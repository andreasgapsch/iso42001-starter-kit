// Druckpalette und Schriften der erzeugten Dokumente (DOCX, XLSX), abgeleitet aus dem Design System «KMU-CIO Systemkarte»
// (docs/design-system/tokens.json, Theme «light»). Dokumente werden immer hell gedruckt; dunkle Werte gibt es hier nicht.
// Halbtransparente Tokens (linie, linie-stark) sind auf Weiss vorberechnet, weil Word und Excel keine Deckkraft kennen.
//
// Schriften: Archivo (Titel, Tabellen, Zahlen) und Source Serif 4 (Lesetext) sind bei Firmen in der Regel nicht installiert,
// und Word kennt in w:rFonts keine Ersatzliste wie CSS. Die Dokumente nennen deshalb direkt Schriften, die mit Office auf
// Windows und macOS sowie in Word für das Web vorhanden sind und für die LibreOffice metrisch gleiche Ersatzschriften
// mitbringt (Seitenumbrüche bleiben gleich):
//   Titel, Tabellen, Kopf/Fuss, XLSX  Arial   (Groteskschrift wie Archivo; LibreOffice: Liberation Sans)
//   Lesetext                          Cambria (Serifenschrift für Bildschirm und Druck wie Source Serif 4; LibreOffice: Caladea)
// Georgia (Ersatz der Website) wäre näher am Schriftbild, hat aber in LibreOffice keinen metrisch gleichen Ersatz.
// Eingebettet wird nichts (Dateigrösse, Lizenzfragen bei Weitergabe, Word bettet ohnehin nur TrueType ein).
import { abstand, abstandFehlsicht, fuerText, hauch, hexNormal, kontrast, mitHelligkeit, schriftAuf, type Fehlsicht } from './farbe.ts';
import type { Farbrolle } from './ir.ts';

export const SCHRIFT = {
  titel: 'Arial',
  text: 'Cambria',
  tabelle: 'Arial',
} as const;

/** Tokens des hellen Themes als Hex ohne «#» */
export const TOKEN = {
  seite: 'F2F0EB',
  buehne: 'F8F7F4',
  karte: 'FFFFFF',
  flaecheTief: 'E9E6DF',
  tinte: '121821',
  text: '262D36',
  gedaempft: '535C67',
  /** rgba(18, 24, 33, .12) auf Weiss */
  linie: 'E3E3E4',
  /** rgba(18, 24, 33, .28) auf Weiss */
  linieStark: 'BDBEC1',
  kontur: '6B737C',
  blau: '1C5D94',
  blauTief: '14456E',
  aufBlau: 'FFFFFF',
} as const;

export interface RollenFarbe {
  /** Zellgrund */
  fill: string;
  /** Text auf dem Zellgrund (WCAG AA, mind. 4,5:1) */
  schrift: string;
  /** Linie, Balken oder Rand (mind. 3:1 gegen Weiss) */
  linie: string;
}

const STATUS = {
  gut: { text: '17606A', flaeche: '2E95A5', hauch: 'E6F3F5' },
  warnung: { text: '8A5A00', flaeche: '8A5A00', hauch: 'F6ECD8' },
  kritisch: { text: '9C3510', flaeche: '772106', hauch: 'F9E5DC' },
  neutral: { text: '535C67', flaeche: '616A74', hauch: 'EBEAE6' },
  info: { text: '1C5D94', flaeche: '1C5D94', hauch: 'E8EFF5' },
} as const;

/**
 * Druckfarben je Farbrolle. Status als Zelle: Hauch mit Text in tinte, Linie in der Fläche. Risikostufen: Orangeton mit
 * dunkler Schrift (auch «hoch»: tinte auf BF6C2E hat 4,58:1, Weiss nur 3,1:1). Kategorien und Sequenz für Diagramme.
 */
