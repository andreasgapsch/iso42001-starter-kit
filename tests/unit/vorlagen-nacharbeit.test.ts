// Nacharbeit nach der Konsolidierung: D-02 ohne abgelöste und untersagte Systeme, gemeinsame Texte in allgemein.yaml,
// Anlage für Systemtabellen ab 8 KI-Systemen, Betreiberpflichten im Guide, E-06 Inhalte b und e.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { Block, DocxDokument, XlsxMappe } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Projekt, Sprache } from '../../src/model/typen.ts';
import { d01 } from '../../src/vorlagen/D-01.ts';
import { AUSSER_GELTUNG, d02 } from '../../src/vorlagen/D-02.ts';
import { d10 } from '../../src/vorlagen/D-10.ts';
import { d12 } from '../../src/vorlagen/D-12.ts';
import { d13 } from '../../src/vorlagen/D-13.ts';
import { d14 } from '../../src/vorlagen/D-14.ts';
import { d24 } from '../../src/vorlagen/D-24.ts';
import { E05_PUNKTE } from '../../src/vorlagen/E-05.ts';
import { e06 } from '../../src/vorlagen/E-06.ts';
import { ANLAGE_AB_SYSTEMEN, type Form, type Modus, type Vorlage, type VorlagenKontext } from '../../src/vorlagen/kontext.ts';
import { kiSystem, vollstaendigesProjekt } from '../fixtures/projekt.ts';
import { projektMitVielenSystemen } from '../fixtures/viele-systeme.ts';

const kataloge = ladeKataloge();
const uebersetzer = { de: erstelleUebersetzer('de', ladeTexte('de')), en: erstelleUebersetzer('en', ladeTexte('en')) };
const ctx = (projekt: Projekt, modus: Modus = 'firma', form: Form = 'dokument', sprache: Sprache = 'de', extra: Partial<VorlagenKontext> = {}): VorlagenKontext => ({
  u: uebersetzer[sprache], modus, form, projekt, kataloge, kitVersion: 'test', ...extra,
});
const text = (ir: unknown) => JSON.stringify(ir);
const tabellen = (d: DocxDokument) => d.bloecke.filter((b): b is Extract<Block, { typ: 'tabelle' }> => b.typ === 'tabelle');

describe('D-02 Systemliste des Geltungsbereichs', () => {
  it('zeigt abgelöste KI-Systeme nicht, untersagte mit Status (Stage 1 Runde 3)', () => {
    const p = vollstaendigesProjekt();
    p.kiSysteme = [
      kiSystem({ id: 'KI-001', name: 'Aktiv', status: 'freigegeben' }),
      kiSystem({ id: 'KI-002', name: 'Alt', status: 'abgeloest' }),
      kiSystem({ id: 'KI-003', name: 'Verboten', status: 'untersagt' }),
      kiSystem({ id: 'KI-004', name: 'Neu', status: 'in-pruefung' }),
    ];
    const ir = d02(ctx(p));
    const t = tabellen(ir).find((x) => x.kopf[1] === 'KI-System')!;
    expect(t.zeilen.map((z) => z[0])).toEqual(['KI-001', 'KI-003', 'KI-004']);
    expect(t.zeilen[1]![5]).toBe(uebersetzer.de.t('allgemein.ki_status.untersagt'));
    expect(text(ir)).toContain(uebersetzer.de.t('vorlagen.D-02.systeme_ohne_nutzung'));
    expect(AUSSER_GELTUNG).toEqual(['abgeloest']);
  });

  it('meldet, wenn alle Systeme abgelöst sind', () => {
    const p = vollstaendigesProjekt();
    p.kiSysteme = [kiSystem({ status: 'abgeloest' })];
    const ir = d02(ctx(p));
    expect(text(ir)).toContain(uebersetzer.de.t('vorlagen.D-02.systeme_keine_aktiven'));
    expect(tabellen(ir).some((x) => x.kopf[1] === 'KI-System')).toBe(false);
  });
});

