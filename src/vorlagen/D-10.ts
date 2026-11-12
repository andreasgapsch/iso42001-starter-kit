// D-10 KI-Inventar und Erhebungsfragebogen (A.4.2 bis A.4.6, A.6, 7.1)
// Blätter: Inventar, Ressourcen, Fragebogen Fachbereiche (re-importierbar: feste Spaltenköpfe, eine Zeile je Werkzeug), Freigabeliste.
import type { Block, XlsxMappe, XlsxSpalte, Zellwert } from '../generator/ir.ts';
import { AUFGABENARTEN, DATENKLASSEN, FUNKTIONEN, HANDLUNGSBEFUGNISSE, TARIFE, type KiSystem } from '../model/typen.ts';
import { erstelleHelfer, type VorlagenKontext } from './kontext.ts';

const TYP: KiSystem['typ'][] = ['eingekauft', 'saas', 'eigenbau', 'schatten'];
const AUTOMATISIERUNG: KiSystem['automatisierung'][] = ['unterstuetzend', 'teilautomatisiert', 'vollautomatisiert'];
const LEBENSZYKLUS: KiSystem['lebenszyklus'][] = ['idee', 'entwicklung', 'test', 'betrieb', 'ausserbetrieb'];
const STATUS: KiSystem['status'][] = ['erfasst', 'in-pruefung', 'freigegeben', 'eingeschraenkt', 'ausgesetzt', 'abgeloest', 'untersagt'];
const ROLLE: KiSystem['aiAct']['rollen'][number][] = ['anbieter', 'betreiber', 'einfuehrer', 'haendler', 'produkthersteller', 'bevollmaechtigter'];
const KLASSE: KiSystem['aiAct']['risikoklasse'][] = ['offen', 'verboten', 'hochrisiko-anhang-iii', 'hochrisiko-anhang-i', 'transparenz', 'minimal'];
const FREIGABE: KiSystem['status'][] = ['freigegeben', 'eingeschraenkt', 'ausgesetzt', 'untersagt'];

