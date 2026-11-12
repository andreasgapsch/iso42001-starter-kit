// Verweisregister (AF-008): jede Verweisart des Projekts, also jedes Feld, das die Kennung eines Eintrags einer anderen Liste
// trägt (Feld -> Zielliste), und die Prüfung «Verweis zeigt ins Leere». Der Test tests/unit/verweise.test.ts leitet die
// Verweisfelder aus dem erzeugten Schema ab und vergleicht sie mit diesem Register: ein neues Verweisfeld ohne Eintrag hier
// (oder in KEIN_VERWEIS mit Grund) bricht den Test. Grundlage für Löschschutz (AF-009) und Zähler (AF-010).
//
// Pfadschreibweise wie im Schema: `liste[].feld.unterfeld`, `[]` = Element einer Liste, `{}` = Wert einer Schlüsseltabelle.
import { ID_PRAEFIX, type Projekt } from './typen.ts';

export type Zielliste = keyof typeof ID_PRAEFIX | 'controls' | 'prozesse' | 'kennzahlen';

export interface Verweisart {
  /** Pfad des Feldes im Schema, zugleich der Name der Art */
  feld: string;
  /** Listen, in denen die Kennung stehen kann (mindestens eine muss sie enthalten) */
  ziel: readonly Zielliste[];
  /** Ziel hängt vom Geschwisterfeld ab (massnahmen[].herkunft.ref je nach herkunft.art); sonst gilt `ziel` */
  je?: { feld: string; ziele: Readonly<Record<string, Zielliste>> };
}

const PERSONEN: Zielliste[] = ['personen'];
const person = (feld: string): Verweisart => ({ feld, ziel: PERSONEN });
const ki = (feld: string): Verweisart => ({ feld, ziel: ['kiSysteme'] });
const massnahmen = (feld: string): Verweisart => ({ feld, ziel: ['massnahmen'] });
const nachweise = (feld: string): Verweisart => ({ feld, ziel: ['nachweise'] });
const prozesse = (feld: string): Verweisart => ({ feld, ziel: ['prozesse'] });

