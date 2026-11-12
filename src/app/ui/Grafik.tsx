// Grafiken der App mit Texten und Routen: Risikomatrix vor und nach Behandlung (Lagebild, Risiken, E6), Vorschau der
// Matrix beim Festlegen der Grenzen, Stufe eines Risikowerts als Pille. Daten aus src/grafik/daten.ts, Darstellung aus
// src/grafik/preact; hier nur Beschriftung (t()) und Sprungziele.
import type { Projekt, Risiko } from '../../model/typen.ts';
import { matrixRisiken, risikoMatrix, skalenStufen, stufeAusWert, werteJeStufe, type MatrixStand, type MatrixZelle, type RisikoMatrix, type Risikostufe } from '../../grafik/daten.ts';
import { Legende, Risikomatrix, type RisikoListe, type RisikomatrixTexte } from '../../grafik/preact/Risikomatrix.tsx';
import { optionText, t } from '../i18n.ts';
import { routeZuHash } from '../logik/routen.ts';
import { StatusPille, type StatusArt } from './StatusPille.tsx';

/** Farbton der Pille je Stufe (Form und Wort, nicht nur Farbe). */
export const STUFE_TON: Record<Risikostufe, 'gut' | 'warnung' | 'kritisch'> = { tief: 'gut', mittel: 'warnung', hoch: 'kritisch' };

export function stufeText(s: Risikostufe): string {
  return t(`grafik.stufe.${s}`);
}

/** Risikowert mit Stufe als Pille, z. B. «12 hoch»; leer ohne Bewertung. */
export function StufePille({ w, a, p }: { w: number | null | undefined; a: number | null | undefined; p: Projekt }) {
  if (typeof w !== 'number' || typeof a !== 'number' || !w || !a) return null;
  const stufe = stufeAusWert(w * a, p.organisation.risikokriterien);
  return <StatusPille art={STUFE_TON[stufe] as StatusArt} data-stufe={stufe}>{t('grafik.stufe_spalte', { wert: w * a, stufe: stufeText(stufe) })}</StatusPille>;
}

function namen(liste: { stufe: number; bezeichnung: string }[]): Record<number, string> {
  return Object.fromEntries(liste.filter((x) => x.bezeichnung?.trim()).map((x) => [x.stufe, x.bezeichnung.trim()]));
}

/** Legendentexte aus den eigenen Grenzen und Skalen (mittel: erreichbare Werte zwischen den Grenzen). */
export function legendenTexte(p: Projekt): Record<Risikostufe, string> {
  const kr = p.organisation.risikokriterien;
  const s = skalenStufen(p);
  const mittel = werteJeStufe(s.w, s.a, kr).mittel;
  return {
    tief: t('grafik.legende_tief', { bis: kr.akzeptanzBis }),
    mittel: mittel.length ? t('grafik.legende_mittel', { von: mittel[0]!, bis: mittel.at(-1)! }) : t('grafik.legende_mittel_leer'),
    hoch: t('grafik.legende_hoch', { ab: kr.unannehmbarAb }),
  };
}

export function matrixTexte(p: Projekt, titel: string): RisikomatrixTexte {
  const kr = p.organisation.risikokriterien;
  const kurzW = t('grafik.kurz_w');
  const kurzA = t('grafik.kurz_a');
  const zeitraum = kr.zeitraum?.trim() ? optionText('zeitraum', kr.zeitraum.trim()) : '';
  return {
    titel,
    achseW: zeitraum ? `${t('grafik.achse_w')} (${zeitraum})` : t('grafik.achse_w'),
    achseA: t('grafik.achse_a'),
    kurzW,
    kurzA,
    namenW: namen(kr.wahrscheinlichkeit),
    namenA: namen(kr.auswirkung),
    legende: legendenTexte(p),
    stufe: { tief: stufeText('tief'), mittel: stufeText('mittel'), hoch: stufeText('hoch') },
    ecke: t('grafik.ecke'),
    zelleVor: (z: MatrixZelle) => t('grafik.zelle_vor', { kurzW, kurzA, w: z.w, a: z.a }),
    zelleMitte: (z: MatrixZelle) => t('grafik.zelle_mitte', { stufe: stufeText(z.stufe) }),
    zelleLink: t('grafik.zelle_link'),
  };
}

const werteFuer = (r: Risiko, stand: MatrixStand): [number | null, number | null] => (stand === 'vor' ? [r.w, r.a] : [r.wNach, r.aNach]);

