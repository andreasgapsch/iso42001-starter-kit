// Gemeinsame Hilfen der Abnahmetests: Struktur des Guides (src/gefuehrt), Texte, Ausfüllen von Feldern über die Oberfläche.
// Die Tests bedienen das Werkzeug wie eine Person ohne Normkenntnis: Seite lesen, Beispiel übernehmen oder Pflichtangaben ausfüllen, «Weiter».
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import { parse } from 'yaml';
import type { EtappeDef, FeldDef, SeiteDef } from '../../../src/app/logik/gefuehrt-typen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { AUSWAHL, optionenZahl, waehle, wertVon } from '../auswahl-hilfen.ts';

// ---------- Struktur und Texte ----------

const yaml = <T>(p: string) => parse(readFileSync(join(REPO, p), 'utf8')) as T;

export const ETAPPEN: EtappeDef[] = yaml<{ etappen: EtappeDef[] }>('src/gefuehrt/etappen.yaml').etappen;
export const SEITEN = new Map<string, SeiteDef>(
  readdirSync(join(REPO, 'src/gefuehrt/seiten'))
    .filter((d) => d.endsWith('.yaml'))
    .flatMap((d) => yaml<{ seiten: SeiteDef[] }>(`src/gefuehrt/seiten/${d}`).seiten)
    .map((s) => [s.id, s]),
);
export const OPTIONEN: Record<string, string[]> = yaml<{ optionen: Record<string, unknown[]> }>('src/gefuehrt/optionen.yaml').optionen as Record<string, string[]>;

type Texte = Record<string, unknown>;
const texteCache: Partial<Record<'de' | 'en', Texte>> = {};
/** Erzeugte Texte (npm run build:app legt sie in src/generiert ab). */
export function texte(sprache: 'de' | 'en'): Texte {
  return (texteCache[sprache] ??= JSON.parse(readFileSync(join(REPO, `src/generiert/texte.${sprache}.json`), 'utf8')) as Texte);
}
export function text(sprache: 'de' | 'en', schluessel: string): string {
  let x: unknown = texte(sprache);
  for (const t of schluessel.split('.')) x = (x as Record<string, unknown> | undefined)?.[t];
  if (typeof x !== 'string') throw new Error(`Text fehlt: ${sprache} ${schluessel}`);
  return x.trim();
}
/** UI-Text ohne Platzhalter-Teil (alles vor dem ersten «{»). */
export const uiText = (sprache: 'de' | 'en', schluessel: string) => text(sprache, `app.${schluessel}`).split('{')[0]!.trim();

/** Fester Stichtag des Laufs (AF-140): die App läuft mit page.clock auf diesem Tag, die Eingaben des Tests rechnen mit demselben */
let festerTag: string | undefined;
export const setzeStichtag = (tag: string | undefined): void => void (festerTag = tag);
const jetztMs = () => (festerTag ? Date.parse(`${festerTag}T12:00:00Z`) : Date.now());
export const heute = () => new Date(jetztMs()).toISOString().slice(0, 10);
export const inTagen = (n: number) => new Date(jetztMs() + n * 86_400_000).toISOString().slice(0, 10);

/** Etappe und Seite aus der aktuellen URL (#/gefuehrt/E4/E4-systeme). */
export function ortAusUrl(url: string): { etappe?: string; seite?: string } {
  const m = /#\/gefuehrt\/([^/?]+)(?:\/([^/?]+))?/.exec(url);
  return { etappe: m?.[1] ? decodeURIComponent(m[1]) : undefined, seite: m?.[2] ? decodeURIComponent(m[2]) : undefined };
}

// ---------- Start ----------

