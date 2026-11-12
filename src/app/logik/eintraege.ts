// Neue, schemagültige Einträge für die Projektlisten (Standardwerte nach src/model/typen.ts), IDs aus dem Zähler je Liste
// (AF-010), und Löschen mit Abhängigkeiten (AF-009): abhängige Einträge finden, Verweise entfernen, Eintrag löschen.
import type {
  Audit, ControlEintrag, DokumentEintrag, EigenesControl, Feststellung, Folgenabschaetzung, InteressiertePartei, KiSystem,
  Kommunikation, Kompetenz, Lieferant, Managementbewertung, Massnahme, Nachweis, Person, Projekt, Rahmenwerk, Risiko, Rolle, Ziel,
} from '../../model/typen.ts';
import { ENTSCHEIDE, VERTRAUENSMERKMALE } from '../../model/typen.ts';
import { VERWEISE, teile, type Verweisart, type Zielliste } from '../../model/verweise.ts';
import { idMerken, istZaehlerListe, vergibId, type ListenName, type ZaehlerListe } from './ids.ts';
import { lies, setze } from './pfad.ts';

type Fabrik = (id: string) => object;

const FABRIKEN: Record<ListenName, Fabrik> = {
  personen: (id): Person => ({ id, name: '', funktion: '', aimsRollen: [] }),
  parteien: (id): InteressiertePartei => ({ id, name: '', art: 'extern', anforderungen: [] }),
  rollen: (id): Rolle => ({ id, bereich: '', konsultiert: [], informiert: [] }),
  kiSysteme: (id): KiSystem => ({
    id, name: '', typ: 'saas', beschreibung: '', zweck: '', fachbereich: '',
    betroffene: '', automatisierung: 'unterstuetzend', lebenszyklus: 'betrieb', status: 'erfasst',
    ressourcen: { daten: '', werkzeuge: '', rechenressourcen: '', personal: '' }, sensibleNutzung: false,
    aiAct: { rollen: [], risikoklasse: 'offen', transparenz: [], gpai: false, begruendung: '', juristischGeprueft: false },
  }),
  risiken: (id): Risiko => ({
    id, art: 'risiko', titel: '', beschreibung: '', quelle: '', ebenen: [], ursache: '', folge: '', bestehendeMassnahmen: '',
    w: null, a: null, wNach: null, aNach: null, controls: [], massnahmen: [], status: 'offen',
  }),
  folgenabschaetzungen: (id): Folgenabschaetzung => ({
    id, kiSystem: '',
    triage: { ergebnis: 'offen', begruendung: '' },
    systembeschreibung: '', verwendungen: '', fehlanwendungen: '', daten: '', einsatzumfeld: '', betroffene: [], nutzenSchaden: {},
    ausfaelle: '', massnahmen: '', sensibleNutzung: false, eingeschraenkteNutzung: false, ergebnis: '',
  }),
  eigeneControls: (id): EigenesControl => ({ id, titel: '', beschreibung: '', quelle: '' }),
  nachweise: (id): Nachweis => ({ id, titel: '', art: 'dokument', ablageort: '' }),
  massnahmen: (id): Massnahme => ({ id, titel: '', beschreibung: '', status: 'offen', prioritaet: 'mittel', herkunft: { art: 'sonstige' } }),
  lieferanten: (id): Lieferant => ({ id, name: '', leistung: '', pruefstatus: 'offen', pruefpunkte: {}, bemerkung: '' }),
  ziele: (id): Ziel => ({ id, ziel: '', kiSysteme: [], kennzahl: '', sollwert: '', messmethode: '', haeufigkeit: '', ressourcen: '', bewertung: '', messungen: [] }),
  kompetenzen: (id): Kompetenz => ({ id, rolle: '', anforderung: '', personen: [], massnahme: '', nachweis: '', wirksamkeit: '', status: 'offen' }),
  kommunikation: (id): Kommunikation => ({ id, was: '', wann: '', mitWem: '', wie: '', richtung: 'intern' }),
  // Umfang Controls und Prozesse als leere Liste (Mehrfachauswahl; leer heisst alle anwendbaren bzw. keine Auswahl)
  audits: (id): Audit => ({ id, art: 'intern', kombiniertMitIsms: false, umfang: '', umfangControls: [], umfangProzesse: [], kriterien: '', auditor: '', unabhaengigkeit: '', ergebnis: '' }),
  feststellungen: (id): Feststellung => ({ id, quelle: 'audit', einstufung: 'beobachtung', beschreibung: '', normbezug: '', korrektur: '', ursache: '', massnahmen: [], status: 'offen' }),
  managementbewertungen: (id): Managementbewertung => ({
    id, kombiniertMitIsms: false, teilnehmende: '',
    eingaben: { statusMassnahmen: '', aenderungenThemen: '', aenderungenParteien: '', leistung: '', verbesserungen: '', weitere: '' },
    entscheide: '', massnahmen: [],
  }),
};

