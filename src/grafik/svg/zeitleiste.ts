// Zeitleisten als SVG-Szenen: Gantt (Fahrplan E0, Leitfaden Kapitel 4) auf einer Wochenachse und Zeitachse nach Datum
// (Fristen des AI Act). Zustand als Füllung und Wort (desc), Meilensteine als Raute, Freigaben als hohle Raute,
// «heute» als gestrichelte Linie in blau.
import { raute } from './formen.ts';
import { el, kuerze, rund, svgWurzel, textBreite, umbreche, type Knoten } from './szene.ts';

export type Zustand = 'erledigt' | 'aktiv' | 'offen';

export interface GanttZeile {
  titel: string;
  /** Zusatz unter dem Titel, z. B. Etappen */
  text?: string;
  /** erste und letzte Woche, 1-basiert, einschliesslich */
  von: number;
  bis: number;
  zustand: Zustand;
  /** Zweiter Balken in derselben Zeile (z. B. Pfad ohne ISMS unter dem Pfad mit ISMS); beide werden halb so hoch */
  zweit?: { von: number; bis: number; zustand: Zustand };
}

export interface GanttMarke {
  /** Ende dieser Woche (1-basiert) */
  woche: number;
  text: string;
  art: 'meilenstein' | 'freigabe';
}

export interface GanttOptionen {
  id: string;
  wochen: number;
  breite?: number;
  marken?: readonly GanttMarke[];
  /** Position von heute in Wochen ab Planbeginn (1 = Beginn der ersten Woche), auch gebrochen; ausserhalb: keine Linie */
  heute?: number;
  /** Beschriftung der Achse je Woche (z. B. «KW 3»); ohne: Nummer der Woche */
  achse?: (woche: number) => string;
  /** Titel in der Zeichnung (false: die Seite zeigt ihn als Überschrift; er bleibt in <title>) */
  titelSichtbar?: boolean;
}

export interface GanttTexte {
  titel: string;
  beschreibung: string;
  heute: string;
  /** Beschriftung der Zeilen mit Meilensteinen und Freigaben */
  meilensteine: string;
  freigaben: string;
  /** Legende unter der Grafik: Text je Zustand der Balken und je Art der Marken (nur genannte Einträge) */
  legende?: Partial<Record<Zustand | 'meilenstein' | 'freigabe', string>>;
}

