// Dokumentgestaltung (Custom Branding): Farbrechnung und Kontrast, Bildformate und Normalisierung, SVG-Bereinigung,
// Word-Vorlage als Vorschlag, DOCX und XLSX mit Logo, Titelseite und Wasserzeichen, Reproduzierbarkeit, Datenmodell,
// Teilimport, Gestaltungspaket, Tor G8 und Grösse.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { farbenReduzieren, farbvorschlaege, fuerDunklenGrund, inhaltRahmen, LogoFehler, logoForm, logoNormalisieren, verkleinern } from '../../src/generator/bild.ts';
import { abstand, fuerText, hexNormal, hexZuRgb, kontrast, linearZuHex, MACHADO, simuliere } from '../../src/generator/farbe.ts';
import { druckGestaltung, logoMasse, schriften } from '../../src/generator/gestaltung.ts';
import { renderDocx, renderXlsx } from '../../src/generator/index.ts';
import type { DocxDokument } from '../../src/generator/ir.ts';
import { palette, ROLLE } from '../../src/generator/palette.ts';
import { ausBase64, pngBereinigen, pngDataUrl, pngDekodieren, pngInfo, pngKodieren, pngTeile, type Rgba } from '../../src/generator/png.ts';
import { SvgFehler, svgBereinigen, svgMitGroesse } from '../../src/generator/svg.ts';
import { ausWordVorlage } from '../../src/generator/vorlage-import.ts';
import { holePfad, ersetze } from '../../src/i18n/texte.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { ladeProjektDaten, pruefeProjektDaten } from '../../src/app/import/laden.ts';
import { ladeKiErgebnis } from '../../src/app/import/ki-ergebnis.ts';
import { teilimportAnwenden, vergleiche } from '../../src/app/import/teilimport.ts';
import { musterDocx as gestaltungsMuster, musterXlsx as gestaltungsMusterXlsx, type MusterTexte } from '../../src/app/logik/gestaltung-muster.ts';
import { svgVorbereiten, svgZuschneiden } from '../../src/generator/svg.ts';
import { logoDataUrlUebernehmen, paketDateiname, paketErstellen, paketLesen } from '../../src/model/gestaltung.ts';
import type { Gestaltung, Projekt } from '../../src/model/typen.ts';
import { gestaltungEinsetzen, istEntwurf } from '../../src/vorlagen/gestaltung.ts';
import { pruefeAbwesend } from '../../scripts/pruefen/namensnennung.mts';
import { musterDocx } from './generator.muster.ts';

const ZEIT = new Date('2026-10-20T08:00:00Z');
const teile = (b: Uint8Array) => Object.fromEntries(Object.entries(unzipSync(b)).filter(([p]) => /\.(xml|rels|vml)$/.test(p)).map(([p, x]) => [p, strFromU8(x)]));
const beispiel = (datei: string) => JSON.parse(readFileSync(`src/beispiele/${datei}.aims.json`, 'utf8')) as Projekt;

/** Synthetisches RGBA-Bild aus einer Funktion je Pixel */
function bild(breite: number, hoehe: number, f: (x: number, y: number) => [number, number, number, number]): Rgba {
  const daten = new Uint8Array(breite * hoehe * 4);
  for (let y = 0; y < hoehe; y++) for (let x = 0; x < breite; x++) daten.set(f(x, y), (y * breite + x) * 4);
  return { breite, hoehe, daten };
}

/** Quer-Logo: blaue Fläche und roter Balken auf transparentem Grund mit Rand */
const logoBild = () => bild(300, 100, (x, y) => (x < 20 || x >= 280 || y < 10 || y >= 90 ? [0, 0, 0, 0] : y > 60 ? [200, 30, 40, 255] : [28, 93, 148, 255]));
const logoPng = () => logoNormalisieren(logoBild()).png;

function gestaltungMitLogo(extra: Partial<Gestaltung> = {}): Gestaltung {
  const png = logoPng();
  const { breite, hoehe } = pngInfo(png);
  return { logo: { png: pngDataUrl(png), breite, hoehe }, farben: { primaer: '1D3557', sekundaer: '457B9D', akzent: 'E9A23B' }, ...extra };
}

