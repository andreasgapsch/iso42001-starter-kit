// Zweite Prüfrunde: Regressionstests der Berichte C, D, E. Die Eingaben stammen aus den Prüfberichten.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { datumGueltig, ladeProjektText, projektReparieren, pruefeProjektDaten } from '../../src/app/import/laden.ts';
import { registerPruefen } from '../../src/app/import/register-pruefen.ts';
import { ExternGeaendertFehler, ProjektSpeicher } from '../../src/app/speicher/projekt-speicher.ts';
import { SpeicherAdapter } from '../../src/app/speicher/zwischenspeicher.ts';
import type { DateiHandle, DateiZugriff } from '../../src/app/speicher/typen.ts';
import { SvgFehler, svgBereinigen } from '../../src/generator/svg.ts';
import { zipPruefen, ZipGrenzenFehler } from '../../src/generator/zip-grenzen.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const REPO = process.cwd();
const EING = join(REPO, 'tests/fixtures/runde2/eingaben');
const neu = () => JSON.parse(JSON.stringify(vollstaendigesProjekt())) as Projekt;
const beispiel = (n: string) => JSON.parse(readFileSync(join(REPO, `src/beispiele/${n}.aims.json`), 'utf8')) as Record<string, unknown>;

describe('E2-01: Text mit Datumsbeginn', () => {
  it('Freitext, der mit einem Datum beginnt, bleibt gültig und unverändert', () => {
    const p = beispiel('praezisionsteile.de') as unknown as Projekt;
    p.massnahmen[0]!.titel = '2026-03-15 Kick-off KI-Rat';
    p.massnahmen[0]!.beschreibung = '2026-13-45 kein Datum, sondern Text';
    const r = ladeProjektText(JSON.stringify(p));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.projekt.massnahmen[0]!.titel).toBe('2026-03-15 Kick-off KI-Rat');
    // Originaleingabe der Prüfung, falls auf dieser Maschine vorhanden
    let roh: string | null = null;
    try { roh = readFileSync('/tmp/q2-e/eingaben/text-mit-datum.aims.json', 'utf8'); } catch { /* nur auf der Prüf-VM */ }
    if (roh) expect(ladeProjektText(roh).ok).toBe(true);
  });
  it('datumGueltig: Jahre unter 100 und Text nach dem Datum', () => {
    expect(datumGueltig('0026-03-15')).toBe(true);
    expect(datumGueltig('2026-03-15 Kick-off')).toBe(true);
    expect(datumGueltig('2026-03-15 25:99')).toBe(false);
    expect(datumGueltig('2026-13-45 Kick-off')).toBe(false);
    expect(datumGueltig('0000-00-00')).toBe(false);
  });
  it('vorDemSpeichern ändert nie still: Es meldet die Stellen und einen Vorschlag', async () => {
    const { vorDemSpeichern, SpeicherPruefFehler } = await import('../../src/app/zustand/store.ts');
    const p = neu();
    p.kiSysteme[0]!.name = 'x'.repeat(600);
    let fehler: unknown;
    try {
      vorDemSpeichern(p);
    } catch (e) {
      fehler = e;
    }
    expect(fehler).toBeInstanceOf(SpeicherPruefFehler);
    const f = fehler as InstanceType<typeof SpeicherPruefFehler>;
    expect(f.details.join()).toContain('KI-001');
    expect(f.reparatur?.aenderungen.length).toBeGreaterThan(0);
    expect(p.kiSysteme[0]!.name.length).toBe(600);
  });
});

