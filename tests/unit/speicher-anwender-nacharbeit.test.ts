// P10 Nacharbeit nach Prüfung: Rückfrage vor dem Überschreiben (N1), Sicherungsangebot beim Wechsel des Projekts (N2), nur lesend
// geöffnet sperrt Bibliothek und KI-Import (N3), Hinweis beim Beenden und ein Begriff in EN (N5), Grössenbudget Q8 und Release-Tore Q13 (N6).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Projekt } from '../../src/model/typen.ts';
import type { Sicherung } from '../../src/app/speicher/index.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';
import { beantworte } from '../fixtures/bestaetigen.ts';

/** Schreibvorgänge in aims-bibliothek (Dateien und Ordner-Merker) */
const idbSchreibt = { dateien: 0, griffe: 0 };
vi.mock('../../src/app/ansichten/bibliothek/idb.ts', () => ({
  idbDateien: {
    lesen: async () => undefined,
    schreiben: async () => void idbSchreibt.dateien++,
    loeschen: async () => void idbSchreibt.dateien++,
    schluessel: async () => [],
  },
  griffMerken: async () => void idbSchreibt.griffe++,
  griffLesen: async () => null,
}));

const REPO = join(import.meta.dirname, '..', '..');
const lies = (rel: string): string => readFileSync(join(REPO, rel), 'utf8');
const json = (rel: string) => JSON.parse(lies(rel));
const { setzeAppDaten } = await import('../../src/app/daten.ts');
setzeAppDaten({
  texte: { de: ladeTexte('de'), en: ladeTexte('en') }, kataloge: ladeKataloge(), gefuehrt: json('src/generiert/gefuehrt.json'),
  regeln: { regeln: parse(lies('src/regeln/pruefregeln.yaml')).regeln }, version: '1.0.0', gebaut: '', beispiele: [],
});
const { uiSprache, t } = await import('../../src/app/i18n.ts');
uiSprache.value = 'de';
const S = await import('../../src/app/zustand/store.ts');
const { speichern } = await import('../../src/app/rahmen/speichern.ts');
const B = await import('../../src/app/ansichten/bibliothek/zustand.ts');
const { kiImportGesperrt } = await import('../../src/app/ansichten/start/KiImport.tsx');
const { teilimportMoeglich } = await import('../../src/app/import/teilimport.ts');

const SICHERUNG: Sicherung = { name: 'a.vor-v1.aims.json', inhalt: '{}', von: 1, nach: 2 };
const neu = (): Projekt => JSON.parse(JSON.stringify(vollstaendigesProjekt())) as Projekt;
const LESEND = { version: 99, bekannt: 2 };
/** Aktuelle Meldung (der Typ wird nach dem Zurücksetzen auf null sonst zu eng) */
const meldung = () => S.meldung.value as { text: string; art: string } | null;

beforeEach(async () => {
  vi.stubGlobal('document', { createElement: () => ({ click: () => undefined, remove: () => undefined }), body: { append: () => undefined } });
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined });
  vi.stubGlobal('location', { hash: '' });
  if (!S.speicherStatus.value) await S.speicherStarten();
  const p = neu();
  S.holeSpeicher().neu(p);
  S.zustand.laden(p, true);
  S.meldung.value = null;
  S.migrationsSicherung.value = null;
  idbSchreibt.dateien = 0;
  idbSchreibt.griffe = 0;
});
afterEach(() => vi.unstubAllGlobals());

/** Speicher mit Dateihandle (File System Access): Speichern überschreibt das Original */
function direkt() {
  const sp = S.holeSpeicher();
  vi.spyOn(sp, 'status', 'get').mockReturnValue({ ...Object.getOwnPropertyDescriptor(Object.getPrototypeOf(sp), 'status')!.get!.call(sp), direkt: true });
  const speichernSpion = vi.spyOn(sp, 'speichern').mockResolvedValue({ art: 'datei', name: 'a.aims.json' });
  return { sp, speichernSpion };
}

