// Tor G8: Namensnennung vorhanden bzw. abwesend, an selbst erzeugten Mini-Dateien.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { istErzeugtesDokument, istProzessdokument, istTraeger, pruefeAbwesend, pruefeVorhanden, pruefeWerkzeugsprache } from '../../scripts/pruefen/namensnennung.mts';

const ordner = mkdtempSync(join(tmpdir(), 'namen-'));

function office(name: string, teile: Record<string, string>): string {
  const pfad = join(ordner, name);
  writeFileSync(pfad, zipSync(Object.fromEntries(Object.entries(teile).map(([k, v]) => [k, strToU8(v)]))));
  return pfad;
}

const CORE_SAUBER = '<?xml version="1.0"?><cp:coreProperties><dc:creator>Muster AG</dc:creator></cp:coreProperties>';
const CORE_BELASTET = '<?xml version="1.0"?><cp:coreProperties>\n<dc:creator>KMU-CIO</dc:creator></cp:coreProperties>';

describe('pruefeAbwesend', () => {
  it('lässt saubere DOCX und XLSX durch', () => {
    const docx = office('sauber.docx', { 'word/document.xml': '<w:document><w:t>Leitlinie der Muster AG</w:t></w:document>', 'docProps/core.xml': CORE_SAUBER });
    const xlsx = office('sauber.xlsx', { 'xl/sharedStrings.xml': '<sst><si><t>Risiko</t></si></sst>', 'docProps/app.xml': '<Properties><Company>Muster AG</Company></Properties>' });
    expect(pruefeAbwesend(docx)).toEqual([]);
    expect(pruefeAbwesend(xlsx)).toEqual([]);
  });

  it('findet Treffer in docProps, Kopfzeile und Beziehungen', () => {
    const docx = office('belastet.docx', {
      'word/document.xml': '<w:document><w:t>Text</w:t></w:document>',
      'word/header1.xml': '<w:hdr><w:t>Vorlage von kmu-cio.ch</w:t></w:hdr>',
      'word/_rels/document.xml.rels': '<Relationships><Relationship Target="https://www.KMU-CIO.ch" TargetMode="External"/></Relationships>',
      'docProps/core.xml': CORE_BELASTET,
    });
    const b = pruefeAbwesend(docx);
    expect(b.map((x) => x.meldung.split(':')[0])).toEqual(['Teil word/header1.xml (Zeile 1)', 'Teil word/_rels/document.xml.rels (Zeile 1)', 'Teil docProps/core.xml (Zeile 2)']);
    expect(b.every((x) => x.tor === 'G8' && x.schwere === 'fehler')).toBe(true);
  });

  it('findet Treffer in XLSX-Arbeitsblättern und im Dateinamen', () => {
    const xlsx = office('kmu-cio-liste.xlsx', { 'xl/worksheets/sheet1.xml': '<worksheet><c t="inlineStr"><is><t>kmu-cio</t></is></c></worksheet>' });
    const b = pruefeAbwesend(xlsx);
    expect(b).toHaveLength(2);
    expect(b[0]!.meldung).toMatch(/Dateiname/);
  });

  it('meldet Zeilen in HTML, MD und TXT', () => {
    const md = join(ordner, 'notiz.md');
    writeFileSync(md, '# Titel\n\nQuelle: KMU-CIO\n');
    expect(pruefeAbwesend(md).map((b) => b.zeile)).toEqual([3]);
  });

  it('meldet beschädigte Office-Dateien', () => {
    const kaputt = join(ordner, 'kaputt.docx');
    writeFileSync(kaputt, 'kein zip');
    expect(pruefeAbwesend(kaputt)[0]!.meldung).toMatch(/nicht entpackbar/);
  });
});

