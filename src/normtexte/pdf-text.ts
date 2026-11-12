// Text eines PDF mit pdf.js lesen (im PDF-Worker; in Node für den lokalen Zusatztest). pdf.js wird hineingereicht,
// damit dieses Modul ohne die Bibliothek geladen werden kann.
import { GRENZEN } from '../eingang/grenzen.ts';
import { EingangsFehler } from '../eingang/lesen.ts';
import { zeilenAusStuecken, type RohStueck, type Seite } from './zeilen.ts';

interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  fontName: string;
}
interface PdfSeite {
  getViewport(o: { scale: number }): { width: number; height: number };
  getTextContent(): Promise<{ items: (PdfTextItem | { type: string })[] }>;
  cleanup(): void;
}
interface PdfDokument {
  numPages: number;
  getPage(n: number): Promise<PdfSeite>;
}
export interface PdfJs {
  getDocument(o: Record<string, unknown>): { promise: Promise<PdfDokument>; destroy(): Promise<void> };
}

/** Optionen ohne Netz und ohne eval: keine Schriften, CMaps oder Wasm nachladen, nur Text lesen. */
export const PDF_OPTIONEN = {
  isEvalSupported: false,
  disableFontFace: true,
  useSystemFonts: false,
  useWorkerFetch: false,
  disableAutoFetch: true,
  disableStream: true,
  disableRange: true,
  stopAtErrors: false,
  verbosity: 0,
} as const;

/**
 * Seiten lesen. Mehr Seiten als die Grenze der Konfiguration (src/eingang/grenzen.ts, `maxSeiten`) bricht vor dem Auslesen ab:
 * Zerlegen und Seitentext einer riesigen PDF kosten Zeit und Speicher, bevor der Herzschlag etwas merkt (AF-018).
 */
export async function seitenAusPdf(pdfjs: PdfJs, daten: Uint8Array, fortschritt?: (fertig: number, gesamt: number) => void, maxSeiten: number = GRENZEN['norm-pdf'].maxSeiten): Promise<Seite[]> {
  const aufgabe = pdfjs.getDocument({ ...PDF_OPTIONEN, data: daten });
  const seiten: Seite[] = [];
  try {
    const doc = await aufgabe.promise;
    if (doc.numPages > maxSeiten) throw new EingangsFehler('norm-pdf', 'zu-viele-seiten', maxSeiten, doc.numPages);
    for (let n = 1; n <= doc.numPages; n++) {
      const seite = await doc.getPage(n);
      const vp = seite.getViewport({ scale: 1 });
      const inhalt = await seite.getTextContent();
      const stuecke: RohStueck[] = [];
      for (const it of inhalt.items) {
        if (!('str' in it)) continue;
        const [a = 1, b = 0, c = 0, d = 1, x = 0, y = 0] = it.transform;
        stuecke.push({ str: it.str, x, y, w: it.width, h: Math.hypot(c, d) || Math.hypot(a, b), font: it.fontName, rotiert: Math.abs(b) > 0.01 || Math.abs(c) > 0.01 });
      }
      seiten.push(zeilenAusStuecken({ breite: vp.width, hoehe: vp.height, stuecke }, n));
      seite.cleanup();
      fortschritt?.(n, doc.numPages);
    }
  } finally {
    await aufgabe.destroy();
  }
  return seiten;
}
