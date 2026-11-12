// Reichhaltige Musterdokumente für Generatortests und Sichtprüfung (Spike S2).
// Bewusst ohne Kit-Absender: findet ein Test «KMU-CIO» in der Ausgabe, stammt es vom Renderer.
import { zlibSync } from 'fflate';
import type { Block, DocxDokument, Farbrolle, Lauf, XlsxMappe } from '../../src/generator/ir.ts';

const P = (text: string): Lauf => ({ text, platzhalter: true });

// Kleines PNG-Logo erzeugen (ohne Bilddatei im Repo)

function crc32(daten: Uint8Array): number {
  let c = ~0;
  for (const b of daten) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(typ: string, daten: Uint8Array): Uint8Array {
  const aus = new Uint8Array(12 + daten.length);
  const dv = new DataView(aus.buffer);
  dv.setUint32(0, daten.length);
  aus.set(new TextEncoder().encode(typ), 4);
  aus.set(daten, 8);
  dv.setUint32(8 + daten.length, crc32(aus.subarray(4, 8 + daten.length)));
  return aus;
}

/** Logo 160 x 48 px: dunkelblaues Feld mit hellem Balken. */
export function musterLogo(): Uint8Array {
  const w = 160;
  const h = 48;
  const roh = new Uint8Array(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    roh[y * (1 + w * 3)] = 0;
    for (let x = 0; x < w; x++) {
      const i = y * (1 + w * 3) + 1 + x * 3;
      const balken = y > 18 && y < 30 && x > 50;
      roh[i] = balken ? 0xdc : 0x1f;
      roh[i + 1] = balken ? 0xe3 : 0x3a;
      roh[i + 2] = balken ? 0xec : 0x5f;
    }
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const teile = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibSync(roh)),
    chunk('IEND', new Uint8Array()),
  ];
  const png = new Uint8Array(teile.reduce((n, t) => n + t.length, 0));
  let o = 0;
  for (const t of teile) {
    png.set(t, o);
    o += t.length;
  }
  return png;
}

export const FIRMA = 'Müller Präzisionsteile AG';

const lenkung = {
  dokumentId: 'D-07',
  titel: 'Risikobeurteilung KI-Systeme',
  version: '0.9 (Entwurf)',
  eigner: [P('[Name, Funktion]')],
  freigabeDurch: 'Geschäftsleitung',
  datum: [P('[TT.MM.JJJJ]')],
  klassifikation: 'Intern',
  normbezug: 'ISO/IEC 42001, Abschnitte 6.1.2 und 8.2',
  ismsBezug: 'erweitert (ISO/IEC 27001, Abschnitt 6.1.2)',
  pfad: 'mit und ohne ISMS',
};

/** Lange Tabelle: 70 Zeilen, läuft sicher über mehr als eine Seite. */
export const LANGE_TABELLE_ZEILEN = 70;

