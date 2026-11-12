// Runde 2, letzte Behebung: Regressionstests zu E2-07, E2-10, E-13, C2-08, C2-13, C2-17, C2-22, C2-23.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { stage1Bericht } from '../../src/app/ansichten/pruefung/stage1.ts';
import { projektReparieren, pruefeProjektDaten, schemaFehlerText } from '../../src/app/import/laden.ts';
import { seitenStatus, type Umfeld } from '../../src/app/logik/gefuehrt.ts';
import type { GefuehrtDaten } from '../../src/app/logik/gefuehrt-typen.ts';
import { RASTER_GRENZE_MS, rasterStufeErlaubt } from '../../src/app/logik/logo.ts';
import { gefuehrtSprung } from '../../src/app/logik/pruefsprung.ts';
import { musterDocx, type MusterTexte } from '../../src/app/logik/gestaltung-muster.ts';
import { begruendungNachfuehren, type EuaiaControl } from '../../src/app/logik/vorschlaege.ts';
import { kanaeleVereint, speicherKanal, tabWache, type KanalLike } from '../../src/app/speicher/zwei-tabs.ts';
import { DateiZuGrossFehler, OrdnerAblage, SPEICHER_MAX_BYTES, type DateiGriff, type OrdnerGriff } from '../../src/bibliothek/ablage.ts';
import { sha256, sha256Datei, Sha256Strom } from '../../src/bibliothek/pruefsumme.ts';
import { freigabeStand } from '../../src/bibliothek/sicht.ts';
import type { DocxDokument } from '../../src/generator/ir.ts';
import { KIT_VERSION } from '../../src/model/neu.ts';
import { MAX_SVG_EBENEN, SvgFehler, svgBereinigen } from '../../src/generator/svg.ts';
import { ablaufPlatz, type Rechteck } from '../../src/grafik/svg/ablauf.ts';
import { el, zuSvg } from '../../src/grafik/svg/szene.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { VORLAGEN } from '../../src/vorlagen/index.ts';
import { PRUEFUNGEN, pruefeProjekt, type Regel } from '../../src/regeln/pruefungen.ts';
import { CONTROLS_42001, vollstaendigesProjekt } from '../fixtures/projekt.ts';

