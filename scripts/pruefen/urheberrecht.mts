// Tor G6 Urheberrecht (nur lokal, mit --lokal): meldet jede 8-Wort-Folge aus den Kit-Texten,
// die auch in den lokalen Textfassungen der Normen oder weiterer Vergleichstexte vorkommt.
// Die Quellfolgen werden nur als Hashwerte in .urheberrecht-cache/ (gitignored) gehalten,
// Meldungen nennen nur Fundort und Quelldatei, nie den Wortlaut.
//
// Quellen: alle Textfassungen unter <QUELLEN_DIR>/text (Normen ISO/IEC 42001, 42005, 27001, 27002 und weitere Vergleichstexte, etwa Kursunterlagen).
// Fehlt zu einer Norm-PDF unter <QUELLEN_DIR>/norm die Textfassung oder ist sie älter als die PDF, wird sie lokal mit
// pdftotext -layout erzeugt (wie bei 42001). Textfassungen und Cache liegen ausserhalb des Repos oder sind gitignored.
// Geprüft werden auch der Code des Normtext-Imports und die synthetischen Norm-Fixtures (dort steht kein Normtext).
//
// Zitat-Quelle NIST: Die wörtlichen Auszüge aus NIST AI 100-1 und 600-1 (src/nist-rmf/original-*.yaml, Felder zitat,
// titel_zitat, abschnitt_titel_zitat) sind gemeinfreie US-Regierungswerke und dürfen zitiert werden. Vergleichstexte
// können dieselben NIST-Sätze zitieren; ohne Ausnahme meldete G6 diese Zitate (und ihre Wiedergabe in N-01, N-02, N-04 und im
// Skill) als Übernahme aus dem Vergleichstext. Darum gilt jede 8-Wort-Folge innerhalb eines NIST-Zitats als Ausnahme
// (nistZitatAusnahmen); kürzere Zitate wie Merkmalsnamen werden nicht als Ausnahme verwendet. Die Treue der Zitate prüft G18.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parse } from 'yaml';
import { type Befund, type Optionen, REPO, TEXT_ENDUNGEN, alsHauptprogramm, dateienUnter, hatEndung, leseListe, quellenDir, relativ, textAusDokument } from './gemeinsam.mts';

const TOR = 'G6';
export const N = 8;

/** Kit-Texte relativ zum Repo. */
export const KIT_QUELLEN = ['src/i18n', 'src/vorlagen', 'src/kataloge', 'src/prozesse', 'src/nist-rmf', 'src/skill', 'src/start', 'src/gefuehrt', 'src/regeln', 'src/leitfaden', 'src/normtexte', 'src/app/normtexte', 'tests/fixtures/normpdf.ts'];

/**
 * Textfassungen der Norm-PDFs (<quellen>/norm/*.pdf -> <quellen>/text/*.txt) lokal erzeugen, wenn sie fehlen oder älter
 * sind als die PDF. Gibt die Namen der erzeugten Dateien zurück; ohne pdftotext eine Warnung.
 */
export function normtexteExtrahieren(quellen: string): { erzeugt: string[]; warnung?: string } {
  const normOrdner = join(quellen, 'norm');
  const textOrdner = join(quellen, 'text');
  if (!existsSync(normOrdner)) return { erzeugt: [] };
  const offen = dateienUnter(normOrdner, (p) => p.toLowerCase().endsWith('.pdf')).filter((pdf) => {
    const txt = join(textOrdner, basename(pdf).replace(/\.pdf$/i, '.txt'));
    return !existsSync(txt) || statSync(txt).mtimeMs < statSync(pdf).mtimeMs;
  });
  if (!offen.length) return { erzeugt: [] };
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
  } catch {
    return { erzeugt: [], warnung: `pdftotext fehlt (poppler-utils): ${offen.length} Norm-PDF ohne Textfassung` };
  }
  mkdirSync(textOrdner, { recursive: true });
  const erzeugt: string[] = [];
  for (const pdf of offen) {
    const name = basename(pdf).replace(/\.pdf$/i, '.txt');
    execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', pdf, join(textOrdner, name)], { stdio: 'ignore' });
    erzeugt.push(name);
  }
  return { erzeugt };
}

