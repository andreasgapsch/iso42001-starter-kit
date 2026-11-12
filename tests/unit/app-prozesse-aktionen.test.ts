// AF-048: Schreibaktionen und Auswahl der Prozesse im Werkzeug (src/app/logik/prozesse.ts) auf dem Zustand ohne Browser.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const REPO = join(import.meta.dirname, '..', '..');
const json = (rel: string) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
const { setzeAppDaten } = await import('../../src/app/daten.ts');
setzeAppDaten({
  texte: { de: ladeTexte('de'), en: ladeTexte('en') }, kataloge: ladeKataloge(), gefuehrt: json('src/generiert/gefuehrt.json'),
  regeln: { regeln: parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')).regeln }, version: '1.0.0', gebaut: '', beispiele: [],
});
const { uiSprache } = await import('../../src/app/i18n.ts');
uiSprache.value = 'de';
const { zustand } = await import('../../src/app/zustand/store.ts');
const P = await import('../../src/app/logik/prozesse.ts');

const frisch = (): Projekt => {
  const p = JSON.parse(JSON.stringify(vollstaendigesProjekt())) as Projekt;
  delete p.prozesse;
  delete p.eigeneProzesse;
  zustand.laden(p, false);
  return p;
};
const aktuell = (): Projekt => zustand.projekt.value!;

describe('Prozesse: Auswahl und Texte', () => {
  it('Katalog, Projektprozesse und Stände', () => {
    const p = frisch();
    expect(P.katalogProzesse().length).toBeGreaterThan(10);
    expect(P.prozesseDesProjekts(p).length).toBeGreaterThanOrEqual(P.katalogProzesse().length - 1);
    expect(P.staende(p, '2026-11-07').length).toBeGreaterThan(0);
  });
  it('reifeText kennt jede Stufe und fällt bei unbekannter Stufe auf Stufe 0 zurück', () => {
    for (const r of [0, 1, 2, 3, 4] as const) expect(P.reifeText(r).length).toBeGreaterThan(0);
    expect(P.reifeText(99)).toBe(P.reifeText(0));
    expect(P.REIFE_TON).toHaveLength(5);
  });
  it('rollenAuswahl bietet jeden Text einmal an, sortiert', () => {
    const r = P.rollenAuswahl();
    expect(r.length).toBeGreaterThan(3);
    const texte = r.map((x) => x.text.trim().toLowerCase());
    expect(new Set(texte).size).toBe(texte.length);
    expect(r.map((x) => x.text)).toEqual([...r.map((x) => x.text)].sort((a, b) => a.localeCompare(b, 'de')));
  });
});

describe('Prozesse: Einträge und Reife', () => {
  it('prozessFeld legt den Eintrag sortiert an, setzt und löscht Felder; leere Angaben entfallen', () => {
    frisch();
    P.prozessFeld('PR-09', 'reife', 2);
    P.prozessFeld('PR-02', 'reife', 1);
    expect(aktuell().prozesse!.map((e) => e.id)).toEqual(['PR-02', 'PR-09']);
    expect(aktuell().prozesse!.find((e) => e.id === 'PR-09')!.reife).toBe(2);
    P.prozessFeld('PR-09', 'reife', undefined);
    expect(aktuell().prozesse!.find((e) => e.id === 'PR-09')).not.toHaveProperty('reife');
    P.prozessAendern('PR-02', (e) => {
      e.eigner = '';
    });
    expect(aktuell().prozesse!.find((e) => e.id === 'PR-02')).not.toHaveProperty('eigner');
  });
  it('Vorschläge aus dem Guide: nur Prozesse ohne eigene Einstufung, Reife «definiert» mit Datum', () => {
    const p = frisch();
    const mit = P.katalogProzesse().find((k) => k.gefuehrt_option)!;
    p.meta.gefuehrt.antworten['aimsProzesse'] = [mit.gefuehrt_option!];
    expect(P.vorschlaegeAusGefuehrt(p)).toEqual(P.katalogProzesse().filter((k) => k.gefuehrt_option === mit.gefuehrt_option).map((k) => k.id));
    expect(P.vorschlaegeAusGefuehrt({ ...p, prozesse: [{ id: mit.id, reife: 3 }] })).not.toContain(mit.id);
    p.meta.gefuehrt.antworten['aimsProzesse'] = undefined as never;
    expect(P.vorschlaegeAusGefuehrt(p)).toEqual([]);
    frisch();
    P.prozessFeld(mit.id, 'reife', 3);
    P.vorschlaegeUebernehmen([mit.id, 'PR-13'], '2026-11-07');
    const liste = aktuell().prozesse!;
    expect(liste.find((e) => e.id === mit.id)!.reife).toBe(3);
    expect(liste.find((e) => e.id === 'PR-13')).toMatchObject({ reife: 1, reifeAm: '2026-11-07' });
  });
  it('prozesseStarten legt die leere Liste an und lässt eine vorhandene stehen', () => {
    frisch();
    P.prozesseStarten();
    expect(aktuell().prozesse).toEqual([]);
    P.prozessFeld('PR-02', 'reife', 1);
    P.prozesseStarten();
    expect(aktuell().prozesse).toHaveLength(1);
  });
});

describe('Prozesse: eigene Prozesse', () => {
  it('anlegen: Eintrag, Ablauf mit Start, Schritt und Ende in den Bahnen; ohne Wahl die AIMS-Verantwortliche', () => {
    frisch();
    const id = P.eigenenProzessAnlegen({ titel: 'Eigener' } as never, []);
    expect(id).toMatch(/^PE-/);
    const e = aktuell().prozesse!.find((x) => x.id === id)!;
    expect(e.schritte!.map((s) => s.art)).toEqual(['start', 'aufgabe', 'ende']);
    expect(e.bahnen).toEqual([{ id: 'aims', rolle: 'aims' }]);
    const id2 = P.eigenenProzessAnlegen({ titel: 'Zwei' } as never, ['it', 'recht']);
    const e2 = aktuell().prozesse!.find((x) => x.id === id2)!;
    expect(e2.schritte![0]!.bahn).toBe('it');
    expect(e2.schritte![1]!.bahn).toBe('recht');
    expect(aktuell().eigeneProzesse).toHaveLength(2);
  });
  it('ändern: Zweck und Normbezug entfallen, wenn leer; unbekannte Kennung ändert nichts', () => {
    frisch();
    const id = P.eigenenProzessAnlegen({ titel: 'A', zweck: 'Z', normbezug: ['x'] } as never, []);
    P.eigenenProzessAendern(id, (e) => {
      e.zweck = '';
      e.normbezug = [];
      e.titel = 'B';
    });
    const e = aktuell().eigeneProzesse!.find((x) => x.id === id)!;
    expect(e.titel).toBe('B');
    expect(e).not.toHaveProperty('zweck');
    expect(e).not.toHaveProperty('normbezug');
    const vorher = JSON.stringify(aktuell().eigeneProzesse);
    P.eigenenProzessAendern('PE-99', (x) => {
      x.titel = 'Nie';
    });
    expect(JSON.stringify(aktuell().eigeneProzesse)).toBe(vorher);
  });
  it('löschen: Eintrag, Stand, Ablauf und Bezug im Auditumfang verschwinden', () => {
    const p = frisch();
    const id = P.eigenenProzessAnlegen({ titel: 'Weg' } as never, []);
    zustand.aendereMit((q) => {
      if (q.audits[0]) q.audits[0].umfangProzesse = [id, 'PR-02'];
    });
    P.eigenenProzessLoeschen(id);
    expect(aktuell().eigeneProzesse).toBeUndefined();
    expect(aktuell().prozesse!.some((x) => x.id === id)).toBe(false);
    if (p.audits[0]) expect(aktuell().audits[0]!.umfangProzesse).toEqual(['PR-02']);
    P.eigenenProzessLoeschen('PE-99');
    frisch();
    P.eigenenProzessLoeschen('PE-01');
    expect(aktuell().prozesse).toBeUndefined();
  });
});

describe('Prozesse: Bahnen und Schritte', () => {
  const eigener = () => {
    frisch();
    const id = P.eigenenProzessAnlegen({ titel: 'Ablauf' } as never, ['it', 'recht']);
    return { id, kp: P.prozesseDesProjekts(aktuell()).find((k) => k.id === id)! };
  };
  const eintrag = (id: string) => aktuell().prozesse!.find((x) => x.id === id)!;

  it('offeneBahnen: nur Bahnen ohne Rolle, die Schritte tragen oder offen blieben', () => {
    expect(P.offeneBahnen(undefined)).toEqual([]);
    expect(P.offeneBahnen({ id: 'x' })).toEqual([]);
    const e = {
      id: 'x', schritte: [{ id: 'x.01', art: 'aufgabe', text: 't', bahn: 'b1' }],
      bahnen: [{ id: 'b1' }, { id: 'b2' }, { id: 'b3', rolle: 'it' }],
      drawio: { offen: { bahnen: ['b2'], formen: [] } },
    } as never;
    expect(P.offeneBahnen(e).map((b) => b.id)).toEqual(['b1', 'b2']);
  });
  it('bahnRolleSetzen: Rolle setzen schliesst die offene Bahn, Rolle entfernen löscht sie', () => {
    const { id } = eigener();
    P.prozessAendern(id, (e) => {
      e.bahnen!.push({ id: 'neu' });
      e.drawio = { offen: { bahnen: ['neu'], formen: ['f'] } } as never;
    });
    P.bahnRolleSetzen(id, 'neu', 'it');
    expect(eintrag(id).bahnen!.find((b) => b.id === 'neu')!.rolle).toBe('it');
    expect(eintrag(id).drawio!.offen!.bahnen).toEqual([]);
    expect(eintrag(id).drawio!.offen!.formen).toEqual(['f']);
    P.bahnRolleSetzen(id, 'neu', undefined);
    expect(eintrag(id).bahnen!.find((b) => b.id === 'neu')).not.toHaveProperty('rolle');
    P.bahnRolleSetzen(id, 'gibt-es-nicht', 'it');
    P.prozessAendern(id, (e) => {
      e.drawio!.offen!.formen = [];
    });
    P.bahnRolleSetzen(id, 'neu', 'it');
    expect(eintrag(id).drawio).not.toHaveProperty('offen');
  });
  it('formenGeprueft: Formen leer; ohne Bahnen entfällt der Vermerk', () => {
    const { id } = eigener();
    P.formenGeprueft(id);
    P.prozessAendern(id, (e) => {
      e.drawio = { offen: { bahnen: ['b'], formen: ['f'] } } as never;
    });
    P.formenGeprueft(id);
    expect(eintrag(id).drawio!.offen).toEqual({ bahnen: ['b'], formen: [] });
    P.prozessAendern(id, (e) => {
      e.drawio!.offen!.bahnen = [];
    });
    P.formenGeprueft(id);
    expect(eintrag(id).drawio).not.toHaveProperty('offen');
  });
  it('schrittHinzufuegen hält den Ablauf durchgehend; schrittEntfernen verbindet Vorgänger mit Nachfolgern', () => {
    const { id, kp } = eigener();
    const neu = P.schrittHinzufuegen(kp, 1);
    expect(neu).toBe(`${id}.02`);
    let s = eintrag(id).schritte!;
    expect(s.map((x) => x.id)).toEqual([`${id}.00`, `${id}.01`, `${id}.02`, `${id}.90`]);
    expect(s[1]!.naechste).toEqual([`${id}.02`]);
    expect(s[2]!.naechste).toEqual([`${id}.90`]);
    // nach dem Ende bleibt der neue Schritt unverbunden, in der Bahn des Vorgängers
    const kp2 = P.prozesseDesProjekts(aktuell()).find((k) => k.id === id)!;
    const nach = P.schrittHinzufuegen(kp2, 3);
    s = eintrag(id).schritte!;
    expect(s.at(-1)!.id).toBe(nach);
    expect(s.at(-1)!.naechste).toBeUndefined();
    // ausserhalb des Bereichs: Bahn «aims»
    P.schrittHinzufuegen(P.prozesseDesProjekts(aktuell()).find((k) => k.id === id)!, 99);
    expect(eintrag(id).schritte!.at(-1)!.bahn).toBe('aims');
    // Entfernen des mittleren Schritts
    const kp3 = P.prozesseDesProjekts(aktuell()).find((k) => k.id === id)!;
    const index = eintrag(id).schritte!.findIndex((x) => x.id === neu);
    P.schrittEntfernen(kp3, index);
    s = eintrag(id).schritte!;
    expect(s.some((x) => x.id === neu)).toBe(false);
    expect(s.find((x) => x.id === `${id}.01`)!.naechste).toEqual([`${id}.90`]);
    P.schrittEntfernen(P.prozesseDesProjekts(aktuell()).find((k) => k.id === id)!, 99);
  });
  it('schrittEntfernen reicht die Zweigtexte einer Entscheidung an die Nachfolger weiter', () => {
    const { id, kp } = eigener();
    P.prozessAendern(id, (e) => {
      e.schritte = [
        { id: `${id}.00`, art: 'start', text: 's', bahn: 'it', naechste: [`${id}.01`] },
        { id: `${id}.01`, art: 'entscheidung', text: 'e', bahn: 'it', naechste: [`${id}.02`, `${id}.90`], zweige: { [`${id}.02`]: 'ja', [`${id}.90`]: 'nein' } },
        { id: `${id}.02`, art: 'aufgabe', text: 'a', bahn: 'it', naechste: [`${id}.90`] },
        { id: `${id}.90`, art: 'ende', text: 'z', bahn: 'it' },
      ] as never;
    });
    P.schrittEntfernen(P.prozesseDesProjekts(aktuell()).find((k) => k.id === kp.id)!, 2);
    const e = eintrag(id).schritte!.find((x) => x.id === `${id}.01`)!;
    expect(e.naechste).toEqual([`${id}.90`]);
    expect(e.zweige).toEqual({ [`${id}.90`]: 'nein' });
  });
});
