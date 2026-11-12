// Tor G5 Stil: Schweizer Rechtschreibung (kein Eszett), keine Halbgeviert- und Geviertstriche,
// Wortliste mit verbotenen Formen (DE und britisches EN).
// Ausnahmen: Zeilen mit dem Vermerk `stil-ok:` oder Dateien in scripts/pruefen/stil-ausnahmen.txt.
// Zitat-Quellen: In den wörtlichen NIST-Auszügen (ZITAT_DATEIEN, src/nist-rmf/original-*.yaml) sind die Zeilen mit einem
// Zitatfeld (zitat, titel_zitat, abschnitt_titel_zitat) ausgenommen. Zitate bleiben wörtlich, auch mit Halbgeviertstrich
// oder US-Schreibweise («behavior», «labor»); ihre Treue prüft Tor G18 gegen das PDF. Die eigenen Übersetzungen (de,
// titel_de) und alle übrigen Zeilen dieser Dateien prüft G5 wie jede andere Quelle.
// Anführungszeichen (docs/KONVENTIONEN.md): deutsch «…» (verschachtelt ‹…›), englisch ‘…’ (verschachtelt “…”). In englischen
// Zeilen sind Guillemets verboten. Sprache aus dem Pfad, aus DATEI_SPRACHE, aus einem Abschnitt «English»/«Deutsch» mit
// Unterstreichung (CHANGELOG), aus dem Zeilenschlüssel (`en:`, `titel_en:`) oder aus einem Wert `en: '…'` innerhalb der Zeile.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Befund, type Optionen, REPO, TEXT_ENDUNGEN, alsHauptprogramm, dateienUnter, hatEndung, leseListe, passtMuster, relativ } from './gemeinsam.mts';

const TOR = 'G5';

/** Zusätzlich zu TEXT_ENDUNGEN geprüft: Vorlagen der Startdateien (LIESMICH.txt.tpl, README.txt.tpl, CHANGELOG.txt.tpl). */
export const ZUSATZ_ENDUNGEN = ['.txt.tpl'];

/** Geprüfte Textquellen relativ zum Repo. */
export const QUELLEN = ['src/i18n', 'src/vorlagen', 'src/kataloge', 'src/prozesse', 'src/ai-act', 'src/nist-rmf', 'src/start', 'src/skill', 'src/lizenz', 'src/leitfaden', 'src/gefuehrt', 'src/regeln', 'src/beispiele'];

/** Immer ausgenommen: wörtliche AI-Act-Auszüge und Volltexte der Lizenzen. */
export const STANDARD_AUSNAHMEN = [
  'src/ai-act/auszuege/**',
  'src/lizenz/CC-BY-4.0*',
  'src/lizenz/MIT*',
  'src/lizenz/**/volltext*',
  // Bauskripte des Stands vor rc.6: erzeugen die eingecheckten Beispiele nicht mehr (Wörterbücher DE und EN nebeneinander)
  'src/beispiele/bau/**',
];

/** Dateien mit wörtlichen Zitaten; ausgenommen sind dort nur die Zeilen der Zitatfelder (ZITAT_FELD). */
export const ZITAT_DATEIEN = ['src/nist-rmf/original-*.yaml'];
export const ZITAT_FELD = /^\s*(?:-\s*)?(?:\w+_)?zitat\s*:/;

/** Zeile eines Zitatfelds in einer Zitat-Quelle? */
export function istZitatZeile(datei: string, zeile: string): boolean {
  return ZITAT_FELD.test(zeile) && ZITAT_DATEIEN.some((m) => passtMuster(datei, m));
}

export type Sprache = 'de' | 'en' | 'beide';

interface Regel {
  muster: RegExp;
  meldung: string;
  sprache: Sprache;
}

const ESZETT = /[\u00DF\u1E9E]/g;
const HALBGEVIERT = /\u2013/g;
const GEVIERT = /\u2014/g;
const ZAHLENBEREICH = /\d\s*\u2013\s*\d/;