const REPO = process.cwd();
const kataloge = ladeKataloge();
const u = erstelleUebersetzer('de', ladeTexte('de'));
const gefuehrt = JSON.parse(readFileSync(join(REPO, 'src/generiert/gefuehrt.json'), 'utf8')) as GefuehrtDaten;
const umfeld: Umfeld = { gefuehrt, controlIds42001: CONTROLS_42001, euaia: (kataloge['aiact_euaiaControls'] as { controls: EuaiaControl[] }).controls };
const regeln = (parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')) as { regeln: Regel[] }).regeln;
const beispiel = () => JSON.parse(readFileSync(join(REPO, 'src/beispiele/praezisionsteile.de.aims.json'), 'utf8')) as Projekt;
const neu = () => JSON.parse(JSON.stringify(vollstaendigesProjekt())) as Projekt;

describe('E2-07: Rastern in Stufen', () => {
  it('Die nächste Stufe beginnt nur, wenn sie nach der Messung unter der Grenze bleibt', () => {
    expect(rasterStufeErlaubt(5)).toBe(true);
    expect(rasterStufeErlaubt(RASTER_GRENZE_MS / 6)).toBe(true);
    expect(rasterStufeErlaubt(RASTER_GRENZE_MS / 6 + 1)).toBe(false);
    expect(rasterStufeErlaubt(700)).toBe(false);
  });
});

describe('E2-07: Ebenen', () => {
  const kopf = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">';
  const gruppen = (n: number) => `${kopf}${'<g opacity="0.9">'.repeat(n)}<rect width="9" height="9"/>${'</g>'.repeat(n)}</svg>`;
  it('Bis zur Grenze zulässig, darüber abgelehnt', () => {
    expect(() => svgBereinigen(gruppen(MAX_SVG_EBENEN))).not.toThrow();
    expect(() => svgBereinigen(gruppen(MAX_SVG_EBENEN + 1))).toThrow(SvgFehler);
  });
  it('Ebenen über Verweise zählen mit', () => {
    let d = '<clipPath id="c0"><rect width="9" height="9"/></clipPath>';
    for (let i = 1; i <= MAX_SVG_EBENEN + 1; i++) d += `<clipPath id="c${i}" clip-path="url(#c${i - 1})"><rect width="9" height="9"/></clipPath>`;
    expect(() => svgBereinigen(`${kopf}<defs>${d}</defs><rect width="9" height="9" clip-path="url(#c${MAX_SVG_EBENEN + 1})"/></svg>`)).toThrow(SvgFehler);
  });
});

describe('E2-10: Prüfsumme und Schreiben ohne Laden', () => {
  it('Sha256Strom rechnet wie Node, auch über beliebige Stücke und Blockgrenzen', () => {
    for (const n of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000, 100_003]) {
      const d = new Uint8Array(n).map((_, i) => (i * 31) & 255);
      const s = new Sha256Strom();
      for (let o = 0; o < n; o += 37 + (o % 91)) s.dazu(d.subarray(o, o + 37 + (o % 91)));
      expect(s.ende()).toBe(createHash('sha256').update(d).digest('hex'));
    }
  });
  it('sha256Datei über der Schwelle und darunter gibt dasselbe wie Web Crypto', async () => {
    const klein = new Uint8Array(1024).fill(7);
    expect(await sha256Datei(new Blob([klein]))).toBe(await sha256(klein));
    const gross = new Uint8Array(70 * 1024 * 1024).fill(3);
    expect(await sha256Datei(new Blob([gross]))).toBe(createHash('sha256').update(gross).digest('hex'));
  });
  const griff = (groesse: number, geschrieben: unknown[]): OrdnerGriff => {
    const datei: DateiGriff = {
      kind: 'file', name: 'v1.bin',
      getFile: async () => ({ size: groesse, lastModified: 1, arrayBuffer: async () => { throw new Error('darf nicht laden'); } }) as unknown as File,
      createWritable: async () => ({ write: async (d) => void geschrieben.push(d), close: async () => {} }),
    };
    const o: OrdnerGriff = {
      kind: 'directory', name: 'x',
      getDirectoryHandle: async () => o, getFileHandle: async () => datei, removeEntry: async () => {},
      // eslint-disable-next-line require-yield
      values: async function* () { return; },
    };
    return o;
  };
  it('Der Ordner bekommt die Datei selbst, nicht ihren Inhalt im Speicher', async () => {
    const geschrieben: unknown[] = [];
    const quelle = new Blob(['x']);
    const r = await new OrdnerAblage(griff(2_500_000_000, geschrieben)).schreibenStrom('Nachweise/v1.bin', quelle);
    expect(geschrieben).toEqual([quelle]);
    expect(r.groesse).toBe(2_500_000_000);
  });
  it('Ganz lesen über der Grenze wird abgelehnt, statt die Seite abzubrechen', async () => {
    const a = new OrdnerAblage(griff(SPEICHER_MAX_BYTES + 1, []));
    await expect(a.lesen('Nachweise/v1.bin')).rejects.toBeInstanceOf(DateiZuGrossFehler);
    await expect(a.blob('Nachweise/v1.bin')).resolves.toMatchObject({ size: SPEICHER_MAX_BYTES + 1 });
  });
});

describe('E-13: Tabs über localStorage', () => {
  const quelle = () => {
    const hoerer: ((k: string | null, w: string | null) => void)[] = [];
    const sender = (ich: number) => ({
      setItem: (k: string, w: string) => hoerer.forEach((h, i) => i !== ich && h(k, w)),
      horchen: (f: (k: string | null, w: string | null) => void) => { hoerer[ich] = f; return () => {}; },
    });
    return sender;
  };
  it('Zwei Tabs sehen sich ohne BroadcastChannel', () => {
    const s = quelle();
    const a: number[] = [];
    const b: number[] = [];
    const wa = tabWache(speicherKanal(s(0)), 'a', (n) => a.push(n));
    const wb = tabWache(speicherKanal(s(1)), 'b', (n) => b.push(n));
    wa.setze('p');
    wb.setze('p');
    expect(wa.andere()).toBe(1);
    expect(wb.andere()).toBe(1);
    wb.setze(null);
    expect(wa.andere()).toBe(0);
  });
  it('Gleiche Nachricht über zwei Wege zählt einen Tab einmal', () => {
    const s = quelle();
    const s2 = quelle();
    const kanal = (i: number): KanalLike => kanaeleVereint([speicherKanal(s(i)), speicherKanal(s2(i))]);
    const wa = tabWache(kanal(0), 'a', () => {});
    const wb = tabWache(kanal(1), 'b', () => {});
    wa.setze('p');
    wb.setze('p');
    expect(wa.andere()).toBe(1);
  });
  it('Fremde Inhalte im Schlüssel und ein voller Speicher stören nicht', () => {
    let f: ((k: string | null, w: string | null) => void) | undefined;
    const k = speicherKanal({ setItem: () => { throw new Error('voll'); }, horchen: (h) => { f = h; return () => {}; } });
    const gesehen: unknown[] = [];
    k.addEventListener('message', (e) => gesehen.push(e.data));
    expect(() => k.postMessage({ art: 'hallo', tab: 'x', schluessel: null })).not.toThrow();
    f!('aims-manager-tabs', 'kein json');
    f!('anderer', '{}');
    expect(gesehen).toEqual([]);
  });
});

