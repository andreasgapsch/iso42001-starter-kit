// E-02 Risikoklassifizierung nach EU AI Act (Art. 5, 6, 49(2), 50, Anhang I und III; ISO/IEC 42001 6.1.4, A.5)
// Blätter: Klassifizierung je KI-System mit Vorschlag per Formel, Prüfhilfe.
import type { XlsxMappe, XlsxSpalte, Zellwert } from '../generator/ir.ts';
import { ANHANG_I, ART5_ERGEBNISSE, type JaNeinOffen, type KiSystem } from '../model/typen.ts';
import { KLASSEN, modulHelfer } from './E-0x.ts';
import { erstelleHelfer, klartext, type VorlagenKontext } from './kontext.ts';

export function e02(ctx: VorlagenKontext): XlsxMappe {
  const h = erstelleHelfer(ctx);
  const m = modulHelfer(ctx, h);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.E-02.${s}`;
  const liste = (s: string) => u.liste(k(`listen.${s}`));
  const sp = u.liste(k('spalten'));
  const systeme = h.istLeer ? [] : projekt.kiSysteme;
  const klassen = KLASSEN.map(m.klasse);
  const [ja, nein] = m.jaNein as [string, string];

  const bereich = (s: KiSystem): [string, string] => {
    const b = s.aiAct.anhangIiiBereich?.trim();
    if (!b) return [s.aiAct.risikoklasse === 'hochrisiko-anhang-iii' ? '' : liste('anhang_iii')[0]!, ''];
    const nr = Number(/^(\d)/.exec(b)?.[1]);
    return [nr >= 1 && nr <= 8 ? liste('anhang_iii')[nr]! : '', b];
  };
  const ausnahme = (s: KiSystem): string => (s.aiAct.ausnahmeArt63 ? liste('ausnahme')[5]! : s.aiAct.risikoklasse === 'hochrisiko-anhang-iii' ? liste('ausnahme')[0]! : '');
  const tr = (s: KiSystem, f: KiSystem['aiAct']['transparenz'][number]) => (s.aiAct.transparenz.includes(f) ? ja : nein);

  // Prüfpunkte aus dem Projekt (aiAct.art5, produkt, profiling, registrierung; N-23); ohne Angabe bleibt die Zelle leer
  const jno3 = (v: JaNeinOffen | undefined): string => (v ? m.jaNeinOffen[['ja', 'nein', 'offen'].indexOf(v)]! : '');
  const verbot = (s: KiSystem): string => (s.aiAct.art5 ? liste('verbot')[ART5_ERGEBNISSE.indexOf(s.aiAct.art5.ergebnis)] ?? '' : '');
  const anhangI = (s: KiSystem): string => (s.aiAct.produkt ? liste('anhang_i')[ANHANG_I.indexOf(s.aiAct.produkt.anhangI)] ?? '' : '');
  const registrierung = (s: KiSystem): string =>
    s.aiAct.registrierung ? liste('registrierung')[['ja', 'nein', 'nicht-noetig'].indexOf(s.aiAct.registrierung)] ?? '' : '';
  // Begründung: Einstufung, dazu die Begründungen der Prüfungen nach Art. 5 und Art. 6(1) (6(1a), 6(1b))
  const begruendung = (s: KiSystem): string =>
    [
      s.aiAct.begruendung,
      s.aiAct.art5?.begruendung ? u.t(k('begruendung_art5'), { text: s.aiAct.art5.begruendung }) : '',
      s.aiAct.produkt?.begruendung ? u.t(k('begruendung_produkt'), { text: s.aiAct.produkt.begruendung }) : '',
    ]
      .filter((t) => t.trim())
      .join('\n');

  // Prüfpunkte ohne Bezug: Art. 6(1) bis 6(1c) ohne Produkt nach Anhang I, Art. 6(4) ohne geltend gemachte Ausnahme nach Art. 6(3)
  const nichtRelevant = u.t(k('nicht_relevant'));
  const produktPunkt = (s: KiSystem, v: JaNeinOffen | undefined) => (s.aiAct.produkt?.anhangI === 'nein' ? nichtRelevant : jno3(v));
  const art64 = (s: KiSystem) => (s.aiAct.ausnahmeArt63 ? (s.aiAct.begruendung.trim() ? m.jaNeinOffen[0]! : '') : nichtRelevant);
  // Ohne Bereich nach Anhang III: Fall (Spalte K) und Ausnahme (Spalte M) «nicht relevant» statt leer (leer hiesse: nicht beurteilt)
  const ohneBereich = liste('anhang_iii')[0]!;
  const a1 = liste('anhang_i');
  const verbotFrei = [liste('verbot')[0]!, liste('verbot').at(-1)!];
  const zeilen: Zellwert[][] = systeme.map((s) => {
    const [b, fall] = bereich(s);
    const p = s.aiAct.produkt;
    const keinBereich = !h.istLeer && b === ohneBereich;
    const zeile: Zellwert[] = [
      s.id, s.name, s.zweck,
      verbot(s), anhangI(s), produktPunkt(s, p?.sicherheitsbauteil), produktPunkt(s, p?.nurNichtSicherheitsrelevant), produktPunkt(s, p?.ausfallGefaehrdet), produktPunkt(s, p?.drittpruefung),
      b, keinBereich && !fall ? nichtRelevant : fall, jno3(s.aiAct.profiling), keinBereich && !ausnahme(s) ? nichtRelevant : ausnahme(s), h.istLeer ? '' : art64(s), registrierung(s),
      tr(s, '50-1'), tr(s, '50-2'), tr(s, '50-3'), tr(s, '50-4'),
      null,
      m.klasse(s.aiAct.risikoklasse),
      begruendung(s),
      m.jn(s.aiAct.juristischGeprueft),
      // «Eingestuft durch, am» (aiAct.eingestuft)
      s.aiAct.eingestuft ? [projekt.personen.find((p) => p.id === s.aiAct.eingestuft!.von)?.name ?? s.aiAct.eingestuft.von, h.datum(s.aiAct.eingestuft.am)].filter(Boolean).join(', ') : '',
    ];
    // Zwischengespeichertes Ergebnis der Formel «Vorschlag» (Spalte T), sichtbar ohne Neuberechnung
    zeile[19] = vorschlagWert(zeile);
    return zeile;
  });

  // Vorschlag der Klasse per Formel; das Ergebnis (Spalte U) setzt die verantwortliche Person
  const q = (t: string) => `"${t.replace(/"/g, '""')}"`;
  const formel =
    `=IF(D{r}="","",` +
    `IF(AND(D{r}<>${q(verbotFrei[0]!)},D{r}<>${q(verbotFrei[1]!)}),${q(klassen[1]!)},` +
    `IF(AND(OR(E{r}=${q(a1[1]!)},E{r}=${q(a1[2]!)}),F{r}=${q(ja)},OR(G{r}<>${q(ja)},H{r}=${q(ja)}),I{r}=${q(ja)}),${q(klassen[3]!)},` +
    `IF(AND(J{r}<>"",J{r}<>${q(liste('anhang_iii')[0]!)},OR(L{r}=${q(ja)},M{r}=${q(liste('ausnahme')[0]!)},M{r}="")),${q(klassen[2]!)},` +
    `IF(OR(P{r}=${q(ja)},Q{r}=${q(ja)},R{r}=${q(ja)},S{r}=${q(ja)}),${q(klassen[4]!)},${q(klassen[5]!)})))))`;

  /** Gleiche Logik wie die Formel oben, für das zwischengespeicherte Ergebnis */
  function vorschlagWert(z: Zellwert[]): string {
    const c = (i: number) => String(z[i] ?? '');
    if (c(3) === '') return '';
    if (c(3) !== verbotFrei[0] && c(3) !== verbotFrei[1]) return klassen[1]!;
    if ((c(4) === a1[1] || c(4) === a1[2]) && c(5) === ja && (c(6) !== ja || c(7) === ja) && c(8) === ja) return klassen[3]!;
    if (c(9) !== '' && c(9) !== liste('anhang_iii')[0] && (c(11) === ja || c(12) === liste('ausnahme')[0] || c(12) === '')) return klassen[2]!;
    if ([15, 16, 17, 18].some((i) => c(i) === ja)) return klassen[4]!;
    return klassen[5]!;
  }
  const text = (kopf: string, breite = 18, umbruch = true): XlsxSpalte => ({ kopf, breite, umbruch });
  const auswahl = (kopf: string, werte: string[], breite = 12): XlsxSpalte => ({ kopf, breite, typ: 'liste', liste: werte, umbruch: true });
  const jno = m.jaNeinOffen;
  // Auswahlwerte der Prüfpunkte mit «nicht relevant» (Firmendokument)
  const jnoNr = h.istLeer ? jno : [...jno, u.t(k('nicht_relevant'))];

  const hilfe = (u.roh(k('hilfe')) as string[][]).map((z) => z.map((x) => klartext(m.fuelle(x))) as Zellwert[]);

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    eigenschaften: h.eigenschaften('E-02'),
    lenkung: h.lenkung('E-02'),
    firmenname: h.firmenname(),
    hinweisBlock: [
      ...h.kitBlock(),
      m.aiActBezug(['5(1)', '6(1) bis (4)', '49(2)', '50(1) bis (4)', 'Anhang I', 'Anhang III']),
      h.normverweis('6.1.4, A.5.2'),
      m.juristisch(k('juristisch')),
    ],
    blaetter: [
      {
        name: u.t(k('blaetter.klassen')),
        titel: u.t(k('titel_klassen')),
        hinweise: [
          ...(h.istLeer ? u.liste(k('hinweise_klassen')).map(m.fuelle) : [u.t(k('hinweis_firma'))]),
          ...(!h.istLeer && !systeme.length ? [u.t('vorlagen.E-0x.keine_systeme')] : []),
          m.standText(),
        ],
        fixiert: true,
        spalten: [
          text(sp[0]!, 9, false),
          text(sp[1]!, 22),
          text(sp[2]!, 30),
          auswahl(sp[3]!, liste('verbot'), 16),
          auswahl(sp[4]!, a1, 16),
          auswahl(sp[5]!, jnoNr),
          auswahl(sp[6]!, jnoNr, 16),
          auswahl(sp[7]!, jnoNr),
          auswahl(sp[8]!, jnoNr, 14),
          auswahl(sp[9]!, liste('anhang_iii'), 22),
          text(sp[10]!, 12),
          auswahl(sp[11]!, jno),
          auswahl(sp[12]!, h.istLeer ? liste('ausnahme') : [...liste('ausnahme'), nichtRelevant], 22),
          auswahl(sp[13]!, jnoNr),
          auswahl(sp[14]!, liste('registrierung'), 14),
          auswahl(sp[15]!, jno, 11),
          auswahl(sp[16]!, jno, 11),
          auswahl(sp[17]!, jno, 11),
          auswahl(sp[18]!, jno, 11),
          { kopf: sp[19]!, breite: 18, typ: 'formel', formel, umbruch: true },
          auswahl(sp[20]!, klassen, 18),
          text(sp[21]!, 40),
          auswahl(sp[22]!, m.jaNein, 11),
          text(sp[23]!, 18),
        ],
        zeilen,
        leereZeilen: h.istLeer ? 25 : 5,
      },
      {
        name: u.t(k('blaetter.hilfe')),
        titel: u.t(k('titel_hilfe')),
        hinweise: u.liste(k('hinweise_hilfe')).map(m.fuelle),
        spalten: u.liste(k('spalten_hilfe')).map((kopf, i) => ({ kopf, breite: [18, 28, 60, 22, 20][i], umbruch: true })),
        zeilen: hilfe,
      },
    ],
  });
}
