// Prozesskatalog (src/prozesse/katalog.yaml), Reifeskala (src/prozesse/reifeskala.yaml) und Texte
// (src/i18n/<sprache>/prozesse.yaml): Vollständigkeit, IDs, Nummern, Rollen, Dokumente, Abläufe, Abdeckung.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { type GraphEingabe, pruefeGraph } from '../../scripts/pruefen/prozessgraph.mts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPRACHEN = ['de', 'en'] as const;
const datei = (pfad: string): string => readFileSync(join(ROOT, pfad), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yaml = (pfad: string): any => parse(datei(pfad));

type Raci = 'R' | 'A' | 'C' | 'I';
interface Schritt {
  id: string;
  art: 'start' | 'aufgabe' | 'entscheidung' | 'ende';
  bahn: string;
  naechste?: string[];
  raci?: Record<string, Raci>;
  verweis?: string[];
  entscheid?: string;
}
interface Prozess {
  id: string;
  gruppe: string;
  art: string;
  pflicht: string;
  bedingung?: string[];
  minimal_ohne_isms?: boolean;
  eigner_rolle: string;
  rhythmus: string | null;
  normbezug_42001: string[];
  normbezug_27001: string[];
  kit_dokumente: string[];
  verbunden: string[];
  gefuehrt_option?: string;
  kennzahl_vorschlag: { einheit: string; richtung: string; soll: number };
  ableitung: string[];
  schritte: Schritt[];
}
interface Katalog {
  rollen: { aus_aims_rolle: string[]; zusatz: string[] };
  gruppen: string[];
  arten: string[];
  pflichtarten: string[];
  einheiten: string[];
  prozesse: Prozess[];
}
interface ProzessText {
  titel: string;
  zweck: string;
  ausloeser: string[];
  eingaben: string[];
  schritte: Record<string, string>;
  zweige?: Record<string, Record<string, string>>;
  ausgaben: string[];
  kennzahl: string;
  hilfe: string;
  bedingung?: string;
  ohne_isms?: string;
}

const katalog = yaml('src/prozesse/katalog.yaml') as Katalog;
const reife = yaml('src/prozesse/reifeskala.yaml') as { stufen: { stufe: number; schluessel: string; gap: number[] }[] };
const texte = Object.fromEntries(SPRACHEN.map((s) => [s, yaml(`src/i18n/${s}/prozesse.yaml`)])) as Record<(typeof SPRACHEN)[number], any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const prozesse = katalog.prozesse;
const nachId = new Map(prozesse.map((p) => [p.id, p]));

// Bezugskataloge
const anforderungen = yaml('src/kataloge/iso42001-anforderungen.yaml') as { kapitel: { abschnitte: { id: string; di: string }[] }[] };
const abschnitte42001 = anforderungen.kapitel.flatMap((k) => k.abschnitte);
const nummern42001Abschnitte = new Set(abschnitte42001.map((a) => a.id.replace(/^K-/, '')));
const controls42001 = yaml('src/kataloge/iso42001-controls.yaml') as { gruppen: { id: string; controls?: { id: string }[] }[]; untergruppen?: unknown };
const nummern42001Controls = new Set<string>();
(function sammle(knoten: unknown): void {
  if (Array.isArray(knoten)) knoten.forEach(sammle);
  else if (knoten && typeof knoten === 'object') {
    const o = knoten as Record<string, unknown>;
    if (Array.isArray(o['controls'])) for (const c of o['controls'] as { id: string }[]) nummern42001Controls.add(c.id);
    for (const v of Object.values(o)) if (typeof v === 'object') sammle(v);
  }
})(controls42001);
const kapitelGemeinsam = yaml('src/kataloge/kapitel-gemeinsam.yaml') as { abschnitte: { gegenstueck27001: string | null }[] };
const nummern27001Abschnitte = new Set(kapitelGemeinsam.abschnitte.map((a) => a.gegenstueck27001).filter((x): x is string => x !== null));
const nummern27001Controls = new Set((yaml('src/kataloge/iso27001-controls.yaml') as { controls: { nummer: string }[] }).controls.map((c) => `A.${c.nummer}`));
const dokumente = new Set((yaml('src/kataloge/dokumente.yaml') as { dokumente: { id: string; format?: string }[] }).dokumente.filter((d) => d.format).map((d) => d.id));
const optionen = yaml('src/gefuehrt/optionen.yaml').optionen as Record<string, string[]>;
const typen = datei('src/model/typen.ts');

const rollenBereich = new Set(optionen['rollenBereich']);
const erlaubteRollen = new Set([...rollenBereich, ...katalog.rollen.aus_aims_rolle, ...katalog.rollen.zusatz]);
const istAbschnitt = (n: string): boolean => !n.startsWith('A.');

describe('Prozesskatalog: Aufbau', () => {
  it('enthält PR-01 bis PR-27 und PS-01 bis PS-11, IDs eindeutig und lückenlos', () => {
    const ids = prozesse.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const soll = [
      ...Array.from({ length: 27 }, (_, i) => `PR-${String(i + 1).padStart(2, '0')}`),
      ...Array.from({ length: 11 }, (_, i) => `PS-${String(i + 1).padStart(2, '0')}`),
    ];
    expect(ids).toEqual(soll);
  });

  it('Schritt-IDs sind eindeutig und tragen die Prozess-ID als Präfix', () => {
    const alle = prozesse.flatMap((p) => p.schritte.map((s) => s.id));
    expect(new Set(alle).size).toBe(alle.length);
    for (const p of prozesse) for (const s of p.schritte) expect(s.id, s.id).toMatch(new RegExp(`^${p.id}\\.\\d{2}$`));
  });

  it('Gruppe, Art, Pflicht, Einheit und Richtung aus den erlaubten Werten', () => {
    for (const p of prozesse) {
      expect(katalog.gruppen, p.id).toContain(p.gruppe);
      expect(katalog.arten, p.id).toContain(p.art);
      expect(katalog.pflichtarten, p.id).toContain(p.pflicht);
      expect(katalog.einheiten, p.id).toContain(p.kennzahl_vorschlag.einheit);
      expect(['mindestens', 'hoechstens'], p.id).toContain(p.kennzahl_vorschlag.richtung);
      expect(typeof p.kennzahl_vorschlag.soll, p.id).toBe('number');
      if (p.kennzahl_vorschlag.einheit === 'prozent') expect(p.kennzahl_vorschlag.soll).toBeLessThanOrEqual(100);
      if (p.rhythmus !== null) expect(optionen['rhythmus'], p.id).toContain(p.rhythmus);
    }
  });

  it('PR-Prozesse sind AIMS-Prozesse, PS-Prozesse ISMS-Basisprozesse mit Kennzeichen minimal_ohne_isms', () => {
    for (const p of prozesse) {
      if (p.id.startsWith('PS-')) {
        expect(p.art, p.id).toBe('nur-isms');
        expect(typeof p.minimal_ohne_isms, p.id).toBe('boolean');
        expect(p.pflicht, p.id).not.toBe('pflicht');
      } else {
        expect(p.art, p.id).not.toBe('nur-isms');
        expect(p.minimal_ohne_isms, p.id).toBeUndefined();
      }
    }
  });

  it('Mindestumfang ohne ISMS: Zugänge, Sicherheitsvorfälle und Datensicherung (falls relevant)', () => {
    expect(prozesse.filter((p) => p.minimal_ohne_isms).map((p) => p.id)).toEqual(['PS-02', 'PS-04', 'PS-06']);
    expect(nachId.get('PS-06')!.pflicht).toBe('bedingt');
  });

  it('bedingt genau dann, wenn Bedingungen angegeben sind; Pfade existieren im Datenmodell', () => {
    for (const p of prozesse) {
      expect(p.pflicht === 'bedingt', p.id).toBe(Array.isArray(p.bedingung) && p.bedingung.length > 0);
      for (const b of p.bedingung ?? []) for (const f of feldnamen(b)) expect(hatFeld(f), `${p.id}: ${b} (${f})`).toBe(true);
    }
  });

  it('Gruppenzahl wie geplant: Führung 5, Kern 15, Unterstützung 15, Bewertung 3', () => {
    const zahl = (g: string): number => prozesse.filter((p) => p.gruppe === g).length;
    expect([zahl('fuehrung'), zahl('kern'), zahl('unterstuetzung'), zahl('bewertung')]).toEqual([5, 15, 15, 3]);
  });
});

/** Feldnamen eines Ableitungs- oder Bedingungspfads, z. B. «audits[art=intern].durchgefuehrt» -> audits, art, durchgefuehrt. */
function feldnamen(pfad: string): string[] {
  const namen: string[] = [];
  for (const teil of pfad.split(/\.(?![^[]*\])/)) {
    const m = /^(\w+)(?:\[([\w.]+)(?:=[\w-]+)?\])?$/.exec(teil);
    if (!m) throw new Error(`Pfad nicht lesbar: ${pfad}`);
    namen.push(m[1]!);
    if (m[2]) namen.push(...m[2].split('.'));
  }
  return namen;
}
const hatFeld = (name: string): boolean => new RegExp(`^\\s+${name}\\??:`, 'm').test(typen);

describe('Prozesskatalog: Bezüge', () => {
  it('Nummern ISO/IEC 42001 existieren in den Katalogen (Abschnitte und Anhang A)', () => {
    for (const p of prozesse)
      for (const n of p.normbezug_42001) expect(istAbschnitt(n) ? nummern42001Abschnitte.has(n) : nummern42001Controls.has(n), `${p.id}: ${n}`).toBe(true);
  });

  it('Nummern ISO/IEC 27001 existieren (Abschnitte aus kapitel-gemeinsam, Controls aus iso27001-controls)', () => {
    for (const p of prozesse)
      for (const n of p.normbezug_27001) expect(istAbschnitt(n) ? nummern27001Abschnitte.has(n) : nummern27001Controls.has(n), `${p.id}: ${n}`).toBe(true);
  });

  it('jeder Prozess hat mindestens einen Normbezug und keine doppelten Nummern', () => {
    for (const p of prozesse) {
      expect(p.normbezug_42001.length + p.normbezug_27001.length, p.id).toBeGreaterThan(0);
      expect(new Set(p.normbezug_42001).size, p.id).toBe(p.normbezug_42001.length);
      expect(new Set(p.normbezug_27001).size, p.id).toBe(p.normbezug_27001.length);
    }
  });

  it('PR-Prozesse beziehen sich auf ISO/IEC 42001, PS-Prozesse auf Anhang A von ISO/IEC 27001', () => {
    for (const p of prozesse) {
      if (p.id.startsWith('PR-')) expect(p.normbezug_42001.length, p.id).toBeGreaterThan(0);
      else expect(p.normbezug_27001.filter((n) => !istAbschnitt(n)).length, p.id).toBeGreaterThan(0);
    }
  });

  it('jede verlangte dokumentierte Information (di != keine) aus Kapitel 4 bis 10 ist einem Pflichtprozess zugeordnet', () => {
    const pflichtNummern = new Set(prozesse.filter((p) => p.pflicht === 'pflicht').flatMap((p) => p.normbezug_42001));
    const offen = abschnitte42001.filter((a) => a.di !== 'keine').map((a) => a.id.replace(/^K-/, '')).filter((n) => !pflichtNummern.has(n));
    expect(offen).toEqual([]);
  });

  it('jeder Abschnitt 4 bis 10 und jedes Control aus Anhang A von ISO/IEC 42001 ist mindestens einem Prozess zugeordnet', () => {
    const alle = new Set(prozesse.flatMap((p) => p.normbezug_42001));
    expect([...nummern42001Abschnitte].filter((n) => !alle.has(n))).toEqual([]);
    expect([...nummern42001Controls].filter((n) => !alle.has(n))).toEqual([]);
  });

  it('Kit-Dokumente existieren im Dokumentenregister', () => {
    for (const p of prozesse) {
      expect(p.kit_dokumente.length, p.id).toBeGreaterThan(0);
      for (const d of p.kit_dokumente) expect(dokumente.has(d), `${p.id}: ${d}`).toBe(true);
    }
  });

  it('verbundene Prozesse existieren, liegen auf der anderen Seite und sind gegenseitig eingetragen', () => {
    for (const p of prozesse)
      for (const v of p.verbunden) {
        const q = nachId.get(v);
        expect(q, `${p.id}: ${v}`).toBeDefined();
        expect(v.slice(0, 2), `${p.id}: ${v}`).not.toBe(p.id.slice(0, 2));
        expect(q!.verbunden, `${v} nennt ${p.id} nicht`).toContain(p.id);
      }
  });

  it('Verweise in Schritten zeigen auf bestehende andere Prozesse', () => {
    for (const p of prozesse)
      for (const s of p.schritte)
        for (const v of s.verweis ?? []) {
          expect(nachId.has(v), `${s.id}: ${v}`).toBe(true);
          expect(v, s.id).not.toBe(p.id);
        }
  });

  it('Optionsgruppe aimsProzesse: jeder Wert genau einem Prozess zugeordnet', () => {
    const zuordnung = prozesse.filter((p) => p.gefuehrt_option).map((p) => p.gefuehrt_option!);
    expect([...zuordnung].sort()).toEqual([...optionen['aimsProzesse']!].sort());
  });

  it('Ableitungen nennen Felder, die im Datenmodell existieren', () => {
    for (const p of prozesse) {
      expect(Array.isArray(p.ableitung), p.id).toBe(true);
      for (const a of p.ableitung) for (const f of feldnamen(a)) expect(hatFeld(f), `${p.id}: ${a} (${f})`).toBe(true);
    }
  });

  it('Ableitungen für die Prozesse aus dem Plan (Audit, Managementbewertung, Risiko)', () => {
    expect(nachId.get('PR-25')!.ableitung).toContain('audits[art=intern].durchgefuehrt');
    expect(nachId.get('PR-26')!.ableitung).toContain('managementbewertungen.datum');
    expect(nachId.get('PR-08')!.ableitung).toContain('risiken.beurteiltAm');
  });
});

describe('Prozesskatalog: Rollen und RACI', () => {
  it('Zusatzrollen aus aimsRolle existieren dort und doppeln keinen Rollenbereich', () => {
    for (const r of katalog.rollen.aus_aims_rolle) expect(optionen['aimsRolle'], r).toContain(r);
    for (const r of katalog.rollen.zusatz) {
      expect(rollenBereich.has(r), r).toBe(false);
      expect(optionen['aimsRolle'], r).not.toContain(r);
    }
  });

  it('Eigner, Bahnen und RACI-Schlüssel sind bekannte Rollen', () => {
    for (const p of prozesse) {
      expect(erlaubteRollen.has(p.eigner_rolle), `${p.id}: ${p.eigner_rolle}`).toBe(true);
      for (const s of p.schritte) {
        expect(erlaubteRollen.has(s.bahn), `${s.id}: Bahn ${s.bahn}`).toBe(true);
        for (const [r, w] of Object.entries(s.raci ?? {})) {
          expect(erlaubteRollen.has(r), `${s.id}: ${r}`).toBe(true);
          expect(['R', 'A', 'C', 'I'], `${s.id}: ${r}`).toContain(w);
        }
      }
    }
  });

  it('jede Aufgabe und Entscheidung hat genau eine A; die Bahn führt aus oder verantwortet', () => {
    for (const p of prozesse)
      for (const s of p.schritte.filter((x) => x.art === 'aufgabe' || x.art === 'entscheidung')) {
        const raci = s.raci ?? {};
        expect(Object.values(raci).filter((w) => w === 'A').length, s.id).toBe(1);
        expect(['R', 'A'], `${s.id}: Bahn ${s.bahn}`).toContain(raci[s.bahn]);
      }
  });

  it('höchstens fünf Bahnen je Prozess', () => {
    for (const p of prozesse) expect(new Set(p.schritte.map((s) => s.bahn)).size, p.id).toBeLessThanOrEqual(5);
  });

  it('Rollenbereiche haben Texte in gefuehrt.optionen, Zusatzrollen in prozesse.rollen', () => {
    for (const s of SPRACHEN) {
      const g = yaml(`src/i18n/${s}/gefuehrt.yaml`).optionen;
      for (const r of rollenBereich) expect(g.rollenBereich[r], `${s}: ${r}`).toBeTruthy();
      for (const r of katalog.rollen.aus_aims_rolle) expect(g.aimsRolle[r], `${s}: ${r}`).toBeTruthy();
      for (const r of katalog.rollen.zusatz) expect(texte[s].rollen[r], `${s}: ${r}`).toBeTruthy();
    }
  });
});

describe('Prozesskatalog: Abläufe', () => {
  it('schlank für KMU: 5 bis 8 Aufgaben und Entscheidungen je Prozess, mit Freigabe nach Entscheidungsrechten höchstens 10', () => {
    for (const p of prozesse) {
      const n = p.schritte.filter((s) => s.art === 'aufgabe' || s.art === 'entscheidung').length;
      expect(n, p.id).toBeGreaterThanOrEqual(5);
      // Zweig zur Geschäftsleitung (Entscheidungsrechte D-04, Freigabe voller Abschätzungen D-08): zwei Schritte mehr
      const zweiFreigaben = new Set(p.schritte.filter((s) => s.entscheid).map((s) => s.bahn)).size > 1;
      expect(n, p.id).toBeLessThanOrEqual(zweiFreigaben ? 10 : 8);
    }
  });

  it('Freigaben nach Entscheidungsrechten: AIMS-Verantwortung und Geschäftsleitung, keine Selbstfreigabe der Folgenabschätzung', () => {
    const freigaben = (id: string) => prozesse.find((p) => p.id === id)!.schritte.filter((s) => s.entscheid).map((s) => `${s.bahn}:${s.entscheid}`);
    expect(freigaben('PR-07')).toEqual(['aims:einfuehren', 'gl:einfuehren']);
    expect(freigaben('PR-11')).toEqual(['aims:einfuehren', 'gl:einfuehren']);
    expect(freigaben('PR-09')).toEqual(['aims:kurzpruefung', 'gl:abschaetzung']);
    expect(freigaben('PR-08')).toEqual(['gl:restrisiko']);
  });

  it('genau ein Start, mindestens ein Ende; Nachfolger passen zur Art', () => {
    for (const p of prozesse) {
      const ids = new Set(p.schritte.map((s) => s.id));
      expect(p.schritte.filter((s) => s.art === 'start').length, p.id).toBe(1);
      expect(p.schritte[0]!.art, p.id).toBe('start');
      expect(p.schritte.filter((s) => s.art === 'ende').length, p.id).toBeGreaterThanOrEqual(1);
      for (const s of p.schritte) {
        const n = s.naechste ?? [];
        for (const z of n) expect(ids.has(z), `${s.id} -> ${z}`).toBe(true);
        expect(new Set(n).size, s.id).toBe(n.length);
        expect(n, s.id).not.toContain(s.id);
        if (s.art === 'ende') expect(n.length, s.id).toBe(0);
        else if (s.art === 'entscheidung') expect(n.length, s.id).toBeGreaterThanOrEqual(2);
        else expect(n.length, s.id).toBe(1);
        if (s.art === 'start' || s.art === 'ende') expect(s.raci, s.id).toBeUndefined();
      }
      for (const s of p.schritte) expect(p.schritte.some((q) => q.naechste?.includes(s.id)), `${s.id} ohne Vorgänger`).toBe(s.art !== 'start');
    }
  });

  it('zusammenhängend: jeder Schritt vom Start erreichbar, von jedem Schritt ein Ende erreichbar', () => {
    for (const p of prozesse) {
      const nach = new Map(p.schritte.map((s) => [s.id, s.naechste ?? []]));
      const erreichbar = (von: string): Set<string> => {
        const gesehen = new Set<string>([von]);
        const offen = [von];
        while (offen.length) for (const z of nach.get(offen.pop()!) ?? []) if (!gesehen.has(z)) (gesehen.add(z), offen.push(z));
        return gesehen;
      };
      const vomStart = erreichbar(p.schritte[0]!.id);
      expect([...nach.keys()].filter((id) => !vomStart.has(id)), p.id).toEqual([]);
      const enden = p.schritte.filter((s) => s.art === 'ende').map((s) => s.id);
      for (const s of p.schritte) expect([...erreichbar(s.id)].some((z) => enden.includes(z)), `${s.id} erreicht kein Ende`).toBe(true);
    }
  });
});

describe('Prozesskatalog: Texte DE und EN', () => {
  for (const s of SPRACHEN) {
    it(`${s}: jeder Prozess vollständig beschrieben`, () => {
      const t = texte[s].prozesse as Record<string, ProzessText>;
      expect(Object.keys(t).sort()).toEqual(prozesse.map((p) => p.id).sort());
      for (const p of prozesse) {
        const x = t[p.id]!;
        for (const feld of ['titel', 'zweck', 'kennzahl', 'hilfe'] as const) expect(x[feld]?.trim(), `${p.id}.${feld}`).toBeTruthy();
        for (const feld of ['ausloeser', 'eingaben', 'ausgaben'] as const) {
          expect(Array.isArray(x[feld]) && x[feld].length > 0, `${p.id}.${feld}`).toBe(true);
          for (const z of x[feld]) expect(typeof z === 'string' && z.trim() !== '', `${p.id}.${feld}`).toBe(true);
        }
        expect(Object.keys(x.schritte).sort(), `${p.id}.schritte`).toEqual(p.schritte.map((q) => q.id).sort());
        for (const q of p.schritte) expect(x.schritte[q.id]?.trim(), q.id).toBeTruthy();
        const entscheide = p.schritte.filter((q) => q.art === 'entscheidung');
        expect(Object.keys(x.zweige ?? {}).sort(), `${p.id}.zweige`).toEqual(entscheide.map((q) => q.id).sort());
        for (const q of entscheide) {
          expect(Object.keys(x.zweige![q.id]!).sort(), `${q.id} Zweige`).toEqual([...q.naechste!].sort());
          for (const w of Object.values(x.zweige![q.id]!)) expect(w.trim(), q.id).toBeTruthy();
          expect(x.schritte[q.id]!.trim().endsWith('?'), `${q.id}: Entscheidung als Frage`).toBe(true);
        }
        expect(x.bedingung !== undefined, `${p.id}.bedingung`).toBe(p.pflicht === 'bedingt');
        expect(x.ohne_isms !== undefined, `${p.id}.ohne_isms`).toBe(p.art === 'nur-isms');
      }
    });

    it(`${s}: Bezeichnungen für Gruppen, Arten, Pflichtarten, Schrittarten, Einheiten und Reifestufen`, () => {
      const t = texte[s];
      for (const g of katalog.gruppen) expect(t.gruppen[g], g).toBeTruthy();
      for (const a of katalog.arten) (expect(t.arten[a], a).toBeTruthy(), expect(t.arten_hilfe[a], a).toBeTruthy());
      for (const a of katalog.pflichtarten) (expect(t.pflichtarten[a], a).toBeTruthy(), expect(t.pflichtarten_hilfe[a], a).toBeTruthy());
      for (const a of ['start', 'aufgabe', 'entscheidung', 'ende']) expect(t.schrittarten[a], a).toBeTruthy();
      for (const e of katalog.einheiten) expect(t.einheiten[e], e).toBeTruthy();
      for (const r of ['R', 'A', 'C', 'I']) expect(t.raci[r], r).toBeTruthy();
      for (const st of reife.stufen)
        for (const f of ['titel', 'erklaerung', 'kriterium', 'gap']) expect(t.reifeskala[st.schluessel]?.[f], `${st.schluessel}.${f}`).toBeTruthy();
    });
  }

  it('DE und EN haben dieselben Listenlängen (Auslöser, Eingaben, Ausgaben)', () => {
    for (const p of prozesse)
      for (const feld of ['ausloeser', 'eingaben', 'ausgaben'] as const)
        expect(texte.en.prozesse[p.id][feld].length, `${p.id}.${feld}`).toBe(texte.de.prozesse[p.id][feld].length);
  });

  it('Titel eindeutig je Sprache', () => {
    for (const s of SPRACHEN) {
      const titel = prozesse.map((p) => texte[s].prozesse[p.id].titel as string);
      expect(new Set(titel).size, s).toBe(titel.length);
    }
  });
});

describe('Reifeskala', () => {
  it('fünf Stufen 0 bis 4 in fester Reihenfolge', () => {
    expect(reife.stufen.map((s) => s.stufe)).toEqual([0, 1, 2, 3, 4]);
    expect(reife.stufen.map((s) => s.schluessel)).toEqual(['nicht-begonnen', 'definiert', 'eingefuehrt', 'wirksam', 'ueberprueft']);
  });

  it('Zuordnung zur Gap-Skala D-00 deckt 0 bis 5 lückenlos, steigend und ohne Überschneidung ab', () => {
    const gap = reife.stufen.flatMap((s) => s.gap);
    expect(gap).toEqual([0, 1, 2, 3, 4, 5]);
    const d00 = yaml('src/i18n/de/vorlagen/D-00.yaml').reifegrade as unknown[][];
    expect(d00.map((z) => z[0])).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

// Graphregeln «Freigabe X setzt Schritt Y voraus» (AF-096, QK-52; Tor G45 scripts/pruefen/prozessgraph.mts)
describe('Prozesskatalog: Graphregeln', () => {
  const regeln = yaml('src/prozesse/graphregeln.yaml') as GraphEingabe['regeln'];
  const pruefen = (k: Katalog) => pruefeGraph({ katalog: k as unknown as GraphEingabe['katalog'], regeln });
  const kopie = (): Katalog => JSON.parse(JSON.stringify(katalog)) as Katalog;
  // Ablauf PR-09 vor AF-096: Kurzweg über PR-09.05 zur Entscheidung PR-09.08, «ja» direkt zur Freigabe PR-09.09 (A3-11)
  const PR09_ALT: Schritt[] = [
    { id: 'PR-09.00', art: 'start', bahn: 'ki-eigner', naechste: ['PR-09.01'] },
    { id: 'PR-09.01', art: 'aufgabe', bahn: 'folgenabschaetzung', naechste: ['PR-09.02'], raci: { folgenabschaetzung: 'A' } },
    { id: 'PR-09.02', art: 'entscheidung', bahn: 'folgenabschaetzung', naechste: ['PR-09.03', 'PR-09.05'], raci: { folgenabschaetzung: 'A' } },
    { id: 'PR-09.03', art: 'aufgabe', bahn: 'folgenabschaetzung', naechste: ['PR-09.04'], raci: { folgenabschaetzung: 'A' } },
    { id: 'PR-09.04', art: 'aufgabe', bahn: 'folgenabschaetzung', naechste: ['PR-09.05'], raci: { folgenabschaetzung: 'A' } },
    { id: 'PR-09.05', art: 'aufgabe', bahn: 'folgenabschaetzung', naechste: ['PR-09.08'], raci: { folgenabschaetzung: 'A' } },
    { id: 'PR-09.08', art: 'entscheidung', bahn: 'folgenabschaetzung', naechste: ['PR-09.09', 'PR-09.06'], raci: { folgenabschaetzung: 'A' } },
    { id: 'PR-09.06', art: 'aufgabe', bahn: 'aims', naechste: ['PR-09.07'], raci: { aims: 'A' }, entscheid: 'kurzpruefung' },
    { id: 'PR-09.09', art: 'aufgabe', bahn: 'gl', naechste: ['PR-09.07'], raci: { gl: 'A' }, entscheid: 'abschaetzung' },
    { id: 'PR-09.07', art: 'aufgabe', bahn: 'folgenabschaetzung', naechste: ['PR-09.90'], raci: { folgenabschaetzung: 'A' } },
    { id: 'PR-09.90', art: 'ende', bahn: 'folgenabschaetzung' },
  ];

  it('alle 38 Prozesse: 0 Verstösse gegen die Graphregeln (bekannte offene Regel nur als Warnung)', () => {
    expect(prozesse.length).toBe(38);
    const b = pruefen(katalog);
    expect(b.filter((x) => x.schwere === 'fehler').map((x) => x.meldung)).toEqual([]);
    // Erwartung geändert (P14): GR-05 behoben (PR-07 «keine vertiefte Prüfung» führt zur AIMS-Verantwortung), keine offene Warnung
    expect(b.filter((x) => x.schwere === 'warnung').map((x) => x.meldung)).toEqual([]);
  });

  it('Gegenprobe: der alte Ablauf PR-09 verletzt GR-01 (volle Abschätzung freigegeben, ohne sie zu erarbeiten)', () => {
    const k = kopie();
    k.prozesse.find((p) => p.id === 'PR-09')!.schritte = PR09_ALT;
    const m = pruefen(k).filter((x) => x.schwere === 'fehler').map((x) => x.meldung);
    expect(m).toEqual(expect.arrayContaining(['GR-01: PR-09.09 ist ohne PR-09.03 erreichbar', 'GR-01: PR-09.09 ist ohne PR-09.04 erreichbar']));
  });

  it('Gegenprobe GR-05: der alte Ablauf PR-07 («keine vertiefte Prüfung» zur Frage «hohes Risiko») verletzt GR-05 (P14)', () => {
    const k = kopie();
    const p07 = k.prozesse.find((p) => p.id === 'PR-07')!;
    p07.schritte = p07.schritte.map((s) => (s.id === 'PR-07.03' ? { ...s, naechste: ['PR-07.04', 'PR-07.09'] } : s));
    expect(pruefen(k).filter((x) => x.schwere === 'fehler').map((x) => x.meldung)).toContain('GR-05: PR-07.10 ist ohne PR-07.04 erreichbar');
    // Neuer Ablauf: ohne vertiefte Prüfung entscheidet die AIMS-Verantwortung, die Geschäftsleitung nur nach PR-07.04
    const s = (id: string) => nachId.get('PR-07')!.schritte.find((x) => x.id === id)!;
    expect(s('PR-07.03').naechste).toEqual(['PR-07.04', 'PR-07.05']);
    expect(s('PR-07.04').naechste).toEqual(['PR-07.09']);
    expect(Object.keys(texte.de.prozesse['PR-07'].zweige['PR-07.03'])).toEqual(['PR-07.04', 'PR-07.05']);
    expect(Object.keys(texte.en.prozesse['PR-07'].zweige['PR-07.03'])).toEqual(['PR-07.04', 'PR-07.05']);
  });

  it('Gegenprobe GR-06: PR-07 ohne Test mit eigenen Fällen vor der Freigabe verletzt GR-06 (M4-33)', () => {
    const k = kopie();
    const p07 = k.prozesse.find((p) => p.id === 'PR-07')!;
    // Ablauf wie vor P20: nach der Prüfung direkt zur Frage «vertiefte Prüfung?», der Nein-Zweig führt ohne Test zur Freigabe
    p07.schritte = p07.schritte.map((s) => (s.id === 'PR-07.02' ? { ...s, naechste: ['PR-07.03'] } : s));
    const m = pruefen(k).filter((x) => x.schwere === 'fehler').map((x) => x.meldung);
    expect(m).toEqual(expect.arrayContaining(['GR-06: PR-07.05 ist ohne PR-07.11 erreichbar', 'GR-06: PR-07.10 ist ohne PR-07.11 erreichbar']));
    // Neuer Ablauf: Prüfung nach den Freigabekriterien und Test vor der Frage nach der vertieften Prüfung, DE und EN mit D-08 und D-12
    const s = (id: string) => nachId.get('PR-07')!.schritte.find((x) => x.id === id)!;
    expect(s('PR-07.02').naechste).toEqual(['PR-07.11']);
    expect(s('PR-07.11').naechste).toEqual(['PR-07.03']);
    for (const t of [texte.de, texte.en]) {
      expect(t.prozesse['PR-07'].schritte['PR-07.02']).toMatch(/D-08.*D-07/);
      expect(t.prozesse['PR-07'].schritte['PR-07.11']).toContain('D-12');
    }
  });

  it('PR-09: Rückprüfung mit erreichter Schwelle springt zur vollen Abschätzung zurück, Rückprüfung als Auslöser DE und EN', () => {
    const p = nachId.get('PR-09')!;
    const s = (id: string) => p.schritte.find((x) => x.id === id)!;
    expect(s('PR-09.02').naechste).toEqual(['PR-09.03', 'PR-09.10']);
    expect(s('PR-09.10').naechste).toEqual(['PR-09.08']);
    expect(s('PR-09.08').naechste).toEqual(['PR-09.03', 'PR-09.06']);
    expect(s('PR-09.05').naechste).toEqual(['PR-09.09']);
    expect((texte.de.prozesse['PR-09'].ausloeser as string[]).some((a) => a.startsWith('Rückprüfung'))).toBe(true);
    expect((texte.en.prozesse['PR-09'].ausloeser as string[]).some((a) => a.startsWith('Back-check'))).toBe(true);
    expect(texte.de.prozesse['PR-09'].schritte['PR-09.00']).toContain('Rückprüfung');
    expect(texte.en.prozesse['PR-09'].schritte['PR-09.00']).toContain('back-check');
  });

  it('erkennt eine Freigabe direkt nach dem Start (GR-00), unbekannte Schritte und überholte offene Regeln', () => {
    const k = kopie();
    k.prozesse.find((x) => x.id === 'PR-08')!.schritte[0]!.naechste = ['PR-08.07'];
    const r: GraphEingabe['regeln'] = {
      regeln: [
        { id: 'GR-00', art: 'erarbeitung' },
        { id: 'GR-X1', art: 'voraus', prozess: 'PR-08', freigabe: ['PR-08.99'], voraus: ['PR-08.03'] },
        { id: 'GR-X2', art: 'voraus', prozess: 'PR-09', freigabe: ['PR-09.09'], voraus: ['PR-09.03'], offen: 'Test' },
      ],
    };
    const m = pruefeGraph({ katalog: k as unknown as GraphEingabe['katalog'], regeln: r }).map((x) => `${x.schwere} ${x.meldung}`);
    expect(m).toContain('fehler GR-00: PR-08.07: Freigabe «restrisiko» ohne vorherige Aufgabe erreichbar');
    expect(m).toContain('fehler GR-X1: Schritte PR-08.99 gibt es in PR-08 nicht');
    expect(m).toContain('fehler GR-X2: Verstoss behoben, Vermerk «offen: Test» streichen');
  });
});
