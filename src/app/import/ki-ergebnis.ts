// Ergebnis des KI-Assistenten (Skill) übernehmen: Projektdatei im gleichen Schema, oft als Text mit Erklärung und
// Markdown-Codeblock eingefügt. Liest das JSON heraus, ergänzt fehlende leere Wurzellisten und Standardangaben
// (Skill-Regel: «Immer die ganze Datei»; kleine Auslassungen sollen den Import nicht scheitern lassen) und prüft dann
// wie beim Öffnen einer Projektdatei (Version, Migration über migriere(), Schema).
import { pruefeSchemaVersion } from '../../model/migrationen.ts';
import { ID_PRAEFIX } from '../../model/typen.ts';
import { ORGANISATION_NUR_WERKZEUG } from '../../model/gestaltung.ts';
import { ladeProjektDaten, MAX_BYTES, type LadeErgebnis } from './laden.ts';
import { technikText } from '../speicher/technik.ts';
import { jsonLesen } from '../../eingang/lesen.ts';

export type KiErgebnis = LadeErgebnis & {
  /** Ergänzte Angaben (Pfade), damit die Oberfläche darauf hinweisen kann */
  ergaenzt?: string[];
};

/** JSON aus einem eingefügten Text holen: reines JSON, Markdown-Codeblock oder Text mit einem Objekt darin. */
export function extrahiereJson(text: string): { ok: true; daten: unknown } | { ok: false; meldung: string } {
  const roh = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const versuche: string[] = [roh.trim()];
  for (const m of roh.matchAll(/```(?:json|JSON)?\s*\n([\s\S]*?)```/g)) versuche.push(m[1]!.trim());
  const a = roh.indexOf('{');
  const e = roh.lastIndexOf('}');
  if (a >= 0 && e > a) versuche.push(roh.slice(a, e + 1));
  let letzte = '';
  // Längster gültiger Kandidat gewinnt (ein Codeblock kann auch nur ein Ausschnitt sein)
  const gueltig: { laenge: number; daten: unknown }[] = [];
  for (const v of versuche) {
    if (!v) continue;
    try {
      const daten: unknown = jsonLesen(v, 'ki-ergebnis');
      if (daten && typeof daten === 'object' && !Array.isArray(daten)) gueltig.push({ laenge: v.length, daten });
    } catch (x) {
      letzte = technikText(x);
    }
  }
  if (gueltig.length === 0) return { ok: false, meldung: letzte };
  gueltig.sort((x, y) => y.laenge - x.laenge);
  return { ok: true, daten: gueltig[0]!.daten };
}

const LISTEN = ['personen', 'parteien', 'rollen', ...Object.keys(ID_PRAEFIX), 'controls', 'dokumente'];

/** Fehlende leere Listen und Standardangaben ergänzen; vorhandene Werte bleiben unverändert. */
export function ergaenzeKiErgebnis(daten: Record<string, unknown>): string[] {
  const ergaenzt: string[] = [];
  for (const l of new Set(LISTEN)) {
    if (daten[l] === undefined) {
      daten[l] = [];
      ergaenzt.push(l);
    }
  }
  // Gestaltung (Logo, Farben) setzt nur das Werkzeug, nie der Skill: aus einem KI-Ergebnis nie übernehmen
  const org = daten['organisation'];
  if (org && typeof org === 'object' && !Array.isArray(org)) for (const f of ORGANISATION_NUR_WERKZEUG) delete (org as Record<string, unknown>)[f];
  const meta = daten['meta'];
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const m = meta as Record<string, unknown>;
    if (m['gefuehrt'] === undefined) {
      m['gefuehrt'] = { aktuelleEtappe: 'E0', etappen: {}, antworten: {} };
      ergaenzt.push('meta.gefuehrt');
    }
    if (m['checklisten'] === undefined) {
      m['checklisten'] = {};
      ergaenzt.push('meta.checklisten');
    }
    if (m['projektId'] === undefined || m['projektId'] === '') {
      m['projektId'] = globalThis.crypto?.randomUUID?.() ?? `ki-${Date.now().toString(36)}`;
      ergaenzt.push('meta.projektId');
    }
  }
  return ergaenzt;
}

export function ladeKiErgebnis(text: string): KiErgebnis {
  if (text.trim() === '') return { ok: false, art: 'leer', details: [] };
  if (text.length > MAX_BYTES) return { ok: false, art: 'zu-gross', details: [`${(text.length / 1048576).toFixed(1)} MB`] };
  const j = extrahiereJson(text);
  // Rohtext des Parsers nur als Technikzeile, nicht in den Details der Meldung
  if (!j.ok) return { ok: false, art: 'kein-json', details: [], ...(j.meldung ? { technik: j.meldung } : {}) };
  const daten = j.daten as Record<string, unknown>;
  if (!('meta' in daten || 'schemaVersion' in daten)) return { ok: false, art: 'kein-projekt', details: [] };
  // Versionsregel zuerst und ohne die Antwort zu verändern (AF-003): abgelehnt wird nur eine höhere oder fehlende
  // schemaVersion, mit Meldung; ältere Stände heben ladeProjektDaten über migriere() auf die aktuelle Version.
  const versionsfehler = pruefeSchemaVersion(daten);
  if (versionsfehler) return { ok: false, art: versionsfehler.art, details: [], version: versionsfehler.version, technik: technikText(versionsfehler) };
  const ergaenzt = ergaenzeKiErgebnis(daten);
  const r = ladeProjektDaten(daten);
  return r.ok ? { ...r, ergaenzt } : r;
}
