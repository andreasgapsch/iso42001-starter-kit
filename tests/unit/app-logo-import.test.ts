// AF-048: Logo-Import im Browser (src/app/logik/logo.ts) mit Ersatzumgebung für Canvas, Bild und createImageBitmap.
// Der Worker läuft als echte Funktion (worker/logo.ts: logoAufgabe), nur die Übergabe an den Worker ist ersetzt.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pngKodieren } from '../../src/generator/png.ts';

const umleitung: { f: ((a: unknown) => unknown) | null } = { f: null };
vi.mock('../../src/app/worker/client.ts', async () => {
  const { logoAufgabe } = await import('../../src/app/worker/logo.ts');
  return { logoImWorker: async (a: never) => (umleitung.f ? umleitung.f(a) : logoAufgabe(a)) };
});
const L = await import('../../src/app/logik/logo.ts');

/** Bild mit rotem Rechteck in der Mitte auf transparentem Grund */
function pixelDaten(w: number, h: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = Math.floor(h / 4); y < Math.floor((3 * h) / 4); y++) {
    for (let x = Math.floor(w / 4); x < Math.floor((3 * w) / 4); x++) d.set([200, 20, 20, 255], (y * w + x) * 4);
  }
  return d;
}

const eigenschaften = { kein2d: false, zeichnet: 0 };
function umgebungAufbauen(): void {
  eigenschaften.kein2d = false;
  eigenschaften.zeichnet = 0;
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0, height: 0,
      getContext(this: { width: number; height: number }) {
        if (eigenschaften.kein2d) return null;
        return {
          imageSmoothingEnabled: false, imageSmoothingQuality: '',
          drawImage: () => eigenschaften.zeichnet++,
          getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: pixelDaten(w, h) }),
        };
      },
    }),
  });
  class Bild {
    naturalWidth = 400;
    naturalHeight = 200;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decoding = '';
    set src(url: string) {
      queueMicrotask(() => (url.includes('KAPUTT') ? this.onerror?.() : this.onload?.()));
    }
  }
  vi.stubGlobal('Image', Bild);
  vi.stubGlobal('createImageBitmap', async () => ({ width: 400, height: 200, close: () => undefined }));
}

const bytes = (...b: number[]) => new Uint8Array(b);
const mit = (kopf: string, n = 64) => {
  const b = new Uint8Array(n);
  b.set(new TextEncoder().encode(kopf));
  return b;
};
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500" viewBox="0 0 1000 500"><rect x="250" y="125" width="500" height="250" fill="#c81414"/></svg>';
const art = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as InstanceType<typeof L.LogoImportFehlerMeldung>).art ?? `anderer Fehler: ${String(e)}`;
  }
  return 'kein Fehler';
};

beforeEach(() => {
  umleitung.f = null;
  umgebungAufbauen();
});
afterEach(() => vi.unstubAllGlobals());

