// Szene (src/grafik/svg/szene.ts) als Preact-Knoten: dieselbe Zeichnung wie zuSvg(), aber ohne innerHTML, damit die App
// unter Trusted Types (require-trusted-types-for 'script') Inline-SVG zeigen kann.
import { h, type VNode } from 'preact';
import { rund, type Kind, type Knoten } from '../svg/szene.ts';

export function zuPreact(k: Kind, key?: number): VNode | string {
  if (typeof k === 'string') return k;
  const a: Record<string, unknown> = key === undefined ? {} : { key };
  for (const [n, v] of Object.entries(k.a ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    a[n] = typeof v === 'number' ? String(rund(v)) : v;
  }
  return h(k.el, a, ...(k.k ?? []).map((c, i) => zuPreact(c, i))) as VNode;
}

/** Zeichnet eine Szene; null zeichnet nichts. */
export function SzeneSvg({ szene }: { szene: Knoten | null }) {
  return szene ? (zuPreact(szene) as VNode) : null;
}
