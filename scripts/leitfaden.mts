// Leitfaden «Minimal Viable AIMS» und Poster «AIMS auf einer Seite»: Markdown und HTML-Vorlage
// aus src/leitfaden/<sprache>/ werden mit den Katalogen zu druckfertigem HTML und mit
// Playwright-Chromium zu PDF (Leitfaden A4, Poster A3 quer).
//
// Aufruf: npx tsx scripts/leitfaden.mts [--sprache de|en] [--ablage <ordner>] [--nur-html]
//   --ablage   kopiert die PDFs zusätzlich in diesen Ordner (z. B. für eine Sichtprüfung)
//   --nur-html schreibt nur die HTML-Dateien (ohne Browser)
// Ausgabe: dist/kit/<DE|EN>/<00_Leitfaden|00_Guide>/*.pdf (Ordner und Dateinamen aus leitfaden.yaml), HTML zur Kontrolle unter dist/leitfaden/<sprache>/
//
// Das Inhaltsverzeichnis erhält Seitenzahlen in zwei Durchläufen: Der erste Druck enthält
// unsichtbare Messmarken je Überschrift, pdftotext (poppler-utils) liest die Seiten aus.
// Fehlt pdftotext, erscheint das Inhaltsverzeichnis ohne Seitenzahlen.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { parse } from 'yaml';
import { matrixZaehlen, STUFEN, werteJeStufe, type Risikostufe } from '../src/grafik/daten.ts';
import {
  ablaufSzene, balkenSzene, ganttSzene, landkarteSzene, risikomatrixSzene, zeitachseSzene, zuSvg,
  type AchsenEintrag, type BalkenZeile, type GanttMarke, type GanttZeile, type Knoten,
} from '../src/grafik/svg/index.ts';
import { ladeTexte } from '../src/i18n/laden-node.ts';
import { erstelleUebersetzer, type Uebersetzer } from '../src/i18n/texte.ts';
import { leeresProjekt } from '../src/model/neu.ts';
import type { VorlagenKontext } from '../src/vorlagen/kontext.ts';
import { entscheidungsbaumD24 } from '../src/vorlagen/grafik.ts';

export type Sprache = 'de' | 'en';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(REPO, 'src');

// ---------------------------------------------------------------------------------------------
// Daten laden

interface Etappe { id: string; norm: string; vorlagen: string[]; leitfaden: number; beteiligte: string[] }
interface Schritt {
  nr: number;
  vorlagen_zusatz: string[];
  modi: number[];
  wochen: { mit_isms: [number, number]; ohne_isms: [number, number] };
  pt: { mit_isms: [number, number]; ohne_isms: [number, number] };
}
interface Dokument { id: string; format: string; normbezug: string; art: 'pflicht' | 'leitfaden' | 'modul' | 'modul_nist'; ordner: string; eb: boolean; je_system?: boolean; datei: Record<Sprache, string> }
interface Blatt { id: string; vorlage: string; normbezug: string[] }
type Texte = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Daten des Moduls NIST AI RMF (src/nist-rmf/*.yaml) für Kapitel 10 */
type Abdeckung = 'ganz' | 'teilweise' | 'nicht';
interface NistSubkategorie { id: string; funktion: string; abdeckung: Abdeckung; abdeckung_kit: Abdeckung; zusatz_control?: string; praezisierung?: boolean }
interface NistFassung { id: string; dokument: string; kurzname: string; version: string | null; datum?: string; erstveroeffentlicht?: string; pdf_erstellt?: string; doi?: string; url: string; datei: string; seiten: number }
export interface NistDaten {
  funktionen: { id: string; nist_id: string; kuerzel: string }[];
  subkategorien: NistSubkategorie[];
  controls: { id: string; art: 'allgemein' | 'genai' }[];
  risiken: { id: string; nr: number; kmu_relevanz: string; controls: string[]; praezisierung?: boolean }[];
  stand: { geprueft_am: string; hinweis_nach_monaten: number; fassungen: NistFassung[]; revision: { status: string; angekuendigt: string } };
  /** Texte aus src/i18n/<sprache>/nist.yaml */
  t: Texte;
}

/** Stand des EU AI Act (src/ai-act/stand.yaml): Fassung, Prüfdatum und Fristen */
export interface AiActStand {
  geprueft_am: string;
  fassung: { datum: string };
  fristen: { id: string; datum: string; art: string; artikel: string }[];
}

export interface Daten {
  sprache: Sprache;
  version: string;
  t: Texte;
  schritte: Schritt[];
  etappen: Etappe[];
  dokumente: Dokument[];
  blaetter: Blatt[];
  dokTexte: Record<string, { titel: string; kurz: string }>;
  ebTexte: Record<string, { titel: string }>;
  kapitel42001: { id: string; vorlagen: string[] }[];
  kapitelTitel: Record<string, string>;
  controlGruppen: { id: string; anzahl: number; vorlagen: string[] }[];
  gruppenTitel: Record<string, string>;
  etappenTitel: Record<string, string>;
  beteiligte: Record<string, string>;
  /** Wörter in sprachneutralen Normangaben (etappen.yaml, dokumente.yaml), z. B. «bis» → «to». */
  normbegriffe: Record<string, string>;
  nist: NistDaten;
  /** Freigaben der Geschäftsleitung je Pfad (schritte.yaml, Kapitel 4) */
  freigaben: { mit_isms: number[]; ohne_isms: number[] };
  /** Landkarte der Regelwerke (src/leitfaden/landkarte.yaml) */
  landkarte: { id: string; spalte: number; zeile: number; im_kit: boolean }[];
  aiAct: AiActStand;
  /** Texte des Kits (src/i18n/<sprache>): Vorschlagskalen D-07, Kriterien D-06, Entscheidungsbaum D-24 */
  u: Uebersetzer;
  /** Laufende Nummer der Abbildungen beim Bauen (baueMarkdown setzt sie zurück) */
  abbNr: number;
}

const yaml = (pfad: string): any => parse(readFileSync(pfad, 'utf8')); // eslint-disable-line @typescript-eslint/no-explicit-any
const eindeutig = <T,>(a: T[]): T[] => [...new Set(a)];

export function leitfadenOrdner(sprache: Sprache): string {
  return join(SRC, 'leitfaden', sprache);
}

export function ladeDaten(sprache: Sprache): Daten {
  const ordner = leitfadenOrdner(sprache);
  if (!existsSync(join(ordner, 'leitfaden.yaml'))) {
    throw new Error(`Leitfaden-Texte für «${sprache}» fehlen: ${ordner}/leitfaden.yaml`);
  }
  const i18n = join(SRC, 'i18n', sprache);
  const controls = yaml(join(SRC, 'kataloge', 'iso42001-controls.yaml')).gruppen as { id: string; controls: { id: string; vorlagen: string[] }[] }[];
  const anf = yaml(join(SRC, 'kataloge', 'iso42001-anforderungen.yaml')).kapitel as { id: string; abschnitte: { vorlagen: string[] }[] }[];
  const anfTexte = yaml(join(i18n, 'anforderungen42001.yaml'));
  const ctrlTexte = yaml(join(i18n, 'controls42001.yaml'));
  const gefuehrt = yaml(join(i18n, 'gefuehrt.yaml')) as { etappen: Record<string, { titel: string }>; beteiligte: Record<string, string> };
  const eb = existsSync(join(i18n, 'ergaenzungsblaetter.yaml')) ? yaml(join(i18n, 'ergaenzungsblaetter.yaml')) : { blaetter: {} };
  const schritteDatei = yaml(join(SRC, 'leitfaden', 'schritte.yaml'));
  return {
    sprache,
    version: (JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as { version: string }).version,
    t: yaml(join(ordner, 'leitfaden.yaml')),
    schritte: schritteDatei.schritte,
    freigaben: schritteDatei.freigaben,
    landkarte: yaml(join(SRC, 'leitfaden', 'landkarte.yaml')).regelwerke,
    aiAct: yaml(join(SRC, 'ai-act', 'stand.yaml')),
    u: erstelleUebersetzer(sprache, ladeTexte(sprache)),
    abbNr: 0,
    etappen: yaml(join(SRC, 'gefuehrt', 'etappen.yaml')).etappen,
    dokumente: yaml(join(SRC, 'kataloge', 'dokumente.yaml')).dokumente,
    blaetter: yaml(join(SRC, 'kataloge', 'ergaenzungsblaetter.yaml')).blaetter,
    dokTexte: yaml(join(i18n, 'dokumente.yaml')),
    ebTexte: eb.blaetter ?? {},
    kapitel42001: anf.map((k) => ({ id: k.id, vorlagen: eindeutig(k.abschnitte.flatMap((a) => a.vorlagen)).sort() })),
    kapitelTitel: anfTexte.kapitel,
    controlGruppen: controls.map((g) => ({ id: g.id, anzahl: g.controls.length, vorlagen: eindeutig(g.controls.flatMap((c) => c.vorlagen)).sort() })),
    gruppenTitel: ctrlTexte.gruppen,
    etappenTitel: Object.fromEntries(Object.entries(gefuehrt.etappen).map(([id, e]) => [id, e.titel])),
    beteiligte: gefuehrt.beteiligte,
    // Übersetzung der Wörter in sprachneutralen Normangaben (nur EN nötig)
    normbegriffe: existsSync(join(ordner, 'normbegriffe.yaml')) ? yaml(join(ordner, 'normbegriffe.yaml')) : {},
    nist: ladeNist(i18n),
  };
}

function ladeNist(i18n: string): NistDaten {
  const n = (datei: string) => yaml(join(SRC, 'nist-rmf', datei));
  const subk = n('subkategorien.yaml');
  return {
    funktionen: subk.funktionen,
    subkategorien: subk.subkategorien,
    controls: n('rmf-controls.yaml').controls,
    risiken: n('genai-risiken.yaml').risiken,
    stand: n('stand.yaml'),
    t: yaml(join(i18n, 'nist.yaml')),
  };
}

// ---------------------------------------------------------------------------------------------
// Hilfen

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 1.5 → «1,5» (de) bzw. «1.5» (en). */
function zahl(n: number, sprache: Sprache): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return sprache === 'de' ? s.replace('.', ',') : s;
}

