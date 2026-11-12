// D-02 Geltungsbereich und AIMS-Überblick (4.3, 4.4)
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import type { KiStatus } from '../model/typen.ts';
import { d02IsmsBasis, d02NichtAnwendbar, d02Prozesse, prozesslandkarteD02 } from './grafik.ts';
import { ANLAGE_AB_SYSTEMEN, erstelleHelfer, leer, md, type VorlagenKontext } from './kontext.ts';

/**
 * Status, mit denen ein KI-System nicht in der Systemliste des Geltungsbereichs erscheint. Untersagte und ausgesetzte
 * Systeme bleiben Gegenstand des AIMS (Überwachung des Verbots, Vorbereitung der Wiederinbetriebnahme) und stehen mit
 * ihrem Status in der Liste; nur abgelöste Systeme entfallen (sie bleiben im Inventar D-10).
 */
export const AUSSER_GELTUNG: KiStatus[] = ['abgeloest'];
/** Status ohne erlaubte Nutzung; Listen je System kennzeichnen sie */
export const OHNE_NUTZUNG: KiStatus[] = ['untersagt', 'ausgesetzt'];

export function d02(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-02.${s}`;
  const org = projekt.organisation;
  const g = org.geltungsbereich;
  const fehlHinweis = (s: string, fehlt: boolean): Block[] => (fehlt ? h.hinweis(k(s), true) : []);
  const zeilenAusYaml = (s: string): Text[][] => (u.roh(k(s)) as string[][]).map((z) => z.map((zelle) => md(zelle)));
  const datumOderPlatzhalter = (iso?: string) => h.datum(iso) ?? `[[${u.t('allgemein.platzhalter.datum')}]]`;
  /** Firmenwert oder (leer bzw. fehlend) Beispieltext als Platzhalter */
  const wertOderBeispiel = (v: string | undefined, beispiel: string): Text => (!h.istLeer && !leer(v) ? v! : md(u.t(k(beispiel))));

  // 1 Aussage
  const aussageFehlt = !h.istLeer && leer(g.beschreibung);

  // 2 Grenzen
  const grenzen = [
    { label: u.t(k('grenzen_felder.organisation')), wert: wertOderBeispiel(g.grenzenOrganisation, 'grenzen_beispiel.organisation') },
    { label: u.t(k('grenzen_felder.technik')), wert: wertOderBeispiel(g.grenzenTechnik, 'grenzen_beispiel.technik') },
    { label: u.t(k('grenzen_felder.standorte')), wert: wertOderBeispiel(g.grenzenStandorte || org.standorte, 'grenzen_beispiel.standorte') },
  ];

  // 3 KI-Systeme: abgelöste Systeme gehören nicht (mehr) zum Geltungsbereich; sie bleiben im Inventar (D-10)
  const systemeFehlen = !h.istLeer && projekt.kiSysteme.length === 0;
  const imGeltungsbereich = projekt.kiSysteme.filter((s) => !AUSSER_GELTUNG.includes(s.status));
  const nurAusserGeltung = !h.istLeer && !systemeFehlen && imGeltungsbereich.length === 0;
  const systemZeilen: Text[][] = h.istLeer
    ? []
    : imGeltungsbereich.map((s) => [s.id, s.name, u.t(`allgemein.ki_typ.${s.typ}`), s.zweck, h.personText(s.eigner, 'person'), u.t(`allgemein.ki_status.${s.status}`)]);
  // Untersagte oder ausgesetzte Systeme in der Liste: kurzer Vermerk, warum sie zum Geltungsbereich gehören
  const ohneNutzung = !h.istLeer && imGeltungsbereich.some((s) => OHNE_NUTZUNG.includes(s.status));

  // 4 Schnittstellen
  const schnittstellenBloecke: Block[] = [];
  if (h.istLeer || leer(g.schnittstellen)) {
    schnittstellenBloecke.push({ typ: 'tabelle', kopf: u.liste(k('schnittstellen_kopf')), zeilen: zeilenAusYaml('schnittstellen_vorschlag'), breiten: [24, 36, 22, 18], leereZeilen: h.istLeer ? 1 : 0 });
  } else {
    schnittstellenBloecke.push({ typ: 'absatz', text: g.schnittstellen });
  }
  if (!h.istLeer && projekt.lieferanten.length > 0) {
    // Prüfstand je Lieferant aus der Lieferantenprüfung (D-16) zum Stand dieses Dokuments (Freigabe oder spätere Bestätigung
    // ohne Änderung): Ergebnis mit Datum, wenn die Prüfung bis dahin abgeschlossen war, sonst «in Prüfung» bzw. der offene Status
    const docStand = h.standDatum('D-02');
    const statusText = (s: string) => u.tOpt(`gefuehrt.optionen.pruefstatus.${s}`) ?? s;
    const stand = (l: (typeof projekt.lieferanten)[number]) => {
      const abgeschlossen = (l.pruefstatus === 'geprueft' || l.pruefstatus === 'mit-auflagen') && !!l.geprueft?.am && (!docStand || l.geprueft.am <= docStand);
      if (abgeschlossen) return ` (${u.t(k('lieferant_stand_datum'), { status: statusText(l.pruefstatus), datum: h.datum(l.geprueft!.am) ?? '' })})`;
      const offen = l.pruefstatus === 'geprueft' || l.pruefstatus === 'mit-auflagen' ? 'in-pruefung' : l.pruefstatus;
      return ` (${u.t(k('lieferant_stand'), { status: statusText(offen) })})`;
    };
    schnittstellenBloecke.push(
      { typ: 'absatz', text: u.t(k('lieferanten_titel')) },
      { typ: 'liste', punkte: projekt.lieferanten.map((l) => `${l.id} ${l.name}: ${l.leistung.trim()}${stand(l)}`) },
    );
  }

  // 5 Ausschlüsse
  const ausschlussBloecke: Block[] =
    h.istLeer
      ? [{ typ: 'tabelle', kopf: u.liste(k('ausschluesse_kopf')), zeilen: zeilenAusYaml('ausschluesse_vorschlag'), breiten: [40, 60], leereZeilen: 1 }]
      : g.ausschluesse.length > 0
        ? [{ typ: 'tabelle', kopf: u.liste(k('ausschluesse_kopf')), zeilen: g.ausschluesse.map((a) => [a.was, h.wert(a.begruendung, 'text')]), breiten: [40, 60] }]
        : [{ typ: 'absatz', text: u.t(k(g.keineAusschluesseBestaetigt ? 'keine_ausschluesse_bestaetigt' : 'keine_ausschluesse')) }];

  // 6 Prozesse aus dem Katalog (src/prozesse/katalog.yaml): AIMS-Prozesse, ohne ISMS dazu der Mindestumfang der
  // Basisprozesse; Eigner/in aus dem Prozessstand, sonst aus dem Dokumentenregister (erstes Dokument des Prozesses)
  const prozesse = d02Prozesse(ctx);
  const prozessZeilen: Text[][] = prozesse.map((x) => {
    // Eigene Prozesse (PE-01) haben keine Kit-Dokumente: Eigner nur aus dem Prozessstand
    const erstes = x.dokumente[0];
    const e = erstes ? (h.dokEintrag(erstes) ?? h.dokEintrag(`${erstes}-EB`)) : undefined;
    return [`${x.id} ${x.titel}`, x.zweck, h.personText(x.eigner ?? e?.eigner, 'eigner'), x.dokumente.join(', ')];
  });
  // Mit ISMS: Basisprozesse der Informationssicherheit führt das ISMS (Verweis statt eigener Prozess)
  const ismsBasis = !h.istLeer && projekt.meta.mitIsms ? d02IsmsBasis(ctx) : [];
  // Nicht angewendete Prozesse des Katalogs mit Begründung (Lücken in der Nummerierung erklären, z. B. PR-15)
  const nichtAnwendbar = h.istLeer || projekt.prozesse === undefined ? [] : d02NichtAnwendbar(ctx);
  const mitD27 = !h.istLeer && projekt.prozesse !== undefined;

  // 7 Änderungen: Änderungshistorie aus dem Dokumentenregister, sonst die aktuelle Version mit Freigabe
  const dok = h.dokEintrag('D-02');
  const historie = h.aenderungen('D-02');
  const aenderungZeilen: Text[][] = historie.length
    ? historie.map((a) => [a.version, h.datum(a.datum) ?? '', a.was, h.personText(a.von ?? (a.version === dok?.version ? dok?.freigabe?.von : undefined))])
    : !h.istLeer && dok?.freigabe
      ? [[dok.version, h.datum(dok.freigabe.am) ?? '', u.t(k('aenderung_freigabe'), { version: dok.version }), h.personText(dok.freigabe.von)]]
      : [];
  // 8 Freigabe: aktuelle Version aus dem Register; bei mehreren Versionen mit dem Datum der ersten Freigabe
  const freigabeAktuell = !h.istLeer && dok?.freigabe?.am ? dok.freigabe : g.freigabe;
  const erste = h.istLeer ? undefined : h.ersteFreigabe('D-02');
  const freigabeText =
    historie.length > 1 && erste && freigabeAktuell?.am && erste < freigabeAktuell.am
      ? u.t(k('freigabe_text_version'), { datum: h.datum(freigabeAktuell.am)!, version: dok?.version ?? '', erste: h.datum(erste)! })
      : u.t(k('freigabe_text'), { datum: datumOderPlatzhalter(freigabeAktuell?.am) });

  let n = 0;
  const titel = (s: string): Block => ({ typ: 'ueberschrift', ebene: 1, text: `${++n} ${u.t(k(`abschnitte.${s}`))}` });

  const bloecke: Block[] = [
    ...h.kitBlock(),
    h.normverweis('4.3, 4.4'),
    { typ: 'absatz', text: h.istLeer ? md(u.t(k('einleitung'))) : u.t(k('einleitung_firma'), { firma: org.name }) },

    titel('aussage'),
    ...h.hinweis(k('hinweis_aussage'), aussageFehlt),
    ...fehlHinweis('aussage_fehlt', aussageFehlt),
    { typ: 'absatz', text: h.istLeer || aussageFehlt ? md(u.t(k('aussage_beispiel'))) : g.beschreibung },

    titel('grenzen'),
    ...h.hinweis(k('hinweis_grenzen')),
    { typ: 'felder', felder: grenzen },
    ...h.ausbau(k('ausbau_grenzen'), []),

    titel('systeme'),
    ...h.hinweis(k('hinweis_systeme')),
    ...fehlHinweis('systeme_fehlen', systemeFehlen),
    ...(nurAusserGeltung
      ? [{ typ: 'absatz', text: u.t(k('systeme_keine_aktiven')) } as Block]
      : h.systemAnlage(
          u.t(k('abschnitte.systeme')),
          [
            { typ: 'tabelle', kopf: u.liste(k('systeme_kopf')), zeilen: systemZeilen, breiten: [10, 20, 15, 26, 17, 12], leereZeilen: h.istLeer || systemeFehlen ? 2 : 0 },
            ...(ohneNutzung ? [{ typ: 'absatz', text: u.t(k('systeme_ohne_nutzung')) } as Block] : []),
          ],
          systemZeilen.length,
        )),

    titel('schnittstellen'),
    ...h.hinweis(k('hinweis_schnittstellen')),
    ...schnittstellenBloecke,

    titel('ausschluesse'),
    ...h.hinweis(k('hinweis_ausschluesse')),
    ...ausschlussBloecke,

    titel('ueberblick'),
    ...h.hinweis(k('hinweis_ueberblick')),
    { typ: 'absatz', text: u.t(k('ueberblick_text')) },
    ...(mitD27 ? [{ typ: 'absatz', text: u.t(k('ueberblick_d27')) } as Block] : []),
    // Viele Prozesse: Tabelle im Firmendokument in einer Anlage (Seitenvorgabe 4 Seiten Haupttext), wie die Systemliste
    ...((inhalt: Block[]): Block[] => (prozessZeilen.length >= ANLAGE_AB_SYSTEMEN ? h.textAnlage(u.t(k('prozesse_anlage')), inhalt, (nr) => u.t(k('prozesse_verweis'), { anzahl: prozessZeilen.length, nr })) : inhalt))([
      { typ: 'tabelle', kopf: u.liste(k('ueberblick_kopf')), zeilen: prozessZeilen, breiten: [26, 40, 20, 14] },
      ...(ismsBasis.length ? [{ typ: 'absatz', text: u.t(k('isms_basis'), { liste: ismsBasis.join('; ') }) } as Block] : []),
      ...(nichtAnwendbar.length ? [{ typ: 'absatz', text: u.t(k('nicht_anwendbar'), { liste: nichtAnwendbar.join('; ') }) } as Block] : []),
    ]),
    // Prozesslandkarte aus bearbeitbaren Formen in der Anlage (zählt nicht zur Seitenvorgabe)
    ...h.grafikAnlage(u.t('vorlagen.grafik.d02.titel'), [prozesslandkarteD02(ctx, prozesse)]),

    titel('aenderungen'),
    ...h.hinweis(k('hinweis_aenderungen')),
    { typ: 'absatz', text: u.t(k('aenderungen_text')) },
    { typ: 'tabelle', kopf: u.liste(k('aenderungen_kopf')), zeilen: aenderungZeilen, breiten: [12, 16, 47, 25], leereZeilen: h.istLeer || !aenderungZeilen.length ? 1 : 0 },

    titel('freigabe'),
    { typ: 'absatz', text: md(freigabeText) },
    // Bekannte Freigabe der aktuellen Version statt leerer Felder (N-15)
    h.unterschriften([freigabeAktuell], h.istLeer ? 1 : 2),
    ...h.anlagen(),
  ];

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: h.fusszeile('D-02') },
    lenkung: h.lenkung('D-02'),
    eigenschaften: h.eigenschaften('D-02'),
    bloecke,
  });
}
