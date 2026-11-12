// bibliothek.json im Bibliotheksordner: Spiegel des Registers mit Metadaten und Prüfsummen. Die Projektdatei bleibt die
// Quelle; die Datei dient Menschen (lesbar im Explorer) und dem Verbinden desselben Ordners auf einem anderen Rechner.
import { jsonLesen } from '../eingang/lesen.ts';
import type { Projekt } from '../model/typen.ts';
import type { BibliothekEintrag } from './modell.ts';
import type { SichtEintrag } from './sicht.ts';

export const REGISTER_FORMAT = 'aims-bibliothek';

export interface RegisterDatei {
  format: typeof REGISTER_FORMAT;
  version: 1;
  projektId: string;
  organisation: string;
  geaendert: string;
  /** Lesbare Übersicht (abgeleitet) */
  uebersicht: { id: string; art: string; titel: string; status: string; version?: string; gueltig?: string; eigner?: string; naechstePruefung?: string; datei?: string; pruefsumme?: string }[];
  /** Gespeicherte Einträge wie in der Projektdatei (für die Übernahme) */
  eintraege: BibliothekEintrag[];
}

export function registerDatei(p: Projekt, sicht: readonly SichtEintrag[], jetzt: string): string {
  const d: RegisterDatei = {
    format: REGISTER_FORMAT,
    version: 1,
    projektId: p.meta.projektId,
    organisation: p.organisation.name,
    geaendert: jetzt,
    uebersicht: sicht
      .filter((e) => !e.schreibgeschuetzt && (e.versionen.length || e.gespeichert))
      .map((e) => {
        const v = e.versionen.at(-1);
        return {
          id: e.id,
          art: e.art,
          titel: e.titel,
          status: e.status,
          ...(e.version ? { version: e.version } : {}),
          ...(e.gueltig ? { gueltig: e.gueltig } : {}),
          ...(e.eigner ? { eigner: p.personen.find((x) => x.id === e.eigner)?.name ?? e.eigner } : {}),
          ...(e.naechstePruefung ? { naechstePruefung: e.naechstePruefung } : {}),
          ...(v ? { datei: v.datei, pruefsumme: v.pruefsumme } : {}),
        };
      }),
    eintraege: p.bibliothek?.eintraege ?? [],
  };
  return `${JSON.stringify(d, null, 2)}\n`;
}

/** Liest bibliothek.json; null, wenn es keine gültige Registerdatei ist */
/** Grenzen für bibliothek.json von aussen: Die Prüfung läuft im Hauptthread und kopiert das Projekt */
export const REGISTER_MAX_TEXT = 20 * 1024 * 1024;
export const REGISTER_MAX_EINTRAEGE = 10_000;
export const REGISTER_MAX_VERSIONEN = 2_000;

export function registerParsen(text: string): RegisterDatei | null {
  if (text.length > REGISTER_MAX_TEXT) return null;
  try {
    const d = jsonLesen(text, 'sicherung') as Partial<RegisterDatei>;
    if (d.format !== REGISTER_FORMAT || d.version !== 1 || !Array.isArray(d.eintraege)) return null;
    const gueltig = d.eintraege.every((e) => typeof e?.id === 'string' && typeof e.art === 'string' && Array.isArray(e.versionen));
    return gueltig ? (d as RegisterDatei) : null;
  } catch {
    return null;
  }
}

/**
 * Einträge aus bibliothek.json in die Projektdatei übernehmen: fehlende Einträge ganz, bei bestehenden die fehlenden
 * Versionen (gleicher Pfad gilt als gleiche Version). Liefert die Zahl der übernommenen Versionen und Einträge.
 */
export function registerUebernehmen(p: Projekt, d: RegisterDatei): { eintraege: number; versionen: number } {
  p.bibliothek ??= { eintraege: [] };
  const b = p.bibliothek;
  let eintraege = 0;
  let versionen = 0;
  for (const neu of d.eintraege) {
    const alt = b.eintraege.find((e) => e.id === neu.id);
    if (!alt) {
      b.eintraege.push(structuredClone(neu));
      eintraege++;
      versionen += neu.versionen.length;
      continue;
    }
    for (const v of neu.versionen) {
      if (alt.versionen.some((x) => x.datei === v.datei || x.version === v.version)) continue;
      alt.versionen.push(structuredClone(v));
      versionen++;
    }
  }
  return { eintraege, versionen };
}
