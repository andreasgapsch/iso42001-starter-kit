// Befunde eines Rollentests: Dokumentkopf aus den Projektdaten (RT-15), Feld vorschlag
// am Risiko (RT-19), Ampel in D-15 (RT-21), «wirksam» nach positiver Prüfung (RT-22), Linkziel FRIST-16 (RT-23),
// Stage-1-Bericht (RT-29), Inhaltsverzeichnis im ZIP (RT-34), Daten des Beispiels (RT-49), Titel und Dateinamen der
// Ergänzungsblätter (RT-50).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { stage1Bericht, pflichtDokumentIds, regelAktiv } from '../../src/app/ansichten/pruefung/stage1.ts';
import type { Umfeld } from '../../src/app/logik/gefuehrt.ts';
import type { GefuehrtDaten } from '../../src/app/logik/gefuehrt-typen.ts';
import type { EuaiaControl } from '../../src/app/logik/vorschlaege.ts';
import { inhaltsverzeichnis, registerId, STAGE1_DOKUMENTE } from '../../src/app/worker/inhalt.ts';
import { dokumentSet, erzeugeIr } from '../../src/app/worker/set.ts';
import type { DocxDokument, Text, XlsxMappe } from '../../src/generator/ir.ts';
import { renderXlsx } from '../../src/generator/xlsx.ts';
import { kennzahlVerlaeufe } from '../../src/grafik/daten.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import type { Projekt, Sprache } from '../../src/model/typen.ts';
import { pruefeProjekt, type Regel } from '../../src/regeln/pruefungen.ts';
import { fristDokument, type Stand } from '../../src/vorlagen/E-0x.ts';
import { ebDateistamm } from '../../src/vorlagen/ergaenzungsblatt.ts';
import { VORLAGEN, ZUSATZDATEIEN } from '../../src/vorlagen/index.ts';
import { dokumentTitel, type Form } from '../../src/vorlagen/kontext.ts';
import { pruefeFristLinks } from '../../scripts/pruefen/links.mts';
import { erwartetBisP15 } from '../fixtures/erwartet-p15.ts';

