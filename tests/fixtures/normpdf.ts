// SYNTHETISCHE Norm-PDF für Tests des Normtext-Imports. Aufbau wie eine ISO-Norm (Deckblatt, Inhaltsverzeichnis,
// Kapitel 4 bis 10, Anhang A als Tabelle, Anhang B, Literatur, optional Änderung), aber nur selbst erfundener Text
// («Testtitel», «Prüfobjekt», «Quux-Verfahren»). Kein Satz aus einer echten Norm. Wird zur Testzeit erzeugt, nie gespeichert.
//
// Liefert die Seiten als Zeilen (für den Parser ohne pdf.js), als PDF-Bytes (pdf.js in Node und im Browser) und die
// erwarteten Einträge je ID.
import type { Erwartet } from '../../src/normtexte/erwartet.ts';
import { zeilenAusStuecken, type RohStueck, type Seite } from '../../src/normtexte/zeilen.ts';

const GEDANKENSTRICH = String.fromCharCode(0x2014);
const BREITE = 595;
const HOEHE = 842;

interface Text {
  x: number;
  /** von oben */
  y: number;
  text: string;
  fett?: boolean;
  groesse: number;
  rotiert?: boolean;
}

export interface SynthOptionen {
  norm: '42001' | '27001';
  sprache: 'de' | 'en';
  /** Nationale Ausgabe im Kopf, z. B. «SN EN» oder «DIN EN» */
  national?: string;
  /** 27001: Änderung Amd 1:2024 als eigener Teil nach dem Haupttext */
  amd?: boolean;
  /** IDs, die im PDF fehlen sollen */
  ohne?: string[];
  /** Nur die Änderung (27001), ohne Haupttext */
  nurAmd?: boolean;
}

export interface SynthNorm {
  seiten: Text[][];
  /** Erwartete Einträge (Titel, Text mit \n zwischen Absätzen) */
  erwartet: Record<string, { titel: string; text: string }>;
}

const W = {
  de: { org: 'Die Organisation', muss: 'muss', ziel: 'Ziel', inhalt: 'Inhalt', seite: 'Seite', anhang: 'Anhang', normativ: '(normativ)', informativ: '(informativ)', tabelle: 'Tabelle', fort: '(fortgesetzt)', thema: 'Thema', control: 'Steuerung', label27001: 'Massnahme', literatur: 'Literaturhinweise', anmerkung: 'ANMERKUNG', aenderung: 'Änderung 1' },
  en: { org: 'The organization', muss: 'shall', ziel: 'Objective', inhalt: 'Contents', seite: 'Page', anhang: 'Annex', normativ: '(normative)', informativ: '(informative)', tabelle: 'Table', fort: '(continued)', thema: 'Topic', control: 'Control', label27001: 'Control', literatur: 'Bibliography', anmerkung: 'NOTE', aenderung: 'Amendment 1' },
};

/** Erfundener Fliesstext je ID: mehrere Absätze, Aufzählung, Anmerkung, langes Wort für die Silbentrennung. */
function absaetze(id: string, s: 'de' | 'en', kurz = false): string[] {
  const w = W[s];
  const nr = id.replace(/^27001-/, '').replace(/^K-/, '');
  if (s === 'en') {
    if (kurz) return [`${w.org} ${w.muss} determine the test object ${nr} with the quux method and the zorbeldocumentationfilingsystem.`];
    return [
      `${w.org} ${w.muss} determine a synthetic test object for clause ${nr} that only exists in this test and keep the quux verificationprocedurerecords.`,
      `a) first feature ${nr} of the test series;`,
      `b) second feature ${nr} of the test series.`,
      `${w.anmerkung} Invented note on ${nr} without meaning.`,
    ];
  }
  if (kurz) return [`${w.org} ${w.muss} das Prüfobjekt ${nr} nach dem Quux-Verfahren mit Zorbel-Dokumentationsunterlagenverwaltung bestimmen und festhalten.`];
  return [
    `${w.org} ${w.muss} für Abschnitt ${nr} ein synthetisches Prüfobjekt bestimmen, das nur in diesem Test vorkommt, und dazu die Quux-Prüfverfahrensbeschreibungen aufbewahren.`,
    `a) erstes Merkmal ${nr} der Testreihe;`,
    `b) zweites Merkmal ${nr} der Testreihe.`,
    `${w.anmerkung} Erfundene Anmerkung zu ${nr} ohne Bedeutung.`,
  ];
}

