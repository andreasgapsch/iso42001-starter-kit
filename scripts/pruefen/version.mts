// Tor G36 Version und Changelog (AF-177, AF-178, AF-179, AF-007; Q13 «Release-Tore»).
// Einzige Quelle der Version ist package.json. Das Tor vergleicht damit:
//   0. package-lock.json: Version des Wurzelpakets gleich package.json.
//   1. CHANGELOG.md: «## [Unveröffentlicht]» zuoberst, darunter je Version «## [x.y.z-…] - JJJJ-MM-TT» (ISO, W11 a),
//      absteigend nach SemVer; der oberste Versionseintrag ist die Version in package.json. Jede Aufzählung steht unter
//      einer Änderungsart aus ARTEN; ab 1.0.0-test.4 hat jeder Release den Abschnitt «Für Anwender» (AF-007).
//   2. Git-Tags: jeder Tag v<x> hat einen Eintrag und jeder Eintrag einen Tag (AF-179); kein Tag über package.json.
//   3. Release-Tag (--tag v<x>, RELEASE_TAG oder GITHUB_REF_TYPE=tag): muss v<package.json> sein (AF-178).
//   4. Gebautes Kit und Werkzeug (dist/kit/*/START.html, CHANGELOG.txt, Skill SKILL.md, dist/app/aims-manager.html): dieselbe Version.
//   5. Handgepflegte Versionsangaben: in src/, scripts/ und README.md darf keine Kit-Version als Text stehen (AF-177);
//      Ausnahmen nur mit Grund in AUSNAHMEN.
// Release-Modus (--release, RELEASE=1 oder Tag-Build): fehlender Tag, fehlendes oder veraltet gebautes Kit und Werkzeug und
// fehlende Tags im Klon sind Fehler, sonst Warnungen (Entwicklung zwischen zwei Releases, flacher Klon in der CI).
// Aufruf: npx tsx scripts/pruefen/version.mts [--release] [--tag v1.0.0-test.4]   (Tag auch über RELEASE_TAG)
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, dateienUnter, formatiere, passtMuster, relativ, zaehle, type Befund, type Optionen } from './gemeinsam.mts';

const TOR = 'G36';

/** Änderungsarten nach Keep a Changelog, deutsch, plus «Für Anwender» (AF-007, QK-04) */
export const ARTEN = ['Für Anwender', 'Neu', 'Geändert', 'Behoben', 'Entfernt', 'Veraltet', 'Sicherheit'] as const;
/** Ab dieser Version verlangt das Tor den Abschnitt «Für Anwender» (AF-007) */
export const FUER_ANWENDER_AB = '1.0.0-test.4';
export const UNVEROEFFENTLICHT = 'Unveröffentlicht';

/**
 * Handgepflegte Versionsangaben, die bleiben dürfen, mit Grund. Muster wie in den Ausnahmelisten (`*`, `**`).
 * `zeile`: nur Zeilen, die auf diesen Ausdruck passen (sonst die ganze Datei). `warnung`: Treffer wird als Warnung gemeldet
 * (fremde Datei, Nachführung offen), sonst still übergangen.
 */
