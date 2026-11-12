// Fachliche Entscheide und Soll-Ist-Abgleich der Darstellung (Designentscheide V-18 bis V-22): Abnahmetests ohne Browser.
//
// N7: «allein» heisst «ohne Eigner/in». Bei tiefem Risiko entscheidet die AIMS-Verantwortung allein über die Einführung, bei
// mittlerem zusammen mit der Eignerin oder dem Eigner des Systems (ohne Geschäftsleitung), bei hohem Risiko die
// Geschäftsleitung. Querbezug: Vorlage D-03, Feldhilfe E3 und Textbausteine, D-04 Anlage A, D-12, D-15, PR-07, PR-11, PR-13
// und der Rang der Prüfregel sagen dasselbe; in beiden Beispielen passen D-03, D-12 und D-15 zu den Entscheidungsrechten des
// Projekts (Generator, DE und EN).
// A-07: Zähltexte mit Einzahl («1 Dokumente in Prüfung freigeben»): jeder Text mit {anzahl} vor einem Wort hat eine Form
// <schluessel>_eins, und alle Wege zum Text (t, inhalt, Generator) nehmen sie bei anzahl = 1.
// V-18 (A-12): eine Dialogart; jede Rückfrage hat einen Titel als Frage mit Handlung, «Bitte bestätigen» gibt es nicht mehr.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { auftraege } from '../../scripts/beispiele.mts';
import type { DocxDokument } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer, holePfad } from '../../src/i18n/texte.ts';
import type { Projekt, Sprache } from '../../src/model/typen.ts';
import { RANG_VORSCHLAG } from '../../src/regeln/pruefungen.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { kontext, projekt, texte } from './kittexte-hilfen.ts';

const REPO = join(import.meta.dirname, '..', '..');
const SPRACHEN: Sprache[] = ['de', 'en'];
const texteJe = { de: ladeTexte('de'), en: ladeTexte('en') };
const { setzeAppDaten } = await import('../../src/app/daten.ts');
setzeAppDaten({
  texte: texteJe, kataloge: ladeKataloge(), gefuehrt: JSON.parse(readFileSync(join(REPO, 'src/generiert/gefuehrt.json'), 'utf8')),
  regeln: { regeln: [] }, version: '1.0.0', gebaut: '', beispiele: [],
} as never);
const { inhalt, setzeUiSprache, t } = await import('../../src/app/i18n.ts');
const text = (s: Sprache, k: string): string => {
  const w = holePfad(texteJe[s], k);
  return Array.isArray(w) ? w.join('\n') : String(w ?? '');
};

// ---------------------------------------------------------------------------------------------------------------- N7
type Stelle = 'aims' | 'aims+eigner' | 'gl';
type Stufe = 'tief' | 'mittel' | 'hoch';
const ENTSCHEID: Record<Stufe, Stelle> = { tief: 'aims', mittel: 'aims+eigner', hoch: 'gl' };
const STUFE: Record<Sprache, Record<Stufe, RegExp>> = {
  de: { tief: /\btiefe[mns]? Risik/i, mittel: /\bmittlere[mns]? Risik/i, hoch: /\bhohe[mns]? Risik/i },
  en: { tief: /\blow risk/i, mittel: /\bmedium risk/i, hoch: /\bhigh risk/i },
};
// wie verlangt() in src/regeln/pruefungen.ts: Geschäftsleitung, Geschäftsführung, Verwaltungsrat, Executive board, Managing director
const GL = /Geschäftsleitung|Geschäftsführ|Verwaltungsrat|top management|executive board|board of directors|managing director/i;
const EIGNER = /Eigner|verantwortliche[nr]? Person|owner|person responsible|responsible person/i;
const AIMS = /AIMS|\ballein|\balone\b|\bsole\b/i;

/** Teilsätze: an Satzzeichen und vor «und bei» / «and for» getrennt, damit jede Stufe ihren eigenen Teil hat */
const teilsaetze = (x: string) => x.split(/[.;\n]|,|\bund (?=bei )|\band (?=(?:for|together|at) )/);

/**
 * Lesart einer Stelle: je genannte Stufe, wer über die Einführung entscheidet. Ohne Wort für die Stelle gilt `standard`
 * (D-03: die Zeile nennt die AIMS-Verantwortung im Titel).
 */
