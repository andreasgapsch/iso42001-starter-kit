// draw.io im Projekt: Export der Prozesse eines Projekts (oder des Katalogs für die leere Vorlage) als eine Datei mit
// Landkarte und einer Seite je Prozess, Import einer Datei mit Vorschau je Seite. Isomorph (Worker, Build, Tests).
import type { Kataloge } from '../kataloge/typen.ts';
import type { Projekt, ProzessBahn, ProzessSchritt } from '../model/typen.ts';
import { ablaufUnterschied, drawioExport, drawioImportieren, DrawioFehler, drawioSeitenLesen, type DrawioExportProzess } from './drawio.ts';
import { ablaufImSystem, ablaufVon, bahnText, EIGENE_ID, eintragVon, gefuehrteProzesse, imProzesssystem, naechsteEigeneId, prozesseImProjekt, prozessKatalog, prozessTexte, rollenText, sichtImPfad, type Ablauf, type TextQuelle } from './katalog.ts';
import { NUR_ALS_EB_MIT_ISMS } from '../vorlagen/kontext.ts';
import { GRUPPEN } from './landkarte.ts';
import type { KatalogProzess } from './typen.ts';

export interface DrawioVorschauDaten {
  seiteId: string;
  seiteName: string;
  prozessId?: string;
  datei?: string;
  bahnen: ProzessBahn[];
  schritte: ProzessSchritt[];
  offen: { bahnen: string[]; formen: string[] };
  roh: string;
  hash: string;
  hinweise: string[];
  unterschied: { neu: string[]; geaendert: string[]; entfernt: string[] };
  /**
   * Seite ohne bekannten Prozess: Vorschlag, sie als eigenen Prozess anzulegen. Schritte und Rohdaten tragen schon die
   * vorgeschlagene Kennung (PE-01 ff.); die Oberfläche legt Projekt.eigeneProzesse erst beim Übernehmen an.
   */
  eigen?: { id: string; titel: string };
}

/** Prozesse im Export: ohne Projekt (leere Vorlage) alle AIMS-Prozesse, sonst die anwendbaren wie D-27 (mit eigenen), oder die genannten */
function auswahl(p: Projekt | null, k: Kataloge, ids?: readonly string[]): KatalogProzess[] {
  const alle = prozesseImProjekt(p, k);
  if (ids?.length) return alle.filter((x) => ids.includes(x.id));
  // Leere Vorlage wie D-27: AIMS-Prozesse und die empfohlenen Basisprozesse ohne ISMS
  if (!p) return alle.filter((x) => ['aims', 'minimal'].includes(sichtImPfad(x, false)));
  return alle.filter((x) => imProzesssystem(p, x));
}

/**
 * Texte im Pfad der Firma wie in den Firmendokumenten (N-17): mit ISMS heissen Dokumente mit eigener EB-Form D-04-EB statt
 * D-04 (Schritte, Bahnen, Zweige)
 */
function pfadVerweise(a: Ablauf, mitIsms: boolean): Ablauf {
  if (!mitIsms) return a;
  const f = (t: string) => t.replace(/(?<![\w-])(D-\d{2})(?![\w]|-EB|-\d)/g, (_, id: string) => (NUR_ALS_EB_MIT_ISMS.has(id) ? `${id}-EB` : id));
  return {
    ...a,
    bahnen: a.bahnen.map((b) => (b.text ? { ...b, text: f(b.text) } : b)),
    schritte: a.schritte.map((s) => ({
      ...s,
      text: f(s.text),
      ...(s.zweige ? { zweige: Object.fromEntries(Object.entries(s.zweige).map(([k, v]) => [k, f(v)])) } : {}),
      ...(s.dokumente ? { dokumente: s.dokumente.map(f) } : {}),
    })),
  };
}

/** Dateiname: D-27_Prozesse.drawio bzw. D-27_PR-08.drawio (EN D-27_Processes.drawio) */
export function drawioDateiname(q: TextQuelle & { sprache?: string }, ids?: readonly string[]): string {
  if (ids?.length === 1) return `D-27_${ids[0]}.drawio`;
  return q.sprache === 'en' ? 'D-27_Processes.drawio' : 'D-27_Prozesse.drawio';
}

