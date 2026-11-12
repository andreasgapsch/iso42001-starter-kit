// Worker-Einstieg: nimmt {art, spec} entgegen und antwortet mit den Dateibytes.
// Der Puffer wird übertragen (transferable), nicht kopiert.
import { renderDocx } from './docx.ts';
import type { DocxDokument, XlsxMappe } from './ir.ts';
import { renderXlsx } from './xlsx.ts';

export type WorkerAuftrag =
  | { id?: number; art: 'docx'; spec: DocxDokument }
  | { id?: number; art: 'xlsx'; spec: XlsxMappe };

export type WorkerAntwort =
  | { id?: number; ok: true; art: 'docx' | 'xlsx'; daten: Uint8Array }
  | { id?: number; ok: false; fehler: string };

export async function auftragAusfuehren(a: WorkerAuftrag): Promise<Uint8Array> {
  if (a.art === 'docx') return renderDocx(a.spec);
  if (a.art === 'xlsx') return renderXlsx(a.spec);
  throw new Error(`Unbekannte Art: ${String((a as { art: unknown }).art)}`);
}

interface WorkerScope {
  postMessage(nachricht: WorkerAntwort, transfer: Transferable[]): void;
  addEventListener(typ: 'message', f: (e: MessageEvent<WorkerAuftrag>) => void): void;
}

// Nur im Worker anmelden (nicht beim Import in Tests oder im Hauptthread)
const scope = globalThis as unknown as Partial<WorkerScope> & { WorkerGlobalScope?: unknown };
if (typeof scope.WorkerGlobalScope !== 'undefined' && typeof scope.addEventListener === 'function') {
  const ws = scope as WorkerScope;
  ws.addEventListener('message', (e) => {
    const a = e.data;
    auftragAusfuehren(a).then(
      (daten) => ws.postMessage({ id: a.id, ok: true, art: a.art, daten }, [daten.buffer as ArrayBuffer]),
      (err: unknown) => ws.postMessage({ id: a.id, ok: false, fehler: err instanceof Error ? err.message : String(err) }, []),
    );
  });
}