const bloecke: Block[] = [
  {
    typ: 'hinweis',
    art: 'namensnennung',
    text: 'Diese Vorlage steht unter CC BY 4.0. Bitte diesen Kasten vor der Freigabe löschen.',
  },
  { typ: 'ueberschrift', ebene: 1, text: '1 Zweck und Geltungsbereich' },
  {
    typ: 'absatz',
    text: [
      { text: 'Dieses Dokument beschreibt, wie die ' },
      { text: FIRMA, fett: true },
      { text: ' Risiken ihrer KI-Systeme beurteilt. Es gilt für ' },
      P('[Standorte / Bereiche]'),
      { text: ' und wird ' },
      { text: 'mindestens jährlich', kursiv: true },
      { text: ' überprüft. Sonderzeichen: äöü ÄÖÜ é à ç « » ‹ › € §.' },
    ],
  },
  {
    typ: 'hinweis',
    art: 'ausfuellhinweis',
    text: [
      { text: 'Beschreiben Sie den Geltungsbereich in zwei bis drei Sätzen. Ersetzen Sie alle ' },
      P('[gelb markierten]'),
      { text: ' Stellen.' },
    ],
  },
  {
    typ: 'hinweis',
    art: 'normverweis',
    text: 'Anforderungstext siehe ISO/IEC 42001, Abschnitt 6.1.2.',
  },
  { typ: 'ueberschrift', ebene: 2, text: '1.1 Begriffe' },
  {
    typ: 'liste',
    punkte: [
      'KI-System: maschinengestütztes System mit gewissem Grad an Autonomie',
      [{ text: 'Risikoeigner/in', fett: true }, { text: ': verantwortet die Behandlung' }],
      'Restrisiko: Risiko nach der Behandlung',
    ],
  },
  { typ: 'ueberschrift', ebene: 2, text: '1.2 Ablauf' },
  { typ: 'liste', nummeriert: true, punkte: ['Risiken identifizieren', 'Risiken analysieren', 'Risiken bewerten'] },
  { typ: 'absatz', text: 'Zweite nummerierte Liste (beginnt wieder bei 1):' },
  { typ: 'liste', nummeriert: true, punkte: ['Behandlung planen', 'Wirksamkeit prüfen'] },
  {
    typ: 'hinweis',
    art: 'ausbau',
    titel: 'Quantitative Bewertung',
    text: 'Wer bereits ein ISMS mit Schadenshöhen in Franken führt, kann die Skala übernehmen.',
  },
  { typ: 'ueberschrift', ebene: 3, text: '1.2.1 Bewertungsskala' },
  {
    typ: 'felder',
    felder: [
      { label: 'Wahrscheinlichkeit', wert: '1 (selten) bis 5 (häufig)' },
      { label: 'Auswirkung', wert: '1 (gering) bis 5 (existenzbedrohend)' },
      { label: 'Risikowert', wert: [{ text: 'Wahrscheinlichkeit × Auswirkung, Schwelle ' }, P('[12]')] },
    ],
  },
  {
    typ: 'hinweis',
    art: 'beispiel',
    titel: 'Chatbot im Kundendienst',
    text: 'Halluzinierte Lieferzusagen; Wahrscheinlichkeit 3, Auswirkung 4, Risikowert 12.',
  },
  { typ: 'seitenumbruch' },
  { typ: 'ueberschrift', ebene: 1, text: '2 Risikoregister' },
  {
    typ: 'tabelle',
    kopf: ['ID', 'KI-System', 'Risiko', 'W', 'A', 'Massnahme'],
    breiten: [8, 18, 34, 5, 5, 30],
    zeilen: Array.from({ length: LANGE_TABELLE_ZEILEN }, (_, i) => {
      const n = String(i + 1).padStart(3, '0');
      return [
        `R-${n}`,
        `KI-${String((i % 7) + 1).padStart(3, '0')}`,
        `Risiko Nummer ${i + 1}: Daten werden ungeprüft übernommen und führen zu Fehlentscheiden`,
        String((i % 5) + 1),
        String(((i + 2) % 5) + 1),
        i % 9 === 0 ? [P('[Massnahme festlegen]')] : `M-${n} Vier-Augen-Prüfung einführen`,
      ];
    }),
    leereZeilen: 3,
  },
  { typ: 'absatz', text: 'Ende des Risikoregisters.' },
  { typ: 'ueberschrift', ebene: 1, text: '3 Freigabe' },
  { typ: 'unterschriften', felder: ['Erstellt', 'Geprüft', 'Freigegeben'] },
];

export function musterDocx(): DocxDokument {
  return {
    sprache: 'de',
    kopf: {
      firmenname: FIRMA,
      logoPng: musterLogo(),
      fusszeile: 'Klassifikation: Intern',
    },
    lenkung,
    eigenschaften: { titel: 'D-07 Risikobeurteilung KI-Systeme', autor: FIRMA, betreff: 'AIMS' },
    bloecke,
  };
}

/** Vorlage ohne Firmenangaben: Kopfzeile wird zum Platzhalter, Autor leer. */
export function musterDocxLeer(): DocxDokument {
  const d = musterDocx();
  return {
    ...d,
    kopf: { firmenname: '', fusszeile: [P('[Klassifikation]')] },
    eigenschaften: { titel: d.eigenschaften.titel, autor: '' },
  };
}

export const MASSNAHMEN_STATUS = ['offen', 'in Arbeit', 'erledigt, wirksam', 'erledigt, nicht wirksam'];

