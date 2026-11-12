// P20-Prüfung N2 bis N4 und Hinweis H8: Verweise und Wortlaut der Freigabestellen
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = join(import.meta.dirname, '..', '..');
const lies = (rel: string): string => readFileSync(join(REPO, rel), 'utf8');

describe.each(['de', 'en'] as const)('P20 Nacharbeit (%s)', (sprache) => {
  const prozesse = lies(`src/i18n/${sprache}/prozesse.yaml`);
  const d15 = lies(`src/i18n/${sprache}/vorlagen/D-15.yaml`);

  it('N2: Verweise auf D-15 tragen keine Abschnittsnummer (D-15 und D-15-EB nummerieren verschieden)', () => {
    expect(prozesse).not.toMatch(/D-15,? (Abschnitt|section) \d/);
  });

  it('N2: PR-07 nennt den Abschnitt der Freigabekriterien mit dem Titel aus D-15', () => {
    const titel = /^ {2}neu: (.+)$/m.exec(d15)?.[1]?.trim();
    expect(titel).toBeTruthy();
    const zeile = prozesse.split('\n').find((z) => /D-15, (Abschnitt|section) /.test(z));
    expect(zeile).toBeDefined();
    expect(zeile).toContain(titel!);
  });

  it('N4: PR-11.06 nennt AIMS-Verantwortung und Eigner/in des Systems wie PR-07.05 und PR-13.05', () => {
    const z = /PR-11\.06: (.+)$/m.exec(prozesse)?.[1] ?? '';
    // N7 (test.8) und Rollenbegriff (test.9): «… bei mittlerem Risiko mit der Eignerin oder dem Eigner des Systems»
    expect(z).toMatch(sprache === 'de' ? /AIMS-Verantwortung.*Eignerin oder dem Eigner des Systems/ : /AIMS lead.*system owner/);
  });

  it('H8: D-06-EB nennt die Freigabe des Behandlungsplans aus der Faktenquelle', () => {
    const d06 = lies(`src/i18n/${sprache}/vorlagen/D-06.yaml`);
    expect(/^ {2}behandlung_text: (.+)$/m.exec(d06)?.[1]).toContain('{{fakt:freigabe.behandlungsplan}}');
  });
});

describe('P20 Nacharbeit (Wortlaut DE)', () => {
  it('N3: D-15 meint das Werkzeug, nicht eine Person', () => {
    const d15 = lies('src/i18n/de/vorlagen/D-15.yaml');
    expect(d15).not.toContain('Freigegeben wird nur, wer');
    expect(d15).toContain('Freigegeben wird ein Werkzeug nur, wenn es');
  });
});
