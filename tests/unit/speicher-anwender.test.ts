// P10 Speicher für Anwender: Sicherung vor Migration (AF-004), nur lesend bei neuerer Version (AF-005), Speicherstand mit Zeit
// (AF-017), Browserspeicher leeren, befristen und Hinweis (AF-032); dazu Seitengrenze der Norm-PDF, Budget Q8 und die Nummer
// weggefallener Einträge bei der Reparatur (AF-010). Reine Einheitentests ohne Browser; die Bedienung prüft
// tests/e2e/app/speicher-anwender.e2e.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { GRENZEN, grenzPlatzhalter } from '../../src/eingang/grenzen.ts';
import { EingangsFehler } from '../../src/eingang/lesen.ts';
import { projektReparieren } from '../../src/app/import/laden.ts';
import { sicherungsName } from '../../src/app/speicher/datei.ts';
import {
  AUFBEWAHRUNG_TAGE, NurLesendFehler, PRAEFIX, ProjektSpeicher, SpeicherAdapter, leereBrowserspeicher,
  type DateiHandle, type DateiZugriff, type GeoeffneteDatei, type SpeicherErgebnis, type Zwischenstand,
} from '../../src/app/speicher/index.ts';
import { erstelleZustand } from '../../src/app/zustand/kern.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import { SCHEMA_VERSION, type Projekt } from '../../src/model/typen.ts';
import { seitenAusPdf, type PdfJs } from '../../src/normtexte/pdf-text.ts';

const REPO = join(import.meta.dirname, '..', '..');
const lies = (rel: string): string => readFileSync(join(REPO, rel), 'utf8');
const json = (rel: string) => JSON.parse(lies(rel)) as Record<string, unknown>;
const { setzeAppDaten } = await import('../../src/app/daten.ts');
setzeAppDaten({
  texte: { de: ladeTexte('de'), en: ladeTexte('en') }, kataloge: ladeKataloge(), gefuehrt: json('src/generiert/gefuehrt.json') as never,
  regeln: { regeln: parse(lies('src/regeln/pruefregeln.yaml')).regeln }, version: '1.0.0', gebaut: '', beispiele: [],
});
const S = await import('../../src/app/zustand/store.ts');
const { t, uiSprache } = await import('../../src/app/i18n.ts');
const { fehlerVerstaendlich } = await import('../../src/app/worker/fehlertext.ts');
const { liesNormPdf, setzePdfUmgebung } = await import('../../src/app/normtexte/pdf.ts');
const { tr, uhrzeitText } = await import('../../src/app/rahmen/text.ts');

const MIGRATION = 'tests/fixtures/migration';
const V1 = ['v1.muster-maschinenbau.de.aims.json', 'v1.muster-maschinenbau.en.aims.json', 'v1.praezisionsteile.de.aims.json', 'v1.praezisionsteile.en.aims.json'];
// Fixtures der jeweils aktuellen Schemaversion (seit P14 Version 3); ältere Versionen werden migriert und gesichert
const AKTUELL = V1.map((d) => d.replace('v1.', `v${SCHEMA_VERSION}.`));
const V2 = V1.map((d) => d.replace('v1.', 'v2.'));
const V99 = `${MIGRATION}/zu-neu.v99.aims.json`;

/** Attrappe des Dateizugriffs: liefert eine Datei beim Öffnen und merkt sich jedes Schreiben. */
class TestDatei implements DateiZugriff {
  readonly art = 'fallback' as const;
  offen: GeoeffneteDatei | null = null;
  geschrieben: { inhalt: string; vorschlag: string }[] = [];
  async oeffnen(): Promise<GeoeffneteDatei | null> {
    return this.offen;
  }
  async speichern(inhalt: string, vorschlag: string, _h?: DateiHandle): Promise<SpeicherErgebnis | null> {
    this.geschrieben.push({ inhalt, vorschlag });
    return { art: 'download', name: vorschlag };
  }
}