export function musterXlsx(): XlsxMappe {
  return {
    sprache: 'de',
    eigenschaften: { titel: 'D-08 KI-Register', autor: FIRMA },
    lenkung: { ...lenkung, dokumentId: 'D-08', titel: 'KI-Register und Risiken' },
    firmenname: FIRMA,
    hinweisBlock: [
      { typ: 'hinweis', art: 'namensnennung', text: 'Diese Vorlage steht unter CC BY 4.0.' },
      { typ: 'hinweis', art: 'normverweis', text: 'Anforderungstext siehe ISO/IEC 42001, Abschnitt 6.1.' },
      { typ: 'absatz', text: 'Die Blätter «Inventar», «Risiken» und «Massnahmen» sind verknüpft.' },
    ],
    blaetter: [
      {
        name: 'Inventar',
        titel: 'Inventar der KI-Systeme',
        hinweise: ['Ein KI-System pro Zeile. Auswahlwerte über die Pfeile in den Spalten wählen.'],
        spalten: [
          { kopf: 'ID', breite: 9 },
          { kopf: 'Bezeichnung', breite: 30, umbruch: true },
          { kopf: 'Typ', breite: 18, typ: 'liste', liste: ['Eigenentwicklung', 'SaaS', 'Eingebettet'] },
          { kopf: 'Lebenszyklus', breite: 16, typ: 'liste', liste: ['Planung', 'Betrieb', 'Ausserbetrieb'] },
          { kopf: 'Eingeführt', breite: 13, typ: 'datum' },
        ],
        zeilen: [
          ['KI-001', 'Chatbot Kundendienst (Übersetzung für Österreich)', 'SaaS', 'Betrieb', '2026-03-15'],
          ['KI-002', 'Bildprüfung Drehteile', 'Eigenentwicklung', 'Planung', null],
        ],
        leereZeilen: 20,
        fixiert: true,
      },
      {
        name: 'Risiken',
        titel: 'Risikoregister',
        hinweise: ['Risikowert = Wahrscheinlichkeit × Auswirkung (Formel, nicht überschreiben).', 'Ampel: bis 6 grün, bis 12 gelb, darüber rot.'],
        spalten: [
          { kopf: 'ID', breite: 8 },
          { kopf: 'KI-System', breite: 10 },
          { kopf: 'Beschreibung', breite: 40, umbruch: true },
          { kopf: 'Wahrschein-\nlichkeit', breite: 12, typ: 'zahl' },
          { kopf: 'Auswirkung', breite: 12, typ: 'zahl' },
          { kopf: 'Risikowert', breite: 11, typ: 'formel', formel: '=IF(OR(D{r}="",E{r}=""),"",D{r}*E{r})' },
          { kopf: 'Behandlung', breite: 16, typ: 'liste', liste: ['vermindern', 'vermeiden', 'teilen', 'akzeptieren'] },
        ],
        zeilen: [
          ['R-001', 'KI-001', 'Falsche Lieferzusagen durch Halluzination', 3, 4, null, 'vermindern'],
          ['R-002', 'KI-002', 'Ausschuss wird nicht erkannt', 13, 17, null, 'vermeiden'],
          ['R-003', 'KI-001', 'Personendaten im Prompt', 1, 2, null, 'akzeptieren'],
        ],
        leereZeilen: 15,
        fixiert: true,
        ampel: { spalte: 5, gruenBis: 6, gelbBis: 12 },
      },
      {
        name: 'Massnahmen',
        titel: 'Massnahmenplan',
        spalten: [
          { kopf: 'ID', breite: 8 },
          { kopf: 'Massnahme', breite: 40, umbruch: true },
          { kopf: 'Status', breite: 22, typ: 'liste', liste: MASSNAHMEN_STATUS },
          { kopf: 'Termin', breite: 13, typ: 'datum' },
        ],
        zeilen: [['M-001', 'Vier-Augen-Prüfung für Lieferzusagen', 'in Arbeit', '2026-12-31']],
        leereZeilen: 10,
      },
    ],
  };
}

// Grafik-Blöcke (matrix, diagramm, ablauf) und XLSX mit Matrix-Blatt, bedingten Formaten und zwei Ampeln

