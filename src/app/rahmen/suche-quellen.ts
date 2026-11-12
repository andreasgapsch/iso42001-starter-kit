// Erweiterungsstelle der globalen Suche (R6). Jeder Bereich registriert eine Quelle; die Suche fragt alle Quellen ab und
// zeigt die Treffer nach Gruppen. Beispiel (Bibliothek):
//
//   import { registriereSuchquelle } from '../../rahmen/suche-quellen.ts';
//   registriereSuchquelle({
//     id: 'bibliothek',
//     gruppe: () => 'Bibliothek',
//     suche: (q, p) => dokumente(p).filter((d) => passt(q, d.titel, d.id)).map((d) => ({ titel: d.titel, unter: d.id, href: `#/bibliothek/dok/${d.id}` })),
//   });
//
// Eine Quelle liefert synchron höchstens einige Dutzend Treffer; die Suche kürzt je Gruppe. Fehler einer Quelle werden
// ignoriert (die übrigen Gruppen erscheinen trotzdem).
import type { Projekt } from '../../model/typen.ts';

export interface Suchtreffer {
  titel: string;
  /** zweite Zeile, z. B. Kennung, Bereich oder Ausschnitt */
  unter?: string;
  /** Ziel im Werkzeug (Hash-Route, z. B. #/formular/inventar/KI-001) */
  href: string;
  /** Symbolname (src/app/rahmen/symbole.tsx), optional */
  icon?: string;
  /** höhere Werte zuerst; Standard: Treffer am Wortanfang vor Treffern im Wort */
  rang?: number;
}

export interface Suchquelle {
  id: string;
  /** Überschrift der Gruppe in der Sprache der Oberfläche */
  gruppe: () => string;
  /** Reihenfolge der Gruppen (klein zuerst), Standard 50 */
  reihenfolge?: number;
  /** nur mit geöffnetem Projekt abfragen (Standard: ja) */
  mitProjekt?: boolean;
  suche: (anfrage: string, p: Projekt | null) => Suchtreffer[];
}

const quellen = new Map<string, Suchquelle>();

/** Registriert eine Suchquelle; eine zweite Registrierung mit derselben id ersetzt die erste. */
export function registriereSuchquelle(q: Suchquelle): () => void {
  quellen.set(q.id, q);
  return () => {
    if (quellen.get(q.id) === q) quellen.delete(q.id);
  };
}

export function suchquellen(): Suchquelle[] {
  return [...quellen.values()].sort((a, b) => (a.reihenfolge ?? 50) - (b.reihenfolge ?? 50));
}

/** Text für den Vergleich: klein, ohne Akzente, Eszett als ss. */
export function normiere(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u00df/g, 'ss');
}

/**
 * Bewertet, ob alle Wörter der Anfrage in einem der Texte vorkommen: 0 = kein Treffer, sonst höher bei Treffer am
 * Wortanfang oder als ganze Kennung (KI-001).
 */
export function trefferRang(anfrage: string, ...texte: (string | undefined)[]): number {
  const woerter = normiere(anfrage).split(/\s+/).filter(Boolean);
  if (!woerter.length) return 0;
  const heu = normiere(texte.filter(Boolean).join(' \u0001 '));
  let rang = 0;
  for (const w of woerter) {
    const i = heu.indexOf(w);
    if (i < 0) return 0;
    rang += i === 0 || /[\s\u0001(«"/.,:-]/.test(heu[i - 1]!) ? 2 : 1;
  }
  if (texte.some((t) => t && normiere(t) === normiere(anfrage))) rang += 5;
  return rang;
}

export interface Suchgruppe {
  id: string;
  titel: string;
  treffer: Suchtreffer[];
}

/** Fragt alle Quellen ab; je Gruppe höchstens `jeGruppe` Treffer, nach Rang sortiert. */
export function suchen(anfrage: string, p: Projekt | null, jeGruppe = 6): Suchgruppe[] {
  const q = anfrage.trim();
  if (q.length < 2) return [];
  const r: Suchgruppe[] = [];
  for (const quelle of suchquellen()) {
    if ((quelle.mitProjekt ?? true) && !p) continue;
    let treffer: Suchtreffer[];
    try {
      treffer = quelle.suche(q, p);
    } catch {
      continue;
    }
    if (!treffer.length) continue;
    const sortiert = [...treffer].sort((a, b) => (b.rang ?? 0) - (a.rang ?? 0)).slice(0, jeGruppe);
    r.push({ id: quelle.id, titel: quelle.gruppe(), treffer: sortiert });
  }
  return r;
}
