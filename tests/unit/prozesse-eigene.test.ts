// Eigene Prozesse (PE-01 ff.), Prozesslandkarte nach Reife, Umfang Prozesse im internen Audit (D-20), Bahnen nach
// draw.io (entfernt markieren, Rolle zuordnen), Präfix der Dokumentkennung in Dateinamen. Ergänzt prozesse.test.ts.
import { describe, expect, it } from 'vitest';
import { dokumentSet } from '../../src/app/worker/set.ts';
import { inhaltsverzeichnis } from '../../src/app/worker/inhalt.ts';
import type { AblaufBlock, Block, DocxDokument, XlsxMappe } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { EigenerProzess, Projekt, Sprache } from '../../src/model/typen.ts';
import { drawioExport, drawioImportieren, drawioSeite, drawioSeitenLesen, type DrawioExportProzess } from '../../src/prozesse/drawio.ts';
import { projektDrawio, projektDrawioLesen } from '../../src/prozesse/drawio-projekt.ts';
import {
  anwendbar, bahnText, eigenerKatalogProzess, katalogAblauf, naechsteEigeneId, prozessKatalog, prozesseImProjekt, prozessTexte, rollenText, sichtImPfad,
} from '../../src/prozesse/katalog.ts';
import { REIFE_ROLLE } from '../../src/prozesse/landkarte.ts';
import { prozesseImAuditzyklus, prozessStaende, prozessUebersicht } from '../../src/prozesse/stand.ts';
import { attr, elemente, kind, parseXml, wurzel } from '../../src/prozesse/xml.ts';
import { PRUEFUNGEN, type PruefKontext } from '../../src/regeln/pruefungen.ts';
import { d02 } from '../../src/vorlagen/D-02.ts';
import { d20 } from '../../src/vorlagen/D-20.ts';
import { d21 } from '../../src/vorlagen/D-21.ts';
import { d27 } from '../../src/vorlagen/D-27.ts';
import { dateiPraefix } from '../../src/vorlagen/gestaltung.ts';
import type { VorlagenKontext } from '../../src/vorlagen/kontext.ts';
import { CONTROLS_42001, vollstaendigesProjekt } from '../fixtures/projekt.ts';

const kataloge = ladeKataloge();
const texte = { de: ladeTexte('de'), en: ladeTexte('en') };
const u = { de: erstelleUebersetzer('de', texte.de), en: erstelleUebersetzer('en', texte.en) };
const ctx = (projekt: Projekt, weitere: Partial<VorlagenKontext> = {}, sprache: Sprache = 'de'): VorlagenKontext => ({
  u: u[sprache], modus: 'firma', form: 'dokument', projekt, kataloge, kitVersion: 'test', ...weitere,
});
const text = (d: DocxDokument) => JSON.stringify(d.bloecke);
const ablaeufe = (d: DocxDokument) => d.bloecke.filter((b): b is AblaufBlock => b.typ === 'ablauf');
const ROLLEN = [...new Set(prozessKatalog(kataloge).prozesse.flatMap((p) => p.schritte.map((s) => s.bahn)))].map((r) => ({ schluessel: r, text: rollenText(u.de, r) }));

const PE01: EigenerProzess = { id: 'PE-01', titel: 'Kundenanfragen zu KI beantworten', zweck: 'Fragen von Kunden zu KI-Funktionen rasch und richtig beantworten.', gruppe: 'kern', art: 'nur-aims', normbezug: ['8.1', 'A.8.3'] };

/** Projekt mit eigenem Prozess PE-01 (Ablauf in zwei Bahnen, Reife definiert, Eigner P-001) */
function mitEigenem(): Projekt {
  const p = vollstaendigesProjekt();
  p.eigeneProzesse = [structuredClone(PE01)];
  p.prozesse = [
    {
      id: 'PE-01',
      eigner: 'P-001',
      reife: 1,
      bahnen: [{ id: 'fachbereich', rolle: 'fachbereich' }, { id: 'aims', rolle: 'aims' }],
      schritte: [
        { id: 'PE-01.00', art: 'start', text: 'Anfrage geht ein', bahn: 'fachbereich', naechste: ['PE-01.01'] },
        { id: 'PE-01.01', art: 'aufgabe', text: 'Anfrage erfassen', bahn: 'fachbereich', naechste: ['PE-01.02'], raci: { fachbereich: 'R', aims: 'A' } },
        { id: 'PE-01.02', art: 'entscheidung', text: 'Produktfunktion mit KI?', bahn: 'aims', naechste: ['PE-01.03', 'PE-01.90'], zweige: { 'PE-01.03': 'ja', 'PE-01.90': 'nein' } },
        { id: 'PE-01.03', art: 'aufgabe', text: 'Antwort mit Produktmanagement abstimmen', bahn: 'aims', naechste: ['PE-01.90'] },
        { id: 'PE-01.90', art: 'ende', text: 'Antwort versandt', bahn: 'fachbereich' },
      ],
    },
  ];
  return p;
}

