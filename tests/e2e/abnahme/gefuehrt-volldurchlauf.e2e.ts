// Abnahme 1: Guide im Volldurchlauf. Neues Projekt, Startinterview, Etappen E1 bis E13 bis zur Prüfseite
// mit «Bereit für Stage 1», nur über den Guide (keine Formularansicht). Zwei Pfade: mit ISMS und Modul,
// ohne ISMS und ohne Modul. Auf jeder Seite: Frage, Erklärung (warum), Beispiel und Normabschnitt vorhanden.
// Voraussetzung: npm run build:app. Testtiefe: Chromium.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test } from '../app/app-hilfen.ts';
import { parse } from 'yaml';
import type { Projekt } from '../../../src/model/typen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, fixtureDatei, oeffne, starte } from '../app/app-hilfen.ts';
import {
  abschlussBearbeiten, ETAPPEN, feldKey, heute, inTagen, neuesProjektAnlegen, ortAusUrl, seiteBearbeiten, SEITEN, setzeStichtag, seiteHatHilfe, text, type Durchlauf, type Vorgaben,
} from './abnahme-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, acceptDownloads: true, actionTimeout: 15_000 });

const SOA_UMGESETZT = ['E9-lebenszyklus', 'E9-dokumentation', 'E9-entwicklung', 'E9-daten-betrieb', 'E9-daten-entwicklung', 'E9-information', 'E9-meldekanal-soa', 'E9-nutzung', 'E9-dritte'];