export function ganttSzene(zeilen: readonly GanttZeile[], t: GanttTexte, o: GanttOptionen): Knoten {
  const breite = o.breite ?? 860;
  // Beschriftungsspalte: so breit wie der längste Text, höchstens 230; längere Titel brechen um (siehe unten)
  const arten = (['meilenstein', 'freigabe'] as const).filter((art) => (o.marken ?? []).some((m) => m.art === art));
  const links = Math.min(230, Math.max(120, ...zeilen.map((z) => textBreite(z.titel, 12) + 14), ...zeilen.map((z) => (z.text ? textBreite(z.text, 10.5) + 14 : 0)),
    ...arten.map((art) => textBreite(art === 'meilenstein' ? t.meilensteine : t.freigaben, 12) + 14)));
  const plot = breite - links - 10;
  const ww = plot / Math.max(1, o.wochen);
  const kopf = o.titelSichtbar === false ? 16 : 30;
  const oben = kopf + 34;
  const zh = zeilen.some((z) => z.text) ? 34 : 26;
  // Lange Titel brechen in mehrere Zeilen um (kein Kürzen); die Zeile wird dafür höher
  const titelZeilen = zeilen.map((z) => umbreche(z.titel, links - 10));
  const hoehen = zeilen.map((z, i) => Math.max(zh, 14 * (titelZeilen[i]!.length + (z.text ? 1 : 0)) + 6));
  const yZeile = hoehen.map((_, i) => hoehen.slice(0, i).reduce((s, h) => s + h, 0));
  const xVon = (w: number) => links + (w - 1) * ww;
  const kinder: Knoten[] = o.titelSichtbar === false ? [] : [el('text', { class: 'g-text-tinte', x: 0, y: 16, 'font-size': 14 }, t.titel)];
  // Achse: Wochen mit Raster; Beschriftung so dicht, wie Platz ist
  const schritt = Math.max(1, Math.ceil(46 / ww));
  const rasterUnten = oben + hoehen.reduce((s, h) => s + h, 0);
  for (let w = 1; w <= o.wochen + 1; w++) {
    const x = rund(xVon(w));
    kinder.push(el('line', { class: (w - 1) % schritt === 0 ? 'g-achse' : 'g-raster', x1: x, x2: x, y1: oben - 6, y2: rasterUnten }));
    if (w <= o.wochen && (w - 1) % schritt === 0) {
      // Letzte Beschriftung nicht über den rechten Rand hinaus
      const text = o.achse ? o.achse(w) : String(w);
      kinder.push(el('text', { class: 'g-text-gedaempft', x: rund(Math.min(x + 3, breite - textBreite(text, 11) - 2)), y: oben - 10, 'font-size': 11 }, text));
    }
  }
  zeilen.forEach((z, i) => {
    const y = oben + yZeile[i]!;
    const zh = hoehen[i]!;
    const tz = titelZeilen[i]!;
    const erste = tz.length + (z.text ? 1 : 0) > 1 ? 14 : 17;
    kinder.push(el('line', { class: 'g-raster', x1: 0, x2: breite, y1: y + zh, y2: y + zh }));
    tz.forEach((zeile, j) => kinder.push(el('text', { class: 'g-text-tinte', x: 0, y: y + erste + j * 14 }, zeile)));
    if (z.text) kinder.push(el('text', { class: 'g-text-gedaempft', x: 0, y: y + erste + tz.length * 14, 'font-size': 10.5 }, kuerze(z.text, links - 10, 10.5)));
    const balken = (von: number, bis: number, zustand: Zustand, oben: number, h: number) =>
      el('rect', { class: `g-balken-${zustand}`, x: rund(xVon(von) + 1), y: rund(oben), width: rund(Math.max(4, (bis - von + 1) * ww - 2)), height: h, rx: rund(h / 2), 'data-zustand': zustand });
    if (z.zweit) {
      kinder.push(balken(z.von, z.bis, z.zustand, y + zh / 2 - 10, 9));
      kinder.push(balken(z.zweit.von, z.zweit.bis, z.zweit.zustand, y + zh / 2 + 1, 9));
    } else {
      kinder.push(balken(z.von, z.bis, z.zustand, y + (zh - 14) / 2, 14));
    }
  });
  // Marken in eigenen Zeilen je Art (Meilensteine, Freigaben): Raute am Ende der Woche, Text als <title>; mehrere in
  // derselben Woche mit Anzahl. Die Liste mit Text steht in der Tabelle unter der Grafik.
  arten.forEach((art, i) => {
    const y = rasterUnten + i * zh;
    kinder.push(el('line', { class: 'g-raster', x1: 0, x2: breite, y1: y + zh, y2: y + zh }));
    kinder.push(el('text', { class: 'g-text-gedaempft', x: 0, y: y + 17 }, kuerze(art === 'meilenstein' ? t.meilensteine : t.freigaben, links - 10)));
    // Anzahl rechts der Raute, am rechten Rand links davon
    const anzahlText = (x: number, ty: number, n: number) => {
      const tb = textBreite(String(n), 10);
      return el('text', { class: 'g-text-gedaempft', x: rund(x + 8 + tb > breite ? x - 8 - tb : x + 8), y: ty, 'font-size': 10 }, String(n));
    };
    const jeWoche = new Map<number, string[]>();
    for (const m of o.marken ?? []) if (m.art === art) jeWoche.set(m.woche, [...(jeWoche.get(m.woche) ?? []), m.text]);
    for (const [woche, texte] of [...jeWoche].sort((x, y2) => x[0] - y2[0])) {
      const x = xVon(woche + 1);
      kinder.push(el('g', { 'data-woche': woche }, el('title', undefined, texte.join('; ')), raute(x, y + zh / 2, 6, art === 'meilenstein' ? 'g-meilenstein' : 'g-freigabe'),
        texte.length > 1 ? anzahlText(x, y + zh / 2 + 4, texte.length) : null));
    }
  });
  const markenUnten = rasterUnten + arten.length * zh;
  if (o.heute !== undefined && o.heute >= 1 && o.heute <= o.wochen + 1) {
    const x = rund(xVon(o.heute));
    kinder.push(el('line', { class: 'g-heute', x1: x, x2: x, y1: oben - 4, y2: markenUnten + 4 }));
    kinder.push(el('text', { class: 'g-heute-text', x: rund(Math.min(x + 4, breite - textBreite(t.heute, 11))), y: oben - 24, 'font-size': 11 }, t.heute));
  }
  let hoehe = markenUnten + 8;
  // Legende mit Wort und Form: Balken je Zustand, Rauten je Art
  const legende = Object.entries(t.legende ?? {}) as [Zustand | 'meilenstein' | 'freigabe', string][];
  if (legende.length) {
    let lx = 0;
    let ly = markenUnten + 24;
    for (const [art, text] of legende) {
      const b = 30 + textBreite(text, 11) + 18;
      if (lx + b > breite && lx > 0) {
        lx = 0;
        ly += 18;
      }
      if (art === 'meilenstein' || art === 'freigabe') kinder.push(raute(lx + 9, ly - 4, 6, art === 'meilenstein' ? 'g-meilenstein' : 'g-freigabe'));
      else kinder.push(el('rect', { class: `g-balken-${art}`, x: lx, y: ly - 9, width: 20, height: 9, rx: 4.5 }));
      kinder.push(el('text', { class: 'g-text-gedaempft', x: lx + 26, y: ly, 'font-size': 11 }, text));
      lx += b;
    }
    hoehe = ly + 8;
  }
  return svgWurzel(o.id, breite, hoehe, t.titel, t.beschreibung, 'g-svg--gantt', kinder);
}

