// Mess- und Prüfprozess (P6): Tor G33 Erwartungen (AF-060, sperrt auch das Absenken der Abdeckungsbasis, AF-047),
// Rot-Grün-Skript (AF-058) und Begründungsdatei.
// Je Tor: Gegenprobe bricht. Die Git-Läufe geschehen in einem vorübergehenden Repository unter $TMPDIR.
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  type Aenderung,
  BASIS_DATEI,
  basisAbsenkungen,
  bewerte,
  inMehrzeiligerErwartung,
  neueBegruendungen,
  nennt,
  parseDiff,
  pruefe,
  sammle,
  tragend,
  vergleichsCommit,
  vermerkeAus,
} from '../../scripts/pruefen/erwartungen.mts';
import { REPO } from '../../scripts/pruefen/gemeinsam.mts';

const lies = (p: string) => readFileSync(join(REPO, p), 'utf8');

// ---------- Hilfen für das vorübergehende Repository ----------
const aufraeumen: string[] = [];
afterAll(() => {
  for (const d of aufraeumen) rmSync(d, { recursive: true, force: true });
});
function git(dir: string, ...args: string[]): string {
  return execFileSync('git', ['-C', dir, '-c', 'user.name=T', '-c', 'user.email=t@example.org', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' });
}
function neuesRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'erwartungen-'));
  aufraeumen.push(dir);
  git(dir, 'init', '-q', '-b', 'main');
  return dir;
}
function schreibe(dir: string, pfad: string, inhalt: string | Buffer): void {
  mkdirSync(dirname(join(dir, pfad)), { recursive: true });
  writeFileSync(join(dir, pfad), inhalt);
}
function einchecken(dir: string, nachricht: string): string {
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', nachricht);
  return git(dir, 'rev-parse', 'HEAD').trim();
}
const basis = (lines: number) => `${JSON.stringify({ stand: 'x', gesamt: { lines, statements: 60, functions: 60, branches: 50 } }, null, 2)}\n`;
const meldungen = async (dir: string, argv: string[] = []) => (await pruefe({}, ['node', 'x', ...argv], {}, dir)).map((b) => b.meldung);

