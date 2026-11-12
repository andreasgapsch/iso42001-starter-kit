// AF-015 (QK-07): Alle Fehlertexte laufen über eine Abbildung auf Ursache und nächsten Schritt; Rohtexte der Laufzeit erreichen
// die Oberfläche nicht. Dazu die Tore G38 (Rohtexte) und G39 (Testebenen, AF-049) mit je einer Gegenprobe.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { pruefeQuellen, pruefe as pruefeRohtexte } from '../../scripts/pruefen/rohtexte.mts';
import { quelldateien } from '../../scripts/pruefen/ratsche.mts';
import { bewerteAbdeckung, bewerteListe, musterRegex, type Testebenen } from '../../scripts/pruefen/testebenen.mts';
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
const { fehlerVerstaendlich, fehlerAbbildung, technikText, KlartextFehler } = await import('../../src/app/worker/fehlertext.ts');
const { fehler, meldeFehler, fehlerbericht } = await import('../../src/app/Fehler.tsx');
const { ladeProjektText, schemaFehlerText } = await import('../../src/app/import/laden.ts');
const { ladeKiErgebnis } = await import('../../src/app/import/ki-ergebnis.ts');

/** Rohtexte aus Runde 2 (E2-18) und weitere der Bibliotheken und Browser */
const ROHTEXTE = [
  'Self Reference',
  'The string to be decoded is not correctly encoded.',
  "Failed to execute 'structuredClone' on 'Window': #<Object> could not be cloned.",
  "Cannot set properties of undefined (setting 'sheetNo')",
  'Maximum call stack size exceeded',
  'Invalid string length',
  'Unexpected token } in JSON at position 12',
  'Unexpected end of JSON input',
  'invalid zip data',
  'Array buffer allocation failed',
  'The quota has been exceeded.',
  'x.map is not a function',
  "Cannot read properties of null (reading 'name')",
];

