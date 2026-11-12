// Bibliothek (R4): Sicht, Versionen, Status nach D-26, Anbindung der Register ohne Datenverlust, Abgleich, Ablagen,
// bibliothek.json, Sicherung als ZIP (Rundreise), Generator-Versionen, Textvorschau und D-26 aus der Bibliothek.
import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { abgleichen, gleicherAbgleich, zusammenfassen, type DateiStand } from '../../src/bibliothek/abgleich.ts';
import { OrdnerAblage, SchluesselAblage, SpeicherDateiAblage, berechtigung, registerLesen } from '../../src/bibliothek/ablage.ts';
import { ablageText, archivieren, aufraeumen, aussenAenderungUebernehmen, einrichten, entwurfAenderbar, metadatenSetzen, naechsteKennung, pruefeFreigabe, statusWechseln, versionHinzufuegen } from '../../src/bibliothek/aenderungen.ts';
import { generatorVersion, mitEntwurf, registerIdVon } from '../../src/bibliothek/generator.ts';
import { endungVon, ignorierteDatei, pfadSicher, pfadTeil, versionPfad } from '../../src/bibliothek/layout.ts';
import type { BibliothekVersion } from '../../src/bibliothek/modell.ts';
import { sha256 } from '../../src/bibliothek/pruefsumme.ts';
import { registerAusBibliothek } from '../../src/bibliothek/register.ts';
import { registerDatei, registerParsen, registerUebernehmen } from '../../src/bibliothek/register-datei.ts';
import { sicherungEntpacken, sicherungPacken } from '../../src/bibliothek/sicherung.ts';
import { imUnterbereich, naechsteVersion, sichtEintraege, vergleicheVersion, zaehler } from '../../src/bibliothek/sicht.ts';
import { docxText } from '../../src/bibliothek/vorschau.ts';
import { renderDocx } from '../../src/generator/docx.ts';
import type { XlsxMappe } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { d26, d26Register } from '../../src/vorlagen/D-26.ts';
import { pruefeProjekt } from '../../src/regeln/pruefungen.ts';
import { sprungRoute } from '../../src/app/logik/routen.ts';
import { SpeicherOrdner } from '../fixtures/ordner-doppel.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const kataloge = ladeKataloge();
const HEUTE = '2026-10-20';

async function version(pfad: string, inhalt: string, v: string, teil: Partial<BibliothekVersion> = {}): Promise<BibliothekVersion> {
  const d = strToU8(inhalt);
  return { version: v, datei: pfad, groesse: d.byteLength, pruefsumme: await sha256(d), datum: `${HEUTE}T10:00:00Z`, ...teil };
}

function projekt(): Projekt {
  const p = vollstaendigesProjekt();
  p.personen.push({ id: 'P-002', name: 'Beat Prüfer', funktion: 'Qualität', aimsRollen: [] }, { id: 'P-003', name: 'Clara Leitung', funktion: 'Geschäftsleitung', aimsRollen: [] });
  p.nachweise = [{ id: 'N-001', titel: 'Schulungsliste', art: 'schulung', ablageort: 'SharePoint/HR', datum: '2026-09-01' }];
  return p;
}

describe('Versionen und Layout', () => {
  it('vergleicht und zählt Versionen', () => {
    expect(vergleicheVersion('1.10', '1.9')).toBeGreaterThan(0);
    expect(vergleicheVersion('2', '1.9')).toBeGreaterThan(0);
    expect(naechsteVersion('firmendokument', '1.3')).toBe('1.4');
    expect(naechsteVersion('firmendokument', '1.3', true)).toBe('2.0');
    expect(naechsteVersion('eigene', undefined)).toBe('0.1');
    expect(naechsteVersion('nachweis', '2')).toBe('3');
  });
  it('baut sichere Pfade nach dem Ordner-Layout', () => {
    expect(versionPfad('firmendokument', 'D-07', 'KI-Risikoregister', '1.4', 'XLSX')).toBe('Firmendokumente/D-07_KI-Risikoregister/v1.4.xlsx');
    expect(versionPfad('nachweis', 'N-017', 'Schulung «Copilot» 2026/27', '1', 'pdf')).toBe('Nachweise/N-017_Schulung-«Copilot»-202627/v1.pdf');
    expect(pfadTeil('  ..  ')).toBe('Dokument');
    expect(pfadSicher('a/../b')).toBe(false);
    expect(pfadSicher('/abs')).toBe(false);
    expect(pfadSicher('Eigene/X-001_a/v1.0.pdf')).toBe(true);
    expect(endungVon('Vertrag.PDF')).toBe('pdf');
    expect(ignorierteDatei('Eigene/~$Vertrag.docx')).toBe(true);
    expect(ignorierteDatei('Eigene/x.docx.crswap')).toBe(true);
    expect(ignorierteDatei('bibliothek.json')).toBe(true);
  });
});