export interface Ausnahme { muster: string; zeile?: RegExp; grund: string; warnung?: boolean }
export const AUSNAHMEN: Ausnahme[] = [
  { muster: 'scripts/pruefen/version.mts', grund: 'Tor selbst (Schwelle FUER_ANWENDER_AB)' },
  { muster: 'src/beispiele/*.aims.json', zeile: /"kitVersion"/, grund: 'beim Bau durch KIT_VERSION ersetzt (scripts/app-bauen.mts, scripts/build.mts)' },
  { muster: 'src/beispiele/bau/**', grund: 'Bauskripte vor rc.6, laufen nicht mehr (src/beispiele/bau/bauen.mts)' },
  { muster: 'src/model/migrationen.ts', zeile: /^\/\//, grund: 'Kommentar zur Geschichte der Schemaversion' },
  { muster: 'src/model/typen.ts', zeile: /^\s*(?:\/\/|\*|\/\*\*)/, grund: 'Kommentar zur Geschichte der Schemaversion (SCHEMA_VERSION, Paket P7)' },
  // Fremdversionen mit Versionswort oder «v» (Erkennung allgemeiner SemVer-Versionen, findeVersion)
  { muster: 'src/lizenz/DIAGRAMMANSICHT_DIAGRAM-VIEWER/**', grund: 'Lizenz- und Herkunftstexte des gepinnten draw.io-Viewers' },
  { muster: 'src/lizenz/LI*.txt', zeile: /draw\.io/, grund: 'Lizenztext: Version des gepinnten draw.io-Viewers' },
  { muster: 'scripts/diagrammansicht.mts', zeile: /version: '|tag: 'v|\/v\d+\.\d+\.\d+\//, grund: 'gepinnter Viewer mit Prüfsumme (VIEWER)' },
  { muster: 'scripts/drittlizenzen.mts', zeile: /version: '/, grund: 'Versionen von Schriften und Viewer-Bibliotheken in der Drittlizenzliste' },
  { muster: 'scripts/pruefen/workflow.mts', zeile: /# v\d/, grund: 'Beispiel des Versionskommentars für Actions (# v7.0.1)' },
];

// SemVer 2.0.0, ohne Build-Metadaten
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?$/;

export function istSemver(v: string): boolean {
  return SEMVER.test(v);
}

/** Vergleich nach SemVer 2.0.0, Abschnitt 11: negativ, wenn a < b. Eine Version ohne Vorabkennung ist höher als jede Vorabversion. */
export function vergleiche(a: string, b: string): number {
  const ma = SEMVER.exec(a);
  const mb = SEMVER.exec(b);
  if (!ma || !mb) throw new Error(`keine SemVer-Version: ${!ma ? a : b}`);
  for (let i = 1; i <= 3; i++) {
    const d = Number(ma[i]) - Number(mb[i]);
    if (d) return d;
  }
  const pa = ma[4]?.split('.');
  const pb = mb[4]?.split('.');
  if (!pa && !pb) return 0;
  if (!pa) return 1;
  if (!pb) return -1;
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) {
      const d = Number(x) - Number(y);
      if (d) return d;
    } else if (nx !== ny) return nx ? -1 : 1;
    else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export interface Abschnitt {
  /** Version oder UNVEROEFFENTLICHT */
  version: string;
  datum?: string;
  zeile: number;
  /** Änderungsarten (Überschriften ###) in der Reihenfolge */
  arten: string[];
  /** Zeilennummern von Aufzählungen vor der ersten Änderungsart */
  ohneArt: number[];
  /** Überschriften ###, die keine Änderungsart sind */
  fremdeArten: { text: string; zeile: number }[];
  /** Zeilen der Kopfzeile, die nicht dem Muster entsprechen */
  kopfFehler?: string;
  leer: boolean;
}

const KOPF = /^## \[([^\]]+)\](.*)$/;

/** Zerlegt CHANGELOG.md in Abschnitte je Version. */
export function zerlegeChangelog(text: string): Abschnitt[] {
  const zeilen = text.split(/\r?\n/);
  const liste: Abschnitt[] = [];
  let akt: Abschnitt | null = null;
  let art: string | null = null;
  zeilen.forEach((z, i) => {
    const nr = i + 1;
    if (z.startsWith('## ')) {
      const m = KOPF.exec(z);
      art = null;
      if (!m) {
        akt = { version: z.slice(3).trim(), zeile: nr, arten: [], ohneArt: [], fremdeArten: [], kopfFehler: 'Kopfzeile nicht in der Form «## [Version] - JJJJ-MM-TT» oder «## [Unveröffentlicht]»', leer: true };
        liste.push(akt);
        return;
      }
      const version = m[1]!.trim();
      const rest = m[2]!.trim();
      const a: Abschnitt = { version, zeile: nr, arten: [], ohneArt: [], fremdeArten: [], leer: true };
      if (version === UNVEROEFFENTLICHT) {
        if (rest) a.kopfFehler = '«Unveröffentlicht» trägt kein Datum';
      } else {
        const d = /^- (\d{4}-\d{2}-\d{2})$/.exec(rest);
        if (d) a.datum = d[1];
        else a.kopfFehler = `Datum fehlt oder nicht im ISO-Format «- JJJJ-MM-TT» (W11 a): «${rest}»`;
      }
      akt = a;
      liste.push(a);
      return;
    }
    if (!akt) return;
    const a = akt as Abschnitt;
    if (z.startsWith('### ')) {
      const t = z.slice(4).trim();
      if ((ARTEN as readonly string[]).includes(t)) {
        a.arten.push(t);
        art = t;
      } else {
        a.fremdeArten.push({ text: t, zeile: nr });
        art = null;
      }
      a.leer = false;
      return;
    }
    if (z.trim()) a.leer = false;
    if (/^\s*[-*] /.test(z) && !art && !/^\s{2,}/.test(z)) a.ohneArt.push(nr);
  });
  return liste;
}

export interface Eingabe {
  paketVersion?: string;
  changelog?: string;
  /** Git-Tags (alle, auch fremde); null: Git nicht verfügbar */
  tags?: string[] | null;
  /** Tag des Release-Builds */
  tag?: string | null;
  release?: boolean;
  /** Text von START.html des gebauten Kits; null: nicht gebaut */
  start?: string | null;
  /** Text von CHANGELOG.txt des gebauten Kits; null: nicht gebaut */
  changelogTxt?: string | null;
  /** Text von SKILL.md im gebauten Kit; null: nicht gebaut */
  skill?: string | null;
  /** Ordnername des gebauten Kits */
  kitOrdner?: string | null;
  /** Version im Datenblock des gebauten AIMS-Managers; null: nicht gebaut */
  appVersion?: string | null;
  /** Dateien für die Suche nach handgepflegten Versionen (Pfad relativ zum Repo, Text) */
  dateien?: { pfad: string; text: string }[];
  ausnahmen?: Ausnahme[];
  /** Text von package-lock.json; null: keiner */
  lock?: string | null;
}

function gitTags(): string[] | null {
  try {
    return execFileSync('git', ['tag', '--list'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').map((t) => t.trim()).filter(Boolean);
  } catch {
    return null;
  }
}

function releaseTag(): string | null {
  const i = process.argv.indexOf('--tag');
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]!;
  if (process.env.RELEASE_TAG) return process.env.RELEASE_TAG;
  if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME) return process.env.GITHUB_REF_NAME;
  return null;
}

export function istReleaseModus(): boolean {
  return process.argv.includes('--release') || process.env.RELEASE === '1' || releaseTag() !== null;
}

/** Gebautes Kit: neuester Ordner unter dist/kit mit START.html */
function gebautesKit(): { ordner: string; start: string; changelogTxt: string | null; skill: string | null } | null {
  const basis = join(REPO, 'dist', 'kit');
  if (!existsSync(basis)) return null;
  for (const n of readdirSync(basis)) {
    const s = join(basis, n, 'START.html');
    if (existsSync(s)) {
      const c = join(basis, n, 'CHANGELOG.txt');
      const k = join(basis, n, 'KI-Assistent_AI-Assistant', 'iso42001-kmu', 'SKILL.md');
      return { ordner: n, start: readFileSync(s, 'utf8'), changelogTxt: existsSync(c) ? readFileSync(c, 'utf8') : null, skill: existsSync(k) ? readFileSync(k, 'utf8') : null };
    }
  }
  return null;
}

/** Version im Block «daten-app» des gebauten AIMS-Managers */
export function appVersionAus(html: string): string | null {
  const m = /<script type="application\/json" id="daten-app">([\s\S]*?)<\/script>/.exec(html);
  if (!m) return null;
  try {
    return (JSON.parse(m[1]!) as { version?: string }).version ?? null;
  } catch {
    return null;
  }
}

/** Version in START.html («Version</span> x.y.z,») */
export function startVersionAus(html: string): string | null {
  return /data-t="stand_version">[^<]*<\/span>\s*([^\s,<]+)/.exec(html)?.[1] ?? null;
}

const SUCH_ENDUNGEN = /\.(ts|tsx|mts|js|mjs|tpl|md|yaml|yml|json|html|txt)$/;

/** Dateien, in denen keine handgepflegte Kit-Version stehen darf */
export function suchDateien(): { pfad: string; text: string }[] {
  const liste = [...dateienUnter(join(REPO, 'src'), (p) => SUCH_ENDUNGEN.test(p)), ...dateienUnter(join(REPO, 'scripts'), (p) => SUCH_ENDUNGEN.test(p)), join(REPO, 'README.md')];
  return liste
    .filter((p) => existsSync(p) && !relativ(p).startsWith('src/generiert/'))
    .map((p) => ({ pfad: relativ(p), text: readFileSync(p, 'utf8') }));
}

/**
 * Sucht in einer Zeile eine Versionsangabe, die wie eine Kit-Version aussieht (AF-177). Erfasst werden allgemeine
 * SemVer-Versionen (x.y.z, auch 1.1.0 oder 2.0.0) in einer dieser Formen:
 *   - mit Vorabteil test, rc, alpha, beta (1.1.0-test.1)
 *   - als Tag mit «v» (v1.1.0)
 *   - nach dem Wort version, Version, kitVersion, KIT_VERSION oder kit_version («version: "1.1.0"», «Version 2.0.0»)
 *   - am Zeilenanfang vor « (» wie im Kopf von CHANGELOG.txt («1.1.0 (20.11.2026)»)
 *   - mit derselben Haupt- und Nebenversion wie package.json (1.0.y)
 * Nicht erfasst werden Nummern ohne diesen Zusammenhang: Normabschnitte (6.1.2), WCAG-Kriterien (1.4.3), Datumsangaben
 * (27.07.2026, wegen der führenden Null keine SemVer-Version; 2.12.2027 nur ohne Versionswort). Versionen von Fremdteilen
 * mit Versionswort (Viewer, Abhängigkeiten, Beispielmuster) stehen begründet in AUSNAHMEN.
 */
export function findeVersion(zeile: string, paketVersion: string): string | null {
  const p = SEMVER.exec(paketVersion);
  const [major, minor] = [p?.[1] ?? '1', p?.[2] ?? '0'];
  const V = String.raw`\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?`;
  const muster = [
    new RegExp(String.raw`(?<![\w.\-/])v?(\d+\.\d+\.\d+-(?:test|rc|alpha|beta)\.\d+)(?![\w.]*\d)`, 'g'),
    new RegExp(String.raw`(?<![\w.\-/])v(\d+\.\d+\.\d+)(?![\w.]*\d)`, 'g'),
    new RegExp(String.raw`\b(?:kit_?version|version)\b["'\x60]?\s*[:=]?\s*["'\x60]?v?(${V})(?![\w.]*\d)`, 'gi'),
    new RegExp(String.raw`^\s*v?(${V}) \(`, 'g'),
    new RegExp(String.raw`(?<![\w.\-/])v?(${major}\.${minor}\.\d+(?:-(?:test|rc|alpha|beta)\.\d+)?)(?![\w.]*\d)`, 'g'),
  ];
  for (const re of muster) for (const m of zeile.matchAll(re)) if (istSemver(m[1]!)) return m[0].trim();
  return null;
}

export async function pruefe(_o: Optionen = {}, e: Eingabe = {}): Promise<Befund[]> {
  const befunde: Befund[] = [];
  const release = e.release ?? istReleaseModus();
  const fehler = (datei: string, meldung: string, zeile?: number) => befunde.push({ tor: TOR, datei, meldung, schwere: 'fehler', ...(zeile ? { zeile } : {}) });
  const warnung = (datei: string, meldung: string, zeile?: number) => befunde.push({ tor: TOR, datei, meldung, schwere: 'warnung', ...(zeile ? { zeile } : {}) });
  const fehlerOderWarnung = (datei: string, meldung: string) => (release ? fehler : warnung)(datei, meldung);

  const version = e.paketVersion ?? (JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as { version: string }).version;
  if (!istSemver(version)) {
    fehler('package.json', `Version «${version}» ist keine SemVer-Version`);
    return befunde;
  }

  // Lockfile: Version des Wurzelpakets wie package.json (npm version führt beide nach)
  const lock = e.lock === undefined ? (existsSync(join(REPO, 'package-lock.json')) ? readFileSync(join(REPO, 'package-lock.json'), 'utf8') : null) : e.lock;
  if (lock !== null) {
    const l = JSON.parse(lock) as { version?: string; packages?: Record<string, { version?: string }> };
    for (const [wo, v] of [['version', l.version], ['packages[""].version', l.packages?.['']?.version]] as const) {
      if (v !== version) fehler('package-lock.json', `${wo} ist ${v ?? '(leer)'} statt ${version} (npm install --package-lock-only)`);
    }
  }

  // 1. Changelog
  const text = e.changelog ?? readFileSync(join(REPO, 'CHANGELOG.md'), 'utf8');
  const abschnitte = zerlegeChangelog(text);
  if (abschnitte[0]?.version !== UNVEROEFFENTLICHT) fehler('CHANGELOG.md', '«## [Unveröffentlicht]» steht nicht als erster Abschnitt (AF-179)', abschnitte[0]?.zeile);
  const versionen = abschnitte.filter((a) => a.version !== UNVEROEFFENTLICHT);
  const gesehen = new Set<string>();
  for (const a of abschnitte) {
    if (a.kopfFehler) fehler('CHANGELOG.md', a.kopfFehler, a.zeile);
    if (a.version !== UNVEROEFFENTLICHT) {
      if (!istSemver(a.version)) fehler('CHANGELOG.md', `«${a.version}» ist keine SemVer-Version`, a.zeile);
      if (gesehen.has(a.version)) fehler('CHANGELOG.md', `Version ${a.version} steht doppelt`, a.zeile);
      gesehen.add(a.version);
      if (a.leer) fehler('CHANGELOG.md', `Eintrag ${a.version} ist leer`, a.zeile);
      else if (!a.arten.length) fehler('CHANGELOG.md', `Eintrag ${a.version} ohne Änderungsart (### ${ARTEN.join(', ')})`, a.zeile);
      if (istSemver(a.version) && vergleiche(a.version, FUER_ANWENDER_AB) >= 0 && !a.arten.includes('Für Anwender')) {
        fehler('CHANGELOG.md', `Release ${a.version} ohne Abschnitt «### Für Anwender» (was ändert sich an meinen Dateien, was ist zu tun; AF-007)`, a.zeile);
      }
    } else if (!a.leer && !a.arten.includes('Für Anwender')) {
      warnung('CHANGELOG.md', '«Unveröffentlicht» hat noch keinen Abschnitt «### Für Anwender»; vor dem Release ergänzen (AF-007)', a.zeile);
    }
    for (const z of a.ohneArt) fehler('CHANGELOG.md', `Aufzählung ohne Änderungsart in ${a.version}`, z);
    for (const f of a.fremdeArten) fehler('CHANGELOG.md', `«### ${f.text}» ist keine Änderungsart (erlaubt: ${ARTEN.join(', ')})`, f.zeile);
  }
  for (let i = 1; i < versionen.length; i++) {
    const [vor, nach] = [versionen[i - 1]!, versionen[i]!];
    if (istSemver(vor.version) && istSemver(nach.version) && vergleiche(vor.version, nach.version) <= 0) {
      fehler('CHANGELOG.md', `Reihenfolge: ${nach.version} steht unter ${vor.version}, ist aber nicht älter`, nach.zeile);
    }
  }
  const kopf = versionen[0];
  if (!kopf) fehler('CHANGELOG.md', 'kein Versionseintrag');
  else if (kopf.version !== version) {
    const hoeher = istSemver(kopf.version) && vergleiche(version, kopf.version) > 0;
    fehler(
      'package.json',
      `Version ${version} weicht vom obersten Changelog-Eintrag ${kopf.version} ab` +
        (hoeher && !version.includes('-') && kopf.version.includes('-')
          ? `; nach SemVer ist ${version} höher als jede Vorabversion ${kopf.version.replace(/\.\d+$/, '.x')} und meldet fälschlich eine fertige Version`
          : '') +
        ' (AF-178)',
    );
  }

  // 2. Tags
  const tags = e.tags === undefined ? gitTags() : e.tags;
  const vTags = (tags ?? []).filter((t) => /^v\d/.test(t)).map((t) => t.slice(1));
  if (!vTags.length) {
    fehlerOderWarnung('.git', 'keine Versions-Tags gefunden (flacher Klon ohne Tags?); Vergleich Tag und Changelog übersprungen');
  } else {
    const eintraege = new Set(versionen.map((a) => a.version));
    for (const t of vTags) {
      if (!eintraege.has(t)) fehler('CHANGELOG.md', `Tag v${t} ohne Changelog-Eintrag (AF-179)`);
      if (istSemver(t) && vergleiche(t, version) > 0) fehler('package.json', `Tag v${t} ist höher als die Version ${version} in package.json`);
    }
    for (const a of versionen) {
      if (vTags.includes(a.version)) continue;
      if (a.version === version && !release) warnung('CHANGELOG.md', `Eintrag ${a.version} hat noch keinen Tag v${a.version} (Release in Vorbereitung)`, a.zeile);
      else fehler('CHANGELOG.md', `Eintrag ${a.version} ohne Tag v${a.version} (AF-179)`, a.zeile);
    }
  }

  // 3. Release-Tag
  const tag = e.tag === undefined ? releaseTag() : e.tag;
  if (tag !== null && tag !== `v${version}`) fehler('package.json', `Release-Tag ${tag} passt nicht zur Version ${version} (erwartet v${version}; AF-178)`);

  // 4. Gebautes Kit und Werkzeug
  let start = e.start;
  let changelogTxt = e.changelogTxt;
  let kitOrdner = e.kitOrdner;
  let skill = e.skill;
  if (start === undefined) {
    const k = gebautesKit();
    start = k?.start ?? null;
    changelogTxt ??= k?.changelogTxt ?? null;
    kitOrdner ??= k?.ordner ?? null;
    skill ??= k?.skill ?? null;
  }
  if (start === null) fehlerOderWarnung('dist/kit', 'Kit nicht gebaut (npm run build:kit): START.html nicht verglichen');
  else {
    const sv = startVersionAus(start);
    // Ein veralteter Bau ist zwischen zwei Releases normal (Warnung); im Release-Modus bricht er ab
    if (sv !== version) fehlerOderWarnung('dist/kit/START.html', `START.html nennt Version ${sv ?? '(keine)'} statt ${version} (AF-178)`);
    if (kitOrdner && !kitOrdner.endsWith(`_v${version}`)) fehlerOderWarnung('dist/kit', `Kit-Ordner ${kitOrdner} trägt nicht die Version ${version}`);
    if (changelogTxt && !changelogTxt.includes(`${version} (`)) fehlerOderWarnung('dist/kit/CHANGELOG.txt', `CHANGELOG.txt nennt die Version ${version} nicht`);
    if (skill) {
      const sv = /^\s*version:\s*"([^"]*)"/m.exec(skill)?.[1];
      if (sv !== version) fehlerOderWarnung('dist/kit/SKILL.md', `Skill nennt Version ${sv ?? '(keine)'} statt ${version} (scripts/skill.mts setzt {{version}} ein)`);
    }
  }
  let appVersion = e.appVersion;
  if (appVersion === undefined) {
    const p = join(REPO, 'dist', 'app', 'aims-manager.html');
    appVersion = existsSync(p) ? appVersionAus(readFileSync(p, 'utf8')) ?? '(keine)' : null;
  }
  if (appVersion === null) fehlerOderWarnung('dist/app', 'AIMS-Manager nicht gebaut (npm run build:app): Version nicht verglichen');
  else if (appVersion !== version) fehlerOderWarnung('dist/app/aims-manager.html', `AIMS-Manager meldet Version ${appVersion} statt ${version} (veraltet gebaut?)`);

  // 5. Handgepflegte Versionsangaben
  const ausnahmen = e.ausnahmen ?? AUSNAHMEN;
  for (const d of e.dateien ?? suchDateien()) {
    d.text.split(/\r?\n/).forEach((z, i) => {
      const treffer = findeVersion(z, version);
      if (!treffer) return;
      const a = ausnahmen.find((x) => passtMuster(d.pfad, x.muster) && (!x.zeile || x.zeile.test(z)));
      if (a && !a.warnung) return;
      const meldung = `handgepflegte Version «${treffer}»; die Version kommt aus package.json über KIT_VERSION oder {{version}} (AF-177)`;
      if (a) warnung(d.pfad, `${meldung}. Ausnahme: ${a.grund}`, i + 1);
      else fehler(d.pfad, meldung, i + 1);
    });
  }
  return befunde;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  const befunde = await pruefe();
  for (const b of befunde) console.log(formatiere(b));
  const z = zaehle(befunde);
  console.log(`${TOR} Version und Changelog${istReleaseModus() ? ' (Release)' : ''}: ${z.fehler} Fehler, ${z.warnungen} Warnungen`);
  process.exitCode = z.fehler ? 1 : 0;
}