/** ProjektSpeicher mit den echten Lese- und Prüfwegen der App (store.ts), aber Attrappen für Datei und Zwischenspeicher */
function aufbau() {
  const datei = new TestDatei();
  const zwischen = new SpeicherAdapter();
  let jetzt = Date.parse('2027-01-15T10:00:00Z');
  const speicher = new ProjektSpeicher<Projekt>({
    datei, zwischen,
    schluesselVon: (p) => p.meta.projektId,
    dateinameVon: (p) => p.organisation.name || 'projekt',
    deserialisieren: S.deserialisieren,
    deserialisierenMitInfo: S.deserialisierenMitInfo,
    vorDemSpeichern: S.vorDemSpeichern,
    jetzt: () => new Date(jetzt),
    zeitgeber: { setTimeout: () => 0, clearTimeout: () => undefined },
  });
  return { datei, zwischen, speicher, zeit: (ms: number) => void (jetzt += ms) };
}

describe('AF-004 Sicherung vor jeder Migration', () => {
  it('Name der Sicherung: <name>.vor-v<X>.aims.json, Endungen nicht doppelt, Sonderzeichen bereinigt', () => {
    expect(sicherungsName('Muster AG.aims.json', 1)).toBe('Muster AG.vor-v1.aims.json');
    expect(sicherungsName('projekt.json', 2)).toBe('projekt.vor-v2.aims.json');
    expect(sicherungsName('a/b:c.aims.json', 1)).toBe('abc.vor-v1.aims.json');
    expect(sicherungsName('', 1)).toBe('projekt.vor-v1.aims.json');
  });

  it.each(V1)('%s: jede Migration liefert eine Sicherung mit dem unveränderten Text der Datei (4 von 4)', async (name) => {
    const text = lies(`${MIGRATION}/${name}`);
    const { datei, speicher } = aufbau();
    datei.offen = { name, inhalt: text };
    const r = await speicher.oeffnen();
    expect(r).not.toBeNull();
    expect(r!.sicherung).toEqual({ name: sicherungsName(name, 1), inhalt: text, von: 1, nach: SCHEMA_VERSION });
    expect(r!.sicherung!.name).toMatch(/\.vor-v1\.aims\.json$/);
    expect(r!.projekt.schemaVersion).toBe(SCHEMA_VERSION);
    expect(r!.nurLesen).toBeNull();
    // Nichts geschrieben, bevor die Person entscheidet
    expect(datei.geschrieben).toEqual([]);
    // Ablegen schreibt die Sicherung als eigene Datei (Download), das Original bleibt Text für Text gleich
    const a = await speicher.sicherungAblegen(r!.sicherung!);
    expect(a).toEqual({ art: 'download', name: sicherungsName(name, 1) });
    expect(datei.geschrieben).toEqual([{ inhalt: text, vorschlag: sicherungsName(name, 1) }]);
  });

  it.each(V2)('%s: ältere Version 2 wird migriert und gesichert', async (name) => {
    const text = lies(`${MIGRATION}/${name}`);
    const { datei, speicher } = aufbau();
    datei.offen = { name, inhalt: text };
    const r = await speicher.oeffnen();
    expect(r!.sicherung).toEqual({ name: sicherungsName(name, 2), inhalt: text, von: 2, nach: SCHEMA_VERSION });
    expect(datei.geschrieben).toEqual([]);
  });

  it.each(AKTUELL)('%s: aktuelle Version, keine Migration, keine Sicherung', async (name) => {
    const { datei, speicher } = aufbau();
    datei.offen = { name, inhalt: lies(`${MIGRATION}/${name}`) };
    expect((await speicher.oeffnen())!.sicherung).toBeNull();
  });

  it('Hinweis in DE und EN nennt beide Versionen und den Namen der Sicherung', () => {
    for (const sprache of ['de', 'en'] as const) {
      uiSprache.value = sprache;
      const text = t('laden.migriert_text', { von: 1, nach: 2, name: 'x.vor-v1.aims.json' });
      expect(text, sprache).toContain('1');
      expect(text, sprache).toContain('2');
      expect(text, sprache).toContain('x.vor-v1.aims.json');
      for (const k of ['migriert_titel', 'sicherung_ablegen', 'sicherung_verwerfen', 'sicherung_abgelegt', 'sicherung_vor_speichern']) expect(t(`laden.${k}`, { name: 'n' }), `${sprache} ${k}`).not.toMatch(/^laden\./);
    }
    uiSprache.value = 'de';
  });
});

