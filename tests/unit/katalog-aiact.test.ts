// Konsistenz des AI-Act-Moduls: Pflichten, Zusatz-Controls, Stand, Texte DE/EN, Auszüge.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { parse } from 'yaml';

const wurzel = new URL('../../', import.meta.url);
const lies = (pfad: string): any => parse(readFileSync(new URL(pfad, wurzel), 'utf8'));

const pflichtenDatei = lies('src/ai-act/pflichten.yaml');
const controlsDatei = lies('src/ai-act/euaia-controls.yaml');
const standDatei = lies('src/ai-act/stand.yaml');
const texte = {
  de: {
    pflichten: lies('src/i18n/de/pflichten.yaml'),
    euaia: lies('src/i18n/de/euaia.yaml'),
    stand: lies('src/i18n/de/stand.yaml'),
  },
  en: {
    pflichten: lies('src/i18n/en/pflichten.yaml'),
    euaia: lies('src/i18n/en/euaia.yaml'),
    stand: lies('src/i18n/en/stand.yaml'),
  },
};

const pflichten: any[] = pflichtenDatei.pflichten;
const controls: any[] = controlsDatei.controls;

/** ISO/IEC 42001 Anhang A, 38 Controls (nur Nummern). */
const CONTROLS_42001 = [
  'A.2.2', 'A.2.3', 'A.2.4',
  'A.3.2', 'A.3.3',
  'A.4.2', 'A.4.3', 'A.4.4', 'A.4.5', 'A.4.6',
  'A.5.2', 'A.5.3', 'A.5.4', 'A.5.5',
  'A.6.1.2', 'A.6.1.3', 'A.6.2.2', 'A.6.2.3', 'A.6.2.4', 'A.6.2.5', 'A.6.2.6', 'A.6.2.7', 'A.6.2.8',
  'A.7.2', 'A.7.3', 'A.7.4', 'A.7.5', 'A.7.6',
  'A.8.2', 'A.8.3', 'A.8.4', 'A.8.5',
  'A.9.2', 'A.9.3', 'A.9.4',
  'A.10.2', 'A.10.3', 'A.10.4',
] as const;

/** Abschnitte 4 bis 10 von ISO/IEC 42001 mit Anforderungen, als K-IDs (wie src/kataloge/iso42001-anforderungen.yaml). */
const KLAUSELN_42001 = [
  '4.1', '4.2', '4.3', '4.4',
  '5.1', '5.2', '5.3',
  '6.1.1', '6.1.2', '6.1.3', '6.1.4', '6.2', '6.3',
  '7.1', '7.2', '7.3', '7.4', '7.5',
  '8.1', '8.2', '8.3', '8.4',
  '9.1', '9.2', '9.3',
  '10.1', '10.2',
].map((k) => `K-${k}`);

/** ISO/IEC 27001:2022 Anhang A, 93 Controls (5.1 bis 5.37, 6.1 bis 6.8, 7.1 bis 7.14, 8.1 bis 8.34). */
const CONTROLS_27001 = [
  ...Array.from({ length: 37 }, (_, i) => `27001-5.${i + 1}`),
  ...Array.from({ length: 8 }, (_, i) => `27001-6.${i + 1}`),
  ...Array.from({ length: 14 }, (_, i) => `27001-7.${i + 1}`),
  ...Array.from({ length: 34 }, (_, i) => `27001-8.${i + 1}`),
];

const ROLLEN = ['anbieter', 'betreiber', 'einfuehrer', 'haendler', 'produkthersteller', 'bevollmaechtigter'];
const RISIKOKLASSEN = ['verboten', 'hochrisiko-anhang-iii', 'hochrisiko-anhang-i', 'transparenz', 'minimal', 'alle'];
const TRANSPARENZ = ['50-1', '50-2', '50-3', '50-4'];
const BEDINGUNG_SCHLUESSEL = [
  'immer', 'rollen_any', 'risikoklasse_any', 'transparenz_any', 'anhang_iii_bereich_any',
  'ausnahme_art_6_3', 'gpai', 'org_niederlassung_eu', 'org_oeffentliche_dienste', 'any_of',
];
const ID_MUSTER = /^P-(ALLE|ANB|ANB6-3|BETR|EINF|HAEN|BEV|PROD|TRANSP-ANB|TRANSP-BETR|GPAI)-\d{2}$/;

