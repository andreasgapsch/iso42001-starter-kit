// Grafiken der Vorlagen als IR-Blöcke: Risikomatrix (DOCX-Tabelle und XLSX-Formelblatt), Diagramme (SoA, Kennzahlen),
// Fahrplan als Zeitraster und Abläufe aus Formen (D-24, D-08, D-02). Daten aus src/grafik/daten.ts, Texte aus
// i18n vorlagen.grafik; der Generator setzt Farben und Schriften (generator/palette.ts).
import type { AblaufBlock, AblaufKante, AblaufKnoten, Block, DiagrammBlock, Farbrolle, MatrixBlock, MatrixZelle, Text, XlsxMatrix } from '../generator/ir.ts';
import {
  type Faelligkeit,
  type FaelligkeitsGruppe,
  type Kennzahlverlauf,
  type RisikoMatrix,
  type Risikostufe,
  type SoaGruppe,
  STUFEN,
  matrixZaehlen,
  werteJeStufe,
} from '../grafik/daten.ts';
import type { Audit, Projekt } from '../model/typen.ts';
import type { Helfer, VorlagenKontext } from './kontext.ts';
import { anwendbar, eignerVon, eintragVon, imProzesssystem, prozessDokumente, prozesseImProjekt, prozessKatalog, prozessTexte, sichtImPfad } from '../prozesse/katalog.ts';
import { GRUPPEN, landkarteBlock } from '../prozesse/landkarte.ts';
import type { ProzessGruppe } from '../prozesse/typen.ts';
import { ergaenzungsblaetter } from './ergaenzungsblatt.ts';

const g = (s: string) => `vorlagen.grafik.${s}`;

export const ROLLE_STUFE: Record<Risikostufe, Farbrolle> = { tief: 'risiko-tief', mittel: 'risiko-mittel', hoch: 'risiko-hoch' };

export interface Skalenstufe {
  stufe: number;
  bezeichnung: string;
}

/** Skalen der Matrix: eigene aus den Risikokriterien (Firmendokument), sonst der 4×4-Vorschlag aus D-07 */
export function matrixSkalen(ctx: VorlagenKontext): { w: Skalenstufe[]; a: Skalenstufe[]; eigene: boolean } {
  const kr = ctx.projekt.organisation.risikokriterien;
  const eigene = ctx.modus !== 'leer' && kr.wahrscheinlichkeit.length > 0 && kr.auswirkung.length > 0;
  const vorschlag = ctx.u.roh('vorlagen.D-07.skalen_vorschlag') as { wahrscheinlichkeit: (string | number)[][]; auswirkung: (string | number)[][] };
  const aus = (z: (string | number)[][]) => z.map((x) => ({ stufe: Number(x[0]), bezeichnung: String(x[1] ?? '') }));
  const sortiert = (s: Skalenstufe[]) => [...s].sort((x, y) => x.stufe - y.stufe);
  return eigene
    ? { w: sortiert(kr.wahrscheinlichkeit), a: sortiert(kr.auswirkung), eigene }
    : { w: sortiert(aus(vorschlag.wahrscheinlichkeit)), a: sortiert(aus(vorschlag.auswirkung)), eigene };
}

/** Leere Matrix der Skalen (nur Zonen), z. B. für D-06 und leere Vorlagen */
export function zonenMatrix(ctx: VorlagenKontext): RisikoMatrix {
  const s = matrixSkalen(ctx);
  return matrixZaehlen([], s.w.map((x) => x.stufe), s.a.map((x) => x.stufe), ctx.projekt.organisation.risikokriterien);
}

/** Risikomatrix des Projekts mit den Skalen der Vorlage (leere Vorlage: nur Zonen) */
export function projektMatrix(ctx: VorlagenKontext, stand: 'vor' | 'nach'): RisikoMatrix {
  if (ctx.modus === 'leer') return zonenMatrix(ctx);
  const s = matrixSkalen(ctx);
  const risiken = ctx.projekt.risiken.filter((r) => r.art !== 'chance' && r.status !== 'geschlossen');
  return matrixZaehlen(risiken, s.w.map((x) => x.stufe), s.a.map((x) => x.stufe), ctx.projekt.organisation.risikokriterien, stand);
}

const kuerzel = (ctx: VorlagenKontext, stufe: Risikostufe) => ctx.u.liste(g('kuerzel'))[STUFEN.indexOf(stufe)]!;

