// AF-024: Pflichtteil für CI, 50 Fälle je Ziel mit Seed 77123, alle 9 Ziele; dazu die erwarteten Fehlschläge (bekannte Funde)
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BEKANNTE_FUNDE } from './bekannte-funde.ts';
import { fuehreAus, PFLICHT_FAELLE, STANDARD_SEED } from './kern.ts';
import { laufeZiel } from './lauf.ts';
import { EINGABEARTEN } from './typen.ts';

const FAELLE = Number(process.env['FUZZ_FAELLE'] ?? PFLICHT_FAELLE);
const SEED = Number(process.env['FUZZ_SEED'] ?? STANDARD_SEED);

describe(`AF-024 Pflichtteil: ${FAELLE} Fälle je Ziel, Seed ${SEED}`, () => {
  for (const art of EINGABEARTEN) {
    it(`${art}: Fehlerfälle 0, Hänger 0`, async () => {
      const r = await laufeZiel({ art, seed: SEED, faelle: FAELLE });
      expect(r.faelle).toBe(FAELLE);
      // Bekannte Funde sind erwartete Fehlschläge; alles andere ist ein roter Test mit Seed und Wiederholbefehl
      const bekannt = new Set(BEKANNTE_FUNDE.filter((f) => f.art === art && f.seed === SEED).map((f) => f.nummer));
      const neu = r.fehlerFaelle.filter((f) => !bekannt.has(f.nummer));
      expect(neu.map((f) => f.text)).toEqual([]);
      expect(r.angenommen + r.abgelehnt + r.fehler + r.haenger).toBe(FAELLE);
      // Nicht alles wird abgelehnt und nicht alles angenommen: Das Werkzeug erreicht beide Pfade
      expect(r.angenommen, 'angenommene Fälle').toBeGreaterThan(0);
      // Kontrollfälle ohne Mutation müssen angenommen werden: Sonst prüft das Ziel nichts Sinnvolles
      const kontrolle = r.liste.filter((f) => f.name === 'gueltig');
      for (const k of kontrolle) expect(k.status, `Kontrollfall ${k.nummer} ohne Mutation`).toBe('angenommen');
      if (!['ki-ergebnis', 'svg-logo'].includes(art)) expect(kontrolle.length, 'Kontrollfälle').toBeGreaterThanOrEqual(3);
      expect(r.abgelehnt, 'abgelehnte Fälle').toBeGreaterThan(0);
    }, 240_000);
  }

  it('Reparaturen mit gültiger Datei: 100 %', async () => {
    const r = await laufeZiel({ art: 'projektdatei', seed: SEED, faelle: FAELLE });
    const versucht = r.zaehler['reparaturVersucht'] ?? 0;
    const gueltig = r.zaehler['reparaturGueltig'] ?? 0;
    const keine = r.zaehler['reparaturKeine'] ?? 0;
    expect(versucht, 'Reparatur wird versucht').toBeGreaterThan(0);
    // Jede Probe liefert entweder keine Reparatur (Knopf erscheint nicht) oder eine gültige Datei; ungültige Dateien sind Fehlerfälle
    expect(gueltig + keine).toBe(versucht);
    expect(r.fehlerFaelle.filter((f) => /Reparatur|reparierte/.test(f.meldung ?? ''))).toEqual([]);
    expect(keine, 'reparaturKeine (Ziel 0)').toBe(0);
    // Die Fallarten der Runde-2-Funde kommen im Pflichtteil vor (Emoji über der Grenze E2-15, einzelnes Surrogat E2-17, Grenzfälle)
    const namen = new Set(r.liste.map((f) => f.name));
    for (const n of ['emoji-ueber-grenze', 'einzelnes-surrogat', 'ueber-grenze', 'tief-eingebettet']) expect(namen.has(n), `Fallart ${n}`).toBe(true);
  }, 240_000);
});

describe('AF-024 erwartete Fehlschläge (Funde, die ein anderes Paket behebt)', () => {
  it('jede Fall-Datei existiert, nennt ein Paket und schlägt weiter fehl', async () => {
    for (const f of BEKANNTE_FUNDE) {
      expect(f.paket, f.datei).toMatch(/^P\d+$/);
      expect(existsSync(join(process.cwd(), f.datei)), `Fall-Datei ${f.datei}`).toBe(true);
      const e = await fuehreAus(f.art, f.seed, f.nummer);
      expect(['fehler', 'haenger'], `${f.datei} ist behoben? Eintrag aus bekannte-funde.ts entfernen (${f.paket})`).toContain(e.status);
      expect(e.meldung ?? '', f.datei).toContain(f.meldung);
      const datei = readFileSync(join(process.cwd(), f.datei));
      expect(datei.length, f.datei).toBeGreaterThan(0);
    }
  }, 240_000);
});
