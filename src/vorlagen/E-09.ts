// E-09 Fristen und Stand EU AI Act (Art. 111, 113; ISO/IEC 42001 4.1, 4.2)
// Alle Fristen aus src/ai-act/stand.yaml, Erläuterung formell/praktisch als gekennzeichnete Auslegung, Schweizer Stand mit Datum.
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import type { Risikoklasse } from '../model/typen.ts';
import { fristDokument, fusszeile, modulHelfer, type Frist } from './E-0x.ts';
import { erstelleHelfer, md, type VorlagenKontext } from './kontext.ts';

const STATUS_LABEL = { rechtstext: 'rechtstext', auslegung: 'auslegung', zu_pruefen: 'zu_pruefen' } as const;
const WEITERE = ['altsysteme', 'maschinen', 'berichtigung-c2', 'iso-42001-keine-vermutung', 'normen-en-18286', 'uebergang-art-111-4', 'leitlinien-kommission'] as const;
const SCHWEIZ = ['schweiz-geltungsbereich', 'schweiz-regulierung'] as const;
const ART = ['geltung', 'uebergang', 'kommission'] as const;

/** Frist, ab der die Pflichten einer Risikoklasse (neben Art. 4 und 5) im Wesentlichen gelten */
const KLASSE_FRIST: Record<Exclude<Risikoklasse, 'offen'>, string> = {
  verboten: 'FRIST-02',
  'hochrisiko-anhang-iii': 'FRIST-13',
  'hochrisiko-anhang-i': 'FRIST-15',
  transparenz: 'FRIST-07',
  minimal: 'FRIST-02',
};