describe('Anbindung der Register (Migration ohne Datenverlust)', () => {
  it('einrichten lässt Dokumentenregister und Nachweise unverändert; die Sicht zeigt beide', () => {
    const p = projekt();
    const vorher = structuredClone({ dokumente: p.dokumente, nachweise: p.nachweise });
    einrichten(p, 'ordner', 'AIMS');
    expect({ dokumente: p.dokumente, nachweise: p.nachweise }).toEqual(vorher);
    expect(p.bibliothek).toEqual({ ablage: 'ordner', ordnerName: 'AIMS', eintraege: [] });
    const s = sichtEintraege(p, { titel: (id) => `Titel ${id}` });
    const d07 = s.find((e) => e.id === 'D-07')!;
    expect(d07).toMatchObject({ art: 'firmendokument', status: 'freigegeben', version: '1.0', gueltig: '1.0', naechstePruefung: '2027-10-01', titel: 'Titel D-07' });
    expect(s.find((e) => e.id === 'N-001')).toMatchObject({ art: 'nachweis', titel: 'Schulungsliste', status: 'freigegeben' });
  });
  it('Metadaten gehen ins passende Register; aufräumen entfernt leere Einträge', () => {
    const p = projekt();
    metadatenSetzen(p, 'D-07', 'firmendokument', { eigner: 'P-002', naechstePruefung: '2027-01-31', normbezug: ['6.1.2', ' 8.2 '] });
    expect(p.dokumente[0]).toMatchObject({ eigner: 'P-002', naechsteUeberpruefung: '2027-01-31' });
    expect(p.bibliothek!.eintraege[0]).toEqual({ id: 'D-07', art: 'firmendokument', versionen: [], normbezug: ['6.1.2', '8.2'] });
    metadatenSetzen(p, 'N-001', 'nachweis', { titel: 'Schulungsliste 2026' });
    expect(p.nachweise[0]!.titel).toBe('Schulungsliste 2026');
    metadatenSetzen(p, 'D-07', 'firmendokument', { normbezug: [] });
    aufraeumen(p);
    expect(p.bibliothek!.eintraege).toEqual([]);
  });
  it('vergibt freie Kennungen über Bibliothek und Nachweise', () => {
    const p = projekt();
    expect(naechsteKennung(p, 'N')).toBe('N-002');
    expect(naechsteKennung(p, 'X')).toBe('X-001');
  });
});

