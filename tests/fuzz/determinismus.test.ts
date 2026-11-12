// AF-024: gleicher Seed ergibt gleiche Fallliste und gleiche Urteile, auch in getrennten Prozessen und bei verschobener Uhr
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const FAELLE = 50;
const SEED = 77123;

function lauf(versatzMs: number): Record<string, { nummer: number; name: string; hash: string; status: string; meldung: string }[]> {
  const aus = execFileSync(process.execPath, ['--import', 'tsx', 'tests/fuzz/liste.mts', String(FAELLE), String(SEED)], {
    cwd: process.cwd(),
    env: { ...process.env, FUZZ_UHR_VERSATZ_MS: String(versatzMs) },
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 240_000,
  });
  return JSON.parse(aus.toString('utf8')) as ReturnType<typeof lauf>;
}

describe('AF-024 Determinismus über Prozesse', () => {
  it('zwei getrennte Prozesse, der zweite mit um 37 Stunden verschobener Uhr: Fallliste und Urteile gleich (50 Fälle je Ziel)', () => {
    const a = lauf(0);
    const b = lauf(37 * 3600 * 1000 + 1500);
    expect(Object.keys(a)).toHaveLength(9);
    for (const art of Object.keys(a)) {
      expect(a[art], art).toHaveLength(FAELLE);
      const abweichungen = a[art]!.filter((f, i) => f.hash !== b[art]![i]!.hash || f.status !== b[art]![i]!.status || f.meldung !== b[art]![i]!.meldung).map((f) => `${art} Fall ${f.nummer} (${f.name})`);
      expect(abweichungen, `Abweichungen in ${art}`).toEqual([]);
    }
  }, 600_000);
});
