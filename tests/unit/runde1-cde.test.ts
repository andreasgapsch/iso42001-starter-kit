// Regressionstests der ersten Prüfrunde: Sicherheit (E), Neuling (C), Oberfläche (D).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync, strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { generatorVersion } from '../../src/bibliothek/generator.ts';
import { pfadSicher, titelAusName } from '../../src/bibliothek/layout.ts';
import type { RegisterDatei } from '../../src/bibliothek/register-datei.ts';
import { sicherungEntpacken } from '../../src/bibliothek/sicherung.ts';
import { freigabeStand, sichtEintraege } from '../../src/bibliothek/sicht.ts';
import { docxText } from '../../src/bibliothek/vorschau.ts';
import { stapelOhnePfad } from '../../src/app/Fehler.tsx';
import { ohneFreigabeIds, stage1Bericht } from '../../src/app/ansichten/pruefung/stage1.ts';
import { datumGueltig, ladeProjektText, projektReparieren, pruefeProjektDaten, schemaFehlerText } from '../../src/app/import/laden.ts';
import { registerProbe, registerPruefen } from '../../src/app/import/register-pruefen.ts';
import { bereitschaftBerechnen } from '../../src/app/logik/bereitschaft.ts';
import type { Umfeld } from '../../src/app/logik/gefuehrt.ts';
import type { GefuehrtDaten } from '../../src/app/logik/gefuehrt-typen.ts';
import { parseRoute } from '../../src/app/logik/routen.ts';
import { soaVorschlaege, type EuaiaControl } from '../../src/app/logik/vorschlaege.ts';
import { ProjektSpeicher, SpeicherAdapter, type DateiZugriff } from '../../src/app/speicher/index.ts';
import { tabWache, type KanalLike, type TabNachricht } from '../../src/app/speicher/zwei-tabs.ts';
import { dokumentSet } from '../../src/app/worker/set.ts';
import { renderDocx } from '../../src/generator/docx.ts';
import type { DocxDokument, XlsxMappe } from '../../src/generator/ir.ts';
import { svgBereinigen, SvgFehler } from '../../src/generator/svg.ts';
import { ausWordVorlage, VorlagenFehler } from '../../src/generator/vorlage-import.ts';
import { renderXlsx } from '../../src/generator/xlsx.ts';
import { xmlBereinigen, zeichenBereinigen } from '../../src/generator/xml-zeichen.ts';
import { entpackeBegrenzt, ZipGrenzenFehler } from '../../src/generator/zip-grenzen.ts';
import { ablaufBeschriftung, ablaufGeometrie, ablaufWeg, ablaufSzene, seitenPunkt, type Rechteck } from '../../src/grafik/svg/ablauf.ts';
import { zuSvg } from '../../src/grafik/svg/szene.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { logoBereinigen } from '../../src/model/gestaltung.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import type { Gestaltung, Projekt } from '../../src/model/typen.ts';
import { drawioExport, drawioSeitenLesen, entpackeSeite, DrawioFehler, MAX_ROH } from '../../src/prozesse/drawio.ts';
import { ablaufVon, prozessKatalog } from '../../src/prozesse/katalog.ts';
import { prozessRaster, SPALTE_PX } from '../../src/prozesse/layout.ts';
import { pruefeProjekt, type Regel } from '../../src/regeln/pruefungen.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const REPO = join(import.meta.dirname, '..', '..');
const kataloge = ladeKataloge();
const texte = { de: ladeTexte('de'), en: ladeTexte('en') };
const u = erstelleUebersetzer('de', texte.de);
const CONTROLS = kataloge.controls42001.gruppen.flatMap((g) => g.controls.map((c) => c.id));
const regeln = (parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')) as { regeln: Regel[] }).regeln;
const gefuehrt = JSON.parse(readFileSync(join(REPO, 'src/generiert/gefuehrt.json'), 'utf8')) as GefuehrtDaten;
const umfeld: Umfeld = { gefuehrt, controlIds42001: CONTROLS, euaia: (kataloge['aiact_euaiaControls'] as { controls: EuaiaControl[] }).controls };
const beispiel = (f: string): Projekt => JSON.parse(readFileSync(join(REPO, `src/beispiele/${f}.aims.json`), 'utf8')) as Projekt;
const version = (o: Record<string, unknown> = {}) => ({ version: '0.1', datei: 'Firmendokumente/D-03_x/v0.1.docx', groesse: 1, pruefsumme: 'a'.repeat(64), datum: '2026-10-01T08:00:00Z', ...o });
const register = (eintraege: unknown[], projektId = 'p'): RegisterDatei => ({ format: 'aims-bibliothek', version: 1, projektId, organisation: 'X', geaendert: '2026-10-01', uebersicht: [], eintraege: eintraege as RegisterDatei['eintraege'] });

describe('E-01, E-02: von aussen nichts Unlesbares', () => {
  const p = () => leeresProjekt({ sprache: 'de', mitIsms: false, modulAiAct: false, projektId: 'p' });
  it('bibliothek.json: ungültige Einträge werden abgewiesen, gültige übernommen', () => {
    const g = registerPruefen(p(), register([
      { id: 'X-001', art: 'eigene', titel: 'Gut', versionen: [version({ datei: 'Eigene/X-001_a/v0.1.pdf' })] },
      { id: 'X-002', art: 'eigene', versionen: [version({ datei: 42 })] },
      { id: 'X-003', art: 'boese', versionen: [] },
      { id: 'X-004', art: 'eigene', extra: 1, versionen: [] },
      { id: 'X-005', art: 'eigene', versionen: [version({ datei: '../aussen.pdf' })] },
      { id: 'X-006', art: 'eigene', versionen: [version({ groesse: 'gross' })] },
    ]));
    expect(g.register.eintraege.map((e) => e.id)).toEqual(['X-001']);
    expect(g.abgelehnt.map((a) => a.id)).toEqual(['X-002', 'X-003', 'X-004', 'X-005', 'X-006']);
    expect(registerProbe(p(), g.register).ok).toBe(true);
  });
  it('fremde Projektkennung wird erkannt', () => {
    expect(registerPruefen(p(), register([], 'anders')).fremdesProjekt).toBe(true);
    expect(registerPruefen(p(), register([], 'p')).fremdesProjekt).toBe(false);
  });
  it('langer Dateiname ergibt einen Titel innerhalb der Grenze des Schemas', () => {
    expect([...titelAusName(`${'ä'.repeat(400)}.pdf`)].length).toBe(200);
  });
  it('Vor dem Speichern: Reparatur macht aus einem zu langen Titel wieder eine lesbare Datei', () => {
    const roh = p();
    roh.bibliothek = { eintraege: [{ id: 'X-001', art: 'eigene', titel: 'y'.repeat(300), versionen: [] }] };
    expect(pruefeProjektDaten(JSON.parse(JSON.stringify(roh))).ok).toBe(false);
    const r = projektReparieren(JSON.parse(JSON.stringify(roh)))!;
    expect(r.aenderungen.length).toBeGreaterThan(0);
    expect(r.projekt.bibliothek!.eintraege[0]!.titel!.length).toBe(200);
    expect(ladeProjektText(JSON.stringify(r.projekt)).ok).toBe(true);
  });
  it('Speicher schreibt nichts, wenn die Prüfung vor dem Speichern wirft', async () => {
    let geschrieben = 0;
    const datei: DateiZugriff = { oeffnen: async () => null, speichern: async (_i: string, n: string) => { geschrieben++; return { art: 'download', name: n }; } } as unknown as DateiZugriff;
    const s = new ProjektSpeicher<{ id: string }>({ datei, zwischen: new SpeicherAdapter(), schluesselVon: (x) => x.id, vorDemSpeichern: () => { throw new Error('ungültig'); } });
    s.neu({ id: 'a' });
    await expect(s.speichern()).rejects.toThrow('ungültig');
    expect(geschrieben).toBe(0);
    expect(s.status.fehler).toContain('ungültig');
  });
});

describe('E-03: Steuerzeichen zentral', () => {
  it('xmlBereinigen: VT wird Umbruch, BEL, U+FFFE und einzelne Surrogate fallen weg, Emoji bleibt', () => {
    expect(xmlBereinigen('a\u000Bb')).toBe('a\nb');
    expect(xmlBereinigen('a\u0007\uFFFE\uFFFFb')).toBe('ab');
    expect(xmlBereinigen('a\uD83Db')).toBe('ab');
    expect(xmlBereinigen('a😀b\tc\n')).toBe('a😀b\tc\n');
  });
  it('zeichenBereinigen lässt saubere Objekte und Bytes unberührt', () => {
    const o = { a: ['x'], b: new Uint8Array([7]) };
    expect(zeichenBereinigen(o)).toBe(o);
    expect((zeichenBereinigen({ a: ['x\u0007'] })).a[0]).toBe('x');
  });
  const wohlgeformt = (xml: string) => expect(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/.test(xml)).toBe(false);
  it('Erzeugte Word- und Excel-Dateien enthalten nur gültige Zeichen', async () => {
    const p = vollstaendigesProjekt();
    p.organisation.name = 'Firma\u000B AG\u0007\uFFFE';
    p.kiSysteme[0]!.name = 'Assistent\u000BZwei';
    const { VORLAGEN } = await import('../../src/vorlagen/index.ts');
    const { dateien } = dokumentSet(p, kataloge, 'de', ['D-02', 'D-10']);
    const { erzeugeIr, istDocx } = await import('../../src/app/worker/set.ts');
    expect(Object.keys(VORLAGEN).length).toBeGreaterThan(0);
    for (const d of dateien) {
      const ir = erzeugeIr(d, p, texte.de, kataloge, 'de', 'x');
      const b = istDocx(ir) ? await renderDocx(ir as DocxDokument) : await renderXlsx(ir as XlsxMappe);
      for (const [pfad, teil] of Object.entries(unzipSync(b))) if (pfad.endsWith('.xml')) wohlgeformt(strFromU8(teil));
    }
  });
});

describe('E-04, E-05, E-06: SVG bei jedem Eingang', () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const logo = (svg: string) => ({ logo: { png: `data:image/png;base64,${png}`, breite: 16, hoehe: 16, svg } }) as Gestaltung;
  const boese = '<svg xmlns="http://www.w3.org/2000/svg" onload="x()"><script>y()</script><foreignObject/><image href="https://example.org/a.png"/><rect width="1" height="1"/></svg>';
  it('Gestaltungspaket und Projektdatei: Skript, onload, foreignObject, externes Bild fallen weg', () => {
    const g = logo(boese);
    expect(logoBereinigen(g)).toBeTruthy();
    expect(g.logo!.svg).not.toMatch(/script|onload|foreignObject|example\.org/);
    expect(g.logo!.svg).toContain('<rect');
  });
  it('Beim Laden der Projektdatei bereinigt, ohne Rundreise zu ändern', () => {
    const p = leeresProjekt({ sprache: 'de', mitIsms: false, modulAiAct: false, projektId: 'p' });
    p.organisation.gestaltung = logo(boese);
    const r = ladeProjektText(JSON.stringify(p));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.projekt.organisation.gestaltung!.logo!.svg).not.toMatch(/script|onload/);
      const sauber = r.projekt.organisation.gestaltung!.logo!.svg!;
      expect(svgBereinigen(sauber).svg).toBe(sauber);
    }
  });
  it('Nicht lesbares SVG wird verworfen, PNG bleibt; falsches PNG entfernt das Logo', () => {
    const g = logo('<svg><g></svg>');
    logoBereinigen(g);
    expect(g.logo!.svg).toBeUndefined();
    expect(g.logo!.png).toBeTruthy();
    const h = { logo: { png: 'data:image/png;base64,QUJD', breite: 1, hoehe: 1 } } as Gestaltung;
    logoBereinigen(h);
    expect(h.logo).toBeUndefined();
  });
  it('Word-Datei: Das SVG im Paket ist bereinigt, auch wenn es am Laden vorbei ins Zwischenformat kommt', async () => {
    const p = vollstaendigesProjekt();
    p.organisation.gestaltung = logo('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>');
    const { dateien } = dokumentSet(p, kataloge, 'de', ['D-02']);
    const { erzeugeIr } = await import('../../src/app/worker/set.ts');
    const ir = erzeugeIr(dateien[0]!, p, texte.de, kataloge, 'de', 'x') as DocxDokument;
    if (ir.gestaltung?.logo) ir.gestaltung.logo.svg = new TextEncoder().encode(boese);
    const teile = unzipSync(await renderDocx(ir));
    for (const [pfad, teil] of Object.entries(teile)) if (pfad.endsWith('.svg')) expect(strFromU8(teil)).not.toMatch(/script|onload|example\.org/);
  });
  it('E-05: CSS-Escape in fill und style wird entfernt', () => {
    const r = svgBereinigen('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="u\\72l(https://example.org/esc)" style="fill:u\\72l(https://example.org/x)"/></svg>');
    expect(r.svg).not.toContain('example.org');
  });
  it('E-06: verschachtelte use werden abgelehnt, einfache bleiben', () => {
    let s = '<svg xmlns="http://www.w3.org/2000/svg"><defs><rect id="a0" width="1" height="1"/>';
    for (let i = 1; i < 12; i++) s += `<g id="a${i}">${`<use href="#a${i - 1}"/>`.repeat(10)}</g>`;
    expect(() => svgBereinigen(`${s}</defs><use href="#a11"/></svg>`)).toThrow(SvgFehler);
    expect(() => svgBereinigen('<svg xmlns="http://www.w3.org/2000/svg"><g id="a"><use href="#a"/></g></svg>')).toThrow(SvgFehler);
    expect(svgBereinigen('<svg xmlns="http://www.w3.org/2000/svg"><defs><rect id="a"/></defs><use href="#a"/><use href="#a"/></svg>').svg).toContain('<use');
  });
});