describe('Versionen und Status nach D-26', () => {
  it('eigene Datei: Entwurf, Prüfung, Freigabe mit zweiter Person; neue Version ersetzt die alte', async () => {
    const p = projekt();
    versionHinzufuegen(p, 'X-001', 'eigene', await version('Eigene/X-001_KI-Richtlinie/v0.1.docx', 'a', '0.1'), { titel: 'KI-Richtlinie' });
    metadatenSetzen(p, 'X-001', 'eigene', { eigner: 'P-001' });
    expect(statusWechseln(p, 'X-001', 'eigene', 'freigegeben').fehler).toBe('nicht-erlaubt');
    expect(statusWechseln(p, 'X-001', 'eigene', 'in-pruefung').fehler).toBeUndefined();
    expect(statusWechseln(p, 'X-001', 'eigene', 'freigegeben', {}).fehler).toBe('pruefung-fehlt');
    expect(statusWechseln(p, 'X-001', 'eigene', 'freigegeben', { geprueft: { von: 'P-002', am: '2026-10-11' } }).fehler).toBe('freigabe-fehlt');
    expect(statusWechseln(p, 'X-001', 'eigene', 'freigegeben', { geprueft: { von: 'P-002', am: '2026-10-11' }, freigabe: { von: 'P-002', am: '2026-10-12' } }).fehler).toBe('gleiche-person');
    expect(statusWechseln(p, 'X-001', 'eigene', 'freigegeben', { geprueft: { von: 'P-002', am: '2026-10-13' }, freigabe: { von: 'P-003', am: '2026-10-12' } }).fehler).toBe('reihenfolge');
    const ok = statusWechseln(p, 'X-001', 'eigene', 'freigegeben', { geprueft: { von: 'P-002', am: '2026-10-11' }, freigabe: { von: 'P-001', am: '2026-10-12' } });
    expect(ok).toEqual({ warnungen: ['eigner-gibt-frei'] });
    let s = sichtEintraege(p).find((e) => e.id === 'X-001')!;
    // D-26 (Nutzertest rc.10, U-06): der Entwurf 0.1 wird als 1.0 freigegeben, die Datei behält ihren Namen
    expect(s).toMatchObject({ status: 'freigegeben', version: '1.0', gueltig: '1.0', titel: 'KI-Richtlinie', freigabe: { von: 'P-001' } });
    expect(s.versionen.at(-1)).toMatchObject({ version: '1.0', entwurf: '0.1', datei: 'Eigene/X-001_KI-Richtlinie/v0.1.docx' });
    versionHinzufuegen(p, 'X-001', 'eigene', await version('Eigene/X-001_KI-Richtlinie/v1.1.docx', 'b', '1.1'));
    s = sichtEintraege(p).find((e) => e.id === 'X-001')!;
    expect(s).toMatchObject({ status: 'entwurf', version: '1.1', gueltig: '1.0' });
    statusWechseln(p, 'X-001', 'eigene', 'in-pruefung');
    expect(statusWechseln(p, 'X-001', 'eigene', 'freigegeben', { geprueft: { von: 'P-002', am: '2026-10-14' }, freigabe: { von: 'P-003', am: '2026-10-15' } }).fehler).toBe('aenderung-fehlt');
    statusWechseln(p, 'X-001', 'eigene', 'freigegeben', { geprueft: { von: 'P-002', am: '2026-10-14' }, freigabe: { von: 'P-003', am: '2026-10-15' }, aenderung: 'Kapitel 3 ergänzt' });
    s = sichtEintraege(p).find((e) => e.id === 'X-001')!;
    expect(s.versionen.map((v) => [v.version, v.status])).toEqual([['1.0', 'ersetzt'], ['1.1', 'freigegeben']]);
    expect(p.dokumente.some((d) => d.id === 'X-001')).toBe(false);
  });
  it('nie freigegebene Vorversionen gelten als ersetzt', async () => {
    const p = projekt();
    versionHinzufuegen(p, 'X-001', 'eigene', await version('Eigene/X-001_a/v0.1.docx', 'a', '0.1'), { titel: 'a' });
    versionHinzufuegen(p, 'X-001', 'eigene', await version('Eigene/X-001_a/v0.2.docx', 'b', '0.2'));
    expect(sichtEintraege(p).find((e) => e.id === 'X-001')!.versionen.map((v) => v.status)).toEqual(['ersetzt', 'entwurf']);
  });
  it('Regel «eigner»: Eigner/in darf freigeben', () => {
    expect(pruefeFreigabe({ geprueft: { von: 'P-002', am: '2026-01-01' }, freigabe: { von: 'P-001', am: '2026-01-02' } }, 'P-001', 'eigner').warnungen).toEqual([]);
  });
  it('Firmendokument: Freigabe schreibt Register mit Änderungshistorie, die alte Version wird nachgetragen', async () => {
    const p = projekt();
    versionHinzufuegen(p, 'D-07', 'firmendokument', await version('Firmendokumente/D-07_KI-Risikoregister/v1.1.xlsx', 'neu', '1.1'));
    // Register beschreibt weiter die gültige Version 1.0; die Sicht zeigt den Entwurf 1.1
    expect(p.dokumente[0]).toMatchObject({ version: '1.0', status: 'freigegeben' });
    expect(sichtEintraege(p).find((e) => e.id === 'D-07')).toMatchObject({ status: 'entwurf', version: '1.1', gueltig: '1.0' });
    statusWechseln(p, 'D-07', 'firmendokument', 'in-pruefung');
    const r = statusWechseln(p, 'D-07', 'firmendokument', 'freigegeben', { geprueft: { von: 'P-002', am: '2026-10-18' }, freigabe: { von: 'P-003', am: '2026-10-19' }, aenderung: 'Risiko R-002 ergänzt', textAeltere: 'Erstfassung' });
    expect(r.fehler).toBeUndefined();
    expect(p.dokumente[0]).toMatchObject({
      version: '1.1', status: 'freigegeben', freigabe: { von: 'P-003', am: '2026-10-19' }, geprueft: { von: 'P-002', am: '2026-10-18' }, ablageort: 'SharePoint',
      aenderungen: [{ version: '1.0', datum: '2026-10-10', was: 'Erstfassung', von: 'P-001' }, { version: '1.1', datum: '2026-10-19', was: 'Risiko R-002 ergänzt', von: 'P-003' }],
    });
  });
  it('Firmendokument ohne Registereintrag: Freigabe legt ihn mit Ablageort in der Bibliothek an', async () => {
    const p = projekt();
    versionHinzufuegen(p, 'D-12', 'firmendokument', await version('Firmendokumente/D-12_x/v0.1.docx', 'x', '0.1'));
    metadatenSetzen(p, 'D-12', 'firmendokument', { eigner: 'P-001', naechstePruefung: '2027-10-01' });
    statusWechseln(p, 'D-12', 'firmendokument', 'in-pruefung');
    statusWechseln(p, 'D-12', 'firmendokument', 'freigegeben', { geprueft: { von: 'P-002', am: '2026-10-18' }, freigabe: { von: 'P-003', am: '2026-10-19' } });
    expect(p.dokumente.find((d) => d.id === 'D-12')).toEqual({
      id: 'D-12', version: '1.0', status: 'freigegeben', ablageort: ablageText('Firmendokumente/D-12_x/v0.1.docx'), giltFuerIsms: false, eigner: 'P-001', naechsteUeberpruefung: '2027-10-01',
      aenderungen: [{ version: '1.0', datum: '2026-10-19', was: '', von: 'P-003' }], freigabe: { von: 'P-003', am: '2026-10-19' }, geprueft: { von: 'P-002', am: '2026-10-18' },
    });
    expect(p.bibliothek!.eintraege[0]!.eigner).toBeUndefined();
  });
  it('Register in Arbeit (Entwurf) folgt der neuesten Version', async () => {
    const p = projekt();
    p.dokumente.push({ id: 'D-27', version: '0.3', status: 'entwurf', ablageort: '', giltFuerIsms: false });
    versionHinzufuegen(p, 'D-27', 'firmendokument', await version('Firmendokumente/D-27_x/v0.4.docx', 'x', '0.4'));
    expect(p.dokumente.at(-1)).toMatchObject({ version: '0.4', status: 'entwurf' });
    statusWechseln(p, 'D-27', 'firmendokument', 'in-pruefung');
    expect(p.dokumente.at(-1)).toMatchObject({ version: '0.4', status: 'in-pruefung' });
  });
  it('Nachweis: neue Datei legt den Nachweis im Register an; neue Version ersetzt die alte', async () => {
    const p = projekt();
    versionHinzufuegen(p, 'N-002', 'nachweis', await version('Nachweise/N-002_Protokoll/v1.pdf', 'p', '1', { name: 'Protokoll.pdf' }), { titel: 'Protokoll Workshop', heute: HEUTE, nachweisArt: 'protokoll' });
    expect(p.nachweise.at(-1)).toEqual({ id: 'N-002', titel: 'Protokoll Workshop', art: 'protokoll', ablageort: 'Bibliothek: Nachweise/N-002_Protokoll/v1.pdf', datum: HEUTE });
    versionHinzufuegen(p, 'N-002', 'nachweis', await version('Nachweise/N-002_Protokoll/v2.pdf', 'q', '2'));
    expect(p.nachweise.at(-1)!.ablageort).toBe('Bibliothek: Nachweise/N-002_Protokoll/v2.pdf');
    const s = sichtEintraege(p).find((e) => e.id === 'N-002')!;
    expect(s.versionen.map((v) => v.status)).toEqual(['ersetzt', 'freigegeben']);
    // bestehender Ablageort der Firma bleibt
    versionHinzufuegen(p, 'N-001', 'nachweis', await version('Nachweise/N-001_x/v1.pdf', 'z', '1'));
    expect(p.nachweise[0]!.ablageort).toBe('SharePoint/HR');
  });
  it('archivieren: Register veraltet, zurückholen: wieder freigegeben', () => {
    const p = projekt();
    archivieren(p, 'D-07', 'firmendokument', true);
    expect(p.dokumente[0]!.status).toBe('veraltet');
    expect(sichtEintraege(p).find((e) => e.id === 'D-07')!.status).toBe('archiviert');
    archivieren(p, 'D-07', 'firmendokument', false);
    expect(p.dokumente[0]!.status).toBe('freigegeben');
  });
  it('Unterbereiche und Zähler', async () => {
    const p = projekt();
    versionHinzufuegen(p, 'X-001', 'eigene', await version('Eigene/X-001_a/v0.1.pdf', 'a', '0.1'), { titel: 'Vertrag' });
    metadatenSetzen(p, 'X-001', 'eigene', { naechstePruefung: '2026-10-01' });
    const s = sichtEintraege(p, { katalog: kataloge.dokumente.dokumente, vorlageTitel: (id) => id, rechtstexte: [{ id: 'RT-01', titel: 'AI Act', pfad: '../Rechtstexte/x.pdf' }] });
    const z = zaehler(s, HEUTE);
    expect(z).toMatchObject({ firma: 1, eigene: 1, nachweise: 1, recht: 1, entwurf: 1, pruefen: 1, ueberfaellig: 1, vorlagen: kataloge.dokumente.dokumente.length });
    expect(z.alle).toBe(4);
    expect(imUnterbereich(s.find((e) => e.id === 'V-D-07')!, 'alle', HEUTE)).toBe(false);
  });
});