describe('AF-015: Abbildung der Rohtexte', () => {
  uiSprache.value = 'de';
  it.each(ROHTEXTE)('«%s» wird auf Ursache und nächsten Schritt abgebildet, der Rohtext erscheint nicht', (roh) => {
    for (const e of [new Error(roh), new TypeError(roh), roh]) {
      const m = fehlerVerstaendlich(e);
      expect(fehlerAbbildung(e), 'bekannte Ursache').toBeDefined();
      expect(m).not.toContain(roh);
      expect(m).not.toMatch(/undefined|TypeError|Unexpected|position \d/);
      expect(m.length).toBeGreaterThan(40);
    }
  });
  it('unbekannte Fehler: allgemeiner Text mit nächstem Schritt, nie der Rohtext; gilt auch in EN', () => {
    const roh = 'Qxz kryptischer Zufallstext 7731';
    expect(fehlerAbbildung(new Error(roh))).toBeUndefined();
    expect(fehlerVerstaendlich(new Error(roh))).toBe(t('fehler.unbekannt'));
    expect(fehlerVerstaendlich(roh)).not.toContain('7731');
    expect(fehlerVerstaendlich(null)).toBe(t('fehler.unbekannt'));
    uiSprache.value = 'en';
    expect(fehlerVerstaendlich(new Error(roh))).toMatch(/Try again/);
    expect(fehlerVerstaendlich(new Error(roh))).not.toContain('7731');
    expect(fehlerVerstaendlich(new Error('storage quota exceeded'))).toMatch(/storage space/);
    uiSprache.value = 'de';
  });
  it('eigene Fehlerklassen und Browserobjekte: ZeitFehler, QuotaExceededError, DOMException ohne Error-Basis', () => {
    const zeit = Object.assign(new Error('roh'), { name: 'ZeitFehler' });
    expect(fehlerVerstaendlich(zeit)).toBe(t('fehler.zeitgrenze'));
    expect(fehlerVerstaendlich(Object.assign(new Error('x'), { name: 'QuotaExceededError' }))).toBe(t('fehler.speicher_voll'));
    expect(fehlerVerstaendlich({ name: 'NotAllowedError', message: 'roh' })).toBe(t('fehler.schreibrecht'));
    expect(fehlerVerstaendlich({ name: 'NotFoundError', message: 'roh' })).toBe(t('fehler.nicht_gefunden'));
  });
  it('technikText liefert den Rohtext für Bericht und Status, auch für Objekte und Zyklen', () => {
    expect(technikText(new Error('roh'))).toBe('roh');
    expect(technikText(new Error(''))).toBe('Error');
    expect(technikText('text')).toBe('text');
    expect(technikText({ a: 1 })).toBe('{"a":1}');
    const zyklus: Record<string, unknown> = {};
    zyklus['selbst'] = zyklus;
    expect(technikText(zyklus)).toBe('[object Object]');
  });
  it('Fehlerbericht: der Rohtext steht nur in der Technikzeile, der Dialog zeigt die Ursache', () => {
    meldeFehler(new Error("Cannot set properties of undefined (setting 'sheetNo')"));
    expect(fehler.value!.meldung).toContain('sheetNo');
    expect(fehlerbericht(fehler.value!)).toContain('Fehler: Cannot set properties');
    expect(fehlerAbbildung(fehler.value!.meldung)).toBe(`${t('fehler.datei_defekt')} ${t('fehler.schritt_datei')}`);
    meldeFehler({ code: 7 });
    expect(fehler.value!.meldung).toBe('{"code":7}');
    fehler.value = null;
  });
  it('Ladefehler und KI-Ergebnis: Ajv-Texte und Parser-Rohtexte stehen nicht in den Details der Meldung', () => {
    const r = ladeKiErgebnis('{ "meta": { , }');
    expect(r).toMatchObject({ ok: false, art: 'kein-json', details: [] });
    expect((r as { technik?: string }).technik).toBeTruthy();
    const p = ladeProjektText('{ kaputt');
    expect(p).toMatchObject({ ok: false, art: 'kein-json', details: [] });
    const zeilen = schemaFehlerText([{ instancePath: '/meta/x', keyword: 'minimum', message: 'must be >= 1', params: {} }]);
    expect(zeilen.join(' ')).not.toContain('must be');
    expect(zeilen[0]).toContain('meta.x');
  });
});

describe('G38 Rohtexte (Quellprüfung src/app)', () => {
  const q = (text: string, pfad = 'src/app/x.ts') => pruefeQuellen([{ pfad, text }]);
  it('der Bestand ist sauber: direkte Ausgabe von Laufzeittexten in src/app 0', async () => {
    expect(await pruefeRohtexte()).toEqual([]);
  });
  it.each([
    "melde(e instanceof Error ? e.message : String(e), 'fehler');",
    'setFehler(err.message);',
    'const m = `${String(x)}`;',
    'throw new Error(JSON.stringify(error));',
    'ziel.textContent = reason.message;',
    'melde(`${(e as Error).message}`);',
    'const f = e as Error; melde(f.message);',
    'throw new MeinFehler(q.message);',
    'try { x(); } catch (boese) { melde(`Fehler: ${boese}`); }',
    'try { x(); } catch (boese) { melde(String(boese)); }',
    "try { x(); } catch (boese) { melde('Fehler: ' + boese); }",
    'p.catch((fehlschlag) => melde(JSON.stringify(fehlschlag)));',
    'p.then(ok, (grund: unknown) => melde(`${grund}`));',
  ])('Gegenprobe: «%s» bricht', (zeile) => {
    expect(q(zeile)).toHaveLength(1);
  });
  it('technikText in einer Ausgabe bricht, in einer Zuweisung nicht', () => {
    expect(q("melde(technikText(e), 'fehler');")).toHaveLength(1);
    expect(q('const m = technikText(x);')).toEqual([]);
    expect(q("import { technikText } from './technik.ts';")).toEqual([]);
  });
  it('Vermerk roh-ok, Kommentare und die Abbildung selbst sind ausgenommen', () => {
    expect(q('detail: e.message /* roh-ok: eigener Fachtext */')).toEqual([]);
    expect(q('// früher: e.message')).toEqual([]);
    expect(q('const roh = e.message;', 'src/app/worker/fehlertext.ts')).toEqual([]);
    expect(q('const roh = e.message;', 'src/app/worker/einstieg.ts')).toEqual([]);
  });
});

