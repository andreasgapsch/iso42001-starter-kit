// AF-075 (QK-44): DE und EN sind strukturgleich. Verglichen werden alle Nicht-Text-Angaben der Beispiele, Vorlagen und
// des Leitfadens: Struktur und Listenlängen, IDs, Status, Daten, Zahlen, Verweise, Fundstellen und Artikelangaben.
// Bekannte Sprachfassungsdifferenzen stehen mit Grund in tests/fixtures/sprachdifferenzen.yaml; eine Differenz ohne
// Eintrag oder ohne Grund bricht den Test, ebenso ein Eintrag, der nichts mehr ausnimmt.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { istFreitext } from '../../src/beispiele/bau/englisch.mts';

const REPO = join(import.meta.dirname, '..', '..');
const lies = (pfad: string): string => readFileSync(join(REPO, pfad), 'utf8');

/** Eintrag der Differenzliste: Gruppe, Datei, optional eine Stelle (Pfad oder Token), Grund. */
interface Differenz {
  gruppe: 'beispiele' | 'vorlagen' | 'leitfaden';
  datei: string;
  stelle?: string;
  grund: string;
}
const DIFFERENZEN = (parse(lies('tests/fixtures/sprachdifferenzen.yaml')) as { differenzen: Differenz[] | null }).differenzen ?? [];

const MONATE: Record<string, number> = {
  januar: 1, january: 1, februar: 2, february: 2, märz: 3, march: 3, april: 4, mai: 5, may: 5, juni: 6, june: 6, juli: 7, july: 7,
  august: 8, september: 9, oktober: 10, october: 10, november: 11, dezember: 12, december: 12,
};
const MONAT = Object.keys(MONATE).join('|');
const zwei = (n: number | string): string => String(n).padStart(2, '0');

