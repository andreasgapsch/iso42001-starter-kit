// Quellenvermerk für Dokumente mit Normtext: «Auszug aus SN EN ISO/IEC 42001:2026 (ISO/IEC 42001:2023), wiedergegeben
// unter Lizenz von …». Texte in src/i18n/<sprache>/allgemein.yaml (normtext.*); gleich im Generator und in der Vorschau der App.
import type { NormTeil } from './typen.ts';

export type TextFn = (schluessel: string, werte?: Record<string, string | number>) => string;

export function vermerkText(t: TextFn, teil: Pick<NormTeil, 'norm' | 'bezeichnung' | 'ausgabe' | 'amd'>, lizenzgeber: string, lizenznummer: string): string {
  const geber = lizenzgeber.trim();
  const nr = lizenznummer.trim();
  const international = `ISO/IEC ${teil.norm}:${teil.ausgabe}`;
  return t(geber ? 'allgemein.normtext.vermerk' : 'allgemein.normtext.vermerk_ohne_geber', {
    bezeichnung: `${teil.bezeichnung}${teil.amd ? `/${teil.amd}` : ''}`,
    ausgabe: teil.bezeichnung.startsWith(international) ? '' : t('allgemein.normtext.ausgabe', { norm: teil.norm, jahr: teil.ausgabe }),
    lizenzgeber: geber,
    nummer: nr ? t('allgemein.normtext.nummer', { nummer: nr }) : '',
  });
}
