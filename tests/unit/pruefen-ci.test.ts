// CI-Schranken ohne neue Abhängigkeit (P3): Testmarker G30 (AF-061), Audit G34 (AF-038), Workflows G32 (AF-040, AF-039),
// Abdeckungs-Ratsche G35 (AF-047). Je Tor: die echte Lage ist grün, die Gegenprobe bricht.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type Ausnahme, bewerte as bewerteAudit } from '../../scripts/pruefen/audit.mts';
import { pruefe as pruefeMarker, pruefeText } from '../../scripts/pruefen/testmarker.mts';
import { type Basis, angehoben, bewerte as bewerteRatsche, quelldateien } from '../../scripts/pruefen/ratsche.mts';
import { pruefe as pruefeWorkflows, pruefeDependabot, pruefeWorkflow } from '../../scripts/pruefen/workflow.mts';
import { REPO } from '../../scripts/pruefen/gemeinsam.mts';

// Marker aus Teilen gebaut, damit dieser Test selbst das Tor nicht auslöst
const ONLY = `it.${'only'}('x', () => {});`;
const SKIP = `it.${'skip'}('x', () => {});`;

describe('G30 Testmarker', () => {
  it('der Bestand ist ohne Fehler', async () => {
    const fehler = (await pruefeMarker({}, '2026-11-07')).filter((b) => b.schwere === 'fehler');
    expect(fehler.map((b) => `${b.datei}:${b.zeile} ${b.meldung}`)).toEqual([]);
  });
  it('.only bricht immer, auch mit Vermerk', () => {
    expect(pruefeText('a.test.ts', ONLY, '2026-11-07').befunde).toHaveLength(1);
    expect(pruefeText('a.test.ts', `// skip-bis: 2030-01-01 Grund\n${ONLY}`, '2026-11-07').befunde).toHaveLength(1);
    expect(pruefeText('a.test.ts', `describe.${'only'}.each([1])('x', () => {});`, '2026-11-07').befunde).toHaveLength(1);
  });
  it('.skip ohne Vermerk oder mit abgelaufenem Datum bricht, mit gültigem Vermerk nicht', () => {
    expect(pruefeText('a.test.ts', SKIP, '2026-11-07').befunde[0]?.meldung).toContain('ohne Vermerk');
    expect(pruefeText('a.test.ts', `// skip-bis: 2026-11-06 Quelle fehlt\n${SKIP}`, '2026-11-07').befunde[0]?.meldung).toContain('abgelaufen');
    expect(pruefeText('a.test.ts', `// skip-bis: 2026-11-07 Quelle fehlt\n${SKIP}`, '2026-11-07').befunde).toEqual([]);
    expect(pruefeText('a.test.ts', `${'x'}it('x', () => {});`, '2026-11-07').befunde).toHaveLength(1);
  });
  it('Kettenformen und mehrzeiliges .only brechen', () => {
    for (const kette of ['test.concurrent', 'it.concurrent', 'describe.concurrent', 'test.describe.serial', 'describe.sequential']) {
      expect(pruefeText('a.test.ts', `${kette}.${'only'}('x', () => {});`, '2026-11-07').befunde, kette).toHaveLength(1);
    }
    expect(pruefeText('a.test.ts', `it\n  .${'only'}('x', () => {});`, '2026-11-07').befunde).toHaveLength(1);
    expect(pruefeText('a.test.ts', `it.${'skip'}.concurrent('x', () => {});`, '2026-11-07').befunde[0]?.meldung).toContain('ohne Vermerk');
    expect(pruefeText('a.test.ts', `test.describe.serial.${'skip'}('x', () => {});`, '2026-11-07').befunde).toHaveLength(1);
  });
  it('je Marker der nächste Vermerk, ein Vermerk gilt nur für einen Marker', () => {
    // zwei Vermerke: erster abgelaufen, zweiter gültig; das .skip darunter nimmt den nächsten (gültigen)
    const zwei = `// skip-bis: 2026-01-01 alt\n// skip-bis: 2027-01-01 neu\n${SKIP}`;
    expect(pruefeText('a.test.ts', zwei, '2026-11-07').befunde).toEqual([]);
    // ein Vermerk deckt nur ein .skip
    const eins = `// skip-bis: 2027-01-01 Grund\n${SKIP}\n${SKIP}`;
    const b = pruefeText('a.test.ts', eins, '2026-11-07').befunde;
    expect(b).toHaveLength(1);
    expect(b[0]?.zeile).toBe(3);
  });
  it('bedingte Auslassungen werden gezählt, nicht gesperrt', () => {
    const r = pruefeText('a.test.ts', `it.skipIf(!vorhanden)('x', () => {});\ntest.skip(browserName !== 'chromium', 'Grund');`, '2026-11-07');
    expect(r).toEqual({ befunde: [], bedingt: 2 });
  });
  it('Kommentarzeilen zählen nicht', () => {
    expect(pruefeText('a.test.ts', `// ${ONLY}\n * ${SKIP}`, '2026-11-07').befunde).toEqual([]);
  });
});

