// Zeichnet einen Inhaltsbaum [tag, attribute | 0, ...kinder] (scripts/wissen.mts) mit Preact, ohne innerHTML (Trusted
// Types). Nur die Elemente und Attribute, die der Build zulässt; Links nur innerhalb des Werkzeugs (#…).
import { h, type ComponentChildren } from 'preact';
import type { Knoten } from '../rahmen/wissen-daten.ts';

const ERLAUBT = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'code', 'pre', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'br', 'hr', 'span', 'sup', 'sub', 'dl', 'dt', 'dd', 'a', 'caption',
]);

export interface BaumOptionen {
  /** Ersatz für Abbildungen der Druckfassung (Knoten «abb») */
  abbildung?: (titel: string) => ComponentChildren;
  /** Überschriften um Stufen verschieben (h1 im Kapitel wird h2, wenn die Seite schon ein h1 hat) */
  ebenen?: number;
  /** Präfix für IDs, damit sie auf der Seite eindeutig bleiben */
  idPraefix?: string;
}

function knoten(k: Knoten, o: BaumOptionen, i: number): ComponentChildren {
  if (typeof k === 'string') return k;
  const [tag, attrs, ...kinder] = k;
  if (tag === 'abb') return o.abbildung ? <div key={i}>{o.abbildung((attrs || {})['titel'] ?? '')}</div> : null;
  if (!ERLAUBT.has(tag)) return <>{kinder.map((x, j) => knoten(x, o, j))}</>;
  let name = tag;
  const m = /^h([1-4])$/.exec(tag);
  if (m && o.ebenen) name = `h${Math.min(6, Number(m[1]) + o.ebenen)}`;
  const props: Record<string, string | number> = { key: i };
  for (const [a, w] of Object.entries(attrs || {})) {
    if (a === 'href' && !w.startsWith('#')) continue;
    if (a === 'id') props['id'] = `${o.idPraefix ?? ''}${w}`;
    else if (a === 'class') props['class'] = w;
    else if (a === 'colspan' || a === 'rowspan') props[a] = Number(w);
    else if (a === 'href') props['href'] = w;
  }
  if (name === 'table') return <div class="tabelle-feld" key={i}>{h('table', { class: props['class'] }, kinder.map((x, j) => knoten(x, o, j)))}</div>;
  return h(name, props, kinder.length ? kinder.map((x, j) => knoten(x, o, j)) : null);
}

export function Baum({ knoten: liste, ...o }: { knoten: readonly Knoten[] } & BaumOptionen) {
  return <>{liste.map((k, i) => knoten(k, o, i))}</>;
}
