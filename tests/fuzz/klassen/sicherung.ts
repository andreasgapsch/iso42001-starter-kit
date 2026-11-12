// Klassen der Bibliothekssicherung: Befunde E-01, E-09, E-22, E2-09
import { createHash } from 'node:crypto';
import { unzipSync, zipSync, type Zippable } from 'fflate';
import { pruefeProjektDaten } from '../../../src/app/import/laden.ts';
import { registerPruefen } from '../../../src/app/import/register-pruefen.ts';
import { pfadSicher } from '../../../src/bibliothek/layout.ts';
import { REGISTER_FORMAT, REGISTER_MAX_EINTRAEGE, REGISTER_MAX_VERSIONEN, type RegisterDatei } from '../../../src/bibliothek/register-datei.ts';
import { sicherungEntpacken } from '../../../src/bibliothek/sicherung.ts';
import { OrakelFehler, type Urteil } from '../typen.ts';
import type { Zufall } from '../zufall.ts';
import { ablehnung, FESTE_PROJEKT_ID, festesTestprojekt, ZIP_ZEIT } from '../ziele/hilfen.ts';
import { sicherung as ziel } from '../ziele/sicherung.ts';
import type { Klasse, KlassenFall } from './typen.ts';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');

function grund(): { register: RegisterDatei; dateien: Record<string, Uint8Array> } {
  const daten = enc('Inhalt');
  const pfad = 'Eigene Dateien/X-100_Datei/v1.0.txt';
  const register: RegisterDatei = {
    format: REGISTER_FORMAT, version: 1, projektId: FESTE_PROJEKT_ID, organisation: 'Test AG', geaendert: '2026-10-01T09:00:00Z', uebersicht: [],
    eintraege: [{ id: 'X-100', art: 'eigene', titel: 'Datei', versionen: [{ version: '1.0', datei: pfad, groesse: daten.length, pruefsumme: sha(daten), datum: '2026-10-01T09:00:00Z' }] }],
  };
  return { register, dateien: { [pfad]: daten } };
}

function packen(register: unknown, dateien: Record<string, Uint8Array>): Uint8Array {
  const baum: Zippable = { 'bibliothek.json': enc(typeof register === 'string' ? register : JSON.stringify(register)) };
  for (const [p, d] of Object.entries(dateien)) Object.defineProperty(baum, p, { value: d, enumerable: true, configurable: true, writable: true });
  return zipSync(baum, { mtime: ZIP_ZEIT });
}