describe('G34 Audit mit Ausnahmen', () => {
  const bericht = (schwere: string) => ({
    vulnerabilities: {
      paket: { name: 'paket', via: [{ source: 1, name: 'paket', title: 'Testbefund', url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc', severity: schwere }] },
      eltern: { name: 'eltern', via: ['paket'] },
    },
  });
  const ausnahme = (ablauf: string): Ausnahme => ({ advisory: 'GHSA-aaaa-bbbb-cccc', paket: 'paket', grund: 'begründet', erfasst: '2026-11-01', ablauf });
  const fehler = <T extends { schwere: string }>(b: T[]) => b.filter((x) => x.schwere === 'fehler');

  it('hoch und kritisch ohne Ausnahme brechen, mittel nicht', () => {
    expect(fehler(bewerteAudit(bericht('high'), [], '2026-11-07'))).toHaveLength(1);
    expect(fehler(bewerteAudit(bericht('critical'), [], '2026-11-07'))).toHaveLength(1);
    const mittel = bewerteAudit(bericht('moderate'), [], '2026-11-07');
    expect(fehler(mittel)).toHaveLength(0);
    expect(mittel).toHaveLength(1);
  });
  it('gültige Ausnahme nimmt aus; abgelaufene Ausnahme bricht (Gegenprobe)', () => {
    expect(bewerteAudit(bericht('high'), [ausnahme('2027-01-31')], '2026-11-07')).toEqual([]);
    expect(bewerteAudit(bericht('high'), [ausnahme('2027-01-31')], '2027-01-31')).toEqual([]);
    const abgelaufen = bewerteAudit(bericht('high'), [ausnahme('2026-11-06')], '2026-11-07');
    expect(fehler(abgelaufen).map((b) => b.meldung).join('\n')).toMatch(/abgelaufen/);
    expect(fehler(abgelaufen)).toHaveLength(2); // abgelaufene Ausnahme und ungedeckter Befund
  });
  it('Frist über 180 Tage ab Erfassung bricht, genau 180 Tage nicht', () => {
    const mit = (ablauf: string) => ({ ...ausnahme(ablauf), erfasst: '2026-11-07' });
    expect(fehler(bewerteAudit(bericht('low'), [mit('2027-05-06')], '2026-11-07'))).toEqual([]); // 180 Tage
    const zuLang = fehler(bewerteAudit(bericht('low'), [mit('2027-05-07')], '2026-11-07'));
    expect(zuLang).toHaveLength(1);
    expect(zuLang[0]?.meldung).toContain('180 Tage');
    expect(fehler(bewerteAudit(bericht('low'), [mit('2099-01-01')], '2026-11-07'))).toHaveLength(1);
  });
  it('Ausnahme ohne Frist oder Grund bricht; ungenutzte Ausnahme warnt', () => {
    expect(fehler(bewerteAudit(bericht('low'), [{ ...ausnahme(''), ablauf: '' }], '2026-11-07'))).toHaveLength(1);
    expect(fehler(bewerteAudit(bericht('low'), [{ ...ausnahme('2027-01-31'), grund: ' ' }], '2026-11-07'))).toHaveLength(1);
    expect(fehler(bewerteAudit(bericht('low'), [{ ...ausnahme('31.01.2027') }], '2026-11-07'))).toHaveLength(1);
    const ungenutzt = bewerteAudit({ vulnerabilities: {} }, [ausnahme('2027-01-31')], '2026-11-07');
    expect(ungenutzt.map((b) => b.schwere)).toEqual(['warnung']);
  });
  it('audit-ausnahmen.json im Repo: jede Ausnahme vollständig und mit Frist', () => {
    const liste = (JSON.parse(readFileSync(join(REPO, 'audit-ausnahmen.json'), 'utf8')) as { ausnahmen: Ausnahme[] }).ausnahmen;
    // bewertet gegen einen Bericht mit demselben Befund: keine Fehler, solange die Frist nicht abgelaufen ist
    for (const a of liste) {
      const b = { vulnerabilities: { [a.paket]: { name: a.paket, via: [{ name: a.paket, url: `https://github.com/advisories/${a.advisory}`, severity: 'high', title: 't' }] } } };
      expect(fehler(bewerteAudit(b, [a], '2026-11-07')), a.advisory).toEqual([]);
    }
  });
});

describe('G32 Workflows und Dependabot', () => {
  const SHA = 'a'.repeat(40);
  const gut = (extra = '') => `name: T
on: push
concurrency: { group: g, cancel-in-progress: "\${{ github.ref != 'refs/heads/main' }}" }
jobs:
  j:
    runs-on: ubuntu-24.04
    permissions: { contents: read }
    steps:
      - uses: actions/checkout@${SHA} # v7.0.1${extra}
        timeout-minutes: 5
      - run: echo hi
        timeout-minutes: 1
`;
  it('die Workflows im Repo bestehen', async () => {
    expect((await pruefeWorkflows()).map((b) => `${b.datei}: ${b.meldung}`)).toEqual([]);
  });
  it('ein gültiger Workflow besteht', () => {
    expect(pruefeWorkflow('t.yml', gut())).toEqual([]);
  });
  it('uses ohne SHA, ohne Versionskommentar, ohne permissions, ohne concurrency, ohne timeout-minutes brechen', () => {
    expect(pruefeWorkflow('t.yml', gut().replace(SHA, 'v7'))[0]?.meldung).toContain('SHA');
    expect(pruefeWorkflow('t.yml', gut().replace(' # v7.0.1', ''))[0]?.meldung).toContain('Versionskommentar');
    expect(pruefeWorkflow('t.yml', gut().replace('    permissions: { contents: read }\n', ''))[0]?.meldung).toContain('permissions');
    expect(pruefeWorkflow('t.yml', gut().replace(/concurrency: .*\n/, ''))[0]?.meldung).toContain('concurrency');
    expect(pruefeWorkflow('t.yml', gut().replace('        timeout-minutes: 1\n', ''))[0]?.meldung).toContain('timeout-minutes');
  });
  it('Versionskommentar ohne genaue Version und Abbruch auch auf main brechen', () => {
    expect(pruefeWorkflow('t.yml', gut().replace('# v7.0.1', '# v7'))[0]?.meldung).toContain('genauer Version');
    expect(pruefeWorkflow('t.yml', gut().replace(/cancel-in-progress: ".*?" \}/, 'cancel-in-progress: true }'))[0]?.meldung).toContain('Nicht-main-Zweige');
    expect(pruefeWorkflow('t.yml', gut().replace(/cancel-in-progress: ".*?" \}/, 'cancel-in-progress: false }'))[0]?.meldung).toContain('Nicht-main-Zweige');
  });
  it('kaputtes YAML und fehlende Pflichtteile brechen', () => {
    expect(pruefeWorkflow('t.yml', 'a: [')).toHaveLength(1);
    expect(pruefeWorkflow('t.yml', 'name: x\non: push\n')[0]?.meldung).toContain('jobs');
    expect(pruefeWorkflow('t.yml', gut().replace('runs-on: ubuntu-24.04', 'x: 1'))[0]?.meldung).toContain('runs-on');
  });
  it('Dependabot: npm und github-actions wöchentlich', () => {
    const dep = (npm: string, actions: string) => `version: 2\nupdates:\n  - package-ecosystem: npm\n    directory: /\n    schedule: { interval: ${npm} }\n  - package-ecosystem: github-actions\n    directory: /\n    schedule: { interval: ${actions} }\n`;
    expect(pruefeDependabot(dep('weekly', 'weekly'))).toEqual([]);
    expect(pruefeDependabot(dep('monthly', 'weekly'))).toHaveLength(1);
    expect(pruefeDependabot('version: 2\nupdates:\n  - package-ecosystem: npm\n    schedule: { interval: weekly }\n')).toHaveLength(1);
    expect(pruefeDependabot(readFileSync(join(REPO, '.github', 'dependabot.yml'), 'utf8'))).toEqual([]);
  });
});

describe('G35 Abdeckungs-Ratsche', () => {
  const basis: Basis = { stand: '2026-11-07', gesamt: { lines: 60, statements: 60, functions: 50, branches: 50 } };
  const summary = (lines: number, dateien: string[]) => ({
    total: { lines: { pct: lines }, statements: { pct: 60 }, functions: { pct: 50 }, branches: { pct: 50 } },
    ...Object.fromEntries(dateien.map((d) => [join(REPO, d), {}])),
  });
  it('gleiche oder höhere Abdeckung besteht, Absenkung bricht (Gegenprobe)', () => {
    expect(bewerteRatsche(summary(60, ['src/a.ts']), basis, ['src/a.ts'])).toEqual([]);
    expect(bewerteRatsche(summary(75.5, ['src/a.ts']), basis, ['src/a.ts'])).toEqual([]);
    const b = bewerteRatsche(summary(59.9, ['src/a.ts']), basis, ['src/a.ts']);
    expect(b).toHaveLength(1);
    expect(b[0]?.meldung).toContain('lines gesunken');
  });
  it('Quelldatei ohne Abdeckungswert bricht', () => {
    const b = bewerteRatsche(summary(60, ['src/a.ts']), basis, ['src/a.ts', 'src/b.ts']);
    expect(b[0]?.meldung).toContain('1 Quelldateien ohne Abdeckungswert');
  });
  it('die Basis steigt nur', () => {
    const neu = angehoben(summary(75.559, []), basis, '2026-12-01');
    expect(neu.gesamt.lines).toBe(75.55);
    expect(neu.gesamt.functions).toBe(50);
    expect(angehoben(summary(10, []), basis, '2026-12-01').gesamt.lines).toBe(60);
  });
  it('die Basisdatei im Repo ist gültig und alle Quelldateien liegen unter src ohne generiert', () => {
    const b = JSON.parse(readFileSync(join(REPO, 'tests', 'abdeckung-basis.json'), 'utf8')) as Basis;
    for (const wert of Object.values(b.gesamt)) expect(wert).toBeGreaterThan(0);
    const q = quelldateien();
    expect(q.length).toBeGreaterThan(200);
    expect(q.some((p) => p.startsWith('src/generiert/') || p.endsWith('.d.ts') || p.startsWith('tests/'))).toBe(false);
  });
});