/** AI-Act-Texte sind amtliche Werke und werden nicht als Quelle verwendet. */
export function istAiActDatei(name: string): boolean {
  return /ai[-_ ]?act|aenderungsverordnung|2024[-_]1689/i.test(name);
}

/** Seitenköpfe, Seitenzahlen und Urheberrechtsvermerke der Quellen werden ignoriert. */
export function istKopfzeile(zeile: string): boolean {
  const t = zeile.trim();
  return (
    t === '' ||
    /^\d{1,4}$/.test(t) ||
    /\u00A9|\(c\)\s*\d{4}|copyright|urheberrecht|all rights reserved|alle rechte vorbehalten|licensed to|lizenziert f/i.test(t) ||
    /^(seite|page)\s+\d+(\s+(von|of)\s+\d+)?$/i.test(t) ||
    /^(SN\s+)?(EN\s+)?ISO\/IEC\s+\d{5}(:\d{4})?(\s*\(\w+\))?$/i.test(t)
  );
}

/** Kleinbuchstaben, Silbentrennung am Zeilenende aufheben, Satzzeichen entfernen. */
export function normalisiere(text: string): string[] {
  return text
    .replace(/\u00AD/g, '')
    .replace(/(\p{L})-\s*\n\s*(\p{Ll})/gu, '$1$2')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter((w) => w !== '');
}

/** Hash einer Wortfolge (16 Hex-Zeichen), damit kein Klartext gespeichert wird. */
export function hashFolge(woerter: string[]): string {
  return createHash('sha1').update(woerter.join(' ')).digest('hex').slice(0, 16);
}

/** Alle n-Wort-Folgen eines Textes als Hashwerte. */
export function folgen(woerter: string[], n: number = N): string[] {
  const ergebnis: string[] = [];
  for (let i = 0; i + n <= woerter.length; i++) ergebnis.push(hashFolge(woerter.slice(i, i + n)));
  return ergebnis;
}

/** Text einer Quelldatei ohne Kopfzeilen. */
export function quelltext(text: string): string {
  return text
    .split('\n')
    .filter((z) => !istKopfzeile(z))
    .join('\n');
}

export type Quellmenge = Map<string, number>;

/** Baut die Menge der Quellfolgen: Hash auf Index der Quelldatei. */
export function baueQuellmenge(dateien: string[]): { menge: Quellmenge; namen: string[] } {
  const menge: Quellmenge = new Map();
  const namen = dateien.map((d) => basename(d));
  dateien.forEach((d, i) => {
    for (const h of folgen(normalisiere(quelltext(readFileSync(d, 'utf8'))))) if (!menge.has(h)) menge.set(h, i);
  });
  return { menge, namen };
}

/** Lädt die Quellmenge aus dem Cache oder baut sie neu (Cache-Schlüssel: Name, Grösse, Änderungszeit). */
export function ladeQuellmenge(textOrdner: string, cacheOrdner: string = join(REPO, '.urheberrecht-cache')): { menge: Quellmenge; namen: string[] } {
  // Normen zuerst, damit Treffer der Norm und nicht einem Vergleichstext zugeordnet werden, der sie zitiert
  const dateien = dateienUnter(textOrdner, (p) => p.toLowerCase().endsWith('.txt') && !istAiActDatei(basename(p))).sort(
    (a, b) => Number(!/iso/i.test(basename(a))) - Number(!/iso/i.test(basename(b))) || a.localeCompare(b),
  );
  const schluessel = createHash('sha1')
    .update(JSON.stringify(dateien.map((d) => [basename(d), statSync(d).size, statSync(d).mtimeMs, N])))
    .digest('hex');
  const cacheDatei = join(cacheOrdner, `quellfolgen-${schluessel.slice(0, 12)}.json`);
  if (existsSync(cacheDatei)) {
    const c = JSON.parse(readFileSync(cacheDatei, 'utf8')) as { namen: string[]; folgen: [string, number][] };
    return { menge: new Map(c.folgen), namen: c.namen };
  }
  const r = baueQuellmenge(dateien);
  mkdirSync(cacheOrdner, { recursive: true });
  writeFileSync(cacheDatei, JSON.stringify({ namen: r.namen, folgen: [...r.menge] }));
  return r;
}

