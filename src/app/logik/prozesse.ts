// Prozesse im Werkzeug: Stand je Prozess zum Stichtag, Texte der Oberfläche und Schreibaktionen auf Projekt.prozesse.
// Die Fachlogik (Katalog, Ableitung, Reifevorschlag, Layout) steht in src/prozesse und gilt auch für Dokumente und Prüfregeln.
import type { EigenerProzess, Projekt, ProzessBahn, ProzessEintrag, ProzessReife, ProzessSchritt } from '../../model/typen.ts';
import { ablaufVon, naechsteEigeneId, prozesseImProjekt, prozessKatalog, REIFE_SCHLUESSEL, rollenText, type TextQuelle } from '../../prozesse/katalog.ts';
import { prozessStaende, type ProzessStand } from '../../prozesse/stand.ts';
import type { KatalogProzess } from '../../prozesse/typen.ts';
import { appDaten } from '../daten.ts';
import { eintragLoeschen } from './eintraege.ts';
import { idMerken } from './ids.ts';
import { inhalt, inhaltRoh, t } from '../i18n.ts';
import { aendereMit } from '../zustand/store.ts';

/** Texte der Oberfläche als Quelle für die Prozesslogik (Sprache der Oberfläche, Rückfall Deutsch) */
export const UI_TEXTE: TextQuelle = { roh: inhaltRoh };

export function katalogProzesse(): KatalogProzess[] {
  return prozessKatalog(appDaten().kataloge).prozesse;
}

/** Katalog und eigene Prozesse des Projekts */
export function prozesseDesProjekts(p: Projekt): KatalogProzess[] {
  return prozesseImProjekt(p, appDaten().kataloge);
}

export function staende(p: Projekt, stichtag: string): ProzessStand[] {
  return prozessStaende(p, appDaten().kataloge, stichtag);
}

export function reifeText(r: ProzessReife | number): string {
  return inhalt(`prozesse.reifeskala.${REIFE_SCHLUESSEL[r] ?? REIFE_SCHLUESSEL[0]}.titel`) ?? String(r);
}

/** Ton der Statusform je Reife (Design System, nie CI-Farben): Wort und Form tragen die Bedeutung */
/** Ton je Reifestufe: neutrale, steigende Skala ohne Warnfarbe (U-17) */
export const REIFE_TON = ['neutral', 'neutral', 'info', 'gut', 'gut'] as const;

/** Eintrag ändern oder anlegen; leere Angaben entfallen. Legt Projekt.prozesse beim ersten Eintrag an. */
export function prozessAendern(id: string, f: (e: ProzessEintrag) => void): void {
  aendereMit((p) => {
    const liste = (p.prozesse ??= []);
    let e = liste.find((x) => x.id === id);
    if (!e) {
      e = { id };
      liste.push(e);
      liste.sort((a, b) => a.id.localeCompare(b.id));
    }
    f(e);
    for (const [k, v] of Object.entries(e)) {
      if (k === 'id') continue;
      if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) delete (e as unknown as Record<string, unknown>)[k];
    }
  });
}

/** Ein Feld eines Eintrags setzen (undefined löscht es) */
export function prozessFeld<K extends keyof ProzessEintrag>(id: string, feld: K, wert: ProzessEintrag[K] | undefined): void {
  prozessAendern(id, (e) => {
    if (wert === undefined) delete e[feld];
    else e[feld] = wert;
  });
}

/**
 * Vorschläge aus dem Guide (E2, aimsProzesse: «schon gelebt»): Reife «definiert» für die entsprechenden
 * Prozesse ohne eigene Einstufung. Liefert die Zahl der übernommenen Prozesse.
 */
export function vorschlaegeAusGefuehrt(p: Projekt): string[] {
  const gelebt = new Set((p.meta.gefuehrt.antworten['aimsProzesse'] as string[] | undefined) ?? []);
  return katalogProzesse()
    .filter((kp) => kp.gefuehrt_option && gelebt.has(kp.gefuehrt_option) && p.prozesse?.find((e) => e.id === kp.id)?.reife === undefined)
    .map((kp) => kp.id);
}

export function vorschlaegeUebernehmen(ids: readonly string[], heute: string): void {
  aendereMit((p) => {
    const liste = (p.prozesse ??= []);
    for (const id of ids) {
      let e = liste.find((x) => x.id === id);
      if (!e) liste.push((e = { id }));
      if (e.reife === undefined) {
        e.reife = 1;
        e.reifeAm = heute;
      }
    }
    liste.sort((a, b) => a.id.localeCompare(b.id));
  });
}

/** Projekt nutzt die Prozesse (Prüfregeln, D-27): legt die leere Liste an */
export function prozesseStarten(): void {
  aendereMit((p) => {
    p.prozesse ??= [];
  });
}