export function neuerDokumentEintrag(id: string): DokumentEintrag {
  return { id, version: '', status: 'entwurf', ablageort: '', giltFuerIsms: false };
}

export function rahmenwerkVon(id: string): Rahmenwerk {
  if (id.startsWith('EUAIA-')) return 'EUAIA';
  if (id.startsWith('RMF-')) return 'NISTRMF';
  if (id.startsWith('EC-')) return 'EIGENE';
  if (id.startsWith('27001-')) return 'ISO27001';
  return 'ISO42001';
}

export function neuerControlEintrag(id: string): ControlEintrag {
  return { id, rahmenwerk: rahmenwerkVon(id), anwendbar: 'offen', begruendung: '', status: 'offen', nachweise: [], umsetzung: '', iso27001: [], kiSysteme: [] };
}

export type AlleListen = ListenName | 'dokumente' | 'controls';

/** Vorlage-Eintrag ohne ID (zum Bestimmen von Feldarten, z. B. ob ein Feld eine Liste ist). */
export function musterEintrag(liste: string): Record<string, unknown> | undefined {
  if (liste === 'dokumente') return neuerDokumentEintrag('D-00') as unknown as Record<string, unknown>;
  if (liste === 'controls') return neuerControlEintrag('A.2.2') as unknown as Record<string, unknown>;
  const f = FABRIKEN[liste as ListenName];
  return f ? (f('X-000') as Record<string, unknown>) : undefined;
}

/** Standardeintrag der Liste mit gegebener ID, ohne eine Nummer zu vergeben (z. B. fest vorgegebene ID). */
export function eintragMitId(liste: ListenName, id: string): Record<string, unknown> {
  return FABRIKEN[liste](id) as Record<string, unknown>;
}

/**
 * Neuer Eintrag mit fortlaufender ID und Vorgabewerten (Punktpfade erlaubt). Vergibt die ID aus dem Zähler der Liste
 * (meta.idZaehler) und zählt ihn im übergebenen Entwurf hoch; `projekt` ist deshalb immer der Entwurf in aendereMit.
 */
export function neuerEintrag(
  projekt: Projekt, liste: ListenName, vorgabe: Record<string, unknown> = {}, filter?: Record<string, readonly unknown[]>,
): Record<string, unknown> {
  let e = FABRIKEN[liste](vergibId(projekt, liste)) as Record<string, unknown>;
  for (const [pfad, wert] of Object.entries(vorgabe)) {
    if (wert !== null && typeof wert === 'object' && !Array.isArray(wert)) {
      for (const [k, v] of Object.entries(wert)) e = setze(e, `${pfad}.${k}`, v);
    } else e = setze(e, pfad, wert);
  }
  return filter ? passendZumFilter(e, filter, projekt[liste] as unknown as readonly Record<string, unknown>[]) : e;
}

/**
 * Neuer Eintrag passend zum Filter der Seite (C4-01): Ein Eintrag, den der Filter nicht zeigt, entstünde ohne Felder
 * (Register) oder gar nicht sichtbar (Guide), z. B. eine RACI-Zeile mit leerem Bereich. Je Schlüssel, dessen Wert nicht passt,
 * gilt der erste Filterwert, den noch kein Eintrag der Liste hat (sonst der erste).
 */
export function passendZumFilter(e: Record<string, unknown>, filter: Record<string, readonly unknown[]>, vorhandene: readonly Record<string, unknown>[]): Record<string, unknown> {
  let r = e;
  for (const [pfad, werte] of Object.entries(filter)) {
    const wert = lies(r, pfad);
    // Listenfelder (z. B. aiAct.rollen) und «*» bleiben unberührt: dort wählt die Person den Wert
    if (!werte.length || werte.includes('*') || Array.isArray(wert) || werte.includes(wert)) continue;
    const belegt = new Set(vorhandene.map((x) => lies(x, pfad)));
    r = setze(r, pfad, werte.find((w) => !belegt.has(w)) ?? werte[0]);
  }
  return r;
}