/** Alle Verweisarten. Die Personenfelder sind genau die Felder vom Typ PersonId im Schema. */
export const VERWEISE: readonly Verweisart[] = [
  // Personen (Typ PersonId; Felder mit «Person oder Funktion» prüfen nur Werte der Form P-001)
  ...[
    'bibliothek.eintraege[].eigner',
    'bibliothek.eintraege[].versionen[].autor',
    'bibliothek.eintraege[].versionen[].freigabe.von',
    'bibliothek.eintraege[].versionen[].geprueft.von',
    'controls[].verantwortlich',
    'controls[].wirksamkeit.wer',
    'dokumente[].aenderungen[].von',
    'dokumente[].bestaetigt.von',
    'dokumente[].eigner',
    'dokumente[].freigabe.von',
    'dokumente[].geprueft.von',
    'folgenabschaetzungen[].freigabe.von',
    'folgenabschaetzungen[].fria.durch',
    'folgenabschaetzungen[].mitgewirkt[]',
    'folgenabschaetzungen[].neubeurteilungen[].durch',
    'folgenabschaetzungen[].neubeurteilungen[].freigabe.von',
    'folgenabschaetzungen[].triage.durch',
    'kennzahlen[].werMisst',
    'kennzahlen[].werWertetAus',
    'kiSysteme[].aiAct.eingestuft.von',
    'kiSysteme[].aiAct.geprueft.von',
    'kiSysteme[].eigner',
    'kiSysteme[].freigabe.von',
    'kiSysteme[].messkonzept.unabhaengig.wer',
    'kommunikation[].wer',
    'kompetenzen[].personen[]',
    'lieferanten[].geprueft.von',
    'managementbewertungen[].entscheideListe[].verantwortlich',
    'managementbewertungen[].leitung',
    'massnahmen[].verantwortlich',
    'meldungen[].bearbeitung',
    'organisation.aimsVerantwortlich',
    'organisation.dokumentenlenkung.externeDokumente[].zustaendig',
    'organisation.entscheidungsrechte[].wer.hoch',
    'organisation.entscheidungsrechte[].wer.mittel',
    'organisation.entscheidungsrechte[].wer.tief',
    'organisation.geltungsbereich.freigabe.von',
    'organisation.gremien[].vorsitz',
    'organisation.leitlinie.freigabe.von',
    'organisation.meldekanalExtern.bearbeitung',
    'organisation.meldeweg.ausweichstelle',
    'organisation.projektauftrag.freigabe.von',
    'organisation.projektauftrag.sponsor',
    'organisation.projektauftrag.team[]',
    'prozesse[].bahnen[].person',
    'prozesse[].eigner',
    'prozesse[].stellvertretung',
    'risiken[].ausnahme.von',
    'risiken[].eigner',
    'risiken[].restrisikoAkzeptiert.von',
    'rollen[].informiert[]',
    'rollen[].konsultiert[]',
    'rollen[].rechenschaft',
    'rollen[].stellvertretung',
    'rollen[].verantwortlich',
    'ziele[].verantwortlich',
    'ziele[].werMisst',
    'ziele[].werWertetAus',
  ].map(person),
  // KI-Systeme
  ...[
    'bibliothek.eintraege[].verknuepfungen.kiSysteme[]',
    'controls[].kiSysteme[]',
    'feststellungen[].kiSystem',
    'folgenabschaetzungen[].kiSystem',
    'meldungen[].kiSystem',
    'risiken[].kiSystem',
    'ziele[].kiSysteme[]',
  ].map(ki),
  // Massnahmen
  ...[
    'feststellungen[].massnahmen[]',
    'managementbewertungen[].entscheideListe[].massnahme',
    'managementbewertungen[].massnahmen[]',
    'nistProfil{}.massnahmen[]',
    'risiken[].massnahmen[]',
  ].map(massnahmen),
  // Nachweise
  // Schritte nennen Dokumente und Nachweise (D-07, N-012): nur N-Kennungen sind Verweise, D-Kennungen stammen aus dem Katalog
  ...['prozesse[].schritte[].dokumente[]', 'bibliothek.eintraege[].verknuepfungen.nachweise[]', 'controls[].nachweise[]', 'massnahmen[].nachweise[]', 'prozesse[].nachweise[]'].map(nachweise),
  // Prozesse (Katalog PR-/PS-, eigene PE-)
  ...[
    'audits[].umfangProzesse[]',
    'bibliothek.eintraege[].verknuepfungen.prozesse[]',
    'eigeneProzesse[].schnittstellen[]',
    'feststellungen[].prozesse[]',
    'managementbewertungen[].prozesse[].id',
    'prozesse[].schritte[].verweis[]',
  ].map(prozesse),
  // Übrige
  { feld: 'audits[].umfangControls[]', ziel: ['controls'] },
  { feld: 'bibliothek.eintraege[].verknuepfungen.controls[]', ziel: ['controls'] },
  { feld: 'bibliothek.eintraege[].verknuepfungen.risiken[]', ziel: ['risiken'] },
  { feld: 'risiken[].controls[]', ziel: ['controls'] },
  { feld: 'feststellungen[].audit', ziel: ['audits'] },
  { feld: 'kiSysteme[].lieferant', ziel: ['lieferanten'] },
  { feld: 'prozesse[].extern.lieferant', ziel: ['lieferanten'] },
  { feld: 'prozesse[].kennzahl', ziel: ['ziele', 'kennzahlen'] },
  { feld: 'kennzahlMessungen[].kennzahl', ziel: ['kennzahlen'] },
  {
    feld: 'massnahmen[].herkunft.ref',
    ziel: ['risiken', 'audits', 'managementbewertungen', 'ziele', 'prozesse'],
    je: { feld: 'art', ziele: { risiko: 'risiken', audit: 'audits', managementbewertung: 'managementbewertungen', ziel: 'ziele', prozess: 'prozesse' } },
  },
];

/**
 * Felder, die nach Name und Beschreibung nach Verweis aussehen, aber keine Kennung einer Liste tragen. Der Test fordert für
 * jedes Kandidatenfeld des Schemas einen Eintrag in VERWEISE oder hier, mit Grund.
 */
