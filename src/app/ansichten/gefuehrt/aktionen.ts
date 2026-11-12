// Schreibaktionen des Guides auf den Store (Einträge anlegen, Felder setzen, Seiten besuchen, «später»).
import type { Projekt } from '../../../model/typen.ts';
import { eintragLoeschen, eintragMitId, neuerControlEintrag, neuerDokumentEintrag, neuerEintrag } from '../../logik/eintraege.ts';
import type { FeldDef, SeiteDef } from '../../logik/gefuehrt-typen.ts';
import { checklistenSchluessel, type SeitenEintrag } from '../../logik/gefuehrt.ts';
import { idMerken, istListenName } from '../../logik/ids.ts';
import { segmente, setze } from '../../logik/pfad.ts';
import { aendere, aendereMit, projekt } from '../../zustand/store.ts';

/** Legt einen noch nicht vorhandenen Eintrag an (Control, Folgenabschätzung, Dokument) und liefert den Index. */
function stelleSicher(p: Projekt, e: SeitenEintrag): number {
  const liste = (p as unknown as Record<string, Record<string, unknown>[]>)[e.liste]!;
  let i = liste.findIndex((x) => x['id'] === e.id || (e.liste === 'folgenabschaetzungen' && e.kiSystem && x['kiSystem'] === e.kiSystem));
  if (i >= 0) return i;
  let neu: Record<string, unknown>;
  if (e.liste === 'controls') neu = neuerControlEintrag(e.id) as unknown as Record<string, unknown>;
  else if (e.liste === 'dokumente') neu = neuerDokumentEintrag(e.id) as unknown as Record<string, unknown>;
  else if (e.liste === 'folgenabschaetzungen') neu = neuerEintrag(p, 'folgenabschaetzungen', { kiSystem: e.kiSystem ?? '' });
  else if (istListenName(e.liste)) {
    // Fest vorgegebene ID: keine Nummer aus dem Zähler verbrauchen, aber die vorgegebene als vergeben festhalten (AF-010)
    neu = { ...eintragMitId(e.liste, e.id), ...e.objekt, id: e.id };
    idMerken(p, e.liste, e.id);
  }
  else neu = { ...e.objekt };
  liste.push(neu);
  i = liste.length - 1;
  return i;
}

export function schreibeFeld(f: FeldDef, wert: unknown, e?: SeitenEintrag): void {
  if (f.typ === 'checkliste') {
    aendere(['meta', 'checklisten', checklistenSchluessel(f, e?.kiSystem ?? e?.id ?? '')], wert);
    return;
  }
  if (!f.pfad) return;
  if (!e) {
    if (f.setzt && typeof wert === 'string' && f.setzt[wert]) {
      const weitere = f.setzt[wert]!;
      aendereMit((p) => {
        let n = setze(p, f.pfad!, wert);
        for (const [pf, w] of Object.entries(weitere)) n = setze(n, pf, w);
        return n;
      });
      return;
    }
    aendere(f.pfad, wert);
    return;
  }
  if (e.neu) {
    aendereMit((p) => {
      const i = stelleSicher(p, e);
      return setze(p, [e.liste, i, ...segmente(f.pfad!)], wert);
    });
    return;
  }
  // Ohne Kopie des ganzen Projekts (schnell auch bei 1000 Risiken)
  const liste = (projekt.value as unknown as Record<string, { id: string }[]> | null)?.[e.liste];
  const i = liste?.findIndex((x) => x.id === e.id) ?? -1;
  if (i >= 0) aendere([e.liste, i, ...segmente(f.pfad)], wert);
}

export function eintragHinzufuegen(s: SeiteDef, werte: Record<string, unknown> = {}): string {
  let id = '';
  const liste = s.liste ?? '';
  if (!istListenName(liste)) return '';
  aendereMit((p) => {
    // Filter der Seite: der neue Eintrag erscheint auf ihr (C4-01, RACI-Zeile mit Bereich statt ohne Felder)
    const e = neuerEintrag(p, liste, { ...(s.vorgabe ?? {}), ...werte }, s.filter);
    id = String(e['id']);
    (p[liste] as unknown as Record<string, unknown>[]).push(e);
  });
  return id;
}

