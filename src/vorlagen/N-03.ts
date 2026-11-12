// N-03 Mess- und Prüfkonzept je KI-System (Modul NIST AI RMF; RMF-01, RMF-09 bis RMF-13, MEASURE)
// Blatt «Merkmale»: je KI-System die sieben Vertrauensmerkmale als Spalten (Rang 1 bis 4, mit Bezug zu den Zielen in D-09),
// Zielkonflikte und vorgeschlagene Zusatz-Controls. Blatt «Prüfungen»: je System und Merkmal Prüffälle, Messgrösse,
// Schwelle, Häufigkeit, nicht messbar mit Begründung, unabhängige Prüfung, Ergebnis. Firmendokument: aus
// kiSysteme[].messkonzept, sonst Vorschläge aus Kennzahlen (ziele[].kiSysteme) und Missbrauchsfällen.
// Blatt «Vertrauensmerkmale»: Erläuterung und Zuordnung zu D-09.
import type { XlsxMappe, XlsxSpalte, Zellwert } from '../generator/ir.ts';
import type { KiSystem, MessPruefung, VertrauensmerkmalSchluessel } from '../model/typen.ts';
import { aktivesSystem, rmfVorschlaege } from '../nist-rmf/logik.ts';
import { erstelleHelfer, type VorlagenKontext } from './kontext.ts';
import { nistHelfer } from './N-0x.ts';

/** Zusatz-Controls, die das Messkonzept umsetzt */
const MESS_CONTROLS = ['RMF-01', 'RMF-09', 'RMF-10', 'RMF-11', 'RMF-12', 'RMF-13'];