/** Normalisiert Verweise, die je Sprache anders geschrieben werden: Daten, Tausendertrenner, Dezimalzeichen, Artikelangaben. */
export function normalisiere(text: string): string {
  return text
    .replace(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g, (_, t: string, m: string, j: string) => `${j}-${zwei(m)}-${zwei(t)}`)
    .replace(new RegExp(`\\b(\\d{1,2})(?:\\.|st|nd|rd|th)?\\s+(${MONAT})\\s+(\\d{4})\\b`, 'gi'), (_, t: string, m: string, j: string) => `${j}-${zwei(MONATE[m.toLowerCase()]!)}-${zwei(t)}`)
    .replace(new RegExp(`\\b(${MONAT})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'gi'), (_, m: string, t: string, j: string) => `${j}-${zwei(MONATE[m.toLowerCase()]!)}-${zwei(t)}`)
    .replace(new RegExp(`\\b(${MONAT})\\s+(\\d{4})\\b`, 'gi'), (_, m: string, j: string) => `${j}-${zwei(MONATE[m.toLowerCase()]!)}`)
    .replace(/(\d)[ \u00a0\u202f’'.,](\d{3})\b/g, '$1$2')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\b(?:Artikel|Articles?|Art\.)\s*(\d+)/g, 'Art $1');
}

/** Nicht-Text-Token eines Textes: IDs wie D-05, PR-07, Nummern, Zahlen, Daten, Artikelangaben. */
export function tokens(text: string): string[] {
  const t = normalisiere(text);
  return [...t.matchAll(/\bArt \d+|\b[A-Z]{1,5}-(?:\d{1,3}[a-z]?|xx)\b|\d{4}-\d\d(?:-\d\d)?|\d+(?:\.\d+)*/g)].map((m) => m[0]).sort();
}

/** Alle Blätter mit Pfad und Schlüssel, in Dokumentreihenfolge; Listen liefern zusätzlich ihre Länge. */
interface Blatt {
  pfad: string;
  schluessel: string;
  wert: unknown;
}
function blaetter(objekt: unknown, pfad = '', schluessel = ''): Blatt[] {
  if (Array.isArray(objekt)) return [{ pfad: `${pfad}#laenge`, schluessel, wert: objekt.length }, ...objekt.flatMap((w, i) => blaetter(w, `${pfad}[${i}]`, schluessel))];
  if (objekt && typeof objekt === 'object') return Object.entries(objekt).flatMap(([k, v]) => blaetter(v, pfad ? `${pfad}.${k}` : k, k));
  return [{ pfad, schluessel, wert: objekt }];
}

function ausgenommen(gruppe: Differenz['gruppe'], datei: string, stelle: string, benutzt: Set<Differenz>): boolean {
  const d = DIFFERENZEN.find((x) => x.gruppe === gruppe && x.datei === datei && (x.stelle === undefined || x.stelle === stelle || stelle.startsWith(`${x.stelle}.`) || stelle.startsWith(`${x.stelle}[`)));
  if (d) benutzt.add(d);
  return d !== undefined;
}

/** Strukturvergleich zweier Dokumente. Gibt die abweichenden Stellen als Texte zurück (Pfad vor dem ersten Doppelpunkt). */
export function vergleicheStruktur(de: unknown, en: unknown, freitext: (schluessel: string, wert: string) => boolean): string[] {
  const a = blaetter(de);
  const b = blaetter(en);
  const wertB = new Map(b.map((x) => [x.pfad, x.wert]));
  const abweichend: string[] = [];
  for (const x of a) {
    if (!wertB.has(x.pfad)) {
      abweichend.push(`${x.pfad}: fehlt in EN`);
      continue;
    }
    const e = wertB.get(x.pfad);
    if (typeof x.wert === 'string') {
      if (typeof e !== 'string') abweichend.push(`${x.pfad}: Typ`);
      else if (freitext(x.schluessel, x.wert)) {
        const ta = tokens(x.wert).join('|');
        const tb = tokens(e).join('|');
        if (ta !== tb) abweichend.push(`${x.pfad}: Nicht-Text-Angaben ${ta} gegen ${tb}`);
      } else if (e !== x.wert) abweichend.push(`${x.pfad}: ${x.wert} gegen ${String(e)}`);
    } else if (e !== x.wert) abweichend.push(`${x.pfad}: ${String(x.wert)} gegen ${String(e)}`);
  }
  const pfadeA = new Set(a.map((x) => x.pfad));
  for (const y of b) if (!pfadeA.has(y.pfad)) abweichend.push(`${y.pfad}: fehlt in DE`);
  return abweichend;
}

const benutzt = new Set<Differenz>();

describe('Sprachgleichheit DE gegen EN', () => {
  it('Differenzliste: jeder Eintrag hat einen Grund und eine bekannte Gruppe', () => {
    for (const d of DIFFERENZEN) {
      expect(['beispiele', 'vorlagen', 'leitfaden'], d.datei).toContain(d.gruppe);
      expect(d.grund?.trim().length ?? 0, `${d.gruppe} ${d.datei} ohne Grund`).toBeGreaterThan(10);
    }
  });

  describe('Beispiele', () => {
    for (const name of ['muster-maschinenbau', 'praezisionsteile']) {
      it(`${name}: Nicht-Text-Felder gleich`, () => {
        const de = JSON.parse(lies(`src/beispiele/${name}.de.aims.json`)) as unknown;
        const en = JSON.parse(lies(`src/beispiele/${name}.en.aims.json`)) as unknown;
        // Prozentwerte schreibt EN mit Punkt und ohne Leerzeichen; sie gelten als Text mit Zahl
        const text = (k: string, w: string): boolean => istFreitext(k, w) || /^\d+(,\d+)? %$/.test(w);
        const rest = vergleicheStruktur(de, en, text).filter((s) => {
          const pfad = s.split(':')[0]!;
          if (pfad === 'meta.projektId' || pfad === 'meta.dokumentSprache') return false; // je Sprache eigene ID und Sprache
          if (/\.drawio\.|\.zweige\./.test(pfad)) return false; // draw.io je Sprache erzeugt (Prüfsumme, Rohdaten)
          return !ausgenommen('beispiele', name, pfad, benutzt);
        });
        expect(rest).toEqual([]);
      });
    }
  });

  describe('Vorlagen', () => {
    const dateien = readdirSync(join(REPO, 'src/i18n/de/vorlagen')).filter((f) => f.endsWith('.yaml'));
    it('DE und EN haben dieselben Vorlagendateien', () => {
      expect(readdirSync(join(REPO, 'src/i18n/en/vorlagen')).filter((f) => f.endsWith('.yaml'))).toEqual(dateien);
    });
    for (const f of dateien) {
      it(`${f}: Nicht-Text-Angaben gleich`, () => {
        const de = parse(lies(`src/i18n/de/vorlagen/${f}`)) as unknown;
        const en = parse(lies(`src/i18n/en/vorlagen/${f}`)) as unknown;
        const rest = vergleicheStruktur(de, en, () => true).filter((s) => !ausgenommen('vorlagen', f, s.split(':')[0]!, benutzt));
        expect(rest).toEqual([]);
      });
    }
  });

  describe('Leitfaden', () => {
    const nummer = (f: string): string => f.split('-')[0]!;
    const de = readdirSync(join(REPO, 'src/leitfaden/de')).filter((f) => f.endsWith('.md'));
    const en = readdirSync(join(REPO, 'src/leitfaden/en')).filter((f) => f.endsWith('.md'));
    it('DE und EN haben dieselben Kapitelnummern', () => {
      const alle = [...new Set([...de.map(nummer), ...en.map(nummer)])];
      const unterschied = alle.filter((n) => !de.some((f) => nummer(f) === n) || !en.some((f) => nummer(f) === n));
      expect(unterschied.filter((n) => !ausgenommen('leitfaden', `kapitel-${n}`, '', benutzt))).toEqual([]);
    });
    for (const f of de) {
      const gegen = en.find((x) => nummer(x) === nummer(f));
      if (!gegen) continue;
      it(`${f}: IDs, Zahlen, Daten und Artikelangaben gleich`, () => {
        const a = tokens(lies(`src/leitfaden/de/${f}`));
        const b = tokens(lies(`src/leitfaden/en/${gegen}`));
        const nurDe = a.filter((t) => {
          const i = b.indexOf(t);
          if (i < 0) return true;
          b.splice(i, 1);
          return false;
        });
        const abw = [...nurDe.map((t) => ({ t, s: `${t} nur DE` })), ...b.map((t) => ({ t, s: `${t} nur EN` }))];
        expect(abw.filter((x) => !ausgenommen('leitfaden', f, x.t, benutzt)).map((x) => x.s)).toEqual([]);
      });
    }
  });

  it('jeder Eintrag der Differenzliste nimmt noch etwas aus', () => {
    // Vitest führt die Tests einer Datei der Reihe nach aus; dieser Test steht deshalb am Ende
    expect(DIFFERENZEN.filter((d) => !benutzt.has(d)).map((d) => `${d.gruppe} ${d.datei} ${d.stelle ?? ''}`)).toEqual([]);
  });
});

describe('Hilfsfunktionen des Vergleichs (Gegenprobe)', () => {
  it('erkennt eine abweichende ID, Zahl, Listenlänge und einen abweichenden Statuswert', () => {
    expect(vergleicheStruktur({ a: 'Siehe D-05' }, { a: 'See D-06' }, () => true)).toHaveLength(1);
    expect(vergleicheStruktur({ a: 'nach 30 Tagen' }, { a: 'after 14 days' }, () => true)).toHaveLength(1);
    expect(vergleicheStruktur({ l: ['x', 'y'] }, { l: ['x'] }, () => true).length).toBeGreaterThan(0);
    expect(vergleicheStruktur({ s: 'offen' }, { s: 'open' }, () => false)).toHaveLength(1);
  });
  it('gleicht Schreibweisen aus: Artikel, Dezimalzeichen, deutsches Datum', () => {
    expect(vergleicheStruktur({ a: 'Artikel 26, 97,8 % bis 15.03.2027' }, { a: 'Article 26, 97.8% until 2027-03-15' }, () => true)).toEqual([]);
  });
});
