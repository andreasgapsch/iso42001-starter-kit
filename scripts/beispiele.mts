// Erzeugt aus den Beispielprojekten (src/beispiele/*.aims.json) die vollständigen Dokumentensets:
//   dist/beispiele/<firma>/<sprache>/        Modus «beispiel» (Kennzeichnung «Beispiel aus dem Starter-Kit»)
//   dist/firmendokumente/<firma>/<sprache>/  Modus «firma» (Prüftor G8: frei von Kit-Angaben)
// Je Sprache die eigene Projektdatei (<firma>.de.aims.json für DE, <firma>.en.aims.json für EN).
// Pfad gemäss meta.mitIsms (Ergänzungsblätter statt eb-Vorlagen), Module gemäss meta.modulAiAct und meta.modulNistRmf (N-01 bis N-04), D-09 je KI-System.
// Aufruf: npx tsx scripts/beispiele.mts [--pdf] [--zip]
//   --pdf  wandelt jede Datei mit LibreOffice headless in PDF und zählt die Seiten (DOCX mit Haupttext ohne Anlagen über 4 Seiten werden gemeldet)
//   --zip  legt je Firma und Sprache ein ZIP des Beispielsets unter dist/beispiele/ ab
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { strFromU8, unzipSync } from 'fflate';
import { renderDocx, renderXlsx, zipErstellen, type DocxDokument, type XlsxMappe } from '../src/generator/index.ts';
import { ladeTexte } from '../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../src/i18n/texte.ts';
import { ladeKataloge } from '../src/kataloge/laden-node.ts';
import { dokumentImProjekt } from '../src/kataloge/typen.ts';
import { KIT_VERSION, leeresProjekt } from '../src/model/neu.ts';
import type { Projekt, Sprache } from '../src/model/typen.ts';
import type { Form, Modus, Vorlage, VorlagenKontext } from '../src/vorlagen/kontext.ts';
import { EIGENE_EB_FORM, generischesErgaenzungsblatt, VORLAGEN, ZUSATZDATEIEN } from '../src/vorlagen/index.ts';
import { ebDateistamm, ergaenzungsblaetter } from '../src/vorlagen/ergaenzungsblatt.ts';
import { gestaltungEinsetzen } from '../src/vorlagen/gestaltung.ts';
import { projektDrawio } from '../src/prozesse/drawio-projekt.ts';

const args = new Set(process.argv.slice(2));
const SPRACHEN: Sprache[] = ['de', 'en'];
const FIRMEN = ['muster-maschinenbau', 'praezisionsteile'] as const;
export const BEISPIELE: { firma: string; sprache: Sprache; datei: string }[] = FIRMEN.flatMap((firma) =>
  SPRACHEN.map((sprache) => ({ firma, sprache, datei: `src/beispiele/${firma}.${sprache}.aims.json` })),
);
const kataloge = ladeKataloge();

interface Auftrag { name: string; vorlage: Vorlage; form: Form; kiSystemId?: string }

/** Welche Dateien ein Projekt erhält: Pfad (mit/ohne ISMS), Modul, je System */
export function auftraege(p: Projekt, sprache: Sprache): Auftrag[] {
  const liste: Auftrag[] = [];
  const mitIsms = p.meta.mitIsms;
  const ebKatalog = ergaenzungsblaetter(kataloge);
  for (const d of kataloge.dokumente.dokumente) {
    const vorlage = VORLAGEN[d.id];
    if (!vorlage) throw new Error(`Vorlage fehlt: ${d.id}`);
    if (!dokumentImProjekt(d, p.meta, p.prozesse !== undefined)) continue;
    if (d.id === 'D-23' && !mitIsms) continue; // Integrationsmatrix 27001 nur im Pfad mit ISMS
    const stamm = d.datei[sprache];
    const ebName = ebDateistamm(kataloge, `${d.id}-EB`, sprache);
    if (d.je_system) {
      for (const s of p.kiSysteme) if (p.folgenabschaetzungen.some((f) => f.kiSystem === s.id)) liste.push({ name: `${stamm}_${s.id}`, vorlage, form: 'dokument', kiSystemId: s.id });
      continue;
    }
    const alsEb = mitIsms && d.eb && EIGENE_EB_FORM.has(d.id);
    liste.push({ name: alsEb ? ebName : stamm, vorlage, form: alsEb ? 'ergaenzungsblatt' : 'dokument' });
    for (const z of ZUSATZDATEIEN[d.id] ?? []) liste.push({ name: `${alsEb ? ebName : stamm}_${z.suffix[sprache]}`, vorlage: z.vorlage, form: alsEb ? 'ergaenzungsblatt' : 'dokument' });
    // Generische Ergänzungsblätter (ohne eigene Form): zusätzlich zur Hauptvorlage, die die Projektdaten trägt (z. B. D-07)
    if (mitIsms) for (const b of ebKatalog.filter((e) => e.vorlage === d.id && !EIGENE_EB_FORM.has(d.id))) liste.push({ name: ebDateistamm(kataloge, b.id, sprache), vorlage: generischesErgaenzungsblatt(b.id), form: 'ergaenzungsblatt' });
  }
  return liste;
}