/** Standardzeile für eingebettete Tabellen; bekannte Pfade erhalten die Pflichtfelder des Modells. */
export function neueTabellenZeile(pfad: string, zeilen: readonly Record<string, unknown>[], spalten: { pfad?: string; typ: string }[]): Record<string, unknown> {
  let z: Record<string, unknown> = {};
  for (const s of spalten) {
    if (!s.pfad) continue;
    // Spalten mit Punktpfad (z. B. wer.tief) als verschachteltes Objekt
    z = setze(z, s.pfad, s.typ === 'zahl' ? null : s.typ === 'janein' ? false : s.typ === 'mehrfach' || s.typ === 'liste-text' ? [] : '');
  }
  const ende = pfad.split('.').pop() ?? '';
  if (ende === 'themen') {
    const max = zeilen.reduce((m, r) => Math.max(m, Number(/^TH-(\d+)$/.exec(String(r['id']))?.[1] ?? 0)), 0);
    return { id: `TH-${String(max + 1).padStart(3, '0')}`, art: 'extern', kategorie: '', beschreibung: '', ...entferneLeere(z) };
  }
  if (ende === 'rollenIso') return { rolle: 'kunde', bemerkung: '', ...entferneLeere(z) };
  if (ende === 'anforderungen') return { text: '', quelle: 'intern', adressiert: 'offen', ...entferneLeere(z) };
  if (ende === 'wahrscheinlichkeit' || ende === 'auswirkung') return { ...z, stufe: zeilen.length + 1, bezeichnung: '', beschreibung: '' };
  if (ende === 'betroffene') return { gruppe: '', art: 'direkt', wirkung: '', konsultiert: false, ...entferneLeere(z) };
  if (ende === 'messungen') return { datum: '', wert: '', ...entferneLeere(z) };
  if (ende === 'ausschluesse') return { was: '', begruendung: '', ...entferneLeere(z) };
  if (ende === 'nichtGemessen') return { was: '', begruendung: '', ...entferneLeere(z) };
  // Mess- und Prüfkonzept (N-03): Merkmal ist Pflicht, Vorschlag das erste noch ohne Prüfung
  if (ende === 'pruefungen') {
    const merkmal = VERTRAUENSMERKMALE.find((m) => !zeilen.some((r) => r['merkmal'] === m)) ?? VERTRAUENSMERKMALE[0];
    return { ...entferneLeere(z), merkmal };
  }
  // Entscheidungsrechte (D-04): ein noch nicht erfasster Entscheid in der Reihenfolge der Vorlage
  if (ende === 'entscheidungsrechte') {
    const offen = ENTSCHEIDE.find((e) => !zeilen.some((r) => r['entscheid'] === e)) ?? 'einfuehren';
    return { entscheid: offen, wer: {} };
  }
  return z;
}

function entferneLeere(z: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(z)
      .map(([k, v]) => [k, v !== null && typeof v === 'object' && !Array.isArray(v) ? entferneLeere(v as Record<string, unknown>) : v] as const)
      .filter(([, v]) => v !== '' && v !== null),
  );
}

// ---- Löschen mit Abhängigkeiten (AF-009) ----

type Objekt = Record<string, unknown>;
const istObjekt = (w: unknown): w is Objekt => typeof w === 'object' && w !== null && !Array.isArray(w);

/** Status, ab denen ein fehlender Verweis zählt (W2: Pflicht erst bei freigegeben, erledigt, wirksam; vorher nur Hinweis) */
export const ENDSTATUS: ReadonlySet<string> = new Set(['freigegeben', 'erledigt', 'wirksam']);

/** Eine Stelle, die auf den zu löschenden Eintrag verweist */
export interface Abhaengigkeit {
  /** Verweisart (Pfad im Schema wie in src/model/verweise.ts) */
  feld: string;
  /** Genauer Ort, z. B. risiken[2].kiSystem */
  pfad: string;
  /** Wurzelfeld des Projekts (Liste oder Bereich) */
  wurzel: string;
  /** Kennung des Eintrags, in dem der Verweis steht (fehlt bei Bereichen wie organisation) */
  quelleId?: string;
  /** Bezeichnung des Eintrags (Name, Titel …), leer, wenn er keine hat */
  name: string;
  /** Status des Eintrags, falls er einen hat */
  status?: string;
  /** Eintrag wird mitgelöscht, statt nur den Verweis zu verlieren (SoA-Zeile eines eigenen Controls) */
  mitGeloescht?: boolean;
}