/** Plausible Antworten einer kleinen Firma (Beispiel AG, ein KI-System im Einsatz). */
function vorgaben(mitIsms: boolean, modul: boolean): Vorgaben {
  const v: Vorgaben = {
    'E0-firma:organisation.name': 'Beispiel AG',
    'E0-firma:organisation.branche': 'maschinenbau',
    'E0-groesse:organisation.mitarbeitende': 80,
    'E0-isms:meta.gefuehrt.antworten.isms': mitIsms ? 'vorhanden' : 'nein',
    'E0-modul:meta.modulAiAct': modul,
    'E0-modul:meta.modulNistRmf': false,
    'E0-verantwortung:organisation.aimsVerantwortlich': { person: 'neu' },
    // H91: je drei externe und interne Themen, drei Quellen der Inventarsuche (die Seiten bleiben sonst «unvollständig»)
    'E2-themen:organisation.kontext.themen': {
      zeilen: [
        { art: 'extern', kategorie: 'recht', beschreibung: 'EU AI Act und revDSG regeln den Einsatz von KI' },
        { art: 'extern', kategorie: 'markt', beschreibung: 'Kunden fragen nach dem Umgang mit KI im Angebot' },
        { art: 'extern', kategorie: 'technik', beschreibung: 'Anbieter bauen KI ohne Ankündigung in Produkte ein' },
        { art: 'intern', kategorie: 'kultur', beschreibung: 'Mitarbeitende probieren KI-Werkzeuge selbst aus' },
        { art: 'intern', kategorie: 'governance', beschreibung: 'Zuständigkeiten für KI sind noch nicht geregelt' },
        { art: 'intern', kategorie: 'technik', beschreibung: 'Daten liegen verteilt auf mehreren Ablagen' },
      ],
    },
    'E4-suche:meta.gefuehrt.antworten.inventar.quellen': ['softwareliste', 'lizenzen', 'einkauf'],
    'E1-team:name': 'Max Beispiel',
    'E1-team:funktion': 'Geschäftsführer',
    'E1-team:aimsRollen': ['gl'],
    'E4-systeme:name': 'Microsoft 365 Copilot',
    'E4-systeme:typ': 'saas',
    'E4-systeme:zweck': 'Texte entwerfen und Besprechungen zusammenfassen',
    'E4-daten:automatisierung': 'unterstuetzend',
    // ab rc.2: Modell und Version (H33), Einsatzentscheid (H31), Wirksamkeit der Controls (H35)
    'E4-generativ:modell.name': 'Copilot laut Anbieter',
    'E4-generativ:modell.version': 'Stand 10/2026',
    'E7-einsatzentscheid:einsatzentscheid.nutzen': 'Entwürfe in der halben Zeit',
    'E7-einsatzentscheid:einsatzentscheid.alternativeOhneKi': 'Textvorlagen geprüft, decken Zusammenfassungen nicht ab',
    'E8-wirksamkeit:wirksamkeit.wie': 'Stichprobe von 10 Fällen zu {id}, Befund im Ordner Nachweise',
    'E8-wirksamkeit:wirksamkeit.wann': heute(),
    'aiAct.rollen': ['betreiber'],
    'E5-risikoklasse:aiAct.risikoklasse': 'transparenz',
    'E5-transparenz:aiAct.transparenz': ['50-1'],
    'E6-isms-skalen:organisation.risikokriterien.ausIsmsUebernommen': true,
    'E6-skalen:organisation.risikokriterien.wahrscheinlichkeit': { zeilen: [{ stufe: 1, bezeichnung: 'selten' }, { stufe: 2, bezeichnung: 'möglich' }, { stufe: 3, bezeichnung: 'häufig' }] },
    'E6-skalen:organisation.risikokriterien.auswirkung': { zeilen: [{ stufe: 1, bezeichnung: 'gering' }, { stufe: 2, bezeichnung: 'spürbar' }, { stufe: 3, bezeichnung: 'schwer' }] },
    'E6-akzeptanz:organisation.risikokriterien.akzeptanzBis': 3,
    'E6-akzeptanz:organisation.risikokriterien.unannehmbarAb': 6,
    'E6-register:titel': 'Vertrauliche Daten gelangen in Eingaben',
    'E6-register:kiSystem': { verweis: ['KI-001'] },
    'E6-bewertung:w': 2,
    'E6-bewertung:a': 3,
    'E6-chancen:titel': 'Schnellere Angebotserstellung',
    'E7-triage-ergebnis:triage.ergebnis': 'kurz',
    'E8-behandlung:behandlung': 'vermindern',
    'E8-behandlung:controls': { verweis: ['A.9.3'] },
    'E8-soa:anwendbar': 'ja',
    'E8-soa:status': 'umgesetzt',
    'E8-euaia:anwendbar': 'ja',
    'E8-euaia:status': 'umgesetzt',
    'E8-nachweise:titel': 'Nutzungsrichtlinie KI, unterzeichnet',
    'E8-nachweise:ablageort': 'SharePoint AIMS, Ordner Nachweise',
    'E8-massnahmen:titel': 'Schulung zur Nutzungsrichtlinie',
    // Offen: eine erledigte Massnahme verlangt einen Nachweis (H83, Runde 1 A-09), der erst auf der nächsten Seite entsteht
    'E8-massnahmen:status': 'offen',
    'E9-lieferanten:name': 'Microsoft Schweiz GmbH',
    // «mit Auflagen»: Das übernommene Beispiel hat offene Prüffragen (H45 meldet «geprüft» mit offenen Punkten)
    'E9-lieferanten:pruefstatus': 'mit-auflagen',
    'E9-transparenz:E-07.hinweis': { checkliste: 'Hinweis im Intranet' },
    'E10-kompetenzen:nachweis': 'Schulungsliste 2026',
    'E10-kommunikation:richtung': 'extern',
    'E11-ziele:ziel': 'Alle KI-Systeme im Inventar erfasst und freigegeben',
    'E12-audit:durchgefuehrt': heute(),
    // P19 (C4-08): durchgeführt heisst Datum und Ergebnis oder Checkliste; ein Datum allein belegt kein Audit
    'E12-audit:ergebnis': 'Keine Abweichung, zwei Beobachtungen zur Dokumentenlenkung',
    // Das übernommene Beispiel nennt ein Datum in der Zukunft: Der Guide lässt die Seite offen (H89), bis es stimmt
    'E12-mb:datum': heute(),
    'E12-feststellungen:quelle': 'audit',
    'E12-feststellungen:audit': { verweis: 'erste' },
    'E12-feststellungen:einstufung': 'nk-leicht',
  };
  for (const s of SOA_UMGESETZT) v[`${s}:status`] = 'umgesetzt';
  return v;
}

