// Verfahrensvorgaben in Firmendokumenten (D-12, D-13): Platzhalter mit Projektdaten füllen.
//
// Regel für Vorgaben ohne eigenes Modellfeld (z. B. «[[10 bis 30]] Testfälle», «[[80 %]]»): Sie sind Vorschläge des Kits,
// die das Unternehmen mit der Freigabe des Dokuments übernimmt. Im Firmendokument erscheinen sie deshalb als normaler
// Text, sobald das Dokument im Register freigegeben ist (DokumentEintrag.status «freigegeben»); vorher bleiben sie
// gelb markiert. Platzhalter mit eigenem Feld (Meldestelle, Ablageort, Person) werden zuerst aus dem Projekt gefüllt
// und bleiben markiert, wenn die Angabe fehlt.
import type { Text } from '../generator/ir.ts';
import type { Helfer, VorlagenKontext } from './kontext.ts';

const alsMd = (t: Text): string => (typeof t === 'string' ? t : t.map((l) => (l.platzhalter ? `[[${l.text}]]` : l.text)).join(''));
const ALLGEMEIN = ['text', 'liste', 'zahl', 'datum', 'person', 'eigner', 'freigabe', 'ort', 'ki_system', 'meldestelle', 'version'];
const gleich = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export interface VorgabenWerte {
  /** Ablageort für Aufzeichnungen */
  ablage?: string;
  /** Person für Freigaben (Name, Funktion) */
  person?: string;
  /** weitere Platzhalter: Platzhaltertext (ohne Klammern, Gross-/Kleinschreibung egal) -> Wert */
  weitere?: Record<string, string | undefined>;
}

/** Liefert eine Funktion, die Platzhalter in Auszeichnungstexten ersetzt (siehe Regel oben). */
export function vorgabenFueller(ctx: VorlagenKontext, h: Helfer, dokumentId: string, werte: VorgabenWerte): (text: string) => string {
  if (h.istLeer) return (t) => t;
  const { u } = ctx;
  const freigegeben = h.dokEintrag(dokumentId)?.status === 'freigegeben';
  const meldestelle = alsMd(h.meldestelle());
  const ersatz: [string, string | undefined][] = [
    [u.t('allgemein.platzhalter.meldestelle'), meldestelle.startsWith('[[') ? undefined : meldestelle],
    [u.t('allgemein.platzhalter.ort'), werte.ablage],
    [u.t('allgemein.platzhalter.person'), werte.person],
    ...Object.entries(werte.weitere ?? {}),
  ];
  return (text) =>
    text.replace(/\[\[(.+?)\]\]/g, (ganz, inhalt: string) => {
      const treffer = ersatz.find(([ph]) => gleich(ph, inhalt));
      if (treffer) return treffer[1]?.trim() ? treffer[1] : ganz;
      if (gleich(inhalt, u.t('allgemein.platzhalter.firmenname'))) return ctx.projekt.organisation.name || ganz;
      // Allgemeine Platzhalter (Text ergänzen, Datum, Zahl, ...) sind nie eine Vorgabe des Kits
      if (ALLGEMEIN.some((s) => gleich(u.t(`allgemein.platzhalter.${s}`), inhalt))) return ganz;
      return freigegeben ? inhalt : ganz;
    });
}

/** Ablage aus dem Dokumentenregister (Eintrag des Dokuments), sonst Grundregel der Dokumentenlenkung */
export function ablageVon(ctx: VorlagenKontext, h: Helfer, dokumentId: string): string | undefined {
  return h.dokEintrag(dokumentId)?.ablageort || ctx.projekt.organisation.dokumentenlenkung?.ablage || undefined;
}
