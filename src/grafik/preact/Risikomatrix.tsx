// Risikomatrix für die App als echte HTML-Tabelle (Design System «Risikomatrix»): Spalten Wahrscheinlichkeit, Zeilen
// Auswirkung absteigend, jede Zelle mit Wert W×A, Stufe als Fläche und Wort (für Bildschirmleser), Anzahl Risiken.
// Belegte Zellen sind Links (gefilterte Risikoliste); Pfeiltasten springen zur nächsten belegten Zelle, Pos1 und Ende
// an den Anfang und das Ende der Zeile. Höchste Stufe schraffiert, Legende mit Wort, Textalternative als Tabelle.
import type { ComponentChildren } from 'preact';
import type { MatrixZelle, RisikoMatrix, Risikostufe } from '../daten.ts';
import { matrixZeilen, type MatrixTexte } from '../svg/risikomatrix.ts';

/** Pfeil der Achse als SVG (A-24: «→» fehlt in der eingebetteten Inter, im Druck kam er aus einer Ersatzschrift) */
const Pfeil = () => (
  <svg class="g-pfeil" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

export interface RisikomatrixTexte extends Omit<MatrixTexte, 'beschreibung'> {
  /** Unsichtbarer Text einer Zelle vor dem Wert, z. B. «W 3, A 4, Wert» (Bildschirmleser) */
  zelleVor: (z: MatrixZelle) => string;
  /** Unsichtbarer Text zwischen Wert und Anzahl, z. B. «, Stufe hoch, Risiken:» */
  zelleMitte: (z: MatrixZelle) => string;
  /** Unsichtbarer Text am Ende eines Links, z. B. «. Gefilterte Liste öffnen» */
  zelleLink: string;
  /** Kopf der Ecke (nur Bildschirmleser), z. B. «Auswirkung / Wahrscheinlichkeit» */
  ecke: string;
}

export interface RisikoListe {
  /** Text des Aufklappers, z. B. «Risiken als Tabelle (14)» */
  zusammenfassung: string;
  kopf: string[];
  /** Zeilen; Zahlenspalten als number (rechtsbündig) */
  zeilen: (string | number)[][];
}

export interface RisikomatrixProps {
  matrix: RisikoMatrix;
  /** Eindeutiges Präfix auf der Seite (Beschriftung, Tests) */
  id: string;
  texte: RisikomatrixTexte;
  /** Ziel einer belegten Zelle; ohne: keine Links */
  href?: (z: MatrixZelle) => string;
  /** Hervorgehobene Zelle (aktiver Filter) */
  aktiv?: { w: number; a: number };
  /** Anzahl zeigen (false: nur Zonen, z. B. Vorschau beim Festlegen der Grenzen) */
  mitAnzahl?: boolean;
  /** Zeile unter der Matrix, z. B. «nicht bewertet: 3» */
  fuss?: ComponentChildren;
  /** Textalternative: Risiken als Tabelle */
  liste?: RisikoListe;
  /** Legende zeigen (bei zwei Matrizen nebeneinander nur einmal) */
  legende?: boolean;
}

const STUFEN: Risikostufe[] = ['tief', 'mittel', 'hoch'];

/** Pfeiltasten: nächster Link in der Richtung (gleiche Zeile bzw. Spalte); Pos1, Ende: erster und letzter der Zeile. */
function tastatur(e: KeyboardEvent): void {
  const ziel = e.target as HTMLElement | null;
  if (!ziel || ziel.tagName !== 'A' || !ziel.dataset['w']) return;
  const tabelle = ziel.closest('table');
  if (!tabelle) return;
  const w = Number(ziel.dataset['w']);
  const a = Number(ziel.dataset['a']);
  const links = [...tabelle.querySelectorAll<HTMLAnchorElement>('a[data-w]')].map((l) => ({ l, w: Number(l.dataset['w']), a: Number(l.dataset['a']) }));
  let kandidaten: typeof links = [];
  let sortierung: (x: (typeof links)[number], y: (typeof links)[number]) => number = () => 0;
  switch (e.key) {
    case 'ArrowRight':
      kandidaten = links.filter((x) => x.a === a && x.w > w);
      sortierung = (x, y) => x.w - y.w;
      break;
    case 'ArrowLeft':
      kandidaten = links.filter((x) => x.a === a && x.w < w);
      sortierung = (x, y) => y.w - x.w;
      break;
    case 'ArrowUp':
      kandidaten = links.filter((x) => x.w === w && x.a > a);
      sortierung = (x, y) => x.a - y.a;
      break;
    case 'ArrowDown':
      kandidaten = links.filter((x) => x.w === w && x.a < a);
      sortierung = (x, y) => y.a - x.a;
      break;
    case 'Home':
      kandidaten = links.filter((x) => x.a === a);
      sortierung = (x, y) => x.w - y.w;
      break;
    case 'End':
      kandidaten = links.filter((x) => x.a === a);
      sortierung = (x, y) => y.w - x.w;
      break;
    default:
      return;
  }
  e.preventDefault();
  kandidaten.sort(sortierung)[0]?.l.focus();
}

export function Legende({ texte }: { texte: Pick<RisikomatrixTexte, 'legende'> }) {
  return (
    <ul class="g-legende">
      {STUFEN.map((s) => (
        <li key={s}><span class={`g-farbe g-stufe-${s}`} aria-hidden="true" />{texte.legende[s]}</li>
      ))}
    </ul>
  );
}

export function Risikomatrix(p: RisikomatrixProps) {
  const t = p.texte;
  const m = p.matrix;
  return (
    <figure class="g-matrix" id={p.id} data-stand={m.stand}>
      <div class="g-matrix__feld">
        <div class="g-matrix__achse-a" aria-hidden="true">{t.achseA} <Pfeil /></div>
        <table onKeyDown={tastatur}>
          <caption>{t.titel}</caption>
          <thead>
            <tr>
              <th class="g-matrix__ecke" scope="col"><span class="nur-sr">{t.ecke}</span></th>
              {m.w.map((w) => (
                <th key={w} scope="col">
                  {t.kurzW} {w}
                  {t.namenW?.[w] && <span class="g-matrix__name">{t.namenW[w]}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixZeilen(m).map((zeile) => {
              const a = zeile[0]!.a;
              return (
                <tr key={a}>
                  <th scope="row">
                    {t.kurzA} {a}
                    {t.namenA?.[a] && <span class="g-matrix__name">{t.namenA[a]}</span>}
                  </th>
                  {zeile.map((z) => {
                    const aktiv = p.aktiv?.w === z.w && p.aktiv?.a === z.a;
                    // Zugänglicher Name aus dem Inhalt (sichtbare Zahlen bleiben Teil des Namens): «W 3, A 4, Wert 12, Stufe hoch, Risiken: 2»
                    const link = !!p.href && z.anzahl > 0;
                    const inhalt = (
                      <>
                        <span class="g-matrix__wert"><span class="nur-sr">{t.zelleVor(z)} </span>{z.wert}<span class="nur-sr">{p.mitAnzahl !== false ? t.zelleMitte(z) : `, ${t.stufe[z.stufe]}`}</span></span>
                        {p.mitAnzahl !== false && <span class="g-matrix__anzahl">{z.anzahl > 0 ? z.anzahl : <span class="nur-sr">0</span>}{link && <span class="nur-sr">{t.zelleLink}</span>}</span>}
                      </>
                    );
                    return (
                      <td key={z.w} class={`g-stufe-${z.stufe}`} aria-current={aktiv ? 'true' : undefined} data-w={z.w} data-a={z.a} data-anzahl={z.anzahl}>
                        {link ? (
                          <a href={p.href!(z)} data-w={z.w} data-a={z.a}>{inhalt}</a>
                        ) : (
                          <span>{inhalt}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div class="g-matrix__achse-w" aria-hidden="true">{t.achseW} <Pfeil /></div>
      </div>
      {p.legende !== false && <Legende texte={t} />}
      {p.fuss && <p class="g-matrix__fuss">{p.fuss}</p>}
      {p.liste && p.liste.zeilen.length > 0 && (
        <details class="g-details">
          <summary>{p.liste.zusammenfassung}</summary>
          <table class="g-tabelle">
            <thead><tr>{p.liste.kopf.map((k, i) => <th key={i} scope="col">{k}</th>)}</tr></thead>
            <tbody>
              {p.liste.zeilen.map((z, i) => (
                <tr key={i}>{z.map((x, j) => (j === 0 ? <th key={j} scope="row">{x}</th> : <td key={j} class={typeof x === 'number' ? 'zahl' : undefined}>{x}</td>))}</tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </figure>
  );
}
