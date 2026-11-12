// Projektdatei einlesen: Grösse, JSON, Version und Migration, Schema-Prüfung (Ajv standalone, ohne eval).
import { logoBereinigenImProjekt, logoDataUrlUebernehmen } from '../../model/gestaltung.ts';
import { migriere, MigrationsFehler, pruefeSchemaVersion } from '../../model/migrationen.ts';
import { SCHEMA_VERSION, type Projekt } from '../../model/typen.ts';
import pruefeSchema from '../../generiert/projekt-validator.mjs';
import { technikText } from '../speicher/technik.ts';
import { GRENZEN, groesseText, JSON_MAX_TIEFE } from '../../eingang/grenzen.ts';
import { EingangsFehler, jsonLesen } from '../../eingang/lesen.ts';
import { idMerken, ZAEHLER_PRAEFIX, type ZaehlerListe } from '../logik/ids.ts';

/** Obergrenze für Projektdateien. Grössere Dateien sind fast sicher keine Projektdateien (oder beschädigt). */
export const MAX_BYTES = GRENZEN.projektdatei.maxBytes;

export type LadeFehlerArt = 'leer' | 'zu-gross' | 'kein-json' | 'kein-projekt' | 'keine-version' | 'zu-neu' | 'luecke' | 'schema';

export type LadeErgebnis =
  | { ok: true; projekt: Projekt; vonVersion: number; migrationen: string[] }
  | { ok: false; art: LadeFehlerArt; details: string[]; version?: number | null; schema?: SchemaFehler[]; technik?: string };

export interface SchemaFehler {
  instancePath: string;
  keyword: string;
  message?: string;
  params: Record<string, unknown>;
}

/** Textbausteine der Fehlermeldungen (UI-Sprache); Platzhalter {ort}, {feld}, {werte}, {typ}, {anzahl}. */
export interface SchemaFehlerFormat {
  wurzel: string;
  fehlt: string;
  unbekannt: string;
  wert: string;
  typ: string;
  sonst: string;
  weitere: string;
  /** Text zu lang ({max}) */
  zu_lang?: string;
  /** Format verletzt (Pattern) */
  muster?: string;
  /** Kein gültiges Datum */
  datum?: string;
  /** Kennung mehrfach vergeben ({wert}) */
  doppelt?: string;
  /** Text mit einzelnem Surrogat, ungültiges Unicode */
  zeichen?: string;
  /** Feldname zu lang ({max}) */
  schluessel?: string;
  /** Feldnamen in Klartext (C2-13) */
  felder?: Record<string, string>;
  /** Bezeichnungen der Listen in der Einzahl, für Klartext statt massnahmen[0] */
  listen?: Record<string, string>;
  /** Zusatz einer Änderung: bisheriger Wert ({wert}) */
  war?: string;
  /** Zusatz: Wert gesetzt ({wert}) */
  gesetzt?: string;
  /** Listeneintrag entfernt */
  entfernt?: string;
}

const FORMAT_DE: SchemaFehlerFormat = {
  wurzel: '(Wurzel)',
  fehlt: '{ort}: Angabe «{feld}» fehlt',
  unbekannt: '{ort}: unbekanntes Feld «{feld}»',
  wert: '{ort}: unzulässiger Wert (erlaubt: {werte})',
  typ: '{ort}: falscher Datentyp (erwartet {typ})',
  sonst: '{ort}: {feld}',
  weitere: '… {anzahl} weitere',
  zu_lang: '{ort}: Text zu lang (höchstens {max} Zeichen)',
  muster: '{ort}: Format nicht zulässig',
  datum: '{ort}: kein gültiges Datum',
  doppelt: '{ort}: Kennung «{wert}» mehrfach vergeben',
  zeichen: '{ort}: ungültiges Zeichen',
  schluessel: '{ort}: Feldname zu lang (höchstens {max} Zeichen)',
  war: 'bisher «{wert}»',
  gesetzt: 'neu «{wert}»',
  entfernt: 'Eintrag entfernt',
  listen: { personen: 'Person', parteien: 'Partei', rollen: 'Rolle', kiSysteme: 'KI-System', risiken: 'Risiko', folgenabschaetzungen: 'Folgenabschätzung', controls: 'Control', eigeneControls: 'Eigenes Control', nachweise: 'Nachweis', dokumente: 'Dokument', massnahmen: 'Massnahme', lieferanten: 'Lieferant', ziele: 'Ziel', kompetenzen: 'Kompetenz', kommunikation: 'Kommunikation', audits: 'Audit', feststellungen: 'Feststellung', managementbewertungen: 'Managementbewertung', prozesse: 'Prozess', eigeneProzesse: 'Eigener Prozess' },
  felder: { personen: 'Personen', schemaVersion: 'Version des Dateiformats', meta: 'Projektangaben', organisation: 'Organisation', termin: 'Termin', datum: 'Datum', titel: 'Titel', name: 'Name', status: 'Status', eigner: 'Eigner/in', von: 'Person', am: 'Datum', freigabe: 'Freigabe' },
};

