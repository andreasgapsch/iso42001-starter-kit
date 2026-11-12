// AF-018 bis AF-020 (QK-09): Eingangsmodul mit Grössen-, Eintrags- und Zeitgrenzen aus einer Konfiguration; Meldungen und Hilfe
// lesen die Grenzen aus derselben Konfiguration. Dazu das Tor G41 (scripts/pruefen/lesestellen.mts) mit Gegenprobe.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { pruefe as pruefeLesestellen, pruefeQuellen, pruefeTexte } from '../../scripts/pruefen/lesestellen.mts';
import { EINGANGSARTEN, GRENZEN, LOGO_GRENZEN, grenzPlatzhalter, groesseText, type EingangsArt, type Grenze } from '../../src/eingang/grenzen.ts';
import { EingangsFehler, jsonAusVertrauen, jsonLesen, liesBegrenzt, liesJsonBegrenzt, liesStueckweise, liesTextBegrenzt, zipEintraegeVorab, type DateiQuelle } from '../../src/eingang/lesen.ts';
import { wacheStarten, type Uhr } from '../../src/eingang/zeit.ts';
import { ersetze } from '../../src/i18n/texte.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';

const REPO = join(import.meta.dirname, '..', '..');
const json = (rel: string) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
const { setzeAppDaten } = await import('../../src/app/daten.ts');
setzeAppDaten({
  texte: { de: ladeTexte('de'), en: ladeTexte('en') }, kataloge: ladeKataloge(), gefuehrt: json('src/generiert/gefuehrt.json'),
  regeln: { regeln: parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')).regeln }, version: '1.0.0', gebaut: '', beispiele: [],
});
const { uiSprache, t } = await import('../../src/app/i18n.ts');
const { fehlerVerstaendlich } = await import('../../src/app/worker/fehlertext.ts');
const { liesNormPdf, setzePdfUmgebung } = await import('../../src/app/normtexte/pdf.ts');

/** Datei, die nie gelesen werden darf: Jeder Zugriff auf den Inhalt wirft */
function unlesbar(size: number): DateiQuelle & { gelesen: number } {
  const d = {
    size,
    gelesen: 0,
    arrayBuffer: () => {
      d.gelesen++;
      throw new Error('Inhalt gelesen');
    },
    text: () => {
      d.gelesen++;
      throw new Error('Inhalt gelesen');
    },
    slice: () => {
      d.gelesen++;
      throw new Error('Inhalt gelesen');
    },
  };
  return d;
}

const blob = (b: Uint8Array | string): DateiQuelle => new Blob([b as BlobPart]) as unknown as DateiQuelle;

describe('AF-018 Eingangsmodul: Grösse vor dem Lesen, Eintragslimit, eine Kopie', () => {
  for (const art of EINGANGSARTEN) {
    it(`${art}: Datei über der Grenze wird mit Meldung abgelehnt, bevor der Inhalt gelesen wird`, async () => {
      const g = GRENZEN[art].maxBytes;
      for (const lesen of [liesBegrenzt, liesTextBegrenzt, liesJsonBegrenzt]) {
        const d = unlesbar(g + 1);
        const e = await lesen(d, art).catch((x: unknown) => x);
        expect(e).toBeInstanceOf(EingangsFehler);
        expect((e as EingangsFehler).grund).toBe('zu-gross');
        expect((e as EingangsFehler).art).toBe(art);
        expect((e as EingangsFehler).message).toContain(groesseText(g));
        expect(d.gelesen, `${art}: Inhalt angefasst`).toBe(0);
      }
      // Gegenprobe: genau an der Grenze wird gelesen
      const d = unlesbar(g);
      await expect(liesBegrenzt(d, art)).rejects.toThrow('Inhalt gelesen');
    });
  }

  it('liest ohne weitere Kopie: die Bytes teilen den Puffer des gelesenen ArrayBuffer', async () => {
    const puffer = new ArrayBuffer(16);
    const d: DateiQuelle = { size: 16, arrayBuffer: () => Promise.resolve(puffer), text: () => Promise.resolve(''), slice: () => d };
    const b = await liesBegrenzt(d, 'drawio');
    expect(b.buffer).toBe(puffer);
  });

  it('Eintragslimit im ZIP vor dem Entpacken (Verzeichnisende), Gegenprobe unter der Grenze', () => {
    const viele: Record<string, Uint8Array> = {};
    for (let i = 0; i <= GRENZEN.sicherung.maxEintraege; i++) viele[`d${i}`] = new Uint8Array(0);
    const e = (() => {
      try {
        zipEintraegeVorab(zipSync(viele), 'sicherung');
      } catch (x) {
        return x;
      }
    })();
    expect(e).toBeInstanceOf(EingangsFehler);
    expect((e as EingangsFehler).grund).toBe('zu-viele');
    expect(() => zipEintraegeVorab(zipSync({ a: new Uint8Array(1) }), 'sicherung')).not.toThrow();
  });

  it('JSON: BOM, Tiefe und Zahl der Werte ohne Rekursion, SyntaxError bleibt SyntaxError', () => {
    expect(jsonLesen('﻿{"a":1}', 'projektdatei')).toEqual({ a: 1 });
    expect(() => jsonLesen('{"a":', 'projektdatei')).toThrow(SyntaxError);
    const tief = `${'['.repeat(100_000)}${']'.repeat(100_000)}`;
    expect(() => jsonLesen(tief, 'projektdatei')).toThrow(EingangsFehler);
    expect(() => jsonLesen(`${'['.repeat(200)}${']'.repeat(200)}`, 'projektdatei')).not.toThrow();
    const g = GRENZEN.gestaltungspaket.maxWerte;
    expect(() => jsonLesen(JSON.stringify(Array.from({ length: g }, () => 0)), 'gestaltungspaket')).toThrow(/zu viele/);
    expect(() => jsonLesen(JSON.stringify(Array.from({ length: g - 1 }, () => 0)), 'gestaltungspaket')).not.toThrow();
  });

  it('Stückweise lesen: jedes Stück begrenzt, Summe gleich', async () => {
    const b = new Uint8Array(10_000).map((_, i) => i % 251);
    const stuecke: Uint8Array[] = [];
    for await (const s of liesStueckweise(blob(b), 4096)) stuecke.push(s);
    expect(stuecke.map((s) => s.length)).toEqual([4096, 4096, 1808]);
    expect(Buffer.concat(stuecke).equals(Buffer.from(b))).toBe(true);
  });

  it('Text und JSON aus echten Blobs unter der Grenze', async () => {
    expect(await liesTextBegrenzt(blob('äö'), 'ki-ergebnis')).toBe('äö');
    expect(await liesJsonBegrenzt(blob('{"format":"x"}'), 'normpaket')).toEqual({ format: 'x' });
  });
});

describe('AF-018 Tor G41: Lesestellen und Grenzwerte in Texten', () => {
  it('im Repository: Lesestellen ausserhalb src/eingang 0, JSON.parse auf dem Leseweg 0, von Hand geschriebene Grenzwerte 0', async () => {
    const r = await pruefeLesestellen();
    expect(r.map((b) => `${b.datei}: ${b.meldung}`)).toEqual([]);
  });

  it('Gegenprobe: eine eingeschleuste Lesestelle, ein JSON.parse auf dem Leseweg und ein Grenzwert im Text schlagen an', () => {
    const quellen = pruefeQuellen([
      { pfad: 'src/app/x.tsx', text: "const b = new Uint8Array(await datei.arrayBuffer());" },
      { pfad: 'src/app/y.ts', text: "const s = await f.text();" },
      { pfad: 'src/app/z.ts', text: "import { liesTextBegrenzt } from '../eingang/lesen.ts';\nconst d = JSON.parse(await liesTextBegrenzt(f, 'normpaket'));" },
      { pfad: 'src/eingang/lesen.ts', text: 'JSON.parse(text); await datei.arrayBuffer();' },
    ]);
    expect(quellen.map((f) => f.datei.split(':')[0])).toEqual(['src/app/x.tsx', 'src/app/y.ts', 'src/app/z.ts']);
    expect(pruefeTexte([{ pfad: 'src/i18n/de/app.yaml', text: 'zu_gross: höchstens 10 MB\nok: höchstens {grenze_bild}\n' }])).toHaveLength(1);
  });

  it('Gegenprobe Nacharbeit N1, N2: bytes(), new Response(), text () mit Leerraum und JSON.parse in einem beliebigen Modul schlagen an', () => {
    const faelle = [
      "const b = await f.bytes();",
      "const d = await new Response(f).json();",
      "const s = await new Response(blob).text();",
      "const s = await f.text ();",
      "const s = await f.text( );",
      "const d = JSON.parse(s);",
      "const d = JSON . parse(s);",
    ];
    // Modul ausserhalb jedes Lesewegs (kein Import aus src/eingang): früher nicht geprüft
    for (const text of faelle) expect(pruefeQuellen([{ pfad: 'src/app/logik/prozesse.ts', text }]), text).toHaveLength(1);
    // Gegenprobe zur Gegenprobe: benannte Hilfe und Kommentar schlagen nicht an
    expect(pruefeQuellen([{ pfad: 'src/app/daten.ts', text: "const d = jsonAusVertrauen(roh, 'app-daten');\n// JSON.parse(roh) früher" }])).toEqual([]);
  });
});

describe('AF-020 Grenzen in Meldungen und Hilfe aus derselben Konfiguration', () => {
  it('von Hand geschriebene Grössen in src/i18n: 0', () => {
    expect(pruefeTexte(textDateien())).toEqual([]);
  });

  it('jede Grenze erscheint als Platzhalter; die Meldung enthält den Wert aus der Konfiguration', () => {
    uiSprache.value = 'de';
    expect(t('laden.zu-gross')).toContain(`höchstens ${groesseText(GRENZEN.projektdatei.maxBytes)}`);
    expect(t('fragebogen.zu_gross')).toContain(groesseText(GRENZEN.fragebogen.maxBytes));
    expect(t('prozesse.import_zu_gross')).toContain(groesseText(GRENZEN.drawio.maxBytes));
    expect(t('gestaltung.logo.hilfe')).toContain(`bis ${groesseText(GRENZEN.bild.maxBytes)}`);
    expect(t('gestaltung.logo.hilfe')).toContain(groesseText(LOGO_GRENZEN.pngBytes));
    expect(t('gestaltung.logo.fehler.zu-gross')).toContain(groesseText(GRENZEN.bild.maxBytes));
    uiSprache.value = 'en';
    expect(t('laden.zu-gross')).toContain(`${groesseText(GRENZEN.projektdatei.maxBytes)} at most`);
    uiSprache.value = 'de';
    for (const v of Object.values(grenzPlatzhalter('de'))) expect(v).toMatch(/^\d[\d’',.]* ?(MB|KB|B|px)?$/);
  });

  it('Meldung eines EingangsFehlers nennt Art und Grenze aus der Konfiguration (geänderte Grenze, geänderte Meldung)', () => {
    uiSprache.value = 'de';
    const m = fehlerVerstaendlich(new EingangsFehler('normpaket', 'zu-gross', GRENZEN.normpaket.maxBytes, GRENZEN.normpaket.maxBytes + 1));
    expect(m).toContain(groesseText(GRENZEN.normpaket.maxBytes));
    expect(m).toContain(t('eingang.art.normpaket'));
    expect(m).not.toMatch(/Eingang normpaket/);
    // Andere Grenze, anderer Text: Der Wert kommt aus dem Fehler, nicht aus dem Text
    expect(fehlerVerstaendlich(new EingangsFehler('normpaket', 'zu-gross', 3 * 1024 * 1024))).toContain('3 MB');
    expect(fehlerVerstaendlich(new EingangsFehler('norm-pdf', 'herzschlag', 30_000))).toContain('30 s');
  });

  it('Texte mit Platzhaltern sind vollständig ersetzt, DE und EN', () => {
    for (const sprache of ['de', 'en'] as const) {
      const werte = grenzPlatzhalter(sprache);
      for (const { text } of textDateien().filter((d) => d.pfad.includes(`/${sprache}/`))) {
        for (const m of text.matchAll(/\{(grenze_\w+)\}/g)) expect(werte, `${sprache}: ${m[1]}`).toHaveProperty(m[1]!);
        expect(ersetze('{grenze_drawio}', werte)).toBe(groesseText(GRENZEN.drawio.maxBytes));
      }
    }
  });

  it('Diagrammansicht: Grenzen im Text aus den Konstanten der Seite, die mit der Konfiguration übereinstimmen', () => {
    const tpl = readFileSync(join(REPO, 'src/diagrammansicht/Diagrammansicht.html.tpl'), 'utf8');
    expect(tpl).toMatch(new RegExp(`var MAX_ENTPACKT = 20 \\* 1024 \\* 1024;`));
    expect(GRENZEN.drawio.maxEntpackt).toBe(20 * 1024 * 1024);
    expect(tpl).toContain("zeigeStatus(e.grenze, { datei: name, mb: MAX_ENTPACKT / 1048576, seiten: MAX_SEITEN, formen: MAX_ZELLEN }, true)");
  });
});

/** Uhr zum Vorspulen */
function testUhr(): Uhr & { vor(ms: number): void } {
  let jetzt = 0;
  const wecker = new Map<number, { bis: number; f: () => void }>();
  let id = 0;
  return {
    setTimeout: (f, ms) => {
      wecker.set(++id, { bis: jetzt + ms, f });
      return id;
    },
    clearTimeout: (h) => void wecker.delete(h as number),
    vor(ms) {
      jetzt += ms;
      for (const [k, w] of [...wecker]) {
        if (w.bis <= jetzt) {
          wecker.delete(k);
          w.f();
        }
      }
    },
  };
}

describe('AF-019 Zeitgrenze und Herzschlag im Worker', () => {
  it('Herzschlag: ohne Lebenszeichen Abbruch nach der Zeit der Konfiguration, Lebenszeichen schieben ihn hinaus', () => {
    const uhr = testUhr();
    const abbruch = vi.fn();
    const w = wacheStarten('norm-pdf', abbruch, { uhr });
    const ms = (GRENZEN['norm-pdf'] as Grenze).herzschlagMs!;
    uhr.vor(ms - 1);
    w.lebt();
    uhr.vor(ms - 1);
    expect(abbruch).not.toHaveBeenCalled();
    uhr.vor(1);
    expect(abbruch).toHaveBeenCalledTimes(1);
    expect((abbruch.mock.calls[0]![0] as EingangsFehler).grund).toBe('herzschlag');
  });

  it('Zeitgrenze: Abbruch nach zeitMs, auch bei Lebenszeichen; ende() hält die Wache an', () => {
    const uhr = testUhr();
    const abbruch = vi.fn();
    const w = wacheStarten('drawio', abbruch, { uhr });
    const ms = (GRENZEN.drawio as Grenze).zeitMs!;
    for (let i = 0; i < 10; i++) {
      uhr.vor(ms / 10 - 1);
      w.lebt();
    }
    uhr.vor(10);
    expect((abbruch.mock.calls[0]![0] as EingangsFehler).grund).toBe('zeit');
    const ab2 = vi.fn();
    const w2 = wacheStarten('drawio', ab2, { uhr });
    w2.ende();
    uhr.vor(ms * 2);
    expect(ab2).not.toHaveBeenCalled();
  });

  it('jede teure Art hat eine Zeitgrenze oder einen Herzschlag in der Konfiguration', () => {
    for (const art of ['norm-pdf', 'drawio', 'sicherung', 'word-vorlage'] as EingangsArt[]) {
      const g = GRENZEN[art] as Grenze;
      expect(g.zeitMs ?? g.herzschlagMs, art).toBeGreaterThan(0);
    }
  });

  it('Norm-PDF: Worker ohne Antwort wird beendet, der Auftrag endet in einer Meldung; Fortschritt hält ihn am Leben', async () => {
    const uhr = testUhr();
    const hoerer: ((e: MessageEvent) => void)[] = [];
    const worker = { addEventListener: (typ: string, f: (e: MessageEvent) => void) => typ === 'message' && hoerer.push(f), removeEventListener: () => {}, postMessage: vi.fn(), terminate: vi.fn() };
    setzePdfUmgebung({ fabrik: () => worker as never, uhr });
    const lauf = liesNormPdf(new Uint8Array(8));
    const nr = (worker.postMessage.mock.calls[0]![0] as { nr: number }).nr;
    const ms = (GRENZEN['norm-pdf'] as Grenze).herzschlagMs!;
    uhr.vor(ms - 1);
    for (const f of hoerer) f({ data: { nr, art: 'fortschritt', fertig: 1, gesamt: 9 } } as MessageEvent);
    uhr.vor(ms - 1);
    expect(worker.terminate).not.toHaveBeenCalled();
    uhr.vor(1);
    const e = await lauf.catch((x: unknown) => x);
    expect(e).toBeInstanceOf(EingangsFehler);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    uiSprache.value = 'de';
    expect(fehlerVerstaendlich(e)).toContain(`${ms / 1000} s`);
  });
});

function textDateien(): { pfad: string; text: string }[] {
  const aus: { pfad: string; text: string }[] = [];
  const lauf = (o: string): void => {
    for (const n of readdirSync(join(REPO, o), { withFileTypes: true })) {
      const p = `${o}/${n.name}`;
      if (n.isDirectory()) lauf(p);
      else if (n.name.endsWith('.yaml')) aus.push({ pfad: p, text: readFileSync(join(REPO, p), 'utf8') });
    }
  };
  lauf('src/i18n');
  return aus;
}

describe('Funktionsänderungen der Nacharbeit (N5): Zwischenstand, Register mit BOM, Grenzen des Gestaltungspakets', () => {
  it('Zwischenstand über der Grenze einer Projektdatei: bleibt in der Liste und im Browser, Wiederherstellen meldet Ursache und nächsten Schritt (DE, EN)', async () => {
    const { ProjektSpeicher, PRAEFIX } = await import('../../src/app/speicher/projekt-speicher.ts');
    const { SpeicherAdapter } = await import('../../src/app/speicher/zwischenspeicher.ts');
    const zwischen = new SpeicherAdapter();
    const datei = { art: 'fallback' as const, oeffnen: () => Promise.resolve(null), speichern: () => Promise.resolve(null) };
    const speicher = new ProjektSpeicher<{ id: string }>({ datei, zwischen, schluesselVon: (p) => p.id });
    const gross = GRENZEN.projektdatei.maxBytes + 10;
    await zwischen.schreiben(`${PRAEFIX}gross`, JSON.stringify({ v: 1, schluessel: 'gross', dateiname: 'gross.aims.json', geaendertAm: '2026-11-07T10:00:00Z', inhalt: 'x'.repeat(gross) }));
    // Vorher (P8 erste Fassung) ergab die Hülle über der Grenze still null: der Stand fehlte in der Liste
    expect((await speicher.zwischenstaende()).map((z) => z.schluessel)).toEqual(['gross']);
    const e = await speicher.wiederherstellen('gross').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(EingangsFehler);
    expect((e as EingangsFehler).grund).toBe('zwischenstand-gross');
    expect(await zwischen.lesen(`${PRAEFIX}gross`)).not.toBeNull();
    uiSprache.value = 'de';
    const de = fehlerVerstaendlich(e);
    expect(de).toContain(`höchstens ${groesseText(GRENZEN.projektdatei.maxBytes)}`);
    expect(de).toContain('bleibt im Browser erhalten');
    expect(de).toContain('als Datei');
    uiSprache.value = 'en';
    expect(fehlerVerstaendlich(e)).toContain('stays in the browser');
    uiSprache.value = 'de';
  });

  it('registerParsen liest bibliothek.json jetzt auch mit BOM (Funktionsänderung durch jsonLesen)', async () => {
    const { registerParsen, REGISTER_FORMAT } = await import('../../src/bibliothek/register-datei.ts');
    const r = { format: REGISTER_FORMAT, version: 1, projektId: 'p', organisation: 'o', geaendert: '2026-11-07T10:00:00Z', uebersicht: [], eintraege: [] };
    expect(registerParsen(`﻿${JSON.stringify(r)}`)).not.toBeNull();
    expect(registerParsen(JSON.stringify(r))).not.toBeNull();
    expect(registerParsen('{"format":')).toBeNull();
  });

  it('paketLesen: neue Grenzen 10 000 Werte und Tiefe 50 lehnen mit Grund zu-gross ab; ein volles Paket bleibt weit darunter', async () => {
    const { paketErstellen, paketLesen } = await import('../../src/model/gestaltung.ts');
    const g = GRENZEN.gestaltungspaket;
    const voll = paketErstellen({
      farben: { primaer: '0A5A8C', sekundaer: '222222', akzent: 'E2A200', ueberschriften: true },
      schrift: { paar: 'eigen', titel: 'Arial', text: 'Arial' },
      kopfzeile: { logoPosition: 'links', firmennameZeigen: true, logoHoeheMm: 9 },
      logo: { png: `data:image/png;base64,${'A'.repeat(LOGO_GRENZEN.pngBytes)}`, breite: 200, hoehe: 80, svg: `<svg>${'<g/>'.repeat(20_000)}</svg>` },
    } as never);
    expect(paketLesen(JSON.stringify(voll)).ok).toBe(true);
    const viele = { art: 'aims-gestaltung', version: 1, gestaltung: { liste: Array.from({ length: g.maxWerte }, () => 0) } };
    expect(paketLesen(JSON.stringify(viele))).toEqual({ ok: false, grund: 'zu-gross' });
    const tief = `{"art":"aims-gestaltung","version":1,"gestaltung":{"x":${'['.repeat(g.maxTiefe)}0${']'.repeat(g.maxTiefe)}}}`;
    expect(paketLesen(tief)).toEqual({ ok: false, grund: 'zu-gross' });
    uiSprache.value = 'de';
    expect(t('gestaltung.paket.grund.zu-gross')).toContain(groesseText(g.maxBytes));
  });

  it('JSON.parse nur im Eingangsmodul: jsonAusVertrauen verlangt eine benannte Quelle', () => {
    expect(jsonAusVertrauen('{"a":1}', 'kopie')).toEqual({ a: 1 });
    expect(() => jsonAusVertrauen('{}', 'datei' as never)).toThrow(TypeError);
  });
});

describe('AF-019 Verdrahtung der Zeitgrenzen im Generator-Worker (N3)', () => {
  it('ZEITGRENZE trägt die Werte aus GRENZEN; logo deckt Bild, SVG-Logo und Word-Vorlage', async () => {
    const { ZEITGRENZE } = await import('../../src/app/worker/client.ts');
    expect(ZEITGRENZE['zip-entpacken']).toBe(GRENZEN.sicherung.zeitMs);
    expect(ZEITGRENZE['drawio-lesen']).toBe(GRENZEN.drawio.zeitMs);
    expect(ZEITGRENZE['xlsx-lesen']).toBe(GRENZEN.fragebogen.zeitMs);
    expect(ZEITGRENZE.logo).toBe(Math.max(GRENZEN.bild.zeitMs, GRENZEN['svg-logo'].zeitMs, GRENZEN['word-vorlage'].zeitMs));
    for (const art of ['bild', 'svg-logo', 'word-vorlage'] as const) expect(ZEITGRENZE.logo, art).toBeGreaterThanOrEqual(GRENZEN[art].zeitMs);
  });
});
