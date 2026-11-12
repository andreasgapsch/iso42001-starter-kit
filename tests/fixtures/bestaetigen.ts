// Rückfragen ohne Oberfläche beantworten (V-11): ersetzt in Unit-Tests das frühere vi.stubGlobal('confirm', …). Die Funktion
// erhält wie confirm() den Text der Frage und liefert die Antwort; sie gilt bis zum nächsten Aufruf.
import { offeneFrage } from '../../src/app/zustand/bestaetigen.ts';

let antwort: ((text: string) => boolean) | null = null;
offeneFrage.subscribe((f) => {
  const a = antwort;
  if (f && a) queueMicrotask(() => f.antwort(a(f.text)));
});

export function beantworte(fn: ((text: string) => boolean) | null): void {
  antwort = fn;
}