describe('G39 Testebenen und Kernlogik (AF-049, AF-048)', () => {
  const basis: Testebenen = {
    schwellen: { kernZeilen: 90, kernVerzweigungen: 80, untergrenze: 60 },
    kern: ['src/a/k.ts'],
    ausnahmen: [],
    module: [{ muster: 'src/a/**', ebenen: ['unit'], tests: ['tests/unit/x.test.ts'] }],
  };
  const quellen = ['src/a/k.ts', 'src/a/b/c.ts'];
  const da = () => true;
  it('der Bestand im Repo: Module ohne Testebene 0', async () => {
    // Modulliste und Testdateien; die Messung (Kernlogik, Untergrenze) braucht einen frischen Bericht von `npm run test:cov`
    const t = json('tests/testebenen.json') as Testebenen;
    expect(bewerteListe(t, quelldateien(), (p) => existsSync(join(REPO, p)))).toEqual([]);
    expect(t.kern).toHaveLength(5);
  });
  it('Muster: ** über Ebenen, * innerhalb eines Ordners', () => {
    expect(musterRegex('src/a/**').test('src/a/b/c.ts')).toBe(true);
    expect(musterRegex('src/a/*').test('src/a/b/c.ts')).toBe(false);
    expect(musterRegex('src/a/*').test('src/a/c.ts')).toBe(true);
  });
  it('Gegenprobe: Modul ohne Eintrag, toter Eintrag, fehlender Test, falsche Ebene und Kern ohne unit brechen', () => {
    expect(bewerteListe(basis, quellen, da)).toEqual([]);
    expect(bewerteListe(basis, [...quellen, 'src/z/neu.ts'], da).map((b) => b.datei)).toEqual(['src/z/neu.ts']);
    expect(bewerteListe({ ...basis, module: [...basis.module, { muster: 'src/q/**', ebenen: ['unit'], tests: ['tests/unit/x.test.ts'] }] }, quellen, da)).toHaveLength(1);
    expect(bewerteListe(basis, quellen, () => false)).toHaveLength(1);
    expect(bewerteListe({ ...basis, module: [{ muster: 'src/a/**', ebenen: ['e2e'], tests: ['tests/unit/x.test.ts'] }] }, quellen, da).length).toBeGreaterThan(0);
    expect(bewerteListe({ ...basis, module: [{ muster: 'src/a/**', ebenen: [], tests: [] }] }, quellen, da).length).toBeGreaterThan(0);
    expect(bewerteListe({ ...basis, module: [{ muster: 'src/a/**', ebenen: ['e2e'], tests: ['tests/e2e/x.ts'] }] }, quellen, da).map((b) => b.meldung).join()).toContain('ohne Ebene unit');
    expect(bewerteListe({ ...basis, kern: ['src/a/fehlt.ts'] }, quellen, da).length).toBeGreaterThan(0);
  });
  it('erster passender Eintrag gilt: ein verdeckter Eintrag bricht, Besonderes vor Allgemeinem gilt', () => {
    const e2e = { muster: 'src/a/b/**', ebenen: ['e2e'], tests: ['tests/e2e/x.ts'] } as const;
    const verdeckt = { ...basis, module: [...basis.module, { ...e2e, ebenen: [...e2e.ebenen] }] } as Testebenen;
    expect(bewerteListe(verdeckt, quellen, da).map((x) => x.meldung).join()).toContain('verdeckt');
    const besser = { ...basis, module: [{ ...e2e, ebenen: [...e2e.ebenen] }, ...basis.module] } as Testebenen;
    expect(bewerteListe(besser, quellen, da)).toEqual([]);
    // das Modul mit dem besonderen Eintrag gilt als reines Browsermodul, das allgemeine nicht
    const niedrig = { 'src/a/k.ts': { lines: { pct: 95 }, branches: { pct: 85 } }, 'src/a/b/c.ts': { lines: { pct: 10 }, branches: { pct: 0 } } };
    expect(bewerteAbdeckung(besser, niedrig, quellen)).toEqual([]);
  });
  it('Ausnahmen gelten je Modul mit genauem Pfad: Muster, überholte und zu breite Ausnahmen brechen', () => {
    const ok = { 'src/a/k.ts': { lines: { pct: 95 }, branches: { pct: 85 } }, 'src/a/b/c.ts': { lines: { pct: 70 }, branches: { pct: 50 } } };
    const grund = 'wird nur im Browser ausgeführt';
    expect(bewerteAbdeckung({ ...basis, ausnahmen: [{ datei: 'src/a/**', grund }] }, ok, quellen).map((x) => x.meldung).join()).toContain('genauer Pfad');
    expect(bewerteAbdeckung({ ...basis, ausnahmen: [{ datei: 'src/a/b/c.ts', grund }] }, ok, quellen).map((x) => x.meldung).join()).toContain('zu breit oder überholt');
  });
  it('Abdeckung: Kernlogik unter 90 % Zeilen oder 80 % Verzweigungen bricht; Modul unter 60 % braucht eine Begründung', () => {
    const ok = { 'src/a/k.ts': { lines: { pct: 95 }, branches: { pct: 85 } }, 'src/a/b/c.ts': { lines: { pct: 70 }, branches: { pct: 50 } } };
    expect(bewerteAbdeckung(basis, ok, quellen)).toEqual([]);
    expect(bewerteAbdeckung(basis, { ...ok, 'src/a/k.ts': { lines: { pct: 89.9 }, branches: { pct: 85 } } }, quellen)).toHaveLength(1);
    expect(bewerteAbdeckung(basis, { ...ok, 'src/a/k.ts': { lines: { pct: 95 }, branches: { pct: 79 } } }, quellen)).toHaveLength(1);
    expect(bewerteAbdeckung(basis, { 'src/a/b/c.ts': ok['src/a/b/c.ts'] }, quellen)).toHaveLength(1);
    const niedrig = { ...ok, 'src/a/b/c.ts': { lines: { pct: 10 }, branches: { pct: 0 } } };
    expect(bewerteAbdeckung(basis, niedrig, quellen)).toHaveLength(1);
    const mitGrund = { ...basis, ausnahmen: [{ datei: 'src/a/b/c.ts', grund: 'wird nur im Browser ausgeführt' }] };
    expect(bewerteAbdeckung(mitGrund, niedrig, quellen)).toEqual([]);
    expect(bewerteAbdeckung({ ...basis, ausnahmen: [{ datei: 'src/a/b/c.ts', grund: 'zu kurz' }] }, niedrig, quellen)).toHaveLength(1);
    expect(bewerteAbdeckung(mitGrund, ok, quellen)).toHaveLength(1);
    // nur Browser-Ebene: von der Unit-Messung nicht erfasst
    const browser = { ...basis, module: [{ muster: 'src/a/**', ebenen: ['unit'], tests: ['tests/unit/x.test.ts'] }, { muster: 'src/a/b/**', ebenen: ['e2e'], tests: ['tests/e2e/x.ts'] }] } as Testebenen;
    expect(bewerteAbdeckung(browser, niedrig, quellen)).toHaveLength(1);
    const nurE2e = { ...basis, kern: [], module: [{ muster: 'src/a/**', ebenen: ['e2e'], tests: ['tests/e2e/x.ts'] }] } as Testebenen;
    expect(bewerteAbdeckung(nurE2e, niedrig, quellen)).toEqual([]);
  });
});

