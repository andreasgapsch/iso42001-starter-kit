// Weiche Trennstellen (U+00AD) für die Einträge des Untermenüs (Nutzertest rc.10, U-04). «hyphens: auto» trennt nicht
// in allen Engines (Chromium unter Linux und Windows ohne Wörterbuch für Deutsch, WebKit je nach System); ohne Trennstelle
// bricht ein zu langes Wort sonst mitten im Wort ohne Strich («Folgenabschätzung / en»). Die Liste deckt alle Wörter ab
// 12 Zeichen in den Titeln des Untermenüs ab (DE und EN); tests/unit/nutzertest-rc10.test.ts prüft das.
const SHY = '\u00ad';

/** Trennstellen je Wort (klein geschrieben, «|» markiert die Stelle) */
const STELLEN = [
  // Deutsch
  'anwend|barkeit', 'arbeits|liste', 'ausgangs|lage', 'audit|fest|stellungen', 'biblio|theks|ordner', 'dar|stellung', 'doku|menten|lenkung', 'doku|ment|gestaltung',
  'doku|menten|register', 'ein|stellungen', 'fest|stellungen', 'firmen|doku|mente', 'folgen|abschät|zungen', 'geltungs|bereich',
  'jahres|kalender', 'kern|prozesse', 'kommu|nikation', 'kurz|anleitung', 'liefe|ranten', 'manage|ment|bewertung', 'mass|nahmen',
  'mit|arbeitende', 'organi|sation', 'personen|tagen', 'prüf|regeln', 'rechts|texte', 'start|interview', 'tasten|kürzel', 'unter|stützung',
  'verbes|serung', 'vor|bereiten', 'zerti|fizierung', 'bereit|schaft', 'unter|stützungs|prozesse', 'führungs|prozesse', 'bewertungs|prozesse',
  'regel|werke', 'auf|gaben', 'ent|würfe', 'nach|weise',
  // Englisch
  'applic|ability', 'assess|ments', 'certifi|cation', 'commu|nication', 'comple|ment', 'foun|dations', 'imple|men|tation', 'improve|ment',
  'measure|ment', 'objec|tives', 'oppor|tunities', 'organi|zation', 'appear|ance', 'manage|ment',
];
const TABELLE = new Map(STELLEN.map((s) => [s.replaceAll('|', ''), s]));

/** Wort ohne Satzzeichen am Rand mit Trennstellen nach der Liste, Gross- und Kleinschreibung bleiben */
function wort(w: string): string {
  const m = /^([^\p{L}]*)([\p{L}]+)([^\p{L}]*)$/u.exec(w);
  if (!m) return w;
  const s = TABELLE.get(m[2]!.toLowerCase());
  if (!s) return w;
  let aus = '';
  let i = 0;
  for (const z of s) {
    if (z === '|') aus += SHY;
    else aus += m[2]![i++];
  }
  return m[1] + aus + m[3];
}

/** Titel mit weichen Trennstellen; Teile mit Bindestrich (Stage-1-Bereitschaft) einzeln */
export function weichTrennen(titel: string): string {
  return titel.split(/(\s+)/).map((t) => (/\s/.test(t) ? t : t.split('-').map(wort).join('-'))).join('');
}

/** Wörter ab dieser Länge brauchen eine Trennstelle (Breite des Untermenüs mit Zahl rund 16 Zeichen) */
export const TRENNEN_AB = 12;
