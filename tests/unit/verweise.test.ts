// Verweisregister (AF-008): Register gegen Schema, je Verweisart eine präparierte Datei, Prüfregel F33 «Verweis zeigt ins Leere».
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import { alleControls42001 } from '../../src/kataloge/typen.ts';
import { ID_PRAEFIX, type Projekt } from '../../src/model/typen.ts';
import { KEIN_VERWEIS, VERWEISE, haengendeVerweise, stellen, type Verweisart, type Zielliste } from '../../src/model/verweise.ts';
import { PRUEFUNGEN, pruefeProjekt, type Regel } from '../../src/regeln/pruefungen.ts';
import { CONTROLS_42001 } from '../fixtures/projekt.ts';

type Objekt = Record<string, unknown>;
const BEISPIELE = ['muster-maschinenbau.de', 'muster-maschinenbau.en', 'praezisionsteile.de', 'praezisionsteile.en'];
const lade = (name: string) => JSON.parse(readFileSync(join(process.cwd(), 'src', 'beispiele', `${name}.aims.json`), 'utf8')) as Projekt;
const basis = lade('praezisionsteile.de');
const kataloge = ladeKataloge();

// ---- Schema lesen: alle Blattfelder (Zeichenketten, Listen von Zeichenketten, PersonId) mit Pfad wie im Register ----
interface SchemaKnoten { $ref?: string; anyOf?: SchemaKnoten[]; oneOf?: SchemaKnoten[]; allOf?: SchemaKnoten[]; type?: string; enum?: unknown[]; items?: SchemaKnoten; properties?: Record<string, SchemaKnoten>; additionalProperties?: boolean | SchemaKnoten }
const schema = JSON.parse(readFileSync(join(process.cwd(), 'src', 'generiert', 'projekt.schema.json'), 'utf8')) as { $ref: string; definitions: Record<string, SchemaKnoten> };
const blaetter: { pfad: string; art: 'PersonId' | 'string' }[] = [];
(function lauf(k: SchemaKnoten | undefined, pfad: string, gesehen: string[]): void {
  if (!k) return;
  if (k.$ref) {
    const n = k.$ref.split('/').pop()!;
    if (n === 'PersonId') return void blaetter.push({ pfad, art: 'PersonId' });
    if (!gesehen.includes(n)) lauf(schema.definitions[n], pfad, [...gesehen, n]);
    return;
  }
  const alt = k.anyOf ?? k.oneOf ?? k.allOf;
  if (alt) return alt.forEach((x) => lauf(x, pfad, gesehen));
  if (k.type === 'array') return lauf(k.items, `${pfad}[]`, gesehen);
  if (k.properties) for (const [n, v] of Object.entries(k.properties)) lauf(v, pfad ? `${pfad}.${n}` : n, gesehen);
  if (k.additionalProperties && typeof k.additionalProperties === 'object') lauf(k.additionalProperties, `${pfad}{}`, gesehen);
  if (k.type === 'string' && !k.enum) blaetter.push({ pfad, art: 'string' });
})({ $ref: schema.$ref }, '', []);
const schemaPfade = new Set(blaetter.map((b) => b.pfad));
const personenPfade = blaetter.filter((b) => b.art === 'PersonId' && b.pfad !== 'personen[].id').map((b) => b.pfad);
/** Felder, die nach ihrem Namen Verweise sein könnten (Name des Blattes); jedes muss im Register stehen oder begründet ausgenommen sein */
const EINZAHL: Record<string, string> = {
  personen: 'person', parteien: 'partei', rollen: 'rolle', kiSysteme: 'kiSystem', risiken: 'risiko', folgenabschaetzungen: 'folgenabschaetzung', eigeneControls: 'eigenesControl',
  nachweise: 'nachweis', massnahmen: 'massnahme', lieferanten: 'lieferant', ziele: 'ziel', kompetenzen: 'kompetenz', kommunikation: 'kommunikation', audits: 'audit',
  feststellungen: 'feststellung', managementbewertungen: 'managementbewertung', controls: 'control', prozesse: 'prozess', kennzahlen: 'kennzahl',
};
const ZIELLISTEN = [...Object.keys(ID_PRAEFIX), 'controls', 'prozesse', 'kennzahlen'];
/** Name eines Feldes (Blatt), das auf eine Zielliste hindeutet: Name der Liste in Einzahl und Mehrzahl, dazu weitere Verweisnamen */
const VERWEIS_NAMEN_LISTE = new Set([
  ...ZIELLISTEN.flatMap((l) => [l, EINZAHL[l] ?? l]),
  'umfangControls', 'umfangProzesse', 'schnittstellen', 'verweis', 'ref', 'dokumente', 'bahn', 'naechste', 'zweige', 'geaendert', 'fehlend', 'nichtLokal',
]);
const VERWEIS_NAMEN = { test: (n: string) => VERWEIS_NAMEN_LISTE.has(n) };
const kandidaten = blaetter.filter((b) => b.art === 'string' && VERWEIS_NAMEN.test(b.pfad.split(/[.[\]{}]+/).filter(Boolean).pop()!)).map((b) => b.pfad);