/**
 * Hochrisiko-System nach Anhang III (4a, Vorauswahl von Bewerbungen), eingekauft und betrieben (Betreiber). Das System läuft
 * unter dem eigenen Namen im Bewerbungsportal: Rollenwechsel nach Art. 25(1) Bst. a, damit auch Anbieter. Vollständige
 * Folgenabschätzung, FRIA-Prüfung (nicht erforderlich: private Arbeitgeberin ohne öffentliche Dienste), Betreiber- und
 * Anbieterpflichten als erledigte Checklistenpunkte. Dazu Ziel Stage-1-Bereitschaft und Pensum für den Fahrplan.
 */
function hochrisikoVorgaben(): Vorgaben {
  const v: Vorgaben = {
    ...vorgaben(false, true),
    'E0-termin:organisation.zielterminStage1': inTagen(200),
    'E0-termin:organisation.projektauftrag.pensumProzent': 40,
    'E4-systeme:name': 'Bewerbungsvorauswahl im Bewerbungsportal',
    'E4-systeme:typ': 'saas',
    'E4-systeme:zweck': 'Eingehende Bewerbungen nach den Anforderungen der Stelle vorsortieren',
    'E4-daten:automatisierung': 'teilautomatisiert',
    'E5-rolle:aiAct.anwendungsbereich': ['b'],
    'E5-rollenwechsel:aiAct.rollenwechsel': 'a',
    'E5-rollenwechsel:aiAct.rollen': ['betreiber', 'anbieter'],
    'E5-rollenwechsel:aiAct.begruendung': 'Das eingekaufte System läuft unter unserem Namen im Bewerbungsportal (Art. 25(1) Bst. a): Wir sind zusätzlich Anbieter.',
    'E5-risikoklasse:aiAct.risikoklasse': 'hochrisiko-anhang-iii',
    'E5-risikoklasse:aiAct.anhangIiiBereich': '4a',
    'E5-risikoklasse:aiAct.ausnahmeArt63': false,
    'E5-risikoklasse:aiAct.art5.ergebnis': 'keine',
    'E5-risikoklasse:aiAct.produkt.anhangI': 'nein',
    'E5-risikoklasse:aiAct.profiling': 'ja',
    'E5-gpai:aiAct.gpai': false,
    'E7-triage:triage.rechtspositionOderChancen': true,
    'E7-ergebnis:sensibleNutzung': true,
    'E7-triage:triage.automatisierteEntscheidung': true,
    'E7-triage-ergebnis:triage.ergebnis': 'voll',
    // Je Ziel ein eigener Text mit eigenem Ausmass (F44: wortgleiche Zellen zeigen nicht, dass jedes Ziel geprüft wurde). Das hohe
    // Ausmass bei der Fairness verlangt nach D-08 die eingeschränkte Nutzung mit Auflagen (F46).
    'E7-ziele-a:nutzenSchaden.rechenschaft.nutzen': 'Die Vorsortierung ist je Bewerbung nachvollziehbar protokolliert, die Personalabteilung kann Entscheide belegen.',
    'E7-ziele-a:nutzenSchaden.rechenschaft.schaden': 'Ohne Zuständigkeit für Einzelfälle weiss niemand, wer eine Absage verantwortet.',
    'E7-ziele-a:nutzenSchaden.rechenschaft.ausmass': 2,
    'E7-ziele-a:nutzenSchaden.transparenz.nutzen': 'Bewerbende erfahren in der Eingangsbestätigung, dass eine Software vorsortiert.',
    'E7-ziele-a:nutzenSchaden.transparenz.schaden': 'Wer den Hinweis übersieht, weiss nicht, dass keine Person die erste Durchsicht macht.',
    'E7-ziele-a:nutzenSchaden.transparenz.ausmass': 2,
    'E7-ziele-a:nutzenSchaden.fairness.nutzen': 'Alle Bewerbungen werden nach denselben Kriterien vorsortiert.',
    'E7-ziele-a:nutzenSchaden.fairness.schaden': 'Benachteiligung von Gruppen durch Muster in den Trainingsdaten des Anbieters.',
    'E7-ziele-a:nutzenSchaden.fairness.ausmass': 3,
    'E7-ziele-a:nutzenSchaden.datenschutz.nutzen': 'Lebensläufe bleiben im Portal des Anbieters, nur die Personalabteilung hat Zugriff.',
    'E7-ziele-a:nutzenSchaden.datenschutz.schaden': 'Bewerbungsdaten könnten länger als nötig beim Anbieter liegen.',
    'E7-ziele-a:nutzenSchaden.datenschutz.ausmass': 2,
    'E7-ziele-b:nutzenSchaden.zuverlaessigkeit.nutzen': 'Die Rangliste spart bei hunderten Bewerbungen pro Stelle Wochen an Durchsicht.',
    'E7-ziele-b:nutzenSchaden.zuverlaessigkeit.schaden': 'Geeignete Personen können fälschlich weit unten landen und werden nie gelesen.',
    'E7-ziele-b:nutzenSchaden.zuverlaessigkeit.ausmass': 2,
    'E7-ziele-b:nutzenSchaden.sicherheit.nutzen': 'Die Bewerbungsdaten liegen im gesicherten Portal statt in E-Mail-Postfächern.',
    'E7-ziele-b:nutzenSchaden.sicherheit.schaden': 'Ein Angriff auf das Portal würde viele Bewerbungen gleichzeitig offenlegen.',
    'E7-ziele-b:nutzenSchaden.sicherheit.ausmass': 2,
    'E7-ziele-b:nutzenSchaden.erklaerbarkeit.nutzen': 'Das Portal zeigt je Bewerbung die Kriterien, die zur Platzierung führten.',
    'E7-ziele-b:nutzenSchaden.erklaerbarkeit.schaden': 'Die Gewichtung der Kriterien bleibt für uns ein Geschäftsgeheimnis des Anbieters.',
    'E7-ziele-b:nutzenSchaden.erklaerbarkeit.ausmass': 1,
    'E7-ziele-b:nutzenSchaden.umwelt.nutzen': 'Weniger gedruckte Unterlagen und weniger Versand von Mappen.',
    'E7-ziele-b:nutzenSchaden.umwelt.schaden': 'Der Betrieb der Modelle im Rechenzentrum verbraucht Strom.',
    'E7-ziele-b:nutzenSchaden.umwelt.ausmass': 1,
    'E7-ergebnis:eingeschraenkteNutzung': true,
    'E4-ueberpruefung:sensibleNutzung': true,
    // Sensible Nutzung verlangt ein eigenes Ziel mit Kennzahl (H34): Es nennt das System beim Namen. Die Auswahl des Systems im Feld
    // «KI-Systeme» des Ziels schreibt heute eine Zeichenkette statt einer Liste (Datei lässt sich nicht speichern), darum der Name im Text.
    'E11-ziele:ziel': 'Die Bewerbungsvorauswahl im Bewerbungsportal sortiert niemanden zu Unrecht aus',
    'E11-ziele:kennzahl': 'Anteil der Absagen, die die Personalabteilung nach Prüfung umkehrt',
    'E4-ueberpruefung:auflagen': 'Nur Vorsortierung, jede Absage prüft eine Person der Personalabteilung; Auswertung der Trainingsdaten jährlich beim Anbieter anfordern.',
    'E7-fria:fria.erforderlich': 'nein',
    'E7-fria:fria.begruendung': 'Private Arbeitgeberin ohne öffentliche Dienste, kein Bereich nach Anhang III Nr. 5 Bst. b oder c: keine Grundrechte-Folgenabschätzung nach Art. 27 nötig.',
  };
  delete v['E5-transparenz:aiAct.transparenz'];
  delete v['E9-transparenz:E-07.hinweis'];
  // Betreiber- und Anbieterpflichten (E-05, E-08) erledigt mit Nachweis
  for (const id of ['E9-betreiber-hr', 'E9-betreiber-info', 'E9-anbieter']) {
    for (const f of SEITEN.get(id)!.felder ?? []) if (f.typ === 'checkliste') v[`${id}:${feldKey(f)}`] = { checkliste: `Nachweis ${feldKey(f)} im Ordner KI-001` };
  }
  return v;
}

