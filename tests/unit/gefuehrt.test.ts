// Guide: Struktur (etappen.yaml, seiten/*.yaml, optionen.yaml) gegen Datenmodell und Texte (DE).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import {
  AUFGABENARTEN, ENTSCHEIDE, HANDLUNGSBEFUGNISSE, MB_TRAKTANDEN, PRUEFPUNKTE_LIEFERANT, PRUEFPUNKTE_LIEFERANT_RC2, PRUEFPUNKTE_LIEFERANT_RC3, VERTRAGSKLAUSELN, VERTRAGSKLAUSELN_RC2, VERTRAGSKLAUSELN_RC3, FUNKTIONEN, TARIFE, VERTRAUENSMERKMALE,
} from '../../src/model/typen.ts';
import { E05_PUNKTE } from '../../src/vorlagen/E-05.ts';
import type {
  Audit, Bewusstseinsthema, ControlEintrag, DokumentEintrag, Dokumentenlenkung, ExternesDokument, GapAnalyse, Gremium, Meldeweg, MeldekanalExtern, Meldung, Kennzahl, KennzahlMessung, Projektauftrag, Protokollvorgaben, Risikobereitschaft, EigenesControl, Feststellung, Folgenabschaetzung, InteressiertePartei, KiSystem,
  Kommunikation, Kompetenz, Lieferant, Managementbewertung, Massnahme, Nachweis, Person, Projekt, Risiko, Rolle, Ziel,
} from '../../src/model/typen.ts';

const REPO = join(import.meta.dirname, '..', '..');
const lies = <T>(rel: string): T => parse(readFileSync(join(REPO, rel), 'utf8')) as T;

// ---------- Strukturtypen ----------
type Wenn = Record<string, unknown>;
interface Feld {
  pfad?: string;
  typ: string;
  optionen?: string;
  vorschlaege?: string;
  pflicht?: boolean;
  wenn?: Wenn & { eintrag?: Record<string, unknown[]> };
  spalten?: Feld[];
  quelle?: string;
  setzt?: Record<string, Record<string, unknown>>;
  vorschlag?: { wert: unknown; wennEines: string[] };
  schluessel?: string;
}
interface Aufgabe { id: string; rhythmus: string; seite: string; norm: string; wenn?: Wenn; monatAus?: string; faelligAus?: string }
interface Seite {
  id: string;
  typ: string;
  norm: string;
  vorlage?: string;
  leitfaden?: number;
  aiact?: string[];
  wenn?: Wenn;
  beispiel?: string;
  felder?: Feld[];
  liste?: string;
  filter?: Record<string, unknown[]>;
  filterSystem?: Record<string, unknown[]>;
  vorgabe?: Record<string, unknown>;
  startwerte?: Record<string, unknown>[];
  anlegen?: boolean;
  eintrag?: string;
  rahmenwerk?: string;
  controls?: string[];
  fragebogen?: boolean;
  aufgaben?: Aufgabe[];
  filterEines?: Record<string, unknown[]>;
  katalog?: string;
  nistStand?: boolean;
}
type CheckEintrag = string | { id: string; wenn?: Wenn };
interface Etappe {
  id: string;
  norm: string;
  vorlagen: string[];
  leitfaden: number;
  dauer_h: { mit_isms: number; ohne_isms: number };
  beteiligte: string[];
  wenn?: Wenn;
  seiten: string[];
  checkliste: CheckEintrag[];
}

const etappen = lies<{ etappen: Etappe[] }>('src/gefuehrt/etappen.yaml').etappen;
const seitenJeEtappe = new Map<string, Seite[]>();
for (const datei of readdirSync(join(REPO, 'src/gefuehrt/seiten')).filter((d) => d.endsWith('.yaml'))) {
  seitenJeEtappe.set(datei.replace(/\.yaml$/, ''), lies<{ seiten: Seite[] }>(`src/gefuehrt/seiten/${datei}`).seiten);
}
const alleSeiten = [...seitenJeEtappe.values()].flat();
const seitenIds = new Set(alleSeiten.map((s) => s.id));
const optionen = lies<{ optionen: Record<string, (string | number)[]> }>('src/gefuehrt/optionen.yaml').optionen;

// ---------- Texte ----------
interface SeitenText { titel?: string; frage?: string; warum?: string; fehler?: string; felder?: Record<string, { label?: string; hilfe?: string }> }
interface GefuehrtText {
  etappen: Record<string, { titel?: string; ziel?: string; warum?: string; ergebnis?: string }>;
  beteiligte: Record<string, string>;
  checklisten: Record<string, string>;
  kalender: Record<string, string>;
  optionen: Record<string, Record<string, string>>;
  ui: Record<string, unknown>;
}
const texte = lies<GefuehrtText>('src/i18n/de/gefuehrt.yaml');
const ETAPPEN_IDS = ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'J'];
// Texte über den Sprachlader: gefuehrt.yaml und Ordner gefuehrt/ werden zusammengeführt (gefuehrt.<etappe>.<seiten-id>)
const gefuehrtGeladen = ladeTexte('de').gefuehrt as unknown as Record<string, unknown>;
const seitenTexteJeEtappe = new Map<string, Record<string, SeitenText>>(
  ETAPPEN_IDS.map((e) => [e, (gefuehrtGeladen[e] ?? {}) as Record<string, SeitenText>]),
);
const glossarKatalog = lies<{ begriffe: { id: string; norm?: string; aiact?: string[] }[] }>('src/kataloge/glossar.yaml').begriffe;
const glossarTexte = lies<Record<string, { begriff?: string; erklaerung?: string; en?: string }>>('src/i18n/de/glossar.yaml');
const dokumentIds = new Set(lies<{ dokumente: { id: string }[] }>('src/kataloge/dokumente.yaml').dokumente.map((d) => d.id));
// Ergänzungsblätter (D-xx-EB) als Einträge im Dokumentenregister, z. B. D-07-EB im Pfad mit ISMS
const ebIds = new Set(lies<{ blaetter: { id: string }[] }>('src/kataloge/ergaenzungsblaetter.yaml').blaetter.map((b) => b.id));

// ---------- Datenmodell: leeres Projekt, ergänzt um optionale Felder und je einen Beispiel-Eintrag pro Liste ----------
// Die Beispiel-Einträge sind gegen typen.ts typgeprüft (Required<> erzwingt auch optionale Felder der obersten Ebene).
const freigabe = { von: 'P-001', am: '2026-10-01' };

