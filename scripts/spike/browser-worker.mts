// Spike S2: gebündelten Generator-Worker in echten Browsern (Chromium, Firefox, WebKit) ausführen.
// Seite über file:// mit strenger CSP (ohne 'unsafe-eval'), Worker als Blob-URL.
// Aufruf: tsx scripts/spike/browser-worker.mts <worker.js> <Ausgabeordner>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox, webkit, type BrowserType } from '@playwright/test';
import { musterDocx, musterXlsx } from '../../tests/unit/generator.muster.ts';

const [workerPfad, ausgabe] = process.argv.slice(2);
if (!workerPfad || !ausgabe) throw new Error('Aufruf: browser-worker.mts <worker.js> <Ausgabeordner>');
mkdirSync(ausgabe, { recursive: true });

const csp = "default-src 'none'; script-src 'unsafe-inline'; worker-src blob:; img-src data: blob:; connect-src 'none'";
const seite = join(ausgabe, 'seite.html');
writeFileSync(
  seite,
  `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}">` +
    `<script>window.verstoesse=[];document.addEventListener('securitypolicyviolation',e=>verstoesse.push(e.violatedDirective+' '+e.blockedURI));</script>`,
);
const code = readFileSync(workerPfad, 'utf8');
const auftraege = [
  { art: 'docx', spec: musterDocx() },
  { art: 'xlsx', spec: musterXlsx() },
];

const browser: [string, BrowserType][] = [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]];
let fehler = 0;
for (const [name, typ] of browser) {
  const b = await typ.launch();
  try {
    const p = await b.newPage();
    await p.goto(pathToFileURL(seite).href);
    const t0 = Date.now();
    const ergebnis = await p.evaluate(
      async ({ code, auftraege }) => {
        const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
        const w = new Worker(url);
        const aus: { art: string; ok: boolean; bytes?: number[]; fehler?: string; ms: number }[] = [];
        for (const a of auftraege) {
          const t = performance.now();
          const antwort = await new Promise<{ ok: boolean; daten?: Uint8Array; fehler?: string }>((res) => {
            w.onmessage = (e) => res(e.data);
            w.onerror = (e) => res({ ok: false, fehler: e.message });
            w.postMessage(a);
          });
          aus.push({
            art: a.art,
            ok: antwort.ok,
            bytes: antwort.daten ? Array.from(antwort.daten) : undefined,
            fehler: antwort.fehler,
            ms: Math.round(performance.now() - t),
          });
        }
        w.terminate();
        return { aus, verstoesse: (window as unknown as { verstoesse: string[] }).verstoesse };
      },
      { code, auftraege },
    );
    for (const r of ergebnis.aus) {
      if (!r.ok || !r.bytes) {
        fehler++;
        console.log(`${name} ${r.art}: FEHLER ${r.fehler}`);
        continue;
      }
      const datei = join(ausgabe, `${name}.${r.art}`);
      writeFileSync(datei, new Uint8Array(r.bytes));
      console.log(`${name} ${r.art}: ${r.bytes.length} Bytes in ${r.ms} ms -> ${datei}`);
    }
    console.log(`${name}: CSP-Verstösse ${ergebnis.verstoesse.length ? ergebnis.verstoesse.join(', ') : 'keine'}; gesamt ${Date.now() - t0} ms`);
    if (ergebnis.verstoesse.length) fehler++;
  } finally {
    await b.close();
  }
}
process.exitCode = fehler ? 1 : 0;