/**
 * Ausnahmen: normalisierte Wortfolgen. Eine 8-Wort-Folge ist ausgenommen, wenn sie eine kürzere
 * Ausnahme enthält oder in einer längeren Ausnahme enthalten ist.
 */
export function baueAusnahmen(zeilen: string[]): (woerter: string[]) => boolean {
  const ausnahmen = zeilen.map((z) => normalisiere(z)).filter((w) => w.length > 0);
  const lang = new Set<string>();
  const kurz: string[] = [];
  for (const a of ausnahmen) {
    if (a.length >= N) for (let i = 0; i + N <= a.length; i++) lang.add(a.slice(i, i + N).join(' '));
    else kurz.push(` ${a.join(' ')} `);
  }
  return (woerter) => {
    const s = woerter.join(' ');
    return lang.has(s) || kurz.some((k) => ` ${s} `.includes(k));
  };
}

/**
 * Entfernt als AI-Act-Zitat gekennzeichnete Markdown-Blockzitate (zusammenhängende Zeilen mit «>»,
 * die «Art.», «Artikel» oder «Article» nennen). Die Zeilen bleiben als Leerzeilen erhalten,
 * damit die Zeilennummern stimmen.
 */
export function ohneAiActZitate(text: string): string {
  const zeilen = text.split('\n');
  let i = 0;
  while (i < zeilen.length) {
    if (!/^\s*>/.test(zeilen[i]!)) {
      i++;
      continue;
    }
    let j = i;
    while (j < zeilen.length && /^\s*>/.test(zeilen[j]!)) j++;
    if (zeilen.slice(i, j).some((z) => /\bArt\.|\bArtikel\b|\bArticle\b/.test(z))) for (let k = i; k < j; k++) zeilen[k] = '';
    i = j;
  }
  return zeilen.join('\n');
}

/** Dateien mit wörtlichen NIST-Zitaten (Zitat-Quelle, siehe Kopf) */
export const NIST_ZITAT_DATEIEN = ['src/nist-rmf/original-100-1.yaml', 'src/nist-rmf/original-600-1.yaml'];

/** Alle NIST-Zitate mit mindestens N Wörtern als Ausnahmezeilen für baueAusnahmen. */
export function nistZitatAusnahmen(repo: string = REPO): string[] {
  const zeilen: string[] = [];
  for (const rel of NIST_ZITAT_DATEIEN) {
    const datei = join(repo, rel);
    if (!existsSync(datei)) continue;
    const d = parse(readFileSync(datei, 'utf8')) as Record<string, unknown>;
    for (const liste of Object.values(d)) {
      if (!Array.isArray(liste)) continue;
      for (const e of liste as Record<string, unknown>[]) {
        for (const feld of ['zitat', 'titel_zitat', 'abschnitt_titel_zitat']) {
          const t = e[feld];
          if (typeof t === 'string' && normalisiere(t).length >= N) zeilen.push(t);
        }
      }
    }
  }
  return zeilen;
}

