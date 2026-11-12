// S5b: Vite + vite-plugin-singlefile, Worker über ?worker&inline (Blob-URL).
import './stil.css';
import RechnerWorker from './rechner.worker.ts?worker&inline';

const s5 = { verletzungen: [] as string[], worker: null as unknown, fehler: null as string | null };
Object.assign(window, { s5 });
document.addEventListener('securitypolicyviolation', (e) => s5.verletzungen.push(`${e.violatedDirective} ${e.blockedURI}`));
const w = new RechnerWorker();
w.onmessage = (e: MessageEvent<{ summe: number }>) => {
  s5.worker = e.data;
  document.getElementById('ergebnis')!.textContent = `Summe ${e.data.summe}`;
};
w.onerror = (e) => {
  s5.fehler = e.message || 'Worker-Fehler';
};
w.postMessage({ n: 1000 });