function bereich([von, bis]: [number, number], d: Daten): string {
  return von === bis ? zahl(von, d.sprache) : `${zahl(von, d.sprache)} ${d.t.steckbrief.bis} ${zahl(bis, d.sprache)}`;
}

function dokTitel(d: Daten, id: string): string {
  const t = d.dokTexte[id]?.titel;
  if (!t) throw new Error(`Titel für ${id} fehlt in src/i18n/${d.sprache}/dokumente.yaml`);
  return t;
}

function dokument(d: Daten, id: string): Dokument {
  const dok = d.dokumente.find((x) => x.id === id);
  if (!dok) throw new Error(`Unbekannte Vorlage ${id}`);
  return dok;
}

function etappenFuer(d: Daten, nr: number): Etappe[] {
  return d.etappen.filter((e) => e.leitfaden === nr);
}

function schritt(d: Daten, nr: number): Schritt {
  const s = d.schritte.find((x) => x.nr === nr);
  if (!s) throw new Error(`Schritt ${nr} fehlt in src/leitfaden/schritte.yaml`);
  return s;
}

/** Übersetzt die Wörter einer Normangabe («6.1.1 bis 6.1.3, Anhang A» → «6.1.1 to 6.1.3, Annex A»). */
export function normtext(d: Daten, s: string): string {
  return s.replace(/\p{L}+/gu, (w) => d.normbegriffe[w] ?? w);
}

/** Normabschnitte eines Schritts (aus den Etappen, ohne Doppel). */
export function normFuer(d: Daten, nr: number): string[] {
  return eindeutig(etappenFuer(d, nr).flatMap((e) => normtext(d, e.norm).split(/,\s*/)).map((x) => x.trim()).filter(Boolean));
}

/** Vorlagen eines Schritts: Ergebnisse der Etappen, dann Zusatz. */
export function vorlagenFuer(d: Daten, nr: number): string[] {
  return eindeutig([...etappenFuer(d, nr).flatMap((e) => e.vorlagen), ...schritt(d, nr).vorlagen_zusatz]);
}

export function summePt(d: Daten, pfad: 'mit_isms' | 'ohne_isms'): [number, number] {
  return d.schritte.reduce<[number, number]>((s, x) => [s[0] + x.pt[pfad][0], s[1] + x.pt[pfad][1]], [0, 0]);
}

// ---------------------------------------------------------------------------------------------
// Generierte Bausteine im Markdown: <!-- steckbrief:N -->, <!-- aufwand -->, <!-- modi -->,
// <!-- dokumentenuebersicht -->

function steckbrief(d: Daten, nr: number): string {
  const s = schritt(d, nr);
  const sb = d.t.steckbrief;
  const vorlagen = vorlagenFuer(d, nr)
    .map((id) => {
      const art = dokument(d, id).art;
      const modul = art === 'modul' ? sb.modul : art === 'modul_nist' ? sb.modul_nist : '';
      return `<span class="dok">${esc(id)}</span> ${esc(dokTitel(d, id))}${modul ? ` <span class="modul">(${esc(modul)})</span>` : ''}`;
    })
    .join('; ');
  const etappen = etappenFuer(d, nr).map((e) => `${esc(e.id)} ${esc(d.etappenTitel[e.id] ?? '')}`).join(', ');
  const modi = s.modi.map((m) => `${m} ${esc(d.t.modi[m] ?? '')}`).join(', ');
  const beteiligte = eindeutig(etappenFuer(d, nr).flatMap((e) => e.beteiligte)).map((b) => esc(d.beteiligte[b] ?? b)).join(', ');
  const woche = (w: [number, number]) => (w[0] === w[1] ? `${sb.woche} ${w[0]}` : `${sb.wochen} ${w[0]} ${sb.bis} ${w[1]}`);
  const zeilen: [string, string][] = [
    [sb.norm, esc(normFuer(d, nr).join(', '))],
    [sb.vorlagen, vorlagen],
    [sb.etappe, etappen],
    [sb.modus, modi],
    [sb.dauer, `${esc(sb.mit_isms)}: ${woche(s.wochen.mit_isms)}; ${esc(sb.ohne_isms)}: ${woche(s.wochen.ohne_isms)}`],
    [sb.aufwand, `${esc(sb.mit_isms)}: ${bereich(s.pt.mit_isms, d)} ${sb.pt}; ${esc(sb.ohne_isms)}: ${bereich(s.pt.ohne_isms, d)} ${sb.pt}`],
    [sb.beteiligte, beteiligte],
  ];
  return `<table class="steckbrief"><tbody>${zeilen.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`).join('')}</tbody></table>`;
}

function aufwand(d: Daten): string {
  const a = d.t.aufwand;
  const zeilen = d.schritte
    .map((s) => `<tr><td>${s.nr} ${esc(d.t.schritte[s.nr])}</td><td class="zahl">${bereich(s.pt.mit_isms, d)}</td><td class="zahl">${bereich(s.pt.ohne_isms, d)}</td></tr>`)
    .join('');
  const summe = `<tr class="summe"><td>${esc(a.summe)}</td><td class="zahl">${bereich(summePt(d, 'mit_isms'), d)}</td><td class="zahl">${bereich(summePt(d, 'ohne_isms'), d)}</td></tr>`;
  return `<table class="aufwand"><thead><tr><th>${esc(a.schritt)}</th><th class="zahl">${esc(a.mit_isms)}</th><th class="zahl">${esc(a.ohne_isms)}</th></tr></thead><tbody>${zeilen}${summe}</tbody></table>`;
}

function modi(d: Daten): string {
  const zeilen = Object.entries(d.t.modi as Record<string, string>)
    .map(([nr, name]) => {
      const s = d.schritte.filter((x) => x.modi.includes(Number(nr))).map((x) => `${x.nr} ${esc(d.t.schritte[x.nr])}`).join(', ');
      return `<tr><td class="zahl">${esc(nr)}</td><td>${esc(name)}</td><td>${s}</td></tr>`;
    })
    .join('');
  return `<table class="modi"><thead><tr><th class="zahl">${esc(d.t.steckbrief.modus.split(' ')[0])}</th><th>${esc(d.t.uebersicht.titel)}</th><th>${esc(d.t.aufwand.schritt)}</th></tr></thead><tbody>${zeilen}</tbody></table>`;
}

/** Pfad einer Vorlage im entpackten Kit, relativ zum Sprachordner. */
export function kitPfad(d: Daten, dok: Dokument): string {
  return `${d.t.ordner[dok.ordner]}/${dok.datei[d.sprache]}.${dok.format}`;
}

function normbezugEb(b: Blatt): string {
  return b.normbezug.map((n) => n.replace(/^K-/, '')).join(', ');
}

function dokumentenuebersicht(d: Daten): string {
  const u = d.t.uebersicht;
  const kopf = `<thead><tr><th>${esc(u.id)}</th><th>${esc(u.titel)}</th><th>${esc(u.normbezug)}</th><th>${esc(u.pfad)}</th></tr></thead>`;
  const teile: string[] = [];
  for (const art of ['pflicht', 'leitfaden', 'modul', 'modul_nist'] as const) {
    const zeilen = d.dokumente
      .filter((x) => x.art === art)
      .map((x) => `<tr><td class="dok">${esc(x.id)}</td><td>${esc(dokTitel(d, x.id))}${x.je_system ? ` (${esc(u.je_system)})` : ''}</td><td>${esc(normtext(d, x.normbezug))}</td><td class="pfad">${esc(kitPfad(d, x))}</td></tr>`)
      .join('');
    teile.push(`<h3>${esc(u.gruppen[art])}</h3><table class="uebersicht">${kopf}<tbody>${zeilen}</tbody></table>`);
  }
  const eb = d.blaetter
    .map((b) => `<tr><td class="dok">${esc(b.id)}</td><td>${esc(d.ebTexte[b.id]?.titel ?? b.id)}</td><td>${esc(normbezugEb(b))}</td><td class="pfad">${esc(`${d.t.ordner.ergaenzungsblaetter}/${b.id}`)}</td></tr>`)
    .join('');
  teile.push(`<h3>${esc(u.gruppen.eb)}</h3><table class="uebersicht">${kopf}<tbody>${eb}</tbody></table>`);
  return teile.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Modul NIST AI RMF (Kapitel 10): Bilanz, Stand und GenAI-Risiken aus src/nist-rmf/*.yaml

const MONATE: Record<Sprache, string[]> = {
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

/** «2023-01-26» → «26.01.2023» (de) bzw. «26 January 2023» (en); «2024-07» → «Juli 2024». */
export function datumText(iso: string, sprache: Sprache): string {
  const [j, m, t] = iso.split('-');
  const monat = MONATE[sprache][Number(m) - 1] ?? m;
  if (!t) return `${monat} ${j}`;
  return sprache === 'de' ? `${t}.${m}.${j}` : `${t}/${m}/${j}`;
}

const GRADE: Abdeckung[] = ['ganz', 'teilweise', 'nicht'];

/** Bilanz der Abdeckung: je Funktion Norm und Kit, dazu der Satz mit Zusatz-Controls. */
function nistBilanz(d: Daten): string {
  const n = d.nist;
  const b = d.t.nist.bilanz;
  const zaehle = (liste: NistSubkategorie[], feld: 'abdeckung' | 'abdeckung_kit') => GRADE.map((g) => liste.filter((s) => s[feld] === g).length);
  const zelle = (z: number[]) => z.map((x) => `<td class="zahl">${x}</td>`).join('');
  const zeilen = n.funktionen.map((f) => {
    const liste = n.subkategorien.filter((s) => s.funktion === f.id);
    return `<tr><td>${esc(f.nist_id)} (${esc(n.t.funktionen[f.id]?.titel ?? f.id)})</td><td class="zahl">${liste.length}</td>${zelle(zaehle(liste, 'abdeckung'))}${zelle(zaehle(liste, 'abdeckung_kit'))}</tr>`;
  });
  const alle = n.subkategorien;
  const summe = `<tr class="summe"><td>${esc(b.summe)}</td><td class="zahl">${alle.length}</td>${zelle(zaehle(alle, 'abdeckung'))}${zelle(zaehle(alle, 'abdeckung_kit'))}</tr>`;
  const kopf1 = `<tr><th rowspan="2">${esc(b.funktion)}</th><th rowspan="2" class="zahl">${esc(b.anzahl)}</th><th colspan="3">${esc(b.norm)}</th><th colspan="3">${esc(b.kit)}</th></tr>`;
  const kopf2 = `<tr>${[...GRADE, ...GRADE].map((g) => `<th class="zahl">${esc(b[g])}</th>`).join('')}</tr>`;
  const tabelle = `<table class="nist-bilanz"><thead>${kopf1}${kopf2}</thead><tbody>${zeilen.join('')}${summe}</tbody></table>`;
  const teilweise = alle.filter((s) => s.abdeckung_kit !== 'ganz');
  const allgemein = n.controls.filter((c) => c.art === 'allgemein');
  const genai = n.controls.filter((c) => c.art === 'genai');
  const satz = String(b.satz)
    .replace('{teilweise}', String(teilweise.length))
    .replace('{liste}', teilweise.map((s) => s.id).join(', '))
    .replace('{allgemein}', String(allgemein.length))
    .replace('{allgemein_von}', allgemein[0]?.id ?? '')
    .replace('{allgemein_bis}', allgemein.at(-1)?.id ?? '')
    .replace('{genai}', String(genai.length))
    .replace('{genai_von}', genai[0]?.id ?? '')
    .replace('{genai_bis}', genai.at(-1)?.id ?? '')
    .replace('{praezisierungen}', String(alle.filter((s) => s.praezisierung).length));
  return `${tabelle}\n\n<p class="nist-satz">${esc(satz)}</p>`;
}

/** Fassungen der NIST-Dokumente mit Datum, Seiten und DOI bzw. Adresse; Prüfdatum und Revision. */
function nistStand(d: Daten): string {
  const n = d.nist;
  const st = d.t.nist.stand;
  const zeilen = n.stand.fassungen.map((f) => {
    const datum = f.datum ? datumText(f.datum, d.sprache) : f.pdf_erstellt ? `${st.pdf_vom} ${datumText(f.pdf_erstellt, d.sprache)}` : '';
    const quelle = f.doi ? `https://doi.org/${f.doi}` : f.url;
    return `<tr><td>${esc(f.dokument)}${f.version ? ` ${esc(st.version)} ${esc(f.version)}` : ''}<br><span class="leise">${esc(f.kurzname)}</span></td><td>${esc(datum)}</td><td class="zahl">${f.seiten}</td><td class="pfad">${esc(quelle)}</td></tr>`;
  });
  const tabelle = `<table class="nist-stand"><thead><tr><th>${esc(st.dokument)}</th><th>${esc(st.datum)}</th><th class="zahl">${esc(st.seiten)}</th><th>${esc(st.quelle)}</th></tr></thead><tbody>${zeilen.join('')}</tbody></table>`;
  const satz = String(st.satz)
    .replace('{geprueft}', datumText(n.stand.geprueft_am, d.sprache))
    .replace('{angekuendigt}', datumText(n.stand.revision.angekuendigt, d.sprache))
    .replace('{monate}', String(n.stand.hinweis_nach_monaten));
  return `${tabelle}\n\n<p class="nist-satz">${esc(satz)}</p>`;
}