describe('Verweisregister gegen Schema', () => {
  it('liest das Schema (Plausibilität der Ableitung)', () => {
    expect(blaetter.length).toBeGreaterThan(400);
    expect(personenPfade.length).toBe(58);
  });

  it('jedes Feld vom Typ PersonId steht im Register mit Ziel personen, und nur diese (Lücken 0)', () => {
    const imRegister = VERWEISE.filter((v) => v.ziel.length === 1 && v.ziel[0] === 'personen').map((v) => v.feld).sort();
    expect(imRegister).toEqual([...personenPfade].sort());
  });

  it('jedes Kandidatenfeld des Schemas ist Verweisart oder mit Grund ausgenommen (Lücken 0)', () => {
    const bekannt = new Set([...VERWEISE.map((v) => v.feld), ...KEIN_VERWEIS.map((v) => v.feld)]);
    expect(kandidaten.filter((k) => !bekannt.has(k))).toEqual([]);
  });

  it('jeder Registereintrag und jede Ausnahme verweist auf ein Feld, das es im Schema gibt; keine Doppelten, keine Überschneidung', () => {
    const felder = [...VERWEISE.map((v) => v.feld), ...KEIN_VERWEIS.map((v) => v.feld)];
    expect(felder.filter((f) => !schemaPfade.has(f))).toEqual([]);
    expect(new Set(felder).size).toBe(felder.length);
    for (const k of KEIN_VERWEIS) expect(k.grund.length, k.feld).toBeGreaterThan(10);
  });

  it('die Zielliste jeder Art gibt es im Projekt', () => {
    const projekt = basis as unknown as Objekt;
    for (const v of VERWEISE) for (const z of v.ziel) if (z !== 'controls' && z !== 'prozesse' && z !== 'kennzahlen') expect(z in ID_PRAEFIX, `${v.feld} -> ${z}`).toBe(true);
    for (const z of Object.keys(ID_PRAEFIX)) expect(Array.isArray(projekt[z]) || projekt[z] === undefined, z).toBe(true);
  });
});

// ---- Präparierte Datei je Verweisart ----
const ERFUNDEN: Record<Zielliste, string> = { ...(Object.fromEntries(Object.entries(ID_PRAEFIX).map(([l, p]) => [l, `${p}-999`])) as Record<keyof typeof ID_PRAEFIX, string>), controls: 'ZZ-999', prozesse: 'PE-99', kennzahlen: 'KZ-99' };