function titel(id: string, s: 'de' | 'en'): string {
  const nr = id.replace(/^27001-/, '').replace(/^K-/, '');
  return s === 'de' ? `Testtitel ${nr} Bravo` : `Test title ${nr} bravo`;
}

/** Zeilenumbruch nach Zeichen; zu lange Wörter mit Trennstrich (Silbentrennung) */
function umbrechen(text: string, max: number): string[] {
  const zeilen: string[] = [];
  let akt = '';
  for (const wort of text.split(' ')) {
    const kandidat = akt ? `${akt} ${wort}` : wort;
    if (kandidat.length <= max) {
      akt = kandidat;
      continue;
    }
    const platz = max - akt.length - (akt ? 2 : 1);
    if (wort.length > 12 && platz >= 5 && /^\p{L}+$/u.test(wort.slice(0, platz))) {
      zeilen.push(`${akt ? `${akt} ` : ''}${wort.slice(0, platz)}-`);
      akt = wort.slice(platz);
    } else {
      if (akt) zeilen.push(akt);
      akt = wort;
    }
  }
  if (akt) zeilen.push(akt);
  return zeilen;
}

class Satz {
  seiten: Text[][] = [];
  y = 0;
  constructor(private readonly o: SynthOptionen) {
    this.neueSeite();
  }
  get links(): number {
    return this.seiten.length % 2 === 0 ? 37 : 71;
  }
  neueSeite(): void {
    const bez = `${this.o.national ? `${this.o.national} ` : ''}ISO/IEC ${this.o.norm}:${this.o.national ? '2026' : this.o.norm === '42001' ? '2023' : '2022'} ${this.o.sprache}`;
    const seite: Text[] = [
      { x: 300, y: 30, text: bez, groesse: 10 },
      { x: 300, y: 48, text: `ISO/IEC ${this.o.norm}:${this.o.norm === '42001' ? '2023' : '2022'}(${this.o.sprache === 'de' ? 'D' : 'E'})`, groesse: 10 },
      { x: 300, y: 815, text: `${W[this.o.sprache].seite} ${this.seiten.length + 1}`, groesse: 9 },
      { x: 60, y: 826, text: this.o.sprache === 'de' ? '© Testverlag 2026 Alle Rechte vorbehalten' : '© Test publisher 2026 All rights reserved', groesse: 8 },
      { x: 20, y: 600, text: 'Normen-Download Testverlag KdNr.0000 Testkunde', groesse: 7, rotiert: true },
    ];
    this.seiten.push(seite);
    this.y = 100;
  }
  platz(h: number): void {
    if (this.y + h > 770) this.neueSeite();
  }
  zeile(text: string, o: { x?: number; fett?: boolean; groesse?: number; abstand?: number } = {}): void {
    const g = o.groesse ?? 11;
    this.platz(g + 4);
    this.seiten[this.seiten.length - 1]!.push({ x: this.links + (o.x ?? 0), y: this.y, text, fett: o.fett, groesse: g });
    this.y += o.abstand ?? 13;
  }
  luecke(n = 8): void {
    this.y += n;
  }
}

