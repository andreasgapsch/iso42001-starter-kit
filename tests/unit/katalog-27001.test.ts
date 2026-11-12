import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPRACHEN = ['de', 'en'] as const;

const datei = (pfad: string): string => readFileSync(join(ROOT, pfad), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yaml = (pfad: string): any => parse(datei(pfad));

interface Control27001 {
  id: string;
  nummer: string;
  thema: string;
}
interface Zuordnung {
  id: string;
  verwandt: { control: string; staerke: string; begruendung: string }[];
}
interface Kapitel {
  id: string;
  nummer: string;
  gegenstueck27001: string | null;
  gemeinsam: string;
  hinweis: string;
  vorlagen: string[];
}
interface Ergaenzungsblatt {
  id: string;
  vorlage: string;
  ismsDokument: string;
  normbezug: string[];
  iso27001: string[];
  abschnitte: string[];
}

const katalog = yaml('src/kataloge/iso27001-controls.yaml');
const controls: Control27001[] = katalog.controls;
const controlIds = new Set(controls.map((c) => c.id));
const mapping = yaml('src/kataloge/mapping-42001-27001.yaml');
const zuordnungen: Zuordnung[] = mapping.zuordnungen;
const kapitel: Kapitel[] = yaml('src/kataloge/kapitel-gemeinsam.yaml').abschnitte;
const blaetter: Ergaenzungsblatt[] = yaml('src/kataloge/ergaenzungsblaetter.yaml').blaetter;

/** ISO/IEC 42001 Anhang A: die 38 Control-Nummern (nur Nummern, kein Normtext) */
const ids42001: string[] = [
  'A.2.2', 'A.2.3', 'A.2.4',
  'A.3.2', 'A.3.3',
  'A.4.2', 'A.4.3', 'A.4.4', 'A.4.5', 'A.4.6',
  'A.5.2', 'A.5.3', 'A.5.4', 'A.5.5',
  'A.6.1.2', 'A.6.1.3', 'A.6.2.2', 'A.6.2.3', 'A.6.2.4', 'A.6.2.5', 'A.6.2.6', 'A.6.2.7', 'A.6.2.8',
  'A.7.2', 'A.7.3', 'A.7.4', 'A.7.5', 'A.7.6',
  'A.8.2', 'A.8.3', 'A.8.4', 'A.8.5',
  'A.9.2', 'A.9.3', 'A.9.4',
  'A.10.2', 'A.10.3', 'A.10.4',
];

const istText = (t: unknown): boolean => typeof t === 'string' && t.trim().length > 0;

describe('Katalog ISO/IEC 27001:2022 Anhang A', () => {
  it('enthält genau 93 Controls mit eindeutigen IDs', () => {
    expect(controls).toHaveLength(93);
    expect(controlIds.size).toBe(93);
    expect(katalog.rahmenwerk).toBe('ISO27001');
  });

  it('hat je Thema die richtige Anzahl und lückenlose Nummern', () => {
    const erwartet: Record<string, [string, number]> = {
      organisatorisch: ['5', 37],
      personen: ['6', 8],
      physisch: ['7', 14],
      technologisch: ['8', 34],
    };
    for (const [thema, [kapitelNr, anzahl]] of Object.entries(erwartet)) {
      const nummern = controls.filter((c) => c.thema === thema).map((c) => c.nummer);
      const soll = Array.from({ length: anzahl }, (_, i) => `${kapitelNr}.${i + 1}`);
      expect(nummern).toEqual(soll);
    }
    for (const c of controls) expect(c.id).toBe(`27001-${c.nummer}`);
  });

  it.each(SPRACHEN)('hat alle Titel in %s (3 bis 7 Wörter, keine Zusatzschlüssel)', (sprache) => {
    const texte = yaml(`src/i18n/${sprache}/iso27001.yaml`);
    expect(Object.keys(texte.controls).sort()).toEqual([...controlIds].sort());
    for (const id of controlIds) {
      const titel = texte.controls[id]?.titel;
      expect(istText(titel), `${sprache} ${id}`).toBe(true);
      const woerter = (titel as string).replace(/,/g, ' ').split(/\s+/).filter(Boolean).length;
      expect(woerter, `${sprache} ${id}: ${titel}`).toBeGreaterThanOrEqual(3);
      expect(woerter, `${sprache} ${id}: ${titel}`).toBeLessThanOrEqual(7);
    }
    for (const thema of katalog.themen) expect(istText(texte.themen[thema])).toBe(true);
  });
});

describe('Mapping ISO/IEC 42001 Anhang A zu ISO/IEC 27001', () => {
  it('die Liste der 42001-Controls hat 38 Einträge', () => {
    expect(ids42001).toHaveLength(38);
  });

  it('enthält jedes 42001-Control aus Anhang A genau einmal und keine anderen', () => {
    const imMapping = zuordnungen.map((z) => z.id);
    expect(new Set(imMapping).size).toBe(imMapping.length);
    expect([...imMapping].sort()).toEqual([...ids42001].sort());
    for (const z of zuordnungen) expect(z.verwandt.length, z.id).toBeGreaterThan(0);
  });

  it('verweist nur auf existierende 27001-Controls mit gültiger Stärke', () => {
    for (const z of zuordnungen) {
      const ziele = z.verwandt.map((v) => v.control);
      expect(new Set(ziele).size, `${z.id} doppelt`).toBe(ziele.length);
      for (const v of z.verwandt) {
        expect(controlIds.has(v.control), `${z.id} -> ${v.control}`).toBe(true);
        expect(mapping.staerken).toContain(v.staerke);
      }
    }
  });

  it.each(SPRACHEN)('hat für jeden Begründungsschlüssel einen Text in %s', (sprache) => {
    const texte = yaml(`src/i18n/${sprache}/mapping.yaml`);
    const schluessel = zuordnungen.flatMap((z) => z.verwandt.map((v) => v.begruendung));
    for (const s of schluessel) expect(istText(texte.begruendung[s]), `${sprache} ${s}`).toBe(true);
    expect(Object.keys(texte.begruendung).sort()).toEqual([...new Set(schluessel)].sort());
    for (const st of mapping.staerken) expect(istText(texte.staerke[st])).toBe(true);
  });
});

describe('Gemeinsame Kapitel 4 bis 10', () => {
  it('hat gültige Einträge mit Texten in beiden Sprachen', () => {
    expect(new Set(kapitel.map((k) => k.id)).size).toBe(kapitel.length);
    for (const k of kapitel) {
      expect(k.id).toBe(`K-${k.nummer}`);
      expect(['ja', 'teilweise', 'nein']).toContain(k.gemeinsam);
      for (const v of k.vorlagen) expect(v).toMatch(/^D-\d{2}$/);
    }
    expect(kapitel.filter((k) => k.gegenstueck27001 === null).map((k) => k.id)).toEqual(['K-6.1.4', 'K-8.4']);
    for (const sprache of SPRACHEN) {
      const texte = yaml(`src/i18n/${sprache}/kapitel-gemeinsam.yaml`);
      for (const k of kapitel) {
        expect(istText(texte.abschnitte[k.id]?.titel), `${sprache} ${k.id}`).toBe(true);
        expect(istText(texte.hinweise[k.hinweis]), `${sprache} ${k.hinweis}`).toBe(true);
      }
    }
  });
});

describe('Ergänzungsblätter Pfad «mit ISMS»', () => {
  const kapitelIds = new Set(kapitel.map((k) => k.id));

  it('hat gültige IDs und Verweise', () => {
    for (const b of blaetter) {
      expect(b.id).toBe(`${b.vorlage}-EB`);
      expect(b.id).toMatch(/^D-\d{2}-EB$/);
      for (const n of b.normbezug) {
        const ok = n.startsWith('K-') ? kapitelIds.has(n) : ids42001.includes(n);
        expect(ok, `${b.id} -> ${n}`).toBe(true);
      }
      for (const c of b.iso27001) expect(controlIds.has(c), `${b.id} -> ${c}`).toBe(true);
      expect(b.abschnitte.length).toBeGreaterThan(0);
    }
  });

  it.each(SPRACHEN)('hat für jedes Blatt und jeden Abschnitt Titel und Inhalt in %s', (sprache) => {
    const texte = yaml(`src/i18n/${sprache}/ergaenzungsblaetter.yaml`);
    for (const b of blaetter) {
      expect(istText(texte.ismsDokumente[b.ismsDokument]), `${sprache} ${b.ismsDokument}`).toBe(true);
      const blatt = texte.blaetter[b.id];
      expect(istText(blatt?.titel), `${sprache} ${b.id}`).toBe(true);
      expect(Object.keys(blatt.abschnitte)).toEqual(b.abschnitte);
      for (const a of b.abschnitte) {
        expect(istText(blatt.abschnitte[a]?.titel), `${sprache} ${b.id}.${a}`).toBe(true);
        expect(istText(blatt.abschnitte[a]?.inhalt), `${sprache} ${b.id}.${a}`).toBe(true);
      }
    }
  });
});

describe('Konventionen in den Katalog- und Textdateien', () => {
  const dateien = [
    'src/kataloge/iso27001-controls.yaml',
    'src/kataloge/mapping-42001-27001.yaml',
    'src/kataloge/kapitel-gemeinsam.yaml',
    'src/kataloge/ergaenzungsblaetter.yaml',
    ...['iso27001', 'mapping', 'kapitel-gemeinsam', 'ergaenzungsblaetter'].flatMap((b) =>
      SPRACHEN.map((s) => `src/i18n/${s}/${b}.yaml`),
    ),
  ];

  it.each(dateien)('%s: kein Eszett, keine Gedankenstriche', (pfad) => {
    const inhalt = datei(pfad);
    expect(inhalt).not.toMatch(/\u00DF/);
    expect(inhalt).not.toMatch(/[\u2013\u2014]/);
  });
});
