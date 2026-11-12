// Ziel «Bibliothekssicherung»: ZIP entpacken, bibliothek.json lesen, prüfen, ins Projekt übernehmen, Rundreise
import { createHash } from 'node:crypto';
import { zipSync, type Zippable } from 'fflate';
import { registerPruefen } from '../../../src/app/import/register-pruefen.ts';
import { REGISTER_FORMAT, registerParsen, registerUebernehmen, type RegisterDatei } from '../../../src/bibliothek/register-datei.ts';
import { pfadSicher } from '../../../src/bibliothek/layout.ts';
import { sicherungEntpacken } from '../../../src/bibliothek/sicherung.ts';
import { mutiereBytes, mutiereJson, mutiereText } from '../mutation.ts';
import { OrakelFehler, type Fall, type Urteil, type Ziel } from '../typen.ts';
import type { Zufall } from '../zufall.ts';
import { ablehnung, FESTE_PROJEKT_ID, festesTestprojekt, projektLesbar, rundreise, ZIP_ZEIT } from './hilfen.ts';

const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');
const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function grundSicherung(z: Zufall): { register: RegisterDatei; dateien: Record<string, Uint8Array> } {
  const dateien: Record<string, Uint8Array> = {};
  const eintraege: RegisterDatei['eintraege'] = [];
  for (let i = 0, n = z.zwischen(1, 4); i < n; i++) {
    const versionen = [];
    for (let v = 1, m = z.zwischen(1, 3); v <= m; v++) {
      const pfad = `Eigene Dateien/X-10${i}_Datei/v${v}.0.txt`;
      const daten = enc(`Inhalt ${i} ${v} ${z.ganz(1e6)}`);
      dateien[pfad] = daten;
      versionen.push({ version: `${v}.0`, datei: pfad, groesse: daten.length, pruefsumme: sha(daten), datum: '2026-10-01T09:00:00Z' });
    }
    eintraege.push({ id: `X-10${i}`, art: 'eigene', titel: `Datei ${i}`, versionen });
  }
  const register: RegisterDatei = { format: REGISTER_FORMAT, version: 1, projektId: FESTE_PROJEKT_ID, organisation: 'Test AG', geaendert: '2026-10-01T09:00:00Z', uebersicht: [], eintraege };
  return { register, dateien };
}

function packen(register: string, dateien: Record<string, Uint8Array>): Uint8Array {
  const baum: Zippable = { 'bibliothek.json': enc(register) };
  for (const [p, d] of Object.entries(dateien)) Object.defineProperty(baum, p, { value: d, enumerable: true, configurable: true, writable: true });
  return zipSync(baum, { mtime: ZIP_ZEIT });
}

const BOESE_PFADE = ['../x.txt', 'a/../../x.txt', '/abs.txt', 'a\\b.txt', 'C:/x.txt', '__proto__/x', 'a/__proto__', 'constructor/x', 'a//b', './a', 'con.txt', 'a/\u0001b', 'a/\u202eb.txt', 'x'.repeat(5000)];

