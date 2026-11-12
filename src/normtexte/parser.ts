// Zerlegt den Text eines Norm-PDF (ISO/IEC 42001, ISO/IEC 27001; ISO, SN EN, DIN EN; deutsch oder englisch) in Einträge
// je Abschnitt und Control. Rein und ohne pdf.js: läuft im PDF-Worker und in Node-Tests mit synthetischen Seiten.
//
// Vorgehen
//  1. Erkennen (vor der Bereinigung, Kopfzeilen tragen die Bezeichnung): Norm, Sprache, Ausgabe, nationale Ausgabe, Amd
//  2. Bereinigen (bereinigen.ts): Kopf- und Fusszeilen, Seitenzahlen, Vermerke, Ligaturen, Inhaltsverzeichnis
//  3. Kapitel 4 bis 10: Überschriften über Abschnittsnummern in fortlaufender Folge und Auszeichnung (fett oder grösser);
//     Unterabschnitte ohne eigenen Katalogeintrag (7.5.1) gehören mit Überschrift zum übergeordneten Abschnitt
//  4. Anhang A: Tabelle mit Spalten Nummer, Titel, Control-Text; Spalten je Seite aus der Lage der Läufe
//  5. Silbentrennung am Zeilenende auflösen (Wortliste des Dokuments), Absätze an Aufzählungen und Abständen
import { istVerzeichniszeile, seitenBereinigen } from './bereinigen.ts';
import { pflichtIds, type Erwartet } from './erwartet.ts';
import type { NormEintrag, NormId, NormNr, NormSprache } from './typen.ts';
import type { Lauf, Seite, Zeile } from './zeilen.ts';

export interface Erkennung {
  norm: NormNr | null;
  sprache: NormSprache;
  /** z. B. «SN EN ISO/IEC 42001:2026», sonst «ISO/IEC 42001:2023» */
  bezeichnung: string;
  ausgabe: string;
  amd?: string;
  /** Eine andere Norm (z. B. «ISO/IEC 27002»): wird nicht importiert, auch wenn sie 42001 oder 27001 zitiert */
  nichtUnterstuetzt?: string;
}

export interface ParseErgebnis extends Erkennung {
  eintraege: Record<NormId, NormEintrag>;
  /** Pflichteinträge (Vollständigkeit) mit Titel und Text */
  gefunden: NormId[];
  fehlend: NormId[];
  /** Das PDF enthält nur die Änderung (Amd), keine Controls: wird mit einem vorhandenen Paket zusammengeführt */
  nurAenderung: boolean;
  seiten: number;
}

const STANDARD_AUSGABE: Record<NormNr, string> = { '42001': '2023', '27001': '2022' };

// ---------------------------------------------------------------------------------------------------------------------
// 1. Erkennen

function zaehle(text: string, muster: RegExp): number {
  return (text.match(muster) ?? []).length;
}

function haeufigste(werte: string[]): string | undefined {
  const z = new Map<string, number>();
  for (const w of werte) z.set(w, (z.get(w) ?? 0) + 1);
  let best: string | undefined;
  let n = 0;
  for (const [w, c] of z) if (c > n) [best, n] = [w, c];
  return best;
}

const STOPP_DE = /\b(der|die|das|und|muss|müssen|Organisation|für|mit|von|eine?n?)\b/g;
const STOPP_EN = /\b(the|and|shall|of|organization|for|with|to|an?)\b/g;