export async function neuesProjektAnlegen(page: Page, o: { isms: 'zertifiziert' | 'vorhanden' | 'nein'; modul: boolean }): Promise<void> {
  await page.click('#start-neu');
  const isms = page.locator('input[name=isms]');
  await isms.nth(['zertifiziert', 'vorhanden', 'nein'].indexOf(o.isms)).check();
  await page.locator('input[name=modul]').nth(o.modul ? 0 : 1).check();
  await page.click('#neu-anlegen');
  await expect(page).toHaveURL(/#\/gefuehrt\/E0/);
}

// ---------- Felder ausfüllen ----------

/** Wertangabe für ein Feld. Optionswerte als Werte aus optionen.yaml. */
export type Wert =
  | string
  | number
  | boolean
  | string[]
  | { person: 'erste' | 'neu' | number }
  | { freigabe: true }
  | { zeilen: Record<string, unknown>[] }
  | { verweis: 'erste' | string[] }
  | { checkliste: string };

export const feldKey = (f: FeldDef) => f.pfad ?? (f.schluessel ?? '').replace(/\.\{id\}$/, '');

let personZaehler = 0;

async function personWaehlen(feld: Locator, wahl: 'erste' | 'neu' | number = 'erste'): Promise<void> {
  const sel = feld.locator(AUSWAHL).first();
  const n = await optionenZahl(sel);
  if (wahl !== 'neu' && n > 1) {
    const index = typeof wahl === 'number' ? Math.min(wahl, n - 1) : 1;
    if ((await wertVon(sel)) === '' || typeof wahl === 'number') await waehle(sel, { index });
    return;
  }
  // Noch keine Person: «Person hinzufügen» im Feld
  personZaehler++;
  await feld.locator('button.leise').first().click();
  const karte = feld.locator('.karte').first();
  await karte.locator('input').nth(0).fill(`Erika Muster ${personZaehler}`);
  await karte.locator('input').nth(1).fill('Leitung Qualität');
  await karte.getByRole('button', { name: /Person erfassen und wählen|Create and select person/ }).click();
  await expect(sel).not.toHaveAttribute('data-wert', '');
}

async function zelleFuellen(zelle: Locator, def: FeldDef, wert: unknown): Promise<void> {
  if (def.typ === 'person') return personWaehlen(zelle, 'erste');
  if (def.typ === 'janein') return zelle.locator('input[type=radio]').nth(wert === false ? 1 : 0).check();
  if (def.typ === 'auswahl') return void (await waehle(zelle.locator(AUSWAHL), String(wert ?? OPTIONEN[def.optionen!]![0])));
  if (def.typ === 'verweis') {
    const sel = zelle.locator(AUSWAHL);
    if (await sel.count()) return void (await waehle(sel, { index: 1 }));
    return zelle.locator('input[type=checkbox]').first().check();
  }
  await zelle.locator('input, textarea').first().fill(String(wert ?? standardText(def)));
}

function standardText(f: FeldDef): string | number {
  const k = feldKey(f);
  switch (f.typ) {
    case 'zahl':
      return 3;
    case 'datum':
      return /naechste|termin|geplant|bis$|ruecklauf|ziel/i.test(k) ? inTagen(200) : heute();
    case 'zeitpunkt':
      return `${heute()}T09:00`;
    case 'text':
      return `Angabe ${k.split('.').pop()}`;
    default:
      return `Kurze, plausible Angabe zu ${k.split('.').pop()} für die Beispiel AG.`;
  }
}

/** Füllt ein Feld (Container .feld[data-feld]) mit dem angegebenen oder einem plausiblen Standardwert. */
export async function feldFuellen(feld: Locator, def: FeldDef, wert?: Wert): Promise<void> {
  const opt = def.optionen ? OPTIONEN[def.optionen] ?? [] : [];
  // Zahl mit Skala (Risikobewertung): Auswahl der Stufe statt Eingabe
  if (def.typ === 'zahl' && def.skala) {
    const radios = feld.locator('input[type=radio]');
    const n = await radios.count();
    const ziel = Math.min(n, Math.max(1, Number(wert ?? standardText(def)) || 1));
    await radios.nth(ziel - 1).check();
    return;
  }
  switch (def.typ) {
    case 'text':
    case 'textarea':
    case 'zahl':
    case 'datum':
    case 'zeitpunkt':
      await feld.locator(def.typ === 'textarea' ? 'textarea' : 'input').first().fill(String(wert ?? standardText(def)));
      return;
    case 'janein':
      await feld.locator('input[type=radio]').nth(wert === false ? 1 : 0).check();
      return;
    case 'auswahl': {
      const w = String(wert ?? opt[0]);
      const sel = feld.locator(AUSWAHL);
      if (await sel.count()) await waehle(sel.first(), w);
      else await feld.locator('input[type=radio]').nth(Math.max(0, opt.indexOf(w))).check();
      return;
    }
    case 'mehrfach': {
      const werte = (Array.isArray(wert) ? wert : [opt[0]!]) as string[];
      for (const w of werte) await feld.locator('input[type=checkbox]').nth(Math.max(0, opt.indexOf(w))).check();
      return;
    }
    case 'personen':
      await feld.locator('input[type=checkbox]').first().check();
      return;
    case 'person':
      await personWaehlen(feld, (wert as { person?: 'erste' | 'neu' | number } | undefined)?.person ?? 'erste');
      return;
    case 'freigabe':
      await personWaehlen(feld, 'erste');
      await feld.locator('input[type=date]').fill(heute());
      // Beide Teile sichtbar übernommen, bevor es weitergeht (Wackler «Prüfseite im Guide», test.7)
      await expect(feld.locator(AUSWAHL).first()).not.toHaveAttribute('data-wert', '');
      await expect(feld.locator('input[type=date]')).toHaveValue(heute());
      return;
    case 'verweis': {
      const v = (wert as { verweis?: 'erste' | string[] } | undefined)?.verweis ?? 'erste';
      const sel = feld.locator(AUSWAHL);
      if (await sel.count()) {
        if (Array.isArray(v)) await waehle(sel.first(), v[0]!);
        else await waehle(sel.first(), { index: 1 });
        return;
      }
      if (Array.isArray(v)) {
        for (const x of v) await feld.locator('label', { hasText: new RegExp(`^${x.replace(/\./g, '\\.')}\\b`) }).locator('input[type=checkbox]').check();
      } else await feld.locator('input[type=checkbox]').first().check();
      return;
    }
    case 'liste-text': {
      const eingaben = feld.locator('input[type=text]');
      if ((await eingaben.count()) === 0) await feld.locator('button.klein').first().click();
      const letzte = eingaben.last();
      if (!(await letzte.inputValue())) await letzte.fill(typeof wert === 'string' ? wert : `Grundsatz oder Angabe für ${feldKey(def).split('.').pop()}`);
      return;
    }
    case 'tabelle': {
      const zeilen = (wert as { zeilen?: Record<string, unknown>[] } | undefined)?.zeilen ?? [{}];
      const spalten = def.spalten ?? [];
      const vorhanden = await feld.locator('tbody tr').count();
      for (let i = vorhanden; i < zeilen.length; i++) {
        await feld.locator(':scope > .tabelle-feld > button, :scope .tabelle-feld > button').last().click();
        const tr = feld.locator('tbody tr').nth(i);
        for (const [j, s] of spalten.entries()) {
          const w = zeilen[i]![s.pfad!];
          if (!s.pflicht && w === undefined) continue;
          await zelleFuellen(tr.locator('td').nth(j), s, w);
        }
      }
      return;
    }
    case 'pruefliste': {
      // Erster Prüfpunkt: Nachweis und Ergebnis (Gruppe aufklappen)
      const gruppe = feld.locator('details').first();
      if (!(await gruppe.getAttribute('open'))) await gruppe.locator('summary').click();
      await gruppe.locator('input[type=text]').first().fill(typeof wert === 'string' ? wert : 'Protokoll Workshop Kontext, Version 1.0');
      await waehle(gruppe.locator(AUSWAHL).first(), 'konform');
      return;
    }
    case 'checkliste':
      await feld.locator('input[type=checkbox]').first().check();
      await feld.locator('input[type=text]').first().fill(typeof (wert as { checkliste?: string })?.checkliste === 'string' ? (wert as { checkliste: string }).checkliste : 'Ablage AIMS, Ordner Nachweise');
      return;
  }
}

/** Pflichtfeld schon ausgefüllt? (nur für einfache Felder, sonst false) */
async function istGefuellt(feld: Locator, def: FeldDef): Promise<boolean> {
  switch (def.typ) {
    case 'text':
    case 'textarea':
    case 'zahl':
    case 'datum':
    case 'zeitpunkt':
      if (def.typ === 'zahl' && def.skala) return (await feld.locator('input[type=radio]:checked').count()) > 0;
      return (await feld.locator(def.typ === 'textarea' ? 'textarea' : 'input').first().inputValue()) !== '';
    case 'auswahl': {
      const sel = feld.locator(AUSWAHL);
      if (await sel.count()) return (await wertVon(sel.first())) !== '';
      return (await feld.locator('input[type=radio]:checked').count()) > 0;
    }
    case 'janein':
      return (await feld.locator('input[type=radio]:checked').count()) > 0;
    case 'mehrfach':
    case 'personen':
      return (await feld.locator('input[type=checkbox]:checked').count()) > 0;
    case 'person':
      return (await wertVon(feld.locator(AUSWAHL).first())) !== '';
    case 'freigabe':
      return (await wertVon(feld.locator(AUSWAHL).first())) !== '' && (await feld.locator('input[type=date]').inputValue()) !== '';
    case 'verweis': {
      const sel = feld.locator(AUSWAHL);
      if (await sel.count()) return (await wertVon(sel.first())) !== '';
      return (await feld.locator('input[type=checkbox]:checked').count()) > 0;
    }
    case 'liste-text': {
      const e = feld.locator('input[type=text]');
      return (await e.count()) > 0 && (await e.first().inputValue()) !== '';
    }
    case 'tabelle':
      return (await feld.locator('tbody tr').count()) > 0;
    case 'checkliste':
      return feld.locator('input[type=checkbox]').first().isChecked();
    case 'pruefliste':
      return (await feld.locator('input[type=text]').evaluateAll((els) => els.filter((e) => (e as HTMLInputElement).value !== '').length)) > 0;
  }
}

/** Werte je Seite und Feld: «<seite>:<pfad>» oder «<pfad>»; überschreibt Standardwerte und füllt auch freiwillige Felder. */
export type Vorgaben = Record<string, Wert>;

let laufNr = 0;

/** Füllt die Felder einer Seite im Bereich «bereich» (Formular oder ein Eintrag). */
export async function felderFuellen(bereich: Locator, seite: SeiteDef, vorgaben: Vorgaben): Promise<void> {
  for (const f of seite.felder ?? []) {
    const key = feldKey(f);
    const feld = bereich.locator(`.feld[data-feld="${key}"]`).first();
    if ((await feld.count()) === 0) continue; // Bedingung nicht erfüllt
    let vorgabe = vorgaben[`${seite.id}:${key}`] ?? vorgaben[key];
    // «{id}» in einem Text: Kennung des Eintrags (Control A.9.3), damit jeder Eintrag seinen eigenen, nachvollziehbaren Text trägt (H47, AF-140)
    if (typeof vorgabe === 'string' && vorgabe.includes('{id}')) {
      const eid = ((await bereich.getAttribute('id').catch(() => null)) ?? '').replace(/^eintrag-/, '') || String(++laufNr);
      vorgabe = vorgabe.replace('{id}', eid);
    }
    if (vorgabe !== undefined) await feldFuellen(feld, f, vorgabe);
    // Kurzprüfung: nichts mehr vorbelegt (C-09); der Durchlauf antwortet «Nein», wie es die frühere Vorbelegung tat
    else if (f.pflicht && !(await istGefuellt(feld, f))) await feldFuellen(feld, f, key.startsWith('triage.') ? false : undefined);
  }
}

/**
 * Beispiel als Vorlage übernehmen. Sind schon Felder ausgefüllt, fragt die App im eigenen Dialog (V-11), ob sie ersetzt werden;
 * wie früher beim Verwerfen von confirm() durch Playwright bleiben sie stehen («Nur leere Felder füllen»).
 */
async function vorlageUebernehmen(page: Page, vorlage: Locator): Promise<void> {
  await vorlage.click();
  const nein = page.locator('#bestaetigen-nein');
  await nein.waitFor({ state: 'visible', timeout: 700 }).then(() => nein.click(), () => undefined);
}

/** Hilfe-Spalte aufklappen, wenn sie eingeklappt ist (V-16: unter 1366 px Standard) */
export async function hilfeAufklappen(page: Page): Promise<void> {
  const griff = page.locator('#hilfe-umschalten');
  if ((await griff.count()) && (await griff.isVisible()) && (await griff.getAttribute('aria-expanded')) === 'false') await griff.click();
}

// ---------- Seitenprüfung (Frage, Erklärung, Beispiel, Normabschnitt) ----------

export async function seiteHatHilfe(page: Page, sprache: 'de' | 'en', seite: SeiteDef): Promise<string[]> {
  const fehlt: string[] = [];
  const hilfe = page.locator('aside.hilfe');
  if (!(await page.locator('h1#seitentitel').textContent())?.trim()) fehlt.push('Titel');
  if ((await page.locator('.seite p.frage').count()) === 0 || !(await page.locator('.seite p.frage').textContent())?.trim()) fehlt.push('Frage');
  const warum = hilfe.locator('section', { has: page.locator('h3', { hasText: text(sprache, 'app.hilfe.warum') }) });
  if ((await warum.count()) === 0 || ((await warum.textContent()) ?? '').length < text(sprache, 'app.hilfe.warum').length + 20) fehlt.push('Erklärung (warum)');
  if (!['info', 'fahrplan', 'kalender', 'pruefung', 'vorschlaege', 'nist-profil', 'gestaltung'].includes(seite.typ)) {
    const beispiel = hilfe.locator('section', { has: page.locator('h3', { hasText: text(sprache, 'app.hilfe.beispiel') }) });
    if ((await beispiel.locator('dl dd').count()) === 0) fehlt.push('Beispiel');
  }
  const norm = uiText(sprache, 'hilfe.norm');
  if ((await hilfe.getByText(norm).count()) === 0) fehlt.push('Normabschnitt');
  return fehlt;
}

// ---------- Durchlauf einer Seite ----------

export interface Durchlauf {
  sprache: 'de' | 'en';
  vorgaben: Vorgaben;
  /** «Als Vorlage übernehmen» nutzen, wo angeboten */
  beispielUebernehmen: boolean;
  befunde: string[];
  besucht: string[];
}

async function eintragsBereiche(page: Page): Promise<Locator> {
  return page.locator('.seite > .karte section.eintrag');
}

/** Bearbeitet die aktuelle Seite und klickt «Weiter». Liefert die Seiten-ID. */
export async function seiteBearbeiten(page: Page, d: Durchlauf): Promise<string> {
  const ort = ortAusUrl(page.url());
  const etappe = ort.etappe;
  // Ohne Seite in der URL (z. B. nach dem Etappenabschluss) zeigt das Werkzeug die erste Seite der Etappe
  const sId = ort.seite ?? ETAPPEN.find((e) => e.id === etappe)?.seiten[0];
  const seite = SEITEN.get(sId ?? '');
  if (!seite || !etappe) throw new Error(`Unbekannte Seite: ${page.url()}`);
  await expect(page.locator('h1#seitentitel')).toBeVisible();
  d.besucht.push(seite.id);
  const fehlt = await seiteHatHilfe(page, d.sprache, seite);
  if (fehlt.length) d.befunde.push(`${seite.id}: fehlt ${fehlt.join(', ')}`);

  const karte = page.locator('.seite > .karte');
  const vorlage = page.locator('aside.hilfe button', { hasText: text(d.sprache, 'app.hilfe.als_vorlage') });
  // Hilfe-Spalte unter 1366 px eingeklappt (V-16): für «Als Vorlage übernehmen» aufklappen
  if (d.beispielUebernehmen) await hilfeAufklappen(page);
  const startwerte = karte.getByRole('button', { name: text(d.sprache, 'app.gefuehrt.startwerte') });
  const neu = karte.getByRole('button', { name: text(d.sprache, 'app.gefuehrt.eintrag_neu'), exact: true });

  if (seite.typ === 'formular') {
    if (d.beispielUebernehmen && (await vorlage.count())) await vorlageUebernehmen(page, vorlage);
    await felderFuellen(karte, seite, d.vorgaben);
  } else if (['liste', 'auswahl-systeme', 'folgenabschaetzung', 'soa'].includes(seite.typ)) {
    const eintraege = await eintragsBereiche(page);
    const gross = karte.locator('.vliste');
    if ((await eintraege.count()) === 0 && (await gross.count()) === 0) {
      if (await startwerte.count()) await startwerte.click();
      else if (await neu.count()) {
        if (d.beispielUebernehmen && (await vorlage.count())) await vorlageUebernehmen(page, vorlage);
        else await neu.click();
      }
    }
    if (await gross.count()) {
      // Grosse Liste (z. B. 38 Controls): Einträge nacheinander über die Tastatur wählen und bearbeiten
      await gross.focus();
      await gross.press('Home');
      let vorher = '';
      for (let i = 0; i < 400; i++) {
        await gross.press('Enter');
        const aktiv = (await gross.getAttribute('aria-activedescendant')) ?? '';
        if (aktiv === vorher) break;
        vorher = aktiv;
        await expect(karte.locator('section.eintrag')).toHaveCount(1);
        await felderFuellen(karte.locator('section.eintrag'), seite, d.vorgaben);
        await gross.focus();
        await gross.press('ArrowDown');
      }
    } else {
      const n = await eintraege.count();
      for (let i = 0; i < n; i++) await felderFuellen(eintraege.nth(i), seite, d.vorgaben);
    }
  }
  // Weiter: ohne Warnung zur nächsten Seite
  const url = page.url();
  await karte.locator('.knoepfe button.weiter').click();
  const warnung = karte.locator('[role=alert]');
  await page.waitForFunction((u) => location.href !== u || !!document.querySelector('.seite [role=alert]'), url);
  if (await warnung.count()) {
    const offen = await karte.locator('.feld.fehlt').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset['feld'] ?? '?'));
    throw new Error(`${seite.id}: Pflichtangaben nicht erfüllbar oder nicht gefüllt: ${offen.join(', ') || (await warnung.textContent())}`);
  }
  return seite.id;
}