/** Die 12 Risiken generativer KI nach NIST AI 600-1 mit Kurztitel des Kits, KMU-Relevanz und Controls. */
function nistGenai(d: Daten): string {
  const n = d.nist;
  const g = d.t.nist.genai;
  const zeilen = [...n.risiken]
    .sort((a, b) => a.nr - b.nr)
    .map((r) => `<tr><td class="zahl">${r.nr}</td><td>${esc(n.t.genai_risiken[r.id]?.titel ?? r.id)}</td><td>${esc(n.t.werte.kmu_relevanz[r.kmu_relevanz] ?? r.kmu_relevanz)}</td><td>${esc(r.controls.length ? r.controls.join(', ') : g.hinweis)}</td></tr>`)
    .join('');
  return `<table class="nist-genai"><thead><tr><th class="zahl">${esc(g.nr)}</th><th>${esc(g.risiko)}</th><th>${esc(g.relevanz)}</th><th>${esc(g.controls)}</th></tr></thead><tbody>${zeilen}</tbody></table>`;
}

// ---------------------------------------------------------------------------------------------
// Abbildungen (Bausteine <!-- abb:name --> und <!-- aiactfristen -->): SVG aus src/grafik/svg mit Druckpalette,
// Daten aus den Quellen, Wörter aus leitfaden.yaml. Jede Abbildung: Titel mit Nummer, Textalternative im SVG
// (title, desc), Quellenzeile.

/** {name} im Text ersetzen. */
function setze(text: string, werte: Record<string, string | number>): string {
  return String(text).replace(/\{([\w-]+)\}/g, (m, k: string) => (k in werte ? String(werte[k]) : m));
}

/** Liste mit «und» bzw. «and» am Schluss. */
function aufzaehlung(teile: (string | number)[], sprache: Sprache): string {
  const t = teile.map(String);
  if (t.length < 2) return t.join('');
  return `${t.slice(0, -1).join(', ')} ${sprache === 'de' ? 'und' : 'and'} ${t.at(-1)}`;
}

const MONAT_KURZ_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Datum einer Frist: «2.12.2027» (de) bzw. «2 December 2027» oder kurz «2 Dec 2027» (en). */
export function fristDatum(iso: string, sprache: Sprache, kurz = false): string {
  const [j, m, t] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  const tt = String(t).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  void kurz;
  return sprache === 'de' ? `${tt}.${mm}.${j}` : `${tt}/${mm}/${j}`;
}

function svgText(szene: Knoten): string {
  // Im Druck die statischen Schnitte: sonst bettet Chromium die Abbildungen als Type 3 ein (F-11)
  // zuSvg maskiert das Hochkomma im eingebetteten Stil (&#39;): Der Austausch muss die maskierte Form treffen
  return zuSvg(szene, { stil: true, palette: 'hell' }).replaceAll(`&#39;Archivo Variable&#39;,Archivo`, `&#39;Archivo Statisch&#39;,Archivo`);
}

/** Rahmen einer Abbildung: Titel mit Nummer, Grafik, optional Zusatz, Quellenzeile. */
function abbildung(d: Daten, name: string, titel: string, quelle: string, inhalt: string): string {
  d.abbNr++;
  return `<figure class="abb abb-${name}" id="abb-${name}" data-abbildung="${name}"><figcaption class="abb-titel"><span class="abb-nr">${esc(d.t.abbildung)} ${d.abbNr}</span> ${esc(titel)}</figcaption>${inhalt}<p class="abb-quelle">${esc(d.t.quelle)}: ${esc(quelle)}</p></figure>`;
}

/** Fahrplan als Gantt: je Schritt ein Balken mit ISMS (voll) und einer ohne ISMS (hell), Freigaben als Rauten. */
export function fahrplanSzene(d: Daten): Knoten {
  const f = d.t.abbildungen.fahrplan;
  const wochen = Math.max(...d.schritte.map((s) => s.wochen.ohne_isms[1]), ...d.schritte.map((s) => s.wochen.mit_isms[1]));
  const zeilen: GanttZeile[] = d.schritte.map((s) => ({
    titel: `${s.nr} ${d.t.schritte[s.nr]}`,
    von: s.wochen.mit_isms[0],
    bis: s.wochen.mit_isms[1],
    zustand: 'erledigt',
    zweit: { von: s.wochen.ohne_isms[0], bis: s.wochen.ohne_isms[1], zustand: 'offen' },
  }));
  const marken: GanttMarke[] = [
    ...d.freigaben.mit_isms.map((w): GanttMarke => ({ woche: w, text: f.freigabe, art: 'meilenstein' })),
    ...d.freigaben.ohne_isms.map((w): GanttMarke => ({ woche: w, text: f.freigabe, art: 'freigabe' })),
  ];
  const spanne = ([von, bis]: [number, number]) => setze(von === bis ? f.woche : f.wochen, { von, bis });
  const beschreibung = setze(f.beschreibung, {
    schritte: d.schritte.map((s) => setze(f.schritt, { nr: s.nr, titel: d.t.schritte[s.nr], mit: spanne(s.wochen.mit_isms), ohne: spanne(s.wochen.ohne_isms) })).join('; '),
    freigaben_mit: aufzaehlung(d.freigaben.mit_isms, d.sprache),
    freigaben_ohne: aufzaehlung(d.freigaben.ohne_isms, d.sprache),
    ende_mit: Math.max(...d.schritte.map((s) => s.wochen.mit_isms[1])),
    ende_ohne: Math.max(...d.schritte.map((s) => s.wochen.ohne_isms[1])),
  });
  return ganttSzene(
    zeilen,
    {
      titel: f.titel,
      beschreibung,
      heute: '',
      meilensteine: f.freigaben_mit,
      freigaben: f.freigaben_ohne,
      legende: { erledigt: f.legende_mit, offen: f.legende_ohne, meilenstein: f.legende_freigabe_mit, freigabe: f.legende_freigabe_ohne },
    },
    { id: `abb-fahrplan-${d.sprache}`, wochen, breite: 760, marken, titelSichtbar: false, achse: (w) => String(w) },
  );
}

