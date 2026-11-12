// Teilimport und KI-Ergebnis laufen über migriere() (AF-003). Über der echten Schemaversion 3 (P7 meta.idZaehler, P14 Antrag,
// Entscheid, Entdeckung) ist hier eine Version 4 simuliert: SCHEMA_VERSION ist auf 4 gesetzt und MIGRATIONEN erhält einen
// Testschritt 3 -> 4 (er ändert kitVersion und hängt an jeden Risikotitel « [v4]»). Ein Auszug der Version 1 durchläuft so die
// echten Schritte 1 -> 2 und 2 -> 3 und den Testschritt, einer der Version 2 den Schritt 2 -> 3 und den Testschritt, einer der
// Version 3 nur den Testschritt. Abgelehnt werden nur Dateien mit höherer oder fehlender schemaVersion.
// Erwartung geändert (P14): Simulation von Version 3 auf 4 angehoben, weil Version 3 jetzt echt ist (Begründung im Bericht P14).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/model/typen.ts', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../src/model/typen.ts')>()), SCHEMA_VERSION: 4 }));

const { MIGRATIONEN, fuerJedenEintrag, migriere, stufe } = await import('../../src/model/migrationen.ts');
const { SCHEMA_VERSION } = await import('../../src/model/typen.ts');
const { ladeKiErgebnis } = await import('../../src/app/import/ki-ergebnis.ts');
const { alles, teilimportAnwenden, teilimportMoeglich, teilimportPruefen, teilimportVersion, vergleiche } = await import('../../src/app/import/teilimport.ts');
import type { Projekt } from '../../src/model/typen.ts';

/** Beschreibungen der echten Schritte 1 -> 2 (meta.idZaehler) und 2 -> 3 (Antrag, Entscheid, Entdeckung) */
const ECHT = `1->2: ${MIGRATIONEN[0]!.beschreibung}`;
const ECHT3 = `2->3: ${MIGRATIONEN[1]!.beschreibung}`;
const TEST = '3->4: Testschritt Schemaversion 4';
MIGRATIONEN.push(
  stufe(3, 'Testschritt Schemaversion 4', (p) => {
    p['kitVersion'] = '1.0.0-migriert';
    fuerJedenEintrag(p, 'risiken', (r) => { r['titel'] = `${String(r['titel'])} [v4]`; });
  }),
);

type Objekt = Record<string, unknown>;
const text = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'migration', 'v1.praezisionsteile.de.aims.json'), 'utf8');
const v1 = () => JSON.parse(text) as Objekt;
/** Offenes Projekt der (simulierten) Version 4 */
const aktuell = () => migriere(v1()).projekt as unknown as Projekt;
const projektId = () => (v1()['meta'] as Objekt)['projektId'] as string;
const risiken = () => v1()['risiken'] as Objekt[];
/** Auszug im Stand der Version 1: R-001 unverändert, R-002 mit geänderter Beschreibung */
function auszugV1(extra: Objekt = { schemaVersion: 1 }): Objekt {
  const [r1, r2] = risiken();
  return { ...extra, meta: { projektId: projektId() }, risiken: [r1, { ...r2, beschreibung: 'Geänderte Beschreibung aus der KI-Antwort' }] };
}
const laden = (schluessel: string, sprache: 'de' | 'en') => ((parse(readFileSync(`src/i18n/${sprache}/app.yaml`, 'utf8')) as Record<string, Record<string, string>>)['laden'] ?? {})[schluessel.replace('laden.', '')];

describe('Aufbau der Simulation', () => {
  it('die Zielversion ist 4 und das v1-Fixture wird mit den echten Schritten und dem Testschritt gehoben', () => {
    expect(SCHEMA_VERSION).toBe(4);
    const m = migriere(v1());
    expect(m).toMatchObject({ vonVersion: 1, angewendet: [ECHT, ECHT3, TEST] });
    expect(m.projekt.schemaVersion).toBe(4);
    expect(((m.projekt['risiken'] as Objekt[])[0] as Objekt)['titel']).toMatch(/ \[v4\]$/);
  });
});

