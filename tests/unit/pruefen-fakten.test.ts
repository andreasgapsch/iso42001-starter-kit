// Tor G40 Faktenquelle und Einsetzen der Fakten (AF-072): Repo grün, eingepflanzte Fehler rot, eine Faktänderung in
// src/kataloge/fakten.yaml erreicht alle Stellen in DE und EN.
import { describe, expect, it } from 'vitest';
import { eingabeAusRepo, flach, pruefeFakten } from '../../scripts/pruefen/fakten.mts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { faktWert, setzeFaktenInText, UnbekannterFakt } from '../../src/kataloge/fakten.ts';
import { ladeFakten } from '../../src/kataloge/fakten-node.ts';

type Baum = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('Tor G40 Faktenquelle', () => {
  it('ist auf dem Repo grün', () => {
    expect(pruefeFakten(eingabeAusRepo()).map((b) => b.meldung)).toEqual([]);
  });

  it('erkennt Werte von Hand, fehlende Platzhalter, unbekannte Stellen und falsche Freigabestellen', () => {
    const e = eingabeAusRepo();
    const de = e.texte.de as Baum;
    const en = e.texte.en as Baum;
    de.vorlagen['D-14'].schwere_tabelle[1][2] = 'AIMS-Verantwortliche innert [[1 Arbeitstag]]';
    en.prozesse.prozesse['PR-19'].hilfe = 'From severity 3 the incident contact informs top management immediately.';
    de.prozesse.prozesse['PR-26'].kennzahl_methode = 'Entscheide gegen das Register D-22 (Blatt Verbesserungen)';
    de.vorlagen['D-06'].folgen_punkte[2] = 'Ein Risiko mit Auswirkung {hoch} für Menschen oder Gesellschaft löst sie aus.';
    de.vorlagen['D-08'].freigabe_text += ' {{fakt:vorfall.meldung}}';
    de.vorlagen['D-08'].zustaendigkeiten[0][1] += ' {{fakt:gibt.es.nicht}}';
    e.katalog.prozesse.find((p) => p.id === 'PR-09')!.schritte.find((s) => s.id === 'PR-09.09')!.bahn = 'aims';
    const m = pruefeFakten(e).map((b) => b.meldung);
    expect(m).toContain('vorlagen.D-14.schwere_tabelle.1.2: Wert «1 Arbeitstag» des Fakts vorfall.stufe2 von Hand; {{fakt:vorfall.stufe2}} verwenden oder Ausnahme mit Grund (de)');
    expect(m).toContain('Fakt vorfall.stufe2: Stelle vorlagen.D-14.schwere_tabelle liest den Fakt nicht über {{fakt:vorfall.stufe2}} (de)');
    expect(m).toContain('Fakt vorfall.stufe3: Stelle prozesse.prozesse.PR-19.hilfe liest den Fakt nicht über {{fakt:vorfall.stufe3}} (en)');
    expect(m).toContain('prozesse.prozesse.PR-19.hilfe: Wert «immediately» des Fakts vorfall.stufe4 von Hand; {{fakt:vorfall.stufe4}} verwenden oder Ausnahme mit Grund (en)');
    expect(m).toContain('prozesse.prozesse.PR-26.kennzahl_methode: Wert «Register D-22 (Blatt Verbesserungen)» des Fakts register.massnahmen von Hand; {{fakt:register.massnahmen}} verwenden oder Ausnahme mit Grund (de)');
    expect(m.some((x) => x.startsWith('vorlagen.D-06.folgen_punkte.2: Wert «Risiko mit Auswirkung'))).toBe(true);
    expect(m).toContain('vorlagen.D-08.freigabe_text: Platzhalter {{fakt:vorfall.meldung}} steht an keiner Stelle des Fakts; Stelle in src/kataloge/fakten.yaml nachtragen (de)');
    expect(m).toContain('vorlagen.D-08.zustaendigkeiten.0.1: unbekannter Fakt {{fakt:gibt.es.nicht}} (de)');
    expect(m).toContain('PR-09.09: Freigabe «abschaetzung» liegt bei aims (A: gl), laut Fakt freigabe.abschaetzung bei gl');
  });

  it('Freigabestellen mit «schritte» (P20): falsche Bahn und fehlender Schritt werden gemeldet', () => {
    const e = eingabeAusRepo();
    // Behandlungsplan wieder bei der AIMS-Verantwortung (wie D-26 vor P20) und Erklärung zur Anwendbarkeit ohne Freigabeschritt
    const pr08 = e.katalog.prozesse.find((p) => p.id === 'PR-08')!.schritte.find((s) => s.id === 'PR-08.07')!;
    pr08.bahn = 'aims';
    pr08.raci = { aims: 'A' };
    e.katalog.prozesse.find((p) => p.id === 'PR-10')!.schritte = e.katalog.prozesse.find((p) => p.id === 'PR-10')!.schritte.filter((s) => s.id !== 'PR-10.06');
    const m = pruefeFakten(e).map((b) => b.meldung);
    expect(m).toContain('PR-08.07: Freigabe «freigabe.behandlungsplan» liegt bei aims (A: aims), laut Fakt freigabe.behandlungsplan bei gl');
    expect(m).toContain('Fakt freigabe.soa: Katalogschritt PR-10.06 fehlt');
  });

  it('nimmt die gesetzliche Frist in der Ausnahme nicht als Wert von Hand', () => {
    const e = eingabeAusRepo();
    const ohneAusnahme = structuredClone(e.fakten);
    ohneAusnahme.fakten['vorfall.stufe3']!.ausnahmen = {};
    expect(pruefeFakten({ ...e, fakten: ohneAusnahme }).some((b) => b.meldung.startsWith('vorlagen.D-14.pflichten_tabelle'))).toBe(true);
  });

  it('meldet einen Fakt ohne Wert in einer Sprache', () => {
    const e = eingabeAusRepo();
    const f = structuredClone(e.fakten);
    f.fakten['vorfall.stufe3'] = { ...f.fakten['vorfall.stufe3']!, einheit: 'minuten' };
    expect(pruefeFakten({ ...e, fakten: f }).map((b) => b.meldung)).toContain('Fakt vorfall.stufe3: Unbekannte Einheit minuten im Fakt vorfall.stufe3 (de)');
  });
});