/** Legende der Stufen mit erreichbaren Risikowerten (z. B. «M mittel: Risikowert 6 bis 9») */
export function stufenLegende(ctx: VorlagenKontext, m: RisikoMatrix): { rolle: Farbrolle; text: string; stufe: Risikostufe }[] {
  const kr = ctx.projekt.organisation.risikokriterien;
  const werte = werteJeStufe(m.w, m.a, kr);
  const spanne = (v: number[]) => (v.length > 1 ? ctx.u.t('vorlagen.D-06.skalen.von_bis', { von: v[0]!, bis: v.at(-1)! }) : String(v[0] ?? ''));
  return STUFEN.filter((s) => s !== 'mittel' || werte.mittel.length > 0).map((s) => ({
    stufe: s,
    rolle: ROLLE_STUFE[s],
    text: ctx.u.t(g(`matrix.legende.${s}`), { kuerzel: kuerzel(ctx, s), bis: kr.akzeptanzBis, ab: kr.unannehmbarAb, werte: spanne(werte.mittel) }),
  }));
}

export interface MatrixOptionen {
  titel: string;
  /** Anzahl Risiken je Zelle zeigen (Firmendokument) */
  mitAnzahl: boolean;
  /** IDs bis zu dieser Anzahl je Zelle zeigen (Standard 3) */
  idsBis?: number;
  legende?: boolean;
}

/**
 * Risikomatrix als Tabelle nach Design System: Spalten Wahrscheinlichkeit aufsteigend, Zeilen Auswirkung absteigend; jede
 * Zelle mit Stufenkürzel und Risikowert, auf Wunsch Anzahl und IDs; Legende mit den Grenzen.
 */
export function risikomatrixBlock(ctx: VorlagenKontext, m: RisikoMatrix, o: MatrixOptionen): MatrixBlock {
  const { u } = ctx;
  const s = matrixSkalen(ctx);
  const bez = (liste: Skalenstufe[], stufe: number) => liste.find((x) => x.stufe === stufe)?.bezeichnung ?? '';
  const anzahl = (n: number) => (n === 0 ? u.t(g('matrix.anzahl_null')) : n === 1 ? u.t(g('matrix.anzahl_eins')) : u.t(g('matrix.anzahl'), { anzahl: n }));
  const zeilen = [...m.a].reverse().map((a) => {
    const ai = m.a.indexOf(a);
    const zellen = m.w.map((w, wi): MatrixZelle => {
      const z = m.zellen[wi]![ai]!;
      const ids = o.mitAnzahl && z.ids.length > 0 && z.ids.length <= (o.idsBis ?? 3) ? [z.ids.join(', ')] : [];
      return {
        rolle: ROLLE_STUFE[z.stufe],
        zeilen: [u.t(g('matrix.zelle'), { kuerzel: kuerzel(ctx, z.stufe), wert: z.wert }), ...(o.mitAnzahl ? [anzahl(z.anzahl)] : []), ...ids],
      };
    });
    return { kopf: [u.t(g('matrix.zeile'), { stufe: a }), bez(s.a, a)].filter(Boolean).join('\n'), zellen };
  });
  const spalten: Text[] = m.w.map((w) => [u.t(g('matrix.spalte'), { stufe: w }), bez(s.w, w)].filter(Boolean).join('\n'));
  const alt = !o.mitAnzahl
    ? u.t(g('matrix.alt_zonen'), { w: m.w.length, a: m.a.length })
    : m.bewertet === 0
      ? u.t(g('matrix.alt_ohne'), { titel: o.titel })
      : u.t(g('matrix.alt'), { titel: o.titel, bewertet: m.bewertet, ...m.jeStufe }) +
        (m.unbewertet.length ? ` ${u.t(g('matrix.unbewertet'), { liste: m.unbewertet.join(', ') })}` : '');
  return {
    typ: 'matrix',
    titel: o.titel,
    ecke: u.t(g('matrix.ecke')),
    spalten,
    zeilen,
    ...(o.legende === false ? {} : { legende: stufenLegende(ctx, m).map(({ rolle, text }) => ({ rolle, text })) }),
    alt,
    kopfbreite: m.w.length > 4 ? 1.2 : 1.4,
  };
}