describe('E-07 bis E-10, E-22: Grenzen vor dem Entpacken', () => {
  const bombe = (mb: number) => new Uint8Array(mb * 1024 * 1024);
  const zip = (t: Record<string, Uint8Array>) => zipSync(t, { level: 1 });
  it('Kopfdaten über der Grenze: Abbruch, bevor etwas entpackt wird', () => {
    const z = zip({ a: bombe(3), b: bombe(3) });
    expect(() => entpackeBegrenzt(z, { maxBytes: 4 * 1024 * 1024, maxEintraege: 10 })).toThrow(ZipGrenzenFehler);
    expect(Object.keys(entpackeBegrenzt(z, { maxBytes: 7 * 1024 * 1024, maxEintraege: 10 }))).toEqual(['a', 'b']);
    expect(() => entpackeBegrenzt(z, { maxBytes: 7 * 1024 * 1024, maxEintraege: 1 })).toThrow(/Einträgen/);
  });
  it('__proto__ im ZIP wird gemeldet statt still verloren', () => {
    const t = Object.create(null) as Record<string, Uint8Array>;
    t['__proto__'] = strToU8('x');
    t['b.txt'] = strToU8('y');
    expect(() => sicherungEntpacken(zipSync(t))).toThrow();
  });
  it('Reservierte Namen, Laufwerke und Steuerzeichen sind keine sicheren Pfade', () => {
    for (const x of ['con.txt', 'a/NUL', 'C:/x', 'a\u0007b', '__proto__', '../x', '/x']) expect(pfadSicher(x)).toBe(false);
    expect(pfadSicher('Eigene/X-001_Bericht/v0.1.pdf')).toBe(true);
  });
  it('Word-Vorlage mit vielen grossen Teilen wird abgelehnt', () => {
    const t: Record<string, Uint8Array> = { 'word/document.xml': strToU8('<a/>') };
    for (let i = 0; i < 8; i++) t[`word/media/b${i}.png`] = bombe(10);
    expect(() => ausWordVorlage(zip(t))).toThrow(VorlagenFehler);
  });
  it('Quadratische Suche ist weg: offene Tags in Vorlage und Vorschau bleiben schnell', () => {
    const offen = '<a:accent1>'.repeat(180_000);
    const t0 = performance.now();
    ausWordVorlage(zip({ 'word/document.xml': strToU8('<a/>'), 'word/theme/theme1.xml': strToU8(`${offen}<a:latin ${'x'.repeat(10)}`) }));
    docxText(zip({ 'word/document.xml': strToU8('<w:p>'.repeat(300_000)) }));
    docxText(zip({ 'word/document.xml': strToU8(`<w:p>${'<w:t '.repeat(300_000)}</w:p>`) }));
    expect(performance.now() - t0).toBeLessThan(4000);
  });
  it('Vorschau liest Absätze, Tabellen und Überschriften weiterhin', () => {
    const xml = '<w:document><w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Titel &amp; mehr</w:t></w:r></w:p><w:p/><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Zelle</w:t><w:tab/><w:t>B</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:t>Ende</w:t></w:r></w:p></w:document>';
    expect(docxText(zip({ 'word/document.xml': strToU8(xml) }))).toEqual([{ text: 'Titel & mehr', ebene: 2 }, { text: 'Zelle\tB', tabelle: true }, { text: 'Ende' }]);
  });
  it('draw.io: Seite über 2 MB wird bei fester Puffergrösse erkannt', () => {
    const b = btoa(String.fromCharCode(...deflateSync(strToU8(`<a>${'x'.repeat(3 * 1024 * 1024)}</a>`), { level: 9 })));
    expect(() => entpackeSeite(b)).toThrow(DrawioFehler);
  });
  it('draw.io: DTD wird abgelehnt, zu viele Seiten ebenso', () => {
    expect(() => drawioSeitenLesen('<!DOCTYPE a [<!ENTITY x "y">]><mxfile/>')).toThrow(DrawioFehler);
    const viele = `<mxfile>${'<diagram><mxGraphModel><root/></mxGraphModel></diagram>'.repeat(300)}</mxfile>`;
    expect(() => drawioSeitenLesen(viele)).toThrow(/Seiten/);
    expect(MAX_ROH).toBeGreaterThan(0);
  });
  it('Diagrammansicht lehnt DTD ab und begrenzt Seiten und Formen', () => {
    const tpl = readFileSync(join(REPO, 'src/diagrammansicht/Diagrammansicht.html.tpl'), 'utf8');
    expect(tpl).toContain('fehler_dtd');
    expect(tpl).toContain('MAX_ZELLEN');
    expect(tpl).toContain("DecompressionStream('deflate-raw')");
  });
});