describe('N1 Rückfrage vor dem Überschreiben: Abbrechen bricht ab', () => {
  it('Abbrechen speichert nichts, die Sicherung bleibt angeboten, die Meldung sagt es', async () => {
    const { speichernSpion } = direkt();
    S.migrationsSicherung.value = SICHERUNG;
    const frage = vi.fn((_text: string) => false);
    beantworte(frage);
    await speichern();
    expect(frage).toHaveBeenCalledTimes(1);
    expect(frage.mock.calls[0]![0]).toContain('Mit Abbrechen wird nichts gespeichert');
    expect(speichernSpion).not.toHaveBeenCalled();
    expect(S.migrationsSicherung.value).toEqual(SICHERUNG);
    expect(meldung()?.text).toContain('Nichts gespeichert');
  });

  it('OK legt zuerst die Sicherung ab und speichert danach', async () => {
    const { sp, speichernSpion } = direkt();
    const ablegen = vi.spyOn(sp, 'sicherungAblegen').mockResolvedValue({ art: 'download', name: SICHERUNG.name });
    S.migrationsSicherung.value = SICHERUNG;
    beantworte(() => true);
    await speichern();
    expect(ablegen).toHaveBeenCalledTimes(1);
    expect(S.migrationsSicherung.value).toBeNull();
    expect(speichernSpion).toHaveBeenCalledTimes(1);
  });

  it('OK, aber die Auswahl der Sicherung wird abgebrochen: das Original bleibt unberührt', async () => {
    const { sp, speichernSpion } = direkt();
    vi.spyOn(sp, 'sicherungAblegen').mockResolvedValue(null);
    S.migrationsSicherung.value = SICHERUNG;
    beantworte(() => true);
    await speichern();
    expect(speichernSpion).not.toHaveBeenCalled();
    expect(S.migrationsSicherung.value).toEqual(SICHERUNG);
  });

  it('«Ohne Sicherung weiterarbeiten» ist die ausdrückliche Wahl: danach speichert es ohne Rückfrage', async () => {
    const { speichernSpion } = direkt();
    S.migrationsSicherung.value = SICHERUNG;
    S.migrationsSicherung.value = null;
    const frage = vi.fn(() => false);
    beantworte(frage);
    await speichern();
    expect(frage).not.toHaveBeenCalled();
    expect(speichernSpion).toHaveBeenCalledTimes(1);
  });

  it('Texte in DE und EN sagen, was Abbrechen tut und wo es ohne Sicherung weitergeht', () => {
    uiSprache.value = 'de';
    expect(t('laden.sicherung_vor_speichern', { name: 'x' })).toMatch(/Abbrechen wird nichts gespeichert.*Ohne Sicherung weiterarbeiten/);
    uiSprache.value = 'en';
    expect(t('laden.sicherung_vor_speichern', { name: 'x' })).toMatch(/Cancel to save nothing.*Continue without a backup/);
    expect(t('laden.sicherung_nicht_gespeichert')).toContain('Nothing saved');
    uiSprache.value = 'de';
  });
});

describe('N2 Sicherungsangebot gilt nur für das geöffnete Projekt', () => {
  it('neues Projekt setzt es zurück', () => {
    S.migrationsSicherung.value = SICHERUNG;
    S.neuesProjekt({ sprache: 'de', mitIsms: false, modulAiAct: false });
    expect(S.migrationsSicherung.value).toBeNull();
  });
  it('Beispiel, Zwischenstand und KI-Import übernehmen ein Projekt über projektUebernehmen und setzen es zurück', () => {
    S.migrationsSicherung.value = SICHERUNG;
    S.projektUebernehmen(neu(), true);
    expect(S.migrationsSicherung.value).toBeNull();
  });
  it('die Quelle des Öffnens setzt das Angebot erst nach dem Übernehmen', () => {
    const start = lies('src/app/ansichten/start/Start.tsx');
    expect(start.indexOf('migrationsSicherung.value = r.sicherung')).toBeGreaterThan(start.indexOf('projektUebernehmen(r.projekt, false)'));
  });
});

