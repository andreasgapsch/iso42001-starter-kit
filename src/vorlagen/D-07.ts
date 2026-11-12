// D-07 KI-Risikoregister und Behandlungsplan (6.1.1 bis 6.1.3, 8.2, 8.3)
import type { XlsxBlatt, XlsxMappe, Zellwert } from '../generator/ir.ts';
import { erstelleHelfer, klartext, type VorlagenKontext } from './kontext.ts';
import { projektMatrix, risikomatrixXlsx, stufenLegende } from './grafik.ts';

/** Eintrag des Katalogs src/kataloge/genai-risiken.yaml */
interface GenaiRisiko { id: string; owasp?: string; quelle: string; ebenen: string[]; controls: string[]; zielgruppe: ('betreiber' | 'entwickler')[]; nist_600_1?: string[] }

export function d07(ctx: VorlagenKontext): XlsxMappe {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-07.${s}`;
  const liste = (s: string) => u.liste(k(`listen.${s}`));
  const sp = u.liste(k('spalten_register'));
  const kiName = (id?: string) => projekt.kiSysteme.find((s) => s.id === id)?.name ?? '';
  const personName = (id?: string) => projekt.personen.find((p) => p.id === id)?.name ?? '';
  const status = { offen: 0, 'in-behandlung': 1, behandelt: 2, akzeptiert: 3, geschlossen: 4 } as const;
  const behandlungen = ['vermeiden', 'vermindern', 'teilen', 'tragen', 'nutzen'];
  const ebenen = ['organisation', 'individuen', 'gesellschaft'];

  const annahmeText = (r: (typeof projekt.risiken)[number]): string =>
    [
      r.restrisikoBegruendung?.trim(),
      r.ausnahme
        ? u.t(k('ausnahme_text'), { von: personName(r.ausnahme.von) || r.ausnahme.von, am: h.datum(r.ausnahme.am) ?? '', bis: h.datum(r.ausnahme.bis) ?? '' }) +
          (r.ausnahme.begruendung?.trim() ? `: ${r.ausnahme.begruendung.trim()}` : '')
        : '',
    ]
      .filter(Boolean)
      .join(' ');
  const zeilen: Zellwert[][] = h.istLeer
    ? []
    : projekt.risiken.map((r) => [
        r.id,
        liste('art')[r.art === 'chance' ? 1 : 0]!,
        r.kiSystem ? `${r.kiSystem} ${kiName(r.kiSystem)}` : '',
        r.titel,
        r.beschreibung,
        // Beschriftung wie in der Auswahlliste und im Katalog von D-06 (eine Quelle: Optionsgruppe risikoquelle), auch bei
        // Chancen genau ein Eintrag der Werteliste (Datenvalidierung der Spalte)
        h.risikoquelle(r.quelle),
        r.ebenen.length > 1 ? liste('ebene')[3]! : r.ebenen[0] ? liste('ebene')[ebenen.indexOf(r.ebenen[0])]! : '',
        r.ursache,
        r.folge,
        r.bestehendeMassnahmen,
        r.w,
        r.a,
        // Risikowert: Formel, mit Ergebnis für Leser ohne Neuberechnung
        r.w !== null && r.a !== null ? r.w * r.a : null,
        r.behandlung ? liste('behandlung')[behandlungen.indexOf(r.behandlung)]! : '',
        r.controls.join(', '),
        r.massnahmen.join(', '),
        personName(r.eigner),
        r.wNach,
        r.aNach,
        r.wNach !== null && r.aNach !== null ? r.wNach * r.aNach : null,
        personName(r.restrisikoAkzeptiert?.von) || (r.restrisikoAkzeptiert?.von ?? ''),
        h.datum(r.restrisikoAkzeptiert?.am) ?? '',
        liste('status')[status[r.status]]!,
        // Datum der letzten Beurteilung oder Neubeurteilung (8.2)
        r.beurteiltAm ?? '',
        // Begründung der Annahme über der Akzeptanzgrenze und befristete Ausnahme (D-03, D-06)
        annahmeText(r),
        r.ismsRisiko ?? '',
      ]);

  // Behandlungsplan: alle Massnahmen, die Risiken behandeln, unabhängig von der Herkunft (Risiko, AI Act, Audit, Prüfung, ...).
  // Massnahmen ohne Risikobezug (z. B. aus einem Ziel) stehen ebenfalls im Plan; die Spalte «Herkunft» zeigt den Anlass.
  const herkunftArten = ['risiko', 'audit', 'managementbewertung', 'pruefung', 'checkliste', 'aiact', 'ziel', 'aenderung', 'sonstige'];
  const risikenZu = (mid: string) => projekt.risiken.filter((r) => r.massnahmen.includes(mid)).map((r) => r.id);
  const massnahmen = projekt.massnahmen;
  const mStatus = ['offen', 'in-arbeit', 'erledigt', 'verworfen'];
  const prio = ['hoch', 'mittel', 'tief'];
  const planZeilen: Zellwert[][] = h.istLeer
    ? []
    : massnahmen.map((m) => {
        const art = liste('herkunft')[herkunftArten.indexOf(m.herkunft.art)] ?? m.herkunft.art;
        // Risiko-IDs aus dem Register und aus dem Herkunftsverweis, ohne Doppel
        const ausRef = (m.herkunft.ref ?? '').split(/[,;]\s*/).map((x) => x.trim()).filter((x) => /^R-\d+/.test(x));
        const risiken = [...new Set([...risikenZu(m.id), ...ausRef])].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
        const andere = (m.herkunft.ref ?? '').split(/[,;]\s*/).map((x) => x.trim()).filter((x) => x && !/^R-\d+/.test(x));
        return [
          m.id,
          m.titel,
          andere.length ? `${art}: ${andere.join(', ')}` : art,
          risiken.join(', '),
          personName(m.verantwortlich),
          h.datum(m.termin) ?? '',
          // Status zum Stand des Dokuments: Was erst nach der Freigabe erledigt wurde, ist in dieser Fassung noch in Arbeit
          liste('massnahme_status')[mStatus.indexOf(h.massnahmeStatusAm(m, h.standDatum('D-07')))]!,
          liste('prioritaet')[prio.indexOf(m.prioritaet)]!,
          m.beschreibung,
          h.massnahmeStatusAm(m, h.standDatum('D-07')) === 'erledigt' ? (m.nachweise ?? []).join(', ') : '',
        ];
      });

  const kr = projekt.organisation.risikokriterien;
  const vorschlag = u.roh(k('skalen_vorschlag')) as { wahrscheinlichkeit: (string | number)[][]; auswirkung: (string | number)[][] };
  const wSkala = !h.istLeer && kr.wahrscheinlichkeit.length ? kr.wahrscheinlichkeit.map((s) => [s.stufe, s.bezeichnung, s.beschreibung]) : vorschlag.wahrscheinlichkeit;
  const aSkala = !h.istLeer && kr.auswirkung.length ? kr.auswirkung.map((s) => [s.stufe, s.bezeichnung, s.beschreibung]) : vorschlag.auswirkung;
  const skalenZeilen: Zellwert[][] = wSkala.map((w, i) => [w[0] as number, String(w[1]), String(w[2]), String(aSkala[i]?.[1] ?? ''), String(aSkala[i]?.[2] ?? '')]);

  // Auswahllisten W und A mit den Stufen der eigenen Skalen (D-06), nicht fest 1 bis 4
  const stufenW = h.skala('wahrscheinlichkeit').stufen;
  const stufenA = h.skala('auswirkung').stufen;
  const text = (s: string, breite = 18, umbruch = false) => ({ kopf: s, breite, umbruch });
  // Spalte «ISMS-Verweis» (letzte Spalte) nur mit ISMS; Firmendokument ohne ISMS: entfällt
  const mitIsmsSpalte = h.istLeer || projekt.meta.mitIsms;
  const spPlan = u.liste(k('spalten_plan'));
  // Freigabe des Behandlungsplans: Eintrag D-07, im Pfad mit ISMS D-07-EB (Rückfall in dokEintrag)
  const planFreigabe = h.istLeer ? undefined : h.dokEintrag('D-07')?.freigabe;

  // Vorschläge GenAI-Sicherheit (Katalog genai-risiken, Texte genai-risiken.<id>): nur in der leeren Vorlage als
  // Gedankenstütze; Firmendokumente führen übernommene Einträge als eigene Risiken im Register.
  const genai = (ctx.kataloge['genaiRisiken'] as { risiken: GenaiRisiko[] } | undefined)?.risiken ?? [];
  const g = (s: string) => `genai-risiken.${s}`;
  const genaiBlatt: XlsxBlatt[] =
    h.istLeer && genai.length
      ? [
          {
            name: u.t(g('titel_blatt')),
            titel: u.t(g('titel_blatt')),
            hinweise: u.liste(g('hinweise')),
            fixiert: true,
            spalten: u.liste(g('spalten')).map((kopf, i) => ({ kopf, breite: [8, 32, 20, 40, 36, 50, 22, 18, 14, 22][i], umbruch: i > 0 })),
            zeilen: genai.map((r) => [
              r.id,
              u.t(g(`${r.id}.titel`)),
              h.risikoquelle(r.quelle),
              u.t(g(`${r.id}.ursache`)),
              u.t(g(`${r.id}.folge`)),
              u.liste(g(`${r.id}.massnahmen`)).join('; '),
              r.controls.join(', '),
              r.zielgruppe.map((z) => u.t(g(`zielgruppe.${z}`))).join(', '),
              r.owasp ?? u.t(g('eigener_vorschlag')),
              (r.nist_600_1 ?? []).join(', '),
            ]),
          },
        ]
      : [];

  // Blatt «Risikomatrix»: vor und nach Behandlung, COUNTIFS über das Register (Spalten K/L bzw. R/S), Ergebnis aus JS
  const register = u.t(k('blaetter.register'));
  const quelle = (w: number, a: number) => ({ blatt: register, wSpalte: w, aSpalte: a, artSpalte: 1, statusSpalte: 22, chance: liste('art')[1]!, geschlossen: liste('status')[4]! });
  const vor = projektMatrix(ctx, 'vor');
  const legende = Object.fromEntries(stufenLegende(ctx, vor).map((l) => [l.stufe, l.text]));
  const matrixBlatt: XlsxBlatt = {
    name: u.t('vorlagen.grafik.matrix.xlsx_titel'),
    titel: u.t('vorlagen.grafik.matrix.xlsx_titel'),
    hinweise: u.liste('vorlagen.grafik.matrix.xlsx_hinweise').map((t) => t.replace('{tief}', legende['tief'] ?? '').replace('{mittel}', legende['mittel'] ?? '').replace('{hoch}', legende['hoch'] ?? '').replace(/;\s*;/, ';')),
    spalten: [],
    zeilen: [],
    matrizen: [
      risikomatrixXlsx(ctx, vor, u.t('vorlagen.grafik.matrix.titel_vor'), quelle(10, 11)),
      risikomatrixXlsx(ctx, projektMatrix(ctx, 'nach'), u.t('vorlagen.grafik.matrix.titel_nach'), quelle(17, 18)),
    ],
  };

  return {
    sprache: u.sprache,
    eigenschaften: h.eigenschaften('D-07'),
    lenkung: h.lenkung('D-07'),
    firmenname: h.firmenname(),
    hinweisBlock: [...h.kitBlock(), h.normverweis('6.1.1 bis 6.1.3, 8.2, 8.3')],
    blaetter: [
      {
        name: u.t(k('blaetter.register')),
        titel: u.t(k('titel_register')),
        hinweise: h.istLeer ? u.liste(k('hinweise_register')) : undefined,
        fixiert: true,
        // Risikowert vor (M) und nach Behandlung (T) in den Farben der Risikostufen (D-06)
        ampel: [
          { spalte: 12, gruenBis: kr.akzeptanzBis, gelbBis: kr.unannehmbarAb - 1, palette: 'risiko' },
          { spalte: 19, gruenBis: kr.akzeptanzBis, gelbBis: kr.unannehmbarAb - 1, palette: 'risiko' },
        ],
        spalten: [
          text(sp[0]!, 8),
          { kopf: sp[1]!, breite: 10, typ: 'liste', liste: liste('art') },
          text(sp[2]!, 22),
          text(sp[3]!, 28, true),
          text(sp[4]!, 40, true),
          { kopf: sp[5]!, breite: 22, typ: 'liste', liste: h.risikoquellen().map((q) => q.label) },
          { kopf: sp[6]!, breite: 14, typ: 'liste', liste: liste('ebene') },
          text(sp[7]!, 28, true),
          text(sp[8]!, 28, true),
          text(sp[9]!, 28, true),
          { kopf: sp[10]!, breite: 5, typ: 'liste', liste: stufenW },
          { kopf: sp[11]!, breite: 5, typ: 'liste', liste: stufenA },
          { kopf: sp[12]!, breite: 7, typ: 'formel', formel: '=IF(AND(K{r}<>"",L{r}<>""),K{r}*L{r},"")' },
          { kopf: sp[13]!, breite: 13, typ: 'liste', liste: liste('behandlung') },
          text(sp[14]!, 18, true),
          text(sp[15]!, 14),
          text(sp[16]!, 18),
          { kopf: sp[17]!, breite: 7, typ: 'liste', liste: stufenW },
          { kopf: sp[18]!, breite: 7, typ: 'liste', liste: stufenA },
          { kopf: sp[19]!, breite: 8, typ: 'formel', formel: '=IF(AND(R{r}<>"",S{r}<>""),R{r}*S{r},"")' },
          text(sp[20]!, 20),
          { kopf: sp[21]!, breite: 12, typ: 'datum' },
          { kopf: sp[22]!, breite: 14, typ: 'liste', liste: liste('status') },
          { kopf: sp[23]!, breite: 12, typ: 'datum' },
          text(sp[24]!, 30, true),
          ...(mitIsmsSpalte ? [text(sp[25]!, 14)] : []),
        ],
        zeilen: mitIsmsSpalte ? zeilen : zeilen.map((z) => z.slice(0, 25)),
        leereZeilen: h.istLeer ? 40 : 10,
      },
      matrixBlatt,
      {
        name: u.t(k('blaetter.plan')),
        titel: u.t(k('titel_plan')),
        hinweise: u.liste(k(h.istLeer ? 'hinweise_plan' : 'hinweise_plan_firma')),
        fixiert: true,
        spalten: [
          text(spPlan[0]!, 10),
          text(spPlan[1]!, 40, true),
          text(spPlan[2]!, 22, true),
          text(spPlan[3]!, 14, true),
          text(spPlan[4]!, 20),
          { kopf: spPlan[5]!, breite: 12, typ: 'datum' },
          { kopf: spPlan[6]!, breite: 12, typ: 'liste', liste: liste('massnahme_status') },
          { kopf: spPlan[7]!, breite: 10, typ: 'liste', liste: liste('prioritaet') },
          text(spPlan[8]!, 50, true),
          text(spPlan[9]!, 14, true),
        ],
        zeilen: [...planZeilen, [], [u.t(k('freigabe_plan')), klartext(h.personText(planFreigabe?.von, 'freigabe')), '', '', '', klartext(h.wert(h.datum(planFreigabe?.am), 'datum'))]],
        leereZeilen: h.istLeer ? 20 : 5,
      },
      {
        name: u.t(k('blaetter.skalen')),
        titel: u.t(k('titel_skalen')),
        hinweise: h.istLeer ? u.liste(k('hinweise_skalen')) : undefined,
        spalten: u.liste(k('spalten_skalen')).map((s, i) => ({ kopf: s, breite: [8, 18, 40, 18, 40][i], umbruch: i === 2 || i === 4 })),
        zeilen: skalenZeilen,
      },
      ...genaiBlatt,
    ],
  };
}
