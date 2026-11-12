// Fällige Aufgaben für Start, Übersicht › Fällig und Hinweise: Überprüfungen (KI-Systeme, Dokumente, Folgenabschätzungen,
// Lieferanten, Leitlinie), Aufgaben aus dem Jahreskalender, Durchführungen der Prozesse und Massnahmen mit Termin.
// Stichtag wie im Lagebild (stichtagVon): Beispiele mit Datenstand in der Zukunft zeigen ihre Fälligkeiten.
import type { Projekt } from '../../model/typen.ts';
import { dokumentTitelUi, inhalt, t } from '../i18n.ts';
import { faelligeUeberpruefungen } from '../logik/fortschritt.ts';
import { seitenIndex } from '../logik/gefuehrt.ts';
import { kalenderEintraege } from '../logik/kalender.ts';
import { staende, UI_TEXTE } from '../logik/prozesse.ts';
import { prozessTitel } from '../../prozesse/katalog.ts';
import { sprungRoute, type Route } from '../logik/routen.ts';
import { computed } from '@preact/signals';
import { projekt, stichtag, umfeld } from '../zustand/store.ts';

export type FaelligStand = 'ueberfaellig' | 'bald';

export interface FaelligeAufgabe {
  art: 'ueberpruefung' | 'kalender' | 'prozess' | 'massnahme' | 'bibliothek' | 'geaendert' | 'fehlt';
  /** Kennung für die Anzeige (KI-001, PR-08, M-004) oder leer */
  id: string;
  titel: string;
  /** Bereich als Wort (Register, Prozesse, Guide) */
  bereich: string;
  datum?: string;
  stand: FaelligStand;
  ziel: Route;
}

const tageZwischen = (von: string, bis: string) => Math.round((Date.parse(bis) - Date.parse(von)) / 86_400_000);

export function faelligeAufgaben(p: Projekt, stichtag: string, tage = 30): FaelligeAufgabe[] {
  const r: FaelligeAufgabe[] = [];
  const stand = (d: string): FaelligStand => (d < stichtag ? 'ueberfaellig' : 'bald');
  for (const f of faelligeUeberpruefungen(p, stichtag, tage)) {
    const ziel = f.bereich === 'organisation' ? sprungRoute('organisation/leitlinie') : sprungRoute(`${f.bereich}/${f.id}`);
    r.push({ art: 'ueberpruefung', id: f.id, titel: f.name, bereich: t(`module.${f.bereich}`), datum: f.datum, stand: stand(f.datum), ziel });
  }
  const u = umfeld.value;
  const kalender = seitenIndex(u.gefuehrt).get('J-kalender');
  if (kalender?.aufgaben) {
    for (const k of kalenderEintraege(p, kalender.aufgaben, stichtag, tage)) {
      if (k.stand !== 'ueberfaellig' && k.stand !== 'bald') continue;
      const etappe = u.gefuehrt.etappen.etappen.find((e) => e.seiten.includes(k.aufgabe.seite))?.id;
      r.push({
        art: 'kalender', id: '', titel: inhalt(`gefuehrt.kalender.${k.aufgabe.id}`) ?? k.aufgabe.id, bereich: inhalt('rahmen.bereich.guide') ?? 'Guide',
        datum: k.faellig, stand: k.stand, ziel: etappe ? { art: 'gefuehrt', etappe, seite: k.aufgabe.seite } : { art: 'gefuehrt' },
      });
    }
  }
  if (p.prozesse !== undefined) {
    for (const s of staende(p, stichtag)) {
      const d = s.naechsteFaelligkeit;
      if (!d || s.anwendbar === 'nein' || tageZwischen(stichtag, d) > tage) continue;
      r.push({ art: 'prozess', id: s.id, titel: prozessTitel(UI_TEXTE, s.id, p), bereich: inhalt('rahmen.bereich.prozesse') ?? 'Prozesse', datum: d, stand: stand(d), ziel: { art: 'prozesse', id: s.id } });
    }
  }
  for (const m of p.massnahmen) {
    if ((m.status !== 'offen' && m.status !== 'in-arbeit') || !m.termin || tageZwischen(stichtag, m.termin) > tage) continue;
    r.push({ art: 'massnahme', id: m.id, titel: m.titel || m.id, bereich: t('module.massnahmen'), datum: m.termin, stand: stand(m.termin), ziel: { art: 'formular', modul: 'massnahmen', id: m.id } });
  }
  // Bibliothek (ab rc.10): Prüftermine der Einträge ohne Registereintrag (Firmendokumente zählen über das Register oben)
  // und Befunde des letzten Abgleichs (Datei ausserhalb geändert H78, Datei fehlt H79) als sofort zu erledigen
  const bib = p.bibliothek;
  if (bib) {
    const imRegister = new Set(p.dokumente.map((d) => d.id));
    const titelVon = (id: string) => {
      const e = bib.eintraege.find((x) => x.id === id);
      return e?.titel || (e?.art === 'firmendokument' || /^[DE]-\d/.test(id) ? dokumentTitelUi(id) : id);
    };
    const ziel = (id: string): Route => sprungRoute(`bibliothek/${id}`);
    const bereich = inhalt('rahmen.bereich.bibliothek') ?? 'Bibliothek';
    for (const e of bib.eintraege) {
      const d = e.naechstePruefung;
      if (!d || imRegister.has(e.id) || e.status === 'archiviert' || e.status === 'ersetzt' || e.art === 'vorlage' || e.art === 'rechtstext') continue;
      if (tageZwischen(stichtag, d) > tage) continue;
      r.push({ art: 'bibliothek', id: e.id, titel: titelVon(e.id), bereich, datum: d, stand: stand(d), ziel: ziel(e.id) });
    }
    for (const id of bib.abgleich?.geaendert ?? []) r.push({ art: 'geaendert', id, titel: titelVon(id), bereich, stand: 'ueberfaellig', ziel: ziel(id) });
    for (const id of bib.abgleich?.fehlend ?? []) r.push({ art: 'fehlt', id, titel: titelVon(id), bereich, stand: 'ueberfaellig', ziel: ziel(id) });
  }
  return r.sort((a, b) => (a.stand === b.stand ? (a.datum ?? '9999').localeCompare(b.datum ?? '9999') : a.stand === 'ueberfaellig' ? -1 : 1));
}

/** Fällige Aufgaben des geöffneten Projekts (Start, Übersicht, Hinweise, Punkt in der Symbolleiste) */
export const faelligListe = computed(() => {
  const p = projekt.value;
  return p ? faelligeAufgaben(p, stichtag.value) : [];
});
