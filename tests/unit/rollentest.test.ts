// Befunde aus einem Rollentest, Logik und Dokumente.
import { describe, expect, it } from 'vitest';
import { dokumentSet, erzeugeIr } from '../../src/app/worker/set.ts';
import type { XlsxMappe } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { ueberAkzeptanz } from '../../src/grafik/daten.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const kataloge = ladeKataloge();
const texte = { de: ladeTexte('de'), en: ladeTexte('en') };

describe('RT-03 Risikoregister im Pfad mit ISMS', () => {
  it('Set enthält D-07-EB (Blatt) und D-07 (Register mit den Risiken)', () => {
    const p = vollstaendigesProjekt();
    p.meta.mitIsms = true;
    const { dateien } = dokumentSet(p, kataloge, 'de');
    const d07 = dateien.filter((d) => d.katalogId === 'D-07');
    expect(d07.map((d) => [d.id, d.format])).toEqual(expect.arrayContaining([['D-07', 'xlsx'], ['D-07-EB', 'docx']]));
    const reg = erzeugeIr(d07.find((d) => d.id === 'D-07')!, p, texte.de, kataloge, 'de', '1.0.0') as XlsxMappe;
    expect(JSON.stringify(reg.blaetter)).toContain(p.risiken[0]!.id);
  });
  it('Einzelauswahl: D-07 liefert nur das Register, D-07-EB nur das Blatt', () => {
    const p = vollstaendigesProjekt();
    p.meta.mitIsms = true;
    expect(dokumentSet(p, kataloge, 'de', ['D-07']).dateien.map((d) => d.id)).toEqual(['D-07']);
    expect(dokumentSet(p, kataloge, 'de', ['D-07-EB']).dateien.map((d) => d.id)).toEqual(['D-07-EB']);
  });
  it('Ohne ISMS unverändert: nur D-07', () => {
    const p = vollstaendigesProjekt();
    p.meta.mitIsms = false;
    expect(dokumentSet(p, kataloge, 'de').dateien.filter((d) => d.katalogId === 'D-07').map((d) => d.id)).toEqual(['D-07']);
  });
});

describe('RT-05 Risiken über der Akzeptanzgrenze', () => {
  it('unbehandeltes Risiko zählt mit dem Wert vor Behandlung', () => {
    const p = vollstaendigesProjekt();
    const k = p.organisation.risikokriterien;
    const hoch = Math.ceil(Math.sqrt(k.unannehmbarAb));
    p.risiken = [{ ...p.risiken[0]!, id: 'R-001', art: 'risiko', status: 'offen', w: hoch, a: hoch, wNach: null, aNach: null } as never];
    expect(ueberAkzeptanz(p)).toEqual({ anzahl: 1, ohneBehandlung: 1, vor: 1 });
    p.risiken[0]!.wNach = 1;
    p.risiken[0]!.aNach = 1;
    expect(ueberAkzeptanz(p)).toEqual({ anzahl: 0, ohneBehandlung: 0, vor: 1 });
  });
});
