// Klassen der Projektdatei: Befunde E-11, E-15, E-18, E2-01, E2-15, E2-17, E2-18, E2-20
import { pruefeProjektDaten } from '../../../src/app/import/laden.ts';
import { JSON_MAX_TIEFE } from '../../../src/eingang/grenzen.ts';
import { OrakelFehler, type Urteil } from '../typen.ts';
import type { Zufall } from '../zufall.ts';
import { projektdatei as ziel } from '../ziele/projektdatei.ts';
import { festesTestprojekt } from '../ziele/hilfen.ts';
import { text, type Klasse, type KlassenFall } from './typen.ts';

type Roh = Record<string, unknown>;
const grund = (): Roh => festesTestprojekt() as unknown as Roh;
const liste = (p: Roh, name: string): Roh[] => p[name] as Roh[];
const fall = (name: string, p: Roh | string, extra: Partial<KlassenFall> = {}): KlassenFall => ({ name, endung: 'json', daten: typeof p === 'string' ? p : JSON.stringify(p), ...extra });
const ausDatei = (b: Uint8Array): KlassenFall => fall('original', text(b));
const urteile = (f: KlassenFall): Urteil => ziel.urteile(f) as Urteil;
const parse = (f: KlassenFall): Roh => JSON.parse(f.daten as string) as Roh;

/** Freie Textfelder des Testprojekts (Pfad: Liste, Index, Feld oder Objekt, Feld) */
const FREIE_FELDER: [string, string][] = [['risiken', 'titel'], ['risiken', 'beschreibung'], ['risiken', 'ursache'], ['kiSysteme', 'beschreibung'], ['kiSysteme', 'zweck'], ['nachweise', 'titel'], ['ziele', 'ziel'], ['kommunikation', 'was']];
const setzeFrei = (p: Roh, z: Zufall, wert: string): string => {
  const [l, feld] = z.wahl(FREIE_FELDER);
  liste(p, l)[0]![feld] = wert;
  return `${l}.${feld}`;
};

// ---------------------------------------------------------------------------------------------------------------------
// E2-01: Text, der mit einem Datum beginnt, in einem freien Feld: wurde als Datum geprüft und beim Speichern gelöscht

const DATEN = ['2026-03-15', '0026-03-15', '2026-02-29', '1999-12-31', '0001-01-01', '2026-13-45', '2026-02-30', '2026-00-10', '2026-04-31'];
const ZUSATZ = [' Kick-off KI-Rat', ' bis Q2', ': Freigabe', ' (Entwurf)', 'T10:00 Termin', ' 10:00', ' / 2026-04-01', ' - erledigt', ' Workshop'];

export const datumImText: Klasse = {
  id: 'projekt-datum-im-text',
  art: 'projektdatei',
  befunde: ['E2-01'],
  titel: 'Freier Text, der mit einem Datum beginnt, bleibt erhalten (Rundreise ohne Verlust)',
  regression: 'tests/fixtures/fuzz/regression/projekt-datum-im-text.aims.json',
  variante: (z) => {
    const p = grund();
    const wert = `${z.wahl(DATEN)}${z.wahl(ZUSATZ)}`.slice(0, 40);
    const wo = setzeFrei(p, z, wert);
    return fall(`datum-im-text ${wo}`, p);
  },
  urteile: (f) => {
    const u = urteile(f);
    if (u.urteil !== 'angenommen') throw new OrakelFehler(`Datenverlust: freier Text mit Datum wird abgelehnt (${u.meldung ?? ''})`);
    return u;
  },
  // Altregel vor E2-01: jeder Text bis 40 Zeichen, der mit einem Datum beginnt, galt als Datum; Text dahinter war nie gültig
  ohneSchutz: (f) => {
    const p = parse(f);
    return FREIE_FELDER.some(([l, feld]) => {
      const w = liste(p, l)[0]?.[feld];
      return typeof w === 'string' && w.length <= 40 && /^\d{4}-\d{2}-\d{2}/.test(w) && !/^\d{4}-\d{2}-\d{2}$/.test(w);
    });
  },
  ausDatei,
};