describe('G33 Basis der Abdeckungsratsche gesperrt (AF-060, N1 aus P3)', () => {
  it('Absenken der Kennzahl wird erkannt, gleich und höher nicht', () => {
    expect(basisAbsenkungen(basis(62.8), basis(62.8))).toEqual([]);
    expect(basisAbsenkungen(basis(62.8), basis(70))).toEqual([]);
    expect(basisAbsenkungen(basis(62.8), basis(62.79))).toEqual(['lines: 62.8 % auf 62.79 %']);
    expect(basisAbsenkungen(basis(62.8), null)).toHaveLength(1);
    expect(basisAbsenkungen(null, basis(10))).toEqual([]);
  });
  it('Gegenprobe «Basis gesenkt bricht»: gesenkte Basis ohne Vermerk ergibt einen Fehler', () => {
    const a = sammle({ namensstatus: '', diff: '', basisAlt: basis(62.8), basisNeu: basis(50) });
    expect(a).toHaveLength(1);
    const b = bewerte(a, []);
    expect(b).toHaveLength(1);
    expect(b[0]!.meldung).toContain('Abdeckungsbasis abgesenkt ohne Vermerk');
  });
  it('mit Vermerk «Erwartung geändert: Grund» besteht sie', () => {
    const a = sammle({ namensstatus: '', diff: '', basisAlt: basis(62.8), basisNeu: basis(50) });
    expect(bewerte(a, vermerkeAus(['Titel\n\nErwartung geändert: Quelldateien ohne Test eingeführt, Abdeckungsbasis neu gemessen']))).toEqual([]);
  });
  it('Echtlauf im Git: gesenkte Basis bricht, mit Vermerk im Commit und in der Begründungsdatei besteht sie', async () => {
    const dir = neuesRepo();
    schreibe(dir, BASIS_DATEI, basis(62.8));
    const vor = einchecken(dir, 'Start');
    schreibe(dir, BASIS_DATEI, basis(40));
    // nicht committet (Arbeitsbaum gegen HEAD)
    expect((await meldungen(dir)).join('\n')).toContain('Abdeckungsbasis abgesenkt ohne Vermerk');
    // committet ohne Vermerk, Vorgänger als Vergleich
    einchecken(dir, 'Basis gesenkt');
    expect((await meldungen(dir, ['--basis', vor])).join('\n')).toContain('Abdeckungsbasis abgesenkt ohne Vermerk');
    expect((await meldungen(dir)).join('\n')).toContain('Abdeckungsbasis abgesenkt ohne Vermerk'); // sauberer Baum: HEAD~1
    // Senkung im vorletzten Commit, sauberer Baum (Vergleich HEAD~1 sähe sie nicht): die Geschichte der Basisdatei bricht trotzdem,
    // und ein Vermerk in einem späteren Commit heilt sie nicht (er gehört in den Commit, der senkt)
    schreibe(dir, 'x.txt', '1');
    einchecken(dir, 'Weiteres\n\nErwartung geändert: Abdeckungsbasis nach Umbau der Quelldateien neu gemessen');
    expect((await meldungen(dir, ['--basis', 'HEAD~1'])).join('\n')).toContain('Abdeckungsbasis abgesenkt ohne Vermerk');
    expect((await meldungen(dir)).join('\n')).toContain('Abdeckungsbasis abgesenkt ohne Vermerk');
    // Vermerk in der Nachricht des senkenden Commits
    const dir3 = neuesRepo();
    schreibe(dir3, BASIS_DATEI, basis(62.8));
    const v3 = einchecken(dir3, 'Start');
    schreibe(dir3, BASIS_DATEI, basis(40));
    einchecken(dir3, 'Basis gesenkt\n\nErwartung geändert: Abdeckungsbasis nach Umbau der Quelldateien neu gemessen');
    expect(await meldungen(dir3, ['--basis', v3])).toEqual([]);
    expect(await meldungen(dir3)).toEqual([]);
    // Vermerk nur in der Begründungsdatei
    const dir2 = neuesRepo();
    schreibe(dir2, BASIS_DATEI, basis(62.8));
    const v2 = einchecken(dir2, 'Start');
    schreibe(dir2, BASIS_DATEI, basis(40));
    schreibe(dir2, 'docs/entwicklung/erwartungen-begruendung.md', 'Erwartung geändert: Abdeckungsbasis nach Umbau der Quelldateien neu gemessen\n');
    einchecken(dir2, 'Basis gesenkt');
    expect(await meldungen(dir2, ['--basis', v2])).toEqual([]);
  });
  it('Begründungsdatei zählt auch ungetrackt; bereits im Vergleichs-Commit stehende Zeilen tragen nicht', async () => {
    const dir = neuesRepo();
    const alteZeile = 'Erwartung geändert: alter Eintrag aus einer früheren Runde mit genug Wörtern\n';
    schreibe(dir, BASIS_DATEI, basis(62.8));
    schreibe(dir, 'docs/entwicklung/erwartungen-begruendung.md', alteZeile);
    einchecken(dir, 'Start');
    schreibe(dir, BASIS_DATEI, basis(40));
    // nur die alte Zeile: trägt nicht
    expect((await meldungen(dir)).join('\n')).toContain('ohne Vermerk');
    // neue Zeile, Datei getrackt und geändert
    schreibe(dir, 'docs/entwicklung/erwartungen-begruendung.md', `${alteZeile}Erwartung geändert: Abdeckungsbasis nach Umbau der Quelldateien neu gemessen\n`);
    expect(await meldungen(dir)).toEqual([]);
  });
  it('Gegenprobe «fremder Vermerk deckt kein Absenken»: Vermerk zu einer anderen Datei lässt die Basis nicht durch', async () => {
    const a = sammle({ namensstatus: '', diff: '', basisAlt: basis(62.8), basisNeu: basis(50) });
    const fremd = vermerkeAus(['Erwartung geändert: tests/unit/pruefen-alle.test.ts erwartet zusätzlich das neue Tor G33, AF-060']);
    const b = bewerte(a, fremd);
    expect(b).toHaveLength(1);
    expect(b[0]!.meldung).toContain('Abdeckungsbasis oder Abdeckung nennt');
    expect(bewerte(a, [...fremd, 'Abdeckung nach Umbau der Quelldateien neu gemessen, Basis gesenkt'])).toEqual([]);
    // Echtlauf: fremder Vermerk in der Begründungsdatei
    const dir = neuesRepo();
    schreibe(dir, BASIS_DATEI, basis(62.8));
    einchecken(dir, 'Start');
    schreibe(dir, BASIS_DATEI, basis(40));
    schreibe(dir, 'docs/entwicklung/erwartungen-begruendung.md', 'Erwartung geändert: tests/unit/pruefen-alle.test.ts erwartet zusätzlich das neue Tor G33, AF-060\n');
    expect((await meldungen(dir)).join('\n')).toContain('Abdeckungsbasis oder Abdeckung nennt');
  });
  it('«Merge-Basis» oder ein anderes Wort mit «Basis» deckt das Absenken nicht; Abdeckungsbasis, abdeckung-basis und Abdeckung schon', () => {
    const a = sammle({ namensstatus: '', diff: '', basisAlt: basis(62.8), basisNeu: basis(50) });
    for (const g of ['Vergleich gegen die Merge-Basis zu origin/main angepasst, AF-060', 'Basis der Tests neu aufgebaut, Basisklasse umbenannt, AF-060', 'Basiswert in der Fixture geändert und neu erzeugt, AF-060']) {
      expect(bewerte(a, [g]), g).toHaveLength(1);
    }
    for (const g of ['Die Abdeckungsbasis wurde nach dem Umbau neu gemessen', 'tests/abdeckung-basis.json nach Umbau der Quelldateien neu gemessen', 'Abdeckung nach dem Umbau der Quelldateien neu gemessen']) {
      expect(bewerte(a, [g]), g).toEqual([]);
    }
  });
  it('Begründungsdatei: eine bearbeitete alte Zeile zählt nicht als neu, eine angehängte schon', () => {
    const alt = 'Titel\nErwartung geändert: tests/unit/a.test.ts erwartet jetzt zwei Werte statt einem, AF-001\n';
    expect(neueBegruendungen(alt, alt)).toEqual([]);
    expect(neueBegruendungen(alt.replace('AF-001', 'AF-001 und AF-002 nachträglich'), alt)).toEqual([]);
    expect(neueBegruendungen(`${alt}Erwartung geändert: tests/unit/b.test.ts erwartet drei Werte, AF-003\n`, alt)).toEqual(['Erwartung geändert: tests/unit/b.test.ts erwartet drei Werte, AF-003']);
  });
  it('Begründungsdatei: zwei Vermerke zur selben Datei mit gleichem Anfang zählen beide, eine leicht bearbeitete alte Zeile nicht', () => {
    const anfang = 'Erwartung geändert: tests/unit/pruefen-alle.test.ts erwartet zusätzlich die neuen Tore';
    const a1 = `${anfang} G33, AF-060`;
    const a2 = `${anfang} G36 und G37, AF-178`;
    const a3 = `${anfang} G38 und G39, AF-200`;
    expect(neueBegruendungen(`${a1}\n${a2}\n`, `${a1}\n`)).toEqual([a2]);
    expect(neueBegruendungen(`${a1}\n${a2}\n${a3}\n`, `${a1}\n`)).toEqual([a2, a3]);
    // leicht bearbeitete alte Zeile (ein Wort ersetzt) zählt nicht als neu, ein gleichzeitig angehängter zweiter Vermerk schon
    expect(neueBegruendungen(`${a1.replace('zusätzlich', 'ausserdem')}\n`, `${a1}\n`)).toEqual([]);
    expect(neueBegruendungen(`${a1.replace('zusätzlich', 'ausserdem')}\n${a2}\n`, `${a1}\n`)).toEqual([a2]);
  });
  it('Anheben der Basis braucht keinen Vermerk', async () => {
    const dir = neuesRepo();
    schreibe(dir, BASIS_DATEI, basis(62.8));
    einchecken(dir, 'Start');
    schreibe(dir, BASIS_DATEI, basis(70));
    expect(await meldungen(dir)).toEqual([]);
  });
});

