// Fragebogen für Fachbereiche (Blatt «Fragebogen Fachbereiche» der Vorlage D-10): ausgefüllte Zeilen lesen und
// in Einträge des KI-Inventars umsetzen. Die Spaltenköpfe sind fest (DE oder EN); die Zuordnung erfolgt über die Kopfzeile.
import { holePfad, type Texte } from '../../i18n/texte.ts';
import type { KiSystem, KiTyp, Projekt } from '../../model/typen.ts';

export type Zelle = string | number | boolean | null;

export interface GelesenesBlatt {
  name: string;
  zeilen: Zelle[][];
}

export interface ImportZeile {
  /** Zeilennummer in Excel (1-basiert) */
  nr: number;
  blatt: string;
  werte: Partial<KiSystem> & { name: string };
  /** ID eines bestehenden Systems mit gleichem Namen */
  doppelt?: string;
  /** Anmerkungen zur Umsetzung (z. B. unklare Angaben) */
  hinweise: ('personendaten-unklar' | 'besondere-unklar' | 'schatten' | 'fachbereich-frei' | 'handelnd' | 'handlung-unklar')[];
}

export interface FragebogenText {
  spalten: string[];
  herkunft: string[];
  haeufigkeit: string[];
  jaNeinUnklar: string[];
  pruefung: string[];
}

const liste = (t: Texte, s: string): string[] => {
  const w = holePfad(t, s);
  return Array.isArray(w) ? w.map(String) : [];
};

/** Feste Spaltenköpfe und Auswahllisten des Fragebogens je Sprache (aus den Texten der Vorlage D-10). */
export function fragebogenText(t: Texte): FragebogenText {
  return {
    spalten: liste(t, 'vorlagen.D-10.spalten_fragebogen'),
    herkunft: liste(t, 'vorlagen.D-10.listen.herkunft'),
    haeufigkeit: liste(t, 'vorlagen.D-10.listen.haeufigkeit'),
    jaNeinUnklar: liste(t, 'vorlagen.D-10.listen.ja_nein_unklar'),
    pruefung: liste(t, 'vorlagen.D-10.listen.pruefung'),
  };
}

const norm = (z: Zelle | undefined): string => (z === null || z === undefined ? '' : String(z)).replace(/\s+/g, ' ').trim();
const gleich = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0;

/** Kopfzeile finden: Spalten 1 bis 3 (Fachbereich, ausgefüllt von, Name) entsprechen einer der Sprachen. */
function kopfzeile(b: GelesenesBlatt, sprachen: FragebogenText[]): { zeile: number; text: FragebogenText; spalten: number[] } | null {
  for (let i = 0; i < Math.min(b.zeilen.length, 40); i++) {
    const z = b.zeilen[i]!.map(norm);
    for (const text of sprachen) {
      if (text.spalten.length < 14) continue;
      const spalten = text.spalten.map((k) => z.findIndex((c) => gleich(c, k)));
      // Name (Spalte 3) und Zweck (Spalte 4) müssen vorhanden sein; die übrigen sind optional
      if (spalten[2]! >= 0 && spalten[3]! >= 0) return { zeile: i, text, spalten };
    }
  }
  return null;
}

/** Index eines Werts in einer Auswahlliste (beide Sprachen); -1 = unbekannt */
function index(wert: string, listen: string[][]): number {
  if (!wert) return -1;
  for (const l of listen) {
    const i = l.findIndex((x) => gleich(x, wert));
    if (i >= 0) return i;
  }
  return -1;
}

const HERKUNFT_TYP: KiTyp[] = ['eingekauft', 'eingekauft', 'schatten', 'eigenbau'];
const PRUEFUNG_AUTOMATISIERUNG = ['unterstuetzend', 'teilautomatisiert', 'vollautomatisiert'] as const;

export interface FragebogenUmfeld {
  sprachen: FragebogenText[];
  /** Fachbereich-Werte mit Beschriftungen in beiden Sprachen (gefuehrt.optionen.fachbereich) */
  fachbereiche: { wert: string; texte: string[] }[];
  /** Beschriftungen für Zusatzangaben in der Beschreibung */
  beschriftung: { ausgefuelltVon: string; personen: string; haeufigkeit: string; anbieter: string; bemerkungen: string; unklar: string };
}

