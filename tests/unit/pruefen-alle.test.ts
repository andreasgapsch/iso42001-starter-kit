// Sammelaufruf: alle Tore sind registriert, lokale Tore nur mit --lokal.
import { describe, expect, it, vi } from 'vitest';
import { TORE, alle } from '../../scripts/pruefen/alle.mts';
import { formatiere, passtMuster, zaehle } from '../../scripts/pruefen/gemeinsam.mts';

describe('alle', () => {
  it('kennt die Tore G4 bis G8, G14, G15, G18, G30 bis G33, G36 bis G45', () => {
    expect(TORE.map((t) => t.id)).toEqual(['G4', 'G5', 'G6', 'G7', 'G8', 'G14', 'G15', 'G18', 'G30', 'G31', 'G32', 'G33', 'G36', 'G37', 'G38', 'G39', 'G40', 'G41', 'G42', 'G43', 'G44', 'G45']);
    expect(TORE.filter((t) => t.nurLokal).map((t) => t.id)).toEqual(['G6', 'G18']);
  });

  it('überspringt G6 ohne --lokal und meldet das in der Übersicht', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const r = await alle({ lokal: false });
      expect(r.befunde.some((b) => b.tor === 'G6')).toBe(false);
      expect(log.mock.calls.some((c) => String(c[0]).includes('G6') && String(c[0]).includes('übersprungen'))).toBe(true);
    } finally {
      log.mockRestore();
    }
  });
});

describe('gemeinsam', () => {
  it('zählt und formatiert Befunde', () => {
    const b = [
      { tor: 'G5', datei: 'a.yaml', zeile: 3, meldung: 'x', schwere: 'fehler' as const },
      { tor: 'G7', datei: 'b.html', meldung: 'y', schwere: 'warnung' as const },
    ];
    expect(zaehle(b)).toEqual({ fehler: 1, warnungen: 1 });
    expect(formatiere(b[0]!)).toContain('a.yaml:3');
  });

  it('wertet Ausnahmemuster aus', () => {
    expect(passtMuster('src/ai-act/auszuege/de/a.md', 'src/ai-act/auszuege/**')).toBe(true);
    expect(passtMuster('src/lizenz/CC-BY-4.0.txt', 'src/lizenz/CC-BY-4.0*')).toBe(true);
    expect(passtMuster('src/lizenz/LIZENZ.txt', 'src/lizenz/CC-BY-4.0*')).toBe(false);
    expect(passtMuster('src/start/a/b.html', 'src/start')).toBe(true);
  });
});
