// Originaltexte NIST (src/nist-rmf/original-100-1.yaml, original-600-1.yaml): Vollständigkeit gegen die Kataloge des
// Moduls, Seiten wie seiten.json, Vermerk, Übersetzung im Stil des Kits; Prüfskript Tor G18 (Normalisierung, Vergleich,
// lokal gegen die PDFs); Ausnahme der Zitatzeilen in Tor G5; Anzeige in N-01, N-02 und N-04 mit Blatt «Quelle».
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pdfDatei, pruefe, pruefeAlle, prueflinge, vergleiche, zeichenfolge, ZEILENENDE } from '../../scripts/pruefen/nist-zitate.mts';
import { istZitatZeile, pruefeText } from '../../scripts/pruefen/stil.mts';
import { baueAusnahmen, N, nistZitatAusnahmen, normalisiere } from '../../scripts/pruefen/urheberrecht.mts';
import type { XlsxMappe } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { NistSeiten } from '../../src/kataloge/typen.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import type { Sprache } from '../../src/model/typen.ts';
import { massnahmen600, NIST_VERMERK, nistZitat } from '../../src/nist-rmf/original.ts';
import { VORLAGEN } from '../../src/vorlagen/index.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const REPO = join(import.meta.dirname, '..', '..');
const k = ladeKataloge();
const o100 = k.nistrmf_original1001!;
const o600 = k.nistrmf_original6001!;
const kern = k.nistrmf_subkategorien!;
const seiten = JSON.parse(readFileSync(join(REPO, 'src/nist-rmf/seiten.json'), 'utf8')) as NistSeiten;