describe('logo.ts: Format und Grenzen', () => {
  it('formatErkennen liest die ersten Bytes, nicht die Endung', () => {
    expect(L.formatErkennen(bytes(0x89, 0x50, 0x4e, 0x47))).toBe('png');
    expect(L.formatErkennen(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
    expect(L.formatErkennen(mit('GIF89a'))).toBe('gif');
    expect(L.formatErkennen(mit('RIFF\0\0\0\0WEBP'))).toBe('webp');
    expect(L.formatErkennen(mit('BM'))).toBe('bmp');
    expect(L.formatErkennen(mit('PK\u0003\u0004'))).toBe('docx');
    expect(L.formatErkennen(mit('%PDF-1.7'))).toBe('pdf');
    expect(L.formatErkennen(mit('%!PS-Adobe'))).toBe('eps');
    expect(L.formatErkennen(bytes(0xc5, 0xd0, 0xd3, 0xc6))).toBe('eps');
    expect(L.formatErkennen(new TextEncoder().encode(`\uFEFF  ${SVG}`))).toBe('svg');
    expect(L.formatErkennen(mit('<html><body>'))).toBeUndefined();
    expect(L.formatErkennen(mit('irgendwas'))).toBeUndefined();
  });
  it('rasterStufeErlaubt: die nächste Stufe darf höchstens die Grenze brauchen', () => {
    expect(L.rasterStufeErlaubt(100)).toBe(true);
    expect(L.rasterStufeErlaubt(L.RASTER_GRENZE_MS / 6)).toBe(true);
    expect(L.rasterStufeErlaubt(L.RASTER_GRENZE_MS / 6 + 1)).toBe(false);
  });
  it('Fehlerklasse trägt Art und Detail', () => {
    const e = new L.LogoImportFehlerMeldung('svg-ungueltig', 'Detail');
    expect([e.art, e.detail, e.message]).toEqual(['svg-ungueltig', 'Detail', 'svg-ungueltig']);
  });
  it('logoAusBytes lehnt zu gross, leer, PDF, EPS und Unbekanntes mit eigener Art ab', async () => {
    expect(await art(L.logoAusBytes(new Uint8Array(L.MAX_EINGABE + 1), 'x.png'))).toBe('zu-gross');
    expect(await art(L.logoAusBytes(new Uint8Array(0), 'x.png'))).toBe('leer');
    expect(await art(L.logoAusBytes(mit('%PDF-1.4'), 'x.pdf'))).toBe('format-pdf');
    expect(await art(L.logoAusBytes(mit('%!PS'), 'x.eps'))).toBe('format-eps');
    expect(await art(L.logoAusBytes(mit('Text'), 'x.txt'))).toBe('format-unbekannt');
    expect(await art(L.logoAusBytes(mit('PK\u0003\u0004'), 'x.docx'))).toBe('format-unbekannt');
  });
});

describe('logo.ts: Rastern', () => {
  const png = bytes(0x89, 0x50, 0x4e, 0x47, 1, 2, 3);
  it('PNG: normalisiertes Logo mit Quelle, Hash, Farbvorschlägen und Form', async () => {
    const r = await L.logoAusBytes(png, 'C:\\Ordner\\firma.png');
    expect(r.logo.png.startsWith('data:image/png;base64,')).toBe(true);
    expect(r.logo.quelle).toMatchObject({ dateiname: 'firma.png', format: 'png' });
    expect(r.logo.quelle!.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(r.vorschlaege.length).toBeGreaterThan(0);
    expect(r.bytes).toBeGreaterThan(0);
    expect(r.logo.svg).toBeUndefined();
  });
  it('GIF meldet «erstes Bild», BMP wird als PNG geführt, ohne Hash entfällt die Quelle', async () => {
    expect((await L.logoAusBytes(mit('GIF89a'), 'a.gif')).hinweise).toContain('erstes-bild');
    expect((await L.logoAusBytes(mit('BM'), 'a.bmp')).logo.quelle!.format).toBe('png');
    vi.stubGlobal('crypto', { subtle: { digest: async () => { throw new Error('nicht verfügbar'); } } });
    expect((await L.logoAusBytes(png, 'a.png')).logo.quelle).toBeUndefined();
  });
  it('ohne createImageBitmap oder bei dessen Fehler: Rückfall auf das Bildelement', async () => {
    vi.stubGlobal('createImageBitmap', async () => { throw new Error('nicht lesbar'); });
    expect((await L.logoAusBytes(png, 'a.png')).logo.png).toBeTruthy();
    vi.stubGlobal('createImageBitmap', undefined);
    expect((await L.logoAusBytes(png, 'a.png')).logo.png).toBeTruthy();
  });
  it('zu viele Pixel, Nullgrösse, fehlender Zeichenkontext und nicht ladbares Bild', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 9000, height: 9000, close: () => undefined }));
    expect(await art(L.logoAusBytes(png, 'a.png'))).toBe('zu-viele-pixel');
    // Nullgrösse beim Bitmap: Rückfall auf das Bildelement; hat auch dieses keine Grösse, ist das Bild nicht lesbar
    vi.stubGlobal('createImageBitmap', async () => ({ width: 0, height: 0, close: () => undefined }));
    expect((await L.logoAusBytes(png, 'a.png')).logo.png).toBeTruthy();
    vi.stubGlobal('Image', class { naturalWidth = 0; naturalHeight = 0; onload: (() => void) | null = null; set src(_u: string) { queueMicrotask(() => this.onload?.()); } });
    expect(await art(L.logoAusBytes(png, 'a.png'))).toBe('nicht-lesbar');
    vi.stubGlobal('createImageBitmap', undefined);
    vi.stubGlobal('Image', class { onerror: (() => void) | null = null; set src(_u: string) { queueMicrotask(() => this.onerror?.()); } });
    expect(await art(L.logoAusBytes(png, 'a.png'))).toBe('nicht-lesbar');
    umgebungAufbauen();
    eigenschaften.kein2d = true;
    expect(await art(L.logoAusBytes(png, 'a.png'))).toBe('nicht-lesbar');
  });
  it('leeres Bild und zu grosses Ergebnis kommen als Meldung des Workers zurück', async () => {
    umleitung.f = () => ({ aufgabe: 'normalisieren', ok: false, fehler: 'leer' });
    expect(await art(L.logoAusBytes(png, 'a.png'))).toBe('leer');
  });
  it('getImageData verweigert (verseuchtes Canvas): nicht lesbar', async () => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ drawImage: () => undefined, getImageData: () => { throw new Error('SecurityError'); } }) }) });
    expect(await art(L.logoAusBytes(png, 'a.png'))).toBe('nicht-lesbar');
  });
});