describe('C2-08: Dokumentkopf D-03 mit ISMS', () => {
  /** Wie im Bericht C: Leitlinie im Guide freigegeben, im Register nur das Ergänzungsblatt D-03-EB mit anderer Person und anderem Datum */
  const mitIsms = () => {
    const p = neu();
    p.meta.mitIsms = true;
    p.dokumente = p.dokumente.filter((d) => !d.id.startsWith('D-03'));
    p.dokumente.push({ id: 'D-03-EB', version: '1.0', status: 'freigegeben', freigabe: { von: 'P-002', am: '2026-11-02' }, ablageort: '', giltFuerIsms: true });
    p.organisation.leitlinie.freigabe = { von: 'P-001', am: '2026-12-15' };
    return p;
  };
  const opt = (_p: Projekt) => ({ u, umfeld, kataloge, regeln, befunde: [], heute: '2027-01-15' });
  it('Kopf, Bericht und Bibliothek nennen die Freigabe der Leitlinie, nicht das Ergänzungsblatt', () => {
    const p = mitIsms();
    const name = p.personen.find((x) => x.id === 'P-001')!.name;
    const ir = VORLAGEN['D-03']!({ u, modus: 'firma', form: 'dokument', projekt: p, kataloge, kitVersion: '1.0.0' }) as DocxDokument;
    expect(JSON.stringify(ir.lenkung.freigabeDurch)).toContain(name);
    expect(JSON.stringify(ir.lenkung.datum)).toContain('15.12.2026');
    expect(freigabeStand(p, 'D-03')).toMatchObject({ status: 'freigegeben', freigabe: { von: 'P-001', am: '2026-12-15' }, quelle: 'projekt' });
    const zeile = stage1Bericht(p, opt(p)).dokumente.find((d) => d.id === 'D-03');
    expect(zeile?.freigabe).toMatchObject({ von: 'P-001', am: '2026-12-15' });
  });
  it('Ergänzungsblatt selbst behält seine eigene Freigabe', () => {
    expect(freigabeStand(mitIsms(), 'D-03-EB')).toMatchObject({ freigabe: { von: 'P-002', am: '2026-11-02' }, quelle: 'register' });
  });
  it('Ohne Freigabe der Leitlinie heisst die Zeile D-03-EB, die Daten stehen nicht unter dem Titel der Leitlinie', () => {
    const p = mitIsms();
    delete p.organisation.leitlinie.freigabe;
    const zeilen = stage1Bericht(p, opt(p)).dokumente;
    expect(zeilen.find((d) => d.id === 'D-03')).toBeUndefined();
    expect(zeilen.find((d) => d.id === 'D-03-EB')?.freigabe).toMatchObject({ von: 'P-002' });
  });
});