async function rendere(ir: DocxDokument | XlsxMappe, zeitpunkt: Date): Promise<{ daten: Uint8Array; endung: 'docx' | 'xlsx' }> {
  if ('bloecke' in ir) return { daten: await renderDocx(ir, { zeitpunkt }), endung: 'docx' };
  return { daten: await renderXlsx(ir, { zeitpunkt }), endung: 'xlsx' };
}

function schreibe(pfad: string, daten: Uint8Array) {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, daten);
}

async function erzeuge(p: Projekt, modus: Modus, ziel: string): Promise<string[]> {
  const sprache = p.meta.dokumentSprache;
  const u = erstelleUebersetzer(sprache, ladeTexte(sprache));
  const zeitpunkt = new Date(p.meta.geaendert);
  rmSync(ziel, { recursive: true, force: true });
  const dateien: string[] = [];
  for (const a of auftraege(p, sprache)) {
    const ctx: VorlagenKontext = { u, modus, form: a.form, projekt: p, kataloge, kitVersion: KIT_VERSION, ...(a.kiSystemId ? { kiSystemId: a.kiSystemId } : {}) };
    // Gestaltung der Firma an derselben Stelle wie im Werkzeug (Muster Maschinenbau mit Musterlogo, Präzisionsteile ohne)
    const ir = gestaltungEinsetzen(a.vorlage(ctx), p, modus);
    const json = JSON.stringify(ir);
    if (/undefined|\[object Object\]/.test(json)) throw new Error(`${a.name}: «undefined» oder Objekt im Text`);
    const { daten, endung } = await rendere(ir, zeitpunkt);
    const pfad = join(ziel, `${a.name}.${endung}`);
    schreibe(pfad, daten);
    dateien.push(pfad);
  }
  // Prozesse als Datei für draw.io (Stand des Projekts), nur wenn das Projekt Prozesse führt
  if (p.prozesse !== undefined) {
    const r = projektDrawio(p, kataloge, u, { geaendert: p.meta.geaendert, vars: { projektId: p.meta.projektId } });
    schreibe(join(ziel, r.name), new TextEncoder().encode(r.text));
  }
  return dateien;
}

function seitenzahl(pdf: string): number {
  const r = spawnSync('pdfinfo', [pdf], { encoding: 'utf8' });
  return Number(/Pages:\s+(\d+)/.exec(r.stdout)?.[1] ?? 0);
}

/** Seiten vor der ersten Anlage («Anlage A:», «Appendix A:»); ohne Anlage alle Seiten */
function hauptteil(pdf: string, seiten: number): number {
  for (let i = 1; i <= seiten; i++) {
    const r = spawnSync('pdftotext', ['-f', String(i), '-l', String(i), pdf, '-'], { encoding: 'utf8' });
    if (/^(?:Anlage|Appendix) [A-Z]:/m.test(r.stdout)) return i - 1;
  }
  return seiten;
}

/** Wandelt alle Dateien in PDF (je Endung und Ordner ein Lauf) und liefert die Seitenzahlen, bei DOCX auch den Haupttext ohne Anlagen */
function pdfPruefen(dateien: string[]): { datei: string; seiten: number; haupt: number }[] {
  const arbeit = mkdtempSync(join(tmpdir(), 'beispiele-pdf-'));
  const profil = join(arbeit, 'profil');
  const ergebnis: { datei: string; seiten: number; haupt: number }[] = [];
  try {
    // Je Endung und Quellordner ein eigener Ausgabeordner: gleichnamige Dateien (Beispiel und Firmendokument, beide
    // DE-Firmen) würden sich sonst gegenseitig überschreiben und falsche Seitenzahlen liefern.
    const gruppen = new Map<string, string[]>();
    for (const d of dateien) {
      const schluessel = `${d.split('.').pop()}|${dirname(d)}`;
      gruppen.set(schluessel, [...(gruppen.get(schluessel) ?? []), d]);
    }
    let nr = 0;
    for (const teil of gruppen.values()) {
      const aus = join(arbeit, String(nr++));
      mkdirSync(aus, { recursive: true });
      const r = spawnSync('soffice', [`-env:UserInstallation=${pathToFileURL(profil).href}`, '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', aus, ...teil], { encoding: 'utf8', timeout: 900_000 });
      if (r.status !== 0) throw new Error(`LibreOffice: ${r.stderr}`);
      for (const d of teil) {
        const pdf = join(aus, basename(d).replace(/\.[a-z]+$/, '.pdf'));
        if (!existsSync(pdf)) throw new Error(`Keine PDF für ${d}`);
        const seiten = seitenzahl(pdf);
        // Titelseite der Gestaltung (w:titlePg) zählt nicht zum Haupttext
        const titel = d.endsWith('.docx') && strFromU8(unzipSync(new Uint8Array(readFileSync(d)), { filter: (f) => f.name === 'word/document.xml' })['word/document.xml']!).includes('<w:titlePg/>') ? 1 : 0;
        ergebnis.push({ datei: d, seiten, haupt: d.endsWith('.docx') ? hauptteil(pdf, seiten) - titel : seiten });
      }
    }
  } finally {
    rmSync(arbeit, { recursive: true, force: true });
  }
  return ergebnis;
}

