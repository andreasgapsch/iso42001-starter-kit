// Ablauf eines Prozesses im Raster (Plan Prozesse 8.3): Spalte = Bahn (Rolle), Zeile = Reihenfolge der Schritte. Eine
// Quelle für SVG in der App (src/grafik/svg/ablauf.ts), DOCX-Formen (D-27, AblaufBlock) und den draw.io-Export.
// Kanten rechtwinklig mit festen Seiten: vorwärts nach unten (gleiche Bahn) oder seitlich in die Zielbahn, Rücksprünge
// links bzw. rechts neben den Formen; Ausgänge einer Entscheidung tragen die Beschriftung aus den Zweigen.
import type { AblaufBlock, AblaufKante, AblaufKnoten } from '../generator/ir.ts';
import { ablaufZeilen, type AblaufDaten, type AblaufSeite } from '../grafik/svg/ablauf.ts';
import type { ProzessSchritt, ProzessSchrittArt } from '../model/typen.ts';
import { bahnText, type Ablauf, type TextQuelle } from './katalog.ts';

export const FORM_ZU_ABLAUF: Record<ProzessSchrittArt, AblaufKnoten['form']> = { start: 'start', aufgabe: 'schritt', entscheidung: 'frage', ende: 'ende' };

/** Mindestens drei Spalten, damit einzelne Bahnen nicht über die ganze Breite laufen */
export const MIN_SPALTEN = 3;

export interface ProzessRaster extends AblaufDaten {
  bahnen: { id: string; text: string; spalte: number }[];
  /** Zeilenhöhe in px (mehr Platz bei vielen Bahnen, weil die Formen schmaler sind) */
  zeilenHoehe: number;
}

/** Breite einer Spalte im SVG der App (px); die Zeilenhöhe richtet sich nach dem längsten Text in dieser Breite */
export const SPALTE_PX = 180;

/** Zeilenhöhe, damit jeder Text in die Form passt (SVG: Schrift 11 px, Spalte SPALTE_PX) */
function zeilenHoehe(texte: string[]): number {
  const zeilen = Math.max(1, ...texte.map((t) => ablaufZeilen(t, SPALTE_PX - 18 - 14, 11).length));
  return Math.max(56, Math.ceil(zeilen * 13.75 + 28));
}

/** Text einer Form: Schritt, bei Verweisen die Prozess-IDs in einer eigenen Zeile */
export function formText(s: ProzessSchritt): string {
  return s.verweis?.length ? `${s.text}\n→ ${s.verweis.join(', ')}` : s.text;
}

