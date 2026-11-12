// Seite einer PDF als PNG im Worker (OffscreenCanvas), für die Vorschau der Bibliothek. pdf.js wird hineingereicht.
// Ohne Netz und ohne eval (PDF_OPTIONEN); Schriften als Pfade, nicht eingebettete Standardschriften können fehlen.
import { pngKodieren } from '../generator/png.ts';
import { PDF_OPTIONEN } from './pdf-text.ts';

interface Leinwand {
  canvas: OffscreenCanvas | null;
  context: OffscreenCanvasRenderingContext2D | null;
}

/** Leinwände ohne DOM (OffscreenCanvas) für pdf.js im Worker */
class OffscreenFabrik {
  create(breite: number, hoehe: number): Leinwand {
    const canvas = new OffscreenCanvas(Math.max(1, Math.ceil(breite)), Math.max(1, Math.ceil(hoehe)));
    return { canvas, context: canvas.getContext('2d', { willReadFrequently: true }) };
  }
  reset(l: Leinwand, breite: number, hoehe: number): void {
    if (!l.canvas) throw new Error('Canvas fehlt');
    l.canvas.width = Math.max(1, Math.ceil(breite));
    l.canvas.height = Math.max(1, Math.ceil(hoehe));
  }
  destroy(l: Leinwand): void {
    if (l.canvas) l.canvas.width = l.canvas.height = 0;
    l.canvas = null;
    l.context = null;
  }
}

/** SVG-Filter braucht ein DOM; ohne Filter zeichnet pdf.js die Seite trotzdem */
class OhneFilter {
  addFilter(): string {
    return 'none';
  }
  addHCMFilter(): string {
    return 'none';
  }
  addAlphaFilter(): string {
    return 'none';
  }
  addLuminosityFilter(): string {
    return 'none';
  }
  addHighlightHCMFilter(): string {
    return 'none';
  }
  destroy(): void {}
}

interface PdfSeiteBild {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: Record<string, unknown>): { promise: Promise<void> };
  cleanup(): void;
}
export interface PdfJsBild {
  getDocument(o: Record<string, unknown>): { promise: Promise<{ numPages: number; getPage(n: number): Promise<PdfSeiteBild> }>; destroy(): Promise<void> };
}

/** Rendert eine Seite (1-basiert) in der Breite `breite` Pixel; liefert PNG und die Zahl der Seiten */
export async function seiteAlsBild(pdfjs: PdfJsBild, daten: Uint8Array, seite: number, breite: number): Promise<{ png: Uint8Array; seiten: number }> {
  const aufgabe = pdfjs.getDocument({ ...PDF_OPTIONEN, data: daten, CanvasFactory: OffscreenFabrik, FilterFactory: OhneFilter, isOffscreenCanvasSupported: true });
  try {
    const doc = await aufgabe.promise;
    const n = Math.min(Math.max(1, seite), doc.numPages);
    const s = await doc.getPage(n);
    const vp1 = s.getViewport({ scale: 1 });
    const vp = s.getViewport({ scale: Math.min(4, breite / vp1.width) });
    const fabrik = new OffscreenFabrik();
    const l = fabrik.create(vp.width, vp.height);
    l.context!.fillStyle = '#ffffff';
    l.context!.fillRect(0, 0, l.canvas!.width, l.canvas!.height);
    await s.render({ canvasContext: l.context, canvas: l.canvas, viewport: vp, background: '#ffffff' }).promise;
    // Pixel selbst als PNG kodieren: WebKit liest unter file:// im Worker keine Blobs (convertToBlob scheitert mit Fehlermeldung)
    const bild = l.context!.getImageData(0, 0, l.canvas!.width, l.canvas!.height);
    const png = pngKodieren({ breite: bild.width, hoehe: bild.height, daten: new Uint8Array(bild.data.buffer) });
    s.cleanup();
    fabrik.destroy(l);
    return { png, seiten: doc.numPages };
  } finally {
    await aufgabe.destroy();
  }
}