/** Risikomatrix 4×4 (Zeilen A absteigend, Spalten W), Diagramme und Ablauf mit Konnektoren */
export function musterGrafikBloecke(): Block[] {
  const stufe = (wert: number): Farbrolle => (wert >= 12 ? 'risiko-hoch' : wert > 4 ? 'risiko-mittel' : 'risiko-tief');
  const kurz = (wert: number) => (wert >= 12 ? 'H' : wert > 4 ? 'M' : 'T');
  return [
    { typ: 'ueberschrift', ebene: 1, text: 'Grafiken' },
    {
      typ: 'matrix',
      titel: 'Risikomatrix vor Behandlung',
      ecke: 'A \\ W',
      spalten: [1, 2, 3, 4].map((w) => `W ${w}`),
      zeilen: [4, 3, 2, 1].map((a) => ({ kopf: `A ${a}`, zellen: [1, 2, 3, 4].map((w) => ({ zeilen: [`${kurz(w * a)} ${w * a}`, w === a ? '1 Risiko' : 'keines'], rolle: stufe(w * a) })) })),
      legende: [
        { rolle: 'risiko-tief', text: 'T tief: bis 4' },
        { rolle: 'risiko-mittel', text: 'M mittel: 6 bis 9' },
        { rolle: 'risiko-hoch', text: 'H hoch: ab 12' },
      ],
      alt: 'Risikomatrix vor Behandlung: 4 Risiken eingeordnet.',
    },
    {
      typ: 'diagramm',
      art: 'stapel',
      titel: 'Umsetzung Anhang A je Gruppe',
      kategorien: ['A.2', 'A.3', 'A.4'],
      reihen: [
        { name: 'umgesetzt', werte: [2, 1, 3], rolle: 'status-gut' },
        { name: 'teilweise', werte: [1, 0, 1], rolle: 'status-warnung' },
      ],
      achse: { titel: 'Anzahl Controls', min: 0, schritt: 1 },
      alt: { titel: 'Umsetzung Anhang A', beschreibung: 'A.2: 2 umgesetzt, 1 teilweise; A.3: 1 umgesetzt; A.4: 3 umgesetzt, 1 teilweise.' },
    },
    {
      typ: 'diagramm',
      art: 'linie',
      titel: 'Schulungsquote',
      kategorien: ['30.11.2026', '31.12.2026', '31.01.2027'],
      reihen: [
        { name: 'Messwert', werte: [64, 82, 96], rolle: 'kat-1', marker: true },
        { name: 'Sollwert (mindestens 95 %)', werte: [95, 95, 95], rolle: 'kat-2', gestrichelt: true },
      ],
      achse: { min: 0, max: 100, schritt: 20, format: '0" %"' },
      alt: { titel: 'Schulungsquote', beschreibung: 'Messwerte: 64 %, 82 %, 96 %. Sollwert mindestens 95 %.' },
    },
    {
      typ: 'ablauf',
      spalten: 3,
      zeilen: 3,
      knoten: [
        { id: 'start', form: 'start', text: 'KI-System erfasst', spalte: 0, zeile: 0, breite: 2 },
        { id: 'frage', form: 'frage', text: 'Eigener Name?', spalte: 0, zeile: 1, breite: 2 },
        { id: 'anbieter', form: 'ergebnis', text: 'Anbieter', spalte: 2, zeile: 1 },
        { id: 'betreiber', form: 'ergebnis', text: 'Betreiber', spalte: 0, zeile: 2, breite: 2 },
      ],
      kanten: [
        { von: 'start', vonSeite: 'bottom', nach: 'frage', nachSeite: 'top', weg: 'gerade' },
        { von: 'frage', vonSeite: 'right', nach: 'anbieter', nachSeite: 'left', text: 'Ja', weg: 'gerade' },
        { von: 'frage', vonSeite: 'bottom', nach: 'betreiber', nachSeite: 'top', text: 'Nein', weg: 'gerade' },
      ],
      alt: { titel: 'Entscheidungsbaum Rolle', beschreibung: 'Eigener Name? Ja: Anbieter. Nein: Betreiber.' },
    },
  ];
}

/** DOCX mit Logo und allen Grafik-Blöcken */
export function musterDocxGrafik(): DocxDokument {
  const d = musterDocx();
  return { ...d, bloecke: [...d.bloecke.slice(0, 6), ...musterGrafikBloecke()] };
}