const person: Required<Person> = { id: 'P-001', name: 'Anna Muster', funktion: 'CIO', aimsRollen: ['aims'] };
const partei: Required<InteressiertePartei> = {
  id: 'IP-001', name: 'Kunden', art: 'extern',
  anforderungen: [{ text: 'Nachweis KI-Einsatz', quelle: 'vertrag', adressiert: 'ja', begruendung: 'Kundenvertrag' }],
};
const rolle: Required<Rolle> = { id: 'RO-001', bereich: 'konformitaet', verantwortlich: 'P-001', rechenschaft: 'P-001', stellvertretung: 'P-001', konsultiert: [], informiert: [] };
const kiSystem: Required<KiSystem> = {
  id: 'KI-001', name: 'Qualitätsprüfung', typ: 'eingekauft', beschreibung: '', zweck: '', fachbereich: 'produktion', eigner: 'P-001', lieferant: 'L-001',
  personendaten: false, besondereDaten: false, betroffene: '', automatisierung: 'unterstuetzend', lebenszyklus: 'betrieb', status: 'freigegeben',
  ressourcen: { daten: '', werkzeuge: '', rechenressourcen: '', personal: '' }, sensibleNutzung: false,
  aiAct: {
    rollen: ['betreiber'], risikoklasse: 'minimal', anhangIiiBereich: '4a', ausnahmeArt63: false, transparenz: [], gpai: false, begruendung: '', juristischGeprueft: false,
    anwendungsbereich: ['b'], art5: { ergebnis: 'keine', begruendung: '' }, profiling: 'nein', registrierung: 'nicht-noetig',
    rollenwechsel: 'nein', geprueft: { von: 'P-001', am: '2026-10-01' }, eingestuft: { von: 'P-001', am: '2026-10-01' }, kennzeichnung: '',
    produkt: { anhangI: 'nein', sicherheitsbauteil: 'nein', nurNichtSicherheitsrelevant: 'ja', ausfallGefaehrdet: 'nein', drittpruefung: 'nein', begruendung: '' },
  },
  naechsteUeberpruefung: '2027-06-30', erfasstAm: '2026-10-01', geaendertAm: '2026-10-01', freigabe: { von: 'P-001', am: '2026-10-01' }, protokollierung: '', nutzerinformation: '',
  // ab Schemaversion 3 (AF-104)
  antragAm: '2026-09-20', entscheidAm: '2026-10-01',
  auflagen: '', datenklasse: 'intern', freigabeBegruendung: '', ismsAsset: '',
  eigenesTraining: false, datenqualitaet: '', aufsicht: '', aenderungsregel: '',
  // ab rc.2
  handlungsbefugnis: 'empfiehlt', zugriffe: '', gedaechtnis: false, stoppmoeglichkeit: '', aufgabenart: 'klassifiziert', generativ: false,
  modell: { anbieter: '', name: '', version: '' }, kritisch: false, rueckfallweg: '', abhaengigkeiten: '', fremdeInhalte: false, oeffentlich: false,
  missbrauchsfaelle: '', aufbewahrenBis: '2036-12-31', einsatzentscheid: { nutzen: '', alternativeOhneKi: '', wiedervorlage: '2027-10-01' },
  ausserbetrieb: { ausloeser: '', schritteErledigt: false, am: '2027-12-31' },
  // Modul NIST AI RMF
  messkonzept: {
    merkmale: ['gueltig'], zielkonflikte: '',
    pruefungen: [{ merkmal: 'gueltig', prueffaelle: '', messgroesse: '', schwelle: '', haeufigkeit: '', nichtMessbar: '', ergebnis: '' }],
    unabhaengig: { wer: 'P-001', wann: '2027-03-01', ergebnis: '' },
  },
  genaiBewertung: { 'gai-konfabulation': { relevant: 'ja', begruendung: '', massnahme: '' } },
  // ab rc.3: Dienst und Tarif
  tarif: 'business',
  funktionen: { websuche: 'an', codeausfuehrung: 'aus', dateiupload: 'an', gedaechtnis: 'aus', konnektoren: 'aus', agenten: 'aus', teilen: 'aus' },
  abkuendigung: '2028-06-30',
  quelleAngaben: { fundstelle: '', abgerufen: '2026-10-01' },
};
const risiko: Required<Risiko> = {
  id: 'R-001', art: 'risiko', titel: '', beschreibung: '', kiSystem: 'KI-001', quelle: 'daten', ebenen: ['organisation'], ursache: '', folge: '',
  bestehendeMassnahmen: '', w: 2, a: 3, wNach: 1, aNach: 3, behandlung: 'vermindern', controls: [], massnahmen: [], eigner: 'P-001',
  restrisikoAkzeptiert: freigabe, beurteiltAm: '2026-10-01', erfasstAm: '2026-09-30', ismsRisiko: 'ISR-01', status: 'offen',
  restrisikoBegruendung: '', ausnahme: { von: 'P-001', am: '2026-10-01', bis: '2027-03-31', begruendung: '' }, vorschlag: 'GS-01',
};
const nutzenSchaden = { nutzen: '', schaden: '', ausmass: 1 };
const folgenabschaetzung: Required<Folgenabschaetzung> = {
  id: 'IA-001', kiSystem: 'KI-001',
  triage: { rechtspositionOderChancen: false, gesundheitOderSicherheit: false, verletzlicheGruppen: false, besondereDaten: false, automatisierteEntscheidung: false, grosseReichweite: false, ergebnis: 'kurz', begruendung: '', durch: 'P-001', am: '2026-10-01' },
  systembeschreibung: '', verwendungen: '', fehlanwendungen: '', daten: '', einsatzumfeld: '',
  betroffene: [{ gruppe: '', art: 'direkt', wirkung: '', konsultiert: false }],
  nutzenSchaden: {
    rechenschaft: nutzenSchaden, transparenz: nutzenSchaden, fairness: nutzenSchaden, datenschutz: nutzenSchaden,
    zuverlaessigkeit: nutzenSchaden, sicherheit: nutzenSchaden, erklaerbarkeit: nutzenSchaden, umwelt: nutzenSchaden,
  },
  gesellschaft: '', ausfaelle: '', massnahmen: '', sensibleNutzung: false, eingeschraenkteNutzung: false, ergebnis: '', verknuepfteDsfa: '', freigabe, naechsteUeberpruefung: '2027-10-01',
  fria: { erforderlich: 'nein', begruendung: '', ref: '', durch: 'P-001', am: '2026-10-01', behoerde: '', mitgeteiltAm: '2026-10-01', zeitraumHaeufigkeit: '', aufsicht: '' },
  neubeurteilungen: [{ am: '2026-12-01', durch: 'P-001', anlass: '', ergebnis: '', freigabe }],
  mitgewirkt: ['P-001'],
};
const control: Required<ControlEintrag> = {
  id: 'A.5.2', rahmenwerk: 'ISO42001', anwendbar: 'ja', begruendung: '', status: 'umgesetzt', verantwortlich: 'P-001', nachweise: [], umsetzung: '', iso27001: [], kiSysteme: [], vorschlag: 'risiko',
  wirksamkeit: { wie: '', wann: '2026-12-01', wer: 'P-001', ergebnis: '' },
};
const eigenesControl: Required<EigenesControl> = { id: 'EC-01', titel: '', beschreibung: '', quelle: '' };
const nachweis: Required<Nachweis> = { id: 'N-001', titel: '', art: 'dokument', ablageort: '', datum: '2026-10-01' };
const dokument: Required<DokumentEintrag> = {
  id: 'D-07', version: '1.0', status: 'freigegeben', eigner: 'P-001', freigabe, naechsteUeberpruefung: '2027-10-01', ablageort: '', giltFuerIsms: false, klassifikation: 'intern', aufbewahrung: '', aufgenommenIn: '',
  geprueft: freigabe, bestaetigt: freigabe, aenderungen: [{ version: '1.0', datum: '2026-10-01', was: '', von: 'P-001' }],
};
const massnahme: Required<Massnahme> = {
  id: 'M-001', titel: '', beschreibung: '', verantwortlich: 'P-001', termin: '2026-12-31', status: 'offen', prioritaet: 'hoch', herkunft: { art: 'risiko', ref: 'R-001' }, nachweise: ['N-001'], start: '2026-10-01', erledigtAm: '2026-12-31', erfasstAm: '2026-09-30',
};
const lieferant: Required<Lieferant> = { id: 'L-001', name: '', leistung: '', pruefstatus: 'offen', pruefpunkte: {}, bemerkung: '', naechstePruefung: '2027-10-01', vertragsklauseln: {}, verantwortung: '', geprueft: freigabe };
const ziel: Required<Ziel> = {
  id: 'Z-001', ziel: '', kennzahl: '', sollwert: '', messmethode: '', haeufigkeit: '', verantwortlich: 'P-001', ressourcen: '', termin: '2027-03-31', bewertung: '',
  messungen: [{ datum: '2027-01-31', wert: '', sollErreicht: 'ja', bemerkung: '' }],
  bezugLeitlinie: '', massnahmen: '', status: 'geplant', werMisst: 'P-001', auswertungWann: '', werWertetAus: 'P-001', empfaenger: '', kiSysteme: ['KI-001'],
};
const kompetenz: Required<Kompetenz> = { id: 'K-001', rolle: '', anforderung: '', personen: [], gruppe: '', massnahme: '', nachweis: '', wirksamkeit: '', status: 'offen' };
const kommunikation: Required<Kommunikation> = { id: 'KO-001', was: '', wann: '', wer: 'P-001', mitWem: '', wie: '', richtung: 'intern' };
const audit: Required<Audit> = {
  id: 'AU-001', art: 'intern', kombiniertMitIsms: false, geplant: '2027-02-01', durchgefuehrt: '2027-02-02', durchgefuehrtBis: '2027-02-03', zertifikatAm: '2027-03-01', umfang: '', kriterien: '', auditor: '', unabhaengigkeit: '', ergebnis: '',
  ziel: '', ort: '', methode: '', berichtAn: '', umfangControls: [], umfangProzesse: [], auditierte: '', agenda: '', bericht: '', checkliste: {},
  stichproben: [{ nr: 1, nachweis: '', ergebnis: 'konform' }],
};
const feststellung: Required<Feststellung> = {
  id: 'F-001', audit: 'AU-001', quelle: 'audit', einstufung: 'nk-leicht', beschreibung: '', normbezug: '', korrektur: '', ursache: '', massnahmen: [],
  wirksamkeit: { am: '2027-04-01', ergebnis: '' }, wirksamkeitGeplant: '2027-04-01', status: 'offen',
  datum: '2027-02-01', erfasstAm: '2027-02-01', kiSystem: 'KI-001', bereich: '', prozesse: [], ursacheMethode: '', aehnlicheFaelle: '', risikoAngepasst: false, nachweis: '', ursacheKategorie: '', meldepflicht: 'nein', schwere: 2,
  // ab Schemaversion 3 (AF-104)
  entdecktAm: '2027-02-01T09:40', eingedaemmtAm: '2027-02-01T15:10',
};
const managementbewertung: Required<Managementbewertung> = {
  id: 'MB-001', datum: '2027-03-01', kombiniertMitIsms: false, teilnehmende: '',
  eingaben: { statusMassnahmen: '', aenderungenThemen: '', aenderungenParteien: '', leistung: '', verbesserungen: '', weitere: '', messung: '', audits: '', prozesse: '' }, entscheide: '', massnahmen: [],
  prozesse: [{ id: 'PR-01', reife: 1 }],
  ergebnisse: { inventar: '', risiken: '', meldungen: '', lieferanten: '', ziele: '', ressourcen: '', aiact: '', leitlinie: '' },
  ort: '', leitung: 'P-001', zeitraum: { von: '2026-03-01', bis: '2027-02-28' },
  gesamtbeurteilung: { geeignet: { urteil: 'ja', begruendung: '' }, angemessen: { urteil: 'ja', begruendung: '' }, wirksam: { urteil: 'ja', begruendung: '' } },
  entscheideListe: [{ art: 'verbesserung', text: '', verantwortlich: 'P-001', termin: '2027-06-30', massnahme: 'M-001' }],
};

