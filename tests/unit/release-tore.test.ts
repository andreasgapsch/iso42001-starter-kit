// P4 Version und Release-Tore (Q13): eine Quelle für die Version (AF-177), Tor G36 Version, Tag, Changelog, gebautes START
// (AF-178, AF-179, AF-007), Tor G37 Rechtsstand (AF-116), Hinweis im Werkzeug (AF-117), Seite «Was das Kit nicht
// entscheidet» (AF-119), Rechtsangaben nach R1 bis R18 (AF-120, AF-115).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { KIT_VERSION, leeresProjekt, mitKitVersion } from '../../src/model/neu.ts';
import { minusMonate, rechtsstandTor, rechtsstandWarnung, sichtungen, type RechtsstandQuelle } from '../../src/app/logik/rechtsstand.ts';
import { appVersionAus, findeVersion, pruefe as pruefeVersion, startVersionAus, vergleiche, zerlegeChangelog, type Eingabe } from '../../scripts/pruefen/version.mts';
import { pruefe as pruefeRechtsstand } from '../../scripts/pruefen/rechtsstand.mts';

const REPO = join(import.meta.dirname, '..', '..');
const lies = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
const paket = JSON.parse(lies('package.json')) as { version: string };
const standDatei = parse(lies('src/ai-act/stand.yaml')) as {
  geprueft_am: string;
  fristen: { id: string; datum: string; art: string; artikel: string }[];
  hinweise: { id: string; status: string; geprueft_am?: string; leitlinien?: { artikel: string; status: string; belegt?: string; url?: string }[]; interpellation?: { nummer: string; stellungnahme: string; url: string; abgerufen: string } }[];
};

// Eingabe für G36 ohne Repo-Zugriff: alles festgelegt, nur das Geprüfte variiert
const CHANGELOG_OK = `# Changelog

## [Unveröffentlicht]

### Für Anwender
- nichts zu tun

## [1.0.0-test.4] - 2026-11-20

### Für Anwender
- Projektdateien bleiben gültig

### Neu
- Tore

## [1.0.0-test.3] - 2026-11-03

### Behoben
- Restbefunde
`;
const START = (v: string) => `<p class="stand"><span data-t="stand_version">Version</span> ${v}, <span data-t="stand_datum">Stand</span> 20.11.2026</p>`;
const basis = (x: Partial<Eingabe> = {}): Eingabe => ({
  paketVersion: '1.0.0-test.4', changelog: CHANGELOG_OK, tags: ['v1.0.0-test.3', 'v1.0.0-test.4'], tag: null, release: false,
  start: START('1.0.0-test.4'), changelogTxt: '1.0.0-test.4 (20.11.2026)', kitOrdner: 'KMU-CIO_ISO42001-Starter-Kit_v1.0.0-test.4',
  appVersion: '1.0.0-test.4', dateien: [], lock: null, ...x,
});
const fehler = async (x: Partial<Eingabe>) => (await pruefeVersion({}, basis(x))).filter((b) => b.schwere === 'fehler').map((b) => b.meldung);