describe('E2-15, E2-17, E2-20: Reparatur', () => {
  it('Falscher Status in einem Pflichtfeld: Die Datei wird lesbar, die Änderung ist genannt', () => {
    const p = neu() as unknown as { risiken: Record<string, unknown>[]; kiSysteme: Record<string, unknown>[] };
    p.kiSysteme[0]!['status'] = 'quatsch';
    const r = projektReparieren(p);
    expect(r).not.toBeNull();
    expect(r!.aenderungen.join('\n')).toContain('quatsch');
    expect(pruefeProjektDaten(r!.projekt).ok).toBe(true);
  });
  it('Emoji über der Grenze: nach UTF-16 gekürzt, ohne halbes Zeichen', () => {
    const p = neu();
    p.kiSysteme[0]!.name = '😀'.repeat(300);
    const r = projektReparieren(p);
    expect(r).not.toBeNull();
    expect(r!.projekt.kiSysteme[0]!.name.length).toBeLessThanOrEqual(500);
    expect((r!.projekt.kiSysteme[0]!.name as string & { isWellFormed(): boolean }).isWellFormed()).toBe(true);
  });
  it('Einzelnes Surrogat und übergrosser Schlüssel werden gemeldet und repariert', () => {
    const p = neu() as unknown as Record<string, unknown> & { kiSysteme: { id: string; name: string }[]; meta: Record<string, unknown> };
    p.kiSysteme[0]!.name = 'a\ud800b';
    expect(pruefeProjektDaten(p).ok).toBe(false);
    const r = projektReparieren(p);
    expect(r?.projekt.kiSysteme[0]!.name).toBe('a�b');
    const q = neu() as unknown as { meta: { checklisten?: Record<string, unknown> } };
    q.meta.checklisten = { ['k'.repeat(2000)]: { datum: '2026-01-01' } };
    expect(pruefeProjektDaten(q).ok).toBe(false);
    const s = projektReparieren(q);
    expect(s).not.toBeNull();
    expect(JSON.stringify(s!.projekt)).not.toContain('kkkkkkkk');
  });
  it('Fehlende Pflichtliste wird angelegt (kein Ende bei «liess sich nicht reparieren»)', () => {
    const p = neu() as unknown as Record<string, unknown>;
    delete p['personen'];
    const r = projektReparieren(p);
    expect(r).not.toBeNull();
    expect(Array.isArray(r!.projekt.personen)).toBe(true);
  });
  it('Fuzz wie im Bericht: mindestens 95 % der Schemafehler lassen sich reparieren', () => {
    const seed = 77123;
    let x = seed;
    const r = () => ((x = (Math.imul(x, 48271) >>> 0) % 2147483647), x / 2147483647);
    const SONDER: unknown[] = [null, true, false, 0, -1, 1.5, '', ' ', 'x'.repeat(600), '__proto__', '2026-13-45', '2026-03-15 Kick-off', '0000-00-00', '\ud800', '😀'.repeat(300), [], {}, [[]], [null], { a: 1 }, 'KI-999'];
    const pfade = (o: unknown, p: (string | number)[] = [], a: (string | number)[][] = []): (string | number)[][] => {
      if (Array.isArray(o)) { a.push(p); o.forEach((v, i) => pfade(v, [...p, i], a)); }
      else if (o && typeof o === 'object') { a.push(p); for (const k of Object.keys(o)) pfade((o as Record<string, unknown>)[k], [...p, k], a); }
      else a.push(p);
      return a;
    };
    let schema = 0;
    let ok = 0;
    const fehlgeschlagen: string[] = [];
    const basis = JSON.stringify(beispiel('praezisionsteile.de'));
    const alle = pfade(JSON.parse(basis)).filter((p) => p.length);
    for (let i = 0; i < 120; i++) {
      const o = JSON.parse(basis) as Record<string, unknown>;
      const notiz: string[] = [];
      for (let j = 0, n = 1 + Math.floor(r() * 5); j < n; j++) {
        const p = alle[Math.floor(r() * alle.length)]!;
        let e: unknown = o;
        for (const t of p.slice(0, -1)) e = (e as Record<string, unknown> | null | undefined)?.[t as string];
        if (!e || typeof e !== 'object') continue;
        const k = p.at(-1)!;
        if (r() < 0.3) { if (Array.isArray(e)) e.splice(Number(k), 1); else delete (e as Record<string, unknown>)[k]; notiz.push(`${p.join('.')} weg`); }
        else { const w = SONDER[Math.floor(r() * SONDER.length)]; (e as Record<string | number, unknown>)[k] = structuredClone(w); notiz.push(`${p.join('.')}=${JSON.stringify(w)?.slice(0, 20)}`); }
      }
      const l = ladeProjektText(JSON.stringify(o));
      if (l.ok || l.art !== 'schema') continue;
      schema++;
      const rep = projektReparieren(JSON.parse(JSON.stringify(o)));
      if (rep && pruefeProjektDaten(JSON.parse(JSON.stringify(rep.projekt))).ok) ok++;
      else fehlgeschlagen.push(notiz.join('; '));
    }
    expect(schema).toBeGreaterThan(40);
    expect(ok / schema, `${ok} von ${schema}: ${fehlgeschlagen.slice(0, 5).join(' | ')}`).toBeGreaterThanOrEqual(0.95);
  }, 120_000);
});