describe('logo.ts: SVG', () => {
  const svg = new TextEncoder().encode(SVG);
  it('SVG wird bereinigt, in Stufen gerastert und zugeschnitten mitgespeichert', async () => {
    const r = await L.logoAusBytes(svg, 'logo.svg');
    expect(r.logo.svg).toContain('<svg');
    expect(r.logo.svg).toContain('viewBox');
    expect(r.logo.quelle!.format).toBe('svg');
    expect(eigenschaften.zeichnet).toBeGreaterThanOrEqual(L.RASTER_STUFEN.length);
  });
  it('SVG mit nicht erlaubten Teilen: Hinweis «bereinigt»', async () => {
    const mitSkript = new TextEncoder().encode(SVG.replace('</svg>', '<script>alert(1)</script></svg>'));
    expect((await L.logoAusBytes(mitSkript, 'l.svg')).hinweise).toContain('svg-bereinigt');
  });
  it('ungültiges SVG meldet svg-ungueltig mit Detail', async () => {
    const kaputt = new TextEncoder().encode('<svg><!-- offen</svg>');
    try {
      await L.logoAusBytes(kaputt, 'k.svg');
      expect.unreachable();
    } catch (e) {
      expect((e as InstanceType<typeof L.LogoImportFehlerMeldung>).art).toBe('svg-ungueltig');
    }
  });
  it('teure Stufe: Import endet mit svg-aufwand, bevor die nächste Stufe beginnt', async () => {
    let t = 0;
    vi.stubGlobal('performance', { now: () => (t += 5000) });
    expect(await art(L.logoAusBytes(svg, 'logo.svg'))).toBe('svg-aufwand');
  });
  it('SVG über 100 KB nach dem Zuschnitt: Hinweis «svg-zu-gross», nur das PNG bleibt', async () => {
    const gross = new TextEncoder().encode(SVG.replace('</svg>', `<desc>${'x'.repeat(110_000)}</desc></svg>`));
    const r = await L.logoAusBytes(gross, 'gross.svg');
    expect(r.hinweise).toContain('svg-zu-gross');
    expect(r.logo.svg).toBeUndefined();
  });
  it('Bild des SVG nicht ladbar: nicht lesbar', async () => {
    vi.stubGlobal('Image', class { onerror: (() => void) | null = null; set src(_u: string) { queueMicrotask(() => this.onerror?.()); } });
    expect(await art(L.logoAusBytes(svg, 'logo.svg'))).toBe('nicht-lesbar');
  });
});

