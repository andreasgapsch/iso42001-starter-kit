// Prozesse (Plan Prozesse 5, 6, 8): Katalog im Projekt (Pfade, Anwendbarkeit, Eigner), Status (abgeleitete Durchführung,
// Fälligkeit, Reifevorschlag, Massnahmen), Layout mit Bahnen (SVG und DOCX aus einem Raster), Landkarte und D-02 aus dem
// Katalog, D-27 Prozessbeschreibungen, D-21 mit Prozessstand, Dokumentset, draw.io-Export aller Prozesse, Datenblöcke der App.
import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { lazyBloecke, type AppDaten } from '../../src/app/daten.ts';
import { dokumentSet } from '../../src/app/worker/set.ts';
import { pflichtDokumentIds } from '../../src/app/ansichten/pruefung/stage1.ts';
import type { AblaufBlock, Block, DocxDokument } from '../../src/generator/ir.ts';
import { renderDocx } from '../../src/generator/index.ts';
import { ablaufSzene, zuSvg } from '../../src/grafik/svg/index.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import type { Projekt, Sprache } from '../../src/model/typen.ts';
import { drawioSeitenLesen } from '../../src/prozesse/drawio.ts';
import { projektDrawio } from '../../src/prozesse/drawio-projekt.ts';
import {
  abgeleitetesDatum, anwendbar, anwendbarVorschlag, bedingungErfuellt, eignerVon, katalogAblauf, pfadWerte, prozessKatalog, sichtImPfad, texteImPfad,
} from '../../src/prozesse/katalog.ts';
import { ablaufBlock, prozessRaster } from '../../src/prozesse/layout.ts';
import { plusMonate, prozessStaende, prozessUebersicht } from '../../src/prozesse/stand.ts';
import { d02 } from '../../src/vorlagen/D-02.ts';
import { d21 } from '../../src/vorlagen/D-21.ts';
import { d27 } from '../../src/vorlagen/D-27.ts';
import type { Modus, VorlagenKontext } from '../../src/vorlagen/kontext.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';
import { musterDocx } from './generator.muster.ts';

const kataloge = ladeKataloge();
const katalog = prozessKatalog(kataloge);
const u = { de: erstelleUebersetzer('de', ladeTexte('de')), en: erstelleUebersetzer('en', ladeTexte('en')) };
const kp = (id: string) => katalog.prozesse.find((p) => p.id === id)!;
const beispiel = (firma: string, sprache: Sprache = 'de'): Projekt => JSON.parse(readFileSync(`src/beispiele/${firma}.${sprache}.aims.json`, 'utf8')) as Projekt;
const ctx = (projekt: Projekt, modus: Modus = 'firma', sprache: Sprache = 'de', weitere: Partial<VorlagenKontext> = {}): VorlagenKontext => ({
  u: u[sprache], modus, form: 'dokument', projekt, kataloge, kitVersion: 'test', ...weitere,
});
const art = <T extends Block['typ']>(d: DocxDokument, typ: T) => d.bloecke.filter((b): b is Extract<Block, { typ: T }> => b.typ === typ);
const text = (d: DocxDokument) => JSON.stringify(d.bloecke);

