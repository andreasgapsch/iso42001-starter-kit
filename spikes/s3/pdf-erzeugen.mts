// Erzeugt das 5-seitige Test-PDF und die Linkseite für Spike S3 (Ausgabe spikes/s3/dist).
// Jede Seite hat eine eigene Vollflächenfarbe, damit sich die angezeigte Seite per Bildschirmfoto erkennen lässt.
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

export const FARBEN = ['#d00000', '#00a000', '#0000d0', '#e0a000', '#a000a0'] as const;

export async function erzeugeS3(): Promise<string> {
  const dist = join(dirname(fileURLToPath(import.meta.url)), 'dist');
  await mkdir(dist, { recursive: true });
  const seiten = FARBEN.map(
    (f, i) =>
      `<section style="background:${f};height:297mm;break-after:page;display:flex;align-items:center;justify-content:center">` +
      `<h1 style="font:bold 120px sans-serif;color:#fff;margin:0">Seite ${i + 1}</h1></section>`,
  ).join('');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html><head><style>@page{size:A4;margin:0}body{margin:0}</style></head><body>${seiten}</body></html>`);
    await page.pdf({ path: join(dist, 'test.pdf'), format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
  } finally {
    await browser.close();
  }
  // Realistischer Ablageort mit Leerzeichen, Klammern und Umlaut im Pfad.
  const unter = join(dist, 'AI Act Gesetzestexte');
  await mkdir(unter, { recursive: true });
  await copyFile(join(dist, 'test.pdf'), join(unter, 'Verordnung (EU) 2024-1689 Übersicht.pdf'));
  await writeFile(
    join(dist, 'links.html'),
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Spike S3 PDF-Sprung</title></head><body>
<h1>Spike S3 PDF-Sprung</h1>
<p><a id="seite4" href="test.pdf#page=4">AI Act, Art. 26, S. 4</a></p>
<p><a id="seite4-neu" href="test.pdf#page=4" target="_blank" rel="noopener">AI Act, Art. 26, S. 4 (neues Fenster)</a></p>
<p><a id="seite4-pfad" href="AI%20Act%20Gesetzestexte/Verordnung%20(EU)%202024-1689%20%C3%9Cbersicht.pdf#page=4">Pfad mit Leerzeichen und Umlaut, S. 4</a></p>
</body></html>
`,
  );
  return dist;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(await erzeugeS3());