const fuelle = (vorlage: string, w: Record<string, string | number>) => vorlage.replace(/\{(\w+)\}/g, (m, k: string) => (k in w ? String(w[k]) : m));

/** Ort eines Fehlers lesbar: /kiSysteme/2/typ -> kiSysteme[2].typ */
export function fehlerOrt(instancePath: string): string {
  return instancePath.replace(/^\//, '').split('/').reduce((a, t) => (/^\d+$/.test(t) ? `${a}[${t}]` : a ? `${a}.${t}` : t), '');
}

/** Ort in Klartext: «Massnahme M-001, termin» statt massnahmen[0].termin, wenn die Daten vorliegen. */
function ortKlartext(instancePath: string, fmt: SchemaFehlerFormat, daten?: unknown): string {
  const roh = fehlerOrt(instancePath) || fmt.wurzel;
  const teile = pfadTeile(instancePath);
  const [liste, index] = teile;
  if (!liste || index === undefined || !/^\d+$/.test(index) || !daten || typeof daten !== 'object') return roh;
  const eintrag = (daten as Record<string, unknown[] | undefined>)[liste]?.[Number(index)] as { id?: unknown } | undefined;
  const id = typeof eintrag?.id === 'string' && eintrag.id ? eintrag.id : `#${Number(index) + 1}`;
  const rest = teile.slice(2).map((s, i, a) => (/^\d+$/.test(s) ? `${Number(s) + 1}` : (fmt.felder?.[s] ?? (a.length > 1 ? s : fehlerOrt(`/${s}`))))).join(', ');
  return `${fmt.listen?.[liste] ?? liste} ${id}${rest ? `, ${rest}` : ''}`;
}

const feldKlar = (feld: string, fmt: SchemaFehlerFormat): string => fmt.felder?.[feld] ?? feld;

/** Verständliche Kurzform der Schemafehler, höchstens `max` Zeilen. Gleichartige Folgefehler (anyOf/oneOf) entfallen. */
export function schemaFehlerText(fehler: readonly SchemaFehler[], max = 8, fmt: SchemaFehlerFormat = FORMAT_DE, daten?: unknown): string[] {
  const relevant = fehler.filter((f) => f.keyword !== 'anyOf' && f.keyword !== 'oneOf' && f.keyword !== 'if');
  const gesehen = new Set<string>();
  const zeilen: string[] = [];
  for (const f of relevant) {
    const ort = ortKlartext(f.instancePath, fmt, daten);
    let z: string;
    if (f.keyword === 'required') z = fuelle(fmt.fehlt, { ort, feld: feldKlar(String(f.params['missingProperty']), fmt) });
    else if (f.keyword === 'additionalProperties') z = fuelle(fmt.unbekannt, { ort, feld: String(f.params['additionalProperty']) });
    else if (f.keyword === 'enum') z = fuelle(fmt.wert, { ort, werte: ((f.params['allowedValues'] as unknown[] | undefined) ?? []).map(String).join(', ') });
    else if (f.keyword === 'const') z = fuelle(fmt.wert, { ort, werte: String(f.params['allowedValue']) });
    else if (f.keyword === 'type') z = fuelle(fmt.typ, { ort, typ: String(f.params['type']) });
    else if (f.keyword === 'maxLength') z = fuelle(fmt.zu_lang ?? FORMAT_DE.zu_lang!, { ort, max: String(f.params['limit']) });
    else if (f.keyword === 'pattern') z = fuelle(fmt.muster ?? FORMAT_DE.muster!, { ort });
    else if (f.keyword === 'datum') z = fuelle(fmt.datum ?? FORMAT_DE.datum!, { ort });
    else if (f.keyword === 'doppelt') z = fuelle(fmt.doppelt ?? FORMAT_DE.doppelt!, { ort, wert: String(f.params['wert']) });
    else if (f.keyword === 'zeichen') z = fuelle(fmt.zeichen ?? FORMAT_DE.zeichen!, { ort });
    else if (f.keyword === 'schluessel') z = fuelle(fmt.schluessel ?? FORMAT_DE.schluessel!, { ort, max: String(f.params['limit']) });
    // Jede andere Regel (Zahlbereich, Länge, Format): allgemeiner Klartext; der englische Text von Ajv bleibt aussen vor (AF-015)
    else z = fuelle(fmt.muster ?? FORMAT_DE.muster!, { ort });
    if (gesehen.has(z)) continue;
    gesehen.add(z);
    zeilen.push(z);
  }
  if (zeilen.length > max) return [...zeilen.slice(0, max), fuelle(fmt.weitere, { anzahl: zeilen.length - max })];
  return zeilen;
}

const NUR_DATUM = /^(\d{4})-(\d{2})-(\d{2})([\s\S]*)$/;

/**
 * Echtes Kalenderdatum? 2026-13-45 und 2026-02-30 nicht. Jahre unter 100 sind gültig (0026-03-15 entsteht beim Tippen eines
 * zweistelligen Jahrs). Hinter dem Datum darf eine gültige Zeit oder, durch ein Leerzeichen getrennt, ein Text stehen.
 */
export function datumGueltig(w: string): boolean {
  const m = NUR_DATUM.exec(w);
  if (!m) return false;
  const [j, mo, t] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(0);
  d.setUTCFullYear(j, mo - 1, t);
  if (d.getUTCFullYear() !== j || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== t) return false;
  const rest = m[4]!;
  if (rest === '') return true;
  const zeit = /^[T ](\d{1,2}:[\s\S]*)$/.exec(rest) ?? (rest.startsWith('T') ? [rest, rest.slice(1)] : null);
  if (zeit) return !Number.isNaN(new Date(`2000-01-01T${zeit[1]}`).getTime());
  return rest.startsWith(' ');
}

/** Listen des Projekts, deren Kennungen eindeutig sein müssen (Verweise und Dateinamen hängen daran). */
const LISTEN_MIT_ID = [
  'personen', 'parteien', 'rollen', 'kiSysteme', 'risiken', 'folgenabschaetzungen', 'controls', 'eigeneControls', 'nachweise', 'dokumente',
  'massnahmen', 'lieferanten', 'ziele', 'kompetenzen', 'kommunikation', 'audits', 'feststellungen', 'managementbewertungen', 'prozesse', 'eigeneProzesse',
];

/**
 * Grenzen aller Textfelder. Sie stehen hier statt im Schema: Ajv erzeugt je Feld Prüfcode, der Validator liegt unkomprimiert in
 * der App (Grössenbudget). Bezeichnungen sind kurz, Rohdaten aus draw.io lang, der Rest Fliesstext. Grenzen aus typen.ts gelten
 * zusätzlich und sind teils enger.
 */
export const TEXT_GRENZEN = { kurz: 500, standard: 100_000, lang: 400_000 } as const;
export const KURZE_FELDER = new Set(['name', 'bezeichnung', 'id', 'kurzname', 'firma', 'funktion']);
const LANGE_FELDER = new Set(['roh', 'xml', 'png', 'svg']);
/** Datumsfelder laut Datenmodell: leer, Datum oder Zeitstempel. Nur Felder dieser Art werden als Datum gelesen. */
const DATUM_FELD = /^(am|bis|datum|erstellt|geaendert|faellig|stichtag)$|[a-z](Am|Bis)$/;
/**
 * Felder mit Datumseingabe im Formular, die ältere Dateien auch als Text führen («Q1 2026»): Text bleibt, nur ein unmögliches
 * Datum (2026-13-45) gilt als Fehler, weil Fristen damit rechnen.
 */
export const DATUM_FELD_WEICH = new Set([
  'termin', 'geplant', 'durchgefuehrt', 'abgerufen', 'abkuendigung', 'naechstePruefung', 'naechsteUeberpruefung', 'letzteDurchfuehrung', 'naechsteFaelligkeit',
  'wiedervorlage', 'wirksamkeitGeplant', 'zielterminStage1', 'zielterminZertifizierung',
]);
export const istDatumFeld = (feld: string): boolean => DATUM_FELD.test(feld) || DATUM_FELD_WEICH.has(feld);
/** Grenze für Feldnamen (Schlüssel freier Zuordnungen wie antworten) */
const MAX_SCHLUESSEL = 500;
const wohlgeformt = (s: string): boolean => (s as string & { isWellFormed?: () => boolean }).isWellFormed?.() ?? !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);
const kuerzenUtf16 = (s: string, n: number): string => {
  const t = s.slice(0, n);
  return /[\uD800-\uDBFF]$/.test(t) ? t.slice(0, -1) : t;
};
const pfadTeil = (k: string): string => k.replace(/~/g, '~0').replace(/\//g, '~1');

/** Was das Schema nicht ausdrückt: Länge jedes Texts, echte Kalenderdaten, eindeutige Kennungen. */
function inhaltPruefen(daten: unknown): SchemaFehler[] {
  const fehler: SchemaFehler[] = [];
  const gehe = (w: unknown, pfad: string, feld: string): void => {
    if (typeof w === 'string') {
      const limit = KURZE_FELDER.has(feld) ? TEXT_GRENZEN.kurz : LANGE_FELDER.has(feld) ? TEXT_GRENZEN.lang : TEXT_GRENZEN.standard;
      if (w.length > limit) fehler.push({ instancePath: pfad, keyword: 'maxLength', params: { limit } });
      else if (!wohlgeformt(w)) fehler.push({ instancePath: pfad, keyword: 'zeichen', params: {} });
      // Freie Texte dürfen mit einem Datum beginnen: Nur Felder, die das Modell als Datum führt, werden als Datum geprüft
      else if (DATUM_FELD.test(feld) ? w !== '' && !datumGueltig(w) : DATUM_FELD_WEICH.has(feld) && w.length <= 40 && /^\d{4}-\d{2}-\d{2}(?:[T ]|$)/.test(w) && !datumGueltig(w)) fehler.push({ instancePath: pfad, keyword: 'datum', params: {} });
    // Listen: Name des Felds gilt nicht für die Werte (bibliothek.abgleich.geaendert ist eine Liste von Kennungen)
    } else if (Array.isArray(w)) w.forEach((x, i) => gehe(x, `${pfad}/${i}`, ''));
    else if (w && typeof w === 'object') {
      for (const k of Object.keys(w)) {
        if (k.length > MAX_SCHLUESSEL || !wohlgeformt(k)) fehler.push({ instancePath: `${pfad}/${pfadTeil(k.slice(0, 40))}`, keyword: 'schluessel', params: { limit: MAX_SCHLUESSEL, schluessel: k } });
        else gehe((w as Record<string, unknown>)[k], `${pfad}/${pfadTeil(k)}`, k);
      }
    }
  };
  gehe(daten, '', '');
  const roh = daten as Record<string, unknown>;
  for (const liste of LISTEN_MIT_ID) {
    const l = roh[liste];
    if (!Array.isArray(l)) continue;
    const gesehen = new Set<string>();
    l.forEach((e: { id?: unknown }, i) => {
      if (typeof e?.id !== 'string') return;
      if (gesehen.has(e.id)) fehler.push({ instancePath: `/${liste}/${i}/id`, keyword: 'doppelt', params: { wert: e.id } });
      gesehen.add(e.id);
    });
  }
  return fehler;
}

export function pruefeProjektDaten(daten: unknown): { ok: true } | { ok: false; fehler: SchemaFehler[] } {
  const ok = pruefeSchema(daten);
  if (!ok) return { ok: false, fehler: [...((pruefeSchema.errors ?? []) as SchemaFehler[])] };
  const inhalt = inhaltPruefen(daten);
  return inhalt.length ? { ok: false, fehler: inhalt } : { ok: true };
}

function pfadTeile(instancePath: string): string[] {
  return instancePath.split('/').slice(1).map((t) => t.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/** Standardwert für ein Pflichtfeld, wenn das Schema einen bestimmten Typ verlangt */
function standardNachTyp(typ: unknown): unknown {
  const t = Array.isArray(typ) ? typ[0] : String(typ).split(',')[0];
  return ({ string: '', number: 0, integer: 0, boolean: false, array: [], object: {}, null: null } as Record<string, unknown>)[t as string];
}

function wertKurz(w: unknown): string {
  const s = typeof w === 'string' ? w : JSON.stringify(w) ?? '';
  return s.length > 60 ? `${[...s.slice(0, 60)].join('')}…` : s;
}

/**
 * Reparaturweg: Stellen, die die Prüfung verletzen, so ändern, dass die Datei wieder lesbar ist. Zu lange Texte werden
 * gekürzt, doppelte Kennungen umbenannt, unbekannte Felder fallen weg, ungültige Werte auch. Pflichtfelder erhalten einen
 * Standardwert des Schemas (Erlaubtes aus enum, Leerwert des Typs); ist auch das nicht möglich, fällt der Listeneintrag weg.
 * Jede Änderung steht mit dem bisherigen Wert in der Liste. Null, wenn das Projekt auch danach nicht gültig ist.
 * Vorher wird die Datei wie beim Öffnen auf die aktuelle Schemaversion gehoben (migriere); lässt sie sich nicht heben
 * (Version fehlt oder ist zu neu), repariert der Weg die Datei, wie sie ist. Weggefallene Einträge der Listen mit Zähler
 * halten ihre Nummer in meta.idZaehler fest (AF-010), damit sie nicht wieder vergeben wird.
 */
export function projektReparieren(roh: unknown, fmt: SchemaFehlerFormat = FORMAT_DE): { projekt: Projekt; aenderungen: string[] } | null {
  let p: Record<string, unknown>;
  try {
    p = migriere(roh as Record<string, unknown>).projekt;
  } catch {
    p = structuredClone(roh) as Record<string, unknown>;
  }
  /** Liste mit Zähler, zu der ein weggefallener Eintrag gehört (Wurzelliste des Projekts) */
  const zaehlerListe = (liste: unknown[]): ZaehlerListe | undefined => (Object.keys(ZAEHLER_PRAEFIX) as ZaehlerListe[]).find((l) => p[l] === liste);
  const merken = (liste: ZaehlerListe, eintrag: unknown): void => {
    const meta = p['meta'];
    if (meta === null || typeof meta !== 'object' || Array.isArray(meta) || eintrag === null || typeof eintrag !== 'object') return;
    const z = (meta as Record<string, unknown>)['idZaehler'];
    if (z !== undefined && (z === null || typeof z !== 'object' || Array.isArray(z))) return;
    idMerken(p as unknown as Pick<Projekt, 'meta'>, liste, (eintrag as Record<string, unknown>)['id']);
  };
  const aenderungen: string[] = [];
  const gesehen = new Set<string>();
  // Von der Reparatur gesetzte Pflichtfelder: Hier darf nicht gelöscht werden, sonst läuft es im Kreis
  const gefuellt = new Set<string>();
  const notiere = (f: SchemaFehler, zusatz: string): void => {
    const ort = `${f.instancePath}|${f.keyword}|${String(f.params['missingProperty'] ?? '')}`;
    if (gesehen.has(ort)) return;
    gesehen.add(ort);
    const [zeile] = schemaFehlerText([f], 1, fmt, p);
    aenderungen.push(`${zeile ?? fehlerOrt(f.instancePath)}${zusatz ? ` (${zusatz})` : ''}`);
  };
  const war = (w: unknown): string => (w === undefined || w === '' ? '' : fuelle(fmt.war ?? FORMAT_DE.war!, { wert: wertKurz(w) }));
  const holen = (teile: readonly string[]): unknown => {
    let x: unknown = p;
    for (const t of teile) {
      if (x === null || typeof x !== 'object' || !Object.hasOwn(x, t)) return undefined;
      x = (x as Record<string, unknown>)[t];
    }
    return x;
  };
  for (let runde = 0; runde < 60; runde++) {
    const r = pruefeProjektDaten(p);
    if (r.ok) return { projekt: p as unknown as Projekt, aenderungen };
    let geaendert = false;
    /** Listeneinträge, die wegfallen: erst am Ende der Runde, höchste Stelle zuerst, damit Pfade stimmen */
    const wegfallen = new Map<string, { liste: unknown[]; i: number; f: SchemaFehler }>();
    const eintragEntfernen = (f: SchemaFehler, teile: readonly string[]): boolean => {
      for (let n = teile.length - 1; n >= 1; n--) {
        const liste = holen(teile.slice(0, n));
        if (Array.isArray(liste) && /^\d+$/.test(teile[n]!)) {
          wegfallen.set(`/${teile.slice(0, n + 1).join('/')}`, { liste, i: Number(teile[n]), f });
          return true;
        }
      }
      return false;
    };
    for (const f of r.fehler) {
      const teile = pfadTeile(f.instancePath);
      const name = teile.at(-1);
      const eltern = holen(teile.slice(0, -1));
      if (f.keyword === 'required' || f.keyword === 'anyOf' || f.keyword === 'oneOf' || f.keyword === 'if') continue;
      if (f.keyword === 'additionalProperties') {
        const ziel = (name === undefined ? p : holen(teile)) as Record<string, unknown> | undefined;
        const feld = String(f.params['additionalProperty']);
        if (ziel && typeof ziel === 'object' && Object.hasOwn(ziel, feld)) {
          notiere(f, war(ziel[feld]));
          delete ziel[feld];
          geaendert = true;
        }
        continue;
      }
      if (f.keyword === 'schluessel') {
        const k = String(f.params['schluessel']);
        if (eltern && typeof eltern === 'object' && Object.hasOwn(eltern, k)) {
          notiere(f, '');
          delete (eltern as Record<string, unknown>)[k];
          geaendert = true;
        }
        continue;
      }
      if (name === undefined || eltern === null || typeof eltern !== 'object' || !Object.hasOwn(eltern, name)) continue;
      const e = eltern as Record<string, unknown>;
      const alt = e[name];
      const istGefuellt = gefuellt.has(f.instancePath);
      if (f.keyword === 'maxLength' && typeof alt === 'string') {
        notiere(f, '');
        e[name] = kuerzenUtf16(alt, Number(f.params['limit']));
        geaendert = true;
      } else if (f.keyword === 'zeichen' && typeof alt === 'string') {
        notiere(f, '');
        e[name] = alt.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD');
        geaendert = true;
      } else if (f.keyword === 'doppelt' && typeof alt === 'string') {
        notiere(f, '');
        e[name] = `${alt}-${teile.at(-2)}`;
        geaendert = true;
      } else if (istGefuellt && f.keyword === 'enum') {
        const erlaubt = f.params['allowedValues'] as unknown[] | undefined;
        if (erlaubt?.length) {
          notiere(f, fuelle(fmt.gesetzt ?? FORMAT_DE.gesetzt!, { wert: String(erlaubt[0]) }));
          e[name] = erlaubt[0];
          geaendert = true;
        }
      } else if (istGefuellt && f.keyword === 'const') {
        e[name] = f.params['allowedValue'];
        geaendert = true;
      } else if (istGefuellt && f.keyword === 'type' && standardNachTyp(f.params['type']) !== undefined) {
        e[name] = standardNachTyp(f.params['type']);
        geaendert = true;
      } else if (Array.isArray(e) || istGefuellt) {
        // Ungültiges Listenelement oder Pflichtfeld ohne möglichen Standardwert (Kennung mit Muster): der Eintrag fällt weg
        if (eintragEntfernen(f, teile)) geaendert = true;
      } else if (Object.hasOwn(e, name)) {
        // Ungültiger Wert: Optionales Feld fällt weg, Pflichtfeld kommt in der nächsten Runde als «required» zurück
        notiere(f, war(alt));
        // Eine ungültige Kennung (z. B. PE-0042) wird gleich geleert und der Eintrag fällt danach weg: Die Nummer vorher festhalten (AF-010)
        const eintragsListe = name === 'id' && teile.length >= 3 ? holen(teile.slice(0, -2)) : undefined;
        const zl = Array.isArray(eintragsListe) ? zaehlerListe(eintragsListe) : undefined;
        if (zl) merken(zl, e);
        delete e[name];
        geaendert = true;
      }
    }
    for (const { liste, i, f } of [...wegfallen.values()].sort((a, b) => b.i - a.i)) {
      notiere(f, fmt.entfernt ?? FORMAT_DE.entfernt!);
      const l = zaehlerListe(liste);
      if (l) merken(l, liste[i]);
      liste.splice(i, 1);
    }
    if (wegfallen.size) gefuellt.clear();
    // Weggefallene oder fehlende Pflichtfelder: Standardwert, in den nächsten Runden auf den erlaubten Wert gebracht
    pruefeProjektDaten(p);
    for (const f of (pruefeSchema.errors ?? []) as SchemaFehler[]) {
      if (f.keyword !== 'required') continue;
      const ziel = f.instancePath === '' ? p : holen(pfadTeile(f.instancePath));
      const feld = String(f.params['missingProperty']);
      if (ziel && typeof ziel === 'object' && !Array.isArray(ziel) && !Object.hasOwn(ziel, feld)) {
        notiere(f, '');
        (ziel as Record<string, unknown>)[feld] = '';
        gefuellt.add(`${f.instancePath}/${pfadTeil(feld)}`);
        geaendert = true;
      }
    }
    if (!geaendert) return null;
  }
  return null;
}

/**
 * Einzige Stelle für den Text einer Projektdatei (AF-025): über das Eingangsmodul (AF-018), BOM entfernt, Tiefe und Zahl der Werte
 * begrenzt. Wirft SyntaxError bei ungültigem JSON und EingangsFehler bei einer Grenze.
 */
export function projektTextParsen(text: string): unknown {
  return jsonLesen(text, 'projektdatei');
}

export function ladeProjektText(text: string): LadeErgebnis {
  if (text.length === 0 || (text.length < 1000 && text.trim() === '')) return { ok: false, art: 'leer', details: [] };
  // Zeichen ≈ Bytes; genaue Bytezahl wäre bei 25 MB unnötig teuer
  if (text.length > MAX_BYTES) return { ok: false, art: 'zu-gross', details: [groesseText(text.length)] };
  let roh: unknown;
  try {
    roh = projektTextParsen(text);
  } catch (e) {
    // Grenzen des Eingangsmoduls: Tiefe wie bisher «kein-projekt», zu viele Werte «zu-gross»
    if (e instanceof EingangsFehler) return { ok: false, art: e.grund === 'zu-tief' ? 'kein-projekt' : 'zu-gross', details: [], technik: technikText(e) };
    // Rohtext des Parsers nur als Technikzeile (Fehlerbericht), nicht in der Meldung
    return { ok: false, art: 'kein-json', details: [], technik: technikText(e) };
  }
  return ladeProjektDaten(roh);
}

/** Verschachtelung der Daten ohne Rekursion: Kopieren und Prüfen liefen sonst in einen Stapelüberlauf (Rohtext im Browser) */
function zuTief(roh: unknown, max = JSON_MAX_TIEFE): boolean {
  let ebene: unknown[] = [roh];
  for (let t = 0; ebene.length; t++) {
    if (t > max) return true;
    const naechste: unknown[] = [];
    for (const w of ebene) if (w && typeof w === 'object') for (const k of Object.values(w)) if (k && typeof k === 'object') naechste.push(k);
    ebene = naechste;
  }
  return false;
}

/** Wie ladeProjektText, aber für bereits gelesenes JSON. */
export function ladeProjektDaten(roh: unknown): LadeErgebnis {
  if (roh === null || typeof roh !== 'object' || Array.isArray(roh) || !('meta' in roh || 'schemaVersion' in roh) || zuTief(roh)) {
    return { ok: false, art: 'kein-projekt', details: [] };
  }
  let m;
  try {
    m = migriere(roh as Record<string, unknown>);
  } catch (e) {
    if (e instanceof MigrationsFehler) return { ok: false, art: e.art, details: [], version: e.version, technik: technikText(e) };
    throw e;
  }
  // Veraltetes organisation.logoDataUrl ohne Versionssprung nach organisation.gestaltung.logo (optional, ab 1.1)
  const logo = logoDataUrlUebernehmen(m.projekt);
  if (logo) m.angewendet.push(logo);
  // Logo-SVG aus der Datei durchläuft dieselbe Bereinigung wie beim Hochladen; was nicht bereinigt werden kann, fällt weg
  const logoBereinigt = logoBereinigenImProjekt(m.projekt);
  if (logoBereinigt) m.angewendet.push(logoBereinigt);
  const s = pruefeProjektDaten(m.projekt);
  if (!s.ok) return { ok: false, art: 'schema', details: schemaFehlerText(s.fehler), schema: s.fehler };
  return { ok: true, projekt: m.projekt as unknown as Projekt, vonVersion: m.vonVersion, migrationen: m.angewendet };
}

/** Ergebnis des lesenden Öffnens einer Datei aus einer neueren Version (AF-005) */
export type LesendErgebnis =
  | { ok: true; projekt: Projekt; version: number; bekannt: number; verworfen: number }
  | { ok: false; art: LadeFehlerArt; details: string[]; version?: number | null; technik?: string };

/**
 * Datei mit höherer `schemaVersion` als bekannt (AF-005): nicht migrierbar, aber lesbar. Das Projekt entsteht über den Reparaturweg,
 * der Unbekanntes weglässt (`verworfen` = Zahl der Stellen, die nicht angezeigt werden); es wird nie geschrieben, der Speicher
 * öffnet es nur lesend. Andere Fehler (kein JSON, zu gross, keine Version) bleiben, wie sie sind.
 */
export function ladeProjektLesend(roh: unknown): LesendErgebnis {
  if (roh === null || typeof roh !== 'object' || Array.isArray(roh) || zuTief(roh)) return { ok: false, art: 'kein-projekt', details: [] };
  const fehler = pruefeSchemaVersion(roh as { schemaVersion?: unknown });
  if (!fehler) return { ok: false, art: 'kein-projekt', details: [] };
  if (fehler.art !== 'zu-neu') return { ok: false, art: fehler.art, details: [], version: fehler.version, technik: technikText(fehler) };
  const r = projektReparieren(roh);
  if (!r) return { ok: false, art: 'zu-neu', details: [], version: fehler.version, technik: technikText(fehler) };
  return { ok: true, projekt: r.projekt, version: fehler.version as number, bekannt: SCHEMA_VERSION, verworfen: r.aenderungen.length };
}

export { SCHEMA_VERSION };
/** Höchste Verschachtelung der Projektdaten (Konfiguration des Eingangsmoduls) */
export { JSON_MAX_TIEFE };