function modellProjekt(): Projekt {
  const p = leeresProjekt({ jetzt: '2026-10-19T08:00:00Z' });
  const o = p.organisation;
  o.zielterminZertifizierung = '2027-06-30';
  o.zielterminStage1 = '2027-03-31';
  o.aimsVerantwortlich = 'P-001';
  o.logoDataUrl = '';
  // offene Ja/Nein-Fragen (ohne Vorbelegung) als beantwortet
  o.euBezug = { kundenEu: false, outputEu: false, niederlassungEu: false };
  o.entwickeltKi = false;
  o.verkauftKiProdukte = false;
  o.kontext.themen = [{ id: 'TH-001', art: 'extern', kategorie: 'recht', beschreibung: '', auswirkung: '' }];
  o.rollenIso = [{ rolle: 'kunde', bemerkung: '' }];
  o.geltungsbereich.ausschluesse = [{ was: '', begruendung: '' }];
  o.geltungsbereich.freigabe = freigabe;
  o.leitlinie.freigabe = freigabe;
  o.leitlinie.kommuniziertAm = '2026-10-01';
  o.leitlinie.naechsteUeberpruefung = '2027-10-01';
  o.risikokriterien.wahrscheinlichkeit = [{ stufe: 1, bezeichnung: '', beschreibung: '' }];
  o.risikokriterien.auswirkung = [{ stufe: 1, bezeichnung: '', beschreibung: '' }];
  // Optionale Felder ab Konsolidierung (typgeprüft über Required<>)
  const meldeweg: Required<Meldeweg> = { kanaele: [], kanal: '', ausweichstelle: 'P-001', vertraulich: true, fristTage: 7, fristErgebnisTage: 30, eskalation: '', bekanntmachung: '' };
  const meldekanal: Required<MeldekanalExtern> = { adresse: '', ort: '', bearbeitung: 'P-001', fristTage: 5, fristAntwortTage: 30, vorfallVerfahren: '', fristKundenStunden: 72 };
  const gremium: Required<Gremium> = { name: '', themen: '', rhythmus: '', vorsitz: 'P-001' };
  const auftrag: Required<Projektauftrag> = {
    ziel: '', nutzen: '', aufwandPt: 30, budget: 20000, pensumProzent: 20, sponsor: 'P-001', meilensteine: [{ was: '', termin: '2027-01-31' }], risiken: '', freigabe, glTraktandum: 'monatlich', team: ['P-001'], geltungsbereich: '',
  };
  const extern: Required<ExternesDokument> = { dokument: 'ISO/IEC 42001', herausgeber: 'ISO/IEC', stand: '2023', ablage: '', zustaendig: 'P-001', naechstePruefung: '2027-10-01' };
  const lenkung: Required<Dokumentenlenkung> = { ismsRegelnGelten: true, ablage: '', namensregel: '', freigabe: 'eigner', aufbewahrungJahre: 10, klassifikation: 'intern', extern: '', externeDokumente: [extern] };
  const bewusstsein: Required<Bewusstseinsthema> = { thema: '', inhalt: '', zielgruppe: '', kanal: '', datum: '2026-11-01', nachweis: '' };
  const protokollierung: Required<Protokollvorgaben> = { inhalt: [], aufbewahrungMonate: 6, auswertung: 'halbjaehrlich' };
  Object.assign(o, { protokollierung, meldeweg, meldekanalExtern: meldekanal, meldestelle: '', gremien: [gremium], projektauftrag: auftrag, dokumentenlenkung: lenkung, bewusstsein: [bewusstsein], oeffentlicheDienste: false });
  // ab rc.2
  const risikobereitschaft: Required<Risikobereitschaft> = { nie: [''], nurGl: [''], aimsAllein: [''] };
  Object.assign(o, { risikobereitschaft, naechsthoehereStelle: 'Verwaltungsrat', entscheidungsrechte: [{ entscheid: 'einfuehren', wer: { tief: 'P-001', mittel: 'P-001', hoch: 'P-001' } }], nichtGemessen: [{ was: '', begruendung: '' }] });
  o.geltungsbereich.keineAusschluesseBestaetigt = false;
  o.leitlinie.abgleich = { informationssicherheit: 'angepasst', datenschutz: 'verweis', qualitaet: 'keine', personal: 'keine' };
  o.leitlinie.abgleichNotiz = '';
  const gap: Required<GapAnalyse> = {
    datum: '2026-10-01',
    kapitel: { k4: 'fehlt', k5: 'fehlt', k6: 'fehlt', inventar: 'fehlt', k7: 'fehlt', k8: 'fehlt', k9: 'fehlt', k10: 'fehlt' },
    abschnitte: { 'K-4.1': { ist: 1, soll: 3, beschreibung: '' } },
    controls: { 'A.2.2': { ist: 1, soll: 3, beschreibung: '' } },
  };
  p.gapAnalyse = gap;
  // Modul NIST AI RMF (optional, ab rc.2)
  p.meta.modulNistRmf = false;
  p.nistProfil = { 'GV-1.1': { ist: 1, ziel: 2, prioritaet: 'hoch', massnahmen: ['M-001'], notiz: '' } };
  o.leitlinie.ausnahmeHoechstMonate = 6;
  const meldung: Required<Meldung> = {
    id: 'ME-001', datum: '2026-11-02', art: 'rueckmeldung', herkunft: 'extern', kanal: '', kiSystem: 'KI-001', beschreibung: '', bearbeitung: 'P-001',
    bestaetigtAm: '2026-11-03', erledigtAm: '2026-11-20', ergebnis: '', status: 'erledigt',
  };
  p.meldungen = [meldung];
  const kennzahl: Required<Kennzahl> = { id: 'KZ-05', kennzahl: '', messmethode: '', haeufigkeit: 'quartalsweise', werMisst: 'P-001', auswertungWann: '', werWertetAus: 'P-001', empfaenger: '' };
  const kzMessung: Required<KennzahlMessung> = { kennzahl: 'KZ-05', datum: '2026-12-31', wert: '', sollErreicht: 'ja', zaehler: 1, nenner: 1, keineMessung: 'kein-anlass', bemerkung: '' };
  p.kennzahlen = [kennzahl];
  p.kennzahlMessungen = [kzMessung];
  return {
    ...p,
    personen: [person], parteien: [partei], rollen: [rolle], kiSysteme: [kiSystem], risiken: [risiko], folgenabschaetzungen: [folgenabschaetzung],
    controls: [control], eigeneControls: [eigenesControl], nachweise: [nachweis], dokumente: [dokument], massnahmen: [massnahme], lieferanten: [lieferant],
    ziele: [ziel], kompetenzen: [kompetenz], kommunikation: [kommunikation], audits: [audit], feststellungen: [feststellung], managementbewertungen: [managementbewertung],
  };
}

