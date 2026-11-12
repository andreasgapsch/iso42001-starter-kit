// Tor G5: Stilprüfung (Eszett, Striche, Wortliste, Ausnahmen).
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pruefeRepo, pruefeText, spracheAusPfad, spracheDatei } from '../../scripts/pruefen/stil.mts';

// Verbotene Zeichen nur als Escape, damit diese Datei selbst sauber bleibt
const SZ = '\u00DF';
const HG = '\u2013';
const GV = '\u2014';

const meldungen = (datei: string, text: string) => pruefeText(datei, text).map((b) => `${b.zeile}: ${b.meldung}`);

describe('pruefeText', () => {
  it('meldet Eszett, Halbgeviert- und Geviertstrich mit Zeilennummer', () => {
    const b = pruefeText('src/i18n/de/a.yaml', `a: Gru${SZ}\nb: gut\nc: eins ${HG} zwei\nd: drei ${GV} vier`);
    expect(b.map((x) => x.zeile)).toEqual([1, 3, 4]);
    expect(b.every((x) => x.tor === 'G5' && x.schwere === 'fehler')).toBe(true);
  });

  it('meldet Zahlenbereiche mit Halbgeviertstrich gesondert', () => {
    const [b] = pruefeText('src/i18n/de/a.yaml', `seiten: 10${HG}12`);
    expect(b!.meldung).toMatch(/Zahlenbereich/);
  });

  it('meldet die deutschen Wortformen', () => {
    const m = meldungen('src/i18n/de/a.yaml', 'a: Alle Mitarbeiter\nb: bzgl. der Frist\nc: z.B. so\nd: z. B. so\ne: Mitarbeitende und Mitarbeiterinnen\nf: Mitarbeiter:innen');
    expect(m).toHaveLength(3);
    expect(m[0]).toMatch(/^1: .*Mitarbeitende/);
    expect(m[1]).toMatch(/^2: .*bzgl/);
    expect(m[2]).toMatch(/^3: .*z\. B\./);
  });

  it('meldet amerikanische Formen und lässt britische mit -ize stehen', () => {
    const us = 'color, center, program to analyze behavior and catalog';
    const uk = 'colour, centre, programme to analyse behaviour, organize and prioritize the catalogue';
    expect(pruefeText('src/i18n/en/a.yaml', `a: ${us}`).length).toBeGreaterThanOrEqual(6);
    expect(pruefeText('src/i18n/en/a.yaml', `a: ${uk}`)).toEqual([]);
  });

  it('wendet die Wortliste nur auf die passende Sprache an', () => {
    expect(pruefeText('src/i18n/de/a.yaml', 'a: Das Programm hat eine color-Variable')).toEqual([]);
    expect(pruefeText('src/i18n/en/a.yaml', 'a: Mitarbeiter')).toEqual([]);
    // zweisprachige Datei: Sprache aus dem Schlüssel
    const b = pruefeText('src/kataloge/k.yaml', '  de: Alle Mitarbeiter\n  en: the color\n  titel_en: Mitarbeiter');
    expect(b.map((x) => x.zeile)).toEqual([1, 2]);
  });

  it('prüft in Code-Dateien nur Sätze in Zeichenketten', () => {
    const code = "const a = AlignmentType.CENTER; const b = 'center';\nconst c = 'Click the center button';";
    expect(pruefeText('src/vorlagen/x.ts', code).map((x) => x.zeile)).toEqual([2]);
  });

  it('überspringt Zeilen mit stil-ok:', () => {
    expect(pruefeText('src/i18n/en/a.yaml', 'a: computer program # stil-ok: Software')).toEqual([]);
  });

  describe('Anführungszeichen (U-31): EN ‘…’, DE «…»', () => {
    it('meldet Guillemets in englischen Dateien, lässt ‘…’, “…” und den Pfadtrenner › stehen', () => {
      const m = meldungen('src/i18n/en/a.yaml', [
        'a: The column «Origin»',
        'b: The column ‘Origin’ with “nested” quotes',
        'c: Under Settings › Document design',
        'd: a ‹nested› quote',
        'e: Settings›Design',
        '# Comment with «Origin»',
      ].join('\n'));
      expect(m.map((x) => x.split(':')[0])).toEqual(['1', '4', '5', '6']);
      expect(m[0]).toMatch(/Guillemets in englischem Text.*‘…’/);
    });

    it('lässt deutsche Dateien und Zeilen mit «…» in Ruhe', () => {
      expect(pruefeText('src/i18n/de/a.yaml', 'a: Die Spalte «Herkunft» und ‹innen›')).toEqual([]);
      expect(pruefeText('src/kataloge/k.yaml', '# Pfad «mit ISMS»\n  de: Spalte «Herkunft»\n  titel: «neutral»')).toEqual([]);
    });

    it('erkennt Englisch am Zeilenschlüssel und an Werten englischer Schlüssel in der Zeile', () => {
      const yaml = '  en: Column «Origin»\n  titel_en: "«Origin»"\n  x: { de: "Spalte «Herkunft»", en: "Column «Origin»" }\n  y: { de: "Spalte «Herkunft»", en: "Column ‘Origin’" }';
      expect(pruefeText('src/kataloge/k.yaml', yaml).map((x) => x.zeile)).toEqual([1, 2, 3]);
    });

    it('prüft in Code-Dateien nur Zeichenketten, nicht Kommentare', () => {
      const code = [
        "// Spalte «Herkunft» (Kommentar)",
        "const t = { de: 'Spalte «Herkunft»', en: 'Column «Origin»' };",
        "const u = { de: 'Spalte «Herkunft»', en: 'Column ‘Origin’' };",
        "  en: `The column «${name}» is empty`,",
      ].join('\n');
      expect(pruefeText('src/vorlagen/x.ts', code).map((x) => x.zeile)).toEqual([2, 4]);
    });

    it('kennt die Sprache von Dateien ohne Sprachangabe im Pfad und von Abschnitten «English»', () => {
      expect(spracheDatei('src/lizenz/LICENCE.txt')).toBe('en');
      expect(spracheDatei('src/start/LIESMICH.txt.tpl')).toBe('de');
      expect(spracheDatei('src/kataloge/glossar.yaml')).toBe('beide');
      expect(pruefeText('src/start/README.txt.tpl', 'Click «Enable Editing».')).toHaveLength(1);
      expect(pruefeText('src/lizenz/LIZENZ.txt', 'Klicken Sie auf «Bearbeitung aktivieren».')).toEqual([]);
      const changelog = 'Deutsch\r\n-------\r\nPoster «AIMS auf einer Seite»\r\n\r\nEnglish\r\n-------\r\nPoster «AIMS on one page»\r\nPoster ‘AIMS on one page’\r\n';
      expect(pruefeText('src/start/CHANGELOG.txt.tpl', changelog).map((x) => x.zeile)).toEqual([7]);
    });

    it('überspringt begründete Ausnahmen mit stil-ok:', () => {
      expect(pruefeText('src/i18n/en/a.yaml', 'a: German term «Mitarbeitende» # stil-ok: wörtlicher deutscher Begriff')).toEqual([]);
    });
  });

  it('erkennt die Sprache aus dem Pfad', () => {
    expect(spracheAusPfad('src/i18n/de/x.yaml')).toBe('de');
    expect(spracheAusPfad('src/start/LIESMICH.de.md')).toBe('de');
    expect(spracheAusPfad('src/start/README_EN.md')).toBe('en');
    expect(spracheAusPfad('src/kataloge/glossar.yaml')).toBe('beide');
  });
});

