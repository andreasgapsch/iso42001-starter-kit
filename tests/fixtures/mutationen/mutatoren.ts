// Mutatoren für tests/unit/regeln-mutation.test.ts (AF-052, QK-29): gezielte Fehler in Kopien gültiger Beispiele.
// Jeder Mutator gehört zu einer Prüfregel (oder zur Stimmigkeitsprüfung) und hat zwei Seiten:
//   positiv: baut den Fehler ein und nennt die Marke, an der der Befund zu erkennen sein muss;
//   negativ: ändert dieselben Felder harmlos (gültiger Wert); die Marke darf nicht erscheinen.
// Gibt eine Seite undefined zurück, passt der Mutator nicht zum Beispiel (die Daten fehlen); das Beispiel zählt dann
// nicht. Marken, die schon vor der Mutation im Beispiel stehen, zählen ebenfalls nicht (nur neue Befunde sind Funde).
import type { Projekt } from '../../../src/model/typen.ts';
import { hohesAusmassAb, juengsteAbschaetzung } from '../../../src/regeln/stimmigkeit.ts';

/** Woran der Befund einer Mutation erkannt wird */
export interface Marke {
  /** Prüfregel (F33 bis F47) */
  regel?: string;
  /** Befund der Stimmigkeitsprüfung (src/regeln/stimmigkeit.ts) */
  stimm?: { art: string };
  id?: string | RegExp;
  /** Name der Prüfregel-Meldung oder `was` der Stimmigkeitsabweichung */
  text?: RegExp;
}

export interface Mutator {
  regel: string;
  /** Mutationsart aus AF-052 oder AF-079/AF-095 */
  art: string;
  /** Seit Beginn der Weiterentwicklung neu oder geändert (V2: beide Beispiele Pflicht) */
  stand: 'neu' | 'geaendert';
  /** Macht vor beiden Seiten den Befund der Marke unmöglich, wenn das Beispiel ihn schon hat (vor P15a und P15b) */
  sauber?: (p: Projekt) => void;
  positiv: (p: Projekt) => Marke | undefined;
  negativ: (p: Projekt) => Marke | undefined;
}

type Abschaetzung = Projekt['folgenabschaetzungen'][number];

const SPAET = '2099-01-01';
const FRUEH = '2000-01-01';
const ziele = (f: Abschaetzung) => Object.keys(f.nutzenSchaden ?? {}) as (keyof Abschaetzung['nutzenSchaden'])[];
const aktiv = (p: Projekt) => p.kiSysteme.filter((s) => s.status !== 'abgeloest' && s.status !== 'untersagt');
/** Control mit Wirksamkeitsangabe und Datum (Träger der Belegaussagen F39 bis F41) */
const controlMitBeleg = (p: Projekt) => p.controls.find((c) => c.wirksamkeit?.wann);
/** KI-System mit Freigabe (datierte Aussage mit Freitext) */
const freigegeben = (p: Projekt) => p.kiSysteme.find((s) => s.freigabe?.am);
const incident = (f: Projekt['feststellungen'][number]) => f.quelle === 'vorfall' || f.quelle === 'beinahe-vorfall';

/** Abschätzung mit mindestens einem Ziel, dessen Risiko im Register steht (F45) */
function abschaetzungMitRisiko(p: Projekt) {
  for (const f of juengsteAbschaetzung(p).values()) {
    const z = ziele(f)[0];
    const r = p.risiken.find((x) => typeof x.a === 'number');
    if (z && r && typeof f.nutzenSchaden[z]?.ausmass === 'number') return { f, z, r };
  }
  return undefined;
}

/** Zelle mit eigenem Satz je Ziel und Feld, damit keine Wiederholung entsteht */
const eindeutig = (f: Abschaetzung) => ziele(f).forEach((z, i) => { const x = f.nutzenSchaden[z]!; x.nutzen = `Eigener Nutzen Nummer ${i} für dieses Ziel`; x.schaden = `Eigener Schaden Nummer ${i} bei diesem Ziel`; });