describe('G33 Snapshots, Referenzbilder, Schwellen, Erwartungswerte', () => {
  const diff = (datei: string, entfernt: string[], hinzu: string[]) =>
    `diff --git a/${datei} b/${datei}\n--- a/${datei}\n+++ b/${datei}\n@@ -10,${entfernt.length} +10,${hinzu.length} @@\n${entfernt.map((x) => `-${x}`).join('\n')}\n${hinzu.map((x) => `+${x}`).join('\n')}\n`;
  const leer = { namensstatus: '', basisAlt: null, basisNeu: null };

  it('parseDiff liefert entfernte Zeilen mit alter Zeilennummer und hinzugefügte Zeilen', () => {
    const [d] = parseDiff(diff('tests/a.test.ts', ['  expect(a).toBe(1);', 'x'], ['  expect(a).toBe(2);']));
    expect(d!.datei).toBe('tests/a.test.ts');
    expect(d!.entfernt.map((x) => x.zeile)).toEqual([10, 11]);
    expect(d!.hinzu).toEqual(['  expect(a).toBe(2);']);
  });
  it('geänderte oder entfernte expect-Zeilen zählen, hinzugefügte nicht, verschobene nicht', () => {
    const geaendert = sammle({ ...leer, diff: diff('tests/unit/a.test.ts', ['  expect(a).toBe(1);'], ['  expect(a).toBe(2);']) });
    expect(geaendert.map((a) => a.klasse)).toEqual(['erwartungswert']);
    expect(sammle({ ...leer, diff: diff('tests/unit/a.test.ts', [], ['  expect(a).toBe(2);']) })).toEqual([]);
    expect(sammle({ ...leer, diff: diff('tests/unit/a.test.ts', ['  expect(a).toBe(1);'], ['    expect(a).toBe(1);']) })).toEqual([]);
    const entfernt = sammle({ ...leer, diff: diff('tests/unit/a.test.ts', ["it('prüft x', () => {"], []) });
    expect(entfernt.map((a) => a.klasse)).toEqual(['erwartungswert']);
  });
  it('Änderungen in Nicht-Testdateien und an Testdaten zählen nicht', () => {
    expect(sammle({ ...leer, diff: diff('src/x.ts', ['  expect(a).toBe(1);'], ['  expect(a).toBe(2);']) })).toEqual([]);
    expect(sammle({ ...leer, diff: diff('tests/fixtures/a.json', ['"a": 1'], ['"a": 2']) })).toEqual([]);
  });
  it('Schwellen: geänderte maxDiffPixelRatio, Mindestquote oder thresholds zählen als Schwelle', () => {
    const p = sammle({ ...leer, diff: diff('playwright.config.ts', ['  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },'], ['  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.05 } },']) });
    expect(p.map((a) => a.klasse)).toEqual(['schwelle']);
    const v = sammle({ ...leer, diff: diff('vitest.config.ts', ['      thresholds: { lines: 60 },'], ['      thresholds: { lines: 50 },']) });
    expect(v.map((a) => a.klasse)).toEqual(['schwelle']);
    const t = sammle({ ...leer, diff: diff('tests/unit/a.test.ts', ['const Mindestquote = 0.95;'], ['const Mindestquote = 0.5;']) });
    expect(t.map((a) => a.klasse)).toEqual(['schwelle']);
  });
  it('Snapshots: entfernte oder geänderte Zeilen zählen, neue Dateien nicht', () => {
    const s = sammle({ ...leer, diff: diff('tests/unit/__snapshots__/a.test.ts.snap', ['exports[`a`] = `1`;'], ['exports[`a`] = `2`;']) });
    expect(s.map((a) => a.klasse)).toEqual(['snapshot']);
    expect(sammle({ ...leer, diff: diff('tests/unit/__snapshots__/a.test.ts.snap', [], ['exports[`b`] = `2`;']) })).toEqual([]);
  });
  it('Referenzbilder: geändert oder gelöscht zählt, neu nicht; ohne Befund-ID im Vermerk bricht es', () => {
    const a = sammle({ ...leer, diff: '', namensstatus: 'M\ttests/e2e/app/__screenshots__/alpha.png\nD\ttests/e2e/app/__screenshots__/beta.png\nA\ttests/e2e/app/__screenshots__/gamma.png\nM\ttests/e2e/x.png\n' });
    expect(a.map((x) => x.datei)).toEqual(['tests/e2e/app/__screenshots__/alpha.png', 'tests/e2e/app/__screenshots__/beta.png']);
    const ohne = bewerte(a, vermerkeAus(['Erwartung geändert: Bilder neu erzeugt wegen anderer Schrift']));
    expect(ohne).toHaveLength(2);
    expect(ohne[0]!.meldung).toContain('Referenzbilder ohne Befund');
    // Befund-ID ohne Bildname deckt nicht, Bildname ohne Befund-ID deckt nicht
    expect(bewerte(a, vermerkeAus(['Erwartung geändert: Etappenleiste neu gestaltet, Befund D2-01 behoben']))).toHaveLength(2);
    expect(bewerte(a, vermerkeAus(['Erwartung geändert: Bilder alpha.png und beta.png neu erzeugt, sieht besser aus']))).toHaveLength(2);
    // Befund-ID und Bildname (mit Endung, ohne Endung, als Präfix mit Stern)
    expect(bewerte(a, vermerkeAus(['Erwartung geändert: Bilder alpha.png und beta.png neu, Etappenleiste, Befund D2-01 behoben']))).toEqual([]);
    expect(bewerte(a, vermerkeAus(['Erwartung geändert: Bilder nach AF-123 neu erzeugt, alpha und beta, Kontrast angehoben']))).toEqual([]);
    expect(bewerte(a, vermerkeAus(['Erwartung geändert: Bilder nach AF-123 neu erzeugt, Kontrast angehoben, alpha.png, xyz*']))).toHaveLength(1);
    expect(nennt('Bilder gefuehrt-* neu, AF-123', 'tests/e2e/app/__screenshots__/gefuehrt-de-hell-desktop.png', true)).toBe(true);
    expect(nennt('Bilder grafik-* neu, AF-123', 'tests/e2e/app/__screenshots__/gefuehrt-de-hell-desktop.png', true)).toBe(false);
  });
  it('Vermerke sind an ihre Datei gebunden: ein Vermerk zu einer anderen Datei deckt nicht', () => {
    const a: Aenderung[] = [{ klasse: 'erwartungswert', datei: 'tests/unit/runde1-abf.test.ts', zeile: 38, text: 'expect(x)' }];
    const fremd = vermerkeAus(['Erwartung geändert: tests/unit/start.test.ts erwartet den Platzhalter statt der festen Version, AF-177']);
    expect(bewerte(a, fremd)[0]!.meldung).toContain('die Datei nennt');
    expect(bewerte(a, [...fremd, 'runde1-abf.test.ts erwartet die Interpellation jetzt im Stand Schweiz, AF-120'])).toEqual([]);
    expect(bewerte(a, ['tests/unit/runde1-abf.test.ts erwartet die Interpellation jetzt im Stand Schweiz, AF-120'])).toEqual([]);
  });
  it('Hilfsdateien unter tests/, Spezifikation des Fuzz, Konfigurationsschalter und package.json zählen', () => {
    const klassen = (datei: string, entfernt: string[], hinzu: string[]) => sammle({ ...leer, diff: diff(datei, entfernt, hinzu) }).map((a) => a.klasse);
    expect(klassen('tests/unit/hilfe.ts', ['  expect(a).toBe(1);'], ['  expect(a).toBe(2);'])).toEqual(['erwartungswert']);
    expect(klassen('tests/unit/hilfe.ts', ['const MINDEST = 10;'], ['const MINDEST = 1;'])).toEqual(['schwelle']);
    expect(klassen('tests/fixtures/hilfe.ts', ['  expect(a).toBe(1);'], ['  expect(a).toBe(2);'])).toEqual([]);
    expect(klassen('tests/fuzz/spezifikation.ts', ['  zeitlimitMs: 5000,'], ['  zeitlimitMs: 50000,'])).toEqual(['erwartungswert']);
    expect(klassen('tests/fuzz/zaehlweise.ts', ['  zeitlimitMs: 5000,'], ['  zeitlimitMs: 50000,'])).toEqual([]);
    expect(klassen('vitest.config.ts', [], ['    updateSnapshots: true,'])).toEqual(['schwelle']);
    expect(klassen('playwright.config.ts', [], ["  updateSnapshots: 'all',"])).toEqual(['schwelle']);
    expect(klassen('package.json', [], ['    "test": "vitest run -u",'])).toEqual(['schwelle']);
    expect(klassen('package.json', [], ['    "test": "vitest run",'])).toEqual([]);
  });
  it('mehrzeilige Erwartungswerte: eine entfernte Zeile innerhalb von expect(...) zählt', () => {
    const alt = "it('a', () => {\n  expect(x).toEqual([\n    1,\n    2,\n    3,\n  ]);\n  const y = 1;\n});\n";
    expect(inMehrzeiligerErwartung(alt, 5)).toBe(true); // «3,»
    expect(inMehrzeiligerErwartung(alt, 7)).toBe(false); // «const y»
    const eingabe = { ...leer, diff: diff('tests/unit/a.test.ts', ['    3,'], []).replace('@@ -10,1', '@@ -5,1'), alt: () => alt };
    expect(sammle(eingabe).map((a) => a.klasse)).toEqual(['erwartungswert']);
    expect(sammle({ ...eingabe, alt: undefined })).toEqual([]); // ohne alten Stand nur zeilenweise
  });
  it('Gruppierung: viele Änderungen in einer Datei ergeben einen Befund mit Zahl', () => {
    const a: Aenderung[] = Array.from({ length: 5 }, (_, i) => ({ klasse: 'snapshot' as const, datei: 'tests/unit/__snapshots__/a.snap', zeile: i + 1, text: 'x' }));
    const b = bewerte(a, []);
    expect(b).toHaveLength(1);
    expect(b[0]!.meldung).toContain('und 4 weitere');
  });
  it('ohne Vermerk bricht jede Änderung einzeln, mit nicht tragendem Grund bricht es ebenfalls', () => {
    const a: Aenderung[] = [
      { klasse: 'snapshot', datei: 'tests/unit/__snapshots__/a.snap', zeile: 3, text: 'x' },
      { klasse: 'schwelle', datei: 'playwright.config.ts', zeile: 12, text: 'y' },
    ];
    expect(bewerte(a, [])).toHaveLength(2);
    expect(bewerte(a, vermerkeAus(['Erwartung geändert: angepasst']))[0]!.meldung).toContain('ohne tragenden Grund');
    expect(bewerte(a, vermerkeAus(['Erwartung geändert:']))).toHaveLength(2);
    expect(bewerte([], [])).toEqual([]);
  });
  it('Vermerke: nur Zeilen mit «Erwartung geändert:» am Zeilenanfang, Grund muss tragen', () => {
    expect(vermerkeAus(['Titel\n\n- Erwartung geändert: Skala von 4 auf 5 Stufen, Befund C2-04\nRest'])).toEqual(['Skala von 4 auf 5 Stufen, Befund C2-04']);
    expect(vermerkeAus(['Text Erwartung geändert: mitten in der Zeile ist kein Vermerk'])).toEqual([]);
    expect(tragend('angepasst')).toBe(false);
    expect(tragend('wegen Änderung')).toBe(false);
    expect(tragend('TBD TBD TBD TBD TBD TBD')).toBe(false);
    expect(tragend('Skala von 4 auf 5 Stufen erweitert, Befund C2-04')).toBe(true);
  });
  it('Echtlauf im Git: entfernte expect-Zeile bricht ohne Vermerk, besteht mit Vermerk im Commit', async () => {
    const dir = neuesRepo();
    schreibe(dir, 'tests/unit/a.test.ts', "it('a', () => {\n  expect(1).toBe(1);\n  expect(2).toBe(2);\n});\n");
    const vor = einchecken(dir, 'Start');
    schreibe(dir, 'tests/unit/a.test.ts', "it('a', () => {\n  expect(1).toBe(1);\n});\n");
    expect((await meldungen(dir)).join('\n')).toContain('Erwartung geändert oder entfernt ohne Vermerk');
    einchecken(dir, 'Test gekürzt\n\nErwartung geändert: a.test.ts ohne die doppelte Prüfung von 2, deckt Fall schon ab');
    expect(await meldungen(dir, ['--basis', vor])).toEqual([]);
    // Vermerk zu einer anderen Datei deckt nicht
    const dir2 = neuesRepo();
    schreibe(dir2, 'tests/unit/a.test.ts', "it('a', () => {\n  expect(1).toBe(1);\n  expect(2).toBe(2);\n});\n");
    const v2 = einchecken(dir2, 'Start');
    schreibe(dir2, 'tests/unit/a.test.ts', "it('a', () => {\n  expect(1).toBe(1);\n});\n");
    einchecken(dir2, 'Test gekürzt\n\nErwartung geändert: b.test.ts erwartet jetzt zwei Werte statt einem, AF-001');
    expect((await meldungen(dir2, ['--basis', v2])).join('\n')).toContain('die Datei nennt');
  });
  it('Echtlauf im Git: geändertes Referenzbild bricht ohne Befund-ID', async () => {
    const dir = neuesRepo();
    schreibe(dir, 'tests/e2e/app/__screenshots__/a.png', Buffer.from([1, 2, 3]));
    const vor = einchecken(dir, 'Start');
    schreibe(dir, 'tests/e2e/app/__screenshots__/a.png', Buffer.from([1, 2, 4]));
    einchecken(dir, 'Bild neu\n\nErwartung geändert: Bild neu erzeugt, sieht besser aus');
    expect((await meldungen(dir, ['--basis', vor])).join('\n')).toContain('Referenzbilder ohne Befund');
  });
});