/** Listen, die der Löschschutz kennt: die 16 Listen mit ID-Präfix und die eigenen Prozesse (PE-01) */
export type LoeschListe = ZaehlerListe;
export const istLoeschListe = istZaehlerListe;

/**
 * Ziellisten (Verweisregister), unter denen ein Eintrag der Liste gefunden wird: eigene Controls stehen auch unter «controls»,
 * eigene Prozesse unter «prozesse»
 */
function zieleVon(liste: LoeschListe): readonly Zielliste[] {
  if (liste === 'eigeneProzesse') return ['prozesse'];
  return liste === 'eigeneControls' ? ['eigeneControls', 'controls'] : [liste];
}

/** Liste mit der Zeile, die zum Eintrag selbst gehört (Stand und Ablauf eines eigenen Prozesses): Verweise darin zählen nicht */
const EIGENE_ZEILE: Partial<Record<LoeschListe, string>> = { eigeneProzesse: 'prozesse' };

interface Ort {
  pfad: string;
  wert: unknown;
  /** Objekt oder Liste, die den Wert direkt enthält */
  behaelter: Objekt | unknown[];
  schluessel: string | number;
  /** Eintrag der Wurzelliste (erstes Listenelement auf dem Pfad) */
  eintrag: unknown;
  /** Liste und Stelle des innersten Listenelements auf dem Pfad (für Verweise der Form `liste[].id`) */
  zeile?: { liste: unknown[]; i: number };
}

function orte(k: unknown, t: readonly string[], i: number, pfad: string, behaelter: Objekt | unknown[] | null, schluessel: string | number, eintrag: unknown, zeile: Ort['zeile'], aus: Ort[]): void {
  if (i === t.length) {
    if (behaelter) aus.push({ pfad, wert: k, behaelter, schluessel, eintrag, ...(zeile ? { zeile } : {}) });
    return;
  }
  const s = t[i]!;
  if (s === '[]') {
    if (Array.isArray(k)) k.forEach((x, j) => orte(x, t, i + 1, `${pfad}[${j}]`, k, j, eintrag === undefined ? x : eintrag, { liste: k, i: j }, aus));
  } else if (s === '{}') {
    if (istObjekt(k)) for (const [n, v] of Object.entries(k)) orte(v, t, i + 1, `${pfad}.${n}`, k, n, eintrag, zeile, aus);
  } else if (istObjekt(k) && Object.hasOwn(k, s)) {
    orte(k[s], t, i + 1, pfad ? `${pfad}.${s}` : s, k, s, eintrag, zeile, aus);
  }
}

/** Zeigt die Stelle (Verweisart, Ort) auf die Kennung `id` einer der Ziellisten? */
function trifft(art: Verweisart, o: Ort, ziele: readonly Zielliste[], id: string): boolean {
  if (typeof o.wert !== 'string' || o.wert.trim() !== id) return false;
  if (art.je) {
    const eltern = Array.isArray(o.behaelter) ? null : o.behaelter;
    const z = art.je.ziele[String(eltern?.[art.je.feld])];
    return !!z && ziele.includes(z);
  }
  return art.ziel.some((z) => ziele.includes(z));
}

function bezeichnung(o: unknown): string {
  if (!istObjekt(o)) return '';
  for (const k of ['name', 'titel', 'ziel', 'was', 'bereich', 'anforderung', 'beschreibung', 'umfang']) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) {
      const text = v.trim().replace(/\s+/g, ' ');
      return text.length > 80 ? `${text.slice(0, 79)}…` : text;
    }
  }
  return '';
}

/** Bezeichnung (Name, Titel …) des Eintrags `id` der Liste, leer, wenn es ihn nicht gibt oder er keine hat */
export function eintragBezeichnung(p: Projekt, liste: LoeschListe, id: string): string {
  const l = p[liste] as unknown as Objekt[] | undefined;
  return bezeichnung(Array.isArray(l) ? l.find((x) => istObjekt(x) && x['id'] === id) : undefined);
}

