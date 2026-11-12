// AF-139 (QK-77): «erledigt» im Guide heisst, die Prüfung ist zufrieden. Der Guide nutzt dieselben Regeln wie die Prüfseite:
// Eine besuchte Seite ohne offene Pflichtangabe gilt nur als erledigt, wenn kein Befund zu ihr führt (F03 verlangt die passende
// Abschätzung zum System, H88 lässt keine Freigabe durch eine Person ohne Leitungsfunktion durch). Eigenschaftstest mit
// Zufallsständen (mulberry32 mit Seed, wie tests/unit/modell-folgen.test.ts); jede Fehlermeldung nennt den Seed.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { aktiveEtappen, aktiveSeiten, seitenStatus, type Umfeld } from '../../src/app/logik/gefuehrt.ts';
import type { GefuehrtDaten, SeiteDef } from '../../src/app/logik/gefuehrt-typen.ts';
import { befundeJeSeite, pruefe } from '../../src/app/logik/pruefung.ts';
import { gefuehrtSprung, OHNE_GUIDE_SEITE, REGELN_MIT_GUIDE_SEITE } from '../../src/app/logik/pruefsprung.ts';
import type { EuaiaControl } from '../../src/app/logik/vorschlaege.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const REPO = join(import.meta.dirname, '..', '..');
const gefuehrt = JSON.parse(readFileSync(join(REPO, 'src/generiert/gefuehrt.json'), 'utf8')) as GefuehrtDaten;
const regeln = (parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')) as { regeln: Parameters<typeof pruefe>[1] }).regeln;
const kataloge = ladeKataloge();
const controlIds = kataloge.controls42001.gruppen.flatMap((g) => g.controls.map((c) => c.id));
const euaia = (kataloge['aiact_euaiaControls'] as { controls: EuaiaControl[] }).controls;
const STICHTAG = '2026-10-25';
const AI_ACT_STAND = '2026-07-27';

const ohnePruefung: Umfeld = { gefuehrt, controlIds42001: controlIds, euaia };
/** Umfeld wie im Werkzeug (store.ts): Befunde der Prüfung je Seite */
const mitPruefung = (p: Projekt): { u: Umfeld; befunde: ReturnType<typeof pruefe> } => {
  const befunde = pruefe(p, regeln, controlIds, AI_ACT_STAND, STICHTAG, kataloge);
  return { befunde, u: { ...ohnePruefung, befundeJeSeite: (q) => befundeJeSeite(befunde, q, gefuehrt) } };
};

/** Alle aktiven Seiten aller aktiven Etappen als besucht */
function allesBesucht(p: Projekt): { etappe: string; seite: SeiteDef }[] {
  const r: { etappe: string; seite: SeiteDef }[] = [];
  for (const e of aktiveEtappen(gefuehrt, p)) {
    const seiten = aktiveSeiten(gefuehrt, e, p).filter((s): s is SeiteDef => s.typ !== 'fehlt');
    p.meta.gefuehrt.etappen[e.id] = { status: 'in-arbeit', spaeter: [], besucht: seiten.map((s) => s.id) };
    for (const seite of seiten) r.push({ etappe: e.id, seite });
  }
  return r;
}

function zufall(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Eingriffe, die je eine Regel auslösen, deren Seite der Guide kennt (Quelle: pruefsprung.ts) */
const EINGRIFFE: ((p: Projekt, z: () => number) => void)[] = [
  (p) => void (p.kiSysteme[0]!.eigner = ''), // F01
  (p) => void (p.risiken = []), // F02
  (p) => void (p.kiSysteme[0]!.sensibleNutzung = true), // F03 (verlangt die vollständige Abschätzung zum System)
  (p) => void (p.organisation.leitlinie.freigabe = { von: 'P-002', am: '2026-10-01' }), // H88 (keine Leitungsfunktion)
  (p) => void (p.organisation.geltungsbereich.freigabe = { von: 'P-001', am: '2027-03-01' }), // H89 (Datum in der Zukunft)
  (p) => void (p.audits[0]!.durchgefuehrt = '2027-03-01'), // H89
  (p) => void (p.controls[3]!.begruendung = ''), // F06
  (p, z) => void (p.controls[Math.floor(z() * p.controls.length)]!.anwendbar = 'offen'), // F05
  (p) => void (p.ziele[0]!.verantwortlich = ''), // F13
  (p) => void (p.organisation.leitlinie.grundsaetze = []), // F12
  (p) => void (p.managementbewertungen = []), // F16
  (p) => void (p.kiSysteme[0]!.modell = undefined), // H33
  // Verweisregister, Stimmigkeit und Zeit (AF-139): Regeln mit Feldern auf Guide-Seiten
  (p) => void (p.kiSysteme[0]!.eigner = 'P-099'), // F33 (Person im KI-System)
  (p, z) => void (p.controls[Math.floor(z() * p.controls.length)]!.nachweise = ['N-099']), // F33 (Nachweis im Control)
  (p) => void (p.organisation.entscheidungsrechte = [{ entscheid: 'einfuehren', wer: { tief: 'P-099' } } as never]), // F33 (verschachtelte Spalte)
  (p) => void (p.risiken[0]!.eigner = 'P-099'), // F33 (Person im Risiko)
  (p) => void (p.ziele[0]!.verantwortlich = 'P-099'), // F33 (Person im Ziel)
  (p) => void (p.kiSysteme[0]!.aiAct.juristischGeprueft = true), // F38 (ohne Beleg)
  (p) => void (p.kennzahlMessungen = [{ kennzahl: 'PR-19', datum: '2026-10-01', wert: '3 Stunden' }]), // F43
  (p) => void (p.kennzahlMessungen = [{ kennzahl: 'PR-12', datum: '2026-10-01', wert: '9 von 9', zaehler: 9, nenner: 9 }]), // F42
];

function zufallsStand(seed: number): Projekt {
  const z = zufall(seed);
  const p = vollstaendigesProjekt();
  p.personen.push({ id: 'P-002', name: 'Bruno Beispiel', funktion: 'Sachbearbeiter', aimsRollen: [] });
  const n = Math.floor(z() * 4);
  for (let i = 0; i < n; i++) EINGRIFFE[Math.floor(z() * EINGRIFFE.length)]!(p, z);
  return p;
}

describe('AF-139: «erledigt» im Guide gegen die Prüfung', () => {
  it('Eigenschaftstest: in 200 Zufallsständen gilt keine Seite als erledigt, zu der die Prüfung einen Befund hat', () => {
    let mitWiderspruch = 0;
    let unvollstaendigDurchPruefung = 0;
    const regelnGetroffen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const p = zufallsStand(seed);
      const seiten = allesBesucht(p);
      const { befunde, u } = mitPruefung(p);
      const befundSeiten = new Map<string, string[]>();
      for (const b of befunde) {
        const r = gefuehrtSprung(b, p, gefuehrt);
        if (r?.art === 'gefuehrt' && r.seite) befundSeiten.set(r.seite, [...(befundSeiten.get(r.seite) ?? []), b.regel]);
      }
      // Jeder Befund führt auf eine aktive Seite des Guides, ausser die Regel steht mit Grund in OHNE_GUIDE_SEITE
      for (const b of befunde) regelnGetroffen.add(b.regel);
      const ohneSeite = befunde.filter((b) => !(b.regel in OHNE_GUIDE_SEITE) && gefuehrtSprung(b, p, gefuehrt)?.art !== 'gefuehrt').map((b) => `${b.regel} ${b.id ?? ''}`);
      expect(ohneSeite, `Seed ${seed}: Befunde ohne Seite im Guide`).toEqual([]);
      for (const { etappe, seite } of seiten) {
        const mit = seitenStatus(seite, etappe, p, u);
        const ohne = seitenStatus(seite, etappe, p, ohnePruefung);
        if (befundSeiten.has(seite.id)) {
          if (mit === 'erledigt') mitWiderspruch++;
          expect(mit, `Seed ${seed}: ${seite.id} mit Befunden ${befundSeiten.get(seite.id)!.join(', ')}`).not.toBe('erledigt');
          if (ohne === 'erledigt') unvollstaendigDurchPruefung++;
        } else {
          // Ohne Befund bleibt der Stand der Pflichtfelder massgebend
          expect(mit, `Seed ${seed}: ${seite.id} ohne Befund`).toBe(ohne);
        }
      }
    }
    expect(mitWiderspruch).toBe(0);
    // Der Test hat Kraft: Ohne die Prüfregeln hätte der Guide in diesen Ständen Seiten fälschlich «erledigt» genannt
    expect(unvollstaendigDurchPruefung, 'Seiten, die nur wegen der Prüfung nicht erledigt sind').toBeGreaterThan(50);
    // Die Eingriffe treffen auch die Regeln, die vorher kein Ziel im Guide hatten
    expect([...regelnGetroffen].sort()).toEqual(expect.arrayContaining(['F33', 'F38', 'F42', 'F43']));
  });

  it('Vollständigkeit: jede Prüfregel hat eine Seite im Guide oder steht mit Grund in OHNE_GUIDE_SEITE', () => {
    const ids = regeln.map((r) => r.id);
    const ohne = ids.filter((id) => !REGELN_MIT_GUIDE_SEITE.includes(id) && !(id in OHNE_GUIDE_SEITE));
    expect(ohne, 'Regeln ohne Ziel und ohne Ausnahme').toEqual([]);
    expect(ids.filter((id) => REGELN_MIT_GUIDE_SEITE.includes(id) && id in OHNE_GUIDE_SEITE), 'Ziel und Ausnahme zugleich').toEqual([]);
    expect(Object.entries(OHNE_GUIDE_SEITE).filter(([id, grund]) => !ids.includes(id) || grund.length < 15), 'Ausnahmen ohne Regel oder Grund').toEqual([]);
  });

  it('Beispielprojekte: jeder Befund hat eine Seite im Guide oder eine Ausnahme mit Grund', () => {
    for (const f of ['muster-maschinenbau', 'praezisionsteile']) {
      const p = JSON.parse(readFileSync(join(REPO, `src/beispiele/${f}.de.aims.json`), 'utf8')) as Projekt;
      const befunde = pruefe(p, regeln, controlIds, AI_ACT_STAND, p.meta.geaendert?.slice(0, 10) ?? STICHTAG, kataloge);
      const ohneSeite = befunde.filter((b) => !(b.regel in OHNE_GUIDE_SEITE) && gefuehrtSprung(b, p, gefuehrt)?.art !== 'gefuehrt').map((b) => `${b.regel} ${b.id ?? ''}`);
      expect(ohneSeite, f).toEqual([]);
    }
  });

  it('F03: Kurzprüfung «kurz» bei sensibler Nutzung: Pflichtfelder der Seite sind gefüllt, nur F03 hält sie offen', () => {
    const p = vollstaendigesProjekt();
    p.kiSysteme[0]!.sensibleNutzung = true;
    p.folgenabschaetzungen = [{
      id: 'FA-001', kiSystem: 'KI-001', triage: { ergebnis: 'kurz', begruendung: 'Kurzprüfung ohne Hinweis auf erhebliche Folgen für Betroffene.' },
      systembeschreibung: '', verwendungen: '', fehlanwendungen: '', daten: '', einsatzumfeld: '', betroffene: [], nutzenSchaden: {}, ausfaelle: '',
      massnahmen: '', sensibleNutzung: true, eingeschraenkteNutzung: false, ergebnis: '',
    }];
    const seiten = allesBesucht(p);
    const f03 = pruefe(p, regeln, controlIds, AI_ACT_STAND, STICHTAG, kataloge).filter((b) => b.regel === 'F03');
    expect(f03.length, 'F03 meldet').toBeGreaterThan(0);
    const ziel = gefuehrtSprung(f03[0]!, p, gefuehrt);
    expect(ziel?.art === 'gefuehrt' ? ziel.seite : '').toBe('E7-triage-ergebnis');
    const eintrag = seiten.find((x) => x.seite.id === 'E7-triage-ergebnis')!;
    // Gegenprobe: Ohne Prüfregeln (Zustand vor der Änderung) wäre die Seite erledigt; mit ihnen offen
    expect(seitenStatus(eintrag.seite, eintrag.etappe, p, ohnePruefung), 'ohne Prüfregeln').toBe('erledigt');
    expect(seitenStatus(eintrag.seite, eintrag.etappe, p, mitPruefung(p).u), 'mit Prüfregeln').toBe('unvollstaendig');
  });

  it('H88: Freigabe durch eine Person ohne Leitungsfunktion oder die AIMS-Verantwortliche ohne Funktion hält die Freigabeseite offen', () => {
    for (const funktion of ['Sachbearbeiter', '']) {
      const p = vollstaendigesProjekt();
      p.personen.push({ id: 'P-002', name: 'Bruno Beispiel', funktion, aimsRollen: [] });
      p.organisation.aimsVerantwortlich = 'P-002';
      p.organisation.leitlinie.freigabe = { von: 'P-002', am: '2026-10-01' };
      const seiten = allesBesucht(p);
      const { befunde, u } = mitPruefung(p);
      expect(befunde.some((b) => b.regel === 'H88'), `Funktion «${funktion}»`).toBe(true);
      const s = seiten.find((x) => x.seite.id === 'E3-leitlinie-freigabe')!;
      expect(seitenStatus(s.seite, s.etappe, p, u), `Funktion «${funktion}»`).toBe('unvollstaendig');
    }
  });

  it('Der unveränderte Stand ohne Befund bleibt erledigt (keine Zusatzstrenge)', () => {
    const p = vollstaendigesProjekt();
    const seiten = allesBesucht(p);
    const { befunde, u } = mitPruefung(p);
    const aufSeiten = befunde.filter((b) => gefuehrtSprung(b, p, gefuehrt)?.art === 'gefuehrt');
    for (const { etappe, seite } of seiten) {
      const hat = aufSeiten.some((b) => { const r = gefuehrtSprung(b, p, gefuehrt); return r?.art === 'gefuehrt' && r.seite === seite.id; });
      if (!hat) expect(seitenStatus(seite, etappe, p, u), seite.id).toBe(seitenStatus(seite, etappe, p, ohnePruefung));
    }
  });
});
