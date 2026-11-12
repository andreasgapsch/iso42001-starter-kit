// N-01 AI-RMF-Profil Ist und Ziel (Modul NIST AI RMF; NIST AI 100-1 Abschnitt 6, Profile)
// Blatt «Profil»: 72 Subkategorien nach Funktionen; Ist aus nistProfil oder abgeleitet aus dem Projekt
// (src/nist-rmf/logik.ts, istStufe), Ziel aus nistProfil, Lücke als Formel, Priorität, Massnahme, Nachweis, Fundstelle.
// Blatt «Übersicht»: je Funktion Anzahl, Ist und Ziel im Mittel, Lücken, Abdeckung (Formeln über das Blatt «Profil»).
// Letzte Spalten im Profil: Originaltext NIST der Subkategorie (Englisch) und bei DE die eigene Übersetzung; Blatt «Quelle».
import type { XlsxMappe, XlsxSpalte, Zellwert } from '../generator/ir.ts';
import { istStufe, zielStufe, type IstHerleitung } from '../nist-rmf/logik.ts';
import { erstelleHelfer, type VorlagenKontext } from './kontext.ts';
import { nistHelfer, spalte } from './N-0x.ts';

const STUFEN = ['0', '1', '2', '3'];

export function n01(ctx: VorlagenKontext): XlsxMappe {
  const h = erstelleHelfer(ctx);
  const n = nistHelfer(ctx, h);
  const { u, projekt, kataloge } = ctx;
  const k = (s: string) => `vorlagen.N-01.${s}`;
  const sp = u.liste(k('spalten'));
  const prioritaeten = u.liste(k('listen.prioritaet'));
  const dokStatus = u.liste(k('herleitung.dok_status'));
  const ctrlStatus = u.liste(k('herleitung.ctrl_status'));

  const herleitung = (ist: IstHerleitung, controlId?: string): string => {
    if (ist.quelle === 'profil') return u.t(k('herleitung.profil'));
    // Gruppiert nach Stand, z. B. «Dokumente freigegeben: D-03, D-15; in Arbeit: D-05»
    const gruppen = (eintraege: { id: string; stufe: number }[], namen: string[], id: (x: string) => string) =>
      namen
        .map((name, stufe) => ({ name, ids: eintraege.filter((x) => x.stufe === stufe).map((x) => id(x.id)) }))
        .filter((g) => g.ids.length)
        .reverse()
        .map((g) => `${g.name}: ${g.ids.join(', ')}`)
        .join('; ');
    const teile = [
      ist.dokumente.length ? u.t(k('herleitung.dokumente'), { liste: gruppen(ist.dokumente, dokStatus, h.dokId) }) : '',
      ist.controls.length ? u.t(k('herleitung.controls'), { liste: gruppen(ist.controls, ctrlStatus, (x) => x) }) : '',
      ist.angabenFehlen ? u.t(k('herleitung.angaben')) : '',
      ist.luecke ? (controlId ? u.t(k('herleitung.luecke'), { control: controlId }) : u.t(k('herleitung.luecke_praez'))) : '',
    ].filter(Boolean);
    return teile.length ? teile.join('; ') : u.t(k('herleitung.keine'));
  };
  const massnahmen = (ids: string[] = []): string =>
    ids
      .map((id) => {
        const m = projekt.massnahmen.find((x) => x.id === id);
        return m ? `${m.id} ${m.titel}` : id;
      })
      .join(', ');
  /** Nachweise: im Firmendokument die Nachweise der verknüpften Controls, sonst typische Nachweise */
  const nachweise = (id: string, controlIds: string[]): string => {
    const typisch = u.liste(`nist.subkategorien.${id}.nachweise`).join('; ');
    if (h.istLeer) return typisch;
    const eigene = [...new Set(controlIds.flatMap((c) => projekt.controls.find((x) => x.id === c)?.nachweise ?? []))].map((nid) => {
      const x = projekt.nachweise.find((y) => y.id === nid);
      return x ? `${x.id} ${x.titel}` : nid;
    });
    return eigene.length ? eigene.join(', ') : typisch;
  };

  const zeilen: Zellwert[][] = [];
  const werte: { funktion: string; ist?: number; ziel?: number; luecke?: number; ganz: boolean }[] = [];
  for (const f of n.d.kern.funktionen) {
    zeilen.push(['', u.t(k('abschnitt'), { nist: f.nist_id, titel: n.funktionTitel(f.id) })]);
    for (const s of n.d.kern.subkategorien.filter((x) => x.funktion === f.id)) {
      const ist = h.istLeer ? undefined : istStufe(projekt, kataloge, s);
      const ziel = h.istLeer ? undefined : zielStufe(projekt, s.id);
      const luecke = ist && ziel !== undefined ? Math.max(0, ziel - ist.stufe) : undefined;
      const eintrag = h.istLeer ? undefined : projekt.nistProfil?.[s.id];
      werte.push({ funktion: f.kuerzel, ist: ist?.stufe, ziel, luecke, ganz: s.abdeckung_kit === 'ganz' });
      const controlIds = [...s.iso42001.filter((x) => /^A\./.test(x)), ...(s.zusatz_control ? [s.zusatz_control] : [])];
      zeilen.push([
        s.id,
        s.nist_id,
        f.kuerzel,
        n.subkTitel(s.id),
        n.wert('stufe', s.stufe),
        n.wert('abdeckung', s.abdeckung_kit),
        n.dokumente(s.kit),
        n.behandlung(s),
        ist ? ist.stufe : null,
        ist ? herleitung(ist, s.zusatz_control) : '',
        ziel ?? null,
        luecke ?? null,
        eintrag?.prioritaet ? (prioritaeten[['hoch', 'mittel', 'tief'].indexOf(eintrag.prioritaet)] ?? eintrag.prioritaet) : '',
        [massnahmen(eintrag?.massnahmen), eintrag?.notiz?.trim() ?? ''].filter(Boolean).join('; '),
        nachweise(s.id, controlIds),
        n.fundstelle(s.id),
        ...n.originalZellen('subkategorie', s.id),
      ]);
    }
  }

  const text = (kopf: string, breite: number, umbruch = true): XlsxSpalte => ({ kopf, breite, umbruch });
  const spalten: XlsxSpalte[] = [
    text(sp[0]!, 9, false),
    text(sp[1]!, 13, false),
    text(sp[2]!, 9, false),
    text(sp[3]!, 40),
    text(sp[4]!, 14),
    text(sp[5]!, 12),
    text(sp[6]!, 20),
    text(sp[7]!, 26),
    { kopf: sp[8]!, breite: 9, typ: 'liste', liste: STUFEN },
    text(sp[9]!, 34),
    { kopf: sp[10]!, breite: 9, typ: 'liste', liste: STUFEN },
    { kopf: sp[11]!, breite: 8, typ: 'formel', formel: '=IF(OR($A{r}="",I{r}="",K{r}=""),"",MAX(0,K{r}-I{r}))' },
    { kopf: sp[12]!, breite: 11, typ: 'liste', liste: prioritaeten },
    text(sp[13]!, 30),
    text(sp[14]!, 34),
    text(sp[15]!, 20),
    ...n.originalSpalten(),
  ];

  // Übersicht je Funktion: Formeln über das Blatt «Profil» mit zwischengespeichertem Ergebnis
  const profil = u.t(k('blaetter.profil'));
  const ref = (nr: number) => `'${profil.replace(/'/g, "''")}'!$${spalte(nr)}:$${spalte(nr)}`;
  const F = ref(3);
  const alleKennung = u.t(k('gesamt_kennung'));
  const kriterium = `IF(B{r}="${alleKennung}","??",B{r})`;
  const mittel = (liste: (number | undefined)[]): number | string => {
    const z = liste.filter((x): x is number => x !== undefined);
    return z.length ? Math.round((z.reduce((a, b) => a + b, 0) / z.length) * 10) / 10 : '';
  };
  const uebersicht = (kennung: string, titel: string, w: typeof werte): Zellwert[] => [
    titel,
    kennung,
    w.length,
    mittel(w.map((x) => x.ist)),
    mittel(w.map((x) => x.ziel)),
    h.istLeer ? '' : w.filter((x) => (x.luecke ?? 0) > 0).length,
    w.filter((x) => x.ganz).length,
  ];
  const ganzText = n.wert('abdeckung', 'ganz');
  const uebersichtZeilen: Zellwert[][] = [
    ...n.d.kern.funktionen.map((f) => uebersicht(f.kuerzel, `${f.nist_id}: ${n.funktionTitel(f.id)}`, werte.filter((x) => x.funktion === f.kuerzel))),
    // Gesamtzeile: lesbare Kennung; die Formeln zählen dafür alle Funktionen (Muster «??» für die zweistelligen Kürzel)
    uebersicht(alleKennung, u.t(k('gesamt')), werte),
  ];
  const su = u.liste(k('spalten_uebersicht'));

  return {
    sprache: u.sprache,
    eigenschaften: h.eigenschaften('N-01'),
    lenkung: h.lenkung('N-01'),
    firmenname: h.firmenname(),
    hinweisBlock: [...h.kitBlock(), n.bezug()],
    blaetter: [
      {
        name: profil,
        titel: u.t(k('titel_profil')),
        hinweise: [...u.liste(k(h.istLeer ? 'hinweise_profil' : 'hinweise_profil_firma')), u.t('vorlagen.N-0x.stufen_text'), n.standText()],
        fixiert: true,
        // Lücke Ziel minus Ist: 0 gut, 1 Handlung nötig, ab 2 kritisch
        formate: [{ art: 'stufen', spalte: 11, regeln: [{ bis: 0, rolle: 'status-gut' }, { bis: 1, rolle: 'status-warnung' }], sonst: 'status-kritisch' }],
        spalten,
        zeilen,
      },
      {
        name: u.t(k('blaetter.uebersicht')),
        titel: u.t(k('titel_uebersicht')),
        hinweise: h.istLeer ? u.liste(k('hinweise_uebersicht')) : undefined,
        // Mittelwerte Ist und Ziel (Stufen 0 bis 3) als Datenbalken
        formate: [
          { art: 'datenbalken', spalte: 3, min: 0, max: 3 },
          { art: 'datenbalken', spalte: 4, min: 0, max: 3, rolle: 'seq-3' },
        ],
        spalten: [
          { kopf: su[0]!, breite: 30 },
          { kopf: su[1]!, breite: 10 },
          { kopf: su[2]!, breite: 14, typ: 'formel', formel: `=COUNTIF(${F},${kriterium})` },
          { kopf: su[3]!, breite: 12, typ: 'formel', formel: `=IFERROR(ROUND(AVERAGEIF(${F},${kriterium},${ref(9)}),1),"")` },
          { kopf: su[4]!, breite: 12, typ: 'formel', formel: `=IFERROR(ROUND(AVERAGEIF(${F},${kriterium},${ref(11)}),1),"")` },
          { kopf: su[5]!, breite: 14, typ: 'formel', formel: `=COUNTIFS(${F},${kriterium},${ref(12)},">0")` },
          { kopf: su[6]!, breite: 16, typ: 'formel', formel: `=COUNTIFS(${F},${kriterium},${ref(6)},"${ganzText}")` },
        ],
        zeilen: uebersichtZeilen,
      },
      n.quelleBlatt(),
    ],
  };
}