describe('Teilimport', () => {
  it('nimmt die Antwort im Stand der Version 1 bei Schemaversion 4 an und migriert sie', () => {
    const p = aktuell();
    const daten = auszugV1();
    expect(teilimportMoeglich(p, daten)).toBe(true);
    const v = teilimportVersion(daten);
    expect(v).toMatchObject({ ok: true, vonVersion: 1, migrationen: [ECHT, ECHT3, TEST] });
    if (!v.ok) return;
    expect(v.daten['schemaVersion']).toBe(4);
    expect(daten['schemaVersion']).toBe(1);
  });

  it('der Vergleich arbeitet auf dem migrierten Stand: unveränderte Einträge bleiben gleich, nur der geänderte erscheint', () => {
    const p = aktuell();
    const v = vergleiche(p, auszugV1());
    expect(v.listen).toEqual([{ liste: 'risiken', eintraege: [{ id: 'R-002', titel: expect.stringContaining('[v4]'), art: 'geaendert' }], gleich: 1 }]);
  });

  it('Anwenden und Prüfen übernehmen die gewählten Einträge im migrierten Stand; das Ergebnis ist schemagültig', () => {
    const p = aktuell();
    const daten = auszugV1();
    const auswahl = alles(vergleiche(p, daten));
    const r = teilimportPruefen(p, daten, auswahl);
    expect(r.ok, r.ok ? '' : r.details.join('; ')).toBe(true);
    if (!r.ok) return;
    const neu = r.projekt.risiken.find((x) => x.id === 'R-002')!;
    expect(neu.beschreibung).toBe('Geänderte Beschreibung aus der KI-Antwort');
    expect(neu.titel).toMatch(/ \[v4\]$/);
    expect(r.projekt.risiken.find((x) => x.id === 'R-001')).toEqual(p.risiken.find((x) => x.id === 'R-001'));
    expect(teilimportAnwenden(p, daten, auswahl).risiken).toHaveLength(p.risiken.length);
  });

  it('Auszug im Stand der Version 1: der echte Schritt setzt meta.idZaehler aus dem Auszug, das offene Projekt behält seinen Zähler', () => {
    const p = aktuell();
    const v = teilimportVersion(auszugV1());
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect((v.daten['meta'] as Objekt)['idZaehler']).toEqual({ risiken: 2 });
    const r = teilimportAnwenden(p, auszugV1(), alles(vergleiche(p, auszugV1())));
    expect(r.meta.idZaehler).toEqual(p.meta.idZaehler);
    expect(r.meta.idZaehler?.risiken).toBe(14);
  });

  it('Auszug im Stand der Version 2 (Fixture v2) durchläuft den Schritt 2 -> 3 und den Testschritt und wird angenommen', () => {
    const v2 = JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'migration', 'v2.praezisionsteile.de.aims.json'), 'utf8')) as Objekt;
    const [r1, r2] = v2['risiken'] as Objekt[];
    const daten = { schemaVersion: 2, meta: { projektId: projektId() }, risiken: [r1, { ...r2, beschreibung: 'Geänderte Beschreibung (Version 2)' }] };
    const p = aktuell();
    expect(teilimportMoeglich(p, daten)).toBe(true);
    expect(teilimportVersion(daten)).toMatchObject({ ok: true, vonVersion: 2, migrationen: [ECHT3, TEST] });
    expect(vergleiche(p, daten).listen).toEqual([{ liste: 'risiken', eintraege: [{ id: 'R-002', titel: expect.stringContaining('[v4]'), art: 'geaendert' }], gleich: 1 }]);
    const r = teilimportPruefen(p, daten, alles(vergleiche(p, daten)));
    expect(r.ok, r.ok ? '' : r.details.join('; ')).toBe(true);
    if (r.ok) expect(r.projekt.risiken.find((x) => x.id === 'R-002')!.beschreibung).toBe('Geänderte Beschreibung (Version 2)');
  });

  it('Auszug im Stand der Version 3 (Fixture v3) durchläuft nur den Testschritt und wird angenommen', () => {
    const v3 = JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'migration', 'v3.praezisionsteile.de.aims.json'), 'utf8')) as Objekt;
    const [r1, r2] = v3['risiken'] as Objekt[];
    const daten = { schemaVersion: 3, meta: { projektId: projektId() }, risiken: [r1, { ...r2, beschreibung: 'Geänderte Beschreibung (Version 3)' }] };
    expect(teilimportVersion(daten)).toMatchObject({ ok: true, vonVersion: 3, migrationen: [TEST] });
    const r = teilimportPruefen(aktuell(), daten, alles(vergleiche(aktuell(), daten)));
    expect(r.ok, r.ok ? '' : r.details.join('; ')).toBe(true);
  });

  it('die komplette Datei der Version 1 geht ebenso als Teilimport durch', () => {
    const p = aktuell();
    expect(teilimportMoeglich(p, v1())).toBe(true);
    expect(vergleiche(p, v1()).listen.every((l) => l.eintraege.length === 0)).toBe(true);
  });

  it('Antwort der aktuellen Version läuft unverändert durch (kein zweites Migrieren)', () => {
    const p = aktuell();
    const daten = auszugV1({ schemaVersion: 4 });
    (daten['risiken'] as Objekt[])[0]!['titel'] = (p.risiken[0] as unknown as Objekt)['titel'];
    expect(teilimportVersion(daten)).toMatchObject({ ok: true, vonVersion: 4, migrationen: [] });
    expect(vergleiche(p, daten).listen[0]).toMatchObject({ gleich: 1 });
  });

  it('lehnt eine höhere Version mit Meldung ab (zu neu)', () => {
    const daten = auszugV1({ schemaVersion: 5 });
    expect(teilimportMoeglich(aktuell(), daten)).toBe(false);
    const v = teilimportVersion(daten);
    expect(v).toMatchObject({ ok: false, art: 'zu-neu', version: 5, meldungSchluessel: 'laden.zu-neu' });
    if (!v.ok) {
      expect(v.meldung).toContain('5');
      for (const s of ['de', 'en'] as const) expect(laden(v.meldungSchluessel, s), s).toBeTruthy();
    }
  });

  it.each([[{}], [{ schemaVersion: '1' }], [{ schemaVersion: 0 }], [{ schemaVersion: null }], [{ schemaVersion: 1.5 }]])('lehnt fehlende oder ungültige Version mit Meldung ab (%j)', (version) => {
    const daten = auszugV1(version);
    expect(teilimportMoeglich(aktuell(), daten)).toBe(false);
    const v = teilimportVersion(daten);
    expect(v).toMatchObject({ ok: false, art: 'keine-version', version: null, meldungSchluessel: 'laden.keine-version' });
    if (!v.ok) for (const s of ['de', 'en'] as const) expect(laden(v.meldungSchluessel, s), s).toBeTruthy();
  });

  it('meldet eine Lücke der Kette mit Meldung (luecke)', () => {
    // Datei der Version 1 bei Zielversion 2, aber ohne Schritt: nur durch Entfernen des Testschritts zu erzeugen
    const schritt = MIGRATIONEN.splice(0, MIGRATIONEN.length);
    try {
      const v = teilimportVersion(auszugV1());
      expect(v).toMatchObject({ ok: false, art: 'luecke', version: 1, meldungSchluessel: 'laden.luecke' });
      if (!v.ok) for (const s of ['de', 'en'] as const) expect(laden(v.meldungSchluessel, s), s).toBeTruthy();
    } finally {
      MIGRATIONEN.push(...schritt);
    }
  });

  it('Daten ohne Objekt sind kein Projekt; fremde projektId und fehlendes Projekt verhindern den Teilimport', () => {
    expect(teilimportVersion('text')).toMatchObject({ ok: false, art: 'kein-projekt', meldungSchluessel: 'laden.kein-projekt' });
    expect(teilimportVersion([1])).toMatchObject({ ok: false, art: 'kein-projekt' });
    expect(teilimportMoeglich(aktuell(), { ...auszugV1(), meta: { projektId: 'anderes' } })).toBe(false);
    expect(teilimportMoeglich(null, auszugV1())).toBe(false);
    expect(teilimportMoeglich(aktuell(), { schemaVersion: 1 })).toBe(false);
  });

  it('Anwenden einer nicht hebbaren Antwort lässt die Daten unverändert (die Ablehnung meldet teilimportMoeglich)', () => {
    const p = aktuell();
    const daten = auszugV1({});
    expect(vergleiche(p, daten).listen[0]).toMatchObject({ gleich: 0 });
  });

  it('die Meldungstexte der Ablehnung gibt es in DE und EN', () => {
    for (const art of ['keine-version', 'zu-neu', 'luecke', 'kein-projekt']) for (const s of ['de', 'en'] as const) expect(laden(art, s), `${s} ${art}`).toBeTruthy();
  });
});

