// D-21 Managementbewertung: Agenda und Protokoll (9.3, 5.1, A.2.4)
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import type { Managementbewertung, MbTraktandum, Projekt } from '../model/typen.ts';
import type { Helfer } from './kontext.ts';
import { erstelleHelfer, leer, md, type VorlagenKontext } from './kontext.ts';
import { ergaenzungsAbschnitte } from './ergaenzungsblatt.ts';
import { kennzahlVerlaeufe, massnahmenNachFaelligkeit, soaJeGruppe } from '../grafik/daten.ts';
import { kennzahlDiagramm, massnahmenDiagramm, projektMatrix, risikomatrixBlock, soaDiagramm, zonenMatrix } from './grafik.ts';
import { prozessTexte, REIFE_SCHLUESSEL } from '../prozesse/katalog.ts';
import { imDashboard, prozessStaende, prozessUebersicht } from '../prozesse/stand.ts';
import { landkarteBlock, REIFE_ROLLE } from '../prozesse/landkarte.ts';

/** Höchstens so viele Kennzahlen als Linie im Lagebild (Anlage) */
const LAGEBILD_KENNZAHLEN = 3;

interface Punkt {
  /** Schlüssel des Traktandums (Managementbewertung.ergebnisse), nur bei den empfohlenen Punkten */
  id?: MbTraktandum;
  punkt: string;
  unterlagen: string;
  modul?: boolean;
}

/** ISO-Datum plus ein Jahr */
function plusJahr(iso: string): string {
  const [j, m, t] = iso.slice(0, 10).split('-');
  return `${Number(j) + 1}-${m}-${t}`;
}

/**
 * Pflichteingaben «Überwachung, Messung, Zielerreichung» und «Auditergebnisse» (Nr. 5 und 6): eigener Text der
 * Bewertung oder, wenn er fehlt, Zusammenfassung aus den Projektdaten bis zum Datum der Bewertung (letzte Messung je
 * Ziel; Audits mit Feststellungen).
 */
function abgeleitet(ctx: VorlagenKontext, h: Helfer, projekt: Projekt, mb: Managementbewertung) {
  const { u } = ctx;
  const a = (s: string) => `vorlagen.D-21.abgeleitet.${s}`;
  const bis = mb.datum ?? '9999-12-31';
  const messung = (): string => {
    if (mb.eingaben.messung?.trim()) return mb.eingaben.messung;
    return projekt.ziele
      .filter((z) => z.status !== 'verworfen')
      .map((z) => {
        const m = z.messungen.filter((x) => x.datum <= bis).sort((x, y) => x.datum.localeCompare(y.datum)).at(-1);
        const kennzahl = z.kennzahl || z.ziel;
        if (!m) return u.t(a('keine_messung'), { id: z.id, kennzahl });
        const text = u.t(a('messung'), { id: z.id, kennzahl, wert: m.wert, datum: h.datum(m.datum)! });
        return m.sollErreicht ? `${text} (${u.t(a('soll'), { soll: u.t(a(`soll_wert.${m.sollErreicht}`)) })})` : text;
      })
      .join('; ');
  };
  const audits = (): string => {
    if (mb.eingaben.audits?.trim()) return mb.eingaben.audits;
    return projekt.audits
      .filter((x) => x.durchgefuehrt && x.durchgefuehrt <= bis)
      .map((x) => {
        const werte = { id: x.id, art: u.t(a(`audit_art.${x.art}`)), datum: h.datum(x.durchgefuehrt)!, ergebnis: x.ergebnis };
        const text = u.t(a(x.ergebnis.trim() ? 'audit' : 'audit_ohne_ergebnis'), werte);
        // Feststellungen, die das Ergebnis nicht schon nennt
        const f = projekt.feststellungen.filter((y) => y.audit === x.id && !x.ergebnis.includes(y.id));
        return f.length ? `${text} (${u.t(a('feststellungen'), { liste: f.map((y) => `${y.id} ${u.t(a(`einstufung.${y.einstufung}`))}`).join(', ') })})` : text;
      })
      .join('; ');
  };
  return { messung: messung(), audits: audits() };
}