const REPO = join(import.meta.dirname, '..', '..');
const kataloge = ladeKataloge();
const texte = { de: ladeTexte('de'), en: ladeTexte('en') };
const u = { de: erstelleUebersetzer('de', texte.de), en: erstelleUebersetzer('en', texte.en) };
const beispiel = (firma: string, sprache: Sprache): Projekt => JSON.parse(readFileSync(join(REPO, `src/beispiele/${firma}.${sprache}.aims.json`), 'utf8')) as Projekt;
const regeln = (parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')) as { regeln: Regel[] }).regeln;
const CONTROLS = kataloge.controls42001.gruppen.flatMap((g) => g.controls.map((c) => c.id));

/** Firmendokument einer Vorlage als IR */
function dokument<T extends DocxDokument | XlsxMappe>(p: Projekt, id: string, form: Form = 'dokument', kiSystemId?: string): T {
  const sprache = p.meta.dokumentSprache;
  return VORLAGEN[id]!({ u: u[sprache], modus: 'firma', form, projekt: p, kataloge, kitVersion: '1.0.0', ...(kiSystemId ? { kiSystemId } : {}) }) as T;
}
const klar = (t: Text | undefined): string => (t === undefined ? '' : typeof t === 'string' ? t : t.map((l) => l.text).join(''));
const platzhalter = (t: Text | undefined): boolean => typeof t !== 'string' && !!t?.some((l) => l.platzhalter);
/** Alle Texte eines DOCX-IR (Absätze, Listen, Tabellen) in einem String */
const docxText = (ir: DocxDokument): string => JSON.stringify(ir.bloecke);

/** Neues Projekt wie im Rollentest: Leitlinie in E3 freigegeben, Dokumentenregister leer */
function neuesProjekt(): Projekt {
  const p = leeresProjekt({ jetzt: '2026-10-22T08:00:00Z', mitIsms: true, modulAiAct: true });
  p.organisation.name = 'Alpha Hydraulik AG';
  p.personen = [
    { id: 'P-001', name: 'Sandra Keller', funktion: 'CEO', aimsRollen: ['geschaeftsleitung'] },
    { id: 'P-002', name: 'Peter Graf', funktion: 'Leiter IT', aimsRollen: ['aims'] },
  ] as Projekt['personen'];
  p.organisation.aimsVerantwortlich = 'P-002';
  p.organisation.leitlinie.grundsaetze = ['Der Mensch entscheidet, KI unterstützt.'];
  p.organisation.leitlinie.freigabe = { von: 'P-001', am: '2026-10-22' };
  p.organisation.geltungsbereich.freigabe = { von: 'P-001', am: '2026-10-15' };
  return p;
}

describe('RT-15 Dokumentkopf aus den Projektdaten, wenn das Register leer ist', () => {
  it('D-03: Eigner, Freigabe und Datum aus der Freigabe der Leitlinie statt Platzhaltern', () => {
    const p = neuesProjekt();
    const l = dokument<DocxDokument>(p, 'D-03').lenkung;
    expect(klar(l.freigabeDurch)).toBe('Sandra Keller, CEO');
    expect(klar(l.datum)).toBe('22.10.2026');
    expect(klar(l.eigner)).toBe('Peter Graf, Leiter IT');
    expect(platzhalter(l.freigabeDurch) || platzhalter(l.datum) || platzhalter(l.eigner)).toBe(false);
  });

  it('D-02 und D-00 lesen ihre Freigabe ebenfalls aus den Projektdaten', () => {
    const p = neuesProjekt();
    p.organisation.projektauftrag = { freigabe: { von: 'P-001', am: '2026-09-01' }, sponsor: 'P-001' };
    expect(klar(dokument<DocxDokument>(p, 'D-02').lenkung.datum)).toBe('15.10.2026');
    const d00 = dokument<XlsxMappe>(p, 'D-00').lenkung;
    expect(klar(d00.datum)).toBe('01.09.2026');
    expect(klar(d00.eigner)).toBe('Sandra Keller, CEO');
  });

  it('ein Eintrag im Register geht immer vor', () => {
    const p = neuesProjekt();
    p.dokumente.push({ id: 'D-03', version: '0.9', status: 'entwurf', ablageort: 'Ablage', giltFuerIsms: false });
    const l = dokument<DocxDokument>(p, 'D-03').lenkung;
    expect(klar(l.version)).toBe('0.9');
    expect(klar(l.freigabeDurch)).toMatch(/Entwurf/);
    expect(l.datum).toBe('');
  });

  it('Abschnitt 7 ohne Abgleich: offener Punkt statt der Auswahlliste der leeren Vorlage', () => {
    const p = neuesProjekt();
    const text = docxText(dokument<DocxDokument>(p, 'D-03'));
    expect(text).not.toContain('angepasst / Verweis / keine / nicht vorhanden');
    expect(text).toContain('noch nicht abgeglichen');
    p.organisation.leitlinie.abgleich = { informationssicherheit: 'verweis' };
    expect(docxText(dokument<DocxDokument>(p, 'D-03'))).toContain('Verweis auf diese Leitlinie ergänzt');
  });

  it('leere Vorlage bleibt unverändert mit Platzhaltern', () => {
    const p = neuesProjekt();
    const l = (VORLAGEN['D-03']!({ u: u.de, modus: 'leer', form: 'dokument', projekt: p, kataloge, kitVersion: '1.0.0' }) as DocxDokument).lenkung;
    expect(platzhalter(l.freigabeDurch)).toBe(true);
  });
});

describe('RT-19 Feld vorschlag am Risiko', async () => {
  const { uebernommenesRisiko, vorschlagAlsRisiko } = await import('../../src/app/ansichten/gefuehrt/KatalogVorschlaege.tsx');
  const { zustand } = await import('../../src/app/zustand/store.ts');
  const { setzeAppDaten } = await import('../../src/app/daten.ts');
  const json = (rel: string) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
  setzeAppDaten({ texte, kataloge, gefuehrt: json('src/generiert/gefuehrt.json'), regeln: { regeln }, version: '1.0.0', gebaut: '', beispiele: [] });

  it('erkennt übernommene Vorschläge am Feld, die Texterkennung bleibt als Rückfall', () => {
    const p = neuesProjekt();
    const basis = { art: 'risiko' as const, titel: 'x', kiSystem: 'KI-001', quelle: 'sicherheit', ebenen: [], ursache: '', folge: '', bestehendeMassnahmen: '', w: null, a: null, wNach: null, aNach: null, controls: [], massnahmen: [], status: 'offen' as const };
    p.risiken = [
      { ...basis, id: 'R-001', beschreibung: 'Präparierte Mail', vorschlag: 'GS-01' },
      { ...basis, id: 'R-002', beschreibung: 'Vorschlag GS-07 (OWASP LLM09:2025)' },
      { ...basis, id: 'R-003', beschreibung: 'Vorschlag GS-02 (OWASP)', vorschlag: 'GS-09' },
    ];
    expect(uebernommenesRisiko(p, { id: 'GS-01' }, 'KI-001')).toBe('R-001');
    expect(uebernommenesRisiko(p, { id: 'GS-07' }, 'KI-001')).toBe('R-002');
    // Mit Feld gilt das Feld, nicht ein abweichender Text
    expect(uebernommenesRisiko(p, { id: 'GS-02' }, 'KI-001')).toBeUndefined();
    expect(uebernommenesRisiko(p, { id: 'GS-09' }, 'KI-001')).toBe('R-003');
    expect(uebernommenesRisiko(p, { id: 'GS-01' }, 'KI-002')).toBeUndefined();
  });

  it('die Übernahme setzt das Feld', () => {
    const p = neuesProjekt();
    zustand.laden(p);
    const id = vorschlagAlsRisiko({ id: 'GS-05', titel: 'T', ursache: 'U', folge: 'F', quelle: 'daten', ebenen: ['organisation'], massnahmen: [], controls: [], etiketten: [], verweis: 'OWASP LLM04:2025', nurHandelnd: false, nist: [] }, 'KI-001');
    const r = zustand.projekt.value!.risiken.find((x) => x.id === id)!;
    expect(r.vorschlag).toBe('GS-05');
    expect(r.beschreibung).toContain('GS-05 (');
  });

  it.each([['muster-maschinenbau', 13], ['praezisionsteile', 5]] as const)('Beispiel %s: Risiken mit Vorschlag GenAI-Sicherheit zugeordnet (DE und EN gleich)', (firma, anzahl) => {
    const de = beispiel(firma, 'de');
    const en = beispiel(firma, 'en');
    const zugeordnet = de.risiken.filter((r) => r.vorschlag);
    expect(zugeordnet).toHaveLength(anzahl);
    expect(en.risiken.filter((r) => r.vorschlag).map((r) => [r.id, r.vorschlag])).toEqual(zugeordnet.map((r) => [r.id, r.vorschlag]));
    const gs = new Set((kataloge['genaiRisiken'] as { risiken: { id: string }[] }).risiken.map((r) => r.id));
    for (const r of zugeordnet) {
      expect(gs.has(r.vorschlag!), r.id).toBe(true);
      expect(de.kiSysteme.find((s) => s.id === r.kiSystem)?.generativ, r.id).toBe(true);
    }
  });

  it('Muster: R-027 und R-030 entsprechen GS-01, R-029 GS-05; Copilot hat übernommene Vorschläge', () => {
    const p = beispiel('muster-maschinenbau', 'de');
    const v = (id: string) => p.risiken.find((r) => r.id === id)?.vorschlag;
    expect([v('R-027'), v('R-030'), v('R-029')]).toEqual(['GS-01', 'GS-01', 'GS-05']);
    expect(uebernommenesRisiko(p, { id: 'GS-01' }, 'KI-004')).toBe('R-027');
    expect(uebernommenesRisiko(p, { id: 'GS-07' }, 'KI-004')).toBe('R-004');
  });
});

describe('RT-21 Ampel in D-15', () => {
  const ampel = (p: Projekt) => {
    const ir = dokument<DocxDokument>(p, 'D-15', p.meta.mitIsms ? 'ergaenzungsblatt' : 'dokument');
    const t = ir.bloecke.find((b) => b.typ === 'tabelle');
    if (!t || t.typ !== 'tabelle') throw new Error('Ampel fehlt');
    return { gruen: klar(t.zeilen[0]![1]), gelb: klar(t.zeilen[1]![1]), rot: klar(t.zeilen[2]![1]), text: docxText(ir) };
  };

  it('Muster DE: Grün zeigt ein Werkzeug für Mitarbeitende mit Datenklasse, kein Kamerasystem, keine Schatten-KI', () => {
    const a = ampel(beispiel('muster-maschinenbau', 'de'));
    expect(a.gruen).toBe('ChatGPT Team (Daten bis «intern»)');
    expect(a.gelb).toBe('M365 Copilot (Daten bis «vertraulich»)');
    expect(a.gruen + a.gelb).not.toMatch(/Visuelle Qualitätsprüfung|Schatten-KI/);
    // Die befristete Ausnahme für den Gratisdienst steht unter der Ampel, Rot nennt sie als einzige Ausnahme
    expect(a.rot).toContain('Gratisdienste');
    expect(a.rot).toContain('ausgenommen sind nur die befristeten Ausnahmen unter der Ampel');
    expect(a.text).toContain('KI-Übersetzer für Betriebsanleitungen (Schatten-KI), befristet bis 12.04.2027');
    expect(a.text).toContain('KI in Anlagen und Fachanwendungen (Visuelle Qualitätsprüfung Linie 3)');
  });

  it('Muster: Datenklassen erklärt (Klassifizierung des ISMS) und Control-IDs mit Kurztitel', () => {
    const de = ampel(beispiel('muster-maschinenbau', 'de')).text;
    expect(de).toContain('Klassen der Informationsklassifizierung unseres ISMS');
    expect(de).toContain('EC-01 Exportkontrolle bei generativer KI');
    expect(de).not.toMatch(/\(EC-01\)/);
    const en = ampel(beispiel('muster-maschinenbau', 'en')).text;
    expect(en).toContain('information classification of our ISMS');
    expect(en).toMatch(/EC-01 [A-Z][a-z]/);
  });

  // Erwartung geändert (P15a, AF-083, A3-02c): Copilot ist nach der vollständigen Abschätzung IA-001 (Ausmass 3) nur
  // eingeschränkt freigegeben und steht deshalb in Gelb wie im Muster; Grün ist leer
  it('Präzision (ohne ISMS): Copilot gelb (eingeschränkt), ERP-Funktion und CAM-KI nicht als Werkzeuge, Datenklassen erklärt', () => {
    const a = ampel(beispiel('praezisionsteile', 'de'));
    expect(a.gruen).toBe('derzeit keine');
    expect(a.gelb).toBe('M365 Copilot (Daten bis «vertraulich»)');
    expect(a.rot).toContain('Kostenloser Chatbot für Offerten (Schatten-KI)');
    expect(a.text).toContain('KI in Anlagen und Fachanwendungen (KI-Funktion Disposition im ERP, KI-gestützte CAM-Programmierung)');
    expect(a.text).toContain('Datenklassen: ');
  });
});

describe('RT-22 Status «wirksam» nach positiver Wirksamkeitsprüfung', () => {
  // Erwartung geändert (P15a, AF-085, F34): Präzision A.5.2 (F-006), A.8.4 und A.9.2 (F-005) stehen bis zur
  // Wirksamkeitsprüfung der Korrekturen auf «umgesetzt», wie Muster A.5.2 (F-001)
  // P15b (AF-076, AF-090, G33): Muster A.4.2, A.5.4, A.8.4, A.9.2 wegen der offenen Vorfälle F-006, F-007 und RMF-02 bis zur
  // Übung nach M-037 auf «umgesetzt» (vorher «wirksam» trotz offener Nichtkonformität, Prüfregel F34, A3-10)
  const AUSNAHMEN: Record<string, string[]> = { 'muster-maschinenbau': ['A.4.2', 'A.4.6', 'A.5.2', 'A.5.4', 'A.6.2.4', 'A.6.2.5', 'A.8.4', 'A.9.2', 'RMF-02'], praezisionsteile: ['A.5.2', 'A.6.2.6', 'A.8.4', 'A.9.2'] };
  it.each(['muster-maschinenbau', 'praezisionsteile'])('%s: «umgesetzt» mit Prüfergebnis nur bei Feststellung oder offener Korrektur', (firma) => {
    for (const sprache of ['de', 'en'] as const) {
      const p = beispiel(firma, sprache);
      const umgesetzt = p.controls.filter((c) => c.anwendbar === 'ja' && c.status === 'umgesetzt' && c.wirksamkeit?.ergebnis).map((c) => c.id);
      expect(umgesetzt.sort()).toEqual([...AUSNAHMEN[firma]!].sort());
      expect(p.controls.filter((c) => c.status === 'wirksam').length).toBeGreaterThan(25);
      // «wirksam» nur mit Prüfung (wie, wann, Ergebnis)
      for (const c of p.controls.filter((x) => x.status === 'wirksam')) expect(c.wirksamkeit?.wann && c.wirksamkeit.ergebnis, c.id).toBeTruthy();
    }
  });

  it('Prüfregeln: keine Fehler, höchstens der bekannte Hinweis H15', () => {
    for (const firma of ['muster-maschinenbau', 'praezisionsteile']) {
      // Runde 2b: Treffer der neuen Regeln F34 bis F43 bis zur Korrektur der Beispiele (P15a, P15b) ausgenommen, genaue Liste
      // in tests/fixtures/erwartet-p15.ts, geprüft in beispiele.test.ts
      const b = pruefeProjekt(regeln, { projekt: beispiel(firma, 'de'), heute: '2027-02-15', controlIds42001: CONTROLS, aiActStand: '2026-07-27' }).filter((x) => !erwartetBisP15(firma)(x));
      expect(b.filter((x) => x.schwere === 'fehler')).toEqual([]);
      expect(b.map((x) => x.regel).filter((r) => r !== 'H15')).toEqual([]);
    }
  });

  it('Stand der SoA zum Audit bleibt «umgesetzt» (Prüfung im Audit selbst)', () => {
    const p = beispiel('muster-maschinenbau', 'de');
    const au = p.audits.find((a) => a.id === 'AU-001')!;
    expect(p.controls.find((c) => c.id === 'A.2.3')!.status).toBe('wirksam');
    expect(au.checkliste?.['A.2.3']?.soaStand).toBe('umgesetzt');
  });
});

describe('RT-23 Linkziel je Rechtsakt in stand.yaml', () => {
  const stand = kataloge['aiact_stand'] as Stand;
  const f16 = stand.fristen.find((f) => f.id === 'FRIST-16')!;

  it('FRIST-16 verweist auf die Änderungsverordnung (EU) 2026/1744, Seite 40 in DE und EN (Runde 1, B-12)', () => {
    expect(f16.dokument).toBe('M1');
    expect(fristDokument(stand, f16, 'de')).toEqual({ datei: 'Aenderungsverordnung_2026-1744_DE.pdf', seite: 40, rechtsakt: 'Verordnung (EU) 2026/1744' });
    expect(fristDokument(stand, f16, 'en')).toMatchObject({ datei: 'Aenderungsverordnung_2026-1744_EN.pdf', seite: 40 });
    // Fristen im AI Act selbst: kein eigenes Linkziel (konsolidierte Fassung)
    expect(fristDokument(stand, stand.fristen.find((f) => f.id === 'FRIST-15')!, 'de')).toBeUndefined();
  });

  it('E-09 nennt die Seite der Änderungsverordnung', () => {
    const p = beispiel('muster-maschinenbau', 'de');
    expect(docxText(dokument<DocxDokument>(p, 'E-09'))).toContain('in der Fassung von Art. 3 Nr. 1 VO (EU) 2026/1744, S. 40');
  });

  it('Tor G7: Fundstelle in einem anderen Rechtsakt ohne Linkziel ist ein Fehler, Seite ausserhalb der PDF ebenso', () => {
    const ohne = { fassung: { aenderungen: [] }, fristen: [{ id: 'F-1', artikel: 'Art. 8 VO (EU) 2023/1230' }] };
    expect(pruefeFristLinks(ohne, []).map((b) => b.schwere)).toEqual(['fehler']);
    const ok = { fassung: { aenderungen: [{ id: 'M1', datei: { de: 'a.pdf', en: 'b.pdf' } }] }, fristen: [{ id: 'F-1', artikel: 'Art. 8 VO (EU) 2023/1230', dokument: 'M1', seite: { de: 39, en: 39 } }] };
    // PDF nicht vorhanden: nur Warnung (CI ohne Rechtstexte)
    expect(pruefeFristLinks(ok, []).every((b) => b.schwere === 'warnung')).toBe(true);
    expect(pruefeFristLinks({ ...ok, fristen: [{ ...ok.fristen[0]!, dokument: 'M2' }] }, []).map((b) => b.schwere)).toEqual(['fehler']);
    expect(pruefeFristLinks(parse(readFileSync(join(REPO, 'src/ai-act/stand.yaml'), 'utf8')), []).filter((b) => b.schwere === 'fehler')).toEqual([]);
  });

  it('die App verlinkt die Frist mit dem eigenen Linkziel und Fundstellen anderer Rechtsakte nie auf die konsolidierte Fassung', () => {
    const quelle = readFileSync(join(REPO, 'src/app/ansichten/formular/AiAct.tsx'), 'utf8');
    expect(quelle).toContain('<FristLink f={f} stand={stand} />');
    expect(quelle).toMatch(/VO \\\(EU\\\)\|Verordnung\|Richtlinie/);
  });
});

describe('RT-29 Stage-1-Bericht', () => {
  const gefuehrt = JSON.parse(readFileSync(join(REPO, 'src/generiert/gefuehrt.json'), 'utf8')) as GefuehrtDaten;
  const umfeld: Umfeld = { gefuehrt, controlIds42001: CONTROLS, euaia: (kataloge['aiact_euaiaControls'] as { controls: EuaiaControl[] }).controls };
  const bericht = (p: Projekt, beispielName?: string) => {
    // Beispiele: Treffer der neuen Regeln F34 bis F43 bis P15a, P15b ausgenommen (tests/fixtures/erwartet-p15.ts)
    const befunde = pruefeProjekt(regeln, { projekt: p, heute: '2027-02-15', controlIds42001: CONTROLS, aiActStand: '2026-07-27', kataloge }).filter((x) => !beispielName || !erwartetBisP15(beispielName)(x));
    return stage1Bericht(p, { u: u.de, umfeld, kataloge, regeln, befunde, heute: '2027-02-05' });
  };

  it('Muster: Firma, Pfad, Module, geprüfte Regeln, Termin des Stage-1-Audits', () => {
    const p = beispiel('muster-maschinenbau', 'de');
    const b = bericht(p, 'muster');
    expect(b.firma).toBe(p.organisation.name);
    expect(b.datum).toBe('2027-02-05');
    expect(b).toMatchObject({ mitIsms: true, ismsZertifiziert: true, module: { aiAct: true } });
    expect(b.regeln.geprueft).toBe(regeln.filter((r) => regelAktiv(r, p)).length);
    expect(b.regeln.geprueft).toBeGreaterThan(40);
    // Nur H15 (Stand AI Act); die Prozessbefunde sind seit Stage-1-Runde 6 bereinigt
    expect(b.regeln).toMatchObject({ fehler: 0, hinweise: 1 });
    expect(b.regeln.liste.find((r) => r.id === 'H15')?.befunde).toBe(1);
    expect(b.stage1Audit).toMatchObject({ id: 'AU-002', geplant: '2027-03-02' });
    // Ziel nach dem Ergänzungsaudit AU-008 und vor Stage 1 (Runde 2, A-17; vorher nur am Datenstand ausgerichtet)
    expect(b.zielStage1).toBe('2027-02-26');
  });

  it('Muster: Stand je Etappe und Pflichtdokumente mit Version, Status und Freigabe aus dem Register', () => {
    const p = beispiel('muster-maschinenbau', 'de');
    const b = bericht(p, 'muster');
    expect(b.etappen.map((e) => e.id)).toContain('E13');
    expect(b.etappen.find((e) => e.id === 'E3')?.zustand).toBe('erledigt');
    const d04 = b.dokumente.find((d) => d.id === 'D-04-EB')!;
    expect(d04).toMatchObject({ version: '1.1', status: 'freigegeben', freigabe: { am: '2027-02-02' } });
    expect(b.dokumente.some((d) => d.id === 'D-09-KI-008')).toBe(true);
    expect(b.dokumente.some((d) => d.id === 'D-04')).toBe(false);
    expect(pflichtDokumentIds(p, kataloge)).not.toContain('D-23');
    expect(b.offen.befunde.map((x) => x.regel)).toEqual(['H15']);
    expect(b.offen.massnahmen.length).toBeGreaterThan(0);
  });

  it('neues Projekt: offene Punkte und Dokumente ohne Freigabe', () => {
    const p = neuesProjekt();
    const b = bericht(p);
    expect(b.regeln.fehler).toBeGreaterThan(0);
    expect(b.offen.ohneFreigabe).toContain('D-04-EB');
    // D-03 ist über die Freigabe der Leitlinie freigegeben, auch ohne Registereintrag
    expect(b.dokumente.find((d) => d.id === 'D-03')).toMatchObject({ status: 'freigegeben', freigabe: { am: '2026-10-22' } });
    expect(b.stage1Audit).toBeUndefined();
  });

  it('Knopf druckt den Bericht, Meldungen erscheinen im Druck nie', () => {
    const pruefung = readFileSync(join(REPO, 'src/app/ansichten/pruefung/Pruefung.tsx'), 'utf8');
    expect(pruefung).toContain('onClick={stage1Drucken}');
    expect(pruefung).not.toContain('toISOString().slice(0, 10)}</p>');
    const css = readFileSync(join(REPO, 'src/app/stil.css'), 'utf8');
    const druck = [...css.matchAll(/@media print \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
    expect(druck).toMatch(/\.meldung \{ display: none !important; \}/);
    expect(druck).toContain('body.druck-bericht > :not(#druck-bericht)');
  });

  it('Texte DE und EN vollständig', () => {
    const quelle = readFileSync(join(REPO, 'src/app/ansichten/pruefung/Stage1Bericht.tsx'), 'utf8');
    const schluessel = [...new Set([...quelle.matchAll(/t\('(stage1\.[a-z_0-9.]+)'/g)].map((m) => m[1]!))];
    expect(schluessel.length).toBeGreaterThan(20);
    for (const s of ['de', 'en'] as const) for (const k of schluessel) expect(u[s].tOpt(`app.${k}`), `${s} ${k}`).toBeTruthy();
  });
});

describe('RT-34 Inhaltsverzeichnis im ZIP', () => {
  const iv = (p: Projekt) => {
    const sprache = p.meta.dokumentSprache;
    const { dateien } = dokumentSet(p, kataloge, sprache);
    return { dateien, ...inhaltsverzeichnis(p, texte[sprache], kataloge, sprache, '1.0.0', dateien, '2027-02-05') };
  };

  it('Muster DE: 00_Inhalt.xlsx mit ID, Titel, Normbezug, Datei, Register, Stage 1 und ISMS-Dokument', () => {
    const p = beispiel('muster-maschinenbau', 'de');
    const { mappe, name, dateien } = iv(p);
    expect(name).toBe('00_Inhalt.xlsx');
    const b = mappe.blaetter[0]!;
    expect(b.spalten.map((s) => s.kopf)).toEqual(['ID', 'Titel', 'Normbezug', 'Datei', 'Version', 'Status', 'Freigabe (Datum, Person)', 'Für Stage 1', 'Ergänztes ISMS-Dokument']);
    expect(b.zeilen).toHaveLength(dateien.length);
    const zeile = (id: string) => b.zeilen.find((z) => z[0] === id)!;
    expect(zeile('D-04-EB')).toEqual(['D-04-EB', 'Rollen, Verantwortlichkeiten und Meldewege (Ergänzungsblatt)', '5.3, A.3', 'D-04-EB_Rollen.docx', '1.1', 'freigegeben', expect.stringMatching(/^02\.02\.2027, /), 'ja', expect.stringMatching(/\S/)]);
    expect(zeile('D-03-EB')!.slice(1, 4)).toEqual(['Ergänzung zur Informationssicherheitsleitlinie', '5.2, A.2.2, A.2.3, A.2.4', 'D-03-EB_Sicherheitsleitlinie.docx']);
    // Zusatzblatt neben der eigenen Leitlinie: nicht für Stage 1; D-03 selbst schon
    expect(zeile('D-03-EB')![7]).toBe('nein');
    expect(zeile('D-03')![7]).toBe('ja');
    expect(zeile('D-03')![8]).toBe('');
    expect(zeile('D-24')![7]).toBe('nein');
    expect(b.zeilen.find((z) => z[0] === 'D-09-KI-008')?.[1]).toContain('KI-008');
    expect(b.zeilen.filter((z) => z[0] === 'D-26-EB').map((z) => z[3])).toEqual(['D-26-EB_Dokumentenlenkung.docx', 'D-26-EB_Dokumentenlenkung_Register.xlsx']);
  });

  it('Muster EN: 00_Contents.xlsx, ohne Auswahl der Unterlagen bleibt die Spalte leer', () => {
    const p = beispiel('muster-maschinenbau', 'en');
    expect(iv(p).name).toBe('00_Contents.xlsx');
    delete (p.meta.gefuehrt.antworten as Record<string, unknown>)['zertifizierung'];
    const { mappe } = iv(p);
    expect(mappe.blaetter[0]!.zeilen.every((z) => z[7] === '')).toBe(true);
    expect(mappe.blaetter[0]!.spalten.at(-1)!.kopf).toBe('Supplemented ISMS document');
  });

  it('Präzision (ohne ISMS): keine Spalte für das ISMS-Dokument', () => {
    const { mappe } = iv(beispiel('praezisionsteile', 'de'));
    expect(mappe.blaetter[0]!.spalten).toHaveLength(8);
  });

  it('ohne Kit-Namensnennung, auch nicht in den Dateieigenschaften (Tor G8)', async () => {
    for (const [firma, sprache] of [['muster-maschinenbau', 'de'], ['praezisionsteile', 'en']] as const) {
      const { mappe } = iv(beispiel(firma, sprache));
      const zip = unzipSync(await renderXlsx(mappe, { zeitpunkt: new Date('2027-02-05T10:00:00Z') }));
      for (const [teil, inhalt] of Object.entries(zip)) {
        if (!/\.(xml|rels)$/.test(teil)) continue;
        expect(/KMU-CIO|kmu-cio\.ch|Starter-Kit|Starter Kit/i.test(strFromU8(inhalt)), `${firma}/${teil}`).toBe(false);
      }
    }
  });

  it('Register-ID und Stage-1-Zuordnung', () => {
    expect(registerId({ id: 'D-09', kiSystemId: 'KI-004' })).toBe('D-09-KI-004');
    expect(registerId({ id: 'D-26-EB-Register', zusatz: 'Register' })).toBe('D-26-EB');
    const optionen = (parse(readFileSync(join(REPO, 'src/gefuehrt/optionen.yaml'), 'utf8')) as { optionen: Record<string, string[]> }).optionen['stage1Unterlagen']!;
    expect(Object.keys(STAGE1_DOKUMENTE).sort()).toEqual([...optionen].sort());
  });

  it('der Worker legt das Inhaltsverzeichnis als erste Datei ins ZIP', () => {
    const quelle = readFileSync(join(REPO, 'src/app/worker/einstieg.ts'), 'utf8');
    expect(quelle).toMatch(/eintraege\.unshift\(\{ pfad: iv\.name/);
  });
});

describe('RT-49 Daten des Beispiels Muster Maschinenbau', async () => {
  const { stichtagVon } = await import('../../src/app/zustand/store.ts');

  it('Lagebild: Stichtag ist der Stand der Beispieldatei, die Karte «Ziele mit Messwerten» ist gefüllt', () => {
    for (const sprache of ['de', 'en'] as const) {
      const p = beispiel('muster-maschinenbau', sprache);
      const stichtag = stichtagVon(p);
      expect(stichtag >= p.meta.geaendert.slice(0, 10)).toBe(true);
      expect(kennzahlVerlaeufe(p, stichtag).length).toBeGreaterThan(0);
    }
    // Projekt mit Stand in der Vergangenheit: heute
    const alt = { meta: { ...beispiel('muster-maschinenbau', 'de').meta, geaendert: '2020-01-01T00:00:00Z' } };
    expect(stichtagVon(alt)).toBe(new Date().toISOString().slice(0, 10));
  });

  it('Reihenfolge stimmt: Managementbewertung vor dem Ziel Stage-1-Bereitschaft, Stage-1-Audit danach', () => {
    const p = beispiel('muster-maschinenbau', 'de');
    const mb = p.managementbewertungen.map((m) => m.datum!).sort().at(-1)!;
    const ziel = p.organisation.zielterminStage1!;
    const au = p.audits.find((a) => a.art === 'extern-stage1')!.geplant!;
    expect(mb <= ziel && ziel < au).toBe(true);
    // Das Ziel richtet sich fachlich nach dem Ergänzungsaudit, nicht nach dem Datenstand (Runde 2, A-17)
    expect(p.meta.geaendert.slice(0, 10) <= ziel).toBe(true);
  });

  it('Überblick nennt das Ziel als Stage-1-Bereitschaft, nicht als Termin des Audits', () => {
    expect(u.de.t('app.ueberblick.zeit_ziel', { datum: 'x', kw: 'y', wochen: 1 })).toMatch(/^Ziel Stage-1-Bereitschaft/);
    expect(u.en.t('app.ueberblick.zeit_ziel', { datum: 'x', kw: 'y', wochen: 1 })).toMatch(/^Target for stage 1 readiness/);
  });
});

describe('RT-50 Titel und Dateinamen der Ergänzungsblätter', () => {
  it('eine Quelle für den Titel: Kopf, Dateieigenschaften, Register D-26', () => {
    expect(dokumentTitel(u.de, kataloge, 'D-04-EB')).toBe('Rollen, Verantwortlichkeiten und Meldewege (Ergänzungsblatt)');
    expect(dokumentTitel(u.de, kataloge, 'D-03-EB')).toBe('Ergänzung zur Informationssicherheitsleitlinie');
    expect(dokumentTitel(u.en, kataloge, 'D-03-EB')).toBe('Supplement to the information security policy');
    expect(dokumentTitel(u.de, kataloge, 'D-09-KI-001')).toBe(u.de.t('dokumente.D-09.titel'));
    const p = beispiel('muster-maschinenbau', 'de');
    const d04 = dokument<DocxDokument>(p, 'D-04', 'ergaenzungsblatt');
    expect(d04.lenkung.titel).toBe(dokumentTitel(u.de, kataloge, 'D-04-EB'));
    expect(d04.eigenschaften.titel).toBe(`D-04-EB ${dokumentTitel(u.de, kataloge, 'D-04-EB')}`);
    const reg = ZUSATZDATEIEN['D-26']![0]!.vorlage({ u: u.de, modus: 'firma', form: 'ergaenzungsblatt', projekt: p, kataloge, kitVersion: '1.0.0' }) as XlsxMappe;
    const json = JSON.stringify(reg.blaetter);
    expect(json).toContain('Rollen, Verantwortlichkeiten und Meldewege (Ergänzungsblatt)');
  });

  it('Dateinamen gleich in Werkzeug, Kit und Beispielen: D-xx-EB_Stamm, D-03-EB mit eigenem Stamm', async () => {
    expect(ebDateistamm(kataloge, 'D-03-EB', 'de')).toBe('D-03-EB_Sicherheitsleitlinie');
    expect(ebDateistamm(kataloge, 'D-03-EB', 'en')).toBe('D-03-EB_Security-Policy');
    expect(ebDateistamm(kataloge, 'D-04-EB', 'de')).toBe('D-04-EB_Rollen');
    const p = beispiel('muster-maschinenbau', 'de');
    const werkzeug = dokumentSet(p, kataloge, 'de').dateien.filter((d) => d.form === 'ergaenzungsblatt').map((d) => d.dateiname.replace(/\.\w+$/, ''));
    expect(werkzeug.every((n) => /^D-\d{2}-EB_/.test(n)), werkzeug.join(', ')).toBe(true);
    expect(werkzeug).toContain('D-03-EB_Sicherheitsleitlinie');
    const { auftraege } = await import('../../scripts/beispiele.mts');
    const beispiele = auftraege(p, 'de').filter((a) => a.form === 'ergaenzungsblatt').map((a) => a.name);
    for (const n of werkzeug) expect(beispiele, n).toContain(n);
    for (const datei of ['scripts/build.mts', 'scripts/beispiele.mts', 'src/app/worker/set.ts']) expect(readFileSync(join(REPO, datei), 'utf8'), datei).toContain('ebDateistamm(');
  });

  it('«EB» ist auf der Seite «Dokumente erzeugen» erklärt (DE und EN)', () => {
    expect(u.de.t('app.dokumente.eb_erklaerung')).toMatch(/^EB steht für Ergänzungsblatt/);
    expect(u.en.t('app.dokumente.eb_erklaerung')).toMatch(/supplementary sheet/);
    expect(readFileSync(join(REPO, 'src/app/ansichten/dokumente/Dokumente.tsx'), 'utf8')).toContain("t('dokumente.eb_erklaerung')");
  });

  it('Firmendokumente des Werkzeugs: Kopf von D-03-EB mit eigenem Titel', () => {
    const p = beispiel('muster-maschinenbau', 'de');
    const e = dokumentSet(p, kataloge, 'de').dateien.find((d) => d.id === 'D-03-EB')!;
    const ir = erzeugeIr(e, p, texte.de, kataloge, 'de', '1.0.0') as DocxDokument;
    expect(ir.lenkung.titel).toBe('Ergänzung zur Informationssicherheitsleitlinie');
  });
});
