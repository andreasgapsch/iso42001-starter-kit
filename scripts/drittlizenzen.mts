// Stellt die Lizenztexte der im AIMS-Manager gebündelten Bibliotheken zu DRITTLIZENZEN_THIRD-PARTY.txt zusammen.
//
// Gebündelt sind die direkten Bibliotheken (DIREKT) und alles, was deren Browser-Einstiegsdatei selbst
// schon eingebettet mitbringt: exceljs liefert ein Browserify-Bundle (Quellen aus der Sourcemap), docx ein
// Rolldown-Bundle (Quellen aus den «//#region»-Marken). Vorgebündelte Dateien darin (z. B. jszip.min.js)
// bringen ihre Laufzeit-Abhängigkeiten aus package.json mit.
//
// Lizenztexte stammen aus node_modules. Pakete, die nur eingebettet und nicht installiert sind, holt
// `--holen` einmalig mit `npm pack` in den Cache node_modules/.cache/drittlizenzen (Version: letzte stabile
// Version vor der Veröffentlichung der einbettenden Bibliothek). Ohne Cache-Eintrag bricht das Skript ab.
//
// Aufruf: npx tsx scripts/drittlizenzen.mts [--aus <datei>] [--holen]
//   Standardausgabe: dist/lizenz/DRITTLIZENZEN_THIRD-PARTY.txt (UTF-8 mit BOM, CRLF)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DIREKT = ['preact', '@preact/signals', '@preact/signals-core', 'docx', 'exceljs', 'fflate', 'pdfjs-dist'];
/**
 * Einstiegsdateien, die der Build statt des Browser-Einstiegs bündelt: pdf.js im Legacy-Build (PDF-Worker für die eigene
 * Normausgabe, src/normtexte/pdf-worker.ts), mit eingebetteten Polyfills aus core-js (Sourcemap).
 */
export const EINSTIEGE: Record<string, string[]> = { 'pdfjs-dist': ['legacy/build/pdf.mjs', 'legacy/build/pdf.worker.mjs'] };
const CACHE = join(REPO, 'node_modules', '.cache', 'drittlizenzen');
const LIZENZDATEI = /^(licen[cs]e|copying|notice)([.-].*)?$/i;

interface PaketJson {
  name: string;
  version: string;
  license?: string | { type?: string };
  licenses?: { type?: string }[];
  author?: string | { name?: string; email?: string };
  homepage?: string;
  repository?: string | { url?: string };
  main?: string;
  module?: string;
  browser?: string | Record<string, string | false> | null;
  exports?: unknown;
  dependencies?: Record<string, string>;
}

export interface Fund {
  name: string;
  /** Wo das Paket herkommt: «direkt» oder «in exceljs 4.4.0 eingebettet» usw. */
  herkunft: Set<string>;
  /** Paket, das dieses Paket einbettet (für Versionswahl und Suche nach verschachtelten Kopien). */
  eltern: Set<string>;
}

export interface Eintrag {
  name: string;
  version: string;
  lizenz: string;
  quelle: string;
  herkunft: string[];
  texte: { datei: string; text: string }[];
  hinweis?: string;
}

function leseJson<T>(pfad: string): T {
  return JSON.parse(readFileSync(pfad, 'utf8')) as T;
}

