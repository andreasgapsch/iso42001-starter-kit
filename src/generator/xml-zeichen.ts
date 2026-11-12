// Gültige XML-1.0-Zeichen, zentral für alles, was in DOCX, XLSX und .drawio gelangt. Steuerzeichen entstehen vor allem beim
// Kopieren aus PowerPoint oder Word (U+000B als weicher Umbruch) und machen das ganze Paket unlesbar.

const UNGUELTIG = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const UNGUELTIG_G = new RegExp(UNGUELTIG.source, 'g');

/** Text auf gültige XML-Zeichen reduzieren: U+000B und U+000C werden zum Zeilenumbruch, der Rest fällt weg. */
export function xmlBereinigen(s: string): string {
  if (!UNGUELTIG.test(s)) return s;
  return s.replace(UNGUELTIG_G, (z) => (z === '\u000B' || z === '\u000C' ? '\n' : ''));
}

/** Tief durch ein Zwischenformat (DocxDokument, XlsxMappe): Objekte bleiben gleich, wenn nichts zu tun ist. */
export function zeichenBereinigen<T>(w: T): T {
  if (typeof w === 'string') return xmlBereinigen(w) as T;
  if (w === null || typeof w !== 'object' || ArrayBuffer.isView(w) || w instanceof ArrayBuffer || w instanceof Date) return w;
  if (Array.isArray(w)) {
    let neu: unknown[] | undefined;
    for (let i = 0; i < w.length; i++) {
      const v = zeichenBereinigen(w[i] as unknown);
      if (v !== w[i]) (neu ??= [...w])[i] = v;
    }
    return (neu ?? w) as T;
  }
  let neu: Record<string, unknown> | undefined;
  for (const k of Object.keys(w)) {
    const alt = (w as Record<string, unknown>)[k];
    const v = zeichenBereinigen(alt);
    if (v !== alt) (neu ??= { ...(w as Record<string, unknown>) })[k] = v;
  }
  return (neu ?? w) as T;
}
