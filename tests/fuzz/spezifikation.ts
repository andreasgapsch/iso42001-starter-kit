// Spezifikation je Eingabeart (AF-021): Merkmale, Grösse, Tiefe, Anzahl, Zeit als Datenstruktur. Fuzz und Klassentests lesen
// sie; Zahlen, die der Code selbst festlegt, kommen aus dessen Konstanten, damit die Spezifikation nicht davonläuft.
// Seit P8 kommen Grössen und Tiefen aus der Konfiguration des Eingangsmoduls (src/eingang/grenzen.ts, AF-018 bis AF-020).
// «sollGrenze» nennt Werte, die der Code noch nicht erzwingt: Dort gilt der Wert als Vorgabe.
import { JSON_MAX_TIEFE, MAX_BYTES } from '../../src/app/import/laden.ts';
import { XML_MAX_TIEFE } from '../../src/prozesse/xml.ts';
import { GRENZEN } from '../../src/eingang/grenzen.ts';
import { MAX_DATEI, MAX_SEITEN, MAX_SUMME, MAX_ZELLEN } from '../../src/prozesse/drawio.ts';
import { SICHERUNG_MAX_BYTES, SICHERUNG_MAX_DATEIEN } from '../../src/bibliothek/sicherung.ts';
import { REGISTER_MAX_EINTRAEGE, REGISTER_MAX_TEXT, REGISTER_MAX_VERSIONEN } from '../../src/bibliothek/register-datei.ts';
import { MAX_SVG_EBENEN, MAX_SVG_ELEMENTE, MAX_SVG_KNOTEN } from '../../src/generator/svg.ts';
import { GESTALTUNG_GRENZEN } from '../../src/model/gestaltung.ts';
import { EINGABEARTEN, type Eingabeart } from './typen.ts';

export interface Spezifikation {
  art: Eingabeart;
  bezeichnung: string;
  /** Erwartete Merkmale der Eingabe (Aufbau, Kennungen, Kodierung) */
  merkmale: string[];
  endungen: string[];
  /** Höchstgrösse der Eingabe in Bytes (bei Text: Zeichen) */
  maxBytes: number;
  /** Höchstgrösse nach dem Entpacken, wo es ein Container ist */
  maxEntpackt?: number;
  /** Höchste Verschachtelungstiefe der Daten, wo die Art sie begrenzt */
  maxTiefe?: number;
  /** Höchste Zahl von Einträgen, Elementen oder Seiten, je Schlüssel */
  maxAnzahl: Record<string, number>;
  /** Zeit bis Ergebnis oder Meldung je Fall in Millisekunden (K-SEC-03: höchstens 5 s) */
  maxZeitMs: number;
  /** Stelle im Code, an der die Art gelesen wird */
  leseort: string[];
  /** Werte, die der Code noch nicht selbst erzwingt: Verweis auf das Paket, das es nachholt */
  sollGrenze?: { merkmal: string; paket: string };
}

const ZEIT_MS = 5000;

