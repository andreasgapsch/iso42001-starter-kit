// pdf.js liefert für den Worker-Teil keine Typen; der PDF-Worker braucht nur den Modul-Namensraum.
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  export const WorkerMessageHandler: unknown;
}
