// Baut das Kit: dist/kit/<wurzel>/ und das ZIP dist/<wurzel>.zip mit SHA256SUMS.txt.
// Aufruf: npx tsx scripts/build.mts [--ohne-leitfaden] [--ohne-app] [--ohne-zip]
// Reproduzierbar über SOURCE_DATE_EPOCH (Sekunden); Datum für Texte über BUILD_DATUM (JJJJ-MM-TT).
import { createHash } from 'node:crypto';
import { setzeCsp } from './csp.mts';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';
import { renderDocx, renderXlsx, zipErstellen, type DocxDokument, type XlsxMappe } from '../src/generator/index.ts';
import { ladeTexte } from '../src/i18n/laden-node.ts';
import { erstelleUebersetzer, type Uebersetzer } from '../src/i18n/texte.ts';
import { ladeKataloge } from '../src/kataloge/laden-node.ts';
import type { Dokument } from '../src/kataloge/typen.ts';
import { KIT_VERSION, leeresProjekt, mitKitVersion } from '../src/model/neu.ts';
import type { Form, Vorlage, VorlagenKontext } from '../src/vorlagen/kontext.ts';
import { EIGENE_EB_FORM, generischesErgaenzungsblatt, VORLAGEN, ZUSATZDATEIEN } from '../src/vorlagen/index.ts';
import { ebDateistamm } from '../src/vorlagen/ergaenzungsblatt.ts';
import { projektDrawio } from '../src/prozesse/drawio-projekt.ts';

const args = new Set(process.argv.slice(2));
const epoch = process.env.SOURCE_DATE_EPOCH ? Number(process.env.SOURCE_DATE_EPOCH) * 1000 : Date.now();
const zeitpunkt = new Date(epoch);
const datumIso = process.env.BUILD_DATUM ?? zeitpunkt.toISOString().slice(0, 10);
const datumDe = datumIso.split('-').reverse().join('.');
const KURZLINK = 'kmu-cio.ch/42001';
const QUELLEN = process.env.QUELLEN_DIR ?? join(homedir(), 'work', 'iso42001-quellen');

interface KitOrdner {
  wurzel: string;
  sprachen: Record<'de' | 'en', { ordner: string; leitfaden: string; vorlagen: string; modul: string; modul_nist: string; integration: string; beispiele: string }>;
  skill: string; werkzeug: string; rechtstexte: string; rechtstexte_nist: string; lizenz: string;
}
const ko = parse(readFileSync('src/kataloge/kit-ordner.yaml', 'utf8')) as KitOrdner;
const wurzelName = ko.wurzel.replace('{version}', KIT_VERSION);
const KIT = join('dist', 'kit', wurzelName);
const EB_UNTERORDNER = { de: 'Ergaenzungsblaetter', en: 'Supplementary-Sheets' } as const;

function schreibe(pfad: string, inhalt: Uint8Array | string) {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt);
}
const fuelle = (tpl: string, extra: Record<string, string> = {}) =>
  Object.entries({ version: KIT_VERSION, datum: datumDe, kurzlink: KURZLINK, ...extra }).reduce((t, [k, v]) => t.replaceAll(`{{${k}}}`, v), tpl);

async function rendere(ir: DocxDokument | XlsxMappe): Promise<{ daten: Uint8Array; endung: 'docx' | 'xlsx' }> {
  if ('bloecke' in ir) return { daten: await renderDocx(ir, { zeitpunkt }), endung: 'docx' };
  return { daten: await renderXlsx(ir, { zeitpunkt }), endung: 'xlsx' };
}