describe('Prozesskatalog im Projekt', () => {
  it('ladeKataloge liefert Katalog und Reifeskala mit Präfix prozesse_', () => {
    expect(katalog.prozesse).toHaveLength(38);
    expect(kataloge.prozesse_reifeskala?.stufen.map((s) => s.stufe)).toEqual([0, 1, 2, 3, 4]);
  });

  it('Pfade: Listen auffalten, Filter [feld=wert], Bedingungen', () => {
    const p = vollstaendigesProjekt();
    expect(pfadWerte(p, 'kiSysteme.name')).toEqual(['Copilot']);
    expect(pfadWerte(p, 'kiSysteme[typ=eigenbau]')).toEqual([]);
    expect(bedingungErfuellt(p, 'kiSysteme[typ=saas]')).toBe(true);
    p.organisation.entwickeltKi = false;
    expect(bedingungErfuellt(p, 'organisation.entwickeltKi')).toBe(false);
  });

  it('abgeleitete Durchführung: jüngstes Datum, nicht nach dem Stichtag, Ergänzungsblatt zählt wie das Dokument', () => {
    const p = vollstaendigesProjekt();
    p.dokumente.push({ id: 'D-04-EB', version: '1.0', status: 'freigegeben', freigabe: { von: 'P-001', am: '2026-10-12' }, ablageort: '', giltFuerIsms: true });
    expect(abgeleitetesDatum(p, ['dokumente[id=D-04].freigabe.am'])).toBe('2026-10-12');
    p.audits[0]!.durchgefuehrt = '2026-11-30';
    expect(abgeleitetesDatum(p, ['audits[art=intern].durchgefuehrt'], '2026-11-01')).toBeUndefined();
    expect(abgeleitetesDatum(p, ['audits[art=intern].durchgefuehrt'], '2026-12-01')).toBe('2026-11-30');
  });

  it('Sicht im Pfad: mit ISMS Verweis, ohne ISMS Mindestumfang oder Empfehlung', () => {
    expect(sichtImPfad(kp('PR-08'), true)).toBe('aims');
    expect(sichtImPfad(kp('PS-01'), true)).toBe('verweis');
    expect(sichtImPfad(kp('PS-02'), false)).toBe('minimal');
    expect(sichtImPfad(kp('PS-01'), false)).toBe('empfohlen');
  });

  it('Anwendbarkeit: Pflicht ja, bedingt nach Bedingung, Empfehlung offen, Eintrag geht vor', () => {
    const p = vollstaendigesProjekt();
    p.organisation.entwickeltKi = false;
    expect(anwendbarVorschlag(p, kp('PR-01'))).toBe('ja');
    expect(anwendbarVorschlag(p, kp('PR-15'))).toBe('nein');
    p.organisation.entwickeltKi = true;
    expect(anwendbarVorschlag(p, kp('PR-15'))).toBe('ja');
    expect(anwendbarVorschlag(p, kp('PS-06'))).toBe('nein');
    p.kiSysteme[0]!.typ = 'eingekauft';
    expect(anwendbarVorschlag(p, kp('PS-06'))).toBe('ja');
    expect(anwendbarVorschlag(p, kp('PS-01'))).toBe('offen');
    p.prozesse = [{ id: 'PR-07', anwendbar: 'nein', begruendung: 'x' }];
    expect(anwendbar(p, kp('PR-07'))).toBe('nein');
  });

  it('Eigner: Eintrag, sonst Person der Rolle in D-04, sonst Funktion aus aimsRolle', () => {
    const p = vollstaendigesProjekt();
    p.personen.push({ id: 'P-002', name: 'Ines Rot', funktion: 'Recht', aimsRollen: ['recht'] });
    expect(eignerVon(p, kp('PR-04'))).toEqual({ person: 'P-001', quelle: 'rolle' });
    expect(eignerVon(p, kp('PR-24'))).toEqual({ person: 'P-002', quelle: 'rolle' });
    expect(eignerVon(p, kp('PR-08'))).toEqual({});
    p.prozesse = [{ id: 'PR-08', eigner: 'P-002' }];
    expect(eignerVon(p, kp('PR-08'))).toEqual({ person: 'P-002', quelle: 'eintrag' });
  });

  it('Texte im Pfad: Verweise auf ausgeschaltete Module und ISMS entfallen', () => {
    const p = vollstaendigesProjekt();
    p.meta.modulAiAct = false;
    expect(texteImPfad(['Rollenbestimmung (D-24, E-01)', 'Pflichtenmatrix (E-03, E-09)', 'bestehender Geltungsbereich des ISMS', 'Inventar (D-10)'], p, false)).toEqual(['Rollenbestimmung (D-24)', 'Inventar (D-10)']);
    expect(texteImPfad(['Pflichtenmatrix (E-03)'], p, true)).toEqual(['Pflichtenmatrix (E-03)']);
  });
});