export function d10(ctx: VorlagenKontext): XlsxMappe {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-10.${s}`;
  const liste = (s: string) => u.liste(k(`listen.${s}`));
  const eb = ctx.form === 'ergaenzungsblatt';
  const id = eb ? 'D-10-EB' : 'D-10';
  const modul = projekt.meta.modulAiAct;
  // Rolle und Klasse nach AI Act: in der leeren Vorlage optional, im Firmendokument mit Modul oder sobald eine Rolle
  // erfasst ist (D-24 verweist auf das Inventar), dazu Begründung und wer sie wann festgelegt hat
  const mitAiAct = h.istLeer || modul || projekt.kiSysteme.some((s) => s.aiAct.rollen.length > 0);
  const jaNein = [u.t('allgemein.ja'), u.t('allgemein.nein')];
  const jn = (v: boolean) => jaNein[v ? 0 : 1]!;
  // Optionale Ja/Nein-Felder (ab rc.2): ohne Angabe leer statt «nein»
  const jnOpt = (v?: boolean) => (v === undefined ? '' : jn(v));
  // Modell und Version: «Anbieter Name, Version»
  // Modell und Version (A.4.4): «Anbieter: …; Modell: …; Version: …», damit die drei Angaben nicht ineinanderlaufen
  const modellTeile = u.liste('vorlagen.D-10.modell_teile');
  const modell = (s: KiSystem) =>
    [s.modell?.anbieter, s.modell?.name, s.modell?.version]
      .map((w, i) => (w?.trim() ? `${modellTeile[i]}: ${w.trim()}` : ''))
      .filter(Boolean)
      .join('; ');
  const wahl = <T>(werte: readonly T[], listenName: string, v: T) => liste(listenName)[werte.indexOf(v)] ?? '';
  // Status und Freigabestatus aus allgemein.ki_status (gemeinsam mit D-02)
  const kiStatus = (werte: readonly KiSystem['status'][]) => werte.map((s) => u.t(`allgemein.ki_status.${s}`));
  const statusWahl = (v: KiSystem['status']) => (STATUS.includes(v) ? u.t(`allgemein.ki_status.${v}`) : '');
  const personName = (pid?: string) => projekt.personen.find((p) => p.id === pid)?.name ?? pid ?? '';
  const lieferant = (lid?: string) => {
    const l = projekt.lieferanten.find((x) => x.id === lid);
    return l ? `${l.id} ${l.name}` : (lid ?? '');
  };
  const datum = (iso?: string) => iso?.slice(0, 10) ?? null;
  const systeme = h.istLeer ? [] : projekt.kiSysteme;
  // Dienst und Tarif (ab rc.3): Tarif, Funktionsschalter, Quelle der Anbieterangaben (gemeinsam mit D-16, Blatt «Dienste»)
  const tarif = (s: KiSystem) => (s.tarif ? wahl(TARIFE, 'tarif', s.tarif) : '');
  const quelle = (s: KiSystem) => [s.quelleAngaben?.fundstelle?.trim(), h.datum(s.quelleAngaben?.abgerufen)].filter(Boolean).join(', ');

  const text = (kopf: string, breite = 18, umbruch = false): XlsxSpalte => ({ kopf, breite, umbruch });
  const auswahl = (kopf: string, werte: string[], breite = 14): XlsxSpalte => ({ kopf, breite, typ: 'liste', liste: werte });

  // Blatt Inventar
  const si = u.liste(k('spalten_inventar'));
  const aiKopf = u.liste(k(h.istLeer ? 'spalten_aiact_optional' : 'spalten_aiact'));
  const inventarSpalten: XlsxSpalte[] = [
    text(si[0]!, 9),
    text(si[1]!, 24, true),
    auswahl(si[2]!, liste('typ'), 12),
    text(si[3]!, 36, true),
    text(si[4]!, 30, true),
    text(si[5]!, 16),
    text(si[6]!, 18),
    text(si[7]!, 18),
    auswahl(si[8]!, jaNein, 10),
    auswahl(si[9]!, jaNein, 10),
    text(si[10]!, 22, true),
    auswahl(si[11]!, liste('automatisierung'), 16),
    auswahl(si[12]!, liste('lebenszyklus'), 13),
    auswahl(si[13]!, kiStatus(STATUS), 13),
    auswahl(si[14]!, jaNein, 10),
    { kopf: si[15]!, breite: 12, typ: 'datum' },
    { kopf: si[16]!, breite: 12, typ: 'datum' },
    { kopf: si[17]!, breite: 12, typ: 'datum' },
    // Menschliche Aufsicht: wer die Ergebnisse je System prüft (D-04 verweist darauf)
    text(si[18]!, 30, true),
    // Handelnde KI und Einordnung (ab rc.2): Handlungsbefugnis, Zugriffe, Gedächtnis, Stoppmöglichkeit, Aufgabenart,
    // generativ, Modell und Version, fremde Inhalte, öffentlich, kritisch mit Rückfallweg, Aufbewahren bis
    auswahl(si[19]!, liste('handlungsbefugnis'), 18),
    text(si[20]!, 30, true),
    auswahl(si[21]!, jaNein, 10),
    text(si[22]!, 28, true),
    auswahl(si[23]!, liste('aufgabenart'), 18),
    auswahl(si[24]!, jaNein, 10),
    text(si[25]!, 26, true),
    auswahl(si[26]!, jaNein, 10),
    auswahl(si[27]!, jaNein, 10),
    auswahl(si[28]!, jaNein, 10),
    text(si[29]!, 28, true),
    { kopf: si[30]!, breite: 12, typ: 'datum' },
    // Dienst und Tarif (ab rc.3): Tarif, Abkündigung durch den Anbieter, Quelle der Anbieterangaben
    auswahl(si[31]!, liste('tarif'), 18),
    { kopf: si[32]!, breite: 12, typ: 'datum' },
    text(si[33]!, 30, true),
    ...(mitAiAct ? [auswahl(aiKopf[0]!, liste('aiact_rolle'), 16), auswahl(aiKopf[1]!, liste('risikoklasse'), 18), text(aiKopf[2]!, 50, true), text(aiKopf[3]!, 20, true)] : []),
  ];
  // Wer die Rolle geprüft oder die Klasse festgelegt hat, mit Datum
  const festgelegt = (s: KiSystem) => {
    const f = s.aiAct.geprueft ?? s.aiAct.eingestuft;
    return f?.von ? `${personName(f.von)}, ${h.datum(f.am) ?? ''}`.replace(/, $/, '') : '';
  };
  const inventarZeilen: Zellwert[][] = systeme.map((s) => [
    s.id,
    s.name,
    wahl(TYP, 'typ', s.typ),
    s.beschreibung,
    s.zweck,
    u.tOpt(`gefuehrt.optionen.fachbereich.${s.fachbereich}`) ?? s.fachbereich,
    personName(s.eigner),
    lieferant(s.lieferant),
    jnOpt(s.personendaten),
    jnOpt(s.besondereDaten),
    s.betroffene,
    wahl(AUTOMATISIERUNG, 'automatisierung', s.automatisierung),
    wahl(LEBENSZYKLUS, 'lebenszyklus', s.lebenszyklus),
    statusWahl(s.status),
    jn(s.sensibleNutzung),
    datum(s.naechsteUeberpruefung),
    datum(s.erfasstAm),
    datum(s.geaendertAm),
    s.aufsicht ?? '',
    s.handlungsbefugnis ? wahl(HANDLUNGSBEFUGNISSE, 'handlungsbefugnis', s.handlungsbefugnis) : '',
    s.zugriffe ?? '',
    jnOpt(s.gedaechtnis),
    s.stoppmoeglichkeit ?? '',
    s.aufgabenart ? wahl(AUFGABENARTEN, 'aufgabenart', s.aufgabenart) : '',
    jnOpt(s.generativ),
    modell(s),
    jnOpt(s.fremdeInhalte),
    jnOpt(s.oeffentlich),
    jnOpt(s.kritisch),
    s.rueckfallweg ?? '',
    datum(s.aufbewahrenBis),
    tarif(s),
    datum(s.abkuendigung),
    quelle(s),
    ...(mitAiAct ? [s.aiAct.rollen.map((r) => wahl(ROLLE, 'aiact_rolle', r)).join(', '), wahl(KLASSE, 'risikoklasse', s.aiAct.risikoklasse), s.aiAct.begruendung, festgelegt(s)] : []),
  ]);

  // Blatt Ressourcen (A.4.2 bis A.4.6)
  const sr = u.liste(k('spalten_ressourcen'));
  const ressourcenSpalten: XlsxSpalte[] = [
    text(sr[0]!, 9),
    text(sr[1]!, 24),
    text(sr[2]!, 34, true),
    text(sr[3]!, 30, true),
    text(sr[4]!, 30, true),
    text(sr[5]!, 30, true),
    text(sr[6]!, 34, true),
    ...(eb ? [text(u.t(k('spalte_asset')), 16)] : []),
  ];
  const ressourcenZeilen: Zellwert[][] = systeme.map((s) => [
    s.id,
    s.name,
    s.ressourcen.daten,
    s.ressourcen.werkzeuge,
    s.ressourcen.rechenressourcen,
    s.ressourcen.personal,
    s.abhaengigkeiten ?? '',
    ...(eb ? [s.ismsAsset ?? ''] : []),
  ]);

  // Blatt Fragebogen: feste Spaltenköpfe, eine Zeile je Werkzeug (Import ins Inventar)
  const sf = u.liste(k('spalten_fragebogen'));
  const unklar = liste('ja_nein_unklar');
  const fragebogenSpalten: XlsxSpalte[] = [
    text(sf[0]!, 16),
    text(sf[1]!, 18),
    text(sf[2]!, 24, true),
    text(sf[3]!, 32, true),
    auswahl(sf[4]!, liste('herkunft'), 22),
    text(sf[5]!, 18),
    { kopf: sf[6]!, breite: 12, typ: 'zahl' },
    auswahl(sf[7]!, liste('haeufigkeit'), 12),
    text(sf[8]!, 28, true),
    auswahl(sf[9]!, unklar, 12),
    auswahl(sf[10]!, unklar, 16),
    text(sf[11]!, 22, true),
    auswahl(sf[12]!, liste('pruefung'), 16),
    text(sf[13]!, 30, true),
    // Ab rc.2: handelnde KI (am Ende, damit die Spalten 1 bis 14 für den Import unverändert bleiben)
    auswahl(sf[14]!, unklar, 16),
    text(sf[15]!, 30, true),
  ];

  // Blatt Freigabeliste
  const sg = u.liste(k('spalten_freigabe'));
  // Antrag und Entscheid (ab Schemaversion 3, AF-104): Datenquelle der Kennzahl PR-07, am Ende (Spalten 1 bis 14 bleiben)
  const sa = u.liste(k('spalten_antrag'));
  const freigabeSpalten: XlsxSpalte[] = [
    text(sg[0]!, 22),
    text(sg[1]!, 10),
    text(sg[2]!, 18),
    auswahl(sg[3]!, kiStatus(FREIGABE), 13),
    text(sg[4]!, 36, true),
    auswahl(sg[5]!, liste('datenklasse'), 16),
    text(sg[6]!, 30, true),
    text(sg[7]!, 18),
    { kopf: sg[8]!, breite: 12, typ: 'datum' },
    { kopf: sg[9]!, breite: 12, typ: 'datum' },
    // Ab rc.2: was das Werkzeug selbst tun darf und welche Erweiterungen, Konnektoren und Agenten freigegeben sind
    auswahl(sg[10]!, liste('handlungsbefugnis'), 18),
    text(sg[11]!, 30, true),
    // Ab rc.3: Tarif und Funktionsschalter des Dienstes
    auswahl(sg[12]!, liste('tarif'), 18),
    text(sg[13]!, 30, true),
    { kopf: sa[0]!, breite: 12, typ: 'datum' },
    { kopf: sa[1]!, breite: 12, typ: 'datum' },
  ];
  // Funktionsschalter «Websuche: ein; Gedächtnis: aus»; nicht festgehaltene Funktionen entfallen (ungeklärt)
  const stand = liste('funktion_stand');
  const funktionenText = (s: KiSystem) =>
    FUNKTIONEN.filter((f) => s.funktionen?.[f])
      .map((f) => `${u.t(k(`funktionen.${f}`))}: ${stand[s.funktionen![f] === 'an' ? 0 : 1]}`)
      .join('; ');
  // Freigabeangaben aus dem Projekt: Auflagen (sonst Zweck), Datenklasse, Begründung (sonst Ergebnis der Folgenabschätzung), Freigabe
  const folgen = (sid: string) => projekt.folgenabschaetzungen.find((f) => f.kiSystem === sid);
  const datenklasse = (s: KiSystem) => (s.datenklasse ? (liste('datenklasse')[DATENKLASSEN.indexOf(s.datenklasse)] ?? '') : '');
  const freigabeZeilen: Zellwert[][] = systeme
    .filter((s) => FREIGABE.includes(s.status))
    .map((s) => [
      s.name,
      s.id,
      lieferant(s.lieferant),
      kiStatus(FREIGABE)[FREIGABE.indexOf(s.status)]!,
      // Untersagt oder ausgesetzt: keine erlaubte Nutzung und keine erlaubte Datenklasse (nicht der Zweck des Systems)
      s.auflagen?.trim() || (s.status === 'untersagt' || s.status === 'ausgesetzt' ? u.t(k('keine_nutzung')) : s.zweck),
      s.status === 'untersagt' || s.status === 'ausgesetzt' ? '' : datenklasse(s),
      s.freigabeBegruendung?.trim() || folgen(s.id)?.ergebnis?.trim() || '',
      s.freigabe ? personName(s.freigabe.von) : '',
      datum(s.freigabe?.am),
      datum(s.naechsteUeberpruefung),
      s.handlungsbefugnis ? wahl(HANDLUNGSBEFUGNISSE, 'handlungsbefugnis', s.handlungsbefugnis) : '',
      s.status === 'untersagt' || s.status === 'ausgesetzt' ? '' : (s.zugriffe ?? ''),
      tarif(s),
      funktionenText(s),
      datum(s.antragAm),
      datum(s.entscheidAm),
    ]);

  const hinweisBlock: Block[] = [
    ...h.kitBlock(),
    h.normverweis('A.4.2 bis A.4.6, A.6, 7.1'),
    ...(eb ? h.hinweis(k('hinweis_eb')) : []),
    // Ausbaustufe ohne eigene Blöcke ist ein Ausfüllhinweis: nur in der leeren Vorlage
    ...(h.istLeer ? h.ausbau(k('ausbau_eigenbau'), []) : []),
  ];

  // Ergänzungsblatt: Das Inventar ergänzt das Asset-Inventar des ISMS (Katalog ergaenzungsblaetter.yaml, D-10-EB)
  const lenkung = h.lenkung(id);
  // ISMS-Dokument mit Version aus dem Dokumentenregister (aufgenommenIn), sonst die allgemeine Bezeichnung
  if (eb) lenkung.ismsBezug = u.t('allgemein.isms_dokument.erweitert', { dokument: (!h.istLeer && h.dokEintrag(id)?.aufgenommenIn?.trim()) || u.t('ergaenzungsblaetter.ismsDokumente.isms-asset-inventar') });

  return {
    sprache: u.sprache,
    eigenschaften: h.eigenschaften(id),
    lenkung,
    firmenname: h.firmenname(),
    hinweisBlock,
    blaetter: [
      {
        name: u.t(k('blaetter.inventar')),
        titel: u.t(k('titel_inventar')),
        hinweise: h.istLeer ? [...u.liste(k('hinweise_inventar')), u.t(k('hinweis_aiact'))] : undefined,
        fixiert: true,
        spalten: inventarSpalten,
        zeilen: inventarZeilen,
        leereZeilen: h.istLeer ? 40 : 10,
      },
      {
        name: u.t(k('blaetter.ressourcen')),
        titel: u.t(k('titel_ressourcen')),
        hinweise: h.istLeer ? u.liste(k('hinweise_ressourcen')) : undefined,
        fixiert: true,
        spalten: ressourcenSpalten,
        zeilen: ressourcenZeilen,
        leereZeilen: h.istLeer ? 40 : 10,
      },
      {
        name: u.t(k('blaetter.fragebogen')),
        titel: u.t(k('titel_fragebogen')),
        // Der Fragebogen geht an die Fachbereiche: Hinweise in jedem Modus
        // Firmendokument: das Blatt ist die Vorlage der nächsten Erhebung; Rückläufe früherer Erhebungen sind Nachweise (D-26)
        hinweise: [...u.liste(k('hinweise_fragebogen')), ...(h.istLeer ? [] : [u.t(k('hinweis_fragebogen_firma'))])],
        fixiert: true,
        spalten: fragebogenSpalten,
        zeilen: [],
        leereZeilen: 30,
      },
      {
        name: u.t(k('blaetter.freigabe')),
        titel: u.t(k('titel_freigabe')),
        hinweise: h.istLeer ? u.liste(k('hinweise_freigabe')) : undefined,
        fixiert: true,
        spalten: freigabeSpalten,
        zeilen: freigabeZeilen,
        leereZeilen: h.istLeer ? 30 : 10,
      },
    ],
  };
}