export const SPEZIFIKATION: Record<Eingabeart, Spezifikation> = {
  projektdatei: {
    art: 'projektdatei',
    bezeichnung: 'Projektdatei (*.aims.json) mit Reparatur, Teilimport und Rundreise Speichern/Laden',
    merkmale: ['JSON-Objekt mit meta und schemaVersion', 'UTF-8, BOM erlaubt', 'Schema projekt.schema.json', 'Kennungen je Liste eindeutig', 'Datumsfelder ISO 8601', 'Texte je Feld begrenzt'],
    endungen: ['json'],
    maxBytes: MAX_BYTES,
    maxTiefe: JSON_MAX_TIEFE,
    maxAnzahl: { eintraegeJeListe: 20_000, werte: GRENZEN.projektdatei.maxWerte },
    maxZeitMs: ZEIT_MS,
    leseort: ['src/app/import/laden.ts (ladeProjektText, projektReparieren)', 'src/app/import/teilimport.ts'],
  },
  'ki-ergebnis': {
    art: 'ki-ergebnis',
    bezeichnung: 'KI-Ergebnis (Antworttext mit Projekt-JSON, auch im Codeblock)',
    merkmale: ['Text mit einem JSON-Objekt', 'meta oder schemaVersion vorhanden', 'keine Gestaltung (Logo, Farben) aus der Antwort', 'fehlende Listen werden ergänzt'],
    endungen: ['json', 'md', 'txt'],
    maxBytes: GRENZEN['ki-ergebnis'].maxBytes,
    maxTiefe: JSON_MAX_TIEFE,
    maxAnzahl: { kandidaten: 64 },
    maxZeitMs: ZEIT_MS,
    leseort: ['src/app/import/ki-ergebnis.ts (ladeKiErgebnis)'],
  },
  sicherung: {
    art: 'sicherung',
    bezeichnung: 'Bibliothekssicherung (ZIP mit bibliothek.json und Dateien)',
    merkmale: ['ZIP mit bibliothek.json im Wurzelverzeichnis', 'Pfade relativ, ohne .. und ohne __proto__', 'Register mit format aims-bibliothek, version 1', 'Einträge je Kennung eindeutig'],
    endungen: ['zip'],
    maxBytes: SICHERUNG_MAX_BYTES,
    maxEntpackt: SICHERUNG_MAX_BYTES,
    maxAnzahl: { dateien: SICHERUNG_MAX_DATEIEN, registerEintraege: REGISTER_MAX_EINTRAEGE, versionenJeEintrag: REGISTER_MAX_VERSIONEN, registerZeichen: REGISTER_MAX_TEXT },
    maxZeitMs: ZEIT_MS,
    leseort: ['src/bibliothek/sicherung.ts (sicherungEntpacken)', 'src/bibliothek/register-datei.ts (registerParsen)', 'src/app/import/register-pruefen.ts'],
  },
  gestaltungspaket: {
    art: 'gestaltungspaket',
    bezeichnung: 'Gestaltungspaket (JSON mit Logo, Farben, Schrift, Kopfzeile)',
    merkmale: ['JSON-Objekt art aims-gestaltung, version 1', 'Farben als 6 Hexziffern', 'Logo als PNG-Data-URL oder bereinigtes SVG', 'Schema Gestaltung der Projektdatei'],
    endungen: ['json'],
    maxBytes: GRENZEN.gestaltungspaket.maxBytes,
    maxTiefe: GRENZEN.gestaltungspaket.maxTiefe,
    maxAnzahl: { pngBytes: GESTALTUNG_GRENZEN.pngBytes, svgZeichen: GESTALTUNG_GRENZEN.svgZeichen, werte: GRENZEN.gestaltungspaket.maxWerte },
    maxZeitMs: ZEIT_MS,
    leseort: ['src/eingang/lesen.ts (liesTextBegrenzt, jsonLesen)', 'src/model/gestaltung.ts (paketLesen, logoBereinigen)', 'src/app/ansichten/einstellungen/Gestaltung.tsx'],
  },
  'svg-logo': {
    art: 'svg-logo',
    bezeichnung: 'SVG-Logo (Hochladen, Bereinigung mit Positivliste)',
    merkmale: ['Wurzel svg', 'nur Elemente und Attribute der Positivliste', 'Verweise nur auf Kennungen im Dokument (#)', 'kein Skript, keine Ereignisattribute, keine externen Adressen', 'keine DTD'],
    endungen: ['svg'],
    maxBytes: GRENZEN['svg-logo'].maxBytes,
    maxTiefe: MAX_SVG_EBENEN,
    maxAnzahl: { elemente: MAX_SVG_ELEMENTE, knoten: MAX_SVG_KNOTEN },
    maxZeitMs: ZEIT_MS,
    leseort: ['src/generator/svg.ts (svgBereinigen)', 'src/app/logik/logo.ts'],
  },
  'word-vorlage': {
    art: 'word-vorlage',
    bezeichnung: 'Word-Vorlage (DOCX/DOTX als Quelle für Farben, Schrift und Logo)',
    merkmale: ['ZIP mit word/document.xml', 'Design in word/theme/theme1.xml', 'Kopfzeilenbild über Beziehungsdatei', 'XML-Teile je höchstens 2 MB'],
    endungen: ['docx', 'dotx'],
    // Gelesen über das Logo-Feld (Art «bild», gleiche Grenze); die XML-Teile werden linear durchsucht, nicht als Baum
    maxBytes: GRENZEN['word-vorlage'].maxBytes,
    maxEntpackt: GRENZEN['word-vorlage'].maxEntpackt,
    maxAnzahl: { eintraege: GRENZEN['word-vorlage'].maxEintraege, xmlTeilBytes: 2 * 1024 * 1024, teilBytes: GRENZEN['word-vorlage'].maxTeil },
    maxZeitMs: ZEIT_MS,
    leseort: ['src/app/logik/logo.ts (dateiLesen über liesBegrenzt)', 'src/generator/vorlage-import.ts (ausWordVorlage)'],
  },
  drawio: {
    art: 'drawio',
    bezeichnung: 'draw.io-Datei in der App (Import eines Ablaufs, Vorprüfung, Rundreise)',
    merkmale: ['XML mit mxfile, diagram oder mxGraphModel; auch .drawio.svg mit content', 'Seiten unkomprimiert oder deflate und Base64', 'keine DTD, keine Entitäten ausser den fünf Standardentitäten', 'Zellen mit eindeutiger Kennung, Elternkette ohne Zyklus'],
    endungen: ['drawio', 'xml', 'svg'],
    maxBytes: MAX_DATEI,
    maxEntpackt: MAX_SUMME,
    maxTiefe: XML_MAX_TIEFE,
    maxAnzahl: { seiten: MAX_SEITEN, zellen: MAX_ZELLEN },
    maxZeitMs: ZEIT_MS,
    leseort: ['src/prozesse/drawio.ts (drawioSeitenLesen, drawioImportieren)', 'src/diagrammansicht/Diagrammansicht.html.tpl (Browser, AF-026)'],
  },
  normpaket: {
    art: 'normpaket',
    bezeichnung: 'Normpaket (JSON der eigenen lizenzierten Normtexte)',
    merkmale: ['JSON-Objekt format aims-normpaket, version 1', 'teile mit norm 42001 oder 27001 und sprache de oder en', 'Kennungen im Muster K-n, A.n, 27001-', 'Texte werden gekürzt'],
    endungen: ['json'],
    maxBytes: GRENZEN.normpaket.maxBytes,
    maxTiefe: GRENZEN.normpaket.maxTiefe,
    maxAnzahl: { teile: 4, eintraegeJeTeil: 500, werte: GRENZEN.normpaket.maxWerte },
    maxZeitMs: ZEIT_MS,
    leseort: ['src/eingang/lesen.ts (liesJsonBegrenzt)', 'src/app/normtexte/zustand.ts (pruefeNormpaket)', 'src/app/ansichten/einstellungen/Normtexte.tsx'],
  },
  'norm-pdf': {
    art: 'norm-pdf',
    bezeichnung: 'Norm-PDF (eigene Norm, Textauszug mit pdf.js im Worker)',
    merkmale: ['gültiges PDF, auch mit Passwort', 'Textebene vorhanden', 'Aufbau einer ISO-Norm (Kapitel 4 bis 10, Anhang A)', 'höchstens wenige hundert Seiten'],
    endungen: ['pdf'],
    maxBytes: GRENZEN['norm-pdf'].maxBytes,
    maxAnzahl: { seiten: GRENZEN['norm-pdf'].maxSeiten },
    maxZeitMs: ZEIT_MS,
    leseort: ['src/eingang/lesen.ts (liesBegrenzt)', 'src/app/normtexte/pdf.ts (Herzschlag)', 'src/normtexte/pdf-worker.ts', 'src/normtexte/pdf-text.ts (seitenAusPdf)', 'src/normtexte/parser.ts (zerlege)'],
    // Die Dateigrösse prüft das Eingangsmodul vor dem Lesen, die Seitenzahl pdf-text.ts vor dem Zerlegen (maxSeiten, P10); die
    // Zeit begrenzt der Herzschlag im Worker (AF-019). Es gibt keine offene Grenze mehr.
  },
};

/** Arten ohne Spezifikation: muss leer sein (AF-021) */
export const artenOhneSpezifikation = (): Eingabeart[] => EINGABEARTEN.filter((a) => !SPEZIFIKATION[a]);