export const ROLLE: Record<Farbrolle, RollenFarbe> = {
  'risiko-tief': { fill: 'F2E8D6', schrift: TOKEN.tinte, linie: 'BF6C2E' },
  'risiko-mittel': { fill: 'E8B173', schrift: TOKEN.tinte, linie: 'BF6C2E' },
  'risiko-hoch': { fill: 'BF6C2E', schrift: TOKEN.tinte, linie: '772106' },
  'status-gut': { fill: STATUS.gut.hauch, schrift: TOKEN.tinte, linie: STATUS.gut.flaeche },
  'status-warnung': { fill: STATUS.warnung.hauch, schrift: TOKEN.tinte, linie: STATUS.warnung.flaeche },
  'status-kritisch': { fill: STATUS.kritisch.hauch, schrift: TOKEN.tinte, linie: STATUS.kritisch.flaeche },
  'status-neutral': { fill: STATUS.neutral.hauch, schrift: TOKEN.tinte, linie: STATUS.neutral.flaeche },
  'status-info': { fill: STATUS.info.hauch, schrift: TOKEN.tinte, linie: STATUS.info.flaeche },
  /** status-gut-flaeche mit auf-status-gut (tinte, 4,9:1), z. B. erledigte Meilensteine */
  'status-gut-stark': { fill: STATUS.gut.flaeche, schrift: TOKEN.tinte, linie: STATUS.gut.text },
  kopf: { fill: TOKEN.flaecheTief, schrift: TOKEN.tinte, linie: TOKEN.kontur },
  leer: { fill: TOKEN.karte, schrift: TOKEN.gedaempft, linie: TOKEN.linieStark },
  'kat-1': { fill: 'E8EFF5', schrift: TOKEN.tinte, linie: '1C5D94' },
  'kat-2': { fill: 'F9E5DC', schrift: TOKEN.tinte, linie: 'B44C18' },
  'kat-3': { fill: 'E6F3F5', schrift: TOKEN.tinte, linie: '1F7971' },
  'kat-4': { fill: 'EEE9F5', schrift: TOKEN.tinte, linie: '6A4E9E' },
  'kat-5': { fill: 'F6ECD8', schrift: TOKEN.tinte, linie: '906E00' },
  'kat-6': { fill: 'EBEAE6', schrift: TOKEN.tinte, linie: '616A74' },
  'seq-1': { fill: 'D9EAF8', schrift: TOKEN.tinte, linie: '9EC8ED' },
  'seq-2': { fill: '9EC8ED', schrift: TOKEN.tinte, linie: '4C9ADD' },
  'seq-3': { fill: '4C9ADD', schrift: TOKEN.tinte, linie: '226FB1' },
  'seq-4': { fill: '226FB1', schrift: 'FFFFFF', linie: '15456D' },
  'seq-5': { fill: '15456D', schrift: 'FFFFFF', linie: '15456D' },
};

/** Flächenfarbe einer Rolle in Diagrammen (Balken, Linien): kräftige Variante mit mind. 3:1 gegen Weiss */
export function diagrammFarbe(rolle: Farbrolle): string {
  if (rolle === 'status-gut-stark') return STATUS.gut.flaeche;
  if (rolle.startsWith('status-')) return STATUS[rolle.slice(7) as keyof typeof STATUS].flaeche;
  if (rolle.startsWith('risiko-') || rolle.startsWith('seq-')) return ROLLE[rolle].fill;
  return ROLLE[rolle].linie;
}

/** Textfarbe einer Statusrolle auf hellem Grund (z. B. Wort «überfällig») */
export function statusText(rolle: Farbrolle): string {
  if (rolle === 'status-gut-stark') return STATUS.gut.text;
  return rolle.startsWith('status-') ? STATUS[rolle.slice(7) as keyof typeof STATUS].text : TOKEN.tinte;
}

export { kontrast, leuchtdichte } from './farbe.ts';

// Palette als Funktion der Gestaltung (CI-Farben). Ohne Gestaltung gilt genau die Standardpalette oben (leere Vorlagen und
// Firmendokumente ohne CI bleiben bytegleich). CI-Farben wirken nur auf Marke und Struktur: Überschriften, Kopfzeile,
// Trennlinien, Tabellenkopf, Feldbeschriftung, Titelseite und neutrale Diagrammreihen (kat-*, seq-*). Semantische Rollen
// (risiko-*, status-*, Ampel, Hinweise, Platzhalter) werden kopiert und nie verändert, damit sie in allen Firmen dasselbe
// bedeuten. Kontrast wird automatisch korrigiert (Text 4,5:1, Grafik 3:1) und als Hinweis gemeldet, nie stillschweigend.

/** Eingabe der Farbanpassung (Teilmenge von Gestaltung.farben im Datenmodell) */
export interface FarbWahl {
  primaer?: string;
  sekundaer?: string;
  akzent?: string;
  ueberschriften?: boolean;
  tabellenkopf?: boolean;
  diagramme?: boolean;
  tabellenkopfKraeftig?: boolean;
}

export type FarbQuelle = 'primaer' | 'sekundaer' | 'akzent';