/**
 * Lenkungsangaben der Datei (gelenkte Aufzeichnung zu D-27): Kennung, Version und Freigabe von D-27 aus dem
 * Dokumentenregister; ohne Freigabe der Status. Leere Vorlage: keine.
 */
function lenkungD27(p: Projekt, q: TextQuelle): { text: string; freigabe?: string } | undefined {
  const d = p.dokumente.find((x) => x.id === 'D-27');
  if (!d) return undefined;
  const t = (s: string) => String(q.roh(`vorlagen.D-27.drawio.${s}`) ?? '');
  const titel = String(q.roh('dokumente.D-27.titel') ?? '');
  const datum = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
  const person = p.personen.find((x) => x.id === d.freigabe?.von)?.name ?? '';
  const ersetze = (s: string, w: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, n: string) => w[n] ?? '');
  const text = d.freigabe?.am
    ? ersetze(t('kopf'), { titel, version: d.version, datum: datum(d.freigabe.am), person })
    : ersetze(t('kopf_entwurf'), { titel, version: d.version });
  return { text: text.replace(/\s+,/g, ',').trim(), ...(d.freigabe?.am ? { freigabe: d.freigabe.am.slice(0, 10) } : {}) };
}

export function projektDrawio(p: Projekt | null, k: Kataloge, q: TextQuelle & { sprache?: string }, o: { ids?: readonly string[]; geaendert?: string; vars?: Record<string, string> } = {}): { text: string; name: string } {
  const liste = auswahl(p, k, o.ids);
  // Verweise nur auf Prozesse, die die Firma führt (wie D-27)
  const gefuehrt = p ? gefuehrteProzesse(p, k) : undefined;
  const prozesse: DrawioExportProzess[] = liste.map((kp) => {
    const e = p ? eintragVon(p, kp.id) : undefined;
    const roh = ablaufVon(q, kp, e);
    const ablauf = p && gefuehrt ? pfadVerweise(ablaufImSystem(roh, gefuehrt), p.meta.mitIsms) : roh;
    return {
      id: kp.id,
      titel: prozessTexte(q, kp.id, p)?.titel ?? kp.id,
      ablauf,
      bahnTexte: Object.fromEntries(ablauf.bahnen.map((b) => [b.id, bahnText(q, b)])),
      ...(e?.drawio?.roh ? { roh: e.drawio.roh } : {}),
    };
  });
  const landkarte =
    liste.length > 1
      ? {
          titel: String(q.roh('vorlagen.grafik.d02.titel') ?? 'Prozesslandkarte'),
          gruppen: GRUPPEN.map((g) => ({ gruppe: g, text: String(q.roh(`prozesse.gruppen.${g}`) ?? g) })),
          // Wie D-02 Anlage: mit ISMS gemeinsam geführte Prozesse mit dem Zusatz «mit ISMS»
          prozesse: prozesse.map((x) => {
            const kp = liste.find((y) => y.id === x.id)!;
            const geteilt = !!p?.meta.mitIsms && (kp.art === 'gemeinsam' || kp.art === 'gemeinsam-ki');
            return { id: x.id, gruppe: kp.gruppe, text: `${x.id} ${x.titel}${geteilt ? `\n${String(q.roh('vorlagen.grafik.d02.isms') ?? '')}` : ''}` };
          }),
        }
      : undefined;
  // Gelenkte Aufzeichnung: Lenkungsangaben von D-27 auf jeder Seite; Änderungsdatum der Datei ist die Freigabe von D-27
  const lenkung = p ? lenkungD27(p, q) : undefined;
  const geaendert = lenkung?.freigabe ? `${lenkung.freigabe}T12:00:00.000Z` : o.geaendert;
  const text = drawioExport(prozesse, { ...(landkarte ? { landkarte } : {}), ...(geaendert ? { geaendert } : {}), ...(o.vars ? { vars: o.vars } : {}), ...(lenkung ? { kopf: lenkung.text } : {}) });
  return { text, name: drawioDateiname(q, o.ids) };
}