export function erkenne(seiten: Seite[]): Erkennung {
  const alle = seiten.map((s) => s.zeilen.map((z) => z.text).join('\n')).join('\n');
  const vorne = seiten.slice(0, 15).map((s) => s.zeilen.map((z) => z.text).join('\n')).join('\n');
  // Die eigene Nummer steht auf Titelblatt und in den Kopfzeilen am häufigsten; zitierte Normen (27002 zitiert 27001) seltener
  const nummern = [...vorne.matchAll(/ISO\/IEC\s*(\d{5})(?!\d)/g)].map((m) => m[1]!);
  const haupt = haeufigste(nummern);
  const n42 = zaehle(vorne, /ISO\/IEC\s*42001/g);
  const n27 = zaehle(vorne, /ISO\/IEC\s*27001/g);
  const de = zaehle(alle, STOPP_DE);
  const en = zaehle(alle, STOPP_EN);
  const sprache: NormSprache = de > en ? 'de' : 'en';
  const nHaupt = haupt ? nummern.filter((n) => n === haupt).length : 0;
  if (haupt && haupt !== '42001' && haupt !== '27001' && nHaupt > Math.max(n42, n27)) {
    return { norm: null, sprache, bezeichnung: '', ausgabe: '', nichtUnterstuetzt: `ISO/IEC ${haupt}` };
  }
  const norm: NormNr | null = n42 === 0 && n27 === 0 ? null : n42 >= n27 ? '42001' : '27001';
  if (!norm) return { norm, sprache, bezeichnung: '', ausgabe: '' };
  // Internationale Ausgabe: «ISO/IEC 42001:2023», nicht die europäische Übernahme «EN ISO/IEC 42001:2026»
  const jahre = [...alle.matchAll(new RegExp(`(?<!EN\\s?)ISO\\/IEC\\s*${norm}\\s*:\\s*(20\\d\\d)`, 'g'))].map((m) => m[1]!);
  const ausgabe = haeufigste(jahre) ?? STANDARD_AUSGABE[norm];
  const national = [...vorne.matchAll(new RegExp(`\\b(SN|DIN|ÖNORM|OENORM|BS|NF|UNE|NEN|DS|SS|NS|UNI)\\s+EN\\s+ISO\\/IEC\\s*${norm}\\s*:\\s*(20\\d\\d)`, 'g'))].map((m) => `${m[1]} EN ISO/IEC ${norm}:${m[2]}`);
  const bezeichnung = haeufigste(national) ?? `ISO/IEC ${norm}:${ausgabe}`;
  let amd: string | undefined;
  if (norm === '27001' && /(Amd|AMD|Amendment|Änderung)\s*\.?\s*1\s*:\s*2024|[/+]\s*A1\s*:\s*2024|\bA1:2024\b/.test(alle)) amd = 'Amd 1:2024';
  return { norm, sprache, bezeichnung, ausgabe, ...(amd ? { amd } : {}) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Hilfen: Zeilen, Wörter, Absätze

interface Z extends Zeile {
  seite: number;
}

function flach(seiten: Seite[]): Z[] {
  const aus: Z[] = [];
  for (const s of seiten) {
    // Seite mit Inhaltsverzeichnis: Zeilen mit Seitenzahl am Ende entfallen
    const verzeichnis = s.zeilen.some((z) => /^(Contents|Inhalt|Inhaltsverzeichnis|Sommaire)\b/i.test(z.text));
    for (const z of s.zeilen) {
      if (istVerzeichniszeile(z.text)) continue;
      if (verzeichnis && /\s[\divxlc]{1,4}$/i.test(z.text) && /^(\d|[A-Z]\.\d|Annex|Anhang|Bibliogra|Literatur|Foreword|Vorwort|Introduction|Einleitung)/.test(z.text)) continue;
      aus.push({ ...z, seite: s.nr });
    }
  }
  return aus;
}

function woerterVon(zeilen: Z[]): Set<string> {
  const w = new Set<string>();
  for (const z of zeilen) for (const t of z.text.toLowerCase().split(/[^\p{L}-]+/u)) if (t.length > 2) w.add(t);
  return w;
}

const AUFZAEHLUNG = /^([a-z]\)|\d{1,2}\)|[-\u2013\u2014\u2022\u25aa\u25cf]\s|(NOTE|ANMERKUNG|EXAMPLE|BEISPIEL)\b)/;

/** Zeilen zu Text: Silbentrennung auflösen, Absätze bei Aufzählungen und grösserem Abstand. */
export function verbinde(zeilen: { text: string; y: number; h: number; seite: number }[], woerter: Set<string>): string {
  const absaetze: string[] = [];
  let akt = '';
  let vorher: { text: string; y: number; h: number; seite: number } | undefined;
  for (const z of zeilen) {
    const text = z.text.trim();
    if (!text) continue;
    let neu = !vorher || AUFZAEHLUNG.test(text);
    if (!neu && vorher) {
      const endetSatz = /[.:;]$/.test(vorher.text);
      if (vorher.seite === z.seite) neu = endetSatz && z.y - vorher.y > 1.65 * Math.max(z.h, vorher.h);
      else neu = endetSatz && /^[A-ZÄÖÜ]/.test(text);
    }
    if (neu) {
      if (akt) absaetze.push(akt);
      akt = text;
    } else {
      const trennung = /([\p{L}]+)-$/u.exec(akt);
      const weiter = /^([\p{Ll}]+)/u.exec(text);
      if (trennung && weiter) {
        const ganz = `${trennung[1]}${weiter[1]}`.toLowerCase();
        const mitStrich = `${trennung[1]}-${weiter[1]}`.toLowerCase();
        // Bindestrich behalten, wenn das Wort im Dokument nur mit Bindestrich vorkommt (risk-based)
        akt = !woerter.has(ganz) && woerter.has(mitStrich) ? akt + text : akt.slice(0, -1) + text;
      } else if (trennung) {
        // Gross oder Ziffer nach dem Strich: Bindestrich gehört zum Wort (KI-System)
        akt += text;
      } else {
        akt += ` ${text}`;
      }
    }
    vorher = z;
  }
  if (akt) absaetze.push(akt);
  return absaetze.join('\n');
}

