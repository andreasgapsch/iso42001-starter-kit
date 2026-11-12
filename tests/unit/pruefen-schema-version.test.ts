// Tor G31 Schema-Versionstor (AF-002): Das Schema darf sich nur mit höherer SCHEMA_VERSION, Migrationsschritt und Fixtures ändern.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { stufe } from '../../src/model/migrationen.ts';
import { SCHEMA_VERSION } from '../../src/model/typen.ts';
import { hashSchema, pruefe } from '../../scripts/pruefen/schema-version.mts';

const schemaText = readFileSync(join(process.cwd(), 'src', 'generiert', 'projekt.schema.json'), 'utf8');
const schema = () => JSON.parse(schemaText) as { definitions: Record<string, { properties: Record<string, Record<string, unknown>> }> };
const meldungen = async (e: Parameters<typeof pruefe>[1]) => (await pruefe({}, e)).map((b) => b.meldung);

describe('Schema-Versionstor', () => {
  it('der erzeugte Stand stimmt mit der Referenz der aktuellen Version überein (Verstösse 0)', async () => {
    expect(await pruefe()).toEqual([]);
  });

  it('Gegenprobe: ein geänderter Feldtyp ohne höhere SCHEMA_VERSION bricht', async () => {
    const s = schema();
    expect(s.definitions['Risiko']!.properties['titel']!['type']).toBe('string');
    s.definitions['Risiko']!.properties['titel']!['type'] = 'number';
    const b = await pruefe({}, { schemaText: JSON.stringify(s) });
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ tor: 'G31', schwere: 'fehler', datei: `tests/fixtures/migration/schema-v${SCHEMA_VERSION}.sha256` });
    expect(b[0]!.meldung).toMatch(new RegExp(`weicht von der Referenz der Schemaversion ${SCHEMA_VERSION} ab.*höhere SCHEMA_VERSION.*Migrationsschritt`));
  });

  it('Gegenprobe: ein neues Feld und ein entferntes Pflichtfeld brechen ebenfalls', async () => {
    const neu = schema();
    neu.definitions['Risiko']!.properties['neuesFeld'] = { type: 'string' };
    expect(await meldungen({ schemaText: JSON.stringify(neu) })).toHaveLength(1);
    const ohne = schema() as unknown as { definitions: Record<string, { required: string[] }> };
    ohne.definitions['Risiko']!.required = ohne.definitions['Risiko']!.required.filter((f) => f !== 'titel');
    expect(await meldungen({ schemaText: JSON.stringify(ohne) })).toHaveLength(1);
  });

  it('eine Kommentarkorrektur (description) und die Reihenfolge der Schlüssel lösen nichts aus', async () => {
    const s = schema();
    s.definitions['Risiko']!.properties['titel']!['description'] = 'anderer Kommentar';
    const umgekehrt = JSON.stringify(s, (_k, w: unknown) => (w && typeof w === 'object' && !Array.isArray(w) ? Object.fromEntries(Object.entries(w).reverse()) : w));
    expect(await pruefe({}, { schemaText: umgekehrt })).toEqual([]);
  });

  it('hashSchema: ein Feld namens «description» in properties zählt, ein Schlüsselwort description nicht', () => {
    const a = JSON.stringify({ type: 'object', description: 'x', properties: { description: { type: 'string', description: 'y' } } });
    const b = JSON.stringify({ type: 'object', properties: { description: { type: 'string' } } });
    const c = JSON.stringify({ type: 'object', properties: {} });
    expect(hashSchema(a)).toBe(hashSchema(b));
    expect(hashSchema(a)).not.toBe(hashSchema(c));
    expect(hashSchema(b)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ein übergebener Schematext der aktuellen Version wird wie die erzeugte Datei geprüft', async () => {
    expect(await meldungen({ version: SCHEMA_VERSION, schemaText })).toEqual([]);
  });

  describe('veraltetes erzeugtes Schema', () => {
    const wurzel = mkdtempSync(join(tmpdir(), 'schema-frisch-'));
    afterAll(() => rmSync(wurzel, { recursive: true, force: true }));
    const datei = join(wurzel, 'projekt.schema.json');
    const quelle = join(wurzel, 'typen.ts');
    writeFileSync(datei, schemaText);
    writeFileSync(quelle, 'export {};');

    it('Quelle neuer als das erzeugte Schema: Abbruch mit Hinweis auf npm run schema', async () => {
      utimesSync(datei, new Date('2026-01-01T10:00:00Z'), new Date('2026-01-01T10:00:00Z'));
      utimesSync(quelle, new Date('2026-01-01T10:05:00Z'), new Date('2026-01-01T10:05:00Z'));
      const b = await pruefe({}, { schemaDatei: datei, quellen: [quelle] });
      expect(b).toHaveLength(1);
      expect(b[0]!.meldung).toMatch(/älter als .*typen\.ts.*npm run schema/);
    });

    it('Schema neuer oder gleich alt wie die Quellen: geprüft wie üblich', async () => {
      utimesSync(quelle, new Date('2026-01-01T09:00:00Z'), new Date('2026-01-01T09:00:00Z'));
      expect(await pruefe({}, { schemaDatei: datei, quellen: [quelle] })).toEqual([]);
    });

    it('fehlende Schemadatei: Hinweis auf npm run schema', async () => {
      const b = await pruefe({}, { schemaDatei: join(wurzel, 'gibt-es-nicht.json'), quellen: [quelle] });
      expect(b[0]!.meldung).toContain('npm run schema');
    });
  });

  describe('neue Schemaversion', () => {
    const wurzel = mkdtempSync(join(tmpdir(), 'schema-version-'));
    afterAll(() => rmSync(wurzel, { recursive: true, force: true }));
    const ordner = (name: string, v1 = true, v2 = true) => {
      const o = join(wurzel, name);
      mkdirSync(o);
      const neu = schema();
      neu.definitions['Risiko']!.properties['neuesFeld'] = { type: 'string' };
      if (v1) writeFileSync(join(o, 'schema-v1.sha256'), `${hashSchema(schemaText)}\n`);
      if (v2) writeFileSync(join(o, 'schema-v2.sha256'), `${hashSchema(JSON.stringify(neu))}  projekt.schema.json\n`);
      if (v1) writeFileSync(join(o, 'v1.beispiel.de.aims.json'), JSON.stringify({ schemaVersion: 1 }));
      if (v2) writeFileSync(join(o, 'v2.beispiel.de.aims.json'), JSON.stringify({ schemaVersion: 2 }));
      return { o, neuText: JSON.stringify(neu) };
    };
    const kette = [stufe(1, 'Neues Feld', () => undefined)];

    it('SCHEMA_VERSION 2 mit Schritt, Fixtures und Referenz: Verstösse 0', async () => {
      const { o, neuText } = ordner('vollstaendig');
      expect(await pruefe({}, { version: 2, ordner: o, schemaText: neuText, migrationen: kette })).toEqual([]);
    });

    it('Schema geändert und Version erhöht, aber nichts nachgeliefert: Referenz, Schritt und Fixtures fehlen', async () => {
      const { o, neuText } = ordner('leer', true, false);
      const m = await meldungen({ version: 2, ordner: o, schemaText: neuText, migrationen: [] });
      expect(m).toEqual([
        expect.stringContaining('Referenz für Schemaversion 2 fehlt'),
        'Schritt von Version 1 auf 2 fehlt',
        expect.stringContaining('Beispieldatei der Schemaversion 2 fehlt'),
      ]);
    });

    it('Version erhöht, Schema der alten Version unverändert: weicht von der Referenz 2 ab', async () => {
      const { o } = ordner('altes-schema');
      const m = await meldungen({ version: 2, ordner: o, schemaText, migrationen: kette });
      expect(m).toHaveLength(1);
      expect(m[0]).toContain('Schemaversion 2');
    });

    it('Fixture mit falscher schemaVersion, ungültigem JSON oder über der aktuellen Version bricht', async () => {
      const { o, neuText } = ordner('fixtures');
      writeFileSync(join(o, 'v1.falsch.de.aims.json'), JSON.stringify({ schemaVersion: 2 }));
      writeFileSync(join(o, 'v2.kaputt.de.aims.json'), '{ nicht json');
      writeFileSync(join(o, 'v3.zukunft.de.aims.json'), JSON.stringify({ schemaVersion: 3 }));
      const m = await meldungen({ version: 2, ordner: o, schemaText: neuText, migrationen: kette });
      expect(m).toEqual(
        expect.arrayContaining([
          'schemaVersion 2 passt nicht zum Dateinamen (v1)',
          'Beispieldatei ist kein gültiges JSON',
          'Beispieldatei einer Version über SCHEMA_VERSION 2',
        ]),
      );
      expect(m).toHaveLength(3);
    });

    it('fehlender Fixture-Ordner: Referenzen und Beispieldateien werden als fehlend gemeldet', async () => {
      const m = await meldungen({ version: 1, ordner: join(wurzel, 'gibt-es-nicht'), schemaText, migrationen: [] });
      expect(m).toEqual([expect.stringContaining('Referenz für Schemaversion 1 fehlt'), expect.stringContaining('Beispieldatei der Schemaversion 1 fehlt')]);
    });
  });
});