const PROJEKT = modellProjekt() as unknown as Record<string, unknown>;
/** Felder vom Typ Record<string, …> in typen.ts: beliebige Unterschlüssel sind zulässig. */
const OFFENE_MAPS_WURZEL = ['meta.gefuehrt.antworten', 'meta.checklisten', 'gapAnalyse.abschnitte', 'gapAnalyse.controls', 'organisation.leitlinie.abgleich'];
const OFFENE_MAPS_LISTE: Record<string, string[]> = { lieferanten: ['pruefpunkte', 'vertragsklauseln'] };
/** Record-Felder der KI-Systeme (Schlüssel aus Katalogen, z. B. genaiBewertung.gai-konfabulation) */
const OFFENE_MAPS_SYSTEM = ['genaiBewertung'];
const LISTEN = Object.keys(PROJEKT).filter((k) => Array.isArray(PROJEKT[k]));

const istObjekt = (w: unknown): w is Record<string, unknown> => typeof w === 'object' && w !== null && !Array.isArray(w);

/** Löst einen Punktpfad auf. Listen werden über ihren ersten Eintrag betreten; «liste[3]» und «liste[]» sind erlaubt. */
function loese(wurzel: unknown, pfad: string, offen: string[] = []): { ok: boolean; wert?: unknown } {
  if (offen.some((o) => pfad === o || pfad.startsWith(`${o}.`))) {
    const basis = offen.find((o) => pfad === o || pfad.startsWith(`${o}.`))!;
    const r = loese(wurzel, basis);
    return { ok: r.ok && istObjekt(r.wert), wert: pfad === basis ? r.wert : undefined };
  }
  let wert: unknown = wurzel;
  for (const roh of pfad.split('.')) {
    const m = /^([\w-]+)(\[\d*\])?$/.exec(roh);
    if (!m) return { ok: false };
    if (Array.isArray(wert)) wert = wert[0];
    if (!istObjekt(wert) || !(m[1]! in wert)) return { ok: false };
    wert = wert[m[1]!];
    if (m[2]) {
      if (!Array.isArray(wert) || wert.length === 0) return { ok: false };
      wert = wert[0];
    }
  }
  return { ok: true, wert };
}

/** Kontext (Wurzelobjekt und offene Maps) für die Feldpfade einer Seite. */
function kontext(s: Seite): { wurzel: unknown; offen: string[]; name: string } {
  switch (s.typ) {
    case 'liste':
      return { wurzel: PROJEKT[s.liste!], offen: OFFENE_MAPS_LISTE[s.liste!] ?? [], name: s.liste! };
    case 'auswahl-systeme':
      return { wurzel: PROJEKT.kiSysteme, offen: OFFENE_MAPS_SYSTEM, name: 'kiSysteme' };
    case 'folgenabschaetzung':
      return { wurzel: PROJEKT.folgenabschaetzungen, offen: [], name: 'folgenabschaetzungen' };
    case 'soa':
      return { wurzel: PROJEKT.controls, offen: [], name: 'controls' };
    default:
      return { wurzel: PROJEKT, offen: OFFENE_MAPS_WURZEL, name: 'projekt' };
  }
}

const flachePfade = (o: Record<string, unknown>, pre = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (istObjekt(v) ? flachePfade(v, `${pre}${k}.`) : [`${pre}${k}`]));

const SEITENTYPEN = ['info', 'formular', 'liste', 'auswahl-systeme', 'folgenabschaetzung', 'soa', 'pruefung', 'fahrplan', 'kalender', 'vorschlaege', 'nist-profil', 'gestaltung'];
const OHNE_FELDER = ['info', 'pruefung', 'fahrplan', 'kalender', 'vorschlaege', 'nist-profil', 'gestaltung'];
/** Kataloge mit Vorschlägen für das Risikoregister (Seitentyp vorschlaege) */
const VORSCHLAG_KATALOGE = ['genaiRisiken'];
// P14: Feldtyp «zeitpunkt» (Datum mit Uhrzeit, feststellungen.entdecktAm und eingedaemmtAm) ergänzt
const FELDTYPEN = ['text', 'textarea', 'zahl', 'datum', 'zeitpunkt', 'auswahl', 'mehrfach', 'janein', 'person', 'personen', 'liste-text', 'tabelle', 'freigabe', 'verweis', 'checkliste', 'pruefliste'];
const WENN_SCHLUESSEL = ['mitIsms', 'modul', 'modulNistRmf', 'generativ', 'entwickeltKi', 'verkauftKiProdukte', 'rolle', 'typ'];
const VERWEIS_QUELLEN = ['kiSysteme', 'lieferanten', 'massnahmen', 'nachweise', 'audits', 'controls', 'katalog-27001', 'katalog-dokumente', 'prozesse'];

/** Alle Felder einer Seite mit Textschlüssel (wie in i18n) und Spalten. */
function felderMitSchluessel(s: Seite): { feld: Feld; schluessel: string; spalteVon?: Feld }[] {
  const out: { feld: Feld; schluessel: string; spalteVon?: Feld }[] = [];
  for (const f of s.felder ?? []) {
    const schluessel = f.typ === 'checkliste' ? f.schluessel!.replace(/\.\{id\}$/, '') : f.pfad!;
    out.push({ feld: f, schluessel });
    for (const sp of f.spalten ?? []) out.push({ feld: sp, schluessel: `${f.pfad}.${sp.pfad}`, spalteVon: f });
  }
  return out;
}