export const KEIN_VERWEIS: readonly { feld: string; grund: string }[] = [
  { feld: 'audits[].ziel', grund: 'Freitext: Ziel des Audits' },
  { feld: 'kompetenzen[].rolle', grund: 'Freitext: Rolle oder Funktion, auf die sich die Kompetenzanforderung bezieht' },
  { feld: 'managementbewertungen[].eingaben.audits', grund: 'Freitext: Ergebnisse interner und externer Audits' },
  { feld: 'managementbewertungen[].ergebnisse.lieferanten', grund: 'Freitext: Ergebnis und Bewertung des Traktandums Lieferanten' },
  { feld: 'managementbewertungen[].ergebnisse.ziele', grund: 'Freitext: Ergebnis und Bewertung des Traktandums Ziele' },
  { feld: 'organisation.projektauftrag.ziel', grund: 'Freitext: Ziel des Projekts' },
  { feld: 'prozesse[].bahnen[].rolle', grund: 'Schlüssel einer Rolle des Prozesskatalogs (rollenBereich, aimsRolle), keine Liste des Projekts' },
  { feld: 'ziele[].ziel', grund: 'Freitext: Formulierung des Ziels' },
  { feld: 'audits[].checkliste{}.nachweis', grund: 'Freitext: Dokument mit Version, Aufzeichnung oder Nachweis-ID' },
  { feld: 'bibliothek.abgleich.fehlend[]', grund: 'abgeleitete Liste des letzten Abgleichs: Kennungen von Bibliothekseinträgen, vom Abgleich selbst gesetzt' },
  { feld: 'bibliothek.abgleich.geaendert[]', grund: 'abgeleitete Liste des letzten Abgleichs: Kennungen von Bibliothekseinträgen, vom Abgleich selbst gesetzt' },
  { feld: 'bibliothek.abgleich.nichtLokal[]', grund: 'abgeleitete Liste des letzten Abgleichs: Kennungen von Bibliothekseinträgen, vom Abgleich selbst gesetzt' },
  { feld: 'eigeneProzesse[].dokumente[]', grund: 'Kennungen aus dem Dokumentenkatalog (D-22, D-14), keine Liste des Projekts' },
  { feld: 'meta.geaendert', grund: 'Zeitstempel der letzten Änderung, kein Verweis' },
  { feld: 'prozesse[].schritte[].bahn', grund: 'prozessinterner Verweis auf prozesse[].bahnen[].id, bleibt innerhalb des Prozesses' },
  { feld: 'prozesse[].schritte[].naechste[]', grund: 'prozessinterner Verweis auf Schritt-IDs desselben Prozesses' },
  { feld: 'prozesse[].schritte[].zweige{}', grund: 'prozessinterner Verweis auf Schritt-IDs desselben Prozesses (Zweige der Entscheidung)' },
  { feld: 'audits[].stichproben[].nachweis', grund: 'Freitext: gesehener Nachweis, KI-System, Dokument oder Aufzeichnung' },
  { feld: 'feststellungen[].nachweis', grund: 'Freitext: objektiver Nachweis, was gesehen wurde' },
  { feld: 'folgenabschaetzungen[].fria.ref', grund: 'Freitext: Kennung oder Ablage der FRIA ausserhalb des Projekts' },
  { feld: 'folgenabschaetzungen[].massnahmen', grund: 'Freitext: beschriebene Massnahmen der Abschätzung' },
  { feld: 'kennzahlen[].kennzahl', grund: 'Bezeichnung der Kennzahl, kein Verweis' },
  { feld: 'kiSysteme[].genaiBewertung{}.massnahme', grund: 'Freitext: Massnahme, Control oder Verweis auf eine Massnahme' },
  { feld: 'kompetenzen[].massnahme', grund: 'Freitext: Massnahme zur Kompetenz' },
  { feld: 'kompetenzen[].nachweis', grund: 'Freitext: Nachweis der Kompetenz' },
  { feld: 'managementbewertungen[].ergebnisse.risiken', grund: 'Freitext: Ergebnis und Bewertung des Traktandums Risiken' },
  { feld: 'managementbewertungen[].eingaben.prozesse', grund: 'Freitext: Stand der Prozesse' },
  { feld: 'meta.checklisten{}.nachweis', grund: 'Freitext: gesehener Nachweis der Checkliste' },
  { feld: 'organisation.bewusstsein[].nachweis', grund: 'Freitext: Nachweis der Bewusstseinsbildung' },
  { feld: 'organisation.geltungsbereich.schnittstellen', grund: 'Freitext: Schnittstellen und Abhängigkeiten des Geltungsbereichs' },
  { feld: 'organisation.projektauftrag.risiken', grund: 'Freitext: Projektrisiken im Projektauftrag' },
  { feld: 'prozesse[].extern.name', grund: 'Name eines Dienstleisters ohne Eintrag im Lieferantenregister' },
  { feld: 'ziele[].kennzahl', grund: 'Bezeichnung der Kennzahl des Ziels, kein Verweis' },
  { feld: 'ziele[].massnahmen', grund: 'Freitext: was getan wird, um das Ziel zu erreichen' },
];

