// Klasse des Normpakets (Soll nach V4): Fund F1 aus P2. Werte, die kein Objekt sind, in teile, eintraege und lizenz.
// Geschrieben und gelaufen vor der Behebung in src/app/normtexte/zustand.ts (W28): rot mit TypeError.
import type { Urteil } from '../typen.ts';
import type { Zufall } from '../zufall.ts';
import { normpaket as ziel } from '../ziele/normpaket.ts';
import { text, type Klasse, type KlassenFall } from './typen.ts';

const NICHT_OBJEKT: unknown[] = [null, 0, 1, 'x', '', true, false, [], [null], [[]]];

function grund(): Record<string, unknown> {
  return {
    format: 'aims-normpaket',
    version: 1,
    teile: [{ norm: '42001', sprache: 'de', bezeichnung: 'ISO/IEC 42001:2023', ausgabe: '2023', quelle: 'eigene.pdf', importiert: '2026-10-22T10:00:00Z', eintraege: { 'K-4.1': { titel: 'T', text: 'Text' }, 'A.2.2': { titel: 'T', text: 'Text' } } }],
    lizenz: { dokumente: false, lizenzgeber: 'Verlag', lizenznummer: '1' },
  };
}

export const typen: Klasse = {
  id: 'normpaket-typen',
  art: 'normpaket',
  befunde: ['F1 (P2)'],
  titel: 'Werte, die kein Objekt sind, in teile, eintraege und lizenz: Ablehnung mit eigener Meldung oder bereinigt, nie Rohfehler',
  regression: 'tests/fixtures/fuzz/regression/normpaket-typen.json',
  // Eingeengt auf den auslösenden Fall (Nachprüfung N4): Ein Eintrag null in teile liess `t.norm` werfen. Jede Variante setzt ihn
  // an eine andere Stelle, in unterschiedlicher Zahl und mit weiteren Nicht-Objekten in teile, eintraege und lizenz
  variante: (z: Zufall) => {
    const p = grund();
    const teile = p['teile'] as unknown[];
    const teil = teile[0] as Record<string, unknown>;
    for (let i = 0, n = z.zwischen(1, 3); i < n; i++) teile.splice(z.ganz(teile.length + 1), 0, null);
    const w = (): unknown => z.wahl(NICHT_OBJEKT);
    const wo = z.ganz(4);
    if (wo === 0) teile.splice(z.ganz(teile.length + 1), 0, w());
    else if (wo === 1) (teil['eintraege'] as Record<string, unknown>)[z.wahl(['K-4.2', 'A.3.2', '27001-5.1'])] = w();
    else if (wo === 2) teil['eintraege'] = w();
    else p['lizenz'] = w();
    return { name: `typen null in teile, ${['teile', 'eintrag', 'eintraege', 'lizenz'][wo]}`, endung: 'json', daten: JSON.stringify(p) };
  },
  urteile: (f: KlassenFall): Urteil => ziel.urteile(f) as Urteil,
  // Modell ohne Behebung: Lesen von `norm` auf einem Eintrag null oder undefined in teile wirft (die alte Schleife las t.norm ohne Prüfung)
  ohneSchutz: (f) => {
    const p = JSON.parse(f.daten as string) as { format?: unknown; version?: unknown; teile?: unknown };
    return p.format === 'aims-normpaket' && p.version === 1 && Array.isArray(p.teile) && p.teile.some((t) => t === null || t === undefined);
  },
  ausDatei: (b) => ({ name: 'original', endung: 'json', daten: text(b) }),
};

export const NORMPAKET_KLASSEN: Klasse[] = [typen];
