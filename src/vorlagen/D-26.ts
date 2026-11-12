// D-26 Lenkung dokumentierter Information (7.5) und Änderungen am AIMS (6.3)
// d26: Regeln (DOCX); d26Register: Dokumenten- und Aufzeichnungsregister (XLSX)
import { drawioDateiname } from '../prozesse/drawio-projekt.ts';
import type { Block, DocxDokument, XlsxBlatt, XlsxMappe, XlsxSpalte, Zellwert } from '../generator/ir.ts';
import { dokumentImProjekt } from '../kataloge/typen.ts';
import type { DokumentEintrag } from '../model/typen.ts';
import { dokumentTitel, erstelleHelfer, klartext, md, NUR_ALS_EB_MIT_ISMS, type VorlagenKontext } from './kontext.ts';
import { ergaenzungsAbschnitte, ergaenzungsblaetter } from './ergaenzungsblatt.ts';
import { neuesteDatei, registerAusBibliothek } from '../bibliothek/register.ts';
import { statusFuerRegister } from '../bibliothek/sicht.ts';

export function d26(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-26.${s}`;
  const eb = ctx.form === 'ergaenzungsblatt';
  const org = projekt.organisation;
  const datumOderPlatzhalter = (iso?: string) => h.datum(iso) ?? `[[${u.t('allgemein.platzhalter.datum')}]]`;
  const id = eb ? 'D-26-EB' : 'D-26';

  // Ablageort: der häufigste Ablageort im Projekt, sonst Platzhalter
  const orte = projekt.dokumente.map((d) => d.ablageort).filter(Boolean);
  const lenk = h.istLeer ? undefined : org.dokumentenlenkung;
  const ort = lenk?.ablage
    ? lenk.ablage
    : !h.istLeer && orte.length
      ? orte.sort((a, b) => orte.filter((x) => x === b).length - orte.filter((x) => x === a).length)[0]!
      : `[[${u.t(k('ablage_platzhalter'))}]]`;
  // Ereignisprotokolle: im Firmendokument je System festgelegt (KiSystem.protokollierung, Register Blatt Aufzeichnungen)
  const protokolleJeSystem = !h.istLeer && projekt.kiSysteme.some((x) => x.protokollierung);
  const zelleText = (zelle: string) => (protokolleJeSystem ? zelle.replace(/\[\[[^\]]*(je System|each system)[^\]]*\]\]/, u.t(k('protokolle_je_system'))) : zelle);

  const tabelle = (kopf: string, zeilen: string, breiten: number[]): Block => ({
    typ: 'tabelle',
    kopf: u.liste(k(kopf)),
    zeilen: (u.roh(k(zeilen)) as string[][]).map((z) => z.map((zelle) => md(zelleText(zelle)))),
    breiten,
  });
  // Aufbewahrung (N-27): Zeilen des Vorschlags mit den Fristen aus dem Dokumentenregister des Projekts, wo sie festgelegt
  // sind (DokumentEintrag.aufbewahrung des Dokuments, in dem die Aufzeichnung entsteht); sonst der Vorschlag
  const AUFBEWAHRUNG_QUELLE = [['D-03', 'D-11'], ['D-20', 'D-21', 'D-22'], ['D-09', 'D-07'], ['D-17'], [], ['E-08']];
  const frist = (ids: string[]) => (h.istLeer ? undefined : ids.map((x) => h.dokEintrag(x)).find((e) => e?.aufbewahrung?.trim()));
  // Firmendokument: Zeilen zu Hochrisiko-KI nur, wenn sie zutreffen (Betreiber: Protokolle, Anbieter: technische Dokumentation)
  const hochrisiko = (rolle: 'betreiber' | 'anbieter') =>
    projekt.kiSysteme.some((s) => s.status !== 'abgeloest' && s.aiAct.rollen.includes(rolle) && s.aiAct.risikoklasse.startsWith('hochrisiko'));
  const aufbewahrungTabelle = (): Block => ({
    typ: 'tabelle',
    kopf: u.liste(k('aufbewahrung_kopf')),
    zeilen: (u.roh(k('aufbewahrung_zeilen')) as string[][])
      .map((z, i) => ({ z, i }))
      .filter(({ i }) => h.istLeer || i !== 5 || hochrisiko('anbieter'))
      .map(({ z, i }) => {
        const e = frist(AUFBEWAHRUNG_QUELLE[i] ?? []);
        // Begründung bleibt die fachliche Begründung der Frist; die Frist selbst kommt aus dem Register
        const grund = i === 4 && !h.istLeer && !hochrisiko('betreiber') ? u.t(k('aufbewahrung_protokolle_grund')) : z[2]!;
        return e ? [md(z[0]!), e.aufbewahrung!, md(grund)] : [md(zelleText(z[0]!)), md(zelleText(z[1]!)), md(zelleText(grund))];
      }),
    breiten: [36, 28, 36],
  });
  // Prüfung und Freigabe: Regel der Firma (dokumentenlenkung.freigabe), sonst Vorschlag der Vorlage
  const regel = h.istLeer ? undefined : lenk?.freigabe;
  const freigabeTabelle = (): Block => ({
    typ: 'tabelle',
    kopf: u.liste(k('freigabe_kopf')),
    zeilen: (((regel ? u.roh(k(`freigabe_zeilen_firma.${regel}`)) : undefined) ?? u.roh(k('freigabe_zeilen'))) as string[][]).map((z) => z.map((zelle) => md(zelle))),
    breiten: [40, 28, 32],
  });
  const freigabeBloecke = (): Block[] => [absatz(regel ? 'freigabe_text_firma' : 'freigabe_text'), freigabeTabelle()];
  const ueber = (nr: number, s: string): Block => ({ typ: 'ueberschrift', ebene: 1, text: `${nr} ${u.t(k(`abschnitte.${s}`))}` });
  const absatz = (s: string, werte?: Record<string, string>): Block => ({ typ: 'absatz', text: md(u.t(k(s), werte)) });
  const liste = (s: string): Block => ({ typ: 'liste', punkte: u.liste(k(s)).map((p) => md(p)) });
  // Festlegungen der Firma (organisation.dokumentenlenkung) als Zusatz zum Regeltext
  const zusatz = (s: string, wert: string | number | undefined, schluessel: string): Block[] =>
    wert === undefined || wert === '' ? [absatz(s)] : [{ typ: 'absatz', text: md(`${u.t(k(s))} ${u.t(k(schluessel), { wert: String(wert) })}`) }];
  const freigabe = (nr: number): Block[] => [
    ueber(nr, 'freigabe_regeln'),
    // Wer freigegeben hat, aus dem Dokumentenregister (N-37: Person statt «die AIMS-Verantwortung»)
    absatz('freigabe_regeln_text', {
      datum: datumOderPlatzhalter(h.dokEintrag(id)?.freigabe?.am),
      person: ((p) => (typeof p === 'string' ? p : `[[${p.map((l) => l.text).join('')}]]`))(h.personText(h.dokEintrag(id)?.freigabe?.von, 'freigabe')),
    }),
    // Bekannte Freigabe aus dem Dokumentenregister statt «Name, Funktion» (N-15)
    h.unterschriften([h.dokEintrag(id)?.freigabe]),
  ];

  let bloecke: Block[];
  if (eb) {
    const abschnitte = ergaenzungsAbschnitte(ctx, 'D-26-EB');
    const n = abschnitte.filter((b) => b.typ === 'ueberschrift').length;
    bloecke = [
      ...h.kitBlock(),
      h.normverweis('7.5, 6.3'),
      ...h.hinweis('ergaenzungsblaetter.hinweis'),
      // Firmendokument: bestehendes ISMS-Verfahren mit Kennung und Version aus dem Register (aufgenommenIn)
      {
        typ: 'absatz',
        text: h.istLeer
          ? u.t(k('eb_einleitung'))
          : h.dokEintrag('D-26-EB')?.aufgenommenIn?.trim()
            ? u.t(k('eb_einleitung_firma_dokument'), { firma: org.name, dokument: h.dokEintrag('D-26-EB')!.aufgenommenIn!.trim() })
            : u.t(k('eb_einleitung_firma'), { firma: org.name }),
      },
      ...abschnitte,
      // Freigaberegel für Dokumente des AIMS (mit ISMS sonst nicht festgelegt)
      { typ: 'ueberschrift', ebene: 1, text: `${n + 1} ${u.t(k('eb_freigabe'))}` },
      ...freigabeBloecke(),
      absatz('versionen_text'),
      ...(projekt.bibliothek?.ablage && !h.istLeer ? [absatz('ablage_bibliothek')] : []),
      { typ: 'ueberschrift', ebene: 1, text: `${n + 2} ${u.t(k('eb_aufbewahrung'))}` },
      ...zusatz(h.istLeer ? 'aufbewahrung_text' : 'aufbewahrung_text_firma', lenk?.aufbewahrungJahre, 'aufbewahrung_firma'),
      aufbewahrungTabelle(),
      ...freigabe(n + 3),
    ];
  } else {
    bloecke = [
      ...h.kitBlock(),
      h.normverweis('7.5, 6.3'),
      ...h.hinweis(k('hinweis_umfang')),
      { typ: 'absatz', text: h.istLeer ? md(u.t(k('einleitung'))) : u.t(k('einleitung_firma'), { firma: org.name }) },
      ueber(1, 'arten'),
      liste('arten_liste'),
      ueber(2, 'kennzeichnung'),
      absatz('kennzeichnung_text'),
      // Regel der Firma ohne Schlusspunkt; Version und Datum nennt bereits die Kennzeichnung, der Zusatz regelt nur den Vorrang
      lenk?.namensregel ? absatz('dateiname_firma', { regel: lenk.namensregel.trim().replace(/\.$/, '') }) : absatz('dateiname'),
      ueber(3, 'freigabe'),
      ...freigabeBloecke(),
      ueber(4, 'ablage'),
      absatz('ablage_text', { ort }),
      ...(projekt.bibliothek?.ablage && !h.istLeer ? [absatz('ablage_bibliothek')] : []),
      ueber(5, 'versionen'),
      absatz('versionen_text'),
      ueber(6, 'aufbewahrung'),
      ...zusatz(h.istLeer ? 'aufbewahrung_text' : 'aufbewahrung_text_firma', lenk?.aufbewahrungJahre, 'aufbewahrung_firma'),
      aufbewahrungTabelle(),
      ueber(7, 'extern'),
      ...zusatz('extern_text', lenk?.extern, 'extern_firma'),
      ueber(8, 'ki'),
      absatz('ki_text'),
      ueber(9, 'aenderungen'),
      absatz('aenderungen_text'),
      liste('aenderungen_liste'),
      absatz('aenderungen_ablage'),
      ...h.ausbau(k('ausbau'), []),
      ...freigabe(10),
    ];
  }

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: h.fusszeile(id) },
    lenkung: h.lenkung(id),
    eigenschaften: h.eigenschaften(id),
    bloecke,
  });
}

/** Registerkennung der Prozessdiagramme (Anlage zu D-27, Datei für draw.io) */
export const D27_ANLAGE = 'D-27-A';

export function d26Register(ctxRoh: VorlagenKontext): XlsxMappe {
  // Bibliothek (ab rc.10): Firmendokumente und eigene Dateien ohne Registereintrag als zusätzliche Zeilen; ohne Bibliothek unverändert
  const bib = ctxRoh.modus === 'leer' ? null : registerAusBibliothek(ctxRoh.projekt);
  const ctx = bib ? { ...ctxRoh, projekt: bib.projekt } : ctxRoh;
  const h = erstelleHelfer(ctx);
  const { u, projekt, kataloge } = ctx;
  const k = (s: string) => `vorlagen.D-26.register.${s}`;
  const liste = (s: string) => u.liste(k(`listen.${s}`));
  const jaNeinListe = [u.t('allgemein.ja'), u.t('allgemein.nein')];
  const jaNein = (b: boolean) => jaNeinListe[b ? 0 : 1]!;
  const text = (kopf: string, breite = 18, umbruch = true): XlsxSpalte => ({ kopf, breite, umbruch });
  const personName = (id?: string) => projekt.personen.find((p) => p.id === id)?.name ?? id ?? '';
  const eb = ctx.form === 'ergaenzungsblatt';
  const mitIsms = !h.istLeer && (projekt.meta.mitIsms || eb);
  const lenk = h.istLeer ? undefined : projekt.organisation.dokumentenlenkung;

  // Titel wie im Dokumentkopf aus dokumente.<id>.titel (N-17): Ergänzungsblätter mit «(Ergänzungsblatt)»,
  // Folgenabschätzungen D-09-<KI-ID> mit dem KI-System
  const titel = (id: string): string => {
    if (bib?.titel[id]) return bib.titel[id];
    if (id === D27_ANLAGE) return u.t(k('d27_anlage'), { datei: drawioDateiname(u) });
    const ia = /^D-09-(KI-\d+)$/.exec(id);
    if (ia) {
      const s = projekt.kiSysteme.find((x) => x.id === ia[1]);
      return `${u.t('dokumente.D-09.titel')} (${ia[1]}${s ? ` ${s.name}` : ''})`;
    }
    // Gleicher Titel wie im Dokumentkopf (generische Ergänzungsblätter wie D-03-EB mit eigenem Titel)
    return dokumentTitel(u, kataloge, id);
  };
  // Art: in der leeren Vorlage «Leitfaden» für die Leitfäden des Kits; im Firmendokument sind alle Einträge Dokumente
  const art = (id: string): string => {
    if (id === D27_ANLAGE) return liste('art')[1]!;
    const d = kataloge.dokumente.dokumente.find((x) => x.id === id.replace(/-EB$/, '').replace(/^(D-09)-KI-\d+$/, '$1'));
    return liste('art')[h.istLeer && d?.art === 'leitfaden' ? 2 : 0]!;
  };
  const artListe = h.istLeer ? liste('art') : liste('art').slice(0, 2);
  // Spalte «Gilt für ISMS» (Index 11) nur mit ISMS; Firmendokument ohne ISMS: entfällt
  const mitIsmsSpalte = h.istLeer || mitIsms;
  const ohneIsmsSpalte = <T>(z: T[]): T[] => (mitIsmsSpalte ? z : z.filter((_, i) => i !== 11));
  // Prüfung vor der Freigabe (DokumentEintrag.geprueft) und nächste Überprüfung der Leitlinie aus einer Quelle (D-03)
  const geprueft = (d: DokumentEintrag) => (d.geprueft?.von ? personName(d.geprueft.von) : '');
  const naechste = (d: DokumentEintrag) => (d.id === 'D-03' ? (projekt.organisation.leitlinie.naechsteUeberpruefung ?? d.naechsteUeberpruefung) : d.naechsteUeberpruefung) ?? '';

  // Kit-Liste: alle Vorlagen; mit ISMS die Ergänzungsblätter anstelle der eb-Vorlagen
  const kitListe = (): string[] => {
    const ebs = ergaenzungsblaetter(kataloge);
    return kataloge.dokumente.dokumente
      .filter((d) => h.istLeer || dokumentImProjekt(d, projekt.meta, projekt.prozesse !== undefined))
      .flatMap((d) => {
        if (!mitIsms) return [d.id];
        // Ergänzungsblatt mit eigener Form ersetzt das Dokument; sonst entstehen beide (z. B. D-07 und D-07-EB)
        if (d.eb) return NUR_ALS_EB_MIT_ISMS.has(d.id) ? [`${d.id}-EB`] : [d.id, `${d.id}-EB`];
        return [d.id, ...ebs.filter((b) => b.vorlage === d.id).map((b) => b.id)];
      });
  };

  // Register der Firma: Einträge aus dem Projekt, dazu (N-17) je Folgenabschätzung ein Dokument D-09-<KI-ID> mit Freigabe
  // aus der Abschätzung und im Pfad mit ISMS das Hauptdokument zu einem Ergänzungsblatt, wenn beide entstehen (z. B. D-07
  // neben D-07-EB) und nur eines registriert ist
  const registriert = new Set(projekt.dokumente.map((d) => d.id));
  const registerEintraege = (): DokumentEintrag[] =>
    projekt.dokumente.flatMap((d): DokumentEintrag[] => {
      if (/^D-09-KI-/.test(d.id) && registriert.has('D-09')) return [];
      if (d.id === 'D-09' && projekt.folgenabschaetzungen.length) {
        return projekt.kiSysteme
          .filter((s) => projekt.folgenabschaetzungen.some((f) => f.kiSystem === s.id))
          .map((s) => {
            const ia = projekt.folgenabschaetzungen.find((f) => f.kiSystem === s.id)!;
            const eigen = projekt.dokumente.find((x) => x.id === `D-09-${s.id}`);
            // Freigabe der aktuellen Version: letzte Neubeurteilung, sonst Abschätzung (wie im Dokumentkopf)
            const freigabe = h.dokFreigabe(`D-09-${s.id}`) ?? ia.freigabe ?? eigen?.freigabe;
            return {
              ...d,
              ...eigen,
              id: `D-09-${s.id}`,
              // Prüfung und Historie nur aus dem eigenen Eintrag, nicht vom Sammeleintrag D-09
              geprueft: eigen?.geprueft,
              aenderungen: eigen?.aenderungen,
              status: freigabe ? 'freigegeben' : (eigen?.status ?? d.status),
              ...(freigabe ? { freigabe } : {}),
              ...(ia.naechsteUeberpruefung ? { naechsteUeberpruefung: ia.naechsteUeberpruefung } : {}),
            } as DokumentEintrag;
          });
      }
      const haupt = d.id.replace(/-EB$/, '');
      if (mitIsms && d.id.endsWith('-EB') && !NUR_ALS_EB_MIT_ISMS.has(haupt) && !registriert.has(haupt) && kataloge.dokumente.dokumente.some((x) => x.id === haupt))
        return [{ ...d, id: haupt, aufgenommenIn: undefined }, d];
      // Prozessdiagramme (Datei für draw.io) als gelenkte Aufzeichnung zu D-27: gleiche Version, Prüfung und Freigabe
      if (d.id === 'D-27' && projekt.prozesse !== undefined) return [d, { ...d, id: D27_ANLAGE, aufgenommenIn: undefined, aenderungen: undefined }];
      return [d];
    });

  const dokZeilen: Zellwert[][] =
    !h.istLeer && projekt.dokumente.length
      ? registerEintraege().map((d) => [
          d.id,
          titel(d.id),
          art(d.id),
          d.version,
          u.t(k(`listen.status.${d.status}`)),
          personName(d.eigner),
          geprueft(d),
          personName(d.freigabe?.von),
          d.freigabe?.am ?? '',
          naechste(d),
          d.ablageort,
          jaNein(d.giltFuerIsms),
          d.klassifikation ?? lenk?.klassifikation ?? '',
          [
            d.aufbewahrung ? u.t(k('bemerkung_aufbewahrung'), { wert: d.aufbewahrung }) : '',
            d.aufgenommenIn ? u.t(k(d.id.endsWith('-EB') ? 'bemerkung_aufgenommen' : 'bemerkung_erweitert'), { wert: d.aufgenommenIn }) : '',
            // Bestätigt ohne Änderung (DokumentEintrag.bestaetigt), nicht vor der Freigabe der aktuellen Version
            d.bestaetigt?.am && (!d.freigabe?.am || d.bestaetigt.am >= d.freigabe.am)
              ? u.t(k('bemerkung_bestaetigt'), { person: personName(d.bestaetigt.von), datum: h.datum(d.bestaetigt.am) ?? d.bestaetigt.am })
              : '',
            // Bibliothek: Datei der Version (wenn der Ablageort sie nicht schon nennt) und neuere Version in Arbeit
            bib?.datei[d.id] && !d.ablageort.includes(bib.datei[d.id]!) ? u.t('bibliothek.register.bemerkung_datei', { pfad: bib.datei[d.id]! }) : '',
            bib?.inArbeit[d.id]
              ? u.t('bibliothek.register.bemerkung_in_arbeit', { version: bib.inArbeit[d.id]!.version, status: u.t(k(`listen.status.${statusFuerRegister(bib.inArbeit[d.id]!.status as never)}`)) })
              : '',
          ].filter(Boolean).join('; '),
        ])
      : kitListe().map((id) => {
          const dArt = kataloge.dokumente.dokumente.find((x) => x.id === id)?.art;
          const modul = h.istLeer && dArt === 'modul' ? u.t(k('modul')) : h.istLeer && dArt === 'modul_nist' ? u.t(k('modul_nist')) : '';
          return [id, titel(id), art(id), '', '', '', '', '', '', '', '', h.istLeer ? '' : jaNein(mitIsms), '', modul];
        });

  const sp = u.liste(k('spalten_dokumente'));
  const dokumente: XlsxBlatt = {
    name: u.t(k('blaetter.dokumente')),
    titel: u.t(k('titel_dokumente')),
    hinweise: h.istLeer ? u.liste(k('hinweise_dokumente')) : undefined,
    fixiert: true,
    spalten: ohneIsmsSpalte<XlsxSpalte>([
      text(sp[0]!, 10, false),
      text(sp[1]!, 40),
      { kopf: sp[2]!, breite: 13, typ: 'liste', liste: artListe },
      text(sp[3]!, 8, false),
      { kopf: sp[4]!, breite: 13, typ: 'liste', liste: Object.values(u.roh(k('listen.status')) as Record<string, string>) },
      text(sp[5]!, 18),
      text(sp[6]!, 18),
      text(sp[7]!, 18),
      { kopf: sp[8]!, breite: 12, typ: 'datum' },
      { kopf: sp[9]!, breite: 12, typ: 'datum' },
      text(sp[10]!, 24),
      { kopf: sp[11]!, breite: 10, typ: 'liste', liste: jaNeinListe },
      { kopf: sp[12]!, breite: 13, typ: 'liste', liste: liste('klassifikation') },
      text(sp[13]!, 24),
    ]),
    zeilen: dokZeilen.map((z) => ohneIsmsSpalte(z)),
    leereZeilen: 10,
  };

  // Änderungshistorie je Dokument (dokumente[].aenderungen): Version, Datum, Änderung, Freigabe
  const spAe = u.liste(k('spalten_aenderungen'));
  // Je Dokument des Registers mindestens eine Zeile: Einträge ohne Historie mit der aktuellen Version (Erstfassung);
  // ein Ergänzungsblatt, dessen Hauptdokument nur über das Ergänzungsblatt registriert ist (z. B. D-07 neben D-07-EB),
  // verweist auf die Historie des Hauptdokuments, statt sie zu wiederholen
  const eintraege = h.istLeer ? [] : registerEintraege();
  const abgeleitet = new Set(eintraege.filter((d) => !registriert.has(d.id) && registriert.has(`${d.id}-EB`)).map((d) => d.id));
  const aenderungZeilen: Zellwert[][] = eintraege.flatMap((d): Zellwert[][] => {
    const von = (a?: { von?: string; version: string }) => personName(a?.von ?? (!a || a.version === d.version ? d.freigabe?.von : undefined));
    const haupt = d.id.replace(/-EB$/, '');
    // je Version des Hauptdokuments eine Zeile, damit jede zitierte Fassung des Ergänzungsblatts belegt ist
    if (d.id.endsWith('-EB') && abgeleitet.has(haupt)) {
      const versionen = h.aenderungen(d.id);
      return versionen.length
        ? versionen.map((a) => [d.id, titel(d.id), a.version, a.datum, u.t(k('aenderung_eb_zum_haupt'), { id: haupt }), von(a)])
        : [[d.id, titel(d.id), d.version, d.freigabe?.am ?? '', u.t(k('aenderung_eb_zum_haupt'), { id: haupt }), von()]];
    }
    const liste = h.aenderungen(d.id);
    if (liste.length) return liste.map((a) => [d.id, titel(d.id), a.version, a.datum, h.rollenText(a.was), von(a)]);
    if (!d.freigabe?.am) return [];
    return [[d.id, titel(d.id), d.version, d.freigabe.am, u.t(k(d.version === '1.0' ? 'aenderung_erstfassung' : 'aenderung_ohne_historie')), von()]];
  });
  const aenderungen: XlsxBlatt = {
    name: u.t(k('blaetter.aenderungen')),
    titel: u.t(k('titel_aenderungen')),
    hinweise: h.istLeer ? u.liste(k('hinweise_aenderungen')) : undefined,
    fixiert: true,
    spalten: [text(spAe[0]!, 10, false), text(spAe[1]!, 36), text(spAe[2]!, 8, false), { kopf: spAe[3]!, breite: 12, typ: 'datum' }, text(spAe[4]!, 60), text(spAe[5]!, 18)],
    zeilen: aenderungZeilen,
    leereZeilen: h.istLeer ? 15 : 5,
  };

  // Vorschläge gelten als Festlegung, sobald das Register freigegeben ist (ohne Markierung «[...]»)
  const festgelegt = !h.istLeer && h.dokEintrag(eb ? 'D-26-EB' : 'D-26')?.status === 'freigegeben';
  const zelle = (s: string) => (festgelegt ? klartext(md(s)).replace(/^\[[^\]]+\]$/, '') : klartext(md(s)));
  const spA = u.liste(k('spalten_aufzeichnungen'));
  // Ablageort und Verantwortliche aus dem Dokumentenregister der Vorlage, in der die Aufzeichnung entsteht
  const ausDokument = (ids: string) => (h.istLeer ? undefined : h.dokEintrag(ids.split(',')[0]!.trim()));
  // Untersagte Systeme ohne Betrieb erzeugen keine Protokolle (keine Zeile «technisch geschützt»)
  const systemeMitProtokoll = h.istLeer ? [] : projekt.kiSysteme.filter((x) => x.protokollierung && x.status !== 'abgeloest' && x.status !== 'untersagt');
  const aufzeichnungZeilen: Zellwert[][] = (u.roh(k('aufzeichnungen_vorschlag')) as string[][]).flatMap((z, i, alle): Zellwert[][] => {
    const letzte = i === alle.length - 1; // Ereignisprotokolle: je System eine Zeile
    if (letzte && systemeMitProtokoll.length)
      return systemeMitProtokoll.map((x) => [`${z[0]!}: ${x.id} ${x.name}`, x.protokollierung!, z[2]!, '', z[4]!, u.t(k('protokolle_wie_beschrieben')), personName(x.eigner)]);
    const d = ausDokument(z[2]!);
    // Aufbewahrung aus dem Dokumentenregister, wenn festgelegt (N-27)
    return [[zelle(z[0]!), zelle(z[1]!), z[2]!, d?.ablageort ?? '', zelle(z[4]!), d?.aufbewahrung?.trim() || zelle(z[5]!), personName(d?.eigner)]];
  });
  const aufzeichnungen: XlsxBlatt = {
    name: u.t(k('blaetter.aufzeichnungen')),
    titel: u.t(k('titel_aufzeichnungen')),
    hinweise: h.istLeer ? u.liste(k('hinweise_aufzeichnungen')) : undefined,
    fixiert: true,
    spalten: [text(spA[0]!, 34), text(spA[1]!, 22), text(spA[2]!, 12), text(spA[3]!, 24), text(spA[4]!, 20), text(spA[5]!, 26), text(spA[6]!, 18)],
    zeilen: aufzeichnungZeilen,
    leereZeilen: 8,
  };

  const spE = u.liste(k('spalten_extern'));
  const extern: XlsxBlatt = {
    name: u.t(k('blaetter.extern')),
    titel: u.t(k('titel_extern')),
    hinweise: h.istLeer ? u.liste(k('hinweise_extern')) : undefined,
    fixiert: true,
    spalten: [text(spE[0]!, 40), text(spE[1]!, 20), text(spE[2]!, 18), text(spE[3]!, 24), text(spE[4]!, 18), { kopf: spE[5]!, breite: 13, typ: 'datum' }],
    // Register der Firma (dokumentenlenkung.externeDokumente, N-35), sonst Vorschlag mit dem Rechtsstand des AI Act
    // aus src/ai-act/stand.yaml (N-24)
    zeilen:
      !h.istLeer && lenk?.externeDokumente?.length
        ? lenk.externeDokumente.map((e) => [e.dokument, e.herausgeber, e.stand.replace('{rechtsstand}', h.rechtsstand()), e.ablage, personName(e.zustaendig), e.naechstePruefung ?? ''])
        : // Vorschlag; im Firmendokument mit Ablage, Zuständigkeit (AIMS-Verantwortung) und nächster Prüfung (Überprüfung von D-26)
          (u.roh(k('extern_vorschlag')) as string[][]).map((z) => {
            const zeile: Zellwert[] = z.map((x) => zelle(x.replace('{rechtsstand}', h.rechtsstand())));
            if (h.istLeer) return zeile;
            const d26 = h.dokEintrag(eb ? 'D-26-EB' : 'D-26');
            return [zeile[0]!, zeile[1]!, zeile[2]!, lenk?.ablage || d26?.ablageort || '', personName(projekt.organisation.aimsVerantwortlich), d26?.naechsteUeberpruefung ?? ''];
          }),
    leereZeilen: 8,
  };

  // Register der Nachweise (projekt.nachweise): die Kennungen N-001 ff., auf die SoA, Checkliste und Dokumente verweisen.
  // Dreistellige Nummern; die Dokumente des Moduls NIST AI RMF tragen zweistellige IDs (N-01 bis N-04).
  const spN = u.liste(k('spalten_nachweise'));
  const nachweisZeilen: Zellwert[][] = h.istLeer
    ? []
    : [...projekt.nachweise]
        .sort((a, b) => a.id.localeCompare(b.id, 'de', { numeric: true }))
        .map((n) => {
          // Nachweis in der Bibliothek: Register nennt die Datei neben dem Ablageort (Regel in Abschnitt 5)
          const datei = neuesteDatei(ctx.projekt, n.id);
          return [n.id, n.titel, u.tOpt(`gefuehrt.optionen.nachweisArt.${n.art}`) ?? n.art, n.datum ?? '', datei ? `${n.ablageort}; ${u.t('bibliothek.register.bemerkung_datei', { pfad: datei })}` : n.ablageort];
        });
  const nachweise: XlsxBlatt = {
    name: u.t(k('blaetter.nachweise')),
    titel: u.t(k('titel_nachweise')),
    hinweise: u.liste(k(h.istLeer ? 'hinweise_nachweise' : projekt.meta.modulNistRmf ? 'hinweise_nachweise_nist' : 'hinweise_nachweise_firma')),
    fixiert: true,
    spalten: [text(spN[0]!, 9, false), text(spN[1]!, 50), text(spN[2]!, 14), { kopf: spN[3]!, breite: 12, typ: 'datum' }, text(spN[4]!, 36)],
    zeilen: nachweisZeilen,
    leereZeilen: h.istLeer ? 20 : 3,
  };

  const id = eb ? 'D-26-EB' : 'D-26';
  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    eigenschaften: h.eigenschaften(id),
    lenkung: h.lenkung(id),
    firmenname: h.firmenname(),
    hinweisBlock: [...h.kitBlock(), h.normverweis('7.5, 6.3')],
    blaetter: [dokumente, aenderungen, aufzeichnungen, nachweise, extern],
  });
}