/** Matrix-Blatt in D-07: COUNTIFS über das Register, Ergebnisse aus JS, Zonen nach den Risikokriterien */
export function risikomatrixXlsx(
  ctx: VorlagenKontext,
  m: RisikoMatrix,
  titel: string,
  quelle: { blatt: string; wSpalte: number; aSpalte: number; artSpalte: number; statusSpalte: number; chance: string; geschlossen: string },
): XlsxMatrix {
  const { u } = ctx;
  const s = matrixSkalen(ctx);
  const kr = ctx.projekt.organisation.risikokriterien;
  const bez = (liste: Skalenstufe[], stufe: number) => liste.find((x) => x.stufe === stufe)?.bezeichnung ?? '';
  const aAb = [...m.a].reverse();
  return {
    titel,
    quelle: {
      blatt: quelle.blatt,
      zeilenSpalte: quelle.aSpalte,
      spaltenSpalte: quelle.wSpalte,
      // Gleiche Auswahl wie die Zählung in JS (daten.ts matrixRisiken): ohne Chancen und ohne geschlossene Risiken
      bedingungen: [
        { spalte: quelle.artSpalte, kriterium: `<>${quelle.chance}` },
        { spalte: quelle.statusSpalte, kriterium: `<>${quelle.geschlossen}` },
      ],
    },
    ecke: u.t(g('matrix.ecke')),
    zeilen: aAb.map((a) => ({ wert: a, text: `${u.t(g('matrix.zeile'), { stufe: a })} ${bez(s.a, a)}`.trim() })),
    spalten: m.w.map((w) => ({ wert: w, text: `${u.t(g('matrix.spalte'), { stufe: w })} ${bez(s.w, w)}`.trim() })),
    ergebnisse: aAb.map((a) => m.w.map((_, wi) => m.zellen[wi]![m.a.indexOf(a)]!.anzahl)),
    zonen: { tiefBis: kr.akzeptanzBis, hochAb: kr.unannehmbarAb, kuerzel: u.liste(g('kuerzel')) as [string, string, string] },
  };
}

/** Gestapelte Balken je Gruppe A.2 bis A.10: umgesetzt, teilweise, offen, ausgeschlossen, nicht entschieden */
export function soaDiagramm(ctx: VorlagenKontext, gruppen: SoaGruppe[]): DiagrammBlock {
  const { u } = ctx;
  const reihe = (s: string) => u.t(g(`soa.reihe.${s}`));
  const werte = {
    umgesetzt: gruppen.map((x) => x.anzahl.umgesetzt + x.anzahl.wirksam),
    teilweise: gruppen.map((x) => x.anzahl.teilweise),
    offen: gruppen.map((x) => x.anzahl.offen + x.anzahl.geplant),
    ausgeschlossen: gruppen.map((x) => x.anzahl.ausgeschlossen),
    unentschieden: gruppen.map((x) => x.anzahl.unentschieden),
  };
  const rollen: Record<keyof typeof werte, Farbrolle> = {
    umgesetzt: 'status-gut',
    teilweise: 'status-warnung',
    offen: 'status-kritisch',
    ausgeschlossen: 'status-neutral',
    unentschieden: 'seq-2',
  };
  const reihen = (Object.keys(werte) as (keyof typeof werte)[])
    // Reihen ohne Wert weglassen (ausser «umgesetzt»), die Legende bleibt kurz
    .filter((k) => k === 'umgesetzt' || werte[k].some((v) => v > 0))
    .map((k) => ({ name: reihe(k), werte: werte[k], rolle: rollen[k] }));
  // Textalternative knapp: je Gruppe nur die Reihen mit Wert
  const altGruppen = gruppen.map((x, i) =>
    u.t(g('soa.alt_gruppe'), {
      gruppe: x.id,
      liste: (Object.keys(werte) as (keyof typeof werte)[])
        .filter((k) => werte[k][i]! > 0)
        .map((k) => u.t(g('soa.alt_wert'), { anzahl: werte[k][i]!, reihe: reihe(k) }))
        .join(', '),
    }),
  );
  const titel = u.t(g('soa.titel'));
  return {
    typ: 'diagramm',
    art: 'stapel',
    titel,
    kategorien: gruppen.map((x) => x.id),
    reihen,
    achse: { titel: u.t(g('soa.achse')), min: 0, schritt: Math.max(...gruppen.map((x) => x.gesamt), 1) > 10 ? 2 : 1, format: '0' },
    alt: { titel, beschreibung: u.t(g('soa.alt'), { werte: altGruppen.join('; ') }) },
  };
}