/** Synthetische Norm nach den erwarteten IDs des Kits (Nummern aus den Katalogen, Text erfunden). */
export function synthetischeNorm(e: Erwartet, o: SynthOptionen): SynthNorm {
  const s = new Satz(o);
  const w = W[o.sprache];
  const erwartet: SynthNorm['erwartet'] = {};
  const ohne = new Set(o.ohne ?? []);
  const praefixK = o.norm === '42001' ? 'K-' : '27001-K-';
  const national = o.national ? `${o.national} ` : '';

  // Deckblatt und Inhaltsverzeichnis
  s.zeile(`${national}EN ISO/IEC ${o.norm}:2026`, { fett: true, groesse: 16, abstand: 30 });
  s.zeile(`ISO/IEC ${o.norm}:${o.norm === '42001' ? '2023' : '2022'}${o.amd ? '/Amd 1:2024' : ''}`, { groesse: 12, abstand: 30 });
  s.zeile(o.sprache === 'de' ? 'Lizenziert für Testfirma AG, Einzelplatz' : 'Licensed to Test company Ltd, single user', { groesse: 8 });
  s.neueSeite();
  s.zeile(w.inhalt, { fett: true, groesse: 14, abstand: 20 });
  const kapitel = [...new Set([...e.abschnitte].map((id) => id.slice(praefixK.length).split('.')[0]!))];
  for (const k of kapitel) s.zeile(`${k} ${titel(`${praefixK}${k}`, o.sprache)} ${'.'.repeat(40)} ${Number(k) + 2}`);
  s.zeile(`${w.anhang} A ${w.normativ} ${'.'.repeat(30)} 20`);
  s.neueSeite();

  if (!o.nurAmd) {
    // Kapitel 4 bis 10
    const mitUnter = new Set(['7.5', '9.2', '9.3']);
    const geschrieben = new Set<string>();
    for (const id of e.abschnitte) {
      const nr = id.slice(praefixK.length);
      const k = nr.split('.')[0]!;
      if (!geschrieben.has(k)) {
        geschrieben.add(k);
        s.luecke(10);
        s.zeile(`${k} ${titel(`${praefixK}${k}`, o.sprache)}`, { fett: true, groesse: 13, abstand: 20 });
        if (e.zusatz.includes(`${praefixK}${k}`)) erwartet[`${praefixK}${k}`] = { titel: titel(`${praefixK}${k}`, o.sprache), text: '' };
      }
      const eltern = nr.split('.').slice(0, -1).join('.');
      if (nr.split('.').length === 3 && !geschrieben.has(eltern)) {
        geschrieben.add(eltern);
        s.zeile(`${eltern} ${titel(eltern, o.sprache)}`, { fett: true, groesse: 12, abstand: 18 });
      }
      if (ohne.has(id)) continue;
      s.zeile(`${nr} ${titel(id, o.sprache)}`, { fett: true, groesse: nr.split('.').length === 3 ? 11 : 12, abstand: 18 });
      const text: string[] = [];
      for (const a of absaetze(id, o.sprache)) {
        for (const z of umbrechen(a, 80)) s.zeile(z);
        s.luecke();
        text.push(a);
      }
      if (mitUnter.has(nr)) {
        for (const u of [1, 2]) {
          const un = `${nr}.${u}`;
          s.zeile(`${un} ${titel(un, o.sprache)}`, { fett: true, groesse: 11, abstand: 18 });
          text.push(`${un} ${titel(un, o.sprache)}`);
          for (const a of absaetze(un, o.sprache, true)) {
            for (const z of umbrechen(a, 80)) s.zeile(z);
            s.luecke();
            text.push(a);
          }
        }
      }
      erwartet[id] = { titel: titel(id, o.sprache), text: text.join('\n') };
    }

    // Anhang A: Tabelle mit Nummer, Titel, Text
    s.neueSeite();
    s.zeile(`${w.anhang} A`, { x: 200, fett: true, groesse: 16, abstand: 18 });
    s.zeile(w.normativ, { x: 190, groesse: 16, abstand: 30 });
    s.zeile(`A.1 ${o.sprache === 'de' ? 'Allgemeines' : 'General'}`, { fett: true, groesse: 13, abstand: 18 });
    s.zeile(o.sprache === 'de' ? 'Erfundene Einleitung zur Tabelle ohne Bedeutung.' : 'Invented introduction to the table without meaning.', { abstand: 24 });
    const kopf = () => {
      s.zeile(`${w.tabelle} A.1 ${w.fort}`, { x: 130, fett: true, groesse: 10, abstand: 16 });
      const seite = s.seiten[s.seiten.length - 1]!;
      seite.push({ x: s.links + 71, y: s.y, text: w.thema, fett: true, groesse: 10 }, { x: s.links + 229, y: s.y, text: w.control, fett: true, groesse: 10 });
      s.y += 16;
    };
    s.zeile(`${w.tabelle} A.1 ${GEDANKENSTRICH} ${o.sprache === 'de' ? 'Testcontrols' : 'Test controls'}`, { x: 130, fett: true, groesse: 11, abstand: 16 });
    kopf();
    const praefixC = o.norm === '42001' ? '' : '27001-';
    const gruppen = e.zusatz.filter((g) => !g.startsWith(praefixK));
    for (const id of e.controls) {
      const nr = id.slice(praefixC.length);
      // Gruppe (und Untergruppe), sobald die erste Control-Nummer dazu kommt
      for (const g of gruppen) {
        const gnr = g.slice(praefixC.length);
        if (erwartet[g] || !nr.startsWith(`${gnr}.`)) continue;
        if (s.y > 700) {
          s.neueSeite();
          kopf();
        }
        const gt = `${o.sprache === 'de' ? 'Testgruppe' : 'Test group'} ${gnr}`;
        s.zeile(`${gnr} ${gt}`, { x: 3, fett: true, groesse: 10, abstand: 14 });
        if (o.norm === '42001') s.zeile(`${w.ziel}: ${o.sprache === 'de' ? 'Erfundenes Ziel der Gruppe' : 'Invented objective of the group'} ${gnr}.`, { x: 3, groesse: 10, abstand: 15 });
        erwartet[g] = { titel: gt, text: '' };
      }
      if (ohne.has(id)) continue;
      const ti = o.sprache === 'de' ? `Testcontrol ${nr} mit Bezeichnungsverlängerung` : `Test control ${nr} with designationextension`;
      const satz = o.sprache === 'de'
        ? `${w.org} ${w.muss} das Control ${nr} als Prüfobjekt mit Quux-Verfahren und Zorbelunterlagenablage umsetzen und regelmässig bewerten.`
        : `${w.org} ${w.muss} implement control ${nr} as a test object with the quux method and zorbelrecordfiling and evaluate it regularly.`;
      const tiZeilen = umbrechen(ti, 26);
      const teZeilen = [...(o.norm === '27001' ? [w.label27001] : []), ...umbrechen(satz, 48)];
      const n = Math.max(tiZeilen.length, teZeilen.length);
      if (s.y + n * 11 > 760) {
        s.neueSeite();
        kopf();
      }
      const seite = s.seiten[s.seiten.length - 1]!;
      seite.push({ x: s.links + 3, y: s.y, text: nr, fett: true, groesse: 10 });
      for (let i = 0; i < n; i++) {
        if (tiZeilen[i]) seite.push({ x: s.links + 71, y: s.y + i * 11, text: tiZeilen[i]!, groesse: 10 });
        if (teZeilen[i]) seite.push({ x: s.links + 229, y: s.y + i * 11, text: teZeilen[i]!, groesse: 10 });
      }
      s.y += n * 11 + 6;
      erwartet[id] = { titel: ti, text: satz };
    }

    // Anhang B mit gleichen Titeln (darf nicht als Anhang A gelten), Literatur
    s.neueSeite();
    s.zeile(`${w.anhang} B`, { x: 200, fett: true, groesse: 16, abstand: 18 });
    s.zeile(w.informativ, { x: 190, groesse: 16, abstand: 30 });
    s.zeile(`B.2.2 ${titel('B.2.2', o.sprache)}`, { fett: true, groesse: 12, abstand: 18 });
    s.zeile(o.sprache === 'de' ? 'A.2.2 Querverweis ohne Bedeutung im Anhang B.' : 'A.2.2 Cross reference without meaning in Annex B.');
    s.neueSeite();
    s.zeile(w.literatur, { fett: true, groesse: 16, abstand: 24 });
    s.zeile('[1] Erfundene Quelle 1');
  }

  // Änderung (27001, Amd 1:2024): Ergänzung zu 4.1 und 4.2
  if (o.amd) {
    s.neueSeite();
    s.zeile(w.aenderung, { fett: true, groesse: 16, abstand: 24 });
    for (const nr of ['4.1', '4.2']) {
      const id = `${praefixK}${nr}`;
      s.zeile(`${nr} ${titel(id, o.sprache)}`, { fett: true, groesse: 12, abstand: 18 });
      const zusatz = `${o.sprache === 'de' ? 'Erfundener Zusatzsatz zum Klimathema' : 'Invented additional sentence on the climate topic'} ${nr}.`;
      s.zeile(zusatz);
      s.luecke();
      const alt = erwartet[id];
      erwartet[id] = { titel: alt?.titel ?? titel(id, o.sprache), text: [alt?.text, `[Amd 1:2024] ${zusatz}`].filter(Boolean).join('\n') };
    }
  }
  return { seiten: s.seiten, erwartet };
}

