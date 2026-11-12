// D-06 Verfahren KI-Risikomanagement (6.1.1 bis 6.1.3, 8.2, 8.3)
// Pfad mit ISMS (form ergaenzungsblatt): nur die KI-spezifischen Ergänzungen zur ISMS-Risikomethode (D-06-EB).
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import { erstelleHelfer, md, type VorlagenKontext } from './kontext.ts';
import { risikomatrixBlock, zonenMatrix } from './grafik.ts';
import { werteJeStufe } from '../grafik/daten.ts';

type Skala = (string | number)[][];

export function d06(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-06.${s}`;
  const eb = ctx.form === 'ergaenzungsblatt';
  const id = eb ? 'D-06-EB' : 'D-06';
  const org = projekt.organisation;
  const kr = org.risikokriterien;

  const alsMd = (t: Text): string => (typeof t === 'string' ? t : t.map((l) => (l.platzhalter ? `[[${l.text}]]` : l.text)).join(''));
  const verantwortlich = alsMd(h.personText(org.aimsVerantwortlich, 'person'));
  const freigabeAm = h.datum(h.dokEintrag(id)?.freigabe?.am) ?? `[[${u.t('allgemein.platzhalter.datum')}]]`;
  // Hohe Stufen der Auswirkung aus der eigenen Skala (z. B. «3 oder 4» bei vier Stufen, «3» bei drei)
  const hochA = h.skala('auswirkung').hoch;
  const liste = (s: string): Block => ({ typ: 'liste', punkte: u.liste(k(s)).map((p) => md(p.replace('{hoch}', hochA))) });
  // Katalog der Risikoquellen: dieselben Kategorien wie die Auswahlliste in D-07 (h.risikoquellen), mit Erläuterung
  const quellen: Block = {
    typ: 'liste',
    punkte: h.risikoquellen().map((q) => md(`**${q.label}:** ${u.tOpt(k(`quellen_erlaeuterung.${q.schluessel}`)) ?? ''}`.trim())),
  };
  const absatz = (s: string, werte?: Record<string, string | number>): Block => ({ typ: 'absatz', text: md(u.t(k(s), werte)) });
  // Anlage A am Dokumentende (zählt nicht zur Seitenvorgabe): Risikoquellen mit Erläuterung und KI-Bedrohungen als
  // Gedankenstütze (ab rc.2). Der Verweis auf die Vorschläge GenAI-Sicherheit steht nur in der leeren Vorlage (Blatt in D-07).
  const anlageA: Block[] = [
    { typ: 'seitenumbruch' },
    { typ: 'ueberschrift', ebene: 1, text: u.t('allgemein.anlage.titel', { nr: 'A', titel: u.t(k('anlage.titel')) }) },
    { typ: 'ueberschrift', ebene: 2, text: `A.1 ${u.t(k('anlage.quellen_titel'))}` },
    quellen,
    { typ: 'ueberschrift', ebene: 2, text: `A.2 ${u.t(k('anlage.bedrohungen_titel'))}` },
    absatz('anlage.bedrohungen_text'),
    liste('anlage.bedrohungen'),
    ...h.hinweis(k('anlage.hinweis_genai')),
  ];
  // Überprüfung nach Risikostufe: hohe Risiken häufiger (leere Vorlage: Platzhalter)
  const intervall = (s: string) => (h.istLeer ? `[[${u.t(k(s))}]]` : u.t(k(s)));

  // Skalen: aus dem Projekt; in leeren Vorlagen und bei fehlenden Angaben der 4x4-Vorschlag aus D-07
  const vorschlag = u.roh('vorlagen.D-07.skalen_vorschlag') as { wahrscheinlichkeit: Skala; auswirkung: Skala };
  const eigeneSkalen = !h.istLeer && kr.wahrscheinlichkeit.length > 0 && kr.auswirkung.length > 0;
  const zeile = (s: { stufe: number; bezeichnung: string; beschreibung: string }) => [String(s.stufe), s.bezeichnung, s.beschreibung];
  const wSkala: string[][] = eigeneSkalen ? kr.wahrscheinlichkeit.map(zeile) : vorschlag.wahrscheinlichkeit.map((z) => z.map(String));
  const aSkala: string[][] = eigeneSkalen ? kr.auswirkung.map(zeile) : vorschlag.auswirkung.map((z) => z.map(String));
  // Bezugszeitraum als Text (Optionswert «pro-jahr» -> «pro Jahr», N-15); freie Angaben bleiben, wie sie sind
  const zeitraum = !h.istLeer && kr.zeitraum.trim() ? (u.tOpt(`gefuehrt.optionen.zeitraum.${kr.zeitraum.trim()}`) ?? kr.zeitraum) : `[[${u.t(k('zeitraum_vorschlag'))}]]`;
  const zeitraumFehlt = !h.istLeer && !kr.zeitraum.trim();

  const einstufung = u.liste(k('skalen.einstufung'));
  // Mittlere Stufe: nur Risikowerte, die mit den Skalen erreichbar sind (W x A), z. B. bei 3x3 nur «4» statt «4 bis 5»
  const wStufen = (eigeneSkalen ? kr.wahrscheinlichkeit : vorschlag.wahrscheinlichkeit.map((z) => ({ stufe: Number(z[0]) }))).map((s) => s.stufe);
  const aStufen = (eigeneSkalen ? kr.auswirkung : vorschlag.auswirkung.map((z) => ({ stufe: Number(z[0]) }))).map((s) => s.stufe);
  const mittlere = werteJeStufe(wStufen, aStufen, kr).mittel;
  const mittelText =
    h.istLeer || !eigeneSkalen || mittlere.length > 1
      ? u.t(k('skalen.von_bis'), { von: h.istLeer || !eigeneSkalen ? kr.akzeptanzBis + 1 : mittlere[0]!, bis: h.istLeer || !eigeneSkalen ? kr.unannehmbarAb - 1 : mittlere.at(-1)! })
      : mittlere.length === 1
        ? String(mittlere[0])
        : undefined;
  // Wer annimmt: aus den Entscheidungsrechten (D-04) bzw. deren Vorschlag in D-04 Anlage A, eine Quelle mit D-04, auch in der
  // leeren Vorlage (M4-28: früher eigener Text mit anderer Stelle für mittlere Restrisiken)
  const kriterium = (stufe: 'tief' | 'mittel' | 'hoch', entscheid: 'restrisiko' | 'ausnahme'): string => {
    const recht = h.istLeer ? undefined : projekt.organisation.entscheidungsrechte?.find((e) => e.entscheid === entscheid)?.wer[stufe];
    const p = recht ? h.person(recht) : undefined;
    const wer = p ? `${p.name}, ${p.funktion}` : recht || u.liste(`vorlagen.D-04.entscheidungsrechte_vorschlag.${entscheid}`)[['tief', 'mittel', 'hoch'].indexOf(stufe)]!;
    return u.t(k(`skalen.kriterien_firma.${stufe}`), { wer: h.klartext(h.md(wer)) });
  };
  const kriterienTabelle: Block = {
    typ: 'tabelle',
    kopf: u.liste(k('skalen.kopf_kriterien')),
    zeilen: [
      [u.t(k('skalen.bis'), { wert: kr.akzeptanzBis }), einstufung[0]!, kriterium('tief', 'restrisiko')],
      ...(mittelText ? [[mittelText, einstufung[1]!, kriterium('mittel', 'restrisiko')]] : []),
      [u.t(k('skalen.ab'), { wert: kr.unannehmbarAb }), einstufung[2]!, kriterium('hoch', 'ausnahme')],
    ],
    breiten: [18, 14, 68],
  };
  // Risikomatrix mit den eigenen Skalen und Grenzen (leere Vorlage und fehlende Skalen: Vorschlag 4x4); ohne Risiken, das
  // Lagebild mit Anzahl steht in D-07 (Blatt «Risikomatrix») und D-21
  const matrix: Block = risikomatrixBlock(ctx, zonenMatrix(ctx), { titel: u.t('vorlagen.grafik.matrix.titel_zonen'), mitAnzahl: false });
  const skalenTabellen: Block[] = [
    {
      typ: 'tabelle',
      kopf: u.liste(k('skalen.kopf')),
      zeilen: wSkala.map((w, i) => [w[0] ?? '', w[1] ?? '', w[2] ?? '', aSkala[i]?.[1] ?? '', aSkala[i]?.[2] ?? '']),
      breiten: [7, 20, 28, 15, 30],
    },
  ];
  const zeitraumHinweis: Block[] = zeitraumFehlt ? h.hinweis(k('hinweis_zeitraum_fehlt'), true) : [];
  const skalenHinweise: Block[] = [
    ...h.hinweis(k('hinweis_skalen')),
    ...(!h.istLeer && !eigeneSkalen ? h.hinweis(k('hinweis_skalen_fehlen'), true) : []),
    ...zeitraumHinweis,
  ];

  // Firmendokument: Wert aus dem Projekt oder Platzhalter in [[...]]
  const oder = (v: string | undefined, platzhalter: string) => (v && v.trim() ? v : `[[${platzhalter}]]`);
  const ismsDokument = oder(h.dokEintrag('D-06-EB')?.aufgenommenIn, u.t(k('eb.platzhalter_dokument')));
  // Ablage und Aufbewahrung der Aufzeichnungen: Eintrag D-07 (bzw. D-07-EB), sonst Grundregeln der Dokumentenlenkung
  const regeln = org.dokumentenlenkung;
  const d07 = h.dokEintrag('D-07');
  const ablage = oder(d07?.ablageort || regeln?.ablage, u.t('allgemein.platzhalter.ort'));
  const aufbewahrung = oder(
    d07?.aufbewahrung || (regeln?.aufbewahrungJahre !== undefined ? u.t(k('aufbewahrung_jahre'), { jahre: regeln.aufbewahrungJahre }) : undefined),
    u.t(k('platzhalter_aufbewahrung')),
  );

  const einleitung: Block = {
    typ: 'absatz',
    text: h.istLeer
      ? md(u.t(k(eb ? 'eb.einleitung' : 'einleitung')))
      : md(u.t(k(eb ? 'eb.einleitung_firma' : 'einleitung_firma'), { firma: org.name, isms_dokument: ismsDokument })),
  };

  const freigabe = (nr: number, textSchluessel: string): Block[] => [
    { typ: 'ueberschrift', ebene: 1, text: `${nr} ${u.t(k(eb ? 'eb.abschnitte.freigabe' : 'abschnitte.freigabe'))}` },
    { typ: 'absatz', text: md(u.t(k(textSchluessel), { datum: freigabeAm })) },
    // Bekannte Freigabe aus dem Dokumentenregister statt «Name, Funktion» (N-15)
    h.unterschriften([h.dokEintrag(id)?.freigabe]),
  ];

  const bloecke: Block[] = eb ? ergaenzungsblatt() : verfahren();

  function verfahren(): Block[] {
    const a = (s: string) => `ablauf.${s}`;
    const schritt = (nr: string, s: string): Block => ({ typ: 'ueberschrift', ebene: 2, text: `3.${nr} ${u.t(k(`${a(s)}.titel`))}` });
    return [
      ...h.kitBlock(),
      h.normverweis('6.1.1 bis 6.1.3, 8.2, 8.3'),
      ...h.hinweis(k('hinweis_umfang')),
      { typ: 'ueberschrift', ebene: 1, text: `1 ${u.t(k('abschnitte.zweck'))}` },
      einleitung,
      absatz('zweck_text'),

      { typ: 'ueberschrift', ebene: 1, text: `2 ${u.t(k('abschnitte.geltung'))}` },
      absatz('geltung_text'),
      liste('geltung_ebenen'),

      { typ: 'ueberschrift', ebene: 1, text: `3 ${u.t(k('abschnitte.ablauf'))}` },
      schritt('1', 'kontext'),
      absatz(`${a('kontext')}.text`),
      schritt('2', 'identifikation'),
      absatz(`${a('identifikation')}.text`),
      schritt('3', 'analyse'),
      absatz(`${a('analyse')}.text`),
      liste(`${a('analyse')}.ebenen`),
      absatz(`${a('analyse')}.bewertung`, { zeitraum }),
      schritt('4', 'bewertung'),
      absatz(`${a('bewertung')}.text`),
      schritt('5', 'behandlung'),
      absatz(`${a('behandlung')}.text`),
      liste(`${a('behandlung')}.optionen`),
      absatz(`${a('behandlung')}.controls`),
      absatz(`${a('behandlung')}.soa`),
      absatz(`${a('behandlung')}.plan`),
      absatz(`${a('freigabe')}.text`),

      { typ: 'ueberschrift', ebene: 1, text: `4 ${u.t(k('abschnitte.skalen'))}` },
      ...skalenHinweise,
      absatz('skalen.zeitraum_text', { zeitraum }),
      ...(!h.istLeer && kr.ausIsmsUebernommen ? [absatz('skalen.isms_uebernommen')] : []),
      ...skalenTabellen,
      kriterienTabelle,
      matrix,
      ...h.ausbau(k('ausbau_methoden'), []),

      { typ: 'ueberschrift', ebene: 1, text: `5 ${u.t(k('abschnitte.folgen'))}` },
      absatz('folgen_text'),
      liste('folgen_punkte'),

      { typ: 'ueberschrift', ebene: 1, text: `6 ${u.t(k('abschnitte.wiederholung'))}` },
      absatz('wiederholung_text', { intervall: intervall('wiederholung_intervall'), intervall_hoch: intervall('wiederholung_intervall_hoch') }),
      liste('wiederholung_ausloeser'),
      absatz('wiederholung_nachweis'),

      { typ: 'ueberschrift', ebene: 1, text: `7 ${u.t(k('abschnitte.chancen'))}` },
      absatz('chancen_text'),

      { typ: 'ueberschrift', ebene: 1, text: `8 ${u.t(k('abschnitte.zustaendigkeiten'))}` },
      {
        typ: 'tabelle',
        kopf: u.liste(k('zustaendigkeiten_kopf')),
        zeilen: (u.roh(k('zustaendigkeiten')) as string[][]).map((z) => z.map((c) => md(c.replace('{verantwortlich}', verantwortlich)))),
        breiten: [36, 64],
      },

      { typ: 'ueberschrift', ebene: 1, text: `9 ${u.t(k('abschnitte.aufzeichnungen'))}` },
      h.istLeer ? absatz('aufzeichnungen_text') : absatz('aufzeichnungen_text_firma', { ablage, aufbewahrung }),

      ...freigabe(10, 'freigabe_text'),
      ...anlageA,
    ];
  }

  function ergaenzungsblatt(): Block[] {
    const t = (s: string) => `eb.abschnitte.${s}`;
    const ueberschrift = (nr: number, s: string): Block => ({ typ: 'ueberschrift', ebene: 1, text: `${nr} ${u.t(k(t(s)))}` });
    const beschreibungA = (u.roh(k('eb.ebenen_vorschlag')) as string[]).map((b, i) => [String(i + 1), b]);
    return [
      ...h.kitBlock(),
      h.normverweis('6.1.1 bis 6.1.3, 8.2, 8.3'),
      ...h.hinweis(k('eb.hinweis')),
      einleitung,

      ueberschrift(1, 'geltung'),
      absatz('eb.geltung_text'),

      ueberschrift(2, 'quellen'),
      absatz('eb.quellen_text'),

      ueberschrift(3, 'ebenen'),
      absatz('eb.ebenen_text'),
      liste('ablauf.analyse.ebenen'),
      { typ: 'tabelle', kopf: u.liste(k('eb.ebenen_kopf')), zeilen: beschreibungA, breiten: [12, 88] },

      ueberschrift(4, 'skalen'),
      ...h.hinweis(k('eb.hinweis_skalen')),
      ...zeitraumHinweis,
      absatz('eb.skalen_text', { zeitraum, akzeptanz: kr.akzeptanzBis, unannehmbar: kr.unannehmbarAb }),
      kriterienTabelle,
      matrix,

      ueberschrift(5, 'folgen'),
      // Schwelle der vollständigen Folgenabschätzung aus der Faktenquelle mit den hohen Stufen der Skala (AF-100, A3-06)
      absatz('eb.folgen_text', { hoch: hochA }),

      ueberschrift(6, 'behandlung'),
      absatz('eb.behandlung_text'),

      ueberschrift(7, 'register'),
      absatz('eb.register_text'),

      ueberschrift(8, 'wiederholung'),
      absatz('eb.wiederholung_text', { intervall: intervall('wiederholung_intervall'), intervall_hoch: intervall('wiederholung_intervall_hoch') }),

      ...freigabe(9, 'eb.freigabe_text'),
      ...anlageA,
    ];
  }

  const lenkung = h.lenkung(id);
  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: h.fusszeile(id) },
    lenkung,
    eigenschaften: h.eigenschaften(id),
    bloecke,
  });
}