/** Liest alle Fragebogen-Blätter einer Arbeitsmappe. Liefert null, wenn keine Kopfzeile gefunden wurde. */
export function liesFragebogen(blaetter: readonly GelesenesBlatt[], projekt: Projekt, u: FragebogenUmfeld): ImportZeile[] | null {
  const ergebnis: ImportZeile[] = [];
  let gefunden = false;
  const namen = new Map(projekt.kiSysteme.map((s) => [s.name.trim().toLowerCase(), s.id]));
  const neueNamen = new Set<string>();
  for (const b of blaetter) {
    const k = kopfzeile(b, u.sprachen);
    if (!k) continue;
    gefunden = true;
    const listen = (f: keyof FragebogenText) => u.sprachen.map((s) => s[f]);
    for (let i = k.zeile + 1; i < b.zeilen.length; i++) {
      const z = b.zeilen[i]!;
      const sp = (n: number) => (k.spalten[n]! >= 0 ? norm(z[k.spalten[n]!]) : '');
      const name = sp(2);
      if (!name) continue;
      const hinweise: ImportZeile['hinweise'] = [];
      const herkunft = index(sp(4), listen('herkunft'));
      const typ: KiTyp = herkunft >= 0 ? HERKUNFT_TYP[herkunft]! : 'eingekauft';
      if (typ === 'schatten') hinweise.push('schatten');
      const jn = (n: number): boolean | 'unklar' => {
        const x = index(sp(n), listen('jaNeinUnklar'));
        return x === 0 ? true : x === 2 ? 'unklar' : false;
      };
      const pd = jn(9);
      const bd = jn(10);
      if (pd === 'unklar') hinweise.push('personendaten-unklar');
      if (bd === 'unklar') hinweise.push('besondere-unklar');
      const pruefung = index(sp(12), listen('pruefung'));
      // Frage 13 (ab rc.2): Kann das Werkzeug selbst etwas tun? «ja» und «weiss nicht» vorsichtig als «führt begrenzt aus»
      // übernehmen (Prüfregel H28 fragt dann nach Stoppmöglichkeit, Protokollen und Aufsicht); Frage 14: Zugriffe
      const handlung = sp(14) ? jn(14) : undefined;
      if (handlung === true) hinweise.push('handelnd');
      if (handlung === 'unklar') hinweise.push('handlung-unklar');
      const zugriffe = sp(15);
      const fbText = sp(0);
      const fb = u.fachbereiche.find((f) => f.wert === fbText || f.texte.some((x) => gleich(x, fbText)));
      if (fbText && !fb) hinweise.push('fachbereich-frei');
      const b2 = u.beschriftung;
      const zusatz = [
        sp(1) && `${b2.ausgefuelltVon}: ${sp(1)}`,
        sp(5) && `${b2.anbieter}: ${sp(5)}`,
        sp(6) && `${b2.personen}: ${sp(6)}`,
        sp(7) && `${b2.haeufigkeit}: ${sp(7)}`,
        sp(13) && `${b2.bemerkungen}: ${sp(13)}`,
        (pd === 'unklar' || bd === 'unklar') && b2.unklar,
      ].filter(Boolean);
      const schluessel = name.toLowerCase();
      const doppelt = namen.get(schluessel) ?? (neueNamen.has(schluessel) ? '(Import)' : undefined);
      neueNamen.add(schluessel);
      ergebnis.push({
        nr: i + 1,
        blatt: b.name,
        hinweise,
        doppelt,
        werte: {
          name,
          typ,
          zweck: sp(3),
          fachbereich: fb?.wert ?? fbText,
          beschreibung: zusatz.join('\n'),
          // Unklare Angaben vorsichtig als «ja» übernehmen; die Prüfung erfolgt im Inventar
          personendaten: pd !== false,
          besondereDaten: bd !== false,
          betroffene: sp(11),
          automatisierung: pruefung >= 0 ? PRUEFUNG_AUTOMATISIERUNG[pruefung] : 'unterstuetzend',
          status: typ === 'schatten' ? 'in-pruefung' : 'erfasst',
          lieferant: projekt.lieferanten.find((l) => sp(5) && gleich(l.name, sp(5)))?.id,
          ressourcen: { daten: sp(8), werkzeuge: sp(5), rechenressourcen: '', personal: '' },
          ...(handlung === true || handlung === 'unklar' ? { handlungsbefugnis: 'fuehrt-begrenzt-aus' as const } : {}),
          ...(zugriffe ? { zugriffe } : {}),
        },
      });
    }
  }
  return gefunden ? ergebnis : null;
}
