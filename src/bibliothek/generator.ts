// Generator und Bibliothek: erzeugte Firmendokumente als neue Version (Entwurf) ablegen. Läuft im Worker; rein.
import type { Projekt } from '../model/typen.ts';
import { registerAusProjekt, registerStatus } from './freigabe-stand.ts';
import { naechsteVersion, neuesteVersion, vergleicheVersion } from './sicht.ts';

/**
 * Version für ein neu erzeugtes Dokument: Arbeitsfassung im Register ohne Datei behält ihre Nummer, sonst die nächste
 * Nebennummer nach der höchsten bekannten Version (Register oder Bibliothek). basis: Inhaltsprüfsumme der neuesten
 * erzeugten Version für den Vergleich «unverändert».
 */
export function generatorVersion(p: Projekt, regId: string): { version: string; basis?: string; freigegeben?: boolean } {
  const e = p.bibliothek?.eintraege.find((x) => x.id === regId);
  const r = p.dokumente.find((d) => d.id === regId);
  const neueste = e ? neuesteVersion(e.versionen) : undefined;
  // Schon freigegeben (im Guide oder im Register), aber noch ohne Datei dieser Version: die Datei trägt diese Freigabe,
  // keinen neuen Entwurf. Sonst widerspräche die Bibliothek dem Register und dem Dokumentkopf.
  // Ein Register mit Status «freigegeben» bleibt beim bisherigen Weg: neuer Inhalt ergibt die nächste Nebennummer als Entwurf.
  const frei = r ? (r.status !== 'freigegeben' && registerStatus(r) === 'freigegeben' ? r : undefined) : registerAusProjekt(p, regId);
  if (frei?.version && (!neueste || vergleicheVersion(frei.version, neueste.version) > 0)) {
    return { version: frei.version, freigegeben: true, ...(neueste?.basis ? { basis: neueste.basis } : {}) };
  }
  if (!neueste && r?.version && r.status !== 'freigegeben' && r.status !== 'veraltet') return { version: r.version };
  let hoechste = neueste?.version;
  if (r?.version && (!hoechste || vergleicheVersion(r.version, hoechste) > 0)) hoechste = r.version;
  return { version: hoechste ? naechsteVersion('firmendokument', hoechste) : '0.1', ...(neueste?.basis ? { basis: neueste.basis } : {}) };
}

/** Projekt, in dem das Dokument als Entwurf in der neuen Version gilt (für Dokumentkopf und Lenkungsangaben der Datei) */
export function mitEntwurf(p: Projekt, regId: string, version: string): Projekt {
  const alt = p.dokumente.find((d) => d.id === regId);
  const neu = alt
    ? { ...alt, version, status: 'entwurf' as const, freigabe: undefined, geprueft: undefined, bestaetigt: undefined }
    : { id: regId, version, status: 'entwurf' as const, ablageort: '', giltFuerIsms: regId.endsWith('-EB') };
  for (const k of ['freigabe', 'geprueft', 'bestaetigt'] as const) if (neu[k as keyof typeof neu] === undefined) delete (neu as Record<string, unknown>)[k];
  return { ...p, dokumente: alt ? p.dokumente.map((d) => (d === alt ? neu : d)) : [...p.dokumente, neu] };
}

/**
 * Projekt für den Vergleich «unverändert»: ohne Lenkung (Register, Bibliothek, Freigaben im Guide). Freigaben anderer Dokumente
 * ändern Verweise und Kopfangaben, aber nicht den Inhalt; sie sollen keine neue Version auslösen (C2-09). D-26 führt das
 * Register selbst als Inhalt und bleibt beim vollen Stand.
 */
export function vergleichsProjekt(p: Projekt, regId: string): Projekt {
  if (regId.startsWith('D-26')) return p;
  const org = structuredClone(p.organisation);
  if (org.projektauftrag) delete org.projektauftrag.freigabe;
  delete org.geltungsbereich.freigabe;
  delete org.leitlinie.freigabe;
  const { bibliothek: _b, ...rest } = p;
  return { ...rest, organisation: org, dokumente: [] } as Projekt;
}

/** Register-ID einer erzeugten Datei: Dokumente je KI-System mit der System-ID (D-09-KI-001) */
export function registerIdVon(id: string, kiSystemId?: string): string {
  return kiSystemId ? `${id}-${kiSystemId}` : id;
}