describe('E-11, E-15, E-18: Inhalt der Projektdatei', () => {
  const p = () => JSON.parse(JSON.stringify(vollstaendigesProjekt())) as Projekt;
  it('Text über der Grenze und unmögliches Datum werden abgelehnt, mit verständlichem Text', () => {
    const a = p();
    a.kiSysteme[0]!.name = 'x'.repeat(100_000);
    const r = pruefeProjektDaten(a);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(schemaFehlerText(r.fehler)[0]).toContain('Text zu lang');
    const b = p();
    b.meta.geaendert = '2026-13-45';
    const s = ladeProjektText(JSON.stringify(b));
    expect(s.ok).toBe(false);
    if (!s.ok) expect(s.details.join()).toContain('Datum');
    const c = p();
    c.meta.geaendert = 'gestern';
    expect(pruefeProjektDaten(c).ok).toBe(false);
  });
  it('datumGueltig', () => {
    expect(datumGueltig('2026-02-28')).toBe(true);
    expect(datumGueltig('2026-02-30')).toBe(false);
    expect(datumGueltig('2026-10-01T08:00:00.000Z')).toBe(true);
    expect(datumGueltig('2026-10-01T99:00')).toBe(false);
  });
  it('Doppelte Kennungen: beim Laden erkannt, reparierbar, das Set scheitert nicht mehr', () => {
    const a = p();
    a.kiSysteme.push({ ...a.kiSysteme[0]! });
    expect(pruefeProjektDaten(a).ok).toBe(false);
    const r = projektReparieren(a)!;
    expect(new Set(r.projekt.kiSysteme.map((s) => s.id)).size).toBe(2);
    const b = p();
    b.kiSysteme.push({ ...b.kiSysteme[0]!, id: 'KI-099' });
    const { dateien } = dokumentSet(b, kataloge, 'de');
    const namen = dateien.map((d) => d.dateiname.toLowerCase());
    expect(new Set(namen).size).toBe(namen.length);
  });
  it('Kaputtes JSON: keine englische Parsermeldung in den Details', () => {
    const r = ladeProjektText('{"a": 1 "b"}');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.art).toBe('kein-json');
      expect(r.details).toEqual([]);
    }
  });
  it('Alle Beispiele bleiben gültig und unverändert lesbar', () => {
    for (const f of ['muster-maschinenbau.de', 'muster-maschinenbau.en', 'praezisionsteile.de', 'praezisionsteile.en']) {
      const r = ladeProjektText(readFileSync(join(REPO, `src/beispiele/${f}.aims.json`), 'utf8'));
      expect(r.ok, f).toBe(true);
      if (r.ok) expect(r.projekt).toEqual(beispiel(f));
    }
  });
});