function pruefeWenn(w: Wenn | undefined, ort: string, fehler: string[], eintragKontext?: { wurzel: unknown; offen: string[] }) {
  if (!w) return;
  for (const [k, v] of Object.entries(w)) {
    if (k === 'eintrag') {
      if (!eintragKontext) fehler.push(`${ort}: wenn.eintrag nur auf Eintragsseiten`);
      else for (const p of Object.keys(v as object)) if (!loese(eintragKontext.wurzel, p, eintragKontext.offen).ok) fehler.push(`${ort}: wenn.eintrag-Pfad «${p}» fehlt im Modell`);
      continue;
    }
    if (!WENN_SCHLUESSEL.includes(k)) fehler.push(`${ort}: unbekannte Bedingung «${k}»`);
    else if (k === 'rolle' && !['anbieter', 'betreiber'].includes(String(v))) fehler.push(`${ort}: rolle «${String(v)}»`);
    else if (k === 'typ' && v !== 'eigenbau') fehler.push(`${ort}: typ «${String(v)}»`);
    else if (!['rolle', 'typ'].includes(k) && typeof v !== 'boolean') fehler.push(`${ort}: ${k} muss true oder false sein`);
  }
}

describe('Etappen und Seiten', () => {
  it('kennt alle Etappen E0 bis E13 und J, jede mit Seiten', () => {
    expect(etappen.map((e) => e.id)).toEqual(ETAPPEN_IDS);
    for (const e of etappen) expect(e.seiten.length, e.id).toBeGreaterThan(0);
    expect([...seitenJeEtappe.keys()].sort()).toEqual([...ETAPPEN_IDS].sort());
  });

  it('jede Seiten-ID in etappen.yaml existiert in seiten/<etappe>.yaml und umgekehrt, in derselben Reihenfolge', () => {
    for (const e of etappen) {
      const ids = (seitenJeEtappe.get(e.id) ?? []).map((s) => s.id);
      expect(e.seiten, e.id).toEqual(ids);
    }
    expect(seitenIds.size).toBe(alleSeiten.length);
  });

  it('Seiten-IDs tragen das Etappenpräfix', () => {
    for (const [e, seiten] of seitenJeEtappe) for (const s of seiten) expect(s.id.startsWith(`${e}-`), s.id).toBe(true);
  });

  it('jede Etappe nach E0 beginnt mit einer Einführungsseite vom Typ info', () => {
    for (const e of etappen.filter((x) => x.id !== 'E0')) expect(seitenJeEtappe.get(e.id)![0]!.typ, e.id).toBe('info');
  });

  it('Seiten haben gültigen Typ, Normabschnitt, Leitfaden und Vorlage', () => {
    const fehler: string[] = [];
    for (const s of alleSeiten) {
      if (!SEITENTYPEN.includes(s.typ)) fehler.push(`${s.id}: Typ «${s.typ}»`);
      if (typeof s.norm !== 'string' || s.norm.trim() === '') fehler.push(`${s.id}: norm fehlt`);
      if (s.leitfaden !== undefined && !(s.leitfaden >= 1 && s.leitfaden <= 10)) fehler.push(`${s.id}: leitfaden`);
      if (s.vorlage && !dokumentIds.has(s.vorlage)) fehler.push(`${s.id}: Vorlage ${s.vorlage} unbekannt`);
      if (!OHNE_FELDER.includes(s.typ) && !(s.felder && s.felder.length > 0)) fehler.push(`${s.id}: keine Felder`);
      if (OHNE_FELDER.includes(s.typ) && s.felder) fehler.push(`${s.id}: Typ ${s.typ} ohne Felder`);
      if (!OHNE_FELDER.includes(s.typ) && !s.beispiel) fehler.push(`${s.id}: beispiel fehlt`);
      if (s.typ === 'liste' && !(s.liste && LISTEN.includes(s.liste))) fehler.push(`${s.id}: liste «${s.liste}»`);
      if (s.typ !== 'liste' && (s.liste || s.vorgabe || s.startwerte || s.anlegen !== undefined || s.eintrag)) fehler.push(`${s.id}: Listenattribute nur bei typ liste`);
      if (s.filterSystem && s.typ !== 'folgenabschaetzung') fehler.push(`${s.id}: filterSystem nur bei folgenabschaetzung`);
      if ((s.rahmenwerk || s.controls) && s.typ !== 'soa') fehler.push(`${s.id}: rahmenwerk/controls nur bei soa`);
      if (s.rahmenwerk && !['ISO42001', 'EUAIA', 'NISTRMF', 'EIGENE'].includes(s.rahmenwerk)) fehler.push(`${s.id}: rahmenwerk`);
      if (s.filterEines && s.typ !== 'auswahl-systeme') fehler.push(`${s.id}: filterEines nur bei auswahl-systeme`);
      if ((s.typ === 'vorschlaege') !== !!s.katalog) fehler.push(`${s.id}: katalog genau bei typ vorschlaege`);
      if (s.katalog && !VORSCHLAG_KATALOGE.includes(s.katalog)) fehler.push(`${s.id}: katalog ${s.katalog}`);
      if (s.nistStand && s.typ !== 'nist-profil') fehler.push(`${s.id}: nistStand nur bei nist-profil`);
      if (s.controls) for (const c of s.controls) if (!/^A\.\d+(\.\d+)+$/.test(c)) fehler.push(`${s.id}: Control ${c}`);
      if (s.eintrag && !dokumentIds.has(s.eintrag) && !ebIds.has(s.eintrag)) fehler.push(`${s.id}: eintrag ${s.eintrag}`);
      pruefeWenn(s.wenn, s.id, fehler);
    }
    for (const e of etappen) {
      for (const v of e.vorlagen) if (!dokumentIds.has(v)) fehler.push(`${e.id}: Vorlage ${v} unbekannt`);
      pruefeWenn(e.wenn, e.id, fehler);
    }
    expect(fehler).toEqual([]);
  });

  it('jeder Feldpfad existiert im Datenmodell (leeresProjekt bzw. Beispiel-Eintrag der Liste)', () => {
    const fehler: string[] = [];
    for (const s of alleSeiten) {
      const k = kontext(s);
      for (const { feld, schluessel, spalteVon } of felderMitSchluessel(s)) {
        const ort = `${s.id} ${schluessel}`;
        if (!FELDTYPEN.includes(feld.typ)) fehler.push(`${ort}: Feldtyp «${feld.typ}»`);
        if (feld.typ === 'checkliste') {
          if (feld.pfad || !/^E-0\d\.[a-z]+\.\{id\}$/.test(feld.schluessel ?? '')) fehler.push(`${ort}: checkliste braucht schluessel «E-0x.<name>.{id}» statt pfad`);
          pruefeWenn(feld.wenn, ort, fehler, k);
          continue;
        }
        if (!feld.pfad) {
          fehler.push(`${ort}: pfad fehlt`);
          continue;
        }
        if (spalteVon) {
          const zeile = loese(k.wurzel, `${spalteVon.pfad}[]`, k.offen);
          if (!zeile.ok || !loese(zeile.wert, feld.pfad).ok) fehler.push(`${ort}: Spalte fehlt im Modell (${k.name})`);
        } else if (!loese(k.wurzel, feld.pfad, k.offen).ok) {
          fehler.push(`${ort}: Pfad fehlt im Modell (${k.name})`);
        }
        if (feld.typ === 'tabelle') {
          const w = loese(k.wurzel, feld.pfad, k.offen).wert;
          if (!Array.isArray(w)) fehler.push(`${ort}: tabelle braucht ein Listenfeld`);
          if (!feld.spalten?.length) fehler.push(`${ort}: tabelle ohne spalten`);
        }
        if (['auswahl', 'mehrfach'].includes(feld.typ) && !(feld.optionen && optionen[feld.optionen])) fehler.push(`${ort}: Optionsgruppe «${feld.optionen}» fehlt`);
        if (feld.vorschlaege && !optionen[feld.vorschlaege]) fehler.push(`${ort}: Vorschlagsgruppe «${feld.vorschlaege}» fehlt`);
        if (feld.typ === 'verweis' && !VERWEIS_QUELLEN.includes(feld.quelle ?? '')) fehler.push(`${ort}: verweis-Quelle «${feld.quelle}»`);
        for (const [wert, setzt] of Object.entries(feld.setzt ?? {})) {
          if (!optionen[feld.optionen ?? '']?.includes(wert)) fehler.push(`${ort}: setzt für unbekannten Wert ${wert}`);
          for (const p of Object.keys(setzt)) if (!loese(PROJEKT, p).ok) fehler.push(`${ort}: setzt-Pfad «${p}» fehlt im Modell`);
        }
        for (const p of feld.vorschlag?.wennEines ?? []) if (!loese(PROJEKT, p).ok) fehler.push(`${ort}: vorschlag-Pfad «${p}» fehlt im Modell`);
        pruefeWenn(feld.wenn, ort, fehler, OHNE_FELDER.includes(s.typ) || s.typ === 'formular' ? undefined : k);
      }
      // Filter, Vorgaben, Startwerte
      for (const p of Object.keys(s.filter ?? {})) if (!loese(k.wurzel, p, k.offen).ok) fehler.push(`${s.id}: filter-Pfad «${p}» fehlt`);
      for (const p of Object.keys(s.filterEines ?? {})) if (!loese(k.wurzel, p, k.offen).ok) fehler.push(`${s.id}: filterEines-Pfad «${p}» fehlt`);
      for (const p of Object.keys(s.filterSystem ?? {})) if (!loese(PROJEKT.kiSysteme, p).ok) fehler.push(`${s.id}: filterSystem-Pfad «${p}» fehlt`);
      for (const p of flachePfade(s.vorgabe ?? {})) if (!loese(k.wurzel, p, k.offen).ok) fehler.push(`${s.id}: vorgabe-Pfad «${p}» fehlt`);
      for (const sw of s.startwerte ?? []) for (const p of flachePfade(sw)) if (!loese(k.wurzel, p, k.offen).ok) fehler.push(`${s.id}: startwerte-Pfad «${p}» fehlt`);
    }
    expect(fehler).toEqual([]);
  });

  it('beispiel-Pfade zeigen auf vorhandene Stellen im Datenmodell', () => {
    const fehler = alleSeiten.filter((s) => s.beispiel && !loese(PROJEKT, s.beispiel, OFFENE_MAPS_WURZEL).ok).map((s) => `${s.id}: ${s.beispiel}`);
    expect(fehler).toEqual([]);
  });

  it('Optionswerte stimmen mit den Wertebereichen in typen.ts überein', () => {
    // Stichproben gegen die Unions im Modell (zur Laufzeit nicht abfragbar, daher hier festgehalten)
    expect(optionen.kiTyp).toEqual(['eingekauft', 'saas', 'eigenbau', 'schatten']);
    expect(optionen.kiStatus).toEqual(['erfasst', 'in-pruefung', 'freigegeben', 'eingeschraenkt', 'ausgesetzt', 'abgeloest', 'untersagt']);
    expect(optionen.aiActRolle).toEqual(['anbieter', 'betreiber', 'einfuehrer', 'haendler', 'produkthersteller', 'bevollmaechtigter']);
    expect(optionen.risikoklasse).toEqual(['offen', 'verboten', 'hochrisiko-anhang-iii', 'hochrisiko-anhang-i', 'transparenz', 'minimal']);
    expect(optionen.behandlung).toEqual(['vermeiden', 'vermindern', 'teilen', 'tragen', 'nutzen']);
    expect(optionen.controlStatus).toEqual(['offen', 'geplant', 'teilweise', 'umgesetzt', 'wirksam']);
    expect(optionen.transparenz).toEqual(['50-1', '50-2', '50-3', '50-4']);
    expect(optionen.jaNeinOffen).toEqual(['ja', 'nein', 'offen']);
    expect(optionen.auditArt).toEqual(['intern', 'extern-stage1', 'extern-stage2', 'ueberwachung']);
    expect(optionen.einstufung).toEqual(['nk-schwer', 'nk-leicht', 'beobachtung', 'verbesserung']);
    // Pflichtrollen der Prüfregel F14 sind auswählbar
    expect(optionen.rollenBereich).toEqual(expect.arrayContaining(['konformitaet', 'berichterstattung']));
  });

  it('Kalenderaufgaben verweisen auf vorhandene Seiten und Pfade', () => {
    const kalender = alleSeiten.filter((s) => s.typ === 'kalender');
    expect(kalender.length).toBeGreaterThan(0);
    const fehler: string[] = [];
    for (const s of kalender) {
      for (const a of s.aufgaben ?? []) {
        if (!seitenIds.has(a.seite)) fehler.push(`${a.id}: Seite ${a.seite}`);
        if (!optionen.rhythmus!.includes(a.rhythmus)) fehler.push(`${a.id}: rhythmus`);
        if (a.monatAus && !loese(PROJEKT, a.monatAus, OFFENE_MAPS_WURZEL).ok) fehler.push(`${a.id}: monatAus`);
        if (a.faelligAus && !loese(PROJEKT, a.faelligAus).ok) fehler.push(`${a.id}: faelligAus`);
        pruefeWenn(a.wenn, a.id, fehler);
      }
    }
    expect(fehler).toEqual([]);
  });

  it('Checklisten-IDs sind eindeutig und Bedingungen gültig', () => {
    const ids = etappen.flatMap((e) => e.checkliste.map((c) => (typeof c === 'string' ? c : c.id)));
    expect(new Set(ids).size).toBe(ids.length);
    const fehler: string[] = [];
    for (const e of etappen) for (const c of e.checkliste) if (typeof c !== 'string') pruefeWenn(c.wenn, c.id, fehler);
    expect(fehler).toEqual([]);
  });
});