/** Abschluss einer Etappe: Checkliste abhaken, weiter zur nächsten Etappe. */
export async function abschlussBearbeiten(page: Page): Promise<void> {
  const karte = page.locator('.seite > .karte');
  // Titel im Seitenkopf über der Karte (U-34)
  await expect(page.locator('.gefuehrt > .seitenkopf h1')).toBeVisible();
  // Die Seite des Abschlusses ist erst gerendert, wenn der Abschnitt «Offen» steht (sonst zählt der Lauf null Kästchen)
  await expect(karte.locator('section ul.befunde, section p.hinweis.ok').first()).toBeVisible();
  const boxen = karte.locator('section input[type=checkbox]');
  const n = await boxen.count();
  for (let i = 0; i < n; i++) {
    await boxen.nth(i).check();
    await karte.locator('section input[type=text]').nth(i).fill('Ablage AIMS, Protokoll AIMS-Team');
  }
  const offen = karte.locator('ul.befunde li');
  // Der Stand folgt den Eingaben mit kurzer Verzögerung (Abgleich nach dem Tippen): erst dann zählen
  await expect(offen).toHaveCount(0, { timeout: 2_000 }).catch(async () => {
    // Ursache für die Meldung: Befunde der Prüfung (der Guide nennt eine Seite erst «erledigt», wenn die Prüfung zufrieden ist, AF-139)
    const etappe = ortAusUrl(page.url()).etappe;
    const punkte = (await offen.allTextContents()).join(' | ');
    await page.evaluate(() => (location.hash = '#/gefuehrt/E13/E13-pruefung'));
    await page.locator('[data-bereitschaft]').waitFor({ timeout: 5_000 }).catch(() => undefined);
    const befunde = (await page.locator('.befunde li').allTextContents()).map((b) => b.replace(/\s+/g, ' ').trim());
    throw new Error(`Etappe ${etappe} mit offenen Punkten: ${punkte}. Befunde der Prüfung: ${befunde.join(' | ') || 'keine'}`);
  });
  await karte.locator('.knoepfe button.weiter').click();
}
