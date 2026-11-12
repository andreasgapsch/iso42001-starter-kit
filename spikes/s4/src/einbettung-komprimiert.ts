// Variante «komprimiert»: Worker-Code und Kataloge deflate-komprimiert (fflate) als Base64, Entpacken bei Bedarf.
import { inflateSync, strFromU8 } from 'fflate';
import type { Kataloge } from './typen.ts';
import { workerAusText } from './worker-start.ts';

function base64(text: string): Uint8Array {
  const neu = (Uint8Array as unknown as { fromBase64?: (s: string) => Uint8Array }).fromBase64;
  if (neu) return neu(text);
  const s = atob(text);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
function entpacke(id: string): string {
  const el = document.getElementById(id);
  if (!el?.textContent) throw new Error(`Datenblock ${id} fehlt`);
  return strFromU8(inflateSync(base64(el.textContent.trim())));
}
export async function ladeKataloge(): Promise<Kataloge> {
  // Variante «gemischt»: Kataloge roh als JSON-Block, sonst komprimiert.
  const roh = document.getElementById('daten-kataloge');
  if (roh?.getAttribute('type') === 'application/json' && roh.textContent) return JSON.parse(roh.textContent) as Kataloge;
  return JSON.parse(entpacke('daten-kataloge')) as Kataloge;
}
export function erzeugeWorker(): Worker {
  return workerAusText(entpacke('code-generator'));
}