describe('N3 nur lesend: Bibliothek und KI-Import gesperrt, 0 Schreibvorgänge', () => {
  const datei = () => new File([new Uint8Array([1, 2, 3])], 'nachweis.txt', { type: 'text/plain' });

  it('Gegenprobe: ohne Sperre schreibt Hochladen in die Bibliothek im Browser', async () => {
    B.browserNutzen();
    const r = await B.hochladen([datei()], 'nachweis');
    expect(r).toBeDefined();
    expect(idbSchreibt.dateien).toBeGreaterThan(0);
  });

  it('nur lesend: Hochladen, Einchecken, Browserspeicher, Ordner, Register, ZIP laden schreiben nichts und melden es', async () => {
    B.browserNutzen();
    const vorher = { ...idbSchreibt };
    S.speicherStatus.value = { ...(S.speicherStatus.value as NonNullable<typeof S.speicherStatus.value>), nurLesen: LESEND };
    expect(S.nurLesen.value).toEqual(LESEND);
    const aufrufe: [string, () => unknown][] = [
      ['hochladen', () => B.hochladen([datei()], 'eigene')],
      ['einchecken', () => B.einchecken({ id: 'X-001', art: 'eigene', titel: 'x', versionen: [] } as never, datei(), true)],
      ['browserNutzen', () => B.browserNutzen()],
      ['ordnerVerbinden', () => B.ordnerVerbinden()],
      ['ordnerFreigeben', () => B.ordnerFreigeben()],
      ['trennen', () => B.trennen()],
      ['registerSchreiben', () => B.registerSchreiben()],
      ['aendern', () => B.aendern((p) => void (p.organisation.name = 'X'))],
      ['wiederherstellen', () => B.wiederherstellen(datei())],
      ['firmendokumenteAblegen', () => B.firmendokumenteAblegen()],
      ['freigabeDateiErneuern', () => B.freigabeDateiErneuern('D-01')],
    ];
    for (const [name, f] of aufrufe) {
      S.meldung.value = null;
      await f();
      if (!['registerSchreiben', 'ordnerVerbinden', 'ordnerFreigeben'].includes(name)) expect(meldung()?.text, name).toContain('Bibliothek bleibt unverändert');
      expect(idbSchreibt, name).toEqual(vorher);
    }
    expect(S.projekt.value!.organisation.name).not.toBe('X');
    // Keine Erfolgsmeldung «Abgelegte Dateien»
    S.meldung.value = null;
    expect(await B.hochladen([datei()], 'eigene')).toBeUndefined();
    expect(meldung()?.art).toBe('info');
    expect(meldung()?.text).not.toMatch(/Abgelegte Dateien/);
    S.speicherStatus.value = { ...(S.speicherStatus.value as NonNullable<typeof S.speicherStatus.value>), nurLesen: null };
  });

  it('bibliothek.json im verbundenen Ordner: nur lesend 0 Schreibvorgänge, ohne Sperre 1', async () => {
    const schreiben = vi.fn(async (_pfad: string, _daten: Uint8Array) => ({}));
    B.ablage.value = { art: 'ordner', schreiben } as never;
    const status = S.speicherStatus.value as NonNullable<typeof S.speicherStatus.value>;
    // Gegenprobe: ohne Sperre schreibt das Register genau einmal in den Ordner
    await B.registerSchreiben();
    expect(schreiben).toHaveBeenCalledTimes(1);
    expect(schreiben.mock.calls[0]![0]).toBe('bibliothek.json');
    // Nur lesend: sofort und verzögert (Hintergrund) nichts, auch keine Meldung
    schreiben.mockClear();
    S.speicherStatus.value = { ...status, nurLesen: LESEND };
    S.meldung.value = null;
    await B.registerSchreiben();
    await B.registerSchreiben(false);
    await new Promise((ok) => setTimeout(ok, 1000));
    expect(schreiben).not.toHaveBeenCalled();
    expect(meldung()).toBeNull();
    S.speicherStatus.value = { ...status, nurLesen: null };
    B.ablage.value = null;
  });

  describe('KI-Import: Verhalten der Sperre', () => {
    const p = () => S.projekt.value as Projekt;
    const ganz = (id: string) => JSON.stringify({ ...p(), meta: { ...p().meta, projektId: id } });

    it('nur lesend: dieselbe Kennung (ganzes Projekt) ist gesperrt, ein fremdes Projekt nicht', () => {
      expect(kiImportGesperrt(p(), true, ganz(p().meta.projektId))).toBe(true);
      expect(kiImportGesperrt(p(), true, ganz('ein-anderes-projekt'))).toBe(false);
    });
    it('nur lesend: Teilimport (Auszug mit Kennung des offenen Projekts) ist gesperrt', () => {
      const auszug = JSON.stringify({ schemaVersion: p().schemaVersion, meta: { projektId: p().meta.projektId }, massnahmen: p().massnahmen });
      expect(teilimportMoeglich(p(), JSON.parse(auszug))).toBe(true);
      expect(kiImportGesperrt(p(), true, auszug)).toBe(true);
    });
    it('Gegenprobe: nicht nur lesend ist nichts gesperrt; ohne Projekt, leere Eingabe und kaputter Text auch nicht', () => {
      expect(kiImportGesperrt(p(), false, ganz(p().meta.projektId))).toBe(false);
      expect(kiImportGesperrt(null, true, ganz(p().meta.projektId))).toBe(false);
      expect(kiImportGesperrt(p(), true, '')).toBe(false);
      expect(kiImportGesperrt(p(), true, '{kaputt')).toBe(false);
    });
  });

  it('Texte in DE und EN', () => {
    for (const sprache of ['de', 'en'] as const) {
      uiSprache.value = sprache;
      for (const k of ['nur_lesen_bibliothek', 'nur_lesen_ki_import']) expect(t(`laden.${k}`), `${sprache} ${k}`).not.toBe(`laden.${k}`);
    }
    uiSprache.value = 'de';
  });
});

