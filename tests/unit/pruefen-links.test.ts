// Tor G7: Links, Offline-Bundle und PDF-Sprungmarken.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type ArtikelSeiten, artikelAusText, findeLinks, istBundle, ladeArtikelSeiten, pruefeBundle, pruefeRelativeLinks } from '../../scripts/pruefen/links.mts';

const FIX = join(import.meta.dirname, '..', 'fixtures', 'pruefen', 'links');
const lies = (n: string) => readFileSync(join(FIX, n), 'utf8');

describe('findeLinks', () => {
  it('findet Attribute, Markdown-Links, Bilder und nackte URLs', () => {
    const l = findeLinks(lies('anleitung.md'));
    expect(l.map((x) => [x.url, x.art])).toEqual([
      ['ziel.html', 'markdown'],
      ['nicht-da.md', 'markdown'],
      ['bild.png', 'markdown'],
      ['https://eur-lex.europa.eu/eli/reg/2024/1689/oj', 'text'],
    ]);
  });

  it('liefert Linktext und Zeile bei <a>', () => {
    const l = findeLinks(lies('seite.html')).find((x) => x.url.includes('#page=37'))!;
    expect(l.linktext).toBe('Art. 26, S. 37');
    expect(l.zeile).toBe(8);
  });
});

describe('pruefeBundle', () => {
  const b = pruefeBundle('dist/kit/aims-manager.html', lies('aims-manager.html'));
  const fehler = b.filter((x) => x.schwere === 'fehler').map((x) => x.meldung);
  const warnungen = b.filter((x) => x.schwere === 'warnung').map((x) => x.meldung);

  it('meldet externe Skripte, Stylesheets, CSS-Ressourcen und Abrufe als Fehler', () => {
    expect(fehler).toHaveLength(6);
    expect(fehler.some((m) => m.startsWith('externe Skript') && m.includes('lib.js'))).toBe(true);
    expect(fehler.some((m) => m.startsWith('externe Stylesheet'))).toBe(true);
    expect(fehler.some((m) => m.includes('extra.css'))).toBe(true);
    expect(fehler.some((m) => m.includes('a.png'))).toBe(true);
    expect(fehler.some((m) => m.includes('Abruf (fetch)'))).toBe(true);
    expect(fehler.some((m) => m.includes('Abruf (Worker)'))).toBe(true);
  });

  it('erlaubt den Link auf kmu-cio.ch und SVG-Namensräume, warnt bei fremden Links und Kommentar-URLs', () => {
    expect(b.some((x) => x.meldung.includes('kmu-cio.ch') || x.meldung.includes('w3.org'))).toBe(false);
    expect(warnungen).toHaveLength(2);
  });

  it('erkennt das Werkzeug-Bundle am Namen', () => {
    expect(istBundle('dist/kit/DE/aims-manager.html')).toBe(true);
    expect(istBundle('dist/kit/DE/START.html')).toBe(false);
  });
});

describe('pruefeRelativeLinks', () => {
  const seiten: ArtikelSeiten = {
    quelle: { de: 'EU-AI-Act_2024-1689_konsolidiert-2026-07-27_DE.pdf', en: 'EU-AI-Act_2024-1689_konsolidiert-2026-07-27_EN.pdf' },
    de: { 'art-26': 37 },
    en: { 'anhang-iii': 131 },
    seitenzahl: { de: 151, en: 151 },
  };
  const b = pruefeRelativeLinks(join(FIX, 'seite.html'), lies('seite.html'), { basis: FIX, pruefeZiele: true, seiten, repo: FIX });
  const m = b.map((x) => `${x.zeile} ${x.schwere}: ${x.meldung}`);

  it('meldet Links ins Leere, ignoriert Anker und mailto', () => {
    expect(m.filter((x) => x.includes('fehlt.html'))).toHaveLength(1);
    expect(m.some((x) => x.includes('ziel.html') || x.includes('mailto') || x.includes('#abschnitt'))).toBe(false);
  });

  it('prüft #page=N gegen Seitenzahl und Artikelangabe', () => {
    expect(m.some((x) => x.startsWith('9 fehler') && x.includes('Seite 38') && x.includes('Seite 37'))).toBe(true);
    expect(m.some((x) => x.startsWith('10 fehler') && x.includes('#page=999 ausserhalb von 1 bis 151'))).toBe(true);
    expect(m.some((x) => x.startsWith('8 ') && !x.includes('ins Leere'))).toBe(false);
  });

  it('prüft Markdown-Links', () => {
    const r = pruefeRelativeLinks(join(FIX, 'anleitung.md'), lies('anleitung.md'), { basis: FIX, pruefeZiele: true, repo: FIX });
    expect(r.map((x) => x.meldung)).toEqual(['relativer Link ins Leere: nicht-da.md', 'relativer Link ins Leere: bild.png']);
  });

  it('prüft Ziele nur auf Wunsch', () => {
    const r = pruefeRelativeLinks(join(FIX, 'anleitung.md'), lies('anleitung.md'), { basis: FIX, pruefeZiele: false, repo: FIX });
    expect(r).toEqual([]);
  });
});

describe('artikelAusText und artikel-seiten.json', () => {
  it('liest Artikel- und Anhangangaben', () => {
    expect(artikelAusText('Art. 26, S. 37')).toBe('art-26');
    expect(artikelAusText('Artikel 4a')).toBe('art-4a');
    expect(artikelAusText('Annex III')).toBe('anhang-iii');
    expect(artikelAusText('Leitfaden')).toBeUndefined();
  });

  it('lädt die echte Zuordnung mit Seitenzahlen', () => {
    const s = ladeArtikelSeiten()!;
    expect(s.de['art-26']).toBe(37);
    expect(s.seitenzahl?.en).toBe(151);
  });
});