describe('Abgleich Ordner und Register', () => {
  it('erkennt geändert, nur Zeit, fehlend, nicht lokal und neue Dateien; Prüfsumme nur bei Abweichung', async () => {
    const p = projekt();
    const v1 = await version('Eigene/X-001_a/v0.1.docx', 'eins', '0.1', { geaendert: 100 });
    const v2 = await version('Eigene/X-001_a/v0.2.docx', 'zwei', '0.2', { geaendert: 200 });
    versionHinzufuegen(p, 'X-001', 'eigene', v1, { titel: 'a' });
    versionHinzufuegen(p, 'X-001', 'eigene', v2);
    versionHinzufuegen(p, 'X-002', 'eigene', await version('Eigene/X-002_b/v0.1.pdf', 'b', '0.1', { geaendert: 300 }), { titel: 'b' });
    versionHinzufuegen(p, 'X-003', 'eigene', await version('Eigene/X-003_c/v0.1.pdf', 'c', '0.1', { geaendert: 400 }), { titel: 'c' });
    const inhalt: Record<string, string> = { 'Eigene/X-001_a/v0.1.docx': 'eins', 'Eigene/X-001_a/v0.2.docx': 'zwei!', 'Eigene/X-003_c/v0.1.pdf': 'c' };
    const dateien: DateiStand[] = [
      { pfad: 'Eigene/X-001_a/v0.1.docx', groesse: 4, geaendert: 150 },
      { pfad: 'Eigene/X-001_a/v0.2.docx', groesse: 5, geaendert: 250 },
      { pfad: 'Eigene/X-003_c/v0.1.pdf', groesse: 0, geaendert: 0, nichtLokal: true },
      { pfad: 'Eigene/neu.pdf', groesse: 3, geaendert: 1 },
      { pfad: 'Eigene/~$neu.docx', groesse: 3, geaendert: 1 },
      { pfad: 'bibliothek.json', groesse: 3, geaendert: 1 },
    ];
    const gelesen: string[] = [];
    const befunde = await abgleichen(p.bibliothek!.eintraege, dateien, async (pfad) => {
      gelesen.push(pfad);
      return sha256(strToU8(inhalt[pfad]!));
    });
    expect(befunde.map((b) => [b.art, b.id ?? b.pfad])).toEqual([['zeit', 'X-001'], ['geaendert', 'X-001'], ['fehlt', 'X-002'], ['nicht-lokal', 'X-003'], ['neu', 'Eigene/neu.pdf']]);
    expect(gelesen).toEqual(['Eigene/X-001_a/v0.1.docx', 'Eigene/X-001_a/v0.2.docx']);
    const z = zusammenfassen(befunde, '2026-10-20T10:00:00Z');
    expect(z).toEqual({ am: '2026-10-20T10:00:00Z', geaendert: ['X-001'], fehlend: ['X-002'], nichtLokal: ['X-003'] });
    expect(gleicherAbgleich({ ...z, am: 'früher' }, z)).toBe(true);
    expect(gleicherAbgleich(undefined, z)).toBe(false);
  });
  it('Entwurf übernimmt eine Änderung ausserhalb; freigegebene Version nur als neue Version', async () => {
    const p = projekt();
    versionHinzufuegen(p, 'X-001', 'eigene', await version('Eigene/X-001_a/v0.1.docx', 'eins', '0.1'), { titel: 'a' });
    expect(entwurfAenderbar(p, 'X-001', 'Eigene/X-001_a/v0.1.docx')).toBe(true);
    expect(aussenAenderungUebernehmen(p, 'X-001', 'Eigene/X-001_a/v0.1.docx', { pruefsumme: 'f'.repeat(64), groesse: 9, geaendert: 5 })).toBe('uebernommen');
    expect(p.bibliothek!.eintraege[0]!.versionen[0]).toMatchObject({ pruefsumme: 'f'.repeat(64), groesse: 9, geaendert: 5 });
    statusWechseln(p, 'X-001', 'eigene', 'in-pruefung');
    expect(entwurfAenderbar(p, 'X-001', 'Eigene/X-001_a/v0.1.docx')).toBe(false);
    const neu = await version('Eigene/X-001_a/v0.2.docx', 'zwei', '0.2');
    expect(aussenAenderungUebernehmen(p, 'X-001', 'Eigene/X-001_a/v0.1.docx', { pruefsumme: neu.pruefsumme, groesse: 4, geaendert: 6 }, neu)).toBe('neue-version');
    const e = p.bibliothek!.eintraege[0]!;
    expect(e.versionen.map((v) => [v.version, v.status, v.ueberschrieben ?? false])).toEqual([['0.1', 'in-pruefung', true], ['0.2', 'entwurf', false]]);
    // überschriebene Version meldet der Abgleich nicht mehr
    const b = await abgleichen(p.bibliothek!.eintraege, [{ pfad: 'Eigene/X-001_a/v0.1.docx', groesse: 1, geaendert: 7 }, { pfad: 'Eigene/X-001_a/v0.2.docx', groesse: 4, geaendert: 1 }], async () => neu.pruefsumme);
    expect(b.map((x) => x.art)).toEqual(['zeit']);
  });
});