/** Linie der Messwerte einer Kennzahl mit Sollwert als gestrichelte Linie */
export function kennzahlDiagramm(ctx: VorlagenKontext, h: Helfer, v: Kennzahlverlauf): DiagrammBlock {
  const { u } = ctx;
  const punkte = v.punkte.filter((p) => p.zahl !== null);
  const kategorien = punkte.map((p) => h.datum(p.datum)!);
  const titel = u.t(g('kennzahl.titel'), { id: v.id, kennzahl: v.kennzahl });
  const zahl = (n: number) => (u.sprache === 'de' ? String(n).replace('.', ',') : String(n));
  const einheit = v.einheit ? (v.einheit === '%' ? (ctx.u.sprache === 'en' ? '%' : ' %') : ` ${v.einheit}`) : '';
  const soll = v.soll
    ? v.soll.richtung === 'genau'
      ? u.t(g('kennzahl.soll'), { zahl: `${zahl(v.soll.zahl)}${einheit}` })
      : u.t(g('kennzahl.soll_richtung'), { richtung: u.t(g(`kennzahl.richtung.${v.soll.richtung}`)), zahl: `${zahl(v.soll.zahl)}${einheit}` })
    : undefined;
  const werteText = punkte.map((p, i) => `${kategorien[i]} ${zahl(p.zahl!)}${einheit}`).join(', ');
  const alle = [...punkte.map((p) => p.zahl!), ...(v.soll ? [v.soll.zahl] : [])];
  const prozent = v.einheit === '%';
  return {
    typ: 'diagramm',
    art: 'linie',
    titel,
    kategorien,
    reihen: [
      { name: u.t(g('kennzahl.ist')), werte: punkte.map((p) => p.zahl), rolle: 'kat-1', marker: true },
      ...(v.soll && soll ? [{ name: soll, werte: punkte.map(() => v.soll!.zahl), rolle: 'kat-2' as Farbrolle, gestrichelt: true }] : []),
    ],
    achse: prozent ? { min: Math.min(0, ...alle), max: 100, schritt: 20, format: '0" %"' } : { min: 0, format: einheit ? `0"${einheit}"` : '0' },
    hoehe: 210,
    alt: { titel, beschreibung: soll ? u.t(g('kennzahl.alt_soll'), { werte: werteText, soll }) : u.t(g('kennzahl.alt'), { werte: werteText }) },
  };
}

/** Offene und erledigte Massnahmen nach Fälligkeit am Stichtag als Balken (Farbe je Fälligkeit, Wort in der Achse) */
export function massnahmenDiagramm(ctx: VorlagenKontext, h: Helfer, gruppen: FaelligkeitsGruppe[], stichtag: string): DiagrammBlock {
  const { u } = ctx;
  const rollen: Record<Faelligkeit, Farbrolle> = {
    ueberfaellig: 'status-kritisch',
    bald: 'status-warnung',
    spaeter: 'status-info',
    ohneTermin: 'status-neutral',
    erledigt: 'status-gut',
    verworfen: 'status-neutral',
  };
  const gezeigt = gruppen.filter((x) => x.art !== 'verworfen');
  const titel = u.t(g('massnahmen.titel'), { datum: h.datum(stichtag) ?? stichtag });
  const name = (a: Faelligkeit) => u.t(g(`massnahmen.art.${a}`));
  return {
    typ: 'diagramm',
    art: 'balken',
    titel,
    kategorien: gezeigt.map((x) => name(x.art)),
    reihen: [{ name: u.t(g('massnahmen.achse')), werte: gezeigt.map((x) => x.ids.length), rolle: 'status-info', rollen: gezeigt.map((x) => rollen[x.art]) }],
    achse: { min: 0, schritt: Math.max(...gezeigt.map((x) => x.ids.length), 1) > 10 ? 2 : 1, format: '0' },
    hoehe: 190,
    alt: { titel, beschreibung: u.t(g('massnahmen.alt'), { datum: h.datum(stichtag) ?? stichtag, werte: gezeigt.map((x) => `${name(x.art)} ${x.ids.length}${x.ids.length && x.art !== 'erledigt' ? ` (${x.ids.join(', ')})` : ''}`).join('; ') }) },
  };
}

// Fahrplan D-25

type Meilenstein = 'stage1' | 'stage2' | 'zertifikat' | 'ueberwachung1' | 'ueberwachung2' | 'rezertifizierung';
const MEILENSTEINE: Meilenstein[] = ['stage1', 'stage2', 'zertifikat', 'ueberwachung1', 'ueberwachung2', 'rezertifizierung'];
type Stand = 'erledigt' | 'geplant' | 'richtwert';
const ROLLE_STAND: Record<Stand, Farbrolle> = { erledigt: 'status-gut-stark', geplant: 'seq-2', richtwert: 'status-neutral' };