// ---------------------------------------------------------------------------------------------------------------------
// 3. Kapitel 4 bis 10

interface Abschnitt {
  nr: string;
  titel: string;
  koerper: Z[];
}

const UEBERSCHRIFT = /^(\d{1,2}(?:\.\d{1,2}){0,3})\s+(\p{L}.*)$/u;

function teileNr(nr: string): number[] {
  return nr.split('.').map(Number);
}

/** Folgt b plausibel auf a? Erstes Kind (6.1 -> 6.1.1) oder nächstes Geschwister auf irgendeiner Ebene (6.1.4 -> 6.2, 7). */
function folgt(a: number[], b: number[]): boolean {
  if (b.length === a.length + 1 && b[b.length - 1] === 1 && a.every((x, i) => b[i] === x)) return true;
  for (let k = 1; k <= a.length; k++) {
    if (b.length !== k) continue;
    if (a.slice(0, k - 1).every((x, i) => b[i] === x) && b[k - 1] === a[k - 1]! + 1) return true;
  }
  return false;
}

function vergleiche(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? -1) - (b[i] ?? -1);
    if (d) return d;
  }
  return 0;
}

function haeufigsteSchrift(zeilen: Z[]): { font: string; h: number } {
  const z = new Map<string, number>();
  const hs = new Map<number, number>();
  for (const l of zeilen) {
    z.set(l.font, (z.get(l.font) ?? 0) + l.text.length);
    const h = Math.round(l.h * 2) / 2;
    hs.set(h, (hs.get(h) ?? 0) + l.text.length);
  }
  const font = [...z.entries()].reduce((a, b) => (b[1] > a[1] ? b : a), ['', 0])[0];
  const h = [...hs.entries()].reduce((a, b) => (b[1] > a[1] ? b : a), [0, 0])[0];
  return { font, h };
}

function zerlegeKapitel(zeilen: Z[], bekannt: Set<string>): Abschnitt[] {
  const koerper = haeufigsteSchrift(zeilen);
  const ausgezeichnet = (z: Z) => z.h > koerper.h + 0.5 || z.font !== koerper.font || (z.laeufe[0]?.font ?? z.font) !== koerper.font;
  const abschnitte: Abschnitt[] = [];
  let letzte: number[] | null = null;
  let akt: Abschnitt | null = null;
  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i]!;
    const m = UEBERSCHRIFT.exec(z.text);
    if (m && ausgezeichnet(z)) {
      const nr = teileNr(m[1]!);
      const kapitel = nr[0]!;
      const passt =
        kapitel >= 1 && kapitel <= 10 &&
        (letzte === null ? kapitel <= 4 : folgt(letzte, nr) || (bekannt.has(m[1]!) && vergleiche(nr, letzte) > 0 && kapitel <= letzte[0]! + 1));
      if (passt) {
        let titel = m[2]!.trim();
        // Titel über zwei Zeilen: gleiche Auszeichnung, keine neue Nummer, knapper Abstand
        const schrift = z.laeufe[z.laeufe.length - 1]?.font ?? z.font;
        while (i + 1 < zeilen.length) {
          const n = zeilen[i + 1]!;
          if (n.seite !== z.seite || UEBERSCHRIFT.test(n.text) || n.font !== schrift || schrift === koerper.font || n.y - z.y > 2.5 * z.h) break;
          titel = /-$/.test(titel) && /^\p{Ll}/u.test(n.text) ? titel.slice(0, -1) + n.text : `${titel} ${n.text}`;
          i++;
        }
        akt = { nr: m[1]!, titel, koerper: [] };
        abschnitte.push(akt);
        letzte = nr;
        continue;
      }
    }
    akt?.koerper.push(z);
  }
  return abschnitte;
}

// ---------------------------------------------------------------------------------------------------------------------
// 4. Anhang A (Tabelle)

