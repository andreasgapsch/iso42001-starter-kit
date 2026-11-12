// Referenzielle Integrität und stabile IDs (AF-009, AF-010, QK-05): Löschen zeigt abhängige Einträge und entfernt jeden
// Verweis auf den gelöschten Eintrag (je Verweisart des Registers src/model/verweise.ts), neue IDs kommen aus dem Zähler je
// Liste in meta.idZaehler, der nie sinkt (keine Wiederverwendung gelöschter IDs). Der E2E-Fall «KI-System mit Risiken
// löschen» folgt in P16.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { alleControls42001 } from '../../src/kataloge/typen.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import { ID_PRAEFIX, SCHEMA_VERSION, type Projekt } from '../../src/model/typen.ts';
import { VERWEISE, haengendeVerweise, stellen, teile, type Verweisart, type Zielliste } from '../../src/model/verweise.ts';
import { projektReparieren, pruefeProjektDaten } from '../../src/app/import/laden.ts';
import { naechsteEigeneId } from '../../src/prozesse/katalog.ts';
import { abhaengigeEintraege, eintragBezeichnung, eintragLoeschen, gruppiereAbhaengige, istLoeschListe, loeschVorschau, neuerEintrag, verweiseEntfernen, type LoeschListe } from '../../src/app/logik/eintraege.ts';
import { formatiereId, idMerken, istListenName, naechsteId, nummerVon, vergibId, zaehlerAnheben, zaehlerVon, type ListenName } from '../../src/app/logik/ids.ts';