/** Prüft einen Kit-Text gegen die Quellmenge; meldet je Treffergruppe die erste Zeile. */
export function pruefeText(
  datei: string,
  text: string,
  quellen: { menge: Quellmenge; namen: string[] },
  istAusnahme: (w: string[]) => boolean = () => false,
): Befund[] {
  const woerter: { w: string; zeile: number }[] = [];
  ohneAiActZitate(text)
    .split('\n')
    .forEach((z, i) => {
      for (const w of normalisiere(z)) woerter.push({ w, zeile: i + 1 });
    });
  const befunde: Befund[] = [];
  let letzteTrefferPos = -2;
  let gruppe: Befund | undefined;
  let laenge = 0;
  for (let i = 0; i + N <= woerter.length; i++) {
    const folge = woerter.slice(i, i + N).map((x) => x.w);
    const q = quellen.menge.get(hashFolge(folge));
    if (q === undefined || istAusnahme(folge)) continue;
    if (gruppe && i === letzteTrefferPos + 1) {
      laenge++;
    } else {
      laenge = N;
      gruppe = { tor: TOR, datei, zeile: woerter[i]!.zeile, meldung: '', schwere: 'fehler' };
      befunde.push(gruppe);
    }
    gruppe.meldung = `${laenge} Wörter in Folge übereinstimmend mit Quelle ${quellen.namen[q] ?? '?'}; eigene Worte verwenden`;
    letzteTrefferPos = i;
  }
  return befunde;
}

/** Kit-Dateien: Textquellen unter src/ und, falls vorhanden, erzeugte Dokumente unter dist/kit. */
export function kitDateien(repo: string = REPO): string[] {
  const liste: string[] = [];
  const code = (p: string) => hatEndung(p, [...TEXT_ENDUNGEN, '.ts', '.tsx', '.mts']);
  for (const q of KIT_QUELLEN) {
    const pfad = join(repo, q);
    if (existsSync(pfad) && statSync(pfad).isFile()) liste.push(pfad);
    else liste.push(...dateienUnter(pfad, code));
  }
  liste.push(...dateienUnter(join(repo, 'dist', 'kit'), (p) => hatEndung(p, ['.docx', '.xlsx', '.html', '.htm', '.md', '.txt']) && !/\/(rechtstexte|legal)\//i.test(p)));
  return liste.filter((p) => !/\/ai-act\/auszuege(\/|-(de|en)\.md$)/.test(p.split('\\').join('/')));
}

export async function pruefe(o: Optionen = {}): Promise<Befund[]> {
  if (!o.lokal) return [];
  const extrahiert = normtexteExtrahieren(quellenDir());
  const textOrdner = join(quellenDir(), 'text');
  if (!existsSync(textOrdner)) {
    return [{ tor: TOR, datei: textOrdner, meldung: 'Quelltexte nicht gefunden (QUELLEN_DIR): Urheberrechtsprüfung übersprungen', schwere: 'warnung' }];
  }
  const quellen = ladeQuellmenge(textOrdner);
  const ausnahmeDatei = join(REPO, 'scripts', 'pruefen', 'urheberrecht-ausnahmen.txt');
  const istAusnahme = baueAusnahmen([...(existsSync(ausnahmeDatei) ? leseListe(readFileSync(ausnahmeDatei, 'utf8')) : []), ...nistZitatAusnahmen()]);
  const befunde: Befund[] = extrahiert.warnung ? [{ tor: TOR, datei: join(quellenDir(), 'norm'), meldung: extrahiert.warnung, schwere: 'warnung' }] : [];
  for (const pfad of kitDateien()) {
    let text: string;
    try {
      text = textAusDokument(pfad, readFileSync(pfad));
    } catch (e) {
      befunde.push({ tor: TOR, datei: relativ(pfad), meldung: `nicht lesbar: ${(e as Error).message}`, schwere: 'warnung' });
      continue;
    }
    befunde.push(...pruefeText(relativ(pfad), text, quellen, istAusnahme));
  }
  return befunde;
}

await alsHauptprogramm(import.meta.url, (o) => pruefe({ ...o, lokal: true }));