// ---------------------------------------------------------------------------------------------------------------------
// E2-15: falscher Wert oder Datentyp in Pflichtfeldern: Reparatur lief im Kreis und lieferte nichts

const FALSCH: unknown[] = [42, 'falsch', null, [], {}, true, '', 'ENTWURF', -1, '\u0000'];
const PFLICHT: [string, string][] = [['risiken', 'status'], ['kiSysteme', 'status'], ['dokumente', 'status'], ['controls', 'status'], ['risiken', 'art'], ['kiSysteme', 'typ'], ['personen', 'name'], ['audits', 'art']];

export const pflichtfeldFalsch: Klasse = {
  id: 'projekt-pflichtfeld-falsch',
  art: 'projektdatei',
  befunde: ['E2-15'],
  titel: 'Falscher Wert oder Typ in Pflichtfeldern: abgelehnt, Reparatur liefert eine gültige Datei',
  regression: 'tests/fixtures/fuzz/regression/projekt-pflichtfeld-falsch.aims.json',
  variante: (z) => {
    const p = grund();
    for (let i = 0, n = z.zwischen(1, 4); i < n; i++) {
      const [l, feld] = z.wahl(PFLICHT);
      const e = liste(p, l);
      const ziel = e[z.ganz(e.length)];
      if (ziel) ziel[feld] = z.wahl(FALSCH);
    }
    if (z.mit(0.3)) (p['meta'] as Roh)['dokumentSprache'] = z.wahl(['xx', 1, null]);
    return fall('pflichtfeld-falsch', p);
  },
  urteile,
  // Altverhalten: ungültigen Wert löschen und als Pflichtfeld '' einsetzen; die Datei bleibt ungültig
  ohneSchutz: (f) => {
    const p = parse(f);
    const r = pruefeProjektDaten(p);
    if (r.ok) return false;
    for (const e of r.fehler) {
      const teile = e.instancePath.split('/').slice(1);
      let x: unknown = p;
      for (const t of teile.slice(0, -1)) x = (x as Roh | undefined)?.[t];
      if (x && typeof x === 'object' && teile.length) (x as Roh)[teile.at(-1)!] = '';
    }
    return !pruefeProjektDaten(p).ok;
  },
  ausDatei,
};

// ---------------------------------------------------------------------------------------------------------------------
// E2-17: einzelnes Surrogat in Text, Schlüssel oder Kennung: Fehlerdialog «URI malformed»

const SURROGATE = ['\ud800', '\udfff', 'a\ud83d', '\ude00b', '\udbffA', 'x\udc00y'];

export const surrogat: Klasse = {
  id: 'projekt-surrogat',
  art: 'projektdatei',
  befunde: ['E2-17'],
  titel: 'Einzelnes Surrogat in Text, Schlüssel oder Kennung: nie angenommen, nie Rohfehler',
  regression: 'tests/fixtures/fuzz/regression/projekt-surrogat.aims.json',
  variante: (z) => {
    const p = grund();
    const s = z.wahl(SURROGATE);
    const wo = z.ganz(3);
    const [l] = z.wahl(FREIE_FELDER);
    const e = liste(p, l)[0]!;
    if (wo === 0) e['id'] = `${String(e['id'])}${s}`;
    else if (wo === 1) setzeFrei(p, z, `Text ${s}`);
    else ((p['meta'] as Roh)['gefuehrt'] as Roh | undefined ?? (p['organisation'] as Roh))[`feld${s}`] = 'x';
    return fall(`surrogat ${['kennung', 'text', 'schluessel'][wo]}`, p);
  },
  urteile,
  // Ohne Prüfung: encodeURIComponent wirft beim Sprungziel oder Text
  ohneSchutz: (f) => {
    try {
      encodeURIComponent(f.daten as string);
      // JSON.stringify maskiert einzelne Surrogate; geparst stehen sie wieder im Text
      const roh = JSON.stringify(parse(f), (_k, v: unknown) => (typeof v === 'string' ? (encodeURIComponent(v), v) : v));
      for (const k of roh.match(/"[^"]*\\ud[89ab][0-9a-f]{2}[^"]*":/gi) ?? []) encodeURIComponent(JSON.parse(k.slice(0, -1)) as string);
      return false;
    } catch {
      return true;
    }
  },
  ausDatei,
};