describe('C2-13: Klartext der Prüfung', () => {
  const felder = { personen: 'Personen', schemaVersion: 'Version des Dateiformats', termin: 'Termin' };
  const fmt = undefined;
  it('Fehlende Angaben auf oberster Ebene nennen den Namen, nicht den Schlüssel', () => {
    const p = neu() as unknown as Record<string, unknown>;
    delete p['personen'];
    delete p['schemaVersion'];
    const r = pruefeProjektDaten(p);
    expect(r.ok).toBe(false);
    const text = r.ok ? '' : schemaFehlerText(r.fehler, 8, fmt, p).join('\n');
    expect(text).toContain(`«${felder.personen}»`);
    expect(text).toContain(`«${felder.schemaVersion}»`);
    expect(text).not.toContain('«schemaVersion»');
  });
  it('Datei ohne Personen bleibt reparierbar, mit Hinweis auf das, was geändert wird', () => {
    const p = neu() as unknown as Record<string, unknown>;
    delete p['personen'];
    const r = projektReparieren(p);
    expect(r?.projekt.personen).toBeDefined();
    expect(r?.aenderungen.join('\n')).toContain('Personen');
  });
  it('Ort in einer Liste heisst «Massnahme M-001, Termin»', () => {
    const p = beispiel();
    (p.massnahmen[0] as unknown as Record<string, unknown>)['termin'] = '2026-13-45';
    const r = pruefeProjektDaten(p);
    expect(r.ok ? '' : schemaFehlerText(r.fehler, 8, fmt, p)[0]).toContain(`Massnahme ${p.massnahmen[0]!.id}, Termin`);
  });
});

describe('C2-17: Keine unfertigen Sätze in der Prüfung', () => {
  const titel = (id: string) => (parse(readFileSync(join(REPO, 'src/i18n/de/regeln.yaml'), 'utf8')) as Record<string, { titel: string; erklaerung: string }>)[id]!;
  it('H44 hat auch bei KI-System ohne Namen ein Subjekt (Rückfall auf die Kennung in der Anzeige)', () => {
    const p = neu();
    p.kiSysteme[0]!.name = '';
    for (const b of pruefeProjekt(regeln, { projekt: p, heute: '2026-11-03', controlIds42001: CONTROLS_42001, aiActStand: '2026-07-27', kataloge })) expect(b.name || b.id || b.regel).not.toBe('');
  });
  it('H20 und H21 erklären die Klammer', () => {
    expect(titel('H20').titel).toBe('Behandlungsplan älter als sein jüngster Eintrag: {name}');
    expect(titel('H20').erklaerung).toMatch(/^In Klammern/);
    expect(titel('H21').erklaerung).toMatch(/^In Klammern/);
  });
  it('H85 nennt Kennung und Titel', () => {
    const p = beispiel();
    const r = p.risiken[0]!;
    r.status = 'behandelt';
    p.massnahmen[0]!.status = 'offen';
    r.massnahmen = [p.massnahmen[0]!.id];
    expect(PRUEFUNGEN['H85']!({ projekt: p, heute: '2026-11-03', controlIds42001: CONTROLS_42001, aiActStand: '2026-07-27', kataloge })[0]?.name).toContain(r.id);
  });
});

describe('C2-22: Leseseiten und Zählung', () => {
  it('Leseseite blockiert nicht: Etappe begonnen, Einführung nicht besucht', () => {
    const p = neu();
    const etappe = gefuehrt.etappen.etappen.find((x) => x.seiten.some((id) => gefuehrt.seiten.find((y) => y.id === id)?.typ === 'info'))!;
    const info = etappe.seiten.find((id) => gefuehrt.seiten.find((y) => y.id === id)?.typ === 'info')!;
    const andere = etappe.seiten.find((id) => id !== info)!;
    const def = gefuehrt.seiten.find((y) => y.id === info)!;
    expect(seitenStatus(def, etappe.id, p, umfeld)).toBe('offen');
    p.meta.gefuehrt.etappen[etappe.id] = { besucht: [andere], spaeter: [] } as never;
    expect(seitenStatus(def, etappe.id, p, umfeld)).toBe('erledigt');
  });
  it('Text auf der Einstiegsseite zählt wie der Fortschritt', () => {
    const q = readFileSync(join(REPO, 'src/app/ansichten/gefuehrt/Gefuehrt.tsx'), 'utf8');
    expect(q).toContain("anzahl: etappenFortschritt(etappe, p, umfeld.value).gesamt");
  });
});