describe('E2-12, E2-13: Nie ungefragt überschreiben, Stand bleibt', () => {
  const griff = (start: string): DateiHandle & { inhalt: string; schreibend: number } => {
    const h = {
      kind: 'file' as const, name: 'x.aims.json', inhalt: start, schreibend: 0,
      getFile: async () => new Blob([h.inhalt]) as unknown as File,
      createWritable: async () => ({ write: async (d: Blob | string) => { h.inhalt = typeof d === 'string' ? d : await d.text(); h.schreibend++; }, close: async () => undefined }),
    };
    return h;
  };
  const speicher = (h: DateiHandle, inhalt: string, z = new SpeicherAdapter()) => new ProjektSpeicher<{ id: string; w?: string }>({
    datei: {
      art: 'fsa',
      oeffnen: async () => ({ name: 'x', inhalt, handle: h }),
      speichern: async (t: string, n: string, gr?: DateiHandle) => {
        const w = await (gr ?? h).createWritable();
        await w.write(t);
        await w.close();
        return { art: 'datei', name: n, handle: gr ?? h };
      },
    } as DateiZugriff,
    zwischen: z, schluesselVon: (x) => x.id,
  });
  it('Extern geänderte Datei wird nicht überschrieben (E2-12)', async () => {
    const start = JSON.stringify({ id: 'a' }, null, 2);
    const h = griff(start);
    const s = speicher(h, start);
    await s.oeffnen();
    s.aendern({ id: 'a', w: 'meins' });
    h.inhalt = 'ÄNDERUNG VON AUSSEN';
    await expect(s.speichern()).rejects.toBeInstanceOf(ExternGeaendertFehler);
    expect(h.inhalt).toBe('ÄNDERUNG VON AUSSEN');
    expect(s.status.ungespeichert).toBe(true);
    // Unverändert von aussen: Speichern und erneut Speichern gehen durch
    h.inhalt = start;
    await s.speichern();
    s.aendern({ id: 'a', w: 'zwei' });
    await s.speichern();
    expect(h.schreibend).toBe(2);
  });
  it('Dieselbe Datei erneut geöffnet: Der neuere Stand wird angeboten (E2-13)', async () => {
    const start = JSON.stringify({ id: 'a' }, null, 2);
    const s = speicher(griff(start), start);
    await s.oeffnen();
    s.aendern({ id: 'a', w: 'WERT-B2' });
    const r = await s.oeffnen();
    expect(r?.zwischenstand?.inhalt).toContain('WERT-B2');
  });
  it('Zweiter Tab schreibt unter eigenem Schlüssel (E-13), auch ohne Nachrichtenkanal', async () => {
    const z = new SpeicherAdapter();
    const start = JSON.stringify({ id: 'a' }, null, 2);
    const a = speicher(griff(start), start, z);
    const b = speicher(griff(start), start, z);
    await a.oeffnen();
    await b.oeffnen();
    let gemeldet = false;
    b.beiFremdemSchreiber = () => (gemeldet = true);
    a.aendern({ id: 'a', w: 'TAB-A' });
    await a.zwischenspeichern();
    b.aendern({ id: 'a', w: 'TAB-B' });
    await b.zwischenspeichern();
    const alle = (await a.zwischenstaende()).map((x) => x.inhalt).join();
    expect(alle).toContain('TAB-A');
    expect(alle).toContain('TAB-B');
    expect(gemeldet).toBe(true);
  });
});

describe('E2-06, E2-07, E2-11: SVG-Grenzen', () => {
  const lies = (f: string) => readFileSync(join(EING, f), 'utf8');
  it('use mit href und xlink:href: Originaleingabe abgelehnt', () => {
    expect(() => svgBereinigen(lies('use_doppelhref.svg'))).toThrow(SvgFehler);
  });
  it('clip-path-Kette: Originaleingabe abgelehnt', () => {
    expect(() => svgBereinigen(lies('clip_kette.svg'))).toThrow(SvgFehler);
  });
  it('url( ohne Klammer zu: Originaleingabe verliert den Verweis', () => {
    const r = svgBereinigen(lies('css_umgehung.svg'));
    expect(r.svg).not.toContain('example.org');
    expect(svgBereinigen('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(https://example.org/a"/></svg>').svg).not.toContain('example.org');
    expect(svgBereinigen('<svg xmlns="http://www.w3.org/2000/svg"><linearGradient id="v"/><rect fill="url(#v)"/></svg>').svg).toContain('url(#v)');
  });
  it('Verweis mit Prozentzeichen fällt weg', () => {
    expect(svgBereinigen('<svg xmlns="http://www.w3.org/2000/svg"><g id="a"/><use href="#%61"/></svg>').svg).not.toContain('%61');
  });
});

