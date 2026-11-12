// Vorschläge für die Erklärung zur Anwendbarkeit: aus Risiken (Risiko.controls), mit Modul AI Act aus den
// AI-Act-Zusatz-Controls (src/ai-act/euaia-controls.yaml) und mit Modul NIST AI RMF aus den Zusatz-Controls RMF-xx
// (src/nist-rmf/rmf-controls.yaml), jeweils nach vorschlag_wenn je KI-System.
import type { RmfControl } from '../../kataloge/typen.ts';
import type { KiSystem, Projekt } from '../../model/typen.ts';
import { rmfVorschlaege } from '../../nist-rmf/logik.ts';
import { istLeer, lies } from './pfad.ts';

export interface VorschlagWenn {
  immer?: boolean;
  rollen_any?: string[];
  risikoklasse_any?: string[];
  transparenz_any?: string[];
  anhang_iii_bereich_any?: string[];
  ausnahme_art_6_3?: boolean;
  gpai?: boolean;
  org_niederlassung_eu?: boolean;
  org_oeffentliche_dienste?: boolean;
  any_of?: VorschlagWenn[];
}

export interface EuaiaControl {
  id: string;
  artikel?: string[];
  verwandt_42001?: string[];
  verwandt_27001?: string[];
  vorschlag_wenn?: VorschlagWenn;
}

/** Zusatz-Control des Moduls NIST AI RMF (src/nist-rmf/rmf-controls.yaml) */
export type RmfControlVorschlag = RmfControl;

export interface Vorschlag {
  id: string;
  grund: 'risiko' | 'aiact' | 'nistrmf';
  /** Risiko-IDs bzw. KI-System-IDs, die den Vorschlag auslösen */
  quellen: string[];
}

const aktiv = (s: KiSystem) => s.status !== 'abgeloest' && s.status !== 'untersagt';

export function bedingungTrifft(w: VorschlagWenn, s: KiSystem, p: Projekt): boolean {
  if (w.any_of && !w.any_of.some((alt) => bedingungTrifft(alt, s, p))) return false;
  if (w.rollen_any && !s.aiAct.rollen.some((r) => w.rollen_any!.includes(r))) return false;
  if (w.risikoklasse_any && !w.risikoklasse_any.includes(s.aiAct.risikoklasse)) return false;
  if (w.transparenz_any && !s.aiAct.transparenz.some((t) => w.transparenz_any!.includes(t))) return false;
  if (w.anhang_iii_bereich_any && !w.anhang_iii_bereich_any.includes(s.aiAct.anhangIiiBereich ?? '')) return false;
  if (w.ausnahme_art_6_3 !== undefined && (s.aiAct.ausnahmeArt63 ?? false) !== w.ausnahme_art_6_3) return false;
  if (w.gpai !== undefined && s.aiAct.gpai !== w.gpai) return false;
  if (w.org_niederlassung_eu !== undefined && p.organisation.euBezug.niederlassungEu !== w.org_niederlassung_eu) return false;
  if (w.org_oeffentliche_dienste !== undefined && (lies(p, 'organisation.oeffentlicheDienste') === true) !== w.org_oeffentliche_dienste) return false;
  return true;
}

/** Alle Vorschläge, sortiert nach Control-ID. Ohne Modul keine AI-Act- bzw. RMF-Vorschläge. */
export function soaVorschlaege(p: Projekt, euaia: readonly EuaiaControl[], rmf: readonly RmfControlVorschlag[] = []): Vorschlag[] {
  const karte = new Map<string, Vorschlag>();
  for (const r of p.risiken) {
    if (r.art !== 'risiko') continue;
    for (const c of r.controls) {
      const v = karte.get(c) ?? { id: c, grund: 'risiko', quellen: [] };
      if (!v.quellen.includes(r.id)) v.quellen.push(r.id);
      karte.set(c, v);
    }
  }
  if (p.meta.modulAiAct) {
    for (const c of euaia) {
      if (!c.vorschlag_wenn) continue;
      const systeme = p.kiSysteme.filter((s) => aktiv(s) && bedingungTrifft(c.vorschlag_wenn!, s, p)).map((s) => s.id);
      if (systeme.length) karte.set(c.id, { id: c.id, grund: 'aiact', quellen: systeme });
    }
  }
  for (const v of rmfVorschlaege(p, rmf)) karte.set(v.id, { id: v.id, grund: 'nistrmf', quellen: v.systeme });
  return [...karte.values()].sort((a, b) => a.id.localeCompare(b.id, 'de', { numeric: true }));
}

/** Feldvorschlag (Attribut `vorschlag`): Wert vorschlagen, wenn einer der Pfade wahr ist und der Wert abweicht. */
export function feldVorschlag(v: { wert: unknown; wennEines: string[] } | undefined, p: Projekt, aktuell: unknown): unknown {
  if (!v) return undefined;
  if (!v.wennEines.some((pfad) => lies(p, pfad) === true)) return undefined;
  if (aktuell === v.wert) return undefined;
  return v.wert;
}

/**
 * Begründung stammt aus einem Vorschlag und nennt nicht mehr alle Quellen (A.9.2 erst wegen R-004, später auch wegen R-001):
 * die neue Fassung, sonst undefined. Selbst geschriebener Text bleibt: Er passt nicht auf die Vorlage (C2-23).
 */
export function begruendungNachfuehren(text: unknown, vorlage: string, quellen: readonly string[]): string | undefined {
  if (typeof text !== 'string' || !vorlage.includes('{quellen}')) return undefined;
  const [vor, nach] = vorlage.split('{quellen}') as [string, string];
  if (!text.startsWith(vor) || !text.endsWith(nach)) return undefined;
  const alt = text.slice(vor.length, text.length - nach.length).split(', ');
  // Nur Kennungen dazwischen, sonst hat jemand den Satz ergänzt
  if (!alt.every((q) => /^[A-Z]+-\d+$/.test(q))) return undefined;
  const neu = `${vor}${quellen.join(', ')}${nach}`;
  return neu === text ? undefined : neu;
}

/** Offene Vorschläge: Controls ohne Entscheid (fehlt im Projekt oder anwendbar «offen»). */
export function offeneVorschlaege(p: Projekt, euaia: readonly EuaiaControl[], rmf: readonly RmfControlVorschlag[] = []): Vorschlag[] {
  return soaVorschlaege(p, euaia, rmf).filter((v) => {
    const c = p.controls.find((x) => x.id === v.id);
    return !c || c.anwendbar === 'offen' || istLeer(c.begruendung);
  });
}