/** Alle installierten Kopien eines Pakets unter node_modules (auch verschachtelt). */
export function kopien(name: string, wurzel: string = join(REPO, 'node_modules')): string[] {
  const treffer: string[] = [];
  const stapel = [wurzel];
  while (stapel.length) {
    const nm = stapel.pop()!;
    if (!existsSync(nm)) continue;
    const kandidat = join(nm, name);
    if (existsSync(join(kandidat, 'package.json'))) treffer.push(kandidat);
    for (const e of readdirSync(nm, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue;
      const pakete = e.name.startsWith('@') ? readdirSync(join(nm, e.name)).map((n) => join(nm, e.name, n)) : [join(nm, e.name)];
      for (const p of pakete) {
        const tiefer = join(p, 'node_modules');
        if (existsSync(tiefer)) stapel.push(tiefer);
      }
    }
  }
  return treffer;
}

/** Bevorzugt die Kopie unter dem einbettenden Paket, sonst die oberste. */
function findePaket(name: string, eltern: string[]): string | undefined {
  for (const e of eltern) {
    const ort = findePaket(e, []);
    if (ort) {
      const nah = join(ort, 'node_modules', name);
      if (existsSync(join(nah, 'package.json'))) return nah;
    }
  }
  const oben = join(REPO, 'node_modules', name);
  if (existsSync(join(oben, 'package.json'))) return oben;
  return kopien(name)[0];
}

/** Einstiegsdatei, die ein Browser-Bundler (Vite) wählt. */
export function browserEinstieg(dir: string): string | undefined {
  const pj = leseJson<PaketJson>(join(dir, 'package.json'));
  const bedingung = (e: unknown): string | undefined => {
    if (typeof e === 'string') return e;
    if (!e || typeof e !== 'object') return undefined;
    const o = e as Record<string, unknown>;
    for (const k of ['browser', 'import', 'module', 'default']) {
      if (k in o) {
        const r = bedingung(o[k]);
        if (r) return r;
      }
    }
    return undefined;
  };
  let ziel: string | undefined;
  if (pj.exports && typeof pj.exports === 'object' && '.' in (pj.exports as object)) ziel = bedingung((pj.exports as Record<string, unknown>)['.']);
  else if (pj.exports) ziel = bedingung(pj.exports);
  if (!ziel && typeof pj.browser === 'string') ziel = pj.browser;
  if (!ziel) ziel = pj.module ?? pj.main ?? 'index.js';
  const pfad = join(dir, ziel);
  return existsSync(pfad) ? pfad : undefined;
}

/** Paketname aus einem Quellpfad: letztes «node_modules/<name>». */
export function paketAusPfad(pfad: string): string | undefined {
  const re = /node_modules\/((?:@[^/]+\/)?[^/]+)\//g;
  let m: RegExpExecArray | null;
  let letzter: string | undefined;
  while ((m = re.exec(pfad))) letzter = m[1];
  return letzter;
}

/** Eingebettete Quellen einer Bundle-Datei: Rolldown/esbuild-Marken und Sourcemap. */
export function eingebetteteQuellen(datei: string): string[] {
  const text = readFileSync(datei, 'utf8');
  const quellen: string[] = [];
  for (const m of text.matchAll(/^\/\/(?:#region)? (\S*node_modules\/\S+)/gm)) quellen.push(m[1]!);
  const kartenName = /\/\/[#@] sourceMappingURL=([^\s'"]+)\s*$/m.exec(text)?.[1];
  const karten = [kartenName && !kartenName.startsWith('data:') ? join(dirname(datei), kartenName) : undefined, `${datei}.map`];
  for (const k of karten) {
    if (!k || !existsSync(k)) continue;
    const karte = leseJson<{ sources?: string[] }>(k);
    quellen.push(...(karte.sources ?? []));
    break;
  }
  return quellen;
}

function lizenzAusJson(pj: PaketJson): string {
  if (typeof pj.license === 'string') return pj.license;
  if (pj.license && typeof pj.license === 'object' && pj.license.type) return pj.license.type;
  if (pj.licenses?.length) return pj.licenses.map((l) => l.type ?? '?').join(' OR ');
  return 'unbekannt / unknown';
}

function quelleAusJson(pj: PaketJson): string {
  const repo = typeof pj.repository === 'string' ? pj.repository : pj.repository?.url;
  return (pj.homepage ?? repo ?? `https://www.npmjs.com/package/${pj.name}`).replace(/^git\+/, '').replace(/\.git$/, '');
}

/** Ermittelt alle gebündelten Pakete ausgehend von DIREKT. */
export function sammle(direkt: string[] = DIREKT): Map<string, Fund> {
  const funde = new Map<string, Fund>();
  const merke = (name: string, herkunft: string, eltern?: string): Fund => {
    const f = funde.get(name) ?? { name, herkunft: new Set<string>(), eltern: new Set<string>() };
    f.herkunft.add(herkunft);
    if (eltern) f.eltern.add(eltern);
    funde.set(name, f);
    return f;
  };
  const vorgebuendelt: { name: string; eltern: string }[] = [];
  for (const name of direkt) {
    merke(name, 'direkt / direct');
    const dir = findePaket(name, []);
    if (!dir) throw new Error(`Direkte Bibliothek fehlt in node_modules: ${name}`);
    const einstiege = EINSTIEGE[name]?.map((e) => join(dir, e)) ?? [browserEinstieg(dir)].filter((e): e is string => !!e);
    if (!einstiege.length) continue;
    const version = leseJson<PaketJson>(join(dir, 'package.json')).version;
    const jePaket = new Map<string, string[]>();
    for (const q of einstiege.flatMap((e) => eingebetteteQuellen(e))) {
      const p = paketAusPfad(q);
      if (!p || p === name) continue;
      jePaket.set(p, [...(jePaket.get(p) ?? []), q]);
    }
    for (const [p, qs] of jePaket) {
      merke(p, `in ${name} ${version} eingebettet / embedded in ${name} ${version}`, name);
      if (qs.every((q) => /\/dist\/|\.min\.js$/.test(q))) vorgebuendelt.push({ name: p, eltern: name });
    }
  }
  // Vorgebündelte Dateien enthalten die Laufzeit-Abhängigkeiten ihres Pakets.
  const gesehen = new Set<string>();
  while (vorgebuendelt.length) {
    const { name, eltern } = vorgebuendelt.shift()!;
    if (gesehen.has(name)) continue;
    gesehen.add(name);
    const dir = findePaket(name, [eltern]);
    if (!dir) continue;
    const pj = leseJson<PaketJson>(join(dir, 'package.json'));
    for (const dep of Object.keys(pj.dependencies ?? {})) {
      if (direkt.includes(dep)) continue;
      merke(dep, `über ${name} ${pj.version} vorgebündelt / pre-bundled via ${name} ${pj.version}`, name);
      vorgebuendelt.push({ name: dep, eltern: name });
    }
  }
  return funde;
}

const zeitenCache = new Map<string, Record<string, string>>();

/** Veröffentlichungszeiten aller Versionen eines Pakets aus der npm-Registry. */
function zeiten(name: string): Record<string, string> {
  let z = zeitenCache.get(name);
  if (!z) {
    z = JSON.parse(execFileSync('npm', ['view', name, 'time', '--json'], { encoding: 'utf8' })) as Record<string, string>;
    zeitenCache.set(name, z);
  }
  return z;
}

function veroeffentlicht(name: string, version: string): string | undefined {
  return zeiten(name)[version];
}

/** Letzte stabile Version, die vor `stichtag` veröffentlicht wurde. */
function versionVor(name: string, stichtag: string): string {
  const kandidaten = Object.entries(zeiten(name))
    .filter(([v, t]) => /^\d+\.\d+\.\d+$/.test(v) && t <= stichtag)
    .sort((a, b) => a[1].localeCompare(b[1]));
  const v = kandidaten.at(-1)?.[0];
  if (!v) throw new Error(`Keine Version von ${name} vor ${stichtag}`);
  return v;
}

function cacheOrt(name: string): string | undefined {
  const ordner = join(CACHE, name.replace('/', '__'));
  if (!existsSync(ordner)) return undefined;
  const p = join(ordner, 'package');
  return existsSync(join(p, 'package.json')) ? p : undefined;
}

function hole(name: string, eltern: string[]): string {
  const elternDir = eltern.map((e) => findePaket(e, [])).find(Boolean);
  if (!elternDir) throw new Error(`Einbettende Bibliothek von ${name} nicht gefunden`);
  const epj = leseJson<PaketJson>(join(elternDir, 'package.json'));
  const stichtag = veroeffentlicht(epj.name, epj.version);
  if (!stichtag) throw new Error(`Veröffentlichungsdatum von ${epj.name} ${epj.version} unbekannt`);
  const version = versionVor(name, stichtag);
  const ordner = join(CACHE, name.replace('/', '__'));
  mkdirSync(ordner, { recursive: true });
  const tgz = execFileSync('npm', ['pack', `${name}@${version}`, '--silent', '--pack-destination', ordner], { encoding: 'utf8' }).trim().split('\n').at(-1)!;
  execFileSync('tar', ['--warning=no-unknown-keyword', '-xzf',join(ordner, tgz), '-C', ordner]);
  writeFileSync(join(ordner, 'geholt.json'), `${JSON.stringify({ name, version, stichtag, eltern: epj.name, elternVersion: epj.version }, null, 2)}\n`);
  return join(ordner, 'package');
}

function normalisiere(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trimEnd();
}

function lizenzTexte(dir: string): { datei: string; text: string }[] {
  return readdirSync(dir)
    .filter((n) => LIZENZDATEI.test(n) && statSync(join(dir, n)).isFile())
    .sort()
    .map((n) => ({ datei: n, text: normalisiere(readFileSync(join(dir, n), 'utf8')) }));
}

/** Abschnitt «License» aus der README (bis zur nächsten Überschrift gleicher oder höherer Ebene). */
export function readmeAbschnitt(readme: string): string | undefined {
  const zeilen = normalisiere(readme).split('\n');
  const start = zeilen.findIndex((z) => /^#{1,6}\s*licen[cs]e\b/i.test(z));
  if (start < 0) return undefined;
  const ebene = /^(#+)/.exec(zeilen[start]!)![1]!.length;
  let ende = zeilen.length;
  for (let i = start + 1; i < zeilen.length; i++) {
    const m = /^(#+)\s/.exec(zeilen[i]!);
    if (m && m[1]!.length <= ebene) {
      ende = i;
      break;
    }
  }
  const text = zeilen.slice(start, ende).join('\n').trim();
  return text.split('\n').length > 1 ? text : undefined;
}

/** SPDX-Standardtexte für Pakete ohne jeden Lizenztext; Copyright aus dem Feld «author». */
const SPDX: Record<string, (inhaber: string) => string> = {
  MIT: (inhaber) =>
    [
      'MIT License',
      '',
      `Copyright (c) ${inhaber}`,
      '',
      'Permission is hereby granted, free of charge, to any person obtaining a copy',
      'of this software and associated documentation files (the "Software"), to deal',
      'in the Software without restriction, including without limitation the rights',
      'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
      'copies of the Software, and to permit persons to whom the Software is',
      'furnished to do so, subject to the following conditions:',
      '',
      'The above copyright notice and this permission notice shall be included in all',
      'copies or substantial portions of the Software.',
      '',
      'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
      'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,',
      'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE',
      'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER',
      'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,',
      'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE',
      'SOFTWARE.',
    ].join('\n'),
  ISC: (inhaber) =>
    [
      'ISC License',
      '',
      `Copyright (c) ${inhaber}`,
      '',
      'Permission to use, copy, modify, and/or distribute this software for any',
      'purpose with or without fee is hereby granted, provided that the above',
      'copyright notice and this permission notice appear in all copies.',
      '',
      'THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH',
      'REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND',
      'FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,',
      'INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM',
      'LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR',
      'OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR',
      'PERFORMANCE OF THIS SOFTWARE.',
    ].join('\n'),
};

function autor(pj: PaketJson): string {
  if (typeof pj.author === 'string') return pj.author.replace(/\s*<[^>]*>/, '').replace(/\s*\([^)]*\)/, '').trim();
  return pj.author?.name ?? `the ${pj.name} authors`;
}

/** Liest Version, Lizenz und Lizenztexte; holt fehlende Pakete nur mit `holen`. */
export function eintraege(funde: Map<string, Fund>, holen = false): { liste: Eintrag[]; fehlend: string[] } {
  const liste: Eintrag[] = [];
  const fehlend: string[] = [];
  for (const f of [...funde.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    const eltern = [...f.eltern];
    let dir = findePaket(f.name, eltern);
    let hinweis: string | undefined;
    if (!dir) {
      dir = cacheOrt(f.name) ?? (holen ? hole(f.name, eltern) : undefined);
      if (!dir) {
        fehlend.push(f.name);
        continue;
      }
      const g = existsSync(join(dirname(dir), 'geholt.json')) ? leseJson<{ version: string; stichtag: string; eltern: string; elternVersion: string }>(join(dirname(dir), 'geholt.json')) : undefined;
      if (g) {
        hinweis =
          `Nicht installiert; Lizenztext aus ${f.name} ${g.version}, der letzten Version vor ${g.eltern} ${g.elternVersion} (${g.stichtag.slice(0, 10)}).\n` +
          `Not installed; licence text taken from ${f.name} ${g.version}, the last version before ${g.eltern} ${g.elternVersion} (${g.stichtag.slice(0, 10)}).`;
      }
    }
    const pj = leseJson<PaketJson>(join(dir, 'package.json'));
    const texte = lizenzTexte(dir);
    const lizenz = lizenzAusJson(pj);
    if (!texte.length) {
      const readme = readdirSync(dir).find((n) => /^readme(\.|$)/i.test(n));
      const abschnitt = readme ? readmeAbschnitt(readFileSync(join(dir, readme), 'utf8')) : undefined;
      if (abschnitt) {
        texte.push({ datei: `${readme} (License)`, text: abschnitt });
      } else if (SPDX[lizenz]) {
        texte.push({ datei: `SPDX ${lizenz}`, text: SPDX[lizenz]!(autor(pj)) });
        hinweis = [
          hinweis,
          `Das Paket enthält keinen Lizenztext. Es erklärt in package.json die Lizenz «${lizenz}»; hier steht der SPDX-Standardtext mit dem Autor laut package.json.`,
          `The package contains no licence text. Its package.json declares the licence ‘${lizenz}’; the SPDX standard text is reproduced with the author from package.json.`,
        ]
          .filter(Boolean)
          .join('\n');
      } else {
        throw new Error(`Kein Lizenztext für ${f.name} ${pj.version} (${lizenz})`);
      }
    }
    liste.push({ name: f.name, version: pj.version, lizenz, quelle: quelleAusJson(pj), herkunft: [...f.herkunft].sort(), texte, hinweis });
  }
  return { liste, fehlend };
}

/**
 * Schriften (SIL OFL 1.1): Inter im AIMS-Manager, in START.html und ab rc.11 in der Diagrammansicht (Designpaket «AIMS
 * Nachtblau»), Archivo und Source Serif 4 in Leitfaden und Poster (PDF).
 * Urheber aus der ersten Zeile der Lizenzdatei, Lizenztext unverändert aus src/app/schriften.
 */
export const SCHRIFTEN = [
  {
    name: 'Inter (Schrift / font)', datei: 'OFL-Inter.txt', quelle: 'https://github.com/rsms/inter',
    herkunft: 'eingebettet in AIMS-Manager, START.html und Diagrammansicht / embedded in AIMS Manager, START.html and diagram viewer (@fontsource-variable/inter 5.3.0, latin, latin-ext; Gewichtsachse auf 400 bis 700 begrenzt / weight axis limited to 400 to 700)',
  },
  {
    name: 'Archivo (Schrift / font)', datei: 'OFL-Archivo.txt', quelle: 'https://github.com/Omnibus-Type/Archivo',
    herkunft: 'eingebettet in Leitfaden und Poster / embedded in guide and poster (@fontsource-variable/archivo 5.3.0, latin, latin-ext)',
  },
  {
    name: 'Source Serif 4 (Schrift / font)', datei: 'OFL-Source-Serif-4.txt', quelle: 'https://github.com/adobe-fonts/source-serif',
    herkunft: 'eingebettet in Leitfaden und Poster / embedded in guide and poster (@fontsource-variable/source-serif-4 5.3.0, latin, latin-ext)',
  },
] as const;

/** Urheber laut Lizenzdatei: Copyright-Zeile(n) vor dem Satz «This Font Software is licensed …» */
export function urheberAusOfl(text: string): string {
  const kopf = normalisiere(text).split(/\n\s*This Font Software is licensed/)[0] ?? '';
  return kopf.replace(/\s+/g, ' ').trim();
}

export function schriftEintraege(ordner = join(REPO, 'src', 'app', 'schriften')): Eintrag[] {
  return SCHRIFTEN.map((s) => {
    const text = normalisiere(readFileSync(join(ordner, s.datei), 'utf8'));
    if (!/SIL Open Font License,? Version 1\.1/.test(text)) throw new Error(`${s.datei}: kein Text der SIL OFL 1.1`);
    const urheber = urheberAusOfl(text);
    return {
      name: s.name,
      version: '5.3.0',
      lizenz: 'OFL-1.1',
      quelle: s.quelle,
      herkunft: [s.herkunft],
      texte: [{ datei: s.datei, text }],
      hinweis: [`Urheber laut Lizenzdatei / copyright holder according to the licence file: ${urheber}`, 'Die Schrift wird nicht einzeln verkauft. / The font is not sold by itself.'].join('\n'),
    };
  });
}

/**
 * Diagrammansicht (AIMS-Manager/Diagrammansicht.html): unveränderter Viewer von draw.io mit den darin gebündelten
 * Bibliotheken (vendor/drawio-viewer/HERKUNFT.txt). Lizenztexte unverändert aus src/lizenz/DIAGRAMMANSICHT_DIAGRAM-VIEWER.
 */
export const DIAGRAMMANSICHT = [
  { name: 'draw.io viewer-static', version: '32.4.1', lizenz: 'Apache-2.0', quelle: 'https://github.com/jgraph/drawio/tree/v32.4.1', dateien: ['volltext_Apache-2.0_Viewer.txt'], hinweis: 'Copyright (c) JGraph Holdings Ltd, draw.io AG. Unverändert / unmodified, SHA-256 bc7586cb62eec98018c13b78619078d3a7179cc7bfc711c566dda19527520a30. Keine NOTICE-Datei im Projekt / no NOTICE file in the project.\ndraw.io ist eine eingetragene Marke von draw.io Ltd. / draw.io is a registered trademark of draw.io Ltd.' },
  { name: 'DOMPurify', version: '3.4.16', lizenz: 'Apache-2.0 (gewählt aus / chosen from Apache-2.0 OR MPL-2.0)', quelle: 'https://github.com/cure53/DOMPurify', dateien: ['volltext_Apache-2.0_DOMPurify.txt'], hinweis: '(c) Cure53 and other contributors' },
  { name: 'pako', version: '2.2.0', lizenz: 'MIT AND Zlib', quelle: 'https://github.com/nodeca/pako', dateien: ['volltext_MIT_pako.txt', 'volltext_Zlib_pako.txt'] },
  { name: 'Rough.js (roughjs)', version: '4.6.6', lizenz: 'MIT', quelle: 'https://github.com/rough-stuff/rough', dateien: ['volltext_MIT_Rough.js.txt'] },
  { name: 'spin.js', version: '2.0.0', lizenz: 'MIT', quelle: 'https://github.com/fgnass/spin.js', dateien: ['volltext_MIT_spin.js.txt'] },
  { name: 'regenerator-runtime', version: '-', lizenz: 'MIT', quelle: 'https://github.com/facebook/regenerator', dateien: ['volltext_MIT_regenerator-runtime.txt'], hinweis: 'Version im Bundle nicht angegeben / version not stated in the bundle' },
] as const;

export function diagrammansichtEintraege(ordner = join(REPO, 'src', 'lizenz', 'DIAGRAMMANSICHT_DIAGRAM-VIEWER')): Eintrag[] {
  return DIAGRAMMANSICHT.map((d) => ({
    name: d.name,
    version: d.version,
    lizenz: d.lizenz,
    quelle: d.quelle,
    herkunft: ['im Viewer der Diagrammansicht gebündelt / bundled in the viewer of the diagram viewer (AIMS-Manager/Diagrammansicht.html)'],
    texte: d.dateien.map((datei) => ({ datei, text: normalisiere(readFileSync(join(ordner, datei), 'utf8')) })),
    hinweis: 'hinweis' in d ? d.hinweis : undefined,
  }));
}

const LINIE = '='.repeat(75);

export function formatiere(liste: Eintrag[]): string {
  const kopf = [
    'DRITTLIZENZEN / THIRD-PARTY LICENCES',
    'ISO/IEC 42001 Starter-Kit von Andreas Gapsch, KMU-CIO, kmu-cio.ch',
    'ISO/IEC 42001 Starter Kit by Andreas Gapsch, KMU-CIO, kmu-cio.ch',
    '',
    'Der AIMS-Manager enthält die folgenden Bibliotheken Dritter, die optionale',
    'Diagrammansicht den Viewer von draw.io mit seinen Bibliotheken. AIMS-Manager',
    'Startseite und Diagrammansicht enthalten die Schrift Inter, Leitfaden und',
    'Poster die Schriften Archivo und Source Serif 4. Sie stehen unter ihren',
    'eigenen Lizenzen; die Lizenztexte folgen unverändert.',
    'The AIMS Manager contains the following third-party libraries, the optional',
    'diagram viewer contains the draw.io viewer with its libraries. The AIMS',
    'Manager, the start page and the diagram viewer contain the font Inter, the',
    'guide and poster the fonts Archivo and Source Serif 4. They are subject to',
    'their own licences; the licence texts follow unchanged.',
    '',
    `${'Paket / package'.padEnd(36)} ${'Version'.padEnd(12)} Lizenz / licence`,
    `${'-'.repeat(36)} ${'-'.repeat(12)} ${'-'.repeat(20)}`,
    ...liste.map((e) => `${e.name.padEnd(36)} ${e.version.padEnd(12)} ${e.lizenz}`),
    '',
  ];
  const teile = liste.map((e) =>
    [
      LINIE,
      `${e.name} ${e.version}`,
      `Lizenz / licence: ${e.lizenz}`,
      `Quelle / source: ${e.quelle}`,
      ...e.herkunft.map((h) => `Im Bundle / in bundle: ${h}`),
      ...(e.hinweis ? ['', e.hinweis] : []),
      LINIE,
      '',
      ...e.texte.flatMap((t) => (e.texte.length > 1 ? [`[${t.datei}]`, '', t.text, ''] : [t.text, ''])),
    ].join('\n'),
  );
  return [...kopf, ...teile].join('\n').replace(/\n{3,}/g, '\n\n');
}

/** UTF-8 mit BOM und CRLF, damit der Windows-Editor die Datei richtig zeigt. */
export function fuerWindows(text: string): string {
  return `\uFEFF${text.replace(/\r\n?/g, '\n').replace(/\n/g, '\r\n')}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const ausIdx = args.indexOf('--aus');
  const aus = resolve(ausIdx >= 0 && args[ausIdx + 1] ? args[ausIdx + 1]! : join(REPO, 'dist', 'lizenz', 'DRITTLIZENZEN_THIRD-PARTY.txt'));
  const { liste, fehlend } = eintraege(sammle(), args.includes('--holen'));
  if (fehlend.length) {
    console.error(`Lizenztexte fehlen (nicht in node_modules, nicht im Cache): ${fehlend.join(', ')}`);
    console.error('Einmalig mit --holen ausführen (braucht Zugang zur npm-Registry).');
    process.exit(1);
  }
  mkdirSync(dirname(aus), { recursive: true });
  writeFileSync(aus, fuerWindows(formatiere([...liste, ...schriftEintraege(), ...diagrammansichtEintraege()])));
  const ersatz = liste.filter((e) => e.texte.some((t) => !LIZENZDATEI.test(t.datei))).map((e) => `${e.name} (${e.texte[0]!.datei})`);
  console.log(`${liste.length} Pakete, ${liste.filter((e) => e.hinweis?.startsWith('Nicht installiert')).length} aus dem Cache; Text aus README oder SPDX: ${ersatz.join(', ') || 'keine'}`);
  console.log(aus);
}