describe('Originaltexte NIST: Vollständigkeit', () => {
  it('4 Funktionen, 19 Kategorien, 72 Subkategorien in der Reihenfolge des Kerns', () => {
    expect(o100.funktionen.map((f) => f.id)).toEqual(kern.funktionen.map((f) => f.id));
    expect(o100.funktionen.map((f) => f.name)).toEqual(kern.funktionen.map((f) => f.nist_id));
    expect(o100.kategorien.map((x) => x.id)).toEqual(kern.kategorien.map((x) => x.id));
    expect(o100.subkategorien.map((x) => x.id)).toEqual(kern.subkategorien.map((x) => x.id));
    expect([o100.funktionen.length, o100.kategorien.length, o100.subkategorien.length]).toEqual([4, 19, 72]);
  });

  it('Seiten der Kategorien und Subkategorien wie seiten.json (AI 100-1)', () => {
    for (const x of [...o100.kategorien, ...o100.subkategorien]) expect(x.seite, x.id).toBe(seiten['ai-100-1'][x.id]);
  });

  it('7 Vertrauensmerkmale mit Abschnitt wie merkmale.yaml', () => {
    const m = k.nistrmf_merkmale!.merkmale;
    expect(o100.merkmale.map((x) => [x.id, x.abschnitt])).toEqual(m.map((x) => [x.id, x.abschnitt_100_1]));
  });

  it('12 Risiken mit Nummer und Abschnitt wie genai-risiken.yaml', () => {
    const r = k.nistrmf_genaiRisiken!.risiken;
    expect(o600.risiken.map((x) => [x.id, x.nr, x.abschnitt])).toEqual(r.map((x) => [x.id, x.nr, x.abschnitt_600_1]));
    for (const x of o600.risiken) expect(x.titel_zitat && x.titel_de && x.abschnitt_titel_zitat, x.id).toBeTruthy();
  });

  it('Massnahmen aus 600-1 genau für die IDs, die die Zusatz-Controls nennen (bezug_600_1)', () => {
    const genutzt = [...new Set(k.nistrmf_rmfControls!.controls.flatMap((c) => c.bezug_600_1))].sort();
    expect(o600.massnahmen.map((m) => m.id).sort()).toEqual(genutzt);
    for (const m of o600.massnahmen) {
      expect(m.id.startsWith(`${m.subkategorie}-`), m.id).toBe(true);
      expect(kern.subkategorien.some((s) => s.id === m.subkategorie), m.id).toBe(true);
    }
    expect(massnahmen600(k, ['GV-1.7-001', 'XX-0.0-000']).map((m) => m.id)).toEqual(['GV-1.7-001']);
  });

  it('Quelle mit Vermerk, DOI und Datei wie stand.yaml', () => {
    for (const [o, id] of [[o100, 'ai-100-1'], [o600, 'ai-600-1']] as const) {
      expect(o.quelle.vermerk).toBe(NIST_VERMERK);
      const f = k.nistrmf_stand!.fassungen.find((x) => x.id === id)!;
      expect(o.quelle.datei).toBe(f.datei);
      expect(o.quelle.doi).toBe(f.url);
      expect(o.quelle.uebersetzung.de).toBe('Übersetzung KMU-CIO, nicht amtlich');
    }
  });

  it('Zitate und Übersetzungen vorhanden; Übersetzung ohne Eszett und ohne Gedankenstriche', () => {
    const alle = [...o100.funktionen, ...o100.kategorien, ...o100.subkategorien, ...o100.merkmale, ...o600.risiken, ...o600.massnahmen];
    expect(alle).toHaveLength(4 + 19 + 72 + 7 + 12 + 58);
    for (const x of alle) {
      expect(x.zitat.trim(), x.id).not.toBe('');
      expect(x.de.trim(), x.id).not.toBe('');
      expect(x.de, x.id).not.toBe(x.zitat);
      expect(x.de, x.id).not.toMatch(/[\u00DF\u2013\u2014]/);
      expect(x.zitat, x.id).not.toMatch(/\s{2,}|\u00AD|[\uFB00-\uFB06]/);
    }
  });

  it('nistZitat liefert Titel, Übersetzung und Quelle', () => {
    const r = nistZitat(k, 'risiko', 'gai-konfabulation')!;
    expect(r).toMatchObject({ dok: 'ai-600-1', seite: 8, titel: 'Confabulation', titelDe: 'Konfabulation' });
    expect(nistZitat(k, 'funktion', 'govern')).toMatchObject({ titel: 'GOVERN', seite: 27 });
    expect(nistZitat(k, 'kategorie', 'GV-4')).toMatchObject({ seite: 28, bisSeite: 29 });
    expect(nistZitat(k, 'subkategorie', 'GV-1.1')!.zitat).toBe('Legal and regulatory requirements involving AI are understood, managed, and documented.');
    expect(nistZitat(k, 'subkategorie', 'XX-1')).toBeUndefined();
  });
});

