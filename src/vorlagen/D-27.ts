// D-27 Prozessbeschreibungen (4.4, 8.1): Prozesshandbuch mit einem Kapitel je anwendbarem Prozess oder, mit
// ctx.prozessId, die Beschreibung eines einzelnen Prozesses. Inhalt je Prozess: Zweck, Geltung, Eigner, Rhythmus und
// Stand, Auslöser, Eingaben, Ablauf als Formen mit Bahnen (AblaufBlock) und als Tabelle mit RACI, Ausgaben und
// Nachweise, Kennzahl, Normbezug (nur Nummern), Schnittstellen und offene Massnahmen. Katalog und Texte:
// src/prozesse/katalog.yaml, i18n prozesse. Leere Vorlage: alle AIMS-Prozesse mit dem Katalogablauf und Platzhaltern.
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import type { ProzessSchritt } from '../model/typen.ts';
import { ablaufImSystem, ablaufVon, bahnText, eintragVon, gefuehrteProzesse, imProzesssystem, pfadWerte, prozessDokumente, prozesseImProjekt, prozessKatalog, prozessTexte, rollenText, sichtImPfad, sollText, texteImPfad } from '../prozesse/katalog.ts';
import { ablaufAlt, ablaufBlock, prozessRaster } from '../prozesse/layout.ts';
import { kz01Stand, kz01Text, prozessStaende, type ProzessStand } from '../prozesse/stand.ts';
import type { KatalogProzess } from '../prozesse/typen.ts';
import { erstelleHelfer, md, type VorlagenKontext } from './kontext.ts';

/**
 * Prozesse im Dokument: einzelner Prozess, sonst leere Vorlage alle AIMS-Prozesse des Katalogs, Firma die anwendbaren
 * (ohne ISMS mit Mindestumfang) und danach die eigenen Prozesse (PE-01 ff.)
 */
export function d27Prozesse(ctx: VorlagenKontext): KatalogProzess[] {
  // Leere Vorlage: auch die Basisprozesse, die das Kit ohne ISMS empfiehlt (Mustertexte für den Weg nur mit Word und Excel)
  if (ctx.modus === 'leer') return prozessKatalog(ctx.kataloge).prozesse.filter((p) => (ctx.prozessId ? p.id === ctx.prozessId : ['aims', 'minimal'].includes(sichtImPfad(p, false))));
  const alle = prozesseImProjekt(ctx.projekt, ctx.kataloge);
  if (ctx.prozessId) return alle.filter((p) => p.id === ctx.prozessId);
  return alle.filter((p) => imProzesssystem(ctx.projekt, p));
}

/**
 * Geltung im Firmendokument in Fachsprache (statt der Einstufung des Katalogs): Pflichtprozess, angewendetes Control,
 * bedingter Prozess mit dem Grund, empfohlener Basisprozess mit dem Entscheid der Firma, eigener Prozess
 */
function geltungFirma(ctx: VorlagenKontext, kp: KatalogProzess, grund: string | undefined): string {
  const { u, projekt } = ctx;
  const k = (s: string, w?: Record<string, string>) => u.t(`vorlagen.D-27.geltung.${s}`, w);
  const begruendung = eintragVon(projekt, kp.id)?.begruendung?.trim().replace(/\.$/, '');
  const sicht = sichtImPfad(kp, projekt.meta.mitIsms);
  if (kp.eigen) return k('eigen');
  if (sicht === 'empfohlen') return begruendung ? k('empfohlen_grund', { grund: begruendung }) : k('empfohlen');
  if (kp.pflicht === 'pflicht') return k('pflicht');
  if (kp.pflicht === 'bedingt') {
    // Grund aus dem Projekt: KI-Systeme, die die Bedingung erfüllen, sonst der Text der Bedingung
    const systeme = [...new Set((kp.bedingung ?? []).filter((b) => b.startsWith('kiSysteme[')).flatMap((b) => pfadWerte(projekt, b)).map((x) => (x as { id?: string }).id).filter((x): x is string => !!x))];
    const text = begruendung ?? grund;
    return text ? k(systeme.length ? 'bedingt_systeme' : 'bedingt', { grund: text, systeme: systeme.join(', ') }) : k('control');
  }
  return sicht === 'minimal' ? k('minimal') : k('control');
}

