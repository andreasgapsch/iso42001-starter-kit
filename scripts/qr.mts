// Erzeugt den QR-Code für die Abschlussfolie (Kurzlink kmu-cio.ch/42001) als SVG und PNG.
import QRCode from 'qrcode';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const KURZLINK = 'https://kmu-cio.ch/42001';

export async function erzeugeQr(zielordner: string): Promise<string[]> {
  mkdirSync(zielordner, { recursive: true });
  const optionen = { errorCorrectionLevel: 'H' as const, margin: 4, color: { dark: '#000000', light: '#ffffff' } };
  const svg = join(zielordner, 'QR_kmu-cio-ch-42001.svg');
  const png = join(zielordner, 'QR_kmu-cio-ch-42001.png');
  await QRCode.toFile(svg, KURZLINK, { ...optionen, type: 'svg' });
  await QRCode.toFile(png, KURZLINK, { ...optionen, type: 'png', width: 1200 });
  return [svg, png];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ziel = process.argv[2] ?? 'dist/qr';
  for (const datei of await erzeugeQr(ziel)) console.log(datei);
}
