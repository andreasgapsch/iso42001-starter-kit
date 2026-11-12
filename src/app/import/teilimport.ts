// Teilimport des KI-Ergebnisses (Praxis-Befund H11): Gehört die Antwort zum offenen Projekt (gleiche meta.projektId),
// übernimmt das Werkzeug nur die gewählten Einträge und Bereiche. Einträge mit gleicher ID werden ersetzt, neue
// angehängt; alle anderen Listen und Angaben bleiben, wie sie sind. Die Antwort darf ein Auszug sein (schemaVersion,
// meta.projektId und nur die geänderten Listen mit vollständigen Einträgen, Format des Skills); geprüft wird das
// zusammengeführte Projekt.
// Version (AF-003): Die Antwort läuft über migriere() wie jede Projektdatei. Ältere Stände werden auf die aktuelle Version
// gehoben (KI-Antworten aus älteren Skill-Ständen bleiben brauchbar); abgelehnt wird nur eine höhere oder fehlende schemaVersion.
import { migriere, MigrationsFehler, pruefeSchemaVersion, type MigrationsFehlerArt } from '../../model/migrationen.ts';
import { SCHEMA_VERSION, type Projekt } from '../../model/typen.ts';
import { ORGANISATION_NUR_WERKZEUG } from '../../model/gestaltung.ts';
import { pruefeProjektDaten, schemaFehlerText, type SchemaFehler, type SchemaFehlerFormat } from './laden.ts';
import { technikText } from '../speicher/technik.ts';

/** Projektlisten mit ID je Eintrag, in der Reihenfolge der Projektdatei. */
export const TEIL_LISTEN = [
  'personen', 'parteien', 'rollen', 'kiSysteme', 'risiken', 'folgenabschaetzungen', 'controls', 'eigeneControls', 'nachweise', 'dokumente',
  'massnahmen', 'lieferanten', 'ziele', 'kompetenzen', 'kommunikation', 'audits', 'feststellungen', 'managementbewertungen', 'prozesse', 'eigeneProzesse',
] as const;

/** Felder, die nur das Werkzeug setzt (eigener Ablauf, Daten aus draw.io): bleiben beim Ersetzen eines Prozesses erhalten */
const NUR_WERKZEUG_PROZESS = ['schritte', 'bahnen', 'drawio'];
export type TeilListe = (typeof TEIL_LISTEN)[number];

type Objekt = Record<string, unknown>;
const istObjekt = (w: unknown): w is Objekt => typeof w === 'object' && w !== null && !Array.isArray(w);