const REPO = join(import.meta.dirname, '..', '..');
const json = (rel: string) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
const { setzeAppDaten } = await import('../../src/app/daten.ts');
setzeAppDaten({
  texte: { de: ladeTexte('de'), en: ladeTexte('en') }, kataloge: ladeKataloge(), gefuehrt: json('src/generiert/gefuehrt.json'),
  regeln: { regeln: parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')).regeln }, version: '1.0.0', gebaut: '', beispiele: [],
});
const S = await import('../../src/app/zustand/store.ts');
const A = await import('../../src/app/ansichten/gefuehrt/aktionen.ts');
const PZ = await import('../../src/app/logik/prozesse.ts');
const { t, uiSprache } = await import('../../src/app/i18n.ts');

type Objekt = Record<string, unknown>;
const LISTEN = Object.keys(ID_PRAEFIX) as ListenName[];
/** Katalog-Controls (Anhang A) gelten als vorhanden; Katalogprozesse sind ohne Katalog nicht prüfbar (src/model/verweise.ts) */
const OPT = { katalogControls: alleControls42001(ladeKataloge()).map((c) => c.id) };
const beispiel = (name: string): Projekt => json(`src/beispiele/${name}.aims.json`) as Projekt;
const MUSTER = beispiel('muster-maschinenbau.de');
const ids = (p: Projekt, l: LoeschListe) => ((p[l] ?? []) as unknown as { id: string }[]).map((e) => e.id);
/** Die 16 Listen mit ID-Präfix und die eigenen Prozesse */
const LOESCH_LISTEN: LoeschListe[] = [...LISTEN, 'eigeneProzesse'];

/** Neuer Eintrag der Liste im Entwurf, wie ihn die App anlegt (eigener Prozess mit Zeile für Stand und Ablauf) */
function anlegen(p: Projekt, liste: LoeschListe): string {
  if (liste === 'eigeneProzesse') {
    const id = naechsteEigeneId(p);
    idMerken(p, 'eigeneProzesse', id);
    (p.eigeneProzesse ??= []).push({ id, titel: `Prozess ${id}`, gruppe: 'kern', art: 'nur-aims' });
    (p.prozesse ??= []).push({ id, anwendbar: 'ja' } as never);
    return id;
  }
  const neu = neuerEintrag(p, liste) as Objekt;
  (p[liste] as unknown as Objekt[]).push(neu);
  return String(neu['id']);
}

describe('IDs aus dem Zähler je Liste (AF-010)', () => {
  it('naechsteId nimmt das Maximum aus Zähler und höchster vorhandener Nummer', () => {
    expect(naechsteId('KI', [{ id: 'KI-001' }, { id: 'KI-003' }])).toBe('KI-004');
    expect(naechsteId('KI', [{ id: 'KI-001' }], 7)).toBe('KI-008');
    expect(naechsteId('KI', [{ id: 'KI-012' }], 7)).toBe('KI-013');
    expect(naechsteId('EC', [], 9)).toBe('EC-10');
    expect(formatiereId('R', 1234)).toBe('R-1234');
    expect(nummerVon('R', 'R-017')).toBe(17);
    expect(nummerVon('R', 'RO-017')).toBeNull();
    expect(nummerVon('R', 7)).toBeNull();
  });

  it.each(LISTEN)('%s: Löschen der letzten ID und Neuanlage ergibt eine neue Nummer (Wiederverwendung 0)', (liste) => {
    const p = structuredClone(MUSTER);
    const vorher = zaehlerVon(p, liste);
    const a = neuerEintrag(p, liste);
    (p[liste] as unknown as Objekt[]).push(a);
    expect(nummerVon(ID_PRAEFIX[liste], a['id'])).toBe(vorher + 1);
    expect(eintragLoeschen(p, liste, String(a['id']))).toBe(true);
    const b = neuerEintrag(p, liste);
    expect(b['id']).not.toBe(a['id']);
    expect(nummerVon(ID_PRAEFIX[liste], b['id'])).toBe(vorher + 2);
    expect(zaehlerVon(p, liste)).toBe(vorher + 2);
  });

  it('Löschen der höchsten vorhandenen ID ohne Neuanlage dazwischen: auch sie kommt nicht wieder (Projekt ohne Zähler)', () => {
    const p = leeresProjekt({ jetzt: '2026-11-07T10:00:00Z' });
    expect(p.meta.idZaehler).toBeUndefined();
    for (const n of [1, 2, 3]) p.kiSysteme.push({ ...neuerEintrag(p, 'kiSysteme'), name: `S${n}` } as never);
    // Datei ohne Zähler (z. B. von Hand bearbeitet): die höchste vorhandene Nummer gilt, das Löschen hält sie fest
    delete p.meta.idZaehler;
    eintragLoeschen(p, 'kiSysteme', 'KI-003');
    expect(p.meta.idZaehler).toEqual({ kiSysteme: 3 });
    expect(vergibId(p, 'kiSysteme')).toBe('KI-004');
  });

  it('der Zähler sinkt nie: zaehlerAnheben und idMerken ignorieren kleinere Werte und fremde Kennungen', () => {
    const p = leeresProjekt();
    zaehlerAnheben(p, 'risiken', 5);
    zaehlerAnheben(p, 'risiken', 3);
    zaehlerAnheben(p, 'risiken', 2.5);
    idMerken(p, 'risiken', 'R-004');
    idMerken(p, 'risiken', 'KI-099');
    expect(zaehlerVon(p, 'risiken')).toBe(5);
    idMerken(p, 'risiken', 'R-010');
    expect(p.meta.idZaehler).toEqual({ risiken: 10 });
    p.meta.idZaehler = { risiken: -3 };
    expect(zaehlerVon(p, 'risiken')).toBe(0);
    expect(istListenName('risiken')).toBe(true);
    expect(istListenName('controls')).toBe(false);
  });

  it('der Zähler steht in der gespeicherten Datei und gilt nach dem Laden weiter', () => {
    S.zustand.laden(structuredClone(MUSTER));
    const id = A.eintragHinzufuegen({ id: 'x', liste: 'risiken' } as never);
    expect(id).toBe('R-034');
    A.eintragEntfernen('risiken', id);
    const text = JSON.stringify(S.vorDemSpeichern(S.projekt.value!));
    const geladen = S.deserialisieren(text);
    expect(geladen.meta.idZaehler?.risiken).toBe(34);
    S.zustand.laden(geladen);
    expect(A.eintragHinzufuegen({ id: 'x', liste: 'risiken' } as never)).toBe('R-035');
  });

  it('Aktionen des Guides vergeben über den Zähler: Massnahme aus offenem Punkt, Eintrag mit fest vorgegebener ID', () => {
    S.zustand.laden(structuredClone(MUSTER));
    // P15b: Muster führt M-040 (R-033), der Zähler steht auf 40
    expect(A.alsMassnahme('Offener Punkt', 'E1-c1')).toBe('M-041');
    expect(S.projekt.value!.meta.idZaehler?.massnahmen).toBe(41);
    A.schreibeFeld({ pfad: 'titel', typ: 'text' } as never, 'Fest vorgegeben', { id: 'R-050', liste: 'risiken', neu: true, objekt: {} });
    const p = S.projekt.value!;
    expect(p.risiken.find((r) => r.id === 'R-050')?.titel).toBe('Fest vorgegeben');
    // Die feste ID verbraucht keine zusätzliche Nummer, ist aber festgehalten
    expect(p.meta.idZaehler?.risiken).toBe(50);
    expect(A.eintragHinzufuegen({ id: 'x', liste: 'risiken' } as never)).toBe('R-051');
  });
});

// ---- Löschen mit Abhängigkeiten (AF-009) ----

/** Ziellisten, deren Einträge sich löschen lassen, mit der Liste, in der der Eintrag steht (Controls: eigene, Prozesse: eigene PE-) */
function loeschbar(art: Verweisart): { ziel: Zielliste; liste: LoeschListe }[] {
  const ziele: Zielliste[] = art.je ? Object.values(art.je.ziele) : [...art.ziel];
  return ziele.flatMap((z): { ziel: Zielliste; liste: LoeschListe }[] =>
    z === 'controls' ? [{ ziel: z, liste: 'eigeneControls' }] : z === 'prozesse' ? [{ ziel: z, liste: 'eigeneProzesse' }] : istLoeschListe(z) ? [{ ziel: z, liste: z }] : []);
}
const ARTEN = VERWEISE.filter((a) => loeschbar(a).length > 0);

/** Setzt den Wert `id` an die Stelle der Verweisart; legt fehlende Zwischenobjekte an (nicht schemagültig, nur für die Verweisprüfung). */
function setzeVerweis(p: Projekt, art: Verweisart, id: string, ziel: Zielliste): void {
  const t = teile(art.feld);
  let k: unknown = p;
  for (let i = 0; i < t.length; i++) {
    const s = t[i]!;
    const letztes = i === t.length - 1;
    if (s === '[]') {
      const l = k as unknown[];
      if (letztes) l.push(id);
      else {
        if (!l.length || typeof l[0] !== 'object') l.unshift({});
        k = l[0];
      }
      continue;
    }
    const o = k as Objekt;
    const key = s === '{}' ? Object.keys(o)[0] ?? 'GV-1.1' : s;
    if (letztes) {
      o[key] = id;
      if (art.je) o[art.je.feld] = Object.entries(art.je.ziele).find(([, z]) => z === ziel)![0];
    } else {
      if (o[key] === undefined || o[key] === null || typeof o[key] !== 'object') o[key] = t[i + 1] === '[]' ? [] : {};
      k = o[key];
    }
  }
}

/** Stellen aller Verweisarten des Registers mit dem Wert `id` (Freitext wie audits[].checkliste{}.stichprobe zählt nicht) */
const registrierteStellen = (p: Projekt, id: string) => VERWEISE.flatMap((a) => stellen(p, a.feld).filter((s) => s.wert === id).map((s) => s.pfad));

describe('Löschen entfernt jeden Verweis (AF-009), je Verweisart', () => {
  it('jede Verweisart auf die 16 Listen, eigene Controls und eigene Prozesse ist abgedeckt; übrig bleiben nur Kennzahlen', () => {
    expect(ARTEN.length).toBeGreaterThan(88);
    // Nicht löschbar: Kennzahlen der Vorlage D-05 (KZ-01 bis KZ-06) und Messungen dazu
    for (const a of VERWEISE.filter((x) => !ARTEN.includes(x))) expect(a.ziel, a.feld).toEqual(['kennzahlen']);
    expect(ARTEN.filter((a) => loeschbar(a).some((l) => l.liste === 'eigeneProzesse')).length).toBeGreaterThanOrEqual(7);
  });

  const faelle = ARTEN.flatMap((art) => loeschbar(art).map((l) => [art.feld, l.liste, l.ziel] as const));
  it.each(faelle)('%s -> %s: abhängig angezeigt, nach dem Löschen hängende Verweise 0', (feld, liste, ziel) => {
    const art = VERWEISE.find((a) => a.feld === feld)!;
    const p = structuredClone(MUSTER);
    // Ziel: ein eigener Eintrag, damit kein anderer Verweis zufällig dieselbe Kennung trägt
    const id = anlegen(p, liste);
    setzeVerweis(p, art, id, ziel);
    expect(stellen(p, feld).some((s) => s.wert === id), 'Verweis gesetzt').toBe(true);
    const vorher = haengendeVerweise(p, OPT).length;
    const abh = abhaengigeEintraege(p, liste, id);
    expect(abh.some((a) => a.feld === feld), 'in der Abhängigkeitsanzeige').toBe(true);
    expect(eintragLoeschen(p, liste, id)).toBe(true);
    expect(ids(p, liste)).not.toContain(id);
    expect(stellen(p, feld).filter((s) => s.wert === id)).toEqual([]);
    expect(haengendeVerweise(p, OPT).filter((h) => h.wert === id)).toEqual([]);
    expect(haengendeVerweise(p, OPT).length).toBe(vorher);
    expect(abhaengigeEintraege(p, liste, id)).toEqual([]);
  });

  it.each(['muster-maschinenbau.de', 'praezisionsteile.en'])('%s: jeden Eintrag der 16 Listen und jeden eigenen Prozess einzeln löschen: hängende Verweise 0, Projekt bleibt schemagültig', (name) => {
    const basis = beispiel(name);
    const vorher = haengendeVerweise(basis, OPT).length;
    let geloescht = 0;
    let mitVerweisen = 0;
    for (const liste of LOESCH_LISTEN) {
      for (const id of ids(basis, liste)) {
        const p = structuredClone(basis);
        if (abhaengigeEintraege(p, liste, id).length) mitVerweisen++;
        eintragLoeschen(p, liste, id);
        geloescht++;
        const h = haengendeVerweise(p, OPT);
        if (h.length !== vorher || h.some((x) => x.wert === id)) expect(h.filter((x) => x.wert === id), `${liste} ${id}`).toEqual([]);
        expect(h.length, `${liste} ${id}`).toBe(vorher);
        // Schemaprüfung nur stichprobenweise (Laufzeit): jede zehnte Löschung und alle mit Verweisen auf Personen und KI-Systeme
        if (geloescht % 10 === 0 || liste === 'personen' || liste === 'kiSysteme' || liste === 'eigeneProzesse') {
          const r = pruefeProjektDaten(p);
          expect(r.ok, `${liste} ${id} ${r.ok ? '' : JSON.stringify(r.fehler.slice(0, 2))}`).toBe(true);
        }
      }
    }
    expect(geloescht).toBeGreaterThan(130);
    expect(mitVerweisen).toBeGreaterThan(50);
  });

  it('KI-System mit Risiken löschen: Risiken bleiben, ihr Verweis ist leer, Folgenabschätzung ohne System', () => {
    const p = structuredClone(MUSTER);
    const risiken = p.risiken.filter((r) => r.kiSystem === 'KI-001').map((r) => r.id);
    expect(risiken.length).toBeGreaterThan(0);
    const abh = abhaengigeEintraege(p, 'kiSysteme', 'KI-001');
    for (const r of risiken) expect(abh.some((a) => a.quelleId === r && a.feld === 'risiken[].kiSystem' && a.name !== '')).toBe(true);
    const anzahlRisiken = p.risiken.length;
    eintragLoeschen(p, 'kiSysteme', 'KI-001');
    expect(p.risiken).toHaveLength(anzahlRisiken);
    for (const r of risiken) expect(p.risiken.find((x) => x.id === r)!.kiSystem).toBe('');
    expect(registrierteStellen(p, 'KI-001')).toEqual([]);
    expect(pruefeProjektDaten(p).ok).toBe(true);
  });

  it('eigenes Control: die SoA-Zeile wird mitgelöscht, Verweise in Risiken entfernt', () => {
    const p = structuredClone(MUSTER);
    const abh = abhaengigeEintraege(p, 'eigeneControls', 'EC-01');
    expect(abh[0]).toMatchObject({ wurzel: 'controls', quelleId: 'EC-01', mitGeloescht: true });
    eintragLoeschen(p, 'eigeneControls', 'EC-01');
    expect(p.controls.some((c) => c.id === 'EC-01')).toBe(false);
    expect(registrierteStellen(p, 'EC-01')).toEqual([]);
    expect(pruefeProjektDaten(p).ok).toBe(true);
    // Zähler: EC-01 kommt nicht wieder, auch nicht nach dem Löschen aller eigenen Controls
    eintragLoeschen(p, 'eigeneControls', 'EC-02');
    expect(vergibId(p, 'eigeneControls')).toBe('EC-03');
  });

  it('Massnahme mit Herkunft: Verweis nur entfernt, wenn die Herkunftsart zur Liste passt', () => {
    const p = leeresProjekt();
    p.risiken.push(neuerEintrag(p, 'risiken') as never);
    p.ziele.push(neuerEintrag(p, 'ziele') as never);
    const m1 = { ...(neuerEintrag(p, 'massnahmen') as never as Objekt), herkunft: { art: 'risiko', ref: 'R-001' } };
    const m2 = { ...(neuerEintrag(p, 'massnahmen') as never as Objekt), herkunft: { art: 'checkliste', ref: 'R-001' } };
    p.massnahmen.push(m1 as never, m2 as never);
    expect(abhaengigeEintraege(p, 'risiken', 'R-001').map((a) => a.quelleId)).toEqual(['M-001']);
    expect(verweiseEntfernen(p, 'risiken', 'R-001')).toBe(1);
    expect(p.massnahmen.map((m) => m.herkunft.ref)).toEqual(['', 'R-001']);
    expect(eintragLoeschen(p, 'risiken', 'R-999')).toBe(false);
  });

  it('eigener Prozess: Verweise aus Feststellungen, Managementbewertung, Audit und anderen Prozessen verschwinden, die Nummer kommt nicht wieder', () => {
    const p = structuredClone(MUSTER);
    const pe = anlegen(p, 'eigeneProzesse');
    expect(pe).toBe('PE-02');
    p.feststellungen[0]!.prozesse = [...(p.feststellungen[0]!.prozesse ?? []), pe];
    p.managementbewertungen[0]!.prozesse = [{ id: pe } as never, ...(p.managementbewertungen[0]!.prozesse ?? [])];
    p.audits[0]!.umfangProzesse = [pe];
    p.eigeneProzesse![0]!.schnittstellen = [pe];
    const zeilenMb = p.managementbewertungen[0]!.prozesse!.length;
    const abh = abhaengigeEintraege(p, 'eigeneProzesse', pe);
    expect(new Set(abh.map((a) => a.feld))).toEqual(new Set(['feststellungen[].prozesse[]', 'managementbewertungen[].prozesse[].id', 'audits[].umfangProzesse[]', 'eigeneProzesse[].schnittstellen[]']));
    expect(abh.find((a) => a.feld === 'managementbewertungen[].prozesse[].id')!.mitGeloescht).toBe(true);
    expect(eintragBezeichnung(p, 'eigeneProzesse', pe)).toBe(`Prozess ${pe}`);
    eintragLoeschen(p, 'eigeneProzesse', pe);
    expect(registrierteStellen(p, pe)).toEqual([]);
    expect(haengendeVerweise(p, OPT).filter((h) => h.wert === pe)).toEqual([]);
    expect(p.prozesse!.some((x) => x.id === pe)).toBe(false);
    expect(p.managementbewertungen[0]!.prozesse).toHaveLength(zeilenMb - 1);
    expect(pruefeProjektDaten(p).ok).toBe(true);
    expect(p.meta.idZaehler?.eigeneProzesse).toBe(2);
    expect(naechsteEigeneId(p)).toBe('PE-03');
  });

  it('eigenenProzessLoeschen (Prozessansicht) löscht über den Löschschutz; Neuanlage vergibt eine neue Nummer', () => {
    S.zustand.laden(structuredClone(MUSTER));
    const pe = PZ.eigenenProzessAnlegen({ titel: 'Weg', gruppe: 'kern', art: 'nur-aims' }, []);
    expect(pe).toBe('PE-02');
    S.aendereMit((p) => {
      p.feststellungen[0]!.prozesse = [pe];
    });
    PZ.eigenenProzessLoeschen(pe);
    const p = S.projekt.value!;
    expect(ids(p, 'eigeneProzesse')).not.toContain(pe);
    expect(registrierteStellen(p, pe)).toEqual([]);
    expect(PZ.eigenenProzessAnlegen({ titel: 'Neu', gruppe: 'kern', art: 'nur-aims' }, [])).toBe('PE-03');
    // Alle eigenen Prozesse löschen: die Liste fällt weg wie bisher, der Zähler bleibt
    PZ.eigenenProzessLoeschen('PE-01');
    PZ.eigenenProzessLoeschen('PE-03');
    expect(S.projekt.value!.eigeneProzesse).toBeUndefined();
    expect(S.projekt.value!.meta.idZaehler?.eigeneProzesse).toBe(3);
    expect(PZ.eigenenProzessAnlegen({ titel: 'Danach', gruppe: 'kern', art: 'nur-aims' }, [])).toBe('PE-04');
  });

  it('Verweise im gelöschten Eintrag selbst zählen nicht als abhängig', () => {
    const p = leeresProjekt();
    p.personen.push({ id: 'P-001', name: 'A', funktion: '', aimsRollen: [] });
    p.risiken.push({ ...(neuerEintrag(p, 'risiken') as never as Objekt), eigner: 'P-001' } as never);
    expect(abhaengigeEintraege(p, 'risiken', 'R-001')).toEqual([]);
    expect(abhaengigeEintraege(p, 'personen', 'P-001')).toMatchObject([{ feld: 'risiken[].eigner', quelleId: 'R-001' }]);
  });

  it('eintragEntfernen (Store) löscht über den Löschschutz: keine stehenden Verweise, Zähler hält die Nummer', () => {
    S.zustand.laden(structuredClone(MUSTER));
    A.eintragEntfernen('personen', 'P-001');
    const p = S.projekt.value!;
    expect(ids(p, 'personen')).not.toContain('P-001');
    expect(haengendeVerweise(p, OPT).filter((h) => h.wert === 'P-001')).toEqual([]);
    expect(haengendeVerweise(p, OPT).length).toBe(haengendeVerweise(MUSTER, OPT).length);
    expect(p.meta.idZaehler?.personen).toBe(12); // P15b: Muster mit P-012 (Fachauditorin)
    // Listen ohne Zähler (Dokumente) löscht die Aktion wie bisher
    const d = p.dokumente[0]!.id;
    A.eintragEntfernen('dokumente', d);
    expect(S.projekt.value!.dokumente.some((x) => x.id === d)).toBe(false);
  });
});

describe('Reparaturweg beim Öffnen (projektReparieren) migriert und hält Nummern fest (AF-010)', () => {
  const v1 = () => json('tests/fixtures/migration/v1.muster-maschinenbau.de.aims.json') as Objekt;

  // Erwartung geändert (P14): die aktuelle Schemaversion ist 3 (AF-104); geprüft wird weiter der Zähler aus Schritt 1 -> 2
  it('reparierte Datei der Version 1 ergibt die aktuelle Version mit meta.idZaehler', () => {
    const roh = v1();
    (roh['risiken'] as Objekt[])[0]!['status'] = 42;
    const r = projektReparieren(roh);
    expect(r).not.toBeNull();
    expect(r!.projekt.schemaVersion).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(3);
    expect(r!.projekt.meta.idZaehler).toMatchObject({ risiken: 33, kiSysteme: 8, eigeneProzesse: 1 });
    expect(r!.aenderungen.length).toBeGreaterThan(0);
    expect(pruefeProjektDaten(r!.projekt).ok).toBe(true);
    // Die eingelesene Datei bleibt unverändert
    expect(roh['schemaVersion']).toBe(1);
  });

  it('ein weggefallener Eintrag hält seine Nummer im Zähler fest', () => {
    const roh = v1();
    (roh['eigeneProzesse'] as Objekt[]).push({ id: 'PE-0042', titel: 'Alt', gruppe: 'kern', art: 'nur-aims' });
    const r = projektReparieren(roh);
    expect(r).not.toBeNull();
    expect(ids(r!.projekt, 'eigeneProzesse')).toEqual(['PE-01']);
    expect(r!.projekt.meta.idZaehler?.eigeneProzesse).toBe(42);
    expect(naechsteEigeneId(r!.projekt)).toBe('PE-43');
  });

  it('Datei ohne Version: repariert wie bisher ohne Migration', () => {
    const roh = v1();
    delete roh['schemaVersion'];
    const r = projektReparieren(roh);
    expect(r === null || r.projekt.meta.idZaehler === undefined).toBe(true);
  });
});

describe('Abhängigkeitsanzeige vor dem Löschen (AF-009, W2, W3)', () => {
  it('nennt verweisende Einträge mit Kennung und Namen, eine Zeile je Eintrag', () => {
    const v = loeschVorschau(MUSTER, 'kiSysteme', 'KI-001', 100);
    expect(v.verweise).toBeGreaterThanOrEqual(v.eintraege);
    expect(v.eintraege).toBeGreaterThan(8);
    const r = v.gruppen.find((g) => g.wurzel === 'risiken')!;
    expect(r.quelleId).toMatch(/^R-\d{3}$/);
    expect(r.name).toBe(MUSTER.risiken.find((x) => x.id === r.quelleId)!.titel);
    expect(new Set(v.gruppen.map((g) => `${g.wurzel}|${g.quelleId}`)).size).toBe(v.gruppen.length);
  });

  it('zeigt höchstens acht Einträge und den Rest als Zahl (W3); abgeschlossene Einträge zuerst und markiert (W2)', () => {
    const v = loeschVorschau(MUSTER, 'personen', 'P-001');
    expect(v.eintraege).toBeGreaterThan(8);
    expect(v.gruppen).toHaveLength(8);
    expect(v.weitere).toBe(v.eintraege - 8);
    const alle = gruppiereAbhaengige(abhaengigeEintraege(MUSTER, 'personen', 'P-001'));
    const mitEnd = alle.filter((g) => g.endstatus).length;
    expect(mitEnd).toBeGreaterThan(0);
    expect(v.gruppen.slice(0, Math.min(8, mitEnd)).every((g) => g.endstatus)).toBe(true);
    expect(loeschVorschau(MUSTER, 'personen', 'P-001', 100).weitere).toBe(0);
  });

  it('ohne Abhängigkeiten: leere Anzeige (die Oberfläche fragt wie bisher nur nach)', () => {
    const p = structuredClone(MUSTER);
    p.kommunikation.push(neuerEintrag(p, 'kommunikation') as never);
    expect(loeschVorschau(p, 'kommunikation', 'KO-009')).toEqual({ gruppen: [], weitere: 0, eintraege: 0, verweise: 0 });
  });

  it.each(['de', 'en'] as const)('Texte der Anzeige gibt es in %s, mit Einzahl', (sprache) => {
    uiSprache.value = sprache;
    for (const k of ['titel', 'abhaengig', 'verweise', 'weitere', 'mitgeloescht', 'endstatus', 'verweise_entfernen', 'bereich_organisation', 'bereich_nistProfil', 'bereich_kennzahlMessungen']) {
      expect(t(`loeschen.${k}`, { anzahl: 3, eintrag: 'KI-001' }), k).not.toMatch(/^loeschen\./);
    }
    expect(t('loeschen.verweise', { anzahl: 1 })).toMatch(/^1 /);
    expect(t('loeschen.titel', { eintrag: 'KI-001' })).toContain('KI-001');
    uiSprache.value = 'de';
  });
});