function abbFahrplan(d: Daten): string {
  const f = d.t.abbildungen.fahrplan;
  return abbildung(d, 'fahrplan', f.titel, f.quelle, svgText(fahrplanSzene(d)));
}

/** Vorschlagskalen (D-07) und Grenzen des neuen Projekts (eine Regel mit App und Vorlagen). */
export function matrixVorschlag(d: Daten) {
  const v = d.u.roh('vorlagen.D-07.skalen_vorschlag') as { wahrscheinlichkeit: (string | number)[][]; auswirkung: (string | number)[][] };
  const kr = leeresProjekt({ sprache: d.sprache, jetzt: '2026-01-01T00:00:00Z', projektId: 'leitfaden' }).organisation.risikokriterien;
  const w = v.wahrscheinlichkeit.map((x) => ({ stufe: Number(x[0]), name: String(x[1]) }));
  const a = v.auswirkung.map((x) => ({ stufe: Number(x[0]), name: String(x[1]) }));
  return { w, a, kr, matrix: matrixZaehlen([], w.map((x) => x.stufe), a.map((x) => x.stufe), kr) };
}

/** Beispiel in der Matrix: vor Behandlung hoch, nach Behandlung tief (Werte aus den Grenzen geprüft). */
export const MATRIX_BEISPIEL = { von: { w: 3, a: 4 }, nach: { w: 2, a: 2 } } as const;

function abbRisikomatrix(d: Daten): string {
  const r = d.t.abbildungen.risikomatrix;
  const g = (k: string, werte?: Record<string, string | number>) => d.u.t(`vorlagen.grafik.${k}`, werte);
  const { w, a, kr, matrix } = matrixVorschlag(d);
  const kuerzel = d.u.liste('vorlagen.grafik.kuerzel');
  const werte = werteJeStufe(matrix.w, matrix.a, kr);
  const spanne = (x: number[]) => (x.length > 1 ? d.u.t('vorlagen.D-06.skalen.von_bis', { von: x[0]!, bis: x.at(-1)! }) : String(x[0] ?? ''));
  const legende = Object.fromEntries(STUFEN.map((s, i) => [s, g(`matrix.legende.${s}`, { kuerzel: kuerzel[i]!, bis: kr.akzeptanzBis, ab: kr.unannehmbarAb, werte: spanne(werte.mittel) })])) as Record<Risikostufe, string>;
  const stufeWort = Object.fromEntries(STUFEN.map((s) => [s, g(`stufe.${s}`)])) as Record<Risikostufe, string>;
  const stufeVon = (x: { w: number; a: number }) => matrix.zellen[matrix.w.indexOf(x.w)]![matrix.a.indexOf(x.a)]!.stufe;
  const { von, nach } = MATRIX_BEISPIEL;
  const beispiel = setze(r.beispiel, { w1: von.w, a1: von.a, v1: von.w * von.a, s1: stufeWort[stufeVon(von)], w2: nach.w, a2: nach.a, v2: nach.w * nach.a, s2: stufeWort[stufeVon(nach)] });
  const zonen = STUFEN.map((s) => ({ stufe: s, text: setze(r.zone, { stufe: stufeWort[s], werte: s === 'tief' ? d.u.t('vorlagen.D-06.skalen.bis', { wert: kr.akzeptanzBis }) : s === 'hoch' ? d.u.t('vorlagen.D-06.skalen.ab', { wert: kr.unannehmbarAb }) : spanne(werte.mittel), text: d.u.t(`vorlagen.D-06.skalen.kriterien.${s}`) }) }));
  const szene = risikomatrixSzene(
    matrix,
    {
      titel: r.titel,
      achseW: r.achse_w,
      achseA: r.achse_a,
      kurzW: r.kurz_w,
      kurzA: r.kurz_a,
      namenA: Object.fromEntries(a.map((x) => [x.stufe, x.name])),
      legende,
      stufe: stufeWort,
      beschreibung: setze(r.beschreibung, { zonen: zonen.map((z) => z.text).join(' '), beispiel }),
    },
    { id: `abb-risikomatrix-${d.sprache}`, zelle: 52, mitAnzahl: false, titelSichtbar: false, pfeil: { von: { ...von, text: r.vor }, nach: { ...nach, text: r.nach } } },
  );
  const skala = (liste: { stufe: number; name: string }[], kurz: string) => liste.map((x) => `${kurz} ${x.stufe} ${x.name}`).join(', ');
  const text = `<div class="abb-text"><p class="abb-zwischentitel">${esc(r.zonen)}</p><ul>${zonen.map((z) => `<li class="zone-${z.stufe}">${esc(z.text)}</li>`).join('')}</ul><p>${esc(beispiel)}</p><p class="leise">${esc(r.achse_w)}: ${esc(skala(w, r.kurz_w))}. ${esc(r.achse_a)}: ${esc(skala(a, r.kurz_a))}.</p></div>`;
  return abbildung(d, 'risikomatrix', r.titel, r.quelle, `<div class="abb-zwei"><div>${svgText(szene)}</div>${text}</div>`);
}

/** Entscheidungsbaum «Rolle zuerst»: dieselben Knoten und Texte wie D-24 (src/vorlagen/grafik.ts). */
export function rollenbaumSzene(d: Daten): { szene: Knoten; titel: string } {
  const ablauf = entscheidungsbaumD24({ u: d.u } as unknown as VorlagenKontext);
  return { szene: ablaufSzene(ablauf, ablauf.alt, { id: `abb-rollenbaum-${d.sprache}`, breite: 760, zeilenHoehe: 48, schrift: 11, luecke: 44 }), titel: ablauf.alt.titel };
}

function abbRollenbaum(d: Daten): string {
  const { szene, titel } = rollenbaumSzene(d);
  return abbildung(d, 'rollenbaum', titel, d.t.abbildungen.rollenbaum.quelle, svgText(szene));
}

export function landkarteSzeneLeitfaden(d: Daten): Knoten {
  const l = d.t.abbildungen.landkarte;
  const name = (id: string) => {
    const n = l.eintraege[id];
    if (!n) throw new Error(`Landkarte: Name für ${id} fehlt in leitfaden.yaml (${d.sprache})`);
    return n as string;
  };
  const eintraege = d.landkarte.map((e) => ({ titel: name(e.id), spalte: e.spalte, zeile: e.zeile, markiert: e.im_kit }));
  const felder = (l.zeilen as string[]).flatMap((z, zi) =>
    (l.spalten as string[]).map((s, si) => {
      const hier = eintraege.filter((e) => e.spalte === si && e.zeile === zi).map((e) => e.titel);
      return setze(l.feld, { zeile: z, spalte: s, eintraege: hier.length ? hier.join('; ') : l.leer });
    }),
  );
  const beschreibung = setze(l.beschreibung, { felder: felder.join('. '), markiert: eintraege.filter((e) => e.markiert).map((e) => e.titel).join('; ') });
  return landkarteSzene(eintraege, { titel: l.titel, beschreibung, spalten: l.spalten, zeilen: l.zeilen, achse: l.achse, markiert: l.markiert, offen: l.offen }, { id: `abb-landkarte-${d.sprache}`, breite: 760, kopf: 116, spaltenGewichte: [1, 1, 2.2], kachel: 150 });
}

function abbLandkarte(d: Daten): string {
  const l = d.t.abbildungen.landkarte;
  return abbildung(d, 'landkarte', l.titel, l.quelle, svgText(landkarteSzeneLeitfaden(d)));
}

/** Abdeckung je Funktion: zählt subkategorien.yaml (Norm und Kit), wie die Tabelle der Bilanz. */
export function nistZeilen(d: Daten): (BalkenZeile<Abdeckung> & { funktion: string; quelle: 'norm' | 'kit'; anzahl: number })[] {
  const n = d.nist;
  const a = d.t.abbildungen.nist;
  return n.funktionen.flatMap((f) => {
    const liste = n.subkategorien.filter((s) => s.funktion === f.id);
    return (['norm', 'kit'] as const).map((q) => {
      const feld = q === 'norm' ? 'abdeckung' : 'abdeckung_kit';
      const werte = Object.fromEntries(GRADE.map((g) => [g, liste.filter((s) => s[feld] === g).length])) as Record<Abdeckung, number>;
      return { funktion: f.nist_id, quelle: q, anzahl: liste.length, titel: setze(a.zeile, { funktion: f.nist_id, anzahl: liste.length, quelle: a[q] }), werte };
    });
  });
}

function abbNist(d: Daten): string {
  const a = d.t.abbildungen.nist;
  const b = d.t.nist.bilanz;
  const zeilen = nistZeilen(d);
  const werte = zeilen.map((z) => setze(a.wert, { funktion: z.funktion, quelle: a[z.quelle], ganz: z.werte.ganz ?? 0, teilweise: z.werte.teilweise ?? 0, nicht: z.werte.nicht ?? 0 })).join('; ');
  const szene = balkenSzene(
    zeilen,
    [
      { schluessel: 'ganz', text: b.ganz, ton: 'gut' },
      { schluessel: 'teilweise', text: b.teilweise, ton: 'warnung', muster: true },
      { schluessel: 'nicht', text: b.nicht, ton: 'kritisch' },
    ],
    { titel: a.titel, beschreibung: setze(a.beschreibung, { werte }) },
    { id: `abb-nist-${d.sprache}`, breite: 760, titelSichtbar: false },
  );
  return abbildung(d, 'nist', a.titel, a.quelle, svgText(szene));
}