export function n03(ctx: VorlagenKontext): XlsxMappe {
  const h = erstelleHelfer(ctx);
  const n = nistHelfer(ctx, h);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.N-03.${s}`;
  const merkmale = n.d.merkmale;
  const zielText = (ziel: string) => u.tOpt(`vorlagen.D-09.ziele.${ziel}.name`) ?? ziel;
  const d09 = (id: string) => merkmale.find((m) => m.id === id)!.ziele_d09.map(zielText).join(', ');
  const merkmalKopf = (id: string) => u.t(k('merkmal_kopf'), { merkmal: n.merkmalTitel(id), ziele: d09(id) });

  const systeme: KiSystem[] = h.istLeer ? [] : projekt.kiSysteme.filter(aktivesSystem);
  const vorschlaege = h.istLeer ? [] : rmfVorschlaege(projekt, n.d.controls);
  const personName = (id?: string) => (id ? (projekt.personen.find((p) => p.id === id)?.name ?? id) : '');

  // Blatt «Merkmale»: Rang aus messkonzept.merkmale; ohne Rangfolge das höchste Ausmass eines Schadens in D-09 als Hinweis
  const ia = (s: KiSystem) => projekt.folgenabschaetzungen.find((f) => f.kiSystem === s.id);
  const merkmalZelle = (s: KiSystem, id: string): Zellwert => {
    const rang = (s.messkonzept?.merkmale ?? []).indexOf(id as VertrauensmerkmalSchluessel);
    if (rang >= 0) return rang + 1;
    const ausmass = merkmale
      .find((m) => m.id === id)!
      .ziele_d09.map((z) => ia(s)?.nutzenSchaden[z as keyof NonNullable<ReturnType<typeof ia>>['nutzenSchaden']]?.ausmass)
      .filter((x): x is number => typeof x === 'number');
    return ausmass.length ? u.t(k('d09_ausmass'), { ausmass: Math.max(...ausmass) }) : '';
  };
  const merkmalZeilen: Zellwert[][] = systeme.map((s) => [
    s.id,
    s.name,
    ...merkmale.map((m) => merkmalZelle(s, m.id)),
    s.messkonzept?.zielkonflikte ?? '',
    vorschlaege.filter((v) => MESS_CONTROLS.includes(v.id) && v.systeme.includes(s.id)).map((v) => `${v.id} (${n.entscheid(v.id)})`).join(', '),
  ]);

  // Blatt «Prüfungen»: erfasste Prüfungen; sonst Vorschläge aus Kennzahlen und Missbrauchsfällen
  const unabhaengig = (s: KiSystem): string => {
    const w = s.messkonzept?.unabhaengig;
    if (!w) return '';
    return [personName(w.wer), h.datum(w.wann), w.ergebnis?.trim()].filter(Boolean).join(', ');
  };
  const vorgeschlagen = (s: KiSystem): MessPruefung[] => {
    const liste: MessPruefung[] = [];
    for (const z of projekt.ziele.filter((x) => x.status !== 'verworfen' && (x.kiSysteme ?? []).includes(s.id))) {
      const letzte = [...z.messungen].sort((a, b) => a.datum.localeCompare(b.datum)).at(-1);
      liste.push({
        merkmal: 'gueltig',
        messgroesse: `${z.id} ${z.kennzahl}`.trim(),
        schwelle: z.sollwert,
        haeufigkeit: z.haeufigkeit,
        ergebnis: letzte ? `${letzte.wert} (${h.datum(letzte.datum)})` : '',
      });
    }
    if (s.missbrauchsfaelle?.trim()) liste.push({ merkmal: 'geschuetzt', prueffaelle: s.missbrauchsfaelle });
    return liste;
  };
  const merkmalListe = merkmale.map((m) => n.merkmalTitel(m.id));
  const pruefZeilen: Zellwert[][] = systeme.flatMap((s) => {
    const pruefungen = s.messkonzept?.pruefungen?.length ? s.messkonzept.pruefungen : vorgeschlagen(s);
    const ua = unabhaengig(s);
    if (!pruefungen.length) return [[s.id, s.name, '', '', '', '', '', '', '', ua, '']];
    return pruefungen.map((p, i): Zellwert[] => [
      s.id,
      s.name,
      n.merkmalTitel(p.merkmal),
      d09(p.merkmal),
      p.prueffaelle ?? '',
      p.messgroesse ?? '',
      p.schwelle ?? '',
      p.haeufigkeit ?? '',
      p.nichtMessbar ?? '',
      i === 0 ? ua : '',
      p.ergebnis ?? '',
    ]);
  });

  // Blatt «Vertrauensmerkmale»: Erläuterung; Hinweis zu D-09 nur in der leeren Vorlage
  const erklaerZeilen: Zellwert[][] = [
    ...merkmale.map((m): Zellwert[] => [
      n.merkmalTitel(m.id),
      u.t(`nist.merkmale.${m.id}.beschreibung`),
      d09(m.id),
      n.wert('rolle', m.rolle),
      m.subkategorien.join(', '),
      u.t(k('abschnitt'), { abschnitt: m.abschnitt_100_1 }),
      ...(h.istLeer ? [u.t(`nist.merkmale.${m.id}.d09_hinweis`)] : []),
    ]),
    ...n.d.zieleOhneMerkmal.map((z): Zellwert[] => [
      u.t(k('ohne_merkmal')),
      u.t(`nist.ziele_ohne_merkmal.${z.ziel}`),
      zielText(z.ziel),
      '',
      z.subkategorien.join(', '),
      '',
      ...(h.istLeer ? [''] : []),
    ]),
  ];

  const text = (kopf: string, breite: number, umbruch = true): XlsxSpalte => ({ kopf, breite, umbruch });
  const sm = u.liste(k('spalten_merkmale'));
  const spp = u.liste(k('spalten_pruefungen'));
  const se = u.liste(k('spalten_erklaerung'));
  const raenge = ['1', '2', '3', '4'];
  const keineSysteme = !h.istLeer && !systeme.length ? [u.t(k('keine_systeme'))] : [];
  return {
    sprache: u.sprache,
    eigenschaften: h.eigenschaften('N-03'),
    lenkung: h.lenkung('N-03'),
    firmenname: h.firmenname(),
    hinweisBlock: [...h.kitBlock(), n.bezug(), h.normverweis('6.2, 9.1, A.6.2.4')],
    blaetter: [
      {
        name: u.t(k('blaetter.merkmale')),
        titel: u.t(k('titel_merkmale')),
        hinweise: [...u.liste(k(h.istLeer ? 'hinweise_merkmale' : 'hinweise_merkmale_firma')), ...keineSysteme],
        fixiert: true,
        spalten: [
          text(sm[0]!, 9, false),
          text(sm[1]!, 24),
          ...merkmale.map((m) => ({ kopf: merkmalKopf(m.id), breite: 14, typ: 'liste', liste: raenge, umbruch: true }) as XlsxSpalte),
          text(sm[2]!, 40),
          text(sm[3]!, 30),
        ],
        zeilen: merkmalZeilen,
        leereZeilen: h.istLeer ? 8 : 2,
      },
      {
        name: u.t(k('blaetter.pruefungen')),
        titel: u.t(k('titel_pruefungen')),
        hinweise: [...u.liste(k(h.istLeer ? 'hinweise_pruefungen' : 'hinweise_pruefungen_firma')), ...keineSysteme],
        fixiert: true,
        spalten: [
          text(spp[0]!, 9, false),
          text(spp[1]!, 22),
          { kopf: spp[2]!, breite: 18, typ: 'liste', liste: merkmalListe, umbruch: true },
          text(spp[3]!, 16),
          text(spp[4]!, 30),
          text(spp[5]!, 24),
          text(spp[6]!, 18),
          text(spp[7]!, 14),
          text(spp[8]!, 28),
          text(spp[9]!, 26),
          text(spp[10]!, 22),
        ],
        zeilen: pruefZeilen,
        leereZeilen: h.istLeer ? 12 : 3,
      },
      {
        name: u.t(k('blaetter.erklaerung')),
        titel: u.t(k('titel_erklaerung')),
        spalten: (h.istLeer ? se : se.slice(0, -1)).map((kopf, i) => ({ kopf, breite: [24, 50, 20, 12, 16, 14, 50][i], umbruch: true })),
        zeilen: erklaerZeilen,
      },
    ],
  };
}