describe('AF-005 Datei aus neuerer Version nur lesend', () => {
  it('Fixture v99 öffnet lesend; Änderungen, Zwischenspeichern und Speichern schreiben nichts (Schreibversuche 0)', async () => {
    const text = lies(V99);
    const { datei, zwischen, speicher } = aufbau();
    datei.offen = { name: 'zukunft.aims.json', inhalt: text };
    const r = await speicher.oeffnen();
    expect(r).not.toBeNull();
    expect(r!.nurLesen).toEqual({ version: 99, bekannt: SCHEMA_VERSION });
    expect(r!.sicherung).toBeNull();
    expect(r!.projekt.organisation.name).toBe('Zukunft AG');
    expect(speicher.status.nurLesen).toEqual({ version: 99, bekannt: SCHEMA_VERSION });
    // Schreibversuche: Änderung, Zwischenspeichern, Speichern, Speichern unter
    speicher.aendern({ ...r!.projekt, organisation: { ...r!.projekt.organisation, name: 'Geändert' } });
    await speicher.zwischenspeichern();
    await expect(speicher.speichern()).rejects.toBeInstanceOf(NurLesendFehler);
    await expect(speicher.speichernUnter()).rejects.toBeInstanceOf(NurLesendFehler);
    expect(speicher.status.ungespeichert).toBe(false);
    expect(speicher.aktuell!.organisation.name).toBe('Zukunft AG');
    expect(datei.geschrieben).toEqual([]);
    expect(await zwischen.schluessel('')).toEqual([]);
  });

  it('der Zustand der App sperrt jede Änderung am nur lesend geöffneten Projekt', () => {
    let lesend = true;
    const z = erstelleZustand({ gesperrt: () => lesend });
    const p = leeresProjekt({ sprache: 'de', mitIsms: false, modulAiAct: false });
    z.laden(p, false);
    z.aendere(['organisation', 'name'], 'X');
    z.aendereMit((e) => void (e.organisation.name = 'Y'));
    expect(z.projekt.value!.organisation.name).toBe(p.organisation.name);
    expect(z.ungespeichert.value).toBe(false);
    lesend = false;
    z.aendere(['organisation', 'name'], 'X');
    expect(z.projekt.value!.organisation.name).toBe('X');
  });

  it('neues Projekt und Wiederherstellen heben die Sperre auf', async () => {
    const { datei, speicher } = aufbau();
    datei.offen = { name: 'zukunft.aims.json', inhalt: lies(V99) };
    await speicher.oeffnen();
    speicher.neu(leeresProjekt({ sprache: 'de', mitIsms: false, modulAiAct: false }));
    expect(speicher.status.nurLesen).toBeNull();
  });

  it('zu-neu ohne lesbaren Inhalt bleibt ein Fehler; Datei ohne Version ebenso', () => {
    expect(() => S.deserialisierenMitInfo('[1]')).toThrow();
    expect(() => S.deserialisierenMitInfo(JSON.stringify({ meta: {}, schemaVersion: 'x' }))).toThrow();
    expect(S.deserialisierenMitInfo(lies(V99)).nurLesen).toEqual({ version: 99, bekannt: SCHEMA_VERSION });
  });

  it('Hinweis in DE und EN nennt die Dateiversion und die bekannte', () => {
    for (const sprache of ['de', 'en'] as const) {
      uiSprache.value = sprache;
      const text = t('laden.nur_lesen_text', { version: 99, bekannt: 2 });
      expect(text, sprache).toContain('99');
      for (const k of ['nur_lesen_titel', 'nur_lesen_gesperrt']) expect(t(`laden.${k}`), `${sprache} ${k}`).not.toMatch(/^laden\./);
      expect(t('kopf.nur_lesen')).not.toMatch(/^kopf\./);
    }
    uiSprache.value = 'de';
  });
});

