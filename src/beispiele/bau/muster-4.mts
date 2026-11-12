// Beispiel 1: Muster Maschinenbau AG. Teil 4: Angaben in den Feldern der Konsolidierung (Meldewege, Gremien,
// Projektauftrag, Gap-Analyse, Dokumentenlenkung, Ziele, Audits, Feststellungen, Managementbewertung, Lieferanten).
// Früher teils unter meta.gefuehrt.antworten; jetzt in den eigenen Feldern des Datenmodells.
import type { GapAnalyse, KlauselStand, NutzenSchadenZiel, Projekt, ReifeGrob, Reifegrad, Vertragsklausel } from '../../model/typen.ts';
import { VERTRAGSKLAUSELN } from '../../model/typen.ts';
import { kataloge } from './gemeinsam.mts';

const vk = (werte: KlauselStand[]): Partial<Record<Vertragsklausel, KlauselStand>> => Object.fromEntries(VERTRAGSKLAUSELN.map((id, i) => [id, werte[i]!]));

/** Ist-Reife je Normabschnitt aus der groben Einschätzung je Kapitel (Startinterview) */
const REIFE_AUS_GROB: Record<ReifeGrob, Reifegrad> = { fehlt: 0, begonnen: 1, weitgehend: 2, erfuellt: 3 };

/** Soll-Reife für die Zertifizierung: Stufe 3 (festgelegt, angewendet, nachweisbar) */
const SOLL: Reifegrad = 3;

/**
 * Gap-Analyse zum Datum der Analyse. Soll-Reife 3 je Abschnitt und Control; Controls in «ohneLuecke» (voraussichtlich
 * nicht anwendbar) erhalten Soll gleich Ist und eine Beschreibung in «beschreibungen». Abschnitte in «sollOffen» bleiben ohne
 * Soll-Reife (Muster: K-4.1, Vorgabe von tests/unit/vorlagen-konsolidierung.test.ts).
 */
export function gapAnalyse(
  kapitel: NonNullable<GapAnalyse['kapitel']>,
  datum: string,
  controlReife: Record<string, Reifegrad>,
  beschreibungen: Record<string, string> = {},
  ohneLuecke: string[] = [],
  sollOffen: string[] = [],
): GapAnalyse {
  const abschnitte: GapAnalyse['abschnitte'] = {};
  for (const k of kataloge.anforderungen42001.kapitel as { id: string; abschnitte: { id: string }[] }[]) {
    const nr = k.id.replace(/^K-/, '');
    const grob = kapitel[`k${nr}` as keyof typeof kapitel] ?? 'fehlt';
    const ist = REIFE_AUS_GROB[grob];
    for (const a of k.abschnitte) abschnitte[a.id] = { ist, ...(sollOffen.includes(a.id) ? {} : { soll: Math.max(ist, SOLL) as Reifegrad }), ...(beschreibungen[a.id] ? { beschreibung: beschreibungen[a.id] } : {}) };
  }
  const controls: GapAnalyse['controls'] = {};
  for (const g of kataloge.controls42001.gruppen as { id: string; controls: { id: string }[] }[]) {
    for (const c of g.controls) {
      const ist = controlReife[g.id] ?? 1;
      controls[c.id] = { ist, soll: ohneLuecke.includes(c.id) ? ist : (Math.max(ist, SOLL) as Reifegrad), ...(beschreibungen[c.id] ? { beschreibung: beschreibungen[c.id] } : {}) };
    }
  }
  return { datum, kapitel, abschnitte, controls };
}