/** Wortliste. Muster ohne Flag g; werden pro Zeile mit g ausgewertet. */
export const WORTLISTE: Regel[] = [
  // Deutsch
  { sprache: 'de', muster: /\bMitarbeiter(?:n|s)?\b(?![:*_/]-?innen|\/-?innen|-innen|Innen)/, meldung: '«Mitarbeiter» vermeiden: «Mitarbeitende» verwenden' },
  { sprache: 'de', muster: /(?<![\d.])\d\.\d{1,2}\.20\d\d\b|(?<![\d.])\d{1,2}\.\d\.20\d\d\b/, meldung: 'Datum im Deutschen: TT.MM.JJJJ mit führenden Nullen' },
  { sprache: 'de', muster: /\bbzgl\./, meldung: '«bzgl.» ausschreiben: «bezüglich»' },
  { sprache: 'de', muster: /\bz\.B\./, meldung: '«z.B.» mit Leerzeichen schreiben: «z. B.»' },
  // Englisch (britisch, Oxford-Endung -ize ist erwünscht)
  { sprache: 'en', muster: /\b\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}\b/, meldung: 'Datum im Englischen: TT/MM/JJJJ (docs/KONVENTIONEN.md)' },
  { sprache: 'en', muster: /^[^‘]*“/, meldung: 'Anführungszeichen im Englischen: aussen ‘…’, “…” nur verschachtelt' },
  { sprache: 'en', muster: /\bcolors?\b|\bcolor(?:ed|ing|ful|less)\b/i, meldung: 'US-Form: britisch «colour»' },
  { sprache: 'en', muster: /\bcenter(?:s|ed|ing)?\b/i, meldung: 'US-Form: britisch «centre»' },
  { sprache: 'en', muster: /\bprograms?\b(?!me)/i, meldung: 'US-Form: britisch «programme» (Software: mit «stil-ok:» begründen)' },
  { sprache: 'en', muster: /\banalyz(?:e|ed|es|ing|er|ers)\b/i, meldung: 'US-Form: britisch «analyse»' },
  { sprache: 'en', muster: /\bbehavior(?:s|al|ally)?\b/i, meldung: 'US-Form: britisch «behaviour»' },
  { sprache: 'en', muster: /\bfavor(?:s|ed|ing|able|ite|ites)?\b/i, meldung: 'US-Form: britisch «favour»' },
  { sprache: 'en', muster: /\bhonor(?:s|ed|ing|able)?\b/i, meldung: 'US-Form: britisch «honour»' },
  { sprache: 'en', muster: /\blabor\b/i, meldung: 'US-Form: britisch «labour»' },
  { sprache: 'en', muster: /\bcatalogs?\b/i, meldung: 'US-Form: britisch «catalogue»' },
  { sprache: 'en', muster: /\bdefense\b/i, meldung: 'US-Form: britisch «defence»' },
  { sprache: 'en', muster: /\bfulfill(?:s|ment)?\b/i, meldung: 'US-Form: britisch «fulfil», «fulfilment»' },
  { sprache: 'en', muster: /\b(?:labeled|labeling|modeled|modeling|canceled|canceling|traveled|traveling)\b/i, meldung: 'US-Form: britisch mit doppeltem «l» («labelled», «modelling»)' },
  { sprache: 'en', muster: /\bgray\b/i, meldung: 'US-Form: britisch «grey»' },
];

/**
 * Englisch: Oxford-Endung -ize. Einzige Ausnahme sind Rechtsbegriffe aus dem englischen Amtstext (docs/KONVENTIONEN.md,
 * Abschnitt 4). Wörter, die im britischen Englisch immer auf -ise enden, stehen in ISE_WOERTER.
 */
export const ISE_RECHTSBEGRIFFE = [
  /\bauthorised representatives?\b/gi,
  /\bharmonised (?:standards?|rules?|legislation)\b/gi,
  /\b(?:Union )?harmonisation legislation\b/gi,
  /\bEuropean standardisation organisations?\b/gi,
  /\bstandardisation (?:requests?|deliverables?)\b/gi,
];
const ISE_WOERTER = /^(?:exercis|otherwis|enterpris|expertis|advis|aris|rais|ris|revis|supervis|precis|imprecis|concis|promis|premis|compromis|compris|practis|advertis|likewis|wis|nois|surpris|devis|disguis|franchis|merchandis|paradis|prais|pois|cruis|bruis|demis|excis|incis|treatis|clockwis|stepwis|pairwis|improvis|televis|despis|chastis|mortis|anis|tortois|hois|cois|bais|pais|mais|rais)/i;
const ISE_FORM = /\b[a-z]+is(?:e|es|ed|ing|er|ers|ation|ations)\b/gi;
/** Formen auf -ise in englischem Text, ohne Ausnahmen, Feldnamen und Pfade */
export function iseFormen(text: string): string[] {
  let t = text;
  for (const r of ISE_RECHTSBEGRIFFE) t = t.replace(r, ' ');
  t = t.replace(/https?:\S+/g, ' ');
  // Bezeichner: Punktpfade, Schlüssel am Zeilenanfang und in Anführungszeichen, Dateinamen
  t = t.replace(/\b[\w-]+(?:\.[\w-]+)+/g, ' ').replace(/^\s*(?:-\s*)?"?[\w.-]+"?\s*:/g, ' ');
  return [...t.matchAll(ISE_FORM)].map((m) => m[0]).filter((w) => !ISE_WOERTER.test(w) && !/^[a-zäöü]+(?:weise|preise|hinweise|nachweise)$/i.test(w));
}

