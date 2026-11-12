// Prozessstand der Beispielprojekte (Plan Prozesse, Abschnitt 7): Eigner, Reife, Termine, Kennzahl und ISMS-Verweise je
// Prozess; Muster Maschinenbau mit einem Ablauf aus draw.io (PR-07, mit Notiz und zweiter Ebene) für die Rundreise.
// Muster dazu mit einem eigenen Prozess PE-01 (Rückmeldungen zum Ersatzteil-Assistenten im Kundenportal).
// Bewusst offene Befunde: Muster H55 (PR-12 überfällig) und H59 (Massnahme zu PR-14 überfällig); Präzisionsteile H56
// (PR-12 «eingeführt» ohne Durchführung) und H58 (PR-19 «überprüft», aber nicht im Umfang des internen Audits).
import type { Projekt, ProzessEintrag, ProzessReife } from '../../model/typen.ts';
import { ladeTexte } from '../../i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../i18n/texte.ts';
import { drawioImportieren, drawioSeite, drawioSeitenLesen } from '../../prozesse/drawio.ts';
import { bahnText, katalogAblauf, prozessKatalog, rollenText } from '../../prozesse/katalog.ts';
import { kataloge } from './gemeinsam.mts';

const e = (id: string, reife: ProzessReife, eigner: string, weitere: Partial<ProzessEintrag> = {}): ProzessEintrag => ({ id, eigner, reife, reifeAm: weitere.reifeAm ?? '2027-02-03', ...weitere });

/** Prozesse des ISMS-Handbuchs der Muster Maschinenbau AG zu den Basisprozessen PS-01 bis PS-11 */
const ISMS_PROZESSE: [string, string][] = [
  ['01', 'Inventar der Werte'], ['02', 'Zugriffsrechte'], ['03', 'Personal'], ['04', 'Sicherheitsvorfälle'], ['05', 'Änderungen IT'], ['06', 'Datensicherung'],
  ['07', 'Notfallvorsorge'], ['08', 'Schwachstellen und Patches'], ['09', 'Protokollierung'], ['10', 'Sichere Entwicklung'], ['11', 'Physische Sicherheit'],
];