export function prozessRaster(a: Ablauf, q: TextQuelle): ProzessRaster {
  const benutzt = a.bahnen.filter((b) => a.schritte.some((s) => s.bahn === b.id));
  const spalteVon = new Map(benutzt.map((b, i) => [b.id, i]));
  // Zeilen: Schritte in Reihenfolge, Enden gemeinsam unten (je Bahn eine Zeile, falls mehrere Enden in einer Bahn)
  const zeileVon = new Map<string, number>();
  let z = 0;
  for (const s of a.schritte) if (s.art !== 'ende') zeileVon.set(s.id, z++);
  const endZeilen = new Map<number, number>();
  for (const s of a.schritte.filter((x) => x.art === 'ende')) {
    const sp = spalteVon.get(s.bahn) ?? 0;
    const n = endZeilen.get(sp) ?? 0;
    zeileVon.set(s.id, z + n);
    endZeilen.set(sp, n + 1);
  }
  const zeilen = z + Math.max(0, ...endZeilen.values());
  const knoten = a.schritte.map((s) => ({ id: s.id, form: FORM_ZU_ABLAUF[s.art], text: formText(s), spalte: spalteVon.get(s.bahn) ?? 0, zeile: zeileVon.get(s.id)! }));
  const pos = new Map(knoten.map((k) => [k.id, k]));
  const kanten: { von: string; vonSeite: AblaufSeite; nach: string; nachSeite: AblaufSeite; text?: string; weg?: 'gerade' | 'winkel' }[] = [];
  for (const s of a.schritte) {
    const von = pos.get(s.id)!;
    const belegt = new Set<AblaufSeite>();
    const frei = (...wahl: AblaufSeite[]) => wahl.find((x) => !belegt.has(x)) ?? wahl[0]!;
    for (const ziel of s.naechste ?? []) {
      const nach = pos.get(ziel);
      if (!nach) continue;
      let vonSeite: AblaufSeite;
      let nachSeite: AblaufSeite;
      if (nach.zeile > von.zeile) {
        if (nach.spalte === von.spalte) {
          // Liegt eine andere Form dazwischen, läuft die Kante seitlich daran vorbei
          const dazwischen = knoten.some((k) => k.spalte === von.spalte && k.zeile > von.zeile && k.zeile < nach.zeile);
          vonSeite = dazwischen ? frei('right', 'left') : frei('bottom', 'right', 'left');
          nachSeite = vonSeite === 'bottom' ? 'top' : vonSeite;
        } else {
          const seitlich: AblaufSeite = nach.spalte > von.spalte ? 'right' : 'left';
          vonSeite = frei(seitlich, 'bottom');
          nachSeite = 'top';
        }
      } else {
        // Rücksprung: links neben den Formen (bei Ziel rechts davon: rechts)
        // Erste Spalte: nach rechts, links fehlt der Platz für Linie und Beschriftung (D-05)
        vonSeite = von.spalte === 0 ? frei('right', 'left') : frei(nach.spalte > von.spalte ? 'right' : 'left', 'left', 'right');
        nachSeite = vonSeite;
      }
      belegt.add(vonSeite);
      const text = s.zweige?.[ziel];
      kanten.push({ von: s.id, vonSeite, nach: ziel, nachSeite, ...(text ? { text } : {}), ...(nach.zeile <= von.zeile || vonSeite === nachSeite ? { weg: 'winkel' as const } : {}) });
    }
  }
  // Ankunft nicht auf der Seite, auf der die Form selbst eine Kante verlässt: Beide Linien lägen sonst aufeinander (D-05)
  for (const k of kanten) {
    const belegtAus = new Set(kanten.filter((o) => o.von === k.nach).map((o) => o.vonSeite));
    if (!belegtAus.has(k.nachSeite)) continue;
    const andere: AblaufSeite[] = k.nachSeite === 'left' ? ['right', 'top'] : k.nachSeite === 'right' ? ['left', 'top'] : ['left', 'right'];
    k.nachSeite = andere.find((x) => !belegtAus.has(x)) ?? k.nachSeite;
  }
  const spalten = Math.max(MIN_SPALTEN, benutzt.length);
  return {
    spalten,
    zeilen: Math.max(1, zeilen),
    knoten,
    kanten,
    bahnen: benutzt.map((b, i) => ({ id: b.id, text: bahnText(q, b), spalte: i })),
    zeilenHoehe: zeilenHoehe(knoten.map((k) => k.text)),
  };
}

/** Alternativtext: Titel und Kurzbeschreibung mit Zahl der Schritte und den Bahnen; die Schritt-Tabelle ist die Textfassung */
export function ablaufAlt(a: Ablauf, q: TextQuelle, titel: string, text: (anzahl: number, bahnen: string) => string): { titel: string; beschreibung: string } {
  const bahnen = a.bahnen.filter((b) => a.schritte.some((s) => s.bahn === b.id)).map((b) => bahnText(q, b));
  return { titel, beschreibung: text(a.schritte.length, bahnen.join(', ')) };
}

/**
 * Ablauf als DOCX-Block (Formen mit Bahnen). Rauten bieten in Word und LibreOffice nur halb so viel Platz für Text wie
 * Rechtecke: Zeilen mit einer Entscheidung erhalten die doppelte Höhe. Der Ablauf bleibt auf einer Seite (rund 860 px).
 */
export function ablaufBlock(r: ProzessRaster, alt: { titel: string; beschreibung: string }): AblaufBlock {
  const mitRaute = new Set(r.knoten.filter((k) => k.form === 'frage').map((k) => k.zeile));
  const neu: number[] = [];
  let z = 0;
  for (let i = 0; i < r.zeilen; i++) {
    neu.push(z);
    z += mitRaute.has(i) ? 2 : 1;
  }
  return {
    typ: 'ablauf',
    spalten: r.spalten,
    zeilen: z,
    zeilenHoehe: Math.min(r.zeilenHoehe + 6, Math.floor((860 - 34) / Math.max(1, z))),
    schriftgroesse: r.bahnen.length >= 4 ? 6.5 : 7,
    knoten: r.knoten.map((k) => ({ id: k.id, form: k.form, text: k.text, spalte: k.spalte, zeile: neu[k.zeile]!, ...(k.form === 'frage' ? { hoehe: 2 } : {}) })),
    kanten: r.kanten.map((k): AblaufKante => ({ ...k })),
    bahnen: r.bahnen.map((b) => ({ ...b })),
    alt,
  };
}
