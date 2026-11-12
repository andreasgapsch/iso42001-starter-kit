// Abgleich zwischen Ordner und Register: geänderte, fehlende, nur in der Cloud liegende und neue Dateien.
// Prüfsummen werden nur gerechnet, wenn Grösse oder Änderungszeit abweichen (grosse Ordner bleiben schnell).
import type { BibliothekAbgleich, BibliothekEintrag } from './modell.ts';
import { ignorierteDatei } from './layout.ts';
import { neuesteVersion } from './sicht.ts';

/** Stand einer Datei im Ordner (ohne Inhalt) */
export interface DateiStand {
  pfad: string;
  groesse: number;
  /** lastModified in Millisekunden */
  geaendert: number;
  /** Datei nicht lesbar, z. B. OneDrive-Platzhalter ohne Netz */
  nichtLokal?: boolean;
}

export type AbgleichArt = 'geaendert' | 'fehlt' | 'nicht-lokal' | 'neu' | 'zeit' | 'alt-geaendert';

export interface AbgleichBefund {
  art: AbgleichArt;
  pfad: string;
  id?: string;
  version?: string;
  /** neue Prüfsumme (geändert) */
  pruefsumme?: string;
  groesse?: number;
  geaendert?: number;
}

/**
 * Vergleicht die Versionen der Einträge mit den Dateien. «geaendert»: neueste Version ausserhalb geändert (neue Version
 * einchecken), «alt-geaendert»: ältere Version verändert, «zeit»: nur die Änderungszeit ist neu (Prüfsumme gleich),
 * «fehlt», «nicht-lokal», «neu»: Datei ohne Eintrag.
 */
export async function abgleichen(eintraege: readonly BibliothekEintrag[], dateien: readonly DateiStand[], pruefsummeVon: (pfad: string) => Promise<string>): Promise<AbgleichBefund[]> {
  const nachPfad = new Map(dateien.map((d) => [d.pfad, d]));
  const bekannt = new Set<string>();
  const befunde: AbgleichBefund[] = [];
  for (const e of eintraege) {
    const neueste = neuesteVersion(e.versionen);
    for (const v of e.versionen) {
      bekannt.add(v.datei);
      const d = nachPfad.get(v.datei);
      const basis = { pfad: v.datei, id: e.id, version: v.version };
      if (!d) {
        befunde.push({ ...basis, art: 'fehlt' });
        continue;
      }
      if (v.ueberschrieben) continue;
      if (d.nichtLokal) {
        befunde.push({ ...basis, art: 'nicht-lokal' });
        continue;
      }
      if (d.groesse === v.groesse && v.geaendert !== undefined && d.geaendert === v.geaendert) continue;
      let summe: string;
      try {
        summe = await pruefsummeVon(v.datei);
      } catch (x) {
        befunde.push({ ...basis, art: (x as { name?: string }).name === 'NotFoundError' ? 'fehlt' : 'nicht-lokal' });
        continue;
      }
      if (summe === v.pruefsumme) {
        if (v.geaendert !== d.geaendert) befunde.push({ ...basis, art: 'zeit', geaendert: d.geaendert });
        continue;
      }
      befunde.push({ ...basis, art: v === neueste ? 'geaendert' : 'alt-geaendert', pruefsumme: summe, groesse: d.groesse, geaendert: d.geaendert });
    }
  }
  for (const d of dateien) {
    if (bekannt.has(d.pfad) || ignorierteDatei(d.pfad)) continue;
    befunde.push({ art: 'neu', pfad: d.pfad, groesse: d.groesse, geaendert: d.geaendert });
  }
  return befunde;
}

/** Zusammenfassung für die Projektdatei (Prüfregeln H78, H79) */
export function zusammenfassen(befunde: readonly AbgleichBefund[], am: string): BibliothekAbgleich {
  const ids = (art: AbgleichArt[]) => [...new Set(befunde.filter((b) => art.includes(b.art) && b.id).map((b) => b.id!))].sort();
  const geaendert = ids(['geaendert', 'alt-geaendert']);
  const fehlend = ids(['fehlt']);
  const nichtLokal = ids(['nicht-lokal']);
  return { am, ...(geaendert.length ? { geaendert } : {}), ...(fehlend.length ? { fehlend } : {}), ...(nichtLokal.length ? { nichtLokal } : {}) };
}

/** Gleicher Befund wie zuvor (dann muss die Projektdatei nicht geändert werden) */
export function gleicherAbgleich(a: BibliothekAbgleich | undefined, b: BibliothekAbgleich): boolean {
  const k = (x?: BibliothekAbgleich) => JSON.stringify([x?.geaendert ?? [], x?.fehlend ?? [], x?.nichtLokal ?? []]);
  return !!a && k(a) === k(b);
}

/** Vorschlag für eine neue Datei im Ordner: Art aus dem obersten Ordner */
export function artFuerNeueDatei(pfad: string): 'nachweis' | 'eigene' {
  return /^Nachweise\//.test(pfad) ? 'nachweis' : 'eigene';
}