describe('Gemeinsame Texte in allgemein.yaml', () => {
  it.each(['de', 'en'] as const)('Typ und Status der KI-Systeme (%s): D-02, D-10 und D-12 aus allgemein (N-21)', (sp) => {
    const u = uebersetzer[sp];
    const p = vollstaendigesProjekt();
    p.meta.dokumentSprache = sp;
    p.kiSysteme = [kiSystem({ typ: 'saas', status: 'eingeschraenkt' })];
    const zeile02 = tabellen(d02(ctx(p, 'firma', 'dokument', sp))).find((x) => x.zeilen[0]?.[0] === 'KI-001')!.zeilen[0]!;
    expect(zeile02[2]).toBe(u.t('allgemein.ki_typ.saas'));
    expect(zeile02[5]).toBe(u.t('allgemein.ki_status.eingeschraenkt'));
    const zeile12 = tabellen(d12(ctx(p, 'firma', 'dokument', sp))).find((x) => x.zeilen[0]?.[0] === 'KI-001')!.zeilen[0]!;
    expect(zeile12[2]).toBe(u.t('allgemein.ki_typ.saas'));
    expect(zeile12[4]).toBe(u.t('allgemein.ki_status.eingeschraenkt'));
    const inventar = (d10(ctx(p, 'firma', 'dokument', sp)) as XlsxMappe).blaetter[0]!;
    expect(inventar.zeilen[0]![13]).toBe(u.t('allgemein.ki_status.eingeschraenkt'));
  });

  it.each(['de', 'en'] as const)('keine doppelten Texte mehr in den Vorlagen (%s)', (sp) => {
    const lies = (f: string) => parse(readFileSync(`src/i18n/${sp}/vorlagen/${f}.yaml`, 'utf8')) as Record<string, unknown>;
    expect(lies('D-02')['typ']).toBeUndefined();
    expect(lies('D-02')['status']).toBeUndefined();
    expect(lies('D-01')['janein']).toBeUndefined();
    expect((lies('D-20')['listen'] as Record<string, unknown>)['ja_nein']).toBeUndefined();
    expect((lies('D-10')['listen'] as Record<string, unknown>)['status']).toBeUndefined();
    expect(lies('D-12')['typ']).toBeUndefined();
    expect(lies('D-12')['status']).toBeUndefined();
  });
});

describe('Anlage für Systemtabellen ab 8 KI-Systemen', () => {
  const vorlagen: [string, Vorlage][] = [['D-01', d01], ['D-02', d02], ['D-12', d12], ['D-13', d13], ['D-14', d14], ['D-24', d24]];
  // Anlage der Systemtabellen; die Anlage «Ergänzende Regeln» in D-12 (ab rc.2, Seitenlimit) und die Grafik-Anlagen
  // (Prozesslandkarte D-02, Entscheidungsbaum D-24) zählen nicht
  // und die Prozessliste in D-02 (ab Prozesse, viele Prozesse in einer eigenen Anlage)
  const grafik = [uebersetzer.de.t('vorlagen.grafik.d02.titel'), uebersetzer.de.t('vorlagen.grafik.d24.titel'), uebersetzer.de.t('vorlagen.D-02.prozesse_anlage')];
  const anlageIndex = (d: DocxDokument) =>
    d.bloecke.findIndex((b) => b.typ === 'ueberschrift' && /^Anlage [A-Z]:/.test(b.text) && !b.text.includes('Ergänzende Regeln') && !grafik.some((g) => b.text.endsWith(g)));

  it.each(vorlagen)('%s: mit 12 Systemen stehen alle System-IDs nur in der Anlage', (_id, v) => {
    const p = projektMitVielenSystemen(12, false);
    const ir = v(ctx(p)) as DocxDokument;
    const i = anlageIndex(ir);
    expect(i).toBeGreaterThan(0);
    // Die Anlagen beginnen nach einem Seitenumbruch (vor der Systemtabelle kann eine Grafik-Anlage stehen)
    const ersteAnlage = ir.bloecke.findIndex((b) => b.typ === 'ueberschrift' && /^Anlage [A-Z]:/.test(b.text));
    expect(ir.bloecke[ersteAnlage - 1]!.typ).toBe('seitenumbruch');
    const haupt = text(ir.bloecke.slice(0, ersteAnlage));
    expect(haupt).toContain(uebersetzer.de.t('allgemein.anlage.verweis', { anzahl: p.kiSysteme.length, nr: 'A' }).slice(0, 20));
    expect(haupt).not.toContain('KI-012');
    expect(text(ir.bloecke.slice(i))).toContain('KI-012');
  });

  it.each(vorlagen)('%s: unter 8 Systemen und in der leeren Vorlage keine Anlage', (_id, v) => {
    const p = projektMitVielenSystemen(ANLAGE_AB_SYSTEMEN - 1, false);
    expect(anlageIndex(v(ctx(p)) as DocxDokument)).toBe(-1);
    expect(anlageIndex(v(ctx(p, 'leer')) as DocxDokument)).toBe(-1);
  });

  it('D-14 als Ergänzungsblatt hat die Anlage ebenfalls am Ende', () => {
    const ir = d14(ctx(projektMitVielenSystemen(12, true), 'firma', 'ergaenzungsblatt'));
    expect(anlageIndex(ir)).toBeGreaterThan(0);
    // Nach der Systemtabelle folgt (ab rc.2, Seitenlimit) die Anlage B «Schweregrade und Einspruch»
    const b = ir.bloecke.findIndex((x) => x.typ === 'ueberschrift' && x.text.startsWith('Anlage B'));
    expect(b).toBeGreaterThan(anlageIndex(ir));
    expect(ir.bloecke[b - 1]!.typ).toBe('tabelle');
  });
});

