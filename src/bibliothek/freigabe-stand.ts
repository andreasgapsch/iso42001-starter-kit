// Eine Freigabewahrheit je Dokument (Bericht C, C-10): Guide, Register, Bibliothek, Stage-1-Bericht und Dokumentkopf rechnen hier
// gleich. Vorrang: Dokumentenregister, dann die Freigabe in den Projektdaten (Projektauftrag, Geltungsbereich, Leitlinie,
// Folgenabschätzung), dann die Datei in der Bibliothek. Wer im Register eine Freigabe mit Person und Datum trägt, ist freigegeben;
// so liest es auch der Dokumentkopf (src/vorlagen/kontext.ts, lenkung).
import type { DokumentEintrag, Freigabe, Projekt } from '../model/typen.ts';

/** Status eines Registereintrags: Freigabe mit Person und Datum gilt, auch wenn das Statusfeld (noch) anders lautet */
export function registerStatus(r: Pick<DokumentEintrag, 'status' | 'freigabe'>): DokumentEintrag['status'] {
  return (r.status === 'entwurf' || r.status === 'in-pruefung') && r.freigabe?.von && r.freigabe.am ? 'freigegeben' : r.status;
}

/** Freigabe aus den Projektdaten für Dokumente ohne Registereintrag (im Guide erfasst) */
export function projektFreigabe(p: Projekt, id: string): { freigabe?: Freigabe; version?: string } | undefined {
  const org = p.organisation;
  if (id === 'D-00') return { ...(org.projektauftrag?.freigabe ? { freigabe: org.projektauftrag.freigabe } : {}) };
  if (id === 'D-02') return { ...(org.geltungsbereich?.freigabe ? { freigabe: org.geltungsbereich.freigabe } : {}) };
  if (id === 'D-03') return { ...(org.leitlinie?.freigabe ? { freigabe: org.leitlinie.freigabe } : {}), ...(org.leitlinie?.version?.trim() ? { version: org.leitlinie.version.trim() } : {}) };
  const ia = /^D-09-(KI-\d+)$/.exec(id);
  if (ia) {
    const f = p.folgenabschaetzungen.find((x) => x.kiSystem === ia[1]);
    const neu = [...(f?.neubeurteilungen ?? [])].filter((n) => n.freigabe?.am).sort((a, b) => a.am.localeCompare(b.am)).at(-1)?.freigabe;
    const fg = neu ?? f?.freigabe;
    return fg ? { freigabe: fg } : undefined;
  }
  return undefined;
}

/** Virtueller Registereintrag für im Guide freigegebene Dokumente ohne eigene Zeile im Register */
export function registerAusProjekt(p: Projekt, id: string): DokumentEintrag | undefined {
  const f = projektFreigabe(p, id);
  if (!f?.freigabe?.von || !f.freigabe.am) return undefined;
  return { id, version: f.version ?? '1.0', status: 'freigegeben', freigabe: f.freigabe, ablageort: '', giltFuerIsms: id.endsWith('-EB') };
}
