// N-02 Abdeckungsmatrix AI RMF und ISO/IEC 42001 (Modul NIST AI RMF; Aufbau wie E-03)
// Blatt «Abdeckung»: 72 Subkategorien mit Bezug zu ISO/IEC 42001, Abdeckung durch die Norm und durch das AIMS,
// Dokumenten, Zusatz-Control oder Präzisierung und Entscheid (Firmendokument: aus der SoA bzw. nistProfil[].notiz).
// Blatt «Zusatz-Controls»: RMF-01 bis RMF-16 und RMF-G01 bis RMF-G07 mit Bezügen, Vorschlag je System und Entscheid.
// Blatt «Stand»: Bilanz der Abdeckung, Fassungen, Revision, Prüfdatum, Lizenz und Abgleich.
// Originaltexte NIST: im Blatt «Abdeckung» die Subkategorie (Englisch, bei DE mit eigener Übersetzung), im Blatt
// «Zusatz-Controls» die Massnahmen aus NIST AI 600-1 wörtlich; Blatt «Quelle» mit Vermerk.
import type { XlsxMappe, XlsxSpalte, Zellwert } from '../generator/ir.ts';
import type { NistAbdeckung } from '../kataloge/typen.ts';
import { rmfVorschlaege } from '../nist-rmf/logik.ts';
import { massnahmen600 } from '../nist-rmf/original.ts';
import { erstelleHelfer, type VorlagenKontext } from './kontext.ts';
import { nistHelfer } from './N-0x.ts';

const GRADE: NistAbdeckung[] = ['ganz', 'teilweise', 'nicht'];