function plusMonate(iso: string, monate: number): string {
  const [j, m, t] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  const d = new Date(Date.UTC(j, m - 1 + monate, Math.min(t, 28)));
  return d.toISOString().slice(0, 10);
}

/** Termine des Zertifizierungszyklus aus den Audits und Zielterminen; fehlende als Richtwert aus dem Zyklus */
export function fahrplanTermine(projekt: Projekt): Record<Meilenstein, { datum?: string; stand: Stand }> {
  const datumAudit = (a?: Audit) => a?.durchgefuehrt ?? a?.geplant;
  const standAudit = (a?: Audit): Stand => (a?.durchgefuehrt ? 'erledigt' : 'geplant');
  const nach = (art: Audit['art']) => projekt.audits.filter((a) => a.art === art).sort((x, y) => (datumAudit(x) ?? '').localeCompare(datumAudit(y) ?? ''));
  const s1 = nach('extern-stage1')[0];
  const stage2 = nach('extern-stage2');
  const s2 = stage2[0];
  const ueb = nach('ueberwachung');
  const org = projekt.organisation;
  const aus: Record<Meilenstein, { datum?: string; stand: Stand }> = {
    stage1: datumAudit(s1) ? { datum: datumAudit(s1), stand: standAudit(s1) } : org.zielterminStage1 ? { datum: org.zielterminStage1, stand: 'geplant' } : { stand: 'richtwert' },
    stage2: datumAudit(s2) ? { datum: datumAudit(s2), stand: standAudit(s2) } : { stand: 'richtwert' },
    zertifikat: s2?.zertifikatAm
      ? { datum: s2.zertifikatAm, stand: 'erledigt' }
      : org.zielterminZertifizierung
        ? { datum: org.zielterminZertifizierung, stand: 'geplant' }
        : { stand: 'richtwert' },
    ueberwachung1: datumAudit(ueb[0]) ? { datum: datumAudit(ueb[0]), stand: standAudit(ueb[0]) } : { stand: 'richtwert' },
    ueberwachung2: datumAudit(ueb[1]) ? { datum: datumAudit(ueb[1]), stand: standAudit(ueb[1]) } : { stand: 'richtwert' },
    // Rezertifizierung: zweites Stage-2-Audit (Rezertifizierungsaudit), sonst Richtwert
    rezertifizierung: datumAudit(stage2[1]) ? { datum: datumAudit(stage2[1]), stand: standAudit(stage2[1]) } : { stand: 'richtwert' },
  };
  // Richtwerte mit Datum, sobald ein Bezug da ist: Stage 2 rund 6 Wochen nach Stage 1, Zertifikat rund 6 Wochen nach Stage 2,
  // Überwachung nach 12 und 24 Monaten, Rezertifizierung nach 33 Monaten (vor Ablauf)
  const ab = (m: Meilenstein, von: Meilenstein, monate: number) => {
    const basis = aus[von].datum;
    if (aus[m].stand === 'richtwert' && basis) aus[m] = { datum: plusMonate(basis, monate), stand: 'richtwert' };
  };
  ab('stage2', 'stage1', 2);
  ab('zertifikat', 'stage2', 2);
  ab('ueberwachung1', 'zertifikat', 12);
  ab('ueberwachung2', 'zertifikat', 24);
  ab('rezertifizierung', 'zertifikat', 33);
  return aus;
}