/** Fristen des AI Act für Leitfaden und Poster: Daten aus stand.yaml, Wörter aus leitfaden.yaml; je Datum eine Zeile. */
export function aiActFristen(d: Daten): { datum: string; ids: string[]; kurz: string; text: string; zustand: 'erledigt' | 'aktiv' | 'offen' }[] {
  const ft = d.t.abbildungen.fristen.eintraege as Record<string, { kurz: string; text: string }>;
  const stand = d.aiAct;
  const daten = new Map(stand.fristen.map((f) => [f.id, f.datum]));
  const ersetze = (s: string) => s.replace(/\{(FRIST-\d+)\}/g, (_, id: string) => {
    const x = daten.get(id);
    if (!x) throw new Error(`Frist ${id} fehlt in src/ai-act/stand.yaml`);
    return fristDatum(x, d.sprache);
  });
  const gruppen = new Map<string, string[]>();
  for (const id of Object.keys(ft)) {
    const datum = daten.get(id);
    if (!datum) throw new Error(`Frist ${id} aus leitfaden.yaml fehlt in src/ai-act/stand.yaml`);
    gruppen.set(datum, [...(gruppen.get(datum) ?? []), id]);
  }
  const sortiert = [...gruppen].sort((x, y) => x[0].localeCompare(y[0]));
  const naechste = sortiert.find(([datum]) => datum > stand.geprueft_am)?.[0];
  return sortiert.map(([datum, ids]) => ({
    datum,
    ids,
    kurz: ids.map((id) => ft[id]!.kurz).filter(Boolean).join(', '),
    text: ids.map((id) => ersetze(ft[id]!.text)).join('; '),
    zustand: datum <= stand.geprueft_am ? 'erledigt' : datum === naechste ? 'aktiv' : 'offen',
  }));
}

export function fristenSzene(d: Daten, o: { id: string; breite: number; textBreite?: number }): Knoten {
  const f = d.t.abbildungen.fristen;
  const liste = aiActFristen(d);
  const eintraege: AchsenEintrag[] = liste.map((x) => ({ datum: x.datum, titel: x.kurz, zustand: x.zustand }));
  const beschreibung = setze(f.beschreibung, {
    von: fristDatum(liste[0]!.datum, d.sprache),
    bis: fristDatum(liste.at(-1)!.datum, d.sprache),
    eintraege: liste.map((x) => `${fristDatum(x.datum, d.sprache)} ${x.text}`).join('; '),
    geprueft: fristDatum(d.aiAct.geprueft_am, d.sprache),
  });
  return zeitachseSzene(
    eintraege,
    { titel: f.titel, beschreibung, heute: setze(f.heute, { datum: fristDatum(d.aiAct.geprueft_am, d.sprache, true) }), datum: (iso) => fristDatum(iso, d.sprache, true) },
    { id: o.id, breite: o.breite, heute: d.aiAct.geprueft_am, titelSichtbar: false, textBreite: o.textBreite },
  );
}

function aiActFristenBaustein(d: Daten): string {
  const f = d.t.abbildungen.fristen;
  const quelle = setze(f.quelle, { fassung: fristDatum(d.aiAct.fassung.datum, d.sprache), geprueft: fristDatum(d.aiAct.geprueft_am, d.sprache) });
  const tabelle = `<table class="fristen"><thead><tr><th>${esc(f.ab)}</th><th>${esc(f.was)}</th></tr></thead><tbody>${aiActFristen(d)
    .map((x) => `<tr data-fristen="${x.ids.join(' ')}"><td class="datum">${esc(fristDatum(x.datum, d.sprache))}</td><td>${esc(x.text)}</td></tr>`)
    .join('')}</tbody></table>`;
  return abbildung(d, 'fristen', f.titel, quelle, svgText(fristenSzene(d, { id: `abb-fristen-${d.sprache}`, breite: 760 }))) + tabelle;
}

const ABBILDUNGEN: Record<string, (d: Daten) => string> = {
  fahrplan: abbFahrplan,
  risikomatrix: abbRisikomatrix,
  rollenbaum: abbRollenbaum,
  landkarte: abbLandkarte,
  nist: abbNist,
};

/** Ersetzt die Bausteine im Markdown. Unbekannte Bausteine sind ein Fehler. */
export function ersetzeBausteine(md: string, d: Daten): string {
  return md.replace(/^<!--[ \t]*([a-z]+)(?::([a-z0-9]+))?[ \t]*-->[ \t]*$/gm, (_, name: string, nr?: string) => {
    switch (name) {
      case 'abb': {
        const f = ABBILDUNGEN[nr ?? ''];
        if (!f) throw new Error(`Unbekannte Abbildung <!-- abb:${nr} -->`);
        return f(d);
      }
      case 'aiactfristen': return aiActFristenBaustein(d);
      case 'steckbrief': return steckbrief(d, Number(nr));
      case 'aufwand': return aufwand(d);
      case 'modi': return modi(d);
      case 'dokumentenuebersicht': return dokumentenuebersicht(d);
      case 'nistbilanz': return nistBilanz(d);
      case 'niststand': return nistStand(d);
      case 'nistgenai': return nistGenai(d);
      default: throw new Error(`Unbekannter Baustein <!-- ${name} -->`);
    }
  });
}

/** Alle Kapitel als ein Markdown-Text mit ersetzten Bausteinen. */
export function baueMarkdown(d: Daten): string {
  const ordner = leitfadenOrdner(d.sprache);
  const neueSeite = new Set<string>(d.t.neue_seite ?? []);
  d.abbNr = 0;
  return (d.t.kapitel as string[])
    .map((k) => `<section class="kapitel${neueSeite.has(k) ? ' neue-seite' : ''}">\n\n${ersetzeBausteine(readFileSync(join(ordner, k), 'utf8'), d)}\n\n</section>`)
    .join('\n\n');
}

// ---------------------------------------------------------------------------------------------
// HTML

interface Ueberschrift { ebene: number; text: string; id: string }

function slug(text: string, vergeben: Set<string>): string {
  let s = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'abschnitt';
  const basis = s;
  for (let i = 2; vergeben.has(s); i++) s = `${basis}-${i}`;
  vergeben.add(s);
  return s;
}

/** Markdown → HTML; Überschriften erhalten IDs (und im Messlauf Messmarken). */
export function renderMarkdown(md: string, messmarken = false): { html: string; ueberschriften: Ueberschrift[] } {
  const mdi = new MarkdownIt({ html: true, linkify: true, typographer: false });
  const ueberschriften: Ueberschrift[] = [];
  const vergeben = new Set<string>();
  mdi.core.ruler.push('ueberschrift-ids', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i]!;
      if (tok.type !== 'heading_open') continue;
      const ebene = Number(tok.tag.slice(1));
      const text = tokens[i + 1]?.content ?? '';
      const id = slug(text, vergeben);
      tok.attrSet('id', id);
      if (ebene <= 2) ueberschriften.push({ ebene, text, id });
    }
  });
  const standard = mdi.renderer.rules.heading_close ?? ((t, i, o, _e, self) => self.renderToken(t, i, o));
  let zaehler = 0;
  mdi.renderer.rules.heading_close = (tokens, idx, opt, env, self) => {
    const ebene = Number(tokens[idx]!.tag.slice(1));
    const marke = messmarken && ebene <= 2 ? `<span class="messmarke">QQM${zaehler++}QQ</span>` : '';
    return marke + standard(tokens, idx, opt, env, self);
  };
  return { html: mdi.render(md), ueberschriften };
}

/** Produktname in Kopfzeile und Titelseite. */
const KIT_NAME: Record<Sprache, string> = { de: 'ISO/IEC 42001 Starter-Kit', en: 'ISO/IEC 42001 Starter Kit' };

// Design System «KMU-CIO Systemkarte» (docs/design-system): Druck hell, Archivo für Titel, Tabellen und Grafik,
// Source Serif 4 für Lesetext. Die Schriften stammen aus src/app/schriften (SIL OFL 1.1) und werden eingebettet.
const ANZEIGE = `'Archivo Statisch', 'Archivo Variable', Archivo, 'Helvetica Neue', Arial, sans-serif`;
const LESE = `'Source Serif 4 Statisch', 'Source Serif 4 Variable', 'Source Serif 4', Georgia, 'Times New Roman', serif`;
const UNICODE_LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const UNICODE_LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

/** Schriftdateien (woff2) des Design Systems; dieselben Dateien bettet der AIMS-Manager ein. */
export const SCHRIFTDATEIEN = [
  { familie: 'Archivo Variable', datei: 'archivo-latin-wdth-normal.woff2', bereich: UNICODE_LATIN, achsen: 'font-weight: 100 900; font-stretch: 62% 125%;' },
  { familie: 'Archivo Variable', datei: 'archivo-latin-ext-wdth-normal.woff2', bereich: UNICODE_LATIN_EXT, achsen: 'font-weight: 100 900; font-stretch: 62% 125%;' },
  { familie: 'Source Serif 4 Variable', datei: 'source-serif-4-latin-wght-normal.woff2', bereich: UNICODE_LATIN, achsen: 'font-weight: 200 900;' },
  { familie: 'Source Serif 4 Variable', datei: 'source-serif-4-latin-ext-wght-normal.woff2', bereich: UNICODE_LATIN_EXT, achsen: 'font-weight: 200 900;' },
] as const;

