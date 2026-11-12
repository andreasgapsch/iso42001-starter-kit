// Prüfung von bibliothek.json vor der Übernahme: Die Datei kommt von aussen (Sicherung, verbundener Ordner). Jeder Eintrag läuft
// durch das Schema der Projektdatei; was nicht passt, wird gemeldet und nicht übernommen. Danach wird das zusammengeführte
// Projekt geprüft wie beim Teilimport, damit die Übernahme nie eine unlesbare Projektdatei erzeugen kann.
import { jsonAusVertrauen } from '../../eingang/lesen.ts';
import { pfadSicher } from '../../bibliothek/layout.ts';
import { REGISTER_MAX_EINTRAEGE, REGISTER_MAX_VERSIONEN, registerUebernehmen, type RegisterDatei } from '../../bibliothek/register-datei.ts';
import type { Projekt } from '../../model/typen.ts';
import { pruefeProjektDaten, schemaFehlerText, type SchemaFehlerFormat } from './laden.ts';

export interface RegisterGeprueft {
  /** Register nur mit den gültigen Einträgen */
  register: RegisterDatei;
  abgelehnt: { id: string; details: string[] }[];
  /** bibliothek.json gehört zu einem anderen Projekt */
  fremdesProjekt: boolean;
}

/** Minimales gültiges Projekt: Einträge werden einzeln geprüft, ohne jedes Mal das ganze Projekt zu durchlaufen */
function huelle(p: Projekt): Record<string, unknown> {
  const h: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) h[k] = Array.isArray(v) ? [] : v;
  return h;
}

export function registerPruefen(p: Projekt, d: RegisterDatei, fmt?: SchemaFehlerFormat): RegisterGeprueft {
  const h = huelle(p);
  const gueltig: RegisterDatei['eintraege'] = [];
  const abgelehnt: RegisterGeprueft['abgelehnt'] = [];
  const gesehen = new Set<string>();
  // Mengen vor dem Prüfen begrenzen: Das Schema läuft je Eintrag, die Übernahme kopiert das Projekt
  let versionen = 0;
  for (const e of d.eintraege) {
    const id = typeof e?.id === 'string' ? e.id.slice(0, 60) : '?';
    versionen += e?.versionen?.length ?? 0;
    if (gueltig.length >= REGISTER_MAX_EINTRAEGE || versionen > REGISTER_MAX_VERSIONEN * 10 || (e?.versionen?.length ?? 0) > REGISTER_MAX_VERSIONEN) {
      abgelehnt.push({ id, details: ['versionen: zu viele Einträge oder Versionen'] });
      if (abgelehnt.length > 50) break;
      continue;
    }
    const r = pruefeProjektDaten({ ...h, bibliothek: { ...(p.bibliothek ?? {}), eintraege: [e] } });
    if (!r.ok) {
      abgelehnt.push({ id, details: schemaFehlerText(r.fehler, 3, fmt) });
      continue;
    }
    const pfade = (e.versionen ?? []).map((v) => v.datei);
    if (pfade.some((x) => !pfadSicher(x))) {
      abgelehnt.push({ id, details: ['versionen: unzulässiger Pfad'] });
      continue;
    }
    if (gesehen.has(e.id)) {
      abgelehnt.push({ id, details: ['id: mehrfach vergeben'] });
      continue;
    }
    gesehen.add(e.id);
    gueltig.push(e);
  }
  return { register: { ...d, eintraege: gueltig }, abgelehnt, fremdesProjekt: typeof d.projektId === 'string' && d.projektId !== p.meta.projektId };
}

/** Übernahme auf eine Kopie anwenden und das Ergebnis prüfen; wirft nichts, das Projekt bleibt unverändert. */
export function registerProbe(p: Projekt, d: RegisterDatei, fmt?: SchemaFehlerFormat): { ok: true } | { ok: false; details: string[] } {
  const kopie = structuredClone(p);
  registerUebernehmen(kopie, d);
  const r = pruefeProjektDaten(jsonAusVertrauen(JSON.stringify(kopie), 'kopie'));
  return r.ok ? { ok: true } : { ok: false, details: schemaFehlerText(r.fehler, 5, fmt) };
}