describe('pruefeRepo', () => {
  it('beachtet Quellordner und Ausnahmen (Auszüge, Lizenztexte, Liste)', () => {
    const repo = mkdtempSync(join(tmpdir(), 'stil-'));
    const schreibe = (rel: string, text: string) => {
      mkdirSync(join(repo, rel, '..'), { recursive: true });
      writeFileSync(join(repo, rel), text);
    };
    schreibe('src/i18n/de/a.yaml', `a: Stra${SZ}e`);
    schreibe('src/ai-act/auszuege/de/art-26.md', `Wortlaut mit Stra${SZ}e`);
    schreibe('src/lizenz/CC-BY-4.0.txt', `Lizenz ${GV} Volltext`);
    schreibe('src/start/alt.html', `<p>Stra${SZ}e</p>`);
    schreibe('docs/notiz.md', `Stra${SZ}e`);
    schreibe('src/start/README.txt.tpl', 'Click «Enable Editing».');
    const b = pruefeRepo(repo, ['src/i18n', 'src/ai-act', 'src/lizenz', 'src/start'], ['src/ai-act/auszuege/**', 'src/lizenz/CC-BY-4.0*', 'src/start/alt.html']);
    expect(b.map((x) => x.datei)).toEqual(['src/i18n/de/a.yaml', 'src/start/README.txt.tpl']);
  });
});

describe('Runde 1: -ise und Quellen', () => {
  it('meldet -ise in Englisch, ausser Rechtsbegriffe und Wörter, die immer so enden', () => {
    expect(meldungen('src/i18n/en/a.yaml', 'a: optimisation of the organisation').length).toBe(2);
    expect(meldungen('src/i18n/en/a.yaml', 'a: the authorised representative and a harmonised standard; otherwise exercise expertise')).toEqual([]);
    expect(meldungen('src/i18n/en/a.yaml', 'a: authorised by the board').length).toBe(1);
    expect(meldungen('src/i18n/en/a.yaml', 'organisation.name: Bezeichner')).toEqual([]);
  });

  it('prüft die Projektdateien der Beispiele nach ihrer Sprache', () => {
    expect(meldungen('src/beispiele/x.de.aims.json', '"a": "Ein Mitarbeiter im Einkauf"').length).toBe(1);
    expect(meldungen('src/beispiele/x.en.aims.json', '"a": "after the optimisation of it"').length).toBe(1);
    expect(meldungen('src/beispiele/x.en.aims.json', '"ebenen": ["organisation"]')).toEqual([]);
  });
});

// V-11 (Designsystem AIMS Nachtblau, AF-157, C4-18): Rückfragen über den eigenen Dialog ui/Bestaetigen.tsx, nie über
// window.confirm (Knopf «OK» nennt die Handlung nicht, Dialog des Browsers ohne Stil und Fokusführung)
describe('V-11 kein confirm() im Code', () => {
  it('confirm( kommt in src/ nicht vor', () => {
    const SRC = join(import.meta.dirname, '..', '..', 'src');
    const dateien = (o: string): string[] => readdirSync(o, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? dateien(join(o, e.name)) : /\.(ts|tsx|mts|js)$/.test(e.name) ? [join(o, e.name)] : []));
    const treffer = dateien(SRC).flatMap((d) => readFileSync(d, 'utf8').split('\n').flatMap((z, i) => (/\bconfirm\(/.test(z) ? [`${d.slice(SRC.length + 1)}:${i + 1}`] : [])));
    expect(treffer).toEqual([]);
  });
});