/** Vergleichbare Form unabhängig von der Reihenfolge der Schlüssel. */
function stabil(w: unknown): string {
  if (Array.isArray(w)) return `[${w.map(stabil).join(',')}]`;
  if (istObjekt(w)) return `{${Object.keys(w).sort().filter((k) => w[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stabil(w[k])}`).join(',')}}`;
  return JSON.stringify(w) ?? 'undefined';
}

export function gleich(a: unknown, b: unknown): boolean {
  return stabil(a) === stabil(b);
}

export interface TeilEintrag {
  id: string;
  titel: string;
  art: 'neu' | 'geaendert';
}

export interface TeilVergleich {
  listen: { liste: TeilListe; eintraege: TeilEintrag[]; gleich: number }[];
  /** Bereiche ohne Einträge: organisation.<schluessel>, gapAnalyse, meta.checklisten */
  bereiche: { pfad: string; art: 'neu' | 'geaendert' }[];
}

function titelVon(o: Objekt): string {
  for (const k of ['name', 'titel', 'ziel', 'rolle', 'was', 'beschreibung', 'bereich', 'kiSystem', 'art']) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/** Ergebnis der Versionsprüfung einer Teilimport-Antwort: auf die aktuelle Version gehobene Daten oder Ablehnung mit Meldung. */
export type TeilVersion =
  | { ok: true; daten: Objekt; vonVersion: number; migrationen: string[] }
  | {
      ok: false;
      art: MigrationsFehlerArt | 'kein-projekt';
      version: number | null;
      /** Technische Kurzmeldung (Fehlerbericht) */
      meldung: string;
      /** Schlüssel der Meldung für die Oberfläche (DE und EN in app.yaml), gleich wie beim Öffnen einer Projektdatei */
      meldungSchluessel: string;
    };

/**
 * Prüft die Version der Antwort und hebt ältere Stände mit migriere() auf die aktuelle Version.
 * Abgelehnt werden nur Antworten mit höherer ('zu-neu') oder fehlender ('keine-version') schemaVersion.
 */
export function teilimportVersion(daten: unknown): TeilVersion {
  if (!istObjekt(daten)) return { ok: false, art: 'kein-projekt', version: null, meldung: 'keine Projektdaten', meldungSchluessel: 'laden.kein-projekt' };
  try {
    const m = migriere(daten);
    return { ok: true, daten: m.projekt, vonVersion: m.vonVersion, migrationen: m.angewendet };
  } catch (e) {
    if (e instanceof MigrationsFehler) return { ok: false, art: e.art, version: e.version, meldung: technikText(e), meldungSchluessel: `laden.${e.art}` };
    throw e;
  }
}

/** Daten auf der aktuellen Version; was sich nicht heben lässt, bleibt unverändert (die Ablehnung meldet teilimportMoeglich). */
function aufAktuelleVersion(daten: Objekt): Objekt {
  if (daten['schemaVersion'] === SCHEMA_VERSION) return daten;
  const v = teilimportVersion(daten);
  return v.ok ? v.daten : daten;
}

/**
 * Gehört die Antwort zum offenen Projekt und hat sie eine zulässige Version (gleich oder älter, dann migriert)?
 * Dann ist ein Teilimport möglich. Warum nicht, sagt teilimportVersion.
 */
export function teilimportMoeglich(aktuell: Projekt | null, daten: unknown): boolean {
  if (!aktuell || !istObjekt(daten) || !istObjekt(daten['meta'])) return false;
  if (pruefeSchemaVersion(daten) !== null) return false;
  return daten['meta']['projektId'] === aktuell.meta.projektId;
}

export function vergleiche(aktuell: Projekt, roh: Objekt): TeilVergleich {
  const daten = aufAktuelleVersion(roh);
  const a = aktuell as unknown as Objekt;
  const listen: TeilVergleich['listen'] = [];
  for (const liste of TEIL_LISTEN) {
    const neu = daten[liste];
    if (!Array.isArray(neu)) continue;
    const alt = new Map(((a[liste] as Objekt[] | undefined) ?? []).map((e) => [String(e['id']), e]));
    const eintraege: TeilEintrag[] = [];
    let gleiche = 0;
    for (const e of neu) {
      if (!istObjekt(e) || typeof e['id'] !== 'string' || !e['id']) continue;
      const vorher = alt.get(e['id']);
      if (vorher && gleich(vorher, e)) gleiche++;
      else eintraege.push({ id: e['id'], titel: titelVon(e), art: vorher ? 'geaendert' : 'neu' });
    }
    if (eintraege.length || gleiche) listen.push({ liste, eintraege, gleich: gleiche });
  }
  const bereiche: TeilVergleich['bereiche'] = [];
  const org = daten['organisation'];
  if (istObjekt(org)) {
    for (const [k, v] of Object.entries(org)) {
      // Gestaltung (Logo, Farben) gehört dem Werkzeug: nie aus Skill-JSON übernehmen, die vorhandene nie überschreiben
      if (ORGANISATION_NUR_WERKZEUG.has(k)) continue;
      const vorher = (aktuell.organisation as unknown as Objekt)[k];
      if (!gleich(vorher, v)) bereiche.push({ pfad: `organisation.${k}`, art: vorher === undefined ? 'neu' : 'geaendert' });
    }
  }
  if (daten['gapAnalyse'] !== undefined && !gleich(aktuell.gapAnalyse, daten['gapAnalyse'])) bereiche.push({ pfad: 'gapAnalyse', art: aktuell.gapAnalyse ? 'geaendert' : 'neu' });
  const meta = daten['meta'];
  if (istObjekt(meta) && istObjekt(meta['checklisten'])) {
    const neue = Object.entries(meta['checklisten']).filter(([k, v]) => !gleich(aktuell.meta.checklisten[k], v));
    if (neue.length) bereiche.push({ pfad: 'meta.checklisten', art: 'geaendert' });
  }
  return { listen, bereiche };
}

export interface TeilAuswahl {
  /** je Liste die zu übernehmenden IDs */
  eintraege: Partial<Record<TeilListe, string[]>>;
  /** Pfade aus TeilVergleich.bereiche */
  bereiche: string[];
}

/** Alles aus dem Vergleich gewählt (Vorbelegung der Vorschau). */
export function alles(v: TeilVergleich): TeilAuswahl {
  return { eintraege: Object.fromEntries(v.listen.map((l) => [l.liste, l.eintraege.map((e) => e.id)])), bereiche: v.bereiche.map((b) => b.pfad) };
}

export function anzahlGewaehlt(a: TeilAuswahl): number {
  return Object.values(a.eintraege).reduce((s, ids) => s + (ids?.length ?? 0), 0) + a.bereiche.length;
}

/** Führt die gewählten Einträge und Bereiche in eine Kopie des offenen Projekts zusammen. */
export function teilimportAnwenden(aktuell: Projekt, roh: Objekt, auswahl: TeilAuswahl): Projekt {
  const daten = aufAktuelleVersion(roh);
  const p = structuredClone(aktuell) as unknown as Objekt;
  for (const liste of TEIL_LISTEN) {
    const ids = new Set(auswahl.eintraege[liste] ?? []);
    const neu = daten[liste];
    if (!ids.size || !Array.isArray(neu)) continue;
    const ziel = ((p[liste] as Objekt[] | undefined) ??= []);
    for (const e of neu) {
      if (!istObjekt(e) || !ids.has(String(e['id']))) continue;
      const i = ziel.findIndex((x) => x['id'] === e['id']);
      const kopie = structuredClone(e);
      if (liste === 'prozesse' && i >= 0) for (const f of NUR_WERKZEUG_PROZESS) if (kopie[f] === undefined && ziel[i]![f] !== undefined) kopie[f] = ziel[i]![f];
      if (i >= 0) ziel[i] = kopie;
      else ziel.push(kopie);
    }
  }
  const org = daten['organisation'];
  for (const pfad of auswahl.bereiche) {
    if (pfad.startsWith('organisation.') && istObjekt(org)) {
      const k = pfad.slice('organisation.'.length);
      if (ORGANISATION_NUR_WERKZEUG.has(k)) continue;
      (p['organisation'] as Objekt)[k] = structuredClone(org[k]);
    } else if (pfad === 'gapAnalyse') {
      p['gapAnalyse'] = structuredClone(daten['gapAnalyse']);
    } else if (pfad === 'meta.checklisten') {
      const quelle = (daten['meta'] as Objekt)['checklisten'] as Objekt;
      Object.assign(((p['meta'] as Objekt)['checklisten'] as Objekt), structuredClone(quelle));
    }
  }
  return p as unknown as Projekt;
}

export type TeilErgebnis = { ok: true; projekt: Projekt } | { ok: false; details: string[]; schema: SchemaFehler[] };

/** Zusammenführen und das Ergebnis wie eine Projektdatei prüfen. */
export function teilimportPruefen(aktuell: Projekt, daten: Objekt, auswahl: TeilAuswahl, fmt?: SchemaFehlerFormat): TeilErgebnis {
  const projekt = teilimportAnwenden(aktuell, daten, auswahl);
  const r = pruefeProjektDaten(projekt);
  return r.ok ? { ok: true, projekt } : { ok: false, details: schemaFehlerText(r.fehler, 8, fmt), schema: r.fehler };
}
