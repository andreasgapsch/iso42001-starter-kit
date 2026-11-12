// D-03 KI-Leitlinie (5.2, A.2)
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import { erstelleHelfer, leer, md, type VorlagenKontext } from './kontext.ts';

export function d03(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-03.${s}`;
  const org = projekt.organisation;
  const ll = org.leitlinie;
  const verantwortlich = h.personText(org.aimsVerantwortlich, 'person');
  const verantwortlichText = typeof verantwortlich === 'string' ? verantwortlich : `[[${verantwortlich.map((l) => l.text).join('')}]]`;
  const datumOderPlatzhalter = (iso?: string) => h.datum(iso) ?? `[[${u.t('allgemein.platzhalter.datum')}]]`;

  const grundsaetze = !h.istLeer && !leer(ll.grundsaetze) ? ll.grundsaetze : u.liste(k('grundsaetze_vorschlag'));

  // 7 Bezug zu anderen Leitlinien: Abgleich aus organisation.leitlinie.abgleich (Schlüssel der Optionsgruppe leitlinienBezug)
  const BEZUG_ZEILEN = ['informationssicherheit', 'datenschutz', 'qualitaet', 'personal'];
  const abgleich = h.istLeer ? {} : (ll.abgleich ?? {});
  // Ohne ISMS und ohne eigene Informationssicherheitsleitlinie: der Schutz der Daten in KI-Systemen liegt bei D-03 und D-15.
  // Firmendokument ohne Angabe (Seite E3-andere-leitlinien leer): ein offener Punkt statt der Auswahl der leeren Vorlage
  const abgleichText = (w?: string, schluessel?: string): Text =>
    w === 'nicht-vorhanden' && schluessel === 'informationssicherheit' && !projekt.meta.mitIsms
      ? u.t(k('abgleich_ohne_isms'))
      : w
        ? u.t(k(`abgleich_werte.${w}`))
        : md(`[[${u.t(k('abgleich_offen'))}]]`);
  const bezugZeilen: Text[][] = [
    ...(u.roh(k('bezug_vorschlag')) as string[][]).map((z, i) => [
      md(z[0]!),
      md(z[1]!),
      h.istLeer ? md(z[2]!) : abgleichText(abgleich[BEZUG_ZEILEN[i]!], BEZUG_ZEILEN[i]),
    ]),
    ...Object.entries(abgleich)
      .filter(([schluessel, w]) => !BEZUG_ZEILEN.includes(schluessel) && w)
      .map(([schluessel, w]) => [u.tOpt(`gefuehrt.optionen.leitlinienBezug.${schluessel}`) ?? schluessel, u.tOpt(k(`bezug_weitere_je.${schluessel}`)) ?? u.t(k('bezug_weitere')), abgleichText(w)]),
  ];
  // 8 Ausnahmen: Regel der Firma (leitlinie.ausnahmeprozess), sonst der allgemeine Text der Vorlage
  const ausnahmeprozess = h.istLeer ? '' : ll.ausnahmeprozess?.trim() ?? '';
  // 10 Nächste Überprüfung: eine Quelle für Leitlinie und Dokumentenregister (leitlinie.naechsteUeberpruefung, sonst Register D-03)
  const naechste = ll.naechsteUeberpruefung ?? h.dokEintrag('D-03')?.naechsteUeberpruefung;

  // 4 Risikobereitschaft: organisation.risikobereitschaft je Rahmen, sonst der Vorschlag (Wir-Form); jeder Punkt als Satz mit
  // grossem Anfang und Punkt (P20-Prüfung H2: «… D-12). befristete Ausnahmen …»)
  const satz = (x: string) => `${x.charAt(0).toLocaleUpperCase()}${x.slice(1)}`.replace(/\.?$/, '.');
  const RAHMEN = ['nie', 'nurGl', 'aimsAllein'] as const;
  const rb = h.istLeer ? undefined : org.risikobereitschaft;
  const rbZeilen: Text[][] = RAHMEN.map((r) => {
    const eigene = (rb?.[r] ?? []).map((x) => x.trim()).filter(Boolean);
    const punkte = eigene.length ? eigene : u.liste(k(`risikobereitschaft_vorschlag.${r}`));
    return [u.t(k(`risikobereitschaft_rahmen.${r}`)), md(punkte.map((x) => satz(x)).join(' '))];
  });

  const bloecke: Block[] = [
    ...h.kitBlock(),
    h.normverweis('5.2, A.2.2 bis A.2.4'),
    ...h.hinweis(k('hinweis_umfang')),
    // Ohne Entwicklung (kein Produzent, keine Eigenentwicklung) nennt die Einleitung nur Einkauf und Nutzung
    {
      typ: 'absatz',
      text: h.istLeer
        ? md(u.t(k('einleitung')))
        : u.t(k(org.entwickeltKi || org.verkauftKiProdukte || projekt.kiSysteme.some((s) => s.typ === 'eigenbau') ? 'einleitung_firma' : 'einleitung_firma_ohne_entwicklung'), { firma: org.name }),
    },

    { typ: 'ueberschrift', ebene: 1, text: `1 ${u.t(k('abschnitte.zweck'))}` },
    { typ: 'absatz', text: u.t(k('zweck_text')) },

    { typ: 'ueberschrift', ebene: 1, text: `2 ${u.t(k('abschnitte.grundsaetze'))}` },
    ...h.hinweis(k('hinweis_grundsaetze')),
    { typ: 'liste', punkte: grundsaetze.map((g) => md(g)) },

    { typ: 'ueberschrift', ebene: 1, text: `3 ${u.t(k('abschnitte.verpflichtungen'))}` },
    { typ: 'liste', punkte: u.liste(k('verpflichtungen')).map((v) => md(v)) },

    { typ: 'ueberschrift', ebene: 1, text: `4 ${u.t(k('abschnitte.risikobereitschaft'))}` },
    { typ: 'absatz', text: u.t(k('risikobereitschaft_text')) },
    ...h.hinweis(k('hinweis_risikobereitschaft')),
    { typ: 'tabelle', kopf: u.liste(k('risikobereitschaft_kopf')), zeilen: rbZeilen, breiten: [30, 70] },

    { typ: 'ueberschrift', ebene: 1, text: `5 ${u.t(k('abschnitte.ziele'))}` },
    { typ: 'absatz', text: u.t(k('ziele_text')) },
    ...h.hinweis(k('hinweis_ziele')),

    { typ: 'ueberschrift', ebene: 1, text: `6 ${u.t(k('abschnitte.zustaendigkeiten'))}` },
    { typ: 'absatz', text: md(u.t(k('zustaendigkeiten_text'), { verantwortlich: verantwortlichText })) },

    { typ: 'ueberschrift', ebene: 1, text: `7 ${u.t(k('abschnitte.bezug'))}` },
    { typ: 'absatz', text: u.t(k('bezug_text')) },
    ...h.hinweis(k('hinweis_bezug')),
    {
      typ: 'tabelle',
      kopf: u.liste(k('bezug_kopf')),
      zeilen: bezugZeilen,
      breiten: [30, 40, 30],
    },
    ...(!h.istLeer && ll.abgleichNotiz ? [{ typ: 'absatz' as const, text: ll.abgleichNotiz }] : []),

    { typ: 'ueberschrift', ebene: 1, text: `8 ${u.t(k('abschnitte.ausnahmen'))}` },
    {
      typ: 'absatz',
      text: ausnahmeprozess
        ? md(u.t(k('ausnahmen_text_firma'), { regel: ausnahmeprozess.replace(/\.?$/, '.') }))
        : md(u.t(k('ausnahmen_text'), { verantwortlich: verantwortlichText })),
    },

    { typ: 'ueberschrift', ebene: 1, text: `9 ${u.t(k('abschnitte.bekanntmachung'))}` },
    { typ: 'absatz', text: u.t(k('bekanntmachung_text')) },
    ...h.hinweis(k('hinweis_bekanntmachung')),

    { typ: 'ueberschrift', ebene: 1, text: `10 ${u.t(k('abschnitte.ueberpruefung'))}` },
    {
      typ: 'absatz',
      text: md(u.t(k('ueberpruefung_text'), { verantwortlich: verantwortlichText, naechste: datumOderPlatzhalter(naechste) })),
    },
    ...h.ausbau(k('ausbau_themen'), []),

    { typ: 'ueberschrift', ebene: 1, text: `11 ${u.t(k('abschnitte.freigabe'))}` },
    { typ: 'absatz', text: md(u.t(k('freigabe_text'), { datum: datumOderPlatzhalter(ll.freigabe?.am) })) },
    h.unterschriften([ll.freigabe, h.dokEintrag('D-03')?.freigabe], 2),
  ];

  return {
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: h.fusszeile('D-03') },
    lenkung: h.lenkung('D-03'),
    eigenschaften: h.eigenschaften('D-03'),
    bloecke,
  };
}
