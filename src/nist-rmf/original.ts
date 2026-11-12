// Wörtliche Auszüge aus NIST AI 100-1 und NIST AI 600-1 mit eigener Übersetzung (src/nist-rmf/original-*.yaml).
// Gemeinsamer Zugriff für Werkzeug, Vorlagen N-01 bis N-04 und Skill. NIST bittet, wo seine Inhalte genutzt werden, um den
// Vermerk NIST_VERMERK; die Übersetzung ist eine eigene des Kits und nicht amtlich.
import type { Kataloge, NistZitatQuelle } from '../kataloge/typen.ts';

export const NIST_VERMERK = 'Republished courtesy of the National Institute of Standards and Technology.';

export type ZitatDok = 'ai-100-1' | 'ai-600-1';
export type ZitatArt = 'funktion' | 'kategorie' | 'subkategorie' | 'merkmal' | 'risiko' | 'massnahme';

export interface ZitatAngabe {
  art: ZitatArt;
  id: string;
  dok: ZitatDok;
  /** PDF-Seite (1 = erste Seite der Datei) */
  seite: number;
  bisSeite?: number;
  /** wörtlicher Text (Englisch) */
  zitat: string;
  /** eigene Übersetzung */
  de: string;
  /** Titel wörtlich (Funktion, Risiko) und übersetzt (Risiko) */
  titel?: string;
  titelDe?: string;
  quelle: NistZitatQuelle;
}

const LISTE: Record<ZitatArt, [ZitatDok, string]> = {
  funktion: ['ai-100-1', 'funktionen'],
  kategorie: ['ai-100-1', 'kategorien'],
  subkategorie: ['ai-100-1', 'subkategorien'],
  merkmal: ['ai-100-1', 'merkmale'],
  risiko: ['ai-600-1', 'risiken'],
  massnahme: ['ai-600-1', 'massnahmen'],
};

/** Daten eines Dokuments; undefined, wenn die Kataloge fehlen */
export function zitatQuelle(k: Kataloge, dok: ZitatDok): NistZitatQuelle | undefined {
  return (dok === 'ai-100-1' ? k.nistrmf_original1001 : k.nistrmf_original6001)?.quelle;
}

/** Ein Auszug (Funktion: id wie govern; Kategorie und Subkategorie: Kit-ID; Merkmal: gueltig usw.; Risiko: gai-…; Massnahme: GV-1.7-001) */
export function nistZitat(k: Kataloge, art: ZitatArt, id: string): ZitatAngabe | undefined {
  const [dok, liste] = LISTE[art];
  const datei = (dok === 'ai-100-1' ? k.nistrmf_original1001 : k.nistrmf_original6001) as unknown as Record<string, unknown> & { quelle: NistZitatQuelle } | undefined;
  if (!datei) return undefined;
  const e = (datei[liste] as { id: string; seite: number; bis_seite?: number; zitat: string; de: string; titel_zitat?: string; titel_de?: string; name?: string }[] | undefined)?.find((x) => x.id === id);
  if (!e) return undefined;
  return {
    art,
    id,
    dok,
    seite: e.seite,
    ...(e.bis_seite ? { bisSeite: e.bis_seite } : {}),
    zitat: e.zitat,
    de: e.de,
    ...(e.titel_zitat ? { titel: art === 'funktion' ? (e.name ?? e.titel_zitat) : e.titel_zitat } : {}),
    ...(e.titel_de ? { titelDe: e.titel_de } : {}),
    quelle: datei.quelle,
  };
}

/** Massnahmen aus NIST AI 600-1 zu den IDs (bezug_600_1), in der Reihenfolge der IDs; unbekannte IDs entfallen */
export function massnahmen600(k: Kataloge, ids: readonly string[]): ZitatAngabe[] {
  return ids.map((id) => nistZitat(k, 'massnahme', id)).filter((x): x is ZitatAngabe => x !== undefined);
}