// ---------------------------------------------------------------------------------------------
// Eigene Prozesse (Projekt.eigeneProzesse, PE-01 ff.)

/**
 * Eigenen Prozess anlegen: Eintrag in eigeneProzesse und ein Ablauf mit Start, erstem Schritt und Ende in den gewählten
 * Bahnen (Rollen; ohne Wahl die AIMS-Verantwortliche). Der Ablauf lässt sich danach in der Schritt-Tabelle ausbauen.
 */
export function eigenenProzessAnlegen(angaben: Omit<EigenerProzess, 'id'>, bahnen: readonly string[]): string {
  let id = '';
  aendereMit((p) => {
    id = naechsteEigeneId(p);
    // Kennung im Zähler festhalten (AF-010): wird nach dem Löschen nicht wieder vergeben
    idMerken(p, 'eigeneProzesse', id);
    const rollen = bahnen.length ? [...bahnen] : ['aims'];
    const erste = rollen[0]!;
    const zweite = rollen[1] ?? erste;
    (p.eigeneProzesse ??= []).push({ id, ...angaben });
    const schritte: ProzessSchritt[] = [
      { id: `${id}.00`, art: 'start', text: t('prozesse.eigen_start'), bahn: erste, naechste: [`${id}.01`] },
      { id: `${id}.01`, art: 'aufgabe', text: t('prozesse.eigen_schritt'), bahn: zweite, naechste: [`${id}.90`], raci: { [zweite]: 'A' } },
      { id: `${id}.90`, art: 'ende', text: t('prozesse.eigen_ende'), bahn: erste },
    ];
    const liste = (p.prozesse ??= []);
    liste.push({ id, anwendbar: 'ja', schritte, bahnen: rollen.map((r) => ({ id: r, rolle: r })) });
    liste.sort((a, b) => a.id.localeCompare(b.id));
  });
  return id;
}

/** Titel, Zweck, Gruppe, Art oder Normbezug eines eigenen Prozesses ändern */
export function eigenenProzessAendern(id: string, f: (e: EigenerProzess) => void): void {
  aendereMit((p) => {
    const e = p.eigeneProzesse?.find((x) => x.id === id);
    if (!e) return;
    f(e);
    if (!e.zweck) delete e.zweck;
    if (!e.normbezug?.length) delete e.normbezug;
  });
}

/**
 * Eigenen Prozess löschen über den Löschschutz (AF-009): Eintrag, Stand und Ablauf, dazu jeder Verweis auf die Kennung nach
 * dem Verweisregister (Auditumfang, Feststellungen, Schnittstellen, Schrittverweise, Bibliothek, Herkunft von Massnahmen,
 * Prozesszeilen der Managementbewertung). Die Nummer bleibt im Zähler (AF-010). Die Oberfläche zeigt vorher die
 * abhängigen Einträge (ui/Loeschen.tsx).
 */
export function eigenenProzessLoeschen(id: string): void {
  aendereMit((p) => {
    eintragLoeschen(p, 'eigeneProzesse', id);
  });
}

// ---------------------------------------------------------------------------------------------
// Bahnen ohne Rolle (nach draw.io) und Schritte

/** Rollen zur Auswahl für Bahnen: Rollenbereiche (D-04), Funktionen (aimsRolle) und Zusatzrollen des Katalogs, nach Text */
export function rollenAuswahl(): { schluessel: string; text: string }[] {
  const k = prozessKatalog(appDaten().kataloge);
  const schluessel = new Set<string>([...k.prozesse.flatMap((x) => x.schritte.map((s) => s.bahn)), ...k.rollen.aus_aims_rolle, ...k.rollen.zusatz]);
  for (const gruppe of ['rollenBereich', 'aimsRolle']) {
    const g = inhaltRoh(`gefuehrt.optionen.${gruppe}`);
    if (g && typeof g === 'object') for (const x of Object.keys(g)) schluessel.add(x);
  }
  // Gleicher Text aus Rollen und Bereichen ist für Nutzende eine Rolle (C-20, D-11): nur einmal anbieten, zuerst die Prozessrolle
  const gesehen = new Set<string>();
  const einmal = [...schluessel].filter((x) => {
    const text = rollenText(UI_TEXTE, x).trim().toLowerCase();
    if (gesehen.has(text)) return false;
    gesehen.add(text);
    return true;
  });
  return einmal.map((x) => ({ schluessel: x, text: rollenText(UI_TEXTE, x) })).sort((a, b) => a.text.localeCompare(b.text, 'de'));
}

