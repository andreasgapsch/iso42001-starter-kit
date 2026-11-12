// Rollenbegriff: Die Rolle, die ein KI-System verantwortet, heisst überall
// «Eigner/in des Systems», im Fliesstext «Eignerin oder Eigner des Systems», englisch «system owner». Andere Varianten für
// diese Rolle («verantwortliche Person des Systems», «Eignerschaft», «person responsible for the system», «the owner» …)
// kommen in DE und EN nicht mehr vor: in den Texten (i18n, Leitfaden, Skill, Prozesskatalog, Prüfregeln, Guide, Hilfe), in
// beiden Beispielen und in allen Dokumenten, die der Generator daraus und aus den leeren Vorlagen erzeugt. Andere Rollen
// («AIMS-Verantwortliche/r», Risikoeigner/in, verantwortliche Person einer Massnahme, eines Controls, eines Ziels) bleiben.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auftraege } from '../../scripts/beispiele.mts';
import type { DocxDokument, XlsxMappe } from '../../src/generator/ir.ts';
import type { Sprache } from '../../src/model/typen.ts';
import { kontext, projekt, texte } from './kittexte-hilfen.ts';

const REPO = join(import.meta.dirname, '..', '..');

/** Satz, der ein KI-System oder das Inventar nennt (dann ist «verantwortliche Person» die Rolle Eigner/in); das
 * Managementsystem (AIMS) ist kein KI-System. «Eignerschaft» eines Dokuments (D-26, Bibliothek) ist eine andere Rolle. */
const SYSTEM: Record<Sprache, RegExp> = { de: /\b(?:KI-)?Systems?\b|\bSystem(?:e|en)?\b|KI-Inventar|\bWerkzeug/, en: /(?<!management )\bsystems?\b|AI inventory|\btool\b/i };
/** Varianten, die es für die Rolle nicht mehr geben darf */
const VERBOTEN: Record<Sprache, RegExp[]> = {
  de: [/Eignerschaft (?:des|der) (?:KI-)?System/, /Systemeigner/, /Systemverantwortlich/, /(?<!Eignerin oder )\b(?:der|den|dem|des) Eigners? des Systems\b/, /(?<!Eignerin oder (?:der |den |dem |ein |einen |kein )?)(?<![\/\w])Eigners? des Systems\b/, /Verantwortliche[nr]? je (?:KI-)?System/, /verantwortliche[nr]? Person (?:des|eines|je) (?:betroffenen )?(?:KI-)?Systems?/],
  en: [/person responsible for the (?:AI )?system/i, /owner of the (?:AI )?system/i, /\bsystem's owner\b/i],
};
/** Satzweise: «verantwortliche Person» bzw. «responsible person» oder «the owner» in einem Satz über ein System */
const IM_SATZ: Record<Sprache, RegExp[]> = {
  // Prüfung nach der unabhängigen Prüfung (N15): auch das blosse männliche «Eigner» und EN «owner» ohne «system» in Sätzen über Systeme
  de: [/verantwortliche[nr]? Person/, /Eignerschaft/, /(?<!Eignerin oder (?:der |den |dem |ein |einen |kein )?)(?<![\w\/-])Eigners?\b(?!\/|in\b|innen)/],
  en: [/\bresponsible person\b|\bperson responsible\b/i, /(?<!\b(?:system|risk|process|asset|document|control|data|objective|business|product|action|measure|information)\s)\bowners?\b/i],
};

/** Andere Rolle mit demselben Wort: Eigner von Informationswerten im ISMS (PS-01) */
const AUSNAHMEN = [/Informationen und Systeme erfassen, Eigner und Schutzbedarf/, /Record information and systems, set owners and protection needs/];

function verstoesse(text: string, s: Sprache): string[] {
  const aus: string[] = [];
  for (const a of AUSNAHMEN) text = text.replace(new RegExp(a.source, 'g'), '');
  for (const re of VERBOTEN[s]) for (const m of text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`))) aus.push(m[0]);
  for (const satz of text.split(/(?<=[.!?;])\s+|\n/)) {
    if (!SYSTEM[s].test(satz)) continue;
    for (const re of IM_SATZ[s]) {
      const m = re.exec(satz);
      if (m) aus.push(`«${m[0]}» in «${satz.trim().slice(0, 140)}»`);
    }
  }
  return aus;
}

function dateien(wurzel: string, endung: RegExp): string[] {
  return (readdirSync(join(REPO, wurzel), { recursive: true }) as string[]).filter((d) => endung.test(d)).map((d) => join(wurzel, d));
}

/** Zeichenketten eines JSON-Werts (Beispielprojekte) */
function zeichenketten(o: unknown, aus: string[] = []): string[] {
  if (typeof o === 'string') aus.push(o);
  else if (Array.isArray(o)) for (const x of o) zeichenketten(x, aus);
  else if (o && typeof o === 'object') for (const x of Object.values(o)) zeichenketten(x, aus);
  return aus;
}

describe('Rollenbegriff Eigner/in des Systems', () => {
  for (const s of ['de', 'en'] as const) {
    it(`${s}: Texte (i18n, Leitfaden, Skill, Prozesse, Regeln, Guide, Hilfe, Kurzanleitung)`, () => {
      const quellen = [
        ...dateien(`src/i18n/${s}`, /\.ya?ml$/),
        ...dateien(`src/leitfaden/${s}`, /\.md$/),
        ...(s === 'de' ? dateien('src/skill', /\.md$/) : []),
        `src/app/kurzanleitung/${s === 'de' ? 'Kurzanleitung_DE' : 'Quick-Guide_EN'}.html`,
      ];
      const falsch = quellen.flatMap((d) => verstoesse(readFileSync(join(REPO, d), 'utf8'), s).map((v) => `${d}: ${v}`));
      expect(falsch).toEqual([]);
    });

    it(`${s}: beide Beispiele (Projektdateien)`, () => {
      const falsch: string[] = [];
      for (const b of ['muster-maschinenbau', 'praezisionsteile']) {
        for (const t of zeichenketten(projekt(b, s))) falsch.push(...verstoesse(t, s).map((v) => `${b}: ${v}`));
      }
      expect(falsch).toEqual([]);
    });

    it(`${s}: alle Dokumente der beiden Beispiele und der leeren Vorlagen über den Generator`, () => {
      const falsch: string[] = [];
      for (const b of ['muster-maschinenbau', 'praezisionsteile']) {
        const p = projekt(b, s);
        for (const a of auftraege(p, s)) {
          for (const modus of ['firma', 'leer'] as const) {
            if (modus === 'leer' && b !== 'praezisionsteile') continue;
            const ir = a.vorlage(kontext(p, modus, a)) as DocxDokument | XlsxMappe;
            for (const t of texte(ir)) falsch.push(...verstoesse(t, s).map((v) => `${b} ${modus} ${a.name}: ${v}`));
          }
        }
      }
      expect([...new Set(falsch)]).toEqual([]);
    }, 120_000);
  }
});
