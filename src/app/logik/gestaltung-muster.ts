// Musterdokument der Dokumentgestaltung (Vorschau, «Muster als Word/Excel»): fester Inhalt mit Kopf, Titel,
// Lenkungstabelle, Tabelle, Liste, Hinweis, Risikomatrix und Diagramm. Die Gestaltung setzt dieselbe Funktion wie bei den
// Firmendokumenten ein (vorlagen/gestaltung.ts), damit Vorschau, DOCX und XLSX dieselben Werte haben. Rein, ohne DOM.
import type { DocxDokument, Lenkungsangaben, XlsxMappe } from '../../generator/ir.ts';
import type { Projekt, Sprache } from '../../model/typen.ts';
import { gestaltungEinsetzen } from '../../vorlagen/gestaltung.ts';

export interface MusterTexte {
  titel: string;
  absatz: string;
  h_grundsaetze: string;
  h_risiken: string;
  tabelle_kopf: string[];
  zeilen: string[][];
  liste: string[];
  hinweis: string;
  matrix_titel: string;
  matrix_ecke: string;
  matrix_alt: string;
  tief: string;
  mittel: string;
  hoch: string;
  diagramm_titel: string;
  diagramm_kat: string[];
  reihe_ist: string;
  reihe_plan: string;
  reihe_ueberfaellig: string;
  diagramm_alt: string;
  blatt: string;
  spalten: string[];
  klassifikation: string;
  version: string;
  eigner: string;
  /** Beschriftungen der Lenkung und Fusszeile aus den Generatortexten */
  fusszeile: string;
  status: string;
}

function lenkung(t: MusterTexte): Lenkungsangaben {
  return {
    dokumentId: 'D-03',
    titel: t.titel,
    // Entwurf: Version unter 1.0, passend zum Status im Kopf
    version: '0.1',
    eigner: t.eigner,
    // Muster als Entwurf: zeigt das Wasserzeichen, wenn es eingeschaltet ist
    freigabeDurch: t.status,
    datum: '',
    klassifikation: t.klassifikation,
    normbezug: 'ISO/IEC 42001: 5.2',
    ismsBezug: '',
    pfad: '',
  };
}

export function musterDocx(p: Projekt, sprache: Sprache, t: MusterTexte): DocxDokument {
  const firma = p.organisation.name;
  const dok: DocxDokument = {
    sprache,
    kopf: { firmenname: firma, fusszeile: t.fusszeile },
    lenkung: lenkung(t),
    eigenschaften: { titel: t.titel, autor: firma },
    bloecke: [
      { typ: 'absatz', text: t.absatz },
      { typ: 'ueberschrift', ebene: 1, text: t.h_grundsaetze },
      { typ: 'tabelle', kopf: t.tabelle_kopf, zeilen: t.zeilen, breiten: [3, 2, 1.2] },
      { typ: 'liste', punkte: t.liste },
      { typ: 'hinweis', art: 'normverweis', text: t.hinweis },
      { typ: 'ueberschrift', ebene: 1, text: t.h_risiken },
      {
        typ: 'matrix',
        titel: t.matrix_titel,
        ecke: t.matrix_ecke,
        spalten: ['1', '2', '3', '4'],
        // Gleiche Skala wie die Risikomatrix der App (4 mal 4)
        zeilen: [4, 3, 2, 1].map((w) => ({
          kopf: String(w),
          zellen: [1, 2, 3, 4].map((a) => {
            const wert = w * a;
            const [text, rolle] = wert >= 9 ? [t.hoch, 'risiko-hoch'] as const : wert >= 4 ? [t.mittel, 'risiko-mittel'] as const : [t.tief, 'risiko-tief'] as const;
            return { zeilen: [`${text[0]?.toUpperCase()} ${wert}`], rolle };
          }),
        })),
        legende: [
          { rolle: 'risiko-tief', text: t.tief },
          { rolle: 'risiko-mittel', text: t.mittel },
          { rolle: 'risiko-hoch', text: t.hoch },
        ],
        alt: t.matrix_alt,
      },
      {
        typ: 'diagramm',
        art: 'balken',
        titel: t.diagramm_titel,
        kategorien: t.diagramm_kat,
        reihen: [
          { name: t.reihe_ist, werte: [2, 4, 6, 8], rolle: 'kat-1' },
          { name: t.reihe_plan, werte: [3, 5, 7, 9], rolle: 'kat-2' },
          { name: t.reihe_ueberfaellig, werte: [1, 0, 1, 0], rolle: 'status-kritisch' },
        ],
        alt: { titel: t.diagramm_titel, beschreibung: t.diagramm_alt },
      },
    ],
  };
  return gestaltungEinsetzen(dok, p, 'firma');
}

export function musterXlsx(p: Projekt, sprache: Sprache, t: MusterTexte): XlsxMappe {
  const firma = p.organisation.name;
  const mappe: XlsxMappe = {
    sprache,
    eigenschaften: { titel: t.titel, autor: firma },
    lenkung: lenkung(t),
    firmenname: firma,
    hinweisBlock: [],
    blaetter: [
      {
        name: t.blatt,
        titel: t.titel,
        spalten: [
          { kopf: t.spalten[0] ?? 'ID', breite: 10 },
          { kopf: t.spalten[1] ?? '', breite: 40, umbruch: true },
          { kopf: t.spalten[2] ?? '', breite: 16 },
          { kopf: t.spalten[3] ?? '', breite: 10, typ: 'zahl' },
        ],
        zeilen: t.zeilen.map((z, i) => [`R-00${i + 1}`, z[0] ?? '', z[2] ?? '', [12, 6, 2][i] ?? 0]),
        ampel: { spalte: 3, gruenBis: 4, gelbBis: 9, palette: 'risiko' },
        formate: [{ art: 'datenbalken', spalte: 3, min: 0, max: 16 }],
        fixiert: true,
      },
    ],
  };
  return gestaltungEinsetzen(mappe, p, 'firma');
}