describe('Status der Prozesse', () => {
  it('Fälligkeit aus letzter Durchführung und Rhythmus, überfällig vor dem Stichtag', () => {
    expect(plusMonate('2026-01-31', 1)).toBe('2026-02-28');
    expect(plusMonate('2026-10-15', 3)).toBe('2027-01-15');
    const p = vollstaendigesProjekt();
    p.prozesse = [{ id: 'PR-12', letzteDurchfuehrung: '2026-06-15', rhythmus: 'quartalsweise' }, { id: 'PR-14', naechsteFaelligkeit: '2027-03-01' }];
    const s = prozessStaende(p, kataloge, '2026-10-20');
    const pr12 = s.find((x) => x.id === 'PR-12')!;
    expect(pr12).toMatchObject({ letzteDurchfuehrung: '2026-06-15', letzteQuelle: 'hand', naechsteFaelligkeit: '2026-09-15', ueberfaellig: true });
    expect(s.find((x) => x.id === 'PR-14')).toMatchObject({ naechsteFaelligkeit: '2027-03-01', ueberfaellig: false });
  });

  it('Reifevorschlag Schritt für Schritt bis «überprüft»', () => {
    const p = vollstaendigesProjekt();
    const vorschlag = () => prozessStaende(p, kataloge, '2026-10-20').find((x) => x.id === 'PR-25')!.reifeVorschlag;
    p.prozesse = [];
    p.audits[0]!.durchgefuehrt = undefined;
    p.managementbewertungen[0]!.datum = '2025-06-30';
    // Eigner über die Rolle internes Audit, Dokument im Register: definiert
    p.rollen.push({ id: 'RO-010', bereich: 'internes-audit', verantwortlich: 'P-001', konsultiert: [], informiert: [] });
    expect(vorschlag()).toBe(0);
    p.dokumente.push({ id: 'D-20', version: '1.0', status: 'entwurf', ablageort: '', giltFuerIsms: false });
    expect(vorschlag()).toBe(1);
    // Durchführung (Audit) und freigegebenes Dokument: eingeführt
    p.audits[0]!.art = 'intern';
    p.audits[0]!.durchgefuehrt = '2026-09-30';
    p.dokumente.at(-1)!.status = 'freigegeben';
    expect(vorschlag()).toBe(2);
    // Kennzahl mit Messwert der letzten zwölf Monate: wirksam
    p.prozesse = [{ id: 'PR-25', kennzahl: 'KZ-02' }];
    p.kennzahlMessungen = [{ kennzahl: 'KZ-02', datum: '2026-10-01', wert: '1 Beobachtung' }];
    expect(vorschlag()).toBe(3);
    // Managementbewertung dazu: überprüft
    p.managementbewertungen[0]!.datum = '2026-10-10';
    expect(vorschlag()).toBe(4);
  });

  it('Massnahmen des Prozesses über die Herkunft oder eine Feststellung mit Bereich; Übersicht', () => {
    const p = vollstaendigesProjekt();
    p.prozesse = [{ id: 'PR-12', reife: 2 }];
    p.massnahmen.push(
      { id: 'M-010', titel: 'a', beschreibung: '', termin: '2026-09-30', status: 'offen', prioritaet: 'mittel', herkunft: { art: 'prozess', ref: 'PR-12, PR-14' } },
      { id: 'M-011', titel: 'b', beschreibung: '', termin: '2026-12-31', status: 'in-arbeit', prioritaet: 'mittel', herkunft: { art: 'audit', ref: 'F-009' } },
    );
    p.feststellungen.push({ id: 'F-009', quelle: 'audit', einstufung: 'beobachtung', beschreibung: '', normbezug: '', korrektur: '', ursache: '', massnahmen: ['M-011'], status: 'offen', bereich: 'PR-12' });
    const s = prozessStaende(p, kataloge, '2026-10-20');
    expect(s.find((x) => x.id === 'PR-12')).toMatchObject({ massnahmenOffen: ['M-010', 'M-011'], massnahmenUeberfaellig: ['M-010'] });
    const ue = prozessUebersicht(s);
    expect(ue.reife[2]).toBe(1);
    // Jede Massnahme zählt einmal, auch wenn sie mehrere Prozesse betrifft (M-010: PR-12 und PR-14)
    expect(ue.massnahmenUeberfaellig).toBe(1);
    expect(ue.gesamt).toBeGreaterThan(20);
  });
});

