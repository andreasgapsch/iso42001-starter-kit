// D-11 Erklärung zur Anwendbarkeit (6.1.3)
// Blatt «SoA»: 38 Controls nach Gruppen, mit Modul AI Act die Zusatz-Controls EUAIA-xx, mit Modul NIST AI RMF die
// Zusatz-Controls RMF-xx und RMF-Gxx, danach eigene Controls (EC-xx).
// Blatt «Auswertung»: Anzahl anwendbar und umgesetzt je Abschnitt, berechnet aus dem Blatt «SoA».
import type { Block, XlsxMappe, XlsxSpalte, Zellwert } from '../generator/ir.ts';
import type { ControlEintrag, ControlStatus, JaNeinOffen } from '../model/typen.ts';
import { rmfVorschlaege } from '../nist-rmf/logik.ts';
import type { RmfControl } from '../kataloge/typen.ts';
import { erstelleHelfer, normbezugSprache, type VorlagenKontext } from './kontext.ts';

const STATUS: ControlStatus[] = ['offen', 'geplant', 'teilweise', 'umgesetzt', 'wirksam'];

/** Spaltenbuchstabe aus 1-basiertem Index (ohne Abhängigkeit vom Renderer). */
function spalte(n: number): string {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

interface Zuordnung { id: string; verwandt?: { control: string }[] }
interface EuaiaControl { id: string; artikel?: string[]; verwandt_27001?: string[] }

export function d11(ctx: VorlagenKontext): XlsxMappe {
  const h = erstelleHelfer(ctx);
  const { u, projekt, kataloge } = ctx;
  const k = (s: string) => `vorlagen.D-11.${s}`;
  const modul = projekt.meta.modulAiAct;
  const modulRmf = projekt.meta.modulNistRmf === true;
  const ja = u.t('allgemein.ja');
  const nein = u.t('allgemein.nein');
  const statusText = u.liste(k('status'));

  const personName = (pid?: string) => projekt.personen.find((p) => p.id === pid)?.name ?? pid ?? '';
  const eintrag = (id: string): ControlEintrag | undefined => (h.istLeer ? undefined : projekt.controls.find((c) => c.id === id));
  const anwendbar = (a?: JaNeinOffen) => (a === 'ja' ? ja : a === 'nein' ? nein : '');
  const risiken = (id: string) => (h.istLeer ? '' : projekt.risiken.filter((r) => r.controls.includes(id)).map((r) => r.id).join(', '));
  const nachweise = (c?: ControlEintrag) =>
    (c?.nachweise ?? [])
      .map((n) => {
        const x = projekt.nachweise.find((y) => y.id === n);
        return x ? `${x.id} ${x.titel}` : n;
      })
      .join(', ');
  // Wirksamkeit geprüft (controls[].wirksamkeit): wie, wann, wer; Ergebnis nach Semikolon
  const wirksamkeit = (c?: ControlEintrag) => {
    const w = c?.wirksamkeit;
    if (!w) return '';
    const teile = [w.wie?.trim(), h.datum(w.wann), w.wer ? personName(w.wer) : undefined].filter((x): x is string => !!x).join(', ');
    return [teile, w.ergebnis?.trim()].filter(Boolean).join('; ');
  };
  const ohnePraefix = (ids: string[]) => ids.map((i) => i.replace(/^27001-/, '')).join(', ');

  // Verwandte 27001-Controls: Projekteintrag, sonst Zuordnung aus src/kataloge/mapping-42001-27001.yaml (Katalogname nach laden-node.ts)
  const mapping = (kataloge['mapping4200127001'] as { zuordnungen?: Zuordnung[] } | undefined)?.zuordnungen ?? [];
  const verwandt27001 = (id: string, c?: ControlEintrag, katalog: string[] = []) =>
    ohnePraefix(c?.iso27001.length ? c.iso27001 : katalog.length ? katalog : (mapping.find((m) => m.id === id)?.verwandt ?? []).map((v) => v.control));

  /** Gruppe wie die Formel der Spalte «Gruppe»: EUAIA, NISTRMF, EC oder Gruppe aus Anhang A (A.6.2.4 -> A.6) */
  const gruppeVon = (id: string): string => {
    if (!id) return '';
    if (id.startsWith('EUAIA-')) return 'EUAIA';
    if (id.startsWith('RMF-')) return 'NISTRMF';
    if (id.startsWith('EC-')) return 'EC';
    const punkt = id.indexOf('.', 2);
    return punkt > 0 ? id.slice(0, punkt) : '';
  };
  const kontrollZeile = (id: string, titel: string, katalog27001: string[] = []): Zellwert[] => {
    const c = eintrag(id);
    return [
      id,
      titel,
      anwendbar(c?.anwendbar),
      c?.begruendung ?? '',
      risiken(id),
      // «nicht anwendbar» hat keinen Umsetzungsstatus; Status mit offener Massnahme in der Umsetzung gilt als «teilweise»
      c && c.anwendbar !== 'nein' ? statusText[STATUS.indexOf(h.controlStatus(c))]! : '',
      c?.umsetzung ?? '',
      nachweise(c),
      wirksamkeit(c),
      personName(c?.verantwortlich),
      verwandt27001(id, c, katalog27001),
      // Spalte «Gruppe»: Ergebnis der Formel, zwischengespeichert (sichtbar ohne Neuberechnung)
      gruppeVon(id),
    ];
  };
  const abschnitt = (titel: string): Zellwert[] => ['', titel];

  // ISO/IEC 42001 Anhang A
  const zeilen: Zellwert[][] = [];
  const gruppen = kataloge.controls42001.gruppen;
  for (const g of gruppen) {
    zeilen.push(abschnitt(`${g.id} ${h.normTitel(g.id)}`));
    let unter: string | undefined;
    for (const c of g.controls) {
      const ug = g.untergruppen?.find((x) => c.id.startsWith(`${x}.`));
      if (ug && ug !== unter) {
        zeilen.push(abschnitt(`${ug} ${h.normTitel(ug)}`));
        unter = ug;
      }
      zeilen.push(kontrollZeile(c.id, h.normTitel(c.id)));
    }
  }

  // Zusatz-Controls EU AI Act (nur mit Modul)
  if (modul) {
    zeilen.push([], abschnitt(u.t(k('abschnitt_euaia'))));
    const katalog = (kataloge['aiact_euaiaControls'] as { controls?: EuaiaControl[] } | undefined)?.controls ?? [];
    // Leere Vorlage: ganzer Katalog zur Auswahl. Firmendokument: nur die im Projekt erfassten Zusatz-Controls (mit Entscheid);
    // nicht erfasste Katalog-Controls stehen gesammelt in einer Zeile als nicht aufgenommen.
    const erfasst = (id: string) => projekt.controls.some((c) => c.id === id);
    const katalogIds = katalog.map((c) => c.id).filter((id) => h.istLeer || erfasst(id));
    const ids = [...katalogIds, ...(h.istLeer ? [] : projekt.controls.filter((c) => c.rahmenwerk === 'EUAIA' && !katalog.some((x) => x.id === c.id)).map((c) => c.id))];
    const nichtAufgenommen = h.istLeer ? [] : katalog.map((c) => c.id).filter((id) => !erfasst(id));
    for (const id of ids) {
      const kc = katalog.find((c) => c.id === id);
      const name = u.tOpt(`euaia.${id}.name`) ?? '';
      const artikel = kc?.artikel?.length ? u.t(k('artikel'), { artikel: normbezugSprache(kc.artikel.join(', '), u.sprache) }) : '';
      zeilen.push(kontrollZeile(id, [name, artikel && name ? `(${artikel})` : artikel].filter(Boolean).join(' '), kc?.verwandt_27001 ?? []));
    }
    if (nichtAufgenommen.length) zeilen.push(['', u.t(k('euaia_nicht_aufgenommen'), { ids: nichtAufgenommen.join(', ') })]);
    if (!ids.length && h.istLeer) for (let i = 0; i < 5; i++) zeilen.push([]);
  }

  // Zusatz-Controls NIST AI RMF (nur mit Modul), wie EUAIA: leere Vorlage ganzer Katalog; Firmendokument nur die erfassten
  // Controls (mit Entscheid), nicht erfasste in einer Sammelzeile, getrennt nach «für unsere Systeme vorgeschlagen»
  // (vorschlag_wenn, offen) und «nicht zutreffend»
  if (modulRmf) {
    zeilen.push([], abschnitt(u.t(k('abschnitt_rmf'))));
    const katalog = (kataloge.nistrmf_rmfControls?.controls ?? []) as RmfControl[];
    const erfasst = (id: string) => projekt.controls.some((c) => c.id === id);
    const ids = [
      ...katalog.map((c) => c.id).filter((id) => h.istLeer || erfasst(id)),
      ...(h.istLeer ? [] : projekt.controls.filter((c) => c.rahmenwerk === 'NISTRMF' && !katalog.some((x) => x.id === c.id)).map((c) => c.id)),
    ];
    for (const id of ids) {
      const kc = katalog.find((c) => c.id === id);
      const name = u.tOpt(`nist.controls.${id}.titel`) ?? '';
      const sub = kc?.subkategorien.length ? u.t(k('subkategorien'), { ids: kc.subkategorien.join(', ') }) : '';
      zeilen.push(kontrollZeile(id, [name, sub && name ? `(${sub})` : sub].filter(Boolean).join(' '), kc?.verwandt_27001 ?? []));
    }
    if (!h.istLeer) {
      const vorgeschlagen = new Set(rmfVorschlaege(projekt, katalog).map((v) => v.id));
      const fehlend = katalog.map((c) => c.id).filter((id) => !erfasst(id));
      const offen = fehlend.filter((id) => vorgeschlagen.has(id));
      const nicht = fehlend.filter((id) => !vorgeschlagen.has(id));
      if (offen.length) zeilen.push(['', u.t(k('rmf_offen'), { ids: offen.join(', ') })]);
      if (nicht.length) zeilen.push(['', u.t(k('rmf_nicht_aufgenommen'), { ids: nicht.join(', ') })]);
    }
  }

  // Eigene Controls
  zeilen.push([], abschnitt(u.t(k('abschnitt_eigene'))));
  // Eigenes Control mit Titel und Inhalt (eigeneControls[].beschreibung), damit die Regel in der SoA steht
  for (const ec of h.istLeer ? [] : projekt.eigeneControls) zeilen.push(kontrollZeile(ec.id, ec.beschreibung?.trim() ? `${ec.titel}: ${ec.beschreibung.trim()}` : ec.titel));

  // Spalten; Spalte «Gruppe» wird berechnet und speist die Auswertung. Firmendokument ohne ISMS: ohne die Spalte
  // «Verwandte ISO/IEC 27001-Controls» (Index 10), weil es kein ISMS gibt, dessen Nachweise wiederverwendet würden
  const mit27001 = h.istLeer || projekt.meta.mitIsms;
  const ohne27001 = <T>(z: T[]): T[] => (mit27001 ? z : z.filter((_, i) => i !== 10));
  const sp = ohne27001(u.liste(k('spalten_soa')));
  const text = (kopf: string, breite: number, umbruch = false): XlsxSpalte => ({ kopf, breite, umbruch });
  // Firmendokument mit Normtexten der Firma (nach Bestätigung): Spalte «Control-Text» nach dem Titel; o verschiebt die
  // Spaltenbezüge der Formeln und Formate dahinter
  const mitText = h.mitNormtext;
  const o = mitText ? 1 : 0;
  const iGruppe = sp.length + o; // 1-basiert: letzte Spalte
  const A = 'A';
  const spalten: XlsxSpalte[] = [
    text(sp[0]!, 10),
    text(sp[1]!, 36, true),
    ...(mitText ? [text(u.t('allgemein.normtext.spalte_control_text'), 60, true)] : []),
    { kopf: sp[2]!, breite: 11, typ: 'liste', liste: [ja, nein] },
    text(sp[3]!, 40, true),
    text(sp[4]!, 12, true),
    { kopf: sp[5]!, breite: 12, typ: 'liste', liste: statusText },
    text(sp[6]!, 30, true),
    text(sp[7]!, 22, true),
    text(sp[8]!, 28, true),
    text(sp[9]!, 18),
    ...(mit27001 ? [text(sp[10]!, 16, true)] : []),
    {
      kopf: sp[mit27001 ? 11 : 10]!,
      breite: 8,
      typ: 'formel',
      formel: `=IF(${A}{r}="","",IF(LEFT(${A}{r},6)="EUAIA-","EUAIA",IF(LEFT(${A}{r},4)="RMF-","NISTRMF",IF(LEFT(${A}{r},3)="EC-","EC",IFERROR(LEFT(${A}{r},FIND(".",${A}{r},3)-1),"")))))`,
    },
  ];

  // Auswertung: COUNTIFS über das Blatt «SoA»
  const soa = u.t(k('blaetter.soa'));
  const ref = (n: number) => `'${soa.replace(/'/g, "''")}'!$${spalte(n)}:$${spalte(n)}`;
  const G = ref(iGruppe);
  const ANW = ref(3 + o);
  const ST = ref(6 + o);
  const auswertungZeilen: Zellwert[][] = [
    ...gruppen.map((g) => [`${g.id} ${h.normTitel(g.id)}`, g.id]),
    [u.t(k('gesamt_anhang_a')), 'A.*'],
    ...(modul ? [[u.t(k('euaia_kurz')), 'EUAIA']] : []),
    ...(modulRmf ? [[u.t(k('rmf_kurz')), 'NISTRMF']] : []),
    [u.t(k('eigene_kurz')), 'EC'],
  ];
  const sa = u.liste(k('spalten_auswertung'));
  const umgesetzt = statusText[3]!;
  const wirksam = statusText[4]!;
  // Zwischengespeicherte Ergebnisse der Auswertung (gleiche Zählung wie COUNTIF/COUNTIFS über die Zeilen der SoA)
  const soaZeilen = zeilen.filter((z) => typeof z[0] === 'string' && z[0] !== '');
  for (const a of auswertungZeilen) {
    const schluessel = String(a[1]);
    const passt = (z: Zellwert[]) => {
      const g = String(z[z.length - 1] ?? '');
      return schluessel.endsWith('*') ? g.startsWith(schluessel.slice(0, -1)) : g === schluessel;
    };
    const gruppe = soaZeilen.filter(passt);
    const anw = gruppe.filter((z) => z[2] === ja);
    const ums = anw.filter((z) => z[5] === umgesetzt || z[5] === wirksam);
    a.push(gruppe.length, anw.length, ums.length, anw.length > 0 ? Math.round((ums.length / anw.length) * 100) : '');
  }

  const e = h.dokEintrag('D-11');
  const hinweisBlock: Block[] = [
    ...h.kitBlock(),
    h.normverweis('6.1.3'),
    { typ: 'ueberschrift', ebene: 2, text: u.t(k('freigabe.titel')) },
    { typ: 'absatz', text: u.t(k('freigabe.text')) },
    {
      typ: 'felder',
      felder: [
        { label: u.t(k('freigabe.durch')), wert: h.personText(e?.freigabe?.von, 'freigabe') },
        { label: u.t(k('freigabe.am')), wert: h.wert(h.datum(e?.freigabe?.am), 'datum') },
        { label: u.t(k('freigabe.version')), wert: h.wert(e?.version, 'version') },
      ],
    },
    ...(h.istLeer ? h.ausbau(k('ausbau_systeme'), []) : []),
  ];

  // Hinweis «bereits vorhanden»: nur in leeren Vorlagen. Firmendokumente enthalten keine Ausfüllhinweise; einen Ausschluss
  // mit dieser Begründung meldet die Prüfregel H12 im Werkzeug.
  const hinweise = h.istLeer ? [u.t(k('hinweis_vorhanden')), ...u.liste(k('hinweise_soa'))] : [];

  return {
    sprache: u.sprache,
    eigenschaften: h.eigenschaften('D-11'),
    lenkung: h.lenkung('D-11'),
    firmenname: h.firmenname(),
    hinweisBlock,
    blaetter: [
      {
        name: soa,
        titel: u.t(k('titel_soa')),
        hinweise: hinweise.length ? hinweise : undefined,
        fixiert: true,
        // Umsetzungsstand farbig mit Wort (offen kritisch, geplant und teilweise Handlung nötig, umgesetzt und wirksam gut)
        formate: [{ art: 'text', spalte: 5 + o, regeln: statusText.map((t, i) => ({ text: t, rolle: (['status-kritisch', 'status-warnung', 'status-warnung', 'status-gut', 'status-gut'] as const)[i]! })) }],
        spalten,
        zeilen: zeilen.map((z) => (z.length > 10 ? ohne27001(z) : z)).map((z) => (mitText && z.length > 2 ? [z[0]!, z[1]!, h.normAnforderung(String(z[0])) ?? '', ...z.slice(2)] : z)),
        leereZeilen: h.istLeer ? 10 : 5,
      },
      {
        name: u.t(k('blaetter.auswertung')),
        titel: u.t(k('titel_auswertung')),
        hinweise: h.istLeer ? u.liste(k('hinweise_auswertung')) : undefined,
        // Umsetzungsgrad als Datenbalken 0 bis 100 %
        formate: [{ art: 'datenbalken', spalte: 5, min: 0, max: 100 }],
        spalten: [
          { kopf: sa[0]!, breite: 40 },
          { kopf: sa[1]!, breite: 10 },
          { kopf: sa[2]!, breite: 10, typ: 'formel', formel: `=COUNTIF(${G},B{r})` },
          { kopf: sa[3]!, breite: 12, typ: 'formel', formel: `=COUNTIFS(${G},B{r},${ANW},"${ja}")` },
          {
            kopf: sa[4]!,
            breite: 14,
            typ: 'formel',
            formel: `=COUNTIFS(${G},B{r},${ANW},"${ja}",${ST},"${umgesetzt}")+COUNTIFS(${G},B{r},${ANW},"${ja}",${ST},"${wirksam}")`,
          },
          { kopf: sa[5]!, breite: 14, typ: 'formel', formel: '=IF(D{r}>0,ROUND(E{r}/D{r}*100,0),"")' },
        ],
        zeilen: auswertungZeilen,
      },
    ],
  };
}