describe('E-12, E-13, E-14: Verlust und Tabs', () => {
  const speicher = (schreiben?: () => never) => {
    const z = new SpeicherAdapter();
    if (schreiben) z.schreiben = schreiben as never;
    const timer = { setTimeout: () => 1, clearTimeout: () => undefined };
    return { s: new ProjektSpeicher<{ id: string; n: number }>({ datei: {} as DateiZugriff, zwischen: z, schluesselVon: (x) => x.id, zeitgeber: timer }), z };
  };
  it('Zwischenspeicher voll: Fehler im Status statt still', async () => {
    const { s } = speicher(() => { throw new Error('QuotaExceededError'); });
    s.neu({ id: 'a', n: 1 });
    await s.zwischenspeichern();
    expect(s.status.fehler).toMatch(/^Zwischenspeicher/);
  });
  it('Wechsel zu einem anderen Projekt sichert die letzte Eingabe sofort', async () => {
    const { s } = speicher();
    s.neu({ id: 'a', n: 1 });
    s.aendern({ id: 'a', n: 2 });
    s.neu({ id: 'b', n: 1 });
    await s.zwischenspeichern();
    const stand = (await s.zwischenstaende()).find((x) => x.schluessel === 'a')!;
    expect(JSON.parse(stand.inhalt).n).toBe(2);
  });
  it('Gesicherte Stände werden befristet, ungesicherte bleiben', async () => {
    const { s, z } = speicher();
    await z.schreiben('aims-manager:zwischenstand:alt', JSON.stringify({ v: 1, schluessel: 'alt', dateiname: 'a', geaendertAm: '2020-01-01T00:00:00Z', inhalt: '{}', gesichertAm: '2020-01-01T00:00:00Z' }));
    await z.schreiben('aims-manager:zwischenstand:offen', JSON.stringify({ v: 1, schluessel: 'offen', dateiname: 'a', geaendertAm: '2020-01-01T00:00:00Z', inhalt: '{}' }));
    expect(await s.aufraeumen(30)).toBe(1);
    expect((await s.zwischenstaende()).map((x) => x.schluessel)).toEqual(['offen']);
  });
  it('Zwei Tabs mit demselben Projekt werden erkannt, andere nicht; beim Schliessen aufgehoben', () => {
    const hoerer: ((e: { data: TabNachricht }) => void)[] = [];
    const kanal = (): KanalLike => {
      let eigener: (e: { data: TabNachricht }) => void = () => undefined;
      return {
        postMessage: (n) => { for (const h of hoerer) if (h !== eigener) h({ data: n }); },
        addEventListener: (_t, f) => { eigener = f; hoerer.push(f); },
        close: () => undefined,
      };
    };
    const meld: Record<string, number> = { a: 0, b: 0 };
    const a = tabWache(kanal(), 'A', (n) => (meld['a'] = n));
    const b = tabWache(kanal(), 'B', (n) => (meld['b'] = n));
    a.setze('p1');
    b.setze('p2');
    expect(meld).toEqual({ a: 0, b: 0 });
    b.setze('p1');
    expect(meld).toEqual({ a: 1, b: 1 });
    b.ende();
    expect(meld['a']).toBe(0);
  });
});