export function d27(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-27.${s}`;
  const org = projekt.organisation;
  const prozesse = d27Prozesse(ctx);
  // Stand zum Datenstand des Projekts (deterministisch, wie die übrigen Firmendokumente)
  // Stichtag ist das Datum der Fassung: Das Dokument zeigt keine Messung und keine Durchführung nach seiner Freigabe
  const staendeBis = h.istLeer ? undefined : h.standDatum('D-27');
  const stichtag = staendeBis && staendeBis < projekt.meta.geaendert.slice(0, 10) ? staendeBis : projekt.meta.geaendert.slice(0, 10);
  const staende = new Map<string, ProzessStand>(h.istLeer ? [] : prozessStaende(projekt, ctx.kataloge, stichtag).map((s) => [s.id, s]));
  const reifeText = (r: number) => u.t(`prozesse.reifeskala.${['nicht-begonnen', 'definiert', 'eingefuehrt', 'wirksam', 'ueberprueft'][r]}.titel`);
  const ph = (s: string): Text => [{ text: u.t(`allgemein.platzhalter.${s}`), platzhalter: true }];
  const nummer = (n: string) => n.replace(/^A\./, 'A.');
  const kzName = (x: { id: string; titel: string }) => (x.titel ? `${x.id} ${x.titel}` : x.id);
  // Verweise nur auf Prozesse, die die Firma führt (Prozesssystem, mit ISMS auch die Basisprozesse des ISMS)
  const gefuehrt = h.istLeer ? undefined : gefuehrteProzesse(projekt, ctx.kataloge);

  const externText = (x: NonNullable<NonNullable<ReturnType<typeof eintragVon>>['extern']>): string => {
    const l = x.lieferant ? projekt.lieferanten.find((y) => y.id === x.lieferant) : undefined;
    const wer = l ? `${l.name} (${l.id})` : (x.name ?? x.lieferant ?? '');
    return x.steuerung?.trim() ? u.t(k('extern_text'), { wer, steuerung: x.steuerung.trim().replace(/\.$/, '') }) : wer;
  };

  const kapitel = (kp: KatalogProzess, nr: number): Block[] => {
    const tx = prozessTexte(u, kp.id, projekt);
    const st = staende.get(kp.id);
    const e = eintragVon(projekt, kp.id);
    const ablaufRoh = ablaufVon(u, kp, h.istLeer ? undefined : e);
    const ablauf = gefuehrt ? ablaufImSystem(ablaufRoh, gefuehrt) : ablaufRoh;
    const raster = prozessRaster(ablauf, u);
    const nummerVon = new Map(ablauf.schritte.map((s, i) => [s.id, i + 1]));
    const titel = `${kp.id} ${tx?.titel ?? kp.id}`;
    const titelNr = (i: number, s: string): Block => ({ typ: 'ueberschrift', ebene: 2, text: `${nr}.${i} ${u.t(k(`abschnitte.${s}`))}` });
    const liste = (punkte: string[] | undefined): Block => ({ typ: 'liste', punkte: texteImPfad(punkte ?? [], projekt, h.istLeer).map((p) => h.verweise(p)) });

    // Geltung und Stand. Leere Vorlage: Einstufung des Katalogs mit Bedingung; Firmendokument: Geltung in Fachsprache
    const verbindlich = h.istLeer
      ? `${u.t(`prozesse.pflichtarten.${kp.pflicht}`)}${kp.pflicht === 'bedingt' && tx?.bedingung ? ` (${tx.bedingung})` : ''}`
      : geltungFirma(ctx, kp, tx?.bedingung_firma);
    // Bezug zu ISO/IEC 27001 nur, wenn die Firma ein ISMS führt (sonst entstünde der Eindruck eines ISMS)
    const normbezug = [
      kp.normbezug_42001.length ? `ISO/IEC 42001: ${kp.normbezug_42001.map(nummer).join(', ')}` : '',
      kp.normbezug_27001.length && (h.istLeer || projekt.meta.mitIsms) ? `ISO/IEC 27001: ${kp.normbezug_27001.map(nummer).join(', ')}` : '',
    ].filter(Boolean).join('; ');
    const rhythmus = st?.rhythmus ?? kp.rhythmus;
    const rhythmusText = rhythmus ? (u.tOpt(`gefuehrt.optionen.rhythmus.${rhythmus}`) ?? rhythmus) : u.t('prozesse.felder.ereignis');
    const felder: { label: string; wert: Text }[] = [
      { label: u.t('prozesse.felder.zweck'), wert: tx?.zweck ?? '' },
      // Ohne ISMS keine Angabe zur Führung mit dem ISMS; Basisprozesse als Grundprozess der Informationssicherheit
      { label: u.t(k('felder.art')), wert: h.istLeer || projekt.meta.mitIsms ? `${u.t(`prozesse.arten.${kp.art}`)}; ${u.sprache === 'en' ? verbindlich.charAt(0).toLowerCase() + verbindlich.slice(1) : verbindlich}` : verbindlich },
      { label: u.t(k('felder.eigner')), wert: h.istLeer ? md(u.t(k('eigner_leer'), { rolle: rollenText(u, kp.eigner_rolle) })) : h.personText(st?.eigner, 'eigner') },
      ...(!h.istLeer && e?.stellvertretung ? [{ label: u.t(k('felder.stellvertretung')), wert: h.personText(e.stellvertretung) }] : []),
      { label: u.t('prozesse.felder.rhythmus'), wert: rhythmusText },
      ...(h.istLeer
        ? [
            { label: u.t(k('felder.reife')), wert: ph('reife') },
            { label: u.t(k('felder.letzte')), wert: ph('datum') },
            { label: u.t(k('felder.faellig')), wert: ph('datum') },
          ]
        : [
            { label: u.t(k('felder.reife')), wert: st && e?.reife !== undefined ? reifeText(st.reife) : ph('text') },
            // Stand zum Dokumentdatum: Eine Durchführung nach der Freigabe gehört nicht in diese Fassung
            { label: u.t(k('felder.letzte')), wert: st?.letzteDurchfuehrung && (!staendeBis || st.letzteDurchfuehrung <= staendeBis) ? (h.datum(st.letzteDurchfuehrung) ?? '') : u.t(k('noch_keine')) },
            ...(st?.naechsteFaelligkeit ? [{ label: u.t(k('felder.faellig')), wert: h.datum(st.naechsteFaelligkeit) ?? '' }] : []),
          ]),
      ...(!h.istLeer && projekt.meta.mitIsms && e?.ismsVerweis?.trim() ? [{ label: u.t(k('felder.isms')), wert: e.ismsVerweis.trim() }] : []),
      // Ausführung durch eine externe Stelle mit ihrer Steuerung
      ...(!h.istLeer && e?.extern && (e.extern.lieferant || e.extern.name)
        ? [{ label: u.t(k('felder.extern')), wert: externText(e.extern) }]
        : []),
      // Ohne Normbezug (eigene Prozesse, Basisprozesse ohne ISMS): Zeile entfällt
      ...(normbezug || h.istLeer ? [{ label: u.t('prozesse.felder.normbezug'), wert: normbezug }] : []),
    ];

    // Ablauf als Tabelle: Nummer, Schritt, Bahn (führt aus oder verantwortet), wirkt mit, wird informiert, weiter
    const bahn = new Map(ablauf.bahnen.map((b) => [b.id, bahnText(u, b)]));
    // Name einer Rolle im Ablauf: Beschriftung der Bahn mit dieser Rolle (z. B. «Kundendienst» für fachbereich), sonst Rollenname
    const rollenName = (r: string) => {
      const b = ablauf.bahnen.find((x) => x.id === r || x.rolle === r);
      return b ? (bahn.get(b.id) ?? rollenText(u, r)) : rollenText(u, r);
    };
    const rollen = (s: ProzessSchritt, w: string) => Object.entries(s.raci ?? {}).filter(([, x]) => x === w).map(([r]) => rollenName(r)).join(', ');
    // Rolle: Bahn, dazu wer ausserhalb der Bahn verantwortet (A) oder ausführt (R)
    const rolleZelle = (s: ProzessSchritt): string => {
      const b = ablauf.bahnen.find((x) => x.id === s.bahn);
      const eigene = new Set([s.bahn, b?.rolle].filter(Boolean));
      const fremd = (w: string) => Object.entries(s.raci ?? {}).filter(([r, x]) => x === w && !eigene.has(r)).map(([r]) => rollenName(r)).join(', ');
      const a = fremd('A');
      const r = fremd('R');
      return [bahn.get(s.bahn) ?? s.bahn, ...(a ? [u.t(k('rolle_a'), { liste: a })] : []), ...(r ? [u.t(k('rolle_r'), { liste: r })] : [])].join('; ');
    };
    const weiter = (s: ProzessSchritt): string => {
      const n = s.naechste ?? [];
      if (s.art === 'entscheidung') return n.map((z) => `${s.zweige?.[z] ?? ''}: ${nummerVon.get(z) ?? z}`).join('; ');
      return n.map((z) => String(nummerVon.get(z) ?? z)).join(', ');
    };
    const schrittZeilen: Text[][] = ablauf.schritte.map((s, i) => [
      String(i + 1),
      `${s.text}${s.verweis?.length ? ` (${s.verweis.join(', ')})` : ''}`,
      rolleZelle(s),
      rollen(s, 'C'),
      rollen(s, 'I'),
      weiter(s),
    ]);
    const alt = ablaufAlt(ablauf, u, u.t(k('ablauf_titel'), { prozess: titel }), (anzahl, bahnen) => u.t(k('alt_text'), { anzahl, bahnen }));

    // Kennzahl: Vorschlag des Katalogs mit Soll, im Firmendokument der letzte Messwert der gewählten Kennzahl
    // Eigene Prozesse ohne Vorschlag des Katalogs: nur die gewählte Kennzahl, sonst ein Satz, dass noch keine festgelegt ist
    const kz = kp.kennzahl_vorschlag;
    const soll = kz ? sollText((x, w) => u.t(x, w), kz) : '';
    const kennzahlBloecke: Block[] = [
      ...(kz ? [{ typ: 'absatz', text: u.t(k('kennzahl_text'), { kennzahl: tx?.kennzahl ?? '', soll }) } as Block] : st?.kennzahl ? [] : [{ typ: 'absatz', text: u.t(k('kennzahl_eigen')) } as Block]),
      // Firmendokument ohne zugeordnete Messung: Kennzahl steht mit dem Prozess im Messplan (D-05)
      ...(!h.istLeer && kz && !st?.kennzahl && projekt.prozesse !== undefined ? [{ typ: 'absatz', text: h.verweise(u.t(k('kennzahl_messplan'))) } as Block] : []),
      ...(st?.kennzahl
        ? [{ typ: 'absatz', text: `${st.kennzahl.wert || st.kennzahl.kz01 ? u.t(k(st.kennzahl.keineMessung ? 'kennzahl_keine_messung' : 'kennzahl_wert'), { kennzahl: kzName(st.kennzahl), wert: st.kennzahl.wert ?? kz01Text((x, w) => u.t(x, w), st.kennzahl.kz01!), datum: h.datum(st.kennzahl.datum) ?? '' }) : u.t(k('kennzahl_ohne_wert'), { kennzahl: kzName(st.kennzahl) })}${st.kennzahl.sollErreicht ? ` ${u.t(k(`kennzahl_soll_${st.kennzahl.sollErreicht}`))}` : ''}${(st.kennzahl.keineMessung || st.kennzahl.sollErreicht === 'nein') && st.kennzahl.bemerkung ? ` ${st.kennzahl.bemerkung}` : ''}` } as Block]
        : []),
    ];

    // Ausgaben und Nachweise
    const nachweise = (st?.nachweise ?? []).map((id) => {
      const n = projekt.nachweise.find((x) => x.id === id);
      return n ? `${n.id} ${n.titel}` : id;
    });

    // Schnittstellen: verbundene Prozesse auf der anderen Seite, Verweise aus dem Ablauf, Dokumente
    const verweise = [...new Set(ablauf.schritte.flatMap((s) => s.verweis ?? []))];
    const prozessName = (id: string) => `${id} ${prozessTexte(u, id, projekt)?.titel ?? ''}`.trim();
    const dokumente = prozessDokumente(kp, projekt, h.istLeer);
    const verbunden = gefuehrt ? kp.verbunden.filter((x) => gefuehrt.has(x)) : kp.verbunden;
    const eigenText = kp.eigen ? projekt.eigeneProzesse?.find((x) => x.id === kp.id)?.schnittstellenText?.trim() : undefined;
    const schnittstellen: string[] = [
      ...(verbunden.length ? [u.t(k('verbunden'), { liste: verbunden.map(prozessName).join(', ') })] : []),
      ...(verweise.length ? [u.t(k('verweise'), { liste: verweise.map(prozessName).join(', ') })] : []),
      ...(eigenText ? [eigenText] : []),
      ...(dokumente.length || !kp.eigen ? [u.t(k('dokumente'), { liste: h.verweise(dokumente.join(', ')) })] : []),
    ];

    // Offene Massnahmen (Firmendokument)
    const offen = (st?.massnahmenOffen ?? []).map((id) => projekt.massnahmen.find((m) => m.id === id)!).filter(Boolean);

    let i = 0;
    // Eigene Prozesse haben keine Katalogtexte zu Auslösern, Eingaben und Ausgaben: leere Abschnitte entfallen
    const ausgaben = [...texteImPfad(tx?.ausgaben ?? [], projekt, h.istLeer).map((x) => h.verweise(x)), ...nachweise];
    const zeige = (l: readonly unknown[]) => !kp.eigen || l.length > 0;
    return [
      { typ: 'ueberschrift', ebene: 1, text: `${nr} ${titel}` },
      { typ: 'felder', felder },
      ...(h.istLeer && tx?.hilfe ? [{ typ: 'hinweis', art: 'ausfuellhinweis', text: tx.hilfe } as Block] : []),
      ...(zeige(tx?.ausloeser ?? []) ? [titelNr(++i, 'ausloeser'), liste(tx?.ausloeser)] : []),
      ...(zeige(tx?.eingaben ?? []) ? [titelNr(++i, 'eingaben'), liste(tx?.eingaben)] : []),
      titelNr(++i, 'ablauf'),
      ablaufBlock(raster, alt),
      { typ: 'tabelle', kopf: u.liste(k('schritte_kopf')), zeilen: schrittZeilen, breiten: [5, 31, 16, 17, 16, 15] },
      ...(zeige(ausgaben) ? [titelNr(++i, 'ausgaben'), { typ: 'liste', punkte: ausgaben } as Block] : []),
      titelNr(++i, 'kennzahl'),
      ...kennzahlBloecke,
      ...(schnittstellen.length ? [titelNr(++i, 'schnittstellen'), { typ: 'liste', punkte: schnittstellen } as Block] : []),
      ...(offen.length
        ? [
            titelNr(++i, 'massnahmen'),
            {
              typ: 'tabelle',
              kopf: u.liste(k('massnahmen_kopf')),
              zeilen: offen.map((m): Text[] => [m.id, m.titel, h.personText(m.verantwortlich), h.datum(m.termin) ?? '', u.tOpt(`gefuehrt.optionen.massnahmeStatus.${m.status}`) ?? m.status]),
              breiten: [10, 46, 22, 12, 10],
            } as Block,
          ]
        : []),
      ...(!h.istLeer && e?.notiz?.trim() ? [{ typ: 'absatz', text: e.notiz.trim() } as Block] : []),
    ];
  };

  const dok = h.dokEintrag('D-27');
  const freigabeAm = h.datum(dok?.freigabe?.am) ?? `[[${u.t('allgemein.platzhalter.datum')}]]`;
  let nr = 1;
  const bloecke: Block[] = [
    ...h.kitBlock(),
    h.normverweis('4.4, 8.1'),
    ...h.hinweis(k('hinweis')),
    { typ: 'ueberschrift', ebene: 1, text: `1 ${u.t(k('abschnitte.einleitung'))}` },
    { typ: 'absatz', text: h.istLeer ? md(u.t(k('einleitung'))) : u.t(k(ctx.prozessId ? 'einleitung_einzeln' : 'einleitung_firma'), { firma: org.name }) },
    { typ: 'absatz', text: u.t(k('lesehilfe')) },
    // Kriterien der Reifestufen: Die Einstufung je Prozess bleibt so prüfbar
    {
      typ: 'tabelle',
      kopf: u.liste(k('reife_kopf')),
      zeilen: ['nicht-begonnen', 'definiert', 'eingefuehrt', 'wirksam', 'ueberprueft'].map((s): Text[] => [u.t(`prozesse.reifeskala.${s}.titel`), u.t(`prozesse.reifeskala.${s}.kriterium`)]),
      breiten: [22, 78],
    },
    ...(prozesse.length
      ? prozesse.flatMap((kp) => kapitel(kp, ++nr))
      : [{ typ: 'absatz', text: u.t(k('keine_prozesse')) } as Block]),
    { typ: 'ueberschrift', ebene: 1, text: `${++nr} ${u.t(k('abschnitte.freigabe'))}` },
    { typ: 'absatz', text: md(u.t(k('freigabe_text'), { datum: freigabeAm })) },
    h.unterschriften([dok?.freigabe]),
    ...h.anlagen(),
  ];

  return h.pfadVerweise({
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: h.fusszeile('D-27') },
    lenkung: h.lenkung('D-27'),
    eigenschaften: h.eigenschaften('D-27'),
    bloecke,
  });
}