describe('logo.ts: Word-Vorlage, Datei, Analyse', () => {
  const vorschlagOhneLogo = { ok: true, wert: { farben: [], schriften: [] } };
  it('ausVorlage: Vorschlag ohne Logo; Fehler des Workers wird zu «format-unbekannt»; zu gross', async () => {
    umleitung.f = () => vorschlagOhneLogo;
    expect(await L.ausVorlage(mit('PK\u0003\u0004'), 'v.dotx')).toEqual({ vorschlag: vorschlagOhneLogo.wert });
    umleitung.f = () => ({ aufgabe: 'vorlage', ok: false, fehler: 'format-unbekannt' });
    expect(await art(L.ausVorlage(mit('PK\u0003\u0004'), 'v.dotx'))).toBe('format-unbekannt');
    expect(await art(L.ausVorlage(new Uint8Array(L.MAX_EINGABE + 1), 'v.dotx'))).toBe('zu-gross');
  });
  it('ausVorlage mit Kopfzeilenlogo: Logo mit Quelle «docx»; unlesbares Logo fällt weg', async () => {
    umleitung.f = (a) => ((a as { aufgabe: string }).aufgabe === 'vorlage' ? { ok: true, wert: { logo: { daten: bytes(0x89, 0x50, 0x4e, 0x47), name: 'kopf.png', format: 'png' } } } : undefined);
    umleitung.f = (a) => {
      const x = a as { aufgabe: string };
      if (x.aufgabe === 'vorlage') return { ok: true, wert: { logo: { daten: bytes(0x89, 0x50, 0x4e, 0x47), name: 'kopf.png', format: 'png' } } };
      return undefined;
    };
    // normalisieren läuft über den echten Worker: Umleitung nur für «vorlage»
    const echt = (await import('../../src/app/worker/logo.ts')).logoAufgabe;
    umleitung.f = (a) => {
      const x = a as { aufgabe: string };
      return x.aufgabe === 'vorlage' ? { ok: true, wert: { logo: { daten: bytes(0x89, 0x50, 0x4e, 0x47), name: 'kopf.png', format: 'png' } } } : echt(a as never);
    };
    const r = await L.ausVorlage(mit('PK\u0003\u0004'), 'C:\\x\\firma.dotx');
    expect(r.logo!.logo.quelle).toMatchObject({ dateiname: 'firma.dotx', format: 'docx' });
    umleitung.f = (a) => ((a as { aufgabe: string }).aufgabe === 'vorlage' ? { ok: true, wert: { logo: { daten: mit('%PDF-1.4'), name: 'k.pdf', format: 'pdf' } } } : echt(a as never));
    expect((await L.ausVorlage(mit('PK\u0003\u0004'), 'v.dotx')).logo).toBeUndefined();
  });
  it('dateiLesen unterscheidet Bild und Vorlage; zu grosse Datei wird abgelehnt', async () => {
    const bild = await L.dateiLesen(new File([bytes(0x89, 0x50, 0x4e, 0x47, 1)], 'a.png'));
    expect(bild.art).toBe('bild');
    umleitung.f = () => vorschlagOhneLogo;
    const vorlage = await L.dateiLesen(new File([mit('PK\u0003\u0004')], 'v.dotx'));
    expect(vorlage.art).toBe('vorlage');
    const gross = { size: L.MAX_EINGABE + 1 } as File;
    expect(await art(L.dateiLesen(gross))).toBe('zu-gross');
  });
  it('logoAnalyse liefert Farben, Eignung für dunklen Grund und Höhe; bei Fehler undefined', async () => {
    const w = 8, h = 8;
    const png = pngKodieren({ breite: w, hoehe: h, daten: pixelDaten(w, h) as never });
    const r = await L.logoAnalyse(png);
    expect(r).toMatchObject({ hoehe: 8 });
    expect(Array.isArray(r!.vorschlaege)).toBe(true);
    umleitung.f = () => ({ ok: false, fehler: 'leer' });
    expect(await L.logoAnalyse(png)).toBeUndefined();
  });
});
