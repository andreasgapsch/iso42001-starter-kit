// Zweiter, unabhängiger Prüfer für die erzeugten Office-Dateien : neben LibreOffice
// prüfen gridcraft-cli (XLSX) und wordcraft-cli (DOCX) jede Datei.
//   XLSX: gridcraft-cli check (öffnen, gespeicherte Ergebnisse gegen das eigene Rechenwerk, Round-Trip); dazu LibreOffice mit
//         erzwungener Neuberechnung gegen LibreOffice ohne Neuberechnung (gespeicherte Werte), je Blatt als CSV verglichen.
//   DOCX: wordcraft-cli convert nach PDF; Seitenzahl gegen LibreOffice, keine leere Seite, Fuss mit «Seite x von y» bzw.
//         «Page x of y» auf jeder Seite, Kopf mit der Dokument-ID auf jeder Seite ausser einer eigenen Titelseite, Q10: Haupttext
//         ohne Anlagen und Titelseite höchstens 4 Seiten (ausser D-27, wie scripts/beispiele.mts).
// Aufruf (über begrenzt.sh): npx tsx scripts/werkzeug/zweitpruefer.mts --aus <Ordner> <Ordner oder ZIP> ...
// Ausgabe: <aus>/bericht.json und eine Zusammenfassung; Ausgang 1 bei einem Befund (gridcraft mismatched/staleCache/Fehler,
// LibreOffice-Abweichung, wordcraft-Fehler, leere Seite, fehlender Kopf oder Fuss, Q10).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';

const args = process.argv.slice(2);
const ausIndex = args.indexOf('--aus');
if (ausIndex < 0 || !args[ausIndex + 1]) throw new Error('Aufruf: zweitpruefer.mts --aus <Ordner> <Ordner oder ZIP> ...');
const AUS = resolve(args[ausIndex + 1]!);
const QUELLEN = args.filter((_, i) => i !== ausIndex && i !== ausIndex + 1);
// Schutz (Prüfung test.7 N6): der Ausgabeordner wird geleert; nur unterhalb von TMPDIR und nicht der Arbeitsordner
const TMP = resolve(process.env['TMPDIR'] ?? '/nonexistent');
if (!AUS.startsWith(`${TMP}/`) || process.cwd().startsWith(AUS)) throw new Error(`--aus muss unterhalb von TMPDIR (${TMP}) liegen: ${AUS}`);
rmSync(AUS, { recursive: true, force: true });
mkdirSync(AUS, { recursive: true });

function dateienIn(ordner: string): string[] {
  const r: string[] = [];
  for (const e of readdirSync(ordner, { withFileTypes: true })) {
    const p = join(ordner, e.name);
    if (e.isDirectory()) r.push(...dateienIn(p));
    else if (/\.(docx|xlsx)$/.test(e.name)) r.push(p);
  }
  return r;
}

// ZIPs entpacken (eigener, leerer Ordner je ZIP)
const alle: { datei: string; quelle: string }[] = [];
for (const q of QUELLEN) {
  if (q.endsWith('.zip')) {
    const ziel = join(AUS, 'zip', basename(q, '.zip'));
    mkdirSync(ziel, { recursive: true });
    const z = unzipSync(new Uint8Array(readFileSync(q)));
    for (const [n, d] of Object.entries(z)) {
      if (!/\.(docx|xlsx)$/.test(n)) continue;
      const p = join(ziel, n);
      mkdirSync(join(p, '..'), { recursive: true });
      writeFileSync(p, d);
      alle.push({ datei: p, quelle: `${basename(q)}:${n}` });
    }
  } else for (const d of dateienIn(q)) alle.push({ datei: d, quelle: relative(process.cwd(), d) });
}
const xlsx = alle.filter((x) => x.datei.endsWith('.xlsx'));
const docx = alle.filter((x) => x.datei.endsWith('.docx'));
const befunde: string[] = [];
/** Bekannte Warnungen von gridcraft (Grenzen des Werkzeugs, Bericht dokumente-download-pruefung.md Abschnitt 4) */
const GC_BEKANNT = [/pictures in the header and footer are not shown/, /Excel 2010 conditional format extensions were skipped/];
/** Begründete Seitenabweichungen wordcraft gegen LibreOffice (Umbruch zweier Satzprogramme, eine Seite) */
const SEITEN_AUSNAHME = [/D-27_/, /D-24_Role-First\.docx$/];