/**
 * Stand der Prozesse zum Datum der Bewertung (Plan Prozesse 5.3): Zusammenfassung für das Traktandum und Tabelle für das
 * Lagebild (Prozess, Eigner, Reife, Veränderung seit der letzten Bewertung, Befunde).
 */
function prozessStand(ctx: VorlagenKontext, h: Helfer, mb: Managementbewertung | undefined): { ergebnis: string; bloecke: Block[] } {
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-21.prozesse.${s}`;
  const stichtag = (mb?.datum ?? projekt.meta.geaendert).slice(0, 10);
  const liste = prozessStaende(projekt, ctx.kataloge, stichtag).filter(imDashboard);
  const ue = prozessUebersicht(liste);
  const reife = (r: number) => u.t(`prozesse.reifeskala.${REIFE_SCHLUESSEL[r]}.titel`);
  const verteilung = ue.reife.map((n, i) => (n ? `${n} ${reife(i)}` : '')).filter(Boolean).join(', ');
  const ergebnis = mb?.eingaben.prozesse?.trim()
    ? mb.eingaben.prozesse
    : u.t(k('zusammenfassung'), { anzahl: ue.gesamt, verteilung: verteilung || '0', ohne: ue.ohneEigner.length, ueberfaellig: ue.ueberfaellig.length, massnahmen: ue.massnahmenOffen });
  // Vorherige Bewertung mit eingefrorenem Stand: Veränderung der Reife
  const vorher = projekt.managementbewertungen.filter((x) => x !== mb && x.datum && x.datum < stichtag && x.prozesse?.length).at(-1);
  const zeilen: Text[][] = liste.map((s) => {
    const alt = vorher?.prozesse?.find((x) => x.id === s.id)?.reife;
    // Offene Feststellungen und Massnahmen des Prozesses (Zuordnung wie im Stand der Prozesse: Angabe, Bereich, Controls)
    const offen = s.massnahmenOffen.filter((m) => !s.massnahmenUeberfaellig.includes(m));
    const befunde = [
      s.ueberfaellig ? u.t(k('befund_ueberfaellig')) : '',
      s.feststellungenOffen.length ? u.t(k('befund_feststellungen'), { liste: s.feststellungenOffen.join(', ') }) : '',
      s.massnahmenUeberfaellig.length ? u.t(k('befund_massnahmen'), { liste: s.massnahmenUeberfaellig.join(', ') }) : '',
      offen.length ? u.t(k('befund_massnahmen_offen'), { liste: offen.join(', ') }) : '',
      !s.eigner ? u.t(k('befund_eigner')) : '',
    ].filter(Boolean).join('; ');
    return [
      `${s.id} ${prozessTexte(u, s.id, projekt)?.titel ?? ''}`,
      h.personText(s.eigner, 'eigner'),
      reife(s.reife),
      alt === undefined ? '' : alt === s.reife ? u.t(k('gleich')) : `${reife(alt)} → ${reife(s.reife)}`,
      befunde,
    ];
  });
  return {
    ergebnis,
    bloecke: [
      { typ: 'ueberschrift', ebene: 2, text: u.t(k('titel')) },
      { typ: 'absatz', text: u.t(k('einleitung'), { datum: h.datum(stichtag) ?? '' }) },
      { typ: 'tabelle', kopf: u.liste(k('kopf')), zeilen, breiten: [36, 18, 14, 14, 18] },
      // Prozesslandkarte eingefärbt nach Reife (feste Statusfarben, Stufe als Wort in jeder Form)
      ...(liste.length
        ? [
            landkarteBlock(
              liste.map((s) => ({ id: s.id, gruppe: s.gruppe, text: `${s.id} ${prozessTexte(u, s.id, projekt)?.titel ?? ''}\n${reife(s.reife)}`, rolle: REIFE_ROLLE[s.reife] })),
              (g) => u.t(`prozesse.gruppen.${g}`),
              { titel: u.t(k('landkarte_titel')), beschreibung: u.t(k('landkarte_alt'), { verteilung: verteilung || '0' }) },
            ),
          ]
        : []),
    ],
  };
}

export function d21(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-21.${s}`;
  const eb = ctx.form === 'ergaenzungsblatt';
  const org = projekt.organisation;
  const mb = h.istLeer ? undefined : projekt.managementbewertungen.at(-1);
  const vorher = h.istLeer ? undefined : projekt.managementbewertungen.at(-2);
  const ph = (s: string): Text => [{ text: u.t(k(`platzhalter.${s}`)), platzhalter: true }];
  const feld = (v: string | undefined, platzhalter: string): Text => (!h.istLeer && !leer(v) ? v! : ph(platzhalter));
  const datumOderPlatzhalter = (iso?: string) => h.datum(iso) ?? `[[${u.t('allgemein.platzhalter.datum')}]]`;
  const personName = (id?: string) => projekt.personen.find((p) => p.id === id)?.name ?? id ?? '';

  // ISMS-Punkte nur in der leeren Vorlage und im Pfad mit ISMS (ohne ISMS ist eine gemeinsame Sitzung nicht möglich)
  const zeigeIsms = h.istLeer || projekt.meta.mitIsms;
  // Mit ISMS verweisen Firmendokumente auf die IDs im Pfad der Firma (D-04-EB statt D-04; D-03 und D-07 bleiben)
  const unterlagen = (text: string) => h.verweise(text);
  const zeigeModul = h.istLeer || projekt.meta.modulAiAct;

  // Agenda und Protokoll in einer Tabelle je Gruppe; Nummern laufen durch
  let nr = 0;
  const kopf = u.liste(k('agenda_kopf'));
  const zeilen = (punkte: Punkt[], ergebnisse: (string | undefined)[] = [], markierung?: string): Text[][] =>
    punkte.map((p, i) => {
      nr++;
      const mark = p.modul && h.istLeer ? ` ${u.t(k('markierung.modul'))}` : markierung && h.istLeer ? ` ${markierung}` : '';
      return [String(nr), `${p.punkt}${mark}`, unterlagen(p.unterlagen), ergebnisse[i] ?? ''];
    });
  // Mit Protokoll (Firmendokument mit Bewertung) erhält die Spalte «Ergebnis» mehr Platz; das hält das Protokoll bei 4 Seiten
  const tabelle = (z: Text[][]): Block => ({ typ: 'tabelle', kopf, zeilen: z, breiten: mb ? [5, 33, 17, 45] : [6, 44, 22, 28] });

  const e = mb?.eingaben;
  const aus = mb ? abgeleitet(ctx, h, projekt, mb) : undefined;
  // Erste Bewertung: keine früheren Managementbewertungen, deren Massnahmen zu bewerten wären
  const ersteBewertung = !!mb && !vorher;
  const pflicht = (u.roh(k('pflicht')) as Punkt[]).map((p, i) => (i === 0 && ersteBewertung ? (u.roh(k('erste_massnahmen')) as Punkt) : p));
  const empfohlen = (u.roh(k('empfohlen')) as Punkt[]).filter((p) => !p.modul || zeigeModul);
  // Stand der Prozesse als Eingabe (nur wenn das Projekt Prozesse führt): eigener Text der Bewertung oder Zusammenfassung
  // zum Datum der Bewertung; Tabelle mit Reife, Veränderung seit der letzten Bewertung und Befunden in der Anlage
  const mitProzessen = !h.istLeer && projekt.prozesse !== undefined;
  const pz = mitProzessen ? prozessStand(ctx, h, mb) : undefined;
  // Leere Vorlage: Traktandum ebenfalls, damit das Prozesssystem auch ohne Werkzeug in die Bewertung einfliesst
  if (pz || h.istLeer) empfohlen.push({ punkt: u.t(k('prozesse.punkt')), unterlagen: u.t(k('prozesse.unterlagen')) });
  const isms = u.roh(k('isms')) as Punkt[];
  const pflichtErgebnisse = [e?.statusMassnahmen, e?.aenderungenThemen, e?.aenderungenParteien, e?.leistung, aus?.messung, aus?.audits, e?.verbesserungen];
  const pflichtZeilen = zeilen(pflicht, pflichtErgebnisse);
  const empfohlenErgebnisse = empfohlen.map((p) => (p.id ? mb?.ergebnisse?.[p.id] : p === empfohlen.at(-1) && pz ? pz.ergebnis : undefined));
  const empfohlenZeilen = zeilen(empfohlen, empfohlenErgebnisse);
  // Weitere Themen der Bewertung als eigenes Traktandum (nicht als Zeile ohne Traktandum)
  const weitereZeile = (): Text[] => [String(++nr), u.t(k('weitere_punkt')), '', e!.weitere];
  if (!eb && e && !leer(e.weitere)) empfohlenZeilen.push(weitereZeile());
  const ismsZeilen = zeigeIsms ? zeilen(isms, [], u.t(k('markierung.isms'))) : [];

  // Entscheide und Massnahmen. Der zusammenfassende Entscheid (mb.entscheide) steht als Absatz vor der Tabelle, wenn es
  // zusätzlich einzelne Entscheide gibt; sonst als Zeile der Tabelle.
  const entscheidAlsAbsatz = !!mb && !leer(mb.entscheide) && !!mb.entscheideListe?.length;
  const entscheide: Block = {
    typ: 'tabelle',
    kopf: u.liste(k('entscheide_kopf')),
    zeilen:
      mb && (!leer(mb.entscheide) || mb.entscheideListe?.length)
        ? [
            ...(!leer(mb.entscheide) && !entscheidAlsAbsatz ? [['', mb.entscheide, '', ''] as Text[]] : []),
            ...(mb.entscheideListe ?? []).map((x, i): Text[] => [
              String(i + 1),
              x.text,
              u.t(k(`entscheide_art.${x.art}`)),
              // Massnahme nur, wenn sie zum Entscheid gehört: nicht vor der Bewertung erledigt (sonst Doppelbelegung, z. B. bei jährlichen Prüfungen)
              [
                x.verantwortlich ? personName(x.verantwortlich) : '',
                x.termin ? u.t(k('entscheid_bis'), { datum: h.datum(x.termin)! }) : '',
                x.massnahme && !projekt.massnahmen.some((m) => m.id === x.massnahme && m.status === 'erledigt' && (m.erledigtAm ?? m.termin ?? '') <= (mb.datum ?? '')) ? x.massnahme : '',
              ].filter(Boolean).join(', '),
            ]),
          ]
        : [['1', h.wert(undefined, 'text'), md(u.t(k('entscheide_leer'))), h.wert(undefined, 'text')]],
    breiten: [6, 46, 22, 26],
    // Firmendokument: keine leeren Zeilen in den Tabellen des Protokolls
    leereZeilen: h.istLeer ? 3 : 0,
  };
  const massnahmen = h.istLeer
    ? []
    : projekt.massnahmen.filter((m) => m.herkunft.art === 'managementbewertung' || mb?.massnahmen.includes(m.id));
  const massnahmenTabelle: Block = {
    typ: 'tabelle',
    kopf: u.liste(k('massnahmen_kopf')),
    zeilen: massnahmen.map((m) => [m.id, m.titel, personName(m.verantwortlich), h.datum(m.termin) ?? '', u.t(k(`massnahme_status.${h.massnahmeStatusAm(m, mb?.datum)}`))]),
    breiten: [10, 46, 20, 12, 12],
    leereZeilen: h.istLeer ? 4 : massnahmen.length ? 0 : 2,
  };
  const naechste = mb?.datum ? datumOderPlatzhalter(plusJahr(mb.datum)) : `[[${u.t('allgemein.platzhalter.datum')}]]`;
  const freigabeDatum = datumOderPlatzhalter(h.dokEintrag(eb ? 'D-21-EB' : 'D-21')?.freigabe?.am ?? mb?.datum);

  const rahmen: Block = {
    typ: 'felder',
    felder: [
      // Kennung, unter der andere Dokumente das Protokoll zitieren (z. B. MB-001)
      ...(mb ? [{ label: u.t(k('felder.kennung')), wert: mb.id }] : []),
      { label: u.t(k('felder.datum')), wert: h.wert(h.datum(mb?.datum), 'datum') },
      { label: u.t(k('felder.ort')), wert: feld(mb?.ort, 'ort') },
      { label: u.t(k('felder.leitung')), wert: h.personText(mb?.leitung) },
      { label: u.t(k('felder.teilnehmende')), wert: feld(mb?.teilnehmende, 'teilnehmende') },
      // Protokoll führt die Eignerin oder der Eigner des Dokuments
      { label: u.t(k('felder.protokoll')), wert: h.personText(mb ? h.dokEintrag(eb ? 'D-21-EB' : 'D-21')?.eigner : undefined) },
      {
        label: u.t(k('felder.zeitraum')),
        wert: mb?.zeitraum ? u.t(k('zeitraum_text'), { von: h.datum(mb.zeitraum.von)!, bis: h.datum(mb.zeitraum.bis)! }) : ph('zeitraum'),
      },
      { label: u.t(k('felder.vorher')), wert: h.istLeer || !mb ? ph('vorher') : vorher?.datum ? h.datum(vorher.datum)! : u.t(k('erste_bewertung')) },
      // Ohne ISMS und ohne gemeinsame Sitzung gibt es keine Angabe zum ISMS
      ...(zeigeIsms
        ? [
            {
              label: u.t(k('felder.isms')),
              wert: mb ? u.t(mb.kombiniertMitIsms ? 'allgemein.ja' : 'allgemein.nein') : ([{ text: u.t('allgemein.platzhalter.ja_nein'), platzhalter: true }] as Text),
            },
          ]
        : []),
    ],
  };

  const beurteilung: Block = {
    typ: 'felder',
    felder: (['geeignet', 'angemessen', 'wirksam'] as const).map((f) => {
      const b = mb?.gesamtbeurteilung?.[f];
      return {
        label: u.t(k(`beurteilung_felder.${f}`)),
        wert: b ? `${u.tOpt(k(`beurteilung_urteil.${b.urteil}`)) ?? u.t(`allgemein.${b.urteil}`)}${b.begruendung ? `: ${b.begruendung}` : ''}` : ([{ text: u.t(k('beurteilung_platzhalter')), platzhalter: true }] as Text),
      };
    }),
  };

  const schluss = (start: number): Block[] => [
    { typ: 'ueberschrift', ebene: 1, text: `${start} ${u.t(k('abschnitte.beurteilung'))}` },
    beurteilung,
    { typ: 'ueberschrift', ebene: 1, text: `${start + 1} ${u.t(k('abschnitte.entscheide'))}` },
    ...h.hinweis(k('hinweis_entscheide')),
    ...(entscheidAlsAbsatz ? [{ typ: 'absatz', text: mb!.entscheide } as Block] : []),
    entscheide,
    { typ: 'ueberschrift', ebene: 1, text: `${start + 2} ${u.t(k('abschnitte.massnahmen'))}` },
    ...h.hinweis(k('massnahmen_hinweis')),
    massnahmenTabelle,
  ];

  const freigabe = (nummer: number): Block[] => [
    { typ: 'ueberschrift', ebene: 1, text: `${nummer} ${u.t(k('abschnitte.freigabe'))}` },
    { typ: 'absatz', text: md(u.t(k('freigabe_text'), { datum: freigabeDatum })) },
    // Bekannte Freigabe des Protokolls und Sitzungsleitung; sonst zwei Zeilen «Name, Funktion»
    h.unterschriften([h.dokEintrag(eb ? 'D-21-EB' : 'D-21')?.freigabe, mb?.leitung ? { von: mb.leitung, am: mb.datum ?? '' } : undefined], 2),
  ];

  // Lagebild als Anlage (zählt nicht zur Seitenvorgabe): Risikomatrix vor und nach Behandlung, Umsetzung der Controls je
  // Gruppe, Verlauf der Kennzahlen mit Zahlen bis zum Datum der Bewertung. Leere Vorlage: Matrix mit den Stufen.
  const lagebild = (): Block[] => {
    const g = (s: string) => `vorlagen.grafik.${s}`;
    const titel = u.t(g('lagebild.titel'));
    if (h.istLeer) {
      return h.grafikAnlage(titel, [
        { typ: 'absatz', text: u.t(g('lagebild.einleitung_leer')) },
        risikomatrixBlock(ctx, zonenMatrix(ctx), { titel: u.t(g('matrix.titel_zonen')), mitAnzahl: false }),
      ]);
    }
    if (!mb) return [];
    const stichtag = mb.datum ?? mb.zeitraum?.bis;
    const verlaeufe = kennzahlVerlaeufe(projekt, stichtag).slice(0, LAGEBILD_KENNZAHLEN);
    const gruppen = soaJeGruppe(projekt, ctx.kataloge.controls42001.gruppen);
    return h.grafikAnlage(titel, [
      { typ: 'absatz', text: u.t(g('lagebild.einleitung'), { datum: h.datum(stichtag) ?? '' }) },
      risikomatrixBlock(ctx, projektMatrix(ctx, 'vor'), { titel: u.t(g('matrix.titel_vor')), mitAnzahl: true, legende: false }),
      risikomatrixBlock(ctx, projektMatrix(ctx, 'nach'), { titel: u.t(g('matrix.titel_nach')), mitAnzahl: true }),
      // Geplant oder erreicht: Wie viele Restwerte setzen noch offene Massnahmen voraus? (6.1.3, 8.3)
      ...(() => {
        const offen = new Set(projekt.massnahmen.filter((m) => h.massnahmeStatusAm(m, stichtag) !== 'erledigt' && m.status !== 'verworfen').map((m) => m.id));
        const anzahl = projekt.risiken.filter((r) => r.massnahmen.some((m) => offen.has(m))).length;
        return anzahl ? [{ typ: 'absatz', text: u.t(g('matrix.nach_offen'), { anzahl }) } as Block] : [];
      })(),
      ...(projekt.controls.length ? [soaDiagramm(ctx, gruppen)] : []),
      ...(projekt.massnahmen.length && stichtag ? [massnahmenDiagramm(ctx, h, massnahmenNachFaelligkeit(projekt.massnahmen, stichtag), stichtag)] : []),
      ...(verlaeufe.length
        ? [{ typ: 'ueberschrift', ebene: 2, text: u.t(g('lagebild.kennzahlen')) } as Block, ...verlaeufe.flatMap((v) => [{ typ: 'absatz', text: u.t(g('kennzahl.titel'), { id: v.id, kennzahl: v.kennzahl }) } as Block, kennzahlDiagramm(ctx, h, v)])]
        : []),
      ...(pz?.bloecke ?? []),
    ]);
  };

  let bloecke: Block[];
  if (eb) {
    const abschnitte = ergaenzungsAbschnitte(ctx, 'D-21-EB');
    const n = abschnitte.filter((b) => b.typ === 'ueberschrift').length;
    // Protokoll im Pfad mit ISMS: Rahmen, Pflichteingaben mit KI-Sicht und Ergebnis, zusätzliche Traktanden (Nummern ab 1)
    nr = 0;
    const ebPflicht = (u.roh(k('eb_pflicht')) as string[][]).map((z, i) => (i === 0 && ersteBewertung ? (u.roh(k('eb_erste_massnahmen')) as string[]) : z));
    const ebPflichtZeilen: Text[][] = ebPflicht.map((z, i) => [String(++nr), z[0]!, z[1]!, pflichtErgebnisse[i] ?? '']);
    // Zusätzliche Traktanden mit Ergebnis je Punkt (Managementbewertung.ergebnisse); weitere Themen als letzter Punkt
    const ebTraktanden: Text[][] = zeilen(empfohlen, empfohlenErgebnisse);
    if (e && !leer(e.weitere)) ebTraktanden.push(weitereZeile());
    const traktandenBloecke: Block[] = [tabelle(ebTraktanden)];
    bloecke = [
      ...h.kitBlock(),
      h.normverweis('9.3, 5.1, A.2.4'),
      ...h.hinweis('ergaenzungsblaetter.hinweis'),
      { typ: 'absatz', text: h.istLeer ? u.t(k('eb_einleitung')) : u.t(k('eb_einleitung_firma'), { firma: org.name }) },
      ...abschnitte,
      { typ: 'ueberschrift', ebene: 1, text: `${n + 1} ${u.t(k('abschnitte.rahmen'))}` },
      rahmen,
      ...lagebild(),
      { typ: 'ueberschrift', ebene: 1, text: `${n + 2} ${u.t(k('eb_pflicht_titel'))}` },
      ...h.hinweis(k('hinweis_protokoll')),
      { typ: 'tabelle', kopf: u.liste(k('eb_pflicht_kopf')), zeilen: ebPflichtZeilen, breiten: mb ? [5, 17, 23, 55] : [6, 30, 34, 30] },
      { typ: 'ueberschrift', ebene: 1, text: `${n + 3} ${u.t(k('eb_traktanden'))}` },
      ...traktandenBloecke,
      ...schluss(n + 4),
      ...freigabe(n + 7),
      ...h.anlagen(),
    ];
  } else {
    bloecke = [
      ...h.kitBlock(),
      h.normverweis('9.3, 5.1, A.2.4'),
      ...h.hinweis(k('hinweis_umfang')),
      ...(h.istLeer ? h.hinweis(k('hinweis_isms')) : []),
      { typ: 'absatz', text: h.istLeer ? md(u.t(k('einleitung'))) : u.t(k('einleitung_firma'), { firma: org.name }) },
      ...(!h.istLeer && zeigeIsms ? [{ typ: 'absatz', text: u.t(k('einleitung_isms')) } as Block] : []),

      { typ: 'ueberschrift', ebene: 1, text: `1 ${u.t(k('abschnitte.rahmen'))}` },
      rahmen,
      ...lagebild(),

      { typ: 'ueberschrift', ebene: 1, text: `2 ${u.t(k('abschnitte.agenda'))}` },
      ...h.hinweis(k('hinweis_protokoll')),
      { typ: 'ueberschrift', ebene: 2, text: `2.1 ${u.t(k('abschnitte.pflicht'))}` },
      tabelle(pflichtZeilen),
      { typ: 'ueberschrift', ebene: 2, text: `2.2 ${u.t(k('abschnitte.empfohlen'))}` },
      tabelle(empfohlenZeilen),
      ...(ismsZeilen.length ? [{ typ: 'ueberschrift', ebene: 2, text: `2.3 ${u.t(k('abschnitte.isms'))}` } as Block, tabelle(ismsZeilen)] : []),

      ...schluss(3),

      { typ: 'ueberschrift', ebene: 1, text: `6 ${u.t(k('abschnitte.rhythmus'))}` },
      { typ: 'absatz', text: md(u.t(k('rhythmus_text'), { naechste })) },
      // Ausbaustufe ohne eigene Blöcke ist reiner Ausfüllhinweis: nur in der leeren Vorlage
      ...(h.istLeer ? h.ausbau(k('ausbau'), []) : []),

      ...freigabe(7),
      ...h.anlagen(),
    ];
  }

  const id = eb ? 'D-21-EB' : 'D-21';
  return {
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: h.fusszeile(id) },
    lenkung: h.lenkung(id),
    eigenschaften: h.eigenschaften(id),
    bloecke,
  };
}