describe('DE und EN: die englische Oberfläche zeigt keinen deutschen Fachtext', () => {
  const DEUTSCH = /[äöüÄÖÜß]|\b(?:Datei|nicht|und|ist|ungültig|neuer|geschlossen|Entitäten|Verweis|Endtag|Wurzel|Element)\b/;
  it('Ladefehler aller Arten (Start-Ansicht) in EN', async () => {
    const { ladeFehlerText } = await import('../../src/app/ansichten/start/Start.tsx');
    const { LadeFehler } = await import('../../src/app/zustand/store.ts');
    const arten = ['leer', 'zu-gross', 'kein-json', 'kein-projekt', 'keine-version', 'zu-neu', 'luecke', 'schema'] as const;
    const echt: Record<string, { ok: boolean; art?: string; details: string[] }> = {
      'zu-neu': ladeProjektText(JSON.stringify({ schemaVersion: 999, meta: {} })) as never,
      'keine-version': ladeProjektText(JSON.stringify({ meta: {} })) as never,
      'kein-json': ladeProjektText('{ kaputt') as never,
      leer: ladeProjektText('') as never,
      'kein-projekt': ladeProjektText('[]') as never,
    };
    for (const [art, r] of Object.entries(echt)) {
      expect(r.art, art).toBe(art);
      expect(r.details, `${art}: Details sind Klartext oder leer`).toEqual([]);
    }
    const kaputt = JSON.parse(JSON.stringify((await import('../fixtures/projekt.ts')).vollstaendigesProjekt()));
    kaputt.kiSysteme[0].name = 'x'.repeat(600);
    const schema = ladeProjektText(JSON.stringify(kaputt));
    expect(schema).toMatchObject({ ok: false, art: 'schema' });
    uiSprache.value = 'en';
    try {
      for (const art of arten) {
        const f = art === 'schema' ? new LadeFehler('schema', [], (schema as unknown as { schema: never[] }).schema) : new LadeFehler(art, echt[art]?.details ?? []);
        const text = ladeFehlerText(f);
        expect(text, `${art}: ${text}`).not.toMatch(DEUTSCH);
        expect(text.length).toBeGreaterThan(10);
      }
    } finally {
      uiSprache.value = 'de';
    }
  });
  it('SVG-Fehler: jeder Fall liefert einen Code, dessen Text es in DE und EN gibt; kein Fachtext im Detail', async () => {
    const { logoAufgabe } = await import('../../src/app/worker/logo.ts');
    const faelle = ['<svg><!-- offen</svg>', '<!DOCTYPE svg [<!ENTITY a "aaaa">]><svg>&a;</svg>', '<html/>', `<svg>${'<g>'.repeat(300)}</svg>`, '<svg><g></svg>'];
    const codes = new Set<string>();
    for (const f of faelle) {
      const r = logoAufgabe({ aufgabe: 'svg', text: f });
      expect(r.ok).toBe(false);
      const detail = (r as { detail?: string }).detail!;
      expect(['aufbau', 'entitaeten', 'aufwand', 'verweis']).toContain(detail);
      codes.add(detail);
    }
    expect(codes.size).toBeGreaterThanOrEqual(3);
    for (const sprache of ['de', 'en'] as const) {
      uiSprache.value = sprache;
      for (const c of ['aufbau', 'entitaeten', 'aufwand', 'verweis']) {
        const text = t(`gestaltung.logo.svg_code.${c}`);
        expect(text).not.toBe(`gestaltung.logo.svg_code.${c}`);
        if (sprache === 'en') expect(text).not.toMatch(DEUTSCH);
      }
      if (sprache === 'en') expect(t('gestaltung.logo.fehler.svg-ungueltig', { detail: t('gestaltung.logo.svg_code.entitaeten') })).not.toMatch(DEUTSCH);
    }
    uiSprache.value = 'de';
  });
  it('Fehlerdialog: der Rohtext steht nur in der eingeklappten Technikzeile', () => {
    const q = readFileSync(join(REPO, 'src/app/Fehler.tsx'), 'utf8');
    expect(q).toMatch(/<details[^>]*>\s*<summary>[\s\S]*<pre class="fehlerbericht">/);
  });
});