describe('C2-24: Muster passt zur App', () => {
  it('Matrix 4 mal 4 und Version 0.1 im Entwurf', () => {
    const t = new Proxy({}, { get: (_, k) => String(k) }) as unknown as MusterTexte;
    const ir = JSON.stringify(musterDocx(neu(), 'de', t));
    expect(ir).toContain('"spalten":["1","2","3","4"]');
    expect(ir).toContain('"version":"0.1"');
    expect(ir).not.toContain('"version":"1.0"');
    const zeilen = (JSON.parse(ir) as { bloecke: { typ: string; zeilen?: unknown[] }[] }).bloecke.find((b) => b.typ === 'matrix')?.zeilen;
    expect(zeilen).toHaveLength(4);
  });
});

describe('C2-26: Sprung trifft den Eintrag', () => {
  it('F20 springt auf die Partei, wenn die Liste sie führt', () => {
    const p = beispiel();
    const id = p.parteien[0]!.id;
    expect(gefuehrtSprung({ regel: 'F20', id }, p, gefuehrt)).toMatchObject({ art: 'gefuehrt', seite: 'E2-parteien', eintrag: id });
  });
});

describe('F-17: Beschriftungen im Ablauf', () => {
  const lage = (x: number, y: number) => ({ x, y, anker: 'start' as const, breite: 20 });
  it('Zweite Beschriftung an derselben Stelle weicht aus und bleibt im Bild', () => {
    const belegt: Rechteck[] = [];
    const a = ablaufPlatz(lage(50, 50), belegt, [], 300);
    const b = ablaufPlatz(lage(52, 52), belegt, [], 300);
    expect(a).toMatchObject({ x: 50, y: 50 });
    expect(belegt).toHaveLength(2);
    const [k1, k2] = belegt as [Rechteck, Rechteck];
    expect(k1.y + k1.h <= k2.y || k2.y + k2.h <= k1.y || k1.x + k1.b <= k2.x || k2.x + k2.b <= k1.x).toBe(true);
    expect(b.x).toBeGreaterThanOrEqual(2);
  });
  it('Auch Formen werden nicht verdeckt', () => {
    const r = ablaufPlatz(lage(50, 50), [], [{ x: 40, y: 44, b: 60, h: 10 }], 300);
    expect(r).toMatchObject({ x: 50, y: 38 });
  });
});

describe('F-11: Abbildungen im Leitfaden', () => {
  const pdf = join(REPO, `dist/kit/KMU-CIO_ISO42001-Starter-Kit_v${KIT_VERSION}/DE/00_Leitfaden/Leitfaden_Minimal-Viable-AIMS.pdf`);
  const quelle = readFileSync(join(REPO, 'scripts/leitfaden.mts'), 'utf8');
  it('Austausch der Schrift trifft die maskierte Form, die zuSvg tatsächlich schreibt', () => {
    expect(zuSvg(el('svg', {}), { stil: true, palette: 'hell' })).toContain('&#39;Archivo Variable&#39;,Archivo');
    expect(quelle).toContain('replaceAll(`&#39;Archivo Variable&#39;,Archivo`');
  });
  // Ohne gebauten Leitfaden übersprungen; nach `build:kit` (CI-Schritt «Leitfaden prüfen», KIT_GEBAUT=1) darf er nicht fehlen
  it.skipIf(!existsSync(pdf) && !process.env['KIT_GEBAUT'])('Gebauter Leitfaden enthält keine Type-3-Schrift', () => {
    expect(existsSync(pdf), `Leitfaden fehlt: ${pdf}`).toBe(true);
    expect(execFileSync('pdffonts', [pdf], { encoding: 'utf8' })).not.toContain('Type 3');
  });
});

describe('C2-23: Begründung folgt späteren Quellen', () => {
  const vorlage = 'Behandelt die Risiken {quellen}.';
  it('Vorschlagstext wird nachgeführt', () => {
    expect(begruendungNachfuehren('Behandelt die Risiken R-004.', vorlage, ['R-001', 'R-004'])).toBe('Behandelt die Risiken R-001, R-004.');
  });
  it('Gleicher Stand und eigener Text bleiben', () => {
    expect(begruendungNachfuehren('Behandelt die Risiken R-004.', vorlage, ['R-004'])).toBeUndefined();
    expect(begruendungNachfuehren('Behandelt die Risiken R-004 und unsere Vorgabe.', vorlage, ['R-001'])).toBeUndefined();
    expect(begruendungNachfuehren('Eigene Begründung.', vorlage, ['R-001'])).toBeUndefined();
  });
});