describe('Ablagen', () => {
  it('Ordner: schreiben, lesen, Liste, löschen, grosse Datei, Berechtigung', async () => {
    const o = new SpeicherOrdner('AIMS');
    const a = new OrdnerAblage(o);
    const gross = new Uint8Array(30 * 1024 * 1024).map((_, i) => i & 255);
    const st = await a.schreiben('Firmendokumente/D-07_x/v1.0.xlsx', gross);
    expect(st.groesse).toBe(gross.byteLength);
    expect(await sha256(await a.lesen('Firmendokumente/D-07_x/v1.0.xlsx'))).toBe(await sha256(gross));
    await a.schreiben('bibliothek.json', strToU8('{}'));
    expect((await a.liste()).map((d) => d.pfad).sort()).toEqual(['Firmendokumente/D-07_x/v1.0.xlsx', 'bibliothek.json']);
    expect(await registerLesen(a)).toBe('{}');
    await a.loeschen('bibliothek.json');
    expect(await registerLesen(a)).toBeNull();
    await expect(a.lesen('fehlt/x.pdf')).rejects.toMatchObject({ name: 'NotFoundError' });
    await expect(a.schreiben('../x', strToU8('x'))).rejects.toThrow(/Ungültiger Pfad/);
    (await o.datei('Firmendokumente/D-07_x/v1.0.xlsx')).nichtLokal = true;
    expect((await a.liste()).find((d) => d.pfad.endsWith('.xlsx'))).toMatchObject({ nichtLokal: true });
    o.berechtigung = 'prompt';
    expect(await berechtigung(o, false)).toBe('prompt');
    expect(await berechtigung(o, true)).toBe('granted');
  });
  it('Browserspeicher: je Projekt getrennt, Kopie der Daten', async () => {
    const kv = new SpeicherDateiAblage();
    const a = new SchluesselAblage(kv, 'p1', 'Browserspeicher', () => 42);
    const b = new SchluesselAblage(kv, 'p2');
    const d = strToU8('Hallo');
    await a.schreiben('Eigene/X-001_a/v0.1.txt', d);
    d[0] = 0;
    expect(new TextDecoder().decode(await a.lesen('Eigene/X-001_a/v0.1.txt'))).toBe('Hallo');
    expect(await a.liste()).toEqual([{ pfad: 'Eigene/X-001_a/v0.1.txt', groesse: 5, geaendert: 42 }]);
    expect(await b.liste()).toEqual([]);
    await expect(b.lesen('Eigene/X-001_a/v0.1.txt')).rejects.toMatchObject({ name: 'NotFoundError' });
  });
});

