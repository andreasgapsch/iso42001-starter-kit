// Eingangsmodul (AF-018): einzige Stelle, die Inhalte fremder Dateien liest (File, Blob, Datei-Handle) und Dateitext als JSON
// parst. Grösse vor dem Lesen, Eintragslimit, höchstens eine Kopie. Das Tor G41 (scripts/pruefen/lesestellen.mts) verlangt, dass
// Lesewege (`arrayBuffer(`, `.text()`, `.bytes(`, `new Response(` …) und `JSON.parse` ausserhalb von src/eingang/ nicht vorkommen.
// Text ohne Dateiinhalt (eigene Kopie, Datenblöcke der App, Nachricht zwischen Tabs, Zwischenstand im Browser) läuft über
// jsonAusVertrauen mit benannter Quelle.
import { GRENZEN, groesseText, type EingangsArt, type Grenze } from './grenzen.ts';

export type EingangsGrund = 'zu-gross' | 'zu-viele' | 'zu-tief' | 'zeit' | 'herzschlag' | 'zwischenstand-gross' | 'zu-viele-seiten';

/**
 * Eingabe überschreitet eine Grenze oder der Worker antwortet nicht. Trägt Art, Grenze und gemessenen Wert; die Oberfläche bildet
 * sie über `eingang.<grund>` auf einen Text ab (src/app/worker/fehlertext.ts), in den die Werte aus der Konfiguration eingesetzt
 * werden (AF-020). Die Meldung selbst nennt dieselben Werte für Node und Fehlerbericht.
 */
export class EingangsFehler extends Error {
  readonly art: EingangsArt;
  readonly grund: EingangsGrund;
  /** Grenze als Zahl (Bytes, Einträge, Ebenen, Millisekunden) */
  readonly grenze: number;
  /** Gemessener Wert, wo bekannt */
  readonly wert: number | undefined;
  constructor(art: EingangsArt, grund: EingangsGrund, grenze: number, wert?: number) {
    super(eingangsText(art, grund, grenze, wert));
    this.name = 'EingangsFehler';
    this.art = art;
    this.grund = grund;
    this.grenze = grenze;
    this.wert = wert;
  }
  /** Werte für die Platzhalter des Texts `eingang.<grund>` */
  werte(): Record<string, string> {
    const bytes = this.grund === 'zu-gross' || this.grund === 'zwischenstand-gross';
    const zeit = this.grund === 'zeit' || this.grund === 'herzschlag';
    const f = (n: number): string => (bytes ? groesseText(n) : zeit ? `${Math.round(n / 1000)} s` : String(n));
    return { grenze: f(this.grenze), ...(this.wert !== undefined ? { wert: f(this.wert) } : {}) };
  }
}

function eingangsText(art: EingangsArt, grund: EingangsGrund, grenze: number, wert?: number): string {
  if (grund === 'zu-gross') return `Eingang ${art}: Datei zu gross (${wert !== undefined ? `${groesseText(wert)}, ` : ''}höchstens ${groesseText(grenze)})`;
  if (grund === 'zu-viele') return `Eingang ${art}: zu viele Einträge (${wert !== undefined ? `${wert}, ` : ''}höchstens ${grenze})`;
  if (grund === 'zu-viele-seiten') return `Eingang ${art}: zu viele Seiten (${wert !== undefined ? `${wert}, ` : ''}höchstens ${grenze})`;
  if (grund === 'zu-tief') return `Eingang ${art}: zu tief verschachtelt (höchstens ${grenze} Ebenen)`;
  if (grund === 'zwischenstand-gross') return `Zwischenstand ${art}: grösser als die Grenze (${wert !== undefined ? `${groesseText(wert)}, ` : ''}höchstens ${groesseText(grenze)}), bleibt erhalten`;
  if (grund === 'herzschlag') return `Eingang ${art}: Worker ohne Lebenszeichen seit ${Math.round(grenze / 1000)} s`;
  return `Eingang ${art}: Zeitgrenze von ${Math.round(grenze / 1000)} s überschritten`;
}

/** Was eine Lesestelle braucht: File, Blob oder das Ergebnis von FileSystemFileHandle.getFile() */
export interface DateiQuelle {
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  slice(von?: number, bis?: number): DateiQuelle;
}

/** Grösse vor dem Lesen: wirft, ohne den Inhalt anzufassen */
export function groessePruefen(datei: { readonly size: number }, art: EingangsArt): void {
  const g = GRENZEN[art].maxBytes;
  if (datei.size > g) throw new EingangsFehler(art, 'zu-gross', g, datei.size);
}

/** Bytes einer Datei: Grösse vor dem Lesen, ein Puffer ohne weitere Kopie (die Sicht teilt den Speicher) */
export async function liesBegrenzt(datei: DateiQuelle, art: EingangsArt): Promise<Uint8Array> {
  groessePruefen(datei, art);
  const b = new Uint8Array(await datei.arrayBuffer());
  // Die Datei kann sich zwischen Prüfung und Lesen geändert haben
  if (b.byteLength > GRENZEN[art].maxBytes) throw new EingangsFehler(art, 'zu-gross', GRENZEN[art].maxBytes, b.byteLength);
  if (ZIP_ARTEN.has(art)) zipEintraegeVorab(b, art);
  return b;
}

