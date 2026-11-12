// Migrationsgerüst (AF-001, AF-006): Kette, Fehlerarten, Hilfsfunktionen und eine Fixture je Schemaversion.
// Eine neue Version ergänzt hier einen Test zu ihrem Schritt und legt die Fixtures v<N>.* an (siehe src/model/migrationen.ts).
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ladeProjektText, pruefeProjektDaten } from '../../src/app/import/laden.ts';
import { MIGRATIONEN, MigrationsFehler, PRAEFIXE_V2, fuerJedenEintrag, hoechsteNummer, migriere, pruefeKette, pruefeSchemaVersion, stufe, type Migration, type RohProjekt } from '../../src/model/migrationen.ts';
import { SCHEMA_VERSION } from '../../src/model/typen.ts';

const ORDNER = join(process.cwd(), 'tests', 'fixtures', 'migration');
const BEISPIELE = ['muster-maschinenbau', 'praezisionsteile'];
const SPRACHEN = ['de', 'en'];
const fixtures = readdirSync(ORDNER).filter((d) => /^v\d+\..+\.aims\.json$/.test(d)).sort();
const lies = (pfad: string): RohProjekt => JSON.parse(readFileSync(pfad, 'utf8')) as RohProjekt;

describe('Fixtures je Schemaversion', () => {
  it('es gibt Beispieldateien für jede Version 1 bis SCHEMA_VERSION, je Beispiel und Sprache, und keine darüber', () => {
    const erwartet = Array.from({ length: SCHEMA_VERSION }, (_, i) => i + 1).flatMap((v) => BEISPIELE.flatMap((b) => SPRACHEN.map((s) => `v${v}.${b}.${s}.aims.json`))).sort();
    expect(fixtures).toEqual(erwartet);
    expect(new Set(fixtures.map((f) => /^v(\d+)\./.exec(f)![1])).size).toBe(SCHEMA_VERSION);
  });

  it('je Version gibt es eine Schema-Referenz', () => {
    for (let v = 1; v <= SCHEMA_VERSION; v++) expect(readFileSync(join(ORDNER, `schema-v${v}.sha256`), 'utf8').trim(), `v${v}`).toMatch(/^[0-9a-f]{64}$/);
  });

  describe.each(fixtures)('%s', (datei) => {
    const v = Number(/^v(\d+)\./.exec(datei)![1]);
    const roh = lies(join(ORDNER, datei));

    it('trägt die Version aus dem Dateinamen', () => {
      expect(roh.schemaVersion).toBe(v);
    });

    it('wird auf die aktuelle Version gehoben und ist danach Ajv-gültig', () => {
      const m = migriere(roh);
      expect(m.vonVersion).toBe(v);
      expect(m.projekt.schemaVersion).toBe(SCHEMA_VERSION);
      expect(m.angewendet).toHaveLength(SCHEMA_VERSION - v);
      const r = pruefeProjektDaten(m.projekt);
      expect(r.ok, JSON.stringify(r.ok ? [] : r.fehler.slice(0, 3))).toBe(true);
    });

    it('eine zweite Migration ändert nichts (0 Bytes Unterschied)', () => {
      const erste = migriere(roh).projekt;
      const zweite = migriere(erste);
      expect(zweite.angewendet).toEqual([]);
      expect(JSON.stringify(zweite.projekt)).toBe(JSON.stringify(erste));
    });

    it('verändert die eingelesene Datei nicht (Migration arbeitet auf einer Kopie)', () => {
      const vorher = JSON.stringify(roh);
      migriere(roh);
      expect(JSON.stringify(roh)).toBe(vorher);
    });
  });
});

