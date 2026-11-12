// Ziel «Norm-PDF»: Text mit pdf.js lesen (Legacy-Build in Node, wie im PDF-Worker) und zerlegen
import { ladeKataloge } from '../../../src/kataloge/laden-node.ts';
import { erwartet27001, erwartet42001 } from '../../../src/normtexte/erwartet.ts';
import { zerlege } from '../../../src/normtexte/parser.ts';
import { seitenAusPdf } from '../../../src/normtexte/pdf-text.ts';
import { pruefeNormpaket } from '../../../src/app/normtexte/zustand.ts';
import { alsPdf, synthetischeNorm } from '../../fixtures/normpdf.ts';
import { mutiereBytes, mutiereText } from '../mutation.ts';
import { OrakelFehler, type Fall, type Urteil, type Ziel } from '../typen.ts';
import type { Zufall } from '../zufall.ts';
import { ablehnung } from './hilfen.ts';

let kern: { erwartet: ReturnType<typeof erwartung>; basen: Uint8Array[] } | null = null;

function erwartung() {
  const k = ladeKataloge();
  return { '42001': erwartet42001(k), '27001': erwartet27001(k) };
}

function grundlagen() {
  if (!kern) {
    const erwartet = erwartung();
    kern = {
      erwartet,
      basen: [
        alsPdf(synthetischeNorm(erwartet['42001'], { norm: '42001', sprache: 'de', national: 'SN EN' })),
        alsPdf(synthetischeNorm(erwartet['27001'], { norm: '27001', sprache: 'en', amd: true })),
      ],
    };
  }
  return kern;
}

const lat1 = (b: Uint8Array): string => Buffer.from(b).toString('latin1');
const vonLat1 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, 'latin1'));

function erzeuge(z: Zufall, nummer: number): Fall {
  const { basen } = grundlagen();
  const basis = z.wahl(basen);
  const art = nummer % 10 === 0 ? 0 : z.ganz(100);
  if (art < 6) return { name: 'gueltig', endung: 'pdf', daten: basis };
  if (art < 40) return { name: 'bytes-mutation', endung: 'pdf', daten: mutiereBytes(z, basis) };
  if (art < 65) return { name: 'inhalt-mutation', endung: 'pdf', daten: vonLat1(mutiereText(z, lat1(basis))) };
  if (art < 72) return { name: 'abgeschnitten', endung: 'pdf', daten: basis.slice(0, z.ganz(basis.length)) };
  if (art < 78) {
    // Seitenbaum mit Verweis auf sich selbst, riesige Seitenzahl
    const t = lat1(basis);
    const m = z.ganz(3);
    const s = m === 0 ? t.replace(/\/Kids \[/, '/Kids [2 0 R ') : m === 1 ? t.replace(/\/Count \d+/, `/Count ${z.wahl([0, -1, 99999999, 2 ** 31])}`) : t.replace(/\/MediaBox \[[^\]]*\]/g, `/MediaBox [0 0 ${z.wahl([0, -5, 1e9, 1e-9])} ${z.wahl([0, 1e9])}]`);
    return { name: 'seitenbaum', endung: 'pdf', daten: vonLat1(s) };
  }
  if (art < 82) return { name: 'verschluesselt', endung: 'pdf', daten: vonLat1(lat1(basis).replace(/trailer\n<< /, 'trailer\n<< /Encrypt << /Filter /Standard /V 1 /R 2 /O (aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa) /U (bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb) /P -4 >> ')) };
  return { name: 'aufbau', endung: 'pdf', daten: z.wahl([new Uint8Array(0), vonLat1('%PDF-1.4\n'), vonLat1('%PDF-1.4\n%%EOF'), vonLat1('kein pdf'), z.bytes(z.zwischen(1, 5000)), vonLat1('%PDF-' + 'x'.repeat(5000))]) };
}

async function urteile(f: Fall): Promise<Urteil> {
  const { erwartet } = grundlagen();
  let seiten;
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    // Kopie: pdf.js übernimmt den Puffer
    seiten = await seitenAusPdf(pdfjs as never, (f.daten as Uint8Array).slice());
  } catch (e) {
    return ablehnung(e, 'pdf.js');
  }
  let r;
  try {
    r = zerlege(seiten, erwartet);
  } catch (e) {
    throw new OrakelFehler(`zerlege wirft (${e instanceof Error ? `${e.name}: ${e.message}` : String(e)})`.slice(0, 300));
  }
  if (!r.norm) return { urteil: 'abgelehnt', meldung: 'Norm nicht erkannt' };
  // Wieder lesbar: Das Ergebnis muss als Normpaket gespeichert und geprüft werden können
  const paket = { format: 'aims-normpaket', version: 1, teile: [{ norm: r.norm, sprache: r.sprache, bezeichnung: r.bezeichnung, ausgabe: r.ausgabe, quelle: 'x.pdf', importiert: '2026-10-22T10:00:00Z', eintraege: r.eintraege }], lizenz: { dokumente: false, lizenzgeber: '', lizenznummer: '' } };
  let p;
  try {
    p = pruefeNormpaket(JSON.parse(JSON.stringify(paket)));
  } catch (e) {
    throw new OrakelFehler(`Ergebnis des Imports ist kein gültiges Normpaket (${e instanceof Error ? e.message : String(e)})`);
  }
  if (p.teile.length !== 1) throw new OrakelFehler('Norm-PDF: Teil geht bei der Prüfung verloren');
  return { urteil: 'angenommen' };
}

export const normPdf: Ziel = { art: 'norm-pdf', erzeuge, urteile };
