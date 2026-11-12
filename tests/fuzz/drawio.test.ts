// AF-024: draw.io-Ziel mit den festen Hänger-Dateien aus Runde 2; Browser-Ziel nur vorbereitet
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUSFUEHRUNG, erzeugteFaelle, haengerFaelle, VIEWER_URTEIL } from './browser/drawio-viewer.ts';
import { zeitlimitVon } from './kern.ts';
import { HAENGER_ORDNER, urteileDrawio } from './ziele/drawio.ts';

describe('AF-024 draw.io: Hänger-Dateien aus Runde 2 im Node-Ziel', () => {
  it('alle Dateien in drawio-haenger/ werden angenommen oder mit Meldung abgelehnt, jede in höchstens 5 s', () => {
    const faelle = haengerFaelle();
    expect(faelle.length).toBe(readdirSync(join(process.cwd(), HAENGER_ORDNER)).length);
    expect(faelle.length).toBeGreaterThanOrEqual(30);
    for (const f of faelle) {
      const t0 = performance.now();
      const u = urteileDrawio(f.daten);
      expect(['angenommen', 'abgelehnt'], f.name).toContain(u.urteil);
      if (u.urteil === 'abgelehnt') expect(u.meldung, f.name).toBeTruthy();
      expect(performance.now() - t0, f.name).toBeLessThan(zeitlimitVon('drawio'));
    }
  });
});

describe('AF-024 Browser-Ziel draw.io-Viewer: vorbereitet, Lauf in P18', () => {
  it('ist als Lauf im Browser in P18 gekennzeichnet und startet keinen Browser', () => {
    expect(AUSFUEHRUNG).toBe('Lauf im Browser in P18');
    expect(VIEWER_URTEIL.nichts).toBe('haenger');
    expect(VIEWER_URTEIL.maxSekundenBisMeldung).toBe(20);
  });

  it('liefert deterministische Fälle für P18', () => {
    const a = erzeugteFaelle(77123, 30);
    const b = erzeugteFaelle(77123, 30);
    expect(b).toEqual(a);
    expect(a.length).toBeGreaterThan(10);
    expect(a.every((f) => f.herkunft.includes('Seed 77123'))).toBe(true);
  });
});