describe('AF-177 Version aus einer Quelle (package.json)', () => {
  it('KIT_VERSION ist die Version aus package.json, eine neue Projektdatei trägt sie', () => {
    expect(paket.version).toBe('1.0.0');
    expect(KIT_VERSION).toBe(paket.version);
    expect(leeresProjekt({ jetzt: '2026-11-07T00:00:00.000Z' }).kitVersion).toBe('1.0.0');
  });

  it('Version über ein Modul mit Importattribut (Node-ESM, Playwright), im Bündel nur als Konstante', () => {
    const v = lies('src/model/version.ts');
    expect(v).toContain("import paket from '../../package.json' with { type: 'json' };");
    // Kein JSON-Import ohne Attribut (Node-ESM bricht sonst beim Laden ab, Befund aus der P5-Prüfung)
    for (const d of ['src/model/neu.ts', 'src/app/worker/einstieg.ts']) expect(lies(d), d).not.toMatch(/from '[^']*\.json'(?! with)/);
    const vite = lies('vite.config.ts');
    expect(vite).toContain("const VERSION_MODUL = resolve(HIER, 'src/model/version.ts');");
    expect(vite).toMatch(/plugins: teil === 'app' \? \[kitVersion, viteSingleFile\(\)\] : \[kitVersion\]/);
  });

  it('neu.ts, CHANGELOG.txt.tpl und START tragen keine Version als Text', () => {
    expect(lies('src/model/neu.ts')).not.toMatch(/['"]1\.0\.\d/);
    expect(lies('src/start/CHANGELOG.txt.tpl')).toMatch(/^\{\{version\}\} \(\{\{datum\}\}\)\r?$/m);
    expect(lies('src/start/START.html.tpl')).toContain('</span> {{version}},');
  });

  it('Beispiele bekommen beim Bau die Version aus package.json (Formatierung bleibt)', () => {
    const roh = lies('src/beispiele/praezisionsteile.de.aims.json');
    const neu = mitKitVersion(roh);
    expect(JSON.parse(neu).kitVersion).toBe(KIT_VERSION);
    expect(neu.length - roh.length).toBe(KIT_VERSION.length - (JSON.parse(roh).kitVersion as string).length);
    for (const d of ['scripts/app-bauen.mts', 'scripts/build.mts']) expect(lies(d), d).toContain('mitKitVersion(readFileSync(');
  });

  it('Tor findet eine handgepflegte Version und lässt Fremdversionen in Ruhe (Gegenprobe)', async () => {
    const dateien = [
      { pfad: 'src/model/neu.ts', text: "export const KIT_VERSION = '1.0.0-test.4';" },
      { pfad: 'src/generator/farbe.ts', text: '// WCAG 1.4.3, Abschnitt 6.1.2, Stand 27.07.2026' },
    ];
    const f = await fehler({ dateien });
    expect(f.filter((m) => m.includes('handgepflegte Version'))).toHaveLength(1);
  });

  it('im Repo steht ausserhalb package.json keine handgepflegte Version (Fehler und Warnungen 0)', async () => {
    const b = await pruefeVersion({}, { ...basis({ paketVersion: paket.version }), dateien: undefined, changelog: CHANGELOG_OK.replace(/1\.0\.0-test\.4/g, paket.version) });
    expect(b.filter((x) => x.meldung.includes('handgepflegte Version'))).toEqual([]);
  });

  it('Worker und Skill beziehen die Version aus package.json; Gegenprobe mit Handeintrag in einer neuen Datei bricht', async () => {
    expect(lies('src/app/worker/einstieg.ts')).toContain('let kitVersion = KIT_VERSION;');
    expect(lies('src/skill/SKILL.md')).toMatch(/^\s*version: "\{\{version\}\}"$/m);
    expect(lies('src/skill/references/json-ausgabe.md')).toContain('"kitVersion": "{{version}}"');
    expect(lies('scripts/skill.mts')).toContain("replaceAll('{{version}}', KIT_VERSION)");
    const b = await pruefeVersion({}, basis({ dateien: [{ pfad: 'src/skill/references/neu.md', text: '"kitVersion": "1.0.0-test.4"' }] }));
    expect(b.filter((x) => x.meldung.includes('handgepflegte Version')).map((x) => [x.datei, x.schwere])).toEqual([['src/skill/references/neu.md', 'fehler']]);
  });

  it('erkennt allgemeine SemVer-Versionen als Handeintrag (1.1.0, 2.0.0), aber keine Normabschnitte und Daten', async () => {
    const treffer = ["export const KIT_VERSION = '1.1.0';", 'version: "2.0.0"', 'Tag v1.1.0', 'Version 1.1.0-test.1', '1.1.0 (20.11.2026)', '"kitVersion": "3.2.1"'];
    for (const z of treffer) expect(findeVersion(z, '1.0.0-test.3'), z).not.toBeNull();
    const keine = ['norm: "6.1.1, 6.1.2, 8.2"', 'Text 4,5:1 (WCAG 1.4.3)', 'Fassung vom 27.07.2026', 'Version 5.0, Stand 2026', "version: 'ERP-Release vom 08.12.2026'", 'ab 2.12.2027', 'Version 001.002'];
    for (const z of keine) expect(findeVersion(z, '1.0.0-test.3'), z).toBeNull();
    // Gegenprobe: Handeintrag 1.1.0 in einer neuen Datei bricht das Tor
    const b = await pruefeVersion({}, basis({ dateien: [{ pfad: 'src/app/neu.ts', text: "const version = '1.1.0';" }] }));
    expect(b.filter((x) => x.meldung.includes('handgepflegte Version')).map((x) => [x.datei, x.schwere])).toEqual([['src/app/neu.ts', 'fehler']]);
  });

  it('gebauter Skill mit anderer Version bricht im Release', async () => {
    expect(await fehler({ release: true, skill: '---\nmetadata:\n  version: "1.0.0-test.4"\n---' })).toEqual([]);
    expect(await fehler({ release: true, skill: '---\nmetadata:\n  version: "1.0.0"\n---' })).toEqual(['Skill nennt Version 1.0.0 statt 1.0.0-test.4 (scripts/skill.mts setzt {{version}} ein)']);
  });
});

describe('AF-178 Release-Tor: package.json, Tag, Changelog-Kopf, START', () => {
  it('alles stimmig: keine Fehler', async () => {
    expect(await fehler({})).toEqual([]);
    expect(await fehler({ release: true, tag: 'v1.0.0-test.4' })).toEqual([]);
  });

  it('package.json 1.0.0 bei Changelog-Kopf 1.0.0-test.x ist ein Fehler (SemVer)', async () => {
    expect(vergleiche('1.0.0', '1.0.0-test.4')).toBeGreaterThan(0);
    expect(vergleiche('1.0.0-test.10', '1.0.0-test.4')).toBeGreaterThan(0);
    expect(vergleiche('1.0.0-rc.12', '1.0.0-test.1')).toBeLessThan(0);
    const f = await fehler({ paketVersion: '1.0.0' });
    expect(f.some((m) => m.includes('1.0.0 weicht vom obersten Changelog-Eintrag 1.0.0-test.4 ab') && m.includes('höher als jede Vorabversion'))).toBe(true);
  });

  it('Gegenprobe mit falschem Tag bricht', async () => {
    expect((await fehler({ tag: 'v1.0.0-test.3' })).some((m) => m.includes('Release-Tag v1.0.0-test.3 passt nicht'))).toBe(true);
    expect((await fehler({ tags: ['v1.0.0-test.3', 'v1.0.0-test.4', 'v1.0.0-test.5'] })).some((m) => m.includes('Tag v1.0.0-test.5'))).toBe(true);
  });

  it('gebautes START, Kit-Ordner und Werkzeug mit anderer Version brechen im Release', async () => {
    expect(startVersionAus(START('1.0.0-test.4'))).toBe('1.0.0-test.4');
    expect(appVersionAus('<script type="application/json" id="daten-app">{"version":"1.0.0-test.4","lizenzen":[{"version":"10.29.8"}]}</script>')).toBe('1.0.0-test.4');
    const f = await fehler({ release: true, start: START('1.0.0'), appVersion: '1.0.0', kitOrdner: 'KMU-CIO_ISO42001-Starter-Kit_v1.0.0' });
    expect(f.filter((m) => /START\.html nennt Version 1\.0\.0 |AIMS-Manager meldet Version 1\.0\.0 |Kit-Ordner/.test(m))).toHaveLength(3);
    // Ausserhalb des Releases ist ein veralteter Bau nur eine Warnung
    expect(await fehler({ start: START('1.0.0') })).toEqual([]);
    expect(await fehler({ release: true, start: null })).toContain('Kit nicht gebaut (npm run build:kit): START.html nicht verglichen');
  });

  it('Lockfile mit anderer Version des Wurzelpakets ist ein Fehler', async () => {
    const lock = JSON.stringify({ version: '1.0.0', packages: { '': { version: '1.0.0-test.4' } } });
    expect(await fehler({ lock })).toEqual(['version ist 1.0.0 statt 1.0.0-test.4 (npm install --package-lock-only)']);
  });

  it('das Repo selbst: package.json, Lockfile, Changelog und Tags stimmen (Fehler 0)', async () => {
    const b = await pruefeVersion({}, { release: false, start: null, appVersion: null, dateien: [] });
    expect(b.filter((x) => x.schwere === 'fehler')).toEqual([]);
  });
});

describe('AF-179 und AF-007 Changelog nach festem Muster', () => {
  it('«Unveröffentlicht» zuoberst, ISO-Datum, Änderungsart je Aufzählung', async () => {
    expect((await fehler({ changelog: CHANGELOG_OK.replace('## [Unveröffentlicht]\n', '') })).some((m) => m.includes('Unveröffentlicht'))).toBe(true);
    expect((await fehler({ changelog: CHANGELOG_OK.replace('- 2026-11-03', '03.11.2026') })).some((m) => m.includes('ISO-Format'))).toBe(true);
    expect((await fehler({ changelog: CHANGELOG_OK.replace('### Behoben\n', '') })).some((m) => m.includes('ohne Änderungsart'))).toBe(true);
    expect((await fehler({ changelog: CHANGELOG_OK.replace('### Behoben', '### Korrigiert') })).some((m) => m.includes('«### Korrigiert» ist keine Änderungsart'))).toBe(true);
  });

  it('Tags ohne Eintrag und Einträge ohne Tag: je 0', async () => {
    expect((await fehler({ tags: ['v1.0.0-test.2', 'v1.0.0-test.3', 'v1.0.0-test.4'] })).some((m) => m.includes('Tag v1.0.0-test.2 ohne Changelog-Eintrag'))).toBe(true);
    expect((await fehler({ tags: ['v1.0.0-test.4'] })).some((m) => m.includes('Eintrag 1.0.0-test.3 ohne Tag'))).toBe(true);
    // Der neue Eintrag darf vor dem Taggen ohne Tag sein, im Release nicht
    expect(await fehler({ tags: ['v1.0.0-test.3'] })).toEqual([]);
    expect((await fehler({ tags: ['v1.0.0-test.3'], release: true })).some((m) => m.includes('Eintrag 1.0.0-test.4 ohne Tag'))).toBe(true);
  });

  it('ab 1.0.0-test.4 hat jeder Release den Abschnitt «Für Anwender»', async () => {
    const ohne = CHANGELOG_OK.replace('## [1.0.0-test.4] - 2026-11-20\n\n### Für Anwender\n- Projektdateien bleiben gültig\n', '## [1.0.0-test.4] - 2026-11-20\n');
    expect((await fehler({ changelog: ohne })).some((m) => m.includes('Release 1.0.0-test.4 ohne Abschnitt «### Für Anwender»'))).toBe(true);
    // test.3 und älter brauchen ihn nicht
    expect((await fehler({})).some((m) => m.includes('1.0.0-test.3 ohne Abschnitt'))).toBe(false);
  });

  it('CHANGELOG.md des Repos: ein Eintrag je Tag, alle mit Änderungsart und ISO-Datum', () => {
    const a = zerlegeChangelog(lies('CHANGELOG.md'));
    expect(a[0]!.version).toBe('Unveröffentlicht');
    const v = a.slice(1);
    // ab 1.0.0-test.4 mit «Für Anwender» (AF-007)
    expect(v[0]!.arten).toContain('Für Anwender');
    expect(v.map((x) => x.version)).toEqual(['1.0.0']);
    for (const x of v) {
      expect(x.datum, x.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(x.arten.length, x.version).toBeGreaterThan(0);
      expect([x.ohneArt, x.fremdeArten], x.version).toEqual([[], []]);
    }
    expect(lies('CONTRIBUTING.md')).toMatch(/## Versionen und Release[\s\S]*test\.N[\s\S]*PATCH[\s\S]*MINOR[\s\S]*MAJOR/);
  });
});

describe('AF-116 Release-Tor Rechtsstand (G37)', () => {
  const frisch: RechtsstandQuelle = { geprueft_am: '2026-11-07', hinweise: [{ id: 'a', status: 'zu_pruefen', geprueft_am: '2026-11-07' }, { id: 'b', status: 'rechtstext' }] };

  it('grün bei Sichtung innerhalb von 30 Tagen', () => {
    expect(rechtsstandTor(frisch, '2026-12-07')).toEqual([]);
  });

  it('rot, wenn eine Sichtung älter als 30 Tage ist (Gegenprobe 31 Tage)', () => {
    expect(rechtsstandTor(frisch, '2026-12-08').map((b) => [b.id, b.art])).toEqual([['gesamt', 'alt'], ['a', 'alt']]);
  });

  it('rot, wenn zu_pruefen ohne Sichtungsdatum steht, auch ausserhalb des Releases', async () => {
    const ohne: RechtsstandQuelle = { geprueft_am: '2026-11-07', hinweise: [{ id: 'a', status: 'zu_pruefen' }] };
    expect(rechtsstandTor(ohne, '2026-11-07').map((b) => b.art)).toEqual(['fehlt']);
    const b = await pruefeRechtsstand({}, { stand: ohne, stichtag: '2026-11-07', release: false });
    expect(b.map((x) => x.schwere)).toEqual(['fehler']);
  });

  it('Alter ausserhalb des Releases als Warnung, im Release als Fehler; Datum in der Zukunft immer Fehler', async () => {
    expect((await pruefeRechtsstand({}, { stand: frisch, stichtag: '2026-12-08', release: false })).map((x) => x.schwere)).toEqual(['warnung', 'warnung']);
    expect((await pruefeRechtsstand({}, { stand: frisch, stichtag: '2026-12-08', release: true })).map((x) => x.schwere)).toEqual(['fehler', 'fehler']);
    expect(rechtsstandTor(frisch, '2026-11-06').map((b) => b.art)).toEqual(['zukunft', 'zukunft']);
  });

  it('src/ai-act/stand.yaml: grün am 07.11.2026, rot 31 Tage danach', async () => {
    expect(await pruefeRechtsstand({}, { stichtag: '2026-11-07', release: true })).toEqual([]);
    expect((await pruefeRechtsstand({}, { stichtag: '2026-12-08', release: true })).length).toBeGreaterThan(0);
  });
});

describe('AF-117 Hinweis im Werkzeug bei altem Rechtsstand (feste Uhr)', () => {
  const stand: RechtsstandQuelle = { geprueft_am: '2026-11-07', hinweise: [{ id: 'leitlinien-kommission', status: 'zu_pruefen', geprueft_am: '2026-11-07' }] };

  it('frisch: kein Hinweis; genau 6 Monate: noch kein Hinweis', () => {
    expect(rechtsstandWarnung(stand, '2026-11-07')).toBeNull();
    expect(minusMonate('2027-05-07', 6)).toBe('2026-11-07');
    expect(rechtsstandWarnung(stand, '2027-05-07')).toBeNull();
    expect(minusMonate('2027-08-31', 6)).toBe('2027-02-28');
  });

  it('alt: älter als 6 Monate', () => {
    expect(rechtsstandWarnung(stand, '2027-05-08')).toEqual({ alt: true, geprueft: '2026-11-07', zuPruefen: ['leitlinien-kommission'] });
  });

  it('zu_pruefen ohne Sichtung warnt auch bei frischem Gesamtstand', () => {
    const s: RechtsstandQuelle = { geprueft_am: '2026-11-07', hinweise: [{ id: 'schweiz-regulierung', status: 'zu_pruefen' }, { id: 'x', status: 'auslegung' }] };
    expect(sichtungen(s).map((x) => x.id)).toEqual(['gesamt', 'schweiz-regulierung']);
    expect(rechtsstandWarnung(s, '2026-11-08')).toEqual({ alt: false, geprueft: '2026-11-07', zuPruefen: ['schweiz-regulierung'] });
  });

  it('der Rahmen zeigt den Hinweis in DE und EN, sonst nichts', async () => {
    const { setzeAppDaten } = await import('../../src/app/daten.ts');
    setzeAppDaten({ texte: { de: ladeTexte('de'), en: ladeTexte('en') }, kataloge: ladeKataloge(), gefuehrt: JSON.parse(lies('src/generiert/gefuehrt.json')), regeln: { regeln: [] }, version: KIT_VERSION, gebaut: '', beispiele: [] });
    const { RechtsstandHinweis } = await import('../../src/app/rahmen/Rahmen.tsx');
    const { uiSprache } = await import('../../src/app/i18n.ts');
    type Knoten = { props?: { children?: unknown; id?: string; role?: string } } | string | null | undefined | false;
    const text = (k: unknown): string => (Array.isArray(k) ? k.map(text).join('') : typeof k === 'string' ? k : k && typeof k === 'object' ? text((k as Exclude<Knoten, string | null | undefined | false>).props?.children) : '');
    // Stand des Kits ist frisch: kein Hinweis
    expect(RechtsstandHinweis({ heute: '2026-11-07' })).toBeNull();
    uiSprache.value = 'de';
    const de = RechtsstandHinweis({ heute: '2027-06-01' }) as { props: { id: string; role: string } };
    expect(de.props.id).toBe('rechtsstand-warnung');
    expect(de.props.role).toBe('status');
    expect(text(de)).toContain('zuletzt am 07.11.2026 geprüft, vor mehr als sechs Monaten');
    expect(text(de)).toContain('Leitlinien der Kommission');
    uiSprache.value = 'en';
    expect(text(RechtsstandHinweis({ heute: '2027-06-01' }))).toContain('last checked on 07/11/2026, more than six months ago');
    uiSprache.value = 'de';
  });
});

describe('AF-119 Seite «Was das Kit nicht entscheidet»', () => {
  const offen = standDatei.hinweise.filter((h) => h.status === 'zu_pruefen' || h.status === 'auslegung').map((h) => h.id);

  for (const [sprache, titel, verweis] of [['de', '## H Was das Kit nicht entscheidet', 'Rechtsberatung'], ['en', '## H What the kit does not decide', 'legal adviser']] as const) {
    it(`${sprache}: jede offene Rechtsfrage aus stand.yaml als Frage ohne Antwort, mit Verweis an Legal`, () => {
      const md = lies(`src/leitfaden/${sprache}/11-anhang.md`);
      expect(md).toContain(titel);
      const abschnitt = md.slice(md.indexOf(titel));
      expect(abschnitt).toContain(verweis);
      const fragen = [...abschnitt.matchAll(/^\d+\. (.*?) <!-- frage: ([a-z0-9-]+) -->$/gm)];
      expect(fragen.map((f) => f[2]).sort()).toEqual([...offen].sort());
      for (const f of fragen) expect(f[1], f[2]).toMatch(/\?$/);
    });
  }
});

describe('AF-120 Rechtsangaben nach R1 bis R4, R7 bis R10, R15', () => {
  const h = (id: string) => standDatei.hinweise.find((x) => x.id === id)!;

  it('R4, R15, R2, R7, R8: Sichtung 07.11.2026, zu_pruefen ohne Sichtungsdatum 0', () => {
    expect(standDatei.geprueft_am).toBe('2026-11-07');
    expect(standDatei.hinweise.filter((x) => x.status === 'zu_pruefen' && !x.geprueft_am)).toEqual([]);
    for (const id of ['normen-en-18286', 'leitlinien-kommission', 'schweiz-regulierung']) expect(h(id).geprueft_am, id).toBe('2026-11-07');
    // R5 bleibt bei der Fachperson: Status unverändert
    expect(h('normen-en-18286').status).toBe('zu_pruefen');
    const l = h('leitlinien-kommission').leitlinien!;
    expect(l.find((x) => x.artikel === '50')).toMatchObject({ status: 'angenommen', belegt: '2026-11-07' });
    expect(l.filter((x) => x.artikel !== '50').every((x) => x.status === 'entwurf' && x.url?.startsWith('https://digital-strategy.ec.europa.eu/'))).toBe(true);
  });

  it('R9: Interpellation 26.3414 mit Link und Abrufdatum, Satz zu Pflichten für Private (DE und EN)', () => {
    expect(h('schweiz-regulierung').interpellation).toMatchObject({ nummer: '26.3414', stellungnahme: '2026-05-20', abgerufen: '2026-11-07' });
    expect(h('schweiz-regulierung').interpellation!.url).toContain('AffairId=20263414');
    const de = ladeTexte('de') as { stand: { hinweise: Record<string, { text: string }> } };
    const en = ladeTexte('en') as { stand: { hinweise: Record<string, { text: string }> } };
    expect(de.stand.hinweise['schweiz-regulierung']!.text).toMatch(/26\.3414[\s\S]*Pflichten für Private[\s\S]*Frühjahr 2027[\s\S]*am 07\.11\.2026 nicht/);
    expect(en.stand.hinweise['schweiz-regulierung']!.text).toMatch(/26\.3414[\s\S]*obligations for private parties[\s\S]*spring 2027[\s\S]*as of 07\/11\/2026/);
  });

  it('R1, R3, R10: Daten statt «Kanzleiberichte», Titel ISO/IEC 27090, Art. 41 datiert', () => {
    for (const s of ['de', 'en']) {
      for (const d of ['E-07', 'E-09']) {
        const t = lies(`src/i18n/${s}/vorlagen/${d}.yaml`);
        expect(t, `${s} ${d}`).not.toMatch(/Kanzleibericht|law firm report/);
        expect(t, `${s} ${d}`).toMatch(/10[./]06[./]2026[\s\S]*08[./]07[./]2026[\s\S]*09[./]07[./]2026/);
        expect(t, `${s} ${d}`).not.toMatch(/Konformitätsvermutung[^.]*Praxisleitfaden|presumption[^.]*code of practice/i);
      }
      expect(lies(`src/i18n/${s}/vorlagen/E-09.yaml`)).toMatch(/Art\. 41[^.]*07[./]11[./]2026/);
      expect(lies(`src/leitfaden/${s}/07-rolle-zuerst-ai-act.md`)).toMatch(/Art\. 41[^.]*07[./]11[./]2026/);
      expect(lies(`src/leitfaden/${s}/11-anhang.md`)).toContain('Artificial intelligence (AI), Addressing security threats and compromises to AI systems');
    }
  });

  it('B4-01: Kreis der Betreiber mit Grundrechte-Folgenabschätzung nach Art. 27(1) wie E-06 (Fassung 27.07.2026), DE und EN', () => {
    const de = lies('src/i18n/de/gefuehrt/E7.yaml').split('\nE7-fria:')[1]!.split('\n  fehler:')[0]!;
    const en = lies('src/i18n/en/gefuehrt/E7.yaml').split('\nE7-fria:')[1]!.split('\n  fehler:')[0]!;
    // Ausnahme kritische Infrastruktur, Kreditwürdigkeit und nur Lebens- und Krankenversicherung, Fundstelle Art. 27(1)
    expect(de).toMatch(/Anhang III Nr\. 2[\s\S]*Kreditwürdigkeit natürlicher Personen[\s\S]*Lebens- und Krankenversicherung[\s\S]*Anhang III Nr\. 5 Bst\. b und c[\s\S]*Art\. 27\(1\)/);
    expect(en).toMatch(/Annex III, point 2[\s\S]*creditworthiness of natural persons[\s\S]*life and health insurance[\s\S]*Annex III, point 5\(b\) and \(c\)[\s\S]*Art\. 27\(1\)/);
    for (const t of [de, en]) expect(t).not.toMatch(/Versicherungsrisiken|insurance risks/);
  });

  it('B4-02: Aussage zu ISO/IEC 42001 und Qualitätsmanagement als Einschätzung des Kits, ohne Zuschreibung an die Kommission', () => {
    const de = lies('src/leitfaden/de/07-rolle-zuerst-ai-act.md');
    const en = lies('src/leitfaden/en/07-rolle-zuerst-ai-act.md');
    expect(de).not.toMatch(/Kommission hält in ihren Fragen und Antworten/);
    expect(en).not.toMatch(/Commission also states in its questions and answers/);
    expect(de).toMatch(/Nach unserer Einschätzung sind Ziele und Begriffe von ISO\/IEC 42001 nicht auf das Qualitätsmanagement nach dem AI Act ausgerichtet/);
    expect(en).toMatch(/In our assessment, the objectives and definitions of ISO\/IEC 42001 are not aligned with the quality management system under the AI Act/);
  });
});

describe('AF-115 Fristen nach R18', () => {
  it('Fristen ab 02.08.2026 und 02.12.2026 bestätigt, Art. 57(1) ergänzt', () => {
    const f = (id: string) => standDatei.fristen.find((x) => x.id === id)!;
    expect([f('FRIST-07'), f('FRIST-08'), f('FRIST-09')].map((x) => [x.datum, x.artikel])).toEqual([['2026-08-02', '113(2)'], ['2026-12-02', '113(3)(a)'], ['2026-12-02', '111(4)']]);
    expect(f('FRIST-19')).toMatchObject({ datum: '2027-08-02', artikel: '57(1)' });
    for (const s of ['de', 'en'] as const) expect((ladeTexte(s) as { stand: { fristen: Record<string, string> } }).stand.fristen['FRIST-19'], s).toMatch(/57\(1\)/);
  });

  it('E-02 weist Betreiber generativer Bild- und Videowerkzeuge auf die Verbote ab 02.12.2026 hin (DE und EN)', () => {
    expect(lies('src/i18n/de/vorlagen/E-02.yaml')).toMatch(/Betreiber generativer Bild- und Videowerkzeuge: Ab \{frist:FRIST-08\}[^"]*Bst\. ba und bb/);
    expect(lies('src/i18n/en/vorlagen/E-02.yaml')).toMatch(/deployers of generative image and video tools: from \{frist:FRIST-08\}[^"]*points \(ba\) and \(bb\)/);
  });
});
