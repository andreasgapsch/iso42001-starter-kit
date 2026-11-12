// Fehler dosieren (Rollentest RT-12, Nutzertest rc.10 U-07): Ein neues Projekt verletzt fast alle Prüfregeln, weil noch
// nichts erfasst ist. Fehler aus Etappen, die noch nicht begonnen sind und nach der aktuellen Etappe liegen, gelten deshalb
// als «offen» (sie kommen im Lauf des Guides) und nicht als Fehler. Begonnen ist eine Etappe, wenn im Guide eine ihrer
// Seiten bearbeitet wurde oder das Projekt schon Angaben dieser Etappe enthält (z. B. im Register erfasst). Als Fehler
// zählen Befunde aus begonnenen Etappen, aus Etappen bis zur aktuellen und Befunde ohne Seite im Guide. Symbolleiste,
// Untermenü der Prüfung, Stage-1-Bereitschaft und Überblick des Guides zählen gleich.
import { leeresProjekt as leeresProjektNeu } from '../../model/neu.ts';
import type { Projekt } from '../../model/typen.ts';
import type { EtappeDef, SeiteDef } from './gefuehrt-typen.ts';
import { aktiveEtappen, aktiveFelder, aktiveSeiten, feldWert, seitenIndex, weitermachenZiel, type Umfeld } from './gefuehrt.ts';
import { istLeer, lies } from './pfad.ts';
import type { Befund } from './pruefung.ts';
import { gefuehrtSprung } from './pruefsprung.ts';
import { etappenStand } from './ueberblick.ts';

export interface FehlerDosiert {
  /** Fehler, die jetzt zählen */
  jetzt: Befund[];
  /** Fehler aus Etappen, die noch kommen (neutral «offen») */
  spaeter: Befund[];
  hinweise: Befund[];
}

export function fehlerDosiert(p: Projekt, u: Umfeld, befunde: readonly Befund[]): FehlerDosiert {
  const fehler = befunde.filter((b) => b.schwere === 'fehler');
  const hinweise = befunde.filter((b) => b.schwere !== 'fehler');
  if (!fehler.length) return { jetzt: [], spaeter: [], hinweise };
  const index = seitenIndex(u.gefuehrt);
  const etappen = aktiveEtappen(u.gefuehrt, p);
  const reihenfolge = etappen.map((e) => e.id);
  const ziel = weitermachenZiel(p, u);
  const bis = Math.max(reihenfolge.indexOf(ziel?.etappe ?? ''), 0);
  const leer = leeresProjekt(p);
  const merke = <T>(m: Map<string, T>, k: string, f: () => T): T => (m.has(k) ? m.get(k)! : (m.set(k, f()), m.get(k)!));
  const imGuide = new Map<string, boolean>();
  const angaben = new Map<string, boolean>();
  // Etappe im Guide noch nicht begonnen (keine Seite besucht oder zurückgestellt)
  const offenImGuide = (e: EtappeDef) => merke(imGuide, e.id, () => etappenStand(e, p, u, index).zustand === 'offen');
  // Angaben der Seite des Befunds (oder der ganzen Etappe, wenn der Sprung keine Seite nennt), auch aus dem Register
  const mitAngaben = (e: EtappeDef, seite?: string) => merke(angaben, `${e.id}/${seite ?? ''}`, () => {
    const seiten = aktiveSeiten(u.gefuehrt, e, p, index).filter((x): x is SeiteDef => x.typ !== 'fehlt' && (!seite || x.id === seite));
    return seiten.some((x) => seiteHatAngaben(x, p, leer));
  });
  const jetzt: Befund[] = [];
  const spaeter: Befund[] = [];
  for (const b of fehler) {
    const r = gefuehrtSprung(b, p, u.gefuehrt);
    const e = r && r.art === 'gefuehrt' && r.etappe ? etappen.find((x) => x.id === r.etappe) : undefined;
    // Pflicht mit Termin in der Zukunft (F15: internes Audit geplant, C4-08): offen bis zum Termin, wie aus kommenden Etappen
    const kommt = !!b.faellig || (!!e && reihenfolge.indexOf(e.id) > bis && offenImGuide(e) && !mitAngaben(e, r!.art === 'gefuehrt' ? r!.seite : undefined));
    (kommt ? spaeter : jetzt).push(b);
  }
  return { jetzt, spaeter, hinweise };
}

/** Listen, die sich als Nebenwirkung anderer Aktionen füllen (Dokumente erzeugen, Bibliothek) */
const NEBENBEI = new Set(['dokumente', 'nachweise']);

/** Vergleichsprojekt ohne Angaben: Vorgaben eines neuen Projekts zählen nicht als Angaben */
function leeresProjekt(p: Projekt): Projekt {
  return leeresProjektNeu({ sprache: p.meta.dokumentSprache, mitIsms: p.meta.mitIsms, modulAiAct: p.meta.modulAiAct, projektId: p.meta.projektId, jetzt: p.meta.erstellt });
}

const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Hat das Projekt Angaben, die auf diese Seite gehören? Listenseiten: ein Eintrag mit einem Feld der Seite; SoA-Seiten:
 * Entscheide abweichend von der Vorgabe; übrige Seiten: ein Feld, das von der Vorgabe eines neuen Projekts abweicht.
 */
function seiteHatAngaben(s: SeiteDef, p: Projekt, leer: Projekt): boolean {
  if (s.liste) {
    if (NEBENBEI.has(s.liste)) return false;
    const liste = lies(p, s.liste);
    if (!Array.isArray(liste) || !liste.length) return false;
    const felder = aktiveFelder(s, p).filter((f) => f.pfad);
    return liste.some((eintrag) => felder.length === 0 || felder.some((f) => { const w = lies(eintrag, f.pfad!); return !istLeer(w) && w !== false; }));
  }
  if (s.typ === 'soa') return !gleich(p.controls, leer.controls);
  return aktiveFelder(s, p).some((f) => f.pfad && !istLeer(feldWert(f, p)) && !gleich(feldWert(f, p), lies(leer, f.pfad)));
}