interface Fund {
  art: Verweisart;
  ort: Ort;
  wurzel: string;
  /** Verweis ist die Kennung einer Zeile (`liste[].id`, z. B. Prozesszeile der Managementbewertung): die Zeile fällt weg */
  zeileWeg: boolean;
}

function funde(p: Projekt, liste: LoeschListe, id: string): Fund[] {
  const ziele = zieleVon(liste);
  const aus: Fund[] = [];
  for (const art of VERWEISE) {
    if (!art.je && !art.ziel.some((z) => ziele.includes(z))) continue;
    const t = teile(art.feld);
    const wurzel = t[0]!;
    const gefunden: Ort[] = [];
    orte(p, t, 0, '', null, '', undefined, undefined, gefunden);
    for (const o of gefunden) {
      if (!trifft(art, o, ziele, id)) continue;
      // Verweise im zu löschenden Eintrag selbst (und in seiner eigenen Zeile) verschwinden mit ihm
      if ((wurzel === liste || wurzel === EIGENE_ZEILE[liste]) && istObjekt(o.eintrag) && o.eintrag['id'] === id) continue;
      const zeileWeg = t.length >= 2 && t.at(-1) === 'id' && t.at(-2) === '[]' && !!o.zeile;
      aus.push({ art, ort: o, wurzel, zeileWeg });
    }
  }
  return aus;
}

/** Zeilen, die zum Eintrag gehören und mit ihm gelöscht werden: Zeile im Anwendbarkeitsregister eines eigenen Controls, Stand und Ablauf eines eigenen Prozesses */
function begleitZeilen(p: Projekt, liste: LoeschListe, id: string): { liste: 'controls' | 'prozesse'; i: number[]; anzeigen: boolean } | null {
  if (liste === 'eigeneControls') return { liste: 'controls', i: (p.controls ?? []).flatMap((c, i) => (c.id === id ? [i] : [])), anzeigen: true };
  if (liste === 'eigeneProzesse') return { liste: 'prozesse', i: (p.prozesse ?? []).flatMap((c, i) => (c.id === id ? [i] : [])), anzeigen: false };
  return null;
}

/**
 * Alle Stellen, die auf den Eintrag `id` der Liste verweisen (nach dem Verweisregister), mit Kennung und Bezeichnung des
 * verweisenden Eintrags. Leer: Der Eintrag lässt sich ohne Folgen löschen.
 */
export function abhaengigeEintraege(p: Projekt, liste: LoeschListe, id: string): Abhaengigkeit[] {
  const aus: Abhaengigkeit[] = [];
  const b = begleitZeilen(p, liste, id);
  if (b?.anzeigen) {
    for (const i of b.i) {
      const c = p.controls[i]!;
      aus.push({ feld: 'controls[].id', pfad: `controls[${i}]`, wurzel: 'controls', quelleId: c.id, name: bezeichnung(c), status: c.status, mitGeloescht: true });
    }
  }
  for (const { art, ort, wurzel, zeileWeg } of funde(p, liste, id)) {
    const e = ort.eintrag;
    const quelleId = istObjekt(e) && typeof e['id'] === 'string' ? e['id'] : undefined;
    const status = istObjekt(e) && typeof e['status'] === 'string' ? e['status'] : undefined;
    aus.push({ feld: art.feld, pfad: ort.pfad, wurzel, ...(quelleId ? { quelleId } : {}), name: bezeichnung(e), ...(status ? { status } : {}), ...(zeileWeg ? { mitGeloescht: true } : {}) });
  }
  return aus;
}

/** Abhängige Einträge zusammengefasst je verweisendem Eintrag (W3: eine Zeile je Eintrag statt je Feld) */
export interface AbhaengigGruppe {
  wurzel: string;
  quelleId?: string;
  name: string;
  /** Zahl der Verweise dieses Eintrags auf den zu löschenden */
  anzahl: number;
  /** Eintrag hat einen Endstatus (freigegeben, erledigt, wirksam): Der fehlende Verweis zählt dort als Lücke (W2) */
  endstatus: boolean;
  mitGeloescht: boolean;
}