describe('E-16, E-19: Routen und Fehlerbericht', () => {
  it('Kaputte Adressen werfen nicht, __proto__ ist kein Ziel', () => {
    for (const h of ['#/%', '#/formular/%E0%A4%A', '#/gefuehrt/%', '#/formular/__proto__', '#/prozesse/%ZZ', '#/bibliothek/%']) expect(() => parseRoute(h)).not.toThrow();
    expect(parseRoute('#/formular/__proto__')).toMatchObject({ art: 'formular', modul: 'uebersicht' });
  });
  it('Fehlerbericht ohne Pfad und Benutzernamen', () => {
    const t = stapelOhnePfad('at x (file:///home/nutzer/kit/aims-manager.html:1:2)\nat y (file:///C:/Users/Hans/aims-manager.html:3:4)');
    expect(t).not.toMatch(/nutzer|Hans|Users|home/);
    expect(t).toContain('aims-manager.html:1:2');
  });
});

describe('C-01: Bereitschaft zählt alles', () => {
  const stand = (p: Projekt) => {
    const befunde = pruefeProjekt(regeln, { projekt: p, heute: '2027-02-15', controlIds42001: CONTROLS, aiActStand: '2026-07-27', kataloge });
    return { befunde, b: bereitschaftBerechnen(p, umfeld, befunde, ohneFreigabeIds(p, kataloge)) };
  };
  it('Neues Projekt ist nie bereit, auch ohne Fehler', () => {
    const p = leeresProjekt({ sprache: 'de', mitIsms: false, modulAiAct: false, projektId: 'p' });
    expect(stand(p).b.stufe).toBe('rot');
    expect(bereitschaftBerechnen(p, umfeld, [], []).stufe).toBe('rot');
    expect(bereitschaftBerechnen(p, umfeld, [], []).luecken.some((l) => l.art === 'etappe' && l.id === 'E9')).toBe(true);
  });
  it('Hinweise allein reichen nicht: Etappen mit null Seiten und leere Register bleiben Lücken', () => {
    const p = beispiel('muster-maschinenbau.de');
    for (const e of ['E9', 'E10', 'E11']) delete p.meta.gefuehrt.etappen[e];
    p.ziele = [];
    const { b } = stand(p);
    expect(b.stufe).toBe('rot');
    expect(b.luecken.map((l) => l.id)).toEqual(expect.arrayContaining(['ziele']));
  });
  it('Stage-1-Bericht übernimmt dieselbe Bereitschaft', () => {
    const p = leeresProjekt({ sprache: 'de', mitIsms: false, modulAiAct: false, projektId: 'p' });
    const r = stage1Bericht(p, { u, umfeld, kataloge, regeln, befunde: [], heute: '2026-11-01' });
    expect(r.bereitschaft.stufe).toBe('rot');
    expect(r.offen.ohneFreigabe.length).toBeGreaterThan(0);
  });
  it('Dosierung gilt nicht: Fehler aus kommenden Etappen zählen', () => {
    const p = leeresProjekt({ sprache: 'de', mitIsms: false, modulAiAct: false, projektId: 'p' });
    expect(stand(p).b.fehler).toBe(stand(p).befunde.filter((x) => x.schwere === 'fehler').length);
  });
  it('Beide Beispiele mit vollständigen Etappen und Freigaben: keine Lücken, freiwillige eigene Controls zählen nicht', () => {
    expect(stand(beispiel('muster-maschinenbau.de')).b.luecken).toEqual([]);
    expect(stand(beispiel('praezisionsteile.de')).b.luecken).toEqual([]);
  });
});