describe('Faktenquelle beim Laden der Texte', () => {
  const fakten = ladeFakten();

  it('setzt Zahl mit Einheit, Text und Grossschreibung ein; unbekannte Fakten werfen', () => {
    expect(faktWert(fakten, 'vorfall.stufe2', 'de')).toBe('1 Arbeitstag');
    expect(faktWert(fakten, 'vorfall.stufe3', 'en')).toBe('24 hours');
    expect(setzeFaktenInText('{{fakt:vorfall.erfassung|gross}} erfassen', 'de', fakten)).toBe('Am Tag der Meldung erfassen');
    expect(() => setzeFaktenInText('{{fakt:gibt.es.nicht}}', 'de', fakten)).toThrow(UnbekannterFakt);
  });

  it('lässt keinen Platzhalter in den geladenen Texten stehen', () => {
    for (const s of ['de', 'en'] as const) expect(JSON.stringify(ladeTexte(s))).not.toMatch(/\{\{fakt:/);
  });

  it('eine Faktänderung in einer Datei erreicht jede Stelle in DE und EN', () => {
    const anders = structuredClone(fakten);
    anders.fakten['vorfall.stufe2'] = { ...anders.fakten['vorfall.stufe2']!, wert: 4, einheit: 'stunden' };
    const roh = { de: ladeTexte('de', undefined, null), en: ladeTexte('en', undefined, null) };
    for (const s of ['de', 'en'] as const) {
      const neu = flach(ladeTexte(s, undefined, anders));
      const stellen = flach(roh[s]).filter(([, t]) => t.includes('{{fakt:vorfall.stufe2}}')).map(([k]) => k);
      expect(stellen.length).toBeGreaterThanOrEqual(4); // D-14 Schweregrade, Kommunikation (beide Pfade), PR-19
      const neuerWert = s === 'de' ? '4 Stunden' : '4 hours';
      for (const k of stellen) expect(neu.find(([x]) => x === k)![1], k).toContain(neuerWert);
    }
  });
});