export function gruppiereAbhaengige(liste: readonly Abhaengigkeit[]): AbhaengigGruppe[] {
  const gruppen = new Map<string, AbhaengigGruppe>();
  for (const a of liste) {
    const schluessel = `${a.wurzel}|${a.quelleId ?? ''}`;
    const g = gruppen.get(schluessel);
    if (g) {
      g.anzahl++;
      g.mitGeloescht ||= !!a.mitGeloescht;
    } else {
      gruppen.set(schluessel, {
        wurzel: a.wurzel, ...(a.quelleId ? { quelleId: a.quelleId } : {}), name: a.name, anzahl: 1,
        endstatus: !!a.status && ENDSTATUS.has(a.status), mitGeloescht: !!a.mitGeloescht,
      });
    }
  }
  return [...gruppen.values()];
}

/** Anzeige vor dem Löschen: höchstens `max` Gruppen (W3), Rest als Zahl; Einträge mit Endstatus und mitgelöschte zuerst. */
export interface LoeschVorschau {
  gruppen: AbhaengigGruppe[];
  weitere: number;
  /** Zahl der verweisenden Einträge (Gruppen) */
  eintraege: number;
  /** Zahl der Verweise insgesamt */
  verweise: number;
}

export function loeschVorschau(p: Projekt, liste: LoeschListe, id: string, max = 8): LoeschVorschau {
  const a = abhaengigeEintraege(p, liste, id);
  const g = gruppiereAbhaengige(a);
  const rang = (x: AbhaengigGruppe) => (x.mitGeloescht ? 0 : x.endstatus ? 1 : 2);
  const sortiert = [...g].sort((x, y) => rang(x) - rang(y));
  return { gruppen: sortiert.slice(0, max), weitere: Math.max(0, sortiert.length - max), eintraege: g.length, verweise: a.length };
}

/**
 * Entfernt im Entwurf alle Verweise auf den Eintrag `id` der Liste: Aus Listen wird die Kennung gestrichen, Einzelfelder
 * werden leer, Zeilen mit der Kennung als `id` (Prozesszeilen der Managementbewertung) fallen weg. Zeilen, die zum Eintrag
 * gehören (Register eines eigenen Controls, Stand eines eigenen Prozesses), werden gelöscht. Liefert die Zahl der Stellen.
 */
export function verweiseEntfernen(p: Projekt, liste: LoeschListe, id: string): number {
  const f = funde(p, liste, id);
  const weg: { liste: unknown[]; i: number }[] = [];
  for (const { ort, zeileWeg } of f) {
    if (zeileWeg) weg.push(ort.zeile!);
    else if (Array.isArray(ort.behaelter)) weg.push({ liste: ort.behaelter, i: ort.schluessel as number });
    else ort.behaelter[ort.schluessel as string] = '';
  }
  // Von hinten nach vorn kürzen, damit die Stellen der übrigen Funde stimmen; jede Stelle nur einmal
  const gesehen = new Set<string>();
  const ids = new Map<unknown[], number>();
  const schluessel = (x: { liste: unknown[]; i: number }) => `${ids.get(x.liste) ?? ids.set(x.liste, ids.size).get(x.liste)}|${x.i}`;
  for (const x of weg.sort((a, b) => b.i - a.i)) {
    const k = schluessel(x);
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    x.liste.splice(x.i, 1);
  }
  const b = begleitZeilen(p, liste, id);
  const zeilen = b ? (p[b.liste] as unknown[] | undefined) : undefined;
  if (b && zeilen) for (const i of [...b.i].reverse()) zeilen.splice(i, 1);
  return f.length + (b?.i.length ?? 0);
}

/**
 * Löscht den Eintrag `id` der Liste im Entwurf samt aller Verweise auf ihn (AF-009) und hält seine Nummer im Zähler fest
 * (AF-010), damit sie nie wieder vergeben wird. Liefert false, wenn es den Eintrag nicht gibt.
 */
export function eintragLoeschen(p: Projekt, liste: LoeschListe, id: string): boolean {
  const l = p[liste] as unknown as { id?: unknown }[] | undefined;
  if (!Array.isArray(l) || !l.some((x) => x.id === id)) return false;
  idMerken(p, liste, id);
  verweiseEntfernen(p, liste, id);
  const i = l.findIndex((x) => x.id === id);
  if (i >= 0) l.splice(i, 1);
  // Optionale Liste ohne Einträge fällt weg (wie bisher bei eigenen Prozessen)
  if (liste === 'eigeneProzesse' && !l.length) delete p.eigeneProzesse;
  return true;
}