describe('Tor G18 NIST-Zitate', () => {
  it('normalisiert Silbentrennung, Bindestriche, Ligaturen und Anführungszeichen', () => {
    expect(zeichenfolge('inte-\ngrated decom-\n\nmissioning')).toEqual(['integrated', 'decommissioning']);
    expect(zeichenfolge('context-specific')).toEqual(zeichenfolge('context-\nspecific'));
    expect(zeichenfolge('\uFB01ne-tuning')).toEqual(['finetuning']);
    expect(zeichenfolge('organization\u2019s \u201Cgo\u201D')).toEqual(['organization', "'", 's', '"', 'go', '"']);
    expect(zeichenfolge('a\nb', true)).toEqual(['a', ZEILENENDE, 'b']);
    expect(zeichenfolge('risk \u2013 as')).toEqual(['risk', '\u2013', 'as']);
  });

  it('findet ein Zitat, übergeht Fussnotenzeichen und meldet die erste Abweichung', () => {
    const seite = zeichenfolge('Header 12\nThe production of confidently\nstated content. 6\nNext', true);
    expect(vergleiche('The production of confidently stated content.', seite)).toBeNull();
    expect(vergleiche('The production of confident stated content.', seite)).toMatch(/nach 3 von .*\[confident\]/);
    expect(vergleiche('stated content. Next', seite)).toBeNull();
    expect(vergleiche('The production of stated content.', seite)).not.toBeNull();
    expect(vergleiche('', seite)).toBe('leeres Zitat');
  });

  it('über den Seitenumbruch nur mit Folgeseite, Anfang am Zeilenende und Rest am Seitenanfang', () => {
    const s1 = zeichenfolge('Text\nOrganizational teams are committed\nto a culture', true);
    const s2 = zeichenfolge('NIST AI 100-1 Page 23\nthat considers and communicates AI risk.\nmore', true);
    const z = 'Organizational teams are committed to a culture that considers and communicates AI risk.';
    expect(vergleiche(z, s1)).not.toBeNull();
    expect(vergleiche(z, s1, s2)).toBeNull();
    expect(vergleiche('Organizational teams are committed to a that considers and communicates AI risk.', s1, s2)).not.toBeNull();
    expect(vergleiche('Organizational teams are committed to a culture that considers AI risk.', s1, s2)).not.toBeNull();
  });

  it('kennt alle Zitate mit Seite und Spalte', () => {
    const p = prueflinge();
    expect(p.filter((x) => x.feld === 'zitat')).toHaveLength(4 + 19 + 72 + 7 + 12 + 58);
    expect(p.filter((x) => x.bereich === 'rechts')).toHaveLength(72);
    expect(p.filter((x) => x.bereich === 'mitte')).toHaveLength(58);
    expect(p.find((x) => x.ort === 'ai-600-1 risiken gai-konfabulation' && x.feld === 'abschnitt_titel_zitat')!.seite).toBe(seiten['ai-600-1']['gai-konfabulation']);
  });

  it('läuft nur mit --lokal', async () => {
    expect(await pruefe({ lokal: false })).toEqual([]);
  });

  it.skipIf(!existsSync(pdfDatei('ai-100-1')) || !existsSync(pdfDatei('ai-600-1')))('alle Zitate stimmen Wort für Wort mit den PDFs überein (lokal)', () => {
    expect(pruefeAlle().map((b) => b.meldung)).toEqual([]);
  });
});

describe('Tor G5: Zitatzeilen der NIST-Auszüge ausgenommen', () => {
  const datei = 'src/nist-rmf/original-100-1.yaml';
  it('Zitatfelder wörtlich (Halbgeviertstrich, US-Schreibweise), Übersetzung geprüft', () => {
    const text = ['    zitat: "Fair \u2013 with Harmful Bias Managed, behavior"', '    titel_zitat: "Fair \u2013 x"', '    de: "Fair \u2013 Verzerrung"'].join('\n');
    expect(pruefeText(datei, text).map((b) => b.zeile)).toEqual([3]);
    expect(istZitatZeile(datei, '  - zitat: "x"')).toBe(true);
    expect(istZitatZeile('src/nist-rmf/subkategorien.yaml', '    zitat: "x"')).toBe(false);
    expect(pruefeText('src/nist-rmf/subkategorien.yaml', '    zitat: "Fair \u2013 with"')).toHaveLength(1);
  });
});

describe('Seitenfeld «nist» im Guide', () => {
  it('nur bekannte Schlüssel und nur auf Seiten des Moduls', () => {
    const g = JSON.parse(readFileSync(join(REPO, 'src/generiert/gefuehrt.json'), 'utf8')) as { seiten: { id: string; nist?: string[]; wenn?: { modulNistRmf?: boolean } }[] };
    const mit = g.seiten.filter((x) => x.nist);
    expect(mit.map((x) => x.id).sort()).toEqual(['E12-rmf-profil', 'E3-merkmale', 'E8-rmf', 'E9-genai', 'E9-messkonzept', 'J-rmf']);
    for (const x of mit) {
      expect(x.wenn?.modulNistRmf, x.id).toBe(true);
      for (const n of x.nist!) expect(['kern', 'merkmale', 'messen', 'risiken', 'massnahmen'], x.id).toContain(n);
    }
  });
});

