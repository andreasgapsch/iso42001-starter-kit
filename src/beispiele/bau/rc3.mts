// Beispiele, Felder ab rc.3: Dienst und Tarif (Tarif, Funktionsschalter, Abkündigung, Quelle der Anbieterangaben),
// Prüffragen PF-22 bis PF-27 und Klauseln VK-16 bis VK-19 je Lieferant, je Firma ein Datenrisiko aus der Vorschlagsliste
// GenAI-Sicherheit (GS-17, GS-22). Die neuen Risiken sind nach der Managementbewertung erfasst, bewertet, aber noch
// nicht behandelt; die Zählungen der Managementbewertung bleiben deshalb richtig.
import type { Funktion, FunktionStand, JaNeinOffen, KiSystem, KlauselStand, Projekt, Risiko } from '../../model/typen.ts';

type Dienst = Pick<KiSystem, 'tarif' | 'funktionen' | 'abkuendigung' | 'quelleAngaben'>;
const f = (w: Partial<Record<Funktion, FunktionStand>>) => w;
const pf = (werte: JaNeinOffen[]): Record<string, JaNeinOffen> => Object.fromEntries(werte.map((w, i) => [`PF-${22 + i}`, w]));
const vk = (werte: KlauselStand[]) => Object.fromEntries(werte.map((w, i) => [`VK-${16 + i}`, w]));

function anwenden(p: Projekt, dienste: Record<string, Dienst>, lieferanten: Record<string, [JaNeinOffen[], KlauselStand[]]>, risiko: Risiko): void {
  for (const s of p.kiSysteme) if (dienste[s.id]) Object.assign(s, dienste[s.id]);
  for (const l of p.lieferanten) {
    const [fragen, klauseln] = lieferanten[l.id]!;
    Object.assign(l.pruefpunkte, pf(fragen));
    Object.assign(l.vertragsklauseln ?? (l.vertragsklauseln = {}), vk(klauseln));
  }
  p.risiken.push(risiko);
}

const MUSTER_DIENSTE: Record<string, Dienst> = {
  'KI-001': { tarif: 'enterprise', quelleAngaben: { fundstelle: 'Wartungsvertrag und Release Notes 3.3 von Optikwerk Vision Systems', abgerufen: '2027-01-27' } },
  'KI-004': {
    tarif: 'enterprise',
    funktionen: f({ websuche: 'aus', codeausfuehrung: 'aus', dateiupload: 'an', gedaechtnis: 'aus', konnektoren: 'aus', agenten: 'aus', teilen: 'aus' }),
    quelleAngaben: { fundstelle: 'Produktbedingungen und Datenschutzhinweise zu Microsoft 365 Copilot, Einstellungen im Verwaltungscenter des Mandanten', abgerufen: '2027-01-15' },
  },
  'KI-005': {
    tarif: 'business',
    funktionen: f({ websuche: 'an', codeausfuehrung: 'aus', dateiupload: 'an', gedaechtnis: 'aus', konnektoren: 'aus', agenten: 'aus', teilen: 'aus' }),
    quelleAngaben: { fundstelle: 'Geschäftsbedingungen für Team-Arbeitsbereiche und Einstellungen der Verwaltungskonsole', abgerufen: '2027-01-15' },
  },
  'KI-006': {
    tarif: 'business',
    funktionen: f({ websuche: 'aus', codeausfuehrung: 'aus', dateiupload: 'aus', gedaechtnis: 'aus', konnektoren: 'aus', agenten: 'aus', teilen: 'aus' }),
    abkuendigung: '2027-09-30',
    quelleAngaben: { fundstelle: 'Modellkarte und Seite zum Lebenszyklus der Modelle der Cloud-KI-Plattform (L-004)', abgerufen: '2027-01-20' },
  },
  'KI-007': { tarif: 'gratis', funktionen: f({ dateiupload: 'an', teilen: 'aus' }), quelleAngaben: { fundstelle: 'Nutzungsbedingungen des Webdienstes', abgerufen: '2026-12-08' } },
  'KI-008': { tarif: 'business', funktionen: f({ agenten: 'aus' }), quelleAngaben: { fundstelle: 'Vertrag und Leistungsbeschreibung der HR-SaaS mit Nachtrag zur Funktion «Kandidaten-Ranking»', abgerufen: '2027-01-20' } },
};
/** PF-22 bis PF-27 und VK-16 bis VK-19 je Lieferant (Prüfung vom 08.12.2026, L-002 und L-005 erneut im Januar 2027) */
const MUSTER_LIEFERANTEN: Record<string, [JaNeinOffen[], KlauselStand[]]> = {
  'L-001': [['ja', 'ja', 'offen', 'ja', 'ja', 'ja'], ['offen', 'nicht-noetig', 'nicht-noetig', 'ja']],
  'L-002': [['ja', 'ja', 'ja', 'ja', 'ja', 'ja'], ['ja', 'ja', 'ja', 'offen']],
  'L-003': [['ja', 'ja', 'offen', 'ja', 'ja', 'ja'], ['offen', 'ja', 'ja', 'nein']],
  'L-004': [['ja', 'ja', 'ja', 'ja', 'ja', 'ja'], ['ja', 'ja', 'nicht-noetig', 'ja']],
  'L-005': [['ja', 'ja', 'offen', 'ja', 'offen', 'offen'], ['offen', 'ja', 'nicht-noetig', 'offen']],
  'L-006': [['ja', 'ja', 'offen', 'ja', 'ja', 'ja'], ['offen', 'ja', 'nicht-noetig', 'offen']],
  'L-007': [['offen', 'offen', 'nein', 'offen', 'nein', 'nein'], ['nein', 'nein', 'nein', 'nein']],
};