export interface AchsenEintrag {
  /** ISO-Datum */
  datum: string;
  titel: string;
  zustand: Zustand;
}

const tagMs = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

/** Zeitachse nach Datum (waagrecht), Jahre als Raster, Einträge als Knoten mit gestaffelter Beschriftung. */
export function zeitachseSzene(
  eintraege: readonly AchsenEintrag[],
  t: { titel: string; beschreibung: string; heute: string; datum: (iso: string) => string },
  o: { id: string; breite?: number; heute?: string; titelSichtbar?: boolean; textBreite?: number },
): Knoten {
  const breite = o.breite ?? 860;
  const sortiert = [...eintraege].sort((a, b) => a.datum.localeCompare(b.datum));
  const daten = [...sortiert.map((e) => e.datum), ...(o.heute ? [o.heute] : [])];
  const jahrVon = Math.min(...daten.map((d) => Number(d.slice(0, 4))));
  const jahrBis = Math.max(...daten.map((d) => Number(d.slice(0, 4)))) + 1;
  const t0 = tagMs(`${jahrVon}-01-01`);
  const t1 = tagMs(`${jahrBis}-01-01`);
  const rand = 8;
  const x = (iso: string) => rand + ((tagMs(iso) - t0) / (t1 - t0)) * (breite - 2 * rand);
  // Ohne sichtbaren Titel rückt alles um 20 nach oben (der Titel bleibt in <title>)
  const dy = o.titelSichtbar === false ? 20 : 0;
  const achseY = 58 - dy;
  const maxText = o.textBreite ?? 260;
  const kinder: Knoten[] = dy ? [] : [el('text', { class: 'g-text-tinte', x: 0, y: 16, 'font-size': 14 }, t.titel)];
  kinder.push(el('line', { class: 'g-leitung', x1: rand, x2: breite - rand, y1: achseY, y2: achseY }));
  for (let j = jahrVon; j <= jahrBis; j++) {
    const xj = rund(x(`${j}-01-01`));
    kinder.push(el('line', { class: 'g-achse', x1: xj, x2: xj, y1: achseY - 6, y2: achseY + 6 }));
    if (j < jahrBis) kinder.push(el('text', { class: 'g-text-gedaempft', x: rund(xj + 4), y: achseY - 10, 'font-size': 11 }, String(j)));
  }
  // Erledigte Strecke bis heute
  if (o.heute) kinder.push(el('line', { class: 'g-leitung-aktiv', x1: rand, x2: rund(Math.max(rand, Math.min(breite - rand, x(o.heute)))), y1: achseY, y2: achseY }));
  const ebenen: number[] = [];
  let maxEbene = 0;
  const texte: Knoten[] = [];
  for (const e of sortiert) {
    const xe = x(e.datum);
    const text = `${t.datum(e.datum)} ${e.titel}`;
    const b = Math.min(textBreite(text, 11), maxText);
    const tx = xe + b > breite ? breite - b : xe - 4;
    let i = ebenen.findIndex((ende) => ende < tx);
    if (i < 0) i = ebenen.length;
    ebenen[i] = tx + b + 10;
    maxEbene = Math.max(maxEbene, i);
    const y = achseY + 26 + i * 30;
    texte.push(el('line', { class: 'g-raster', x1: rund(xe), x2: rund(xe), y1: achseY, y2: y - 10 }));
    texte.push(el('text', { class: e.zustand === 'erledigt' ? 'g-text-gedaempft' : 'g-text-tinte', x: rund(tx), y, 'font-size': 11 }, kuerze(text, maxText, 11)));
    texte.push(el('circle', { class: e.zustand === 'offen' ? 'g-knoten-hohl' : 'g-knoten-voll', cx: rund(xe), cy: achseY, r: e.zustand === 'aktiv' ? 7 : 4.5, 'data-zustand': e.zustand }));
  }
  kinder.push(...texte);
  if (o.heute) {
    const xh = rund(x(o.heute));
    kinder.push(el('line', { class: 'g-heute', x1: xh, x2: xh, y1: 28 - dy, y2: achseY + 10 }));
    kinder.push(el('text', { class: 'g-heute-text', x: rund(Math.min(xh + 4, breite - textBreite(t.heute, 11))), y: 34 - dy, 'font-size': 11 }, t.heute));
  }
  return svgWurzel(o.id, breite, achseY + 26 + maxEbene * 30 + 12, t.titel, t.beschreibung, 'g-svg--zeitachse', kinder);
}
