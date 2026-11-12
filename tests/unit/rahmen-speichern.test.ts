// AF-014, AF-048 (Nacharbeit): Speichern aus dem Rahmen (src/app/rahmen/speichern.ts): Meldungen bei Schreibfehlern,
// Reparaturvorschlag mit Bestätigung, Rettungsdatei bei nicht reparierbarer Datei. Download und Rückfrage sind ersetzt.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';
import { beantworte } from '../fixtures/bestaetigen.ts';

const heruntergeladen: { daten: unknown; name: string }[] = [];
vi.mock('../../src/app/worker/client.ts', async (orig) => ({
  ...(await orig<object>()),
  herunterladen: (daten: unknown, name: string) => heruntergeladen.push({ daten, name }),
}));
const steuerung = { reparaturNull: false };
vi.mock('../../src/app/import/laden.ts', async (orig) => {
  const o = await orig<typeof import('../../src/app/import/laden.ts')>();
  return { ...o, projektReparieren: (...a: Parameters<typeof o.projektReparieren>) => (steuerung.reparaturNull ? null : o.projektReparieren(...a)) };
});

const REPO = join(import.meta.dirname, '..', '..');
const json = (rel: string) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
const { setzeAppDaten } = await import('../../src/app/daten.ts');
setzeAppDaten({
  texte: { de: ladeTexte('de'), en: ladeTexte('en') }, kataloge: ladeKataloge(), gefuehrt: json('src/generiert/gefuehrt.json'),
  regeln: { regeln: parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')).regeln }, version: '1.0.0', gebaut: '', beispiele: [],
});
const { uiSprache, t } = await import('../../src/app/i18n.ts');
uiSprache.value = 'de';
const S = await import('../../src/app/zustand/store.ts');
const { speichern } = await import('../../src/app/rahmen/speichern.ts');

const neu = (): Projekt => JSON.parse(JSON.stringify(vollstaendigesProjekt())) as Projekt;
const klicks: string[] = [];
let schreibfehler: Error | null = null;

function dokumentAufbauen(): void {
  vi.stubGlobal('document', {
    createElement: () => ({
      click: () => {
        if (schreibfehler) throw schreibfehler;
        klicks.push('download');
      },
      remove: () => undefined,
    }),
    body: { append: () => undefined },
  });
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined });
}

beforeEach(async () => {
  heruntergeladen.length = 0;
  klicks.length = 0;
  schreibfehler = null;
  steuerung.reparaturNull = false;
  dokumentAufbauen();
  vi.stubGlobal('location', { hash: '' });
  if (!S.speicherStatus.value) await S.speicherStarten();
  const p = neu();
  S.holeSpeicher().neu(p);
  S.zustand.laden(p, true);
  S.meldung.value = null;
});
afterEach(() => vi.unstubAllGlobals());

describe('speichern(): Meldungen', () => {
  it('Download: Meldung «gespeichert» mit Dateiname', async () => {
    await speichern();
    expect(klicks).toEqual(['download']);
    expect(S.meldung.value).toMatchObject({ art: 'ok' });
    expect(S.meldung.value!.text).toContain('.aims.json');
  });
  it.each([
    ['NoModificationAllowedError', 'x', 'kopf.schreibfehler_recht'],
    ['NotAllowedError', 'x', 'kopf.schreibfehler_recht'],
    ['Error', 'Schreibrecht für die Datei verweigert', 'kopf.schreibfehler_recht'],
    ['QuotaExceededError', 'x', 'kopf.schreibfehler_voll'],
    ['Error', 'irgendein Rohtext 4711', 'kopf.schreibfehler_allgemein'],
  ])('Schreibfehler %s «%s»: Klartext mit nächstem Schritt, ohne Rohtext', async (name, text, schluessel) => {
    schreibfehler = Object.assign(new Error(text), { name });
    await speichern(true);
    const m = S.meldung.value!;
    expect(m.art).toBe('fehler');
    expect(m.text).toContain(t(schluessel));
    expect(m.text).not.toContain('4711');
  });
});

describe('speichern(): Prüfung vor dem Speichern', () => {
  const beschaedigen = () => {
    S.aendereMit((p) => {
      p.kiSysteme[0]!.name = 'x'.repeat(600);
    });
  };
  it('Reparatur abgelehnt: nichts geschrieben, Änderungen genannt, Eingabe bleibt', async () => {
    beschaedigen();
    beantworte(() => false);
    await speichern();
    expect(klicks).toEqual([]);
    expect(S.meldung.value!.art).toBe('fehler');
    expect(S.meldung.value!.text).toContain(t('kopf.repariert_abbruch'));
    expect(S.projekt.value!.kiSysteme[0]!.name).toHaveLength(600);
  });
  it('Reparatur bestätigt: Vorschlag gilt, neue Datei geschrieben, Meldung nennt die Änderungen', async () => {
    beschaedigen();
    const frage = vi.fn((_text: string) => true);
    beantworte(frage);
    await speichern();
    expect(frage.mock.calls[0]![0]).toContain(t('kopf.repariert_frage'));
    expect(klicks).toEqual(['download']);
    expect(S.projekt.value!.kiSysteme[0]!.name.length).toBeLessThanOrEqual(500);
    expect(S.meldung.value!.text).toContain(t('kopf.repariert'));
  });
  it('Reparatur bestätigt, Schreiben schlägt fehl: Meldung mit Klartext', async () => {
    beschaedigen();
    beantworte(() => true);
    schreibfehler = Object.assign(new Error('x'), { name: 'NotAllowedError' });
    await speichern();
    expect(S.meldung.value!.art).toBe('fehler');
    expect(S.meldung.value!.text).toContain(t('kopf.schreibfehler_recht'));
  });
  it('nicht reparierbar: Rettungsdatei mit allen Rohdaten wird heruntergeladen, die Datei nicht geschrieben', async () => {
    beschaedigen();
    const roh = JSON.stringify(S.projekt.value);
    steuerung.reparaturNull = true;
    await speichern();
    expect(klicks).toEqual([]);
    expect(heruntergeladen).toHaveLength(1);
    expect(heruntergeladen[0]!.name).toMatch(/^AIMS-Rettung_\d{4}-\d{2}-\d{2}\.rettung\.json$/);
    expect(JSON.parse(heruntergeladen[0]!.daten as string)).toEqual(JSON.parse(roh));
    expect(S.meldung.value!.art).toBe('fehler');
    expect(S.meldung.value!.text).toContain(heruntergeladen[0]!.name);
  });
});
