// Migrationen der Projektdatei: schemaVersion N -> N+1, nacheinander bis SCHEMA_VERSION.
// Version 1 ist die Basis (veröffentlichte Fassung bis 1.0.0-test.3), Version 2 (ab 1.0.0-test.4) bringt meta.idZaehler
// (AF-010), Version 3 (ab 1.0.0-test.4) Antrag und Entscheid je KI-System sowie Entdeckung und Eindämmung je Vorfall
// (AF-104). Version 2 war nie veröffentlicht, ist aber committet: Dateien der Version 2 gibt es, deshalb eine eigene Stufe.
// Eine neue Version braucht ALLE vier Teile, sonst bricht das Schema-Versionstor (scripts/pruefen/schema-version.mts, G31) oder tests/unit/migration.test.ts:
//   1. SCHEMA_VERSION in typen.ts erhöhen;
//   2. einen Schritt `stufe(N, '…', (p) => { … })` in MIGRATIONEN anhängen (von = alte Version);
//   3. Beispieldateien der neuen Version als tests/fixtures/migration/v<N+1>.<beispiel>.<sprache>.aims.json ablegen
//      und die Datei der alten Version unverändert lassen (sie ist der Prüfling des neuen Schritts);
//   4. Referenz tests/fixtures/migration/schema-v<N+1>.sha256 mit `npx tsx scripts/pruefen/schema-version.mts --schreiben` anlegen.
// Zusätzlich je Schritt ein gezielter Test in tests/unit/migration.test.ts (was der Schritt ändert, Zähler, Verweise).
//
// Regeln für Schritte: nur Daten der eigenen Stufe umbauen; tolerant gegenüber fehlenden Listen, weil auch Auszüge
// (Teilimport, KI-Ergebnis) migriert werden; idempotent in dem Sinn, dass ein Projekt der Zielversion unverändert bleibt
// (das garantiert migriere() ohnehin, weil nur Dateien unterhalb der Zielversion einen Schritt durchlaufen).
import { SCHEMA_VERSION } from './typen.ts';

export type RohProjekt = Record<string, unknown> & { schemaVersion?: unknown };

/** Migration von Version `von` nach `von + 1`. Bekommt eine tiefe Kopie und darf sie verändern. */
export interface Migration {
  von: number;
  beschreibung: string;
  migriere(p: RohProjekt): RohProjekt;
}

/**
 * Hilfsfunktion für neue Stufen: Schritt, der die Kopie an Ort und Stelle ändert (kein Rückgabewert nötig).
 * schemaVersion setzt migriere(); der Schritt fasst sie nicht an.
 */
export function stufe(von: number, beschreibung: string, aendere: (p: RohProjekt) => void): Migration {
  return {
    von,
    beschreibung,
    migriere(p) {
      aendere(p);
      return p;
    },
  };
}

type Objekt = Record<string, unknown>;
const istObjekt = (w: unknown): w is Objekt => typeof w === 'object' && w !== null && !Array.isArray(w);

/** Ruft `fn` für jeden Objekt-Eintrag der Liste `liste` des Projekts auf; fehlt die Liste oder ist sie kein Array, passiert nichts. */
export function fuerJedenEintrag(p: RohProjekt, liste: string, fn: (eintrag: Objekt, index: number) => void): void {
  const l = p[liste];
  if (!Array.isArray(l)) return;
  l.forEach((e, i) => {
    if (istObjekt(e)) fn(e, i);
  });
}

/**
 * Präfixe der fortlaufenden IDs im Stand der Schemaversion 1 und 2. Bewusst eine eigene Kopie statt ID_PRAEFIX: Ein späterer
 * Schritt darf Präfixe umbenennen (AF-013), der Schritt 1 -> 2 muss trotzdem die alten Kennungen lesen.
 */
export const PRAEFIXE_V2: Readonly<Record<string, string>> = {
  personen: 'P', parteien: 'IP', rollen: 'RO', kiSysteme: 'KI', risiken: 'R', folgenabschaetzungen: 'IA', eigeneControls: 'EC', nachweise: 'N',
  massnahmen: 'M', lieferanten: 'L', ziele: 'Z', kompetenzen: 'K', kommunikation: 'KO', audits: 'AU', feststellungen: 'F', managementbewertungen: 'MB',
  eigeneProzesse: 'PE',
};