/** Zeitraster: Meilensteine in Zeilen, Jahre in Spalten, Zelle mit Monat und Stand */
export function fahrplanMatrix(ctx: VorlagenKontext, h: Helfer): MatrixBlock {
  const { u } = ctx;
  const f = (s: string) => g(`fahrplan.${s}`);
  const leer = ctx.modus === 'leer';
  const termine = leer ? undefined : fahrplanTermine(ctx.projekt);
  const jahre = termine
    ? (() => {
        const js = MEILENSTEINE.map((m) => termine[m].datum?.slice(0, 4)).filter((j): j is string => !!j).map(Number);
        if (!js.length) return undefined;
        const von = Math.min(...js);
        return Array.from({ length: Math.min(5, Math.max(...js) - von + 1) }, (_, i) => von + i);
      })()
    : undefined;
  // Ohne Termine: Jahre 1 bis 4 des Zyklus mit Richtwerten
  const relativ: Record<Meilenstein, number> = { stage1: 0, stage2: 0, zertifikat: 0, ueberwachung1: 1, ueberwachung2: 2, rezertifizierung: 3 };
  const spalten = jahre ? jahre.map(String) : [1, 2, 3, 4].map((nr) => u.t(f('jahr'), { nr }));
  const monat = (iso: string) => {
    const [j, m] = iso.split('-');
    return u.sprache === 'de' ? `${m}.${j}` : `${m}/${j}`;
  };
  const altTeile: string[] = [];
  const zeilen = MEILENSTEINE.map((m) => {
    const t = termine?.[m] ?? { stand: 'richtwert' as Stand };
    const spalte = jahre && t.datum ? jahre.indexOf(Number(t.datum.slice(0, 4))) : relativ[m];
    const inhalt = t.datum ? (t.stand === 'richtwert' ? monat(t.datum) : h.datum(t.datum)!) : u.t(f(`richtwerte.${m}`));
    const standText = u.t(f(`stand.${t.stand}`));
    altTeile.push(`${u.t(f(`meilensteine.${m}`))} ${inhalt}, ${standText}`);
    return {
      kopf: u.t(f(`meilensteine.${m}`)),
      zellen: spalten.map((_, i): MatrixZelle => (i === spalte ? { zeilen: [inhalt, standText], rolle: ROLLE_STAND[t.stand] } : { zeilen: [''], rolle: 'leer' })),
    };
  });
  return {
    typ: 'matrix',
    titel: u.t(f('titel')),
    ecke: u.t(f('ecke')),
    spalten,
    zeilen,
    legende: (['erledigt', 'geplant', 'richtwert'] as Stand[]).map((s) => ({ rolle: ROLLE_STAND[s], text: u.t(f(`legende.${s}`)) })),
    alt: u.t(f('alt'), { werte: altTeile.join('; ') }),
    kopfbreite: 1.6,
  };
}

// Abläufe aus Formen

const kante = (von: string, vonSeite: AblaufKante['vonSeite'], nach: string, nachSeite: AblaufKante['nachSeite'], text?: string, weg: AblaufKante['weg'] = 'gerade'): AblaufKante => ({
  von,
  vonSeite,
  nach,
  nachSeite,
  ...(text ? { text } : {}),
  weg,
});

/** D-24: Entscheidungsbaum Anbieter oder Betreiber (Fragen der Liste in Abschnitt 1, kurz) */
export function entscheidungsbaumD24(ctx: VorlagenKontext): AblaufBlock {
  const t = (s: string) => ctx.u.t(g(`d24.${s}`));
  const [ja, nein] = [t('ja'), t('nein')];
  const k = (id: string, form: AblaufKnoten['form'], spalte: number, zeile: number, breite = 1, rolle?: Farbrolle): AblaufKnoten => ({
    id,
    form,
    text: t(id),
    spalte,
    zeile,
    ...(breite !== 1 ? { breite } : {}),
    ...(rolle ? { rolle } : {}),
  });
  return {
    typ: 'ablauf',
    spalten: 4,
    zeilen: 8,
    zeilenHoehe: 78,
    knoten: [
      k('start', 'start', 1, 0, 2),
      k('f1', 'frage', 1, 1, 2),
      k('gilt_nicht', 'ergebnis', 0, 1, 1, 'status-neutral'),
      k('f2', 'frage', 1, 2, 2),
      k('nicht_erfasst', 'ergebnis', 0, 2, 1, 'status-neutral'),
      k('f3', 'frage', 1, 3, 2),
      k('anbieter', 'ergebnis', 3, 3, 1, 'kat-2'),
      k('f4', 'frage', 1, 4, 2),
      k('betreiber', 'ergebnis', 3, 4, 1, 'kat-1'),
      k('uebrige', 'ergebnis', 0, 4, 1, 'status-neutral'),
      k('f5', 'frage', 2, 5, 2),
      k('bleibt', 'ergebnis', 1, 5),
      k('wechsel', 'ergebnis', 2, 6, 2, 'kat-2'),
      k('ende', 'ende', 1, 7, 2),
    ],
    kanten: [
      kante('start', 'bottom', 'f1', 'top'),
      kante('f1', 'left', 'gilt_nicht', 'right', nein),
      kante('f1', 'bottom', 'f2', 'top', ja),
      kante('f2', 'left', 'nicht_erfasst', 'right', nein),
      kante('f2', 'bottom', 'f3', 'top', ja),
      kante('f3', 'right', 'anbieter', 'left', ja),
      kante('f3', 'bottom', 'f4', 'top', nein),
      kante('f4', 'right', 'betreiber', 'left', ja),
      kante('f4', 'left', 'uebrige', 'right', nein),
      kante('anbieter', 'right', 'f5', 'right', undefined, 'winkel'),
      kante('betreiber', 'bottom', 'f5', 'top', undefined, 'winkel'),
      kante('f5', 'left', 'bleibt', 'right', nein),
      kante('f5', 'bottom', 'wechsel', 'top', ja),
      kante('bleibt', 'bottom', 'ende', 'left', undefined, 'winkel'),
      kante('wechsel', 'bottom', 'ende', 'top', undefined, 'winkel'),
    ],
    alt: { titel: t('titel'), beschreibung: t('alt') },
  };
}

