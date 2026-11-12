// E-05 Betreiberpflichten bei Hochrisiko-KI (Art. 26(1) bis (12); ISO/IEC 42001 8.1, A.9)
// Checkliste je Hochrisiko-System mit Nachweisfeld. Checklistenschlüssel E-05.<punkt>.<KI-ID> (meta.checklisten);
// Art. 26(7) hat den Schlüssel E-05.arbeitnehmende.<KI-ID> (Prüfregel H14).
import type { XlsxMappe, Zellwert } from '../generator/ir.ts';
import type { KiSystem } from '../model/typen.ts';
import { istHochrisiko, modulHelfer } from './E-0x.ts';
import { erstelleHelfer, klartext, type VorlagenKontext } from './kontext.ts';

/**
 * Punkte der Checkliste in der Reihenfolge von Art. 26 Abs. 1 bis 12. Massgebende Liste der Schlüssel
 * E-05.<punkt>.<KI-ID>: Die Seiten des Geführten Modus (E9-betreiber-*) und die Prüfregel H14 verwenden dieselben Punkte.
 */
export const E05_PUNKTE = [
  'betriebsanleitung', 'aufsicht', 'organisation', 'eingabedaten', 'ueberwachung', 'protokolle',
  'arbeitnehmende', 'eu-stellen', 'dsfa', 'biometrie', 'betroffene', 'behoerden',
] as const;

export function e05(ctx: VorlagenKontext): XlsxMappe {
  const h = erstelleHelfer(ctx);
  const m = modulHelfer(ctx, h);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.E-05.${s}`;
  const sp = u.liste(k('spalten'));
  const anw = u.liste(k('listen.anwendbar'));
  const systeme = h.istLeer
    ? []
    : projekt.kiSysteme.filter((s) => s.aiAct.rollen.includes('betreiber') && istHochrisiko(s.aiAct.risikoklasse));
  const person = (id?: string) => projekt.personen.find((p) => p.id === id)?.name ?? '';

  const giltAb = (s?: KiSystem) =>
    s?.aiAct.risikoklasse === 'hochrisiko-anhang-i'
      ? `${m.frist('FRIST-15')} (${u.t('vorlagen.E-0x.klasse_kurz.hochrisiko-anhang-i')})`
      : s?.aiAct.risikoklasse === 'hochrisiko-anhang-iii'
        ? `${m.frist('FRIST-13')} (${u.t('vorlagen.E-0x.klasse_kurz.hochrisiko-anhang-iii')})`
        : `${m.frist('FRIST-13')} (${u.t('vorlagen.E-0x.klasse_kurz.hochrisiko-anhang-iii')}), ${m.frist('FRIST-15')} (${u.t('vorlagen.E-0x.klasse_kurz.hochrisiko-anhang-i')})`;

  // Vorschlag zur Anwendbarkeit: (3) ist ein Hinweis, (8) nur EU-Organe, (10) nur Strafverfolgung, (11) nur Anhang III
  const anwendbar = (punkt: (typeof E05_PUNKTE)[number], s?: KiSystem): string => {
    if (punkt === 'organisation') return anw[3]!;
    if (punkt === 'eu-stellen' || punkt === 'biometrie') return anw[2]!;
    if (punkt === 'betroffene' && s?.aiAct.risikoklasse === 'hochrisiko-anhang-i') return anw[2]!;
    return s ? anw[0]! : '';
  };

  const block = (s?: KiSystem): Zellwert[][] =>
    E05_PUNKTE.map((punkt, i) => {
      const schluessel = `E-05.${punkt}.${s?.id ?? 'KI-xxx'}`;
      const c = s ? projekt.meta.checklisten[schluessel] : undefined;
      return [
        s ? `${s.id} ${s.name}` : klartext(m.ph(u.t('allgemein.platzhalter.ki_system'))),
        m.fundstelle(`26(${i + 1})`),
        u.t(k(`punkte.${punkt}.pflicht`)),
        u.t(k(`punkte.${punkt}.tun`)),
        anwendbar(punkt, s),
        giltAb(s),
        c ? m.jn(c.erledigt) : '',
        c?.nachweis ?? '',
        h.datum(c?.datum) ?? '',
        s ? person(s.eigner) : '',
      ];
    });

  const zeilen: Zellwert[][] = systeme.length ? systeme.flatMap((s) => [...block(s), []]) : block();

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    eigenschaften: h.eigenschaften('E-05'),
    lenkung: h.lenkung('E-05'),
    firmenname: h.firmenname(),
    hinweisBlock: [...h.kitBlock(), m.aiActBezug(['26', '27', '72', '73', '86', '113(3)(c)']), h.normverweis('8.1, A.9.2 bis A.9.4'), m.juristisch()],
    blaetter: [
      {
        name: u.t(k('blaetter.checkliste')),
        titel: u.t(k('titel')),
        hinweise: [
          u.t(k('geltung'), { anhang_iii: m.frist('FRIST-13'), anhang_i: m.frist('FRIST-15') }),
          ...(h.istLeer ? u.liste(k('hinweise')).map(m.fuelle) : []),
          ...(!h.istLeer && !systeme.length ? [u.t(k('keine_systeme'))] : []),
          m.standText(),
        ],
        fixiert: true,
        spalten: [
          { kopf: sp[0]!, breite: 22, umbruch: true },
          { kopf: sp[1]!, breite: 16 },
          { kopf: sp[2]!, breite: 42, umbruch: true },
          { kopf: sp[3]!, breite: 46, umbruch: true },
          { kopf: sp[4]!, breite: 16, typ: 'liste', liste: anw },
          { kopf: sp[5]!, breite: 18, umbruch: true },
          { kopf: sp[6]!, breite: 10, typ: 'liste', liste: m.jaNein },
          { kopf: sp[7]!, breite: 30, umbruch: true },
          { kopf: sp[8]!, breite: 12, typ: 'datum' },
          { kopf: sp[9]!, breite: 18 },
        ],
        zeilen,
        leereZeilen: h.istLeer ? 0 : 3,
      },
    ],
  });
}