async function vorlagen(sprache: 'de' | 'en', u: Uebersetzer) {
  const kataloge = ladeKataloge();
  const s = ko.sprachen[sprache];
  const ctxBasis = (form: Form): VorlagenKontext => ({
    u, modus: 'leer', form, projekt: leeresProjekt({ sprache, jetzt: zeitpunkt.toISOString(), projektId: 'kit' }), kataloge, kitVersion: KIT_VERSION,
  });
  const ordnerVon = (d: Dokument) =>
    join(KIT, s.ordner, d.ordner === 'modul' ? s.modul : d.ordner === 'modul_nist' ? s.modul_nist : d.ordner === 'integration' ? s.integration : s.vorlagen);
  let anzahl = 0;
  const fehlend: string[] = [];
  for (const d of kataloge.dokumente.dokumente) {
    const vorlage = VORLAGEN[d.id];
    if (!vorlage) { fehlend.push(d.id); continue; }
    if (u.roh(`vorlagen.${d.id}`) === undefined && sprache === 'en') { fehlend.push(`${d.id} (EN-Texte)`); continue; }
    const { daten, endung } = await rendere(vorlage(ctxBasis('dokument')));
    schreibe(join(ordnerVon(d), `${d.datei[sprache]}.${endung}`), daten); anzahl++;
    for (const z of ZUSATZDATEIEN[d.id] ?? []) {
      const r = await rendere(z.vorlage(ctxBasis('dokument')));
      schreibe(join(ordnerVon(d), `${d.datei[sprache]}_${z.suffix[sprache]}.${r.endung}`), r.daten); anzahl++;
    }
    if (d.eb && EIGENE_EB_FORM.has(d.id)) {
      const r = await rendere(vorlage(ctxBasis('ergaenzungsblatt')));
      schreibe(join(KIT, s.ordner, s.integration, EB_UNTERORDNER[sprache], `${ebDateistamm(kataloge, `${d.id}-EB`, sprache)}.${r.endung}`), r.daten); anzahl++;
    }
  }
  // Generische Ergänzungsblätter (ohne eigene Vorlagen-Form)
  const ebKatalog = (parse(readFileSync('src/kataloge/ergaenzungsblaetter.yaml', 'utf8')) as { blaetter?: { id: string }[] } & Record<string, unknown>);
  const ebIds = (ebKatalog.blaetter ?? (Object.values(ebKatalog).find(Array.isArray) as { id: string }[] | undefined) ?? []).map((b) => b.id);
  for (const ebId of ebIds) {
    if (u.roh('allgemein') === undefined) { fehlend.push('Ergänzungsblätter (Texte)'); break; }
    const basis = ebId.replace(/-EB$/, '');
    if (EIGENE_EB_FORM.has(basis)) continue;
    const r = await rendere(generischesErgaenzungsblatt(ebId)(ctxBasis('ergaenzungsblatt')));
    schreibe(join(KIT, s.ordner, s.integration, EB_UNTERORDNER[sprache], `${ebDateistamm(kataloge, ebId, sprache)}.${r.endung}`), r.daten); anzahl++;
  }
  // Prozesse als Datei für draw.io (Katalogstand mit Landkarte), neben der Prozessbeschreibung D-27
  if (u.roh('prozesse') !== undefined) {
    const d27 = kataloge.dokumente.dokumente.find((d) => d.id === 'D-27');
    if (d27) {
      const r = projektDrawio(null, kataloge, u, { geaendert: zeitpunkt.toISOString(), vars: { kitVersion: KIT_VERSION } });
      schreibe(join(ordnerVon(d27), r.name), r.text); anzahl++;
    }
  }
  // fehlend wird nach den Ergänzungsblättern ergänzt
  console.log(`Vorlagen ${sprache.toUpperCase()}: ${anzahl} Dateien${fehlend.length ? `, ohne Vorlage: ${fehlend.join(', ')}` : ''}`);
}

function dateienUnter(ordner: string): string[] {
  if (!existsSync(ordner)) return [];
  return readdirSync(ordner).flatMap((n) => {
    const p = join(ordner, n);
    return statSync(p).isDirectory() ? dateienUnter(p) : [p];
  });
}

