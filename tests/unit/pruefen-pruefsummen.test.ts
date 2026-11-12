// Tor G14: Prüfsummen der Rechtstexte-PDFs gegen eine SHA256SUMS-Liste.
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { leseSummen, pruefeSummen } from '../../scripts/pruefen/pruefsummen.mts';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

describe('leseSummen', () => {
  it('liest das Format von sha256sum mit und ohne Stern', () => {
    const m = leseSummen(`${sha('a')} *A.pdf\n${sha('b')}  unter/B.pdf\nMüll\n`);
    expect([...m.keys()]).toEqual(['A.pdf', 'B.pdf']);
    expect(m.get('A.pdf')).toBe(sha('a'));
  });
});

describe('pruefeSummen', () => {
  const basis = mkdtempSync(join(tmpdir(), 'summen-'));
  const kit = join(basis, 'kit');
  mkdirSync(join(kit, 'Rechtstexte'), { recursive: true });
  writeFileSync(join(kit, 'Rechtstexte', 'EU-AI-Act_DE.pdf'), 'pdf-de');
  writeFileSync(join(kit, 'Rechtstexte', 'EU-AI-Act_EN.pdf'), 'pdf-en-veraendert');
  writeFileSync(join(kit, 'Rechtstexte', 'EU-AI-Act_FR.pdf'), 'pdf-fr');
  writeFileSync(join(kit, 'Leitfaden.pdf'), 'eigenes PDF, kein Rechtstext');
  const summen = join(basis, 'SHA256SUMS.txt');
  writeFileSync(summen, `${sha('pdf-de')} *EU-AI-Act_DE.pdf\n${sha('pdf-en')} *EU-AI-Act_EN.pdf\n`);

  it('meldet Abweichungen und unbekannte Rechtstexte, nicht aber eigene PDFs', () => {
    const b = pruefeSummen(kit, summen, basis);
    expect(b.map((x) => `${x.datei}: ${x.meldung.split(' (')[0]}`)).toEqual([
      'kit/Rechtstexte/EU-AI-Act_EN.pdf: SHA-256 weicht ab',
      'kit/Rechtstexte/EU-AI-Act_FR.pdf: EU-AI-Act_FR.pdf steht nicht in der Prüfsummenliste',
    ]);
    expect(b.every((x) => x.tor === 'G14' && x.schwere === 'fehler')).toBe(true);
  });

  it('warnt ohne Prüfsummenliste und ohne Rechtstexte', () => {
    expect(pruefeSummen(kit, join(basis, 'fehlt.txt'), basis)[0]!.schwere).toBe('warnung');
    const leer = join(basis, 'leer');
    mkdirSync(leer);
    expect(pruefeSummen(leer, summen, basis).map((x) => x.schwere)).toEqual(['warnung']);
  });

  it('führt mehrere Listen zusammen (AI Act und NIST)', () => {
    const nistKit = join(basis, 'kit2');
    mkdirSync(join(nistKit, 'NIST-AI-RMF'), { recursive: true });
    mkdirSync(join(nistKit, 'EU-AI-Act'), { recursive: true });
    writeFileSync(join(nistKit, 'EU-AI-Act', 'EU-AI-Act_DE.pdf'), 'pdf-de');
    writeFileSync(join(nistKit, 'NIST-AI-RMF', 'NIST.AI.100-1.pdf'), 'nist');
    writeFileSync(join(nistKit, 'NIST-AI-RMF', 'NIST_Playbook.pdf'), 'playbook-veraendert');
    const nist = join(basis, 'SHA256SUMS-nist.txt');
    writeFileSync(nist, `${sha('nist')}  NIST.AI.100-1.pdf\n${sha('playbook')}  NIST_Playbook.pdf\n`);
    const nurAiAct = pruefeSummen(nistKit, summen, basis).map((x) => x.meldung.split(' (')[0]);
    expect(nurAiAct).toEqual(['NIST.AI.100-1.pdf steht nicht in der Prüfsummenliste', 'NIST_Playbook.pdf steht nicht in der Prüfsummenliste']);
    const beide = pruefeSummen(nistKit, [summen, nist], basis);
    expect(beide.map((x) => `${x.datei}: ${x.meldung.split(' (')[0]}`)).toEqual(['kit2/NIST-AI-RMF/NIST_Playbook.pdf: SHA-256 weicht ab']);
    expect(pruefeSummen(nistKit, [summen, join(basis, 'fehlt.txt')], basis).some((x) => x.schwere === 'warnung')).toBe(true);
  });
});