// ---------- LibreOffice ----------
function soffice(profil: string, filter: string, ausOrdner: string, dateien: string[]): void {
  mkdirSync(ausOrdner, { recursive: true });
  for (let i = 0; i < dateien.length; i += 40) {
    const r = spawnSync('soffice', [`-env:UserInstallation=file://${profil}`, '--headless', '--norestore', '--convert-to', filter, '--outdir', ausOrdner, ...dateien.slice(i, i + 40)], { encoding: 'utf8', timeout: 1_800_000 });
    if (r.status !== 0) throw new Error(`LibreOffice: ${r.stderr}`);
  }
}
/** Profil mit erzwungener Neuberechnung beim Laden von OOXML (Calc › Formel › Neuberechnung beim Laden: immer) */
function profilNeuberechnung(ordner: string): string {
  const user = join(ordner, 'user');
  mkdirSync(user, { recursive: true });
  writeFileSync(join(user, 'registrymodifications.xcu'), `<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item>
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="ODFRecalcMode" oor:op="fuse"><value>0</value></prop></item>
</oor:items>
`);
  return ordner;
}
function profilOhne(ordner: string): string {
  const user = join(ordner, 'user');
  mkdirSync(user, { recursive: true });
  writeFileSync(join(user, 'registrymodifications.xcu'), `<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>1</value></prop></item>
</oor:items>
`);
  return ordner;
}