describe('Migrationskette', () => {
  const schritt = (von: number, text = `Schritt ${von}`): Migration => stufe(von, text, (p) => { ((p['spur'] ??= []) as unknown[]).push(von); });

  it('die ausgelieferte Kette ist lückenlos bis SCHEMA_VERSION', () => {
    expect(pruefeKette()).toEqual([]);
    expect(MIGRATIONEN).toHaveLength(SCHEMA_VERSION - 1);
  });

  it('wendet die Schritte in aufsteigender Reihenfolge an, setzt schemaVersion und beschreibt jeden Schritt', () => {
    const kette = [schritt(2), schritt(1), schritt(3)];
    const m = migriere({ schemaVersion: 1 }, kette, 4);
    expect(m.projekt['spur']).toEqual([1, 2, 3]);
    expect(m.projekt.schemaVersion).toBe(4);
    expect(m.angewendet).toEqual(['1->2: Schritt 1', '2->3: Schritt 2', '3->4: Schritt 3']);
    expect(m.vonVersion).toBe(1);
  });

  it('ein verändernder Schritt arbeitet auf einer Kopie: Eingabe und tief verschachtelte Teile bleiben unberührt (wirkt schon bei Version 1)', () => {
    const roh: RohProjekt = { schemaVersion: 1, organisation: { name: 'Alt', themen: [{ id: 'T-1' }] }, risiken: [{ id: 'R-001', titel: 'Alt' }] };
    const vorher = JSON.stringify(roh);
    const veraendert = stufe(1, 'verändert tief', (p) => {
      (p['organisation'] as { name: string; themen: { id: string }[] }).name = 'Neu';
      (p['organisation'] as { themen: { id: string }[] }).themen[0]!.id = 'T-2';
      fuerJedenEintrag(p, 'risiken', (r) => { r['titel'] = 'Neu'; });
    });
    const m = migriere(roh, [veraendert], 2);
    expect(JSON.stringify(roh)).toBe(vorher);
    expect(m.projekt).toEqual({ schemaVersion: 2, organisation: { name: 'Neu', themen: [{ id: 'T-2' }] }, risiken: [{ id: 'R-001', titel: 'Neu' }] });
    expect(m.projekt['risiken']).not.toBe(roh['risiken']);
  });

  it('beginnt bei der Version der Datei und lässt Dateien der Zielversion unverührt', () => {
    expect(migriere({ schemaVersion: 3 }, [schritt(1), schritt(2), schritt(3)], 4).projekt['spur']).toEqual([3]);
    const gleich = migriere({ schemaVersion: 4, x: 1 }, [schritt(1)], 4);
    expect(gleich.angewendet).toEqual([]);
    expect(gleich.projekt).toEqual({ schemaVersion: 4, x: 1 });
  });

  it('meldet fehlende, ungültige und zu neue Version mit der jeweiligen Art', () => {
    const art = (roh: RohProjekt, ziel = 2) => {
      try {
        migriere(roh, [schritt(1)], ziel);
      } catch (e) {
        expect(e).toBeInstanceOf(MigrationsFehler);
        return { art: (e as MigrationsFehler).art, version: (e as MigrationsFehler).version, text: (e as MigrationsFehler).message };
      }
      return null;
    };
    for (const roh of [{}, { schemaVersion: '1' }, { schemaVersion: 0 }, { schemaVersion: 1.5 }, { schemaVersion: null }, { schemaVersion: -1 }]) {
      expect(art(roh), JSON.stringify(roh)).toMatchObject({ art: 'keine-version', version: null });
    }
    expect(art({ schemaVersion: 3 })).toMatchObject({ art: 'zu-neu', version: 3 });
    expect(art({ schemaVersion: 3 })!.text).toContain('3');
  });

  it('meldet eine Lücke mit der Version, von der kein Schritt ausgeht', () => {
    expect(() => migriere({ schemaVersion: 1 }, [schritt(2)], 3)).toThrowError(expect.objectContaining({ art: 'luecke', version: 1 }));
    expect(() => migriere({ schemaVersion: 2 }, [schritt(1)], 3)).toThrowError(/Version 2/);
  });

  it('pruefeKette findet Lücken, doppelte Schritte und Schritte ausserhalb der Kette', () => {
    expect(pruefeKette([schritt(1), schritt(2)], 3)).toEqual([]);
    expect(pruefeKette([schritt(1)], 3)).toEqual(['Schritt von Version 2 auf 3 fehlt']);
    expect(pruefeKette([schritt(1), schritt(1)], 2)).toEqual(['Mehrere Schritte von Version 1']);
    expect(pruefeKette([schritt(1), schritt(5), schritt(0)], 2)).toEqual(['Schritt von Version 5 liegt ausserhalb 1 bis 1', 'Schritt von Version 0 liegt ausserhalb 1 bis 1']);
    expect(pruefeKette([], 1)).toEqual([]);
  });

  it('pruefeSchemaVersion lässt ältere und gleiche Versionen zu', () => {
    expect(pruefeSchemaVersion({ schemaVersion: 1 }, 2)).toBeNull();
    expect(pruefeSchemaVersion({ schemaVersion: 2 }, 2)).toBeNull();
    expect(pruefeSchemaVersion({ schemaVersion: 3 }, 2)?.art).toBe('zu-neu');
    expect(pruefeSchemaVersion({}, 2)?.art).toBe('keine-version');
    expect(pruefeSchemaVersion({ schemaVersion: SCHEMA_VERSION })).toBeNull();
  });
});