/**
 * Löscht den Eintrag samt aller Verweise auf ihn (AF-009) und hält seine Nummer im Zähler fest (AF-010). Die Oberfläche
 * zeigt vorher die abhängigen Einträge (ui/Loeschen.tsx); kein Eintrag verschwindet mit stehenden Verweisen.
 */
export function eintragEntfernen(liste: string, id: string): void {
  aendereMit((p) => {
    if (istListenName(liste)) {
      eintragLoeschen(p, liste, id);
      return;
    }
    const l = (p as unknown as Record<string, { id: string }[]>)[liste];
    if (!l) return;
    const i = l.findIndex((x) => x.id === id);
    if (i >= 0) l.splice(i, 1);
  });
}

/** Seite als besucht vermerken, «später» aufheben oder setzen und die Stelle zum Weitermachen merken (Ziel der Navigation, sonst die Seite selbst). */
export function seiteVerlassen(etappe: string, seite: string, art: 'weiter' | 'spaeter', naechsteSeite?: string): void {
  aendereMit((p) => {
    const g = p.meta.gefuehrt;
    const st = g.etappen[etappe] ?? { status: 'in-arbeit', spaeter: [] };
    const besucht = new Set(st.besucht ?? []);
    besucht.add(seite);
    const spaeter = st.spaeter.filter((x) => x !== seite);
    if (art === 'spaeter') spaeter.push(seite);
    g.etappen[etappe] = { ...st, status: st.status === 'erledigt' ? 'erledigt' : 'in-arbeit', spaeter, besucht: [...besucht] };
    g.aktuelleEtappe = etappe;
    g.aktuelleSeite = naechsteSeite ?? seite;
  });
}

/** Listenseite ohne Eintrag als «kein Eintrag nötig» vermerken oder den Vermerk aufheben (meta.gefuehrt.nichtNoetig). */
export function nichtNoetigSetzen(seite: string, an: boolean): void {
  aendereMit((p) => {
    const liste = new Set(p.meta.gefuehrt.nichtNoetig ?? []);
    if (an) liste.add(seite);
    else liste.delete(seite);
    if (liste.size) p.meta.gefuehrt.nichtNoetig = [...liste];
    else delete p.meta.gefuehrt.nichtNoetig;
  });
}

/** Stelle im Guide merken (z. B. vor dem Speichern), damit «Weitermachen» nach dem Öffnen dorthin führt. */
export function stelleMerken(etappe: string, seite: string): void {
  const g = projekt.value?.meta.gefuehrt;
  if (!g || (g.aktuelleEtappe === etappe && g.aktuelleSeite === seite)) return;
  aendereMit((p) => {
    p.meta.gefuehrt.aktuelleEtappe = etappe;
    p.meta.gefuehrt.aktuelleSeite = seite;
  });
}

export function etappeAbschliessen(etappe: string, erledigt: boolean, naechste?: { etappe: string; seite: string }): void {
  aendereMit((p) => {
    const st = p.meta.gefuehrt.etappen[etappe] ?? { status: 'offen', spaeter: [] };
    p.meta.gefuehrt.etappen[etappe] = { ...st, status: erledigt ? 'erledigt' : 'in-arbeit' };
    if (naechste) {
      p.meta.gefuehrt.aktuelleEtappe = naechste.etappe;
      p.meta.gefuehrt.aktuelleSeite = naechste.seite;
    }
  });
}

/** Offener Punkt (Checkliste oder Seite) als Massnahme übernehmen. Liefert die neue ID. */
export function alsMassnahme(titel: string, ref: string): string {
  let id = '';
  aendereMit((p) => {
    const m = neuerEintrag(p, 'massnahmen', { titel, herkunft: { art: 'checkliste', ref }, prioritaet: 'mittel' });
    id = String(m['id']);
    p.massnahmen.push(m as never);
  });
  return id;
}