/** Text einer Datei (UTF-8): Grösse vor dem Lesen */
export async function liesTextBegrenzt(datei: DateiQuelle, art: EingangsArt): Promise<string> {
  groessePruefen(datei, art);
  const text = await datei.text();
  if (text.length > GRENZEN[art].maxBytes) throw new EingangsFehler(art, 'zu-gross', GRENZEN[art].maxBytes, text.length);
  return text;
}

/** JSON einer Datei: Grösse vor dem Lesen, dann wie jsonLesen */
export async function liesJsonBegrenzt(datei: DateiQuelle, art: EingangsArt): Promise<unknown> {
  return jsonLesen(await liesTextBegrenzt(datei, art), art);
}

/**
 * Datei in Stücken fester Grösse, ohne sie ganz zu laden (Prüfsumme grosser Nachweise). Keine Grössengrenze: Jedes Stück ist
 * begrenzt, die Summe nie im Speicher.
 */
export async function* liesStueckweise(datei: DateiQuelle, stueck: number): AsyncGenerator<Uint8Array> {
  for (let o = 0; o < datei.size; o += stueck) yield new Uint8Array(await datei.slice(o, Math.min(datei.size, o + stueck)).arrayBuffer());
}

/**
 * Dateitext als JSON: Länge, BOM, Parsen, dann Verschachtelung und Zahl der Werte ohne Rekursion. Wirft SyntaxError bei
 * ungültigem JSON (Aufrufer bilden ihn auf «kein JSON» ab) und EingangsFehler bei einer Grenze.
 */
export function jsonLesen(text: string, art: EingangsArt): unknown {
  const g: Grenze = GRENZEN[art];
  if (text.length > g.maxBytes) throw new EingangsFehler(art, 'zu-gross', g.maxBytes, text.length);
  const roh: unknown = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  strukturPruefen(roh, art);
  return roh;
}

/** Verschachtelung und Zahl der Werte, Ebene für Ebene (kein Stapelüberlauf bei tiefen Daten) */
export function strukturPruefen(roh: unknown, art: EingangsArt): void {
  const g: Grenze = GRENZEN[art];
  const maxTiefe = g.maxTiefe ?? Infinity;
  const maxWerte = g.maxWerte ?? Infinity;
  if (maxTiefe === Infinity && maxWerte === Infinity) return;
  let ebene: unknown[] = [roh];
  let anzahl = 0;
  for (let t = 0; ebene.length; t++) {
    if (t > maxTiefe) throw new EingangsFehler(art, 'zu-tief', maxTiefe);
    const naechste: unknown[] = [];
    for (const w of ebene) {
      if (++anzahl > maxWerte) throw new EingangsFehler(art, 'zu-viele', maxWerte);
      if (w && typeof w === 'object') for (const k of Object.values(w)) naechste.push(k);
    }
    ebene = naechste;
  }
}

/** Arten, deren Datei ein ZIP ist: Zahl der Einträge aus dem Verzeichnisende vor jeder weiteren Arbeit */
const ZIP_ARTEN: ReadonlySet<EingangsArt> = new Set(['sicherung', 'fragebogen']);

/**
 * Eintragslimit eines ZIP vor dem Entpacken: Zahl aus dem Ende des zentralen Verzeichnisses (22 Bytes plus Kommentar). Kein ZIP
 * oder kein Verzeichnisende: nichts zu zählen, der Leser im Worker lehnt die Datei mit eigener Meldung ab.
 */
export function zipEintraegeVorab(b: Uint8Array, art: EingangsArt): void {
  const max = (GRENZEN[art] as Grenze).maxEintraege;
  if (max === undefined || b.length < 22) return;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  for (let e = b.length - 22, ende = Math.max(0, b.length - 22 - 65_535); e >= ende; e--) {
    if (dv.getUint32(e, true) !== 0x06054b50) continue;
    const anzahl = dv.getUint16(e + 10, true);
    if (anzahl !== 0xffff && anzahl > max) throw new EingangsFehler(art, 'zu-viele', max, anzahl);
    return;
  }
}

/**
 * Quellen ohne Dateiinhalt, die die App selbst erzeugt hat; die Quelle ist die Begründung, warum keine Eingangsgrenze gilt:
 * - `kopie`: JSON.stringify eines Werts der App, wieder gelesen (tiefe Kopie, Prüfung vor dem Speichern)
 * - `app-daten`: Datenblöcke des gebauten Werkzeugs (DOM, entpackte Blöcke) und Einstellungen im lokalen Speicher
 * - `tab-nachricht`: Nachricht eines anderen Tabs desselben Werkzeugs
 * - `zwischenstand`: Hülle eines Zwischenstands im Browserspeicher; der Projekttext darin läuft beim Wiederherstellen wieder
 *   über die Prüfung der Projektdatei
 */
export type VertrauteQuelle = 'kopie' | 'app-daten' | 'tab-nachricht' | 'zwischenstand';
export const VERTRAUTE_QUELLEN: readonly VertrauteQuelle[] = ['kopie', 'app-daten', 'tab-nachricht', 'zwischenstand'];

/** JSON aus einer Quelle der App selbst (kein Dateiinhalt). Wirft SyntaxError wie JSON.parse; die Quelle muss benannt sein. */
export function jsonAusVertrauen(text: string, quelle: VertrauteQuelle): unknown {
  if (!VERTRAUTE_QUELLEN.includes(quelle)) throw new TypeError(`Unbekannte Quelle für jsonAusVertrauen: ${String(quelle)}`);
  return JSON.parse(text);
}
