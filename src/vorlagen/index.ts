// Register aller Vorlagen-Funktionen.
import type { Block, DocxDokument, XlsxMappe } from '../generator/ir.ts';
import { erstelleHelfer, md, type Vorlage, type VorlagenKontext } from './kontext.ts';
import { d00 } from './D-00.ts';
import { d01 } from './D-01.ts';
import { d02 } from './D-02.ts';
import { d03 } from './D-03.ts';
import { d04 } from './D-04.ts';
import { d05 } from './D-05.ts';
import { d06 } from './D-06.ts';
import { d07 } from './D-07.ts';
import { d08 } from './D-08.ts';
import { d09 } from './D-09.ts';
import { d10 } from './D-10.ts';
import { d11 } from './D-11.ts';
import { d12 } from './D-12.ts';
import { d13 } from './D-13.ts';
import { d14 } from './D-14.ts';
import { d15 } from './D-15.ts';
import { d16 } from './D-16.ts';
import { d17 } from './D-17.ts';
import { d20 } from './D-20.ts';
import { d21 } from './D-21.ts';
import { d22 } from './D-22.ts';
import { d23 } from './D-23.ts';
import { d24 } from './D-24.ts';
import { d25 } from './D-25.ts';
import { d26, d26Register } from './D-26.ts';
import { d27 } from './D-27.ts';
import { e01 } from './E-01.ts';
import { e02 } from './E-02.ts';
import { e03 } from './E-03.ts';
import { e04 } from './E-04.ts';
import { e05 } from './E-05.ts';
import { e06 } from './E-06.ts';
import { e07 } from './E-07.ts';
import { e08 } from './E-08.ts';
import { e09 } from './E-09.ts';
import { n01 } from './N-01.ts';
import { n02 } from './N-02.ts';
import { n03 } from './N-03.ts';
import { n04 } from './N-04.ts';
import { ergaenzungsblatt } from './ergaenzungsblatt.ts';

/**
 * Verweise im ganzen Dokument auf die IDs im Pfad der Firma lenken (im Pfad mit ISMS D-04-EB statt D-04), auch in
 * Texten aus den Katalogen. Gilt für jede Vorlage; pfadVerweise ist idempotent, Vorlagen dürfen es zusätzlich selbst aufrufen.
 * geplanteVerweise darf nur einmal laufen (hier).
 */
/** Leere Vorlage: fester Block «Wozu, Was tun, Nachweis» direkt nach dem Vorlagenhinweis (Wort und Excel) */
export function mitEinleitung<T extends DocxDokument | XlsxMappe>(ir: T, ctx: VorlagenKontext): T {
  if (ctx.modus !== 'leer') return ir;
  const id = ir.lenkung.dokumentId.replace(/-EB$/, '');
  const k = (s: string) => `vorlagen.einleitung.${s}`;
  if (ctx.u.tOpt(k(`texte.${id}.wozu`)) === undefined) return ir;
  const zeile = (s: string) => `**${ctx.u.t(k(s))}:** ${ctx.u.t(k(`texte.${id}.${s}`))}`;
  const block: Block = { typ: 'hinweis', art: 'ausfuellhinweis', text: md(['wozu', 'was', 'nachweis'].map(zeile).join('\n')) };
  const einfuegen = (b: Block[]): Block[] => [...b.slice(0, 1), block, ...b.slice(1)];
  if ('bloecke' in ir) return { ...ir, bloecke: einfuegen(ir.bloecke) };
  return { ...ir, hinweisBlock: einfuegen(ir.hinweisBlock ?? []) };
}

/** Rhythmus-Schlüssel der Optionsgruppe in Daten und Texten: im englischen Dokument übersetzt, auch mitten im Satz (Runde 1, F-05) */
const RHYTHMUS = /\b(vierzehntaeglich|monatlich|quartalsweise|halbjaehrlich|jaehrlich)\b/g;
function ohneDeutscheWerte<T extends DocxDokument | XlsxMappe>(ir: T, ctx: VorlagenKontext, abbilden: (ir: T, f: (s: string) => string) => T): T {
  if (ctx.u.sprache !== 'en') return ir;
  return abbilden(ir, (s) => s.replace(RHYTHMUS, (w) => ctx.u.tOpt(`gefuehrt.optionen.rhythmus.${w}`) ?? w));
}

const imPfad =
  (v: Vorlage): Vorlage =>
  (ctx) => {
    const h = erstelleHelfer(ctx);
    // danach Verweise auf Dokumente, die zum Freigabedatum noch nicht freigegeben waren, als «in Erarbeitung» kennzeichnen
    // zuerst eine Quelle für den Normbezug (Kasten und Kopf), dann die Verweise
    // zuletzt der Quellenvermerk, wenn Normtexte der Firma übernommen wurden (nur Firmendokumente nach Bestätigung)
    return mitEinleitung(ohneDeutscheWerte(h.normVermerk(h.geplanteVerweise(h.pfadVerweise(h.normbezugVereinheitlichen(v(ctx))))), ctx, h.textAbbildenIr), ctx);
  };

/** Hauptvorlage je Dokument-ID (Katalog src/kataloge/dokumente.yaml) */
export const VORLAGEN: Record<string, Vorlage> = Object.fromEntries(
  Object.entries({
    'D-00': d00, 'D-01': d01, 'D-02': d02, 'D-03': d03, 'D-04': d04, 'D-05': d05, 'D-06': d06, 'D-07': d07,
    'D-08': d08, 'D-09': d09, 'D-10': d10, 'D-11': d11, 'D-12': d12, 'D-13': d13, 'D-14': d14, 'D-15': d15,
    'D-16': d16, 'D-17': d17, 'D-20': d20, 'D-21': d21, 'D-22': d22, 'D-23': d23, 'D-24': d24, 'D-25': d25,
    'D-26': d26, 'D-27': d27,
    // Modul EU AI Act
    'E-01': e01, 'E-02': e02, 'E-03': e03, 'E-04': e04, 'E-05': e05, 'E-06': e06, 'E-07': e07, 'E-08': e08, 'E-09': e09,
    // Modul NIST AI RMF
    'N-01': n01, 'N-02': n02, 'N-03': n03, 'N-04': n04,
  } satisfies Record<string, Vorlage>).map(([id, v]) => [id, imPfad(v)]),
);

/** Zusätzliche Dateien zu einer Dokument-ID (Dateistamm + Suffix) */
export const ZUSATZDATEIEN: Record<string, { suffix: { de: string; en: string }; vorlage: Vorlage }[]> = {
  'D-26': [{ suffix: { de: 'Register', en: 'Register' }, vorlage: imPfad(d26Register) }],
};

/** Vorlagen, die selbst eine Ergänzungsblatt-Form (ctx.form = 'ergaenzungsblatt') haben */
export const EIGENE_EB_FORM = new Set(['D-04', 'D-06', 'D-10', 'D-14', 'D-15', 'D-16', 'D-17', 'D-20', 'D-21', 'D-22', 'D-26']);

/** Ergänzungsblätter ohne eigene Vorlagen-Form werden generisch erzeugt (z. B. D-03-EB, D-07-EB) */
export function generischesErgaenzungsblatt(ebId: string): Vorlage {
  return imPfad((ctx: VorlagenKontext) => ergaenzungsblatt(ctx, ebId));
}
