// Fortschritt für die Übersicht: je Normkapitel 4 bis 10 (über die Etappen des Guides)
// und je Control-Gruppe A.2 bis A.10 (über die Entscheide in der SoA). Ampel «bereit für Stage 1».
import type { ControlEintrag, Projekt } from '../../model/typen.ts';
import { etappenFortschritt, seitenIndex, type Umfeld } from './gefuehrt.ts';
import { erfuellt } from './bedingungen.ts';
import { istLeer } from './pfad.ts';

export interface KatalogAusschnitt {
  anforderungen42001: { kapitel: { id: string; abschnitte: { id: string; etappe: string }[] }[] };
  controls42001: { gruppen: { id: string; controls: { id: string }[] }[] };
}

export interface Anteil {
  id: string;
  /** 0 bis 1 */
  anteil: number;
}

export function kapitelFortschritt(p: Projekt, u: Umfeld, k: KatalogAusschnitt): Anteil[] {
  const index = seitenIndex(u.gefuehrt);
  const etappen = new Map(u.gefuehrt.etappen.etappen.map((e) => [e.id, e]));
  const cache = new Map<string, number | null>();
  const wertEtappe = (id: string): number | null => {
    if (cache.has(id)) return cache.get(id)!;
    const e = etappen.get(id);
    let w: number | null = null;
    if (e && erfuellt(e.wenn, p)) {
      const f = etappenFortschritt(e, p, u, index);
      w = f.gesamt ? f.erledigt / f.gesamt : null;
    }
    cache.set(id, w);
    return w;
  };
  return k.anforderungen42001.kapitel.map((kap) => {
    const werte = kap.abschnitte.map((a) => wertEtappe(a.etappe)).filter((w): w is number => w !== null);
    return { id: kap.id, anteil: werte.length ? werte.reduce((a, b) => a + b, 0) / werte.length : 0 };
  });
}

/** Punkte je Control: 0 offen, 0.5 entschieden und begründet, 1 ausgeschlossen mit Begründung oder umgesetzt. */
export function controlPunkte(c: ControlEintrag | undefined): number {
  if (!c || c.anwendbar === 'offen' || istLeer(c.begruendung)) return 0;
  if (c.anwendbar === 'nein') return 1;
  return c.status === 'umgesetzt' || c.status === 'wirksam' ? 1 : 0.5;
}

export function gruppenFortschritt(p: Projekt, k: KatalogAusschnitt): Anteil[] {
  const karte = new Map(p.controls.map((c) => [c.id, c]));
  return k.controls42001.gruppen.map((g) => ({
    id: g.id,
    anteil: g.controls.length ? g.controls.reduce((a, c) => a + controlPunkte(karte.get(c.id)), 0) / g.controls.length : 0,
  }));
}

export type Ampel = 'gruen' | 'gelb' | 'rot';

export function ampel(befunde: readonly { schwere: 'fehler' | 'hinweis' }[]): Ampel {
  if (befunde.some((b) => b.schwere === 'fehler')) return 'rot';
  return befunde.length ? 'gelb' : 'gruen';
}

/** Offene Massnahmen und fällige Überprüfungen (bis heute + Tage). */
export function offeneMassnahmen(p: Projekt): number {
  return p.massnahmen.filter((m) => m.status === 'offen' || m.status === 'in-arbeit').length;
}

export interface Faellig {
  bereich: string;
  id: string;
  name: string;
  datum: string;
}

export function faelligeUeberpruefungen(p: Projekt, heute: string, tage = 30): Faellig[] {
  const grenze = new Date(Date.parse(heute) + tage * 86_400_000).toISOString().slice(0, 10);
  const r: Faellig[] = [];
  const pruefe = (bereich: string, id: string, name: string, d?: string) => {
    if (d && d <= grenze) r.push({ bereich, id, name, datum: d });
  };
  for (const s of p.kiSysteme) pruefe('inventar', s.id, s.name, s.naechsteUeberpruefung);
  for (const d of p.dokumente) pruefe('dokumente', d.id, d.id, d.naechsteUeberpruefung);
  for (const f of p.folgenabschaetzungen) pruefe('folgen', f.id, f.id, f.naechsteUeberpruefung);
  for (const l of p.lieferanten) pruefe('lieferanten', l.id, l.name, l.naechstePruefung);
  pruefe('organisation', 'leitlinie', 'D-03', p.organisation.leitlinie.naechsteUeberpruefung);
  return r.sort((a, b) => a.datum.localeCompare(b.datum));
}