describe('Guide: Betreiberpflichten (Art. 26) und E-06', () => {
  const seiten = (parse(readFileSync('src/gefuehrt/seiten/E9.yaml', 'utf8')) as { seiten: { id: string; felder?: { schluessel?: string }[] }[] }).seiten;
  const punkte = seiten
    .filter((s) => s.id.startsWith('E9-betreiber'))
    .flatMap((s) => (s.felder ?? []).map((f) => f.schluessel!.replace(/^E-05\.(.+)\.\{id\}$/, '$1')));

  it('E9-betreiber-* fragt alle Pflichten ab, die für Unternehmen gelten', () => {
    // Abs. 3 ist keine eigene Pflicht, Abs. 8 betrifft nur Stellen der EU, Abs. 10 nur die Strafverfolgung
    const ohne = ['organisation', 'eu-stellen', 'biometrie'];
    expect(new Set(punkte)).toEqual(new Set(E05_PUNKTE.filter((p) => !ohne.includes(p))));
  });

  it('E-06 übernimmt Zeitraum und Häufigkeit (b) und menschliche Aufsicht (e)', () => {
    const p = vollstaendigesProjekt();
    p.kiSysteme = [kiSystem({ aiAct: { ...kiSystem().aiAct, rollen: ['betreiber'], risikoklasse: 'hochrisiko-anhang-iii', anhangIiiBereich: '4a' } })];
    p.folgenabschaetzungen = [{
      id: 'IA-001', kiSystem: 'KI-001',
      triage: { rechtspositionOderChancen: true, gesundheitOderSicherheit: false, verletzlicheGruppen: false, besondereDaten: false, automatisierteEntscheidung: false, grosseReichweite: false, ergebnis: 'voll', begruendung: '' },
      systembeschreibung: '', verwendungen: '', fehlanwendungen: '', daten: '', einsatzumfeld: '', betroffene: [], nutzenSchaden: {}, ausfaelle: '', massnahmen: '',
      sensibleNutzung: true, eingeschraenkteNutzung: false, ergebnis: '',
      fria: { erforderlich: 'ja', begruendung: 'öffentliche Dienste', zeitraumHaeufigkeit: 'ab 2028 täglich', aufsicht: 'HR prüft jede Absage' },
    }];
    const t = text(e06(ctx(p, 'firma', 'dokument', 'de', { kiSystemId: 'KI-001' })));
    expect(t).toContain('ab 2028 täglich');
    expect(t).toContain('HR prüft jede Absage');
  });
});