export function n02(ctx: VorlagenKontext): XlsxMappe {
  const h = erstelleHelfer(ctx);
  const n = nistHelfer(ctx, h);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.N-02.${s}`;
  // Firmendokument: Spalte H nennt die Dokumente des Moduls (nicht «Vorlagen»)
  const sp = u.liste(k('spalten')).map((x, i) => (i === 7 && !h.istLeer ? u.t(k('spalte_nist_firma')) : x));
  const grade = GRADE.map((x) => n.wert('abdeckung', x));
  const entscheide = u.liste(k('listen.entscheid'));
  const subk = n.d.kern.subkategorien;
  const ohnePraefix = (ids: string[]) => ids.map((x) => x.replace(/^K-/, '').replace(/^27001-/, '')).join(', ');

  // Entscheid je Subkategorie: Zusatz-Control aus der SoA, Präzisierung aus der Notiz im Profil; ganz abgedeckt: nicht nötig
  const entscheid = (s: (typeof subk)[number]): string => {
    if (h.istLeer) return '';
    if (s.abdeckung === 'ganz' && s.abdeckung_kit === 'ganz') return u.t(k('nicht_noetig'));
    if (s.zusatz_control) return n.entscheid(s.zusatz_control);
    const notiz = projekt.nistProfil?.[s.id]?.notiz?.trim();
    return notiz ? `${u.t(k('praezisiert'))}: ${notiz}` : u.t('vorlagen.N-0x.entscheid.offen');
  };

  const zeilen: Zellwert[][] = [];
  for (const f of n.d.kern.funktionen) {
    zeilen.push(['', `${f.nist_id}: ${n.funktionTitel(f.id)}`]);
    for (const s of subk.filter((x) => x.funktion === f.id)) {
      zeilen.push([
        s.id,
        s.nist_id,
        n.subkTitel(s.id),
        ohnePraefix(s.iso42001),
        n.wert('abdeckung', s.abdeckung),
        n.wert('abdeckung', s.abdeckung_kit),
        n.dokumente(s.kit),
        [...(s.nist_vorlagen ?? [])].join(', '),
        n.behandlung(s),
        s.praezisierung && h.istLeer ? u.t(`nist.subkategorien.${s.id}.praezisierung`) : '',
        entscheid(s),
        n.wert('stufe', s.stufe),
        s.genai_600_1,
        n.fundstelle(s.id),
        ...n.originalZellen('subkategorie', s.id),
      ]);
    }
  }

  // Zusatz-Controls mit Vorschlag je System (vorschlag_wenn) und Entscheid aus der SoA
  const vorschlaege = h.istLeer ? [] : rmfVorschlaege(projekt, n.d.controls);
  const controlZeilen: Zellwert[][] = n.d.controls.map((c) => {
    const v = vorschlaege.find((x) => x.id === c.id);
    const form = !v ? '' : c.betreiber_lite && v.voll.length < v.systeme.length ? u.t(k('form_betreiber'), { systeme: v.systeme.filter((s) => !v.voll.includes(s)).join(', ') }) : '';
    return [
      c.id,
      n.controlTitel(c.id),
      n.wert('art', c.art),
      c.subkategorien.join(', '),
      ohnePraefix(c.verwandt_42001),
      ohnePraefix(c.verwandt_27001),
      n.dokumente([...c.kit, ...c.nist_vorlagen]),
      u.t(c.betreiber_lite ? 'allgemein.ja' : 'allgemein.nein'),
      h.istLeer ? '' : v ? [v.systeme.join(', '), form].filter(Boolean).join('; ') : u.t(k('nicht_vorgeschlagen')),
      h.istLeer ? '' : n.entscheid(c.id),
      c.bezug_600_1.join(', '),
      massnahmen600(ctx.kataloge, c.bezug_600_1).map((m) => `${m.id}: ${m.zitat}`).join('\n'),
    ];
  });

  // Blatt «Stand»: Bilanz und Fassungen
  const zahl = (feld: 'abdeckung' | 'abdeckung_kit', gr: NistAbdeckung) => subk.filter((s) => s[feld] === gr).length;
  const st = n.d.stand;
  const fassungen = st.fassungen.map((f): Zellwert[] => [u.t(`nist.stand.fassungen.${f.id}`), f.datei, String(f.seiten), f.url]);
  const stand: Zellwert[][] = [
    [u.t(k('stand.bilanz')), u.t(k('stand.norm')), u.t(k('stand.aims')), ''],
    ...GRADE.map((gr, i): Zellwert[] => [grade[i]!, zahl('abdeckung', gr), zahl('abdeckung_kit', gr), u.t(k(`stand.grad_${gr}`))]),
    [u.t(k('stand.zusatz')), n.d.controls.filter((c) => c.art === 'allgemein').length, n.d.controls.filter((c) => c.art === 'genai').length, u.t(k('stand.zusatz_text'))],
    [u.t(k('stand.praezisierungen')), subk.filter((s) => s.praezisierung).length, '', subk.filter((s) => s.praezisierung).map((s) => s.id).join(', ')],
    [],
    [u.t(k('stand.fassungen')), u.t(k('stand.datei')), u.t(k('stand.seiten')), u.t(k('stand.url'))],
    ...fassungen,
    [],
    [u.t(k('stand.geprueft')), h.datum(st.geprueft_am) ?? st.geprueft_am, '', ''],
    // Revision, Lizenz, Abgleich und Ablage der PDFs sind Angaben zur Vorlage; das Firmendokument nennt nur die Revision
    ...(h.istLeer
      ? ([
          [u.t(k('stand.revision')), u.t('nist.stand.revision'), '', ''],
          [u.t(k('stand.lizenz')), u.t('nist.stand.lizenz'), '', ''],
          [u.t(k('stand.abgleich')), u.t('nist.stand.abgleich.crosswalk-42001'), '', ''],
          [u.t(k('stand.pdf')), `${u.t('nist.stand.pdf_pruefung')} ${u.t(k('stand.ablage'), { ordner: n.ordner })}`, '', ''],
        ] as Zellwert[][])
      : [[u.t(k('stand.revision')), u.t(k('stand.revision_firma')), '', ''] as Zellwert[]]),
  ];

  const text = (kopf: string, breite: number, umbruch = true): XlsxSpalte => ({ kopf, breite, umbruch });
  const sc = u.liste(k('spalten_controls'));
  const ss = u.liste(k('spalten_stand'));
  return {
    sprache: u.sprache,
    eigenschaften: h.eigenschaften('N-02'),
    lenkung: h.lenkung('N-02'),
    firmenname: h.firmenname(),
    hinweisBlock: [...h.kitBlock(), n.bezug(), h.normverweis('6.1.3, Anhang A')],
    blaetter: [
      {
        name: u.t(k('blaetter.abdeckung')),
        titel: u.t(k('titel_abdeckung')),
        hinweise: [...u.liste(k(h.istLeer ? 'hinweise_abdeckung' : 'hinweise_abdeckung_firma')), n.standText()],
        fixiert: true,
        spalten: [
          text(sp[0]!, 9, false),
          text(sp[1]!, 13, false),
          text(sp[2]!, 38),
          text(sp[3]!, 22),
          { kopf: sp[4]!, breite: 11, typ: 'liste', liste: grade },
          { kopf: sp[5]!, breite: 11, typ: 'liste', liste: grade },
          text(sp[6]!, 20),
          text(sp[7]!, 10),
          text(sp[8]!, 28),
          text(sp[9]!, 40),
          { kopf: sp[10]!, breite: 28, typ: 'liste', liste: entscheide },
          text(sp[11]!, 14),
          { kopf: sp[12]!, breite: 10, typ: 'zahl' },
          text(sp[13]!, 20),
          ...n.originalSpalten(),
        ],
        zeilen,
      },
      {
        name: u.t(k('blaetter.controls')),
        titel: u.t(k('titel_controls')),
        hinweise: h.istLeer ? u.liste(k('hinweise_controls')) : [u.t(k('hinweis_controls_firma'))],
        fixiert: true,
        spalten: [text(sc[0]!, 10, false), text(sc[1]!, 36), text(sc[2]!, 12), text(sc[3]!, 18), text(sc[4]!, 18), text(sc[5]!, 16), text(sc[6]!, 18), text(sc[7]!, 10), text(sc[8]!, 26), text(sc[9]!, 28), text(sc[10]!, 22), text(sc[11]!, 60)],
        zeilen: controlZeilen,
      },
      {
        name: u.t(k('blaetter.stand')),
        titel: u.t(k('titel_stand')),
        spalten: ss.map((kopf, i) => ({ kopf, breite: [34, 60, 14, 50][i], umbruch: true })),
        zeilen: stand,
      },
      n.quelleBlatt(['ai-100-1', 'ai-600-1']),
    ],
  };
}
