// N-04 Generative KI: Risiken und Massnahmen (Modul NIST AI RMF; NIST AI 600-1, Generative AI Profile, Abschnitt 2)
// Blatt «Bewertung»: je KI-System mit generativ die zwölf Risiken nach 600-1 mit Relevanz, Begründung, Massnahme und
// Zusatz-Controls RMF-Gxx (Firmendokument: kiSysteme[].genaiBewertung, Entscheid zu den Controls aus der SoA).
// Blatt «Risiken»: die zwölf Risiken mit eigenen Kurztiteln, Fundstelle, KMU-Relevanz, Merkmalen, Controls, Fall und am
// Ende Originaltitel und Originalbeschreibung nach NIST AI 600-1 Abschnitt 2 (wörtlich, bei DE mit eigener Übersetzung).
// Blatt «Quelle»: Dokument, zitierte Stellen, Vermerk.
import type { XlsxMappe, XlsxSpalte, Zellwert } from '../generator/ir.ts';
import type { JaNeinOffen, KiSystem } from '../model/typen.ts';
import { aktivesSystem } from '../nist-rmf/logik.ts';
import { nistZitat } from '../nist-rmf/original.ts';
import { erstelleHelfer, type VorlagenKontext } from './kontext.ts';
import { nistHelfer } from './N-0x.ts';

export function n04(ctx: VorlagenKontext): XlsxMappe {
  const h = erstelleHelfer(ctx);
  const n = nistHelfer(ctx, h);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.N-04.${s}`;
  const risiken = [...n.d.risiken].sort((a, b) => a.nr - b.nr);
  const text = (kopf: string, breite: number, umbruch = true): XlsxSpalte => ({ kopf, breite, umbruch });
  const jno: Record<JaNeinOffen, string> = { ja: u.t('allgemein.ja'), nein: u.t('allgemein.nein'), offen: u.t('allgemein.offen') };
  const systeme: KiSystem[] = h.istLeer ? [] : projekt.kiSysteme.filter((s) => aktivesSystem(s) && s.generativ === true);

  const controls = (ids: string[]) => ids.join(', ');
  const fuerSystem = (id: string, ki: string) => {
    const c = projekt.controls.find((x) => x.id === id);
    return !c || c.kiSysteme.length === 0 || c.kiSysteme.includes(ki);
  };
  const controlStand = (ids: string[]) => ids.map((id) => `${id} ${n.entscheid(id)}`).join('; ');
  const fundstelle = (r: (typeof risiken)[number]) => [u.t(k('abschnitt'), { abschnitt: r.abschnitt_600_1 }), n.fundstelle600(r.id)].filter(Boolean).join(', ');

  const bewertungZeilen: Zellwert[][] = h.istLeer
    ? risiken.map((r) => ['', '', r.nr, n.risikoTitel(r.id), n.wert('kmu_relevanz', r.kmu_relevanz), '', '', '', controls(r.controls), fundstelle(r)])
    : systeme.flatMap((s) =>
        risiken.map((r): Zellwert[] => {
          const b = s.genaiBewertung?.[r.id];
          return [
            s.id,
            s.name,
            r.nr,
            n.risikoTitel(r.id),
            n.wert('kmu_relevanz', r.kmu_relevanz),
            b ? jno[b.relevant] : jno.offen,
            b?.begruendung ?? '',
            b?.massnahme ?? '',
            // Nur Zusatz-Controls, die laut Erklärung zur Anwendbarkeit für dieses System gelten (kiSysteme leer = alle)
            r.controls.length ? controlStand(r.controls.filter((id) => fuerSystem(id, s.id))) || u.t(k('kein_control_system')) : r.praezisierung ? u.t('vorlagen.N-0x.praezisierung') : '',
            fundstelle(r),
          ];
        }),
      );

  // Originaltitel und Originalbeschreibung (600-1 Abschnitt 2), bei DE mit eigener Übersetzung «Titel: Beschreibung»
  const original = (id: string): Zellwert[] => {
    const z = nistZitat(ctx.kataloge, 'risiko', id);
    return [z?.titel ?? '', z?.zitat ?? '', ...(n.mitUebersetzung ? [z ? `${z.titelDe}: ${z.de}` : ''] : [])];
  };
  const originalSpalten: XlsxSpalte[] = [
    text(u.t(k('spalte_originaltitel')), 26),
    text(u.t(k('spalte_originaltext')), 60),
    ...(n.mitUebersetzung ? [text(u.t('vorlagen.N-0x.spalte_uebersetzung'), 60)] : []),
  ];

  const risikoZeilen: Zellwert[][] = risiken.map((r) => [
    r.nr,
    n.risikoTitel(r.id),
    fundstelle(r),
    n.wert('kmu_relevanz', r.kmu_relevanz),
    r.merkmale.map((m) => n.merkmalTitel(m)).join(', '),
    r.controls.map((c) => n.controlText(c)).join('; '),
    r.subkategorien.join(', '),
    u.t(`nist.genai_risiken.${r.id}.kmu_fall`),
    // Präzisierung (Hinweis an die Ausfüllenden) nur in der leeren Vorlage
    ...(h.istLeer ? [u.tOpt(`nist.genai_risiken.${r.id}.praezisierung`) ?? ''] : []),
    ...original(r.id),
  ]);

  // Firmendokument: Spaltenköpfe ohne Angaben zur Vorlage («KMU-Relevanz» wird «Allgemeine Relevanz»)
  const sb = u.liste(k(h.istLeer ? 'spalten_bewertung' : 'spalten_bewertung_firma'));
  const sr = h.istLeer ? u.liste(k('spalten_risiken')) : [...u.liste(k('spalten_risiken_firma')), ''];
  const keine = !h.istLeer && !systeme.length;
  return {
    sprache: u.sprache,
    eigenschaften: h.eigenschaften('N-04'),
    lenkung: h.lenkung('N-04'),
    firmenname: h.firmenname(),
    hinweisBlock: [...h.kitBlock(), n.bezug(true)],
    blaetter: [
      {
        name: u.t(k('blaetter.bewertung')),
        titel: u.t(k('titel_bewertung')),
        hinweise: [...u.liste(k(h.istLeer ? 'hinweise_bewertung' : 'hinweise_bewertung_firma')), ...(keine ? [u.t(k('keine_systeme'))] : [])],
        fixiert: true,
        spalten: [
          text(sb[0]!, 9, false),
          text(sb[1]!, 22),
          { kopf: sb[2]!, breite: 6, typ: 'zahl' },
          text(sb[3]!, 34),
          text(sb[4]!, 11),
          { kopf: sb[5]!, breite: 10, typ: 'liste', liste: [jno.ja, jno.nein, jno.offen] },
          text(sb[6]!, 34),
          text(sb[7]!, 34),
          text(sb[8]!, 30),
          text(sb[9]!, 18),
        ],
        zeilen: bewertungZeilen,
        leereZeilen: h.istLeer ? 12 : 0,
      },
      {
        name: u.t(k('blaetter.risiken')),
        titel: u.t(k('titel_risiken')),
        hinweise: h.istLeer ? u.liste(k('hinweise_risiken')) : undefined,
        spalten: [...(h.istLeer ? sr : sr.slice(0, -1)).map((kopf, i): XlsxSpalte => ({ kopf, breite: [6, 34, 18, 11, 30, 34, 26, 44, 40][i], umbruch: i !== 0, ...(i === 0 ? { typ: 'zahl' as const } : {}) })), ...originalSpalten],
        zeilen: risikoZeilen,
      },
      n.quelleBlatt(['ai-600-1']),
    ],
  };
}