describe('Fahrplan', () => {
  const fahrplan = lies<{ fahrplan: { schritte: { nr: number; wochen: unknown; pt: unknown }[]; wochen: Record<string, number>; meilensteine: { id: string; wochen: Record<string, number> }[]; freigaben: { id: string; wochen: Record<string, number>; vorlagen: Record<string, string[]> }[] } }>('src/gefuehrt/etappen.yaml').fahrplan;
  const leitfaden = lies<{ schritte: { nr: number; wochen: unknown; pt: unknown }[] }>('src/leitfaden/schritte.yaml').schritte;
  it('Wochen und Personentage je Schritt stimmen mit src/leitfaden/schritte.yaml überein', () => {
    expect(fahrplan.schritte.map((s) => ({ nr: s.nr, wochen: s.wochen, pt: s.pt }))).toEqual(leitfaden.map((s) => ({ nr: s.nr, wochen: s.wochen, pt: s.pt })));
  });
  it('Meilensteine und Freigaben liegen im Plan des Pfads, Vorlagen existieren, Texte DE und EN vorhanden', () => {
    const app = { de: ladeTexte('de').app as Record<string, Record<string, Record<string, string>>>, en: ladeTexte('en').app as Record<string, Record<string, Record<string, string>>> };
    const fehler: string[] = [];
    for (const m of [...fahrplan.meilensteine, ...fahrplan.freigaben]) {
      for (const [pfad, w] of Object.entries(m.wochen)) if (!(w >= 1 && w <= fahrplan.wochen[pfad]!)) fehler.push(`${m.id}: Woche ${w} (${pfad})`);
    }
    for (const f of fahrplan.freigaben) for (const v of Object.values(f.vorlagen).flat()) if (!dokumentIds.has(v)) fehler.push(`${f.id}: Vorlage ${v}`);
    for (const s of ['de', 'en'] as const) {
      for (const m of fahrplan.meilensteine) if (!app[s].fahrplan?.['meilensteine']?.[m.id]) fehler.push(`${s}: meilensteine.${m.id}`);
      for (const f of fahrplan.freigaben) if (!app[s].fahrplan?.['freigaben']?.[f.id]) fehler.push(`${s}: freigaben.${f.id}`);
    }
    expect(fehler).toEqual([]);
  });
});

