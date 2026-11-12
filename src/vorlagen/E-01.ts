// E-01 Rollenbestimmung nach EU AI Act (Art. 2, 3, 25; ISO/IEC 42001 4.1)
// Blätter: Rollen je KI-System mit Prüffragen, Entscheidungshilfe.
import type { XlsxMappe, XlsxSpalte, Zellwert } from '../generator/ir.ts';
import type { KiSystem } from '../model/typen.ts';
import { istHochrisiko, modulHelfer } from './E-0x.ts';
import { erstelleHelfer, klartext, type VorlagenKontext } from './kontext.ts';

const TYP: KiSystem['typ'][] = ['eingekauft', 'saas', 'eigenbau', 'schatten'];

export function e01(ctx: VorlagenKontext): XlsxMappe {
  const h = erstelleHelfer(ctx);
  const m = modulHelfer(ctx, h);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.E-01.${s}`;
  const liste = (s: string) => u.liste(k(`listen.${s}`));
  const sp = u.liste(k('spalten'));
  const eu = projekt.organisation.euBezug;
  const systeme = h.istLeer ? [] : projekt.kiSysteme;

  // Räumlicher Anwendungsbereich nach Art. 2(1) je System (aiAct.anwendungsbereich). Ohne Angabe ein Vorschlag aus dem
  // EU-Bezug der Organisation: Bst. a für Anbieter mit Kunden in der EU, Bst. b für Betreiber mit Niederlassung in der EU,
  // Bst. c, wenn Ausgaben in der EU verwendet werden (N-23: nicht pauschal Bst. b).
  const BEZUG = ['a', 'b', 'c', 'ab', 'ac', 'bc', 'abc'];
  const buchstaben = (s: KiSystem): string[] => {
    if (s.aiAct.anwendungsbereich) return [...s.aiAct.anwendungsbereich].sort();
    const r = s.aiAct.rollen;
    const aus: string[] = [];
    if ((r.includes('anbieter') || r.includes('produkthersteller')) && eu.kundenEu) aus.push('a');
    if (r.includes('betreiber') && eu.niederlassungEu) aus.push('b');
    if (eu.outputEu) aus.push('c');
    return aus;
  };
  const bezug = (s: KiSystem): string => {
    const b = liste('bezug');
    if (!s.aiAct.rollen.length && !s.aiAct.anwendungsbereich) return b[8]!;
    const l = buchstaben(s);
    return l.length ? b[BEZUG.indexOf(l.join(''))]! : b[7]!;
  };
  // Prüffragen D bis K aus den Rollen und dem räumlichen Anwendungsbereich (leer, solange keine Rolle bestimmt ist)
  const pruefFragen = (s: KiSystem): string[] => {
    const r = s.aiAct.rollen;
    if (!r.length) return ['', '', '', '', '', '', '', ''];
    const l = buchstaben(s);
    return [true, r.includes('anbieter'), l.includes('a'), l.includes('c'), r.includes('betreiber'), r.includes('einfuehrer'), r.includes('haendler'), r.includes('produkthersteller')].map(m.jn);
  };
  // Rollenwechsel nach Art. 25(1): erfasster Wert (aiAct.rollenwechsel); ohne Hochrisiko-Bezug «nicht relevant»
  const WECHSEL = ['nein', 'nicht-relevant', 'a', 'b', 'c', 'offen'];
  const wechsel = (s: KiSystem): string => {
    const kl = s.aiAct.risikoklasse;
    if (s.aiAct.rollenwechsel) return liste('wechsel')[WECHSEL.indexOf(s.aiAct.rollenwechsel)] ?? '';
    return kl === 'offen' || istHochrisiko(kl) ? '' : liste('wechsel')[1]!;
  };
  // «Geprüft durch, am» aus der juristischen Prüfung (aiAct.geprueft)
  const durchAm = (f?: { von: string; am: string }) => (f ? [projekt.personen.find((p) => p.id === f.von)?.name ?? f.von, h.datum(f.am)].filter(Boolean).join(', ') : '');

  const zeilen: Zellwert[][] = systeme.map((s) => [
    s.id,
    s.name,
    u.liste('vorlagen.D-10.listen.typ')[TYP.indexOf(s.typ)] ?? '',
    ...pruefFragen(s),
    wechsel(s),
    bezug(s),
    m.rollenText(s),
    s.aiAct.begruendung,
    m.jn(s.aiAct.juristischGeprueft),
    durchAm(s.aiAct.geprueft),
    h.datum(s.naechsteUeberpruefung) ?? '',
  ]);

  const text = (kopf: string, breite = 18, umbruch = false): XlsxSpalte => ({ kopf, breite, umbruch });
  const auswahl = (kopf: string, werte: string[], breite = 12): XlsxSpalte => ({ kopf, breite, typ: 'liste', liste: werte, umbruch: true });
  const jno = m.jaNeinOffen;

  const hilfe = (u.roh(k('hilfe')) as string[][]).map((z, i) => [i + 1, ...z.map((x) => klartext(m.fuelle(x)))] as Zellwert[]);

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    eigenschaften: h.eigenschaften('E-01'),
    lenkung: h.lenkung('E-01'),
    firmenname: h.firmenname(),
    hinweisBlock: [
      ...h.kitBlock(),
      m.aiActBezug(['2(1)', '3 Nr. 3 bis 8', '22(1)', '23', '24', '25(1)', '25(3)']),
      h.normverweis('4.1'),
      m.juristisch(),
    ],
    blaetter: [
      {
        name: u.t(k('blaetter.rollen')),
        titel: u.t(k('titel_rollen')),
        hinweise: [
          ...(h.istLeer ? u.liste(k('hinweise_rollen')).map(m.fuelle) : []),
          ...(!h.istLeer && systeme.length ? [u.t(k('hinweis_vorbelegt'))] : []),
          ...(!h.istLeer && !systeme.length ? [u.t('vorlagen.E-0x.keine_systeme')] : []),
          m.standText(),
        ],
        fixiert: true,
        spalten: [
          text(sp[0]!, 9),
          text(sp[1]!, 24, true),
          auswahl(sp[2]!, u.liste('vorlagen.D-10.listen.typ'), 14),
          auswahl(sp[3]!, jno),
          auswahl(sp[4]!, jno),
          auswahl(sp[5]!, jno),
          auswahl(sp[6]!, jno),
          auswahl(sp[7]!, jno),
          auswahl(sp[8]!, jno),
          auswahl(sp[9]!, jno),
          auswahl(sp[10]!, jno),
          auswahl(sp[11]!, liste('wechsel'), 26),
          auswahl(sp[12]!, liste('bezug'), 28),
          text(sp[13]!, 20, true),
          text(sp[14]!, 40, true),
          auswahl(sp[15]!, m.jaNein, 11),
          text(sp[16]!, 20, true),
          { kopf: sp[17]!, breite: 12, typ: 'datum' },
        ],
        zeilen,
        leereZeilen: h.istLeer ? 25 : 5,
      },
      {
        name: u.t(k('blaetter.hilfe')),
        titel: u.t(k('titel_hilfe')),
        hinweise: [u.t(k('hinweis_hilfe'), { rechtsstand: h.rechtsstand() })],
        spalten: u.liste(k('spalten_hilfe')).map((kopf, i) => ({ kopf, breite: [5, 48, 40, 40, 22][i], umbruch: i > 0 })),
        zeilen: hilfe,
      },
    ],
  });
}
