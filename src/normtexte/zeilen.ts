// Textstücke einer PDF-Seite (pdf.js getTextContent) zu Zeilen mit Läufen zusammensetzen. Rein, ohne pdf.js: läuft im
// PDF-Worker und in Node-Tests (synthetische Seiten).

/** Ein Textstück wie von pdf.js geliefert, auf das Nötige reduziert (Koordinaten in PDF-Punkten, y von unten). */
export interface RohStueck {
  str: string;
  x: number;
  y: number;
  /** Breite des Stücks */
  w: number;
  /** Schrifthöhe */
  h: number;
  font: string;
  /** Gedreht oder gekippt (Wasserzeichen, Randvermerke) */
  rotiert?: boolean;
}

export interface RohSeite {
  breite: number;
  hoehe: number;
  stuecke: RohStueck[];
}

/** Zusammenhängender Text einer Zeile ohne grosse Lücke (Spalten einer Tabelle sind getrennte Läufe). */
export interface Lauf {
  x: number;
  ende: number;
  text: string;
  font: string;
  /** Stücke des Laufs mit Lage (zum Teilen an einer Spaltengrenze, wenn Titel und Text eng beieinander stehen) */
  stuecke?: { x: number; text: string }[];
}

export interface Zeile {
  /** Abstand der Grundlinie vom oberen Seitenrand */
  y: number;
  x: number;
  h: number;
  /** Schrift mit den meisten Zeichen */
  font: string;
  text: string;
  laeufe: Lauf[];
}

export interface Seite {
  nr: number;
  breite: number;
  hoehe: number;
  zeilen: Zeile[];
}

const LEER = /^\s*$/;

/** Stücke einer Seite zu Zeilen: gleiche Grundlinie (Toleranz 30 % der Schrifthöhe), sortiert nach x. */
export function zeilenAusStuecken(seite: RohSeite, nr: number): Seite {
  const stuecke = seite.stuecke.filter((s) => !s.rotiert && s.str.length > 0 && s.h > 0);
  // Von oben nach unten, dann links nach rechts
  stuecke.sort((a, b) => b.y - a.y || a.x - b.x);
  const gruppen: RohStueck[][] = [];
  for (const s of stuecke) {
    const g = gruppen.find((x) => Math.abs(x[0]!.y - s.y) <= Math.max(1, 0.3 * Math.min(x[0]!.h, s.h)));
    if (g) g.push(s);
    else gruppen.push([s]);
  }
  const zeilen: Zeile[] = [];
  for (const g of gruppen) {
    g.sort((a, b) => a.x - b.x);
    const laeufe: Lauf[] = [];
    for (const s of g) {
      const letzter = laeufe[laeufe.length - 1];
      const h = s.h;
      // Leerraum-Stücke: pdf.js setzt sie auch über breite Spaltenlücken; sie verlängern einen Lauf nicht
      if (LEER.test(s.str)) {
        if (letzter && s.w <= 2 * h && s.x - letzter.ende <= 2 * h && !/\s$/.test(letzter.text)) {
          letzter.text += ' ';
          letzter.stuecke!.push({ x: s.x, text: ' ' });
        }
        continue;
      }
      const luecke = letzter ? s.x - letzter.ende : Infinity;
      // Lücke grösser als zwei Schrifthöhen: neuer Lauf (Tabellenspalte)
      if (letzter && luecke <= 2 * h) {
        const brauchtLeer = luecke > 0.15 * h && !/\s$/.test(letzter.text) && !/^\s/.test(s.str);
        letzter.text += (brauchtLeer ? ' ' : '') + s.str;
        letzter.ende = Math.max(letzter.ende, s.x + s.w);
        letzter.stuecke!.push({ x: s.x, text: (brauchtLeer ? ' ' : '') + s.str });
        continue;
      }
      laeufe.push({ x: s.x, ende: s.x + s.w, text: s.str, font: s.font, stuecke: [{ x: s.x, text: s.str }] });
    }
    for (const l of laeufe) l.text = l.text.replace(/\s+/g, ' ').trim();
    const sichtbar = laeufe.filter((l) => l.text.length > 0);
    if (!sichtbar.length) continue;
    // Schrift der Zeile: die mit den meisten Zeichen
    const zeichen = new Map<string, number>();
    for (const s of g) zeichen.set(s.font, (zeichen.get(s.font) ?? 0) + s.str.trim().length);
    const fontZeile = [...zeichen.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    zeilen.push({
      y: seite.hoehe - g[0]!.y,
      x: sichtbar[0]!.x,
      h: Math.max(...g.map((s) => s.h)),
      font: fontZeile,
      text: sichtbar.map((l) => l.text).join(' '),
      laeufe: sichtbar,
    });
  }
  zeilen.sort((a, b) => a.y - b.y || a.x - b.x);
  return { nr, breite: seite.breite, hoehe: seite.hoehe, zeilen };
}