function lesart(x: string, s: Sprache, standard?: Stelle): Partial<Record<Stufe, Stelle | '?'>> {
  const aus: Partial<Record<Stufe, Stelle | '?'>> = {};
  for (const teil of teilsaetze(x)) {
    for (const stufe of ['tief', 'mittel', 'hoch'] as const) {
      if (!STUFE[s][stufe].test(teil)) continue;
      const stelle: Stelle | '?' = GL.test(teil) ? 'gl' : EIGNER.test(teil) ? 'aims+eigner' : AIMS.test(teil) ? 'aims' : standard ?? '?';
      if (aus[stufe] && aus[stufe] !== stelle) aus[stufe] = '?';
      else aus[stufe] = stelle;
    }
  }
  return aus;
}

/** Stelle einer Angabe der Entscheidungsrechte im Projekt (Person über ihre Rolle, sonst der Text) */
function stelleVon(p: Projekt, wer: string): Stelle | 'andere' {
  const person = p.personen.find((x) => x.id === wer);
  if (person) return person.aimsRollen.includes('gl') ? 'gl' : person.aimsRollen.includes('aims') || p.organisation.aimsVerantwortlich === wer ? 'aims' : 'andere';
  return GL.test(wer) ? 'gl' : /aims/i.test(wer) ? (EIGNER.test(wer) ? 'aims+eigner' : 'aims') : 'andere';
}

/** Text der Zeile «… ohne Geschäftsleitung» in D-03 */
function d03Allein(ir: DocxDokument, s: Sprache): string {
  const t0 = texte(ir);
  const i = t0.findIndex((x) => x.includes(text(s, 'vorlagen.D-03.risikobereitschaft_rahmen.aimsAllein')));
  expect(i, 'Zeile «ohne Geschäftsleitung» in D-03').toBeGreaterThanOrEqual(0);
  return t0[i + 1] ?? '';
}

/** Absatz eines Dokuments, der die Freigabe der Einführung nach Stufen regelt (D-12 Abschnitt 5, D-15 «Neues Werkzeug») */
function freigabeAbsatz(ir: DocxDokument, s: Sprache): string {
  const kandidaten = texte(ir).filter((x) => STUFE[s].tief.test(x) && STUFE[s].hoch.test(x) && GL.test(x));
  expect(kandidaten.length, 'Absatz mit Freigabe nach Stufen').toBeGreaterThanOrEqual(1);
  return kandidaten[0]!;
}

const doc = (p: Projekt, s: Sprache, id: string, modus: 'leer' | 'firma'): DocxDokument => {
  // mit ISMS als Ergänzungsblatt (D-15-EB)
  const a = auftraege(p, s).find((x) => x.name.startsWith(`${id}_`) || x.name.startsWith(`${id}-EB_`))!;
  return a.vorlage(kontext(p, modus, a)) as DocxDokument;
};