describe('G33 Vergleichs-Commit', () => {
  const lesen = (antworten: Record<string, string | null>) => (args: string[]) => antworten[args.join(' ')] ?? null;
  it('--basis ist verbindlich, unlesbar ergibt einen Fehler statt stillem Grün', () => {
    expect(vergleichsCommit({}, ['--basis', 'abc'], lesen({ 'rev-parse --verify --quiet abc^{commit}': 'abc' }))).toEqual({ ref: 'abc' });
    expect(vergleichsCommit({}, ['--basis', 'abc'], lesen({}))?.fehler).toContain('fetch-depth');
  });
  it('Pull Request nimmt die Merge-Basis, ohne Vorgeschichte bricht es', () => {
    expect(vergleichsCommit({ GITHUB_BASE_REF: 'main' }, [], lesen({ 'merge-base HEAD origin/main': 'mb123\n' }))).toEqual({ ref: 'mb123' });
    expect(vergleichsCommit({ GITHUB_BASE_REF: 'main' }, [], lesen({}))?.fehler).toContain('Merge-Basis');
  });
  it('Push: Stand vor dem Push; neuer Zweig oder Force-Push: Merge-Basis zu origin/main mit Warnung, sonst Fehler; flacher Klon in CI bricht', () => {
    const sauber = { 'status --porcelain --untracked-files=no': '', 'rev-parse --verify --quiet HEAD~1^{commit}': 'h1' };
    expect(vergleichsCommit({ ERWARTUNGEN_BASIS: 'vor1' }, [], lesen({ ...sauber, 'rev-parse --verify --quiet vor1^{commit}': 'vor1' }))).toEqual({ ref: 'vor1' });
    const mitMain = { ...sauber, 'merge-base HEAD origin/main': 'mb999\n', 'rev-parse --verify --quiet HEAD^{commit}': 'kopf1\n' };
    const neuerZweig = vergleichsCommit({ ERWARTUNGEN_BASIS: '0000000000000000000000000000000000000000' }, [], lesen(mitMain));
    expect(neuerZweig?.ref).toBe('mb999');
    expect(neuerZweig?.warnung).toContain('neuer Zweig');
    expect(neuerZweig?.fehler).toBeUndefined();
    const force = vergleichsCommit({ ERWARTUNGEN_BASIS: 'weg123456789' }, [], lesen(mitMain));
    expect(force?.ref).toBe('mb999');
    expect(force?.warnung).toContain('Force-Push');
    // HEAD liegt selbst auf main (Force-Push auf main): nur der Vorgänger, mit Warnung
    const aufMain = vergleichsCommit({ ERWARTUNGEN_BASIS: 'weg123456789' }, [], lesen({ ...mitMain, 'merge-base HEAD origin/main': 'kopf1\n' }));
    expect(aufMain?.ref).toBe('HEAD~1');
    expect(aufMain?.warnung).toContain('Vorgänger');
    // HEAD ist der Wurzel-Commit auf main (neue Geschichte): kein Vergleich, kein Fehler; ohne Wurzelnachweis bleibt es ein Fehler
    const wurzel = { 'status --porcelain --untracked-files=no': '', 'merge-base HEAD origin/main': 'kopf1\n', 'rev-parse --verify --quiet HEAD^{commit}': 'kopf1\n' };
    expect(vergleichsCommit({ ERWARTUNGEN_BASIS: 'weg123456789' }, [], lesen({ ...wurzel, 'rev-list --max-parents=0 HEAD': 'kopf1\n' }))).toBeNull();
    expect(vergleichsCommit({ ERWARTUNGEN_BASIS: 'weg123456789' }, [], lesen(wurzel))?.fehler).toContain('kein Vergleichs-Commit');
    // origin/main nicht lesbar: Fehler statt stillem Rückfall
    const ohneMain = vergleichsCommit({ ERWARTUNGEN_BASIS: '0000000000' }, [], lesen(sauber));
    expect(ohneMain?.fehler).toContain('kein Vergleichs-Commit');
    expect(vergleichsCommit({ ERWARTUNGEN_BASIS: '0000000000', ERWARTUNGEN_STANDARDZWEIG: 'master' }, [], lesen({ ...mitMain, 'merge-base HEAD origin/master': 'mb1\n' }))?.ref).toBe('mb1');
    expect(vergleichsCommit({ CI: 'true' }, [], lesen({ 'status --porcelain --untracked-files=no': '' }))?.fehler).toContain('fetch-depth');
    expect(vergleichsCommit({}, [], lesen({ 'status --porcelain --untracked-files=no': '' }))).toBeNull();
  });
  it('geänderter Arbeitsbaum vergleicht gegen HEAD', () => {
    expect(vergleichsCommit({}, [], lesen({ 'status --porcelain --untracked-files=no': ' M a.ts\n' }))).toEqual({ ref: 'HEAD' });
  });
  it('das Tor ist in alle.mts und package.json eingehängt, CI holt die Vorgeschichte', () => {
    expect(lies('scripts/pruefen/alle.mts')).toContain("id: 'G33'");
    expect(JSON.parse(lies('package.json')).scripts['pruefen:erwartungen']).toContain('erwartungen.mts');
    expect(lies('.github/workflows/ci.yml')).toContain('fetch-depth: 0');
  });
});