// ---------------------------------------------------------------------------------------------------------------------
// E-11, E2-20: überlange Texte und Schlüssel (Hauptthread hing, 20 MB als Schlüssel angenommen)

export const ueberlang: Klasse = {
  id: 'projekt-ueberlang',
  art: 'projektdatei',
  befunde: ['E-11', 'E2-20'],
  titel: 'Überlange Texte und Feldnamen: abgelehnt, Reparatur kürzt oder entfernt',
  regression: 'tests/fixtures/fuzz/regression/projekt-ueberlang.aims.json',
  variante: (z) => {
    const p = grund();
    const n = z.wahl([501, 1000, 100_001, 400_001, 1_000_000]);
    const zeichen = z.wahl(['a', 'ä', '\u{1F600}', ' ', '́']);
    const lang = zeichen.repeat(Math.ceil(n / zeichen.length));
    const art = z.ganz(3);
    if (art === 0) liste(p, 'personen')[0]!['name'] = lang;
    else if (art === 1) setzeFrei(p, z, lang.length > 100_000 ? lang : lang.repeat(Math.ceil(100_001 / lang.length)));
    else (p['organisation'] as Roh)[lang.slice(0, Math.max(501, z.wahl([501, 5000, 100_000])))] = 'x';
    return fall(`ueberlang ${['name', 'text', 'schluessel'][art]}`, p);
  },
  urteile: (f) => {
    const u = urteile(f);
    if (u.urteil === 'angenommen') throw new OrakelFehler('Grenze greift nicht: überlanger Text oder Schlüssel angenommen');
    return u;
  },
  // Ohne Grenze: ein Wert oder Schlüssel über der Grenze geht ungeprüft durch
  ohneSchutz: (f) => {
    let ueber = false;
    JSON.parse(f.daten as string, (k, v: unknown) => {
      if (k.length > 500 || (typeof v === 'string' && v.length > (k === 'name' ? 500 : 100_000))) ueber = true;
      return v;
    });
    return ueber;
  },
  ausDatei,
};

// ---------------------------------------------------------------------------------------------------------------------
// E-15: unmögliches Kalenderdatum in Datumsfeldern: RangeError auf allen Routen

const UNMOEGLICH = ['2026-13-45', '2026-02-30', '2026-00-10', '2026-04-31', '2025-02-29', '9999-99-99', '2026-12-32T10:00:00Z', '2026-01-01T25:61:00Z', '2026-1-1', '20261-01-01'];

export const datumUngueltig: Klasse = {
  id: 'projekt-datum-ungueltig',
  art: 'projektdatei',
  befunde: ['E-15'],
  titel: 'Unmögliches Datum in Datumsfeldern: abgelehnt mit Ort, Reparatur entfernt',
  regression: 'tests/fixtures/fuzz/regression/projekt-datum-ungueltig.aims.json',
  variante: (z) => {
    const p = grund();
    const d = z.wahl(UNMOEGLICH);
    const wo = z.ganz(3);
    if (wo === 0) (p['meta'] as Roh)['geaendert'] = d;
    else if (wo === 1) (p['meta'] as Roh)['erstellt'] = d;
    else liste(p, 'managementbewertungen')[0]!['datum'] = d;
    return fall(`datum-ungueltig ${['meta.geaendert', 'meta.erstellt', 'managementbewertungen.datum'][wo]}`, p);
  },
  urteile: (f) => {
    const u = urteile(f);
    if (u.urteil === 'angenommen') throw new OrakelFehler('Grenze greift nicht: unmögliches Datum angenommen');
    return u;
  },
  // Ohne Prüfung: Datumsanzeige mit toISOString wirft RangeError (oder rechnet mit einem anderen Tag)
  ohneSchutz: (f) => {
    const p = parse(f);
    const werte = [(p['meta'] as Roh)['geaendert'], (p['meta'] as Roh)['erstellt'], liste(p, 'managementbewertungen')[0]?.['datum']];
    return werte.some((w) => {
      if (typeof w !== 'string') return false;
      const d = new Date(w);
      return Number.isNaN(d.getTime()) || !d.toISOString().startsWith(w.slice(0, 10));
    });
  },
  ausDatei,
};