export function konsolidierungMuster(p: Projekt): void {
  const o = p.organisation;
  o.meldeweg = {
    kanaele: ['vorgesetzte', 'aims', 'whistleblowing'],
    kanal: 'Gespräch mit der vorgesetzten Person oder der AIMS-Verantwortlichen, E-Mail an ki-meldung@muster-maschinenbau.example; vertraulich auch über die Hinweisgeberstelle des ISMS',
    ausweichstelle: 'P-009',
    vertraulich: true,
    fristTage: 10,
    fristErgebnisTage: 30,
    eskalation: 'An den CEO, wenn eine Meldung nicht fristgerecht bearbeitet wird oder ein erhebliches Risiko für Personen, Kunden oder Maschinen besteht.',
    bekanntmachung: 'Intranet-Seite «KI bei Muster», Teamsitzungen und Aushang in Werk und Büro',
  };
  o.meldekanalExtern = {
    adresse: 'ki-feedback@muster-maschinenbau.example und Formular «KI-Rückmeldung» im Kundenportal',
    ort: 'Website (Seite Kontakt), Kundenportal und Betriebsanleitung der Baureihe MX',
    bearbeitung: 'P-008',
    fristTage: 5,
    fristAntwortTage: 30,
    vorfallVerfahren: 'ISMS-Vorfallverfahren VA-ISMS-07, Version 2.1, mit KI-Ergänzung',
  };
  o.meldestelle = 'AIMS-Verantwortliche (ki-meldung@muster-maschinenbau.example)';
  o.gremien = [
    { name: 'Geschäftsleitungssitzung', themen: 'Freigaben (Leitlinie, Geltungsbereich, Restrisiken, KI-Systeme mit hohem Risiko oder vollständiger Folgenabschätzung, Vorbehalte der Risikobereitschaft), Stand des AIMS, Managementbewertung. Entscheide fallen in der Sitzung oder als Zirkularbeschluss und stehen mit Datum im Protokoll (N-058); in Registern und Freigabelisten zeichnet der Vorsitzende im Auftrag der Geschäftsleitung', rhythmus: 'alle 14 Tage während des Aufbaus, danach monatlich; Managementbewertung jährlich', vorsitz: 'P-001' },
    { name: 'ISMS-Runde, erweitert um KI', themen: 'KI-Risiken, Vorfälle, Lieferanten, Stand der Massnahmen', rhythmus: 'quartalsweise', vorsitz: 'P-003' },
    { name: 'AIMS-Team', themen: 'Anträge für neue KI-Werkzeuge vorbereiten (Entscheid durch die AIMS-Verantwortliche mit der verantwortlichen Person, bei hohem Risiko durch die Geschäftsleitung), KI-Inventar, Änderungen an KI-Systemen und am AIMS', rhythmus: 'monatlich', vorsitz: 'P-002' },
  ];
  o.projektauftrag = {
    ziel: 'Zertifizierung nach ISO/IEC 42001 bis 30.06.2027 als Erweiterung des ISMS, mit den Pflichten aus dem EU AI Act für Produkt-KI, Kundenportal und Personalbereich; Stage-1-Bereitschaft nach rund 6 Monaten.',
    nutzen: 'Nachweis für Grosskunden in Lieferantenaudits, geordneter Einsatz von KI in Produkten und Verwaltung, Vorbereitung auf EU AI Act und Maschinenverordnung. Zwei Kunden in den USA fragen in ihren Lieferantenfragebögen nach dem NIST AI RMF; deshalb gleichen wir das AIMS mit dem AI RMF ab (Profil, Mess- und Prüfkonzept, Risiken generativer KI).',
    aufwandPt: 50,
    budget: 85000,
    pensumProzent: 40,
    sponsor: 'P-001',
    meilensteine: [
      { was: 'Gap-Analyse und Projektauftrag', termin: '2026-08-04' },
      { was: 'Kontext, Geltungsbereich, KI-Leitlinie und Rollen', termin: '2026-09-01' },
      { was: 'KI-Inventar vollständig', termin: '2026-09-11' },
      { was: 'Rolle und Einstufung je KI-System', termin: '2026-09-25' },
      { was: 'Risikokriterien und Verfahren Folgenabschätzung', termin: '2026-09-29' },
      { was: 'Zertifizierungsstelle gewählt', termin: '2026-10-09' },
      { was: 'Folgenabschätzungen freigegeben', termin: '2026-11-10' },
      { was: 'Behandlungsplan, Restrisiken und Erklärung zur Anwendbarkeit', termin: '2026-11-24' },
      { was: 'Richtlinien, Verfahren und Schulung', termin: '2026-12-22' },
      { was: 'Internes Audit', termin: '2027-01-18' },
      { was: 'Managementbewertung', termin: '2027-02-02' },
      { was: 'Stage-1-Bereitschaft', termin: '2027-02-05' },
      { was: 'Stage 1', termin: '2027-03-02' },
      { was: 'Stage 2', termin: '2027-05-04' },
    ],
    risiken: 'Zeit der Fachbereiche neben dem Tagesgeschäft, unbekannte Schatten-KI, Lieferanten ohne Auskünfte, offene Auslegung von AI Act und Maschinenverordnung.',
    freigabe: { von: 'P-001', am: '2026-08-04' },
    glTraktandum: 'monatlich',
    // Projektteam ohne den internen Auditor (P-011), damit das interne Audit unabhängig bleibt
    team: ['P-001', 'P-002', 'P-003', 'P-004', 'P-005', 'P-006', 'P-007', 'P-008', 'P-009', 'P-010'],
    geltungsbereich: 'Entwicklung, Bereitstellung und Nutzung aller KI-Systeme der Muster Maschinenbau AG und der Muster Maschinenbau Deutschland GmbH, als Erweiterung des zertifizierten ISMS; die genaue Abgrenzung folgt in D-02.',
  };
  o.protokollierung = { inhalt: ['eingaben', 'ausgaben', 'fehler', 'aenderungen', 'nutzende'], aufbewahrungMonate: 12, auswertung: 'quartalsweise' };
  o.dokumentenlenkung = {
    ismsRegelnGelten: true,
    ablage: 'SharePoint ISMS/AIMS mit Versionsverlauf; Lenkung nach ISMS-Verfahren VA-ISMS-02',
    namensregel: 'Dokument-ID und Titel, z. B. D-07-EB_Risikoregister',
    freigabe: 'aims',
    aufbewahrungJahre: 10,
    klassifikation: 'intern',
    extern: 'Normen, Rechtstexte und Lieferantenunterlagen im Ordner 99_Extern mit Stand-Datum.',
  };
  o.oeffentlicheDienste = false;
  // Keine Selbstfreigabe ab hohem Risiko (D-04): Ist die Geschäftsleitung selbst betroffen, entscheidet der Verwaltungsrat
  o.naechsthoehereStelle = 'Verwaltungsrat';
  o.leitlinie.abgleich = { informationssicherheit: 'angepasst', datenschutz: 'verweis', qualitaet: 'verweis', personal: 'angepasst', beschaffung: 'verweis' };
  o.leitlinie.abgleichNotiz = 'Abgleich am 27.08.2026 (N-042); Verweise in ISMS-Leitlinie IS-LL-01 Version 5.0, Datenschutzrichtlinie, Personalreglement und Einkaufsrichtlinie.';

  // Rollen: Stellvertretungen und die Bereiche, die das ISMS schon kennt
  const stv: Record<string, string> = { konformitaet: 'P-003', berichterstattung: 'P-003', risikomanagement: 'P-003', inventar: 'P-002', lieferanten: 'P-002', vorfall: 'P-006' };
  for (const r of p.rollen) if (stv[r.bereich]) r.stellvertretung = stv[r.bereich];
  p.rollen.push(
    { id: 'RO-013', bereich: 'informationssicherheit', verantwortlich: 'P-003', rechenschaft: 'P-001', konsultiert: ['P-002'], informiert: ['P-010'] },
    { id: 'RO-014', bereich: 'datenschutz', verantwortlich: 'P-009', rechenschaft: 'P-001', konsultiert: ['P-002', 'P-005'], informiert: ['P-003'] },
    { id: 'RO-015', bereich: 'internes-audit', verantwortlich: 'P-011', rechenschaft: 'P-001', konsultiert: ['P-002'], informiert: ['P-003'] },
    { id: 'RO-016', bereich: 'dokumentenlenkung', verantwortlich: 'P-003', rechenschaft: 'P-002', konsultiert: [], informiert: [] },
  );
  p.personen.push({ id: 'P-011', name: 'Reto Lehmann', funktion: 'Interner Auditor QM und ISMS, Bereich Finanzen', aimsRollen: ['auditor'] });

  p.gapAnalyse = gapAnalyse(
    { k4: 'begonnen', k5: 'begonnen', k6: 'weitgehend', inventar: 'fehlt', k7: 'weitgehend', k8: 'begonnen', k9: 'weitgehend', k10: 'erfuellt' },
    '2026-08-04',
    { 'A.2': 1, 'A.3': 1, 'A.4': 2, 'A.5': 0, 'A.6': 1, 'A.7': 1, 'A.8': 1, 'A.9': 1, 'A.10': 2 },
    GAP_IST_MUSTER,
    [],
    [],
  );

  // KI-Systeme: Freigabe, Protokollierung, Information der Nutzenden; gpai nur bei eigenem GPAI-Modell (hier keines)
  const sys = (id: string) => p.kiSysteme.find((s) => s.id === id)!;
  // Freigabe zur Nutzung nach der Folgenabschätzung: AIMS-Verantwortliche mit der verantwortlichen Person, bei
  // vollständiger Abschätzung, eingeschränkter Nutzung oder hohem Risiko die Geschäftsleitung (D-12, D-15-EB)
  const info: Record<string, [[string, string] | null, string, string]> = {
    // KI-001 steuert die Ausschleusweiche ohne Bestätigung: nach der Risikobereitschaft (D-03) Freigabe durch die Geschäftsleitung
    'KI-001': [['P-001', '2026-10-13'], 'Prüfentscheide mit Bild, Merkmal und Konfidenz 12 Monate auf der Prüfstation; Modellversionen und Nachtrainings im Änderungsprotokoll des Lieferanten.', 'Arbeitsanweisung Prüfstation Linie 3 mit Grenzen der Funktion; Einweisung der Prüfer.'],
    'KI-002': [['P-001', '2026-11-10'], 'Ereignisprotokoll der Funktion auf der Maschine (Hinweise, Quittierungen, Modellversion), beim Kunden 24 Monate; Release-Protokoll im Entwicklungsrepository.', 'Kapitel «Wartungsassistent» in der Betriebsanleitung MX mit Zweck, Grenzen, Aufsicht und Kontakt; Hinweis in der Bedienoberfläche.'],
    'KI-003': [['P-002', '2026-10-09'], 'Prognoseläufe mit Datenstand, Modellversion und Abweichungen 24 Monate im Planungssystem.', 'Planungshandbuch mit Hinweis, dass die Prognose ein Vorschlag ist.'],
    'KI-004': [['P-001', '2026-10-13'], 'Copilot-Nutzung und Audit-Log im Microsoft-Purview-Portal 12 Monate.', 'Richtlinie KI-Nutzung (D-15-EB), Intranet-Seite und E-Learning.'],
    'KI-005': [['P-001', '2026-10-13'], 'Anmeldungen und Nutzung der Firmenkonten in der Admin-Konsole des Team-Plans 90 Tage (Grenze des Plans). Abweichung von der Vorgabe 12 Monate: monatlicher Export ins SIEM des ISMS, dort 12 Monate.', 'Richtlinie KI-Nutzung mit Auflage «nur bis Klasse intern».'],
    'KI-006': [['P-001', '2026-10-27'], 'Gesprächsverläufe 90 Tage in der Cloud-KI-Plattform, danach gelöscht; anonymisierte Bewertungen der Antworten und Weiterleitungen an den Kundendienst 24 Monate.', 'Hinweis zu Beginn jedes Gesprächs: «Sie schreiben mit dem Ersatzteil-Assistenten, einem KI-Assistenten der Muster Maschinenbau AG. Die Antworten werden automatisch erzeugt und können Fehler enthalten. Für verbindliche Auskünfte wenden Sie sich an den Kundendienst.» In jeder Antwort: «Antwort eines KI-Assistenten, bitte Teilenummer prüfen».'],
    'KI-007': [['P-001', '2026-10-13'], 'Keine Protokolle beim Dienst; Ablösung durch den Firmenvertrag L-006.', 'Nutzung nur für beschreibende Textbausteine der Klasse «öffentlich»; Hinweis in D-15-EB.'],
    'KI-008': [null, 'Protokolle der Vorselektion 12 Monate beim Lieferanten (N-018); Entscheide der Personalabteilung im Bewerbungsdossier.', 'Geplant ab der Wiederinbetriebnahme (M-020): Hinweis in jeder Stellenausschreibung und in der Eingangsbestätigung, dass ein KI-System die Unterlagen vorsortiert und eine Person entscheidet; Recht auf Erläuterung.'],
  };
  for (const [id, [frei, prot, nutzer]] of Object.entries(info)) {
    const s = sys(id);
    s.aiAct.gpai = false;
    if (frei) s.freigabe = { von: frei[0], am: frei[1] };
    s.protokollierung = prot;
    s.nutzerinformation = nutzer;
    s.aufsicht = AUFSICHT_MUSTER[id];
  }
  // Nachtrainieren und Modelländerungen (D-12): Systeme mit eigenem Training oder eigenem Modell
  sys('KI-001').aenderungsregel = 'Nachtrainieren nur durch die QS mit Formular QS-F-118: Bildsatz mit Labelprüfung, Test gegen das Testset mit 3 000 Bildern, Vergleich der Erkennungsrate je Fehlerklasse, Freigabe durch die Leiterin Qualität, Ablage der Modellversion. Nach jedem Nachtraining beurteilt der Eigner die Risiken des Systems neu (D-07). Wesentlich ist eine Änderung, wenn Prüfmerkmale, Teilefamilien oder Schwellenwerte geändert werden oder die Erkennungsrate im Testset um mehr als 2 Prozentpunkte sinkt; dann folgt zusätzlich eine neue Kurzprüfung (D-09).';
  sys('KI-002').aenderungsregel = 'Jedes Release mit neuem Modellstand nach dem Entwicklungsprozess (Abschnitt 10): Validierung gegen Prüfstanddaten, Validierungsbericht, Freigabe durch Entwicklung und Produktmanagement. Neue Bauteile, Fernsteuerungsfunktionen oder Sicherheitsbezug gelten als wesentlich (neue Folgenabschätzung und Einstufung).';
  sys('KI-003').aenderungsregel = 'Neuer Modellstand nur nach Validierung gegen die letzten 12 Monate im Modellregister (M-012) und Freigabe durch die Leiterin Supply Chain; neue Datenquellen gelten als wesentlich.';
  // Einstufung KI-002 nach der Berichtigung zu Art. 6(1b) erneut geprüft
  sys('KI-002').aiAct.eingestuft = { von: 'P-002', am: '2026-10-20' };

  // Folgenabschätzungen: wer die Kurzprüfung gemacht hat, Bezug zur DSFA, Gesellschaft, FRIA
  const gesellschaft: Record<string, string> = {
    'KI-002': 'Weniger Stillstände und Ersatzteilverbrauch bei Kunden senken Ressourcenverbrauch; falsche Sicherheit bei Wartung könnte das Vertrauen in Maschinensicherheit schwächen.',
    'KI-006': 'Leichterer Zugang zu Ersatzteilinformationen rund um die Uhr; kein Einfluss auf Rechte Dritter. Kunden ohne Portalzugang behalten den Kundendienst.',
    'KI-007': 'Keine Wirkung über die Kunden und deren Personal hinaus; korrekte Warnhinweise schützen Bediener in allen Sprachen.',
    'KI-008': 'Verzerrte Vorselektion könnte Gruppen am Arbeitsmarkt benachteiligen; deshalb Funktion bis zum Nachweis der Bias-Tests deaktiviert.',
  };
  // Durchführung durch die Eigner/in des Systems (D-08), Freigabe durch AIMS-Verantwortliche oder GL: nie dieselbe Person
  const kurzpruefung: Record<string, [string, string]> = {
    'IA-001': ['P-006', '2026-10-06'], 'IA-002': ['P-004', '2026-10-01'], 'IA-003': ['P-007', '2026-10-06'], 'IA-004': ['P-003', '2026-10-06'],
    'IA-005': ['P-004', '2026-10-06'], 'IA-006': ['P-008', '2026-10-01'], 'IA-007': ['P-004', '2026-10-01'], 'IA-008': ['P-005', '2026-10-01'],
  };
  // Ausmass des verbleibenden Schadens je Ziel (1 gering bis 4 schwer, Skala D-06) in den vollständigen Abschätzungen
  const ausmass: Record<string, Partial<Record<NutzenSchadenZiel, number>>> = {
    'IA-002': { rechenschaft: 2, transparenz: 2, fairness: 1, datenschutz: 1, zuverlaessigkeit: 2, sicherheit: 2, erklaerbarkeit: 1, umwelt: 1 },
    'IA-006': { rechenschaft: 2, transparenz: 1, fairness: 2, datenschutz: 1, zuverlaessigkeit: 2, sicherheit: 2, erklaerbarkeit: 1, umwelt: 1 },
    'IA-007': { rechenschaft: 2, transparenz: 2, fairness: 2, datenschutz: 1, zuverlaessigkeit: 2, sicherheit: 3, erklaerbarkeit: 1, umwelt: 1 },
    'IA-008': { rechenschaft: 2, transparenz: 3, fairness: 4, datenschutz: 3, zuverlaessigkeit: 3, sicherheit: 1, erklaerbarkeit: 3, umwelt: 1 },
  };
  for (const f of p.folgenabschaetzungen) {
    [f.triage.durch, f.triage.am] = kurzpruefung[f.id]!;
    for (const [ziel, wert] of Object.entries(ausmass[f.id] ?? {})) f.nutzenSchaden[ziel as NutzenSchadenZiel]!.ausmass = wert;
    if (!f.verknuepfteDsfa) f.verknuepfteDsfa = sys(f.kiSystem).personendaten ? 'Keine DSFA nötig (Prüfung im Datenschutzverzeichnis)' : 'keine (keine Personendaten)';
    if (gesellschaft[f.kiSystem]) f.gesellschaft = gesellschaft[f.kiSystem];
    if (f.kiSystem === 'KI-008') {
      f.fria = {
        erforderlich: 'nein',
        begruendung: 'Private Arbeitgeberin, keine öffentlichen Dienste, kein Fall nach Anhang III Nr. 5 Bst. b oder c; Art. 27 gilt nicht. Die Folgen für Bewerbende sind in IA-008 und DSFA-2026-04 abgeschätzt.',
        durch: 'P-009',
        am: '2026-10-27',
      };
    }
  }

  // Ziele: Bezug zur Leitlinie, Massnahmen, Status, Messplan
  const ziele: Record<string, { bezug: string; was: string; status: 'geplant' | 'in-arbeit' | 'erreicht'; misst: string; wann: string; wertet: string; an: string }> = {
    'Z-001': { bezug: 'Grundsatz 2 (festgelegte Zwecke)', was: 'Inventar mit Lizenzliste abgleichen, Fragebogen jährlich, Freigabeprozess für neue Werkzeuge', status: 'erreicht', misst: 'P-003', wann: 'nach jeder Messung', wertet: 'P-002', an: 'AIMS-Team, Managementbewertung' },
    'Z-002': { bezug: 'Grundsatz 4 (vertrauliche Daten)', was: 'E-Learning KI-Kompetenz, Erinnerung an Säumige, Freischaltung neuer Lizenzen erst nach Schulung (seit 01.12.2026)', status: 'erreicht', misst: 'P-005', wann: 'monatlich', wertet: 'P-002', an: 'Geschäftsleitung' },
    'Z-003': { bezug: 'Grundsatz 1 (der Mensch entscheidet)', was: 'Stichproben durch Key-User, Rückmeldung an die Nutzenden, Schulungsinhalt anpassen', status: 'in-arbeit', misst: 'P-002', wann: 'quartalsweise', wertet: 'P-002', an: 'AIMS-Team, Managementbewertung' },
    'Z-004': { bezug: 'Grundsatz 6 (Lebenszyklus mit Überwachung)', was: 'Monatliche Auswertung, Nachtraining nur nach Freigabe (D-12), Fehlerklassen ergänzen', status: 'in-arbeit', misst: 'P-006', wann: 'monatlich', wertet: 'P-002', an: 'Leitung Produktion, Geschäftsleitung' },
    'Z-005': { bezug: 'Grundsatz 3 (Information der Kunden)', was: 'Testkatalog vor jedem Release, Stichprobe und Korrektur der Wissensquelle', status: 'in-arbeit', misst: 'P-008', wann: 'monatlich', wertet: 'P-002', an: 'Leitung Kundendienst, Geschäftsleitung' },
    'Z-006': { bezug: 'Grundsatz 8 (Freigabeprozess)', was: 'Meldung neuer Werkzeuge, Bewertung im AIMS-Team innert 30 Tagen', status: 'erreicht', misst: 'P-003', wann: 'quartalsweise', wertet: 'P-002', an: 'AIMS-Team' },
    'Z-007': { bezug: 'Grundsatz 6 (Lebenszyklus mit Tests, Freigabe und Überwachung)', was: 'Validierung je Release gegen die Ziele aus D-12, Freigabe erst mit Validierungsbericht', status: 'in-arbeit', misst: 'P-004', wann: 'quartalsweise', wertet: 'P-002', an: 'AIMS-Team, Managementbewertung' },
    'Z-008': { bezug: 'Grundsatz 7 (Gesetze einhalten, Maschinenverordnung)', was: 'Fachprüfung jeder Übersetzung (EC-02), Ablösung von KI-007 durch L-006 (M-018)', status: 'in-arbeit', misst: 'P-004', wann: 'monatlich', wertet: 'P-002', an: 'AIMS-Team, Managementbewertung' },
    'Z-009': { bezug: 'Grundsatz 5 (Menschen fair behandeln)', was: 'Bias-Test mit dem Lieferanten vor der Wiederinbetriebnahme, Sortierhilfe ohne Schwellenwert, Stichprobe durch die Leiterin Personal (M-019)', status: 'geplant', misst: 'P-005', wann: 'nach jeder Messung', wertet: 'P-002', an: 'Geschäftsleitung' },
  };
  const soll: Record<string, ('ja' | 'teilweise' | 'nein')[]> = {
    'Z-001': ['nein', 'ja', 'ja'], 'Z-002': ['nein', 'nein', 'ja'], 'Z-003': ['ja'], 'Z-004': ['ja', 'ja', 'ja'], 'Z-005': ['ja', 'nein', 'ja', 'ja'], 'Z-006': ['ja', 'ja'], 'Z-007': ['ja'], 'Z-008': ['ja'], 'Z-009': [],
  };
  for (const z of p.ziele) {
    const d = ziele[z.id]!;
    Object.assign(z, { bezugLeitlinie: d.bezug, massnahmen: d.was, status: d.status, werMisst: d.misst, auswertungWann: d.wann, werWertetAus: d.wertet, empfaenger: d.an });
    z.messungen.forEach((m, i) => (m.sollErreicht = soll[z.id]![i]));
  }

  // Audits
  const au1 = p.audits.find((a) => a.id === 'AU-001')!;
  Object.assign(au1, {
    ziel: 'Bereitschaft für Stage 1 prüfen und Wirksamkeit des AIMS im Verbund mit dem ISMS bestätigen',
    ort: 'Hauptsitz Ostschweiz und Büro Süddeutschland (remote)',
    methode: 'Interviews, Dokumentprüfung, Vorführung am System; Stichprobe KI-001, KI-002, KI-006 und KI-008',
    berichtAn: 'Geschäftsleitung, AIMS-Verantwortliche, Informationssicherheitsbeauftragter',
    umfangControls: [],
    auditierte: 'Daniel Keller (CEO), Sandra Brunner (AIMS), Marco Huber (IT), Lukas Meier (Entwicklung), Petra Widmer (Personal), Thomas Gerber (Produktion), Claudia Frei (Supply Chain, Einkauf), Stefan Ammann (Kundendienst), Nina Roth (Datenschutz, Recht), fünf Mitarbeitende in Fertigung und Kundendienst',
    agenda: 'Eröffnung, Interviews je Bereich, Systemvorführungen, Abschlussbesprechung',
  });
  for (const a of p.audits.filter((x) => x.art !== 'intern')) Object.assign(a, { berichtAn: 'Geschäftsleitung, AIMS-Verantwortliche', methode: 'nach Auditplan der Zertifizierungsstelle' });

  // Feststellungen
  const fs: Record<string, { kiSystem?: string; bereich: string; methode?: string; aehnlich?: string; risiko?: boolean }> = {
    'F-001': { kiSystem: 'KI-001', bereich: 'Fertigung, Qualitätsprüfung Linie 3', methode: '5 Warum', aehnlich: 'Geprüft: Nachtrainings bei KI-002 und KI-003 liefen nach D-12 mit Freigabe; kein weiterer Fall.', risiko: true },
    'F-002': { kiSystem: 'KI-008', bereich: 'Personal, Lieferantenmanagement', methode: '5 Warum', aehnlich: 'Release Notes aller SaaS-Dienste seit Juli 2026 geprüft: kein weiterer Fall. Ähnliches Risiko beim Kameralieferanten erkannt und als R-024 erfasst.', risiko: true },
    'F-003': { bereich: 'AIMS, Ziele und Messung', methode: '5 Warum', aehnlich: 'Messpläne aller Ziele geprüft: Z-009 ohne Messwert ist begründet (Funktion ausgesetzt); kein weiterer Fall.', risiko: false },
    'F-004': { bereich: 'EU AI Act, Rollen und Einstufungen' },
  };
  for (const f of p.feststellungen) {
    const d = fs[f.id];
    if (!d) continue;
    f.datum = '2027-01-20';
    if (d.kiSystem) f.kiSystem = d.kiSystem;
    f.bereich = d.bereich;
    if (d.methode) f.ursacheMethode = d.methode;
    if (d.aehnlich) f.aehnlicheFaelle = d.aehnlich;
    if (d.risiko !== undefined) f.risikoAngepasst = d.risiko;
  }

  // Managementbewertung
  const mb = p.managementbewertungen[0]!;
  Object.assign(mb, {
    ort: 'Sitzungszimmer Hauptsitz, Geschäftsführer DE online',
    leitung: 'P-001',
    zeitraum: { von: '2026-08-04', bis: '2027-01-31' },
    gesamtbeurteilung: {
      geeignet: { urteil: 'ja', begruendung: 'Das AIMS deckt alle KI-Systeme und beide Gesellschaften ab und passt zu den Zielen.' },
      angemessen: { urteil: 'ja', begruendung: 'Aufwand und Ressourcen stehen im Verhältnis zum KI-Einsatz; Ergänzungsblätter vermeiden Doppelspurigkeiten mit dem ISMS.' },
      wirksam: { urteil: 'ja', begruendung: 'Ziele im Soll, F-001 korrigiert mit Wirksamkeitsprüfung bis 30.04.2027, F-002 in Behebung, keine schweren Vorfälle.' },
    },
    entscheideListe: [
      { art: 'verbesserung', text: 'Funktionsscan der SaaS-Dienste halbjährlich festschreiben', verantwortlich: 'P-003', termin: '2027-03-31', massnahme: 'M-027' },
      { art: 'ressourcen', text: 'CHF 15 000 für die rechtliche Prüfung der Wartungsfunktion 3.0 nach der Maschinenverordnung bewilligt', verantwortlich: 'P-004', termin: '2027-09-30', massnahme: 'M-024' },
      { art: 'restrisiko', text: 'Restrisiken R-019 und R-020 nur für den deaktivierten Zustand angenommen; neue Beurteilung vor der Wiederinbetriebnahme', verantwortlich: 'P-005', termin: '2027-09-30', massnahme: 'M-019' },
      { art: 'verbesserung', text: 'AI-Act-Stand vor Stage 1 aktualisieren', verantwortlich: 'P-009', termin: '2027-02-19', massnahme: 'M-028' },
      { art: 'verbesserung', text: 'Schatten-KI-Fälle als Vorfälle F-006 und F-007 nachtragen, Vorfälle sofort erfassen', verantwortlich: 'P-003', termin: '2027-03-31', massnahme: 'M-036' },
    ],
  });

  // Lieferanten: Stand der Vertragsklauseln VK-01 bis VK-12
  const klauseln: Record<string, KlauselStand[]> = {
    'L-001': ['ja', 'ja', 'ja', 'nein', 'nein', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja'],
    'L-002': ['ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja'],
    'L-003': ['ja', 'nein', 'ja', 'ja', 'offen', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja'],
    'L-004': ['ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'offen'],
    'L-005': ['ja', 'ja', 'ja', 'ja', 'nein', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja'],
    'L-006': ['ja', 'ja', 'offen', 'offen', 'ja', 'offen', 'ja', 'ja', 'ja', 'offen', 'ja', 'ja'],
    'L-007': ['nein', 'nein', 'nein', 'nein', 'nein', 'nein', 'nein', 'nein', 'nein', 'nein', 'nein', 'nein'],
  };
  for (const l of p.lieferanten) l.vertragsklauseln = vk(klauseln[l.id]!);
  // Prüfung je Lieferant mit Person und Datum (L-006 ist noch in Prüfung)
  // L-002 nach dem Beinahe-Vorfall F-005 erneut geprüft (Regel in D-16-EB: zusätzlich nach einem Vorfall)
  const geprueft: Record<string, string> = { 'L-001': '2026-12-08', 'L-002': '2027-01-28', 'L-003': '2026-12-08', 'L-004': '2026-12-08', 'L-005': '2027-01-20', 'L-007': '2026-12-08' };
  for (const l of p.lieferanten) if (geprueft[l.id]) l.geprueft = { von: 'P-007', am: geprueft[l.id]! };
  p.lieferanten.find((l) => l.id === 'L-004')!.verantwortung = 'Modellwahl und Systemprompt liegen bei uns; Betrieb, Sicherheit und Modellpflege beim Anbieter.';
  p.lieferanten.find((l) => l.id === 'L-001')!.verantwortung = 'Das Grundmodell entwickelt und pflegt der Lieferant; Nachtrainieren mit eigenen Bildern, Test gegen das Testset und Freigabe liegen bei unserer QS.';
  p.lieferanten.find((l) => l.id === 'L-007')!.verantwortung = 'Kein Vertrag: Der Dienst übernimmt keine Pflichten. Auswahl der Texte, Fachprüfung und Freigabe jeder Übersetzung liegen bei der Technischen Redaktion (EC-02).';
  p.lieferanten.find((l) => l.id === 'L-005')!.verantwortung = 'Konfiguration (Schwellenwert, ausgeblendete Felder) und Aktivierung der Funktion liegen bei unserer Personalabteilung; Modell, Bias-Tests und Betriebsanleitung beim Lieferanten.';

  // Bewusstsein (D-17) und Dokumente externer Herkunft (D-26)
  o.bewusstsein = [
    { thema: 'KI-Leitlinie', inhalt: 'Grundsätze für KI und Ablage der Leitlinie (D-03)', zielgruppe: 'alle Mitarbeitenden', kanal: 'Intranet, Teamsitzungen', datum: '2026-09-07', nachweis: 'Intranet-Meldung und Teamprotokolle (KO-001)' },
    { thema: 'Eigener Beitrag', inhalt: 'Regeln einhalten, Ergebnisse prüfen, Probleme melden', zielgruppe: 'alle Mitarbeitenden', kanal: 'E-Learning KI-Kompetenz', datum: '2026-12-15', nachweis: 'Export der Lernplattform, N-030' },
    { thema: 'Folgen bei Abweichung', inhalt: 'Folgen für Kunden, Betroffene und das Unternehmen sowie arbeitsrechtliche Folgen', zielgruppe: 'alle Mitarbeitenden', kanal: 'E-Learning KI-Kompetenz, D-15-EB', datum: '2026-12-15', nachweis: 'Export der Lernplattform, N-030' },
    { thema: 'Nutzungsrichtlinie', inhalt: 'Ampel, Datenklassen, Exportkontrolle, neue Werkzeuge beantragen (D-15-EB)', zielgruppe: 'Nutzende von KI-Werkzeugen', kanal: 'E-Learning mit Bestätigung', datum: '2026-11-30', nachweis: 'Bestätigungen der Nutzenden, N-024' },
    { thema: 'Meldewege', inhalt: 'Wohin Bedenken, Fehler und Vorfälle gehen (D-04-EB, D-14-EB)', zielgruppe: 'alle Mitarbeitenden', kanal: 'Intranet, Aushang in Werk und Büro', datum: '2026-09-07', nachweis: 'Intranetseite «Melden», N-005' },
  ];
  const NORMEN = 'SharePoint ISMS/AIMS > 99_Extern > Normen';
  const RECHT = 'SharePoint ISMS/AIMS > 99_Extern > Recht';
  o.dokumentenlenkung!.externeDokumente = [
    { dokument: 'ISO/IEC 42001', herausgeber: 'ISO, SNV', stand: '2023', ablage: NORMEN, zustaendig: 'P-002', naechstePruefung: '2027-06-30' },
    { dokument: 'ISO/IEC 27001', herausgeber: 'ISO, SNV', stand: '2022 mit Amd 1:2024', ablage: NORMEN, zustaendig: 'P-003', naechstePruefung: '2027-06-30' },
    { dokument: 'ISO/IEC 42005 (Folgenabschätzung)', herausgeber: 'ISO, SNV', stand: '2025', ablage: NORMEN, zustaendig: 'P-002', naechstePruefung: '2027-06-30' },
    { dokument: 'EU AI Act, Verordnung (EU) 2024/1689', herausgeber: 'EUR-Lex', stand: 'konsolidierte Fassung vom 27.07.2026 mit Berichtigung vom 29.09.2026', ablage: RECHT, zustaendig: 'P-009', naechstePruefung: '2027-02-19' },
    { dokument: 'Maschinenverordnung (EU) 2023/1230', herausgeber: 'EUR-Lex', stand: 'ABl. L 165 vom 29.6.2023', ablage: RECHT, zustaendig: 'P-004', naechstePruefung: '2027-09-30' },
    { dokument: 'Datenschutzgesetz (DSG) und DSGVO', herausgeber: 'Bund, EU', stand: 'DSG in Kraft seit 1.9.2023, DSGVO 2016/679', ablage: RECHT, zustaendig: 'P-009', naechstePruefung: '2027-06-30' },
    { dokument: 'Dokumentation und Nutzungsbedingungen der KI-Lieferanten L-001 bis L-007', herausgeber: 'Lieferanten (D-16-EB)', stand: 'Stand je Lieferant im Prüfprotokoll N-026', ablage: 'SharePoint ISMS/AIMS > ISMS > Lieferanten', zustaendig: 'P-007', naechstePruefung: '2027-05-31' },
    { dokument: 'Kundenverträge mit Anforderungen zu KI', herausgeber: 'Kunden', stand: 'Stand je Vertrag, Liste N-050', ablage: 'Vertragsdatenbank', zustaendig: 'P-002', naechstePruefung: '2027-06-30' },
  ];

  // Dokumentenregister: Klassifikation, Aufbewahrung, ISMS-Dokument der Ergänzungsblätter.
  // D-07 im Pfad mit ISMS: ein Eintrag D-07-EB (Register mit Behandlungsplan, im ISMS-Risikoregister geführt).
  const d07 = p.dokumente.find((d) => d.id === 'D-07')!;
  p.dokumente = p.dokumente.filter((d) => d.id !== 'D-07');
  Object.assign(p.dokumente.find((d) => d.id === 'D-07-EB')!, { version: d07.version, eigner: d07.eigner, freigabe: d07.freigabe, naechsteUeberpruefung: d07.naechsteUeberpruefung });
  const aufgenommen: Record<string, string> = {
    'D-01': 'ISMS-Kontextanalyse KA-ISMS-01, Version 3.2',
    'D-02': 'Geltungsbereich ISMS GB-ISMS-01, Version 2.0',
    'D-05': 'ISMS-Ziele und Kennzahlen ZK-ISMS-01, Version 2.1',
    'E-04': 'Schulungskonzept ISMS SK-ISMS-01, Version 1.4',
    'D-03-EB': 'Informationssicherheitsleitlinie IS-LL-01, Version 5.0',
    'D-04-EB': 'Organisationshandbuch ISMS OH-ISMS-01, Kapitel 3 Rollen, Version 4.1',
    'D-06-EB': 'Risikoverfahren VA-ISMS-04, Version 3.0',
    'D-07-EB': 'ISMS-Risikoregister RR-ISMS-01, Version 4.2',
    'D-10-EB': 'Inventar der Informationswerte INV-ISMS-01, Version 2.3',
    'D-14-EB': 'Vorfallverfahren VA-ISMS-07, Version 2.1',
    'D-15-EB': 'Richtlinie IT-Nutzung RL-IT-03, Version 6.0',
    'D-16-EB': 'Lieferantenmanagement VA-ISMS-09, Version 2.0',
    'D-17-EB': 'Schulungskonzept ISMS SK-ISMS-01, Version 1.4',
    'D-20-EB': 'Auditprogramm ISMS und QM AP-ISMS-2027, Version 1.0',
    'D-21-EB': 'Managementbewertung ISMS MB-ISMS-01, Vorlage Version 2.0',
    'D-22-EB': 'Korrekturmassnahmen VA-QM-11, Version 3.1',
    'D-26-EB': 'Dokumentenlenkung VA-ISMS-02, Version 3.3',
  };
  for (const d of p.dokumente) {
    if (aufgenommen[d.id]) d.aufgenommenIn = aufgenommen[d.id];
    if (d.id === 'D-03') d.klassifikation = 'öffentlich';
    else if (['D-07-EB', 'D-09', 'E-06'].includes(d.id)) d.klassifikation = 'vertraulich';
    d.aufbewahrung = d.id.startsWith('E-') || d.id === 'D-09' ? '10 Jahre nach Ausserbetriebnahme des Systems' : '10 Jahre nach Ersatz';
  }
  dokumentenHistorie(p, HISTORIE_MUSTER, PRUEFUNG_MUSTER);
  // In der Managementbewertung MB-001 ohne Änderung bestätigt (Verweise auf die inzwischen freigegebenen Dokumente gelten)
  for (const id of ['D-03', 'D-06-EB', 'D-08', 'D-14-EB', 'D-15-EB']) p.dokumente.find((d) => d.id === id)!.bestaetigt = { von: 'P-001', am: '2027-02-02' };

  // Risiken: Datum der letzten Beurteilung (Risikoworkshops Oktober 2026, Neubeurteilungen danach)
  // KI-006 nach Kennzeichnung und Penetrationstest (23.10.2026), KI-002 mit Release 2.1 (10.11.2026), KI-001 nach den
  // Nachtrainings und F-001 (28.01.2027); R-030 bis R-032 mit der Managementbewertung
  const beurteilt: Record<string, string> = {
    'R-014': '2026-10-23', 'R-015': '2026-10-23', 'R-016': '2026-10-23',
    'R-008': '2026-11-10', 'R-009': '2026-11-10', 'R-010': '2026-11-10', 'R-011': '2026-11-10', 'R-021': '2026-11-10',
    'R-005': '2027-01-28', 'R-006': '2027-01-28', 'R-007': '2027-01-28', 'R-022': '2027-01-28', 'R-024': '2027-01-28',
    'R-025': '2027-01-20', 'R-026': '2027-01-20', 'R-027': '2027-01-27', 'R-028': '2027-01-27', 'R-029': '2027-01-27',
    'R-030': '2027-02-02', 'R-031': '2027-02-02', 'R-032': '2027-02-02',
  };
  for (const r of p.risiken) r.beurteiltAm = beurteilt[r.id] ?? '2026-10-06';
  // Erfassung im Register: Risikoworkshops, internes Audit, Beinahe-Vorfall F-005, Managementbewertung
  const erfasstRisiko = (id: string) => (id >= 'R-030' ? '2027-02-02' : id >= 'R-027' ? '2027-01-27' : id >= 'R-024' ? '2027-01-20' : '2026-10-06');
  for (const r of p.risiken) r.erfasstAm = erfasstRisiko(r.id);
  // Massnahmen: Erfassung in der Reihenfolge der IDs (Gap-Analyse, Risikoworkshops, internes Audit)
  const erfasst: Record<string, string> = { pruefung: '2026-08-04', risiko: '2026-10-06', aiact: '2026-10-06', audit: '2027-01-20' };
  // Ausnahmen: Neubeurteilung nach dem Beinahe-Vorfall F-005 (27.01.2027) und Massnahmen aus dem Profil N-01 (02.02.2027)
  const erfasstId: Record<string, string> = { 'M-029': '2027-01-27', 'M-030': '2027-01-27', 'M-031': '2027-01-27', 'M-032': '2027-02-02', 'M-033': '2027-02-02', 'M-034': '2027-02-02', 'M-035': '2027-02-02', 'M-036': '2027-02-02' };
  for (const m of p.massnahmen) m.erfasstAm = erfasstId[m.id] ?? erfasst[m.herkunft.art] ?? '2026-10-06';
  p.massnahmen.sort((a, b) => a.id.localeCompare(b.id, 'de', { numeric: true }));

  // Antworten, die jetzt ein eigenes Feld haben, entfernen
  const a = p.meta.gefuehrt.antworten as Record<string, unknown>;
  for (const k of ['projekt', 'gap', 'meldeweg', 'meldekanal', 'lenkung', 'oeffentlicheDienste', 'protokolle']) delete a[k];
  const ll = a['leitlinie'] as Record<string, unknown>;
  delete ll['bezug'];
  delete ll['bezugNotiz'];
}

/** Ist-Beschreibung je Normabschnitt und Control zum Datum der Gap-Analyse (Muster Maschinenbau AG, mit ISMS) */
const GAP_IST_MUSTER: Record<string, string> = {
  'K-4.1': 'ISMS-Kontextanalyse Version 3.2 ohne KI-Themen; KI-Einsatz und Rollen nach AI Act nicht erhoben',
  'K-4.2': 'Interessierte Parteien im ISMS erfasst; Anforderungen zu KI von Kunden, Betriebsrat und Behörden fehlen',
  'K-4.3': 'Geltungsbereich des ISMS festgelegt; KI-Systeme und KI in Produkten nicht abgegrenzt',
  'K-4.4': 'ISMS-Prozesse im Organisationshandbuch 4.1 beschrieben; keine KI-Prozesse',
  'K-5.1': 'Geschäftsleitung trägt das ISMS; Auftrag für das AIMS mit diesem Projektauftrag',
  'K-5.2': 'ISMS-Leitlinie IS-LL-01 ohne Aussagen zu KI',
  'K-5.3': 'ISMS-Rollen festgelegt; keine KI-Rollen und keine AIMS-Verantwortung',
  'K-6.1.1': 'Risikomanagement nach VA-ISMS-04 für die Informationssicherheit',
  'K-6.1.2': 'Risikobeurteilung nach VA-ISMS-04 ohne KI-spezifische Risikoquellen',
  'K-6.1.3': 'Risikobehandlung und SoA nach ISO/IEC 27001; keine KI-Controls',
  'K-6.1.4': 'Keine Folgenabschätzung für KI; Datenschutz-Folgenabschätzungen nach Datenschutzrecht',
  'K-6.2': 'Ziele des ISMS vorhanden; keine KI-Ziele',
  'K-6.3': 'Änderungen am ISMS über den Änderungsprozess',
  'K-7.1': 'Ressourcen für das ISMS geplant; Pensum für das AIMS im Projektauftrag',
  'K-7.2': 'Kompetenzen im Schulungskonzept ISMS 1.4; KI-Kompetenz nicht erfasst',
  'K-7.3': 'Awareness-Programm zur Informationssicherheit; KI kein Thema',
  'K-7.4': 'Kommunikationsplan des ISMS ohne KI-Inhalte',
  'K-7.5': 'Dokumentenlenkung nach VA-ISMS-02',
  'K-8.1': 'Betrieb nach den ISMS-Verfahren; KI-Systeme nicht gesteuert',
  'K-8.2': 'Jährliche Risikobeurteilung im Betrieb für die Informationssicherheit',
  'K-8.3': 'Behandlungsplan des ISMS ohne KI-Massnahmen',
  'K-8.4': 'Keine Folgenabschätzungen im Betrieb',
  'K-9.1': 'Kennzahlen des ISMS; keine Messung zu KI',
  'K-9.2': 'Kombiniertes internes Audit ISO 9001 und ISO/IEC 27001',
  'K-9.3': 'Managementbewertung ISMS jährlich',
  'K-10.1': 'Verbesserungsprozess in QM und ISMS',
  'K-10.2': 'Korrekturmassnahmen nach VA-QM-11',
  'A.2.2': 'Keine KI-Leitlinie; ISMS-Leitlinie ohne KI',
  'A.2.3': 'Richtlinien von ISMS, QM und Personal ohne Bezug zu KI',
  'A.2.4': 'Jährliche Überprüfung der ISMS-Leitlinie; KI nicht einbezogen',
  'A.3.2': 'ISMS-Rollen; keine KI-Rollen',
  'A.3.3': 'Hinweisgebersystem des ISMS; Bedenken zu KI nicht ausdrücklich vorgesehen',
  'A.4.2': 'Inventar der Informationswerte im ISMS, KI noch nicht gekennzeichnet',
  'A.4.3': 'Datenklassifikation im ISMS; Daten der KI-Systeme nicht erfasst',
  'A.4.4': 'Software im Asset-Inventar; Modelle und Modellversionen nicht erfasst',
  'A.4.5': 'Server und Cloud-Dienste im Asset-Inventar',
  'A.4.6': 'Personal je Bereich bekannt; Kompetenzen zu KI nicht erfasst',
  'A.5.2': 'Keine Folgenabschätzung für KI-Systeme',
  'A.5.3': 'Keine dokumentierten Folgenabschätzungen',
  'A.5.4': 'Wirkung auf Bewerbende und Kunden nicht beurteilt',
  'A.5.5': 'Gesellschaftliche Wirkungen nicht beurteilt',
  'A.6.1.2': 'Entwicklungsziele für Maschinensoftware ohne Grundsätze zu KI',
  'A.6.1.3': 'Entwicklungsprozess für Maschinensoftware; KI-Modelle ohne eigene Freigaben',
  'A.6.2.2': 'Lastenhefte für Maschinensoftware; Anforderungen an KI-Funktionen teilweise',
  'A.6.2.3': 'Entwurfsdokumentation im Wiki, ohne Modellstände',
  'A.6.2.4': 'Tests der Maschinensoftware; Validierung der Modelle nicht festgelegt',
  'A.6.2.5': 'Änderungsprozess des ISMS für Software, nicht für KI-Modelle',
  'A.6.2.6': 'Betriebsüberwachung der IT; Drift und Antwortqualität nicht überwacht',
  'A.6.2.7': 'Betriebsanleitungen ohne Kapitel zu KI-Funktionen',
  'A.6.2.8': 'Protokollierung nach ISMS; Protokolle der KI-Systeme nicht festgelegt',
  'A.7.2': 'Trainingsdaten in der Entwicklung ohne festgelegtes Verfahren',
  'A.7.3': 'Herkunft der Trainingsdaten nicht dokumentiert',
  'A.7.4': 'Datenqualität nicht gemessen',
  'A.7.5': 'Datenstände nicht versioniert',
  'A.7.6': 'Aufbereitung der Daten je Projekt, nicht festgehalten',
  'A.8.2': 'Keine Information der Nutzenden über KI',
  'A.8.3': 'Kontaktformular im Kundenportal ohne Bezug zu KI',
  'A.8.4': 'Vorfallverfahren VA-ISMS-07 ohne KI-Vorfälle',
  'A.8.5': 'Informationspflichten aus Kundenverträgen nicht zusammengestellt',
  'A.9.2': 'Richtlinie IT-Nutzung ohne Regeln zu KI-Werkzeugen',
  'A.9.3': 'Keine Regeln zur Prüfung von KI-Ergebnissen',
  'A.9.4': 'Zweck der KI-Werkzeuge nicht festgelegt',
  'A.10.2': 'Verantwortung in Lieferantenverträgen nur für die Informationssicherheit geregelt',
  'A.10.3': 'Lieferantenbewertung im ISMS ohne KI-Fragen',
  'A.10.4': 'Kundenanforderungen im QM; Erwartungen an KI nicht erfasst',
};

/** Menschliche Aufsicht je KI-System (D-10, Spalte «wer prüft») */
const AUFSICHT_MUSTER: Record<string, string> = {
  'KI-001': 'QS-Fachpersonen prüfen jedes ausgeschleuste Teil an der Prüfstation; die Schichtleitung entscheidet bei Störungen; Modellversionen gibt die Leiterin Qualität frei (QS-F-118), nicht der Eigner des Systems.',
  'KI-002': 'Das Instandhaltungspersonal des Kunden entscheidet über Wartungseinsätze; bei uns überwacht die Entwicklung die Rückmeldungen (Drift-Monitoring) und gibt jedes Release frei.',
  'KI-003': 'Das Planungsteam prüft jede Prognose vor der Übernahme in die Grobplanung; die Data Scientist validiert jeden Modellstand.',
  'KI-004': 'Die Nutzenden prüfen jedes Ergebnis vor der Verwendung; Key-User ziehen quartalsweise Stichproben (Z-003).',
  'KI-005': 'Die Nutzenden prüfen jedes Ergebnis vor der Verwendung; Key-User ziehen quartalsweise Stichproben (Z-003).',
  'KI-006': 'Der Kundendienst prüft monatlich 50 Gespräche und übernimmt weitergeleitete Anfragen; der Produktverantwortliche gibt jedes Release nach dem Testkatalog frei, der eine Gruppe Missbrauch mit 15 Fällen je Sprache enthält.',
  'KI-007': 'Fachprüfung jeder Übersetzung vor der Übernahme ins Redaktionssystem, intern oder durch beauftragte Fachübersetzer.',
  'KI-008': 'Vor der Wiederinbetriebnahme: Sichtung jeder Bewerbung durch eine geschulte Recruiterin (K-001), halbjährliche Stichprobe durch die Leiterin Personal. Zurzeit prüft die Personalabteilung nach jedem Release, ob die Funktion ausgeschaltet bleibt.',
};

type Version = [version: string, datum: string, was: string, von?: string];
/** Änderungshistorie je Dokument (DokumentEintrag.aenderungen); ohne Angabe gibt die Person der aktuellen Freigabe frei */
const HISTORIE_MUSTER: Record<string, Version[]> = {
  'D-01': [['1.0', '2026-09-01', 'Erstfassung'], ['1.1', '2027-02-02', 'Änderungen aus der Managementbewertung MB-001: Maschinenverordnung anwendbar, Anforderungen von Betriebsrat und Grosskunden, Funktionsscan der SaaS-Dienste (M-027)']],
  'D-02': [['1.0', '2026-09-01', 'Erstfassung'], ['1.1', '2026-11-24', 'Ausgelagerte Tätigkeiten mit den Lieferanten L-001 bis L-007 und ihrem Prüfstand ergänzt'], ['1.2', '2027-02-02', 'Prüfstand der Lieferanten nach der Lieferantenprüfung (D-16-EB) und Verweise auf die inzwischen freigegebenen Dokumente nachgeführt (MB-001)']],
  'D-03': [['1.0', '2026-09-01', 'Erstfassung mit Grundsätzen und Risikobereitschaft']],
  'D-04-EB': [['1.0', '2026-09-01', 'Erstfassung'], ['1.1', '2027-02-02', 'Entscheide der Geschäftsleitung im Protokoll oder als Zirkularbeschluss, nächsthöhere Stelle Verwaltungsrat, Vorbehalte der Risikobereitschaft unabhängig von der Risikostufe (MB-001)']],
  'D-05': [['1.0', '2027-01-12', 'Erstfassung mit den Zielen Z-001 bis Z-007 und dem Messplan'], ['1.1', '2027-02-02', 'Messwerte bis 31.01.2027, Wirksamkeit der Controls und Beurteilung der Kennzahlen in der Managementbewertung (KZ-01, KZ-06), Ziele für 2027 bestätigt, Z-008 und Z-009 ergänzt (MB-001)']],
  'D-07-EB': [['1.0', '2026-11-24', 'Erstfassung: Register, Behandlungsplan und Restrisiken'], ['1.1', '2027-02-02', 'Risiken von KI-001 (R-005, R-006, R-007, R-022, R-024) nach den Nachtrainings und Feststellung F-001 neu beurteilt; Risiken R-024 bis R-026 aus dem internen Audit, R-027 bis R-029 nach dem Beinahe-Vorfall F-005 und R-030 bis R-032 aus der Bewertung der Risiken generativer KI (N-04) ergänzt']],
  'D-09-KI-004': [['1.0', '2026-10-13', 'Erstfassung (Kurzprüfung)', 'P-001'], ['1.1', '2027-01-29', 'Neubeurteilung nach dem Beinahe-Vorfall F-005', 'P-001']],
  'D-09-KI-005': [['1.0', '2026-10-13', 'Erstfassung (Kurzprüfung)', 'P-001'], ['1.1', '2027-02-02', 'Neubeurteilung nach der Bewertung der Risiken generativer KI (N-04) und Risiko R-030', 'P-001']],
  'D-09-KI-001': [['1.0', '2026-10-09', 'Erstfassung (Kurzprüfung)', 'P-002'], ['1.1', '2027-01-28', 'Neubeurteilung nach den Nachtrainings vom 20.11.2026 und 27.01.2027 (Feststellung F-001)', 'P-002']],
  'D-10-EB': [
    ['1.0', '2026-09-11', 'Erstfassung: Inventar mit acht Systemen'],
    ['1.1', '2026-10-27', 'Rolle, Einstufung und Freigabe je System nach den Folgenabschätzungen'],
    ['1.2', '2026-11-24', 'Freigabeliste mit Datenklassen und Auflagen, Ressourcen je System'],
    ['1.3', '2027-01-28', 'KI-001 mit Modellversion 3.3, Release der HR-SaaS vom 15.12.2026 bei KI-008 vermerkt (Feststellung F-002)'],
  ],
  'D-11': [['1.0', '2026-11-24', 'Erstfassung mit den Zusatz-Controls EU AI Act und NIST AI RMF'], ['1.1', '2027-02-02', 'Status und Wirksamkeit nach internem Audit, Beinahe-Vorfall F-005 und Managementbewertung nachgeführt (A.2.4, A.5.2, A.6.2.4, A.6.2.5, A.6.2.6, A.10.3, RMF-12, RMF-G04), Risiken R-024 bis R-032']],
  'D-12': [['1.0', '2026-12-08', 'Erstfassung'], ['1.1', '2027-02-02', 'Missbrauchsfälle für Copilot nach dem Beinahe-Vorfall F-005 ergänzt; Abschnitt 8: Neubeurteilung der Risiken nach jedem Nachtraining wie im Risikoverfahren D-06-EB (F-001, M-035)']],
  'D-16-EB': [['1.0', '2026-12-08', 'Erstfassung: Prüfung der Lieferanten L-001 bis L-007'], ['1.1', '2027-01-28', 'L-005 nach dem Release vom 15.12.2026 erneut geprüft (Feststellung F-002), L-002 nach dem Beinahe-Vorfall F-005 erneut geprüft, Stand des Vertrags mit L-006']],
  'D-17-EB': [['1.0', '2026-12-22', 'Erstfassung'], ['1.1', '2027-02-04', 'Schulungsstand Januar 2027 (Z-002), Kompetenz K-003 nach der Korrekturmassnahme M-026']],
  'D-20-EB': [['1.0', '2027-01-12', 'Auditprogramm und Auditplan'], ['1.1', '2027-01-22', 'Checkliste, Ergebnis und Feststellungen des Audits AU-001']],
  'D-22-EB': [['1.0', '2027-01-22', 'Feststellungen aus dem Audit AU-001'], ['1.1', '2027-02-04', 'Beinahe-Vorfall F-005, Schatten-KI-Fälle KI-007 und KI-008 als Vorfälle F-006 und F-007 nachgetragen (MB-001); Ursachen, Korrekturmassnahmen und Stand nach der Managementbewertung']],
  'D-23': [['1.0', '2026-08-07', 'Erstfassung'], ['1.1', '2027-02-04', 'Umsetzung je Abschnitt mit den Ergänzungsblättern und den ISMS-Dokumenten nachgeführt']],
  'D-24': [['1.0', '2026-09-25', 'Erstfassung: Rolle je KI-System'], ['1.1', '2026-10-27', 'Einstufungen nach den Folgenabschätzungen; KI-002 nach der Berichtigung vom 29.09.2026 erneut geprüft']],
  'D-25': [['1.0', '2026-10-09', 'Erstfassung nach der Wahl der Zertifizierungsstelle'], ['1.1', '2027-02-02', 'Stand der Voraussetzungen nach internem Audit und Managementbewertung']],
  'D-26-EB': [['1.0', '2027-01-12', 'Erstfassung'], ['1.1', '2027-02-04', 'Freigaberegel, Prüfung durch eine zweite Person und Änderungshistorie ergänzt']],
  'E-01': [['1.0', '2026-09-25', 'Erstfassung'], ['1.1', '2026-10-27', 'KI-002 nach der Berichtigung vom 29.09.2026 erneut geprüft (20.10.2026)']],
  'E-02': [['1.0', '2026-09-25', 'Erstfassung'], ['1.1', '2026-10-27', 'KI-002 nach der Berichtigung vom 29.09.2026 erneut eingestuft (20.10.2026)']],
  'E-03': [['1.0', '2026-11-24', 'Erstfassung'], ['1.1', '2027-02-02', 'Stand der Pflichten nach internem Audit und Managementbewertung']],
  'E-04': [['1.0', '2026-12-22', 'Erstfassung'], ['1.1', '2027-02-04', 'Schulungsstand Januar 2027']],
  'E-05': [['1.0', '2026-10-27', 'Erstfassung'], ['1.1', '2027-02-02', 'Stand der Betreiberpflichten für KI-008 (N-046)']],
  'E-08': [['1.0', '2026-09-25', 'Erstfassung'], ['1.1', '2026-11-30', 'Betriebsanleitung MX-Predict (N-017) als Nachweis ergänzt']],
  'N-01': [['1.0', '2027-02-02', 'Erstfassung: Ist und Ziel je Subkategorie, Massnahmen M-032 und M-033']],
  'N-02': [['1.0', '2027-02-02', 'Erstfassung: Abdeckung des AI RMF durch das AIMS mit Entscheid je Lücke']],
  'N-03': [['1.0', '2026-12-08', 'Erstfassung'], ['1.1', '2027-02-02', 'Ergebnisse bis Januar 2027, Missbrauchsfälle Copilot nach dem Beinahe-Vorfall F-005']],
  'N-04': [['1.0', '2026-12-08', 'Erstfassung'], ['1.1', '2027-02-02', 'Neubeurteilung nach dem Beinahe-Vorfall F-005 (R-027 bis R-029)']],
};
/** Wer Dokumente vor der Freigabe prüft (zweite Person, nie Eigner/in): bevorzugt in dieser Reihenfolge */
const PRUEFUNG_MUSTER = ['P-003', 'P-002', 'P-009'];

/** ISO-Datum minus Tage */
function tageVorher(iso: string, tage: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - tage);
  return d.toISOString().slice(0, 10);
}

/**
 * Änderungshistorie (aenderungen) und Prüfung durch eine zweite Person (geprueft) je Dokument. Die letzte Zeile der
 * Historie entspricht Version und Freigabe im Register. Prüfung zwei Tage vor der Freigabe durch die erste Person der
 * Liste, die weder Eigner/in noch freigebende Person ist.
 */
export function dokumentenHistorie(p: Projekt, historie: Record<string, Version[]>, pruefer: string[]): void {
  for (const d of p.dokumente) {
    const h = historie[d.id];
    if (h) d.aenderungen = h.map(([version, datum, was, von]) => ({ version, datum, was, von: von ?? d.freigabe?.von ?? d.eigner! }));
    // Folgenabschätzungen D-09-KI-xxx: Freigabe aus der Abschätzung (letzte Neubeurteilung)
    const ia = /^D-09-(KI-\d+)$/.exec(d.id) ? p.folgenabschaetzungen.find((f) => `D-09-${f.kiSystem}` === d.id) : undefined;
    const iaFreigabe = ia ? ([...(ia.neubeurteilungen ?? [])].filter((n) => n.freigabe).at(-1)?.freigabe ?? ia.freigabe) : undefined;
    const am = d.freigabe?.am ?? h?.at(-1)?.[1] ?? iaFreigabe?.am;
    const von = d.freigabe?.von ?? h?.at(-1)?.[3] ?? iaFreigabe?.von;
    const person = pruefer.find((x) => x !== d.eigner && x !== von);
    if (am && person) d.geprueft = { von: person, am: tageVorher(am, 2) };
  }
}

/**
 * Prüfdatum der Dokumente (geprueft.am) nach dem Inhalt: nie nach der Freigabe und nie vor einem Ereignis, das die Version
 * enthält. Ereignisse kurz vor der Freigabe (Managementbewertung, Audittage, Feststellungen, Nachweise, Neubeurteilungen,
 * Messungen, Freigaben, Restrisiko-Annahmen, Prüfungen der Lieferanten): Prüfung am Tag des jüngsten Ereignisses im Fenster
 * von drei Tagen vor der Freigabe, sonst zwei Tage vor der Freigabe. Am Ende des Baus aufrufen, wenn alle Daten stehen;
 * src/beispiele/bau/datumspruefung.mts prüft das Ergebnis gegen den Text der Dokumente.
 */
export function pruefDaten(p: Projekt, abweichend: Record<string, string> = {}): void {
  const ereignisse = [
    ...p.managementbewertungen.map((m) => m.datum),
    ...p.audits.flatMap((a) => [a.durchgefuehrt, a.durchgefuehrtBis]),
    ...p.feststellungen.map((f) => f.datum),
    ...p.nachweise.map((n) => n.datum),
    ...p.folgenabschaetzungen.flatMap((f) => [f.triage.am, f.freigabe?.am, ...(f.neubeurteilungen ?? []).flatMap((n) => [n.am, n.freigabe?.am])]),
    ...p.ziele.flatMap((z) => z.messungen.map((m) => m.datum)),
    ...(p.kennzahlMessungen ?? []).map((m) => m.datum),
    ...p.kiSysteme.map((s) => s.freigabe?.am),
    ...p.risiken.map((r) => r.restrisikoAkzeptiert?.am),
    ...p.lieferanten.map((l) => l.geprueft?.am),
    ...p.massnahmen.map((m) => m.erledigtAm),
    ...(p.meldungen ?? []).flatMap((m) => [m.datum, m.erledigtAm]),
  ].filter((d): d is string => !!d).map((d) => d.slice(0, 10));
  for (const d of p.dokumente) {
    if (!d.geprueft) continue;
    const am = d.freigabe?.am ?? d.aenderungen?.at(-1)?.datum;
    if (!am) continue;
    const fenster = tageVorher(am, 3);
    const juengstes = ereignisse.filter((e) => e > fenster && e <= am).sort().at(-1);
    d.geprueft.am = abweichend[d.id] ?? juengstes ?? tageVorher(am, 2);
  }
}
