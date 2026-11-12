// E-03 Pflichtenmatrix EU AI Act (Pflichten je Rolle und Risikoklasse; ISO/IEC 42001 6.1.3, SoA)
// Blätter: Pflichten (aus src/ai-act/pflichten.yaml, gefiltert nach den Systemen im Projekt; leer: alle), Abdeckung.
import type { XlsxMappe, XlsxSpalte, Zellwert } from '../generator/ir.ts';
import type { ControlStatus, Risikoklasse } from '../model/typen.ts';
import { ROLLEN, modulHelfer, pflichtGiltFuer, type Pflicht } from './E-0x.ts';
import { erstelleHelfer, type VorlagenKontext } from './kontext.ts';

const GRADE = ['ganz', 'teilweise', 'nicht'] as const;
const STATUS: ControlStatus[] = ['offen', 'geplant', 'teilweise', 'umgesetzt', 'wirksam'];

export function e03(ctx: VorlagenKontext): XlsxMappe {
  const h = erstelleHelfer(ctx);
  const m = modulHelfer(ctx, h);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.E-03.${s}`;
  const liste = (s: string) => u.liste(k(`listen.${s}`));
  const sp = u.liste(k('spalten'));
  const systeme = h.istLeer ? [] : projekt.kiSysteme;

  // Filter: Pflichten, die für mindestens ein System gelten; ohne Systeme alle
  const betroffen = (p: Pflicht) => systeme.filter((s) => pflichtGiltFuer(p, s, projekt));
  const auswahl: Pflicht[] = systeme.length ? m.pflichten.filter((p) => betroffen(p).length > 0) : m.pflichten;

  const grad = (p: Pflicht) => liste('grad')[GRADE.indexOf(p.abdeckung_42001.grad)]!;
  const klassenText = (p: Pflicht) =>
    p.risikoklassen.map((kl) => (kl === 'alle' ? u.t(k('alle_klassen')) : m.klasse(kl as Risikoklasse))).join(', ');
  const control = (id?: string) => (id ? projekt.controls.find((c) => c.id === id) : undefined);
  const nachweisText = (ids: string[]) =>
    ids.map((id) => {
      const n = projekt.nachweise.find((x) => x.id === id);
      return n ? `${n.id} ${n.titel}` : id;
    }).join(', ');
  const person = (id?: string) => projekt.personen.find((p) => p.id === id)?.name ?? id ?? '';

  // Pflichten nach Art. 27 (Bedingung fria_anwendbar): Ergebnis der Prüfung aus E-06 (folgenabschaetzungen[].fria, N-23).
  // Ist die FRIA für alle betroffenen Systeme begründet nicht erforderlich, steht «nicht anwendbar» mit Verweis auf E-06.
  const fria = (p: Pflicht, sys: typeof systeme) => {
    if (h.istLeer || p.bedingung?.['fria_anwendbar'] !== true) return undefined;
    const eintraege = sys.map((s) => projekt.folgenabschaetzungen.find((f) => f.kiSystem === s.id && f.fria)).filter((f) => f !== undefined);
    if (!eintraege.length || eintraege.length < sys.length || !eintraege.every((f) => f.fria!.erforderlich === 'nein')) return undefined;
    return {
      status: u.t(k('nicht_anwendbar')),
      nachweis: eintraege.map((f) => u.t(k('fria_nicht_erforderlich'), { ia: f.id, datum: h.datum(f.fria!.am) ?? '' })).join('; '),
      verantwortlich: [...new Set(eintraege.map((f) => person(f.fria!.durch)).filter(Boolean))].join(', '),
    };
  };

  const zeilen: Zellwert[][] = auswahl.map((p) => {
    const sys = betroffen(p);
    const klassen = [...new Set(sys.map((s) => s.aiAct.risikoklasse))];
    const c = h.istLeer ? undefined : control(p.zusatz_control);
    const f = fria(p, sys);
    const bezug = [...p.abdeckung_42001.controls, ...p.abdeckung_42001.klauseln.map((x) => x.replace(/^K-/, ''))].join(', ');
    return [
      p.id,
      m.fundstelle(p.artikel),
      u.t(`pflichten.${p.id}.kurz`),
      p.rollen.map((r) => m.rolle(r)).join(', '),
      klassenText(p),
      m.giltAb(p, klassen),
      m.giltPraktisch(p, klassen),
      bezug,
      grad(p),
      p.zusatz_control ? `${p.zusatz_control} ${u.tOpt(`euaia.${p.zusatz_control}.name`) ?? ''}`.trim() : '',
      p.kmu_erleichterung ? m.fundstelle(p.kmu_erleichterung) : '',
      u.t(`pflichten.${p.id}.nachweis`),
      sys.map((s) => s.id).join(', '),
      f ? f.status : c ? liste('status')[STATUS.indexOf(h.controlStatus(c))]! : '',
      f ? f.nachweis : c ? nachweisText(c.nachweise) : '',
      f ? f.verantwortlich : c ? person(c.verantwortlich) : '',
    ];
  });

  // Blatt Abdeckung: Zahlen und Zusammenfassung «was das AIMS leistet und was nicht»
  const anzahl = (gr: (typeof GRADE)[number]) => auswahl.filter((p) => p.abdeckung_42001.grad === gr).length;
  const nicht = auswahl.filter((p) => p.abdeckung_42001.grad === 'nicht');
  const zusatz = [...new Set(auswahl.map((p) => p.zusatz_control).filter(Boolean))] as string[];
  const abdeckung: Zellwert[][] = [
    [u.t(k('abdeckung.anzahl')), auswahl.length, u.t(k(systeme.length ? 'abdeckung.gefiltert' : 'abdeckung.alle'))],
    ...GRADE.map((gr, i): Zellwert[] => [liste('grad')[i]!, anzahl(gr), u.t(k(`abdeckung.grad_${gr}`))]),
    [u.t(k('abdeckung.zusatz')), zusatz.length, zusatz.join(', ')],
    [u.t(k('abdeckung.ohne')), nicht.length, nicht.map((p) => p.id).join(', ')],
    [],
    [u.t(k('abdeckung.leistet')), '', ''],
    ...u.liste(k('abdeckung.leistet_liste')).map((t): Zellwert[] => ['', '', m.fuelle(t)]),
    [],
    [u.t(k('abdeckung.leistet_nicht')), '', ''],
    ...u.liste(k('abdeckung.leistet_nicht_liste')).map((t): Zellwert[] => ['', '', m.fuelle(t)]),
  ];

  const text = (kopf: string, breite = 18, umbruch = true): XlsxSpalte => ({ kopf, breite, umbruch });
  const rollenListe = ROLLEN.map(m.rolle);

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    eigenschaften: h.eigenschaften('E-03'),
    lenkung: h.lenkung('E-03'),
    firmenname: h.firmenname(),
    hinweisBlock: [...h.kitBlock(), m.aiActBezug(['4', '5', '6', '8 bis 27', '43', '47 bis 50', '72', '73', '86']), h.normverweis('6.1.3, 8.1'), m.juristisch()],
    blaetter: [
      {
        name: u.t(k('blaetter.pflichten')),
        titel: u.t(k('titel_pflichten')),
        hinweise: [
          ...(h.istLeer ? u.liste(k('hinweise_pflichten')) : [u.t(k(systeme.length ? 'hinweis_gefiltert' : 'hinweis_alle'))]),
          u.t(k('hinweis_formell')),
          m.standText(),
        ],
        fixiert: true,
        spalten: [
          text(sp[0]!, 16, false),
          text(sp[1]!, 22),
          text(sp[2]!, 50),
          text(sp[3]!, 18),
          text(sp[4]!, 20),
          text(sp[5]!, 16),
          text(sp[6]!, 16),
          text(sp[7]!, 18),
          { kopf: sp[8]!, breite: 11, typ: 'liste', liste: liste('grad') },
          text(sp[9]!, 26),
          text(sp[10]!, 16),
          text(sp[11]!, 40),
          text(sp[12]!, 14),
          { kopf: sp[13]!, breite: 13, typ: 'liste', liste: [...liste('status'), u.t(k('nicht_anwendbar'))] },
          text(sp[14]!, 24),
          text(sp[15]!, 18),
        ],
        zeilen,
        leereZeilen: h.istLeer ? 5 : 3,
      },
      {
        name: u.t(k('blaetter.abdeckung')),
        titel: u.t(k('titel_abdeckung')),
        hinweise: [u.t(k('hinweis_abdeckung'), { rollen: rollenListe.join(', ') })],
        spalten: u.liste(k('spalten_abdeckung')).map((kopf, i) => ({ kopf, breite: [34, 10, 90][i], umbruch: i !== 1 })),
        zeilen: abdeckung,
      },
    ],
  });
}