/** Rollen für die Zuordnung der Bahnen: alle Rollen des Katalogs und die Bahnen eigener Abläufe, mit Bezeichnung */
function rollen(k: Kataloge, q: TextQuelle): { schluessel: string; text: string }[] {
  const kat = prozessKatalog(k);
  const schluessel = new Set<string>([...kat.prozesse.flatMap((x) => x.schritte.map((s) => s.bahn)), ...kat.rollen.aus_aims_rolle, ...kat.rollen.zusatz]);
  for (const r of ['rollenBereich', 'aimsRolle']) {
    const g = q.roh(`gefuehrt.optionen.${r}`);
    if (g && typeof g === 'object') for (const x of Object.keys(g)) schluessel.add(x);
  }
  return [...schluessel].map((s) => ({ schluessel: s, text: rollenText(q, s) }));
}

export function projektDrawioLesen(p: Projekt, k: Kataloge, q: TextQuelle, daten: Uint8Array, datei: string, prozessId?: string): DrawioVorschauDaten[] {
  let seiten: ReturnType<typeof drawioSeitenLesen>;
  try {
    seiten = drawioSeitenLesen(daten);
  } catch (e) {
    // Code statt deutscher Meldung, damit die Oberfläche in ihrer Sprache antwortet (app.prozesse.fehler.<code>)
    if (e instanceof DrawioFehler) throw new Error(`drawio:${e.code}`);
    throw e;
  }
  const alle = prozesseImProjekt(p, k);
  const ids = new Set(alle.map((x) => x.id));
  const r = rollen(k, q);
  const aus: DrawioVorschauDaten[] = [];
  const vergeben: string[] = [];
  for (const seite of seiten) {
    // Einzelner Prozess: genau die Seite mit dieser ID, sonst bei einer einzigen Seite diese
    let imp = drawioImportieren(seite, { ...(prozessId && (seite.id === prozessId || seiten.length === 1) ? { prozessId } : {}), rollen: r });
    const pid = imp.prozessId && ids.has(imp.prozessId) ? imp.prozessId : undefined;
    if (prozessId && pid && pid !== prozessId) continue;
    if (!imp.schritte.length) continue; // z. B. Landkarte
    // Unbekanntes Diagramm (Liste, keine Seite eines Katalog- oder eigenen Prozesses): als eigener Prozess vorschlagen,
    // mit der nächsten freien Kennung neu gelesen, damit Schritte und Rohdaten zu dieser Kennung passen
    let eigen: DrawioVorschauDaten['eigen'];
    if (!pid && !prozessId) {
      const neu = naechsteEigeneId(p, vergeben);
      vergeben.push(neu);
      imp = drawioImportieren(seite, { prozessId: neu, rollen: r });
      const name = seite.name.trim();
      eigen = { id: neu, titel: name && !/^(page|seite)[-\s]?\d+$/i.test(name) && !EIGENE_ID.test(name) ? name.replace(/^P[RSE]-\d{2,3}\s+/, '').slice(0, 160) : '' };
    }
    const kp = pid ? alle.find((x) => x.id === pid) : undefined;
    const alt = kp ? ablaufVon(q, kp, eintragVon(p, kp.id)) : { schritte: [] };
    const u = ablaufUnterschied(alt, imp);
    aus.push({
      seiteId: seite.id,
      seiteName: seite.name,
      ...(pid ? { prozessId: pid } : {}),
      datei,
      bahnen: imp.bahnen,
      schritte: imp.schritte,
      offen: imp.offen,
      roh: imp.roh,
      hash: imp.hash,
      hinweise: imp.hinweise,
      unterschied: { neu: u.neu, geaendert: u.geaendert, entfernt: u.entfernt },
      ...(eigen ? { eigen } : {}),
    });
  }
  return aus;
}