/** Dateien, deren Pfad die Sprache nicht nennt (Muster wie in den Ausnahmen). */
export const DATEI_SPRACHE: Record<string, 'de' | 'en'> = {
  'src/lizenz/LICENCE.txt': 'en',
  'src/lizenz/LIZENZ.txt': 'de',
  'src/start/README.txt.tpl': 'en',
  'src/start/LIESMICH.txt.tpl': 'de',
};

/** Sprache einer Datei: DATEI_SPRACHE, sonst aus dem Pfad. */
export function spracheDatei(pfad: string): Sprache {
  const eintrag = Object.entries(DATEI_SPRACHE).find(([m]) => passtMuster(pfad, m));
  return eintrag ? eintrag[1] : spracheAusPfad(pfad);
}

/** Bestimmt die Sprache einer Datei aus dem Pfad (…/de/…, ….de.…, …_DE.…). */
export function spracheAusPfad(pfad: string): Sprache {
  if (/(^|\/)de(\/|$)|[._-]de\.[a-z]+$|\.de\.aims\.json$/i.test(pfad)) return 'de';
  if (/(^|\/)en(\/|$)|[._-]en\.[a-z]+$|\.en\.aims\.json$/i.test(pfad)) return 'en';
  return 'beide';
}

/** Sprache einer einzelnen Zeile in zweisprachigen Dateien (`de: …`, `titel_en: …`). */
function spracheAusZeile(zeile: string, datei: Sprache): Sprache {
  if (datei !== 'beide') return datei;
  const m = /^\s*(?:-\s*)?"?(?:[\w-]*[_-])?(de|en)"?\s*:/i.exec(zeile);
  return m ? (m[1]!.toLowerCase() as Sprache) : 'beide';
}

/** Abschnittskopf in zweisprachigen Textdateien: «English» oder «Deutsch», darunter eine Zeile aus - oder =. */
function abschnittSprache(zeile: string, folgende: string | undefined): Sprache | undefined {
  if (folgende === undefined || !/^\s*[-=]{3,}\s*$/.test(folgende)) return undefined;
  const t = zeile.trim();
  return t === 'English' ? 'en' : t === 'Deutsch' ? 'de' : undefined;
}

/**
 * Guillemets in englischem Text. › mit Leerzeichen auf beiden Seiten ist der Pfadtrenner der Oberfläche
 * (wie die Ortsangabe im AIMS-Manager, z. B. Settings › Document design) und kein Anführungszeichen.
 */
export const GUILLEMET_EN = /[«»‹]|(?<! )›|›(?! )/;
const MELDUNG_GUILLEMET = 'Guillemets in englischem Text: ‘…’ verwenden (verschachtelt “…”)';

