// Hauptthread-Seite des PDF-Workers (Block #code-normpdf): erst beim ersten Import entpackt und gestartet.
// Zeitgrenze und Herzschlag (AF-019): Der Worker meldet jede Seite; schweigt er länger als der Herzschlag der Konfiguration
// (src/eingang/grenzen.ts), beendet die Wache ihn, und der Auftrag endet mit einer Meldung statt einer stehenden Anzeige.
import type { ParseErgebnis } from '../../normtexte/parser.ts';
import type { PdfAntwort, PdfAuftrag, PdfBildAuftrag } from '../../normtexte/pdf-worker.ts';
import { erwartet27001, erwartet42001 } from '../../normtexte/erwartet.ts';
import { EingangsFehler } from '../../eingang/lesen.ts';
import { wacheStarten, type Uhr } from '../../eingang/zeit.ts';
import { appDaten } from '../daten.ts';
import { entpackeBlock, workerAusText } from '../worker/start.ts';
import { technikText } from '../speicher/technik.ts';

export class PasswortNoetig extends Error {}

/** Was der Hauptthread vom Worker braucht (für Tests ersetzbar) */
export type PdfWorker = Pick<Worker, 'addEventListener' | 'removeEventListener' | 'postMessage' | 'terminate'>;

let worker: PdfWorker | null = null;
let nr = 0;
let fabrik: () => PdfWorker = () => {
  const code = entpackeBlock('code-normpdf');
  if (!code) throw new Error('PDF-Leser fehlt im Werkzeug');
  return workerAusText(code);
};
let uhr: Uhr | undefined;

/** Für Tests: eigenen Worker und eigene Uhr setzen */
export function setzePdfUmgebung(o: { fabrik?: () => PdfWorker; uhr?: Uhr }): void {
  if (o.fabrik) fabrik = o.fabrik;
  uhr = o.uhr;
  worker = null;
}

function starte(): PdfWorker {
  if (worker) return worker;
  const w = fabrik();
  worker = w;
  w.addEventListener('error', () => {
    if (worker === w) worker = null;
  });
  return w;
}

/** Worker beenden; der nächste Auftrag startet einen neuen */
function beenden(w: PdfWorker): void {
  if (worker === w) worker = null;
  w.terminate();
}

/** Liest die Norm-PDF im Worker und zerlegt sie. Der Text verlässt den Rechner nicht (CSP connect-src 'none'). */
export function liesNormPdf(daten: Uint8Array, o: { passwort?: string; fortschritt?: (fertig: number, gesamt: number) => void } = {}): Promise<ParseErgebnis> {
  const w = starte();
  const n = ++nr;
  const k = appDaten().kataloge;
  return new Promise((ok, fehler) => {
    const aufraeumen = (): void => {
      w.removeEventListener('message', hoere as EventListener);
      w.removeEventListener('error', fehlt as EventListener);
    };
    const wache = wacheStarten('norm-pdf', (f) => {
      aufraeumen();
      beenden(w);
      fehler(f);
    }, uhr ? { uhr } : {});
    const hoere = (e: MessageEvent<PdfAntwort>) => {
      const a = e.data;
      if (a.nr !== n) return;
      if (a.art === 'fortschritt') {
        wache.lebt();
        o.fortschritt?.(a.fertig, a.gesamt);
        return;
      }
      wache.ende();
      aufraeumen();
      if (a.art === 'ergebnis') ok(a.ergebnis);
      else if (a.art === 'fehler') fehler(a.eingang ? new EingangsFehler('norm-pdf', a.eingang.grund, a.eingang.grenze, a.eingang.wert) : a.passwort ? new PasswortNoetig(a.meldung) : new Error(a.meldung));
    };
    const fehlt = (e: ErrorEvent) => {
      wache.ende();
      aufraeumen();
      fehler(new Error(technikText(e) || 'PDF-Leser konnte nicht starten'));
    };
    w.addEventListener('message', hoere as EventListener);
    w.addEventListener('error', fehlt as EventListener);
    const auftrag: PdfAuftrag = { nr: n, daten, erwartet: { '42001': erwartet42001(k), '27001': erwartet27001(k) }, ...(o.passwort ? { passwort: o.passwort } : {}) };
    w.postMessage(auftrag, [daten.buffer as ArrayBuffer]);
  });
}

/** Seite einer PDF als PNG (Vorschau der Bibliothek, ab rc.10); derselbe Worker wie für die Normtexte, dieselbe Wache */
export function pdfSeiteBild(daten: Uint8Array, seite = 1, breite = 900): Promise<{ png: Uint8Array; seiten: number }> {
  const w = starte();
  const n = ++nr;
  return new Promise((ok, fehler) => {
    const wache = wacheStarten('norm-pdf', (f) => {
      w.removeEventListener('message', hoere as EventListener);
      beenden(w);
      fehler(f);
    }, uhr ? { uhr } : {});
    const hoere = (e: MessageEvent<PdfAntwort>) => {
      const a = e.data;
      if (a.nr !== n || a.art === 'fortschritt') return;
      wache.ende();
      w.removeEventListener('message', hoere as EventListener);
      if (a.art === 'bild') ok({ png: a.png, seiten: a.seiten });
      else fehler(new Error(a.art === 'fehler' ? a.meldung : 'Unerwartete Antwort'));
    };
    w.addEventListener('message', hoere as EventListener);
    const auftrag: PdfBildAuftrag = { nr: n, art: 'bild', daten: daten.slice(), seite, breite };
    w.postMessage(auftrag, [auftrag.daten.buffer as ArrayBuffer]);
  });
}