describe('Tor G6: NIST-Zitate als Zitat-Quelle ausgenommen', () => {
  it('jede 8-Wort-Folge eines NIST-Zitats ist Ausnahme, kurze Zitate (Merkmalsnamen) nicht', () => {
    const z = nistZitatAusnahmen();
    expect(z).toContain(nistZitat(k, 'subkategorie', 'GV-1.5')!.zitat);
    expect(z).not.toContain('Safe');
    expect(z.every((x) => normalisiere(x).length >= N)).toBe(true);
    const ist = baueAusnahmen(z);
    expect(ist(normalisiere('periodic review of the risk management process and'))).toBe(true);
    expect(ist(normalisiere('the system is safe and the risk is low'))).toBe(false);
  });
});

describe('Vorlagen mit Originaltext NIST und Blatt «Quelle»', () => {
  const texte = { de: ladeTexte('de'), en: ladeTexte('en') };
  const erzeuge = (id: string, sprache: Sprache, firma: boolean) => {
    const p = firma ? vollstaendigesProjekt() : leeresProjekt({ sprache, projektId: 't' });
    p.meta.modulNistRmf = true;
    return VORLAGEN[id]!({ u: erstelleUebersetzer(sprache, texte[sprache]), modus: firma ? 'firma' : 'leer', form: 'dokument', projekt: p, kataloge: k, kitVersion: '1.0.0' }) as XlsxMappe;
  };
  for (const sprache of ['de', 'en'] as const) {
    for (const firma of [false, true]) {
      it(`${sprache} ${firma ? 'Firmendokument' : 'leere Vorlage'}: N-01 und N-02 mit Originaltext je Subkategorie, N-04 mit Originaltitel und -beschreibung`, () => {
        const gv11 = nistZitat(k, 'subkategorie', 'GV-1.1')!;
        for (const id of ['N-01', 'N-02']) {
          const m = erzeuge(id, sprache, firma);
          const b = m.blaetter[0]!;
          const kopf = b.spalten.map((s) => s.kopf);
          expect(kopf, id).toContain(sprache === 'de' ? 'Originaltext NIST (Englisch)' : 'Original NIST text');
          expect(kopf.includes('Übersetzung (eigene, nicht amtlich)'), id).toBe(sprache === 'de');
          const zeile = b.zeilen.find((z) => z[0] === 'GV-1.1')!;
          expect(zeile.length, id).toBe(b.spalten.length);
          expect(zeile, id).toContain(gv11.zitat);
          expect(zeile.includes(gv11.de), id).toBe(sprache === 'de');
          const quelle = m.blaetter.at(-1)!;
          expect(quelle.name, id).toBe(sprache === 'de' ? 'Quelle' : 'Source');
          expect(JSON.stringify(quelle.zeilen), id).toContain(NIST_VERMERK);
          expect(JSON.stringify(quelle.zeilen).includes('Rechtstexte_Legal-Texts'), id).toBe(!firma);
          // Firmendokumente ohne Namensnennung: der Hinweis zur Übersetzung nennt KMU-CIO nicht (Tor G8)
          if (firma) expect(JSON.stringify(m), id).not.toMatch(/kmu-cio/i);
        }
        const n02 = erzeuge('N-02', sprache, firma);
        const rmf02 = n02.blaetter[1]!.zeilen.find((z) => z[0] === 'RMF-02')!;
        expect(String(rmf02.at(-1))).toContain(`GV-1.7-002: ${nistZitat(k, 'massnahme', 'GV-1.7-002')!.zitat}`);
        const n04 = erzeuge('N-04', sprache, firma);
        const risiken = n04.blaetter[1]!;
        const r2 = risiken.zeilen.find((z) => z[0] === 2)!;
        expect(r2.length).toBe(risiken.spalten.length);
        expect(r2).toContain('Confabulation');
        expect(r2).toContain(nistZitat(k, 'risiko', 'gai-konfabulation')!.zitat);
        expect(r2.some((x) => String(x).startsWith('Konfabulation: '))).toBe(sprache === 'de');
        expect(JSON.stringify(n04.blaetter.at(-1)!.zeilen)).toContain(NIST_VERMERK);
      });
    }
  }
});