/** D-08: Ablauf Kurzprüfung, vollständige Abschätzung, Freigabe, Überwachung */
export function ablaufD08(ctx: VorlagenKontext): AblaufBlock {
  const t = (s: string) => ctx.u.t(g(`d08.${s}`));
  const k = (id: string, form: AblaufKnoten['form'], spalte: number, zeile: number, breite = 1): AblaufKnoten => ({ id, form, text: t(id), spalte, zeile, ...(breite !== 1 ? { breite } : {}) });
  return {
    typ: 'ablauf',
    spalten: 3,
    zeilen: 7,
    zeilenHoehe: 72,
    knoten: [
      k('ausloeser', 'start', 0, 0, 2),
      k('kurzpruefung', 'schritt', 0, 1, 2),
      k('schwelle', 'frage', 0, 2, 2),
      k('doku', 'schritt', 2, 2),
      k('voll', 'schritt', 0, 3, 2),
      // Rückprüfung nach der Risikobeurteilung (Schwelle aus D-06): erreicht, dann zurück zur vollständigen Abschätzung (A3-11)
      k('rueckpruefung', 'frage', 2, 3),
      k('entscheid', 'schritt', 0, 4, 2),
      k('freigabe_aims', 'ergebnis', 2, 4),
      k('freigabe_gl', 'ergebnis', 0, 5, 2),
      k('betrieb', 'ende', 0, 6, 2),
    ],
    kanten: [
      kante('ausloeser', 'bottom', 'kurzpruefung', 'top'),
      kante('kurzpruefung', 'bottom', 'schwelle', 'top'),
      kante('schwelle', 'right', 'doku', 'left', t('nein')),
      kante('schwelle', 'bottom', 'voll', 'top', t('ja')),
      kante('doku', 'bottom', 'rueckpruefung', 'top'),
      kante('rueckpruefung', 'left', 'voll', 'right', t('ja')),
      kante('rueckpruefung', 'bottom', 'freigabe_aims', 'top', t('nein')),
      kante('voll', 'bottom', 'entscheid', 'top'),
      kante('entscheid', 'bottom', 'freigabe_gl', 'top'),
      kante('freigabe_gl', 'bottom', 'betrieb', 'top'),
      kante('freigabe_aims', 'bottom', 'betrieb', 'right', undefined, 'winkel'),
    ],
    alt: { titel: t('titel'), beschreibung: t('alt') },
  };
}

/** Prozess in D-02 (Tabelle und Landkarte) */
export interface D02Prozess {
  id: string;
  gruppe: ProzessGruppe;
  titel: string;
  zweck: string;
  eigner?: string;
  dokumente: string[];
  /** mit ISMS gemeinsam geführt (Art gemeinsam oder gemeinsam-ki) */
  mitIsms: boolean;
}

/**
 * Prozesse für D-02 aus dem Katalog: leere Vorlage alle AIMS-Prozesse; Firmendokument die anwendbaren AIMS-Prozesse und
 * ohne ISMS dazu die anwendbaren Basisprozesse des Mindestumfangs. Reihenfolge wie im Katalog.
 */
export function d02Prozesse(ctx: VorlagenKontext): D02Prozess[] {
  const { u, projekt } = ctx;
  const leer = ctx.modus === 'leer';
  const mitIsms = !leer && projekt.meta.mitIsms;
  // Firmendokument: auch die eigenen Prozesse (PE-01 ff.) in ihrer Gruppe, nach den Katalogprozessen
  return (leer ? prozessKatalog(ctx.kataloge).prozesse : prozesseImProjekt(projekt, ctx.kataloge))
    .filter((kp) => (leer ? sichtImPfad(kp, false) === 'aims' : imProzesssystem(projekt, kp)))
    .map((kp) => {
      const tx = prozessTexte(u, kp.id, leer ? null : projekt);
      return {
        id: kp.id,
        gruppe: kp.gruppe,
        titel: tx?.titel ?? kp.id,
        zweck: tx?.zweck ?? '',
        eigner: leer ? undefined : eignerVon(projekt, kp).person,
        dokumente: prozessDokumente(kp, projekt, leer),
        mitIsms: mitIsms && (kp.art === 'gemeinsam' || kp.art === 'gemeinsam-ki'),
      };
    });
}