export interface HaengenderVerweis {
  /** Verweisart (Pfad im Schema) */
  feld: string;
  /** Genauer Ort, z. B. risiken[2].kiSystem */
  pfad: string;
  /** Liste, in der der Verweis steht (Wurzelfeld des Projekts) */
  wurzel: string;
  /** Kennung des Eintrags, in dem der Verweis steht (falls die Wurzelliste Einträge mit id hat) */
  quelleId?: string;
  /** Die Kennung, die ins Leere zeigt */
  wert: string;
  ziele: readonly Zielliste[];
  /** Liste, in der die Kennung nach ihrer Gestalt stehen müsste (für Meldungstexte) */
  zielliste: Zielliste;
}

type Objekt = Record<string, unknown>;
const istObjekt = (w: unknown): w is Objekt => typeof w === 'object' && w !== null && !Array.isArray(w);

/** Gestalt einer Kennung je Zielliste: nur Werte dieser Form gelten als Verweis, anderer Text ist Freitext und bleibt unberührt */
const KENNUNG: Record<Zielliste, RegExp> = {
  ...(Object.fromEntries(Object.entries(ID_PRAEFIX).map(([liste, p]) => [liste, new RegExp(`^${p}-\\d+$`)])) as Record<keyof typeof ID_PRAEFIX, RegExp>),
  controls: /^\S+$/,
  prozesse: /^(?:PR|PS|PE)-\d+$/,
  kennzahlen: /^KZ-\d+$/,
};

/** Kennzahlen der Vorlage (D-05), die ohne Eintrag in Projekt.kennzahlen gelten */
const KENNZAHLEN_VORLAGE = ['KZ-01', 'KZ-02', 'KZ-03', 'KZ-04', 'KZ-05', 'KZ-06'];

export interface VerweisOptionen {
  /** Kennungen der Katalogprozesse (PR-xx, PS-xx); ohne Angabe sind sie nicht prüfbar und gelten als vorhanden */
  katalogProzesse?: Iterable<string>;
  /**
   * Kennungen der Katalog-Controls (Anhang A, EUAIA, RMF): gültige Ziele auch ohne Eintrag in Projekt.controls, denn die
   * SoA-Einträge entstehen erst beim Bearbeiten (Risiken aus Katalogvorschlägen verweisen schon vorher auf Controls).
   * Ohne Angabe zählen nur die Controls des Projekts.
   */
  katalogControls?: Iterable<string>;
}

function kennungen(p: Projekt, liste: Zielliste, o: VerweisOptionen): Set<string> {
  const roh = p as unknown as Record<string, unknown>;
  const ids = (l: unknown): string[] => (Array.isArray(l) ? l.flatMap((e) => (istObjekt(e) && typeof e['id'] === 'string' ? [e['id']] : [])) : []);
  if (liste === 'prozesse') return new Set([...ids(p.prozesse), ...ids(p.eigeneProzesse), ...(o.katalogProzesse ?? [])]);
  if (liste === 'kennzahlen') return new Set([...ids(p.kennzahlen), ...KENNZAHLEN_VORLAGE]);
  if (liste === 'controls') return new Set([...ids(p.controls), ...ids(p.eigeneControls), ...(o.katalogControls ?? [])]);
  return new Set(ids(roh[liste]));
}

