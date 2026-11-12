// Bedingungen «wenn» für Etappen, Seiten, Felder und Checklisten (FORMAT.md, Abschnitt Bedingungen).
import type { Projekt } from '../../model/typen.ts';
import type { Wenn } from './gefuehrt-typen.ts';
import { istLeer, lies } from './pfad.ts';

/** Passt ein Feldwert zu einer Werteliste? Listenfelder: ein gemeinsamer Wert genügt. "*" = gesetzt. */
export function wertPasst(wert: unknown, erlaubt: readonly unknown[]): boolean {
  if (erlaubt.includes('*')) return !istLeer(wert);
  if (Array.isArray(wert)) return wert.some((w) => erlaubt.includes(w));
  return erlaubt.includes(wert);
}

/** Mindestens ein Schlüssel muss passen (ODER); ohne Filter passt alles. */
export function filterEinesPasst(objekt: unknown, filter: Record<string, readonly unknown[]> | undefined): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;
  return Object.entries(filter).some(([pfad, werte]) => wertPasst(lies(objekt, pfad), werte));
}

/** Alle Schlüssel eines Filters müssen passen. */
export function filterPasst(objekt: unknown, filter: Record<string, readonly unknown[]> | undefined): boolean {
  if (!filter) return true;
  return Object.entries(filter).every(([pfad, werte]) => wertPasst(lies(objekt, pfad), werte));
}

export function erfuellt(wenn: Wenn | undefined, projekt: Projekt, eintrag?: unknown): boolean {
  if (!wenn) return true;
  const m = projekt.meta;
  const o = projekt.organisation;
  if (wenn.mitIsms !== undefined && m.mitIsms !== wenn.mitIsms) return false;
  if (wenn.modul !== undefined && m.modulAiAct !== wenn.modul) return false;
  if (wenn.modulNistRmf !== undefined && (m.modulNistRmf ?? false) !== wenn.modulNistRmf) return false;
  if (wenn.generativ !== undefined && projekt.kiSysteme.some((s) => s.generativ === true && s.status !== 'abgeloest' && s.status !== 'untersagt') !== wenn.generativ) return false;
  if (wenn.entwickeltKi !== undefined && o.entwickeltKi !== wenn.entwickeltKi) return false;
  if (wenn.verkauftKiProdukte !== undefined && o.verkauftKiProdukte !== wenn.verkauftKiProdukte) return false;
  if (wenn.rolle !== undefined && !projekt.kiSysteme.some((s) => s.aiAct.rollen.includes(wenn.rolle as never))) return false;
  if (wenn.typ !== undefined && !projekt.kiSysteme.some((s) => s.typ === wenn.typ)) return false;
  if (wenn.eintrag !== undefined && (eintrag === undefined || !filterPasst(eintrag, wenn.eintrag))) return false;
  return true;
}