const fall = (name: string, daten: Uint8Array, mussAbgelehnt = false): KlassenFall => ({ name, endung: 'zip', daten, mussAbgelehnt });
const ausDatei = (b: Uint8Array): KlassenFall => fall('original', b);
const urteile = (f: KlassenFall): Urteil => ziel.urteile(f) as Urteil;
const registerAus = (f: KlassenFall): Record<string, unknown> | null => {
  try {
    return JSON.parse(new TextDecoder().decode(unzipSync(f.daten as Uint8Array)['bibliothek.json'])) as Record<string, unknown>;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------------------------------------------------
// E-01: Einträge aus bibliothek.json kamen ungeprüft ins Projekt; die gespeicherte Datei liess sich nicht mehr öffnen

const BOESE_WERTE: [string, unknown][] = [
  ['art', 'boese'], ['art', 1], ['titel', 'x'.repeat(300)], ['titel', null], ['status', 'boese'], ['typ', 5], ['extra', { a: 1 }], ['id', 'kein muster'], ['id', ''],
  ['versionen', 'x'], ['versionen', [null]], ['versionen', [{ version: 3, datei: 7 }]], ['versionen', [{ version: '1.0', datei: 'a.txt', groesse: 'gross', pruefsumme: 'x', datum: 'gestern' }]], ['__proto__', { x: 1 }],
];

export const register: Klasse = {
  id: 'sicherung-register',
  art: 'sicherung',
  befunde: ['E-01'],
  titel: 'Ungültige Einträge in bibliothek.json: abgelehnt mit Angabe, das Projekt bleibt gültig und speicherbar',
  regression: 'tests/fixtures/fuzz/regression/sicherung-register.zip',
  variante: (z) => {
    const { register: r, dateien } = grund();
    const e = r.eintraege[0] as unknown as Record<string, unknown>;
    for (let i = 0, n = z.zwischen(1, 3); i < n; i++) {
      const [k, v] = z.wahl(BOESE_WERTE);
      if (k === '__proto__') Object.defineProperty(e, k, { value: v, enumerable: true });
      else e[k] = v;
    }
    if (z.mit(0.3)) r.eintraege.push(structuredClone(r.eintraege[0]!));
    return fall('register', packen(r, dateien));
  },
  urteile,
  // Ohne Prüfung: Einträge werden roh übernommen; das Projekt ist danach ungültig
  ohneSchutz: (f) => {
    const r = registerAus(f);
    if (!r || !Array.isArray(r['eintraege'])) return false;
    const p = festesTestprojekt() as unknown as Record<string, unknown>;
    p['bibliothek'] = { eintraege: r['eintraege'] };
    return !pruefeProjektDaten(p).ok;
  },
  ausDatei,
};

// ---------------------------------------------------------------------------------------------------------------------
// E-09: ZIP-Bombe (Grenze griff erst nach dem Entpacken). Gemessen mit kleiner Grenze, damit die Varianten klein bleiben.

const KLEIN = 1024 * 1024;

export const bombe: Klasse = {
  id: 'sicherung-bombe',
  art: 'sicherung',
  befunde: ['E-09'],
  titel: 'Entpackt über der Grenze (eine grosse Datei, viele mittlere, Register selbst): abgelehnt vor dem Entpacken',
  regression: 'tests/fixtures/fuzz/regression/sicherung-bombe.zip',
  variante: (z) => {
    const { register: r, dateien } = grund();
    const art = z.ganz(3);
    if (art === 0) dateien['Eigene Dateien/X-900_Bombe/v1.0.bin'] = new Uint8Array(z.zwischen(2, 16) * KLEIN);
    else if (art === 1) for (let i = 0, n = z.zwischen(3, 20); i < n; i++) dateien[`Eigene Dateien/X-9${i}_B/v1.0.bin`] = new Uint8Array(KLEIN / 2 + z.ganz(KLEIN));
    else return fall('bombe-register', packen(`${JSON.stringify(r)}${' '.repeat(z.zwischen(2, 8) * KLEIN)}`, dateien), true);
    return fall(`bombe ${['eine', 'viele'][art]}`, packen(r, dateien), true);
  },
  urteile: (f) => {
    try {
      sicherungEntpacken(f.daten as Uint8Array, KLEIN);
    } catch (e) {
      return ablehnung(e, 'sicherungEntpacken');
    }
    throw new OrakelFehler(`Grenze greift nicht: Sicherung über ${KLEIN} Bytes entpackt angenommen`);
  },
  ohneSchutz: (f) => Object.values(unzipSync(f.daten as Uint8Array)).reduce((s, d) => s + d.length, 0) > KLEIN,
  ausDatei,
};

// ---------------------------------------------------------------------------------------------------------------------
// E-22: Pfade (__proto__ ging still verloren, reservierte Namen und C:/ passierten pfadSicher, Zip Slip)

const PFADE = ['a/__proto__', '__proto__/x', 'constructor/x', 'prototype', '../x.txt', 'a/../../x.txt', '/abs.txt', 'C:/x.txt', 'c:x.txt', 'a\\b.txt', 'con.txt', 'NUL', 'a/aux.pdf', 'COM1.txt', 'a//b', './a', 'a/\u0000b', 'a/\u202eb.txt', 'x'.repeat(300), 'a:b.txt', 'a/b. ', 'a/b.'];

export const pfade: Klasse = {
  id: 'sicherung-pfade',
  art: 'sicherung',
  befunde: ['E-22'],
  titel: 'Unsichere oder reservierte Pfade im ZIP: abgelehnt mit Meldung, nie still verloren, nie ausserhalb',
  regression: 'tests/fixtures/fuzz/regression/sicherung-pfade.zip',
  variante: (z) => {
    const { register: r, dateien } = grund();
    for (let i = 0, n = z.zwischen(1, 2); i < n; i++) {
      const p = z.wahl(PFADE);
      dateien[z.mit(0.5) && !p.startsWith('__proto__') ? p : `Eigene Dateien/${p}`] = enc('x');
    }
    return fall('pfade', packen(r, dateien));
  },
  urteile: (f) => {
    const u = urteile(f);
    if (u.urteil === 'angenommen') {
      // Nichts still verloren: jede Datei im ZIP (ausser dem Register) kommt an oder die Sicherung wird abgelehnt
      const roh = sicherungEntpacken(f.daten as Uint8Array);
      let imZip = 0;
      unzipSync(f.daten as Uint8Array, {
        filter: (d) => {
          if (d.name !== 'bibliothek.json' && !d.name.endsWith('/')) imZip++;
          return false;
        },
      });
      if (roh.dateien.length !== imZip) throw new OrakelFehler(`Datenverlust: ${imZip} Dateien im ZIP, ${roh.dateien.length} übernommen, ohne Meldung`);
    }
    return u;
  },
  ohneSchutz: (f) => {
    const namen: string[] = [];
    unzipSync(f.daten as Uint8Array, {
      filter: (d) => {
        namen.push(d.name);
        return false;
      },
    });
    const ohneVerlust = Object.keys(unzipSync(f.daten as Uint8Array)).length === namen.length;
    return !ohneVerlust || namen.some((n) => n !== 'bibliothek.json' && !pfadSicher(n)) || namen.some((n) => /(^|\/)(con|nul|aux|com\d|lpt\d)(\.|$)|:|\\/i.test(n));
  },
  ausDatei,
};

// ---------------------------------------------------------------------------------------------------------------------
// E2-09: sehr viele Versionen oder Einträge im Register (Hauptthread ohne Mengengrenze, über 3 GB)

export const mengen: Klasse = {
  id: 'sicherung-mengen',
  art: 'sicherung',
  befunde: ['E2-09'],
  titel: 'Register mit mehr Einträgen oder Versionen als erlaubt: abgelehnt in höchstens 5 s',
  regression: 'tests/fixtures/fuzz/regression/sicherung-mengen.zip',
  variante: (z) => {
    const { register: r, dateien } = grund();
    const e = r.eintraege[0]!;
    if (z.mit(0.5)) {
      const v = e.versionen[0]!;
      e.versionen = Array.from({ length: z.wahl([REGISTER_MAX_VERSIONEN + 1, 5000, 50_000, 200_000]) }, (_, i) => ({ ...v, version: `1.${i}` }));
    } else {
      r.eintraege = Array.from({ length: z.wahl([REGISTER_MAX_EINTRAEGE + 1, 20_000, 60_000]) }, (_, i) => ({ ...e, id: `X-${i + 1000}`, versionen: z.mit(0.5) ? [] : e.versionen }));
    }
    return fall('mengen', packen(r, dateien));
  },
  // Abgelehnt (Register ungültig) oder angenommen mit den Einträgen über der Grenze als abgelehnt mit Angabe; nie übernommen
  urteile: (f) => {
    const u = urteile(f);
    if (u.urteil === 'angenommen') {
      const r = registerAus(f) as unknown as RegisterDatei;
      const g = registerPruefen(festesTestprojekt(), r);
      if (g.abgelehnt.length === 0) throw new OrakelFehler('Grenze greift nicht: Register über der Mengengrenze vollständig übernommen');
    }
    return u;
  },
  ohneSchutz: (f) => {
    const r = registerAus(f) as { eintraege?: { versionen?: unknown[] }[] } | null;
    return !!r?.eintraege && (r.eintraege.length > REGISTER_MAX_EINTRAEGE || r.eintraege.some((e) => (e.versionen?.length ?? 0) > REGISTER_MAX_VERSIONEN));
  },
  ausDatei,
};

export const SICHERUNG_KLASSEN: Klasse[] = [register, bombe, pfade, mengen];