function istDatum(wert: unknown): boolean {
  if (typeof wert !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(wert)) return false;
  const d = new Date(`${wert}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === wert;
}

function pruefeBedingung(b: any, pfad: string, erlaubtZusatz: string[] = []): string[] {
  const fehler: string[] = [];
  if (b === null || b === undefined) return fehler;
  for (const [k, v] of Object.entries(b)) {
    if (![...BEDINGUNG_SCHLUESSEL, ...erlaubtZusatz].includes(k)) fehler.push(`${pfad}: unbekannter Schlüssel ${k}`);
    if (k === 'rollen_any') for (const r of v as string[]) if (!ROLLEN.includes(r)) fehler.push(`${pfad}: Rolle ${r}`);
    if (k === 'risikoklasse_any') for (const r of v as string[]) if (!RISIKOKLASSEN.includes(r)) fehler.push(`${pfad}: Klasse ${r}`);
    if (k === 'transparenz_any') for (const t of v as string[]) if (!TRANSPARENZ.includes(t)) fehler.push(`${pfad}: Transparenz ${t}`);
    if (k === 'any_of') (v as any[]).forEach((u, i) => fehler.push(...pruefeBedingung(u, `${pfad}.any_of[${i}]`)));
  }
  return fehler;
}

const controlNachId = new Map(controls.map((c) => [c.id, c]));

describe('AI-Act-Pflichten (src/ai-act/pflichten.yaml)', () => {
  it('IDs sind eindeutig und folgen dem Muster', () => {
    const ids = pflichten.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id, id).toMatch(ID_MUSTER);
  });

  it('Rollen, Risikoklassen und Bedingungen haben gültige Werte', () => {
    const fehler: string[] = [];
    for (const p of pflichten) {
      if (!p.rollen?.length) fehler.push(`${p.id}: keine Rolle`);
      for (const r of p.rollen ?? []) if (!ROLLEN.includes(r)) fehler.push(`${p.id}: Rolle ${r}`);
      if (!p.risikoklassen?.length) fehler.push(`${p.id}: keine Risikoklasse`);
      for (const k of p.risikoklassen ?? []) if (!RISIKOKLASSEN.includes(k)) fehler.push(`${p.id}: Klasse ${k}`);
      if (typeof p.artikel !== 'string' || !p.artikel) fehler.push(`${p.id}: artikel fehlt`);
      fehler.push(...pruefeBedingung(p.bedingung, p.id, ['fria_anwendbar']));
    }
    expect(fehler).toEqual([]);
  });

  it('gilt_ab und abgeleitete Daten sind gültige Daten', () => {
    const fehler: string[] = [];
    for (const p of pflichten) {
      if (!istDatum(p.gilt_ab)) fehler.push(`${p.id}: gilt_ab ${p.gilt_ab}`);
      if (p.gilt_praktisch_ab !== undefined) {
        if (!istDatum(p.gilt_praktisch_ab)) fehler.push(`${p.id}: gilt_praktisch_ab ${p.gilt_praktisch_ab}`);
        else if (p.gilt_praktisch_ab < p.gilt_ab) fehler.push(`${p.id}: praktisch vor formell`);
      }
      for (const feld of ['gilt_ab_je_klasse', 'gilt_praktisch_je_klasse']) {
        for (const [klasse, datum] of Object.entries(p[feld] ?? {})) {
          if (!RISIKOKLASSEN.includes(klasse)) fehler.push(`${p.id}: ${feld} Klasse ${klasse}`);
          if (!istDatum(datum)) fehler.push(`${p.id}: ${feld} ${klasse} ${String(datum)}`);
          else if ((datum as string) < p.gilt_ab) fehler.push(`${p.id}: ${feld} ${klasse} vor gilt_ab`);
        }
      }
    }
    expect(fehler).toEqual([]);
  });

  it('jede Pflicht mit Abdeckung teilweise oder nicht hat ein existierendes Zusatz-Control', () => {
    const fehler: string[] = [];
    for (const p of pflichten) {
      const grad = p.abdeckung_42001?.grad;
      if (!['ganz', 'teilweise', 'nicht'].includes(grad)) fehler.push(`${p.id}: grad ${grad}`);
      if (grad !== 'ganz' && !p.zusatz_control) fehler.push(`${p.id}: Zusatz-Control fehlt`);
      if (p.zusatz_control && !controlNachId.has(p.zusatz_control)) fehler.push(`${p.id}: ${p.zusatz_control} unbekannt`);
    }
    expect(fehler).toEqual([]);
  });

  it('Rollen und Risikoklassen der Pflicht passen zum Zusatz-Control', () => {
    const fehler: string[] = [];
    for (const p of pflichten) {
      const c = controlNachId.get(p.zusatz_control);
      if (!c) continue;
      for (const r of p.rollen) if (!c.rollen.includes(r)) fehler.push(`${p.id}: Rolle ${r} fehlt in ${c.id}`);
      if (!c.risikoklassen.includes('alle'))
        for (const k of p.risikoklassen) if (!c.risikoklassen.includes(k)) fehler.push(`${p.id}: Klasse ${k} fehlt in ${c.id}`);
    }
    expect(fehler).toEqual([]);
  });

  it('Vorlagen sind gültige Kit-IDs', () => {
    for (const p of pflichten) {
      expect(p.vorlage?.length, p.id).toBeGreaterThan(0);
      for (const v of p.vorlage) expect(v, p.id).toMatch(/^(E-0[1-9]|D-\d{2})$/);
      expect(['hoch', 'mittel', 'gering'], p.id).toContain(p.kmu_relevanz);
    }
  });
});

describe('Zusatz-Controls (src/ai-act/euaia-controls.yaml)', () => {
  it('IDs sind eindeutig, lückenlos und folgen dem Muster', () => {
    const ids = controls.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id, i) => expect(id).toBe(`EUAIA-${String(i + 1).padStart(2, '0')}`));
  });

  it('jedes Zusatz-Control wird von mindestens einer Pflicht referenziert', () => {
    const referenziert = new Set(pflichten.map((p) => p.zusatz_control).filter(Boolean));
    const unbenutzt = controls.map((c) => c.id).filter((id) => !referenziert.has(id));
    expect(unbenutzt).toEqual([]);
  });

  it('Felder haben gültige Werte', () => {
    const fehler: string[] = [];
    for (const c of controls) {
      if (!c.artikel?.length) fehler.push(`${c.id}: artikel fehlt`);
      for (const r of c.rollen ?? []) if (!ROLLEN.includes(r)) fehler.push(`${c.id}: Rolle ${r}`);
      for (const k of c.risikoklassen ?? []) if (!RISIKOKLASSEN.includes(k)) fehler.push(`${c.id}: Klasse ${k}`);
      if (!['teilweise', 'nicht'].includes(c.abdeckung_42001)) fehler.push(`${c.id}: abdeckung ${c.abdeckung_42001}`);
      for (const x of c.verwandt_27001 ?? []) if (!CONTROLS_27001.includes(x)) fehler.push(`${c.id}: ${x} unbekannt`);
      if (!c.vorschlag_wenn || Object.keys(c.vorschlag_wenn).length === 0) fehler.push(`${c.id}: vorschlag_wenn fehlt`);
      fehler.push(...pruefeBedingung(c.vorschlag_wenn, c.id));
    }
    expect(fehler).toEqual([]);
  });
});

describe('Verweise auf ISO/IEC 42001', () => {
  it('Konstanten haben den erwarteten Umfang', () => {
    expect(CONTROLS_42001.length).toBe(38);
    expect(CONTROLS_27001.length).toBe(93);
  });

  it('alle Control- und Abschnittsverweise existieren', () => {
    const gueltig = new Set<string>([...CONTROLS_42001, ...KLAUSELN_42001]);
    const fehler: string[] = [];
    for (const p of pflichten) {
      for (const a of p.abdeckung_42001.controls) if (!CONTROLS_42001.includes(a)) fehler.push(`${p.id}: ${a}`);
      for (const k of p.abdeckung_42001.klauseln) if (!KLAUSELN_42001.includes(k)) fehler.push(`${p.id}: ${k}`);
    }
    for (const c of controls) for (const v of c.verwandt_42001) if (!gueltig.has(v)) fehler.push(`${c.id}: ${v}`);
    expect(fehler).toEqual([]);
  });
});

describe('Stand (src/ai-act/stand.yaml)', () => {
  it('Prüfdaten, Fassung und Fristen sind vollständig', () => {
    expect(istDatum(standDatei.geprueft_am)).toBe(true);
    expect(standDatei.naechste_pruefung).toBe('vor jedem Release');
    expect(standDatei.fassung.bezeichnung).toBe('konsolidiert 27.07.2026');
    expect(standDatei.fassung.aenderungen[0].in_kraft).toBe('2026-07-27');
    expect(standDatei.fassung.berichtigungen.map((b: any) => b.id)).toContain('C2');
    for (const f of standDatei.fristen) {
      expect(istDatum(f.datum), f.id).toBe(true);
      expect(['geltung', 'uebergang', 'kommission'], f.id).toContain(f.art);
    }
    for (const h of standDatei.hinweise) expect(['rechtstext', 'auslegung', 'zu_pruefen'], h.id).toContain(h.status);
  });
});

describe('Texte DE und EN', () => {
  const schluesselbaum = (o: any, praefix = ''): string[] =>
    o && typeof o === 'object'
      ? Object.entries(o).flatMap(([k, v]) => [`${praefix}${k}`, ...schluesselbaum(v, `${praefix}${k}.`)])
      : [];

  it('DE und EN haben dieselbe Schlüsselstruktur', () => {
    for (const bereich of ['pflichten', 'euaia', 'stand'] as const) {
      expect(schluesselbaum(texte.en[bereich]).sort(), bereich).toEqual(schluesselbaum(texte.de[bereich]).sort());
    }
  });

  it('jede Pflicht, jedes Zusatz-Control, jede Frist und jeder Hinweis hat Texte in beiden Sprachen', () => {
    const fehler: string[] = [];
    const leer = (v: unknown) => typeof v !== 'string' || v.trim() === '';
    for (const sprache of ['de', 'en'] as const) {
      const t = texte[sprache];
      for (const p of pflichten)
        for (const feld of ['kurz', 'nachweis']) if (leer(t.pflichten[p.id]?.[feld])) fehler.push(`${sprache} ${p.id}.${feld}`);
      for (const a of pflichtenDatei.ausgeklammert)
        if (leer(t.pflichten.ausgeklammert?.[a.grund])) fehler.push(`${sprache} ausgeklammert.${a.grund}`);
      for (const c of controls)
        for (const feld of ['name', 'hinweis', 'nachweis']) if (leer(t.euaia[c.id]?.[feld])) fehler.push(`${sprache} ${c.id}.${feld}`);
      for (const f of standDatei.fristen) if (leer(t.stand.fristen?.[f.id])) fehler.push(`${sprache} ${f.id}`);
      for (const h of standDatei.hinweise)
        for (const feld of ['titel', 'text']) if (leer(t.stand.hinweise?.[h.id]?.[feld])) fehler.push(`${sprache} ${h.id}.${feld}`);
      for (const feld of ['titel', 'text', 'geprueft', 'naechste']) if (leer(t.stand.fassung?.[feld])) fehler.push(`${sprache} fassung.${feld}`);
    }
    expect(fehler).toEqual([]);
  });

  it('keine Texte ohne Struktur (verwaiste Schlüssel)', () => {
    const pflichtIds = new Set([...pflichten.map((p) => p.id), 'ausgeklammert']);
    const controlIds = new Set(controls.map((c) => c.id));
    for (const sprache of ['de', 'en'] as const) {
      expect(Object.keys(texte[sprache].pflichten).filter((k) => !pflichtIds.has(k)), sprache).toEqual([]);
      expect(Object.keys(texte[sprache].euaia).filter((k) => !controlIds.has(k)), sprache).toEqual([]);
    }
  });

  it('eigene Texte ohne Eszett und ohne Gedankenstriche', () => {
    for (const datei of ['pflichten', 'euaia', 'stand'])
      for (const sprache of ['de', 'en']) {
        const roh = readFileSync(new URL(`src/i18n/${sprache}/${datei}.yaml`, wurzel), 'utf8');
        expect(roh, `${sprache}/${datei}`).not.toMatch(/[\u00df\u2013\u2014]/);
      }
  });
});

describe('Wörtliche Auszüge (src/ai-act/auszuege)', () => {
  const erwartet = [
    'art-002', 'art-003', 'art-004', 'art-005', 'art-006', 'art-022', 'art-025', 'art-026',
    'art-027', 'art-050', 'art-073', 'art-086', 'art-113', 'anhang-iii',
  ];

  it('DE und EN enthalten dieselben Dateien mit Kopf (Quelle, Fassung, Seite, Hinweis)', () => {
    for (const sprache of ['de', 'en']) {
      const ordner = new URL(`src/ai-act/auszuege/${sprache}/`, wurzel);
      expect(existsSync(ordner)).toBe(true);
      expect(readdirSync(ordner).map((f) => f.replace(/\.md$/, '')).sort()).toEqual([...erwartet].sort());
      for (const name of erwartet) {
        const inhalt = readFileSync(new URL(`${name}.md`, ordner), 'utf8');
        const kopf = parse(inhalt.split('---\n')[1] ?? '');
        for (const feld of ['quelle', 'fassung', 'auszug', 'umfang', 'seiten_pdf', 'hinweis'])
          expect(kopf?.[feld], `${sprache}/${name}.${feld}`).toBeTruthy();
        expect(inhalt.split('---\n')[2]?.trim().length, `${sprache}/${name}`).toBeGreaterThan(50);
      }
    }
  });
});

describe('GPAI: nur wer selbst ein KI-Modell mit allgemeinem Verwendungszweck in Verkehr bringt', () => {
  it('EUAIA-39 wird nur für Anbieter mit gpai: true vorgeschlagen', () => {
    const c = controls.find((x) => x.id === 'EUAIA-39');
    expect(c.vorschlag_wenn).toEqual({ rollen_any: ['anbieter'], gpai: true });
    // Kein anderes Zusatz-Control hängt an gpai
    for (const x of controls.filter((y) => y.id !== 'EUAIA-39')) expect(JSON.stringify(x.vorschlag_wenn ?? {}), x.id).not.toContain('gpai');
  });
  it('GPAI-Pflichten gelten nur mit gpai: true und nur für Anbieter oder Bevollmächtigte', () => {
    const gpai = pflichten.filter((p) => p.id.startsWith('P-GPAI-'));
    expect(gpai.length).toBeGreaterThan(0);
    for (const p of gpai) {
      expect(p.bedingung?.gpai, p.id).toBe(true);
      for (const r of p.rollen) expect(['anbieter', 'bevollmaechtigter'], p.id).toContain(r);
    }
    for (const p of pflichten.filter((x) => !x.id.startsWith('P-GPAI-'))) expect(p.bedingung?.gpai, p.id).toBeUndefined();
  });
  it('Nutzung eines GPAI-Modells löst keine GPAI-Pflicht aus (pflichtGiltFuer)', async () => {
    const { pflichtGiltFuer } = await import('../../src/vorlagen/E-0x.ts');
    const { kiSystem, vollstaendigesProjekt } = await import('../fixtures/projekt.ts');
    const projekt = vollstaendigesProjekt();
    const gpai = pflichten.filter((p) => p.id.startsWith('P-GPAI-') && p.rollen.includes('anbieter'));
    const nutzer = kiSystem({ aiAct: { rollen: ['betreiber'], risikoklasse: 'minimal', transparenz: [], gpai: false, begruendung: '', juristischGeprueft: false } });
    const eigenerChatbot = kiSystem({ aiAct: { rollen: ['anbieter', 'betreiber'], risikoklasse: 'transparenz', transparenz: ['50-1'], gpai: false, begruendung: '', juristischGeprueft: false } });
    const modellAnbieter = kiSystem({ aiAct: { rollen: ['anbieter'], risikoklasse: 'minimal', transparenz: [], gpai: true, begruendung: '', juristischGeprueft: false } });
    for (const p of gpai) {
      expect(pflichtGiltFuer(p, nutzer, projekt), p.id).toBe(false);
      expect(pflichtGiltFuer(p, eigenerChatbot, projekt), p.id).toBe(false);
    }
    expect(gpai.some((p) => pflichtGiltFuer(p, modellAnbieter, projekt))).toBe(true);
  });
});