describe('pruefeVorhanden', () => {
  it('verlangt standardmässig Name und Website', () => {
    const start = join(ordner, 'START.html');
    writeFileSync(start, '<footer>Ein Kit von <a href="https://kmu-cio.ch/42001">Andreas Gapsch, KMU-CIO (kmu-cio.ch)</a></footer>');
    expect(pruefeVorhanden(start)).toEqual([]);
    const ohne = join(ordner, 'SKILL.md');
    writeFileSync(ohne, '# Skill\nOhne Hinweis auf Andreas Gapsch.');
    expect(pruefeVorhanden(ohne).map((b) => b.meldung)).toEqual(['Namensnennung fehlt: «kmu-cio\\.ch»']);
  });

  it('akzeptiert einen eigenen Suchtext und meldet fehlende Dateien', () => {
    const datei = join(ordner, 'leitfaden.html');
    writeFileSync(datei, '<p>Starter-Kit von KMU-CIO</p>');
    expect(pruefeVorhanden(datei, 'KMU-CIO')).toEqual([]);
    expect(pruefeVorhanden(datei, /Andreas Gapsch/)).toHaveLength(1);
    expect(pruefeVorhanden(join(ordner, 'fehlt.html'))[0]!.meldung).toMatch(/fehlt/);
  });

  it('liest die Namensnennung auch aus DOCX', () => {
    const docx = office('leitfaden.docx', { 'word/document.xml': '<w:t>Andreas Gapsch</w:t><w:t>kmu-cio.ch</w:t>' });
    expect(pruefeVorhanden(docx)).toEqual([]);
  });
});

describe('Zuordnung im Kit', () => {
  it('unterscheidet Träger und erzeugte Dokumente', () => {
    expect(istTraeger('dist/kit/DE/START.html')).toBe(true);
    expect(istTraeger('dist/kit/werkzeug/aims-manager.html')).toBe(true);
    expect(istTraeger('dist/kit/skill/iso42001-kmu/SKILL.md')).toBe(true);
    expect(istTraeger('dist/kit/DE/LIESMICH.txt')).toBe(false);
    expect(istErzeugtesDokument('dist/kit/DE/Vorlagen/D-03.docx')).toBe(true);
    expect(istErzeugtesDokument('dist/kit/DE/START.html')).toBe(false);
  });
});

describe('pruefeWerkzeugsprache (D-27 und Datei für draw.io)', () => {
  it('findet Attribute und Tags des Kits, Werkzeugangaben und Konfigurationstexte', () => {
    const drawio = join(ordner, 'D-27_Prozesse.drawio');
    writeFileSync(drawio, '<mxfile host="aims"><diagram><object id="a" kit="schritt" kitRaci="aims:A" tags="kit"/></diagram></mxfile>');
    const m = pruefeWerkzeugsprache(drawio).map((b) => b.meldung);
    expect(m.some((x) => x.includes('Attribut kit…'))).toBe(true);
    expect(m.some((x) => x.includes('Tag «kit»'))).toBe(true);
    expect(m.some((x) => x.includes('host, agent'))).toBe(true);
    const docx = office('D-27_Prozessbeschreibungen.docx', { 'word/document.xml': '<w:document><w:p><w:t>Geltung: Control, abwählbar</w:t></w:p><w:p><w:t>Bedingt (Gilt, wenn die Firma … Angabe im Projekt)</w:t></w:p><w:p><w:t>Soll höchstens 0 Anzahl</w:t></w:p><w:p><w:t>ISO/IEC 27001: A.5.15</w:t></w:p></w:document>' });
    const d = pruefeWerkzeugsprache(docx, true).map((b) => b.meldung);
    expect(d.length).toBe(5);
    expect(pruefeWerkzeugsprache(docx, false).length).toBe(4);
  });

  it('lässt neutrale Dateien durch und erkennt Prozessdokumente', () => {
    const drawio = join(ordner, 'D-27_Processes.drawio');
    writeFileSync(drawio, '<mxfile modified="2027-02-04T12:00:00.000Z"><diagram><object id="a" element="task" elementId="PR-07.01" process="PR-07" raci="aims:A" tags="process"/></diagram></mxfile>');
    expect(pruefeWerkzeugsprache(drawio)).toEqual([]);
    expect(istProzessdokument('dist/firmendokumente/x/de/D-27_Prozesse.drawio')).toBe(true);
    expect(istProzessdokument('dist/firmendokumente/x/de/D-27_Prozessbeschreibungen.docx')).toBe(true);
    expect(istProzessdokument('dist/firmendokumente/x/de/D-26_Register.xlsx')).toBe(false);
  });
});
