// Musterlogo der Beispielfirma Muster Maschinenbau AG: rastert src/beispiele/bau/musterlogo.svg in Chromium (Canvas, wie
// der Logo-Import im Werkzeug), normalisiert mit generator/bild.ts und schreibt src/beispiele/bau/musterlogo.json
// (PNG als Data-URL, Masse, bereinigtes und zugeschnittenes SVG). Einmalig; das JSON liegt im Repo, damit die
// Beispielprojekte nicht vom Rastern abhängen. Aufruf: npx tsx scripts/werkzeug/musterlogo.mts
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { farbenReduzieren, inhaltRahmen, LOGO_GRENZEN, logoNormalisieren } from '../../src/generator/bild.ts';
import { pngDataUrl, pngKodieren } from '../../src/generator/png.ts';
import { svgMitGroesse, svgVorbereiten, svgZuschneiden } from '../../src/generator/svg.ts';

const KANTE = 2400;
const s = svgVorbereiten(readFileSync('src/beispiele/bau/musterlogo.svg', 'utf8'));
const k = KANTE / Math.max(s.breite, s.hoehe);
const breite = Math.round(s.breite * k);
const hoehe = Math.round(s.hoehe * k);
const text = svgMitGroesse(s.svg, breite, hoehe, s.viewBox.join(' '));
const browser = await chromium.launch();
const page = await browser.newPage();
const pixel = await page.evaluate(async ({ text, breite, hoehe }) => {
  const img = new Image();
  img.src = `data:image/svg+xml;base64,${btoa(text)}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = breite;
  c.height = hoehe;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, breite, hoehe);
  return Array.from(ctx.getImageData(0, 0, breite, hoehe).data);
}, { text, breite, hoehe });
await browser.close();
const rgba = { breite, hoehe, daten: new Uint8Array(pixel) };
// Beispiel klein halten (steckt in DE und EN und damit zweimal im Werkzeug): 240 px Höhe reichen für 25 mm bei 240 dpi,
// 256 Farben sehen bei einem flächigen Logo gleich aus
const n = logoNormalisieren(rgba, { ...LOGO_GRENZEN, maxHoehe: 240 });
n.png = pngKodieren(farbenReduzieren(n.bild));
const svg = svgZuschneiden(s, inhaltRahmen(rgba)!, rgba);
writeFileSync('src/beispiele/bau/musterlogo.json', `${JSON.stringify({ png: pngDataUrl(n.png), breite: n.breite, hoehe: n.hoehe, svg }, null, 2)}\n`);
console.log(`Musterlogo: ${n.breite} x ${n.hoehe} px, ${n.png.length} Bytes, SVG ${svg.length} Zeichen, Hinweise: ${n.hinweise.join(', ') || 'keine'}`);
