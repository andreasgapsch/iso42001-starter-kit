// Nacharbeit P11: Meldungen der neuen Regeln nennen Ursache und nächsten Schritt in der
// Sprache der Oberfläche. F41 nennt das Datum des Rechtsstands im Format der Sprache (DE TT.MM.JJJJ, EN DD/MM/YYYY), F37
// die unbesetzten Rollen statt der Prozesse, F38 nur die Auswege, die die Regel prüft.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { pruefeProjekt, type Regel } from '../../src/regeln/pruefungen.ts';
import { CONTROLS_42001, vollstaendigesProjekt } from '../fixtures/projekt.ts';

const REPO = join(import.meta.dirname, '..', '..');
const regeln = (parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')) as { regeln: Regel[] }).regeln;
const kataloge = ladeKataloge();
const { setzeAppDaten } = await import('../../src/app/daten.ts');
setzeAppDaten({
  texte: { de: ladeTexte('de'), en: ladeTexte('en') }, kataloge, gefuehrt: JSON.parse(readFileSync(join(REPO, 'src/generiert/gefuehrt.json'), 'utf8')),
  regeln: { regeln }, version: '1.0.0', gebaut: '', beispiele: [],
});
const { uiSprache } = await import('../../src/app/i18n.ts');
const { befundText } = await import('../../src/app/ansichten/pruefung/Pruefung.tsx');

const pruefe = (p: Projekt) => pruefeProjekt(regeln, { projekt: p, heute: '2027-02-15', controlIds42001: CONTROLS_42001, aiActStand: '2026-07-27', kataloge });
const stand = (kataloge['aiact_stand'] as { geprueft_am: string }).geprueft_am;
const [j, m, d] = stand.split('-');

describe('Meldungen der Regeln aus Runde 2b', () => {
  it('F41 nennt das Prüfdatum des Kits im Format der Sprache und den nächsten Schritt', () => {
    const p = vollstaendigesProjekt();
    p.dokumente.push({ ...p.dokumente[0]!, id: 'E-09' });
    const b = pruefe(p).find((x) => x.regel === 'F41')!;
    expect(b).toMatchObject({ id: 'E-09', name: 'E-09', datum: stand, schwere: 'fehler' });
    uiSprache.value = 'de';
    const de = befundText(b);
    expect(de.titel).toContain(`${d}.${m}.${j}`);
    expect(de.erklaerung).toContain(`Rechtsstand am ${d}.${m}.${j} neu geprüft`);
    expect(de.erklaerung).toMatch(/neue Version frei.*Bestätigung/);
    uiSprache.value = 'en';
    const en = befundText(b);
    expect(en.erklaerung).toContain(`${d}/${m}/${j}`);
    expect(en.erklaerung).toMatch(/new version.*confirmation/);
    expect(`${en.titel} ${en.erklaerung}`).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    uiSprache.value = 'de';
  });

  it('F37 nennt die unbesetzten Rollen in der Sprache, nicht die Prozesse', () => {
    const p = vollstaendigesProjekt();
    p.prozesse = [{ id: 'PR-21', anwendbar: 'ja' }];
    const b = pruefe(p).find((x) => x.regel === 'F37')!;
    expect(b.rollen?.length).toBeGreaterThan(0);
    expect(b.name).not.toMatch(/PR-\d/);
    uiSprache.value = 'de';
    const de = befundText(b).titel;
    expect(de).not.toMatch(/PR-\d/);
    for (const r of b.rollen!) expect(de).not.toMatch(new RegExp(`\\b${r}\\b`)); // Bezeichnung statt Schlüssel, z. B. «Personal» statt «hr»
    uiSprache.value = 'de';
  });

  it('F38 nennt nur Auswege, die die Regel prüft (Angabe entfernen oder Beleg erfassen)', () => {
    for (const sprache of ['de', 'en'] as const) {
      const t = ladeTexte(sprache) as unknown as { regeln: Record<string, { erklaerung: string }> };
      const e = t.regeln.F38!.erklaerung;
      expect(e).not.toMatch(/Risiko, Termin und Eigner|risk, deadline and owner/);
      expect(e).toMatch(sprache === 'de' ? /entfernen Sie «juristisch geprüft»/ : /remove ‘legally reviewed’/);
      expect(e).toMatch(sprache === 'de' ? /Beleg der juristischen Prüfung/ : /record who carried out the legal review/);
    }
  });
});