describe('C-02, C-10: eine Freigabewahrheit', () => {
  const p = () => {
    const x = leeresProjekt({ sprache: 'de', mitIsms: false, modulAiAct: false, projektId: 'p' });
    x.personen.push({ id: 'P-001', name: 'Hans', funktion: 'GL' } as never);
    return x;
  };
  it('Im Guide freigegebenes Dokument ist in der Bibliothek freigegeben und erhält keine Entwurfsversion', () => {
    const x = p();
    x.organisation.leitlinie.freigabe = { von: 'P-001', am: '2026-10-10' };
    expect(generatorVersion(x, 'D-03')).toMatchObject({ version: '1.0', freigegeben: true });
    x.bibliothek = { ablage: 'browser', eintraege: [{ id: 'D-03', art: 'firmendokument', versionen: [version()] }] };
    const s = sichtEintraege(x).find((e) => e.id === 'D-03')!;
    expect(s.status).toBe('freigegeben');
    expect(s.freigabe?.von).toBe('P-001');
    expect(freigabeStand(x, 'D-03')).toMatchObject({ status: 'freigegeben', quelle: 'projekt' });
  });
  it('Register mit Freigabe, aber Status Entwurf: überall freigegeben, wie im Dokumentkopf', () => {
    const x = p();
    x.dokumente.push({ id: 'D-07', version: '1.0', status: 'entwurf', ablageort: '', giltFuerIsms: false, freigabe: { von: 'P-001', am: '2026-10-10' } });
    expect(freigabeStand(x, 'D-07').status).toBe('freigegeben');
    expect(sichtEintraege(x).find((e) => e.id === 'D-07')!.status).toBe('freigegeben');
    expect(generatorVersion(x, 'D-07')).toMatchObject({ version: '1.0', freigegeben: true });
  });
  it('Entwurf in der Bibliothek: Stage-1-Bericht nennt ihn, nicht «nicht im Register»', () => {
    const x = p();
    x.bibliothek = { ablage: 'browser', eintraege: [{ id: 'D-02', art: 'firmendokument', versionen: [version({ datei: 'Firmendokumente/D-02_x/v0.1.docx', status: 'entwurf' })] }] };
    const r = stage1Bericht(x, { u, umfeld, kataloge, regeln, befunde: [], heute: '2026-11-01' });
    expect(r.dokumente.find((d) => d.id === 'D-02')).toMatchObject({ version: '0.1', status: 'entwurf' });
    expect(r.offen.ohneFreigabe).toContain('D-02');
  });
  it('C-11: Entwurf ohne Registereintrag: Entwurfsnummer, Status, Eigner aus der AIMS-Verantwortung', async () => {
    const x = vollstaendigesProjekt();
    x.dokumente = [];
    x.organisation.aimsVerantwortlich = 'P-001';
    const { erstelleHelfer } = await import('../../src/vorlagen/kontext.ts');
    const h = erstelleHelfer({ u, modus: 'firma', form: 'dokument', projekt: x, kataloge, kitVersion: '' });
    const l = h.lenkung('D-06');
    expect(l.version).toBe('0.1');
    expect(JSON.stringify(l.freigabeDurch)).toContain('Entwurf');
    expect(JSON.stringify(l.eigner)).not.toContain('Name, Funktion');
  });
});

