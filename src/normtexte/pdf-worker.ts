// Einstieg des PDF-Workers: liest die eigene Norm-PDF der Firma mit pdf.js und zerlegt sie (parser.ts).
// Wird als IIFE gebaut, deflate-komprimiert eingebettet (Block #code-normpdf, scripts/app-bauen.mts) und erst beim ersten
// Import über eine Blob-URL gestartet. pdf.js läuft hier ohne eigenen Worker (pdfjsWorker im selben Thread), ohne eval,
// ohne Schriften und ohne Netz: nur Text.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import { EingangsFehler } from '../eingang/lesen.ts';
import type { Erwartet } from './erwartet.ts';
import { zerlege, type ParseErgebnis } from './parser.ts';
import { seitenAusPdf, type PdfJs } from './pdf-text.ts';
import { seiteAlsBild, type PdfJsBild } from './pdf-bild.ts';
import type { NormNr } from './typen.ts';

(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;

export interface PdfAuftrag {
  nr: number;
  daten: Uint8Array;
  erwartet: Record<NormNr, Erwartet>;
  passwort?: string;
}

/** Vorschau der Bibliothek (ab rc.10): eine Seite als PNG */
export interface PdfBildAuftrag {
  nr: number;
  art: 'bild';
  daten: Uint8Array;
  seite: number;
  breite: number;
}

export type PdfAntwort =
  | { nr: number; art: 'fortschritt'; fertig: number; gesamt: number }
  | { nr: number; art: 'ergebnis'; ergebnis: ParseErgebnis }
  | { nr: number; art: 'bild'; png: Uint8Array; seiten: number }
  | { nr: number; art: 'fehler'; meldung: string; passwort?: boolean; eingang?: { grund: EingangsFehler['grund']; grenze: number; wert?: number } };

interface Scope {
  postMessage(a: PdfAntwort): void;
  addEventListener(t: 'message', f: (e: MessageEvent<PdfAuftrag | PdfBildAuftrag>) => void): void;
}
const scope = globalThis as unknown as Scope;

scope.addEventListener('message', (e) => {
  const a = e.data;
  if ('art' in a && a.art === 'bild') {
    seiteAlsBild(pdfjs as unknown as PdfJsBild, a.daten, a.seite, a.breite)
      .then((r) => scope.postMessage({ nr: a.nr, art: 'bild', ...r }))
      .catch((x: unknown) => scope.postMessage({ nr: a.nr, art: 'fehler', meldung: x instanceof Error ? x.message : String(x) }));
    return;
  }
  const t = a as PdfAuftrag;
  const pdf = pdfjs as unknown as PdfJs;
  const mitPasswort: PdfJs = { getDocument: (o) => pdf.getDocument({ ...o, ...(t.passwort ? { password: t.passwort } : {}) }) };
  seitenAusPdf(mitPasswort, t.daten, (fertig, gesamt) => scope.postMessage({ nr: t.nr, art: 'fortschritt', fertig, gesamt }))
    .then((seiten) => scope.postMessage({ nr: t.nr, art: 'ergebnis', ergebnis: zerlege(seiten, t.erwartet) }))
    .catch((x: unknown) => {
      const name = (x as { name?: string } | null)?.name;
      // Grenze des Eingangsmoduls (Seitenzahl): strukturiert weitergeben, damit die Oberfläche den Text mit den Werten zeigt
      const eingang = x instanceof EingangsFehler ? { grund: x.grund, grenze: x.grenze, ...(x.wert !== undefined ? { wert: x.wert } : {}) } : undefined;
      scope.postMessage({ nr: t.nr, art: 'fehler', meldung: x instanceof Error ? x.message : String(x), passwort: name === 'PasswordException', ...(eingang ? { eingang } : {}) });
    });
});