// ---------------------------------------------------------------------------------------------------------------------
// Ausgabe als Zeilen (ohne pdf.js) und als PDF

const breiteText = (t: string, g: number, fett?: boolean) => t.length * g * (fett ? 0.56 : 0.5);

/** Seiten wie aus pdf.js (Stücke je Wort), für den Parser ohne Bibliothek */
export function alsSeiten(n: SynthNorm): Seite[] {
  return n.seiten.map((seite, i) => {
    const stuecke: RohStueck[] = [];
    for (const t of seite) {
      let x = t.x;
      const woerter = t.text.split(' ');
      woerter.forEach((w, j) => {
        const st = j < woerter.length - 1 ? `${w} ` : w;
        const b = breiteText(st, t.groesse, t.fett);
        stuecke.push({ str: st, x, y: HOEHE - t.y, w: b, h: t.groesse, font: t.fett ? 'F2' : 'F1', rotiert: t.rotiert });
        x += b;
      });
    }
    return zeilenAusStuecken({ breite: BREITE, hoehe: HOEHE, stuecke }, i + 1);
  });
}

const WINANSI: Record<number, number> = { 0x2014: 0x97, 0x2013: 0x96, 0x2026: 0x85, 0x201c: 0x93, 0x201d: 0x94, 0x2019: 0x92 };

