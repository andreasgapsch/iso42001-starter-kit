// E-07 Transparenzpflichten (Art. 50, Übergang Art. 111(4); ISO/IEC 42001 A.8.2)
// Checkliste Art. 50(1) bis (5), Systeme mit Transparenzfällen (firma), Textbausteine.
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import { fusszeile, modulHelfer } from './E-0x.ts';
import { erstelleHelfer, md, type VorlagenKontext } from './kontext.ts';

const FAELLE = ['50-1', '50-2', '50-3', '50-4'] as const;
const BAUSTEINE = ['chatbot', 'inhalte', 'deepfake', 'text', 'emotion'] as const;

export function e07(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const m = modulHelfer(ctx, h);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.E-07.${s}`;
  let nr = 0;
  const ueber = (s: string): Block => ({ typ: 'ueberschrift', ebene: 1, text: `${++nr} ${u.t(k(`abschnitte.${s}`))}` });
  const absatz = (s: string): Block => ({ typ: 'absatz', text: md(m.fuelle(u.t(k(s)))) });
  const jaNeinPh = m.ph(`${u.t('allgemein.ja')}/${u.t('allgemein.nein')}`);

  const systeme = h.istLeer ? [] : projekt.kiSysteme.filter((s) => s.aiAct.transparenz.length > 0);
  // Firmendokument: Spalte «Erledigt» aus den Transparenzfällen und den Checklisten E-07.hinweis / E-07.kennzeichnung
  const ZEILE_FALL: ((typeof FAELLE)[number] | 'alle')[] = ['50-1', '50-2', '50-3', '50-4', '50-4', 'alle'];
  const erledigt = (fall: (typeof FAELLE)[number] | 'alle'): Text => {
    if (h.istLeer || !projekt.kiSysteme.length) return jaNeinPh;
    const betroffen = systeme.filter((s) => fall === 'alle' || s.aiAct.transparenz.includes(fall));
    if (!betroffen.length) return u.t(k('nicht_zutreffend'));
    if (fall === '50-3') return jaNeinPh; // keine Checkliste im Geführten Modus
    const schluessel = (s: (typeof systeme)[number], f: string) => (f === '50-1' ? `E-07.hinweis.${s.id}` : `E-07.kennzeichnung.${s.id}`);
    const ok = betroffen.every((s) =>
      (fall === 'alle' ? s.aiAct.transparenz.filter((t) => t !== '50-3') : [fall]).every((f) => projekt.meta.checklisten[schluessel(s, f)]?.erledigt),
    );
    return m.jn(ok);
  };
  const checkliste: Block = {
    typ: 'tabelle',
    kopf: u.liste(k('checkliste_kopf')),
    zeilen: (u.roh(k('checkliste')) as string[][]).map((z, i) => [...z.map((x) => md(m.fuelle(x))), erledigt(ZEILE_FALL[i] ?? 'alle')]),
    breiten: [16, 12, 28, 34, 10],
  };

  const fall = u.liste(k('faelle'));
  const systemZeilen: Text[][] = systeme.map((s) => [
    s.id,
    s.name,
    m.rollenText(s),
    s.aiAct.transparenz.map((t) => fall[FAELLE.indexOf(t)]!).join('; '),
  ]);

  // Firmendokument: Firmenname in den Bausteinen einsetzen
  const name = projekt.organisation.name.trim();
  const firma = (t: string) => (h.istLeer || !name ? t : t.replaceAll('[[Firmenname]]', name).replaceAll('[[Company name]]', name));
  const BAUSTEIN_FALL: Record<(typeof BAUSTEINE)[number], (typeof FAELLE)[number]> = { chatbot: '50-1', inhalte: '50-2', deepfake: '50-4', text: '50-4', emotion: '50-3' };
  // Im Firmendokument nur Bausteine für vorhandene Fälle; ohne Systeme mit Transparenzfall alle als Vorlage
  const zeigeAlle = h.istLeer || systeme.length === 0;
  const genutzt = BAUSTEINE.filter((b) => zeigeAlle || systeme.some((s) => s.aiAct.transparenz.includes(BAUSTEIN_FALL[b])));
  const ausgelassen = BAUSTEINE.filter((b) => !genutzt.includes(b));
  const kontakt = projekt.organisation.meldekanalExtern?.adresse;
  // Chatbot: je System der festgelegte Hinweis (KiSystem.nutzerinformation), sonst Baustein mit Systemname und Kontakt
  const chatbotTexte = (): string[] => {
    const mitFall = systeme.filter((s) => s.aiAct.transparenz.includes('50-1'));
    if (zeigeAlle || !mitFall.length) return [firma(u.t(k('bausteine.chatbot.text')))];
    return mitFall.map((s) =>
      s.nutzerinformation
        ? `${s.id} ${s.name}: ${s.nutzerinformation}`
        : firma(u.t(k('bausteine.chatbot.text')))
            .replace(/\[\[(Name des Assistenten|Assistant name)\]\]/, s.name)
            .replace(/\[\[(Kontakt|Contact)\]\]/, kontakt ?? '$&'),
    );
  };
  // Erzeugte Inhalte: je System mit Fall 50(2) der Hinweis mit dem Systemnamen und das Verfahren der Kennzeichnung
  // (KiSystem.aiAct.kennzeichnung, sonst Umsetzung von EUAIA-06 in der SoA); fehlt beides, bleibt der Platzhalter
  const inhalteTexte = (): string[] => {
    const mitFall = systeme.filter((s) => s.aiAct.transparenz.includes('50-2'));
    if (zeigeAlle || !mitFall.length) return [firma(u.t(k('bausteine.inhalte.text')))];
    const soa = projekt.controls.find((c) => c.id === 'EUAIA-06' && c.anwendbar === 'ja')?.umsetzung.trim();
    return mitFall.map((s) => {
      const verfahren = s.aiAct.kennzeichnung?.trim() || soa;
      return `${s.id} ${s.name}: ${u.t(k('bausteine.inhalte.text_firma'), { system: s.name, verfahren: verfahren ? verfahren.replace(/[.\s]+$/, '') : `[[${u.t(k('platzhalter_verfahren'))}]]` })}`;
    });
  };
  const bausteine: Block[] = [
    ...genutzt.flatMap((b): Block[] => [
      { typ: 'ueberschrift', ebene: 2, text: u.t(k(`bausteine.${b}.titel`)) },
      { typ: 'absatz', text: md(m.fuelle(u.t(k(`bausteine.${b}.wann`)))) },
      ...(b === 'chatbot' ? chatbotTexte() : b === 'inhalte' ? inhalteTexte() : [firma(u.t(k(`bausteine.${b}.text`)))]).map((t): Block => ({ typ: 'absatz', text: md(`**${u.t(k('baustein_titel'))}:** ${t}`) })),
    ]),
    ...(ausgelassen.length
      ? [{ typ: 'absatz', text: u.t(k('bausteine_nicht_noetig'), { bausteine: ausgelassen.map((b) => u.t(k(`bausteine.${b}.titel`))).join('; ') }) } as Block]
      : []),
  ];

  const bloecke: Block[] = [
    ...h.kitBlock(),
    m.aiActBezug(['50', '111(4)', '99(4)']),
    h.normverweis('A.8.2'),
    m.juristisch(k('juristisch')),
    ...h.hinweis(k('hinweis_umfang')),

    ueber('wozu'),
    absatz('wozu_text'),

    ueber('checkliste'),
    ...h.hinweis(k('hinweis_checkliste')),
    checkliste,
    absatz('ausnahmen'),

    ueber('uebergang'),
    absatz('uebergang_text'),

    ...(systemZeilen.length
      ? [ueber('systeme'), ...h.systemAnlage(u.t(k('abschnitte.systeme')), [{ typ: 'tabelle', kopf: u.liste(k('systeme_kopf')), zeilen: systemZeilen, breiten: [10, 26, 18, 46] }], systemZeilen.length)]
      : []),

    ueber('bausteine'),
    ...(zeigeAlle ? [absatz('bausteine_text')] : []),
    ...bausteine,
    ...h.anlagen(),
  ];

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: fusszeile(ctx, 'E-07') },
    lenkung: h.lenkung('E-07'),
    eigenschaften: h.eigenschaften('E-07'),
    bloecke,
  });
}