describe('N5 Beenden nennt die Bibliothek; ein Begriff für den Zwischenspeicher in EN', () => {
  it('Frage beim Beenden sagt, dass Dateien der Bibliothek im Browser bleiben (DE und EN)', () => {
    uiSprache.value = 'de';
    expect(t('beenden.leeren_frage')).toMatch(/Bibliothek im Browser.*bleiben/);
    uiSprache.value = 'en';
    expect(t('beenden.leeren_frage')).toMatch(/library files in the browser stay/);
    uiSprache.value = 'de';
  });
  it('neue EN-Texte nennen den Zwischenspeicher «interim storage» und den Zwischenstand «interim copy», nicht «temporary» oder «working version»', () => {
    const en = lies('src/i18n/en/app.yaml');
    expect(en).not.toMatch(/temporary storage/i);
    expect(en).not.toMatch(/working versions?/i);
  });
  it('Kommentar in leeren.ts behauptet nicht mehr, danach liege nichts im Browser', () => {
    const q = lies('src/app/speicher/leeren.ts');
    expect(q).not.toContain('liegt nichts mehr im Browser');
    expect(q).toContain('aims-bibliothek');
  });
});

describe('N6 Grössenbudget und Release-Tore', () => {
  it('Q8 Grösse: das Bauskript begrenzt den AIMS-Manager auf 10 MB (dezimal)', () => {
    const q = lies('scripts/app-bauen.mts');
    expect(q).toMatch(/const BUDGET = 10_000_000;/);
    expect(q).toContain('höchstens 10 MB');
  });
  it('Q13 Release-Tore: G36 und G37 laufen in «pruefen» und im Release-Lauf', () => {
    const alle = lies('scripts/pruefen/alle.mts');
    expect(alle).toContain("id: 'G36'");
    expect(alle).toContain("id: 'G37'");
    const paket = JSON.parse(lies('package.json')) as { scripts: Record<string, string> };
    expect(paket.scripts['pruefen:release']).toContain('version.mts --release');
    expect(paket.scripts['pruefen:release']).toContain('rechtsstand.mts --release');
  });
});

describe('N4 E2E ohne Auslassung nach Engine', () => {
  it('speicher-anwender.e2e.ts lässt keine Engine aus', () => {
    const q = lies('tests/e2e/app/speicher-anwender.e2e.ts');
    expect(q).not.toMatch(/browserName\s*!==\s*'chromium'/);
    expect(readdirSync(join(REPO, 'tests/e2e/app'))).toContain('speicher-anwender.e2e.ts');
  });
});