/** Aus den variablen Dateien abgeleitete statische Schnitte (gleiche OFL-Lizenz), nur für die PDF */
const SCHRIFTEN_STATISCH = [
  ...[400, 500, 600, 650, 700, 750, 820].map((gewicht) => ({ familie: 'Archivo Statisch', gewicht, datei: `archivo-latin-${gewicht}.woff2` })),
  ...[400, 600, 700].map((gewicht) => ({ familie: 'Source Serif 4 Statisch', gewicht, datei: `source-serif-4-latin-${gewicht}.woff2` })),
];

/** @font-face mit eingebetteten Daten (base64); `nur` wählt Dateien aus. */
export function schriftenCss(nur?: (datei: string) => boolean): string {
  const variabel = SCHRIFTDATEIEN.filter((f) => !nur || nur(f.datei)).map((f) => {
    const daten = readFileSync(join(SRC, 'app', 'schriften', f.datei)).toString('base64');
    return `@font-face { font-family: '${f.familie}'; font-style: normal; font-display: block; ${f.achsen} src: url(data:font/woff2;base64,${daten}) format('woff2'); unicode-range: ${f.bereich}; }`;
  });
  // Statische Schnitte für den Druck: Variable Schriften bettet Chromium als Type 3 ein, mit unruhigen Abständen und schlechtem Text (F-11)
  const statisch = SCHRIFTEN_STATISCH.filter((f) => !nur || nur(f.datei)).map((f) => {
    const daten = readFileSync(join(SRC, 'app', 'schriften', 'statisch', f.datei)).toString('base64');
    return `@font-face { font-family: '${f.familie}'; font-style: normal; font-weight: ${f.gewicht}; font-display: block; src: url(data:font/woff2;base64,${daten}) format('woff2'); unicode-range: ${UNICODE_LATIN}; }`;
  });
  return [...variabel, ...statisch].join('\n');
}

/** Tokens hell (tokens.json, Druck immer hell) */
const TOKENS = `:root { --seite: #f2f0eb; --karte: #ffffff; --flaeche-tief: #e9e6df; --tinte: #121821; --text: #262d36; --gedaempft: #535c67;
  --linie: rgba(18, 24, 33, .12); --linie-stark: rgba(18, 24, 33, .28); --kontur: #6b737c; --blau: #1c5d94; --blau-hauch: rgba(28, 93, 148, .08);
  --anzeige: ${ANZEIGE}; --lese: ${LESE}; }`;

/** Etikett des Motivs: Knoten in blau auf einer Leitung (über Überschriften und als Trenner). */
const ETIKETT = 'radial-gradient(circle at 4.5px 4.5px, var(--blau) 4px, transparent 4.6px) no-repeat, linear-gradient(var(--linie-stark), var(--linie-stark)) 0 4px / 100% 1px no-repeat';

function druckCss(d: Daten): string {
  const t = d.t;
  const rand = `font-family: ${ANZEIGE}; font-size: 7.5pt; color: #535c67;`;
  return `
${schriftenCss()}
@page { size: A4; margin: 20mm 17mm 18mm 19mm;
  @top-left { content: "${t.titel}"; ${rand} }
  @top-right { content: "${KIT_NAME[d.sprache]}"; ${rand} }
  @bottom-left { content: "${t.absender}"; ${rand} }
  @bottom-right { content: "${t.seite} " counter(page) " ${t.von} " counter(pages); ${rand} }
}
@page :first { @top-left { content: none; } @top-right { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }
${TOKENS}
html { font-family: var(--lese); font-size: 9.4pt; line-height: 1.42; color: var(--text); background: var(--karte); font-optical-sizing: auto; font-kerning: normal; }
body { margin: 0; }
h1, h2, h3 { font-family: var(--anzeige); color: var(--tinte); line-height: 1.14; letter-spacing: 0; word-spacing: 0.08em; break-after: avoid; text-wrap: balance; }
h1 { font-size: 17pt; font-weight: 750; margin: 20pt 0 8pt; }
h1::before { content: ""; display: block; height: 9px; margin-bottom: 7pt; background: ${ETIKETT}; }
section.neue-seite { break-before: page; }
section.neue-seite > h1:first-child { margin-top: 0; }
h2 { font-size: 12pt; font-weight: 700; margin: 15pt 0 5pt; }
h3 { font-size: 10pt; font-weight: 700; margin: 11pt 0 4pt; }
p { margin: 0 0 5.5pt; orphans: 3; widows: 3; text-wrap: pretty; }
ul, ol { margin: 0 0 6pt; padding-left: 15pt; }
li { margin: 0 0 2.5pt; }
li::marker { color: var(--blau); }
strong { color: var(--tinte); font-weight: 650; }
code { font-family: var(--anzeige); font-size: 0.9em; background: var(--flaeche-tief); padding: 0 2pt; border-radius: 2pt; }
a { color: inherit; text-decoration: none; }
/* Tabelle (Komponente Tabelle): Haarlinien, Kopf gedämpft über linie-stark, keine Zebrastreifen, keine senkrechten Linien */
table { width: 100%; border-collapse: collapse; margin: 4pt 0 10pt; font-family: var(--anzeige); font-size: 8.2pt; line-height: 1.32; font-variant-numeric: tabular-nums; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th, td { text-align: left; vertical-align: top; padding: 3pt 5pt; border-bottom: 0.5pt solid var(--linie); }
thead th { color: var(--gedaempft); font-weight: 600; border-bottom: 0.8pt solid var(--linie-stark); }
td.zahl, th.zahl { text-align: right; white-space: nowrap; }
td.dok, span.dok { font-weight: 650; color: var(--tinte); white-space: nowrap; }
td.datum { font-weight: 650; color: var(--tinte); white-space: nowrap; }
table.uebersicht { table-layout: fixed; }
table.uebersicht th:nth-child(1) { width: 13%; } table.uebersicht th:nth-child(2) { width: 36%; } table.uebersicht th:nth-child(3) { width: 15%; }
td.pfad { font-size: 7.6pt; color: var(--gedaempft); word-break: break-all; }
tr.summe td { font-weight: 700; color: var(--tinte); border-top: 0.8pt solid var(--linie-stark); }
/* Steckbrief als Hinweis: Rahmen rundum gestrichelt, kein Linksbalken */
table.steckbrief { border-collapse: separate; border-spacing: 0; border: 0.75pt dashed var(--linie-stark); border-radius: 7pt; margin: 4pt 0 8pt; break-inside: avoid; }
table.steckbrief th { width: 30%; font-weight: 600; color: var(--gedaempft); }
table.steckbrief tr:last-child th, table.steckbrief tr:last-child td { border-bottom: none; }
span.modul { font-size: 7.2pt; color: var(--gedaempft); }
span.leise, p.leise { font-size: 7.6pt; color: var(--gedaempft); }
table.nist-bilanz th[colspan] { text-align: center; }
table.nist-stand td.pfad { width: 38%; }
p.nist-satz { margin-top: -4pt; }
/* Abbildungen: Titel mit Nummer, Grafik in voller Satzbreite, Quellenzeile */
figure.abb { margin: 9pt 0 10pt; break-inside: avoid; }
figcaption.abb-titel { font-family: var(--anzeige); font-size: 8.8pt; font-weight: 650; color: var(--tinte); margin: 0 0 5pt; text-wrap: balance; }
.abb-nr { color: var(--blau); margin-right: 3pt; }
figure.abb svg { display: block; width: 100%; height: auto; }
p.abb-quelle { font-family: var(--anzeige); font-size: 7.2pt; color: var(--gedaempft); margin: 4pt 0 0; padding-top: 3pt; border-top: 0.5pt solid var(--linie); }
.abb-zwei { display: grid; grid-template-columns: 50% 1fr; gap: 6mm; align-items: start; }
.abb-text { font-size: 8.6pt; }
.abb-text ul { padding-left: 11pt; }
p.abb-zwischentitel { font-family: var(--anzeige); font-weight: 650; color: var(--tinte); margin-bottom: 3pt; }
section.einseiter { break-before: page; font-size: 10.6pt; line-height: 1.45; }
section.einseiter h2 { font-size: 15pt; margin-top: 0; }
section.einseiter ol { padding-left: 18pt; }
section.einseiter ol li { margin-bottom: 7pt; }
section.einseiter p.fuss { margin-top: 10pt; font-family: var(--anzeige); font-size: 7.6pt; color: var(--gedaempft); border-top: 0.5pt solid var(--linie); padding-top: 4pt; }
.messmarke { position: absolute; font-size: 3pt; color: #fff; }
/* Titelseite: Etikett mit Knoten und Leitung, Versprechen als ruhige Fläche ohne Linksbalken */
.titelseite { height: 250mm; display: flex; flex-direction: column; justify-content: space-between; }
.titelseite .oben { margin-top: 40mm; }
.titelseite .kit { font-family: var(--anzeige); font-size: 10pt; font-weight: 650; color: var(--gedaempft); letter-spacing: 0.03em; margin: 0 0 7mm; padding-top: 7mm; background: ${ETIKETT}; }
.titelseite h1.titel { font-size: 36pt; font-weight: 820; letter-spacing: -0.02em; margin: 0 0 6mm; }
.titelseite h1.titel::before { content: none; }
.titelseite .untertitel { font-size: 14pt; color: var(--text); max-width: 140mm; }
.titelseite .versprechen { margin-top: 18mm; padding: 6mm 7mm; border: 0.75pt solid var(--linie); border-radius: 12pt; background: var(--seite); font-size: 12pt; color: var(--tinte); max-width: 140mm; }
.titelseite .unten { font-family: var(--anzeige); font-size: 9pt; color: var(--text); border-top: 0.5pt solid var(--linie-stark); padding-top: 4mm; }
.titelseite .unten p { margin: 0 0 2pt; }
/* Inhaltsverzeichnis */
nav.inhalt { break-before: page; font-family: var(--anzeige); }
nav.inhalt ol { list-style: none; padding: 0; margin: 0; columns: 2; column-gap: 10mm; }
nav.inhalt li { break-inside: avoid; display: flex; align-items: baseline; margin: 0; padding: 1.6pt 0; font-variant-numeric: tabular-nums; }
nav.inhalt li.e1 { font-weight: 650; color: var(--tinte); margin-top: 5pt; }
nav.inhalt li.e2 { padding-left: 14pt; font-size: 8.8pt; }
nav.inhalt li .punkte { flex: 1; border-bottom: 0.6pt dotted var(--kontur); margin: 0 4pt; transform: translateY(-2.5pt); }
nav.inhalt li .nr { min-width: 14pt; text-align: right; }
`;
}