export function rc3Muster(p: Projekt): void {
  anwenden(p, MUSTER_DIENSTE, MUSTER_LIEFERANTEN, {
    id: 'R-033', art: 'risiko', status: 'offen', titel: 'Veralteter Suchindex lässt den Assistenten abgelöste Ersatzteile empfehlen', kiSystem: 'KI-006', quelle: 'daten', ebenen: ['organisation', 'individuen'],
    beschreibung: 'Der Suchindex des Ersatzteil-Assistenten wird nachts aus dem Ersatzteilkatalog aufgebaut. Fällt der Lauf aus oder bleibt ein gelöschter Eintrag im Index, empfiehlt der Assistent abgelöste Teile oder alte Preise, und die Antwort wirkt trotzdem stimmig.',
    ursache: 'Index und Katalog werden in getrennten Abläufen gepflegt; ein Ausfall des nächtlichen Laufs fällt nur in den Protokollen der Plattform auf.',
    folge: 'Falsche Bestellungen von Kunden, Rücksendungen und Aufwand im Service; bei sicherheitsrelevanten Teilen falscher Ersatz.',
    bestehendeMassnahmen: 'Täglicher Abgleich der Teilenummern mit dem ERP (M-031), Stichproben der Antworten durch die Redaktion Ersatzteilkatalog.',
    // Tiefes Risiko bewusst getragen (Behandlungsentscheid nach 6.1.3, Annahme durch die zuständige Stelle für tiefe Risiken)
    w: 2, a: 2, wNach: 2, aNach: 2, behandlung: 'tragen', restrisikoAkzeptiert: { von: 'P-002', am: '2027-02-02' }, controls: ['A.7.4', 'A.6.2.6', 'A.9.3'], massnahmen: [], eigner: 'P-008',
    beurteiltAm: '2027-02-02', erfasstAm: '2027-02-02',
  });
}

const PRAEZISION_DIENSTE: Record<string, Dienst> = {
  'KI-001': {
    tarif: 'business',
    funktionen: f({ websuche: 'an', codeausfuehrung: 'aus', dateiupload: 'an', gedaechtnis: 'aus', konnektoren: 'aus', agenten: 'aus', teilen: 'aus' }),
    quelleAngaben: { fundstelle: 'Produktbedingungen zu Microsoft 365 Copilot und Einstellungen im Verwaltungscenter, geprüft durch Mittelland Informatik', abgerufen: '2026-11-12' },
  },
  'KI-002': { tarif: 'business', quelleAngaben: { fundstelle: 'Release Notes und Leistungsbeschreibung des ERP-Anbieters', abgerufen: '2027-01-08' } },
  'KI-003': { tarif: 'eigenbetrieb', quelleAngaben: { fundstelle: 'Lizenzvertrag und Versionshinweise der CAM-Software', abgerufen: '2026-11-12' } },
  'KI-004': { tarif: 'gratis', quelleAngaben: { fundstelle: 'Nutzungsbedingungen des Dienstes', abgerufen: '2026-09-22' } },
};
const PRAEZISION_LIEFERANTEN: Record<string, [JaNeinOffen[], KlauselStand[]]> = {
  'L-001': [['ja', 'ja', 'ja', 'ja', 'ja', 'ja'], ['ja', 'ja', 'ja', 'offen']],
  'L-002': [['ja', 'ja', 'offen', 'ja', 'ja', 'ja'], ['offen', 'ja', 'nicht-noetig', 'ja']],
  'L-003': [['ja', 'ja', 'ja', 'ja', 'ja', 'ja'], ['nicht-noetig', 'nicht-noetig', 'nicht-noetig', 'ja']],
};

export function rc3Praezision(p: Projekt): void {
  anwenden(p, PRAEZISION_DIENSTE, PRAEZISION_LIEFERANTEN, {
    id: 'R-014', art: 'risiko', status: 'offen', titel: 'Zusammenfassungen und Abschriften aus Copilot sind schlechter geschützt als die Quelle', kiSystem: 'KI-001', quelle: 'vertraulichkeit', ebenen: ['organisation', 'individuen'],
    beschreibung: 'Copilot fasst Besprechungen, Mails und Zeichnungsunterlagen zusammen. Die Zusammenfassungen landen in allgemeinen Teams-Kanälen oder in Mails an Lieferanten und werden nicht gelöscht, wenn die Kundenunterlagen nach Projektende gelöscht werden.',
    ursache: 'Für Abschriften und Zusammenfassungen gibt es keine eigene Ablage; die Klassifikation der Quelle geht beim Kopieren verloren.',
    folge: 'Vertrauliche Kundenangaben bleiben nach Projektende verfügbar oder erreichen Personen ohne Berechtigung; Löschpflichten gegenüber Kunden werden verfehlt.',
    bestehendeMassnahmen: 'Regeln zur KI-Nutzung mit Datenklassen (D-15), Aufbewahrungsfristen in M365 für Projektordner.',
    // Tiefes Risiko bewusst getragen (Behandlungsentscheid nach 6.1.3), mit dem Behandlungsplan freigegeben
    w: 1, a: 3, wNach: 1, aNach: 3, behandlung: 'tragen', restrisikoAkzeptiert: { von: 'P-002', am: '2027-01-26' }, controls: ['A.4.3', 'A.9.2', 'A.7.4'], massnahmen: [], eigner: 'P-002',
    beurteiltAm: '2027-01-26', erfasstAm: '2027-01-26',
  });
}
