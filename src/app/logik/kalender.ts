// Jahreskalender (Seitentyp kalender): wiederkehrende Aufgaben mit Fälligkeit aus der Projektdatei.
// faelligAus: Datumsfeld (auch «liste[].feld»), frühestes offenes Datum zählt; monatAus: gewählter Monat im laufenden Jahr.
import type { Projekt } from '../../model/typen.ts';
import { erfuellt } from './bedingungen.ts';
import type { KalenderAufgabe } from './gefuehrt-typen.ts';
import { lies } from './pfad.ts';

export const MONATE = ['januar', 'februar', 'maerz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];
export const RHYTHMUS_MONATE: Record<string, number> = { monatlich: 1, quartalsweise: 3, halbjaehrlich: 6, jaehrlich: 12 };

export type KalenderStand = 'erledigt' | 'ueberfaellig' | 'bald' | 'geplant' | 'offen';

export interface KalenderEintrag {
  aufgabe: KalenderAufgabe;
  schluessel: string;
  erledigt: boolean;
  /** frühestes fälliges Datum JJJJ-MM-TT */
  faellig?: string;
  /** gewählter Monat (Wert aus Optionsgruppe monat) */
  monat?: string;
  /** Anzahl Einträge mit überschrittenem Datum (faelligAus mit Liste) */
  ueberfaelligeEintraege: number;
  /** betroffene Einträge (ID und Name) mit überschrittenem Datum */
  betroffen: { id: string; name: string; datum: string }[];
  stand: KalenderStand;
}

function tageBis(heute: string, datum: string): number {
  return Math.round((Date.parse(datum) - Date.parse(heute)) / 86_400_000);
}

export function kalenderEintraege(p: Projekt, aufgaben: readonly KalenderAufgabe[], heute: string, baldTage = 30): KalenderEintrag[] {
  const jahr = heute.slice(0, 4);
  const r: KalenderEintrag[] = [];
  for (const a of aufgaben) {
    if (!erfuellt(a.wenn, p)) continue;
    const schluessel = `J-${a.id}-${jahr}`;
    const erledigt = p.meta.checklisten[schluessel]?.erledigt === true;
    const betroffen: KalenderEintrag['betroffen'] = [];
    let faellig: string | undefined;
    if (a.faelligAus) {
      const [liste, feld] = a.faelligAus.split('[].') as [string, string | undefined];
      if (feld) {
        for (const x of ((lies(p, liste) as Record<string, unknown>[] | undefined) ?? [])) {
          const d = x[feld];
          if (typeof d !== 'string' || !d) continue;
          if (!faellig || d < faellig) faellig = d;
          if (d < heute) betroffen.push({ id: String(x['id'] ?? ''), name: String(x['name'] ?? x['titel'] ?? x['id'] ?? ''), datum: d });
        }
      } else {
        const d = lies(p, a.faelligAus);
        if (typeof d === 'string' && d) {
          faellig = d;
          if (d < heute) betroffen.push({ id: a.faelligAus, name: '', datum: d });
        }
      }
    }
    const monat = a.monatAus ? (lies(p, a.monatAus) as string | undefined) : undefined;
    if (!faellig && monat && MONATE.includes(monat)) {
      const m = MONATE.indexOf(monat) + 1;
      // Letzter Tag des gewählten Monats im laufenden Jahr
      faellig = new Date(Date.UTC(Number(jahr), m, 0)).toISOString().slice(0, 10);
    }
    let stand: KalenderStand = 'offen';
    if (erledigt && betroffen.length === 0) stand = 'erledigt';
    else if (faellig && faellig < heute) stand = 'ueberfaellig';
    else if (faellig && tageBis(heute, faellig) <= baldTage) stand = 'bald';
    else if (faellig) stand = 'geplant';
    r.push({ aufgabe: a, schluessel, erledigt, faellig, monat, ueberfaelligeEintraege: betroffen.length, betroffen: betroffen.sort((x, y) => x.datum.localeCompare(y.datum)), stand });
  }
  const rang: Record<KalenderStand, number> = { ueberfaellig: 0, bald: 1, geplant: 2, offen: 3, erledigt: 4 };
  return r.sort((x, y) => rang[x.stand] - rang[y.stand] || (x.faellig ?? '9999').localeCompare(y.faellig ?? '9999'));
}