describe('bibliothek.json und Sicherung als ZIP', () => {
  it('Register schreiben, lesen und in ein anderes Projekt übernehmen', async () => {
    const p = projekt();
    versionHinzufuegen(p, 'X-001', 'eigene', await version('Eigene/X-001_a/v0.1.pdf', 'a', '0.1'), { titel: 'Vertrag' });
    const text = registerDatei(p, sichtEintraege(p), '2026-10-20T10:00:00Z');
    const d = registerParsen(text)!;
    expect(d.uebersicht.find((e) => e.id === 'X-001')).toMatchObject({ titel: 'Vertrag', status: 'entwurf', version: '0.1', datei: 'Eigene/X-001_a/v0.1.pdf' });
    expect(registerParsen('{"format":"anders"}')).toBeNull();
    expect(registerParsen('kein json')).toBeNull();
    const q = projekt();
    expect(registerUebernehmen(q, d)).toEqual({ eintraege: 1, versionen: 1 });
    expect(registerUebernehmen(q, d)).toEqual({ eintraege: 0, versionen: 0 });
    expect(q.bibliothek!.eintraege).toEqual(p.bibliothek!.eintraege);
  });
  it('Rundreise: gleiche Dateien und Register, Prüfsummen stimmen', async () => {
    const dateien = [
      { pfad: 'Eigene/X-001_a/v0.1.pdf', daten: new Uint8Array(200_000).map((_, i) => (i * 7) & 255) },
      { pfad: 'Nachweise/N-001_b/v1.txt', daten: strToU8('Nachweis äöü') },
    ];
    const zip = sicherungPacken(dateien, '{"format":"aims-bibliothek"}', new Date('2026-10-20T10:00:00Z'));
    expect(sicherungPacken(dateien, '{"format":"aims-bibliothek"}', new Date('2026-10-20T10:00:00Z'))).toEqual(zip);
    const r = sicherungEntpacken(zip);
    expect(r.register).toBe('{"format":"aims-bibliothek"}');
    expect(r.dateien.map((d) => d.pfad)).toEqual(dateien.map((d) => d.pfad));
    for (const [i, d] of r.dateien.entries()) expect(await sha256(d.daten)).toBe(await sha256(dateien[i]!.daten));
  });
  it('lehnt unsichere Pfade ab (Zip Slip)', () => {
    expect(() => sicherungPacken([{ pfad: '../x', daten: new Uint8Array() }], '{}')).toThrow(/Ungültiger Pfad/);
    const boese = zipSync({ '../boese.txt': strToU8('x') });
    expect(() => sicherungEntpacken(boese)).toThrow(/Ungültiger Pfad/);
  });
});