async function main() {
  rmSync(join('dist', 'kit'), { recursive: true, force: true });
  execFileSync('npx', ['tsx', 'scripts/kataloge.mts'], { stdio: 'inherit' });

  for (const sprache of ['de', 'en'] as const) {
    const texte = ladeTexte(sprache);
    await vorlagen(sprache, erstelleUebersetzer(sprache, texte));
  }

  if (!args.has('--ohne-leitfaden')) {
    for (const sprache of ['de', 'en'] as const) {
      if (!existsSync(join('src', 'leitfaden', sprache))) { console.log(`Leitfaden ${sprache.toUpperCase()}: Quellen fehlen, übersprungen`); continue; }
      execFileSync('npx', ['tsx', 'scripts/leitfaden.mts', '--sprache', sprache], { stdio: 'inherit' });
      const s = ko.sprachen[sprache];
      const quelle = join('dist', 'kit', s.ordner, s.leitfaden);
      if (existsSync(quelle)) cpSync(quelle, join(KIT, s.ordner, s.leitfaden), { recursive: true });
    }
    rmSync(join('dist', 'kit', 'DE'), { recursive: true, force: true });
    rmSync(join('dist', 'kit', 'EN'), { recursive: true, force: true });
  }

  // Werkzeug (falls gebaut)
  const app = join('dist', 'app', 'aims-manager.html');
  if (!args.has('--ohne-app') && existsSync(app)) cpSync(app, join(KIT, ko.werkzeug, 'aims-manager.html'));
  else console.log('Werkzeug: dist/app/aims-manager.html fehlt, übersprungen');
  // Kurzanleitung je Sprache (eine Seite) neben dem Werkzeug
  for (const d of ['Kurzanleitung_DE.html', 'Quick-Guide_EN.html']) {
    const q = join('src', 'app', 'kurzanleitung', d);
    // Dieselbe enge CSP wie die übrigen HTML-Dateien (die Seiten enthalten kein Skript)
    if (existsSync(q)) schreibe(join(KIT, ko.werkzeug, d), setzeCsp(readFileSync(q, 'utf8')).html);
  }

  // Diagrammansicht (optional, eigene Datei neben dem Werkzeug): zeigt .drawio-Dateien offline mit dem unveränderten,
  // gepinnten Viewer aus vendor/drawio-viewer (Prüfsumme, eigene CSP); Einzelheiten in scripts/diagrammansicht.mts
  if (!args.has('--ohne-diagrammansicht')) {
    const { baueDiagrammansicht, VIEWER } = await import('./diagrammansicht.mts');
    const d = baueDiagrammansicht();
    schreibe(join(KIT, ko.werkzeug, 'Diagrammansicht.html'), d.html);
    const kb = (n: number) => `${Math.round(n / 1024).toLocaleString('de-CH')} KB`;
    console.log(`Diagrammansicht: ${kb(d.bytes)} (Viewer ${VIEWER.version} ${kb(d.viewerBlock)}), im ZIP rund ${kb(d.zipBytes)}`);
  }

  // Beispiele: komplette Sets (Modus «beispiel») je Sprache, Projektdateien zusätzlich beim Werkzeug
  if (!args.has('--ohne-beispiele') && existsSync('scripts/beispiele.mts')) {
    execFileSync('npx', ['tsx', 'scripts/beispiele.mts'], { stdio: 'inherit' });
    for (const sprache of ['de', 'en'] as const) {
      const s = ko.sprachen[sprache];
      for (const firma of existsSync(join('dist', 'beispiele')) ? readdirSync(join('dist', 'beispiele')) : []) {
        const q = join('dist', 'beispiele', firma, sprache);
        if (existsSync(q) && statSync(q).isDirectory()) cpSync(q, join(KIT, s.ordner, s.beispiele, firma), { recursive: true });
      }
    }
    for (const d of readdirSync('src/beispiele').filter((n) => n.endsWith('.aims.json'))) {
      schreibe(join(KIT, ko.werkzeug, 'Beispiele_Examples', d), mitKitVersion(readFileSync(join('src/beispiele', d), 'utf8')));
    }
  }

  // Lizenzen
  cpSync('src/lizenz', join(KIT, ko.lizenz), { recursive: true });
  try {
    execFileSync('npx', ['tsx', 'scripts/drittlizenzen.mts'], { stdio: 'inherit' });
    cpSync(join('dist', 'lizenz', 'DRITTLIZENZEN_THIRD-PARTY.txt'), join(KIT, ko.lizenz, 'DRITTLIZENZEN_THIRD-PARTY.txt'));
  } catch { console.log('Drittlizenzen: nicht erzeugt (mit --holen einmal den Cache füllen)'); }

  // Rechtstexte und NIST-Dokumente (nur lokal: Quellen liegen nie im Repo). Dasselbe LIESMICH in jedem Ordner.
  const liesmich = fuelle(readFileSync('src/rechtstexte/LIESMICH_README.txt.tpl', 'utf8'));
  for (const [quelle, ziel, name] of [['eu-ai-act', ko.rechtstexte, 'Rechtstexte EU AI Act'], ['nist', ko.rechtstexte_nist, 'NIST AI RMF']] as const) {
    const q = join(QUELLEN, quelle);
    if (!existsSync(q)) { console.log(`${name}: Quellordner fehlt (CI), übersprungen`); continue; }
    for (const d of readdirSync(q).filter((n) => n.endsWith('.pdf'))) cpSync(join(q, d), join(KIT, ziel, d));
    cpSync(join(q, 'SHA256SUMS.txt'), join(KIT, ziel, 'SHA256SUMS.txt'));
    schreibe(join(KIT, ziel, 'LIESMICH_README.txt'), liesmich);
  }

  // Skill (falls vorhanden)
  if (existsSync('scripts/skill.mts')) execFileSync('npx', ['tsx', 'scripts/skill.mts', '--ziel', join(KIT, ko.skill)], { stdio: 'inherit' });

  // Start, LIESMICH, CHANGELOG
  const dateiliste: Record<string, string[]> = {};
  for (const p of dateienUnter(KIT)) {
    const rel = relative(KIT, p).split('\\').join('/');
    const ordner = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/') + 1) : '';
    (dateiliste[ordner] ??= []).push(rel.slice(ordner.length));
  }
  schreibe(join(KIT, 'START.html'), fuelle(readFileSync('src/start/START.html.tpl', 'utf8'), { dateiliste: JSON.stringify(dateiliste) }));
  for (const [tpl, ziel] of [['LIESMICH.txt.tpl', 'LIESMICH.txt'], ['README.txt.tpl', 'README.txt'], ['CHANGELOG.txt.tpl', 'CHANGELOG.txt']] as [string, string][]) {
    schreibe(join(KIT, ziel), fuelle(readFileSync(join('src/start', tpl), 'utf8')));
  }

  // Prüfsummen über alle Dateien (ohne SHA256SUMS.txt selbst im Wurzelordner)
  const alle = dateienUnter(KIT).sort();
  const summen = alle.map((p) => `${createHash('sha256').update(readFileSync(p)).digest('hex')}  ${relative(KIT, p).split('\\').join('/')}`).join('\r\n') + '\r\n';
  schreibe(join(KIT, 'SHA256SUMS.txt'), summen);

  if (!args.has('--ohne-zip')) {
    const eintraege = dateienUnter(KIT).sort().map((p) => ({ pfad: `${wurzelName}/${relative(KIT, p).split('\\').join('/')}`, inhalt: readFileSync(p) }));
    const zip = zipErstellen(eintraege, { zeitpunkt });
    const zipPfad = join('dist', `${wurzelName}.zip`);
    schreibe(zipPfad, zip);
    const mb = (zip.length / 1024 / 1024).toFixed(1);
    console.log(`ZIP: ${zipPfad} (${mb} MB, ${eintraege.length} Dateien), SHA-256 ${createHash('sha256').update(zip).digest('hex')}`);
    const zuLang = eintraege.filter((e) => e.pfad.length > 180);
    if (zuLang.length) throw new Error(`Pfade zu lang für Windows: ${zuLang.map((e) => e.pfad).join(', ')}`);
    const sonderzeichen = eintraege.filter((e) => /[^A-Za-z0-9._\/-]/.test(e.pfad));
    if (sonderzeichen.length) throw new Error(`Dateinamen mit Umlauten oder Sonderzeichen: ${sonderzeichen.map((e) => e.pfad).join(', ')}`);
  }
}

await main();