function erzeuge(z: Zufall, nummer: number): Fall {
  const { register, dateien } = grundSicherung(z);
  if (nummer % 13 === 7) {
    // Über der Grenze für Einträge im ZIP: Ablehnungsart «zu vielen Einträgen»
    const extra: Record<string, Uint8Array> = {};
    for (let i = 0; i < 20_001; i++) extra[`Eigene Dateien/X-950_Viele/d${i}.txt`] = new Uint8Array(0);
    return { name: 'viele-dateien', endung: 'zip', daten: packen(JSON.stringify(register), extra), erwartet: 'zu vielen Einträgen' };
  }
  const art = nummer % 10 === 0 ? 0 : z.ganz(100);
  if (art < 8) return { name: 'gueltig', endung: 'zip', daten: packen(JSON.stringify(register), dateien) };
  if (art < 40) return { name: 'register-mutation', endung: 'zip', daten: packen(JSON.stringify(mutiereJson(z, register)), dateien) };
  if (art < 52) return { name: 'register-text', endung: 'zip', daten: packen(mutiereText(z, JSON.stringify(register)), dateien) };
  if (art < 64) {
    const extra = { ...dateien };
    extra[z.wahl(BOESE_PFADE)] = enc('x');
    return { name: 'pfad', endung: 'zip', daten: packen(JSON.stringify(register), extra) };
  }
  if (art < 76) return { name: 'zip-bytes', endung: 'zip', daten: mutiereBytes(z, packen(JSON.stringify(register), dateien)) };
  if (art < 82) {
    // Bombe: wenige KB, entpackt einige MB (Summe bleibt unter der Grenze, Zeit und Speicher werden gemessen)
    const extra = { ...dateien, 'Eigene Dateien/X-900_Bombe/v1.0.bin': new Uint8Array(z.zwischen(1, 40) * 1024 * 1024) };
    return { name: 'bombe', endung: 'zip', daten: packen(JSON.stringify(register), extra) };
  }
  if (art < 88) {
    // Viele Versionen im Register (E2-09), unter der Grenze der Dateigrösse
    const e = register.eintraege[0]!;
    const v = e.versionen[0]!;
    e.versionen = Array.from({ length: z.wahl([2001, 5000, 40_000]) }, (_, i) => ({ ...v, version: `1.${i}`, datei: `Eigene Dateien/X-100_Datei/v${i}.txt` }));
    return { name: 'viele-versionen', endung: 'zip', daten: packen(JSON.stringify(register), dateien) };
  }
  if (art < 90) {
    // Viele Einträge
    const e = register.eintraege[0]!;
    register.eintraege = Array.from({ length: z.wahl([10_001, 12_000]) }, (_, i) => ({ ...e, id: `X-${i + 1000}`, versionen: [] }));
    return { name: 'viele-eintraege', endung: 'zip', daten: packen(JSON.stringify(register), dateien) };
  }
  return { name: 'aufbau', endung: 'zip', daten: z.wahl([new Uint8Array(0), enc('PK'), enc('kein zip'), zipSync({}, { mtime: ZIP_ZEIT }), zipSync({ 'x.txt': enc('x') }, { mtime: ZIP_ZEIT }), zipSync({ 'bibliothek.json': enc('') }, { mtime: ZIP_ZEIT })]) };
}

function urteile(f: Fall): Urteil {
  const zaehler: Record<string, number> = {};
  let e;
  try {
    e = sicherungEntpacken(f.daten as Uint8Array);
  } catch (x) {
    return ablehnung(x, 'sicherungEntpacken');
  }
  for (const d of e.dateien) if (!pfadSicher(d.pfad)) throw new OrakelFehler(`Unsicherer Pfad im Entpackten: ${d.pfad.slice(0, 60)}`);
  if (e.register === null) return { urteil: 'abgelehnt', meldung: 'bibliothek.json fehlt' };
  let d: RegisterDatei | null;
  try {
    d = registerParsen(e.register);
  } catch (x) {
    throw new OrakelFehler(`registerParsen wirft (${x instanceof Error ? `${x.name}: ${x.message}` : String(x)})`.slice(0, 300));
  }
  if (!d) return { urteil: 'abgelehnt', meldung: 'bibliothek.json ist keine gültige Registerdatei' };
  const p = festesTestprojekt();
  let g;
  try {
    g = registerPruefen(p, d);
    registerUebernehmen(p, g.register);
  } catch (x) {
    throw new OrakelFehler(`Register prüfen oder übernehmen wirft (${x instanceof Error ? `${x.name}: ${x.message}` : String(x)})`.slice(0, 300));
  }
  // Das Projekt muss danach wieder lesbar sein, auch wenn Einträge abgelehnt wurden
  projektLesbar(JSON.parse(JSON.stringify(p)), 'Projekt nach der Übernahme');
  rundreise(p, 'Projekt nach der Übernahme');
  if (g.abgelehnt.length) {
    zaehler['teilweise'] = 1;
    for (const a of g.abgelehnt) if (a.details.length === 0) throw new OrakelFehler('Eintrag abgelehnt ohne Angabe');
  }
  return { urteil: 'angenommen', zaehler };
}

export const sicherung: Ziel = { art: 'sicherung', erzeuge, urteile };
