// Gemeinsame Bausteine der Ziele: Grundlagen (Beispielprojekte), Rundreise, Erkennung von Rohfehlern, Giftprüfung für SVG
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { ladeProjektText, pruefeProjektDaten } from '../../../src/app/import/laden.ts';
import { vorDemSpeichern } from '../../../src/app/zustand/store.ts';
import { routeZuHash } from '../../../src/app/logik/routen.ts';
import { parseXml } from '../../../src/prozesse/xml.ts';
import type { Projekt } from '../../../src/model/typen.ts';
import { vollstaendigesProjekt } from '../../fixtures/projekt.ts';
import { OrakelFehler, type Urteil } from '../typen.ts';
import type { Zufall } from '../zufall.ts';

const REPO = process.cwd();

/** Fester Zeitstempel für jedes erzeugte ZIP: fflate nimmt sonst die Uhrzeit, und gleiche Fälle hätten verschiedene Bytes */
export const ZIP_ZEIT = new Date('2026-10-01T09:00:00Z');

/** Feste Projektkennung: vollstaendigesProjekt() vergibt sonst bei jedem Aufruf eine neue, das machte Fälle unwiederholbar */
export const FESTE_PROJEKT_ID = '5e1f7a52-3c1d-4b8e-9d52-0a1b2c3d4e5f';

export function festesTestprojekt(): Projekt {
  const p = JSON.parse(JSON.stringify(vollstaendigesProjekt())) as Projekt;
  p.meta.projektId = FESTE_PROJEKT_ID;
  return p;
}

let beispielCache: Record<string, unknown>[] | null = null;

/** Grundlagen für Projekt-Fälle: die vier Beispiele des Kits und das Testprojekt. Je Aufruf eine tiefe Kopie. */
export function grundProjekt(z: Zufall): Record<string, unknown> {
  if (!beispielCache) {
    const ordner = join(REPO, 'src/beispiele');
    beispielCache = readdirSync(ordner)
      .filter((n) => n.endsWith('.aims.json'))
      .sort()
      .map((n) => JSON.parse(readFileSync(join(ordner, n), 'utf8')) as Record<string, unknown>);
    beispielCache.push(festesTestprojekt() as unknown as Record<string, unknown>);
  }
  return structuredClone(z.wahl(beispielCache));
}

/** Fehler, die auf einen ungefangenen Fehler im Code deuten (Rohtext für den Menschen, kein Ablehnungsgrund) */
export const istRohfehler = (e: unknown): boolean =>
  e instanceof TypeError || e instanceof RangeError || e instanceof SyntaxError || e instanceof ReferenceError || e instanceof EvalError || e instanceof URIError;

/** Meldung einer erwarteten Ablehnung; ein Rohfehler ist ein Fund, kein Urteil «abgelehnt» */
export function ablehnung(e: unknown, wo: string): Urteil {
  if (istRohfehler(e)) throw new OrakelFehler(`${wo}: Rohfehler statt Meldung (${e instanceof Error ? `${e.name}: ${e.message}` : String(e)})`.slice(0, 400));
  const meldung = e instanceof Error ? e.message : '';
  if (!meldung.trim()) throw new OrakelFehler(`${wo}: Ablehnung ohne Meldung`);
  return { urteil: 'abgelehnt', meldung: meldung.slice(0, 200) };
}

/**
 * Rundreise Speichern und Laden wie die App: Prüfung vor dem Speichern (vorDemSpeichern), Serialisieren wie der Speicher
 * (JSON mit Einrückung 2), Laden mit ladeProjektText. Das Ergebnis muss gleich sein; jede Abweichung ist Datenverlust.
 */
export function rundreise(p: Projekt, wo: string): void {
  let gespeichert: Projekt;
  try {
    gespeichert = vorDemSpeichern(p);
  } catch (e) {
    throw new OrakelFehler(`${wo}: Prüfung vor dem Speichern lehnt eine gültig geladene Datei ab (${e instanceof Error ? e.message.slice(0, 200) : String(e)})`);
  }
  const text = JSON.stringify(gespeichert, null, 2);
  const r = ladeProjektText(text);
  if (!r.ok) throw new OrakelFehler(`${wo}: gespeicherte Datei lässt sich nicht mehr laden (${r.art}: ${r.details.join('; ').slice(0, 200)})`);
  if (!isDeepStrictEqual(JSON.parse(JSON.stringify(r.projekt)), JSON.parse(text))) throw new OrakelFehler(`${wo}: Datenverlust in der Rundreise (geladenes Projekt weicht vom gespeicherten ab)`);
  unicodeUndRouten(r.projekt, wo);
}