describe('Hilfsfunktionen für neue Stufen', () => {
  it('stufe ändert die Kopie an Ort und Stelle, ohne schemaVersion anzufassen', () => {
    const m = stufe(1, 'Test', (p) => { p['neu'] = true; });
    expect(m).toMatchObject({ von: 1, beschreibung: 'Test' });
    const p: RohProjekt = { schemaVersion: 1 };
    expect(m.migriere(p)).toBe(p);
    expect(p).toEqual({ schemaVersion: 1, neu: true });
  });

  it('fuerJedenEintrag besucht Objekt-Einträge und übergeht fehlende Listen, Nicht-Listen und Nicht-Objekte', () => {
    const p: RohProjekt = { risiken: [{ id: 'R-001' }, 'x', null, { id: 'R-002' }], massnahmen: 'keine Liste' };
    const besucht: [string, number][] = [];
    fuerJedenEintrag(p, 'risiken', (e, i) => besucht.push([String(e['id']), i]));
    fuerJedenEintrag(p, 'massnahmen', () => besucht.push(['falsch', -1]));
    fuerJedenEintrag(p, 'gibtEsNicht', () => besucht.push(['falsch', -1]));
    expect(besucht).toEqual([['R-001', 0], ['R-002', 3]]);
    fuerJedenEintrag(p, 'risiken', (e) => { e['ergaenzt'] = true; });
    expect((p['risiken'] as RohProjekt[])[0]).toEqual({ id: 'R-001', ergaenzt: true });
  });
});

// AF-006: Projektdateien aus den Release-Ständen der Testversionen 1 bis 3 lassen sich öffnen, ohne dass Einträge verloren gehen.
describe('Rundreise der Projektdateien der Testversionen 1 bis 3', () => {
  const sha = (pfad: string) => createHash('sha256').update(readFileSync(pfad)).digest('hex');
  const quellen = JSON.parse(readFileSync(join(ORDNER, 'testversionen', 'quellen.json'), 'utf8')) as Record<string, { sha256?: Record<string, string> }>;
  const stand: [string, string, string][] = [];
  for (const [version, ordner] of [['1.0.0-test.1', join(ORDNER, 'testversionen', '1.0.0-test.1')]] as const) {
    for (const b of BEISPIELE) for (const s of SPRACHEN) stand.push([version, `${b}.${s}`, join(ordner, `${b}.${s}.aims.json`)]);
  }
  // Testversion 2 und 3 lieferten dieselben Beispieldateien wie die Fixtures v1 (SHA-256 aus dem Release-ZIP)
  for (const version of ['1.0.0-test.2', '1.0.0-test.3']) {
    for (const b of BEISPIELE) for (const s of SPRACHEN) {
      stand.push([version, `${b}.${s}`, join(ORDNER, `v1.${b}.${s}.aims.json`)]);
      it(`${version} ${b}.${s}: Prüfsumme des Release-ZIP gleich Fixture v1`, () => {
        expect(sha(join(ORDNER, `v1.${b}.${s}.aims.json`))).toBe(quellen[version]!.sha256![`${b}.${s}`]);
      });
    }
  }

  it('deckt alle drei Testversionen und beide Beispiele in beiden Sprachen ab', () => {
    expect(stand).toHaveLength(12);
    expect(new Set(stand.map((x) => x[0]))).toEqual(new Set(['1.0.0-test.1', '1.0.0-test.2', '1.0.0-test.3']));
  });

  it.each(stand)('%s %s: lesbar, jede Liste vollzählig', (_version, _name, pfad) => {
    const text = readFileSync(pfad, 'utf8');
    const roh = JSON.parse(text) as Record<string, unknown>;
    const r = ladeProjektText(text);
    expect(r.ok, r.ok ? '' : `${r.art} ${r.details.join('; ')}`).toBe(true);
    if (!r.ok) return;
    expect(r.projekt.schemaVersion).toBe(SCHEMA_VERSION);
    const neu = r.projekt as unknown as Record<string, unknown>;
    const listen = Object.keys(roh).filter((k) => Array.isArray(roh[k]));
    expect(listen.length).toBeGreaterThan(10);
    for (const k of listen) expect((neu[k] as unknown[]).length, k).toBe((roh[k] as unknown[]).length);
  });
});

