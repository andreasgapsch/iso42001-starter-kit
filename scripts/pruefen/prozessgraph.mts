// Tor G45 Prozessgraph (AF-096, QK-52): Graphregeln «Freigabe X setzt Schritt Y voraus» aus src/prozesse/graphregeln.yaml
// gegen alle Abläufe in src/prozesse/katalog.yaml.
//   - art erarbeitung (alle Prozesse): Jeder Schritt mit «entscheid» ist vom Start nur über mindestens eine Aufgabe ohne
//     «entscheid» erreichbar.
//   - art voraus: Ohne einen der Schritte in «voraus» ist keiner der Schritte in «freigabe» vom Start aus erreichbar, d. h.
//     jeder Weg zur Freigabe führt über alle diese Schritte (auch über Rücksprünge).
//   - Regeln nennen nur bestehende Prozesse und Schritte; eine Regel mit «offen» meldet ihren Verstoss als Warnung und ist
//     ein Fehler, sobald der Verstoss behoben ist (Eintrag streichen).
// Aufruf: npx tsx scripts/pruefen/prozessgraph.mts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { type Befund, type Optionen, REPO, alsHauptprogramm } from './gemeinsam.mts';

const TOR = 'G45';
const KATALOG = 'src/prozesse/katalog.yaml';
const REGELN = 'src/prozesse/graphregeln.yaml';

export interface GraphSchritt { id: string; art: string; naechste?: string[]; entscheid?: string }
export interface GraphProzess { id: string; schritte: GraphSchritt[] }
export interface GraphRegel {
  id: string;
  art: 'erarbeitung' | 'voraus';
  prozess?: string;
  freigabe?: string[];
  voraus?: string[];
  offen?: string;
}
export interface GraphEingabe {
  katalog: { prozesse: GraphProzess[] };
  regeln: { regeln: GraphRegel[] };
}

/** Vom Start erreichbare Schritte, ohne die gesperrten Schritte zu betreten */
export function erreichbar(p: GraphProzess, gesperrt: ReadonlySet<string> = new Set()): Set<string> {
  const nach = new Map(p.schritte.map((s) => [s.id, s.naechste ?? []]));
  const start = p.schritte.find((s) => s.art === 'start');
  const gesehen = new Set<string>();
  if (!start || gesperrt.has(start.id)) return gesehen;
  const offen = [start.id];
  gesehen.add(start.id);
  while (offen.length) {
    for (const z of nach.get(offen.pop()!) ?? []) {
      if (gesehen.has(z) || gesperrt.has(z)) continue;
      gesehen.add(z);
      offen.push(z);
    }
  }
  return gesehen;
}

/** Verstösse je Regel als Text (leer = Regel erfüllt) */
export function verstoesse(r: GraphRegel, prozesse: GraphProzess[]): string[] {
  const aus: string[] = [];
  if (r.art === 'erarbeitung') {
    for (const p of prozesse) {
      const aufgaben = new Set(p.schritte.filter((s) => s.art === 'aufgabe' && !s.entscheid).map((s) => s.id));
      const ohne = erreichbar(p, aufgaben);
      for (const s of p.schritte.filter((x) => x.entscheid)) if (ohne.has(s.id)) aus.push(`${s.id}: Freigabe «${s.entscheid}» ohne vorherige Aufgabe erreichbar`);
    }
    return aus;
  }
  const p = prozesse.find((x) => x.id === r.prozess);
  if (!p) return [`Prozess ${r.prozess ?? '(fehlt)'} gibt es nicht`];
  const ids = new Set(p.schritte.map((s) => s.id));
  const unbekannt = [...(r.freigabe ?? []), ...(r.voraus ?? [])].filter((id) => !ids.has(id));
  if (unbekannt.length) return [`Schritte ${unbekannt.join(', ')} gibt es in ${p.id} nicht`];
  if (!r.freigabe?.length || !r.voraus?.length) return ['Regel ohne «freigabe» oder «voraus»'];
  for (const f of r.freigabe) {
    if (!erreichbar(p).has(f)) aus.push(`${f} ist vom Start nicht erreichbar`);
    for (const v of r.voraus) if (erreichbar(p, new Set([v])).has(f)) aus.push(`${f} ist ohne ${v} erreichbar`);
  }
  return aus;
}

export function pruefeGraph(e: GraphEingabe): Befund[] {
  const befunde: Befund[] = [];
  const melde = (meldung: string, schwere: Befund['schwere'] = 'fehler') => befunde.push({ tor: TOR, datei: REGELN, meldung, schwere });
  const gesehen = new Set<string>();
  for (const r of e.regeln.regeln) {
    if (gesehen.has(r.id)) melde(`${r.id}: Regel-ID doppelt`);
    gesehen.add(r.id);
    if (r.art !== 'erarbeitung' && r.art !== 'voraus') {
      melde(`${r.id}: unbekannte Art «${String(r.art)}»`);
      continue;
    }
    const v = verstoesse(r, e.katalog.prozesse);
    if (r.offen) {
      if (v.length) for (const x of v) melde(`${r.id}: ${x} (offen: ${r.offen})`, 'warnung');
      else melde(`${r.id}: Verstoss behoben, Vermerk «offen: ${r.offen}» streichen`);
    } else for (const x of v) melde(`${r.id}: ${x}`);
  }
  return befunde;
}

export function eingabeAusRepo(): GraphEingabe {
  return {
    katalog: parse(readFileSync(join(REPO, KATALOG), 'utf8')) as GraphEingabe['katalog'],
    regeln: parse(readFileSync(join(REPO, REGELN), 'utf8')) as GraphEingabe['regeln'],
  };
}

export async function pruefe(_o: Optionen = {}): Promise<Befund[]> {
  return pruefeGraph(eingabeAusRepo());
}

await alsHauptprogramm(import.meta.url, pruefe);