function titelseite(d: Daten): string {
  const t = d.t;
  return `<section class="titelseite">
  <div class="oben">
    <p class="kit">${esc(KIT_NAME[d.sprache])}</p>
    <h1 class="titel">${esc(t.titel)}</h1>
    <p class="untertitel">${esc(t.untertitel)}</p>
    <p class="versprechen">${esc(t.versprechen)}</p>
  </div>
  <div class="unten">
    <p><strong>${esc(t.absender)}</strong></p>
    <p>${esc(t.version)} ${esc(d.version)}. ${esc(t.stand)}.</p>
    <p>${esc(t.lizenzzeile)}</p>
  </div>
</section>`;
}

function inhaltsverzeichnis(d: Daten, ue: Ueberschrift[], seiten: (number | undefined)[] | 'platzhalter' | 'keine'): string {
  const eintraege = ue
    .map((u, i) => {
      const s = seiten === 'platzhalter' ? '00' : seiten === 'keine' ? '' : String(seiten[i] ?? '');
      return `<li class="e${u.ebene}"><a href="#${u.id}">${esc(u.text)}</a><span class="punkte"></span><span class="nr">${s}</span></li>`;
    })
    .join('');
  return `<nav class="inhalt"><h1>${esc(d.t.inhalt)}</h1><ol>${eintraege}</ol></nav>`;
}

function seite(d: Daten, titel: string, css: string, body: string): string {
  return `<!doctype html>
<html lang="${d.sprache}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="author" content="${esc(d.t.absender)}">
<title>${esc(titel)}</title>
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

/** Druckfertiges HTML des Leitfadens. */
export function baueLeitfadenHtml(d: Daten, opt: { seiten?: (number | undefined)[] | 'platzhalter' | 'keine'; messmarken?: boolean } = {}): { html: string; ueberschriften: Ueberschrift[] } {
  const { html, ueberschriften } = renderMarkdown(baueMarkdown(d), opt.messmarken ?? false);
  const body = `${titelseite(d)}\n${inhaltsverzeichnis(d, ueberschriften, opt.seiten ?? 'keine')}\n<main>\n${html}</main>`;
  return { html: seite(d, `${d.t.titel}: ${d.t.untertitel}`, druckCss(d), body), ueberschriften };
}

// ---------------------------------------------------------------------------------------------
// Poster

const POSTER_ZOOM = 1.03;

function posterCss(): string {
  return `
${schriftenCss((datei) => datei.startsWith('archivo'))}
@page { size: A3 landscape; margin: 11mm 12mm; }
${TOKENS}
html { font-family: var(--anzeige); font-size: 9.4pt; line-height: 1.32; color: var(--text); background: var(--karte); font-variant-numeric: tabular-nums; }
/* Druckmassstab: füllt A3 quer; prüfen, dass das Poster einseitig bleibt */
body { margin: 0; zoom: ${POSTER_ZOOM}; }
h1, h2, h3 { color: var(--tinte); margin: 0; line-height: 1.12; letter-spacing: 0; word-spacing: 0.08em; }
p { margin: 0 0 3pt; }
ul { margin: 0; padding-left: 12pt; }
li { margin: 0 0 1.5pt; }
li::marker { color: var(--blau); }
strong { color: var(--tinte); }
.p-kopf { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 4mm; margin-bottom: 4mm; background: radial-gradient(circle at 4.5px calc(100% - 4.5px), var(--blau) 4px, transparent 4.6px) no-repeat, linear-gradient(var(--linie-stark), var(--linie-stark)) 0 calc(100% - 4px) / 100% 1px no-repeat; }
.p-kopf h1 { font-size: 26pt; font-weight: 820; }
.p-unter { font-size: 11pt; color: var(--text); margin: 1.5mm 0 0; }
.p-absender { font-size: 10pt; color: var(--gedaempft); text-align: right; margin: 0; }
.p-raster { display: grid; grid-template-columns: 1.2fr 0.95fr 1.1fr; grid-template-rows: auto auto; gap: 4mm 5mm; }
.p-feld { border: 0.75pt solid var(--linie-stark); border-radius: 4mm; padding: 3mm 3.5mm; background: var(--karte); }
.p-feld h2 { font-size: 12.5pt; font-weight: 750; margin-bottom: 1mm; }
.p-feld h3 { font-size: 10pt; font-weight: 700; margin: 0 0 1mm; }
.p-hinweis { color: var(--gedaempft); font-size: 8.4pt; margin-bottom: 2.5mm; }
.p-kreis { grid-row: 1; grid-column: 1; }
.p-schritte { grid-row: 1 / span 2; grid-column: 2; }
.p-controls { grid-row: 1; grid-column: 3; }
.p-pfad { grid-row: 2; grid-column: 1; }
.p-modul { grid-row: 2; grid-column: 3; }
.kreis { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, auto); gap: 3mm; }
.kreis svg.bogen { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; }
.kreis svg.bogen ellipse { fill: none; stroke: var(--linie-stark); stroke-width: 1.5; }
.kreis .k { position: relative; z-index: 1; background: var(--karte); border: 0.75pt solid var(--kontur); border-radius: 2.5mm; padding: 2mm 2.4mm; min-height: 22mm; }
.kreis .k .nr { font-size: 14pt; font-weight: 820; color: var(--blau); margin-right: 1.5mm; line-height: 1; }
.kreis .k .name { font-weight: 700; color: var(--tinte); font-size: 9.6pt; }
.kreis .k .was { font-size: 8.2pt; color: var(--text); display: block; margin-top: 0.8mm; }
.kreis .k .doks { font-size: 7.8pt; color: var(--blau); display: block; margin-top: 1mm; font-weight: 650; }
.kreis .mitte { position: relative; z-index: 1; background: var(--seite); border-radius: 50%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 3mm; }
.kreis .mitte strong { color: var(--tinte); font-size: 10.5pt; }
.kreis .mitte span { font-size: 8pt; color: var(--text); margin-top: 1mm; }
.kreis .weiter { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 8.4pt; color: var(--blau); font-weight: 650; }
ol.schritte { list-style: none; margin: 0; padding: 0; }
ol.schritte li { display: grid; grid-template-columns: 9mm 1fr; gap: 0 2mm; padding: 1.8mm 0; border-bottom: 0.5pt solid var(--linie); margin: 0; }
ol.schritte li:last-child { border-bottom: none; }
ol.schritte .nr { grid-row: 1 / span 3; font-size: 17pt; font-weight: 820; color: var(--blau); line-height: 1; }
ol.schritte .name { font-weight: 700; color: var(--tinte); font-size: 10pt; }
ol.schritte .doks { font-size: 8.2pt; color: var(--text); }
ol.schritte .zeit { font-size: 7.8pt; color: var(--gedaempft); }
table.gruppen { width: 100%; border-collapse: collapse; font-size: 8.6pt; }
table.gruppen td { padding: 1.2mm 1.5mm; border-bottom: 0.5pt solid var(--linie); vertical-align: top; }
table.gruppen td.id { font-weight: 750; color: var(--blau); white-space: nowrap; width: 11mm; }
table.gruppen td.anz { text-align: right; color: var(--gedaempft); white-space: nowrap; }
table.gruppen .doks { display: block; font-size: 7.6pt; color: var(--gedaempft); }
.p-zwei { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-top: 1mm; }
.p-zwei ul { font-size: 8.6pt; }
.p-neu { margin-top: 2.5mm; font-size: 8.6pt; background: var(--seite); padding: 1.8mm 2.4mm; border-radius: 2mm; }
.p-modul p { font-size: 8.6pt; }
.p-modul h3.p-zweitmodul { margin-top: 1.5mm; padding-top: 1.2mm; border-top: 0.5pt solid var(--linie); font-size: 10pt; }
.p-fristen { margin: 1mm 0 1.5mm; }
.p-fristen svg { display: block; width: 100%; height: auto; }
.p-fristen-quelle { font-size: 7pt; color: var(--gedaempft); margin: 0.5mm 0 1.5mm; }
.p-klein { font-size: 7.8pt; color: var(--text); }
.p-fuss { display: flex; justify-content: space-between; gap: 6mm; margin-top: 3.5mm; padding-top: 2mm; border-top: 0.75pt solid var(--linie-stark); font-size: 8pt; color: var(--gedaempft); }
.p-fuss span:first-child { font-weight: 650; color: var(--tinte); }
`;
}

function kreislauf(d: Daten): string {
  const karte = (kid: string) => {
    const kap = d.kapitel42001.find((k) => k.id === kid);
    if (!kap) throw new Error(`Kapitel ${kid} fehlt im Katalog`);
    return `<div class="k"><span class="nr">${esc(kid.replace('K-', ''))}</span><span class="name">${esc(d.kapitelTitel[kid] ?? kid)}</span><span class="was">${esc(d.t.poster_kapitel[kid] ?? '')}</span><span class="doks">${esc(kap.vorlagen.join(' '))}</span></div>`;
  };
  // Anordnung im Uhrzeigersinn: 4 5 6 / 10 Mitte 7 / 9 8 (Pfeil); die Leitung des Kreislaufs liegt hinter den Karten
  const bogen = `<svg class="bogen" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="150" cy="100" rx="112" ry="70" vector-effect="non-scaling-stroke"/></svg>`;
  return `<div class="kreis">${bogen}
