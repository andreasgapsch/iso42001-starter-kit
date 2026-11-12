// Variante «naiv»: Kataloge als JS-Modul, Worker über Vite ?worker&inline im Hauptbundle.
import kataloge from 'virtual:kataloge';
import GeneratorWorker from './worker.ts?worker&inline';
import type { Kataloge } from './typen.ts';

export async function ladeKataloge(): Promise<Kataloge> {
  return kataloge as Kataloge;
}
export function erzeugeWorker(): Worker {
  return new GeneratorWorker();
}
