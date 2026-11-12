// D-00 Gap-Analyse und Projektauftrag (alle Abschnitte, Anhang A)
import type { XlsxBlatt, XlsxMappe, XlsxSpalte, Zellwert } from '../generator/ir.ts';
import { alleAbschnitte42001, alleControls42001 } from '../kataloge/typen.ts';
import { erstelleHelfer, klartext, leer, type VorlagenKontext } from './kontext.ts';

/** Normabschnitt (K-6.1, 6.1) oder Control (A.6.2.4) ohne Präfix «K-» und ohne Schlusspunkt; andere Angaben unverändert */
const normRef = (r: string): string => r.trim().replace(/^K-/i, '').replace(/\.$/, '').toUpperCase();
const NORMREF = /^(?:A\.)?\d+(?:\.\d+)*$/;
/**
 * Bezüge auf Normabschnitte und Controls in herkunft.ref, z. B. «K-6.1; A.6, R-003» oder «K-9». Ein Abschnitt deckt seine
 * Unterabschnitte (6.1 deckt 6.1.1 bis 6.1.4), eine Control-Gruppe ihre Controls (A.6 deckt A.6.1.2 bis A.6.2.8).
 */
export const refsAus = (ref: string | undefined): string[] =>
  (ref ?? '')
    .split(/[,;\s]+/)
    // Ganzes Kapitel nur mit Präfix (K-6), damit eine blosse Zahl im Text nicht ein ganzes Kapitel zuordnet
    .filter((r) => /^K-/i.test(r) || r.includes('.'))
    .map(normRef)
    .filter((r) => NORMREF.test(r));

interface AuftragZeile {
  id: string;
  label: string;
  hinweis: string;
}

