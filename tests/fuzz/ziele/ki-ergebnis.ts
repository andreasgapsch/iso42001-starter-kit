// Ziel «KI-Ergebnis»: Antworttext mit Projekt-JSON (rein, im Codeblock oder in Prosa), Übernahme und Rundreise
import { ladeKiErgebnis } from '../../../src/app/import/ki-ergebnis.ts';
import { mutiereJson, mutiereText, tiefJson } from '../mutation.ts';
import { OrakelFehler, type Fall, type Urteil, type Ziel } from '../typen.ts';
import type { Zufall } from '../zufall.ts';
import { grundProjekt, rundreise } from './hilfen.ts';

const PROSA = ['Hier ist die aktualisierte Datei.', 'Ich habe zwei Risiken ergänzt:', '', 'Gerne! Die ganze Datei folgt.', '{ nicht JSON }'];

function erzeuge(z: Zufall, nummer: number): Fall {
  let p = grundProjekt(z);
  if (nummer % 23 === 11) {
    // Über der Grösse: gültige Antwort, durch Leerraum angehoben (Ablehnungsart «zu-gross»)
    const t = JSON.stringify(p);
    return { name: 'ueber-grenze', endung: 'json', daten: t + ' '.repeat(25 * 1024 * 1024 + 1 - t.length), erwartet: 'zu-gross' };
  }
  // Teile der Datei weglassen wie eine KI, die Listen vergisst
  if (z.mit(0.3)) for (const k of ['personen', 'risiken', 'controls', 'dokumente', 'massnahmen']) if (z.mit(0.3)) delete p[k];
  // Gestaltung aus der Antwort darf nie übernommen werden
  if (nummer % 3 === 0) {
    const org = (p['organisation'] ?? {}) as Record<string, unknown>;
    org['gestaltung'] = { logo: { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script><rect width="10" height="10"/></svg>', breite: 10, hoehe: 10 }, farben: { primaer: 'FF0000' } };
    org['logoDataUrl'] = 'data:image/svg+xml;base64,PHN2Zy8+';
    p['organisation'] = org;
  }
  if (z.mit(0.5)) p = mutiereJson(z, p);
  const json = JSON.stringify(p, null, z.mit(0.5) ? 2 : 0);
  let text: string;
  switch (z.ganz(6)) {
    case 0: text = json; break;
    case 1: text = `${z.wahl(PROSA)}\n\n\`\`\`json\n${json}\n\`\`\`\n\n${z.wahl(PROSA)}`; break;
    case 2: text = `${z.wahl(PROSA)}\n${json}\n${z.wahl(PROSA)}`; break;
    case 3: text = `\`\`\`\n${json}\n\`\`\``; break;
    case 4: text = tiefJson(z); break;
    default: text = mutiereText(z, `\`\`\`json\n${json}\n\`\`\``);
  }
  return { name: 'ki-antwort', endung: 'md', daten: text };
}

function urteile(f: Fall): Urteil {
  let r;
  try {
    r = ladeKiErgebnis(f.daten as string);
  } catch (e) {
    throw new OrakelFehler(`ladeKiErgebnis wirft (${e instanceof Error ? `${e.name}: ${e.message}` : String(e)})`.slice(0, 300));
  }
  if (!r.ok) {
    if (!r.art) throw new OrakelFehler('Ablehnung ohne Art');
    return { urteil: 'abgelehnt', meldung: `${r.art}${r.details.length ? `: ${r.details[0]}` : ''}`.slice(0, 200) };
  }
  if (r.projekt.organisation?.gestaltung !== undefined) throw new OrakelFehler('Gestaltung aus dem KI-Ergebnis übernommen');
  rundreise(r.projekt, 'KI-Ergebnis');
  return { urteil: 'angenommen' };
}

export const kiErgebnis: Ziel = { art: 'ki-ergebnis', erzeuge, urteile };