${karte('K-4')}${karte('K-5')}${karte('K-6')}
${karte('K-10')}<div class="mitte"><strong>${esc(d.t.poster_mitte)}</strong><span>${esc(d.t.poster_mitte_klein)}</span></div>${karte('K-7')}
${karte('K-9')}${karte('K-8')}<div class="weiter"><svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true" style="vertical-align:-1px"><path fill="currentColor" d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg> ${esc(d.sprache === 'de' ? 'jährlich wiederholen: Überwachungsaudit, Rezertifizierung im dritten Jahr' : 'repeat every year: surveillance audit, recertification in year three')}</div>
</div>`;
}

/** Fristen des AI Act auf dem Poster: Zeitachse aus stand.yaml (dieselbe Quelle wie Kapitel 7). */
function posterFristen(d: Daten): string {
  const f = d.t.abbildungen.fristen;
  const quelle = setze(f.quelle, { fassung: fristDatum(d.aiAct.fassung.datum, d.sprache), geprueft: fristDatum(d.aiAct.geprueft_am, d.sprache) });
  return `<div class="p-fristen">${svgText(fristenSzene(d, { id: `poster-fristen-${d.sprache}`, breite: 500, textBreite: 230 }))}</div><p class="p-fristen-quelle">${esc(quelle)}</p>`;
}

function posterSchritte(d: Daten): string {
  const sb = d.t.steckbrief;
  const w = (x: [number, number]) => (x[0] === x[1] ? `${x[0]}` : `${x[0]} ${sb.bis} ${x[1]}`);
  return `<ol class="schritte">${d.schritte
    // Vorlagen des Moduls NIST AI RMF stehen im Modulfeld des Posters, nicht bei den Schritten
    .map((s) => `<li><span class="nr">${s.nr}</span><span class="name">${esc(d.t.schritte[s.nr])}</span><span class="doks">${esc(vorlagenFuer(d, s.nr).filter((id) => dokument(d, id).art !== 'modul_nist').join(', '))}</span><span class="zeit">${esc(sb.wochen)}: ${esc(sb.mit_isms)} ${w(s.wochen.mit_isms)}, ${esc(sb.ohne_isms)} ${w(s.wochen.ohne_isms)}</span></li>`)
    .join('')}</ol>`;
}

function controlgruppen(d: Daten): string {
  return `<table class="gruppen"><tbody>${d.controlGruppen
    .map((g) => `<tr><td class="id">${esc(g.id)}</td><td>${esc(d.gruppenTitel[g.id] ?? g.id)}<span class="doks">${esc(g.vorlagen.join(' '))}</span></td><td class="anz">${g.anzahl}</td></tr>`)
    .join('')}</tbody></table>`;
}

/** Druckfertiges HTML des Posters (A3 quer). */
export function bauePosterHtml(d: Daten): string {
  const vorlage = readFileSync(join(leitfadenOrdner(d.sprache), 'poster.html'), 'utf8').replace(/^<!--[\s\S]*?-->\s*/, '');
  const bausteine: Record<string, () => string> = {
    kreislauf: () => kreislauf(d),
    schritte: () => posterSchritte(d),
    controlgruppen: () => controlgruppen(d),
    fristen: () => posterFristen(d),
  };
  const body = vorlage.replace(/\{\{([a-z_]+)\}\}/g, (_, name: string) => {
    if (bausteine[name]) return bausteine[name]();
    const text = d.t[name];
    if (typeof text !== 'string') throw new Error(`Unbekannter Platzhalter {{${name}}} im Poster`);
    return esc(text);
  });
  return seite(d, d.t.poster_titel, posterCss(), body);
}

// ---------------------------------------------------------------------------------------------
// PDF

function pdftotextVorhanden(): boolean {
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Liest aus einem Mess-PDF die Seite jeder Messmarke QQM<n>QQ (1-basiert). */
export function seitenAusText(text: string, anzahl: number): (number | undefined)[] {
  const seiten = text.split('\f');
  const ergebnis: (number | undefined)[] = Array.from({ length: anzahl });
  seiten.forEach((inhalt, i) => {
    for (const m of inhalt.replace(/\s+/g, '').matchAll(/QQM(\d+)QQ/g)) {
      const n = Number(m[1]);
      if (n < anzahl && ergebnis[n] === undefined) ergebnis[n] = i + 1;
    }
  });
  return ergebnis;
}

function seitenzahl(pdf: string): number {
  try {
    const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
    return Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? 0);
  } catch {
    return 0;
  }
}

export interface Ergebnis { leitfaden: string; poster: string; seitenLeitfaden: number; seitenPoster: number; html: string[] }

export async function erzeuge(sprache: Sprache, opt: { nurHtml?: boolean; ablage?: string } = {}): Promise<Ergebnis> {
  const d = ladeDaten(sprache);
  const htmlOrdner = join(REPO, 'dist', 'leitfaden', sprache);
  const kitOrdner = join(REPO, 'dist', 'kit', d.t.kitordner, d.t.datei.ordner);
  mkdirSync(htmlOrdner, { recursive: true });
  mkdirSync(kitOrdner, { recursive: true });
  const leitfadenPdf = join(kitOrdner, `${d.t.datei.leitfaden}.pdf`);
  const posterPdf = join(kitOrdner, `${d.t.datei.poster}.pdf`);
  const leitfadenHtml = join(htmlOrdner, `${d.t.datei.leitfaden}.html`);
  const posterHtml = join(htmlOrdner, `${d.t.datei.poster}.html`);
  writeFileSync(posterHtml, bauePosterHtml(d));

  if (opt.nurHtml) {
    writeFileSync(leitfadenHtml, baueLeitfadenHtml(d).html);
    return { leitfaden: '', poster: '', seitenLeitfaden: 0, seitenPoster: 0, html: [leitfadenHtml, posterHtml] };
  }

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const drucke = async (html: string, ziel: string) => {
      await page.setContent(html, { waitUntil: 'load' });
      await page.emulateMedia({ media: 'print' });
      await page.pdf({ path: ziel, preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
    };

    // Durchlauf 1: Messmarken, Platzhalter im Inhaltsverzeichnis (gleiche Breite wie Seitenzahlen)
    let seiten: (number | undefined)[] | 'keine' = 'keine';
    if (pdftotextVorhanden()) {
      const tmp = mkdtempSync(join(tmpdir(), 'leitfaden-'));
      try {
        const mess = baueLeitfadenHtml(d, { seiten: 'platzhalter', messmarken: true });
        const messPdf = join(tmp, 'mess.pdf');
        await drucke(mess.html, messPdf);
        seiten = seitenAusText(execFileSync('pdftotext', ['-raw', messPdf, '-'], { encoding: 'utf8' }), mess.ueberschriften.length);
        const fehlend = seiten.filter((s) => s === undefined).length;
        if (fehlend > 0) console.warn(`Warnung: ${fehlend} Überschriften ohne Seitenzahl`);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    } else {
      console.warn('Warnung: pdftotext fehlt (poppler-utils); Inhaltsverzeichnis ohne Seitenzahlen');
    }

    // Durchlauf 2: endgültiger Druck
    const endgueltig = baueLeitfadenHtml(d, { seiten });
    writeFileSync(leitfadenHtml, endgueltig.html);
    await drucke(endgueltig.html, leitfadenPdf);
    await drucke(readFileSync(posterHtml, 'utf8'), posterPdf);
  } finally {
    await browser.close();
  }

  const ergebnis: Ergebnis = {
    leitfaden: leitfadenPdf,
    poster: posterPdf,
    seitenLeitfaden: seitenzahl(leitfadenPdf),
    seitenPoster: seitenzahl(posterPdf),
    html: [leitfadenHtml, posterHtml],
  };
  if (ergebnis.seitenPoster > 1) console.warn(`Warnung: Poster hat ${ergebnis.seitenPoster} Seiten statt einer`);
  if (opt.ablage) {
    mkdirSync(opt.ablage, { recursive: true });
    for (const pdf of [leitfadenPdf, posterPdf]) copyFileSync(pdf, join(opt.ablage, pdf.split('/').pop()!));
  }
  return ergebnis;
}

// ---------------------------------------------------------------------------------------------
// Hauptprogramm

function argument(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sprache = (argument('--sprache') ?? 'de') as Sprache;
  if (sprache !== 'de' && sprache !== 'en') throw new Error(`Sprache ${sprache} unbekannt (de, en)`);
  const e = await erzeuge(sprache, { nurHtml: process.argv.includes('--nur-html'), ablage: argument('--ablage') });
  for (const h of e.html) console.log(`HTML   ${h}`);
  if (e.leitfaden) console.log(`PDF    ${e.leitfaden} (${e.seitenLeitfaden} Seiten)`);
  if (e.poster) console.log(`PDF    ${e.poster} (${e.seitenPoster} Seite)`);
  const ablage = argument('--ablage');
  if (ablage && e.leitfaden) console.log(`Ablage ${ablage}`);
}