/** XLSX: Risiken mit W/A vor und nach, Ampel auf beiden Werten, Datenbalken, Textfarben und Matrix-Blatt mit COUNTIFS */
export function musterXlsxGrafik(ergebnis?: (i: number, j: number) => number): XlsxMappe {
  const basis = musterXlsx();
  const risiken: [string, string, number, number, number, number, number, string][] = [
    ['R-001', 'Risiko', 3, 4, 2, 2, 0.6, 'offen'],
    ['R-002', 'Risiko', 4, 4, 2, 3, 0.2, 'offen'],
    ['R-003', 'Risiko', 1, 2, 1, 1, 1, 'offen'],
    ['R-004', 'Chance', 4, 4, 4, 4, 0, 'offen'],
    ['R-005', 'Risiko', 4, 4, 1, 1, 1, 'geschlossen'],
    ['R-006', 'Risiko', 3, 4, 1, 2, 0.5, 'offen'],
  ];
  const zaehlbar = risiken.filter((r) => r[1] !== 'Chance' && r[7] !== 'geschlossen');
  const zeilenA = [4, 3, 2, 1];
  const spaltenW = [1, 2, 3, 4];
  const zaehle = (iw: number, ia: number) => (a: number, w: number) => zaehlbar.filter((r) => r[iw] === w && r[ia] === a).length;
  const matrix = (titel: string, wSpalte: number, aSpalte: number, z: (a: number, w: number) => number) => ({
    titel,
    quelle: { blatt: 'Register', zeilenSpalte: aSpalte, spaltenSpalte: wSpalte, bedingungen: [{ spalte: 1, kriterium: '<>Chance' }, { spalte: 9, kriterium: '<>geschlossen' }] },
    ecke: 'A \\ W',
    zeilen: zeilenA.map((a) => ({ wert: a, text: `A ${a}` })),
    spalten: spaltenW.map((w) => ({ wert: w, text: `W ${w}` })),
    ergebnisse: zeilenA.map((a, i) => spaltenW.map((w, j) => (ergebnis ? ergebnis(i, j) : z(a, w)))),
    zonen: { tiefBis: 4, hochAb: 12, kuerzel: ['T', 'M', 'H'] as [string, string, string] },
  });
  return {
    ...basis,
    blaetter: [
      {
        name: 'Register',
        titel: 'Risikoregister',
        spalten: [
          { kopf: 'ID', breite: 8 },
          { kopf: 'Art', breite: 10, typ: 'liste', liste: ['Risiko', 'Chance'] },
          { kopf: 'W', breite: 5, typ: 'zahl' },
          { kopf: 'A', breite: 5, typ: 'zahl' },
          { kopf: 'Wert', breite: 7, typ: 'formel', formel: '=IF(AND(C{r}<>"",D{r}<>""),C{r}*D{r},"")' },
          { kopf: 'W nach', breite: 7, typ: 'zahl' },
          { kopf: 'A nach', breite: 7, typ: 'zahl' },
          { kopf: 'Wert nach', breite: 8, typ: 'formel', formel: '=IF(AND(F{r}<>"",G{r}<>""),F{r}*G{r},"")' },
          { kopf: 'Umsetzung', breite: 10, typ: 'zahl' },
          { kopf: 'Status', breite: 12, typ: 'liste', liste: ['offen', 'geschlossen'] },
        ],
        zeilen: risiken.map(([id, art, w, a, wn, an, u, st]) => [id, art, w, a, w * a, wn, an, wn * an, u, st]),
        leereZeilen: 5,
        ampel: [
          { spalte: 4, gruenBis: 4, gelbBis: 11, palette: 'risiko' },
          { spalte: 7, gruenBis: 4, gelbBis: 11, palette: 'risiko' },
        ],
        formate: [
          { art: 'datenbalken', spalte: 8, min: 0, max: 1 },
          { art: 'text', spalte: 9, regeln: [{ text: 'offen', rolle: 'status-kritisch' }, { text: 'geschlossen', rolle: 'status-gut' }] },
          { art: 'stufen', spalte: 2, regeln: [{ bis: 1, rolle: 'status-gut' }, { bis: 2, rolle: 'status-warnung' }], sonst: 'status-kritisch' },
          { art: 'farbskala', spalte: 3, min: 0, max: 4 },
        ],
      },
      {
        name: 'Risikomatrix',
        titel: 'Risikomatrix',
        hinweise: ['Zahl = Anzahl Risiken im Register; Farbe = Stufe aus W×A.'],
        spalten: [],
        zeilen: [],
        matrizen: [matrix('Risikomatrix vor Behandlung', 2, 3, zaehle(2, 3)), matrix('Risikomatrix nach Behandlung', 5, 6, zaehle(5, 6))],
      },
    ],
  };
}