/** Bahnen eines eigenen Ablaufs ohne Rolle, die Schritte tragen oder beim Import offen blieben */
export function offeneBahnen(e: ProzessEintrag | undefined): ProzessBahn[] {
  if (!e?.schritte?.length) return [];
  const offen = new Set(e.drawio?.offen?.bahnen ?? []);
  return (e.bahnen ?? []).filter((b) => !b.rolle && (offen.has(b.id) || e.schritte!.some((s) => s.bahn === b.id)));
}

/** Rolle einer Bahn setzen; die Bahn gilt danach nicht mehr als offen (Prüfregel H61) */
export function bahnRolleSetzen(id: string, bahn: string, rolle: string | undefined): void {
  prozessAendern(id, (e) => {
    const b = e.bahnen?.find((x) => x.id === bahn);
    if (!b) return;
    if (rolle) b.rolle = rolle;
    else delete b.rolle;
    const o = e.drawio?.offen;
    if (o && rolle) {
      o.bahnen = o.bahnen.filter((x) => x !== bahn);
      if (!o.bahnen.length && !o.formen.length) delete e.drawio!.offen;
    }
  });
}

/** Formen ohne Zuordnung zur Kenntnis genommen (bleiben in den Rohdaten der Datei erhalten) */
export function formenGeprueft(id: string): void {
  prozessAendern(id, (e) => {
    const o = e.drawio?.offen;
    if (!o) return;
    o.formen = [];
    if (!o.bahnen.length) delete e.drawio!.offen;
  });
}

/** Nächste freie Schrittkennung (PR-08.11, PE-01.02); Enden tragen 90 und höher */
function neueSchrittId(pid: string, schritte: readonly ProzessSchritt[]): string {
  const nummern = schritte.map((s) => Number(s.id.startsWith(`${pid}.`) ? s.id.slice(pid.length + 1) : NaN)).filter((n) => Number.isFinite(n));
  const unter90 = nummern.filter((n) => n < 90);
  let n = (unter90.length ? Math.max(...unter90) : 0) + 1;
  if (n >= 90) n = Math.max(...nummern) + 1;
  while (nummern.includes(n)) n++;
  return `${pid}.${String(n).padStart(2, '0')}`;
}

/** Ablauf als bearbeitbare Kopie im Projekt (der Katalog bleibt unverändert) */
function ablaufAendern(kp: KatalogProzess, f: (schritte: ProzessSchritt[], bahnen: ProzessBahn[]) => void): void {
  prozessAendern(kp.id, (x) => {
    const basis = ablaufVon(UI_TEXTE, kp, x);
    const schritte = structuredClone(basis.schritte);
    const bahnen = structuredClone(basis.bahnen);
    f(schritte, bahnen);
    x.schritte = schritte;
    x.bahnen = bahnen;
  });
}

/**
 * Schritt nach Zeile i einfügen (gleiche Bahn). Bei Start und Aufgabe übernimmt der neue Schritt deren Nachfolger,
 * damit der Ablauf durchgehend bleibt; nach einer Entscheidung oder einem Ende ist er noch nicht verbunden.
 */
export function schrittHinzufuegen(kp: KatalogProzess, i: number): string {
  let neu = '';
  ablaufAendern(kp, (schritte) => {
    const vorher = schritte[i];
    neu = neueSchrittId(kp.id, schritte);
    const s: ProzessSchritt = { id: neu, art: 'aufgabe', text: t('prozesse.neuer_schritt'), bahn: vorher?.bahn ?? 'aims' };
    if (vorher && (vorher.art === 'start' || vorher.art === 'aufgabe')) {
      if (vorher.naechste?.length) s.naechste = [...vorher.naechste];
      vorher.naechste = [neu];
    }
    schritte.splice(i + 1, 0, s);
  });
  return neu;
}

/** Schritt i entfernen; Vorgänger zeigen danach auf seine Nachfolger, damit der Ablauf durchgehend bleibt */
export function schrittEntfernen(kp: KatalogProzess, i: number): void {
  ablaufAendern(kp, (schritte) => {
    const weg = schritte[i];
    if (!weg) return;
    schritte.splice(i, 1);
    for (const s of schritte) {
      if (!s.naechste?.includes(weg.id)) continue;
      const ersatz = (weg.naechste ?? []).filter((z) => z !== s.id);
      s.naechste = [...new Set(s.naechste.flatMap((z) => (z === weg.id ? ersatz : [z])))];
      if (s.zweige?.[weg.id] !== undefined) {
        const text = s.zweige[weg.id]!;
        delete s.zweige[weg.id];
        for (const z of ersatz) if (s.zweige[z] === undefined) s.zweige[z] = text;
      }
      if (!s.naechste.length) delete s.naechste;
    }
  });
}
