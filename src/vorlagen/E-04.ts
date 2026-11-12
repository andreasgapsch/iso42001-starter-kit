// E-04 KI-Kompetenz der Mitarbeitenden (Art. 4 in der geänderten Fassung; ISO/IEC 42001 7.2, 7.3, A.4.6)
// Konzept: Zielgruppen, Inhalte, Formen, Nachweis; Verbindung zu D-17.
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import { fusszeile, modulHelfer } from './E-0x.ts';
import { erstelleHelfer, md, type VorlagenKontext } from './kontext.ts';

export function e04(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const m = modulHelfer(ctx, h);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.E-04.${s}`;
  let nr = 0;
  const ueber = (s: string): Block => ({ typ: 'ueberschrift', ebene: 1, text: `${++nr} ${u.t(k(`abschnitte.${s}`))}` });
  const absatz = (s: string): Block => ({ typ: 'absatz', text: md(m.fuelle(u.t(k(s)))) });
  const liste = (s: string): Block => ({ typ: 'liste', punkte: u.liste(k(s)).map((p) => md(m.fuelle(p))) });

  const person = (id: string) => projekt.personen.find((p) => p.id === id)?.name ?? id;
  const kompetenzen = h.istLeer ? [] : projekt.kompetenzen;
  const status = u.liste(k('status'));
  // Kurzfassung je Rolle (Seitenlimit 4); Anforderung und Nachweis im Einzelnen in D-17
  const kompetenzZeilen: Text[][] = kompetenzen.map((c) => [
    c.id,
    c.rolle,
    [c.massnahme, c.personen.length ? `(${c.personen.map(person).join(', ')})` : ''].filter(Boolean).join(' '),
    status[c.status === 'erfuellt' ? 2 : c.status === 'teilweise' ? 1 : 0]!,
  ]);
  const systeme = h.istLeer ? [] : projekt.kiSysteme.filter((s) => s.lebenszyklus === 'betrieb' || s.lebenszyklus === 'test');

  const bloecke: Block[] = [
    ...h.kitBlock(),
    m.aiActBezug(['4', '26(2)', '99(1)']),
    h.normverweis('7.2, 7.3, A.4.6'),
    ...h.hinweis(k('hinweis_umfang')),

    ueber('wozu'),
    absatz('wozu_text'),
    absatz('wozu_pflicht'),

    ueber('zielgruppen'),
    ...h.hinweis(k('hinweis_zielgruppen')),
    m.tabelle(k('zielgruppen_kopf'), k('zielgruppen_zeilen'), [20, 32, 18, 12, 18]),
    ...(systeme.length
      ? h.systemAnlage(
          u.t('allgemein.anlage.ki_systeme'),
          [absatz('systeme_text'), { typ: 'liste', punkte: systeme.map((s) => `${s.id} ${s.name} (${(s.fachbereich && u.tOpt(`gefuehrt.optionen.fachbereich.${s.fachbereich}`)) || s.fachbereich || s.betroffene})`) }],
          systeme.length,
        )
      : []),

    ueber('inhalte'),
    liste('inhalte_liste'),

    ueber('formen'),
    liste('formen_liste'),

    ueber('nachweis'),
    // Mit ISMS (D-17-EB) gibt es kein Blatt «Schulungen»: Teilnahmen stehen im bestehenden Schulungsnachweis
    !h.istLeer && projekt.meta.mitIsms
      ? { typ: 'liste', punkte: [u.t(k('nachweis_isms')), ...u.liste(k('nachweis_liste')).slice(1)].map((p) => md(m.fuelle(p))) }
      : liste('nachweis_liste'),
    ...(kompetenzZeilen.length
      ? [absatz('kompetenzen_text'), { typ: 'tabelle', kopf: u.liste(k('kompetenzen_kopf')), zeilen: kompetenzZeilen, breiten: [9, 24, 55, 12] } as Block]
      : []),

    ueber('verbindung'),
    absatz('verbindung_text'),
    m.juristisch(k('juristisch')),
    ...h.anlagen(),
  ];

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: fusszeile(ctx, 'E-04') },
    lenkung: h.lenkung('E-04'),
    eigenschaften: h.eigenschaften('E-04'),
    bloecke,
  });
}