describe('Eigene Prozesse im Katalog des Projekts', () => {
  it('Katalogeintrag: Verbindlichkeit eigen, immer im AIMS, ohne Kit-Dokumente und Ableitung; nach dem Katalog', () => {
    const p = mitEigenem();
    const alle = prozesseImProjekt(p, kataloge);
    expect(alle.at(-1)!.id).toBe('PE-01');
    expect(alle).toHaveLength(39);
    const kp = eigenerKatalogProzess({ ...PE01, art: 'nur-isms' });
    expect(kp).toMatchObject({ pflicht: 'eigen', eigen: true, kit_dokumente: [], ableitung: [], normbezug_42001: ['8.1', 'A.8.3'] });
    // auch als ISMS-Ablauf mit und ohne ISMS ein Prozess des AIMS-Managers (kein Verweis, keine Empfehlung)
    expect(sichtImPfad(kp, true)).toBe('aims');
    expect(sichtImPfad(kp, false)).toBe('aims');
    expect(anwendbar(p, kp)).toBe('ja');
    expect(prozesseImProjekt(null, kataloge)).toHaveLength(38);
  });

  it('Texte aus dem Projekt, Kennungen fortlaufend', () => {
    const p = mitEigenem();
    expect(prozessTexte(u.de, 'PE-01', p)).toMatchObject({ titel: PE01.titel, zweck: PE01.zweck, schritte: {} });
    expect(prozessTexte(u.de, 'PE-01')).toBeUndefined();
    expect(prozessTexte(u.de, 'PR-08', p)?.titel).toBe(prozessTexte(u.de, 'PR-08')?.titel);
    expect(naechsteEigeneId(p)).toBe('PE-02');
    expect(naechsteEigeneId(p, ['PE-02'])).toBe('PE-03');
    expect(naechsteEigeneId(vollstaendigesProjekt())).toBe('PE-01');
  });

  it('Stand und Dashboard: eigener Ablauf ergibt Reifevorschlag «definiert», zählt in der Übersicht', () => {
    const p = mitEigenem();
    const st = prozessStaende(p, kataloge, '2026-10-20');
    const pe = st.find((s) => s.id === 'PE-01')!;
    expect(pe).toMatchObject({ sicht: 'aims', anwendbar: 'ja', eigner: 'P-001', reife: 1, reifeVorschlag: 1, ueberfaellig: false });
    expect(prozessUebersicht(st).gesamt).toBe(prozessUebersicht(st.filter((s) => s.id !== 'PE-01')).gesamt + 1);
  });

  it('Prüfregeln: F31 und F32 nicht für eigene Prozesse ohne Eigner; H61 nach draw.io bis zur Zuordnung der Rolle', () => {
    const p = mitEigenem();
    delete p.prozesse![0]!.eigner;
    const k: PruefKontext = { projekt: p, heute: '2026-10-20', controlIds42001: CONTROLS_42001, aiActStand: '2026-07-27', kataloge };
    expect(PRUEFUNGEN['F31']!(k).map((t) => t.id)).not.toContain('PE-01');
    p.prozesse![0]!.anwendbar = 'nein';
    expect(PRUEFUNGEN['F32']!({ ...k }).map((t) => t.id)).toEqual(['PE-01']);
    p.prozesse![0]!.begruendung = 'Läuft im Vertrieb ausserhalb des AIMS';
    expect(PRUEFUNGEN['F32']!({ ...k }).map((t) => t.id)).toEqual([]);
    // Bahn ohne Rolle (Import aus draw.io): H61; nach Zuordnung der Rolle entfällt der Hinweis
    p.prozesse![0]!.anwendbar = 'ja';
    p.prozesse![0]!.bahnen![0] = { id: 'bahn-1', text: 'Vertrieb' };
    p.prozesse![0]!.schritte![0]!.bahn = 'bahn-1';
    p.prozesse![0]!.drawio = { roh: '<diagram id="PE-01"/>', hash: 'x', importiertAm: '2026-10-01T08:00:00Z', offen: { bahnen: ['bahn-1'], formen: [] } };
    expect(PRUEFUNGEN['H61']!({ ...k }).map((t) => t.id)).toEqual(['PE-01']);
    p.prozesse![0]!.bahnen![0]!.rolle = 'fachbereich';
    delete p.prozesse![0]!.drawio!.offen;
    expect(PRUEFUNGEN['H61']!({ ...k }).map((t) => t.id)).toEqual([]);
  });
});