/** Werte englischer Schlüssel innerhalb einer Zeile, z. B. `{ de: '…', en: '…' }` oder `titel_en: "…"`. */
function englischeWerte(zeile: string): string {
  return [...zeile.matchAll(/(?:^|[\s{,(])"?(?:[\w-]*[_-])?en"?\s*:\s*(["'`])((?:\\.|(?!\1).)*)\1/gi)].map((m) => m[2]!).join(' | ');
}

/** Code-Dateien: die Wortliste gilt nur für Zeichenketten mit Leerzeichen (Sätze, keine Bezeichner). */
export const CODE_ENDUNGEN = ['.ts', '.tsx', '.mts'];

function satzZeichenketten(zeile: string): string {
  return [...zeile.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)]
    .map((m) => m[2]!)
    .filter((t) => /\s/.test(t.trim()))
    .join(' | ');
}

/** Prüft einen Text; `datei` dient der Meldung und der Spracherkennung. */
export function pruefeText(datei: string, text: string, sprache: Sprache = spracheDatei(datei)): Befund[] {
  const istCode = hatEndung(datei, CODE_ENDUNGEN);
  const befunde: Befund[] = [];
  const melde = (zeile: number, meldung: string): void => {
    befunde.push({ tor: TOR, datei, zeile, meldung, schwere: 'fehler' });
  };
  const zeilen = text.split('\n');
  let abschnitt: Sprache = sprache;
  zeilen.forEach((zeile, i) => {
    if (sprache === 'beide' && !istCode) abschnitt = abschnittSprache(zeile, zeilen[i + 1]) ?? abschnitt;
    if (zeile.includes('stil-ok:') || istZitatZeile(datei, zeile)) return;
    const nr = i + 1;
    if (ESZETT.test(zeile)) melde(nr, 'Eszett: Schweizer Rechtschreibung verlangt «ss»');
    ESZETT.lastIndex = 0;
    if (ZAHLENBEREICH.test(zeile)) melde(nr, 'Zahlenbereich mit Halbgeviertstrich: «bis» oder Bindestrich verwenden');
    else if (HALBGEVIERT.test(zeile)) melde(nr, 'Halbgeviertstrich (Gedankenstrich): umformulieren oder Komma, Doppelpunkt, Klammer verwenden');
    HALBGEVIERT.lastIndex = 0;
    if (GEVIERT.test(zeile)) melde(nr, 'Geviertstrich: umformulieren oder Komma, Doppelpunkt, Klammer verwenden');
    GEVIERT.lastIndex = 0;
    const zs = spracheAusZeile(zeile, abschnitt);
    const geprueft = istCode ? satzZeichenketten(zeile) : zeile;
    for (const regel of WORTLISTE) {
      if (zs !== 'beide' && regel.sprache !== zs) continue;
      // Projektdaten führen CAM-Programme (Software, britisch «program»); gemeldet wird dort nur das Programm im Sinn von «programme»
      if (/\.aims\.json$/.test(datei) && regel.meldung.includes('«programme»') && !/\b(?:audit|training|awareness|learning) programs?\b/i.test(geprueft)) continue;
      const m = regel.muster.exec(geprueft);
      if (m) melde(nr, `${regel.meldung} (gefunden: «${m[0]}»)`);
    }
    // Guillemets nur in sicher englischen Zeilen; in zweisprachigen Zeilen nur in den Werten englischer Schlüssel
    const englisch = zs === 'en' ? geprueft : zs === 'beide' ? englischeWerte(zeile) : '';
    // Projektdaten: Feldwerte ohne Leerzeichen sind Codes (auch «organisation» als Risikoebene); geprüft wird nur Fliesstext
    const iseText = /\.aims\.json$/.test(datei) ? satzZeichenketten(englisch) : englisch;
    for (const w of iseFormen(iseText)) melde(nr, `Britisch mit -ize, ausser Rechtsbegriffe in docs/KONVENTIONEN.md (gefunden: «${w}»)`);
    const g = GUILLEMET_EN.exec(englisch);
    if (g) melde(nr, `${MELDUNG_GUILLEMET} (gefunden: «${englisch.slice(Math.max(0, g.index - 20), g.index + 20).trim()}»)`);
  });
  return befunde;
}

export function leseAusnahmen(repo: string = REPO): string[] {
  const datei = join(repo, 'scripts', 'pruefen', 'stil-ausnahmen.txt');
  return [...STANDARD_AUSNAHMEN, ...(existsSync(datei) ? leseListe(readFileSync(datei, 'utf8')) : [])];
}

/** Prüft alle Textquellen unter `repo`. */
export function pruefeRepo(repo: string = REPO, quellen: string[] = QUELLEN, ausnahmen: string[] = leseAusnahmen(repo)): Befund[] {
  const befunde: Befund[] = [];
  for (const q of quellen) {
    for (const pfad of dateienUnter(join(repo, q), (p) => hatEndung(p, [...TEXT_ENDUNGEN, ...CODE_ENDUNGEN, ...ZUSATZ_ENDUNGEN]))) {
      const rel = relativ(pfad, repo);
      if (ausnahmen.some((m) => passtMuster(rel, m))) continue;
      befunde.push(...pruefeText(rel, readFileSync(pfad, 'utf8')));
    }
  }
  return befunde;
}

export async function pruefe(_o: Optionen = {}): Promise<Befund[]> {
  return pruefeRepo();
}

await alsHauptprogramm(import.meta.url, pruefe);