export function e09(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const m = modulHelfer(ctx, h);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.E-09.${s}`;
  let nr = 0;
  const ueber = (s: string): Block => ({ typ: 'ueberschrift', ebene: 1, text: `${++nr} ${u.t(k(`abschnitte.${s}`))}` });
  const absatz = (s: string, werte?: Record<string, string>): Block => ({ typ: 'absatz', text: md(m.fuelle(u.t(k(s), werte))) });
  const absaetze = (text: string): Block[] =>
    text.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean).map((t): Block => ({ typ: 'absatz', text: md(t) }));

  const statusVon = (id: string) => m.stand.hinweise.find((x) => x.id === id)?.status ?? 'rechtstext';
  const hinweisBlock = (id: string): Block[] => [
    // «zu prüfen» steht schon im Titel; der Zusatz würde es nur wiederholen
    {
      typ: 'ueberschrift',
      ebene: 2,
      text: statusVon(id) === 'zu_pruefen' ? u.t(`stand.hinweise.${id}.titel`) : `${u.t(`stand.hinweise.${id}.titel`)} (${u.t(k(`status.${STATUS_LABEL[statusVon(id)]}`))})`,
    },
    ...absaetze(u.t(`stand.hinweise.${id}.text`)),
  ];

  // Fundstelle in einem anderen Rechtsakt (Frist.dokument): Seite in der PDF des zuletzt genannten Akts, z. B. VO (EU) 2026/1744
  const fristFundstelle = (f: Frist): string => {
    const d = fristDokument(m.stand, f, u.sprache);
    return d?.seite ? u.t('vorlagen.E-0x.fundstelle', { angabe: m.fundstelle(f.artikel), seite: d.seite }) : m.fundstelle(f.artikel);
  };
  // Drei Spalten (Art der Frist vor der Fundstelle), damit die Tabelle schmal bleibt (Seitenlimit 4)
  const fristZeilen: Text[][] = m.stand.fristen.map((f) => [
    m.datum(f.datum),
    `${u.liste(k('arten'))[ART.indexOf(f.art)]!}: ${fristFundstelle(f)}`,
    u.t(`stand.fristen.${f.id}`),
  ]);

  const systeme = h.istLeer ? [] : projekt.kiSysteme;
  // Eine Zeile je Risikoklasse mit allen Systemen dieser Klasse
  const klassen = [...new Set(systeme.map((s) => s.aiAct.risikoklasse))];
  const systemZeilen: Text[][] = klassen.map((kl) => [
    m.klasse(kl),
    kl === 'offen' ? u.t(k('einstufung_offen')) : m.frist(KLASSE_FRIST[kl]),
    systeme.filter((s) => s.aiAct.risikoklasse === kl).map((s) => `${s.id} ${s.name}`).join('; '),
  ]);

  const schweizStand = m.stand.hinweise.find((x) => x.id === 'schweiz-regulierung')?.stand;
  // Firmendokument und Beispiel: die weiteren Hinweise zum Stand stehen in Anlage A (Seitenlimit 4 für den Haupttext)
  const weitereInAnlage = true;
  const weitereBloecke = WEITERE.flatMap(hinweisBlock);

  const bloecke: Block[] = [
    ...h.kitBlock(),
    m.aiActBezug(['111', '113']),
    h.normverweis('4.1, 4.2'),
    // Prüfauftrag zum Stand nur in der leeren Vorlage; im Firmendokument steht das Prüfdatum in Abschnitt 1
    ...(h.istLeer ? [{ typ: 'hinweis', art: 'normverweis', titel: u.t(k('pruefen_titel')), text: md(u.t(k('pruefen'), { geprueft: m.datum(m.stand.geprueft_am) })) } as Block] : []),
    ...h.hinweis(k('hinweis_umfang')),

    ueber('stand'),
    ...absaetze(u.t('stand.fassung.text')),
    // Rechtsstand einheitlich aus src/ai-act/stand.yaml (N-24)
    // Massgebender Stand und Prüfdatum in einem Absatz (Seitenlimit 4)
    { typ: 'absatz', text: md(`${m.fuelle(u.t(k('massgebend'), { rechtsstand: h.rechtsstand() }))} ${u.t('stand.fassung.geprueft', { datum: m.datum(m.stand.geprueft_am) })}. ${u.t('stand.fassung.naechste')}.`) },

    ueber('fristen'),
    absatz('fristen_text'),
    { typ: 'tabelle', kopf: u.liste(k('fristen_kopf')), zeilen: fristZeilen, breiten: [12, 24, 64] },

    ...(systemZeilen.length
      ? [ueber('systeme'), absatz('systeme_text'), { typ: 'tabelle', kopf: u.liste(k('systeme_kopf')), zeilen: systemZeilen, breiten: [20, 14, 66] } as Block]
      : []),

    ueber('formell'),
    // Kennzeichnung als Kasten nur in der leeren Vorlage; der Text selbst nennt sich «Auslegung des Kits» (Seitenlimit 4)
    ...(h.istLeer ? [{ typ: 'hinweis', art: 'normverweis', titel: u.t(k('auslegung_titel')), text: u.t(k('auslegung_kennzeichnung')) } as Block] : []),
    ...absaetze(u.t('stand.hinweise.formell-praktisch.text')),

    ueber('weitere'),
    // Normung und Vermutungswirkung (Art. 40, 41, Anhang ZA): nur Ausfüllhinweis der leeren Vorlage (Seitenlimit 4; Fundstelle EN 18286 in stand.yaml)
    ...h.hinweis(k('hinweis_normung')),
    ...(weitereInAnlage ? [absatz('weitere_verweis')] : weitereBloecke),

    ueber('schweiz'),
    absatz('schweiz_text', { stand: schweizStand ? m.datum(`${schweizStand}-01`).slice(3) : '' }),
    ...SCHWEIZ.flatMap(hinweisBlock),
    m.juristisch(),
    ...(weitereInAnlage
      ? [
          { typ: 'seitenumbruch' } as Block,
          { typ: 'ueberschrift', ebene: 1, text: u.t('allgemein.anlage.titel', { nr: 'A', titel: u.t(k('abschnitte.weitere')) }) } as Block,
          ...weitereBloecke,
        ]
      : []),
  ];

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: fusszeile(ctx, 'E-09') },
    lenkung: h.lenkung('E-09'),
    eigenschaften: h.eigenschaften('E-09'),
    bloecke,
  });
}