describe('Eigene Prozesse in den Dokumenten', () => {
  it('D-02: in Tabelle und Landkarte ihrer Gruppe; leere Vorlage unverändert ohne eigene Prozesse', () => {
    const p = mitEigenem();
    const d = d02(ctx(p));
    expect(text(d)).toContain('PE-01 Kundenanfragen zu KI beantworten');
    const karte = ablaeufe(d).find((b) => b.knoten.some((x) => x.id === 'gruppe-kern'))!;
    expect(karte.knoten.find((x) => x.id === 'PE-01')).toBeDefined();
    const ohne = vollstaendigesProjekt();
    expect(text(d02(ctx(ohne)))).not.toContain('PE-01');
  });

  it('D-27: eigenes Kapitel mit Ablauf, Normbezug, ohne leere Katalogabschnitte; einzeln mit Titel', () => {
    const p = mitEigenem();
    const hb = d27(ctx(p));
    const kapitel = hb.bloecke.filter((b): b is Extract<Block, { typ: 'ueberschrift' }> => b.typ === 'ueberschrift' && b.ebene === 1).map((b) => b.text);
    expect(kapitel.some((x) => x.includes('PE-01 Kundenanfragen zu KI beantworten'))).toBe(true);
    const einzeln = d27(ctx(p, { prozessId: 'PE-01' }));
    const s = text(einzeln);
    expect(s).toContain('Antwort mit Produktmanagement abstimmen');
    expect(s).toContain('ISO/IEC 42001: 8.1, A.8.3');
    expect(s).toContain('eigener Prozess der Firma');
    expect(s).toContain('Noch keine Kennzahl festgelegt.');
    expect(s).not.toContain('Auslöser');
    expect(ablaeufe(einzeln)).toHaveLength(1);
    expect(ablaeufe(einzeln)[0]!.bahnen?.map((b) => b.id)).toEqual(['fachbereich', 'aims']);
    // Dateiname der Einzelbeschreibung mit dem Titel aus dem Projekt
    const set = dokumentSet(p, kataloge, 'de', ['D-27'], 'PE-01', prozessTexte(u.de, 'PE-01', p)!.titel);
    expect(set.dateien.map((x) => x.dateiname)).toEqual(['D-27_PE-01_Kundenanfragen-zu-KI-beantworten.docx']);
  });

  it('D-27 und D-02: Auslöser, Eingaben, Ausgaben, Dokumente, Kennzahl mit Sollwert und Schnittstellen des eigenen Prozesses', () => {
    const p = mitEigenem();
    Object.assign(p.eigeneProzesse![0]!, {
      ausloeser: ['Anfrage eines Kunden zu KI'],
      eingaben: ['Anfrage mit Kontext'],
      ausgaben: ['Antwort im Ticketsystem'],
      dokumente: ['D-14', 'D-22'],
      kennzahl: { text: 'Arbeitstage bis zur Antwort', einheit: 'tage', richtung: 'hoechstens', soll: 2 },
      schnittstellen: ['PR-18'],
      schnittstellenText: 'Jede Anfrage wird zugleich als Meldung im Register erfasst.',
    });
    const s = text(d27(ctx(p, { prozessId: 'PE-01' })));
    for (const t of ['Anfrage eines Kunden zu KI', 'Anfrage mit Kontext', 'Antwort im Ticketsystem', 'Arbeitstage bis zur Antwort. Sollwert: höchstens 2 Tage.', 'PR-18 Meldungen', 'Jede Anfrage wird zugleich als Meldung im Register erfasst.', 'D-14, D-22']) expect(s).toContain(t);
    expect(text(d02(ctx(p)))).toContain('D-14, D-22');
  });

  it('D-21: Landkarte nach Reife in der Anlage, feste Statusrollen, Stufe als Wort; eigener Prozess dabei', () => {
    const p = mitEigenem();
    const d = d21(ctx(p));
    const karte = ablaeufe(d).find((b) => b.knoten.some((x) => x.id === 'PE-01'));
    expect(karte).toBeDefined();
    const pe = karte!.knoten.find((x) => x.id === 'PE-01')!;
    expect(pe.text).toBe('PE-01 Kundenanfragen zu KI beantworten\ndefiniert');
    expect(pe.rolle).toBe(REIFE_ROLLE[1]);
    expect(REIFE_ROLLE).toEqual(['leer', 'status-info', 'status-warnung', 'status-gut', 'status-gut-stark']);
    // Jede Form nennt ihre Reife als Wort
    const woerter = ['nicht begonnen', 'definiert', 'eingeführt', 'wirksam', 'überprüft'];
    for (const kn of karte!.knoten.filter((x) => !x.id.startsWith('gruppe-'))) expect(woerter.some((w) => kn.text.endsWith(`\n${w}`)), kn.text).toBe(true);
    // Ohne Prozessstand keine Landkarte
    delete p.prozesse;
    delete p.eigeneProzesse;
    expect(ablaeufe(d21(ctx(p))).some((b) => b.knoten.some((x) => x.id.startsWith('PR-')))).toBe(false);
  });

  it('draw.io: eigener Prozess als Seite im Export aller Prozesse und in der Landkarte', () => {
    const p = mitEigenem();
    const r = projektDrawio(p, kataloge, u.de, { geaendert: p.meta.geaendert });
    const seiten = drawioSeitenLesen(r.text);
    expect(seiten.at(-1)!.id).toBe('PE-01');
    expect(seiten.at(-1)!.name).toBe('PE-01 Kundenanfragen zu KI beantworten');
    expect(seiten[0]!.xml).toContain('link="data:page/id,PE-01"');
  });
});

