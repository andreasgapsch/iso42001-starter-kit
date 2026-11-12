// Dokumentenregister D-26 aus der Bibliothek: Firmendokumente und eigene Dateien ohne Registereintrag kommen als Zeilen
// dazu, registrierte Dokumente erhalten den Pfad ihrer Datei und eine Version in Arbeit als Bemerkung.
// Ohne Bibliothek (Projekt.bibliothek fehlt oder ist leer) ändert sich nichts.
import type { DokumentEintrag, Projekt } from '../model/typen.ts';
import { registerZeile } from './aenderungen.ts';
import { neuesteVersion, sichtVon, vergleicheVersion } from './sicht.ts';

export interface RegisterAusBibliothek {
  /** Projekt mit den zusätzlichen Zeilen in dokumente[] */
  projekt: Projekt;
  /** Titel der zusätzlichen Zeilen (eigene Dateien, Dokumente ohne Katalog) */
  titel: Record<string, string>;
  /** Kennungen der eigenen Dateien (Art «Dokument» im Register) */
  eigene: Set<string>;
  /** Datei der gültigen bzw. neuesten Version je Kennung */
  datei: Record<string, string>;
  /** Neuere Version in Arbeit (Entwurf, in Prüfung) je Kennung */
  inArbeit: Record<string, { version: string; status: string }>;
}

/** Kennung einer Zusatzdatei: D-26-Register, D-26-EB-Register (Zusatz in der Dokumentsprache «de») */
export const ZUSATZ = /^[A-Z]-\d{2}(?:-EB)?-[A-Z][a-z]+$/;

export function registerAusBibliothek(p: Projekt): RegisterAusBibliothek | null {
  const eintraege = p.bibliothek?.eintraege.filter((e) => (e.art === 'firmendokument' || e.art === 'eigene') && e.versionen.length) ?? [];
  if (!eintraege.length) return null;
  const zusatz: DokumentEintrag[] = [];
  const titel: Record<string, string> = {};
  const eigene = new Set<string>();
  const datei: Record<string, string> = {};
  const inArbeit: Record<string, { version: string; status: string }> = {};
  for (const e of eintraege) {
    // Zusatzdateien eines Dokuments (Register zu D-26) gehören zu ihrem Dokument, keine eigene Zeile
    if (ZUSATZ.test(e.id)) continue;
    const r = p.dokumente.find((d) => d.id === e.id);
    const s = sichtVon(e, { id: e.id, art: e.art, register: r });
    const neueste = s.versionen.at(-1)!;
    const gueltig = [...s.versionen].reverse().find((v) => v.status === 'freigegeben');
    if (s.status === 'archiviert' && !r) continue;
    if (r) {
      const passend = s.versionen.find((v) => v.version === r.version) ?? gueltig;
      if (passend) datei[e.id] = passend.datei;
      if (vergleicheVersion(neueste.version, r.version || '0') > 0 && neueste.status !== 'freigegeben') inArbeit[e.id] = { version: neueste.version, status: neueste.status };
      continue;
    }
    const basis = gueltig ?? neueste;
    const zeile = registerZeile(e, basis, gueltig ? 'freigegeben' : basis.status, p.meta.dokumentSprache);
    // Änderungshistorie aus den freigegebenen Versionen
    const historie = s.versionen.filter((v) => v.freigabe?.am && (v.status === 'freigegeben' || v.status === 'ersetzt'));
    if (historie.length) zeile.aenderungen = historie.map((v) => ({ version: v.version, datum: v.freigabe!.am, was: v.aenderung ?? '', ...(v.freigabe?.von ? { von: String(v.freigabe.von) } : {}) }));
    zusatz.push(zeile);
    titel[e.id] = s.titel;
    if (e.art === 'eigene') eigene.add(e.id);
    datei[e.id] = basis.datei;
    if (gueltig && neueste !== gueltig && neueste.status !== 'freigegeben') inArbeit[e.id] = { version: neueste.version, status: neueste.status };
  }
  return { projekt: { ...p, dokumente: [...p.dokumente, ...zusatz] }, titel, eigene, datei, inArbeit };
}

/** Neueste Datei eines Eintrags (für Ablageort und Vorschau) */
export function neuesteDatei(p: Projekt, id: string): string | undefined {
  const e = p.bibliothek?.eintraege.find((x) => x.id === id);
  return e ? neuesteVersion(e.versionen)?.datei : undefined;
}
