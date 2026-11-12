// D-16 Lieferanten und eingekaufte KI (8.1, A.10.2 bis A.10.4)
// Form «ergaenzungsblatt»: Ergänzung des bestehenden Lieferantenmanagements im ISMS (D-16-EB)
import type { Block, XlsxMappe, XlsxSpalte, Zellwert } from '../generator/ir.ts';
import type { JaNeinOffen, KlauselStand, Lieferant } from '../model/typen.ts';
import { DATENKLASSEN, FUNKTIONEN, PRUEFPUNKTE_LIEFERANT, TARIFE, VERTRAGSKLAUSELN as KLAUSELN } from '../model/typen.ts';
import { erstelleHelfer, klartext, md, type VorlagenKontext } from './kontext.ts';

/** Prüffragen vor dem Einkauf (Schlüssel in Lieferant.pruefpunkte). Massgebende Liste in src/model/typen.ts; Geführter Modus E9-lieferanten fragt dieselben Schlüssel ab. */
export const PRUEFFRAGEN = PRUEFPUNKTE_LIEFERANT;
/** Vertragsklauseln (Schlüssel in Lieferant.vertragsklauseln), Liste in src/model/typen.ts */
export const VERTRAGSKLAUSELN = KLAUSELN;
const KLAUSEL_STAND: KlauselStand[] = ['ja', 'nein', 'offen', 'nicht-noetig'];

const PRUEFSTATUS: Lieferant['pruefstatus'][] = ['offen', 'in-pruefung', 'geprueft', 'mit-auflagen', 'abgelehnt'];
const JA_NEIN_OFFEN: JaNeinOffen[] = ['ja', 'nein', 'offen'];