describe('Fehler.tsx: Pfade im Bericht, globale Fehlerbehandlung', () => {
  it('stapelOhnePfad kürzt Adressen und Windows-Pfade auf den Dateinamen', async () => {
    const { stapelOhnePfad } = await import('../../src/app/Fehler.tsx');
    expect(stapelOhnePfad('at f (file:///home/anna/Projekte/app/main.js:10:5)')).toBe('at f (main.js:10:5)');
    expect(stapelOhnePfad('at g (https://x.example/assets/chunk-1.js:3:1)')).toBe('at g (chunk-1.js:3:1)');
    expect(stapelOhnePfad('Fehler in C:\\Users\\Anna\\Dokumente\\a.json')).toBe('Fehler in a.json');
  });
  it('installiereFehlerbehandlung: Fehler und abgelehnte Zusagen erscheinen im Dialog, Rauschen nicht', async () => {
    const { installiereFehlerbehandlung, setzeVersion } = await import('../../src/app/Fehler.tsx');
    const horcher: Record<string, (e: unknown) => void> = {};
    vi.stubGlobal('addEventListener', (t: string, f: (e: unknown) => void) => (horcher[t] = f));
    vi.stubGlobal('navigator', { userAgent: 'TestBrowser' });
    vi.stubGlobal('location', { hash: '#/formular/risiken/R-001' });
    installiereFehlerbehandlung();
    setzeVersion('9.9.9');
    const ereignis = (error: unknown, message = '') => ({ error, message, preventDefault: vi.fn() });
    fehler.value = null;
    horcher['error']!(ereignis(undefined, 'Script error'));
    horcher['error']!(ereignis(new Error('x'), 'ResizeObserver loop limit exceeded'));
    expect(fehler.value).toBeNull();
    const e1 = ereignis(new Error('Maximum call stack size exceeded'));
    horcher['error']!(e1);
    expect(e1.preventDefault).toHaveBeenCalled();
    expect(fehler.value!.meldung).toBe('Maximum call stack size exceeded');
    const bericht = fehlerbericht(fehler.value!);
    expect(bericht).toContain('AIMS-Manager 9.9.9');
    expect(bericht).toContain('Browser: TestBrowser');
    expect(bericht).toContain('Ansicht: #/formular/risiken/…');
    fehler.value = null;
    const e2 = { reason: 'abgelehnt 55', preventDefault: vi.fn() };
    horcher['unhandledrejection']!(e2);
    expect(e2.preventDefault).toHaveBeenCalled();
    expect(fehler.value!.meldung).toBe('abgelehnt 55');
    fehler.value = null;
    vi.unstubAllGlobals();
  });
});

describe('Eigene Klartexte der App (P5, Rückschritt E2-09)', () => {
  it('KlartextFehler geht unverändert durch; derselbe Text als gewöhnlicher Fehler wird allgemein gemeldet', () => {
    uiSprache.value = 'de';
    const text = 'Die Datei «video.bin» ist grösser als 512 MB und wurde nicht gelesen.';
    expect(fehlerVerstaendlich(new KlartextFehler(text))).toBe(text);
    expect(fehlerAbbildung(new KlartextFehler(text))).toBe(text);
    expect(fehlerVerstaendlich(new Error(text))).toBe(t('fehler.unbekannt'));
  });

  it('Rohtexte fremder Quellen bleiben abgebildet, auch wenn sie wie ein Klartext aussehen', () => {
    uiSprache.value = 'de';
    expect(fehlerVerstaendlich(new SyntaxError('Unexpected token < in JSON at position 0'))).not.toMatch(/Unexpected token/);
  });
});