// ---------------------------------------------------------------------------------------------------------------------
// E-18: doppelte Kennungen (ganzes Set scheiterte an doppeltem Pfad)

export const doppelteKennung: Klasse = {
  id: 'projekt-doppelte-kennung',
  art: 'projektdatei',
  befunde: ['E-18'],
  titel: 'Doppelte Kennungen in einer Liste: abgelehnt, Reparatur benennt um',
  regression: 'tests/fixtures/fuzz/regression/projekt-doppelte-kennung.aims.json',
  variante: (z) => {
    const p = grund();
    const l = z.wahl(['kiSysteme', 'risiken', 'personen', 'nachweise', 'dokumente', 'controls', 'audits']);
    const e = liste(p, l);
    for (let i = 0, n = z.zwischen(1, 3); i < n; i++) {
      const kopie = structuredClone(e[z.ganz(e.length)]!);
      if (z.mit(0.3)) kopie['name'] = 'Gleicher Name';
      e.splice(z.ganz(e.length + 1), 0, kopie);
    }
    return fall(`doppelte-kennung ${l}`, p);
  },
  urteile: (f) => {
    const u = urteile(f);
    if (u.urteil === 'angenommen') throw new OrakelFehler('Grenze greift nicht: doppelte Kennung angenommen');
    return u;
  },
  ohneSchutz: (f) => {
    const p = parse(f);
    return Object.values(p).some((l) => Array.isArray(l) && new Set(l.map((e: Roh) => e?.['id'])).size < l.length);
  },
  ausDatei,
};

// ---------------------------------------------------------------------------------------------------------------------
// E-20, E2-18: tiefe Verschachtelung (Maximum call stack, structuredClone scheitert, Rohtext)

export const tief: Klasse = {
  id: 'projekt-tief',
  art: 'projektdatei',
  befunde: ['E-20', 'E2-18'],
  titel: 'Tiefe Verschachtelung an beliebiger Stelle: abgelehnt «kein-projekt», kein Stapelüberlauf',
  regression: 'tests/fixtures/fuzz/regression/projekt-tief.aims.json',
  variante: (z) => {
    const p = grund();
    const n = z.wahl([JSON_MAX_TIEFE + 1, 250, 1000, 10_000, 100_000]);
    const offen = z.wahl(['[', '{"a":']);
    const zu = offen === '[' ? ']' : '}';
    const tiefWert = `${offen.repeat(n)}1${zu.repeat(n)}`;
    const wo = z.wahl(['zusatz', 'organisation', 'risiken']);
    const t = JSON.stringify(p);
    const marke = '"__TIEF__"';
    if (wo === 'organisation') (p['organisation'] as Roh)['kontext'] = '__TIEF__';
    else if (wo === 'risiken') liste(p, 'risiken')[0]!['beschreibung'] = '__TIEF__';
    const daten = wo === 'zusatz' ? `${t.slice(0, -1)},"zusatz":${tiefWert}}` : JSON.stringify(p).replace(marke, tiefWert);
    return fall(`tief ${wo} ${n}`, daten, { mussAbgelehnt: true });
  },
  urteile,
  // Ohne Tiefenprüfung: Kopieren und Prüfen laufen rekursiv; über der Grenze droht der Stapelüberlauf
  ohneSchutz: (f) => {
    let max = 0;
    let t = 0;
    for (const c of f.daten as string) {
      if (c === '[' || c === '{') max = Math.max(max, ++t);
      else if (c === ']' || c === '}') t--;
    }
    return max > JSON_MAX_TIEFE;
  },
  ausDatei,
};

export const PROJEKT_KLASSEN: Klasse[] = [datumImText, pflichtfeldFalsch, surrogat, ueberlang, datumUngueltig, doppelteKennung, tief];