export type FarbHinweis =
  /** Farbe für Text bzw. Grafik zu hell (oder zu dunkel): ersetzt durch `ersatz` */
  | { art: 'korrigiert'; quelle: FarbQuelle; wofuer: 'text' | 'grafik' | 'flaeche'; original: string; ersatz: string; kontrast: number; deltaE: number }
  /** Farbe liegt nahe an einer Statusfarbe: nur für Überschriften, Kopfzeile und Tabellenkopf, nicht in Diagrammen */
  | { art: 'nahe-status'; quelle: FarbQuelle; status: Farbrolle; abstand: number; sicht: 'normal' | Fehlsicht }
  /** Zwei benachbarte Diagrammreihen sind bei Fehlsichtigkeit kaum unterscheidbar: Reihe ersetzt durch eine Kit-Farbe */
  | { art: 'reihe-ersetzt'; quelle: FarbQuelle; reihe: Farbrolle; sicht: 'normal' | Fehlsicht };

/** Farben der Dokumentstruktur (DOCX und XLSX, Vorschau) */
export interface DokFarben {
  /** Fliesstext */
  text: string;
  /** Titel, Überschriften, Firmenname in der Kopfzeile, Grafiktitel */
  titel: string;
  /** Metadaten, Notizen, Fusszeile */
  leise: string;
  /** Tabellenränder */
  linie: string;
  /** Trennlinie unter der Kopf- und über der Fusszeile */
  trennlinie: string;
  /** Tabellenkopf (Grund) */
  kopf: string;
  /** Schrift im Tabellenkopf; nur gesetzt, wenn sie vom Fliesstext abweicht (Tabellenkopf kräftig) */
  kopfText?: string;
  /** Feldbeschriftung der Lenkungstabelle */
  label: string;
  /** Band der Titelseite und Schrift darauf */
  band: string;
  aufBand: string;
  /** Akzentlinie der Titelseite */
  akzent: string;
}

export interface Druckpalette {
  /** CI-Farben wirken (mindestens eine Rolle weicht vom Standard ab) */
  ci: boolean;
  dok: DokFarben;
  rolle: Record<Farbrolle, RollenFarbe>;
  hinweise: FarbHinweis[];
}

/** Semantische Farben für die Konfliktprüfung (Flächen und Text der Statusrollen, Risikostufe hoch) */
export const SEMANTISCH: readonly { rolle: Farbrolle; hex: string }[] = [
  { rolle: 'status-kritisch', hex: STATUS.kritisch.flaeche },
  { rolle: 'status-kritisch', hex: STATUS.kritisch.text },
  { rolle: 'status-gut', hex: STATUS.gut.flaeche },
  { rolle: 'status-gut', hex: STATUS.gut.text },
  { rolle: 'status-warnung', hex: STATUS.warnung.flaeche },
  { rolle: 'risiko-hoch', hex: ROLLE['risiko-hoch'].fill },
  { rolle: 'risiko-mittel', hex: ROLLE['risiko-mittel'].fill },
];

/** Grenzen der Konfliktprüfung (OKLab): Normalsicht 0,08, bei Fehlsichtigkeit 0,06 */
export const NAHE_STATUS = 0.08;
export const NAHE_FEHLSICHT = 0.06;

const STANDARD_DOK: DokFarben = {
  text: TOKEN.text,
  titel: TOKEN.tinte,
  leise: TOKEN.gedaempft,
  linie: TOKEN.linieStark,
  trennlinie: TOKEN.linieStark,
  kopf: TOKEN.flaecheTief,
  label: TOKEN.seite,
  band: TOKEN.blau,
  aufBand: TOKEN.aufBlau,
  akzent: TOKEN.blau,
};

/** Kit-Kategorien für Diagrammreihen, in dieser Reihenfolge als Ersatz */
const KIT_KAT: readonly Farbrolle[] = ['kat-1', 'kat-2', 'kat-3', 'kat-4', 'kat-5', 'kat-6'];

/** Nächste semantische Farbe zu einer CI-Farbe (Normalsicht und Fehlsichtigkeiten) */
export function naechsteStatusfarbe(hex: string): { rolle: Farbrolle; abstand: number; sicht: 'normal' | Fehlsicht } {
  let best: { rolle: Farbrolle; abstand: number; sicht: 'normal' | Fehlsicht } = { rolle: 'status-neutral', abstand: Infinity, sicht: 'normal' };
  for (const s of SEMANTISCH) {
    const normal = abstand(hex, s.hex);
    if (normal < best.abstand) best = { rolle: s.rolle, abstand: normal, sicht: 'normal' };
    const f = abstandFehlsicht(hex, s.hex);
    // Fehlsicht mit eigener (strengerer) Grenze: auf die Normalgrenze skaliert vergleichen
    const skaliert = (f.min * NAHE_STATUS) / NAHE_FEHLSICHT;
    if (f.art !== 'normal' && skaliert < best.abstand) best = { rolle: s.rolle, abstand: f.min, sicht: f.art };
  }
  return best;
}

