// E-08 Anbieterpflichten im Überblick (Art. 8 bis 22, 25(2), 25(4), 43, 47 bis 49, 72, 73; ISO/IEC 42001 4.1, 8.1)
// Bevollmächtigter nach Art. 22 für Schweizer Anbieter: Checklistenschlüssel E-08.bevollmaechtigter.<KI-ID> (Prüfregel H16).
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import { fusszeile, istHochrisiko, modulHelfer } from './E-0x.ts';
import { erstelleHelfer, md, type VorlagenKontext } from './kontext.ts';

export function e08(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const m = modulHelfer(ctx, h);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.E-08.${s}`;
  let nr = 0;
  const ueber = (s: string): Block => ({ typ: 'ueberschrift', ebene: 1, text: `${++nr} ${u.t(k(`abschnitte.${s}`))}` });
  const absatz = (s: string): Block => ({ typ: 'absatz', text: md(m.fuelle(u.t(k(s)))) });
  const liste = (s: string): Block => ({ typ: 'liste', punkte: u.liste(k(s)).map((p) => md(m.fuelle(p))) });

  // Hochrisiko-Systeme, für die die Firma Anbieter ist
  const anbieter = h.istLeer ? [] : projekt.kiSysteme.filter((s) => s.aiAct.rollen.includes('anbieter') && istHochrisiko(s.aiAct.risikoklasse));
  // Tabelle Bevollmächtigter: Hochrisiko-Systeme als Anbieter und Systeme, zu denen die Frage schon festgehalten ist
  const mitBev = h.istLeer
    ? []
    : projekt.kiSysteme.filter((s) => anbieter.includes(s) || projekt.meta.checklisten[`E-08.bevollmaechtigter.${s.id}`]);
  const ohneEu = !projekt.organisation.euBezug.niederlassungEu;
  const jaNeinPh = m.ph(`${u.t('allgemein.ja')}/${u.t('allgemein.nein')}`);
  const bevZeilen: Text[][] = mitBev.length
    ? mitBev.map((s) => {
        const schluessel = `E-08.bevollmaechtigter.${s.id}`;
        const c = projekt.meta.checklisten[schluessel];
        // Ohne Hochrisiko-System als Anbieter ist kein Bevollmächtigter nötig: «nicht erforderlich» statt «ja» (Vermerk erledigt)
        const status = !anbieter.includes(s) ? u.t(k('nicht_erforderlich')) : c ? m.jn(c.erledigt) : jaNeinPh;
        return [`${s.id} ${s.name}`, status, h.wert(c?.nachweis, 'text')];
      })
    : [[m.ph(u.t('allgemein.platzhalter.ki_system')), jaNeinPh, h.wert(undefined, 'text')]];

  const systemAbsatz: Block[] = h.istLeer
    ? []
    : [
        {
          typ: 'absatz',
          text: anbieter.length
            ? u.t(k('systeme_ja'), { systeme: anbieter.map((s) => `${s.id} ${s.name} (${m.klasse(s.aiAct.risikoklasse)})`).join(', ') })
            : u.t(k('systeme_nein')),
        },
      ];

  const bloecke: Block[] = [
    ...h.kitBlock(),
    m.aiActBezug(['8 bis 22', '25(2)', '25(4)', '43', '47 bis 49', '72', '73']),
    h.normverweis('4.1, 8.1, A.6'),
    { typ: 'hinweis', art: 'normverweis', titel: u.t(k('aussage_titel')), text: md(u.t(k('aussage'))) },
    m.juristisch(k('juristisch')),
    ...h.hinweis(k('hinweis_umfang')),

    ueber('wann'),
    absatz('wann_text'),
    ...systemAbsatz,
    absatz('formell'),

    ueber('ueberblick'),
    m.tabelle(k('ueberblick_kopf'), k('ueberblick'), [20, 58, 22], m.fuelle),

    ueber('kmu'),
    liste('kmu_liste'),

    ueber('bevollmaechtigter'),
    absatz('bev_text'),
    ...h.hinweis(k('bev_hinweis')),
    ...(!h.istLeer && !ohneEu ? [absatz('bev_eu')] : []),
    // Firmendokument ohne betroffenes System: keine leere Musterzeile (der Absatz in Abschnitt 1 sagt es)
    // Checklistenschlüssel (Prüfregel H16) nur in der leeren Vorlage; im Firmendokument ohne Werkzeugangabe
    ...(h.istLeer
      ? [{ typ: 'tabelle', kopf: u.liste(k('bev_kopf')), zeilen: bevZeilen, breiten: [36, 20, 44] } as Block]
      : mitBev.length
        ? [{ typ: 'tabelle', kopf: u.liste(k('bev_kopf')), zeilen: bevZeilen, breiten: [36, 20, 44] } as Block]
        : []),

    ueber('aims'),
    absatz('aims_text'),
    m.tabelle(k('aims_kopf'), k('aims'), [24, 32, 32, 12], m.fuelle),
  ];

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: fusszeile(ctx, 'E-08') },
    lenkung: h.lenkung('E-08'),
    eigenschaften: h.eigenschaften('E-08'),
    bloecke,
  });
}
