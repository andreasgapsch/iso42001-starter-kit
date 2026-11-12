// D-24 Rolle zuerst: Anbieter oder Betreiber nach EU AI Act und was ISO/IEC 42001 nachweist (Leitfaden, 4.1)
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import { erstelleHelfer, md, type VorlagenKontext } from './kontext.ts';
import { entscheidungsbaumD24 } from './grafik.ts';

export function d24(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-24.${s}`;
  const ueber = (nr: number, s: string): Block => ({ typ: 'ueberschrift', ebene: 1, text: `${nr} ${u.t(k(`abschnitte.${s}`))}` });
  const liste = (s: string, nummeriert = false): Block => ({ typ: 'liste', nummeriert, punkte: u.liste(k(s)).map((p) => md(p)) });
  const tabelle = (kopf: string, zeilen: string, breiten: number[]): Block => ({
    typ: 'tabelle',
    kopf: u.liste(k(kopf)),
    zeilen: (u.roh(k(zeilen)) as string[][]).map((z) => z.map((zelle) => md(ohneEVerweise(zelle)))),
    breiten,
  });

  // Firmendokument: Verweise auf E-01 bis E-09 nur mit Modul; ohne Modul Inventar (D-10) und Kontext (D-01)
  const modul = projekt.meta.modulAiAct;
  const firmaText = (leerSchluessel: string, mitModul: string, ohneModul: string, werte?: Record<string, string>) =>
    u.t(k(h.istLeer ? leerSchluessel : modul ? mitModul : ohneModul), werte);
  const ohneEVerweise = (t: string) => (h.istLeer || modul ? t : t.replace(/\s*\(E-\d{2}\)/g, ''));
  const systemZeilen: Text[][] = h.istLeer
    ? []
    : projekt.kiSysteme.map((s) => [
        s.id,
        s.name,
        s.aiAct.rollen.length ? s.aiAct.rollen.map((r) => u.t(k(`rollen.${r}`))).join(', ') : u.t(k('rollen.offen')),
        s.aiAct.begruendung,
      ]);

  // Firmendokument: Teile für Anbieter von Hochrisiko-KI nur, wenn ein solches System erfasst ist (Bevollmächtigter Art. 22,
  // Konformitätsbewertung, CE, Konformitätserklärung, Registrierung, QMS Art. 17)
  const hochrisikoAnbieter = h.istLeer || projekt.kiSysteme.some((s) => s.aiAct.rollen.includes('anbieter') && s.aiAct.risikoklasse.startsWith('hochrisiko'));
  const NUR_HOCHRISIKO_ANBIETER = [7, 8, 9, 10, 11];
  const nachweisTabelle: Block = {
    typ: 'tabelle',
    kopf: u.liste(k('nachweis_kopf')),
    zeilen: (u.roh(k('nachweis_zeilen')) as string[][]).filter((_, i) => hochrisikoAnbieter || !NUR_HOCHRISIKO_ANBIETER.includes(i)).map((z) => z.map((zelle) => md(ohneEVerweise(zelle)))),
    breiten: [42, 14, 44],
  };
  const schweizListe: Block = { typ: 'liste', punkte: u.liste(k('schweiz_liste')).filter((_, i) => hochrisikoAnbieter || i !== 3).map((p) => md(p)) };

  const bloecke: Block[] = [
    ...h.kitBlock(),
    h.normverweis('4.1'),
    // Stand der Rechtslage: in der leeren Vorlage als Kasten, im Firmendokument als Absatz (kein Normverweis)
    h.istLeer
      ? { typ: 'hinweis', art: 'normverweis', titel: u.t(k('stand_titel')), text: firmaText('stand', 'stand', 'firma.stand_ohne_modul', { rechtsstand: h.rechtsstand() }) }
      : { typ: 'absatz', text: firmaText('stand', 'stand', 'firma.stand_ohne_modul', { rechtsstand: h.rechtsstand() }) },
    ...h.hinweis(k('hinweis_umfang')),
    { typ: 'absatz', text: h.istLeer ? u.t(k('einleitung')) : u.t(k('firma.einleitung'), { firma: projekt.organisation.name }) },

    ueber(1, 'baum'),
    ...h.hinweis(k('baum_hinweis')),
    liste('baum', true),
    // Dieselben Fragen als Entscheidungsbaum aus bearbeitbaren Formen (Anlage, zählt nicht zur Seitenvorgabe)
    ...h.grafikAnlage(u.t('vorlagen.grafik.d24.titel'), [entscheidungsbaumD24(ctx)]),

    ueber(2, 'schweiz'),
    { typ: 'absatz', text: u.t(k('schweiz_text')) },
    schweizListe,
    { typ: 'absatz', text: firmaText('schweiz_recht', 'schweiz_recht', 'firma.schweiz_recht_ohne_modul') },

    ueber(3, 'begriffe'),
    { typ: 'absatz', text: u.t(k('begriffe_text')) },
    tabelle('begriffe_kopf', 'begriffe_zeilen', [18, 41, 41]),
    { typ: 'absatz', text: firmaText('begriffe_hinweis', 'firma.begriffe_hinweis_modul', 'firma.begriffe_hinweis_ohne_modul') },

    ueber(4, 'nachweis'),
    { typ: 'absatz', text: u.t(k('nachweis_text')) },
    nachweisTabelle,

    // Firmendokument: Rollen der erfassten Systeme; leere Vorlage: Verweis auf D-10 und E-01 (Platz sparen)
    ...(systemZeilen.length
      ? [
          ueber(5, 'systeme'),
          ...h.systemAnlage(u.t(k('abschnitte.systeme')), [{ typ: 'tabelle', kopf: u.liste(k('systeme_kopf')), zeilen: systemZeilen, breiten: [10, 28, 20, 42] }], systemZeilen.length),
        ]
      : []),

    ueber(systemZeilen.length ? 6 : 5, 'weiter'),
    // Leere Vorlage: beide Fälle mit «Mit Modul» und «Ohne Modul»; Firmendokument: nur der eigene Fall
    h.istLeer
      ? liste('weiter_liste')
      : { typ: 'liste', punkte: [u.t(k(modul ? 'firma.weiter_modul' : 'firma.weiter_ohne_modul')), u.liste(k('weiter_liste'))[2]!].map((p) => md(p)) },
    // Modul NIST AI RMF (ab rc.2): Verhältnis zum AI Act in einem Satz
    ...(h.istLeer || projekt.meta.modulNistRmf ? [{ typ: 'absatz', text: md(`**${u.t(k(h.istLeer ? 'nist_praefix_leer' : 'nist_praefix'))}** ${u.t(k('nist_verhaeltnis'))}`) } as Block] : []),
    ...h.anlagen(),
  ];

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: h.fusszeile('D-24') },
    lenkung: h.lenkung('D-24'),
    eigenschaften: h.eigenschaften('D-24'),
    bloecke,
  });
}