function zuNahe(n: { abstand: number; sicht: 'normal' | Fehlsicht }): boolean {
  return n.sicht === 'normal' ? n.abstand < NAHE_STATUS : n.abstand < NAHE_FEHLSICHT;
}

/** Druckpalette zur Farbwahl der Firma; ohne Primärfarbe die Standardpalette */
export function palette(wahl?: FarbWahl): Druckpalette {
  const rolle: Record<Farbrolle, RollenFarbe> = Object.fromEntries(Object.entries(ROLLE).map(([k, v]) => [k, { ...v }])) as Record<Farbrolle, RollenFarbe>;
  const dok: DokFarben = { ...STANDARD_DOK };
  const hinweise: FarbHinweis[] = [];
  const primaer = hexNormal(wahl?.primaer);
  if (!primaer || !wahl) return { ci: false, dok, rolle, hinweise };
  const sekundaer = hexNormal(wahl.sekundaer);
  const akzent = hexNormal(wahl.akzent);
  const tinte = TOKEN.tinte;

  const text = fuerText(primaer, 'FFFFFF', 4.5);
  if (wahl.ueberschriften !== false) {
    dok.titel = text.hex;
    if (text.korrigiert) hinweise.push({ art: 'korrigiert', quelle: 'primaer', wofuer: 'text', original: primaer, ersatz: text.hex, kontrast: text.kontrast, deltaE: text.deltaE });
  }
  // Trennlinie: helle Primärfarbe, im Graudruck sichtbar (mindestens 1,3:1 gegen Weiss)
  let linie = mitHelligkeit(primaer, 0.78, 0.12);
  for (let l = 0.78; kontrast(linie, 'FFFFFF') < 1.3 && l > 0; l -= 0.02) linie = mitHelligkeit(primaer, l, 0.12);
  dok.trennlinie = linie;
  // Titelseite: Band in Primärfarbe mit lesbarer Schrift (Weiss oder tinte), sonst abgedunkelt
  if (kontrast(primaer, 'FFFFFF') >= 4.5) Object.assign(dok, { band: primaer, aufBand: 'FFFFFF' });
  else if (kontrast(primaer, tinte) >= 4.5) Object.assign(dok, { band: primaer, aufBand: tinte });
  else Object.assign(dok, { band: text.hex, aufBand: 'FFFFFF' });
  dok.akzent = fuerText(akzent ?? primaer, 'FFFFFF', 3).hex;

  if (wahl.tabellenkopf !== false) {
    dok.label = hauch(primaer, 0.975, tinte, 7, 0.02);
    if (wahl.tabellenkopfKraeftig) {
      const f = fuerText(primaer, 'FFFFFF', 4.5);
      if (f.korrigiert) hinweise.push({ art: 'korrigiert', quelle: 'primaer', wofuer: 'flaeche', original: primaer, ersatz: f.hex, kontrast: f.kontrast, deltaE: f.deltaE });
      dok.kopf = f.hex;
      dok.kopfText = 'FFFFFF';
      rolle.kopf = { fill: f.hex, schrift: 'FFFFFF', linie: f.hex };
    } else {
      dok.kopf = hauch(primaer, 0.94, tinte, 7);
      rolle.kopf = { fill: dok.kopf, schrift: tinte, linie: fuerText(primaer, 'FFFFFF', 3).hex };
    }
  }

  if (wahl.diagramme !== false) {
    const quellen: [FarbQuelle, string | undefined, Farbrolle][] = [
      ['primaer', primaer, 'kat-1'],
      ['sekundaer', sekundaer, 'kat-2'],
      ['akzent', akzent, 'kat-3'],
    ];
    const ci = new Set<Farbrolle>();
    for (const [quelle, hex, ziel] of quellen) {
      if (!hex) continue;
      const nah = naechsteStatusfarbe(hex);
      if (zuNahe(nah)) {
        hinweise.push({ art: 'nahe-status', quelle, status: nah.rolle, abstand: nah.abstand, sicht: nah.sicht });
        continue;
      }
      const g = fuerText(hex, 'FFFFFF', 3);
      if (g.korrigiert) hinweise.push({ art: 'korrigiert', quelle, wofuer: 'grafik', original: hex, ersatz: g.hex, kontrast: g.kontrast, deltaE: g.deltaE });
      rolle[ziel] = { fill: hauch(g.hex, 0.95, tinte, 7), schrift: tinte, linie: g.hex };
      ci.add(ziel);
    }
    // Benachbarte Reihen in Normalsicht und allen Fehlsichtigkeiten unterscheidbar; sonst nächste freie Kit-Kategorie
    // (erst eine, die zu beiden Nachbarn passt, sonst eine, die zur vorherigen passt; die nächste Runde prüft weiter)
    const quelleVon: Partial<Record<Farbrolle, FarbQuelle>> = { 'kat-1': 'primaer', 'kat-2': 'sekundaer', 'kat-3': 'akzent' };
    const angepasst = new Set<Farbrolle>(ci);
    const unterscheidbar = (a: string, b: string) => abstandFehlsicht(a, b).min >= NAHE_FEHLSICHT;
    for (let i = 1; i < KIT_KAT.length; i++) {
      const vor = rolle[KIT_KAT[i - 1]!];
      const r = KIT_KAT[i]!;
      if (!angepasst.has(r) && !angepasst.has(KIT_KAT[i - 1]!)) continue;
      const d = abstandFehlsicht(vor.linie, rolle[r].linie);
      if (d.min >= NAHE_FEHLSICHT) continue;
      const genutzt = new Set(KIT_KAT.slice(0, i).map((k) => rolle[k].linie));
      const frei = KIT_KAT.map((k) => ROLLE[k]).filter((f) => !genutzt.has(f.linie) && unterscheidbar(vor.linie, f.linie));
      const naechste = i + 1 < KIT_KAT.length ? rolle[KIT_KAT[i + 1]!].linie : undefined;
      const ersatz = frei.find((f) => !naechste || unterscheidbar(f.linie, naechste)) ?? frei[0];
      if (!ersatz) continue;
      rolle[r] = { ...ersatz };
      ci.delete(r);
      angepasst.add(r);
      hinweise.push({ art: 'reihe-ersetzt', quelle: quelleVon[r] ?? 'primaer', reihe: r, sicht: d.art });
    }
    // Sequenz (geplant, unentschieden, Datenbalken) aus der Primärfarbe, sofern sie nicht nahe an einer Statusfarbe liegt
    if (ci.has('kat-1')) {
      const stufen = [0.93, 0.84, 0.71, 0.56, 0.42];
      const fl = stufen.map((l) => mitHelligkeit(primaer, l, 0.16));
      // Mittlere Stufen können weder mit Weiss noch mit tinte 4,5:1 erreichen: dann L verschieben, bis eine Schrift passt
      const lesbar = (f: string, l: number): string => {
        for (let d = 0; d <= 0.3; d += 0.005) {
          for (const x of [mitHelligkeit(primaer, l - d, 0.16), mitHelligkeit(primaer, l + d, 0.16)]) if (Math.max(kontrast(x, 'FFFFFF'), kontrast(x, tinte)) >= 4.5) return x;
        }
        return f;
      };
      const fest = fl.map((f, i) => lesbar(f, stufen[i]!));
      fest.forEach((f, i) => {
        rolle[`seq-${i + 1}` as Farbrolle] = { fill: f, schrift: schriftAuf(f, tinte), linie: fest[Math.min(i + 1, fest.length - 1)]! };
      });
    }
  }
  const ci = JSON.stringify(dok) !== JSON.stringify(STANDARD_DOK) || Object.entries(rolle).some(([k, v]) => JSON.stringify(v) !== JSON.stringify(ROLLE[k as Farbrolle]));
  return { ci, dok, rolle, hinweise };
}

/** Flächenfarbe einer Rolle in Diagrammen (Balken, Linien) in einer Palette */
export function diagrammFarbeIn(p: Druckpalette, rolle: Farbrolle): string {
  if (rolle === 'status-gut-stark') return STATUS.gut.flaeche;
  if (rolle.startsWith('status-')) return STATUS[rolle.slice(7) as keyof typeof STATUS].flaeche;
  if (rolle.startsWith('risiko-') || rolle.startsWith('seq-')) return p.rolle[rolle].fill;
  return p.rolle[rolle].linie;
}
