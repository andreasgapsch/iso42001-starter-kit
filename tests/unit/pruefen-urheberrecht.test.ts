// Tor G6: 8-Wort-Folgen gegen erfundene Testquellen (kein echter Norm- oder Vergleichstext).
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { baueAusnahmen, folgen, istAiActDatei, istKopfzeile, ladeQuellmenge, normalisiere, ohneAiActZitate, pruefe, pruefeText } from '../../scripts/pruefen/urheberrecht.mts';

const TEXT = join(import.meta.dirname, '..', 'fixtures', 'pruefen', 'urheberrecht', 'text');

describe('Normalisierung', () => {
  it('senkt, entfernt Satzzeichen und hebt Trennungen auf', () => {
    expect(normalisiere('Die Prü-\nfung, «eigens» (A.5)!')).toEqual(['die', 'prüfung', 'eigens', 'a', '5']);
  });

  it('erkennt Kopf-, Seiten- und Copyright-Zeilen', () => {
    expect(istKopfzeile('Seite 3 von 40')).toBe(true);
    expect(istKopfzeile('© ISO 2099 Alle Rechte vorbehalten')).toBe(true);
    expect(istKopfzeile('ISO/IEC 99999:2099(de)')).toBe(true);
    expect(istKopfzeile('17')).toBe(true);
    expect(istKopfzeile('Ein gewöhnlicher Satz.')).toBe(false);
  });

  it('bildet n-1 weniger Folgen als Wörter', () => {
    expect(folgen('a b c d e f g h i j'.split(' '))).toHaveLength(3);
  });

  it('schliesst AI-Act-Dateien als Quelle aus', () => {
    expect(istAiActDatei('EU-AI-Act_2024-1689_konsolidiert-2026-07-27_DE.txt')).toBe(true);
    expect(istAiActDatei('Aenderungsverordnung_2026-1744_EN.txt')).toBe(true);
    expect(istAiActDatei('SN_EN_ISO-IEC_42001-2026.txt')).toBe(false);
  });
});

describe('Abgleich', () => {
  const cache = mkdtempSync(join(tmpdir(), 'urh-'));
  const quellen = ladeQuellmenge(TEXT, cache);

  it('liest nur Nicht-AI-Act-Quellen und speichert nur Hashwerte im Cache', () => {
    expect(quellen.namen).toEqual(['Erfundene_Norm_ISO.txt']);
    const dateien = readdirSync(cache);
    expect(dateien).toHaveLength(1);
    const inhalt = readFileSync(join(cache, dateien[0]!), 'utf8');
    expect(inhalt).not.toMatch(/testorganisation|verzeichnis/i);
    // zweiter Aufruf kommt aus dem Cache
    expect(ladeQuellmenge(TEXT, cache).menge.size).toBe(quellen.menge.size);
  });

  it('meldet übernommene Folgen über Zeilen und Trennungen hinweg', () => {
    const kit = 'titel: Eigene Einleitung\ntext: Jede Vorgabe in diesem Testdokument wurde ausschliesslich für automatische Prüfungen geschrieben.';
    const b = pruefeText('src/i18n/de/x.yaml', kit, quellen);
    expect(b).toHaveLength(1);
    expect(b[0]!.zeile).toBe(2);
    expect(b[0]!.meldung).toMatch(/^11 Wörter in Folge .*Erfundene_Norm_ISO\.txt/);
    expect(b[0]!.meldung).not.toMatch(/Testdokument/);
  });

  it('ignoriert Kopfzeilen der Quelle beim Bilden der Folgen', () => {
    // über die Seitenzahl und Lizenzzeile hinweg ist der Text der Quelle zusammenhängend
    const kit = 'jährlich gegenüber dem Gremium berichten Jede Vorgabe in diesem';
    expect(pruefeText('x.md', kit, quellen)).toHaveLength(1);
  });

  it('meldet eigene Formulierungen und AI-Act-Texte nicht', () => {
    expect(pruefeText('x.md', 'Wir führen eine eigene Liste aller Prüfobjekte und berichten dem Gremium einmal im Jahr.', quellen)).toEqual([]);
    expect(pruefeText('x.md', 'Dieser amtliche Testtext wird bewusst niemals als Quelle für die Urheberrechtsprüfung verwendet werden.', quellen)).toEqual([]);
  });

  it('nimmt gekennzeichnete AI-Act-Blockzitate aus', () => {
    const md = 'Einleitung\n\n> Art. 99 Testzitat:\n> Jede Vorgabe in diesem Testdokument wurde ausschliesslich für automatische Prüfungen geschrieben.\n\nSchluss';
    expect(ohneAiActZitate(md).split('\n')).toHaveLength(6);
    expect(pruefeText('x.md', md, quellen)).toEqual([]);
    const ohneVermerk = md.replace('Art. 99 ', '');
    expect(pruefeText('x.md', ohneVermerk, quellen)).toHaveLength(1);
  });

  it('beachtet die Ausnahmeliste', () => {
    const kit = 'Die erfundene Testorganisation muss ein sorgfältig gepflegtes Verzeichnis führen.';
    expect(pruefeText('x.md', kit, quellen)).toHaveLength(1);
    expect(pruefeText('x.md', kit, quellen, baueAusnahmen(['erfundene Testorganisation']))).toEqual([]);
    expect(pruefeText('x.md', kit, quellen, baueAusnahmen(['Die erfundene Testorganisation muss ein sorgfältig gepflegtes Verzeichnis']))).toEqual([]);
  });
});

describe('pruefe', () => {
  it('läuft ohne --lokal nicht und warnt ohne Quellordner', async () => {
    expect(await pruefe({ lokal: false })).toEqual([]);
    const vorher = process.env.QUELLEN_DIR;
    process.env.QUELLEN_DIR = join(tmpdir(), 'gibt-es-nicht-' + Date.now());
    try {
      const b = await pruefe({ lokal: true });
      expect(b).toHaveLength(1);
      expect(b[0]!.schwere).toBe('warnung');
    } finally {
      if (vorher === undefined) delete process.env.QUELLEN_DIR;
      else process.env.QUELLEN_DIR = vorher;
    }
    expect(existsSync(TEXT)).toBe(true);
  });
});