export function d00(ctx: VorlagenKontext): XlsxMappe {
  const h = erstelleHelfer(ctx);
  const { u, projekt, kataloge } = ctx;
  const k = (s: string) => `vorlagen.D-00.${s}`;
  const org = projekt.organisation;
  const hinweise = (s: string) => u.liste(k(s)).map((t) => klartext(t));
  const personName = (id?: string) => {
    const p = projekt.personen.find((x) => x.id === id);
    return p ? p.name : (id ?? '');
  };

  // Blatt Projektauftrag (organisation.projektauftrag; Freigabe des Auftrags vor der Freigabe im Dokumentenregister)
  const auftrag = org.projektauftrag;
  const freigabe = auftrag?.freigabe ?? h.dokEintrag('D-00')?.freigabe;
  const zahl = (n?: number) => (n === undefined || n === null ? undefined : n.toLocaleString(u.sprache === 'de' ? 'de-CH' : 'en-GB').replace(/[’']/g, ' '));
  const richtwert = h.istLeer
    ? u.t(k('richtwert_beide'))
    : u.t(k(projekt.meta.mitIsms ? 'richtwert_mit_isms' : 'richtwert_ohne_isms'));
  // Projektteam: festgelegte Mitglieder (projektauftrag.team), sonst Personen mit AIMS-Rollen ohne interne Auditorinnen
  // und Auditoren, damit das interne Audit unabhängig vom Aufbau bleibt (9.2)
  const teamIds = auftrag?.team?.length ? auftrag.team : projekt.personen.filter((p) => p.aimsRollen.length && !p.aimsRollen.includes('auditor')).map((p) => p.id);
  const team = teamIds
    .map((id) => projekt.personen.find((p) => p.id === id))
    .filter((p) => !!p)
    .map((p) => `${p!.name}${p!.funktion ? `, ${p!.funktion}` : ''}`)
    .join('; ');
  const zieltermin = h.datum(org.zielterminZertifizierung);
  const firmaWerte: Record<string, string | undefined> = {
    ziel: auftrag?.ziel || (zieltermin ? u.t(k('ziel_firma'), { datum: zieltermin }) : undefined),
    // Grober Geltungsbereich zum Zeitpunkt des Auftrags; die Aussage aus D-02 nur, wenn keiner erfasst ist
    geltungsbereich: auftrag?.geltungsbereich?.trim() || org.geltungsbereich.beschreibung,
    nutzen: auftrag?.nutzen,
    zieltermin,
    ziel_stage1: h.datum(org.zielterminStage1),
    aufwand_intern:
      auftrag?.aufwandPt !== undefined
        ? auftrag.pensumProzent !== undefined
          ? u.t(k('aufwand_mit_pensum'), { pt: zahl(auftrag.aufwandPt)!, pensum: zahl(auftrag.pensumProzent)! })
          : zahl(auftrag.aufwandPt)
        : undefined,
    aufwand_extern: zahl(auftrag?.budget),
    projektleitung: org.aimsVerantwortlich ? klartext(h.personText(org.aimsVerantwortlich)) : undefined,
    sponsor: auftrag?.sponsor ? klartext(h.personText(auftrag.sponsor)) : undefined,
    team,
    meilensteine: auftrag?.meilensteine?.length ? auftrag.meilensteine.map((m) => (m.termin ? `${m.was} (${h.datum(m.termin)})` : m.was)).join('; ') : undefined,
    risiken: auftrag?.risiken,
    freigabe_von: freigabe ? klartext(h.personText(freigabe.von)) : undefined,
    freigabe_am: h.datum(freigabe?.am),
  };
  const platzhalter: Record<string, string> = { zieltermin: 'datum', ziel_stage1: 'datum', freigabe_am: 'datum', projektleitung: 'person', sponsor: 'person', freigabe_von: 'freigabe', aufwand_intern: 'zahl', aufwand_extern: 'zahl' };
  const auftragZeilen: Zellwert[][] = (u.roh(k('auftrag')) as AuftragZeile[]).map((z) => {
    const wert = h.istLeer ? undefined : firmaWerte[z.id];
    const fehlt = leer(wert);
    const inhalt = !fehlt
      ? wert!
      : z.id === 'ziel'
        ? klartext(u.t(k('ziel_vorschlag')))
        : klartext(h.wert(undefined, platzhalter[z.id] ?? 'text'));
    // Hinweise in Firmendokumenten nur dort, wo Angaben fehlen
    const hinweis = h.istLeer || fehlt ? z.hinweis.replace('{richtwert}', richtwert) : '';
    return [z.label, inhalt, hinweis];
  });

  // Gap-Blätter Normabschnitte und Controls
  const sp = u.liste(k('spalten_gap'));
  const reife = ['0', '1', '2', '3', '4', '5'];
  const gapSpalten = (bezeichnungBreite: number): XlsxSpalte[] => [
    { kopf: sp[0]!, breite: 9 },
    { kopf: sp[1]!, breite: bezeichnungBreite, umbruch: true },
    { kopf: sp[2]!, breite: 34, umbruch: true },
    { kopf: sp[3]!, breite: 40, umbruch: true },
    { kopf: sp[4]!, breite: 8, typ: 'liste', liste: reife },
    { kopf: sp[5]!, breite: 8, typ: 'liste', liste: reife },
    { kopf: sp[6]!, breite: 7, typ: 'formel', formel: '=IF(AND(E{r}<>"",F{r}<>""),F{r}-E{r},"")' },
    { kopf: sp[7]!, breite: 32, umbruch: true },
    { kopf: sp[8]!, breite: 18 },
    { kopf: sp[9]!, breite: 12, typ: 'datum' },
    // Firmendokument mit Normtexten der Firma (nach Bestätigung): Anforderungstext als letzte Spalte
    ...(h.mitNormtext ? [{ kopf: u.t('allgemein.normtext.spalte_anforderung'), breite: 60, umbruch: true }] : []),
  ];
  // Massnahmen aus dem Projekt, die sich auf einen Abschnitt oder ein Control beziehen (herkunft.ref, auch als Liste)
  const massnahmenZu = (id: string) => {
    const kern = normRef(id);
    return projekt.massnahmen.filter(
      (m) => m.status !== 'verworfen' && refsAus(m.herkunft.ref).some((r) => kern === r || kern.startsWith(`${r}.`)),
    );
  };
  // Ist- und Soll-Reife aus projekt.gapAnalyse. Die Soll-Reife bleibt leer, bis sie festgelegt ist (typisch 3, siehe Hinweis).
  const gap = h.istLeer ? undefined : projekt.gapAnalyse;
  const gapZeile = (id: string, titel: string, nachweis: string, ist = '', verantwortlich = '', eintrag?: { ist?: number; soll?: number; beschreibung?: string }): Zellwert[] => {
    const m = h.istLeer ? [] : massnahmenZu(id);
    return [
      id,
      titel,
      nachweis,
      h.istLeer ? '' : eintrag?.beschreibung || ist,
      eintrag?.ist ?? null,
      eintrag?.soll ?? null,
      // Lücke: berechnet (Formel), mit Ergebnis für Leser ohne Neuberechnung
      eintrag?.ist !== undefined && eintrag?.soll !== undefined ? eintrag.soll - eintrag.ist : null,
      m.map((x) => `${x.id} ${x.titel}`).join('; '),
      // Verantwortlich für die Massnahme zur Lücke; ohne Massnahme die verantwortliche Person des Controls
      h.istLeer ? '' : personName(m[0]?.verantwortlich) || verantwortlich,
      h.istLeer ? null : (m[0]?.termin ?? null),
      ...(h.mitNormtext ? [h.normAnforderung(id) ?? ''] : []),
    ];
  };
  const abschnittZeilen = alleAbschnitte42001(kataloge).map((a) =>
    gapZeile(a.id, h.normTitel(a.id), u.t(`anforderungen42001.abschnitte.${a.id}.nachweis`), '', '', gap?.abschnitte?.[a.id]),
  );
  const controlZeilen = alleControls42001(kataloge).map((c) => {
    const e = projekt.controls.find((x) => x.id === c.id);
    // Ist-Beschreibung nur aus der Gap-Analyse (Stand zum Datum der Analyse), nicht aus dem Umsetzungsstand der SoA (N-36)
    return gapZeile(c.id, h.normTitel(c.id), u.t(`controls42001.controls.${c.id}.nachweis`), '', personName(e?.verantwortlich), gap?.controls?.[c.id]);
  });
  // Firmendokument: keine Hinweise an Ausfüllende; Ist- und Soll-Reife stehen, soweit erfasst (projekt.gapAnalyse)
  const gapBlatt = (name: string, titel: string, hinw: string, zeilen: Zellwert[][], breite: number): XlsxBlatt => ({
    name: u.t(k(`blaetter.${name}`)),
    titel: u.t(k(titel)),
    hinweise: h.istLeer ? hinweise(hinw) : undefined,
    fixiert: true,
    ampel: { spalte: 6, gruenBis: 0, gelbBis: 1 },
    // Reifegrad Ist und Soll (0 bis 5) als Datenbalken
    formate: [
      { art: 'datenbalken', spalte: 4, min: 0, max: 5 },
      { art: 'datenbalken', spalte: 5, min: 0, max: 5 },
    ],
    spalten: gapSpalten(breite),
    zeilen,
  });

  // Schnellcheck mit Ampel je Kapitel
  const [ja, teilweise, nein] = u.liste(k('antworten')) as [string, string, string];
  const [gruen, gelb, rot] = u.liste(k('ampel')) as [string, string, string];
  const fragen = u.roh(k('schnellcheck')) as { kapitel: string; frage: string }[];
  // Antworten aus der groben Einschätzung je Kapitel (gapAnalyse.kapitel, Startinterview): erfüllt = Ja, begonnen und
  // weitgehend = Teilweise, fehlt = Nein. Die Frage zum Inventar (erste Frage zu Kapitel 4) folgt der Einschätzung «inventar».
  const grob = gap?.kapitel;
  const antwort = (f: { kapitel: string }, i: number): string | null => {
    const schluessel = i === 0 ? 'inventar' : `k${f.kapitel.slice(2)}`;
    const r = grob?.[schluessel as keyof NonNullable<typeof grob>];
    return r === 'erfuellt' ? ja : r === 'fehlt' ? nein : r ? teilweise : null;
  };
  // Punkte, Kapitelwert und Ampel als Ergebnis der Formeln mitgeben (sichtbar ohne Neuberechnung)
  const punkte = (a: string | null): number | null => (a === ja ? 0 : a === teilweise ? 1 : a === nein ? 2 : null);
  const antworten = fragen.map((f, i) => antwort(f, i));
  const kapitelWert = (kap: string): number | null => {
    const werte = fragen.map((f, i) => (f.kapitel === kap ? punkte(antworten[i]!) : undefined)).filter((x) => x !== undefined);
    return werte.some((x) => x === null) || !werte.length ? null : Math.round(((werte as number[]).reduce((a, b) => a + b, 0) / werte.length) * 10) / 10;
  };
  const ampelText = (w: number | null): string | null => (w === null ? null : w <= 0 ? gruen : w <= 1 ? gelb : rot);
  const schnellZeilen: Zellwert[][] = fragen.map((f, i) => {
    const kw = kapitelWert(f.kapitel);
    return [i + 1, `${f.kapitel.slice(2)} ${h.normTitel(f.kapitel)}`, f.frage, antworten[i]!, punkte(antworten[i]!), kw, ampelText(kw), null];
  });
  const ss = u.liste(k('spalten_schnellcheck'));

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    eigenschaften: h.eigenschaften('D-00'),
    lenkung: h.lenkung('D-00'),
    firmenname: h.firmenname(),
    hinweisBlock: [...h.kitBlock(), h.normverweis('4 bis 10 und Anhang A'), ...h.ausbau(k('ausbau_wiederholung'), [])],
    blaetter: [
      {
        name: u.t(k('blaetter.auftrag')),
        titel: u.t(k('titel_auftrag')),
        hinweise: h.istLeer ? hinweise('hinweise_auftrag') : undefined,
        spalten: [
          { kopf: u.liste(k('spalten_auftrag'))[0]!, breite: 30, umbruch: true },
          { kopf: u.liste(k('spalten_auftrag'))[1]!, breite: 60, umbruch: true },
          { kopf: u.liste(k('spalten_auftrag'))[2]!, breite: 50, umbruch: true },
        ],
        zeilen: auftragZeilen,
      },
      gapBlatt('abschnitte', 'titel_abschnitte', 'hinweise_abschnitte', abschnittZeilen, 30),
      gapBlatt('controls', 'titel_controls', 'hinweise_controls', controlZeilen, 30),
      {
        name: u.t(k('blaetter.reifegrade')),
        titel: u.t(k('titel_reifegrade')),
        // Der Hinweis zur Konformität gilt immer, nicht nur in der leeren Vorlage (Firmendokument: als Festlegung)
        hinweise: hinweise(h.istLeer ? 'hinweise_reifegrade' : 'hinweise_reifegrade_firma'),
        spalten: u.liste(k('spalten_reifegrade')).map((s, i) => ({ kopf: s, breite: [8, 24, 60, 40][i], umbruch: i > 0 })),
        // Stufe 0 bis 5 in der Farbskala des Reifegrads
        formate: [{ art: 'farbskala', spalte: 0, min: 0, max: 5 }],
        zeilen: u.roh(k('reifegrade')) as Zellwert[][],
      },
      {
        name: u.t(k('blaetter.schnellcheck')),
        titel: u.t(k('titel_schnellcheck')),
        // Firmendokument: Stand und Bedeutung der Ampel, keine Anleitung zum Ablauf
        hinweise: h.istLeer
          ? hinweise('hinweise_schnellcheck')
          : hinweise('hinweise_schnellcheck_firma').map((t) => t.replace('{datum}', h.datum(gap?.datum) ?? h.datum(freigabe?.am) ?? '')),
        fixiert: true,
        // Kapitelwert erst, wenn alle Fragen des Kapitels beantwortet sind: 0 = alles ja (grün), bis 1 = im Mittel teilweise (gelb), darüber rot
        ampel: { spalte: 5, gruenBis: 0, gelbBis: 1 },
        // Ampel als Wort zusätzlich farbig
        formate: [{ art: 'text', spalte: 6, regeln: [{ text: gruen, rolle: 'status-gut' }, { text: gelb, rolle: 'status-warnung' }, { text: rot, rolle: 'status-kritisch' }] }],
        spalten: [
          { kopf: ss[0]!, breite: 5, typ: 'zahl' },
          { kopf: ss[1]!, breite: 22, umbruch: true },
          { kopf: ss[2]!, breite: 60, umbruch: true },
          { kopf: ss[3]!, breite: 11, typ: 'liste', liste: [ja, teilweise, nein] },
          { kopf: ss[4]!, breite: 8, typ: 'formel', formel: `=IF(D{r}="${ja}",0,IF(D{r}="${teilweise}",1,IF(D{r}="${nein}",2,"")))` },
          { kopf: ss[5]!, breite: 11, typ: 'formel', formel: '=IF(COUNTIFS(B:B,B{r},E:E,">=0")<COUNTIF(B:B,B{r}),"",ROUND(AVERAGEIF(B:B,B{r},E:E),1))' },
          { kopf: ss[6]!, breite: 11, typ: 'formel', formel: `=IF(F{r}="","",IF(F{r}<=0,"${gruen}",IF(F{r}<=1,"${gelb}","${rot}")))` },
          { kopf: ss[7]!, breite: 30, umbruch: true },
        ],
        zeilen: schnellZeilen,
      },
    ],
  });
}