describe('Meldung bei fehlender Version im KI-Import', () => {
  it('nennt, was zu tun ist, in DE und EN', () => {
    for (const s of ['de', 'en'] as const) {
      const t = ((parse(readFileSync(`src/i18n/${s}/app.yaml`, 'utf8')) as Record<string, Record<string, string>>)['ki_import'] ?? {})['keine_version'];
      expect(t, s).toMatch(/schemaVersion/);
      expect(t, s).toMatch(/meta\.projektId/);
    }
  });

  it('ein Auszug ohne Version wird abgelehnt (keine Vorschau), die Meldung gehört zur Art keine-version', () => {
    const daten = auszugV1({});
    expect(teilimportMoeglich(aktuell(), daten)).toBe(false);
    expect(ladeKiErgebnis(JSON.stringify(daten))).toMatchObject({ ok: false, art: 'keine-version' });
  });
});

describe('KI-Ergebnis', () => {
  const alsText = (d: Objekt) => JSON.stringify(d);

  it('nimmt eine Antwort im Stand der Version 1 bei Schemaversion 4 an und meldet die Migration', () => {
    const r = ladeKiErgebnis(alsText(v1()));
    expect(r.ok, r.ok ? '' : `${r.art} ${r.details.join('; ')}`).toBe(true);
    if (!r.ok) return;
    expect(r.vonVersion).toBe(1);
    expect(r.migrationen).toEqual([ECHT, ECHT3, TEST]);
    expect(r.projekt.schemaVersion).toBe(4);
    expect(r.projekt.risiken[0]!.titel).toMatch(/ \[v4\]$/);
  });

  it('liest auch Text mit Erklärung und Codeblock', () => {
    const r = ladeKiErgebnis(`Hier ist die Datei:\n\n\`\`\`json\n${alsText(v1())}\n\`\`\`\n`);
    expect(r).toMatchObject({ ok: true, vonVersion: 1 });
  });

  it('lehnt eine höhere Version mit Meldung ab', () => {
    const r = ladeKiErgebnis(alsText({ ...v1(), schemaVersion: 5 }));
    expect(r).toMatchObject({ ok: false, art: 'zu-neu', version: 5 });
    if (!r.ok) {
      // Die Meldung kommt aus dem Schlüssel laden.<art> in DE und EN; die Versionszahl steht in version, der Rohtext in technik
      expect(r.details).toEqual([]);
      expect((r as { technik?: string }).technik).toContain('5');
      for (const s of ['de', 'en'] as const) expect(laden(`laden.${r.art}`, s), s).toBeTruthy();
    }
  });

  it('lehnt eine fehlende Version mit Meldung ab', () => {
    const ohne = v1();
    delete ohne['schemaVersion'];
    const r = ladeKiErgebnis(alsText(ohne));
    expect(r).toMatchObject({ ok: false, art: 'keine-version', version: null });
    if (!r.ok) expect((r as { technik?: string }).technik).toBeTruthy();
    expect(ladeKiErgebnis('{"meta": {}}')).toMatchObject({ ok: false, art: 'keine-version' });
  });
});
