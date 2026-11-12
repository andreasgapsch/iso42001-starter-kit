// D-08 Verfahren Folgenabschätzung für KI-Systeme (6.1.4, 8.4, A.5.2)
// Gliederung nach ISO/IEC 42005 Kap. 5 in eigenen Worten; Kurzprüfung mit den sechs Fragen aus Folgenabschaetzung.triage.
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import type { Folgenabschaetzung } from '../model/typen.ts';
import { ablaufD08 } from './grafik.ts';
import { erstelleHelfer, md, type VorlagenKontext } from './kontext.ts';

/** Die sechs Fragen der Kurzprüfung in fester Reihenfolge (Schlüssel = Feld im Datenmodell). */
export const TRIAGE_FRAGEN = [
  'rechtspositionOderChancen',
  'gesundheitOderSicherheit',
  'verletzlicheGruppen',
  'besondereDaten',
  'automatisierteEntscheidung',
  'grosseReichweite',
] as const satisfies readonly (keyof Folgenabschaetzung['triage'])[];

export function d08(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-08.${s}`;
  const org = projekt.organisation;
  const modul = projekt.meta.modulAiAct;

  const alsMd = (t: Text): string => (typeof t === 'string' ? t : t.map((l) => (l.platzhalter ? `[[${l.text}]]` : l.text)).join(''));
  const verantwortlich = alsMd(h.personText(org.aimsVerantwortlich, 'person')).replace(/, AIMS lead$/, '');
  // Auswirkungsskala aus D-06 (organisation.risikokriterien): Bereich und hohe Stufen statt fester «1 bis 4»
  const skalaA = h.skala('auswirkung');
  const werte = { verantwortlich, bereich: skalaA.bereich, hoch: skalaA.hoch };
  const freigabeAm = h.datum(h.dokEintrag('D-08')?.freigabe?.am) ?? `[[${u.t('allgemein.platzhalter.datum')}]]`;

  const absatz = (s: string, w: Record<string, string> = werte): Block => ({ typ: 'absatz', text: md(u.t(k(s), w)) });
  const liste = (s: string, nummeriert = false): Block => ({
    typ: 'liste',
    nummeriert,
    punkte: u.liste(k(s)).map((p) => md(p.replace('{verantwortlich}', verantwortlich).replace('{hoch}', skalaA.hoch))),
  });
  let nr = 0;
  const ueberschrift = (s: string): Block => ({ typ: 'ueberschrift', ebene: 1, text: `${++nr} ${u.t(k(`abschnitte.${s}`))}` });
  const tabelle = (kopf: string, zeilen: string, breiten: number[]): Block => ({
    typ: 'tabelle',
    kopf: u.liste(k(kopf)),
    zeilen: (u.roh(k(zeilen)) as string[][]).map((z) => z.map((c) => md(c.replace('{verantwortlich}', verantwortlich)))),
    breiten,
  });
  const intervall = h.istLeer ? `[[${u.t(k('ueberwachung_intervall'))}]]` : u.t(k('ueberwachung_intervall'));

  // Aufbewahrung der Folgenabschätzungen: Eintrag D-09 im Dokumentenregister, sonst Grundregeln der Dokumentenlenkung
  const oder = (v: string | undefined, platzhalter: string) => (v && v.trim() ? v : `[[${platzhalter}]]`);
  const d09 = h.dokEintrag('D-09');
  const regeln = org.dokumentenlenkung;
  const aufbewahrungWerte = {
    aufbewahrung: oder(
      d09?.aufbewahrung || (regeln?.aufbewahrungJahre !== undefined ? u.t(k('aufbewahrung_jahre'), { jahre: regeln.aufbewahrungJahre }) : undefined),
      u.t(k('platzhalter_aufbewahrung')),
    ),
    ablage: oder(d09?.ablageort || regeln?.ablage, u.t('allgemein.platzhalter.ort')),
  };

  const bloecke: Block[] = [
    ...h.kitBlock(),
    h.normverweis('6.1.4, 8.4, A.5.2'),
    ...h.hinweis(k('hinweis_umfang')),

    ueberschrift('zweck'),
    { typ: 'absatz', text: h.istLeer ? md(u.t(k('einleitung'))) : u.t(k('einleitung_firma'), { firma: org.name }) },
    absatz('zweck_text'),

    ueberschrift('einbettung'),
    // Firmendokument ohne Modul: ohne den Punkt zur Grundrechte-Folgenabschätzung (E-06 gibt es dann nicht)
    ((b: Block): Block => (b.typ === 'liste' && !h.istLeer && !modul ? { ...b, punkte: b.punkte.filter((p) => !JSON.stringify(p).includes('E-06')) } : b))(liste('einbettung_punkte')),

    ueberschrift('ausloeser'),
    absatz('ausloeser_text'),
    liste('ausloeser_punkte'),
    ...(h.istLeer || org.entwickeltKi ? [absatz('ausloeser_entwicklung')] : []),

    ueberschrift('triage'),
    absatz('triage_text'),
    {
      typ: 'tabelle',
      kopf: u.liste(k('triage_kopf')),
      zeilen: TRIAGE_FRAGEN.map((f, i) => [String(i + 1), u.t(k(`triage.fragen.${f}`))]),
      breiten: [7, 93],
    },
    { typ: 'ueberschrift', ebene: 2, text: `${nr}.1 ${u.t(k('schwellen_titel'))}` },
    liste('schwellen'),
    ...(h.istLeer || modul ? [absatz('schwellen_aiact')] : []),
    { typ: 'ueberschrift', ebene: 2, text: `${nr}.2 ${u.t(k('ausmass_titel'))}` },
    absatz('ausmass_text'),
    liste('ausmass_punkte'),

    ueberschrift('umfang'),
    absatz('umfang_text'),

    ueberschrift('zustaendigkeiten'),
    tabelle('zustaendigkeiten_kopf', 'zustaendigkeiten', [32, 68]),
    absatz('zustaendigkeiten_unabhaengig'),

    ueberschrift('durchfuehrung'),
    liste('durchfuehrung', true),
    // Ablauf als bearbeitbare Formen in der Anlage (zählt nicht zur Seitenvorgabe)
    ...h.grafikAnlage(u.t('vorlagen.grafik.d08.titel'), [ablaufD08(ctx)]),

    ueberschrift('auswertung'),
    absatz('auswertung_text'),

    ueberschrift('bericht'),
    absatz('bericht_intern'),
    absatz('bericht_extern'),
    ...(h.istLeer || modul ? [absatz('bericht_aiact')] : []),

    ueberschrift('freigabe'),
    absatz('freigabe_text'),

    ueberschrift('ueberwachung'),
    absatz('ueberwachung_text', { ...werte, intervall }),
    ...h.ausbau(k('ausbau_entwicklung'), []),

    ueberschrift('aufbewahrung'),
    h.istLeer ? absatz('aufbewahrung_text') : absatz('aufbewahrung_text_firma', { ...werte, ...aufbewahrungWerte }),

    ueberschrift('freigabe_verfahren'),
    { typ: 'absatz', text: md(u.t(k('freigabe_verfahren_text'), { datum: freigabeAm })) },
    h.unterschriften([h.dokEintrag('D-08')?.freigabe]),
    ...h.anlagen(),
  ];

  return {
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: h.fusszeile('D-08') },
    lenkung: h.lenkung('D-08'),
    eigenschaften: h.eigenschaften('D-08'),
    bloecke,
  };
}
