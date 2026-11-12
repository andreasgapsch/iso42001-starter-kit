import { registerAusProjekt } from '../bibliothek/freigabe-stand.ts';
// Gemeinsame Bausteine aller Vorlagen. Eine Vorlage ist eine Funktion (ctx) => DocxDokument | XlsxMappe.
// Modi:
//  leer     leere Vorlage im Kit: Platzhalter, Ausfüllhinweise, Namensnennungsblock auf Seite 1
//  firma    vom Werkzeug oder Skill erzeugtes Firmendokument: keine Kit-Hinweise, Hinweise nur bei fehlenden Angaben
//  beispiel wie firma, mit Kennzeichnung «Beispiel aus dem Starter-Kit»
import type { Block, DocxDokument, Lauf, Lenkungsangaben, Text, XlsxMappe } from '../generator/ir.ts';
import type { Uebersetzer } from '../i18n/texte.ts';
import type { Kataloge } from '../kataloge/typen.ts';
import { dokument } from '../kataloge/typen.ts';
import type { Aenderung, ControlStatus, DokumentEintrag, Freigabe, Massnahme, Person, Projekt } from '../model/typen.ts';
import { hatNormtext, idsAusNormbezug, normEintrag, normText, type NormQuelle } from '../normtexte/aufloesung.ts';
import type { NormTeil, NormtexteLaufzeit } from '../normtexte/typen.ts';
import { vermerkText } from '../normtexte/vermerk.ts';

export type Modus = 'leer' | 'firma' | 'beispiel';
export type Form = 'dokument' | 'ergaenzungsblatt';

export interface VorlagenKontext {
  u: Uebersetzer;
  modus: Modus;
  form: Form;
  projekt: Projekt;
  kataloge: Kataloge;
  kitVersion: string;
  /** Für je-System-Vorlagen (D-09): das betroffene KI-System */
  kiSystemId?: string;
  /** Prozessbeschreibung (D-27) für einen einzelnen Prozess statt des Prozesshandbuchs */
  prozessId?: string;
  /**
   * Normtexte aus der eigenen Normausgabe der Firma: nur Laufzeitparameter des Generators im Werkzeug und nur nach der
   * Bestätigung «Unsere Lizenz erlaubt die Übernahme in interne Dokumente». Nie im Projekt, nie in leeren Vorlagen.
   */
  normtexte?: NormtexteLaufzeit;
  /** IDs, deren Normtext ins Dokument übernommen wurde (für den Quellenvermerk) */
  normGenutzt?: Set<string>;
}

export type Vorlage = (ctx: VorlagenKontext) => DocxDokument | XlsxMappe;

/**
 * Seitenlimit bei vielen KI-Systemen: Ab so vielen Zeilen stehen Tabellen und Listen mit einer Zeile je KI-System in
 * Firmendokumenten (DOCX) in einer Anlage am Dokumentende; im Text steht ein Verweis.
 */
export const ANLAGE_AB_SYSTEMEN = 8;

/**
 * Vorlagen mit eigener Ergänzungsblatt-Form: Im Pfad mit ISMS erhält die Firma nur das Blatt D-xx-EB, kein
 * eigenes Dokument D-xx. Muss mit EIGENE_EB_FORM in index.ts übereinstimmen (Test firmendokumente-kittexte);
 * hier eigene Kopie, weil index.ts alle Vorlagen lädt und kontext.ts sonst zirkulär importieren würde.
 */
export const NUR_ALS_EB_MIT_ISMS = new Set(['D-04', 'D-06', 'D-10', 'D-14', 'D-15', 'D-16', 'D-17', 'D-20', 'D-21', 'D-22', 'D-26']);

/**
 * Titel eines Dokuments nach Register-ID, eine Quelle für Dokumentkopf, Dateieigenschaften, Register (D-26), Dokumentenliste
 * und 27001-Brücke: Ergänzungsblätter mit eigener Form (D-04-EB) heissen wie ihre Vorlage mit Zusatz «(Ergänzungsblatt)»,
 * generische Blätter (D-03-EB) tragen ihren eigenen Titel; Folgenabschätzungen D-09-KI-xxx den Titel von D-09.
 */
export function dokumentTitel(u: Pick<Uebersetzer, 't' | 'tOpt'>, kataloge: Kataloge, id: string): string {
  const basis = id.replace(/-EB$/, '').replace(/^(D-09)-KI-\d+$/, '$1');
  const titel = u.tOpt(`dokumente.${basis}.titel`) ?? basis;
  if (!id.endsWith('-EB')) return titel;
  const generisch = !NUR_ALS_EB_MIT_ISMS.has(basis) && ((kataloge['ergaenzungsblaetter'] as { blaetter?: { id: string }[] } | undefined)?.blaetter ?? []).some((b) => b.id === id);
  return (generisch ? u.tOpt(`ergaenzungsblaetter.blaetter.${id}.titel`) : undefined) ?? `${titel} (${u.t('allgemein.ergaenzungsblatt')})`;
}