describe('AF-017 Speicherstand mit Zeit', () => {
  it('Status trägt den Zeitpunkt der letzten Speicherung und des letzten Zwischenstands', async () => {
    const { speicher, zeit } = aufbau();
    speicher.neu(leeresProjekt({ sprache: 'de', mitIsms: false, modulAiAct: false }));
    expect(speicher.status).toMatchObject({ ungespeichert: true, gespeichertAm: null, letzterZwischenstand: null });
    await speicher.zwischenspeichern();
    expect(speicher.status.letzterZwischenstand).toBe('2027-01-15T10:00:00.000Z');
    zeit(60_000);
    await speicher.speichern();
    expect(speicher.status).toMatchObject({ ungespeichert: false, gespeichertAm: '2027-01-15T10:01:00.000Z' });
  });

  it('Uhrzeit in Ortszeit HH:MM, leer bei fehlender oder unlesbarer Angabe', () => {
    const d = new Date(2027, 0, 15, 9, 5);
    expect(uhrzeitText(d.toISOString())).toBe('09:05');
    expect(uhrzeitText(null)).toBe('');
    expect(uhrzeitText('kein Zeitpunkt')).toBe('');
  });

  it('Texte der Zeit in DE und EN', () => {
    for (const sprache of ['de', 'en'] as const) {
      uiSprache.value = sprache;
      expect(t('kopf.zeit_gespeichert', { zeit: '09:05' })).toContain('09:05');
      expect(t('kopf.zeit_zwischenstand', { zeit: '09:05' })).toContain('09:05');
    }
    uiSprache.value = 'de';
  });
});

describe('AF-032 Browserspeicher: leeren, befristen, abschalten, Hinweis', () => {
  const eintrag = (schluessel: string, inhalt: string, extra: Partial<Zwischenstand> = {}): Zwischenstand => ({ v: 1, schluessel, dateiname: `${schluessel}.aims.json`, geaendertAm: '2027-01-15T10:00:00.000Z', inhalt, ...extra });

  it('Leeren entfernt alle Schlüssel: Zwischenstände mit Projekt und Logo und das Normpaket', async () => {
    const zwischen = new SpeicherAdapter();
    const normpaket = new SpeicherAdapter();
    const logo = 'data:image/png;base64,iVBORw0KGgo=';
    const mitLogo = leeresProjekt({ sprache: 'de', mitIsms: false, modulAiAct: false });
    (mitLogo.organisation as unknown as Record<string, unknown>)['gestaltung'] = { logo: { png: logo, breite: 10, hoehe: 10 } };
    await zwischen.schreiben(`${PRAEFIX}p-1`, JSON.stringify(eintrag('p-1', JSON.stringify(mitLogo))));
    await zwischen.schreiben(`${PRAEFIX}p-2~sitzung`, JSON.stringify(eintrag('p-2~sitzung', '{}', { gesichertAm: '2027-01-14T10:00:00.000Z' })));
    await normpaket.schreiben('normpaket', JSON.stringify({ format: 'aims-normpaket', version: 1, teile: [], lizenz: {} }));
    expect(await zwischen.schluessel('')).toHaveLength(2);
    expect(JSON.stringify(await zwischen.lesen(`${PRAEFIX}p-1`))).toContain('iVBORw0KGgo');

    const r = await leereBrowserspeicher({ zwischen, normpaket });
    expect(r).toEqual({ zwischenstaende: 2, normpaket: 1 });
    expect(await zwischen.schluessel('')).toEqual([]);
    expect(await normpaket.schluessel('')).toEqual([]);
  });

  it('Leeren mit Ausnahme lässt genau den Zwischenstand dieses Projekts stehen', async () => {
    const zwischen = new SpeicherAdapter();
    await zwischen.schreiben(`${PRAEFIX}offen`, JSON.stringify(eintrag('offen', '{}')));
    await zwischen.schreiben(`${PRAEFIX}anderes`, JSON.stringify(eintrag('anderes', '{}')));
    await leereBrowserspeicher({ zwischen, behalte: 'offen' });
    expect(await zwischen.schluessel('')).toEqual([`${PRAEFIX}offen`]);
  });

  it('Schliessen ohne Sichern schreibt nichts mehr; mit Sichern bleibt ein Zwischenstand (Vorschlag beim Beenden)', async () => {
    const mit = aufbau();
    mit.speicher.neu(leeresProjekt({ sprache: 'de', mitIsms: false, modulAiAct: false, projektId: 'a' }));
    await mit.speicher.schliessen();
    expect(await mit.zwischen.schluessel('')).toEqual([`${PRAEFIX}a`]);
    expect(mit.speicher.aktuell).toBeNull();

    const ohne = aufbau();
    ohne.speicher.neu(leeresProjekt({ sprache: 'de', mitIsms: false, modulAiAct: false, projektId: 'b' }));
    await ohne.speicher.schliessen({ sichern: false });
    expect(await ohne.zwischen.schluessel('')).toEqual([]);
  });

  it('Schalter «keine Zwischenstände»: nichts wird abgelegt', async () => {
    const { speicher, zwischen } = aufbau();
    speicher.ohneZwischenspeicher = true;
    speicher.neu(leeresProjekt({ sprache: 'de', mitIsms: false, modulAiAct: false }));
    await speicher.zwischenspeichern();
    expect(await zwischen.schluessel('')).toEqual([]);
  });

  it('Befristung: gesicherte Stände älter als die Aufbewahrung fallen weg, jüngere und ungesicherte bleiben', async () => {
    const { speicher, zwischen } = aufbau();
    const tage = (n: number) => new Date(Date.parse('2027-01-15T10:00:00Z') - n * 86_400_000).toISOString();
    await zwischen.schreiben(`${PRAEFIX}alt`, JSON.stringify(eintrag('alt', '{}', { gesichertAm: tage(AUFBEWAHRUNG_TAGE + 1) })));
    await zwischen.schreiben(`${PRAEFIX}frisch`, JSON.stringify(eintrag('frisch', '{}', { gesichertAm: tage(AUFBEWAHRUNG_TAGE - 1) })));
    await zwischen.schreiben(`${PRAEFIX}offen`, JSON.stringify(eintrag('offen', '{}')));
    expect(await speicher.aufraeumen(AUFBEWAHRUNG_TAGE)).toBe(1);
    expect((await zwischen.schluessel('')).sort()).toEqual([`${PRAEFIX}frisch`, `${PRAEFIX}offen`]);
    expect(AUFBEWAHRUNG_TAGE).toBe(30);
  });

  it('die vier Bedienpunkte haben Texte in DE und EN; Befristung und Art stehen im Hinweis', () => {
    for (const sprache of ['de', 'en'] as const) {
      uiSprache.value = sprache;
      const hinweis = t('speicher_hinweis.text', { art: 'IndexedDB', tage: AUFBEWAHRUNG_TAGE });
      expect(hinweis, sprache).toContain('IndexedDB');
      expect(hinweis, sprache).toContain(String(AUFBEWAHRUNG_TAGE));
      expect(t('einstellungen.zwischenspeicher_datenschutz', { tage: AUFBEWAHRUNG_TAGE }), sprache).toContain(String(AUFBEWAHRUNG_TAGE));
      for (const k of ['speicher_hinweis.titel', 'speicher_hinweis.ok', 'speicher_hinweis.einstellungen', 'beenden.ungespeichert', 'beenden.leeren_frage', 'beenden.geleert', 'beenden.beendet', 'einstellungen.zwischenspeicher_aus', 'einstellungen.leeren_frage']) {
        expect(t(k), `${sprache} ${k}`).not.toBe(k);
      }
      expect(tr('projekt.beenden'), sprache).not.toBe('projekt.beenden');
      expect(t('einstellungen.geleert', { anzahl: 3, normpaket: 1 }), sprache).toContain('3');
    }
    uiSprache.value = 'de';
  });
});