// ---------- XLSX ----------
const gc = { dateien: xlsx.length, geoeffnet: 0, fehler: 0, staleCache: 0, mismatched: 0, noOracle: 0, formelzellen: 0, roundTrip: 0, x14: 0, warnungen: {} as Record<string, number> };
for (let i = 0; i < xlsx.length; i += 50) {
  const teil = xlsx.slice(i, i + 50);
  const r = spawnSync('gridcraft-cli', ['check', ...teil.map((x) => x.datei), '--json', '--max-report', '5'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  // Ausgang 0 ohne Abweichung, 1 mit Abweichung (dann Befunde aus dem JSON); alles andere ist ein Fehler des Laufs
  if (r.status !== 0 && r.status !== 1) befunde.push(`gridcraft: Ausgang ${r.status} ${r.stderr.slice(0, 200)}`);
  const j = JSON.parse(r.stdout) as { files: { path: string; opened: boolean; error: string | null; warnings: string[]; calc: { staleCache: boolean; mismatched: number; noOracle: number; formulaCells: number }; roundTrip: { categories: Record<string, { equal: boolean }> } }[] };
  for (const f of j.files) {
    const q = teil.find((x) => resolve(x.datei) === resolve(f.path))?.quelle ?? f.path;
    if (f.opened) gc.geoeffnet++;
    if (f.error) { gc.fehler++; befunde.push(`gridcraft ${q}: ${f.error}`); }
    if (f.calc.staleCache) { gc.staleCache++; befunde.push(`gridcraft ${q}: staleCache`); }
    if (f.calc.mismatched) { gc.mismatched += f.calc.mismatched; befunde.push(`gridcraft ${q}: ${f.calc.mismatched} Formelzellen weichen ab`); }
    gc.noOracle += f.calc.noOracle;
    gc.formelzellen += f.calc.formulaCells;
    const rt = Object.entries(f.roundTrip?.categories ?? {}).filter(([, c]) => !c.equal).map(([k]) => k);
    if (rt.length) { gc.roundTrip++; befunde.push(`gridcraft ${q}: Round-Trip ${rt.join(', ')}`); }
    for (const w of f.warnings ?? []) {
      const k = w.replace(/^sheet "[^"]*": /, '');
      gc.warnungen[k] = (gc.warnungen[k] ?? 0) + 1;
      if (/conditional format extensions/.test(k)) gc.x14++;
      if (!GC_BEKANNT.some((m) => m.test(k))) befunde.push(`gridcraft ${q}: Warnung ${w}`);
    }
  }
}

// LibreOffice: gespeicherte Werte gegen Neuberechnung, je Blatt als CSV
const lo = { dateien: 0, blaetter: 0, abweichungen: 0 };
if (xlsx.length) {
  const csv = 'csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,-1';
  const kopien = join(AUS, 'xlsx');
  mkdirSync(kopien, { recursive: true });
  const namen = xlsx.map((x, i) => {
    const n = join(kopien, `${String(i).padStart(4, '0')}.xlsx`);
    writeFileSync(n, readFileSync(x.datei));
    return n;
  });
  soffice(profilOhne(join(AUS, 'lo-profil-ohne')), csv, join(AUS, 'csv-ohne'), namen);
  soffice(profilNeuberechnung(join(AUS, 'lo-profil-neu')), csv, join(AUS, 'csv-neu'), namen);
  const ohne = readdirSync(join(AUS, 'csv-ohne'));
  for (const [i, x] of xlsx.entries()) {
    const stamm = String(i).padStart(4, '0');
    const blaetter = ohne.filter((n) => n.startsWith(`${stamm}-`) || n === `${stamm}.csv`);
    if (!blaetter.length) { befunde.push(`LibreOffice ${x.quelle}: keine CSV`); continue; }
    lo.dateien++;
    for (const b of blaetter) {
      lo.blaetter++;
      const a = readFileSync(join(AUS, 'csv-ohne', b), 'utf8');
      const n = existsSync(join(AUS, 'csv-neu', b)) ? readFileSync(join(AUS, 'csv-neu', b), 'utf8') : '';
      if (a !== n) {
        lo.abweichungen++;
        const za = a.split('\n');
        const zn = n.split('\n');
        const z = za.findIndex((l, k) => l !== zn[k]);
        befunde.push(`LibreOffice ${x.quelle} ${b.replace(/^\d+-?/, '')}: gespeicherter Wert weicht von der Neuberechnung ab, Zeile ${z + 1}: «${za[z]?.slice(0, 80)}» statt «${zn[z]?.slice(0, 80)}»`);
      }
    }
  }
}

// ---------- DOCX ----------
const wc = { dateien: docx.length, pdf: 0, fehler: 0, seitenWc: 0, seitenLo: 0, seitenAbweichung: [] as string[], leer: 0, ohneFuss: 0, ohneKopf: 0, q10: [] as string[] };
const seitenzahl = (pdf: string) => Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [pdf], { encoding: 'utf8' }))?.[1] ?? 0);
const seite = (pdf: string, i: number) => execFileSync('pdftotext', ['-f', String(i), '-l', String(i), '-layout', pdf, '-'], { encoding: 'utf8' });
if (docx.length) {
  const kopien = join(AUS, 'docx');
  mkdirSync(kopien, { recursive: true });
  mkdirSync(join(AUS, 'wc'), { recursive: true });
  const namen = docx.map((x, i) => {
    const n = join(kopien, `${String(i).padStart(4, '0')}.docx`);
    writeFileSync(n, readFileSync(x.datei));
    return n;
  });
  soffice(join(AUS, 'lo-profil-docx'), 'pdf', join(AUS, 'lo'), namen);
  for (const [i, x] of docx.entries()) {
    const stamm = String(i).padStart(4, '0');
    const pdf = join(AUS, 'wc', `${stamm}.pdf`);
    const r = spawnSync('wordcraft-cli', ['convert', namen[i]!, pdf], { encoding: 'utf8', timeout: 300_000 });
    if (r.status !== 0 || !existsSync(pdf) || statSync(pdf).size < 1000) {
      wc.fehler++;
      befunde.push(`wordcraft ${x.quelle}: keine PDF (${(r.stderr || r.stdout).trim().slice(0, 200)})`);
      continue;
    }
    wc.pdf++;
    const n = seitenzahl(pdf);
    const loPdf = join(AUS, 'lo', `${stamm}.pdf`);
    const nLo = existsSync(loPdf) ? seitenzahl(loPdf) : 0;
    wc.seitenWc += n;
    wc.seitenLo += nLo;
    if (!nLo) befunde.push(`LibreOffice ${x.quelle}: keine PDF`);
    else if (n !== nLo) {
      wc.seitenAbweichung.push(`${x.quelle}: wordcraft ${n}, LibreOffice ${nLo}`);
      if (Math.abs(n - nLo) > 1 || !SEITEN_AUSNAHME.some((m) => m.test(x.quelle))) befunde.push(`Seitenzahl ${x.quelle}: wordcraft ${n}, LibreOffice ${nLo}`);
    }
    const xml = strFromU8(unzipSync(new Uint8Array(readFileSync(x.datei)), { filter: (f) => f.name === 'word/document.xml' })['word/document.xml']!);
    const titelseite = xml.includes('<w:titlePg/>');
    let haupt = n;
    // Kopf: die erste Zeile der Folgeseiten (Firmenname bzw. «Firmenname» in den Vorlagen) steht auf jeder Seite ausser einer
    // eigenen Titelseite; Fuss: «Seite x von y» bzw. «Page x of y»
    const texte = Array.from({ length: n }, (_, k) => seite(pdf, k + 1));
    const ersteZeile = (t: string) => t.split('\n').map((z) => z.trim()).find(Boolean) ?? '';
    // Kopftext aus der Kopfzeile des DOCX (erste Kopfzeile mit Text), nicht aus dem Seitentext
    // Kopfzeile der Folgeseiten: w:headerReference w:type="default" über die Beziehungen, ohne Wasserzeichen (VML)
    const teile = unzipSync(new Uint8Array(readFileSync(x.datei)), { filter: (f) => /^word\/(header\d*\.xml|_rels\/document\.xml\.rels)$/.test(f.name) });
    const rid = /<w:headerReference w:type="default" r:id="([^"]+)"/.exec(xml)?.[1];
    const ziel = rid ? new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${rid}"`).exec(strFromU8(teile['word/_rels/document.xml.rels'] ?? new Uint8Array()))?.slice(1).find(Boolean) : undefined;
    const kopfXml = ziel && teile[`word/${ziel}`] ? strFromU8(teile[`word/${ziel}`]!) : '';
    const kopf = kopfXml.replace(/<w:pict>[\s\S]*?<\/w:pict>|<mc:AlternateContent>[\s\S]*?<\/mc:AlternateContent>/g, '').replace(/<w:tab\/>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || '\u0000';
    const adresse = (texte[n - 1] ?? '').split('\n').map((z) => z.trim()).filter(Boolean).at(-1) ?? '';
    for (let s = 1; s <= n; s++) {
      const t = texte[s - 1]!;
      const zeilen = t.split('\n').map((z) => z.trim()).filter(Boolean);
      const fuss = /(Seite|Page) \d+ (von|of) \d+/.test(t);
      if (!fuss) { wc.ohneFuss++; befunde.push(`wordcraft ${x.quelle} Seite ${s}: ohne «Seite x von y»`); }
      // Kopf als Text (Firmenname) oder als Bild (Logo der Gestaltung, pdfimages je Seite)
      const bild = () => execFileSync('pdfimages', ['-list', '-f', String(s), '-l', String(s), pdf], { encoding: 'utf8' }).split('\n').length > 3;
      if (!(titelseite && s === 1) && !ersteZeile(t).replace(/\s+/g, ' ').includes(kopf) && !bild()) { wc.ohneKopf++; befunde.push(`wordcraft ${x.quelle} Seite ${s}: ohne Kopf «${kopf}»`); }
      // leer: nichts ausser Kopf und Fuss
      const inhalt = zeilen.filter((z) => z !== kopf && z !== adresse && !/(Seite|Page) \d+ (von|of) \d+/.test(z));
      if (inhalt.length === 0) { wc.leer++; befunde.push(`wordcraft ${x.quelle} Seite ${s}: leer`); }
      if (haupt === n && /^(?:Anlage|Appendix) [A-Z0-9]+:/m.test(t.replace(/^\s+/gm, ''))) haupt = s - 1;
    }
    if (!/D-27_/.test(basename(x.datei)) && haupt - (titelseite ? 1 : 0) > 4) wc.q10.push(`${x.quelle}: Haupttext ${haupt - (titelseite ? 1 : 0)} Seiten`);
  }
}
for (const q of wc.q10) befunde.push(`Q10 ${q}`);

const bericht = { quellen: QUELLEN, gridcraft: gc, libreoffice: lo, wordcraft: wc, befunde };
writeFileSync(join(AUS, 'bericht.json'), JSON.stringify(bericht, null, 2));
console.log(JSON.stringify({ gridcraft: { ...gc }, libreoffice: lo, wordcraft: { ...wc, seitenAbweichung: wc.seitenAbweichung.length, q10: wc.q10.length } }, null, 2));
console.log(`Seitenzahl wordcraft ≠ LibreOffice: ${wc.seitenAbweichung.length}${wc.seitenAbweichung.length ? `\n  ${wc.seitenAbweichung.slice(0, 20).join('\n  ')}` : ''}`);
console.log(`Befunde: ${befunde.length}${befunde.length ? `\n  ${befunde.slice(0, 60).join('\n  ')}` : ''}`);
process.exit(befunde.length ? 1 : 0);