export function d16(ctx: VorlagenKontext): XlsxMappe {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-16.${s}`;
  const eb = ctx.form === 'ergaenzungsblatt';
  const id = eb ? 'D-16-EB' : 'D-16';
  const liste = (s: string) => u.liste(k(`listen.${s}`));
  const text = (kopf: string, breite = 18, umbruch = true): XlsxSpalte => ({ kopf, breite, umbruch });
  const modul = h.istLeer || projekt.meta.modulAiAct;
  const lieferanten = h.istLeer ? [] : projekt.lieferanten;
  const antwort = (w: JaNeinOffen | undefined) => (w ? liste('antwort')[JA_NEIN_OFFEN.indexOf(w)]! : '');

  // Systeme mit Status ohne Nutzung (untersagt, ausgesetzt) gekennzeichnet
  const systemText = (s: (typeof projekt.kiSysteme)[number]) =>
    `${s.id} ${s.name}${s.status === 'untersagt' || s.status === 'ausgesetzt' ? ` (${u.t('allgemein.ki_status_vermerk', { status: u.t(`allgemein.ki_status.${s.status}`) })})` : ''}`;
  // Wer die Prüfung durchgeführt hat und wann (Lieferant.geprueft)
  const geprueft = (l: Lieferant) => (l.geprueft?.von ? `${h.person(l.geprueft.von)?.name ?? l.geprueft.von}, ${h.datum(l.geprueft.am) ?? ''}`.replace(/, $/, '') : '');

  // Blatt Lieferanten
  const sp = u.liste(k('spalten_lieferanten'));
  const lieferantenZeilen: Zellwert[][] = lieferanten.map((l) => [
    l.id,
    l.name,
    l.leistung,
    projekt.kiSysteme
      .filter((s) => s.lieferant === l.id && s.status !== 'abgeloest')
      .map(systemText)
      .join(', '),
    liste('pruefstatus')[PRUEFSTATUS.indexOf(l.pruefstatus)]!,
    geprueft(l),
    l.naechstePruefung ?? null,
    [l.bemerkung, l.verantwortung].filter((x) => x && x.trim()).join(' '),
  ]);

  // Antwortspalten: je Lieferant eine Spalte im Firmendokument, sonst eine allgemeine Spalte
  const antwortSpalten = (werte: string[], kopf: string): XlsxSpalte[] =>
    lieferanten.length
      ? lieferanten.map((l) => ({ kopf: `${l.id} ${l.name}`, breite: 14, typ: 'liste' as const, liste: werte }))
      : [{ kopf: u.t(k(kopf)), breite: 12, typ: 'liste' as const, liste: werte }];

  const spF = u.liste(k('spalten_fragen'));
  const fragenZeilen: Zellwert[][] = PRUEFFRAGEN.map((f) => [
    f,
    klartext(u.t(k(`fragen.${f}.thema`))),
    // Firmendokument: Frage ohne Vorgabewert der Vorlage (frage_firma), sonst die Frage der Vorlage
    klartext((!h.istLeer && u.tOpt(k(`fragen.${f}.frage_firma`))) || u.t(k(`fragen.${f}.frage`))),
    klartext(u.t(k(`fragen.${f}.warum`))),
    ...(lieferanten.length ? lieferanten.map((l) => antwort(l.pruefpunkte[f])) : ['']),
    '',
  ]);

  const spV = u.liste(k('spalten_klauseln'));
  const klauselZeilen: Zellwert[][] = VERTRAGSKLAUSELN.map((v) => [
    v,
    klartext(u.t(k(`klauseln.${v}.klausel`))),
    klartext(u.t(k(`klauseln.${v}.bezug`))),
    ...(lieferanten.length ? lieferanten.map((l) => { const w = l.vertragsklauseln?.[v]; return w ? liste('klausel')[KLAUSEL_STAND.indexOf(w)]! : ''; }) : ['']),
    '',
  ]);

  const spR = u.liste(k('spalten_verantwortung'));
  // Verantwortungsmatrix (N-22): leere Vorlage mit dem Vorschlag für einen typischen SaaS-Dienst; Firmendokument je Gruppe
  // nach Rolle: eingekaufte Systeme (Betreiber) und eigene Systeme oder Produkte (Anbieter), dazu abweichende Aufteilungen
  // je Lieferant (Lieferant.verantwortung) als Bemerkung
  const zeilenAus = (s: string): Zellwert[][] => (u.roh(k(s)) as string[][]).map((z) => [...z, '']);
  const aktiv = h.istLeer ? [] : projekt.kiSysteme.filter((s) => s.status !== 'abgeloest' && s.status !== 'untersagt');
  const istAnbieter = (s: (typeof aktiv)[number]) => s.typ === 'eigenbau' || s.aiAct.rollen.includes('anbieter');
  const gruppe = (systeme: typeof aktiv, schluessel: string, vorschlag: string): Zellwert[][] => {
    if (!systeme.length) return [];
    const ids = new Set(systeme.map((s) => s.lieferant).filter(Boolean));
    const abweichungen = lieferanten.filter((l) => ids.has(l.id) && l.verantwortung?.trim());
    return [
      [u.t(k(schluessel), { systeme: systeme.map(systemText).join(', ') }), '', '', '', ''],
      ...zeilenAus(vorschlag),
      ...abweichungen.map((l): Zellwert[] => [u.t(k('abweichung'), { lieferant: `${l.id} ${l.name}` }), '', '', '', l.verantwortung!.trim()]),
    ];
  };
  const verantwortungZeilen: Zellwert[][] = aktiv.length
    ? [...gruppe(aktiv.filter((s) => !istAnbieter(s)), 'gruppe_betreiber', 'verantwortung_vorschlag'), ...gruppe(aktiv.filter(istAnbieter), 'gruppe_anbieter', 'verantwortung_anbieter')]
    : zeilenAus('verantwortung_vorschlag');

  // Blatt Dienste (ab rc.3): Tarif, Datenklasse, Funktionsschalter, Abkündigung und Quelle je eingekauftem Dienst
  // (KiSystem.tarif, funktionen, abkuendigung, quelleAngaben); Listen und Funktionsnamen aus D-10
  const d10 = (s: string) => `vorlagen.D-10.${s}`;
  const d10Liste = (s: string) => u.liste(d10(`listen.${s}`));
  const spD = u.liste(k('spalten_dienste'));
  const dienste = aktiv.filter((s) => s.typ !== 'eigenbau' || !!s.lieferant || !!s.tarif);
  const stand = d10Liste('funktion_stand');
  const dienstZeilen: Zellwert[][] = dienste.map((s) => [
    s.id,
    s.name,
    (() => { const l = projekt.lieferanten.find((x) => x.id === s.lieferant); return l ? `${l.id} ${l.name}` : (s.lieferant ?? ''); })(),
    s.tarif ? (d10Liste('tarif')[TARIFE.indexOf(s.tarif)] ?? '') : '',
    s.datenklasse ? (d10Liste('datenklasse')[DATENKLASSEN.indexOf(s.datenklasse)] ?? '') : '',
    FUNKTIONEN.filter((f) => s.funktionen?.[f]).map((f) => `${u.t(d10(`funktionen.${f}`))}: ${stand[s.funktionen![f] === 'an' ? 0 : 1]}`).join('; '),
    s.abkuendigung?.slice(0, 10) ?? null,
    [s.quelleAngaben?.fundstelle?.trim(), h.datum(s.quelleAngaben?.abgerufen)].filter(Boolean).join(', '),
  ]);

  const hinweisBlock: Block[] = [
    ...h.kitBlock(),
    h.normverweis('8.1, A.10.2 bis A.10.4'),
    ...(eb
      ? ([
          { typ: 'ueberschrift', ebene: 1, text: u.t(k('eb_titel')) },
          // Firmendokument: Nachweis der Übernahme (wo aufgenommen, was umgesetzt) statt Anweisungen
          { typ: 'absatz', text: md(u.t(k(h.istLeer ? 'eb_einleitung' : 'eb_einleitung_firma'))) },
          ...(!h.istLeer && h.dokEintrag(id)?.aufgenommenIn?.trim()
            ? [{ typ: 'absatz', text: u.t(k('eb_aufgenommen'), { dokument: h.dokEintrag(id)!.aufgenommenIn!.trim() }) } as Block]
            : []),
          { typ: 'liste', punkte: u.liste(k(h.istLeer ? 'eb_abschnitte' : 'eb_abschnitte_firma')).map((p) => md(p)) },
        ] as Block[])
      : []),
    ...(modul ? [{ typ: 'absatz' as const, text: md(`**${u.t(k(h.istLeer ? 'modul_praefix_leer' : 'modul_praefix'))}** ${u.t(k('modul_hinweis'))}`) }] : []),
  ];

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    eigenschaften: h.eigenschaften(id),
    lenkung: h.lenkung(id),
    firmenname: h.firmenname(),
    hinweisBlock,
    blaetter: [
      {
        name: u.t(k('blaetter.lieferanten')),
        titel: u.t(k(eb ? 'titel_lieferanten_eb' : 'titel_lieferanten')),
        hinweise: [...(h.istLeer ? u.liste(k('hinweise_lieferanten')) : []), u.t(k('regel_ueberwachung'))],
        fixiert: true,
        spalten: [
          text(sp[0]!, 8, false),
          text(sp[1]!, 24),
          text(sp[2]!, 30),
          text(sp[3]!, 30),
          { kopf: sp[4]!, breite: 14, typ: 'liste', liste: liste('pruefstatus') },
          text(sp[5]!, 20),
          { kopf: sp[6]!, breite: 13, typ: 'datum' },
          text(sp[7]!, 30),
        ],
        zeilen: lieferantenZeilen,
        leereZeilen: h.istLeer ? 20 : 5,
      },
      {
        name: u.t(k('blaetter.fragen')),
        titel: u.t(k('titel_fragen')),
        hinweise: h.istLeer ? u.liste(k('hinweise_fragen')) : undefined,
        fixiert: true,
        spalten: [text(spF[0]!, 7, false), text(spF[1]!, 18), text(spF[2]!, 50), text(spF[3]!, 36), ...antwortSpalten(liste('antwort'), 'spalte_antwort'), text(spF[4]!, 30)],
        zeilen: fragenZeilen,
      },
      {
        name: u.t(k('blaetter.klauseln')),
        titel: u.t(k('titel_klauseln')),
        hinweise: h.istLeer ? u.liste(k('hinweise_klauseln')) : undefined,
        fixiert: true,
        spalten: [text(spV[0]!, 7, false), text(spV[1]!, 56), text(spV[2]!, 10), ...antwortSpalten(liste('klausel'), 'spalte_im_vertrag'), text(spV[3]!, 30)],
        zeilen: klauselZeilen,
      },
      {
        name: u.t(k('blaetter.verantwortung')),
        titel: u.t(k('titel_verantwortung')),
        hinweise: h.istLeer ? u.liste(k('hinweise_verantwortung')) : aktiv.length ? [u.t(k('hinweis_verantwortung_firma'))] : undefined,
        fixiert: true,
        spalten: [
          text(spR[0]!, 44),
          { kopf: spR[1]!, breite: 15, typ: 'liste', liste: liste('verantwortung') },
          { kopf: spR[2]!, breite: 15, typ: 'liste', liste: liste('verantwortung') },
          { kopf: spR[3]!, breite: 15, typ: 'liste', liste: liste('verantwortung') },
          text(spR[4]!, 30),
        ],
        zeilen: verantwortungZeilen,
        leereZeilen: h.istLeer ? 5 : 2,
      },
      {
        name: u.t(k('blaetter.dienste')),
        titel: u.t(k('titel_dienste')),
        hinweise: h.istLeer ? u.liste(k('hinweise_dienste')) : undefined,
        fixiert: true,
        spalten: [
          text(spD[0]!, 8, false),
          text(spD[1]!, 26),
          text(spD[2]!, 26),
          { kopf: spD[3]!, breite: 18, typ: 'liste', liste: d10Liste('tarif') },
          { kopf: spD[4]!, breite: 16, typ: 'liste', liste: d10Liste('datenklasse') },
          text(spD[5]!, 40),
          { kopf: spD[6]!, breite: 13, typ: 'datum' },
          text(spD[7]!, 36),
        ],
        zeilen: dienstZeilen,
        leereZeilen: h.istLeer ? 20 : 3,
      },
    ],
  });
}