describe('Seitengrenze der Norm-PDF vor dem Zerlegen (AF-018)', () => {
  const MAX = GRENZEN['norm-pdf'].maxSeiten;
  /** pdf.js-Attrappe mit n Seiten; zählt, wie viele Seiten gelesen werden */
  function pdfMit(n: number): { pdfjs: PdfJs; gelesen: () => number } {
    let gelesen = 0;
    const seite = { getViewport: () => ({ width: 100, height: 100 }), getTextContent: async () => ({ items: [] }), cleanup: () => undefined };
    return {
      gelesen: () => gelesen,
      pdfjs: { getDocument: () => ({ promise: Promise.resolve({ numPages: n, getPage: async () => { gelesen++; return seite; } }), destroy: async () => undefined }) },
    };
  }

  it('Grenze steht in der Konfiguration und im Platzhalter für die Texte', () => {
    expect(MAX).toBe(400);
    expect(grenzPlatzhalter('de')['grenze_norm_pdf_seiten']).toBe('400');
  });

  it('genau die Höchstzahl wird gelesen, eine Seite mehr bricht vor dem Auslesen ab', async () => {
    const ok = pdfMit(MAX);
    expect(await seitenAusPdf(ok.pdfjs, new Uint8Array(1))).toHaveLength(MAX);
    const zuViel = pdfMit(MAX + 1);
    const fehler = await seitenAusPdf(zuViel.pdfjs, new Uint8Array(1)).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(EingangsFehler);
    expect(fehler).toMatchObject({ art: 'norm-pdf', grund: 'zu-viele-seiten', grenze: MAX, wert: MAX + 1 });
    expect(zuViel.gelesen()).toBe(0);
  });

  it('Meldung in DE und EN nennt Zahl der Seiten und Grenze aus der Konfiguration', () => {
    const e = new EingangsFehler('norm-pdf', 'zu-viele-seiten', MAX, MAX + 1);
    for (const sprache of ['de', 'en'] as const) {
      uiSprache.value = sprache;
      const m = fehlerVerstaendlich(e);
      expect(m, sprache).toContain(String(MAX + 1));
      expect(m, sprache).toContain(String(MAX));
      expect(m, sprache).not.toBe(t('fehler.unbekannt'));
    }
    uiSprache.value = 'de';
  });

  it('der Hauptthread macht aus der Antwort des Workers wieder einen EingangsFehler', async () => {
    const hoerer: ((e: MessageEvent) => void)[] = [];
    const worker = { addEventListener: (typ: string, f: (e: MessageEvent) => void) => typ === 'message' && hoerer.push(f), removeEventListener: () => undefined, postMessage: (a: { nr: number }) => hoerer.forEach((f) => f({ data: { nr: a.nr, art: 'fehler', meldung: 'x', eingang: { grund: 'zu-viele-seiten', grenze: MAX, wert: MAX + 7 } } } as MessageEvent)), terminate: () => undefined };
    setzePdfUmgebung({ fabrik: () => worker as never });
    const e = await liesNormPdf(new Uint8Array(8)).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(EingangsFehler);
    expect(e).toMatchObject({ grund: 'zu-viele-seiten', wert: MAX + 7 });
    setzePdfUmgebung({});
  });

  it('die Fuzz-Spezifikation kennt keine offene Seitengrenze mehr und liest sie aus der Konfiguration', async () => {
    const { SPEZIFIKATION } = await import('../fuzz/spezifikation.ts');
    expect(SPEZIFIKATION['norm-pdf'].sollGrenze).toBeUndefined();
    expect(SPEZIFIKATION['norm-pdf'].maxAnzahl['seiten']).toBe(MAX);
  });
});