describe('C-03, C-06, C-09', () => {
  it('C-03: H82 meldet die unerreichbare Schwelle', () => {
    const p = vollstaendigesProjekt();
    const k = p.organisation.risikokriterien;
    k.wahrscheinlichkeit = [1, 2, 3].map((stufe) => ({ stufe, bezeichnung: `s${stufe}`, beschreibung: '' }));
    k.auswirkung = [...k.wahrscheinlichkeit];
    k.akzeptanzBis = 4;
    k.unannehmbarAb = 12;
    const ids = pruefeProjekt(regeln, { projekt: p, heute: '2027-02-15', controlIds42001: CONTROLS, aiActStand: '2026-07-27', kataloge }).map((b) => b.regel);
    expect(ids).toContain('H82');
  });
  it('C-06: Controls des übernommenen Risikos erscheinen als Vorschlag der SoA', () => {
    const p = leeresProjekt({ sprache: 'de', mitIsms: false, modulAiAct: false, projektId: 'p' });
    p.risiken.push({ id: 'R-001', art: 'risiko', controls: ['A.4.3'] } as never);
    expect(soaVorschlaege(p, [])).toEqual([{ id: 'A.4.3', grund: 'risiko', quellen: ['R-001'] }]);
    expect(readFileSync(join(REPO, 'src/app/ansichten/gefuehrt/KatalogVorschlaege.tsx'), 'utf8')).toContain('controls: v.controls');
  });
  it('C-09: Kurzprüfung ohne Vorbelegung, jede Frage Pflicht', async () => {
    const { neuerEintrag } = await import('../../src/app/logik/eintraege.ts');
    const p = leeresProjekt({ sprache: 'de', mitIsms: false, modulAiAct: false, projektId: 'p' });
    const e = neuerEintrag(p, 'folgenabschaetzungen', {}) as { triage: Record<string, unknown> };
    expect(e.triage['rechtspositionOderChancen']).toBeUndefined();
    const y = readFileSync(join(REPO, 'src/gefuehrt/seiten/E7.yaml'), 'utf8');
    expect(y).toMatch(/triage\.grosseReichweite, typ: janein, pflicht: true/);
    // Schema: Datei ohne Antworten ist gültig
    p.folgenabschaetzungen.push(e as never);
    (p.folgenabschaetzungen[0] as unknown as { kiSystem: string }).kiSystem = 'KI-001';
    expect(pruefeProjektDaten(JSON.parse(JSON.stringify(p))).ok).toBe(true);
  });
});

describe('D-05: Abläufe bleiben lesbar', () => {
  const q = { roh: () => undefined };
  const liste = prozessKatalog(kataloge).prozesse;
  const leer = leeresProjekt({ sprache: 'de', mitIsms: false, modulAiAct: false, projektId: 'p' });
  void leer;
  const uebersetzt = { roh: (k: string) => u.tOpt(k) };
  for (const kp of liste) {
    it(`${kp.id}: Beschriftungen im Bild, keine Linie durch eine fremde Form`, () => {
      const a = ablaufVon(uebersetzt as never, kp, undefined);
      const r = prozessRaster(a, q);
      const geo = ablaufGeometrie(r, { breite: SPALTE_PX * r.spalten + 24, zeilenHoehe: r.zeilenHoehe });
      for (const k of r.kanten) {
        const r1 = geo.knoten.get(k.von)!;
        const r2 = geo.knoten.get(k.nach)!;
        const p1 = seitenPunkt(r1, k.vonSeite);
        const p2 = seitenPunkt(r2, k.nachSeite);
        const andere = [...geo.knoten.entries()].filter(([id]) => id !== k.von && id !== k.nach).map(([, x]) => x);
        const weg = ablaufWeg(p1, k.vonSeite, p2, k.nachSeite, andere);
        for (let i = 1; i < weg.length; i++) for (const h of andere) expect(trifft(weg[i - 1]!, weg[i]!, h), `${k.von}->${k.nach}`).toBe(false);
        if (k.text) {
          const b = ablaufBeschriftung(k.text, k.vonSeite, p1, r1, geo.breite);
          const links = b.anker === 'end' ? b.x - b.breite : b.x;
          expect(links, `${k.von}: ${k.text}`).toBeGreaterThanOrEqual(0);
          expect(links + b.breite, `${k.von}: ${k.text}`).toBeLessThanOrEqual(geo.breite + b.breite * 0.3);
        }
      }
    });
  }
  it('Linke Spalte: langer Text steht unter der Form statt ausserhalb des Bildes', () => {
    const r = { x: 9, y: 50, b: 150, h: 40 };
    const b = ablaufBeschriftung('nein, andere Massnahme wählen', 'left', { x: 9, y: 70 }, r, 564);
    expect(b.anker).toBe('start');
    expect(b.y).toBeGreaterThan(r.y + r.h);
  });
  it('SVG: Ausweichweg wird gezeichnet, draw.io erhält Stützpunkte', () => {
    const a = { spalten: 2, zeilen: 3, knoten: [{ id: 'a', form: 'schritt' as const, text: 'A', spalte: 0, zeile: 0 }, { id: 'b', form: 'frage' as const, text: 'B', spalte: 0, zeile: 1 }, { id: 'c', form: 'schritt' as const, text: 'C', spalte: 0, zeile: 2 }], kanten: [{ von: 'a', vonSeite: 'bottom' as const, nach: 'c', nachSeite: 'top' as const }] };
    const geo = ablaufGeometrie(a);
    const weg = ablaufWeg(seitenPunkt(geo.knoten.get('a')!, 'bottom'), 'bottom', seitenPunkt(geo.knoten.get('c')!, 'top'), 'top', [geo.knoten.get('b')!]);
    expect(zuSvg(ablaufSzene(a, { titel: 't', beschreibung: 'b' }, { id: 'x' }))).toContain('data-kante="a-c"');
    for (let i = 1; i < weg.length; i++) expect(trifft(weg[i - 1]!, weg[i]!, geo.knoten.get('b')!)).toBe(false);
  });
  it('draw.io-Export bleibt wohlgeformt mit allen Prozessen', () => {
    const prozesse = liste.slice(0, 40).map((kp) => ({ id: kp.id, titel: kp.id, ablauf: ablaufVon(uebersetzt as never, kp, undefined), bahnTexte: {} }));
    const x = drawioExport(prozesse);
    expect(drawioSeitenLesen(x).length).toBe(prozesse.length);
  });
});