describe('draw.io: Import eines unbekannten Diagramms als eigener Prozess', () => {
  const fremd = (name: string, id = 'abc123') =>
    `<mxfile><diagram id="${id}" name="${name}"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
    '<mxCell id="l1" value="Vertrieb" style="swimlane;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="200" height="400" as="geometry"/></mxCell>' +
    '<mxCell id="a" value="Anfrage geht ein" style="ellipse;" vertex="1" parent="l1"><mxGeometry x="20" y="40" width="120" height="40" as="geometry"/></mxCell>' +
    '<mxCell id="b" value="Antwort schreiben" style="rounded=0;" vertex="1" parent="l1"><mxGeometry x="20" y="120" width="120" height="40" as="geometry"/></mxCell>' +
    '<mxCell id="c" value="Erledigt" style="ellipse;" vertex="1" parent="l1"><mxGeometry x="20" y="200" width="120" height="40" as="geometry"/></mxCell>' +
    '<mxCell id="k1" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry"/></mxCell>' +
    '<mxCell id="k2" edge="1" parent="1" source="b" target="c"><mxGeometry relative="1" as="geometry"/></mxCell>' +
    '</root></mxGraphModel></diagram></mxfile>';

  it('schlägt die nächste freie Kennung vor, Schritte und Rohdaten tragen sie; Titel aus dem Seitennamen', () => {
    const p = mitEigenem();
    const v = projektDrawioLesen(p, kataloge, u.de, new TextEncoder().encode(fremd('Kundenreklamation')), 'reklamation.drawio');
    expect(v).toHaveLength(1);
    expect(v[0]!.prozessId).toBeUndefined();
    expect(v[0]!.eigen).toEqual({ id: 'PE-02', titel: 'Kundenreklamation' });
    expect(v[0]!.schritte.map((s) => [s.id, s.art, s.text])).toEqual([
      ['PE-02.01', 'start', 'Anfrage geht ein'],
      ['PE-02.02', 'aufgabe', 'Antwort schreiben'],
      ['PE-02.03', 'ende', 'Erledigt'],
    ]);
    // Bahn «Vertrieb» passt zu keiner Rolle: offen bis zur Zuordnung in der App
    expect(v[0]!.offen.bahnen).toEqual(['bahn-1']);
    expect(v[0]!.roh).toContain('process="PE-02"');
    // Seitenname wie «Page-1» ergibt keinen Titelvorschlag
    expect(projektDrawioLesen(p, kataloge, u.de, new TextEncoder().encode(fremd('Page-1')), 'x.drawio')[0]!.eigen).toEqual({ id: 'PE-02', titel: '' });
    // Aus der Detailseite eines Prozesses: die Seite gehört zu diesem Prozess, kein Vorschlag
    const d = projektDrawioLesen(p, kataloge, u.de, new TextEncoder().encode(fremd('Kundenreklamation')), 'x.drawio', 'PE-01');
    expect(d[0]!.prozessId).toBe('PE-01');
    expect(d[0]!.eigen).toBeUndefined();
  });

  it('Datei aus einem anderen Projekt (PE-05): Kit-Formen erhalten die neue Kennung, der Export erkennt sie wieder', () => {
    const p = mitEigenem();
    const quelle: DrawioExportProzess = { id: 'PE-05', titel: 'Fremd', ablauf: { bahnen: p.prozesse![0]!.bahnen!, schritte: p.prozesse![0]!.schritte!.map((s) => ({ ...s, id: s.id.replace('PE-01', 'PE-05'), naechste: s.naechste?.map((z) => z.replace('PE-01', 'PE-05')), ...(s.zweige ? { zweige: Object.fromEntries(Object.entries(s.zweige).map(([z, t]) => [z.replace('PE-01', 'PE-05'), t])) } : {}) })), eigen: true }, bahnTexte: { fachbereich: 'Fachbereich', aims: 'AIMS' } };
    const datei = drawioExport([quelle]);
    const v = projektDrawioLesen(p, kataloge, u.de, new TextEncoder().encode(datei), 'fremd.drawio');
    expect(v[0]!.eigen?.id).toBe('PE-02');
    expect(v[0]!.roh).not.toContain('kitProzess="PE-05"');
    expect(v[0]!.schritte.every((s) => s.id.startsWith('PE-02.'))).toBe(true);
    // Export mit diesen Rohdaten ändert nichts (keine doppelten Formen, nichts als entfernt markiert)
    const neu = drawioSeite({ id: 'PE-02', titel: 'Fremd', ablauf: { bahnen: v[0]!.bahnen, schritte: v[0]!.schritte, eigen: true }, bahnTexte: Object.fromEntries(v[0]!.bahnen.map((b) => [b.id, b.text ?? b.id])), roh: v[0]!.roh });
    expect(neu).toBe(v[0]!.roh);
    expect(neu).not.toContain('entfernt');
  });
});

describe('draw.io: nicht mehr genutzte Bahnen', () => {
  it('Bahn ohne Schritt wird beim Einmischen grau als entfernt markiert und bei erneuter Nutzung wieder freigegeben', () => {
    const kp = prozessKatalog(kataloge).prozesse.find((x) => x.id === 'PR-07')!;
    const ablauf = katalogAblauf(u.de, kp);
    const p: DrawioExportProzess = { id: 'PR-07', titel: 'Freigabe', ablauf, bahnTexte: Object.fromEntries(ablauf.bahnen.map((b) => [b.id, bahnText(u.de, b)])) };
    const roh = drawioSeitenLesen(drawioExport([p]))[0]!.xml;
    const bahn = ablauf.bahnen.at(-1)!.id;
    const ziel = ablauf.bahnen[0]!.id;
    // Alle Schritte der letzten Bahn in die erste verschieben: die letzte Bahn ist nicht mehr beteiligt
    const verschoben = { ...ablauf, schritte: ablauf.schritte.map((s) => (s.bahn === bahn ? { ...s, bahn: ziel } : s)) };
    const neu = drawioSeite({ ...p, ablauf: verschoben, roh });
    const root = kind(kind(wurzel(parseXml(neu)), 'mxGraphModel'), 'root')!;
    const obj = elemente(root, 'object').find((o) => attr(o, 'id') === `PR-07:bahn:${bahn}`)!;
    expect(attr(obj, 'tags')).toBe('process removed');
    expect(attr(kind(obj, 'mxCell'), 'style')).toContain('opacity=40;');
    // Wieder genutzt: Markierung weg, Stil wie vorher
    const zurueck = drawioSeite({ ...p, ablauf, roh: neu });
    const root2 = kind(kind(wurzel(parseXml(zurueck)), 'mxGraphModel'), 'root')!;
    const obj2 = elemente(root2, 'object').find((o) => attr(o, 'id') === `PR-07:bahn:${bahn}`)!;
    expect(attr(obj2, 'tags')).toBe('process');
    expect(attr(kind(obj2, 'mxCell'), 'style')).not.toContain('opacity=40;');
    // Die übrigen Bahnen bleiben unmarkiert; erneuter Import liest die markierte Bahn nicht als offene Bahn
    const imp = drawioImportieren({ id: 'PR-07', name: '', xml: neu }, { rollen: ROLLEN });
    expect(imp.offen.bahnen).toEqual([]);
  });
});

describe('Internes Audit: Prozesse im Umfang (D-20, H63)', () => {
  const zeilen = (m: XlsxMappe) => m.blaetter[0]!.zeilen.map((z) => z.map(String).join(' | '));
  it('D-20 nennt die Prozesse im Umfang im Programm und im Auditplan; ohne Auswahl unverändert', () => {
    const p = vollstaendigesProjekt();
    const vorher = JSON.stringify(d20(ctx(p)));
    p.audits[0]!.umfangProzesse = [];
    expect(JSON.stringify(d20(ctx(p)))).toBe(vorher);
    p.audits[0]!.umfangProzesse = ['PR-08', 'PR-25'];
    const m = d20(ctx(p));
    expect(zeilen(m)[0]).toContain('alles; Prozesse im Umfang: PR-08, PR-25');
    expect(JSON.stringify(m.blaetter[1]!.zeilen)).toContain('Prozesse im Umfang: PR-08, PR-25');
    expect(zeilen(d20(ctx(p, {}, 'en')))[0]).toContain('processes in scope: PR-08, PR-25');
  });

  it('Zyklus: Audits der letzten 36 Monate und geplante; ein Audit ohne Auswahl umfasst alle', () => {
    const p = vollstaendigesProjekt();
    expect(prozesseImAuditzyklus(p, '2026-10-20')).toBeUndefined();
    p.audits[0]!.umfangProzesse = ['PR-08'];
    expect([...prozesseImAuditzyklus(p, '2026-10-20')!]).toEqual(['PR-08']);
    p.audits.push({ ...p.audits[0]!, id: 'AU-002', durchgefuehrt: undefined, geplant: '2028-01-10', umfangProzesse: ['PR-25'] });
    expect([...prozesseImAuditzyklus(p, '2026-10-20')!].sort()).toEqual(['PR-08', 'PR-25']);
    expect([...prozesseImAuditzyklus(p, '2030-01-01')!]).toEqual(['PR-25']);
    expect(prozesseImAuditzyklus(p, '2032-01-01')).toBeUndefined();
    p.audits[1]!.umfangProzesse = undefined;
    expect(prozesseImAuditzyklus(p, '2026-10-20')).toBeUndefined();
  });
});

describe('Präfix der Dokumentkennung in Dateinamen', () => {
  it('nur mit Wahl: Dateinamen und Inhaltsverzeichnis mit Präfix, Kennungen unverändert', () => {
    const p = vollstaendigesProjekt();
    const ohne = dokumentSet(p, kataloge, 'de').dateien;
    p.organisation.gestaltung = { kennungPraefix: 'AIMS-' };
    expect(dateiPraefix(p)).toBe('');
    expect(dokumentSet(p, kataloge, 'de').dateien.map((d) => d.dateiname)).toEqual(ohne.map((d) => d.dateiname));
    p.organisation.gestaltung.kennungPraefixDateien = true;
    expect(dateiPraefix(p)).toBe('AIMS-');
    const mit = dokumentSet(p, kataloge, 'de').dateien;
    expect(mit.map((d) => d.dateiname)).toEqual(ohne.map((d) => `AIMS-${d.dateiname}`));
    expect(mit.map((d) => d.id)).toEqual(ohne.map((d) => d.id));
    expect(mit.find((d) => d.id === 'D-07')!.dateiname).toBe('AIMS-D-07_Risikoregister.xlsx');
    // Inhaltsverzeichnis nennt die Dateinamen mit Präfix, die Kennung bleibt D-07
    const iv = inhaltsverzeichnis(p, texte.de, kataloge, 'de', 'test', mit, '2026-10-20');
    const zeile = iv.mappe.blaetter[0]!.zeilen.find((z) => z[0] === 'D-07')!;
    expect(zeile).toContain('AIMS-D-07_Risikoregister.xlsx');
    // Ungültiges Präfix wirkt nicht
    p.organisation.gestaltung.kennungPraefix = 'A/B';
    expect(dateiPraefix(p)).toBe('');
  });
});