interface Fund {
  pfad: string;
  wert: unknown;
  eltern: Objekt | null;
  eintrag: unknown;
}

/** Teile eines Verweispfads: Feldnamen, `[]` (Listenelement) und `{}` (Wert einer Schlüsseltabelle); auch für den Löschschutz (AF-009) */
export const teile = (feld: string): string[] => feld.match(/\[\]|\{\}|[^.[\]{}]+/g) ?? [];

function sammle(k: unknown, t: string[], i: number, pfad: string, eltern: Objekt | null, eintrag: unknown, aus: Fund[]): void {
  if (i === t.length) {
    aus.push({ pfad, wert: k, eltern, eintrag });
    return;
  }
  const s = t[i]!;
  if (s === '[]') {
    if (Array.isArray(k)) k.forEach((x, j) => sammle(x, t, i + 1, `${pfad}[${j}]`, eltern, eintrag === undefined ? x : eintrag, aus));
  } else if (s === '{}') {
    if (istObjekt(k)) for (const [n, v] of Object.entries(k)) sammle(v, t, i + 1, `${pfad}.${n}`, k, eintrag, aus);
  } else if (istObjekt(k) && Object.hasOwn(k, s)) {
    sammle(k[s], t, i + 1, pfad ? `${pfad}.${s}` : s, k, eintrag, aus);
  }
}

/** Alle Stellen des Projekts, an denen die Verweisart steht, mit Wert (Zeichenketten, auch aus Listen) */
export function stellen(p: unknown, feld: string): { pfad: string; wert: string; eltern: Objekt | null; eintrag: unknown }[] {
  const aus: Fund[] = [];
  sammle(p, teile(feld), 0, '', null, undefined, aus);
  return aus.flatMap((f) => (typeof f.wert === 'string' && f.wert.trim() !== '' ? [{ ...f, wert: f.wert.trim() }] : []));
}

/**
 * Verweise, die auf keinen Eintrag zeigen. Nur Werte in der Gestalt einer Kennung der Zielliste zählen als Verweis
 * (P-001, KI-001, KZ-01, PR-08 …); Freitext in Feldern wie «Person oder Funktion» bleibt unberührt.
 */
export function haengendeVerweise(p: Projekt, o: VerweisOptionen = {}, arten: readonly Verweisart[] = VERWEISE): HaengenderVerweis[] {
  const zwischen = new Map<Zielliste, Set<string>>();
  const ids = (l: Zielliste) => zwischen.get(l) ?? (zwischen.set(l, kennungen(p, l, o)), zwischen.get(l)!);
  const treffer: HaengenderVerweis[] = [];
  for (const art of arten) {
    const wurzel = teile(art.feld)[0]!;
    for (const s of stellen(p, art.feld)) {
      let ziele: readonly Zielliste[] = art.ziel;
      if (art.je) {
        const z = art.je.ziele[String(s.eltern?.[art.je.feld])];
        if (!z) continue;
        ziele = [z];
      }
      const gesucht = ziele.find((z) => KENNUNG[z].test(s.wert));
      if (!gesucht) continue;
      // Katalogprozesse ohne Katalog nicht prüfbar
      if (ziele.includes('prozesse') && /^(?:PR|PS)-\d+$/.test(s.wert) && o.katalogProzesse === undefined) continue;
      if (ziele.some((z) => ids(z).has(s.wert))) continue;
      const id = istObjekt(s.eintrag) && typeof s.eintrag['id'] === 'string' ? s.eintrag['id'] : undefined;
      treffer.push({ feld: art.feld, pfad: s.pfad, wurzel, ...(id ? { quelleId: id } : {}), wert: s.wert, ziele, zielliste: gesucht });
    }
  }
  return treffer;
}
