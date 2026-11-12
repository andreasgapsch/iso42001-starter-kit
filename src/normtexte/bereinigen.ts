// Bereinigung der Zeilen eines Norm-PDF vor dem Zerlegen: Ligaturen und Sonderzeichen, Kopf- und Fusszeilen,
// Seitenzahlen, Inhaltsverzeichnis, Wasserzeichen und Downloadvermerke (Kundennummer, «Licensed to …»).
import type { Seite, Zeile } from './zeilen.ts';

// U+FB00 bis U+FB06: ff, fi, fl, ffi, ffl, langes st, st
const LIGATUREN: Record<string, string> = { '\ufb00': 'ff', '\ufb01': 'fi', '\ufb02': 'fl', '\ufb03': 'ffi', '\ufb04': 'ffl', '\ufb05': 'st', '\ufb06': 'st' };

/** Ligaturen auflösen, weiches Trennzeichen und unsichtbare Zeichen entfernen, Leerraum vereinheitlichen. */
export function zeichenBereinigen(text: string): string {
  return text
    .replace(/[\ufb00-\ufb06]/g, (z) => LIGATUREN[z] ?? z)
    .replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/g, '')
    .replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .normalize('NFC')
    .trim();
}

/** Downloadvermerke und Wasserzeichen der Normenverkäufer (nie Normtext). */
const VERMERK = [
  /normen-?download/i,
  /\bKd\.?-?Nr\b/i,
  /kunden-?nr/i,
  /\blicen[cs]ed\s+to\b/i,
  /\blizenziert\s+f(ü|ue)r\b/i,
  /\bsingle[- ]user\b/i,
  /\beinzelplatz/i,
  /\bheruntergeladen\b/i,
  /\bdownloaded\b.*\b(by|on|am)\b/i,
  /\bbestell-?nr\b/i,
  /\border\s+(no|number)\b/i,
  /leerseite|page blanche|blank page/i,
];

const SEITENZAHL = [
  /^[-\u2013\u2014\s]*\d{1,3}[-\u2013\u2014\s]*$/,
  /^[ivxlc]{1,6}$/i,
  /^(Seite|Page|S\.)\s*\d{1,3}(\s*(von|of|\/)\s*\d{1,3})?$/i,
];

/** Schlüssel für wiederkehrende Zeilen: Ziffern und römische Seitenzahlen neutralisiert. */
function schluessel(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b[ivxlc]{1,6}\b/g, '#')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

export function istVermerk(text: string): boolean {
  return VERMERK.some((m) => m.test(text));
}

export function istSeitenzahl(text: string): boolean {
  return SEITENZAHL.some((m) => m.test(text.trim()));
}

/** Zeile im Inhaltsverzeichnis: Punktleiste oder Abschnittsnummer mit Seitenzahl am Ende. */
export function istVerzeichniszeile(text: string): boolean {
  if (/(\.\s?){4,}\s*[\divxlc]*\s*$/i.test(text) || /\u2026{2,}/.test(text)) return true;
  return false;
}

/** Rand oben und unten in Anteilen der Seitenhöhe (Kopf- und Fusszeilen liegen darin). */
const RAND = 0.085;

/**
 * Bereinigt alle Seiten:
 *  1. Zeichen (Ligaturen, weiche Trennung) in Zeilen und Läufen
 *  2. Downloadvermerke und Wasserzeichen überall
 *  3. Kopf- und Fusszeilen: Zeilen im Rand, die (mit neutralisierten Zahlen) auf mindestens einem Viertel der Seiten
 *     wiederkehren, sowie Seitenzahlen im Rand
 *  4. Zeilen, die auf der Hälfte aller Seiten gleich vorkommen (gestempelte Vermerke im Satzspiegel)
 */
export function seitenBereinigen(seiten: Seite[]): Seite[] {
  const sauber = seiten.map((s) => ({
    ...s,
    zeilen: s.zeilen
      .map((z): Zeile => ({ ...z, text: zeichenBereinigen(z.text), laeufe: z.laeufe.map((l) => ({ ...l, text: zeichenBereinigen(l.text) })).filter((l) => l.text) }))
      .filter((z) => z.text && !istVermerk(z.text)),
  }));
  const imRand = (z: Zeile, s: Seite) => z.y < RAND * s.hoehe || z.y > (1 - RAND) * s.hoehe;
  const randZaehler = new Map<string, Set<number>>();
  const ueberall = new Map<string, Set<number>>();
  for (const s of sauber) {
    for (const z of s.zeilen) {
      const k = schluessel(z.text);
      if (imRand(z, s)) {
        if (!randZaehler.has(k)) randZaehler.set(k, new Set());
        randZaehler.get(k)!.add(s.nr);
      }
      if (z.text.length < 150) {
        if (!ueberall.has(k)) ueberall.set(k, new Set());
        ueberall.get(k)!.add(s.nr);
      }
    }
  }
  const n = sauber.length;
  const randGrenze = Math.max(2, Math.ceil(n / 4));
  const ueberallGrenze = Math.max(3, Math.ceil(n / 2));
  return sauber.map((s) => ({
    ...s,
    zeilen: s.zeilen.filter((z) => {
      const k = schluessel(z.text);
      if (imRand(z, s) && ((randZaehler.get(k)?.size ?? 0) >= randGrenze || istSeitenzahl(z.text))) return false;
      if ((ueberall.get(k)?.size ?? 0) >= ueberallGrenze) return false;
      return true;
    }),
  }));
}