describe('Schlüssel wie in den Vorlagen', () => {
  const felder = alleSeiten.flatMap((s) => (s.felder ?? []).map((f) => ({ seite: s, feld: f })));
  it('Checklistenschlüssel für Art. 26 sind genau die Punkte von E-05 (E05_PUNKTE)', () => {
    const punkte = felder.filter(({ feld }) => feld.schluessel?.startsWith('E-05.')).map(({ feld }) => feld.schluessel!.split('.')[1]!);
    expect(punkte.length).toBeGreaterThan(0);
    for (const p of punkte) expect(E05_PUNKTE as readonly string[], p).toContain(p);
  });
  it('Prüfpunkte der Lieferanten sind genau PF-01 bis PF-27 (D-16), PF-16 bis PF-27 eingeschlossen', () => {
    const pf = felder.filter(({ seite, feld }) => seite.liste === 'lieferanten' && feld.pfad?.startsWith('pruefpunkte.')).map(({ feld }) => feld.pfad!.slice('pruefpunkte.'.length));
    expect(pf).toEqual([...PRUEFPUNKTE_LIEFERANT]);
    expect(pf).toEqual(expect.arrayContaining([...PRUEFPUNKTE_LIEFERANT_RC2, ...PRUEFPUNKTE_LIEFERANT_RC3]));
  });
  it('Vertragsklauseln sind genau VK-01 bis VK-19 (D-16), VK-13 bis VK-19 eingeschlossen', () => {
    const vk = felder.filter(({ seite, feld }) => seite.liste === 'lieferanten' && feld.pfad?.startsWith('vertragsklauseln.')).map(({ feld }) => feld.pfad!.slice('vertragsklauseln.'.length));
    expect(vk).toEqual([...VERTRAGSKLAUSELN]);
    expect(vk).toEqual(expect.arrayContaining([...VERTRAGSKLAUSELN_RC2, ...VERTRAGSKLAUSELN_RC3]));
  });
  it('Dienst und Tarif (E4-dienst): Tarife und Funktionsschalter wie typen.ts und D-10 (DE und EN)', () => {
    expect(optionen['tarif']).toEqual([...TARIFE]);
    const seite = alleSeiten.find((s) => s.id === 'E4-dienst')!;
    expect((seite.felder ?? []).map((f) => f.pfad!).filter((x) => x.startsWith('funktionen.')).map((x) => x.slice('funktionen.'.length))).toEqual([...FUNKTIONEN]);
    for (const s of ['de', 'en'] as const) {
      const d10 = lies<{ listen: Record<string, string[]>; funktionen: Record<string, string> }>(`src/i18n/${s}/vorlagen/D-10.yaml`);
      const texte = lies<{ optionen: Record<string, Record<string, string>> }>(`src/i18n/${s}/gefuehrt.yaml`).optionen;
      expect(optionen['tarif']!.map((w) => texte['tarif']![String(w)]), s).toEqual(d10.listen['tarif']);
      expect(optionen['funktionStand']!.map((w) => texte['funktionStand']![String(w)]), s).toEqual(d10.listen['funktion_stand']);
      expect(Object.keys(d10.funktionen), s).toEqual([...FUNKTIONEN]);
    }
  });
  it('Optionen der Kernfelder ab rc.2 stimmen mit typen.ts und den Listen in D-10 überein (DE und EN)', () => {
    expect(optionen['handlungsbefugnis']).toEqual([...HANDLUNGSBEFUGNISSE]);
    expect(optionen['aufgabenart']).toEqual([...AUFGABENARTEN]);
    expect(optionen['entscheid']).toEqual([...ENTSCHEIDE]);
    expect(optionen['vertrauensmerkmal']).toEqual([...VERTRAUENSMERKMALE]);
    expect(optionen['schwere']).toEqual([1, 2, 3, 4]);
    expect(optionen['feststellungQuelle']).toEqual(['audit', 'managementbewertung', 'vorfall', 'beinahe-vorfall', 'pruefung', 'meldung']);
    for (const s of ['de', 'en'] as const) {
      const d10 = lies<{ listen: Record<string, string[]> }>(`src/i18n/${s}/vorlagen/D-10.yaml`).listen;
      const d22 = lies<{ listen: Record<string, string[]> }>(`src/i18n/${s}/vorlagen/D-22.yaml`).listen;
      const texte = lies<{ optionen: Record<string, Record<string, string>> }>(`src/i18n/${s}/gefuehrt.yaml`).optionen;
      expect(optionen['handlungsbefugnis']!.map((w) => texte['handlungsbefugnis']![String(w)]), s).toEqual(d10['handlungsbefugnis']);
      expect(optionen['aufgabenart']!.map((w) => texte['aufgabenart']![String(w)]), s).toEqual(d10['aufgabenart']);
      expect(optionen['schwere']!.map((w) => texte['schwere']![String(w)]), s).toEqual(d22['schwere']!.map((x, i) => `${i + 1} ${x}`));
    }
  });
  it('GenAI-Bewertung (E9-genai) fragt genau die 12 Risiken aus src/nist-rmf/genai-risiken.yaml ab', () => {
    const risiken = lies<{ risiken: { id: string }[] }>('src/nist-rmf/genai-risiken.yaml').risiken.map((r) => r.id);
    const seite = alleSeiten.find((s) => s.id === 'E9-genai')!;
    const ids = [...new Set((seite.felder ?? []).map((f) => f.pfad!.split('.')[1]!))];
    expect(ids).toEqual(risiken);
  });
  it('Textbausteine der Ursachenkategorie entsprechen der Liste in D-22 (DE und EN)', () => {
    for (const s of ['de', 'en'] as const) {
      const d22 = lies<{ listen: { ursache_ki: string[] } }>(`src/i18n/${s}/vorlagen/D-22.yaml`).listen.ursache_ki;
      const texte = lies<{ optionen: Record<string, Record<string, string>> }>(`src/i18n/${s}/gefuehrt.yaml`).optionen['ursacheKi']!;
      expect(optionen['ursacheKi']!.map((w) => texte[String(w)]), s).toEqual(d22);
    }
  });
  it('Ergebnisse der Auditcheckliste entsprechen ChecklistenEintrag und der Liste in D-20', () => {
    expect(optionen['checklistenErgebnis']).toEqual(['konform', 'beobachtung', 'nk-leicht', 'nk-schwer', 'nicht-geprueft', 'nicht-pruefbar']);
    for (const s of ['de', 'en'] as const) {
      const d20 = lies<{ listen: { ergebnis: string[] } }>(`src/i18n/${s}/vorlagen/D-20.yaml`).listen.ergebnis;
      const texte = lies<{ optionen: Record<string, Record<string, string>> }>(`src/i18n/${s}/gefuehrt.yaml`).optionen['checklistenErgebnis']!;
      expect(optionen['checklistenErgebnis']!.map((w) => texte[String(w)]), s).toEqual(d20);
    }
  });
  it('Traktanden der Managementbewertung (E12-mb-ergebnisse) sind genau MB_TRAKTANDEN', () => {
    const t = felder.filter(({ seite, feld }) => seite.id === 'E12-mb-ergebnisse' && feld.pfad?.startsWith('ergebnisse.')).map(({ feld }) => feld.pfad!.slice('ergebnisse.'.length));
    expect(t).toEqual([...MB_TRAKTANDEN]);
  });
  it('Dokumentinhalte stehen nicht mehr unter meta.gefuehrt.antworten', () => {
    const verschoben = ['gap', 'projekt', 'meldeweg', 'meldekanal', 'lenkung', 'leitlinie.bezug', 'oeffentlicheDienste', 'protokolle'];
    const pfade = felder.map(({ feld }) => feld.pfad ?? '').filter((p) => verschoben.some((v) => p.startsWith(`meta.gefuehrt.antworten.${v}`)));
    expect(pfade).toEqual([]);
  });
});