/** Wandelt einfache Auszeichnung in Läufe: **fett** und [[Platzhalter]]. */
export function md(text: string): Text {
  if (!/\*\*|\[\[/.test(text)) return text;
  const laeufe: Lauf[] = [];
  const muster = /\*\*(.+?)\*\*|\[\[(.+?)\]\]/g;
  let pos = 0;
  for (const m of text.matchAll(muster)) {
    if (m.index! > pos) laeufe.push({ text: text.slice(pos, m.index) });
    if (m[1] !== undefined) laeufe.push({ text: m[1], fett: true });
    else laeufe.push({ text: m[2]!, platzhalter: true });
    pos = m.index! + m[0].length;
  }
  if (pos < text.length) laeufe.push({ text: text.slice(pos) });
  return laeufe;
}

/** Text als reiner String (für XLSX-Zellen): Auszeichnung entfernen, Platzhalter in eckigen Klammern. */
export function klartext(text: Text): string {
  if (typeof text === 'string') return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[\[(.+?)\]\]/g, '[$1]');
  return text.map((l) => (l.platzhalter ? `[${l.text}]` : l.text)).join('');
}

export function leer(wert: unknown): boolean {
  return wert === undefined || wert === null || (typeof wert === 'string' && wert.trim() === '') || (Array.isArray(wert) && wert.length === 0);
}

/** Normbezüge aus den Katalogen sind deutsch notiert («6.1.1 bis 6.1.3, Anhang A»); für EN übertragen */
/**
 * Normstelle mit dem richtigen Wort: «Abschnitt 5.3», «Abschnitte 6.1.1 bis 6.1.3, 8.2», bei Controls «Control A.5.2»
 * (EN «clause», «clauses», «control», «controls»). Angaben wie «Anhang A» oder «4 bis 10 und Anhang A» bleiben Abschnitte.
 */
export function normStelle(text: string, sprache: 'de' | 'en'): string {
  const [ein, viele, ctrl, ctrls, und] = sprache === 'de' ? ['Abschnitt', 'Abschnitte', 'Control', 'Controls', 'und'] : ['clause', 'clauses', 'control', 'controls', 'and'];
  const teile = text.split(/,\s*/).map((x) => x.trim()).filter(Boolean);
  const istCtrl = (x: string) => /^A\.\d/.test(x);
  const klauseln = teile.filter((x) => !istCtrl(x));
  const controls = teile.filter(istCtrl);
  const mehr = (l: string[]) => l.length > 1 || /\b(?:bis|to|und|and)\b/.test(l[0] ?? '');
  const a = klauseln.length ? `${mehr(klauseln) ? viele : ein} ${klauseln.join(', ')}` : '';
  const c = controls.length ? `${mehr(controls) ? ctrls : ctrl} ${controls.join(', ')}` : '';
  return a && c ? `${a} ${und} ${c}` : a || c;
}

export function normbezugSprache(text: string, sprache: 'de' | 'en'): string {
  if (sprache === 'de') return text;
  return text
    .replace(/\bbis\b/g, 'to')
    .replace(/\bund\b/g, 'and')
    .replace(/\bAnhang\b/g, 'Annex')
    .replace(/\bAnhänge\b/g, 'Annexes')
    .replace(/\bKapitel\b/g, 'clause')
    .replace(/\bZertifizierung\b/g, 'certification')
    .replace(/\balle\b/g, 'all')
    .replace(/\bNr\. /g, 'point ');
}

export const PLAN_VOR = /(?:Freigabe von|Entwurf von|Einführung von|Prozesssystem mit|approval of|draft of|introduction of|process system with|[Ii]ntroduce [^,.;]{0,40}) $/;
export const PLAN_NACH = /^(?: und [^,.;]{0,60})? (?:einführen|erarbeiten|freigeben)|^ (?:to be )?(?:introduced?|approved?|prepared?)\b/;

export function erstelleHelfer(ctx: VorlagenKontext) {
  const { u, modus, projekt, kataloge } = ctx;
  const istLeer = modus === 'leer';

  // Normtexte der Firma: nur in Firmendokumenten und nur, wenn der Generator sie nach der Bestätigung mitgibt
  const normTeile: readonly NormTeil[] | undefined = !istLeer && ctx.normtexte?.teile.length ? ctx.normtexte.teile : undefined;
  const normQuelle: NormQuelle = { teile: normTeile, eigen: (s) => u.tOpt(s) };
  const merkeNorm = (id: string): void => void (ctx.normGenutzt ??= new Set()).add(id);
  /** Titel eines Abschnitts (K-6.1.2), Controls (A.5.2, 27001-5.1) oder einer Gruppe: Normtitel, sonst eigener Kurztitel */
  const normTitel = (id: string): string => {
    if (normTeile && hatNormtext(normTeile, id, 'titel', u.sprache)) merkeNorm(id);
    return normText(normQuelle, id, 'titel', u.sprache) ?? '';
  };
  /** Anforderungs- oder Control-Text nur aus der Normausgabe der Firma (nie Ersatz durch die eigene Erläuterung) */
  const normAnforderung = (id: string): string | undefined => {
    const t = normEintrag(normTeile, id, u.sprache)?.eintrag.text;
    if (t) merkeNorm(id);
    return t || undefined;
  };
  const mitNormtext = !!normTeile;

  /** Wert aus dem Projekt oder Platzhalter (Text aus allgemein.platzhalter.<schluessel>) */
  const wert = (v: unknown, platzhalterSchluessel: string): Text => {
    if (!istLeer && !leer(v)) return String(v);
    return [{ text: u.t(`allgemein.platzhalter.${platzhalterSchluessel}`), platzhalter: true }];
  };

  const person = (id: string | undefined): Person | undefined => projekt.personen.find((p) => p.id === id);
  const personText = (id: string | undefined, platzhalter = 'person'): Text => {
    const p = person(id);
    return wert(p ? `${p.name}${p.funktion ? `, ${p.funktion}` : ''}` : id, platzhalter);
  };
  const datum = (iso: string | undefined): string | undefined => {
    if (!iso) return undefined;
    const [j, m, t] = iso.slice(0, 10).split('-');
    return u.sprache === 'de' ? `${t}.${m}.${j}` : `${t}/${m}/${j}`;
  };

  /** Ausfüllhinweis: in leeren Vorlagen immer; in Firmendokumenten nur, wenn erzwungen (z. B. Angaben fehlen). */
  const hinweis = (schluessel: string, erzwingen = false): Block[] =>
    istLeer || erzwingen ? [{ typ: 'hinweis', art: 'ausfuellhinweis', text: md(u.t(schluessel)) }] : [];

  /** Firmendokument: einzeln genannte Controls, die in der Erklärung zur Anwendbarkeit ausgeschlossen sind, entfallen im Normbezug */
  const ohneAusgeschlossene = (text: string): string =>
    istLeer
      ? text
      : text
          .split(/,\s*/)
          .filter((t) => !(/^A\.\d+(\.\d+)+$/.test(t.trim()) && projekt.controls.find((c) => c.id === t.trim())?.anwendbar === 'nein'))
          .join(', ');
  const normverweis = (abschnitte: string): Block => ({
    typ: 'hinweis',
    art: 'normverweis',
    // Quelle auch für den Normbezug im Kopf (normbezugVereinheitlichen); in Firmendokumenten entfällt der Kasten
    normbezug: abschnitte,
    // Bezugsquelle der Norm nur in der leeren Vorlage (Hinweis an Ausfüllende)
    text: u.t(istLeer ? 'allgemein.normverweis' : 'allgemein.normverweis_firma', { abschnitte: normStelle(normbezugSprache(ohneAusgeschlossene(abschnitte), u.sprache), u.sprache) }),
  });

  /**
   * Ausbaustufe: In der leeren Vorlage mit Kasten «Ausbaustufe (optional)» und Anleitung. Firmendokumente enthalten keine
   * Anleitung: Der Kasten entfällt, die Blöcke der Ausbaustufe (Inhalte der Firma) bleiben.
   */
  const ausbau = (titelSchluessel: string, bloecke: Block[]): Block[] =>
    istLeer
      ? [
          // Die Kennzeichnung «Ausbaustufe (optional)» setzt der Generator selbst
          { typ: 'hinweis', art: 'ausbau', text: md(u.t(titelSchluessel)) },
          ...bloecke,
        ]
      : bloecke;

  /** Namensnennung (nur leere Vorlagen) bzw. Beispielkennzeichnung (nur Beispiele). Firmendokumente: nichts. */
  const kitBlock = (): Block[] => {
    if (modus === 'leer')
      return [{ typ: 'hinweis', art: 'namensnennung', text: u.t('allgemein.namensnennung_vorlage', { version: ctx.kitVersion }) }];
    if (modus === 'beispiel') return [{ typ: 'hinweis', art: 'beispiel', text: u.t('allgemein.beispiel_kennzeichnung') }];
    return [];
  };

  const firmenname = (): Text => wert(projekt.organisation.name, 'firmenname');

  /**
   * Eintrag im Dokumentenregister. Hauptvorlage und Ergänzungsblatt teilen sich einen Eintrag, wenn nur einer
   * erfasst ist (z. B. D-07 im Pfad mit ISMS als D-07-EB): erst die genaue ID, dann die andere Form.
   */
  const dokEintrag = (id: string): DokumentEintrag | undefined => {
    const andere = id.endsWith('-EB') ? id.slice(0, -3) : `${id}-EB`;
    const eigen = projekt.dokumente.find((d) => d.id === id);
    if (eigen) return eigen;
    // Ohne eigene Registerzeile zählt die Freigabe aus den Projektdaten (Leitlinie D-03), nicht das Ergänzungsblatt D-03-EB (C2-08)
    const blatt = projekt.dokumente.find((d) => d.id === andere);
    return blatt && !id.endsWith('-EB') ? (registerAusProjekt(projekt, id) ?? blatt) : blatt;
  };

  /** Änderungshistorie eines Dokuments (dokumente[].aenderungen), älteste zuerst; leere Vorlage: keine */
  const aenderungen = (id: string): Aenderung[] =>
    istLeer ? [] : [...(dokEintrag(id)?.aenderungen ?? [])].sort((a, b) => a.datum.localeCompare(b.datum) || a.version.localeCompare(b.version));

  /**
   * Ohne Eintrag im Register: Freigabe und Eigner aus den Projektdaten, wo das Projekt sie selbst erfasst (Projektauftrag,
   * Geltungsbereich, KI-Leitlinie). Nur Firmendokumente; ein Eintrag im Register geht immer vor.
   */
  const ausProjekt = (id: string): { freigabe?: Freigabe; eigner?: string; version?: string } | undefined => {
    if (istLeer || projekt.dokumente.some((d) => d.id === id)) return undefined;
    const org = projekt.organisation;
    if (id === 'D-00') return { freigabe: org.projektauftrag?.freigabe, eigner: org.projektauftrag?.sponsor ?? org.aimsVerantwortlich };
    if (id === 'D-02') return { freigabe: org.geltungsbereich.freigabe, eigner: org.aimsVerantwortlich };
    if (id === 'D-03') return { freigabe: org.leitlinie.freigabe, eigner: org.aimsVerantwortlich, version: org.leitlinie.version?.trim() || undefined };
    return undefined;
  };

  /**
   * Freigabe eines Dokuments: Eintrag im Register, sonst die Freigabe in den Projektdaten (ausProjekt); für
   * Folgenabschätzungen D-09-<KI-ID> ohne eigene Freigabe die letzte Freigabe der Abschätzung (Neubeurteilung oder erste
   * Freigabe).
   */
  const dokFreigabe = (id: string): Freigabe | undefined => {
    const e = dokEintrag(id)?.freigabe ?? ausProjekt(id)?.freigabe;
    if (e?.am) return e;
    const ia = /^D-09-(KI-\d+)$/.exec(id);
    if (!ia) return e;
    const f = projekt.folgenabschaetzungen.find((x) => x.kiSystem === ia[1]);
    const neu = [...(f?.neubeurteilungen ?? [])].filter((n) => n.freigabe?.am).sort((a, b) => a.am.localeCompare(b.am)).at(-1)?.freigabe;
    return neu ?? f?.freigabe;
  };

  /** Datum der ersten Freigabe: ältester Eintrag der Änderungshistorie, sonst Freigabe der aktuellen Version */
  const ersteFreigabe = (id: string): string | undefined => {
    const ia = /^D-09-(KI-\d+)$/.exec(id);
    const ersteIa = ia ? projekt.folgenabschaetzungen.find((x) => x.kiSystem === ia[1])?.freigabe?.am : undefined;
    return [...aenderungen(id).map((a) => a.datum), ersteIa, dokFreigabe(id)?.am].filter((d): d is string => !!d).sort()[0];
  };

  /** Klassifikation des Dokuments, sonst Standard der Dokumentenlenkung, sonst Platzhalter */
  const klassifikation = (id: string): Text => wert(dokEintrag(id)?.klassifikation ?? projekt.organisation.dokumentenlenkung?.klassifikation, 'klassifikation');

  /** Fusszeile «Klassifikation: …» für DOCX-Vorlagen */
  const fusszeile = (id: string): Text => {
    const kl = klassifikation(id);
    return md(u.t('allgemein.fusszeile', { klassifikation: typeof kl === 'string' ? kl : `[[${kl.map((l) => l.text).join('')}]]` }));
  };

  /** Meldestelle für Texte in Richtlinien und Verfahren (organisation.meldestelle), sonst Platzhalter */
  const meldestelle = (): Text => wert(projekt.organisation.meldestelle, 'meldestelle');

  /**
   * Rollen-IDs (RO-xxx, auch «RO-011 bis RO-016») in Texten durch den Bereich der Zuständigkeitsmatrix ersetzen: D-04 führt
   * die Rollen nach Bereich, nicht nach ID, damit sind Verweise im Dokumentkopf und im Register auflösbar.
   */
  const rollenText = (text: string): string => {
    if (istLeer || !/\bRO-\d{3}\b/.test(text)) return text;
    const bereich = (rid: string) => {
      const r = projekt.rollen.find((x) => x.id === rid);
      return r ? (u.tOpt(`gefuehrt.optionen.rollenBereich.${r.bereich}`) ?? r.bereich) : rid;
    };
    return text
      .replace(/\bRO-(\d{3}) (?:bis|to) RO-(\d{3})\b/g, (treffer, von: string, bis: string) => {
        const ids = projekt.rollen.map((r) => r.id).filter((rid) => rid >= `RO-${von}` && rid <= `RO-${bis}`);
        return ids.length ? ids.map(bereich).join(', ') : treffer;
      })
      .replace(/\bRO-\d{3}\b/g, bereich);
  };

  /** Status einer Massnahme zu einem Stichtag: erst danach erledigt heisst an diesem Tag noch in Arbeit (oder offen vor dem Start) */
  const massnahmeStatusAm = (m: Massnahme, stichtag: string | undefined): Massnahme['status'] => {
    if (!stichtag || m.status !== 'erledigt' || !m.erledigtAm || m.erledigtAm <= stichtag) return m.status;
    return m.start && m.start <= stichtag ? 'in-arbeit' : 'offen';
  };

  /** Datum der Bestätigung ohne Änderung (DokumentEintrag.bestaetigt), wenn es nicht vor der Freigabe der aktuellen Version liegt */
  const bestaetigtAm = (id: string): string | undefined => {
    const b = istLeer ? undefined : dokEintrag(id)?.bestaetigt?.am;
    const f = dokFreigabe(id)?.am;
    return b && (!f || b >= f) ? b : undefined;
  };
  /** Stand des Inhalts: Freigabe der aktuellen Version oder spätere Bestätigung ohne Änderung */
  const standDatum = (id: string): string | undefined => bestaetigtAm(id) ?? dokFreigabe(id)?.am;

  /** Bezug zum ISMS im Kopf: mit Eintrag «aufgenommen in» das ISMS-Dokument mit Kennung und Version */
  const ismsBezug = (id: string, art: string): string => {
    const dok = istLeer ? undefined : dokEintrag(id)?.aufgenommenIn?.trim();
    const wie = id.endsWith('-EB') && art === 'neu' ? 'erweitert' : art;
    if (dok && (wie === 'erweitert' || wie === 'wiederverwendet')) return u.t(`allgemein.isms_dokument.${wie}`, { dokument: dok });
    // Firmendokument ohne Angabe, welches ISMS-Dokument es erweitert oder nutzt: kein allgemeiner Satz (Zeile entfällt)
    if (!istLeer && (wie === 'erweitert' || wie === 'wiederverwendet')) return '';
    return u.t(`allgemein.isms.${wie}`);
  };

  /**
   * Normbezug im Dokumentkopf: Abschnitte aus dem Normverweis des Dokuments (dieselbe Quelle wie der Kasten), sonst aus dem
   * Dokumentenkatalog. Dokumente der Module nennen zuerst ihren Rechtstext (AI Act, NIST) und danach die Abschnitte der Norm.
   */
  const normbezugKopf = (katalog: string, abschnitte?: string): string => {
    const iso = abschnitte ? `ISO/IEC 42001: ${ohneAusgeschlossene(abschnitte)}` : undefined;
    if (katalog.startsWith('AI Act')) {
      const ai = katalog.replace('AI Act', u.t('allgemein.ai_act_kurz'));
      return normbezugSprache(iso ? `${ai}; ${iso}` : ai, u.sprache);
    }
    if (katalog.startsWith('NIST')) return normbezugSprache(iso ? `${katalog.replace(/,\s*ISO\/IEC 42001$/, '')}; ${iso}` : katalog, u.sprache);
    return normbezugSprache(iso ?? `ISO/IEC 42001: ${ohneAusgeschlossene(katalog)}`, u.sprache);
  };

  const lenkung = (id: string): Lenkungsangaben => {
    const d = dokument(kataloge, id.replace(/-EB$/, ''));
    const e = dokEintrag(id);
    const eb = ctx.form === 'ergaenzungsblatt';
    // Ohne Registereintrag: Freigabe, Eigner und Version aus den Projektdaten (z. B. Freigabe der Leitlinie in E3)
    const pr = e ? undefined : ausProjekt(id);
    const freigabe = e?.freigabe ?? pr?.freigabe;
    // Noch nirgends freigegeben: im Firmendokument steht ehrlich «Entwurf» mit der Entwurfsnummer (C-11), kein leerer Platzhalter
    const ohneAngabe = ctx.modus === 'firma' && !istLeer && !e && !freigabe?.am;
    const nichtFreigegeben = !istLeer && ((!!e && !e.freigabe?.von && e.status !== 'freigegeben') || ohneAngabe);
    const entwurfNummer = ohneAngabe ? (pr?.version ?? projekt.bibliothek?.eintraege.find((x) => x.id === id)?.versionen.at(-1)?.version ?? '0.1') : undefined;
    return {
      dokumentId: id,
      titel: dokumentTitel(u, kataloge, eb && !id.endsWith('-EB') ? `${id}-EB` : id),
      version: wert(e?.version ?? entwurfNummer ?? pr?.version, 'version'),
      // Eigner: im Register, sonst aus den Projektdaten, sonst die AIMS-Verantwortung als Vorschlag der Lenkung
      eigner: personText(e?.eigner ?? pr?.eigner ?? (ctx.modus === 'firma' && !istLeer ? projekt.organisation.aimsVerantwortlich : undefined), 'eigner'),
      // Firmendokument im Register, aber (noch) nicht freigegeben: Status statt Platzhalter, Datum entfällt (N-15)
      freigabeDurch: nichtFreigegeben
        ? u.t('allgemein.lenkung.nicht_freigegeben', { status: u.tOpt(`gefuehrt.optionen.dokumentStatus.${e?.status ?? 'entwurf'}`) ?? e?.status ?? 'entwurf' })
        : personText(freigabe?.von, 'freigabe'),
      datum: nichtFreigegeben ? '' : wert(datum(freigabe?.am), 'datum'),
      // Zweite Person vor der Freigabe (D-26) und letzte Änderung (Historie mit mehr als einer Version)
      // Leere Vorlage: Zeilen mit Platzhaltern, damit auch der Weg nur mit Word und Excel zu einem Prüfvermerk führt (D-26)
      geprueftDurch: istLeer ? [{ text: u.t('allgemein.platzhalter.pruefvermerk'), platzhalter: true }] : e?.geprueft?.von ? u.t('allgemein.lenkung.geprueft', { person: klartext(personText(e.geprueft.von)), datum: datum(e.geprueft.am) ?? '' }) : '',
      aenderung: istLeer ? [{ text: u.t('allgemein.platzhalter.aenderung'), platzhalter: true }] : ((liste) => {
        const a = liste.at(-1);
        return liste.length > 1 && a ? u.t('allgemein.lenkung.aenderung', { version: a.version, datum: datum(a.datum) ?? '', was: rollenText(a.was.trim().replace(/\.$/, '')) }) : '';
      })(aenderungen(id)),
      // Letzte Überprüfung ohne Änderung (DokumentEintrag.bestaetigt), nur wenn nicht vor der Freigabe der aktuellen Version
      bestaetigt:
        !istLeer && e?.bestaetigt?.von && bestaetigtAm(id)
          ? u.t('allgemein.lenkung.bestaetigt', { person: klartext(personText(e.bestaetigt.von)), datum: datum(e.bestaetigt.am) ?? '' })
          : '',
      klassifikation: klassifikation(id),
      // Modul NIST AI RMF: Normbezug nennt das NIST-Dokument selbst (NIST AI 100-1, 600-1); die Vorlagen setzen die Abschnitte
      // aus ihrem Normverweis (normbezugVereinheitlichen)
      normbezug: normbezugKopf(d.normbezug),
      // Ohne ISMS gibt es kein ISMS-Dokument, auf das sich ein Firmendokument beziehen könnte, und «Leitfaden» ist eine
      // Angabe zur Vorlage: Feld im Firmendokument leer (wird nicht ausgegeben). Mit Eintrag «aufgenommen in» im Register
      // (Kennung, Titel, Version des ISMS-Dokuments) nennt der Kopf das Dokument; Ergänzungsblätter erweitern immer ein Dokument.
      ismsBezug: !istLeer && (!projekt.meta.mitIsms || d.isms === 'leitfaden') ? '' : ismsBezug(id, d.isms),
      // Der Pfad (mit oder ohne ISMS) ist eine Angabe zur Vorlage, nicht zum Firmendokument; leere Felder gibt der Generator nicht aus
      pfad: istLeer ? u.t(eb ? 'allgemein.pfad.ergaenzungsblatt' : d.eb ? 'allgemein.pfad.ohne_isms_dokument' : 'allgemein.pfad.beide') : '',
    };
  };

  /**
   * Dokument-ID, unter der die Firma ein Dokument führt: im Pfad mit ISMS für Vorlagen mit eigener EB-Form die ID des
   * Ergänzungsblatts (D-04 -> D-04-EB), sonst die ID selbst. Leere Vorlagen: immer die Vorlagen-ID.
   */
  const dokId = (id: string): string => (!istLeer && projekt.meta.mitIsms && NUR_ALS_EB_MIT_ISMS.has(id) ? `${id}-EB` : id);

  /** Ersetzt Verweise wie «D-04» oder «(D-16)» in einem Text durch die ID im Pfad der Firma (dokId). */
  const verweise = (text: string): string =>
    istLeer || !projekt.meta.mitIsms ? text : text.replace(/(?<![\w-])(D-\d{2})(?![\w]|-EB|-\d)/g, (_, id: string) => dokId(id));

  const textAbbilden = (t: Text, f: (s: string) => string): Text => (typeof t === 'string' ? f(t) : t.map((l) => ({ ...l, text: f(l.text) })));
  /** Wendet f auf alle Texte von Blöcken an (Überschriften, Absätze, Listen, Tabellen, Felder, Hinweise). */
  const bloeckeAbbilden = (bloecke: Block[], f: (s: string) => string): Block[] =>
    bloecke.map((b): Block => {
      switch (b.typ) {
        case 'ueberschrift':
          return { ...b, text: f(b.text) };
        case 'absatz':
        case 'hinweis':
          return { ...b, text: textAbbilden(b.text, f) };
        case 'liste':
          return { ...b, punkte: b.punkte.map((p) => textAbbilden(p, f)) };
        case 'tabelle':
          return { ...b, zeilen: b.zeilen.map((z) => z.map((t) => textAbbilden(t, f))) };
        case 'felder':
          return { ...b, felder: b.felder.map((x) => ({ ...x, wert: textAbbilden(x.wert, f) })) };
        case 'matrix':
          return {
            ...b,
            ...(b.titel ? { titel: f(b.titel) } : {}),
            spalten: b.spalten.map((t) => textAbbilden(t, f)),
            zeilen: b.zeilen.map((z) => ({ kopf: textAbbilden(z.kopf, f), zellen: z.zellen.map((c) => ({ ...c, zeilen: c.zeilen.map((t) => textAbbilden(t, f)) })) })),
            ...(b.legende ? { legende: b.legende.map((l) => ({ ...l, text: textAbbilden(l.text, f) })) } : {}),
            ...(b.alt ? { alt: f(b.alt) } : {}),
          };
        case 'diagramm':
          return { ...b, titel: f(b.titel), alt: { titel: f(b.alt.titel), beschreibung: f(b.alt.beschreibung) } };
        case 'ablauf':
          return {
            ...b,
            knoten: b.knoten.map((k) => ({ ...k, text: f(k.text) })),
            kanten: b.kanten.map((k) => (k.text ? { ...k, text: f(k.text) } : k)),
            alt: { titel: f(b.alt.titel), beschreibung: f(b.alt.beschreibung) },
          };
        default:
          return b;
      }
    });
  /** Wendet f auf alle Texte eines Dokuments an (Blöcke bzw. Blätter mit Titel, Hinweisen, Spaltenköpfen und Zellen); Lenkungsangaben und Formeln bleiben. */
  const textAbbildenIr = <T extends DocxDokument | XlsxMappe>(ir: T, f: (s: string) => string): T => {
    if ('bloecke' in ir) return { ...ir, bloecke: bloeckeAbbilden(ir.bloecke, f) };
    return {
      ...ir,
      hinweisBlock: ir.hinweisBlock ? bloeckeAbbilden(ir.hinweisBlock, f) : ir.hinweisBlock,
      blaetter: ir.blaetter.map((b) => ({
        ...b,
        titel: b.titel === undefined ? b.titel : f(b.titel),
        hinweise: b.hinweise?.map(f),
        spalten: b.spalten.map((sp) => ({ ...sp, kopf: f(sp.kopf) })),
        zeilen: b.zeilen.map((z) => z.map((w) => (typeof w === 'string' ? f(w) : w))),
      })),
    };
  };
  /** Wendet verweise() auf alle Texte von Blöcken an (Absätze, Listen, Tabellen, Felder, Hinweise). */
  const verweiseBloecke = (bloecke: Block[]): Block[] => (istLeer || !projekt.meta.mitIsms ? bloecke : bloeckeAbbilden(bloecke, verweise));
  /** verweise() für Zellen einer XLSX-Tabelle */
  const verweiseZeilen = <T>(zeilen: T[][]): T[][] =>
    istLeer || !projekt.meta.mitIsms ? zeilen : zeilen.map((z) => z.map((w) => (typeof w === 'string' ? (verweise(w) as T) : w)));
  /**
   * Verweise im ganzen Dokument (Blöcke bzw. Blätter mit Hinweisen und Zellen) auf die IDs im Pfad der Firma lenken
   * (N-17: im Pfad mit ISMS D-04-EB statt D-04). Lenkungsangaben und Formeln bleiben unverändert.
   */
  const pfadVerweise = <T extends DocxDokument | XlsxMappe>(ir: T): T => (istLeer || !projekt.meta.mitIsms ? ir : textAbbildenIr(ir, verweise));

  /**
   * Verweise auf Dokumente, die zum Freigabedatum dieses Dokuments noch nicht freigegeben waren (erste Freigabe später),
   * erhalten den Zusatz «in Erarbeitung» (7.5.3: der Inhalt entspricht dem Stand der Freigabe). Nicht in Plänen und
   * Registern, die alle Dokumente mit Termin führen (D-00, D-25, Register D-26), und nicht in leeren Vorlagen.
   */
  const geplanteVerweise = <T extends DocxDokument | XlsxMappe>(ir: T): T => {
    const eigene = ir.lenkung.dokumentId;
    if (istLeer || /^D-(00|25)\b/.test(eigene) || (/^D-26/.test(eigene) && !('bloecke' in ir))) return ir;
    // Stand: Freigabe der aktuellen Version oder spätere Bestätigung ohne Änderung (z. B. in der Managementbewertung)
    const stand = standDatum(eigene);
    if (!stand) return ir;
    const zusatz = u.t('allgemein.verweis_geplant');
    const basis = (x: string) => x.replace(/-EB$/, '');
    const markiere = (text: string): string =>
      text.replace(/(?<![\w-])((?:D|E|N)-\d{2}(?:-EB|-KI-\d{3})?)(?![\w-])/g, (treffer: string, ref: string, pos: number, ganz: string) => {
        if (basis(ref) === basis(eigene)) return treffer;
        const erst = ersteFreigabe(ref);
        if (!erst || erst <= stand) return treffer;
        // Titel einer Massnahme oder eines Entscheids über das Dokument selbst («Freigabe von D-27», «D-27 einführen»): kein Zusatz
        if (PLAN_VOR.test(ganz.slice(0, pos)) || PLAN_NACH.test(ganz.slice(pos + ref.length))) return treffer;
        // in Klammern allein: «(D-12, in Erarbeitung)»; in Klammern mit weiteren Angaben: «(D-06-EB in Erarbeitung, D-07)»
        // bzw. «(D-06-EB in Erarbeitung, D-07 in Erarbeitung)»; ausserhalb von Klammern: «D-12 (in Erarbeitung)»
        const vorher = ganz.slice(0, pos);
        const offen = (vorher.match(/\(/g)?.length ?? 0) - (vorher.match(/\)/g)?.length ?? 0);
        if (offen <= 0) return `${ref} (${zusatz})`;
        const auf = vorher.lastIndexOf('(');
        const zu = ganz.indexOf(')', pos);
        const allein = auf >= 0 && zu >= 0 && ganz.slice(auf + 1, zu).trim() === ref;
        return allein ? `${ref}, ${zusatz}` : `${ref} ${zusatz}`;
      });
    // In Klammern mit weiteren Verweisen trennt ein Semikolon den Verweis mit Zusatz von den übrigen, damit der Zusatz nur
    // zu seinem Verweis gehört: «(D-06; D-07 in Erarbeitung)» statt «(D-06, D-07 in Erarbeitung)»
    const ref = '(?:D|E|N)-\\d{2}(?:-EB|-KI-\\d{3})?';
    const mit = new RegExp(`(${ref} ${zusatz}), (?=(?:D|E|N)-\\d{2})`, 'g');
    const vor = new RegExp(`(${ref}), (?=${ref} ${zusatz})`, 'g');
    const trennen = (text: string): string => text.replace(mit, '$1; ').replace(vor, '$1; ');
    return textAbbildenIr(ir, (t) => trennen(markiere(t)));
  };

  /**
   * Firmendokument mit Normtexten: Statt des Verweises «Anforderungstext siehe ISO/IEC 42001, Abschnitt X» steht am Ende
   * der Wortlaut der genannten Abschnitte und Controls aus der Normausgabe der Firma, mit Quellenvermerk.
   */
  const normAuszug = (normbezug: string): Block[] => {
    if (!normTeile) return [];
    const bekannt = [...kataloge.anforderungen42001.kapitel.flatMap((k) => k.abschnitte.map((a) => a.id)), ...kataloge.controls42001.gruppen.flatMap((g) => g.controls.map((c) => c.id))];
    const ids = idsAusNormbezug(ohneAusgeschlossene(normbezug), bekannt).filter((id) => normEintrag(normTeile, id, u.sprache)?.eintrag.text);
    if (!ids.length) return [];
    return [
      { typ: 'ueberschrift', ebene: 1, text: u.t('allgemein.normtext.auszug_titel') },
      { typ: 'absatz', text: u.t('allgemein.normtext.auszug_einleitung') },
      ...ids.flatMap((id): Block[] => [
        { typ: 'ueberschrift', ebene: 3, text: `${id.replace(/^K-/, '')} ${normTitel(id)}` },
        ...(normAnforderung(id) ?? '').split('\n').filter(Boolean).map((t): Block => ({ typ: 'absatz', text: t })),
      ]),
    ];
  };

  /** Quellenvermerk je verwendeter Normausgabe (Lizenzgeber und Lizenznummer aus den Einstellungen des Werkzeugs) */
  const normVermerkText = (): string[] => {
    if (!normTeile || !ctx.normGenutzt?.size) return [];
    const teile = new Map<string, NormTeil>();
    for (const id of ctx.normGenutzt) {
      const t = normEintrag(normTeile, id, u.sprache)?.teil;
      if (t) teile.set(`${t.norm}-${t.sprache}`, t);
    }
    return [...teile.values()].map((t) => vermerkText((k, w) => u.t(k, w), t, ctx.normtexte?.lizenzgeber ?? '', ctx.normtexte?.lizenznummer ?? ''));
  };
  /** Quellenvermerk ans Dokument: DOCX am Ende, XLSX auf dem Lenkungsblatt */
  const normVermerk = <T extends DocxDokument | XlsxMappe>(ir: T): T => {
    const saetze = normVermerkText();
    if (!saetze.length) return ir;
    if ('bloecke' in ir) return { ...ir, bloecke: [...ir.bloecke, ...saetze.map((s): Block => ({ typ: 'absatz', text: [{ text: s, kursiv: true }] }))] };
    return { ...ir, hinweisBlock: [...(ir.hinweisBlock ?? []), ...saetze.map((s): Block => ({ typ: 'hinweis', art: 'normverweis', text: s }))] };
  };

  /**
   * Eine Quelle für den Normbezug: Abschnitte aus dem Normverweis des Dokuments (Kasten) auch im Kopf. In Firmendokumenten
   * entfällt der Kasten, weil der Kopf dieselbe Angabe trägt; die Formatvorlage des Kastens erscheint dann nur, wenn ein
   * anderer Kasten derselben Art (z. B. AI-Act-Bezug) im Dokument steht.
   */
  const normbezugVereinheitlichen = <T extends DocxDokument | XlsxMappe>(ir: T): T => {
    const istNorm = (b: Block) => b.typ === 'hinweis' && b.art === 'normverweis' && !!b.normbezug;
    const bloecke = 'bloecke' in ir ? ir.bloecke : (ir.hinweisBlock ?? []);
    const erster = bloecke.find(istNorm);
    if (!erster || erster.typ !== 'hinweis') return ir;
    const katalogId = ir.lenkung.dokumentId.replace(/-EB$/, '').replace(/^(D-09)-KI-\d+$/, '$1');
    const katalog = kataloge.dokumente.dokumente.find((x) => x.id === katalogId)?.normbezug ?? '';
    const lenkungNeu = { ...ir.lenkung, normbezug: normbezugKopf(katalog, erster.normbezug) };
    if (istLeer) return { ...ir, lenkung: lenkungNeu };
    if ('bloecke' in ir) return { ...ir, lenkung: lenkungNeu, bloecke: [...ir.bloecke.filter((b) => !istNorm(b)), ...normAuszug(erster.normbezug ?? '')] };
    return { ...ir, lenkung: lenkungNeu, hinweisBlock: (ir.hinweisBlock ?? []).filter((b) => !istNorm(b)) };
  };

  /**
   * Unterschriftenblock: bekannte Freigaben (Person aus dem Projekt) mit Funktion, Name und Datum; doppelte Personen nur
   * einmal. Leere Vorlage oder keine bekannte Freigabe: «Name, Funktion» in der gewünschten Anzahl Zeilen.
   */
  const unterschriften = (freigaben: (Freigabe | undefined)[], anzahlLeer = 1): Block => {
    const bekannt = istLeer
      ? []
      : freigaben
          .filter((f): f is Freigabe => !!f?.von)
          .filter((f, i, alle) => alle.findIndex((x) => x.von === f.von) === i)
          .map((f) => {
            const p = person(f.von);
            return { funktion: p?.funktion ?? '', name: p?.name ?? f.von, datum: datum(f.am) ?? '' };
          });
    return {
      typ: 'unterschriften',
      felder: bekannt.length ? bekannt : Array.from({ length: anzahlLeer }, () => u.t('allgemein.unterschrift.name_funktion')),
    };
  };

  /**
   * Entscheid der Erklärung zur Anwendbarkeit (D-11) für eine Gruppe von Controls: «ja», wenn eines anwendbar ist;
   * «nein», wenn alle entschieden und nicht anwendbar sind; sonst undefined (noch offen oder nicht erfasst).
   */
  const soaEntscheid = (ids: string[]): 'ja' | 'nein' | undefined => {
    if (istLeer) return undefined;
    const eintraege = ids.map((id) => projekt.controls.find((c) => c.id === id));
    if (eintraege.some((c) => c?.anwendbar === 'ja')) return 'ja';
    return eintraege.every((c) => c?.anwendbar === 'nein') ? 'nein' : undefined;
  };

  /**
   * Bewertungsskala Wahrscheinlichkeit oder Auswirkung aus organisation.risikokriterien (D-06), sonst der Vorschlag aus D-07
   * (vier Stufen). hoch: Stufen, die als hoch gelten (ab vier Stufen die zwei obersten, sonst die oberste), z. B. «3 oder 4».
   */
  const skala = (art: 'wahrscheinlichkeit' | 'auswirkung') => {
    const vorschlag = ((u.roh('vorlagen.D-07.skalen_vorschlag') as Record<string, (string | number)[][]> | undefined)?.[art] ?? []).map((z) => ({
      stufe: Number(z[0]),
      bezeichnung: String(z[1]),
    }));
    const eigene = istLeer ? [] : projekt.organisation.risikokriterien[art];
    const stufen = [...(eigene.length ? eigene : vorschlag)].sort((a, b) => a.stufe - b.stufe);
    const min = stufen[0] ?? { stufe: 1, bezeichnung: '' };
    const max = stufen.at(-1) ?? min;
    const ab = max.stufe >= 4 ? max.stufe - 1 : max.stufe;
    const hoch = stufen.filter((x) => x.stufe >= ab).map((x) => String(x.stufe));
    return {
      stufen: stufen.map((x) => String(x.stufe)),
      /** «1 gering bis 4 schwer» */
      bereich: u.t('allgemein.skala.bereich', { von: min.stufe, von_name: min.bezeichnung, bis: max.stufe, bis_name: max.bezeichnung }).replace(/\s+/g, ' '),
      /** «1 bis 4» */
      vonBis: u.t('allgemein.skala.von_bis', { von: min.stufe, bis: max.stufe }),
      /** «3 oder 4» */
      hoch: hoch.length > 1 ? `${hoch.slice(0, -1).join(', ')} ${u.t('allgemein.skala.oder')} ${hoch.at(-1)}` : (hoch[0] ?? ''),
    };
  };

  /**
   * Risikoquellen: eine Quelle für Katalog (D-06), Auswahlliste und Zellen (D-07), nämlich die Optionsgruppe
   * risikoquelle (Risiko.quelle) mit ihren Beschriftungen, erster Buchstabe gross.
   */
  const risikoquellen = (): { schluessel: string; label: string }[] =>
    Object.entries((u.roh('gefuehrt.optionen.risikoquelle') ?? {}) as Record<string, string>).map(([schluessel, label]) => ({
      schluessel,
      label: label.charAt(0).toUpperCase() + label.slice(1),
    }));
  /**
   * Risikoquelle als Eintrag der Werteliste (D-07, Datenvalidierung): Schlüssel, sonst gleicher Text, sonst der Eintrag,
   * dessen Text ohne Klammerzusatz übereinstimmt («Modell oder Technik» -> «Modell oder Technik (Fehler, Robustheit)»)
   */
  const risikoquelle = (quelle: string): string => {
    const liste = risikoquellen();
    const n = (x: string) => x.trim().toLowerCase();
    return (
      liste.find((q) => q.schluessel === quelle)?.label ??
      liste.find((q) => n(q.label) === n(quelle))?.label ??
      liste.find((q) => n(q.label.replace(/\s*\(.*\)\s*$/, '')) === n(quelle.replace(/\s*\(.*\)\s*$/, '')))?.label ??
      quelle
    );
  };

  /**
   * Umsetzungsstand eines Controls für Dokumente (D-11, D-20, D-25, E-03): Status aus der Erklärung zur Anwendbarkeit;
   * «umgesetzt» oder «wirksam» gilt nur als «teilweise», solange die Umsetzung auf eine offene Massnahme verweist
   * (M-ID in controls[].umsetzung, Massnahme nicht erledigt oder verworfen). Prüfregel H24 meldet den Widerspruch.
   */
  const controlStatus = (c: { status: ControlStatus; umsetzung: string }): ControlStatus => {
    if (c.status !== 'umgesetzt' && c.status !== 'wirksam') return c.status;
    const offen = (c.umsetzung.match(/\bM-\d{3}\b/g) ?? []).some((id) => {
      const m = projekt.massnahmen.find((x) => x.id === id);
      return !!m && m.status !== 'erledigt' && m.status !== 'verworfen';
    });
    return offen ? 'teilweise' : c.status;
  };

  /** Person aus der Zuständigkeitsmatrix (projekt.rollen, D-04): verantwortlich (R) oder rechenschaftspflichtig (A) für einen Bereich */
  const rollenPerson = (bereich: string, art: 'verantwortlich' | 'rechenschaft' = 'verantwortlich'): string | undefined =>
    projekt.rollen.find((r) => r.bereich === bereich)?.[art];

  /**
   * Rechtsstand des EU AI Act aus src/ai-act/stand.yaml: konsolidierte Fassung und jüngere Berichtigungen der
   * Sprachfassung, z. B. «konsolidierte Fassung vom 27.07.2026, inklusive Berichtigung vom 29.09.2026».
   */
  const rechtsstand = (): string => {
    const stand = kataloge['aiact_stand'] as
      | { fassung: { datum: string; berichtigungen?: { datum: string; in_sprachfassung?: string[] }[] } }
      | undefined;
    if (!stand) return '';
    const fassung = stand.fassung.datum;
    const tag = (iso: string) => datum(iso) ?? iso;
    const berichtigungen = (stand.fassung.berichtigungen ?? [])
      .filter((b) => b.datum > fassung && (!b.in_sprachfassung || b.in_sprachfassung.includes(u.sprache)))
      .map((b) => b.datum)
      .sort();
    return berichtigungen.length
      ? u.t('allgemein.rechtsstand.mit_berichtigung', { fassung: tag(fassung), berichtigung: berichtigungen.map(tag).join(', ') })
      : u.t('allgemein.rechtsstand.fassung', { fassung: tag(fassung) });
  };

  const eigenschaften = (id: string) => ({
    titel: `${id} ${dokumentTitel(u, kataloge, id)}`,
    // Nie Kit-Absender in den Dateieigenschaften: Firma oder leer
    autor: istLeer ? '' : projekt.organisation.name,
    // Erstellt und geändert: erste und aktuelle Freigabe des Dokuments statt Zeitpunkt des Builds (wenn bekannt)
    ...(istLeer ? {} : { erstellt: ersteFreigabe(id), geaendert: dokFreigabe(id)?.am, revision: Math.max(1, aenderungen(id).length) }),
  });

  // Anlagen für Systemtabellen (ANLAGE_AB_SYSTEMEN). systemAnlage() merkt die Blöcke vor, anlagen() gibt sie am
  // Dokumentende aus; anlagen() deshalb als letzten Eintrag der Blockliste aufrufen.
  const anlagenListe: { titel: string; bloecke: Block[] }[] = [];
  const anlageNr = (i: number) => String.fromCharCode(65 + i);
  /** Blöcke mit einer Zeile je KI-System: bis 7 Systeme im Text, ab 8 Systemen (nur Firmendokumente) in einer Anlage */
  const systemAnlage = (titel: string, bloecke: Block[], anzahl: number): Block[] => {
    if (istLeer || anzahl < ANLAGE_AB_SYSTEMEN) return bloecke;
    anlagenListe.push({ titel, bloecke });
    return [{ typ: 'absatz', text: u.t('allgemein.anlage.verweis', { anzahl, nr: anlageNr(anlagenListe.length - 1) }) }];
  };
  /** Blöcke als Anlage am Dokumentende (nur Firmendokumente) mit eigenem Verweis im Text, z. B. eine lange Prozessliste */
  const textAnlage = (titel: string, bloecke: Block[], verweis: (nr: string) => Text): Block[] => {
    if (istLeer) return bloecke;
    anlagenListe.push({ titel, bloecke });
    return [{ typ: 'absatz', text: verweis(anlageNr(anlagenListe.length - 1)) }];
  };
  /**
   * Grafik als Anlage am Dokumentende (zählt nicht zur Seitenvorgabe von 4 Seiten Haupttext), auch in leeren Vorlagen. Im
   * Text steht ein Verweis mit Titel und Buchstabe der Anlage.
   */
  const grafikAnlage = (titel: string, bloecke: Block[]): Block[] => {
    anlagenListe.push({ titel, bloecke });
    return [{ typ: 'absatz', text: u.t('vorlagen.grafik.anlage_verweis', { titel, nr: anlageNr(anlagenListe.length - 1) }) }];
  };
  /**
   * Wer im Firmendokument über die Einführung eines KI-Systems entscheidet, je Risikostufe aus den Entscheidungsrechten
   * (D-04 Anlage A; N7). Personen mit ihrer Stelle («die AIMS-Verantwortung (Name)»), damit
   * D-12 und D-15 dieselbe Stelle nennen wie D-04. Leere Vorlage oder unvollständige Angabe: undefined (Text der Vorlage).
   */
  const einfuehrungsStellen = (): Record<'tief' | 'mittel' | 'hoch', string> | undefined => {
    const wer = istLeer ? undefined : projekt.organisation.entscheidungsrechte?.find((e) => e.entscheid === 'einfuehren')?.wer;
    if (!wer || (['tief', 'mittel', 'hoch'] as const).some((st) => leer(wer[st]))) return undefined;
    const text = (w: string): string => {
      const p = person(w);
      if (!p) return w.trim();
      const stelle = p.aimsRollen.includes('gl') ? 'gl' : p.aimsRollen.includes('aims') || projekt.organisation.aimsVerantwortlich === p.id ? 'aims' : undefined;
      return stelle ? u.t(`allgemein.entscheidungsstelle.${stelle}`, { name: p.name }) : p.name;
    };
    return { tief: text(wer.tief ?? ''), mittel: text(wer.mittel ?? ''), hoch: text(wer.hoch ?? '') };
  };
  const anlagen = (): Block[] =>
    anlagenListe.flatMap((a, i): Block[] => [
      ...(i === 0 ? [{ typ: 'seitenumbruch' } as Block] : []),
      { typ: 'ueberschrift', ebene: 1, text: u.t('allgemein.anlage.titel', { nr: anlageNr(i), titel: a.titel }) },
      ...a.bloecke,
    ]);

  return {
    wert, person, personText, einfuehrungsStellen, datum, hinweis, normverweis, ausbau, kitBlock, firmenname, lenkung, eigenschaften, dokEintrag, klassifikation,
    fusszeile, meldestelle, md, klartext, istLeer, systemAnlage, textAnlage, grafikAnlage, anlagen,
    normTitel, normAnforderung, mitNormtext, normVermerk,
    textAbbildenIr, dokId, verweise, verweiseBloecke, rollenText, verweiseZeilen, pfadVerweise, geplanteVerweise, normbezugVereinheitlichen, aenderungen, dokFreigabe, ersteFreigabe, massnahmeStatusAm, standDatum, bestaetigtAm, controlStatus, unterschriften, rollenPerson, rechtsstand, soaEntscheid, risikoquellen, risikoquelle, skala,
  };
}

export type Helfer = ReturnType<typeof erstelleHelfer>;