/** Zufallsgenerator mit festem Startwert (reproduzierbare Eigenschaftstests) */
function zufall(start: number): () => number {
  let s = start >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('Farbrechnung', () => {
  it('liest Hex in allen üblichen Schreibweisen', () => {
    expect(hexNormal('#1c5d94')).toBe('1C5D94');
    expect(hexNormal('1C5D94')).toBe('1C5D94');
    expect(hexNormal('#16a')).toBe('1166AA');
    expect(hexNormal('#12345')).toBeUndefined();
    expect(hexNormal('rot')).toBeUndefined();
  });

  it('fuerText erreicht den Mindestkontrast und meldet die Korrektur', () => {
    const k = fuerText('FFB000');
    expect(k.korrigiert).toBe(true);
    expect(kontrast(k.hex, 'FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(k.deltaE).toBeGreaterThan(0);
    expect(fuerText('1C5D94')).toMatchObject({ hex: '1C5D94', korrigiert: false });
    expect(kontrast(fuerText('FFFF00', 'FFFFFF', 3).hex, 'FFFFFF')).toBeGreaterThanOrEqual(3);
  });

  it('Simulation der Fehlsichtigkeit nach Machado et al. (2009): Referenzwerte für Rot und Blau', () => {
    // Reines Rot und Blau ergeben je die erste bzw. dritte Spalte der Matrix (lineares RGB, Werte unter 0 abgeschnitten)
    const spalte = (art: keyof typeof MACHADO, i: number) => linearZuHex([0, 1, 2].map((z) => MACHADO[art][z * 3 + i]!));
    expect(simuliere('FF0000', 'protanopie')).toBe(spalte('protanopie', 0));
    expect(simuliere('0000FF', 'tritanopie')).toBe(spalte('tritanopie', 2));
    // Protanopie: Rot erscheint dunkel olivbraun (kein Rotanteil mehr dominant)
    const [r, g, b] = hexZuRgb(simuliere('FF0000', 'protanopie'));
    expect(Math.abs(r - g)).toBeLessThan(20);
    expect(b).toBe(0);
    // Rot und Grün sind bei Deuteranopie nahe, bei Normalsicht weit
    expect(abstand(simuliere('D62728', 'deuteranopie'), simuliere('2CA02C', 'deuteranopie'))).toBeLessThan(abstand('D62728', '2CA02C') / 2);
  });
});

describe('Palette als Funktion der CI-Farben (Eigenschaftstests)', () => {
  const pruefe = (p: ReturnType<typeof palette>, ort: string) => {
    const d = p.dok;
    expect(kontrast(d.titel, 'FFFFFF'), `${ort} titel`).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(d.kopfText ?? d.text, d.kopf), `${ort} kopf`).toBeGreaterThanOrEqual(4.5);
    expect(kontrast('121821', d.label), `${ort} label`).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(d.aufBand, d.band), `${ort} band`).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(d.trennlinie, 'FFFFFF'), `${ort} trennlinie`).toBeGreaterThanOrEqual(1.3);
    expect(kontrast(d.akzent, 'FFFFFF'), `${ort} akzent`).toBeGreaterThanOrEqual(3);
    for (const [rolle, f] of Object.entries(p.rolle)) {
      expect(kontrast(f.fill, f.schrift), `${ort} ${rolle}`).toBeGreaterThanOrEqual(4.5);
      if (rolle.startsWith('kat-')) expect(kontrast(f.linie, 'FFFFFF'), `${ort} ${rolle} linie`).toBeGreaterThanOrEqual(3);
      // Semantische Rollen bleiben bytegleich zum Standard
      if (rolle.startsWith('risiko-') || rolle.startsWith('status-')) expect(f, `${ort} ${rolle}`).toEqual(ROLLE[rolle as keyof typeof ROLLE]);
    }
    // Benachbarte Diagrammreihen bleiben unterscheidbar, wenn eine davon aus der CI stammt
    const kat = ['kat-1', 'kat-2', 'kat-3', 'kat-4', 'kat-5', 'kat-6'] as const;
    for (let i = 1; i < kat.length; i++) {
      const a = p.rolle[kat[i - 1]!].linie;
      const b = p.rolle[kat[i]!].linie;
      if (a !== ROLLE[kat[i - 1]!].linie || b !== ROLLE[kat[i]!].linie) {
        for (const art of ['protanopie', 'deuteranopie', 'tritanopie'] as const) expect(abstand(simuliere(a, art), simuliere(b, art)), `${ort} ${kat[i]} ${art}`).toBeGreaterThanOrEqual(0.06 - 1e-9);
      }
    }
  };

  it('Raster von 4096 Primärfarben (16 Stufen je Kanal), Hauch und kräftig', () => {
    const stufen = Array.from({ length: 16 }, (_, i) => i * 17);
    for (const r of stufen) for (const g of stufen) for (const b of stufen) {
      const hex = [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase();
      pruefe(palette({ primaer: hex }), hex);
      if ((r + g + b) % 51 === 0) pruefe(palette({ primaer: hex, tabellenkopfKraeftig: true }), `${hex} kräftig`);
    }
  });

  it('Grenzfälle und zufällige Dreiergruppen (Primär, Sekundär, Akzent)', () => {
    for (const hex of ['FFFF00', '00FF00', 'FFFFFF', '000000', 'FFD1DC', 'B0E0E6', 'FDFD96', '39FF14', 'FF073A', '0FF0FC']) pruefe(palette({ primaer: hex, sekundaer: 'FFFF00', akzent: '00FF00' }), hex);
    const z = zufall(42);
    const h = () => Math.floor(z() * 0xffffff).toString(16).padStart(6, '0').toUpperCase();
    for (let i = 0; i < 400; i++) pruefe(palette({ primaer: h(), sekundaer: h(), akzent: h() }), `zufall ${i}`);
  });

  it('ohne Primärfarbe gilt die Standardpalette; Schalter wirken', () => {
    expect(palette().ci).toBe(false);
    expect(palette({ sekundaer: 'FF0000' }).ci).toBe(false);
    const aus = palette({ primaer: '1D3557', ueberschriften: false, tabellenkopf: false, diagramme: false });
    expect(aus.dok.titel).toBe('121821');
    expect(aus.dok.kopf).toBe('E9E6DF');
    expect(aus.rolle['kat-1']).toEqual(ROLLE['kat-1']);
    const an = palette({ primaer: '1D3557' });
    expect(an.dok.titel).toBe('1D3557');
    expect(an.rolle['kat-1'].linie).toBe('1D3557');
  });

  it('Konfliktprüfung: Rot und Blaugrün nahe an Statusfarben, Blau nicht', () => {
    const rot = palette({ primaer: '9C3510' });
    expect(rot.hinweise).toContainEqual(expect.objectContaining({ art: 'nahe-status', status: 'status-kritisch' }));
    expect(rot.rolle['kat-1']).toEqual(ROLLE['kat-1']);
    // Überschriften nehmen die Farbe trotzdem
    expect(rot.dok.titel).toBe('9C3510');
    expect(palette({ primaer: '2E95A5' }).hinweise).toContainEqual(expect.objectContaining({ art: 'nahe-status', status: 'status-gut' }));
    expect(palette({ primaer: '1D3557' }).hinweise.filter((h) => h.art === 'nahe-status')).toEqual([]);
  });

  it('meldet korrigierte Farben (zu hell für Text bzw. Grafik)', () => {
    const p = palette({ primaer: 'FFB000', akzent: '7FD4FF' });
    expect(p.hinweise).toContainEqual(expect.objectContaining({ art: 'korrigiert', quelle: 'primaer', wofuer: 'text', original: 'FFB000' }));
    expect(p.hinweise).toContainEqual(expect.objectContaining({ art: 'korrigiert', quelle: 'akzent', wofuer: 'grafik' }));
  });
});

describe('PNG und Bildformate (synthetische Bilder)', () => {
  it('Kodierer: Palette, RGB und RGBA im Rundlauf', () => {
    const wenige = bild(40, 20, (x) => (x < 20 ? [255, 0, 0, 255] : [0, 0, 255, 128]));
    const pngP = pngKodieren(wenige);
    expect(pngInfo(pngP).farbtyp).toBe(3);
    expect(pngDekodieren(pngP).daten).toEqual(wenige.daten);
    const verlauf = bild(64, 64, (x, y) => [x * 4, y * 4, (x * y) & 255, 255]);
    expect(pngInfo(pngKodieren(verlauf)).farbtyp).toBe(2);
    expect(pngDekodieren(pngKodieren(verlauf)).daten).toEqual(verlauf.daten);
    const alpha = bild(64, 64, (x, y) => [x * 4, y * 4, 9, (x * 3) & 255 || 1]);
    expect(pngInfo(pngKodieren(alpha)).farbtyp).toBe(6);
    expect(pngDekodieren(pngKodieren(alpha)).daten).toEqual(alpha.daten);
  });

  it('Bereinigung entfernt Text-, EXIF- und Zeitblöcke (PNG mit tEXt «kmu-cio»)', () => {
    const png = pngKodieren(bild(20, 20, () => [10, 20, 30, 255]));
    const tEXt = (typ: string, text: string) => {
      const d = strToU8(text);
      const aus = new Uint8Array(12 + d.length);
      new DataView(aus.buffer).setUint32(0, d.length);
      aus.set(strToU8(typ), 4);
      aus.set(d, 8);
      return aus;
    };
    const belastet = new Uint8Array([...png.subarray(0, 33), ...tEXt('tEXt', 'Software\u0000kmu-cio.ch'), ...tEXt('eXIf', 'GPS'), ...png.subarray(33)]);
    expect(pngTeile(belastet).map((t) => t.typ)).toContain('tEXt');
    const sauber = pngBereinigen(belastet);
    expect(pngTeile(sauber).map((t) => t.typ)).toEqual(['IHDR', 'PLTE', 'IDAT', 'IEND']);
    expect(Buffer.from(sauber).toString('latin1')).not.toMatch(/kmu-cio/i);
  });

  it('schneidet transparente und weisse Ränder ab und erkennt die Form', () => {
    expect(inhaltRahmen(logoBild())).toEqual({ x: 20, y: 10, breite: 260, hoehe: 80 });
    const weiss = bild(100, 100, (x, y) => (x > 30 && x < 70 && y > 40 && y < 60 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    expect(inhaltRahmen(weiss)).toEqual({ x: 31, y: 41, breite: 39, hoehe: 19 });
    expect(inhaltRahmen(bild(10, 10, () => [0, 0, 0, 0]))).toBeUndefined();
    expect([logoForm(300, 100), logoForm(200, 100), logoForm(100, 100), logoForm(50, 100)]).toEqual(['quer', 'breit', 'quadratisch', 'hoch']);
    const n = logoNormalisieren(logoBild());
    expect(n.hinweise).toContain('raender');
    expect([n.breite, n.hoehe, n.form]).toEqual([260, 80, 'quer']);
  });

  it('verkleinert grosse Bilder auf 1600 px Kante und 400 px Höhe, kleine Logos werden gemeldet', () => {
    const gross = logoNormalisieren(bild(8000, 2000, (x, y) => [(x >> 4) & 255, (y >> 3) & 255, 120, 255]));
    expect(gross.hinweise).toContain('verkleinert');
    expect(Math.max(gross.breite, gross.hoehe)).toBeLessThanOrEqual(1600);
    expect(gross.hoehe).toBeLessThanOrEqual(400);
    const klein = logoNormalisieren(bild(20, 20, () => [200, 0, 0, 255]));
    expect(klein.hinweise).toContain('klein');
    expect(klein.breite).toBeGreaterThanOrEqual(16);
    const winzig = logoNormalisieren(bild(40, 4, () => [0, 0, 200, 255]));
    expect(winzig.hoehe).toBe(16);
  });

  it('Grössengrenze 200 KB: Rauschen wird verkleinert und auf 256 Farben reduziert', () => {
    const z = zufall(7);
    const rauschen = bild(1600, 400, () => [z() * 256, z() * 256, z() * 256, 255].map(Math.floor) as [number, number, number, number]);
    const n = logoNormalisieren(rauschen);
    expect(n.png.length).toBeLessThanOrEqual(200 * 1024);
    expect(n.hinweise).toContain('verkleinert');
    expect(() => logoNormalisieren(rauschen, { maxKante: 1600, maxHoehe: 400, maxBytes: 100, minKante: 16 })).toThrow(LogoFehler);
  });

  it('warnt bei Logo für dunklen Grund (weiss auf transparent)', () => {
    const weissAufTransparent = bild(200, 60, (x, y) => (x > 20 && x < 180 && y > 15 && y < 45 && (x + y) % 3 ? [255, 255, 255, 255] : [0, 0, 0, 0]));
    expect(fuerDunklenGrund(weissAufTransparent)).toBe(true);
    expect(logoNormalisieren(weissAufTransparent).hinweise).toContain('dunkler-grund');
    expect(fuerDunklenGrund(logoBild())).toBe(false);
  });

  it('Farbvorschläge aus dem Logo (k-Means in OKLab): Blau vor Rot, Grau und Transparenz ignoriert', () => {
    const v = farbvorschlaege(bild(120, 40, (x, y) => (y < 4 ? [128, 128, 128, 255] : x < 80 ? [28, 93, 148, 255] : x < 110 ? [200, 30, 40, 255] : [0, 0, 0, 0])));
    expect(v).toHaveLength(2);
    expect(abstand(v[0]!, '1C5D94')).toBeLessThan(0.02);
    expect(abstand(v[1]!, 'C81E28')).toBeLessThan(0.02);
    expect(farbvorschlaege(bild(10, 10, () => [120, 120, 120, 255]))).toEqual([]);
  });

  it('Reduktion auf 256 Farben behält seltene, deutlich andere Farben (Akzent neben dominanter Farbe mit Kantenpixeln)', () => {
    const b = bild(400, 100, (x, y) => (x < 10 ? [233, 162, 59, 255] : x < 20 ? [69, 123, 157, 255] : y === 0 ? [29, 53, 87, (x * 7) % 256] : x % 7 === 0 ? [29 + (x % 30), 53, 87, 255] : [29, 53, 87, 255]));
    const r = farbenReduzieren(b);
    const farben = new Set<string>();
    for (let i = 0; i < r.daten.length; i += 4) farben.add([...r.daten.subarray(i, i + 4)].join(','));
    expect(farben.size).toBeLessThanOrEqual(256);
    expect(farben).toContain('233,162,59,255');
    expect(farben).toContain('69,123,157,255');
  });

  it('verkleinern mit Alpha ohne dunkle Säume', () => {
    const halb = verkleinern(bild(4, 1, (x) => (x < 2 ? [255, 0, 0, 255] : [0, 0, 0, 0])), 2, 1);
    expect([...halb.daten]).toEqual([255, 0, 0, 255, 0, 0, 0, 0]);
    const misch = verkleinern(bild(2, 1, (x) => (x < 1 ? [255, 0, 0, 255] : [0, 0, 0, 0])), 1, 1);
    expect([...misch.daten]).toEqual([255, 0, 0, 128]);
  });
});

describe('SVG-Bereinigung', () => {
  const boese = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 200 50" onload="alert(1)">
    <script>alert(2)</script><foreignObject><div>x</div></foreignObject>
    <image href="https://example.org/a.png" width="10" height="10"/>
    <use xlink:href="https://example.org/s.svg#a"/><use href="#form"/>
    <rect id="form" width="100" height="50" fill="url(https://example.org/f)" style="fill:#1c5d94;background:url(http://x/y)" onclick="x()"/>
    <a href="javascript:alert(3)"><circle r="5"/></a>
    <linearGradient id="v"><stop offset="0" stop-color="#fff"/></linearGradient><path d="M0 0L10 10" fill="url(#v)"/></svg>`;

  it('entfernt Skripte, Ereignisse, foreignObject, externe Verweise und Bilder', () => {
    const r = svgBereinigen(boese);
    for (const verboten of ['script', 'alert', 'foreignObject', 'onload', 'onclick', 'example.org', 'javascript', '<image', '<a ', 'http://x']) expect(r.svg).not.toContain(verboten);
    expect(r.svg).toContain('<use href="#form"/>');
    expect(r.svg).toContain('fill="url(#v)"');
    expect(r.svg).toContain('style="fill:#1c5d94"');
    expect(r.entfernt).toEqual(expect.arrayContaining(['script', 'foreignObject', 'image', 'a', '@onload', '@onclick']));
    expect([r.breite, r.hoehe]).toEqual([200, 50]);
  });

  it('lehnt Entitäten (DOCTYPE mit interner Teilmenge) und Nicht-SVG ab', () => {
    expect(() => svgBereinigen('<!DOCTYPE svg [<!ENTITY a "aaaa">]><svg>&a;</svg>')).toThrow(SvgFehler);
    expect(() => svgBereinigen('<html><body/></html>')).toThrow(SvgFehler);
    expect(() => svgBereinigen('<svg><g></svg>')).toThrow(SvgFehler);
  });

  it('Grösse nur aus viewBox, aus Einheiten, und feste Grösse zum Rastern', () => {
    expect(svgBereinigen('<svg viewBox="0 0 300 100"/>')).toMatchObject({ breite: 300, hoehe: 100 });
    expect(svgBereinigen('<svg width="50mm" viewBox="0 0 100 25"/>').hoehe).toBeCloseTo((50 * 96) / 25.4 / 4, 3);
    expect(svgMitGroesse('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="2"><g/></svg>', 400, 100, '0 0 4 1')).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 1" width="400" height="100"><g/></svg>');
  });

  it('viewBox wird auf den Inhalt der Rasterung zugeschnitten', () => {
    const s = svgVorbereiten('<svg viewBox="0 0 200 100"><rect x="50" y="25" width="100" height="50"/></svg>');
    const zu = svgZuschneiden(s, { x: 100, y: 50, breite: 200, hoehe: 100 }, { breite: 400, hoehe: 200 });
    expect(zu).toContain('viewBox="50 25 100 50"');
    expect(zu).not.toMatch(/^<svg[^>]*width=/);
  });

  it('das Musterlogo der Beispiele ist bereinigt und zugeschnitten', () => {
    const logo = JSON.parse(readFileSync('src/beispiele/bau/musterlogo.json', 'utf8')) as { png: string; svg: string; breite: number; hoehe: number };
    expect(svgBereinigen(logo.svg).entfernt).toEqual([]);
    expect(pngInfo(ausBase64(logo.png.split(',')[1]!))).toMatchObject({ breite: logo.breite, hoehe: logo.hoehe });
  });
});

describe('Word-Vorlage (.dotx) als Vorschlag', () => {
  const thema = `<a:theme xmlns:a="x"><a:themeElements><a:clrScheme name="Firma"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:dk2><a:srgbClr val="44546A"/></a:dk2>
    <a:accent1><a:srgbClr val="0B5394"/></a:accent1><a:accent2><a:srgbClr val="808080"/></a:accent2><a:accent3><a:srgbClr val="E69138"/></a:accent3><a:accent4><a:srgbClr val="6AA84F"/></a:accent4></a:clrScheme>
    <a:fontScheme name="F"><a:majorFont><a:latin typeface="Calibri Light"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`;
  const png = pngKodieren(bild(30, 10, () => [11, 83, 148, 255]));
  const vorlage = (mitBild: boolean, endung = 'png') =>
    zipSync({
      'word/document.xml': strToU8('<w:document/>'),
      'word/theme/theme1.xml': strToU8(thema),
      'word/header1.xml': strToU8(mitBild ? '<w:hdr><a:blip r:embed="rId9"/></w:hdr>' : '<w:hdr/>'),
      'word/_rels/header1.xml.rels': strToU8(`<Relationships><Relationship Id="rId9" Type="image" Target="media/image1.${endung}"/></Relationships>`),
      [`word/media/image1.${endung}`]: png,
    });

  it('liest Designfarben (ohne Grau), Schriften und das Kopfzeilenlogo', () => {
    const v = ausWordVorlage(vorlage(true));
    expect(v.farben.map((f) => f.name)).toEqual(['accent1', 'accent2', 'accent3', 'accent4', 'dk2']);
    expect([v.primaer, v.sekundaer, v.akzent]).toEqual(['0B5394', 'E69138', '6AA84F']);
    expect(v.schrift).toEqual({ titel: 'Calibri Light', text: 'Calibri' });
    expect(v.logo).toMatchObject({ format: 'png', name: 'image1.png' });
    expect(v.logo!.daten).toEqual(png);
  });

  it('meldet nicht lesbare Kopfzeilenbilder (EMF) und lehnt Nicht-Word-Dateien ab', () => {
    expect(ausWordVorlage(vorlage(true, 'emf'))).toMatchObject({ logoNichtLesbar: 'EMF' });
    expect(ausWordVorlage(vorlage(false)).logo).toBeUndefined();
    expect(() => ausWordVorlage(strToU8('kein zip'))).toThrow();
    expect(() => ausWordVorlage(zipSync({ 'a.txt': strToU8('x') }))).toThrow();
  });
});

function docxMit(g: DruckGestaltungArg): DocxDokument {
  const d = musterDocx();
  return { ...d, kopf: { ...d.kopf, logoPng: undefined }, lenkung: { ...d.lenkung, dokumentId: g.id ?? 'D-03' }, gestaltung: druckGestaltung(g.g, { sprache: 'de', firmenname: 'Müller Präzisionsteile AG', dokumentId: g.id ?? 'D-03', entwurf: g.entwurf ?? false }) };
}
interface DruckGestaltungArg {
  g: Gestaltung;
  id?: string;
  entwurf?: boolean;
}

describe('DOCX mit Gestaltung', () => {
  it('Logo rechts (Standard) oder links, SVG mit PNG-Ersatz, Masse je Form, Farben und Schrift in den Stilen', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 10"><rect width="30" height="10" fill="#1D3557"/></svg>';
    const g = gestaltungMitLogo({ schrift: { paar: 'calibri' } });
    g.logo!.svg = svg;
    const t = teile(await renderDocx(docxMit({ g }), { zeitpunkt: ZEIT }));
    const kopf = t['word/header1.xml']!;
    expect(kopf.indexOf('Müller')).toBeLessThan(kopf.indexOf('<w:drawing>'));
    expect(kopf).toContain('asvg:svgBlip');
    expect(Object.keys(unzipSync(await renderDocx(docxMit({ g }), { zeitpunkt: ZEIT }))).filter((p) => p.startsWith('word/media/') && !p.endsWith('/')).map((p) => p.split('.').pop()).sort()).toEqual(['png', 'svg']);
    // Quer-Logo 260 x 80 px: Höhe 9 mm = 34 px, Breite 111 px (EMU 9525 je px)
    expect(logoMasse(260, 80, 9, 200)).toEqual({ breite: 111, hoehe: 34 });
    expect(kopf).toContain(`cx="${111 * 9525}" cy="${34 * 9525}"`);
    expect(t['word/styles.xml']).toContain('w:ascii="Calibri"');
    expect(t['word/styles.xml']).toContain('w:color w:val="1D3557"');
    const links = teile(await renderDocx(docxMit({ g: { ...g, kopfzeile: { logoPosition: 'links', firmennameZeigen: false } } }), { zeitpunkt: ZEIT }))['word/header1.xml']!;
    expect(links).not.toMatch(/<w:t[^>]*>[^<]*Müller/);
    expect(links).toContain('<w:drawing>');
  });

  it('Wasserzeichen nur bei Entwurf, Titelseite nach Auswahl, Kurzname, Fusszeilenzusatz und Präfix', async () => {
    const g = gestaltungMitLogo({ titelseite: 'grundlagen', kurzname: 'MPT', fusszeileZusatz: 'Industriestrasse 1, 8000 Zürich', kennungPraefix: 'AIMS-' });
    const entwurf = teile(await renderDocx(docxMit({ g, entwurf: true }), { zeitpunkt: ZEIT }));
    const koepfe = Object.entries(entwurf).filter(([p]) => /^word\/header\d+\.xml$/.test(p)).map(([, x]) => x).join('');
    expect(koepfe).toMatch(/PowerPlusWaterMarkObject1/);
    expect(koepfe).toContain('string="ENTWURF"');
    expect(entwurf['word/document.xml']).toContain('<w:titlePg/>');
    expect(entwurf['word/document.xml']).toContain('AIMS-D-03');
    expect(koepfe).toContain('MPT');
    expect(Object.values(entwurf).join('')).toContain('Industriestrasse 1, 8000 Zürich');
    const frei = teile(await renderDocx(docxMit({ g, entwurf: false, id: 'D-12' }), { zeitpunkt: ZEIT }));
    expect(Object.values(frei).join('')).not.toContain('PowerPlusWaterMark');
    expect(frei['word/document.xml']).not.toContain('<w:titlePg/>');
    const ohne = teile(await renderDocx(docxMit({ g: { ...g, wasserzeichenEntwurf: false }, entwurf: true }), { zeitpunkt: ZEIT }));
    expect(Object.values(ohne).join('')).not.toContain('PowerPlusWaterMark');
    expect(druckGestaltung(g, { sprache: 'en', firmenname: 'X', dokumentId: 'D-11', entwurf: true })).toMatchObject({ wasserzeichen: 'DRAFT', titelseite: true });
  });

  it('eigene Schrift nur mit Bestätigung', () => {
    expect(schriften({ paar: 'eigen', titel: 'Frutiger', text: 'Minion' })).toEqual({ titel: 'Arial', text: 'Cambria', tabelle: 'Arial' });
    expect(schriften({ paar: 'eigen', titel: 'Frutiger', text: 'Minion', installiertBestaetigt: true })).toEqual({ titel: 'Frutiger', text: 'Minion', tabelle: 'Frutiger' });
    expect(schriften({ paar: 'eigen', titel: 'A;B"<x>', installiertBestaetigt: true }).titel).toBe('ABx');
  });
});

describe('Reproduzierbarkeit mit Logo, Titelseite und Wasserzeichen', () => {
  it('zwei Dokumente bytegleich, auch nach anderen Dokumenten und zu anderer Uhrzeit (DOCX und XLSX)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-21T09:00:00Z'));
      const g = gestaltungMitLogo({ titelseite: 'alle', fusszeileZusatz: 'Zusatz' });
      const dok = () => docxMit({ g, entwurf: true });
      const a = await renderDocx(dok(), { zeitpunkt: ZEIT });
      await renderDocx(musterDocx(), { zeitpunkt: ZEIT });
      await renderDocx(dok(), { zeitpunkt: ZEIT });
      vi.setSystemTime(new Date('2026-10-22T17:33:21Z'));
      expect(await renderDocx(dok(), { zeitpunkt: ZEIT })).toEqual(a);
      const p = beispiel('muster-maschinenbau.de');
      const x1 = await renderXlsx(gestaltungsMusterXlsx(p, 'de', musterTexte('de')), { zeitpunkt: ZEIT });
      await renderXlsx(gestaltungsMusterXlsx(beispiel('praezisionsteile.de'), 'de', musterTexte('de')), { zeitpunkt: ZEIT });
      vi.setSystemTime(new Date('2027-01-01T00:00:00Z'));
      expect(await renderXlsx(gestaltungsMusterXlsx(p, 'de', musterTexte('de')), { zeitpunkt: ZEIT })).toEqual(x1);
    } finally {
      vi.useRealTimers();
    }
  });
});

/** Texte des Musterdokuments wie in der App (Gestaltung.tsx, musterTexte) */
function musterTexte(s: 'de' | 'en'): MusterTexte {
  const tx = ladeTexte(s);
  const roh = holePfad(tx, 'app.gestaltung.muster') as Omit<MusterTexte, 'fusszeile' | 'status'>;
  const text = (k: string, w?: Record<string, string>) => ersetze(holePfad(tx, k) as string, w);
  return { ...roh, fusszeile: text('allgemein.fusszeile', { klassifikation: roh.klassifikation }), status: text('allgemein.lenkung.nicht_freigegeben', { status: text('gefuehrt.optionen.dokumentStatus.entwurf') }) };
}

describe('Musterdokument der Vorschau', () => {
  it('Texte DE und EN: jede Tabellenzeile so lang wie der Kopf, gleiche Anzahl Zeilen', () => {
    for (const s of ['de', 'en'] as const) {
      const t = musterTexte(s);
      for (const z of t.zeilen) expect(z, s).toHaveLength(t.tabelle_kopf.length);
      expect(t.zeilen).toHaveLength(3);
      expect(t.diagramm_kat).toHaveLength(4);
    }
  });
});

describe('XLSX mit Gestaltung', () => {
  it('Logo im Blatt «Dokument», Logo in der Druckkopfzeile (VML), Vermerk «Entwurf», Farben des Tabellenkopfs', async () => {
    const p = beispiel('muster-maschinenbau.de');
    const mappe = gestaltungsMusterXlsx(p, 'de', musterTexte('de'));
    expect(istEntwurf(mappe)).toBe(true);
    const b = await renderXlsx(mappe, { zeitpunkt: ZEIT });
    const t = teile(b);
    const roh = unzipSync(b);
    expect(Object.keys(roh).filter((x) => x.startsWith('xl/media/') && !x.endsWith('/')).sort()).toEqual(['xl/media/image1.png', 'xl/media/kopflogo.png'].sort());
    expect(t['xl/drawings/drawing1.xml']).toContain('xdr:pic');
    const blaetter = Object.keys(t).filter((x) => /^xl\/worksheets\/sheet\d+\.xml$/.test(x));
    for (const s of blaetter) {
      expect(t[s], s).toContain('<legacyDrawingHF r:id="rIdKopflogo"/>');
      expect(t[s], s).toMatch(/<oddHeader>[^<]*&amp;G/);
      expect(t[s], s).toContain('ENTWURF');
      // legacyDrawingHF vor tableParts und extLst (Reihenfolge in CT_Worksheet)
      const i = t[s]!.indexOf('<legacyDrawingHF');
      for (const danach of ['<tableParts', '<extLst']) if (t[s]!.includes(danach)) expect(i).toBeLessThan(t[s]!.indexOf(danach));
    }
    expect(t['xl/drawings/vmlDrawingHF1.vml']).toContain('v:shape id="RH"');
    expect(t['xl/drawings/_rels/vmlDrawingHF1.vml.rels']).toContain('../media/kopflogo.png');
    expect(t['[Content_Types].xml']).toMatch(/Extension="vml"/);
    expect(t['xl/styles.xml']).toContain(palette(p.organisation.gestaltung!.farben).dok.kopf);
    expect(Buffer.from(b).toString('latin1')).not.toMatch(/kmu-cio/i);
  });
});

describe('Gestaltung an einer Stelle: Vorlagen unverändert, leere Vorlagen im Kit-Design', () => {
  const p = beispiel('muster-maschinenbau.de');
  it('Modus «leer» und Projekte ohne Gestaltung bleiben ohne Gestaltung', () => {
    const ir = gestaltungsMuster(p, 'de', musterTexte('de'));
    expect(ir.gestaltung).toBeDefined();
    expect(gestaltungEinsetzen({ ...ir, gestaltung: undefined }, p, 'leer').gestaltung).toBeUndefined();
    const ohne = beispiel('praezisionsteile.de');
    expect(ohne.organisation.gestaltung).toBeUndefined();
    expect(gestaltungEinsetzen({ ...ir, gestaltung: undefined }, ohne, 'firma').gestaltung).toBeUndefined();
  });

  it('Tor G8: Firmendokumente mit Logo, Wasserzeichen und Paket frei von Kit-Angaben', async () => {
    const ordner = mkdtempSync(join(tmpdir(), 'gestaltung-g8-'));
    const ir = gestaltungsMuster(p, 'de', musterTexte('de'));
    const docx = join(ordner, 'Muster.docx');
    writeFileSync(docx, await renderDocx(ir, { zeitpunkt: ZEIT }));
    expect(pruefeAbwesend(docx)).toEqual([]);
    expect(JSON.stringify(paketErstellen(p.organisation.gestaltung!))).not.toMatch(/kmu-cio/i);
    expect(paketDateiname(p.organisation.gestaltung!, p.organisation.name)).toBe('MMB-gestaltung.json');
    expect(paketDateiname({}, 'Müller & Söhne AG')).toBe('Muller-Sohne-AG-gestaltung.json');
  });
});

describe('Datenmodell, Schema, Import', () => {
  const p = beispiel('muster-maschinenbau.de');
  const mit = (g: unknown) => ({ ...p, organisation: { ...p.organisation, gestaltung: g } });

  it('Beispiel Muster Maschinenbau mit Logo und CI-Farben ist gültig, Präzisionsteile ohne Gestaltung', () => {
    expect(pruefeProjektDaten(p).ok).toBe(true);
    expect(p.organisation.gestaltung?.farben?.primaer).toBe('1D3557');
    expect(beispiel('praezisionsteile.en').organisation.gestaltung).toBeUndefined();
  });

  it('Schemagrenzen: zu langes PNG, falsches Hex, unbekanntes Feld, Präfix, Zeilenumbruch', () => {
    const g = p.organisation.gestaltung!;
    expect(pruefeProjektDaten(mit({ ...g, logo: { ...g.logo, png: `data:image/png;base64,${'A'.repeat(280001)}` } })).ok).toBe(false);
    expect(pruefeProjektDaten(mit({ ...g, farben: { primaer: '#1D3557' } })).ok).toBe(false);
    expect(pruefeProjektDaten(mit({ ...g, farben: { primaer: '1d3557' } })).ok).toBe(false);
    expect(pruefeProjektDaten(mit({ ...g, unbekannt: 1 })).ok).toBe(false);
    expect(pruefeProjektDaten(mit({ ...g, kennungPraefix: 'viel-zu-lang-123' })).ok).toBe(false);
    expect(pruefeProjektDaten(mit({ ...g, fusszeileZusatz: 'a\nb' })).ok).toBe(false);
    expect(pruefeProjektDaten(mit({ ...g, kopfzeile: { logoHoeheMm: 20 } })).ok).toBe(false);
    expect(pruefeProjektDaten(mit({ ...g, logo: { ...g.logo, png: 'data:image/jpeg;base64,AAAA' } })).ok).toBe(false);
  });

  it('Projekt mit dem grössten zulässigen Logo bleibt unter 1 MB', () => {
    const g = p.organisation.gestaltung!;
    const gross = mit({ ...g, logo: { ...g.logo, png: `data:image/png;base64,${'A'.repeat(279976)}`, svg: 'x'.repeat(102400) } });
    expect(pruefeProjektDaten(gross).ok).toBe(true);
    expect(JSON.stringify(gross, null, 2).length).toBeLessThan(1024 * 1024);
  });

  it('logoDataUrl wird beim Laden nach gestaltung.logo übernommen (Metadaten weg), anderes verworfen', () => {
    const png = pngKodieren(bild(300, 100, (x, y) => (x < 10 ? [0, 0, 0, 0] : [28, 93, 148, y > 50 ? 255 : 200])));
    const roh = JSON.parse(JSON.stringify(beispiel('praezisionsteile.de'))) as Record<string, any>;
    roh['organisation'].logoDataUrl = pngDataUrl(png);
    const r = ladeProjektDaten(roh);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.projekt.organisation.logoDataUrl).toBeUndefined();
    expect(r.projekt.organisation.gestaltung?.logo).toMatchObject({ breite: 300, hoehe: 100 });
    expect(r.migrationen.join()).toContain('gestaltung.logo');
    const jpeg = { organisation: { logoDataUrl: 'data:image/jpeg;base64,/9j/AAAA' } };
    expect(logoDataUrlUebernehmen(jpeg)).toContain('verworfen');
    expect(jpeg.organisation).toEqual({});
  });

  it('Teilimport und KI-Ergebnis übernehmen nie eine Gestaltung; Paket im Rundlauf', () => {
    const aktuell = beispiel('praezisionsteile.de');
    const ki = { ...aktuell, organisation: { ...aktuell.organisation, gestaltung: p.organisation.gestaltung, logoDataUrl: 'data:image/png;base64,AAAA', standorte: 'Neu' } };
    const v = vergleiche(aktuell, ki as unknown as Record<string, unknown>);
    expect(v.bereiche.map((b) => b.pfad)).toEqual(['organisation.standorte']);
    const zusammen = teilimportAnwenden(aktuell, ki as unknown as Record<string, unknown>, { eintraege: {}, bereiche: ['organisation.gestaltung', 'organisation.standorte'] });
    expect(zusammen.organisation.gestaltung).toBeUndefined();
    const geladen = ladeKiErgebnis(JSON.stringify(ki));
    expect(geladen.ok && geladen.projekt.organisation.gestaltung).toBe(undefined);
    const paket = paketLesen(JSON.stringify(paketErstellen(p.organisation.gestaltung!)));
    expect(paket).toEqual({ ok: true, gestaltung: p.organisation.gestaltung });
    expect(paketLesen('{"art":"x"}')).toEqual({ ok: false, grund: 'kein-paket' });
    expect(paketLesen('{"art":"aims-gestaltung","version":2,"gestaltung":{}}')).toEqual({ ok: false, grund: 'version' });
    expect(paketLesen('kein json')).toEqual({ ok: false, grund: 'kein-json' });
  });
});