describe('AF-058 rot-gruen.sh', () => {
  const skript = join(REPO, 'scripts/werkzeug/rot-gruen.sh');
  function lauf(dir: string, test: string, rot: string, gruen: string, extra: Record<string, string> = {}) {
    const r = spawnSync('bash', [skript, test, rot, gruen], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, TMPDIR: tmpdir(), RG_BEFEHL: 'sh', RG_VORBEREITUNG: '', ...extra },
    });
    return { code: r.status, aus: `${r.stdout}${r.stderr}` };
  }
  /** Repo mit drei Ständen: vorher (Test fehlt), nur Test (rot), Behebung (grün). */
  function repoMitBehebung() {
    const dir = neuesRepo();
    schreibe(dir, 'stand.txt', 'kaputt\n');
    const vorher = einchecken(dir, 'Start');
    schreibe(dir, 'pruefung.sh', 'grep -q repariert stand.txt\n');
    const nurTest = einchecken(dir, 'Test');
    schreibe(dir, 'stand.txt', 'repariert\n');
    const fix = einchecken(dir, 'Behebung');
    return { dir, vorher, nurTest, fix };
  }
  it('rot, dann grün ergibt Beleg gültig (Ausgangscode 0)', () => {
    const { dir, nurTest, fix } = repoMitBehebung();
    const r = lauf(dir, 'pruefung.sh', nurTest, fix);
    expect(r.code).toBe(0);
    expect(r.aus).toContain('ROT bestätigt');
    expect(r.aus.indexOf('ROT bestätigt')).toBeLessThan(r.aus.indexOf('GRÜN bestätigt'));
    expect(r.aus).toContain('Beleg gültig');
  });
  it('fehlt der Test im Rot-Commit, wird er aus dem Grün-Commit eingesetzt', () => {
    const { dir, vorher, nurTest, fix } = repoMitBehebung();
    expect(nurTest).not.toBe(fix);
    // Test und Behebung im selben Commit: Rot-Commit ist der Vorgänger ohne Testdatei
    const dir2 = neuesRepo();
    schreibe(dir2, 'stand.txt', 'kaputt\n');
    const v = einchecken(dir2, 'Start');
    schreibe(dir2, 'pruefung.sh', 'grep -q repariert stand.txt\n');
    schreibe(dir2, 'stand.txt', 'repariert\n');
    const g = einchecken(dir2, 'Test und Behebung');
    const r = lauf(dir2, 'pruefung.sh', v, g);
    expect(r.code).toBe(0);
    expect(r.aus).toContain('aus dem Grün-Commit übernommen');
    expect(vorher).toBeTruthy();
    expect(dir).toBeTruthy();
  });
  it('Gegenprobe: Test schon im Rot-Commit grün ergibt «KEIN BELEG» (Ausgangscode 1)', () => {
    const { dir, nurTest, fix } = repoMitBehebung();
    // Rot- und Grün-Commit vertauscht: auf dem Fix ist der Test grün, also nicht rot
    const r = lauf(dir, 'pruefung.sh', fix, nurTest);
    expect(r.code).toBe(1);
    expect(r.aus).toContain('KEIN BELEG');
  });
  it('Gegenprobe: Test im Grün-Commit rot ergibt Ausgangscode 2', () => {
    const { dir, vorher, nurTest } = repoMitBehebung();
    const r = lauf(dir, 'pruefung.sh', vorher, nurTest);
    expect(r.code).toBe(2);
    expect(r.aus).toContain('nicht grün');
  });
  it('falscher Aufruf, gleiche Commits oder unlesbarer Commit ergeben Ausgangscode 3', () => {
    const { dir, nurTest } = repoMitBehebung();
    expect(lauf(dir, 'pruefung.sh', nurTest, nurTest).code).toBe(3);
    expect(lauf(dir, 'pruefung.sh', nurTest, 'gibt-es-nicht').code).toBe(3);
    expect(spawnSync('bash', [skript], { cwd: dir, encoding: 'utf8' }).status).toBe(3);
  });
  it('Umgebungsfehler im Rot-Lauf (Befehl fehlt 127, nicht ausführbar 126, Signal 137) sind kein Rot: Ausgangscode 3, kein Beleg', () => {
    const { dir, nurTest, fix } = repoMitBehebung();
    for (const befehl of ['./gibt-es-nicht.sh', "sh -c 'exit 137' x", "sh -c 'exit 126' x"]) {
      const r = lauf(dir, 'pruefung.sh', nurTest, fix, { RG_BEFEHL: befehl });
      expect(r.code, befehl).toBe(3);
      expect(r.aus, befehl).toContain('UMGEBUNGSFEHLER im Rot-Lauf');
      expect(r.aus, befehl).not.toContain('Beleg gültig');
    }
  });
  it('der Testbefehl kommt aus dem eigenen Arbeitsbaum: ein Befehl, den der alte Stand nicht kennt, stört den Rot-Lauf nicht', () => {
    const { dir, nurTest, fix } = repoMitBehebung();
    // befehl.sh liegt nur im Arbeitsbaum des Aufrufers (nie eingecheckt), nicht im Rot- oder Grün-Commit
    schreibe(dir, 'befehl.sh', 'sh "$1"\n');
    const r = lauf(dir, 'pruefung.sh', nurTest, fix, { RG_BEFEHL: `sh ${join(dir, 'befehl.sh')}` });
    expect(r.code).toBe(0);
    expect(r.aus).toContain('Beleg gültig');
  });
  describe('Vitest-Bericht: rot nur bei gelaufenen und gescheiterten Tests oder Ladefehler', () => {
    // «Test» ist eine Datei: erste Zeile Ausgangscode, Rest der Bericht; fake.sh gibt ihn wie Vitest nach RG_JSON_DATEI aus
    function fake(): string {
      const d = mkdtempSync(join(tmpdir(), 'fake-'));
      aufraeumen.push(d);
      writeFileSync(join(d, 'fake.sh'), 'rc=$(head -1 "$1")\ntail -n +2 "$1" > "$RG_JSON_DATEI"\nexit "$rc"\n');
      return join(d, 'fake.sh');
    }
    const GESCHEITERT = '1\n{"numTotalTests":3,"numFailedTests":2,"testResults":[{"status":"failed"}]}\n';
    const LADEFEHLER = '1\n{"numTotalTests":0,"numFailedTests":0,"testResults":[{"status":"failed","assertionResults":[]}]}\n';
    const KEINE_TESTS = '1\n{"numTotalTests":0,"numFailedTests":0,"testResults":[]}\n';
    const BESTANDEN = '0\n{"numTotalTests":3,"numFailedTests":0,"testResults":[{"status":"passed"}]}\n';
    const KEINE_TESTS_GRUEN = '0\n{"numTotalTests":0,"numFailedTests":0,"testResults":[]}\n';
    function paar(rotInhalt: string, gruenInhalt: string) {
      const dir = neuesRepo();
      schreibe(dir, 'stand.txt', 'a\n');
      schreibe(dir, 'pruefung.txt', rotInhalt);
      const rot = einchecken(dir, 'Test');
      schreibe(dir, 'pruefung.txt', gruenInhalt);
      const gruen = einchecken(dir, 'Behebung');
      return lauf(dir, 'pruefung.txt', rot, gruen, { RG_BEFEHL: `sh ${fake()}`, RG_BERICHT: 'vitest-json' });
    }
    it('gescheiterte Tests im Rot-Lauf und bestandene im Grün-Lauf ergeben Beleg gültig', () => {
      expect(paar(GESCHEITERT, BESTANDEN).code).toBe(0);
    });
    it('Ladefehler der Testdatei zählt als Rot (Modul fehlt vor der Behebung)', () => {
      expect(paar(LADEFEHLER, BESTANDEN).code).toBe(0);
    });
    it('Lauf ohne Tests und ohne Ladefehler ist ein Umgebungsfehler (Ausgangscode 3), im Rot- wie im Grün-Lauf', () => {
      const a = paar(KEINE_TESTS, BESTANDEN);
      expect(a.code).toBe(3);
      expect(a.aus).toContain('UMGEBUNGSFEHLER im Rot-Lauf');
      const b = paar(GESCHEITERT, KEINE_TESTS_GRUEN);
      expect(b.code).toBe(3);
      expect(b.aus).toContain('UMGEBUNGSFEHLER im Grün-Lauf');
    });
    it('Ausgangscode und Bericht müssen zusammenpassen: Ausgang 1 mit grünem Bericht ist ein Umgebungsfehler', () => {
      expect(paar('1\n{"numTotalTests":3,"numFailedTests":0,"testResults":[{"status":"passed"}]}\n', BESTANDEN).code).toBe(3);
    });
  });
  it('das Skript ist ausführbar und räumt seine Arbeitsbäume auf', () => {
    const { dir, nurTest, fix } = repoMitBehebung();
    chmodSync(skript, 0o755);
    lauf(dir, 'pruefung.sh', nurTest, fix);
    expect(git(dir, 'worktree', 'list').trim().split('\n')).toHaveLength(1);
  });
});

describe('AF-060 Dateien des Mess- und Prüfprozesses', () => {
  it('Tor, Rot-Grün-Skript und Begründungsdatei sind vorhanden', () => {
    for (const p of ['scripts/pruefen/erwartungen.mts', 'scripts/werkzeug/rot-gruen.sh', 'docs/entwicklung/erwartungen-begruendung.md']) {
      expect(existsSync(join(REPO, p)), p).toBe(true);
    }
  });
  it('die Begründungsdatei erklärt die Form der Vermerke und ist kein Platzhalter', () => {
    const t = lies('docs/entwicklung/erwartungen-begruendung.md');
    expect(t).toContain('«Erwartung geändert:»');
    expect(t).toContain('Abdeckungsbasis');
    expect(t).not.toMatch(new RegExp(String.fromCharCode(223, 124, 8211, 124, 8212)));
  });
});