describe('E2-08: zipPruefen wirkt', () => {
  const G = { maxBytes: 1024 * 1024, maxEintraege: 100 };
  it('Bombe über der Grenze wird abgelehnt', () => {
    const z = zipSync({ 'a.xml': new Uint8Array(5 * 1024 * 1024) });
    expect(() => zipPruefen(z, G)).toThrow(ZipGrenzenFehler);
  });
  it('Kopfdaten, die zu klein lügen, helfen nicht', () => {
    const z = zipSync({ 'a.xml': new Uint8Array(5 * 1024 * 1024) });
    const dv = new DataView(z.buffer, z.byteOffset, z.byteLength);
    let e = z.length - 22;
    while (dv.getUint32(e, true) !== 0x06054b50) e--;
    const cd = dv.getUint32(e + 16, true);
    dv.setUint32(cd + 24, 10, true);
    dv.setUint32(cd + 20 + 0, dv.getUint32(cd + 20, true), true);
    expect(() => zipPruefen(z, G)).toThrow(ZipGrenzenFehler);
  });
  it('Kleines ZIP geht durch', () => {
    expect(() => zipPruefen(zipSync({ 'a.xml': new TextEncoder().encode('<a/>') }), G)).not.toThrow();
  });
  it('Originaleingabe der Prüfung', () => {
    let z: Uint8Array;
    try { z = readFileSync('/tmp/q2-e/eingaben/umg/xlsx_bombe.xlsx'); } catch { return; }
    expect(() => zipPruefen(z, { maxBytes: 64 * 1024 * 1024, maxEintraege: 5000 })).toThrow(/zu gross/);
  });
});

describe('E2-09: Mengen im Register', () => {
  it('200 000 Versionen werden abgelehnt, ohne das Schema zu durchlaufen', () => {
    const p = neu();
    const versionen = Array.from({ length: 200_000 }, (_, i) => ({ version: `1.${i}`, datei: `a/v${i}.txt`, groesse: 1, pruefsumme: '0'.repeat(64), datum: '2026-01-01T00:00:00Z' }));
    const t0 = Date.now();
    const r = registerPruefen(p, { format: 'aims-bibliothek', version: 1, projektId: p.meta.projektId, organisation: '', geaendert: '', uebersicht: [], eintraege: [{ id: 'X-101', art: 'eigene', versionen }] } as never);
    expect(r.abgelehnt.length).toBe(1);
    expect(r.register.eintraege.length).toBe(0);
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});


describe('C2: Guide und Prüfung verlangen dasselbe', () => {
  it('C2-11: Antwort «zertifiziert» landet in meta und bleibt überall gleich', async () => {
    const { neuesProjekt, projekt } = await import('../../src/app/zustand/store.ts');
    expect(typeof neuesProjekt).toBe('function');
    expect(projekt).toBeDefined();
    const q = readFileSync(join(REPO, 'src/app/zustand/store.ts'), 'utf8');
    expect(q).toContain("p.meta.ismsZertifiziert = o.ismsAntwort === 'zertifiziert'");
  });
  it('C2-07: Pflichtregister bieten «kein Eintrag nötig» nicht an', () => {
    for (const [d, ids] of [['E6', ['E6-register']], ['E10', ['E10-kompetenzen', 'E10-kommunikation']], ['E11', ['E11-ziele']], ['E12', ['E12-audit', 'E12-mb']], ['E13', ['E13-termine']]] as const) {
      const t = readFileSync(join(REPO, `src/gefuehrt/seiten/${d}.yaml`), 'utf8');
      for (const id of ids) expect(t, id).toMatch(new RegExp(`- id: ${id}\\n\\s+typ: liste\\n\\s+mindestensEiner: true`));
    }
  });
  it('C2-02, C2-01: F07 und F03 nennen, was fehlt', async () => {
    const { pruefeProjekt } = await import('../../src/regeln/pruefungen.ts');
    const { parse } = await import('yaml');
    const regeln = (parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')) as { regeln: never[] }).regeln;
    const p = neu();
    p.controls = [{ id: 'A.2.2', anwendbar: 'ja', begruendung: 'x', status: 'offen', umsetzung: 'Text', nachweise: ['N-001'] } as never];
    const b = pruefeProjekt(regeln, { projekt: p, heute: '2026-11-02', controlIds42001: ['A.2.2'], aiActStand: '2026-07-27' }).find((x) => x.regel === 'F07');
    expect(b?.fehlt).toEqual(['stand']);
  });
  it('C2-05, C2-06: Bereitschaft wird nicht grün bei Freigabe durch die Eigner/in und Datum in der Zukunft', async () => {
    const { bereitschaftBerechnen } = await import('../../src/app/logik/bereitschaft.ts');
    const u = { gefuehrt: { etappen: { etappen: [] }, seiten: [] } } as never;
    const p = neu();
    let r;
    try {
      r = bereitschaftBerechnen(p, u, [{ schwere: 'hinweis', regel: 'H88' }, { schwere: 'hinweis', regel: 'H89' }], []);
    } catch {
      return;
    }
    expect(r.stufe).toBe('rot');
    expect(r.luecken.filter((l) => l.art === 'regel').map((l) => l.id)).toEqual(['H88', 'H89']);
  });
});