function trifft(a: { x: number; y: number }, b: { x: number; y: number }, r: Rechteck): boolean {
  const x1 = Math.min(a.x, b.x);
  const x2 = Math.max(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const y2 = Math.max(a.y, b.y);
  return x2 > r.x + 1 && x1 < r.x + r.b - 1 && y2 > r.y + 1 && y1 < r.y + r.h - 1;
}

describe('D: Regeln im Stil und in den Vorlagen', () => {
  const css = readFileSync(join(REPO, 'src/app/stil.css'), 'utf8');
  it('D-01: Suchliste auf dem Telefon an der Kopfbreite', () => {
    expect(css).toMatch(/\.seitenkopf \.suche-ergebnis \{ left: 0; right: 0; width: auto; \}/);
  });
  it('D-02: Titel bricht nicht mitten im Wort, der Kopf bricht als Ganzes', () => {
    expect(css).toMatch(/\.seitenkopf h1 \{[^}]*overflow-wrap: normal/);
    expect(css).toMatch(/\.sk-titel \{[^}]*flex: 1 1 auto/);
  });
  it('D-06, D-07: Leiste der Diagrammansicht bricht um, Name bleibt für Bildschirmleser', () => {
    const tpl = readFileSync(join(REPO, 'src/diagrammansicht/Diagrammansicht.html.tpl'), 'utf8');
    expect(tpl).toMatch(/\.gruppe \{ display: flex; flex-wrap: wrap/);
    expect(tpl).not.toMatch(/\.gruppe-titel \{ display: none/);
  });
  it('E-23: Kurzanleitungen erhalten beim Bau eine CSP', () => {
    expect(readFileSync(join(REPO, 'scripts/build.mts'), 'utf8')).toMatch(/setzeCsp\(readFileSync\(q/);
  });
  it('D-33: Bau warnt früh; Englische Inhaltstexte sind ausgelagert', () => {
    const s = readFileSync(join(REPO, 'scripts/app-bauen.mts'), 'utf8');
    expect(s).toContain("LAZY['daten-en']");
    expect(s).toContain('BUDGET - 100_000');
  });
});

describe('E-15: Datumsprüfung nur für Datumsfelder', () => {
  it('Listen von Kennungen unter einem Feldnamen wie «geaendert» sind kein Datum', () => {
    const p = JSON.parse(JSON.stringify(vollstaendigesProjekt())) as Projekt;
    p.bibliothek = { eintraege: [], abgleich: { am: '2026-10-01T08:00:00Z', geaendert: ['X-001'], fehlend: ['X-002'] } };
    expect(pruefeProjektDaten(p).ok).toBe(true);
  });
});

describe('D-05: Word', () => {
  it('Beschrifteter Rücksprung in der ersten Spalte läuft nach rechts: Der Text verschiebt die Zeichnung nicht aus der Seite', () => {
    const q = { roh: (k: string) => u.tOpt(k) };
    for (const kp of prozessKatalog(kataloge).prozesse) {
      const r = prozessRaster(ablaufVon(q as never, kp, undefined), { roh: () => undefined });
      const pos = new Map(r.knoten.map((k) => [k.id, k]));
      for (const k of r.kanten) if (k.text && pos.get(k.von)!.spalte === 0) expect(k.vonSeite, `${kp.id} ${k.von}`).not.toBe('left');
    }
  });
});

describe('E-20: Meldungen', () => {
  it('Grenzen und Pfade werden nicht roh gezeigt', () => {
    const f = readFileSync(join(REPO, 'src/app/worker/fehlertext.ts'), 'utf8');
    expect(f).toContain('ZIP entpackt zu gross');
    expect(f).toContain('Ungültiger Pfad');
  });
});