function pdfString(t: string): string {
  let aus = '';
  for (const z of t) {
    const c = z.codePointAt(0)!;
    const b = WINANSI[c] ?? (c < 256 ? c : 0x3f);
    if (z === '(' || z === ')' || z === '\\') aus += `\\${z}`;
    else if (b < 32 || b > 126) aus += `\\${b.toString(8).padStart(3, '0')}`;
    else aus += String.fromCharCode(b);
  }
  return `(${aus})`;
}

/** Minimale PDF 1.4 mit Helvetica und Helvetica-Bold (WinAnsi), ein Inhaltsstrom je Seite. */
export function alsPdf(n: SynthNorm): Uint8Array {
  const objekte: string[] = [];
  const seitenIds: number[] = [];
  objekte[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objekte[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objekte[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  let nr = 5;
  for (const seite of n.seiten) {
    const inhalt = seite
      .map((t) => {
        const y = HOEHE - t.y;
        const m = t.rotiert ? `0.7071 0.7071 -0.7071 0.7071 ${t.x} ${y}` : `1 0 0 1 ${t.x} ${y}`;
        return `BT /${t.fett ? 'F2' : 'F1'} ${t.groesse} Tf ${m} Tm ${pdfString(t.text)} Tj ET`;
      })
      .join('\n');
    const inhaltId = nr++;
    const seitenId = nr++;
    objekte[inhaltId] = `<< /Length ${Buffer.byteLength(inhalt, 'latin1')} >>\nstream\n${inhalt}\nendstream`;
    objekte[seitenId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${BREITE} ${HOEHE}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${inhaltId} 0 R >>`;
    seitenIds.push(seitenId);
  }
  objekte[2] = `<< /Type /Pages /Kids [${seitenIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${seitenIds.length} >>`;
  let pdf = '%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n';
  const offsets: number[] = [];
  for (let i = 1; i < objekte.length; i++) {
    offsets[i] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${i} 0 obj\n${objekte[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objekte.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objekte.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objekte.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, 'latin1'));
}