/** Setzt den Wert am Pfad (legt fehlende Objekte, Listenelemente und Tabelleneinträge an); `je` setzt das Geschwisterfeld */
function setze(p: Projekt, v: Verweisart, wert: string, jeWert?: string): void {
  const t = v.feld.match(/\[\]|\{\}|[^.[\]{}]+/g)!;
  let k: unknown = p;
  for (let i = 0; i < t.length; i++) {
    const naechst = t[i + 1];
    const letzte = i === t.length - 1;
    const s = t[i]!;
    if (s === '[]') {
      const l = k as unknown[];
      if (letzte) { l[0] = wert; return; }
      if (l.length === 0) l.push(naechst === '[]' ? [] : {});
      k = l[0];
    } else if (s === '{}') {
      const o = k as Objekt;
      const n = Object.keys(o)[0] ?? 'x';
      o[n] ??= naechst === '[]' ? [] : {};
      k = o[n];
    } else {
      const o = k as Objekt;
      if (letzte) {
        o[s] = wert;
        if (v.je && jeWert) o[v.je.feld] = jeWert;
        return;
      }
      o[s] ??= naechst === '[]' ? [] : {};
      k = o[s];
    }
  }
}

describe('Verweisart je Eintrag: präparierte Datei', () => {
  it('die vier Beispiele haben keinen hängenden Verweis; das Register prüft dabei viele Stellen', () => {
    for (const n of BEISPIELE) {
      const p = lade(n);
      expect(haengendeVerweise(p, { katalogProzesse: [] }), n).toEqual([]);
      const geprueft = VERWEISE.reduce((s, v) => s + stellen(p, v.feld).length, 0);
      expect(geprueft, n).toBeGreaterThan(150);
    }
  });

  describe.each(VERWEISE.map((v) => [v.feld, v] as const))('%s', (_feld, v) => {
    const ziel = v.je ? Object.values(v.je.ziele)[0]! : v.ziel[0]!;
    const jeWert = v.je ? Object.keys(v.je.ziele)[0] : undefined;

    it('eine erfundene Kennung wird als hängend erkannt, genau einmal', () => {
      const p = structuredClone(basis);
      setze(p, v, ERFUNDEN[ziel], jeWert);
      const h = haengendeVerweise(p, { katalogProzesse: [] });
      expect(h, JSON.stringify(h)).toHaveLength(1);
      expect(h[0]).toMatchObject({ feld: v.feld, wert: ERFUNDEN[ziel], wurzel: v.feld.split(/[.[{]/)[0] });
    });

    it('eine vorhandene Kennung wird nicht gemeldet', () => {
      const liste = (basis as unknown as Record<string, { id: string }[]>)[ziel === 'controls' ? 'controls' : ziel === 'kennzahlen' || ziel === 'prozesse' ? '' : ziel];
      const vorhanden = ziel === 'kennzahlen' ? 'KZ-01' : ziel === 'prozesse' ? basis.prozesse![0]!.id : liste![0]!.id;
      const p = structuredClone(basis);
      setze(p, v, vorhanden, jeWert);
      expect(haengendeVerweise(p, { katalogProzesse: ['PR-01', 'PS-01'] })).toEqual([]);
    });

    it('die Prüfregel F33 meldet sie als Fehler mit Sprungziel', () => {
      const p = structuredClone(basis);
      setze(p, v, ERFUNDEN[ziel], jeWert);
      const f33 = regeln.filter((r) => r.id === 'F33');
      const b = pruefeProjekt(f33, { projekt: p, heute: '2026-11-07', controlIds42001: CONTROLS_42001, aiActStand: '2026-07-27', kataloge });
      expect(b).toHaveLength(1);
      expect(b[0]).toMatchObject({ regel: 'F33', schwere: 'fehler', norm: '7.5.3' });
      expect(b[0]!.name).toContain(ERFUNDEN[ziel]);
      expect(b[0]!.fehlt).toEqual([`verweis_${ziel}`]);
      expect(b[0]!.ziel).not.toMatch(/^uebersicht/);
    });
  });
});

const regeln = (parse(readFileSync('src/regeln/pruefregeln.yaml', 'utf8')) as { regeln: Regel[] }).regeln;

describe('Prüfregel F33', () => {
  it('ist als Fehler eingetragen, hat Prüffunktion und Texte in DE und EN', () => {
    expect(regeln.find((r) => r.id === 'F33')).toMatchObject({ schwere: 'fehler', ziel: '{bereich}/{id}', norm: '7.5.3' });
    expect(PRUEFUNGEN['F33']).toBeTypeOf('function');
    for (const s of ['de', 'en']) {
      const t = (parse(readFileSync(`src/i18n/${s}/regeln.yaml`, 'utf8')) as Record<string, { titel: string; erklaerung: string }>)['F33']!;
      expect(t.titel, s).toContain('{name}');
      expect(t.erklaerung.length, s).toBeGreaterThan(40);
      expect(`${t.titel}${t.erklaerung}`, s).not.toMatch(/\u00df|[\u2013\u2014]/);
    }
  });

  it('löst in keinem der vier Beispiele aus', () => {
    for (const n of BEISPIELE) {
      const b = pruefeProjekt(regeln.filter((r) => r.id === 'F33'), { projekt: lade(n), heute: '2026-11-07', controlIds42001: CONTROLS_42001, aiActStand: '2026-07-27', kataloge });
      expect(b, n).toEqual([]);
    }
  });

  it('meldet jeden hängenden Verweis einzeln, mit Eintrag der Quelle', () => {
    const p = structuredClone(basis);
    const r1 = p.risiken[0]!;
    r1.kiSystem = 'KI-999';
    r1.massnahmen = [...r1.massnahmen, 'M-999'];
    p.controls[0]!.nachweise = ['N-998'];
    const b = pruefeProjekt(regeln.filter((r) => r.id === 'F33'), { projekt: p, heute: '2026-11-07', controlIds42001: CONTROLS_42001, aiActStand: '2026-07-27', kataloge });
    expect(b.map((x) => [x.id, x.name, x.ziel])).toEqual(
      expect.arrayContaining([
        [r1.id, `${r1.id} → KI-999`, `risiken/${r1.id}`],
        [r1.id, `${r1.id} → M-999`, `risiken/${r1.id}`],
        [p.controls[0]!.id, `${p.controls[0]!.id} → N-998`, `soa/${p.controls[0]!.id}`],
      ]),
    );
    expect(b).toHaveLength(3);
  });

  it('Katalogprozesse prüft die Regel nur mit Katalog; eigene Prozesse (PE) immer', () => {
    const p = structuredClone(basis);
    p.audits[0]!.umfangProzesse = ['PR-98', 'PE-97'];
    expect(haengendeVerweise(p).map((h) => h.wert)).toEqual(['PE-97']);
    expect(haengendeVerweise(p, { katalogProzesse: ['PR-01'] }).map((h) => h.wert)).toEqual(['PR-98', 'PE-97']);
    const mitKatalog = pruefeProjekt(regeln.filter((r) => r.id === 'F33'), { projekt: p, heute: '2026-11-07', controlIds42001: CONTROLS_42001, aiActStand: '2026-07-27', kataloge });
    expect(mitKatalog.map((x) => x.name)).toEqual([`${p.audits[0]!.id} → PR-98`, `${p.audits[0]!.id} → PE-97`]);
    const ohneKatalog = pruefeProjekt(regeln.filter((r) => r.id === 'F33'), { projekt: p, heute: '2026-11-07', controlIds42001: CONTROLS_42001, aiActStand: '2026-07-27' });
    expect(ohneKatalog.map((x) => x.name)).toEqual([`${p.audits[0]!.id} → PE-97`]);
  });
});

const F33 = regeln.filter((r) => r.id === 'F33');
const mitKatalog = (p: Projekt) => pruefeProjekt(F33, { projekt: p, heute: '2026-11-07', controlIds42001: alleControls42001(kataloge).map((c) => c.id), aiActStand: '2026-07-27', kataloge });

describe('Katalog-Controls und lesbare Meldung (Nacharbeit N1, N4)', () => {
  const vorschlaege = (kataloge['genaiRisiken'] as { risiken: { id: string; controls: string[] }[] }).risiken;
  const euaia = (kataloge['aiact_euaiaControls'] as { controls: { id: string }[] }).controls.map((c) => c.id);
  const rmf = (kataloge.nistrmf_rmfControls as { controls: { id: string }[] }).controls.map((c) => c.id);

  it('leeres Projekt plus Risiken aus Katalogvorschlägen mit Controls ergibt F33 = 0', () => {
    const p = leeresProjekt();
    expect(p.controls).toEqual([]);
    p.kiSysteme.push({ id: 'KI-001', name: 'System' } as never);
    const ids = new Set(vorschlaege.flatMap((v) => v.controls));
    expect(ids.size).toBeGreaterThan(3);
    vorschlaege.forEach((v, i) => p.risiken.push({ id: `R-${String(i + 1).padStart(3, '0')}`, art: 'risiko', titel: v.id, kiSystem: 'KI-001', controls: v.controls, massnahmen: [] } as never));
    expect(mitKatalog(p)).toEqual([]);
  });

  it('Controls aus Anhang A, EUAIA und RMF gelten als vorhanden, eine unbekannte Control-ID ergibt genau 1', () => {
    expect(euaia.length).toBeGreaterThan(5);
    expect(rmf.length).toBeGreaterThan(5);
    const p = leeresProjekt();
    p.risiken.push({ id: 'R-001', art: 'risiko', titel: 'x', controls: [...alleControls42001(kataloge).map((c) => c.id), ...euaia, ...rmf], massnahmen: [] } as never);
    expect(mitKatalog(p)).toEqual([]);
    p.risiken[0]!.controls = [...p.risiken[0]!.controls, 'ZZ-999'];
    const b = mitKatalog(p);
    expect(b).toHaveLength(1);
    expect(b[0]!.name).toContain('ZZ-999');
  });

  it('ohne Katalogkennungen zählen nur Controls des Projekts (Funktion allein)', () => {
    const p = leeresProjekt();
    p.risiken.push({ id: 'R-001', art: 'risiko', titel: 'x', controls: ['A.5.2'], massnahmen: [] } as never);
    expect(haengendeVerweise(p)).toHaveLength(1);
    expect(haengendeVerweise(p, { katalogControls: ['A.5.2'] })).toEqual([]);
  });

  it('Sprungziele: Kommunikation, Rollen, Personen, Managementbewertung und Meldungen führen an einen echten Ort', () => {
    const p = structuredClone(basis);
    p.kommunikation[0]!.wer = 'P-999';
    p.rollen[0]!.verantwortlich = 'P-998';
    p.managementbewertungen[0]!.leitung = 'P-997';
    const ziele = Object.fromEntries(mitKatalog(p).map((b) => [b.name, b.ziel]));
    expect(ziele[`${p.kommunikation[0]!.id} → P-999`]).toBe(`kommunikation/${p.kommunikation[0]!.id}`);
    expect(ziele[`${p.rollen[0]!.id} → P-998`]).toBe('organisation/rollen');
    expect(ziele[`${p.managementbewertungen[0]!.id} → P-997`]).toBe(`managementbewertung/${p.managementbewertungen[0]!.id}`);
  });

  it('die Texte «gesucht» gibt es in DE und EN für jede Zielliste', () => {
    for (const s of ['de', 'en']) {
      const pruefung = (parse(readFileSync(`src/i18n/${s}/app.yaml`, 'utf8')) as Record<string, Record<string, string>>)['pruefung']!;
      for (const z of ['personen', 'kiSysteme', 'risiken', 'massnahmen', 'nachweise', 'lieferanten', 'ziele', 'audits', 'feststellungen', 'managementbewertungen', 'controls', 'prozesse', 'kennzahlen']) expect(pruefung[`fehlt_verweis_${z}`], `${s} ${z}`).toBeTruthy();
    }
  });
});

describe('Auswertung der Verweise', () => {
  it('Freitext, leere Werte und Funktionsbezeichnungen sind keine Verweise', () => {
    const p = structuredClone(basis);
    p.risiken[0]!.eigner = 'Geschäftsleitung' as never;
    p.risiken[1]!.eigner = '   ' as never;
    p.kiSysteme[0]!.freigabe = { von: 'Verwaltungsrat', am: '2026-01-01' };
    expect(haengendeVerweise(p)).toEqual([]);
  });

  it('Werte werden getrimmt; ein hängender Wert mit Leerzeichen wird gemeldet', () => {
    const p = structuredClone(basis);
    p.risiken[0]!.eigner = ' P-998 ' as never;
    expect(haengendeVerweise(p)[0]).toMatchObject({ wert: 'P-998', pfad: 'risiken[0].eigner', quelleId: p.risiken[0]!.id });
  });

  it('Kennzahlen der Vorlage KZ-01 bis KZ-06 gelten ohne Eintrag; KZ-99 nur mit Eintrag', () => {
    const p = structuredClone(basis);
    p.prozesse![0]!.kennzahl = 'KZ-03';
    expect(haengendeVerweise(p)).toEqual([]);
    p.prozesse![0]!.kennzahl = 'KZ-99';
    expect(haengendeVerweise(p)).toHaveLength(1);
    p.kennzahlen = [...(p.kennzahlen ?? []), { id: 'KZ-99' }];
    expect(haengendeVerweise(p)).toEqual([]);
  });

  it('prozesse[].kennzahl löst gegen Ziele und Kennzahlen auf', () => {
    const p = structuredClone(basis);
    p.prozesse![0]!.kennzahl = p.ziele[0]!.id;
    expect(haengendeVerweise(p)).toEqual([]);
    p.prozesse![0]!.kennzahl = 'Z-999';
    expect(haengendeVerweise(p).map((h) => h.wert)).toEqual(['Z-999']);
  });

  it('herkunft.ref richtet sich nach herkunft.art: Risiko, Audit, Ziel, Prozess, Managementbewertung; andere Arten sind Freitext', () => {
    const p = structuredClone(basis);
    const m = p.massnahmen[0]!;
    const pruefe = (artWert: string, ref: string) => {
      (m as unknown as Objekt)['herkunft'] = { art: artWert, ref };
      return haengendeVerweise(p).map((h) => h.wert);
    };
    expect(pruefe('risiko', 'R-999')).toEqual(['R-999']);
    expect(pruefe('risiko', p.risiken[0]!.id)).toEqual([]);
    expect(pruefe('audit', 'AU-999')).toEqual(['AU-999']);
    expect(pruefe('ziel', 'Z-999')).toEqual(['Z-999']);
    expect(pruefe('prozess', 'PE-99')).toEqual(['PE-99']);
    expect(pruefe('managementbewertung', 'MB-999')).toEqual(['MB-999']);
    expect(pruefe('sonstige', 'R-999')).toEqual([]);
    expect(pruefe('pruefung', 'AU-999')).toEqual([]);
    // Kennung einer anderen Liste als die Art verlangt: Freitext, kein Verweis
    expect(pruefe('risiko', 'AU-999')).toEqual([]);
  });

  it('Verweise aus Schlüsseltabellen werden gefunden (nistProfil{}, genaiBewertung ist Freitext)', () => {
    const p = structuredClone(basis);
    p.nistProfil = { 'GV-1.1': { massnahmen: ['M-999', p.massnahmen[0]!.id] } };
    expect(haengendeVerweise(p)).toEqual([expect.objectContaining({ feld: 'nistProfil{}.massnahmen[]', wert: 'M-999', pfad: 'nistProfil.GV-1.1.massnahmen[0]', wurzel: 'nistProfil' })]);
  });

  it('Verweise in Einträgen ohne id und im Wurzelobjekt melden keine Quelle', () => {
    const p = structuredClone(basis);
    p.organisation.aimsVerantwortlich = 'P-999';
    const h = haengendeVerweise(p);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ wurzel: 'organisation', pfad: 'organisation.aimsVerantwortlich' });
    expect(h[0]).not.toHaveProperty('quelleId');
  });

  it('controls lösen gegen controls und eigeneControls auf', () => {
    const p = structuredClone(basis);
    p.audits[0]!.umfangControls = [p.controls[0]!.id, 'EC-77'];
    expect(haengendeVerweise(p).map((h) => h.wert)).toEqual(['EC-77']);
    p.eigeneControls = [...(p.eigeneControls ?? []), { id: 'EC-77', titel: 'x', beschreibung: 'x', quelle: 'x' }];
    expect(haengendeVerweise(p)).toEqual([]);
  });
});