describe('Texte DE', () => {
  const leer = (t: unknown) => typeof t !== 'string' || t.trim() === '';

  it('jede Seite hat titel, frage, warum und fehler, jedes Feld label und hilfe', () => {
    const fehler: string[] = [];
    for (const [e, seiten] of seitenJeEtappe) {
      const t = seitenTexteJeEtappe.get(e) ?? {};
      for (const s of seiten) {
        const st = t[s.id];
        if (!st) {
          fehler.push(`${s.id}: Text fehlt`);
          continue;
        }
        for (const k of ['titel', 'frage', 'warum', 'fehler'] as const) if (leer(st[k])) fehler.push(`${s.id}: ${k} fehlt`);
        for (const { schluessel } of felderMitSchluessel(s)) {
          const ft = st.felder?.[schluessel];
          if (!ft || leer(ft.label) || leer(ft.hilfe)) fehler.push(`${s.id}: Feldtext ${schluessel}`);
        }
        const erwartet = new Set(felderMitSchluessel(s).map((x) => x.schluessel));
        for (const k of Object.keys(st.felder ?? {})) if (!erwartet.has(k)) fehler.push(`${s.id}: überzähliger Feldtext ${k}`);
      }
      for (const id of Object.keys(t)) if (!seitenIds.has(id)) fehler.push(`Text für unbekannte Seite ${id}`);
    }
    expect(fehler).toEqual([]);
  });

  it('jede Etappe hat titel, ziel, warum und ergebnis; Beteiligte haben Texte', () => {
    const fehler: string[] = [];
    for (const e of etappen) {
      const t = texte.etappen[e.id];
      for (const k of ['titel', 'ziel', 'warum', 'ergebnis'] as const) if (!t || leer(t[k])) fehler.push(`${e.id}: ${k}`);
      for (const b of e.beteiligte) if (leer(texte.beteiligte[b])) fehler.push(`${e.id}: Beteiligte ${b}`);
    }
    expect(fehler).toEqual([]);
  });

  it('jede Checkliste und jede Kalenderaufgabe hat Text', () => {
    const fehler: string[] = [];
    for (const e of etappen) for (const c of e.checkliste) {
      const id = typeof c === 'string' ? c : c.id;
      if (leer(texte.checklisten[id])) fehler.push(id);
    }
    for (const s of alleSeiten) for (const a of s.aufgaben ?? []) if (leer(texte.kalender[a.id])) fehler.push(`kalender ${a.id}`);
    expect(fehler).toEqual([]);
  });

  it('jede Optionsgruppe hat für jeden Wert eine Beschriftung', () => {
    const fehler: string[] = [];
    for (const [g, werte] of Object.entries(optionen)) for (const w of werte) if (leer(texte.optionen[g]?.[String(w)])) fehler.push(`${g}.${w}`);
    for (const g of Object.keys(texte.optionen)) if (!optionen[g]) fehler.push(`Text für unbekannte Gruppe ${g}`);
    expect(fehler).toEqual([]);
  });

  it('der Sprachlader führt gefuehrt.yaml und gefuehrt/ ohne doppelte Schlüssel zusammen', () => {
    expect(Object.keys(gefuehrtGeladen).sort()).toEqual([...Object.keys(texte), ...ETAPPEN_IDS].sort());
  });

  it('allgemeine UI-Texte des Modus sind vorhanden', () => {
    for (const k of ['weiter', 'zurueck', 'spaeter', 'als_vorlage', 'mit_ki_vertiefen', 'live_vorschau', 'hilfe', 'fragebogen', 'checkliste']) expect(texte.ui[k], k).toBeTruthy();
  });

  it('Texte enthalten kein Eszett und keine Halbgeviert- oder Geviertstriche', () => {
    const dateien = ['src/i18n/de/gefuehrt.yaml', 'src/i18n/de/glossar.yaml', ...readdirSync(join(REPO, 'src/i18n/de/gefuehrt')).map((d) => `src/i18n/de/gefuehrt/${d}`)];
    // Zeichen über Codepunkte, damit diese Datei selbst sauber bleibt (Eszett, grosses Eszett, Halbgeviert-, Geviertstrich)
    const verboten = new RegExp(`[${[0xdf, 0x1e9e, 0x2013, 0x2014].map((c) => String.fromCodePoint(c)).join('')}]`);
    for (const d of dateien) expect(readFileSync(join(REPO, d), 'utf8'), d).not.toMatch(verboten);
  });
});

describe('Glossar', () => {
  it('Katalog und Texte decken sich, rund 60 Begriffe mit Begriff, Erklärung und englischem Fachbegriff', () => {
    const ids = glossarKatalog.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(55);
    expect(Object.keys(glossarTexte).sort()).toEqual([...ids].sort());
    for (const id of ids) {
      const t = glossarTexte[id]!;
      expect(t.begriff && t.erklaerung && t.en, id).toBeTruthy();
    }
  });

  it('jeder [[g:…]]-Schlüssel in den Texten existiert im Glossar', () => {
    const ids = new Set(glossarKatalog.map((b) => b.id));
    const dateien = ['src/i18n/de/gefuehrt.yaml', 'src/i18n/de/glossar.yaml', ...readdirSync(join(REPO, 'src/i18n/de/gefuehrt')).map((d) => `src/i18n/de/gefuehrt/${d}`)];
    const fehlend: string[] = [];
    let anzahl = 0;
    for (const d of dateien) {
      for (const m of readFileSync(join(REPO, d), 'utf8').matchAll(/\[\[g:([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
        anzahl++;
        if (!ids.has(m[1]!)) fehlend.push(`${d}: ${m[1]}`);
      }
    }
    expect(fehlend).toEqual([]);
    expect(anzahl).toBeGreaterThan(30);
  });
});

describe('AI-Act-Sprunglinks', () => {
  const datei = join(REPO, 'src/ai-act/artikel-seiten.json');
  it.skipIf(!existsSync(datei))('aiact-Schlüssel der Seiten und des Glossars existieren in artikel-seiten.json', () => {
    const seiten = (JSON.parse(readFileSync(datei, 'utf8')) as { de: Record<string, number> }).de;
    const genutzt = [...alleSeiten.flatMap((s) => (s.aiact ?? []).map((a) => [s.id, a] as const)), ...glossarKatalog.flatMap((b) => (b.aiact ?? []).map((a) => [`glossar ${b.id}`, a] as const))];
    expect(genutzt.length).toBeGreaterThan(0);
    expect(genutzt.filter(([, a]) => !(a in seiten)).map(([o, a]) => `${o}: ${a}`)).toEqual([]);
  });
});
