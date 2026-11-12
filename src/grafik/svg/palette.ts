// Palette für eigenständige SVG (Leitfaden, Poster, START, PNG): dieselben Klassen g-* wie in src/app/stil.css, die Werte
// aus den Tokens des Design Systems «KMU-CIO Systemkarte» (docs/design-system/tokens.json). Die App färbt über ihre
// CSS-Variablen; Hex-Werte stehen nur hier, für Dateien ohne Stylesheet der Seite.

export interface Palette {
  seite: string; karte: string; tinte: string; text: string; gedaempft: string; linie: string; linieStark: string; kontur: string;
  blau: string; blauHauch: string; seq1: string; seq3: string;
  risikoTief: string; risikoMittel: string; risikoHoch: string; aufRisikoHoch: string;
  gut: string; warnung: string; kritisch: string; neutral: string;
  kat: [string, string, string, string, string, string];
}

export const PALETTEN: Record<'hell' | 'dunkel', Palette> = {
  hell: {
    seite: '#f2f0eb', karte: '#ffffff', tinte: '#121821', text: '#262d36', gedaempft: '#535c67', linie: 'rgba(18, 24, 33, .12)',
    linieStark: 'rgba(18, 24, 33, .28)', kontur: '#6b737c', blau: '#1c5d94', blauHauch: 'rgba(28, 93, 148, .08)', seq1: '#d9eaf8', seq3: '#4c9add',
    risikoTief: '#f2e8d6', risikoMittel: '#e8b173', risikoHoch: '#bf6c2e', aufRisikoHoch: '#121821',
    gut: '#2e95a5', warnung: '#8a5a00', kritisch: '#772106', neutral: '#616a74',
    kat: ['#1c5d94', '#b44c18', '#1f7971', '#6a4e9e', '#906e00', '#616a74'],
  },
  dunkel: {
    seite: '#0f1215', karte: '#1c2127', tinte: '#ece8e1', text: '#d6d2ca', gedaempft: '#9aa3ad', linie: 'rgba(236, 232, 225, .12)',
    linieStark: 'rgba(236, 232, 225, .30)', kontur: '#7d8791', blau: '#6fa8dc', blauHauch: 'rgba(111, 168, 220, .10)', seq1: '#16263a', seq3: '#438ed1',
    risikoTief: '#22272e', risikoMittel: '#5e4226', risikoHoch: '#c76e33', aufRisikoHoch: '#0f1215',
    gut: '#227a86', warnung: '#d78c19', kritisch: '#ffab78', neutral: '#7d8791',
    kat: ['#6fa8dc', '#f07a45', '#53baad', '#baa1e8', '#d6af3d', '#9aa3ad'],
  },
};

/** CSS für die Klassen g-* einer eigenständigen SVG-Datei. */
export function paletteCss(name: 'hell' | 'dunkel' = 'hell'): string {
  const p = PALETTEN[name];
  const regeln: [string, string][] = [
    // Schriftgrösse an der Wurzel: Ein font-size-Attribut am Text (z. B. Titel 14) geht der geerbten Grösse vor
    ['.g-svg', `font-family:'Archivo Variable',Archivo,'Helvetica Neue',Arial,sans-serif;font-size:12px;background:${p.karte}`],
    ['.g-svg text', `fill:${p.text}`],
    ['.g-text-gedaempft', `fill:${p.gedaempft}`],
    ['.g-text-tinte', `fill:${p.tinte};font-weight:650`],
    ['.g-text-auf-hoch', `fill:${p.aufRisikoHoch}`],
    ['.g-raster', `stroke:${p.linie};stroke-width:1`],
    ['.g-achse', `stroke:${p.linieStark};stroke-width:1`],
    ['.g-leitung', `stroke:${p.linieStark};stroke-width:1;fill:none`],
    ['.g-leitung-aktiv', `stroke:${p.blau};stroke-width:2;fill:none`],
    ['.g-heute', `stroke:${p.blau};stroke-width:1.5;stroke-dasharray:4 3`],
    ['.g-heute-text', `fill:${p.blau};font-weight:650`],
    ['.g-knoten-voll', `fill:${p.blau};stroke:${p.karte};stroke-width:3`],
    ['.g-knoten-hohl', `fill:${p.karte};stroke:${p.kontur};stroke-width:1.5`],
    ['.g-knoten-ziel', `fill:${p.karte};stroke:${p.blau};stroke-width:2`],
    ['.g-hantel', `stroke:${p.blau};stroke-width:3;stroke-linecap:round`],
    ['.g-hantel-luecke', `stroke:${p.kritisch};stroke-width:3;stroke-linecap:round;stroke-dasharray:5 3`],
    ['.g-balken-erledigt', `fill:${p.blau}`],
    ['.g-balken-aktiv', `fill:${p.seq3};stroke:${p.blau};stroke-width:1.5`],
    ['.g-balken-offen', `fill:${p.seq1};stroke:${p.kontur};stroke-width:1`],
    ['.g-meilenstein', `fill:${p.tinte};stroke:${p.karte};stroke-width:1.5`],
    ['.g-freigabe', `fill:${p.karte};stroke:${p.tinte};stroke-width:1.5`],
    ['.g-stufe-tief', `fill:${p.risikoTief};stroke:${p.linieStark}`],
    ['.g-stufe-mittel', `fill:${p.risikoMittel}`],
    ['.g-stufe-hoch', `fill:${p.risikoHoch}`],
    ['.g-muster-strich', `stroke:${p.aufRisikoHoch};stroke-opacity:.35;stroke-width:2`],
    ['.g-ton-gut', `fill:${p.gut}`],
    ['.g-ton-warnung', `fill:${p.warnung}`],
    ['.g-ton-kritisch', `fill:${p.kritisch}`],
    ['.g-ton-neutral', `fill:${p.neutral}`],
    ['.g-ton-info', `fill:${p.blau}`],
    ['.g-hohl', 'fill:none;stroke-width:1.5'],
    ['.g-ton-leer', `fill:${p.seite};stroke:${p.linieStark}`],
    ...p.kat.map((f, i): [string, string] => [`.g-ton-kat-${i + 1}`, `fill:${f}`]),
    ['.g-feld', `fill:${p.seite}`],
    ['.g-ablauf-knoten', `fill:${p.karte};stroke:${p.kontur};stroke-width:1`],
    ['.g-ablauf-frage', `fill:${p.blauHauch};stroke:${p.blau};stroke-width:1.2`],
    ['.g-ablauf-ergebnis', `fill:${p.seite};stroke:${p.linieStark};stroke-width:1`],
    ['.g-ablauf-rand', `fill:${p.karte};stroke:${p.tinte};stroke-width:1.5`],
    ['.g-ablauf-kante', `stroke:${p.kontur};stroke-width:1;fill:none`],
    ['.g-ablauf-pfeil', `fill:${p.kontur}`],
    ['.g-pfeil-aktiv', `fill:${p.blau}`],
    ['.g-sparkline__linie', `fill:none;stroke:${p.blau};stroke-width:1.5;stroke-linejoin:round;stroke-linecap:round`],
    ['.g-sparkline__grund', `stroke:${p.linieStark};stroke-width:1;stroke-dasharray:2 3`],
    ['.g-sparkline__knoten', `fill:${p.blau};stroke:${p.karte};stroke-width:2`],
  ];
  return regeln.map(([s, r]) => `${s}{${r}}`).join('');
}