describe('Generator und Bibliothek', () => {
  it('Version eines erzeugten Dokuments', async () => {
    const p = projekt();
    expect(generatorVersion(p, 'D-07')).toEqual({ version: '1.1' });
    expect(generatorVersion(p, 'D-12')).toEqual({ version: '0.1' });
    p.dokumente.push({ id: 'D-27', version: '0.3', status: 'entwurf', ablageort: '', giltFuerIsms: false });
    expect(generatorVersion(p, 'D-27')).toEqual({ version: '0.3' });
    versionHinzufuegen(p, 'D-27', 'firmendokument', await version('Firmendokumente/D-27_x/v0.3.docx', 'x', '0.3', { basis: 'a'.repeat(64), quelle: 'generator' }));
    expect(generatorVersion(p, 'D-27')).toEqual({ version: '0.4', basis: 'a'.repeat(64) });
    expect(registerIdVon('D-09', 'KI-001')).toBe('D-09-KI-001');
  });
  it('Entwurf im Dokumentkopf nur für das erzeugte Dokument', () => {
    const p = projekt();
    const q = mitEntwurf(p, 'D-07', '1.1');
    expect(q.dokumente[0]).toEqual({ id: 'D-07', version: '1.1', status: 'entwurf', ablageort: 'SharePoint', giltFuerIsms: false, naechsteUeberpruefung: '2027-10-01' });
    expect(p.dokumente[0]!.status).toBe('freigegeben');
    expect(mitEntwurf(p, 'D-12', '0.1').dokumente.at(-1)).toEqual({ id: 'D-12', version: '0.1', status: 'entwurf', ablageort: '', giltFuerIsms: false });
  });
  it('Textvorschau einer Word-Datei', async () => {
    const p = projekt();
    p.organisation.name = 'Muster <AG> & «Partner»';
    const ir = d26({ u: erstelleUebersetzer('de', ladeTexte('de')), modus: 'firma', form: 'dokument', projekt: p, kataloge, kitVersion: '1.0.0' });
    const a = docxText(await renderDocx(ir, { zeitpunkt: new Date('2026-10-20T10:00:00Z') }));
    expect(a.some((x) => x.ebene === 1 && /Was gelenkt wird/.test(x.text))).toBe(true);
    expect(a.some((x) => x.text.includes('Muster <AG> & «Partner»'))).toBe(true);
    expect(a.filter((x) => x.tabelle).length).toBeGreaterThan(3);
    expect(() => docxText(zipSync({ 'a.txt': strToU8('x') }))).toThrow(/Keine Word-Datei/);
  });
});