/** Leere Vorlagen in einen Arbeitsordner rendern (Seitenprüfung auch über die Vorlagen; Runde 1, F-09) */
async function leereVorlagen(ziel: string): Promise<string[]> {
  const dateien: string[] = [];
  for (const sprache of SPRACHEN) {
    const u = erstelleUebersetzer(sprache, ladeTexte(sprache));
    const zeitpunkt = new Date('2026-01-01T00:00:00Z');
    const projekt = leeresProjekt({ sprache, jetzt: zeitpunkt.toISOString(), projektId: 'kit' });
    for (const d of kataloge.dokumente.dokumente) {
      const vorlage = VORLAGEN[d.id];
      if (!vorlage) continue;
      const ctx: VorlagenKontext = { u, modus: 'leer', form: 'dokument', projekt, kataloge, kitVersion: KIT_VERSION };
      const { daten, endung } = await rendere(vorlage(ctx), zeitpunkt);
      const pfad = join(ziel, sprache, `${d.datei[sprache]}.${endung}`);
      schreibe(pfad, daten);
      dateien.push(pfad);
    }
  }
  return dateien;
}

async function main() {
  const alle: string[] = [];
  for (const f of FIRMEN) rmSync(join('dist', 'firmendokumente', f), { recursive: true, force: true });
  for (const b of BEISPIELE) {
    const p = JSON.parse(readFileSync(b.datei, 'utf8')) as Projekt;
    const sprache = p.meta.dokumentSprache;
    if (sprache !== b.sprache) throw new Error(`${b.datei}: meta.dokumentSprache ist «${sprache}», erwartet «${b.sprache}»`);
    const zielBeispiel = join('dist', 'beispiele', b.firma, sprache);
    const beispiel = await erzeuge(p, 'beispiel', zielBeispiel);
    const firma = await erzeuge(p, 'firma', join('dist', 'firmendokumente', b.firma, sprache));
    console.log(`${b.firma} (${sprache.toUpperCase()}): ${beispiel.length} Beispieldateien, ${firma.length} Firmendokumente (ISMS ${p.meta.mitIsms ? 'ja' : 'nein'}, Modul ${p.meta.modulAiAct ? 'ja' : 'nein'})`);
    alle.push(...beispiel, ...firma);
    if (args.has('--zip')) {
      const zeitpunkt = new Date(p.meta.geaendert);
      const eintraege = readdirSync(zielBeispiel).sort().map((n) => ({ pfad: `${b.firma}-${sprache}/${n}`, inhalt: new Uint8Array(readFileSync(join(zielBeispiel, n))) }));
      const zip = join('dist', 'beispiele', `beispiel-${b.firma}-${sprache}.zip`);
      writeFileSync(zip, zipErstellen(eintraege, { zeitpunkt }));
      console.log(`ZIP: ${zip}`);
    }
  }
  if (args.has('--pdf')) {
    const vorlagenOrdner = mkdtempSync(join(tmpdir(), 'vorlagen-pdf-'));
    alle.push(...(await leereVorlagen(vorlagenOrdner)));
    const seiten = pdfPruefen(alle);
    rmSync(vorlagenOrdner, { recursive: true, force: true });
    // Grenze 4 Seiten gilt für den Haupttext; Anlagen am Dokumentende zählen nicht (Firmendokumente und Beispiele)
    // D-27 ist das Prozesshandbuch und von der Grenze ausgenommen (Q10)
    const lang = seiten.filter((s) => s.datei.endsWith('.docx') && s.haupt > 4 && !/D-27_/.test(basename(s.datei)));
    console.log(`PDF: ${seiten.length} Dateien gewandelt, ${seiten.reduce((a, s) => a + s.seiten, 0)} Seiten`);
    for (const s of seiten.filter((x) => x.datei.includes(join('dist', 'beispiele')))) console.log(`  ${relative('dist', s.datei)}: ${s.seiten}${s.haupt !== s.seiten ? ` (Haupttext ${s.haupt})` : ''}`);
    if (lang.length) {
      console.log(`DOCX mit Haupttext über 4 Seiten: ${lang.map((s) => `${s.datei.includes('vorlagen-pdf-') ? `Vorlage ${basename(dirname(s.datei))}/${basename(s.datei)}` : relative('dist', s.datei)} (${s.haupt})`).join(', ')}`);
      process.exitCode = 1;
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) await main();