/** Wie oft die Kennung im ganzen Projekt vorkommt (1: nur der Eintrag selbst, nichts zeigt darauf) */
const vorkommen = (p: Projekt, id: string) => JSON.stringify(p).split(`"${id}"`).length - 1;
const tagDavor = (iso: string) => new Date(Date.parse(`${iso.slice(0, 10)}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
/** Abschätzung mit mindestens zwei Zielen (F44) */
const mitZwei = (p: Projekt) => p.folgenabschaetzungen.find((x) => ziele(x).length >= 2);
/** Jüngste Abschätzung mit Ziel und System (F46) */
function fuerF46(p: Projekt) {
  for (const f of juengsteAbschaetzung(p).values()) {
    const s = p.kiSysteme.find((x) => x.id === f.kiSystem);
    if (s && ziele(f).length) return { f, s };
  }
  return undefined;
}
/** Ruhige Grundlage für die Zweige von F46: kleines Ausmass, keine der Fragen 3 bis 6, eingeschränkte Nutzung mit Auflagen */
const f46Ruhig = (p: Projekt) => {
  const t = fuerF46(p);
  if (!t) return;
  for (const z of ziele(t.f)) { const x = t.f.nutzenSchaden[z]!; if (typeof x.ausmass === 'number') x.ausmass = 1; }
  Object.assign(t.f.triage, { rechtspositionOderChancen: false, gesundheitOderSicherheit: false, verletzlicheGruppen: false, besondereDaten: false, automatisierteEntscheidung: false, grosseReichweite: false });
  t.f.eingeschraenkteNutzung = true;
  t.s.auflagen = 'Nur intern, Prüfung durch den Eigner';
};
const hochesAusmass = (p: Projekt, f: Abschaetzung) => { const z = ziele(f)[0]!; const x = f.nutzenSchaden[z]!; x.ausmass = hohesAusmassAb(p); };

export const MUTATOREN: Mutator[] = [
  // ---------------------------------------------------------------- F33 Verweisregister (AF-008)
  {
    regel: 'F33', art: 'unbekannte ID', stand: 'neu',
    positiv: (p) => { const s = p.kiSysteme[0]; if (!s) return; s.eigner = 'P-999'; return { regel: 'F33', text: new RegExp(`${s.id} → P-999`) }; },
    negativ: (p) => { const s = p.kiSysteme[0]; const x = p.personen[0]; if (!s || !x) return; s.eigner = x.id; return { regel: 'F33', text: new RegExp(`${s.id} → ${x.id}$`) }; },
  },
  {
    regel: 'F33', art: 'Eintrag löschen', stand: 'neu',
    positiv: (p) => {
      const s = p.kiSysteme[0];
      if (!s || !p.personen.some((x) => x.id === s.eigner)) return;
      const weg = s.eigner;
      p.personen = p.personen.filter((x) => x.id !== weg);
      return { regel: 'F33', text: new RegExp(`${s.id} → ${weg}$`) };
    },
    negativ: (p) => {
      // Eine Person, auf die nichts zeigt, wird gelöscht
      const x = p.personen.find((y) => vorkommen(p, y.id) === 1);
      if (x) {
        p.personen = p.personen.filter((y) => y.id !== x.id);
        return { regel: 'F33', text: new RegExp(`→ ${x.id}$`) };
      }
      // Sonst ein Eintrag der Kommunikation, auf den nichts zeigt
      const k = p.kommunikation.find((y) => vorkommen(p, y.id) === 1);
      if (!k) return;
      p.kommunikation = p.kommunikation.filter((y) => y.id !== k.id);
      return { regel: 'F33', text: new RegExp(`→ ${k.id}$`) };
    },
  },
  {
    regel: 'F33', art: 'Eintrag löschen (Nachweis)', stand: 'neu',
    positiv: (p) => {
      const c = p.controls.find((x) => x.nachweise.some((n) => p.nachweise.some((y) => y.id === n)));
      const id = c?.nachweise.find((n) => p.nachweise.some((y) => y.id === n));
      if (!c || !id) return;
      p.nachweise = p.nachweise.filter((n) => n.id !== id);
      return { regel: 'F33', text: new RegExp(`${c.id} → ${id}$`) };
    },
    negativ: (p) => {
      // Ein Nachweis, auf den nichts zeigt, wird gelöscht
      const n = p.nachweise.find((y) => vorkommen(p, y.id) === 1);
      if (!n) return;
      p.nachweise = p.nachweise.filter((y) => y.id !== n.id);
      return { regel: 'F33', text: new RegExp(`→ ${n.id}$`) };
    },
  },
  // ---------------------------------------------------------------- F34 wirksam bei offener Feststellung (AF-076)
  {
    regel: 'F34', art: 'wirksam bei offener Feststellung', stand: 'neu',
    positiv: (p) => {
      const c = p.controls.find((x) => x.status === 'wirksam');
      if (!c) return;
      p.feststellungen.push({ id: 'F-990', quelle: 'audit', einstufung: 'nk-schwer', beschreibung: 'Eingebauter Fehler', normbezug: c.id, korrektur: '', ursache: '', massnahmen: [], status: 'offen', datum: '2026-10-16' });
      return { regel: 'F34', id: c.id };
    },
    negativ: (p) => {
      // Offene Nichtkonformität zu einem anderen Control, das nicht «wirksam» ist
      const c = p.controls.find((x) => x.status === 'wirksam');
      const a = p.controls.find((x) => x.status !== 'wirksam' && x.anwendbar === 'ja' && !p.feststellungen.some((f) => f.status !== 'geschlossen' && f.normbezug.includes(x.id)));
      if (!c || !a) return;
      p.feststellungen.push({ id: 'F-990', quelle: 'audit', einstufung: 'nk-schwer', beschreibung: 'Zu einem anderen Control', normbezug: a.id, korrektur: 'Korrektur eingeleitet', ursache: 'Ursache geklärt', massnahmen: [], status: 'offen', datum: '2026-10-16' });
      return { regel: 'F34', id: c.id };
    },
  },
  {
    regel: 'F34', art: 'Control wird wirksam, Feststellung in Arbeit', stand: 'neu',
    positiv: (p) => {
      const c = p.controls.find((x) => x.status !== 'wirksam' && x.anwendbar === 'ja');
      if (!c) return;
      c.status = 'wirksam';
      p.feststellungen.push({ id: 'F-991', quelle: 'pruefung', einstufung: 'nk-leicht', beschreibung: 'Eingebauter Fehler', normbezug: `8.1; ${c.id}`, korrektur: '', ursache: '', massnahmen: [], status: 'in-arbeit', datum: '2026-10-16' });
      return { regel: 'F34', id: c.id };
    },
    negativ: (p) => {
      // N1: kein Control wird «wirksam»; zu einem wirksamen Control steht nur eine offene Beobachtung (keine Nichtkonformität)
      const c = p.controls.find((x) => x.status === 'wirksam' && !p.feststellungen.some((f) => f.einstufung.startsWith('nk') && f.status !== 'geschlossen' && f.normbezug.includes(x.id)));
      if (!c) return;
      p.feststellungen.push({ id: 'F-991', quelle: 'pruefung', einstufung: 'beobachtung', beschreibung: 'Nur eine Beobachtung', normbezug: c.id, korrektur: '', ursache: '', massnahmen: [], status: 'offen', datum: '2026-10-16' });
      return { regel: 'F34', id: c.id };
    },
  },
  // ---------------------------------------------------------------- F35 Prozess eingeführt ohne Durchführung (ersetzt H90)
  {
    regel: 'F35', art: 'Prozess «eingeführt» ohne Durchführung', stand: 'geaendert',
    positiv: (p) => {
      const e = p.prozesse?.find((x) => x.anwendbar !== 'nein' && x.reifeAm && (x.reife ?? 0) >= 2);
      if (!e) return;
      e.reifeAm = FRUEH;
      return { regel: 'F35', id: e.id };
    },
    negativ: (p) => {
      const e = p.prozesse?.find((x) => x.anwendbar !== 'nein' && x.reifeAm && (x.reife ?? 0) >= 2);
      if (!e) return;
      e.reifeAm = FRUEH;
      e.letzteDurchfuehrung = FRUEH;
      return { regel: 'F35', id: e.id };
    },
  },
  // ---------------------------------------------------------------- F36 Platzhalter in freigegebenem Dokument
  {
    regel: 'F36', art: 'offener Platzhalter', stand: 'neu',
    positiv: (p) => { const s = p.kiSysteme[0]; if (!s) return; s.zweck = 'Text ergänzen'; return { regel: 'F36', id: /^D-10/ }; },
    negativ: (p) => { const s = p.kiSysteme[0]; if (!s) return; s.zweck = 'Texte für Angebote entwerfen'; return { regel: 'F36', id: /^D-10/ }; },
  },
  {
    regel: 'F36', art: 'noch nicht zugewiesen', stand: 'neu',
    positiv: (p) => { const x = p.personen[0]; if (!x) return; x.funktion = 'noch nicht zugewiesen'; return { regel: 'F36', id: /^D-04/ }; },
    negativ: (p) => { const x = p.personen[0]; if (!x) return; x.funktion = `${x.funktion} (Stellvertretung geregelt)`; return { regel: 'F36', id: /^D-04/ }; },
  },
  // ---------------------------------------------------------------- F37 Rolle einer Prozessbahn ohne Besetzung
  {
    regel: 'F37', art: 'Rolle ohne Person', stand: 'neu',
    positiv: (p) => {
      if (!p.prozesse) return;
      p.rollen = [];
      for (const x of p.personen) x.aimsRollen = (x.aimsRollen as string[]).filter((r) => r !== 'it') as typeof x.aimsRollen;
      return { regel: 'F37', text: /(^|, )it(,|$)/ };
    },
    negativ: (p) => {
      // Die Rolle IT bekommt eine Person, die sie noch nicht hat
      const x = p.personen.find((y) => !(y.aimsRollen as string[]).includes('it'));
      if (!p.prozesse || !x) return;
      x.aimsRollen = [...x.aimsRollen, 'it'] as typeof x.aimsRollen;
      return { regel: 'F37', text: /(^|, )it(,|$)/ };
    },
  },
  // ---------------------------------------------------------------- F38 «juristisch geprüft» ohne Beleg
  {
    regel: 'F38', art: 'juristisch geprüft ohne Beleg', stand: 'neu',
    positiv: (p) => {
      const s = p.meta.modulAiAct ? p.kiSysteme.find((x) => x.status !== 'abgeloest' && x.status !== 'untersagt' && !x.aiAct.juristischGeprueft) : undefined;
      if (!s) return;
      s.aiAct.juristischGeprueft = true;
      delete s.aiAct.geprueft;
      return { regel: 'F38', id: s.id };
    },
    negativ: (p) => {
      // Mit Beleg (wer, wann) und ohne Artikel, zu dem eine Auslegung offen sein kann
      const s = p.meta.modulAiAct ? p.kiSysteme.find((x) => x.status !== 'abgeloest' && x.status !== 'untersagt' && !x.aiAct.juristischGeprueft && !x.aiAct.transparenz.length && !x.aiAct.ausnahmeArt63) : undefined;
      if (!s || !p.personen[0]) return;
      s.aiAct.juristischGeprueft = true;
      s.aiAct.geprueft = { von: p.personen[0].id, am: '2026-10-01' };
      return { regel: 'F38', id: s.id };
    },
  },
  // ---------------------------------------------------------------- F39 bis F41 zeitliche Gültigkeit
  {
    regel: 'F39', art: 'Beleg jünger als die Aussage', stand: 'neu',
    positiv: (p) => {
      const c = controlMitBeleg(p);
      const n = p.nachweise.find((x) => x.datum && x.datum > '2026-01-01');
      if (!c?.wirksamkeit || !n) return;
      c.wirksamkeit.wann = FRUEH;
      c.wirksamkeit.wie = `${c.wirksamkeit.wie ?? ''} siehe ${n.id}`;
      return { regel: 'F39', id: c.id };
    },
    negativ: (p) => {
      const c = controlMitBeleg(p);
      const n = p.nachweise.find((x) => x.datum && x.datum > '2026-01-01');
      if (!c?.wirksamkeit || !n) return;
      c.wirksamkeit.wann = SPAET;
      c.wirksamkeit.wie = `${c.wirksamkeit.wie ?? ''} siehe ${n.id}`;
      return { regel: 'F39', id: c.id };
    },
  },
  {
    regel: 'F40', art: 'Verweis auf nicht freigegebene Version', stand: 'neu',
    positiv: (p) => {
      const c = controlMitBeleg(p);
      const d = p.dokumente.find((x) => x.freigabe?.am && /^D-\d{2}$/.test(x.id));
      if (!c?.wirksamkeit || !d) return;
      c.wirksamkeit.wann = FRUEH;
      c.wirksamkeit.wie = `${c.wirksamkeit.wie ?? ''} gemäss ${d.id} v${d.version}`;
      return { regel: 'F40', id: c.id };
    },
    negativ: (p) => {
      const c = controlMitBeleg(p);
      const d = p.dokumente.find((x) => x.freigabe?.am && /^D-\d{2}$/.test(x.id));
      if (!c?.wirksamkeit || !d) return;
      c.wirksamkeit.wann = SPAET;
      c.wirksamkeit.wie = `${c.wirksamkeit.wie ?? ''} gemäss ${d.id} v${d.version}`;
      return { regel: 'F40', id: c.id };
    },
  },
  {
    regel: 'F41', art: 'Datum im Freitext jünger als das Kopfdatum', stand: 'neu',
    positiv: (p) => {
      const s = freigegeben(p);
      if (!s) return;
      s.freigabeBegruendung = `${s.freigabeBegruendung ?? ''} Rechtsstand: Stand 01.01.2099.`;
      return { regel: 'F41', id: s.id };
    },
    negativ: (p) => {
      const s = freigegeben(p);
      if (!s) return;
      s.freigabeBegruendung = `${s.freigabeBegruendung ?? ''} Rechtsstand: Stand 01.01.2000.`;
      return { regel: 'F41', id: s.id };
    },
  },
  // ---------------------------------------------------------------- F42 und F43 Kennzahlen
  {
    regel: 'F42', art: 'Stichprobe deckt nicht alle Systeme', stand: 'neu',
    positiv: (p) => {
      if (!p.kiSysteme.length) return;
      p.kennzahlMessungen = [...(p.kennzahlMessungen ?? []).filter((x) => x.kennzahl !== 'PR-12'), { kennzahl: 'PR-12', datum: '2027-02-04', wert: '999 von 999 (100 %)', sollErreicht: 'ja', zaehler: 999, nenner: 999, bemerkung: 'Eingebauter Fehler' }];
      return { regel: 'F42', id: 'PR-12' };
    },
    negativ: (p) => {
      // Die gültige Messung bekommt nur eine längere Bemerkung
      const m = p.kennzahlMessungen?.find((x) => x.kennzahl === 'PR-12' && !x.keineMessung);
      if (!m) return;
      m.bemerkung = `${m.bemerkung ?? ''} Zähler aus dem Inventar bestätigt.`;
      return { regel: 'F42', id: 'PR-12' };
    },
  },
  {
    regel: 'F43', art: 'PR-07 ohne Antrag und Entscheid', stand: 'geaendert',
    positiv: (p) => {
      if (!p.kiSysteme.length) return;
      for (const s of p.kiSysteme) { delete s.antragAm; delete s.entscheidAm; }
      p.kennzahlMessungen = [...(p.kennzahlMessungen ?? []).filter((x) => x.kennzahl !== 'PR-07'), { kennzahl: 'PR-07', datum: '2026-09-10', wert: '5 Tage', sollErreicht: 'ja', bemerkung: 'Eingebauter Fehler' }];
      return { regel: 'F43', id: 'PR-07' };
    },
    negativ: (p) => {
      const s = p.kiSysteme[0];
      if (!s) return;
      s.antragAm = '2026-09-01';
      s.entscheidAm = '2026-09-06';
      p.kennzahlMessungen = [...(p.kennzahlMessungen ?? []).filter((x) => x.kennzahl !== 'PR-07'), { kennzahl: 'PR-07', datum: '2026-09-10', wert: '5 Tage', sollErreicht: 'ja', bemerkung: 'Antrag bis Entscheid im Inventar' }];
      return { regel: 'F43', id: 'PR-07' };
    },
  },
  {
    regel: 'F43', art: 'PR-19 ohne Zeitfelder', stand: 'geaendert',
    sauber: (p) => { for (const f of p.feststellungen.filter(incident)) { const d = (f.datum ?? '2026-10-01').slice(0, 10); f.entdecktAm = `${d}T09:00`; f.eingedaemmtAm = `${d}T11:00`; } },
    positiv: (p) => {
      const f = p.feststellungen.find(incident);
      if (!f || !p.kennzahlMessungen?.some((x) => x.kennzahl === 'PR-19' && !x.keineMessung)) return;
      delete f.eingedaemmtAm;
      return { regel: 'F43', id: 'PR-19' };
    },
    negativ: (p) => {
      const f = p.feststellungen.find(incident);
      if (!f || !p.kennzahlMessungen?.some((x) => x.kennzahl === 'PR-19' && !x.keineMessung)) return;
      f.eingedaemmtAm = `${(f.datum ?? '2026-10-01').slice(0, 10)}T12:30`;
      return { regel: 'F43', id: 'PR-19' };
    },
  },
  // ---------------------------------------------------------------- F44 bis F47 Folgenabschätzung (AF-095)
  {
    regel: 'F44', art: 'wortgleiche Zellen über die Ziele', stand: 'neu',
    positiv: (p) => {
      const f = p.folgenabschaetzungen.find((x) => ziele(x).length >= 2);
      if (!f) return;
      for (const z of ziele(f)) { const x = f.nutzenSchaden[z]!; x.nutzen = 'Derselbe Satz in jeder Zelle'; x.schaden = 'Derselbe Satz in jeder Zelle'; }
      return { regel: 'F44', id: f.id };
    },
    negativ: (p) => {
      const f = p.folgenabschaetzungen.find((x) => ziele(x).length >= 2);
      if (!f) return;
      eindeutig(f);
      return { regel: 'F44', id: f.id };
    },
  },
  {
    regel: 'F45', art: 'Ausmass anders als im Risikoregister', stand: 'neu',
    positiv: (p) => {
      const t = abschaetzungMitRisiko(p);
      if (!t) return;
      const x = t.f.nutzenSchaden[t.z]!;
      x.schaden = `${x.schaden} (${t.r.id})`;
      x.ausmass = (t.r.a as number) + 1;
      return { regel: 'F45', id: t.f.id };
    },
    negativ: (p) => {
      // Das Risiko wird nur genannt, wo das Ausmass schon mit A vor der Behandlung übereinstimmt
      for (const f of p.folgenabschaetzungen) {
        for (const z of ziele(f)) {
          const x = f.nutzenSchaden[z]!;
          const r = p.risiken.find((y) => typeof y.a === 'number' && y.a === x.ausmass);
          if (r && !`${x.nutzen} ${x.schaden}`.includes(r.id)) { x.schaden = `${x.schaden} (${r.id})`; return { regel: 'F45', id: f.id }; }
        }
      }
      return undefined;
    },
  },
  {
    regel: 'F46', art: 'Entscheid folgt nicht der Schwelle', stand: 'neu',
    positiv: (p) => {
      const f = [...juengsteAbschaetzung(p).values()][0];
      if (!f) return;
      f.triage.rechtspositionOderChancen = true;
      f.triage.ergebnis = 'kurz';
      f.sensibleNutzung = false;
      return { regel: 'F46', id: f.id };
    },
    negativ: (p) => {
      // Genau eine der Fragen 3 bis 6 ist ein Grenzfall und kein Befund
      for (const f of juengsteAbschaetzung(p).values()) {
        const t = f.triage;
        if (!t.rechtspositionOderChancen && !t.gesundheitOderSicherheit && !t.verletzlicheGruppen && !t.besondereDaten && !t.automatisierteEntscheidung && !t.grosseReichweite) {
          t.grosseReichweite = true;
          return { regel: 'F46', id: f.id };
        }
      }
      return undefined;
    },
  },
  {
    regel: 'F46', art: 'zwei der Fragen 3 bis 6', stand: 'neu',
    sauber: f46Ruhig,
    positiv: (p) => { const t = fuerF46(p); if (!t) return; Object.assign(t.f.triage, { verletzlicheGruppen: true, besondereDaten: true, ergebnis: 'kurz' }); t.f.sensibleNutzung = false; return { regel: 'F46', id: t.f.id }; },
    negativ: (p) => { const t = fuerF46(p); if (!t) return; Object.assign(t.f.triage, { verletzlicheGruppen: true }); return { regel: 'F46', id: t.f.id }; },
  },
  {
    regel: 'F46', art: 'hohes Ausmass ohne eingeschränkte Nutzung', stand: 'neu',
    sauber: f46Ruhig,
    positiv: (p) => { const t = fuerF46(p); if (!t) return; hochesAusmass(p, t.f); t.f.eingeschraenkteNutzung = false; return { regel: 'F46', id: t.f.id }; },
    negativ: (p) => { const t = fuerF46(p); if (!t) return; hochesAusmass(p, t.f); t.f.eingeschraenkteNutzung = true; return { regel: 'F46', id: t.f.id }; },
  },
  {
    regel: 'F46', art: 'hohes Ausmass, freigegeben ohne Auflagen', stand: 'neu',
    sauber: f46Ruhig,
    positiv: (p) => { const t = fuerF46(p); if (!t) return; hochesAusmass(p, t.f); t.s.status = 'freigegeben'; t.s.auflagen = ''; return { regel: 'F46', id: t.f.id }; },
    negativ: (p) => { const t = fuerF46(p); if (!t) return; hochesAusmass(p, t.f); t.s.status = 'freigegeben'; t.s.auflagen = 'Nur intern, Prüfung durch den Eigner'; return { regel: 'F46', id: t.f.id }; },
  },
  {
    regel: 'F44', art: 'genau zwei Wiederholungen (Schwelle)', stand: 'neu',
    sauber: (p) => { const f = mitZwei(p); if (f) eindeutig(f); },
    positiv: (p) => {
      const f = mitZwei(p);
      if (!f) return;
      const [a, b] = ziele(f);
      f.nutzenSchaden[a!]!.schaden = f.nutzenSchaden[a!]!.nutzen;
      f.nutzenSchaden[b!]!.nutzen = f.nutzenSchaden[a!]!.nutzen;
      return { regel: 'F44', id: f.id };
    },
    negativ: (p) => {
      const f = mitZwei(p);
      if (!f) return;
      const a = ziele(f)[0]!;
      f.nutzenSchaden[a]!.schaden = f.nutzenSchaden[a]!.nutzen;
      return { regel: 'F44', id: f.id };
    },
  },
  {
    regel: 'F47', art: 'Inventar «sensible Nutzung» weicht ab', stand: 'neu',
    positiv: (p) => {
      for (const [id, f] of juengsteAbschaetzung(p)) {
        const s = aktiv(p).find((x) => x.id === id);
        if (!s) continue;
        s.sensibleNutzung = !f.sensibleNutzung;
        return { regel: 'F47', id: s.id };
      }
      return undefined;
    },
    negativ: (p) => {
      // Beide Seiten gleich «sensibel»
      for (const [id, f] of juengsteAbschaetzung(p)) {
        const s = aktiv(p).find((x) => x.id === id);
        if (!s || f.sensibleNutzung || s.sensibleNutzung || f.triage.ergebnis !== 'voll' || !f.betroffene.length || !Object.keys(f.nutzenSchaden).length) continue;
        f.sensibleNutzung = true;
        s.sensibleNutzung = true;
        return { regel: 'F47', id: s.id };
      }
      return undefined;
    },
  },
  // ---------------------------------------------------------------- Stimmigkeit (AF-079, src/regeln/stimmigkeit.ts)
  {
    regel: 'stimmigkeit', art: 'Datum nach Dokumentdatum (geprüft nach Freigabe)', stand: 'neu',
    positiv: (p) => {
      const d = p.dokumente.find((x) => x.geprueft?.am && x.freigabe?.am);
      if (!d?.geprueft) return;
      d.geprueft.am = SPAET;
      return { stimm: { art: 'datumskette' }, id: d.id, text: /geprüft 2099-01-01/ };
    },
    negativ: (p) => {
      const d = p.dokumente.find((x) => x.geprueft?.am && x.freigabe?.am);
      if (!d?.geprueft || !d.freigabe) return;
      d.geprueft.am = tagDavor(d.freigabe.am);
      return { stimm: { art: 'datumskette' }, id: d.id, text: /^geprüft/ };
    },
  },
  {
    regel: 'stimmigkeit', art: 'Messung nach Dokumentdatum von D-05', stand: 'neu',
    positiv: (p) => {
      if (!p.dokumente.some((x) => x.id === 'D-05' && x.freigabe?.am) || !p.kennzahlMessungen?.length) return;
      p.kennzahlMessungen = [...p.kennzahlMessungen, { kennzahl: 'KZ-01', datum: SPAET, wert: '1 von 1', bemerkung: 'Eingebauter Fehler' }];
      return { stimm: { art: 'datumskette' }, id: 'D-05', text: /Messung KZ-01 vom 2099-01-01/ };
    },
    negativ: (p) => {
      if (!p.dokumente.some((x) => x.id === 'D-05' && x.freigabe?.am) || !p.kennzahlMessungen?.length) return;
      p.kennzahlMessungen = [...p.kennzahlMessungen, { kennzahl: 'KZ-01', datum: FRUEH, wert: '1 von 1', bemerkung: 'Vor der Freigabe' }];
      return { stimm: { art: 'datumskette' }, id: 'D-05', text: /Messung KZ-01 vom 2000-01-01/ };
    },
  },
  {
    regel: 'stimmigkeit', art: 'PR-19 Stunden gegen das Register', stand: 'geaendert',
    positiv: (p) => {
      const m = p.kennzahlMessungen?.find((x) => x.kennzahl === 'PR-19' && !x.keineMessung);
      if (!m) return;
      m.wert = '9999 Stunden';
      return { stimm: { art: 'kennzahl' }, id: 'PR-19', text: /^9999 Stunden, das Register ergibt/ };
    },
    negativ: (p) => {
      const m = p.kennzahlMessungen?.find((x) => x.kennzahl === 'PR-19' && !x.keineMessung);
      if (!m) return;
      m.bemerkung = `${m.bemerkung ?? ''} Wert bestätigt.`;
      return { stimm: { art: 'kennzahl' }, id: 'PR-19', text: /^9999 Stunden/ };
    },
  },
  {
    regel: 'stimmigkeit', art: 'bestätigt vor der Freigabe', stand: 'neu',
    positiv: (p) => {
      const d = p.dokumente.find((x) => x.freigabe?.am && x.bestaetigt?.am);
      if (!d?.freigabe || !d.bestaetigt) return;
      d.bestaetigt.am = tagDavor(d.freigabe.am);
      return { stimm: { art: 'datumskette' }, id: d.id, text: /^bestätigt .* vor der Freigabe/ };
    },
    negativ: (p) => {
      const d = p.dokumente.find((x) => x.freigabe?.am && x.bestaetigt?.am);
      if (!d?.freigabe || !d.bestaetigt) return;
      d.bestaetigt.am = SPAET;
      return { stimm: { art: 'datumskette' }, id: d.id, text: /^bestätigt .* vor der Freigabe/ };
    },
  },
];