describe('N7: Entscheidungsrechte zur Einführung, alle Stellen gleich', () => {
  it('Rang der Prüfregel H73 für die Einführung: tief und mittel AIMS-Verantwortung, hoch Geschäftsleitung', () => {
    expect(RANG_VORSCHLAG.einfuehren).toEqual({ tief: 2, mittel: 2, hoch: 3 });
  });
  for (const s of SPRACHEN) {
    it(`${s}: Vorlagen, Prozesskatalog und Guide (Texte)`, () => {
      const falsch: string[] = [];
      const pruefe = (name: string, x: string, stufen: Stufe[], standard?: Stelle) => {
        const l = lesart(x, s, standard);
        for (const stufe of ['tief', 'mittel', 'hoch'] as const) {
          if (stufen.includes(stufe) && l[stufe] !== ENTSCHEID[stufe]) falsch.push(`${name} ${stufe}: ${l[stufe] ?? 'fehlt'} statt ${ENTSCHEID[stufe]} («${x}»)`);
          if (!stufen.includes(stufe) && l[stufe]) falsch.push(`${name} nennt ${stufe} («${x}»)`);
        }
      };
      // D-03: ohne Geschäftsleitung entscheidet die AIMS-Verantwortung bei tiefem (allein) und mittlerem Risiko (mit Eigner/in)
      pruefe('D-03 Vorschlag', text(s, 'vorlagen.D-03.risikobereitschaft_vorschlag.aimsAllein'), ['tief', 'mittel'], 'aims');
      pruefe('E3 Feldhilfe', text(s, 'gefuehrt.E3.E3-risikobereitschaft.felder.organisation.risikobereitschaft.aimsAllein.hilfe'), ['tief', 'mittel', 'hoch']);
      pruefe('E3 Textbausteine', Object.values(holePfad(texteJe[s], 'gefuehrt.optionen.rbAimsAllein') as Record<string, string>).join('\n'), ['tief', 'mittel'], 'aims');
      // D-04 Anlage A: Zellen tief, mittel, hoch
      const zellen = holePfad(texteJe[s], 'vorlagen.D-04.entscheidungsrechte_vorschlag.einfuehren') as string[];
      zellen.forEach((z, i) => {
        const stufe = (['tief', 'mittel', 'hoch'] as const)[i]!;
        const stelle = GL.test(z) ? 'gl' : EIGNER.test(z) ? 'aims+eigner' : AIMS.test(z) ? 'aims' : '?';
        if (stelle !== ENTSCHEID[stufe]) falsch.push(`D-04 Anlage A einführen ${stufe}: «${z}»`);
      });
      // Textbaustein für die Einführung bei mittlerem Risiko wie in D-04
      const bausteine = Object.values(holePfad(texteJe[s], 'gefuehrt.optionen.entscheidungstraeger') as Record<string, string>);
      if (!bausteine.includes(zellen[1]!)) falsch.push(`E3 Textbausteine Entscheidungsrechte ohne «${zellen[1]}» (D-04 mittel)`);
      pruefe('D-12 Freigabe', text(s, 'vorlagen.D-12.freigabe_regel'), ['tief', 'mittel', 'hoch']);
      pruefe('D-15 neues Werkzeug', text(s, 'vorlagen.D-15.neu_text'), ['tief', 'mittel', 'hoch']);
      // Prozesskatalog: die Freigabe ohne Geschäftsleitung (PR-07.05, PR-11.06, PR-13.05) lässt das tiefe Risiko ohne Eigner/in
      for (const schritt of ['PR-07.05', 'PR-11.06', 'PR-13.05']) {
        const x = text(s, `prozesse.prozesse.${schritt.slice(0, 5)}.schritte.${schritt}`);
        pruefe(schritt, x, ['tief', 'mittel']);
      }
      expect(falsch).toEqual([]);
    });

    it(`${s}: D-03, D-12 und D-15 der leeren Vorlage über den Generator`, () => {
      const p = projekt('praezisionsteile', s);
      const falsch: string[] = [];
      const allein = lesart(d03Allein(doc(p, s, 'D-03', 'leer'), s), s, 'aims');
      if (allein.tief !== 'aims' || allein.mittel !== 'aims+eigner' || allein.hoch) falsch.push(`D-03 leer: ${JSON.stringify(allein)}`);
      for (const id of ['D-12', 'D-15']) {
        const l = lesart(freigabeAbsatz(doc(p, s, id, 'leer'), s), s);
        if (JSON.stringify(l) !== JSON.stringify(ENTSCHEID)) falsch.push(`${id} leer: ${JSON.stringify(l)}`);
      }
      expect(falsch).toEqual([]);
    });

    it(`${s}: beide Beispiele: D-03, D-12 und D-15 passen zu den Entscheidungsrechten des Projekts`, () => {
      const falsch: string[] = [];
      for (const b of ['muster-maschinenbau', 'praezisionsteile'] as const) {
        const p = projekt(b, s);
        const wer = p.organisation.entscheidungsrechte?.find((e) => e.entscheid === 'einfuehren')?.wer;
        expect(wer, `${b}: Entscheidungsrechte zur Einführung`).toBeTruthy();
        const soll = { tief: stelleVon(p, wer!.tief ?? ''), mittel: stelleVon(p, wer!.mittel ?? ''), hoch: stelleVon(p, wer!.hoch ?? '') };
        // Allein heisst ohne Eigner/in: das tiefe Risiko entscheidet die AIMS-Verantwortung im Beispiel allein
        if (soll.tief !== 'aims') falsch.push(`${b} D-04 tief: ${soll.tief}`);
        const allein = lesart(d03Allein(doc(p, s, 'D-03', 'firma'), s), s, 'aims');
        if (allein.tief !== 'aims') falsch.push(`${b} D-03: tiefes Risiko ${allein.tief ?? 'fehlt'}`);
        for (const stufe of ['mittel', 'hoch'] as const) {
          const hatOhneGl = soll[stufe] === 'aims' || soll[stufe] === 'aims+eigner';
          if (hatOhneGl && allein[stufe] !== soll[stufe]) falsch.push(`${b} D-03 ${stufe}: ${allein[stufe] ?? 'fehlt'} statt ${soll[stufe]}`);
          if (!hatOhneGl && allein[stufe]) falsch.push(`${b} D-03 nennt ${stufe} ohne Geschäftsleitung, D-04: ${wer![stufe]}`);
        }
        for (const id of ['D-12', 'D-15']) {
          const l = lesart(freigabeAbsatz(doc(p, s, id, 'firma'), s), s);
          for (const stufe of ['tief', 'mittel', 'hoch'] as const) if (l[stufe] !== soll[stufe]) falsch.push(`${b} ${id} ${stufe}: ${l[stufe] ?? 'fehlt'} statt ${soll[stufe]} (D-04: ${wer![stufe]})`);
        }
      }
      expect(falsch).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------- A-07
/** Wörter nach der Zahl, die in Einzahl und Mehrzahl gleich lauten (Partizip, Adjektiv, Präposition) */
const GLEICH: Record<Sprache, RegExp> = {
  de: /^(?:von|in|aus|überfällig|erledigt|gewählt|erfasst|offen)\b/,
  en: /^(?:of|in|from|overdue|done|selected|recorded|open)\b/,
};

interface Zaehltext { datei: string; schluessel: string; wert: string; eins?: string }

function zaehltexte(s: Sprache): Zaehltext[] {
  const dir = join(REPO, 'src/i18n', s);
  const dateien = (readdirSync(dir, { recursive: true }) as string[]).filter((f) => f.endsWith('.yaml'));
  const aus: Zaehltext[] = [];
  for (const f of dateien) {
    const d = parse(readFileSync(join(dir, f), 'utf8')) as unknown;
    const lauf = (o: unknown, pfad: string[]) => {
      if (!o || typeof o !== 'object' || Array.isArray(o)) return;
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        if (typeof v === 'string' && !k.endsWith('_eins')) {
          for (const m of v.matchAll(/\{anzahl\}\s+([^\s{]+)/g)) {
            if (GLEICH[s].test(m[1]!)) continue;
            const eins = (o as Record<string, unknown>)[`${k}_eins`];
            aus.push({ datei: f, schluessel: [...pfad, k].join('.'), wert: v, eins: typeof eins === 'string' ? eins : undefined });
            break;
          }
        } else lauf(v, [...pfad, k]);
      }
    };
    lauf(d, [f.replace(/\.yaml$/, '').replace(/\//g, '.')]);
  }
  return aus;
}

/** Sprache der Oberfläche ohne document (Node) */
const I_sprache = (s: Sprache) => {
  try { setzeUiSprache(s); } catch { /* ohne document: Signal ist gesetzt */ }
};

describe('A-07: Zähltexte mit Einzahl in allen Texten DE und EN', () => {
  for (const s of SPRACHEN) {
    it(`${s}: jeder Text mit {anzahl} vor einem Wort hat eine Form _eins ohne {anzahl}`, () => {
      const liste = zaehltexte(s);
      expect(liste.length).toBeGreaterThan(50);
      const falsch = liste.filter((z) => !z.eins || z.eins.includes('{anzahl}')).map((z) => `${z.datei}: ${z.schluessel} = ${z.wert.slice(0, 70)}`);
      expect(falsch).toEqual([]);
    });
  }

  it('t(), inhalt() und der Generator nehmen bei anzahl = 1 die Einzahl', () => {
    for (const s of SPRACHEN) {
      I_sprache(s);
      const u = erstelleUebersetzer(s, texteJe[s]);
      // Oberfläche (app.*), Bibliothek und Guide über inhalt(), Vorlagen über den Übersetzer des Generators
      expect(t('stage1.regeln_hinweise', { anzahl: 1 })).toBe(s === 'de' ? '1 Hinweis' : '1 note');
      expect(inhalt('bibliothek.sammel.freigeben', { anzahl: 1 })).toBe(text(s, 'bibliothek.sammel.freigeben_eins'));
      expect(inhalt('bibliothek.sammel.freigeben', { anzahl: 2 })).toBe(text(s, 'bibliothek.sammel.freigeben').replace('{anzahl}', '2'));
      expect(inhalt('gefuehrt.ui.pruefung.hinweise', { anzahl: 1 })).toBe(text(s, 'gefuehrt.ui.pruefung.hinweise_eins'));
      expect(u.t('vorlagen.D-12.monate', { anzahl: 1 })).toBe(text(s, 'vorlagen.D-12.monate_eins'));
    }
    I_sprache('de');
  });

  it('jeder Aufruf mit einem Zähltext übergibt die Zahl als anzahl', () => {
    // Aufrufe t('x', { n: … }) oder bt('x', { zahl: … }) würden die Einzahl nie finden
    const schluessel = new Set(SPRACHEN.flatMap((s) => zaehltexte(s).map((z) => z.schluessel)));
    const wurzel = join(REPO, 'src');
    const dateien = (readdirSync(wurzel, { recursive: true }) as string[]).filter((d) => /\.(tsx?|mts)$/.test(d) && !d.startsWith('generiert'));
    const falsch: string[] = [];
    let gefunden = 0;
    for (const d of dateien) {
      const quelle = readFileSync(join(wurzel, d), 'utf8');
      const dok = /vorlagen\/(D-\d{2}|E-\d{2}|N-\d{2})\.ts$/.exec(d)?.[1];
      for (const m of quelle.matchAll(/\b(t|tr|bt|inhalt|u\.t|u\.tOpt)\(\s*(k\(|g\()?'([\w.-]+)'\)?\s*,\s*\{([^}]*)\}/g)) {
        const [, fn, umhuellt, k, werte] = m as unknown as [string, string, string | undefined, string, string];
        const kandidaten = umhuellt === 'k(' && dok ? [`vorlagen.${dok}.${k}`] : umhuellt === 'g(' ? [`vorlagen.grafik.${k}`]
          : fn === 't' ? [`app.${k}`] : fn === 'tr' ? [`rahmen.${k}`] : fn === 'bt' ? [`bibliothek.${k}`] : [k];
        if (!kandidaten.some((x) => schluessel.has(x))) continue;
        gefunden++;
        if (!/\banzahl\b/.test(werte)) falsch.push(`${d}: ${k} ohne anzahl`);
      }
    }
    expect(gefunden).toBeGreaterThan(20);
    expect(falsch).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------- V-18
describe('V-18 (A-12): eine Dialogart, Titel als Frage mit Handlung', () => {
  const wurzel = join(REPO, 'src', 'app');
  const dateien = (readdirSync(wurzel, { recursive: true }) as string[]).filter((d) => /\.(tsx?|css)$/.test(d));
  it('«Bitte bestätigen» und «Please confirm» kommen in den Texten nicht vor', () => {
    for (const s of SPRACHEN) {
      const roh = readdirSync(join(REPO, 'src/i18n', s), { recursive: true }).filter((f) => String(f).endsWith('.yaml')).map((f) => readFileSync(join(REPO, 'src/i18n', s, String(f)), 'utf8')).join('\n');
      expect(roh).not.toMatch(/Bitte bestätigen|Please confirm/);
    }
  });
  it('kein eigener Löschdialog: .loeschen-dialog kommt in src/app nicht vor, jedes <dialog role=alertdialog> ist der Dialog Bestaetigen', () => {
    const falsch: string[] = [];
    for (const d of dateien) {
      const q = readFileSync(join(wurzel, d), 'utf8');
      if (q.includes('loeschen-dialog')) falsch.push(`${d}: loeschen-dialog`);
      if (/role="alertdialog"/.test(q) && !d.endsWith('ui/Bestaetigen.tsx')) falsch.push(`${d}: eigener alertdialog`);
    }
    expect(falsch).toEqual([]);
  });
  it('jede Rückfrage nennt einen Titel; die Titel sind Fragen, die Knöpfe nennen eine Handlung (nie «OK» oder «Ja»)', () => {
    const ohne: string[] = [];
    for (const d of dateien) {
      const q = readFileSync(join(wurzel, d), 'utf8');
      for (const m of q.matchAll(/bestaetigen\(\{/g)) {
        // Objekt bis zur passenden Klammer
        let tiefe = 0;
        let ende = m.index! + 'bestaetigen('.length;
        for (; ende < q.length; ende++) {
          if (q[ende] === '{') tiefe++;
          else if (q[ende] === '}' && --tiefe === 0) break;
        }
        const objekt = q.slice(m.index!, ende);
        // titel: … oder Kurzform { titel, … }
        if (!/[{,]\s*titel\s*[:,}]/.test(objekt)) ohne.push(`${d}: ${objekt.slice(0, 80)}`);
      }
    }
    expect(ohne).toEqual([]);
    for (const s of SPRACHEN) {
      const b = holePfad(texteJe[s], 'app.bestaetigen') as Record<string, string>;
      const titel = Object.entries(b).filter(([k]) => k.startsWith('titel_'));
      expect(titel.length, s).toBeGreaterThanOrEqual(15);
      expect(titel.filter(([, v]) => !v.trim().endsWith('?')).map(([k]) => k), s).toEqual([]);
      expect(Object.entries(b).filter(([k, v]) => !k.startsWith('titel_') && /^(OK|Ja|Yes)$/i.test(v.trim())).map(([k]) => k), s).toEqual([]);
    }
  });
});