/** Muster Maschinenbau AG: mit ISMS, alle 27 AIMS-Prozesse, ISMS-Basisprozesse als Verweis auf das ISMS-Handbuch */
export function prozesseMuster(): ProzessEintrag[] {
  const isms = (nr: string) => `ISMS-Handbuch MMB, Prozess IS-${nr}`;
  return [
    e('PR-01', 2, 'P-002', { stellvertretung: 'P-003' }),
    e('PR-02', 2, 'P-002', { notiz: 'Verantwortet von der Geschäftsleitung (Daniel Keller); jährliche Überprüfung der Leitlinie in der Managementbewertung.' }),
    e('PR-03', 2, 'P-002', { ismsVerweis: isms('03 Rollen und Verantwortlichkeiten') }),
    e('PR-04', 2, 'P-002', { kennzahl: 'KZ-06' }),
    e('PR-05', 2, 'P-002', { ismsVerweis: isms('05 Änderungen am Managementsystem') }),
    e('PR-06', 2, 'P-003', { kennzahl: 'Z-001' }),
    e('PR-07', 2, 'P-002', { kennzahl: 'Z-006' }),
    e('PR-08', 3, 'P-002', { kennzahl: 'Z-006', notiz: 'Methode und Register gemeinsam mit dem ISMS; den ISMS-Teil führt Marco Huber.' }),
    e('PR-09', 3, 'P-002', { kennzahl: 'Z-007' }),
    e('PR-10', 2, 'P-002', { kennzahl: 'KZ-01' }),
    e('PR-11', 2, 'P-004', { stellvertretung: 'P-006', notiz: 'Eigenbau MX-Predict: Lukas Meier; Kamerasystem Linie 3: Thomas Gerber.' }),
    e('PR-12', 2, 'P-004', { stellvertretung: 'P-006', letzteDurchfuehrung: '2026-10-30', rhythmus: 'quartalsweise', nachweise: ['N-017'], notiz: 'Quartalsstichprobe Linie 3 wegen Umbau der Kamera verschoben.' }),
    e('PR-13', 2, 'P-004'),
    e('PR-14', 1, 'P-004', { notiz: 'Noch keine Ausserbetriebnahme; Anlass ist die ausgesetzte Sortierhilfe KI-008.' }),
    e('PR-15', 2, 'P-004', { letzteDurchfuehrung: '2026-11-30', nachweise: ['N-017'], kennzahl: 'Z-007' }),
    e('PR-16', 2, 'P-004'),
    e('PR-17', 2, 'P-008'),
    e('PR-18', 2, 'P-008', { kennzahl: 'KZ-04' }),
    e('PR-19', 2, 'P-003', { kennzahl: 'KZ-04' }),
    e('PR-20', 2, 'P-007'),
    e('PR-21', 2, 'P-005', { kennzahl: 'Z-002' }),
    e('PR-22', 2, 'P-008', { ismsVerweis: isms('22 Kommunikation') }),
    e('PR-23', 3, 'P-003', { kennzahl: 'KZ-07', ismsVerweis: isms('23 Lenkung dokumentierter Information') }),
    e('PR-24', 2, 'P-009'),
    e('PR-25', 4, 'P-011', { kennzahl: 'KZ-02', ismsVerweis: isms('25 Internes Audit') }),
    e('PR-26', 2, 'P-001', { ismsVerweis: isms('26 Managementbewertung') }),
    e('PR-27', 2, 'P-002', { nachweise: ['N-034'], ismsVerweis: isms('27 Korrekturmassnahmen') }),
    ...ISMS_PROZESSE.map(([n, titel]): ProzessEintrag => ({ id: `PS-${n}`, eigner: n === '03' ? 'P-005' : n === '10' ? 'P-004' : 'P-003', ismsVerweis: isms(`${30 + Number(n)} ${titel}`) })),
    // Eigener Prozess der Firma (Projekt.eigeneProzesse): Ablauf in drei Bahnen, im Werkzeug angelegt
    e('PE-01', 2, 'P-008', {
      anwendbar: 'ja',
      stellvertretung: 'P-002',
      letzteDurchfuehrung: '2027-01-22',
      kennzahl: 'KZ-04',
      bahnen: [{ id: 'fachbereich', rolle: 'fachbereich', text: 'Kundendienst' }, { id: 'ki-eigner', rolle: 'ki-eigner' }],
      schritte: [
        { id: 'PE-01.00', art: 'start', text: 'Rückmeldung zum Ersatzteil-Assistenten geht ein', bahn: 'fachbereich', naechste: ['PE-01.01'] },
        { id: 'PE-01.01', art: 'aufgabe', text: 'Rückmeldung im Ticketsystem erfassen und einstufen', bahn: 'fachbereich', naechste: ['PE-01.02'], raci: { fachbereich: 'A', 'ki-eigner': 'I' } },
        { id: 'PE-01.02', art: 'entscheidung', text: 'Falsche oder irreführende Antwort der KI?', bahn: 'ki-eigner', naechste: ['PE-01.03', 'PE-01.04'], zweige: { 'PE-01.03': 'ja', 'PE-01.04': 'nein' }, raci: { 'ki-eigner': 'A', fachbereich: 'R' } },
        { id: 'PE-01.03', art: 'aufgabe', text: 'Antwort berichtigen und Fall als Prüffall im Messkonzept von KI-006 aufnehmen', bahn: 'ki-eigner', naechste: ['PE-01.04'], raci: { 'ki-eigner': 'A', aims: 'I' }, verweis: ['PR-12'] },
        { id: 'PE-01.04', art: 'aufgabe', text: 'Kundschaft innert zwei Arbeitstagen antworten', bahn: 'fachbereich', naechste: ['PE-01.90'], raci: { fachbereich: 'A' } },
        { id: 'PE-01.90', art: 'ende', text: 'Rückmeldung abgeschlossen', bahn: 'fachbereich' },
      ],
    }),
  ];
}

/** Muster: eigener Prozess PE-01 der Firma (Titel, Zweck, Gruppe, Art; Stand und Ablauf in prozesseMuster) */
export function eigeneProzesseMuster(): NonNullable<Projekt['eigeneProzesse']> {
  return [
    {
      id: 'PE-01',
      titel: 'Rückmeldungen zum Ersatzteil-Assistenten bearbeiten',
      zweck: 'Rückmeldungen der Kundschaft zu Antworten des Ersatzteil-Assistenten im Kundenportal rasch beantworten und Fehler der KI in die Überwachung des Systems zurückführen.',
      gruppe: 'kern',
      art: 'nur-aims',
      normbezug: ['8.1', 'A.8.3', 'A.6.2.6'],
    },
  ];
}