// AF-010: Schritt 1 -> 2 setzt meta.idZaehler je Liste aus der höchsten vergebenen ID; IDs und Verweise bleiben, wie sie sind.
describe('Schritt 1 -> 2: Zähler der IDs (meta.idZaehler)', () => {
  const schritt = MIGRATIONEN.find((m) => m.von === 1)!;
  const nach = (roh: RohProjekt) => migriere(roh, MIGRATIONEN, 2).projekt;
  const namen = BEISPIELE.flatMap((b) => SPRACHEN.map((s) => `${b}.${s}`));

  it.each(namen)('%s: Fixture v2 ist genau die migrierte Fixture v1', (name) => {
    const v1 = lies(join(ORDNER, `v1.${name}.aims.json`));
    const v2 = readFileSync(join(ORDNER, `v2.${name}.aims.json`), 'utf8');
    expect(`${JSON.stringify(nach(v1), null, 2)}\n`).toBe(v2);
  });

  it.each(namen)('%s: Zähler gleich höchster Nummer je Liste, sonst ändern sich nur schemaVersion und Zähler', (name) => {
    const v1 = lies(join(ORDNER, `v1.${name}.aims.json`));
    const v2 = nach(v1);
    const zaehler = (v2['meta'] as Record<string, unknown>)['idZaehler'] as Record<string, number>;
    // Je Liste der Datei ein Zähler (eigeneProzesse ist optional und fehlt im Präzisionsteile-Beispiel)
    const vorhanden = Object.keys(PRAEFIXE_V2).filter((l) => Array.isArray(v1[l]));
    expect(vorhanden.length).toBeGreaterThanOrEqual(16);
    expect(Object.keys(zaehler).sort()).toEqual(vorhanden.sort());
    for (const [liste, praefix] of Object.entries(PRAEFIXE_V2).filter(([l]) => vorhanden.includes(l))) {
      const nummern = (v1[liste] as { id: string }[]).map((e) => Number(new RegExp(`^${praefix}-(\\d+)$`).exec(e.id)?.[1] ?? 0));
      expect(zaehler[liste], liste).toBe(Math.max(0, ...nummern));
    }
    const ohne = structuredClone(v2);
    delete (ohne['meta'] as Record<string, unknown>)['idZaehler'];
    expect({ ...ohne, schemaVersion: 1 }).toEqual(v1);
  });

  it('Muster: Zählerstände an bekannten Stellen', () => {
    const z = (nach(lies(join(ORDNER, 'v1.muster-maschinenbau.de.aims.json')))['meta'] as { idZaehler: Record<string, number> }).idZaehler;
    expect(z).toMatchObject({ personen: 11, kiSysteme: 8, risiken: 33, nachweise: 65, massnahmen: 39, audits: 8, eigeneControls: 2, managementbewertungen: 1, eigeneProzesse: 1 });
  });

  it('nimmt die höchste Nummer, nicht die Anzahl; fremde Kennungen zählen nicht', () => {
    const p = nach({ schemaVersion: 1, meta: {}, risiken: [{ id: 'R-002' }, { id: 'R-017' }, { id: 'R-abc' }, { id: 'KI-099' }, {}], kiSysteme: [], eigeneControls: [{ id: 'EC-07' }] });
    expect((p['meta'] as Record<string, unknown>)['idZaehler']).toEqual({ risiken: 17, kiSysteme: 0, eigeneControls: 7 });
  });

  it('Auszug: nur Listen der Datei bekommen einen Zähler; ohne meta bleibt die Datei ohne Zähler', () => {
    expect((nach({ schemaVersion: 1, meta: { projektId: 'x' }, massnahmen: [{ id: 'M-004' }] })['meta'] as Record<string, unknown>)['idZaehler']).toEqual({ massnahmen: 4 });
    expect(nach({ schemaVersion: 1, risiken: [{ id: 'R-001' }] })).toEqual({ schemaVersion: 2, risiken: [{ id: 'R-001' }] });
    expect(nach({ schemaVersion: 1, meta: 'kaputt', risiken: [] })).toEqual({ schemaVersion: 2, meta: 'kaputt', risiken: [] });
  });

  it('ein schon vorhandener höherer Zähler bleibt (Zähler sinken nie)', () => {
    const p = nach({ schemaVersion: 1, meta: { idZaehler: { risiken: 40, kiSysteme: 1, fremd: 'x' } }, risiken: [{ id: 'R-003' }], kiSysteme: [{ id: 'KI-005' }] });
    expect((p['meta'] as Record<string, unknown>)['idZaehler']).toEqual({ risiken: 40, kiSysteme: 5 });
  });

  it('hoechsteNummer ist tolerant gegenüber fehlender Liste und Nicht-Objekten', () => {
    expect(hoechsteNummer(undefined, 'R')).toBe(0);
    expect(hoechsteNummer(['R-009', null, { id: 7 }, { id: 'R-003' }], 'R')).toBe(3);
    expect(schritt.beschreibung).toContain('meta.idZaehler');
  });

  it('eine Projektdatei der Version 1 lädt als Version 2 mit Zähler', () => {
    const r = ladeProjektText(readFileSync(join(ORDNER, 'v1.praezisionsteile.de.aims.json'), 'utf8'));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.projekt.meta.idZaehler).toMatchObject({ risiken: 14, massnahmen: 26 });
  });
});