/** Höchste Nummer der Kennungen `<präfix>-<nummer>` in der Liste (0 ohne passende Kennung) */
export function hoechsteNummer(eintraege: unknown, praefix: string): number {
  if (!Array.isArray(eintraege)) return 0;
  const muster = new RegExp(`^${praefix}-(\\d+)$`);
  let max = 0;
  for (const e of eintraege) {
    const m = istObjekt(e) && typeof e['id'] === 'string' ? muster.exec(e['id']) : null;
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

/**
 * 1 -> 2 (AF-010): meta.idZaehler je Liste aus der höchsten vergebenen ID. Nur Listen, die in der Datei stehen (ein Auszug
 * ohne eine Liste bekommt für sie keinen Zähler); ein Auszug ohne meta bleibt ohne Zähler. Verweise und IDs bleiben, wie sie sind.
 */
const schritt1: Migration = stufe(1, 'Zähler der IDs je Liste (meta.idZaehler) aus der höchsten vergebenen ID', (p) => {
  const meta = p['meta'];
  if (!istObjekt(meta)) return;
  const zaehler: Record<string, number> = {};
  for (const [liste, praefix] of Object.entries(PRAEFIXE_V2)) if (Array.isArray(p[liste])) zaehler[liste] = hoechsteNummer(p[liste], praefix);
  // Ein schon vorhandener (höherer) Zähler bleibt: Zähler sinken nie
  const alt = istObjekt(meta['idZaehler']) ? meta['idZaehler'] : {};
  for (const [liste, n] of Object.entries(alt)) if (typeof n === 'number' && Number.isInteger(n) && n > (zaehler[liste] ?? -1)) zaehler[liste] = n;
  meta['idZaehler'] = zaehler;
});

/** Status eines KI-Systems mit Entscheid über den Antrag (Freigabe, Freigabe mit Auflagen, Ablehnung) */
const ENTSCHIEDEN = new Set(['freigegeben', 'eingeschraenkt', 'ausgesetzt', 'untersagt']);
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const ZEITPUNKT = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/**
 * 2 -> 3 (AF-104): Datenquellen der Kennzahlen PR-07 und PR-19.
 * - KI-Systeme mit Entscheid (Status freigegeben, eingeschränkt, ausgesetzt oder untersagt) und Freigabedatum:
 *   entscheidAm = freigabe.am (Freigabe, Auflagen oder Untersagung sind der Entscheid). antragAm bleibt leer: Die
 *   Erfassung im Inventar ist kein belegter Antrag (Bestand aus der Erstinventur); F43 führt zur Eingabe (Entscheid P14).
 *   Ohne Freigabedatum bleibt auch entscheidAm leer (kein erfundener Entscheid).
 * - Feststellungen mit Quelle Vorfall oder Beinahe-Vorfall, deren datum eine Uhrzeit trägt (bis Version 2 der einzige
 *   Ort für den Zeitpunkt, den F43 las), ohne entdecktAm: entdecktAm = der ganze Wert von datum (Uhrzeit mit Sekunden
 *   und Zone bleiben erhalten), datum wird das Datum. Ist entdecktAm schon gesetzt, bleibt datum unverändert. Ein bis
 *   Version 2 nicht im Schema geführtes eingedaemmtAm bleibt stehen und ist jetzt gültig.
 * Vorhandene Werte der Zielfelder werden nie überschrieben.
 */
const schritt2: Migration = stufe(2, 'Entscheid je KI-System aus der Freigabe (D-10, PR-07; Antrag bleibt leer), Entdeckung je Vorfall (D-22, PR-19)', (p) => {
  fuerJedenEintrag(p, 'kiSysteme', (s) => {
    const freigabe = istObjekt(s['freigabe']) ? s['freigabe']['am'] : undefined;
    if (typeof freigabe !== 'string' || !DATUM.test(freigabe.slice(0, 10)) || !ENTSCHIEDEN.has(String(s['status']))) return;
    if (s['entscheidAm'] === undefined) s['entscheidAm'] = freigabe.slice(0, 10);
  });
  fuerJedenEintrag(p, 'feststellungen', (f) => {
    if ((f['quelle'] !== 'vorfall' && f['quelle'] !== 'beinahe-vorfall') || f['entdecktAm'] !== undefined) return;
    const d = f['datum'];
    const m = typeof d === 'string' ? ZEITPUNKT.exec(d) : null;
    if (!m) return;
    f['entdecktAm'] = d;
    f['datum'] = m[1];
  });
});

/** Alle Migrationen, aufsteigend. Version 1 ist die erste veröffentlichte Fassung. */
export const MIGRATIONEN: Migration[] = [schritt1, schritt2];

export type MigrationsFehlerArt = 'keine-version' | 'zu-neu' | 'luecke';

export class MigrationsFehler extends Error {
  constructor(
    readonly art: MigrationsFehlerArt,
    readonly version: number | null,
    meldung: string,
  ) {
    super(meldung);
  }
}

export interface MigrationsErgebnis {
  projekt: RohProjekt;
  vonVersion: number;
  angewendet: string[];
}

/**
 * Prüft nur die Versionsangabe einer Datei gegen die Zielversion: fehlend oder ungültig ('keine-version') oder höher als
 * bekannt ('zu-neu'). Gemeinsame Regel für Projektdatei, Teilimport und KI-Ergebnis; ältere Versionen sind immer zulässig
 * (sie werden migriert). Gibt den Fehler zurück, wirft nicht.
 */
export function pruefeSchemaVersion(roh: { schemaVersion?: unknown }, ziel: number = SCHEMA_VERSION): MigrationsFehler | null {
  const v = roh.schemaVersion;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return new MigrationsFehler('keine-version', null, 'schemaVersion fehlt oder ist ungültig');
  if (v > ziel) return new MigrationsFehler('zu-neu', v, `Version ${v} ist neuer als ${ziel}`);
  return null;
}

/**
 * Prüft die Kette auf Form: je Version von 1 bis ziel-1 genau ein Schritt, keine Schritte darüber oder darunter.
 * Gibt die Probleme als Text zurück (leer = in Ordnung). Das Versionstor und der Migrationstest rufen sie auf.
 */
export function pruefeKette(migrationen: readonly Migration[] = MIGRATIONEN, ziel: number = SCHEMA_VERSION): string[] {
  const probleme: string[] = [];
  const gesehen = new Set<number>();
  for (const m of migrationen) {
    if (!Number.isInteger(m.von) || m.von < 1 || m.von >= ziel) probleme.push(`Schritt von Version ${m.von} liegt ausserhalb 1 bis ${ziel - 1}`);
    if (gesehen.has(m.von)) probleme.push(`Mehrere Schritte von Version ${m.von}`);
    gesehen.add(m.von);
  }
  for (let v = 1; v < ziel; v++) if (!gesehen.has(v)) probleme.push(`Schritt von Version ${v} auf ${v + 1} fehlt`);
  return probleme;
}

/** Hebt ein geparstes Projekt auf die aktuelle Version. Wirft MigrationsFehler mit Art für die Meldung. */
export function migriere(
  roh: RohProjekt,
  migrationen: Migration[] = MIGRATIONEN,
  ziel: number = SCHEMA_VERSION,
): MigrationsErgebnis {
  const fehler = pruefeSchemaVersion(roh, ziel);
  if (fehler) throw fehler;
  const v = roh.schemaVersion as number;
  let p: RohProjekt = structuredClone(roh);
  const angewendet: string[] = [];
  for (let aktuell = v; aktuell < ziel; aktuell++) {
    const m = migrationen.find((x) => x.von === aktuell);
    if (!m) throw new MigrationsFehler('luecke', aktuell, `Keine Migration von Version ${aktuell}`);
    p = m.migriere(p);
    p.schemaVersion = aktuell + 1;
    angewendet.push(`${aktuell}->${aktuell + 1}: ${m.beschreibung}`);
  }
  return { projekt: p, vonVersion: v, angewendet };
}