/** Muster: Kennzahl zur Dokumentenlenkung (PR-23) und Massnahme zur Ausserbetriebnahme (PR-14, überfällig) */
export function prozessDatenMuster(p: Projekt): void {
  p.eigeneProzesse = eigeneProzesseMuster();
  p.kennzahlen = [
    ...(p.kennzahlen ?? []),
    { id: 'KZ-07', kennzahl: 'Anteil der Dokumente mit fristgerechter Überprüfung', messmethode: 'Auswertung des Dokumentenregisters D-26-EB: Datum der nächsten Überprüfung gegen Stichtag', haeufigkeit: 'quartalsweise', werMisst: 'P-003', werWertetAus: 'P-002', empfaenger: 'AIMS-Team' },
  ];
  p.kennzahlMessungen = [...(p.kennzahlMessungen ?? []), { kennzahl: 'KZ-07', datum: '2027-01-29', wert: '100 %', bemerkung: 'Alle Dokumente im Register fristgerecht überprüft' }];
  p.massnahmen.push({
    id: 'M-037', titel: 'Checkliste Ausserbetriebnahme an KI-008 erproben', beschreibung: 'Schritte von PR-14 mit der ausgesetzten Sortierhilfe durchspielen: Zugänge, Daten, Nachweise.',
    verantwortlich: 'P-004', termin: '2027-02-04', status: 'offen', prioritaet: 'mittel', herkunft: { art: 'prozess', ref: 'PR-14' }, erfasstAm: '2027-02-02',
  });
  p.dokumente.push({
    id: 'D-27', version: '1.0', status: 'freigegeben', eigner: 'P-002', freigabe: { von: 'P-001', am: '2027-02-04' }, naechsteUeberpruefung: '2028-02-04',
    ablageort: 'SharePoint ISMS/AIMS > 03_Prozesse', giltFuerIsms: false, aufbewahrung: '10 Jahre nach Ersatz',
  });
}

/** Beispiel Präzisionsteile GmbH: ohne ISMS, früher Stand, Mindestumfang der Basisprozesse */
export function prozessePraezision(): ProzessEintrag[] {
  const b = (id: string, reife: ProzessReife, eigner: string, weitere: Partial<ProzessEintrag> = {}) => e(id, reife, eigner, { reifeAm: '2027-01-26', ...weitere });
  return [
    ...['PR-01', 'PR-02', 'PR-03', 'PR-04', 'PR-05', 'PR-06', 'PR-08', 'PR-09', 'PR-10', 'PR-13', 'PR-14', 'PR-16', 'PR-17', 'PR-18', 'PR-21', 'PR-22', 'PR-23', 'PR-24', 'PR-27'].map((id) =>
      b(id, 1, id === 'PR-06' ? 'P-003' : id === 'PR-16' ? 'P-004' : 'P-002'),
    ),
    b('PR-07', 3, 'P-002', { kennzahl: 'Z-001', notiz: 'Seit der Untersagung des kostenlosen Chatbots KI-004 keine neue Schatten-KI gefunden.' }),
    b('PR-11', 1, 'P-004'),
    b('PR-12', 2, 'P-004'),
    { id: 'PR-15', anwendbar: 'nein', begruendung: 'Keine eigene Entwicklung von KI; alle Systeme sind eingekauft oder als Dienst bezogen.' },
    b('PR-19', 4, 'P-001', { kennzahl: 'KZ-04' }),
    b('PR-20', 1, 'P-005'),
    b('PR-25', 2, 'P-006', { kennzahl: 'KZ-02' }),
    b('PR-26', 1, 'P-001'),
    b('PS-02', 1, 'P-003'),
    b('PS-04', 1, 'P-003'),
    b('PS-06', 1, 'P-003'),
    b('PS-08', 1, 'P-003', { anwendbar: 'ja', notiz: 'Basisschutz: Updates der CAM-Software und der Arbeitsplätze monatlich durch Reto Schneider.' }),
  ];
}

/** Präzisionsteile: Umfang des internen Audits AU-001 (ohne Vorfälle, PR-19) und Dokument D-27 im Register */
export function prozessDatenPraezision(p: Projekt): void {
  const au = p.audits.find((a) => a.id === 'AU-001');
  if (au) au.umfangProzesse = ['PR-01', 'PR-02', 'PR-03', 'PR-04', 'PR-06', 'PR-07', 'PR-08', 'PR-09', 'PR-10', 'PR-11', 'PR-12', 'PR-20', 'PR-21', 'PR-23', 'PR-25', 'PR-26', 'PR-27'];
  p.dokumente.push({
    id: 'D-27', version: '1.0', status: 'freigegeben', eigner: 'P-002', freigabe: { von: 'P-001', am: '2027-01-28' }, naechsteUeberpruefung: '2027-12-31',
    ablageort: 'Laufwerk Q: > AIMS (Ordner nach Dokumentnummer)', giltFuerIsms: false, aufbewahrung: '10 Jahre nach Ersatz',
  });
}

