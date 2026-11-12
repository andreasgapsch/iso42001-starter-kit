// Zentrale Textauflösung: zuerst das Normpaket der Firma (exakter Normtext), sonst der eigene Kurztitel und die eigene
// Erläuterung des Kits. Gleich in App (Anzeige) und Generator (Dokumente, nur nach Bestätigung).
import type { NormArt, NormEintrag, NormId, NormNr, NormSprache, NormTeil } from './typen.ts';

/** Zu welcher Norm gehört die ID? K-…, A.… -> 42001; 27001-… -> 27001 */
export function normVon(id: NormId): NormNr | null {
  if (/^27001-/.test(id)) return '27001';
  if (/^K-\d/.test(id) || /^A\.\d/.test(id)) return '42001';
  return null;
}

/** Untergruppen in Anhang A der ISO/IEC 42001:2023 (wie untergruppen in iso42001-controls.yaml; Test prüft den Abgleich) */
export const UNTERGRUPPEN_42001 = new Set(['A.6.1', 'A.6.2']);

/** Gruppe oder Untergruppe aus Anhang A (A.2, A.6.1), kein Control */
export function istGruppe42001(id: NormId): boolean {
  return /^A\.\d+$/.test(id) || UNTERGRUPPEN_42001.has(id);
}

/** Schlüssel des eigenen Texts im Kit (src/i18n/<sprache>/…) */
export function eigenerSchluessel(id: NormId, art: NormArt): string | undefined {
  if (/^K-\d+$/.test(id)) return art === 'titel' ? `anforderungen42001.kapitel.${id}` : undefined;
  if (/^K-\d+\./.test(id)) return `anforderungen42001.abschnitte.${id}.${art === 'titel' ? 'titel' : 'was'}`;
  if (istGruppe42001(id)) return art === 'titel' ? `controls42001.gruppen.${id}` : undefined;
  if (/^A\.\d+\.\d+/.test(id)) return `controls42001.controls.${id}.${art === 'titel' ? 'titel' : 'zweck'}`;
  if (/^27001-\d+\.\d+$/.test(id)) return art === 'titel' ? `iso27001.controls.${id}.titel` : undefined;
  if (/^27001-K-/.test(id)) return art === 'titel' ? `kapitel-gemeinsam.abschnitte.${id.slice(6)}.titel` : undefined;
  return undefined;
}

/**
 * Eintrag aus den Normteilen: zuerst in der gewünschten Sprache, sonst in der anderen (die Firma hat z. B. nur die
 * englische SN EN-Ausgabe gekauft).
 */
export function normEintrag(teile: readonly NormTeil[] | undefined, id: NormId, sprache: NormSprache): { eintrag: NormEintrag; teil: NormTeil } | undefined {
  const norm = normVon(id);
  if (!teile?.length || !norm) return undefined;
  const passend = teile.filter((t) => t.norm === norm);
  for (const t of [...passend.filter((x) => x.sprache === sprache), ...passend.filter((x) => x.sprache !== sprache)]) {
    const e = t.eintraege[id];
    if (e && (e.titel || e.text)) return { eintrag: e, teil: t };
  }
  return undefined;
}

export interface NormQuelle {
  /** Normteile der Firma (Anzeige: alle; Generator: nur nach Bestätigung) */
  teile?: readonly NormTeil[];
  /** Eigener Text des Kits zum Schlüssel (Übersetzer oder inhalt() der App) */
  eigen: (schluessel: string) => string | undefined;
}

/** Normtext (Titel oder Anforderungs-/Control-Text) zur ID: Normpaket, sonst eigener Text des Kits. */
export function normText(q: NormQuelle, id: NormId, art: NormArt, sprache: NormSprache): string | undefined {
  const n = normEintrag(q.teile, id, sprache)?.eintrag;
  const aus = art === 'titel' ? n?.titel : n?.text;
  if (aus) return aus;
  const s = eigenerSchluessel(id, art);
  return s ? q.eigen(s) : undefined;
}

/** Stammt der Text aus dem Normpaket? (Kennzeichnung in der App, Quellenvermerk in Dokumenten) */
export function hatNormtext(teile: readonly NormTeil[] | undefined, id: NormId, art: NormArt, sprache: NormSprache): boolean {
  const n = normEintrag(teile, id, sprache)?.eintrag;
  return !!(art === 'titel' ? n?.titel : n?.text);
}

/**
 * IDs aus einem Normbezug wie «6.1.1 bis 6.1.3, A.5.2» oder «4.1, 4.2; A.6.2.2 bis A.6.2.8». Bereiche werden über die
 * Reihenfolge der bekannten IDs aufgelöst; Kapitel ohne Unterabschnitt («4 bis 10») und «Anhang A» entfallen.
 */
export function idsAusNormbezug(text: string, bekannt: readonly NormId[]): NormId[] {
  const nummer = (id: NormId) => id.replace(/^K-/, '');
  const index = new Map(bekannt.map((id, i) => [nummer(id), i]));
  const aus: NormId[] = [];
  const token = /(A\.\d+(?:\.\d+){1,2}|\d+\.\d+(?:\.\d+)?)(?:\s*(?:bis|to|-|\u2013)\s*(A\.\d+(?:\.\d+){1,2}|\d+\.\d+(?:\.\d+)?))?/g;
  for (const m of text.matchAll(token)) {
    const von = index.get(m[1]!);
    const bis = m[2] ? index.get(m[2]) : von;
    if (von === undefined) continue;
    for (let i = von; i <= (bis ?? von); i++) if (!aus.includes(bekannt[i]!)) aus.push(bekannt[i]!);
  }
  return aus;
}