describe('Ablauf im Raster mit Bahnen', () => {
  for (const sprache of ['de', 'en'] as const) {
    it(`${sprache}: jeder Katalogprozess ohne Überlappung, höchstens 5 Bahnen, Kanten mit Seiten, SVG und DOCX-Block`, () => {
      for (const p of katalog.prozesse) {
        const r = prozessRaster(katalogAblauf(u[sprache], p), u[sprache]);
        expect(r.bahnen.length, p.id).toBeLessThanOrEqual(5);
        expect(r.spalten, p.id).toBeGreaterThanOrEqual(3);
        const plaetze = r.knoten.map((k) => `${k.spalte}/${k.zeile}`);
        expect(new Set(plaetze).size, p.id).toBe(plaetze.length);
        const ids = new Set(r.knoten.map((k) => k.id));
        for (const k of r.kanten) {
          expect(ids.has(k.von) && ids.has(k.nach), `${p.id} ${k.von}>${k.nach}`).toBe(true);
          expect(['top', 'right', 'bottom', 'left']).toContain(k.vonSeite);
        }
        // Ausgänge einer Entscheidung beschriftet, keine zwei Ausgänge auf derselben Seite
        for (const s of p.schritte.filter((x) => x.art === 'entscheidung')) {
          const aus = r.kanten.filter((k) => k.von === s.id);
          expect(aus.every((k) => !!k.text), s.id).toBe(true);
          expect(new Set(aus.map((k) => k.vonSeite)).size, s.id).toBe(aus.length);
        }
        const svg = zuSvg(ablaufSzene(r, { titel: p.id, beschreibung: '' }, { id: 'x', zeilenHoehe: r.zeilenHoehe }));
        expect((svg.match(/data-bahn=/g) ?? []).length, p.id).toBe(r.bahnen.length);
        const b = ablaufBlock(r, { titel: p.id, beschreibung: '' });
        // Rauten mit doppelter Zeilenhöhe, ganzer Ablauf auf einer Seite
        expect(b.knoten.filter((k) => k.form === 'frage').every((k) => k.hoehe === 2), p.id).toBe(true);
        expect(b.zeilen * b.zeilenHoehe! + 34, p.id).toBeLessThanOrEqual(870);
      }
    });
  }

  it('DOCX: Bahnen als Rechtecke hinter den Formen, Ablauf ohne Bahnen unverändert', async () => {
    const r = prozessRaster(katalogAblauf(u.de, kp('PR-07')), u.de);
    const block = ablaufBlock(r, { titel: 'PR-07', beschreibung: 'Ablauf' });
    const dok: DocxDokument = { ...musterDocx(), bloecke: [block] };
    const xml = strFromU8(unzipSync(await renderDocx(dok, { zeitpunkt: new Date('2026-10-20T08:00:00Z') }))['word/document.xml']!);
    expect((xml.match(/prst="rect"/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(xml).toContain('Fachbereich');
    const ohne: AblaufBlock = { ...block, bahnen: undefined };
    const xml2 = strFromU8(unzipSync(await renderDocx({ ...dok, bloecke: [ohne] }, { zeitpunkt: new Date('2026-10-20T08:00:00Z') }))['word/document.xml']!);
    expect((xml2.match(/prst="rect"/g) ?? []).length).toBeLessThan((xml.match(/prst="rect"/g) ?? []).length);
    expect(xml2).not.toContain('Fachbereich');
  });
});

describe('Dokumente', () => {
  it('D-02: Prozesse und Landkarte aus dem Katalog statt fester Zeilen', () => {
    const leer = d02(ctx(leeresProjekt({ sprache: 'de' }), 'leer'));
    const [b] = art(leer, 'ablauf');
    expect(b!.knoten.filter((k) => /^PR-\d\d$/.test(k.id))).toHaveLength(27);
    expect(b!.knoten.filter((k) => k.id.startsWith('gruppe-'))).toHaveLength(4);
    const p = beispiel('praezisionsteile');
    const firma = d02(ctx(p));
    const [lk] = art(firma, 'ablauf');
    // ohne ISMS: PR-15 nicht anwendbar, Mindestumfang PS-02, PS-04, PS-06 und der als anwendbar entschiedene PS-08
    expect(lk!.knoten.some((k) => k.id === 'PR-15')).toBe(false);
    expect(lk!.knoten.filter((k) => /^PS-/.test(k.id)).map((k) => k.id)).toEqual(['PS-02', 'PS-04', 'PS-06', 'PS-08']);
    expect(text(firma)).not.toContain('mit ISMS');
  });

  it('D-27: leere Vorlage mit allen AIMS-Prozessen, Firma mit den anwendbaren, einzelner Prozess', () => {
    const leer = d27(ctx(leeresProjekt({ sprache: 'de' }), 'leer'));
    expect(art(leer, 'ablauf')).toHaveLength(30); // 27 AIMS-Prozesse und die drei empfohlenen Basisprozesse (Runde 1, A-13)
    expect(art(leer, 'ueberschrift').filter((h) => h.ebene === 1 && / PS-0[246] /.test(` ${h.text} `)).length).toBe(3);
    expect(art(leer, 'ueberschrift').filter((h) => h.ebene === 1 && / PR-\d\d /.test(` ${h.text} `)).length).toBe(27);
    const p = beispiel('praezisionsteile');
    const firma = d27(ctx(p));
    const kapitel = art(firma, 'ueberschrift').filter((h) => h.ebene === 1).map((h) => h.text);
    expect(kapitel.some((t) => t.includes('PR-15'))).toBe(false);
    expect(kapitel.some((t) => t.includes('PS-04'))).toBe(true);
    // Reife und Eigner aus dem Prozessstand
    expect(text(firma)).toContain('wirksam');
    expect(text(firma)).toContain('Andrea Baumann');
    const einzeln = d27(ctx(p, 'firma', 'de', { prozessId: 'PR-07' }));
    expect(art(einzeln, 'ablauf')).toHaveLength(1);
    expect(art(einzeln, 'ueberschrift').filter((h) => h.ebene === 1).map((h) => h.text)).toEqual([expect.stringContaining('Zweck'), expect.stringContaining('PR-07'), expect.stringContaining('Freigabe')]);
    // Muster mit ISMS: Ablauf PR-07 aus draw.io (eigener Text im Schritt), ISMS-Verweis
    const m = d27(ctx(beispiel('muster-maschinenbau'), 'firma', 'de', { prozessId: 'PR-25' }));
    expect(text(m)).toContain('ISMS-Handbuch MMB, Prozess IS-25 Internes Audit');
    expect(text(d27(ctx(beispiel('muster-maschinenbau'), 'firma', 'de', { prozessId: 'PR-07' })))).toContain('innert 10 Tagen');
  });

  it('D-21: Stand der Prozesse als Traktandum und Tabelle in der Anlage, nur wenn das Projekt Prozesse führt', () => {
    const p = beispiel('muster-maschinenbau');
    const mit = d21(ctx(p, 'firma', 'de', { form: 'ergaenzungsblatt' }));
    expect(text(mit)).toContain('Stand der Prozesse');
    expect(text(mit)).toContain('PR-12');
    delete p.prozesse;
    const ohne = d21(ctx(p, 'firma', 'de', { form: 'ergaenzungsblatt' }));
    expect(text(ohne)).not.toContain('Stand der Prozesse');
  });

  it('Dokumentset: D-27 nur mit Prozessen; einzelner Prozess mit eigenem Dateinamen', () => {
    const p = beispiel('praezisionsteile');
    expect(dokumentSet(p, kataloge, 'de').dateien.map((d) => d.id)).toContain('D-27');
    const ohne = structuredClone(p);
    delete ohne.prozesse;
    const r = dokumentSet(ohne, kataloge, 'de');
    expect(r.dateien.map((d) => d.id)).not.toContain('D-27');
    expect(r.ausgelassen.map((a) => a.id)).not.toContain('D-27');
    const einzeln = dokumentSet(p, kataloge, 'de', ['D-27'], 'PR-08', 'KI-Risiken beurteilen und behandeln');
    expect(einzeln.dateien.map((d) => [d.dateiname, d.prozessId])).toEqual([['D-27_PR-08_KI-Risiken-beurteilen-und-behandeln.docx', 'PR-08']]);
    // D9 (Prüfung Dokumente und Download): die Beschreibung eines Prozesses entsteht auch ohne Prozessliste im Projekt
    expect(dokumentSet(ohne, kataloge, 'de', ['D-27'], 'PR-08', 'KI-Risiken beurteilen und behandeln').dateien.map((d) => d.id)).toEqual(['D-27']);
  });

  it('draw.io: alle Prozesse eines Beispiels in einer Datei unter 350 KB, Landkarte und eine Seite je Prozess', () => {
    const p = beispiel('muster-maschinenbau');
    const r = projektDrawio(p, kataloge, u.de, { geaendert: p.meta.geaendert });
    expect(r.name).toBe('D-27_Prozesse.drawio');
    // Mit Lenkungsangaben auf jeder Seite und sichtbaren Querverweisen (Stage-1-Runde 6)
    expect(Buffer.byteLength(r.text)).toBeLessThan(350_000);
    expect(r.text).toContain('D-27-A');
    expect(r.text).not.toMatch(/\bkit(?:Id|Prozess|Raci)?=|tags="kit|host="aims"/);
    const seiten = drawioSeitenLesen(r.text);
    expect(seiten[0]!.id).toBe('landkarte');
    // 27 AIMS-Prozesse und der eigene Prozess PE-01
    expect(seiten.length).toBe(1 + 27 + 1);
    expect(seiten.at(-1)!.id).toBe('PE-01');
    // Rundreise PR-07: Notiz und zweite Ebene aus den Rohdaten bleiben im Export
    expect(seiten.find((s) => s.id === 'PR-07')!.xml).toContain('ebene-hinweise');
    expect(r.text).not.toMatch(/kmu-cio|Starter/i);
  });
});

describe('Stage-1-Bericht', () => {
  it('Pflichtdokument D-27 nur mit Prozessen', () => {
    const p = beispiel('praezisionsteile');
    expect(pflichtDokumentIds(p, kataloge)).toContain('D-27');
    delete p.prozesse;
    expect(pflichtDokumentIds(p, kataloge)).not.toContain('D-27');
  });
});

describe('Datenblöcke der App', () => {
  it('Teile in komprimierten Blöcken werden beim ersten Zugriff einmal entpackt, auch beim Kopieren für den Worker', () => {
    let aufrufe = 0;
    const daten = { texte: { de: { app: { x: 'A' } }, en: { app: { x: 'B' } } }, kataloge: {}, lazy: { 'daten-prozesse': ['texte.de.prozesse', 'kataloge.prozesse_katalog'] } } as unknown as AppDaten;
    lazyBloecke(daten, () => {
      aufrufe++;
      return JSON.stringify({ 'texte.de.prozesse': { titel: 'Prozesse' }, 'kataloge.prozesse_katalog': { prozesse: [] } });
    });
    expect(aufrufe).toBe(0);
    expect(Object.keys(daten.texte.de)).toContain('prozesse');
    const kopie = structuredClone(daten.texte.de);
    expect(kopie['prozesse']).toEqual({ titel: 'Prozesse' });
    expect((daten.kataloge as Record<string, unknown>)['prozesse_katalog']).toEqual({ prozesse: [] });
    expect(aufrufe).toBe(1);
  });
});