// AF-104: Schritt 2 -> 3 setzt den Entscheid je KI-System aus der Freigabe (D-10, PR-07; der Antrag bleibt leer, Entscheid P14
// nach Prüfung) und den Zeitpunkt der Entdeckung je Vorfall (D-22, PR-19) aus den Angaben der Version 2; erfindet nichts,
// überschreibt nichts.
describe('Schritt 2 -> 3: Antrag, Entscheid, Entdeckung (AF-104)', () => {
  const schritt = MIGRATIONEN.find((m) => m.von === 2)!;
  const nach = (roh: RohProjekt) => migriere(roh, MIGRATIONEN, 3).projekt;
  const namen = BEISPIELE.flatMap((b) => SPRACHEN.map((s) => `${b}.${s}`));
  type Obj = Record<string, unknown>;

  it.each(namen)('%s: Fixture v3 ist genau die migrierte Fixture v2', (name) => {
    const v2 = lies(join(ORDNER, `v2.${name}.aims.json`));
    const v3 = readFileSync(join(ORDNER, `v3.${name}.aims.json`), 'utf8');
    expect(`${JSON.stringify(nach(v2), null, 2)}\n`).toBe(v3);
  });

  it.each(namen)('%s: nur schemaVersion, antragAm, entscheidAm (und Entdeckung) kommen dazu', (name) => {
    const v2 = lies(join(ORDNER, `v2.${name}.aims.json`));
    const v3 = nach(v2);
    const ohne = structuredClone(v3);
    for (const s of ohne['kiSysteme'] as Obj[]) { delete s['antragAm']; delete s['entscheidAm']; }
    for (const f of ohne['feststellungen'] as Obj[]) delete f['entdecktAm'];
    expect({ ...ohne, schemaVersion: 2 }).toEqual(v2);
    // Entscheid gleich Freigabe; ein Antrag wird nie abgeleitet (Erfassung im Inventar ist kein belegter Antrag)
    for (const s of v3['kiSysteme'] as Obj[]) {
      if (s['entscheidAm'] !== undefined) expect(s['entscheidAm']).toBe((s['freigabe'] as Obj)['am']);
      expect(s['antragAm']).toBeUndefined();
    }
    expect((v3['kiSysteme'] as Obj[]).filter((s) => s['entscheidAm']).length).toBeGreaterThan(0);
  });

  // Erwartung geändert: Antrag bleibt leer statt Erfassungsdatum (Entscheid Orchestrator P14 M2), Entscheid unverändert
  it('Entscheid nur bei entschiedenem Status mit Freigabedatum; Antrag wird nie abgeleitet, ein vorhandener bleibt', () => {
    const p = nach({
      schemaVersion: 2,
      kiSysteme: [
        { id: 'KI-001', typ: 'saas', status: 'freigegeben', erfasstAm: '2026-09-01', freigabe: { von: 'P-001', am: '2026-09-15' } },
        { id: 'KI-002', typ: 'schatten', status: 'untersagt', erfasstAm: '2026-09-01', freigabe: { von: 'P-001', am: '2026-09-03' } },
        { id: 'KI-003', typ: 'eingekauft', status: 'eingeschraenkt', erfasstAm: '2026-10-01', freigabe: { von: 'P-001', am: '2026-09-20' } },
        { id: 'KI-004', typ: 'saas', status: 'in-pruefung', erfasstAm: '2026-09-01', freigabe: { von: 'P-001', am: '2026-09-15' } },
        { id: 'KI-005', typ: 'saas', status: 'freigegeben', erfasstAm: '2026-09-01' },
        { id: 'KI-006', typ: 'saas', status: 'freigegeben', erfasstAm: '2026-09-01', freigabe: { von: 'P-001', am: '2026-09-15' }, antragAm: '2026-08-20', entscheidAm: '2026-09-10' },
      ],
    });
    const k = (id: string) => (p['kiSysteme'] as Obj[]).find((s) => s['id'] === id)!;
    expect([k('KI-001')['antragAm'], k('KI-001')['entscheidAm']]).toEqual([undefined, '2026-09-15']);
    expect([k('KI-002')['antragAm'], k('KI-002')['entscheidAm']]).toEqual([undefined, '2026-09-03']);
    expect([k('KI-003')['antragAm'], k('KI-003')['entscheidAm']]).toEqual([undefined, '2026-09-20']);
    expect([k('KI-004')['antragAm'], k('KI-004')['entscheidAm']]).toEqual([undefined, undefined]);
    expect([k('KI-005')['antragAm'], k('KI-005')['entscheidAm']]).toEqual([undefined, undefined]);
    expect([k('KI-006')['antragAm'], k('KI-006')['entscheidAm']]).toEqual(['2026-08-20', '2026-09-10']);
  });

  // Erwartung geändert (P14 S4): Sekunden bleiben in entdecktAm, datum bleibt unverändert, wenn entdecktAm schon gesetzt ist
  it('Vorfall mit Uhrzeit im Datum: ganzer Zeitpunkt nach entdecktAm, Datum ohne Uhrzeit; eingedaemmtAm bleibt; andere Quellen unverändert', () => {
    const p = nach({
      schemaVersion: 2,
      feststellungen: [
        { id: 'F-001', quelle: 'vorfall', datum: '2026-11-03T09:40:00', eingedaemmtAm: '2026-11-03T15:10' },
        { id: 'F-002', quelle: 'beinahe-vorfall', datum: '2026-11-04' },
        { id: 'F-003', quelle: 'audit', datum: '2026-11-05T10:00' },
        { id: 'F-004', quelle: 'vorfall', datum: '2026-11-06T08:00', entdecktAm: '2026-11-06T07:30' },
        { id: 'F-005', quelle: 'beinahe-vorfall', datum: '2026-11-07T10:15:42+01:00' },
      ],
    });
    expect(p['feststellungen']).toEqual([
      { id: 'F-001', quelle: 'vorfall', datum: '2026-11-03', eingedaemmtAm: '2026-11-03T15:10', entdecktAm: '2026-11-03T09:40:00' },
      { id: 'F-002', quelle: 'beinahe-vorfall', datum: '2026-11-04' },
      { id: 'F-003', quelle: 'audit', datum: '2026-11-05T10:00' },
      { id: 'F-004', quelle: 'vorfall', datum: '2026-11-06T08:00', entdecktAm: '2026-11-06T07:30' },
      { id: 'F-005', quelle: 'beinahe-vorfall', datum: '2026-11-07', entdecktAm: '2026-11-07T10:15:42+01:00' },
    ]);
  });

  it('Auszug ohne die Listen bleibt unverändert; die Beschreibung nennt die Felder', () => {
    expect(nach({ schemaVersion: 2, risiken: [{ id: 'R-001' }] })).toEqual({ schemaVersion: 3, risiken: [{ id: 'R-001' }] });
    expect(nach({ schemaVersion: 2, kiSysteme: 'kaputt' })).toEqual({ schemaVersion: 3, kiSysteme: 'kaputt' });
    expect(schritt.beschreibung).toMatch(/Entscheid.*Antrag bleibt leer.*Entdeckung/);
  });

  it('eine Projektdatei der Version 2 lädt als Version 3 mit Entscheid, ohne Antrag', () => {
    const r = ladeProjektText(readFileSync(join(ORDNER, 'v2.praezisionsteile.de.aims.json'), 'utf8'));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.projekt.schemaVersion).toBe(3);
      const ki = r.projekt.kiSysteme.find((s) => s.id === 'KI-001')!;
      expect(ki.entscheidAm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ki.antragAm).toBeUndefined();
    }
  });
});