describe('D-26 aus der Bibliothek', () => {
  const ctx = (p: Projekt) => ({ u: erstelleUebersetzer('de', ladeTexte('de')), modus: 'firma' as const, form: 'dokument' as const, projekt: p, kataloge, kitVersion: '1.0.0' });
  const blatt = (m: XlsxMappe, name: string) => m.blaetter.find((b) => b.name === name)!;
  it('ohne Bibliothek und mit leerer Bibliothek unverändert', () => {
    const p = projekt();
    const ohne = d26Register(ctx(p));
    einrichten(p, 'browser');
    expect(d26Register(ctx(p))).toEqual(ohne);
    expect(registerAusBibliothek(p)).toBeNull();
  });
  it('eigene Dateien und Firmendokumente ohne Registereintrag als Zeilen; Version in Arbeit als Bemerkung', async () => {
    const p = projekt();
    versionHinzufuegen(p, 'X-001', 'eigene', await version('Eigene/X-001_KI-Richtlinie/v1.0.docx', 'a', '1.0'), { titel: 'KI-Richtlinie Einkauf' });
    statusWechseln(p, 'X-001', 'eigene', 'in-pruefung');
    statusWechseln(p, 'X-001', 'eigene', 'freigegeben', { geprueft: { von: 'P-002', am: '2026-10-11' }, freigabe: { von: 'P-003', am: '2026-10-12' } });
    versionHinzufuegen(p, 'D-07', 'firmendokument', await version('Firmendokumente/D-07_x/v1.1.xlsx', 'b', '1.1'));
    versionHinzufuegen(p, 'D-26-Register', 'firmendokument', await version('Firmendokumente/D-26-Register_x/v0.1.xlsx', 'c', '0.1'));
    const m = d26Register(ctx(p));
    const zeilen = blatt(m, 'Dokumente').zeilen;
    expect(zeilen.map((z) => z[0])).toEqual(['D-07', 'X-001']);
    expect(zeilen[1]!.slice(0, 5)).toEqual(['X-001', 'KI-Richtlinie Einkauf', 'Dokument', '1.0', 'freigegeben']);
    expect(String(zeilen[0]!.at(-1))).toContain('Version 1.1 in Arbeit (Entwurf)');
    expect(blatt(m, 'Änderungen').zeilen.some((z) => z[0] === 'X-001' && z[2] === '1.0')).toBe(true);
  });
});

describe('Prüfregeln der Bibliothek (H76 bis H80)', () => {
  const regeln = [76, 77, 78, 79, 80].map((n) => ({ id: `H${n}`, schwere: 'hinweis' as const, ziel: n === 80 ? 'bibliothek' : 'bibliothek/{id}', norm: '7.5' }));
  const ids = (p: Projekt, tag = HEUTE) => pruefeProjekt(regeln, { projekt: p, heute: tag, controlIds42001: [], aiActStand: '2026-07-27' }).map((b) => `${b.regel} ${b.id ?? ''}`.trim());
  it('ohne Bibliothek keine Befunde; Register-Dokumente meldet H01, nicht H76', () => {
    const p = projekt();
    expect(ids(p)).toEqual([]);
    einrichten(p, 'ordner');
    p.dokumente[0]!.naechsteUeberpruefung = '2026-01-01';
    expect(ids(p)).toEqual([]);
  });
  it('H77 nicht bei Freigabe mit Angaben und nicht bei Nachweisen', async () => {
    const p = projekt();
    versionHinzufuegen(p, 'X-001', 'eigene', await version('Eigene/X-001_a/v1.0.pdf', 'a', '1.0'), { titel: 'a' });
    statusWechseln(p, 'X-001', 'eigene', 'in-pruefung');
    statusWechseln(p, 'X-001', 'eigene', 'freigegeben', { geprueft: { von: 'P-002', am: '2026-10-01' }, freigabe: { von: 'P-003', am: '2026-10-02' } });
    versionHinzufuegen(p, 'N-002', 'nachweis', await version('Nachweise/N-002_b/v1.pdf', 'b', '1'), { titel: 'b' });
    expect(ids(p)).toEqual([]);
    delete p.bibliothek!.eintraege[0]!.versionen[0]!.freigabe;
    expect(ids(p)).toEqual(['H77 X-001']);
  });
  it('H80 erst nach 30 Tagen und nur mit Ungesichertem', async () => {
    const p = projekt();
    einrichten(p, 'browser');
    versionHinzufuegen(p, 'X-001', 'eigene', await version('Eigene/X-001_a/v0.1.pdf', 'a', '0.1', { datum: '2026-10-01T08:00:00Z' }), { titel: 'a' });
    expect(ids(p, '2026-10-31')).toEqual([]);
    expect(ids(p, '2026-11-01')).toEqual(['H80']);
    p.bibliothek!.gesichertAm = '2026-10-02T08:00:00Z';
    expect(ids(p, '2027-01-01')).toEqual([]);
  });
  it('Sprungziel führt in die Bibliothek', () => {
    expect(sprungRoute('bibliothek/X-001')).toEqual({ art: 'bibliothek', unter: 'alle', id: 'X-001' });
    expect(sprungRoute('bibliothek')).toEqual({ art: 'bibliothek', unter: 'alle' });
  });
});
