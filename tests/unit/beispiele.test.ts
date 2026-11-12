// Beispielprojekte DE und EN: schemagültig, ohne Fehler der Prüfregeln, und jede `beispiel`-Referenz des Guides
// zeigt im Beispiel Muster Maschinenbau AG auf einen vorhandenen Wert. EN: gleiche Struktur und Daten wie DE, Freitexte englisch.
import { readdirSync, readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { auftraege } from '../../scripts/beispiele.mts';
import { istFreitext } from '../../src/beispiele/bau/englisch.mts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { pruefeProjekt, type Regel } from '../../src/regeln/pruefungen.ts';
import { CONTROLS_42001 } from '../fixtures/projekt.ts';
import { ERWARTET_BIS_P15 } from '../fixtures/erwartet-p15.ts';

const json = <T>(pfad: string): T => JSON.parse(readFileSync(pfad, 'utf8')) as T;
const BEISPIELE = {
  muster: 'src/beispiele/muster-maschinenbau.de.aims.json',
  praezision: 'src/beispiele/praezisionsteile.de.aims.json',
  'muster EN': 'src/beispiele/muster-maschinenbau.en.aims.json',
  'praezision EN': 'src/beispiele/praezisionsteile.en.aims.json',
} as const;
const PAARE = [
  ['muster', BEISPIELE.muster, BEISPIELE['muster EN']],
  ['praezision', BEISPIELE.praezision, BEISPIELE['praezision EN']],
] as const;
const regeln = (parse(readFileSync('src/regeln/pruefregeln.yaml', 'utf8')) as { regeln: Regel[] }).regeln;
const ajv = new Ajv({ allErrors: true, strict: false });
const validiere = ajv.compile(json<object>('src/generiert/projekt.schema.json'));

/** Liest einen Punktpfad mit Indizes, z. B. kiSysteme[7] oder meta.gefuehrt.antworten.projekt.freigabe */
function lies(objekt: unknown, pfad: string): unknown {
  return pfad.split('.').reduce<unknown>((o, teil) => {
    const m = /^([^[\]]+)(?:\[(\d+)\])?$/.exec(teil);
    if (!m || o === null || typeof o !== 'object') return undefined;
    const wert = (o as Record<string, unknown>)[m[1]!];
    return m[2] === undefined ? wert : Array.isArray(wert) ? wert[Number(m[2])] : undefined;
  }, objekt);
}

describe.each(Object.entries(BEISPIELE))('Beispiel %s', (_name, datei) => {
  const p = json<Projekt>(datei);

  it('ist schemagültig (keine zusätzlichen Felder, alle Pflichtfelder)', () => {
    const ok = validiere(p);
    expect(ok, JSON.stringify(validiere.errors?.slice(0, 5))).toBe(true);
  });

  it('löst keine Fehler der Prüfregeln aus, höchstens 2 Hinweise; Prozessbefunde wie geplant (Plan Prozesse 7)', () => {
    const befunde = pruefeProjekt(regeln, { projekt: p, heute: '2027-02-15', controlIds42001: CONTROLS_42001, aiActStand: '2026-07-27', kataloge: ladeKataloge() });
    // Runde 2b (P11): Die neuen Regeln F34 bis F43 finden die Befunde der Auditrunde 3 in den Beispielen. Sie stehen hier
    // einzeln als erwartete Treffer, bis P15a (Präzision) und P15b (Muster) die Beispiele korrigieren; danach ist die Liste leer.
    const erwartet = ERWARTET_BIS_P15[_name.startsWith('muster') ? 'muster' : 'praezision'];
    const neu = befunde.filter((b) => erwartet.includes(`${b.schwere} ${b.regel} ${b.id ?? ''}`));
    expect(neu.map((b) => `${b.schwere} ${b.regel} ${b.id ?? ''}`).sort()).toEqual([...erwartet].sort());
    expect(befunde.filter((b) => b.schwere === 'fehler' && !neu.includes(b)).map((b) => `${b.regel} ${b.id ?? ''}`)).toEqual([]);
    const prozess = befunde.filter((b) => b.ziel.startsWith('prozesse/') && !neu.includes(b));
    expect(befunde.filter((b) => b.schwere === 'hinweis' && !prozess.includes(b) && !neu.includes(b)).length).toBeLessThanOrEqual(2);
    // Stage-1-Runde 6: Die früher bewusst offenen Prozessbefunde (H55, H59, H56, H58) sind bereinigt; ein Auditor fände
    // sie als Nichtkonformität (überfälliger Prozess ohne Entscheid, Reife ohne Grundlage). Keine Prozessbefunde mehr.
    expect(prozess.map((b) => `${b.regel} ${b.id}`)).toEqual([]);
  });

  it('führt Prozesse: alle AIMS-Prozesse mit Eigner, gültige Personen, Kennzahlen, Nachweise und Massnahmen', () => {
    expect(p.prozesse?.length).toBeGreaterThan(20);
    const personen = new Set(p.personen.map((x) => x.id));
    const kennzahlen = new Set([...p.ziele.map((z) => z.id), ...(p.kennzahlen ?? []).map((k) => k.id), ...(p.kennzahlMessungen ?? []).map((k) => k.kennzahl)]);
    const nachweise = new Set(p.nachweise.map((n) => n.id));
    for (const e of p.prozesse ?? []) {
      if (e.eigner) expect(personen.has(e.eigner), e.id).toBe(true);
      if (e.stellvertretung) expect(personen.has(e.stellvertretung), e.id).toBe(true);
      if (e.kennzahl) expect(kennzahlen.has(e.kennzahl), `${e.id} ${e.kennzahl}`).toBe(true);
      for (const n of e.nachweise ?? []) expect(nachweise.has(n), `${e.id} ${n}`).toBe(true);
      if (e.anwendbar === 'nein') expect(e.begruendung?.trim(), e.id).toBeTruthy();
    }
    if (_name.startsWith('muster')) {
      // Rundreise draw.io: PR-07 mit Rohdaten (Notiz, zweite Ebene) und eigenem Ablauf
      const pr07 = p.prozesse!.find((x) => x.id === 'PR-07')!;
      expect(pr07.drawio?.roh).toContain('ebene-hinweise');
      // Katalogablauf mit eigenem Text und Zweig zur Geschäftsleitung (Entscheidungsrechte D-04): 13 Schritte
      expect(pr07.schritte?.length).toBe(13);
      expect(p.prozesse!.filter((x) => x.id.startsWith('PS-')).every((x) => !!x.ismsVerweis)).toBe(true);
    }
  });

  it('verweist nur auf vorhandene Personen, KI-Systeme, Massnahmen und Nachweise', () => {
    const ids = (liste: { id: string }[]) => new Set(liste.map((x) => x.id));
    const personen = ids(p.personen);
    const ki = ids(p.kiSysteme);
    const massnahmen = ids(p.massnahmen);
    const nachweise = ids(p.nachweise);
    for (const s of p.kiSysteme) expect(personen.has(s.eigner ?? ''), s.id).toBe(true);
    for (const r of p.risiken) {
      if (r.kiSystem) expect(ki.has(r.kiSystem), r.id).toBe(true);
      for (const m of r.massnahmen) expect(massnahmen.has(m), `${r.id} ${m}`).toBe(true);
    }
    for (const c of p.controls) for (const n of c.nachweise) expect(nachweise.has(n), `${c.id} ${n}`).toBe(true);
    for (const f of p.folgenabschaetzungen) expect(ki.has(f.kiSystem), f.id).toBe(true);
    for (const m of p.massnahmen) if (m.verantwortlich) expect(personen.has(m.verantwortlich), m.id).toBe(true);
  });

  // Stage-1-Audit 2 (P17): Projektdaten landen wörtlich in Firmendokumenten; sie nennen weder Kit, Leitfaden und Werkzeug
  // noch Modulschalter oder Etappen (z. B. «Kit mit Leitfaden», «da Modul ausgeschaltet», «Vermerk E5»). meta ist Arbeitsstand.
  it('Projektdaten ohne Kit-, Modul- und Werkzeugsprache', () => {
    // «ERP-Modul» oder «KI-Modul» einer Software sind Fachbegriffe; gemeint ist das Modul AI Act des Kits und sein Schalter
    const MUSTER_DATEN =
      /\bAI-Act-Modul\w*|\bModul (?:EU )?AI Act\b|\b(?:im|da|das) Modul\b|\bModul(?:s)? (?:ein|aus)geschaltet|\bAI Act module\b|\b(?:in|as) the module\b|\bthe module is\b|\b[Kk]it\b|Starter-Kit|\bLeitfaden\b|\b[Gg]uides?\b|AIMS-Manager|AIMS Manager|Geführte[nrm]? Modus|[Gg]uided mode|\bEtappe\w*|(?<![\w-])E\d{1,2}(?![\w-])/;
    const { meta: _meta, ...daten } = p;
    // Rohdaten der draw.io-Seite (prozesse[].drawio) sind technische Daten mit Attributnamen wie kit, kitProzess
    const treffer = werte(daten)
      .filter((w) => typeof w.wert === 'string' && !/\.drawio\./.test(w.pfad) && MUSTER_DATEN.test(w.wert))
      .map((w) => `${w.pfad}: ${String(w.wert).slice(0, 120)}`);
    expect(treffer).toEqual([]);
  });

  it('enthält kein Eszett, keine Gedankenstriche und keinen Kit-Absender', () => {
    const text = readFileSync(datei, 'utf8');
    expect(text).not.toMatch(/\u00df|[\u2013\u2014]/);
    expect(text).not.toMatch(/kmu-cio/i);
  });
});

/** Alle Werte mit Pfad und Schlüssel, in Dokumentreihenfolge */
function werte(objekt: unknown, pfad = '', schluessel = ''): { pfad: string; schluessel: string; wert: unknown }[] {
  if (Array.isArray(objekt)) return objekt.flatMap((w, i) => werte(w, `${pfad}[${i}]`, schluessel));
  if (objekt && typeof objekt === 'object') return Object.entries(objekt).flatMap(([k, v]) => werte(v, pfad ? `${pfad}.${k}` : k, k));
  return [{ pfad, schluessel, wert: objekt }];
}

// Eigennamen (Firmen, Personen), die Umlaute enthalten oder deutsch klingen und in EN bleiben
const EIGENNAMEN = ['Beispiel Präzisionsteile GmbH', 'Muster Maschinenbau Deutschland GmbH', 'Muster Maschinenbau AG', 'Martin Zürcher', 'Jonas Kälin'];
const DEUTSCH = /\b(und|der|die|das|mit|für|oder|nicht|werden|wird|bei|auf|ist|sind|eine?|zur|zum|nach|über)\b|[äöüÄÖÜ«»]/;

describe.each(PAARE)('Englische Fassung %s', (_name, de, en) => {
  const pDe = json<Projekt>(de);
  const pEn = json<Projekt>(en);
  const wDe = werte(pDe);
  const wEn = werte(pEn);

  it('hat Dokumentsprache en und eine eigene Projekt-ID', () => {
    expect(pEn.meta.dokumentSprache).toBe('en');
    expect(pEn.meta.projektId).not.toBe(pDe.meta.projektId);
  });

  it('hat dieselbe Struktur, dieselben IDs, Daten und Beziehungen wie DE', () => {
    expect(wEn.map((w) => w.pfad)).toEqual(wDe.map((w) => w.pfad));
    const abweichend = wDe.filter((w, i) => {
      const e = wEn[i]!.wert;
      if (w.pfad === 'meta.projektId' || w.pfad === 'meta.dokumentSprache') return false;
      // Ablauf aus draw.io je Sprache erzeugt: Beschriftung der Zweige und Rohdaten der Seite mit Prüfsumme
      if (/\.drawio\.|\.zweige\./.test(w.pfad)) return false;
      if (typeof w.wert === 'string' && (istFreitext(w.schluessel, w.wert) || /^\d+(,\d+)? %$/.test(w.wert))) return false;
      return e !== w.wert;
    });
    expect(abweichend.map((w) => w.pfad)).toEqual([]);
  });

  it('übersetzt jeden Freitext (ausser Eigennamen)', () => {
    const gleich = wDe.filter((w, i) => typeof w.wert === 'string' && istFreitext(w.schluessel, w.wert) && wEn[i]!.wert === w.wert && DEUTSCH.test(w.wert) && !EIGENNAMEN.includes(w.wert));
    expect(gleich.map((w) => `${w.pfad}: ${String(w.wert)}`)).toEqual([]);
  });

  it('enthält keine deutschen Reste, deutschen Datumsangaben oder Zahlenformate', () => {
    const reste = wEn.filter((w) => {
      if (typeof w.wert !== 'string' || !istFreitext(w.schluessel, w.wert)) return false;
      const t = EIGENNAMEN.reduce((s, n) => s.replaceAll(n, ''), w.wert);
      return DEUTSCH.test(t) || /\b\d{1,2}\.\d{1,2}\.\d{4}\b/.test(t) || /\d,\d+ ?%|\d %/.test(t) || /\bCHF \d+ \d{3}\b/.test(t);
    });
    expect(reste.map((w) => `${w.pfad}: ${String(w.wert)}`)).toEqual([]);
  });

  it('hält die englischen Stilregeln ein (-ize, keine Gedankenstriche)', () => {
    expect(readFileSync(en, 'utf8')).not.toMatch(/[\u2013\u2014]/);
    const text = wEn.filter((w) => typeof w.wert === 'string' && istFreitext(w.schluessel, w.wert)).map((w) => w.wert).join('\n');
    expect(text).not.toMatch(/\b(organis|recogn?is|prioritis|summaris|minimis|optimis|categoris|anonymis|authoris|realis|characteris)(e|ed|es|ing|ation)\b/i);
  });
});

/** Platzhalter im IR: markierte Läufe und [[...]] in Texten */
function platzhalter(ir: unknown): string[] {
  const t: string[] = [];
  const geh = (o: unknown): void => {
    if (typeof o === 'string') for (const m of o.matchAll(/\[\[(.+?)\]\]/g)) t.push(m[1]!);
    else if (Array.isArray(o)) o.forEach(geh);
    else if (o && typeof o === 'object') {
      const r = o as Record<string, unknown>;
      if (r['platzhalter'] === true && typeof r['text'] === 'string') t.push(r['text']);
      else Object.values(r).forEach(geh);
    }
  };
  geh(ir);
  return t;
}

describe('Firmendokumente der Beispiele', () => {
  const kataloge = ladeKataloge();
  const anzahl = (datei: string): number => {
    const p = json<Projekt>(datei);
    const sprache = p.meta.dokumentSprache;
    const u = erstelleUebersetzer(sprache, ladeTexte(sprache));
    return auftraege(p, sprache).reduce((n, a) => n + platzhalter(a.vorlage({ u, modus: 'firma', form: a.form, projekt: p, kataloge, kitVersion: 'test', ...(a.kiSystemId ? { kiSystemId: a.kiSystemId } : {}) })).length, 0);
  };
  it.each(PAARE)('%s: EN höchstens 2 Platzhalter und nicht mehr als DE', (_name, de, en) => {
    const nEn = anzahl(en);
    expect(nEn).toBeLessThanOrEqual(2);
    expect(nEn).toBeLessThanOrEqual(anzahl(de));
  });
});

describe.each([['DE', BEISPIELE.muster], ['EN', BEISPIELE['muster EN']]])('beispiel-Referenzen im Guide (%s)', (_sprache, datei) => {
  const muster = json<Projekt>(datei);
  const referenzen = readdirSync('src/gefuehrt/seiten').flatMap((d) =>
    ((parse(readFileSync(`src/gefuehrt/seiten/${d}`, 'utf8')) as { seiten: { id: string; beispiel?: string }[] }).seiten)
      .filter((s) => s.beispiel)
      .map((s) => [s.id, s.beispiel!] as const),
  );

  it('gibt es', () => expect(referenzen.length).toBeGreaterThan(50));
  it.each(referenzen)('%s: %s', (_seite, pfad) => {
    const wert = lies(muster, pfad);
    expect(wert).not.toBeUndefined();
    expect(wert).not.toBeNull();
  });
});
