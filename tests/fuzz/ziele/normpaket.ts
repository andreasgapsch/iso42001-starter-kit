// Ziel «Normpaket»: JSON der eigenen Normtexte prüfen und bereinigen; Ergebnis muss idempotent und wieder lesbar sein
import { isDeepStrictEqual } from 'node:util';
import { normpaketExport, pruefeNormpaket } from '../../../src/app/normtexte/zustand.ts';
import { mutiereJson, mutiereText, tiefJson, boeserText } from '../mutation.ts';
import { OrakelFehler, type Fall, type Urteil, type Ziel } from '../typen.ts';
import type { Zufall } from '../zufall.ts';
import { ablehnung } from './hilfen.ts';

function grund(z: Zufall): Record<string, unknown> {
  const ids = ['K-4.1', 'K-5.2', 'A.2.2', 'A.6.2.6', '27001-5.1', '27001-K-4.2', 'A.10.4'];
  const teile = Array.from({ length: z.zwischen(1, 3) }, () => ({
    norm: z.wahl(['42001', '27001']),
    sprache: z.wahl(['de', 'en']),
    bezeichnung: 'ISO/IEC 42001:2023',
    ausgabe: '2023',
    quelle: 'eigene.pdf',
    importiert: '2026-10-22T10:00:00Z',
    eintraege: Object.fromEntries(ids.filter(() => z.mit(0.6)).map((id) => [id, { titel: `Titel ${id}`, text: `Text ${id}\nAbsatz`, ...(z.mit(0.2) ? { manuell: true } : {}) }])),
  }));
  return { format: 'aims-normpaket', version: 1, hinweis: 'x', teile, lizenz: { dokumente: z.mit(0.5), lizenzgeber: 'Verlag', lizenznummer: '123', bestaetigtAm: '2026-10-22' } };
}

function erzeuge(z: Zufall, nummer: number): Fall {
  const art = nummer % 10 === 0 ? 0 : z.ganz(100);
  const p = grund(z);
  if (art < 8) return { name: 'gueltig', endung: 'json', daten: JSON.stringify(p) };
  if (art < 55) return { name: 'json-mutation', endung: 'json', daten: JSON.stringify(mutiereJson(z, p)) };
  if (art < 75) return { name: 'text-mutation', endung: 'json', daten: mutiereText(z, JSON.stringify(p)) };
  if (art < 80) return { name: 'tief', endung: 'json', daten: tiefJson(z) };
  if (art < 88) {
    // Sehr lange Texte und viele Einträge
    const teil = (p['teile'] as { eintraege: Record<string, unknown> }[])[0]!;
    const n = z.zwischen(500, 5000);
    for (let i = 0; i < n; i++) teil.eintraege[`A.${i}.1`] = { titel: `Titel ${i}`, text: i % 50 === 0 ? boeserText(z) : `Text ${i}` };
    return { name: 'viele-eintraege', endung: 'json', daten: JSON.stringify(p) };
  }
  return { name: 'aufbau', endung: 'json', daten: z.wahl(['', 'null', '[]', '{}', '{"format":"aims-normpaket"}', '{"format":"aims-normpaket","version":1}', '{"format":"aims-normpaket","version":1,"teile":{}}', '{"format":"aims-normpaket","version":1,"teile":[null,1,"x",[]]}', '{"format":"aims-normpaket","version":1,"teile":[{"norm":"42001","sprache":"de","eintraege":{"A.2.2":null}}]}', '{"format":"aims-normpaket","version":1,"teile":[{"norm":"42001","sprache":"de","eintraege":[]}]}']) };
}

function urteile(f: Fall): Urteil {
  let roh: unknown;
  try {
    roh = JSON.parse(f.daten as string);
  } catch (e) {
    return { urteil: 'abgelehnt', meldung: `kein JSON: ${e instanceof Error ? e.message.slice(0, 80) : ''}` };
  }
  let p;
  try {
    p = pruefeNormpaket(roh);
  } catch (e) {
    return ablehnung(e, 'pruefeNormpaket');
  }
  // Wieder lesbar: Export und erneutes Prüfen ergeben dieselben Teile
  const text = normpaketExport(p, 'Hinweis');
  let p2;
  try {
    p2 = pruefeNormpaket(JSON.parse(text));
  } catch (e) {
    throw new OrakelFehler(`Exportiertes Normpaket lässt sich nicht mehr lesen (${e instanceof Error ? e.message : String(e)})`);
  }
  if (!isDeepStrictEqual(p2.teile, p.teile)) throw new OrakelFehler('Normpaket: Rundreise Export und Prüfung verändert die Teile');
  return { urteil: 'angenommen' };
}

export const normpaket: Ziel = { art: 'normpaket', erzeuge, urteile };