/** Risiken einer Zelle (Filter der Risikoliste ?w=&a=&stand=); zählt wie die Matrix (ohne Chancen und geschlossene). */
export function risikenInZelle(risiken: readonly Risiko[], stand: MatrixStand, w: number, a: number, ki?: string): Risiko[] {
  return matrixRisiken(risiken, { kiSystem: ki }).filter((r) => {
    const [rw, ra] = werteFuer(r, stand);
    return rw === w && ra === a;
  });
}

function liste(p: Projekt, m: RisikoMatrix, ki?: string): RisikoListe {
  const kr = p.organisation.risikokriterien;
  const zeilen = matrixRisiken(p.risiken, { kiSystem: ki })
    .map((r) => ({ r, wa: werteFuer(r, m.stand) }))
    .filter((x): x is { r: Risiko; wa: [number, number] } => typeof x.wa[0] === 'number' && typeof x.wa[1] === 'number')
    .sort((x, y) => y.wa[0] * y.wa[1] - x.wa[0] * x.wa[1] || x.r.id.localeCompare(y.r.id))
    .map(({ r, wa: [w, a] }) => [r.id, r.titel || '', w, a, w * a, stufeText(stufeAusWert(w * a, kr))] as (string | number)[]);
  return {
    zusammenfassung: t('grafik.liste', { anzahl: zeilen.length }),
    kopf: [t('grafik.spalte_id'), t('grafik.spalte_titel'), t('grafik.kurz_w'), t('grafik.kurz_a'), t('grafik.spalte_wert'), t('grafik.spalte_stufe')],
    zeilen,
  };
}

function Fuss({ m }: { m: RisikoMatrix }) {
  return (
    <>
      <span>{t('grafik.bewertet', { anzahl: m.bewertet })}</span>
      <span>{t('grafik.ueber', { anzahl: m.jeStufe.mittel + m.jeStufe.hoch })}</span>
      {m.unbewertet.length > 0 && <span>{t('grafik.unbewertet', { anzahl: m.unbewertet.length })}</span>}
      {m.ausserhalb.length > 0 && <span>{t('grafik.ausserhalb', { anzahl: m.ausserhalb.length })}</span>}
    </>
  );
}

/**
 * Risikomatrix vor und nach Behandlung nebeneinander (kleine Vielfache statt Pfeile), Legende einmal darunter.
 * Belegte Zellen führen auf die gefilterte Risikoliste (#/formular/risiken?w=&a=&stand=, mit ?ki= wenn gesetzt).
 */
export function RisikoMatrizen({ p, ki, aktiv, id = 'matrix', mitListe = true }: { p: Projekt; ki?: string; aktiv?: { w: number; a: number; stand: MatrixStand }; id?: string; mitListe?: boolean }) {
  const staende: MatrixStand[] = ['vor', 'nach'];
  const texte0 = matrixTexte(p, '');
  return (
    <div class="g-figur">
      <div class="g-matrizen">
        {staende.map((stand) => {
          const m = risikoMatrix(p, { stand, kiSystem: ki });
          return (
            <Risikomatrix
              key={stand}
              id={`${id}-${stand}`}
              matrix={m}
              texte={matrixTexte(p, t(stand === 'vor' ? 'grafik.matrix_vor' : 'grafik.matrix_nach'))}
              href={(z) => routeZuHash({ art: 'formular', modul: 'risiken', filter: { ...(ki ? { ki } : {}), w: String(z.w), a: String(z.a), stand } })}
              aktiv={aktiv?.stand === stand ? aktiv : undefined}
              legende={false}
              fuss={<Fuss m={m} />}
              liste={mitListe ? liste(p, m, ki) : undefined}
            />
          );
        })}
      </div>
      <Legende texte={texte0} />
    </div>
  );
}

/** Vorschau beim Festlegen der Skalen und Grenzen (E6, Organisation): nur Zonen, folgt den Eingaben sofort. */
export function MatrixVorschau({ p, id = 'matrix-vorschau' }: { p: Projekt; id?: string }) {
  const m = risikoMatrix({ ...p, risiken: [] }, { stand: 'vor' });
  return (
    <section class="karte abschnitt" id={id} aria-labelledby={`${id}-titel`}>
      <h2 id={`${id}-titel`}>{t('grafik.matrix_vorschau')}</h2>
      <p class="zweitext">{t('grafik.matrix_vorschau_text')}</p>
      <Risikomatrix id={`${id}-tabelle`} matrix={m} texte={matrixTexte(p, t('grafik.matrix_vorschau'))} mitAnzahl={false} />
    </section>
  );
}