const KOPF_TABELLE = /^(Table|Tabelle|Tableau)\s+A\.\d/i;
const LABEL_CONTROL = /^(Control|Ma\u00dfnahme|Massnahme|Steuerungsma\u00dfnahme|Steuerungsmassnahme|Mesure)$/i;

interface Spalten {
  titel: number;
  text: number;
}

function median(x: number[]): number {
  const s = [...x].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

interface ControlRoh {
  id: string;
  titel: Z[];
  text: Z[];
}

/** Läufe an einer Spaltengrenze teilen (Titel und Text ohne grosse Lücke im selben Lauf). */
function teileAn(laeufe: Lauf[], grenze: number): { links: Lauf[]; rechts: Lauf[] } {
  const links: Lauf[] = [];
  const rechts: Lauf[] = [];
  for (const l of laeufe) {
    if (l.x >= grenze) {
      rechts.push(l);
      continue;
    }
    const st = l.stuecke ?? [];
    const i = st.findIndex((s) => s.x >= grenze && s.text.trim());
    if (i <= 0) {
      links.push(l);
      continue;
    }
    const text = (t: { text: string }[]) => t.map((s) => s.text).join('').replace(/\s+/g, ' ').trim();
    links.push({ ...l, text: text(st.slice(0, i)), ende: st[i]!.x, stuecke: st.slice(0, i) });
    rechts.push({ ...l, x: st[i]!.x, text: text(st.slice(i)), stuecke: st.slice(i) });
  }
  return { links: links.filter((l) => l.text), rechts: rechts.filter((l) => l.text) };
}

function zerlegeAnhang(zeilen: Z[], norm: NormNr, erwartet: Erwartet): { controls: ControlRoh[]; gruppen: Map<string, string> } {
  const idMuster = norm === '42001' ? /^(A\.\d{1,2}(?:\.\d{1,2}){1,2})(?:\s+(.*))?$/ : /^([5-8]\.\d{1,2})(?:\s+(.*))?$/;
  const gruppeMuster = norm === '42001' ? /^(A\.\d{1,2}(?:\.\d{1,2})?)\s+(\p{L}.*)$/u : /^([5-8])\s+(\p{L}.*)$/u;
  const praefix = norm === '42001' ? '' : '27001-';
  const gruppenIds = new Set(erwartet.zusatz);
  const controlIds = new Set(erwartet.controls);
  const istGruppe = (nr: string) => gruppenIds.has(`${praefix}${nr}`);
  const istControlZeile = (z: Z) => {
    const m = idMuster.exec(z.laeufe[0]?.text ?? '');
    return m && !istGruppe(m[1]!) ? m : null;
  };

  // Spalten je Seite aus den Zeilen mit Control-Nummer: Titel beginnt nach der Nummer, Text nach einer grossen Lücke
  const spaltenJeSeite = new Map<number, Spalten>();
  const proSeite = new Map<number, { titel: number[]; text: number[] }>();
  for (const z of zeilen) {
    if (!istControlZeile(z)) continue;
    const rest = z.laeufe.slice(1);
    if (rest.length < 1) continue;
    const e = proSeite.get(z.seite) ?? { titel: [], text: [] };
    e.titel.push(rest[0]!.x);
    const t = rest.find((l) => l.x > rest[0]!.x + 3 * z.h);
    if (t) e.text.push(t.x);
    proSeite.set(z.seite, e);
  }
  for (const [s, e] of proSeite) if (e.text.length) spaltenJeSeite.set(s, { titel: median(e.titel), text: median(e.text) });
  const spaltenFuer = (seite: number): Spalten | undefined => {
    if (spaltenJeSeite.has(seite)) return spaltenJeSeite.get(seite);
    const gleich = [...spaltenJeSeite.keys()].filter((s) => s % 2 === seite % 2).sort((a, b) => Math.abs(a - seite) - Math.abs(b - seite))[0];
    if (gleich !== undefined) return spaltenJeSeite.get(gleich);
    const naechste = [...spaltenJeSeite.keys()].sort((a, b) => Math.abs(a - seite) - Math.abs(b - seite))[0];
    return naechste === undefined ? undefined : spaltenJeSeite.get(naechste);
  };

  // Tabellenkopf («Topic | Control»), der auf Folgeseiten wiederkehrt
  const kopfSchluessel = new Map<string, Set<number>>();
  for (const z of zeilen) {
    if (z.laeufe.length >= 1 && z.laeufe.length <= 3 && z.laeufe.every((l) => /^[\p{L}()-]+$/u.test(l.text))) {
      const k = z.text.toLowerCase();
      if (!kopfSchluessel.has(k)) kopfSchluessel.set(k, new Set());
      kopfSchluessel.get(k)!.add(z.seite);
    }
  }
  const istKopf = (z: Z) => KOPF_TABELLE.test(z.text) || /^\((continued|fortgesetzt|suite)\)$/i.test(z.text) || (kopfSchluessel.get(z.text.toLowerCase())?.size ?? 0) >= 2;

  const controls: ControlRoh[] = [];
  const gruppen = new Map<string, string>();
  let akt: ControlRoh | null = null;
  const teil = (z: Z, laeufe: Z['laeufe']): Z => ({ ...z, x: laeufe[0]!.x, text: laeufe.map((l) => l.text).join(' '), laeufe });
  for (const z of zeilen) {
    if (istKopf(z)) continue;
    const sp = spaltenFuer(z.seite);
    const m = istControlZeile(z);
    if (m) {
      const nr = m[1]!;
      akt = { id: `${praefix}${nr}`, titel: [], text: [] };
      if (controlIds.has(akt.id) || !controls.some((c) => c.id === akt!.id)) controls.push(akt);
      const rest = [...(m[2] ? [{ ...z.laeufe[0]!, text: m[2] }] : []), ...z.laeufe.slice(1)];
      const { links: ti, rechts: te } = teileAn(rest, sp ? sp.text - 3 : Infinity);
      if (ti.length) akt.titel.push(teil(z, ti));
      if (te.length) akt.text.push(teil(z, te));
      continue;
    }
    const g = gruppeMuster.exec(z.text);
    if (g && istGruppe(g[1]!) && (!sp || z.x < sp.titel - 2)) {
      gruppen.set(`${praefix}${g[1]!}`, g[2]!.trim());
      akt = null;
      continue;
    }
    if (!akt || !sp) continue;
    const grenzeTitel = (Math.min(z.laeufe[0]!.x, sp.titel) + sp.titel) / 2 - 2;
    if (z.laeufe[0]!.x < grenzeTitel && z.laeufe[0]!.x < sp.titel - 2 * z.h) {
      // Volle Breite (Ziel einer Gruppe, Legende): gehört zu keinem Control
      akt = null;
      continue;
    }
    const { links: ti, rechts: te } = teileAn(z.laeufe, sp.text - 3);
    if (ti.length) akt.titel.push(teil(z, ti));
    if (te.length) akt.text.push(teil(z, te));
  }
  // 27001: erste Zeile der Textspalte ist die Beschriftung «Control»
  for (const c of controls) if (c.text[0] && LABEL_CONTROL.test(c.text[0].text.trim())) c.text.shift();
  return { controls, gruppen };
}

// ---------------------------------------------------------------------------------------------------------------------
// Gesamtablauf

const ANHANG_A = /^(Annex|Anhang|Annexe)\s+A(\s*\((normative|normativ|informative|informativ)\).*)?$/;
const ANHANG_ENDE = /^((Annex|Anhang|Annexe)\s+[B-Z](\s*\((normative|normativ|informative|informativ)\).*)?|Bibliography|Bibliographie|Literaturhinweise|Literatur)$/;
const AENDERUNG = /^(Amendment|Änderung|AMENDMENT)\s*1\b|Amd\s*\.?\s*1\s*:\s*2024/;

function inEintraege(abschnitte: Abschnitt[], praefix: string, erwartet: Erwartet, woerter: Set<string>, ziel: Record<NormId, NormEintrag>): void {
  const erwarteteNr = new Set([...erwartet.abschnitte, ...erwartet.zusatz].filter((id) => id.startsWith(praefix)).map((id) => id.slice(praefix.length)));
  for (let i = 0; i < abschnitte.length; i++) {
    const a = abschnitte[i]!;
    if (!erwarteteNr.has(a.nr)) continue;
    const id = `${praefix}${a.nr}`;
    if (ziel[id]?.text) continue;
    const istKapitel = !a.nr.includes('.');
    const teile: string[] = [];
    if (!istKapitel) {
      const eigen = verbinde(a.koerper, woerter);
      if (eigen) teile.push(eigen);
      // Unterabschnitte ohne eigenen Katalogeintrag (7.5.1 bis 7.5.3 in 7.5) mit Überschrift anhängen
      for (let j = i + 1; j < abschnitte.length; j++) {
        const u = abschnitte[j]!;
        if (!u.nr.startsWith(`${a.nr}.`)) break;
        if (erwarteteNr.has(u.nr)) continue;
        teile.push(`${u.nr} ${u.titel}`);
        const t = verbinde(u.koerper, woerter);
        if (t) teile.push(t);
      }
    }
    ziel[id] = { titel: a.titel, text: teile.join('\n') };
  }
}

/** Zerlegt ein Norm-PDF (Zeilen je Seite). `erwartet` je Norm aus den Katalogen (erwartet.ts). */
export function zerlege(seitenRoh: Seite[], erwartetJeNorm: Record<NormNr, Erwartet>): ParseErgebnis {
  const erkennung = erkenne(seitenRoh);
  const leer: ParseErgebnis = { ...erkennung, eintraege: {}, gefunden: [], fehlend: [], nurAenderung: false, seiten: seitenRoh.length };
  if (!erkennung.norm) return leer;
  const norm = erkennung.norm;
  const erwartet = erwartetJeNorm[norm];
  const praefixK = norm === '42001' ? 'K-' : '27001-K-';
  const zeilen = flach(seitenBereinigen(seitenRoh));
  const woerter = woerterVon(zeilen);
  const koerperH = haeufigsteSchrift(zeilen).h;
  const iAnhang = zeilen.findIndex((z, i) => (ANHANG_A.test(z.text) || (/^(Annex|Anhang|Annexe)\s+A$/.test(z.text) && /^\((normative|normativ)\)/.test(zeilen[i + 1]?.text ?? ''))) && z.h >= koerperH);
  // Überschriften der Anhänge sind grösser gesetzt als der Fliesstext
  let iEnde = iAnhang >= 0 ? zeilen.findIndex((z, i) => i > iAnhang && ANHANG_ENDE.test(z.text) && z.h > koerperH + 0.5) : -1;
  if (iAnhang >= 0 && iEnde < 0) iEnde = zeilen.length;
  const eintraege: Record<NormId, NormEintrag> = {};

  // Änderung (Amd 1:2024 zu 27001): eigener Teil nach dem Haupttext oder ein PDF nur mit der Änderung
  const iAenderung = norm === '27001' ? zeilen.findIndex((z, i) => i >= Math.max(0, iEnde) && AENDERUNG.test(z.text) && z.h >= koerperH) : -1;
  const hauptEnde = iAnhang >= 0 ? iAnhang : iAenderung >= 0 ? iAenderung : zeilen.length;

  const bekannt = new Set([...erwartet.abschnitte, ...erwartet.zusatz].filter((id) => id.startsWith(praefixK)).map((id) => id.slice(praefixK.length)));
  inEintraege(zerlegeKapitel(zeilen.slice(0, hauptEnde), bekannt), praefixK, erwartet, woerter, eintraege);

  if (iAnhang >= 0) {
    const { controls, gruppen } = zerlegeAnhang(zeilen.slice(iAnhang + 1, iEnde), norm, erwartet);
    for (const [id, titel] of gruppen) eintraege[id] = { titel, text: '' };
    for (const c of controls) {
      const titel = verbinde(c.titel, woerter).replace(/\n/g, ' ');
      const text = verbinde(c.text, woerter);
      if (!eintraege[c.id] || (!eintraege[c.id]!.text && text)) eintraege[c.id] = { titel, text };
    }
  }

  let nurAenderung = false;
  if (iAenderung >= 0) {
    const teil = zeilen.slice(iAenderung + 1);
    const ergaenzt = zerlegeKapitel(teil, bekannt);
    const amd = erkennung.amd ?? 'Amd 1:2024';
    for (const a of ergaenzt) {
      const id = `${praefixK}${a.nr}`;
      if (!erwartet.abschnitte.includes(id)) continue;
      const zusatz = verbinde(a.koerper, woerter);
      if (!zusatz) continue;
      const alt = eintraege[id];
      eintraege[id] = { titel: alt?.titel || a.titel, text: [alt?.text, `[${amd}] ${zusatz}`].filter(Boolean).join('\n') };
    }
    nurAenderung = !erwartet.controls.some((id) => eintraege[id]);
  }

  const pflicht = pflichtIds(erwartet);
  const gefunden = pflicht.filter((id) => eintraege[id]?.titel && eintraege[id]?.text);
  return { ...erkennung, eintraege, gefunden, fehlend: pflicht.filter((id) => !gefunden.includes(id)), nurAenderung, seiten: seitenRoh.length };
}