describe('Q8 Leistungsbudget 10 MB', () => {
  it('das Bauskript begrenzt auf 10 MB, nicht mehr auf 5,5 MB', () => {
    const s = lies('scripts/app-bauen.mts');
    expect(s).toContain('const BUDGET = 10_000_000;');
    expect(s).not.toContain('5_500_000');
    expect(s).toContain('BUDGET - 100_000');
  });
  it('der Leistungstest prüft dieselbe Grenze am gebauten Werkzeug', () => {
    expect(lies('tests/e2e/app/leistung.e2e.ts')).toContain('const GROESSE_MAX = 10_000_000;');
  });
});

describe('Reparatur einer v2-Datei ohne Zähler hält die Nummer weggefallener Einträge fest (AF-010)', () => {
  it('Kennung PE-0042 ist ungültig und wird geleert; die Nummer steht danach im Zähler (idMerken vor dem Leeren)', () => {
    const roh = json(`${MIGRATION}/v2.muster-maschinenbau.de.aims.json`);
    expect(roh['schemaVersion']).toBe(2);
    delete (roh['meta'] as Record<string, unknown>)['idZaehler'];
    ((roh['eigeneProzesse'] ??= []) as Record<string, unknown>[]).push({ id: 'PE-0042', titel: 'Alt', gruppe: 'kern', art: 'nur-aims' });
    const r = projektReparieren(roh);
    expect(r).not.toBeNull();
    expect((r!.projekt.eigeneProzesse ?? []).some((e) => e.id === 'PE-0042' || e.id === '')).toBe(false);
    expect(r!.projekt.meta.idZaehler?.eigeneProzesse).toBe(42);
  });
});