/**
 * Ablauf PR-07 aus draw.io (Muster): Seite aus dem Katalogablauf der Sprache, in draw.io um eine Notiz und eine zweite
 * Ebene ergänzt und mit geschärftem Text für die Kurzprüfung wieder übernommen. Je Sprache erzeugt, damit Texte und
 * Rohdaten zusammenpassen.
 */
export function mitDrawioBeispiel(p: Projekt, sprache: 'de' | 'en'): Projekt {
  const u = erstelleUebersetzer(sprache, ladeTexte(sprache));
  const kp = prozessKatalog(kataloge).prozesse.find((x) => x.id === 'PR-07')!;
  const ablauf = katalogAblauf(u, kp);
  const kurz = ablauf.schritte.find((s) => s.id === 'PR-07.02')!;
  kurz.text = sprache === 'de' ? 'Kurzprüfung nach den Freigabekriterien (D-15) innert 10 Tagen' : 'Quick check against the approval criteria (D-15) within 10 days';
  let seite = drawioSeite({ id: 'PR-07', titel: u.t('prozesse.prozesse.PR-07.titel'), ablauf, bahnTexte: Object.fromEntries(ablauf.bahnen.map((b) => [b.id, bahnText(u, b)])) });
  const notiz = sprache === 'de' ? 'Vertiefte Prüfung bei Personendaten, vertraulichen Daten oder Entscheiden über Menschen' : 'In-depth review for personal data, confidential data or decisions about people';
  const ebene = sprache === 'de' ? 'Hinweise' : 'Notes';
  // Zweite Ebene und Notiz wie in draw.io Desktop gezeichnet (Textform ohne Rahmen auf der eigenen Ebene)
  seite = seite.replace(
    '</root>',
    `<mxCell id="ebene-hinweise" value="${ebene}" parent="0"/><mxCell id="notiz-1" value="${notiz}" style="text;html=1;whiteSpace=wrap;align=left;verticalAlign=top;fontStyle=2;" vertex="1" parent="ebene-hinweise"><mxGeometry x="560" y="250" width="180" height="70" as="geometry"/></mxCell></root>`,
  );
  const [roh] = drawioSeitenLesen(`<mxfile host="drawio" version="24.7.17">${seite}</mxfile>`);
  const imp = drawioImportieren(roh!, { prozessId: 'PR-07', rollen: kp.schritte.map((s) => ({ schluessel: s.bahn, text: rollenText(u, s.bahn) })) });
  // Beschriftungen der Zweige im eigenen Ablauf PE-01 («ja», «nein» sind Kurzwörter, die aufEnglisch als Code stehen lässt)
  if (sprache === 'en')
    for (const s of p.prozesse?.find((x) => x.id === 'PE-01')?.schritte ?? [])
      if (s.zweige) s.zweige = Object.fromEntries(Object.entries(s.zweige).map(([z, t]) => [z, t === 'ja' ? 'yes' : t === 'nein' ? 'no' : t]));
  const eintrag = p.prozesse?.find((x) => x.id === 'PR-07');
  if (eintrag) {
    eintrag.schritte = imp.schritte;
    eintrag.bahnen = imp.bahnen;
    eintrag.drawio = { roh: imp.roh, hash: imp.hash, importiertAm: '2027-01-14T10:20:00.000Z', datei: 'PR-07_Freigabe-KI-Werkzeuge.drawio' };
  }
  return p;
}

/** Projekt ohne Ablauf aus draw.io (vor der Übersetzung; mitDrawioBeispiel setzt ihn je Sprache) */
export function ohneDrawio(p: Projekt): Projekt {
  const kopie = structuredClone(p);
  // Nur Abläufe aus draw.io; eigene Prozesse behalten ihren Ablauf (Texte über die Übersetzungspaare)
  for (const x of kopie.prozesse ?? []) {
    if (!x.drawio) continue;
    delete x.schritte;
    delete x.bahnen;
    delete x.drawio;
  }
  return kopie;
}