/** Mit ISMS: Basisprozesse der Informationssicherheit, die das ISMS führt («PS-02 Zugänge und Berechtigungen (ISMS-Handbuch …)») */
export function d02IsmsBasis(ctx: VorlagenKontext): string[] {
  const { u, projekt } = ctx;
  return prozessKatalog(ctx.kataloge)
    .prozesse.filter((kp) => sichtImPfad(kp, true) === 'verweis' && anwendbar(projekt, kp) === 'ja')
    .map((kp) => {
      const verweis = eintragVon(projekt, kp.id)?.ismsVerweis?.trim();
      return `${kp.id} ${prozessTexte(u, kp.id)?.titel ?? kp.id}${verweis ? ` (${verweis})` : ''}`;
    });
}

/**
 * Prozesse des Katalogs, die die Firma nicht anwendet, mit Begründung («PR-15 Entwicklung von KI: keine eigene
 * Entwicklung»); ohne eigene Begründung bei bedingten Prozessen: Bedingung trifft nicht zu. Ohne ISMS nur die Prozesse,
 * die im Pfad zählen (AIMS-Prozesse und Mindestumfang), nicht die freiwilligen Empfehlungen.
 */
export function d02NichtAnwendbar(ctx: VorlagenKontext): string[] {
  const { u, projekt } = ctx;
  return prozessKatalog(ctx.kataloge)
    .prozesse.filter((kp) => {
      const sicht = sichtImPfad(kp, projekt.meta.mitIsms);
      return (sicht === 'aims' || sicht === 'minimal') && anwendbar(projekt, kp) === 'nein';
    })
    .map((kp) => {
      const grund = eintragVon(projekt, kp.id)?.begruendung?.trim().replace(/\.$/, '') || u.t('vorlagen.D-02.nicht_anwendbar_bedingung');
      return `${kp.id} ${prozessTexte(u, kp.id)?.titel ?? kp.id} (${grund})`;
    });
}

/** D-02: Prozesslandkarte aus dem Katalog in vier Gruppen; mit ISMS gemeinsam geführte Prozesse markiert */
export function prozesslandkarteD02(ctx: VorlagenKontext, prozesse: readonly D02Prozess[]): AblaufBlock {
  const { u } = ctx;
  const t = (s: string, werte?: Record<string, string>) => u.t(g(`d02.${s}`), werte);
  const gruppe = (x: ProzessGruppe) => u.t(`prozesse.gruppen.${x}`);
  const namen = (x: ProzessGruppe) => prozesse.filter((p) => p.gruppe === x).map((p) => `${p.id} ${p.titel}`).join(', ');
  const geteilt = prozesse.filter((p) => p.mitIsms).map((p) => p.id);
  // Gruppennamen aus derselben Quelle wie die Grafik (prozesse.gruppen), in der Reihenfolge der Landkarte
  const beschreibung = [
    t('alt_einleitung'),
    ...GRUPPEN.filter((x) => prozesse.some((p) => p.gruppe === x)).map((x) => `${gruppe(x)}: ${namen(x)}.`),
    t('alt_wechsel', { fuehrung: gruppe('fuehrung'), kern: gruppe('kern'), bewertung: gruppe('bewertung'), unterstuetzung: gruppe('unterstuetzung') }),
    ...(geteilt.length ? [t('alt_isms', { liste: geteilt.join(', ') })] : []),
  ].join(' ');
  return landkarteBlock(
    prozesse.map((p) => ({ id: p.id, gruppe: p.gruppe, text: [`${p.id} ${p.titel}`, ...(p.mitIsms ? [t('isms')] : [])].join('\n'), rolle: p.mitIsms ? 'kat-3' : 'status-info' })),
    gruppe,
    { titel: t('titel'), beschreibung },
    { wechselwirkungen: true },
  );
}

/** Grafiken einer Anlage mit Einleitung (Absatz) */
export function mitEinleitung(text: string, bloecke: Block[]): Block[] {
  return [{ typ: 'absatz', text }, ...bloecke];
}