async function durchlauf(page: Page, o: { isms: 'vorhanden' | 'nein'; modul: boolean; beispiel: boolean; vorgaben?: Vorgaben }): Promise<Durchlauf> {
  const d: Durchlauf = { sprache: 'de', vorgaben: o.vorgaben ?? vorgaben(o.isms !== 'nein', o.modul), beispielUebernehmen: o.beispiel, befunde: [], besucht: [] };
  const formular: string[] = [];
  page.on('framenavigated', (f) => { if (f === page.mainFrame() && /#\/formular/.test(f.url())) formular.push(f.url()); });
  await neuesProjektAnlegen(page, o);
  const etappenGesehen = new Set<string>();
  for (let i = 0; i < 600; i++) {
    const ort = ortAusUrl(page.url());
    expect(page.url(), 'nur Guide').toMatch(/#\/gefuehrt\//);
    if (ort.etappe) etappenGesehen.add(ort.etappe);
    if (ort.seite === 'abschluss') {
      await abschlussBearbeiten(page);
      await expect(page).not.toHaveURL(/abschluss/);
      continue;
    }
    if (ort.seite === 'E13-pruefung') break;
    await seiteBearbeiten(page, d);
  }
  // Prüfseite im Guide
  await expect(page).toHaveURL(/#\/gefuehrt\/E13\/E13-pruefung/);
  // Jeder Sprung der Prüfseite bleibt im Guide
  const ziele = await page.locator('.befunde li a.knopf').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
  expect(ziele.filter((h) => !h.startsWith('#/gefuehrt/'))).toEqual([]);
  const pruefseite = SEITEN.get('E13-pruefung')!;
  const fehlt = await seiteHatHilfe(page, 'de', pruefseite);
  if (fehlt.length) d.befunde.push(`E13-pruefung: fehlt ${fehlt.join(', ')}`);
  expect([...etappenGesehen]).toEqual(ETAPPEN.filter((e) => e.id !== 'J').map((e) => e.id));
  expect(formular, 'Formularansicht nicht benötigt').toEqual([]);
  return d;
}

/** Befunde der Prüfseite als Text (Regel und Titel). */
async function befundListe(page: Page): Promise<string[]> {
  return page.locator('.befunde li').evaluateAll((lis) => lis.map((li) => li.textContent?.replace(/\s+/g, ' ').trim() ?? ''));
}

async function pruefungZufrieden(page: Page): Promise<void> {
  const ampel = page.locator('[data-bereitschaft]');
  await expect(ampel).toBeVisible();
  const liste = await befundListe(page);
  // Keine Ausnahmeliste (AF-140, QK-77): Der Neuling kommt nur über den Guide ans Ende, und was der Guide «erledigt» nennt,
  // hat die Prüfung zufriedengestellt (AF-139). Befunde nach dem letzten Schritt gäbe es nur, wenn der Guide etwas durchliesse.
  expect(liste, 'Befunde der Prüfung').toEqual([]);
  await expect(page.locator('.ampel-zahlen')).toContainText(/^0 Fehler, 0 Hinweise/);
  // Als Lücke bleibt allein die Freigabe der Pflichtdokumente: Sie geschieht im Bereich Dokumente, nicht im Guide. Alle Etappen
  // gelten als bearbeitet und die Pflichtregister sind gefüllt («Bereit» setzt die Freigabe der Dokumente voraus, C-01).
  const luecken = await page.locator('#pruefung-luecken li').evaluateAll((lis) => lis.map((li) => `${li.getAttribute('data-luecke')}: ${li.textContent?.replace(/\s+/g, ' ').trim()}`));
  expect(luecken.filter((l) => !l.startsWith('dokumente:')), 'Lücken ausser der Freigabe der Dokumente').toEqual([]);
}

/**
 * Fester Stichtag (G33: früher blieb H15 ausgenommen): H15 meldet den AI-Act-Stand nach 183 Tagen und hängt nur vom Datum ab. Liegt
 * der Lauf weniger als 150 Tage nach dem Stand der Kataloge, gilt der echte Tag; sonst läuft die App mit page.clock 30 Tage nach
 * dem Stand, und die Eingaben des Tests rechnen mit demselben Tag (STICHTAG_ERZWINGEN=1 nimmt diesen Weg immer).
 */
async function mitStichtag(page: Page): Promise<void> {
  const stand = (parse(readFileSync(join(REPO, 'src/ai-act/stand.yaml'), 'utf8')) as { fassung: { datum: string } }).fassung.datum;
  const tage = (Date.now() - Date.parse(`${stand}T12:00:00Z`)) / 86_400_000;
  // STICHTAG_ERZWINGEN=1: den Weg mit festem Stichtag auch vor Ablauf der 150 Tage prüfen
  if (tage < 150 && !process.env['STICHTAG_ERZWINGEN']) return setzeStichtag(undefined);
  const tag = new Date(Date.parse(`${stand}T12:00:00Z`) + 30 * 86_400_000).toISOString().slice(0, 10);
  setzeStichtag(tag);
  await page.clock.setFixedTime(new Date(`${tag}T12:00:00Z`));
}

test.afterEach(() => setzeStichtag(undefined));

for (const pfad of [
  { name: 'mit ISMS und Modul, Beispiel übernehmen', isms: 'vorhanden', modul: true, beispiel: true },
  { name: 'ohne ISMS, ohne Modul, Angaben selbst', isms: 'nein', modul: false, beispiel: false },
] as const) {
  test(`Volldurchlauf ${pfad.name}`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Testtiefe Chromium');
    test.setTimeout(600_000);
    await mitStichtag(page);
    const { fehler } = await starte(page);
    const d = await durchlauf(page, pfad);
    await pruefungZufrieden(page);
    expect(d.befunde, 'Frage, Erklärung, Beispiel und Normabschnitt auf jeder Seite').toEqual([]);
    expect(d.besucht.length).toBeGreaterThan(pfad.modul ? 110 : 95);
    expect(fehler).toEqual([]);
  });
}

test('Volldurchlauf mit Hochrisiko-System (Betreiber, Anhang III): FRIA-Prüfung, Betreiber- und Anbieterpflichten, Fahrplan', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Testtiefe Chromium');
  test.setTimeout(600_000);
  await mitStichtag(page);
  const { fehler } = await starte(page);
  const d = await durchlauf(page, { isms: 'nein', modul: true, beispiel: false, vorgaben: hochrisikoVorgaben() });
  await pruefungZufrieden(page);
  expect(d.befunde, 'Frage, Erklärung, Beispiel und Normabschnitt auf jeder Seite').toEqual([]);
  // Seiten des Hochrisiko-Pfads wurden durchlaufen
  expect(d.besucht).toEqual(expect.arrayContaining(['E5-rollenwechsel', 'E5-risikoklasse', 'E7-beschreibung', 'E7-fria', 'E7-freigabe', 'E9-betreiber-hr', 'E9-betreiber-info', 'E9-anbieter']));
  // Fahrplan: rückwärts vom Ziel mit Kalenderwochen, PT-Prüfung, erweiterter Umfang wegen Hochrisiko
  await page.evaluate(() => (location.hash = '#/gefuehrt/E0/E0-fahrplan'));
  const fahrplan = page.locator('#fahrplan');
  await expect(fahrplan).toContainText(text('de', 'app.fahrplan.grund.hochrisiko'));
  await expect(fahrplan.locator('tbody tr').first()).toContainText('KW ');
  await expect(page.locator('#fahrplan-pt')).toBeVisible();
  // Inhalte der Seiten stehen in der Projektdatei
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#speichern')]);
  const p = JSON.parse(readFileSync(await dl.path(), 'utf8')) as Projekt;
  const ki = p.kiSysteme[0]!;
  expect(ki.aiAct).toMatchObject({ risikoklasse: 'hochrisiko-anhang-iii', anhangIiiBereich: '4a', rollenwechsel: 'a' });
  expect(ki.aiAct.rollen).toEqual(expect.arrayContaining(['betreiber', 'anbieter']));
  expect(p.folgenabschaetzungen[0]!.fria?.erforderlich).toBe('nein');
  expect(p.meta.checklisten[`E-05.aufsicht.${ki.id}`]?.erledigt).toBe(true);
  expect(p.meta.checklisten[`E-08.bevollmaechtigter.${ki.id}`]?.erledigt).toBe(true);
  expect(fehler).toEqual([]);
});

test('Prüfseite im Guide: jeder Befund führt auf eine Seite des Guides und lässt sich dort beheben', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Testtiefe Chromium');
  test.setTimeout(300_000);
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('pruefung-gefuehrt.aims.json', false, (p) => {
    delete p.kiSysteme[0]!.eigner;
    delete p.organisation.geltungsbereich.freigabe;
    delete p.organisation.leitlinie.freigabe;
    delete p.dokumente[0]!.freigabe;
    p.audits[0]!.durchgefuehrt = '';
    p.controls[5]!.anwendbar = 'offen';
    p.ziele[0]!.bewertung = '';
  }));
  const d: Durchlauf = { sprache: 'de', vorgaben: { 'E12-audit:durchgefuehrt': heute(), 'E8-soa:anwendbar': 'ja', 'E8-soa:status': 'umgesetzt' }, beispielUebernehmen: false, befunde: [], besucht: [] };
  const behoben: string[] = [];
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => (location.hash = '#/gefuehrt/E13/E13-pruefung'));
    await expect(page.locator('[data-bereitschaft]')).toBeVisible();
    const spruenge = page.locator('.befunde li a.knopf');
    const ziele = await spruenge.evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
    expect(ziele.filter((h) => !h.startsWith('#/gefuehrt/')), 'Sprungziele ausserhalb des Guides').toEqual([]);
    if (ziele.length === 0) break;
    await spruenge.first().click();
    await expect(page).toHaveURL(/#\/gefuehrt\/E\d+\//);
    behoben.push(ortAusUrl(page.url()).seite!);
    await seiteBearbeiten(page, d);
  }
  // Keine Befunde mehr. «Bereit» bleibt aus, weil die Datei den Guide nicht durchlaufen hat: Lücken zählen mit (C-01)
  await expect(page.locator('.befunde li')).toHaveCount(0);
  await expect(page.locator('.ampel-zahlen')).toContainText(/^0 Fehler, 0 Hinweise/);
  await expect(page.locator('#pruefung-luecken')).toBeVisible();
  expect(behoben).toEqual(expect.arrayContaining(['E2-freigabe', 'E3-leitlinie-freigabe', 'E4-systeme', 'E8-soa', 'E8-plan-freigabe', 'E11-messplan', 'E12-audit']));
  expect(fehler).toEqual([]);
});
