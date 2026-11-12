// Variante «roh»: Kataloge als <script type="application/json">, Worker-Code als <script type="text/plain">.
// Beide Blöcke führt der Browser nicht aus; geparst wird erst bei Bedarf.
import type { Kataloge } from './typen.ts';
import { workerAusText } from './worker-start.ts';

function block(id: string): string {
  const el = document.getElementById(id);
  if (!el?.textContent) throw new Error(`Datenblock ${id} fehlt`);
  return el.textContent;
}
export async function ladeKataloge(): Promise<Kataloge> {
  return JSON.parse(block('daten-kataloge')) as Kataloge;
}
export function erzeugeWorker(): Worker {
  return workerAusText(block('code-generator'));
}