/** Ist das Projekt für die App wieder lesbar (Schema)? */
export function projektLesbar(p: unknown, wo: string): void {
  const r = pruefeProjektDaten(p);
  if (!r.ok) throw new OrakelFehler(`${wo}: Ergebnis nicht gültig (${r.fehler[0]?.instancePath ?? '?'}: ${r.fehler[0]?.message ?? '?'})`);
}

/**
 * Giftprüfung eines bereinigten SVG, unabhängig vom Bereiniger gebaut (andere Regeln, anderer Parser): kein Skript, keine
 * Ereignisattribute, keine Verweise ausser auf Kennungen derselben Datei, keine DTD, wohlgeformt.
 */
export function svgGift(svg: string): string | undefined {
  if (/<\s*(script|foreignobject|iframe|object|embed|link|meta|use\b[^>]*\bhref\s*=\s*["'](?!#))/i.test(svg)) return 'gefährliches Element';
  if (/<!|<\?/.test(svg)) return 'DOCTYPE, Kommentar oder Anweisung';
  if (/\son[a-z]+\s*=/i.test(svg)) return 'Ereignisattribut';
  if (/javascript\s*:|vbscript\s*:|data\s*:|@import|expression\s*\(|-moz-binding|behavior\s*:/i.test(svg)) return 'aktiver Verweis';
  for (const m of svg.matchAll(/\b(?:xlink:)?href\s*=\s*"([^"]*)"/gi)) if (!/^#[^%]*$/.test(m[1]!)) return `Verweis ausserhalb der Datei: ${m[1]!.slice(0, 60)}`;
  for (const m of svg.matchAll(/url\s*\(\s*['"&quot;]*\s*(.?)/gi)) if (m[1] !== '#') return 'url( ohne #';
  if (/https?:\/\/(?!www\.w3\.org\/(2000\/svg|1999\/xlink))/i.test(svg)) return 'fremde Adresse';
  try {
    parseXml(svg);
  } catch (e) {
    return `nicht wohlgeformt (${e instanceof Error ? e.message.slice(0, 80) : String(e)})`;
  }
  return undefined;
}

/**
 * Orakel für angenommene Projekte (E2-17): Alle Texte und Schlüssel sind wohlgeformt (kein einzelnes Surrogat), und jede Kennung
 * lässt sich als Sprungziel in eine Hash-Route abbilden, ohne dass encodeURIComponent wirft («URI malformed» im Fehlerdialog).
 * Die Rundreise allein sieht das nicht: JSON.stringify maskiert einzelne Surrogate und stellt sie beim Laden wieder her.
 */
const wohl = (s: string): boolean => (s as string & { isWellFormed(): boolean }).isWellFormed();

export function unicodeUndRouten(p: unknown, wo: string): void {
  const stapel: unknown[] = [p];
  const kennungen = new Set<string>();
  let besucht = 0;
  while (stapel.length) {
    const w = stapel.pop();
    if (++besucht > 2_000_000) break;
    if (typeof w === 'string') {
      if (!wohl(w)) throw new OrakelFehler(`${wo}: Text mit einzelnem Surrogat im angenommenen Projekt (Fehlerdialog URI malformed möglich, Rohfehler)`, 'absturz');
    } else if (Array.isArray(w)) stapel.push(...w);
    else if (w && typeof w === 'object') {
      for (const [k, v] of Object.entries(w)) {
        if (!wohl(k)) throw new OrakelFehler(`${wo}: Schlüssel mit einzelnem Surrogat im angenommenen Projekt (Rohfehler)`, 'absturz');
        if (k === 'id' && typeof v === 'string' && kennungen.size < 5000) kennungen.add(v);
        stapel.push(v);
      }
    }
  }
  const module = ['risiken', 'inventar', 'massnahmen', 'dokumente', 'nachweise'];
  for (const id of kennungen) {
    try {
      for (const m of module) routeZuHash({ art: 'formular', modul: m, id });
      routeZuHash({ art: 'bibliothek', unter: 'eintrag', id });
      routeZuHash({ art: 'prozesse', id });
      routeZuHash({ art: 'wissen', unter: 'regelwerk', id });
      routeZuHash({ art: 'gefuehrt', etappe: id, seite: id, eintrag: id, von: id });
    } catch (e) {
      throw new OrakelFehler(`${wo}: routeZuHash wirft für Kennung «${id.slice(0, 40)}» (${e instanceof Error ? `${e.name}: ${e.message}` : String(e)})`.slice(0, 300), 'absturz');
    }
  }
}
