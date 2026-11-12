// Leitfaden «Minimal Viable AIMS» und Poster: Vollständigkeit, Namensnennung, Stil, Konsistenz mit den Katalogen.
// Prüft das erzeugte HTML (ohne Browser) für DE und EN; die PDFs baut scripts/leitfaden.mts.
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  aiActFristen, baueLeitfadenHtml, baueMarkdown, bauePosterHtml, fahrplanSzene, fristDatum, ladeDaten, landkarteSzeneLeitfaden, leitfadenOrdner, MATRIX_BEISPIEL,
  matrixVorschlag, nistZeilen, REPO, rollenbaumSzene, SCHRIFTDATEIEN, type Sprache, summePt, vorlagenFuer,
} from '../../scripts/leitfaden.mts';
import type { Knoten } from '../../src/grafik/svg/index.ts';
import { ohneTags } from '../../scripts/pruefen/gemeinsam.mts';
import { pruefeVorhanden } from '../../scripts/pruefen/namensnennung.mts';
import { pruefeText } from '../../scripts/pruefen/stil.mts';

/** Sprachabhängige Erwartungen; die Prüfungen selbst sind für beide Sprachen gleich. */
interface Erwartung {
  namensnennung: string;
  dateien: [string, string];
  anhangA: string;
  anhangB: string;
  anhang: string;
  disclaimer: RegExp[];
  zusatzerlaubnis: string;
  versprechen: string;
  pt: [string, string];
  kern: (n: number) => string;
  modul: (n: number) => string;
  modulNist: (n: number) => string;
  eb: (n: number) => string;
  controls: (n: number, g: number) => string;
  phase: RegExp;
  /** Kapitel 10 NIST AI RMF und Anhang F */
  nist: { titel: string; landkarte: string; dsg: string; europarat: string; keinePyramide: RegExp; nichtZertifiziert: RegExp; datum: string; einseiter: string; or: RegExp; owasp: RegExp; posterModul: string; nachLandkarte: string };
}

const ERWARTUNG: Record<Sprache, Erwartung> = {
  de: {
    namensnennung: 'ISO/IEC 42001 Starter-Kit von Andreas Gapsch, KMU-CIO, kmu-cio.ch',
    dateien: ['Leitfaden_Minimal-Viable-AIMS.html', 'AIMS-auf-einer-Seite.html'],
    anhangA: 'A Dokumentenübersicht',
    anhangB: 'B Glossar in Kürze',
    anhang: 'Anhang',
    disclaimer: [/keine Rechtsberatung/, /garantiert keine Zertifizierung/, /Beziehen Sie die Norm ISO\/IEC 42001 selbst/],
    zusatzerlaubnis: 'Zusatzerlaubnis',
    versprechen: 'Das Einzige, was man kaufen muss, ist die Norm ISO/IEC 42001.',
    pt: ['25 bis 35 PT', '45 bis 65 PT'],
    kern: (n) => `${n} Kernvorlagen`,
    modul: (n) => `${n} Vorlagen E-01 bis E-09`,
    modulNist: (n) => `${n} Vorlagen N-01 bis N-04`,
    eb: (n) => `${n} Ergänzungsblätter`,
    controls: (n, g) => `${n} Controls in ${g} Gruppen`,
    phase: /Phase\s+\d\.\d/,
    nist: {
      titel: '10 NIST AI RMF als Ergänzung',
      landkarte: 'Landkarte der Regelwerke aus Schweizer Sicht',
      dsg: 'Datenschutzgesetz (DSG), DSGVO',
      europarat: 'KI-Konvention des Europarats',
      keinePyramide: /keine Pyramide/,
      nichtZertifiziert: /NIST zertifiziert nicht/,
      datum: '21.10.2026',
      einseiter: 'F Fragen für Verwaltungsrat und Geschäftsleitung',
      or: /Art\. 716a Abs\. 1 Ziff\. 1 und 5 OR/,
      owasp: /OWASP Top 10 for LLM Applications 2026, Lizenz CC BY-SA 4\.0/,
      posterModul: 'Modul NIST AI RMF (optional)',
      nachLandkarte: 'Was ISO/IEC 42001 leistet und was nicht',
    },
  },
  en: {
    namensnennung: 'ISO/IEC 42001 Starter Kit by Andreas Gapsch, KMU-CIO, kmu-cio.ch',
    dateien: ['Guide_Minimal-Viable-AIMS.html', 'AIMS-on-one-page.html'],
    anhangA: 'A Document overview',
    anhangB: 'B Glossary in brief',
    anhang: 'Appendix',
    disclaimer: [/not legal advice/, /does not guarantee certification/, /Obtain the standard ISO\/IEC 42001 yourself/],
    zusatzerlaubnis: 'Additional permission',
    versprechen: 'Download the kit, unzip it, get started. The only thing you need to buy is the standard ISO/IEC 42001.',
    pt: ['25 to 35 PD', '45 to 65 PD'],
    kern: (n) => `${n} core templates`,
    modul: (n) => `${n} templates E-01 to E-09`,
    modulNist: (n) => `${n} templates N-01 to N-04`,
    eb: (n) => `${n} supplementary sheets`,
    controls: (n, g) => `${n} controls in ${g} groups`,
    phase: /Phase\s+\d\.\d/i,
    nist: {
      titel: '10 NIST AI RMF as a complement',
      landkarte: 'Map of the frameworks from a Swiss perspective',
      dsg: 'Federal Act on Data Protection (FADP), GDPR',
      europarat: 'Council of Europe Framework Convention on AI',
      keinePyramide: /not a pyramid/,
      nichtZertifiziert: /NIST does not certify/,
      datum: '21/10/2026',
      einseiter: 'F Questions for the board of directors and executive management',
      or: /Art\. 716a para\. 1 items 1 and 5 CO/,
      owasp: /OWASP Top 10 for LLM Applications 2026, licence CC BY-SA 4\.0/,
      posterModul: 'NIST AI RMF module (optional)',
      nachLandkarte: 'What ISO/IEC 42001 does and does not do',
    },
  },
};

/** Schlüsselpfade eines YAML-Objekts (Listen als Ganzes), für den Strukturvergleich DE/EN. */
function schluessel(o: unknown, praefix = ''): string[] {
  if (o === null || typeof o !== 'object' || Array.isArray(o)) return [praefix];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => schluessel(v, praefix ? `${praefix}.${k}` : k));
}

const KIT_ORDNER = parse(readFileSync(join(REPO, 'src/kataloge/kit-ordner.yaml'), 'utf8')) as {
  sprachen: Record<Sprache, { ordner: string; leitfaden: string; vorlagen: string; modul: string; modul_nist: string; integration: string }>;
};

describe.each(['de', 'en'] as const)('Leitfaden %s', (sprache) => {
  const e = ERWARTUNG[sprache];
  const d = ladeDaten(sprache);
  const { html, ueberschriften } = baueLeitfadenHtml(d);
  const text = ohneTags(html);
  /** Nur der Hauptteil (ohne Titelseite und Inhaltsverzeichnis). */
  const haupttext = ohneTags(html.slice(html.indexOf('<main>')));
  const poster = bauePosterHtml(d);
  const posterText = ohneTags(poster);
  const IDS = d.dokumente.map((x) => x.id);
  const EB_IDS = d.blaetter.map((b) => b.id);

  /** Text des Anhangs A (Dokumentenübersicht) bis zum Glossar. */
  function dokumentenuebersicht(): string {
    const start = haupttext.indexOf(e.anhangA);
    const ende = haupttext.indexOf(e.anhangB, start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(ende).toBeGreaterThan(start);
    return haupttext.slice(start, ende);
  }

  describe('Dokumentenübersicht', () => {
    it('enthält jede Vorlage aus dokumente.yaml mit Titel und Pfad', () => {
      const u = dokumentenuebersicht();
      for (const dok of d.dokumente) {
        expect(u, dok.id).toContain(dok.id);
        expect(u, dok.id).toContain(d.dokTexte[dok.id]!.titel);
        expect(u, dok.id).toContain(`${dok.datei[sprache]}.${dok.format}`);
      }
    });

    it('enthält alle Ergänzungsblätter', () => {
      const u = dokumentenuebersicht();
      for (const id of EB_IDS) expect(u).toContain(id);
    });

    it('nennt keine gestrichenen IDs als Vorlage', () => {
      const zeilen = dokumentenuebersicht().split('\n').map((z) => z.trim());
      expect(zeilen).not.toContain('D-18');
      expect(zeilen).not.toContain('D-19');
    });
  });

  describe('Kit-Ordner und Dateinamen', () => {
    it('Ausgabeordner und Vorlagenordner entsprechen kit-ordner.yaml', () => {
      const k = KIT_ORDNER.sprachen[sprache];
      expect(d.t.kitordner).toBe(k.ordner);
      expect(d.t.datei.ordner).toBe(k.leitfaden);
      expect(d.t.ordner.vorlagen).toBe(k.vorlagen);
      expect(d.t.ordner.modul).toBe(k.modul);
      expect(d.t.ordner.modul_nist).toBe(k.modul_nist);
      expect(d.t.ordner.integration).toBe(k.integration);
      expect(d.t.ordner.ergaenzungsblaetter).toBe(k.integration);
    });

    it('Dateinamen von Leitfaden und Poster', () => {
      expect([`${d.t.datei.leitfaden}.html`, `${d.t.datei.poster}.html`]).toEqual(e.dateien);
    });
  });

  describe('Namensnennung und Hinweise', () => {
    const ordner = mkdtempSync(join(tmpdir(), 'leitfaden-'));

    it('Leitfaden und Poster nennen Andreas Gapsch, KMU-CIO, kmu-cio.ch', () => {
      for (const [name, inhalt] of [[e.dateien[0], html], [e.dateien[1], poster]] as const) {
        const pfad = join(ordner, name);
        writeFileSync(pfad, inhalt);
        expect(pruefeVorhanden(pfad)).toEqual([]);
        expect(ohneTags(inhalt)).toContain(e.namensnennung);
      }
    });

    it('enthält Disclaimer, Lizenz, Zusatzerlaubnis und das Kit-Versprechen', () => {
      for (const m of e.disclaimer) expect(text).toMatch(m);
      expect(text).toContain('CC BY 4.0');
      expect(text).toContain(e.zusatzerlaubnis);
      expect(text).toContain(e.versprechen);
      expect(posterText).toContain(e.versprechen);
    });

    it('nennt die Praxisquellen zu Auditfeststellungen mit URL', () => {
      for (const quelle of ['glocertinternational.com', '4cpl.com', 'drel.ai', 'dqsglobal.com', 'iso.org']) expect(text).toContain(quelle);
    });
  });

  describe('Stil (Tor G5)', () => {
    it(`Quellen unter src/leitfaden/${sprache} ohne Eszett, Gedankenstriche und verbotene Wörter`, () => {
      const dateien = [
        ...readdirSync(leitfadenOrdner(sprache)).map((n) => join('src/leitfaden', sprache, n)),
        'src/leitfaden/schritte.yaml',
      ];
      // schritte.yaml ist sprachneutral (deutsche Kommentare): eigene Spracherkennung, alle Wortlisten, Guillemets nur in en-Werten
      const befunde = dateien.flatMap((rel) => pruefeText(rel, readFileSync(join(REPO, rel), 'utf8'), rel.endsWith('schritte.yaml') ? undefined : sprache));
      expect(befunde).toEqual([]);
    });

    it('erzeugtes HTML ohne Eszett und Gedankenstriche', () => {
      expect(pruefeText(`dist/leitfaden/${sprache}/leitfaden.txt`, text, sprache)).toEqual([]);
      expect(pruefeText(`dist/leitfaden/${sprache}/poster.txt`, posterText, sprache)).toEqual([]);
    });
  });

  describe('Konsistenz mit Katalogen und Etappen', () => {
    it('alle Bausteine sind ersetzt', () => {
      expect(baueMarkdown(d)).not.toMatch(/<!--\s*(steckbrief|aufwand|modi|dokumentenuebersicht|nistbilanz|niststand|nistgenai|abb|aiactfristen)/);
      expect(poster).not.toMatch(/\{\{/);
    });

    it('jeder Schritt hat Etappen und gültige Vorlagen; jede Etappe gehört zu einem Schritt', () => {
      for (const s of d.schritte) {
        expect(d.etappen.some((x) => x.leitfaden === s.nr), `Schritt ${s.nr}`).toBe(true);
        for (const id of vorlagenFuer(d, s.nr)) expect(IDS).toContain(id);
      }
      for (const x of d.etappen) expect(d.schritte.map((s) => s.nr)).toContain(x.leitfaden);
    });

    it('erwähnte Vorlagen-IDs existieren', () => {
      const md = baueMarkdown(d) + poster;
      const erwaehnt = new Set([...md.matchAll(/\b([DE]-\d{2}(?:-EB)?)\b/g)].map((m) => m[1]!));
      for (const id of erwaehnt) {
        if (id === 'D-18' || id === 'D-19') continue; // gestrichen, im Text erklärt
        expect([...IDS, ...EB_IDS], id).toContain(id);
      }
    });

    it('Modi 1 bis 12 sind je einem Schritt zugeordnet', () => {
      const modi = Object.keys(d.t.modi).map(Number).sort((a, b) => a - b);
      expect(modi).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      for (const m of modi) expect(d.schritte.some((s) => s.modi.includes(m)), `Modus ${m}`).toBe(true);
    });

    it('Aufwand: Summen entsprechen den Richtwerten im Text und auf dem Poster', () => {
      expect(summePt(d, 'mit_isms')).toEqual([25, 35]);
      expect(summePt(d, 'ohne_isms')).toEqual([45, 65]);
      expect(posterText).toContain(e.pt[0]);
      expect(posterText).toContain(e.pt[1]);
    });

    it('Anzahlen im Text stimmen mit den Katalogen', () => {
      // Modul NIST AI RMF (art modul_nist) zählt weder zu den Kernvorlagen noch zum Modul EU AI Act
      const kern = d.dokumente.filter((x) => x.art !== 'modul' && x.art !== 'modul_nist').length;
      const modul = d.dokumente.filter((x) => x.art === 'modul').length;
      const modulNist = d.dokumente.filter((x) => x.art === 'modul_nist').length;
      expect(text).toContain(e.kern(kern));
      expect(text).toContain(e.modul(modul));
      expect(text).toContain(e.modulNist(modulNist));
      expect(text).toContain(e.eb(EB_IDS.length));
      expect(posterText).toContain(e.eb(EB_IDS.length));
      const controls = d.controlGruppen.reduce((s, g) => s + g.anzahl, 0);
      expect(posterText).toContain(e.controls(controls, d.controlGruppen.length));
    });

    it('Inhaltsverzeichnis enthält alle Kapitel 1 bis 10 und den Anhang', () => {
      const h1 = ueberschriften.filter((u) => u.ebene === 1).map((u) => u.text);
      for (let n = 1; n <= 10; n++) expect(h1.some((t) => t.startsWith(`${n} `)), `Kapitel ${n}`).toBe(true);
      expect(h1).toContain(e.anhang);
    });

    it('Keine fremde Phasennummerierung «Phase x.y» im Text', () => {
      expect(text).not.toMatch(e.phase);
    });
  });


  describe('Abbildungen (Design System, Daten aus den Quellen)', () => {
    const ABB = ['risikomatrix', 'fahrplan', 'rollenbaum', 'fristen', 'landkarte', 'nist'] as const;
    const figuren = [...html.matchAll(/<figure class="abb[^"]*" id="abb-([a-z]+)" data-abbildung="[a-z]+">([\s\S]*?)<\/figure>/g)].map((m) => ({ name: m[1]!, inhalt: m[2]! }));
    /** HTML eines Kapitels (h1 mit Nummer bis zum nächsten h1) */
    const kapitel = (nr: number) => {
      const start = html.indexOf(`<h1 id="${nr}-`);
      const ende = html.indexOf('<h1 id=', start + 5);
      return html.slice(start, ende);
    };
    /** Alle Elemente einer Szene */
    const alle = (k: Knoten): Knoten[] => [k, ...(k.k ?? []).flatMap((x) => (typeof x === 'string' ? [] : alle(x)))];

    it('sechs Abbildungen in Lesereihenfolge, nummeriert, mit Titel, Textalternative und Quellenzeile', () => {
      expect(figuren.map((f) => f.name)).toEqual([...ABB]);
      figuren.forEach((f, i) => {
        const nr = new RegExp(`<figcaption class="abb-titel"><span class="abb-nr">${d.t.abbildung} ${i + 1}</span> [^<]{10,}</figcaption>`);
        expect(f.inhalt, f.name).toMatch(nr);
        expect(f.inhalt, f.name).toMatch(/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]* role="img" aria-labelledby="[^"]+-titel [^"]+-desc"/);
        expect(/<title id="[^"]+">([^<]{10,})<\/title>/.exec(f.inhalt)?.[1], f.name).toBeDefined();
        expect(/<desc id="[^"]+">([^<]{40,})<\/desc>/.exec(f.inhalt)?.[1], f.name).toBeDefined();
        expect(f.inhalt, f.name).toMatch(new RegExp(`<p class="abb-quelle">${d.t.quelle}: [^<]{10,}</p>`));
        // keine handgezeichneten Farben: Farben nur über die Palette (Klassen g-*)
        expect(f.inhalt, f.name).not.toMatch(/\s(fill|stroke)="#/);
      });
    });

    it('jede Abbildung steht im richtigen Kapitel', () => {
      expect(kapitel(3)).toContain('id="abb-risikomatrix"');
      expect(kapitel(4)).toContain('id="abb-fahrplan"');
      for (const n of ['rollenbaum', 'fristen', 'landkarte']) expect(kapitel(7), n).toContain(`id="abb-${n}"`);
      expect(kapitel(10)).toContain('id="abb-nist"');
    });

    it('Fahrplan: Balken je Schritt und Pfad aus schritte.yaml, Freigaben aus dem Freigabekalender', () => {
      const szene = fahrplanSzene(d);
      const balken = alle(szene).filter((k) => k.el === 'rect' && k.a?.['data-zustand']);
      expect(balken).toHaveLength(2 * d.schritte.length);
      // Breite proportional zur Dauer in Wochen: Verhältnis mit/ohne ISMS je Schritt wie in schritte.yaml
      d.schritte.forEach((s, i) => {
        const [mit, ohne] = [balken[2 * i]!, balken[2 * i + 1]!];
        const dauer = (w: [number, number]) => w[1] - w[0] + 1;
        const b = (k: Knoten) => Number(k.a!['width']) + 2;
        expect(b(mit) / b(ohne)).toBeCloseTo(dauer(s.wochen.mit_isms) / dauer(s.wochen.ohne_isms), 1);
      });
      const wochen = alle(szene).filter((k) => k.el === 'g' && k.a?.['data-woche'] !== undefined).map((k) => Number(k.a!['data-woche']));
      expect(wochen.sort((a, b) => a - b)).toEqual([...new Set([...d.freigaben.mit_isms, ...d.freigaben.ohne_isms])].sort((a, b) => a - b).flatMap((w) => (d.freigaben.mit_isms.includes(w) && d.freigaben.ohne_isms.includes(w) ? [w, w] : [w])));
      // Freigabekalender in Kapitel 4: Spalten Woche mit und ohne ISMS
      const md = readFileSync(join(leitfadenOrdner(sprache), '04-zeitplaene.md'), 'utf8');
      const start = md.indexOf(sprache === 'de' ? '## Freigabekalender' : '## Approval calendar');
      expect(start).toBeGreaterThan(0);
      const teil = md.slice(start, md.indexOf('\n## ', start + 3));
      const zeilen = [...teil.matchAll(/^\| (\d+) \| (\d+) \|/gm)].map((m) => [Number(m[1]), Number(m[2])]);
      expect(zeilen.map((z) => z[0])).toEqual(d.freigaben.mit_isms);
      expect(zeilen.map((z) => z[1])).toEqual(d.freigaben.ohne_isms);
    });

    it('Risikomatrix: Vorschlagskalen aus D-07, Grenzen des neuen Projekts, Beispiel von hoch nach tief', () => {
      const { matrix, kr } = matrixVorschlag(d);
      expect(matrix.w).toEqual([1, 2, 3, 4]);
      expect(matrix.a).toEqual([1, 2, 3, 4]);
      const f = figuren.find((x) => x.name === 'risikomatrix')!.inhalt;
      const t = ohneTags(f);
      expect(t).toContain(String(kr.akzeptanzBis));
      expect(t).toContain(String(kr.unannehmbarAb));
      const stufe = (x: { w: number; a: number }) => matrix.zellen[x.w - 1]![x.a - 1]!.stufe;
      expect(stufe(MATRIX_BEISPIEL.von)).toBe('hoch');
      expect(stufe(MATRIX_BEISPIEL.nach)).toBe('tief');
      expect(f).toContain('class="g-matrix-pfeil"');
      expect(f.match(/<g data-w=/g)).toHaveLength(16);
    });

    it('Entscheidungsbaum: Knoten und Texte aus D-24 (eine Quelle mit der Vorlage)', () => {
      const { szene, titel } = rollenbaumSzene(d);
      expect(titel).toBe(d.u.t('vorlagen.grafik.d24.titel'));
      const knoten = alle(szene).filter((k) => k.a?.['data-knoten']).map((k) => k.a!['data-knoten']);
      expect(knoten).toEqual(['start', 'f1', 'gilt_nicht', 'f2', 'nicht_erfasst', 'f3', 'anbieter', 'f4', 'betreiber', 'uebrige', 'f5', 'bleibt', 'wechsel', 'ende']);
      expect(alle(szene).filter((k) => k.a?.['data-kante'])).toHaveLength(15);
      const text = ohneTags(figuren.find((x) => x.name === 'rollenbaum')!.inhalt);
      for (const id of ['anbieter', 'betreiber']) expect(text).toContain(d.u.t(`vorlagen.grafik.d24.${id}`).split('\n')[0]);
    });

    it('AI-Act-Fristen: Daten aus src/ai-act/stand.yaml, nicht fest geschrieben (Leitfaden und Poster)', () => {
      const stand = d.aiAct;
      const liste = aiActFristen(d);
      expect(liste.length).toBeGreaterThanOrEqual(5);
      for (const x of liste) for (const id of x.ids) expect(stand.fristen.find((f) => f.id === id)?.datum, id).toBe(x.datum);
      // Tabelle im Leitfaden: Datum je Zeile aus stand.yaml
      const tabelle = /<table class="fristen">([\s\S]*?)<\/table>/.exec(html)?.[1] ?? '';
      const zeilen = [...tabelle.matchAll(/<tr data-fristen="([^"]+)"><td class="datum">([^<]+)<\/td>/g)];
      expect(zeilen).toHaveLength(liste.length);
      for (const [, ids, datum] of zeilen) expect(datum).toBe(fristDatum(stand.fristen.find((f) => f.id === ids!.split(' ')[0])!.datum, sprache));
      // Zeitachse: jedes Datum als Text, Stand als «heute»
      const svg = figuren.find((x) => x.name === 'fristen')!.inhalt;
      for (const x of liste) expect(svg).toContain(fristDatum(x.datum, sprache, true));
      expect(svg).toContain('class="g-heute"');
      // Kein Datum mehr fest im Markdown von Kapitel 7 und im Poster
      const md = readFileSync(join(leitfadenOrdner(sprache), '07-rolle-zuerst-ai-act.md'), 'utf8');
      expect(md).not.toMatch(/^\| (\d{1,2}\.\d{1,2}\.20\d\d|\d{1,2} \w+ 20\d\d) \|/m);
      const posterVorlage = readFileSync(join(leitfadenOrdner(sprache), 'poster.html'), 'utf8');
      expect(posterVorlage).not.toMatch(/20(25|26|27|28)/);
      expect(posterVorlage).toContain('{{fristen}}');
      expect(poster).toMatch(/<svg [^>]*id="poster-fristen-[a-z]+-titel|aria-labelledby="poster-fristen-/);
      for (const x of liste) expect(posterText).toContain(fristDatum(x.datum, sprache, true));
    });

    it('Landkarte: jedes Regelwerk aus landkarte.yaml als Kachel und in der Tabelle, keine Pyramide', () => {
      const szene = landkarteSzeneLeitfaden(d);
      const kacheln = alle(szene).filter((k) => k.a?.['data-eintrag']);
      expect(kacheln).toHaveLength(d.landkarte.length);
      expect(kacheln.filter((k) => k.a!['data-markiert'] === 'ja')).toHaveLength(d.landkarte.filter((x) => x.im_kit).length);
      const md = readFileSync(join(leitfadenOrdner(sprache), '07-rolle-zuerst-ai-act.md'), 'utf8');
      const tabelle = md.slice(md.indexOf('<!-- abb:landkarte -->'), md.indexOf('\n## ', md.indexOf('<!-- abb:landkarte -->')));
      const zeilen = tabelle.split('\n').filter((z) => z.startsWith('| ') && !/^\|\s*-/.test(z)).slice(1);
      expect(zeilen).toHaveLength(d.landkarte.length);
      for (const k of kacheln) {
        const erstes = String(k.a!['data-eintrag']).split(/[ ,(]/)[0]!;
        expect(zeilen.some((z) => z.includes(erstes)), erstes).toBe(true);
      }
    });

    it('NIST: Funktionen und Bilanz aus subkategorien.yaml', () => {
      const zeilen = nistZeilen(d);
      expect(zeilen).toHaveLength(2 * d.nist.funktionen.length);
      for (const z of zeilen) {
        const summe = (z.werte.ganz ?? 0) + (z.werte.teilweise ?? 0) + (z.werte.nicht ?? 0);
        expect(summe, z.titel).toBe(d.nist.subkategorien.filter((s) => d.nist.funktionen.find((f) => f.id === s.funktion)!.nist_id === z.funktion).length);
      }
      expect(zeilen.filter((z) => z.quelle === 'kit').reduce((s, z) => s + z.anzahl, 0)).toBe(72);
      const kitGanz = zeilen.filter((z) => z.quelle === 'kit').reduce((s, z) => s + (z.werte.ganz ?? 0), 0);
      expect(kitGanz).toBe(d.nist.subkategorien.filter((s) => s.abdeckung_kit === 'ganz').length);
    });

    it('Schriften Archivo und Source Serif 4 eingebettet (woff2 aus src/app/schriften), Hinweise ohne Linksbalken', () => {
      for (const f of SCHRIFTDATEIEN) {
        const b64 = readFileSync(join(REPO, 'src/app/schriften', f.datei)).toString('base64');
        expect(html, f.datei).toContain(`url(data:font/woff2;base64,${b64})`);
      }
      expect(poster).toContain("font-family: 'Archivo Variable'");
      expect(html).toMatch(/font-family: var\(--lese\)/);
      for (const doc of [html, poster]) {
        expect(doc).not.toMatch(/border-left:\s*\d/);
        expect(doc).not.toMatch(/Segoe UI|Calibri/);
      }
    });
  });

  describe('Modul NIST AI RMF, Landkarte und Einseiter (rc.2)', () => {
    /** Text von Kapitel 10 bis zum Anhang */
    const kapitel10 = (() => {
      const start = haupttext.indexOf(e.nist.titel);
      const ende = haupttext.indexOf(`${e.anhang}`, start + 1);
      expect(start).toBeGreaterThanOrEqual(0);
      return haupttext.slice(start, ende > start ? ende : undefined);
    })();

    it('Kapitel 10: freiwillig, keine Zertifizierung, Stand mit Datum, DOI und NIST-Vermerk', () => {
      expect(kapitel10).toMatch(e.nist.nichtZertifiziert);
      expect(kapitel10).toContain(e.nist.datum);
      for (const doi of ['https://doi.org/10.6028/NIST.AI.100-1', 'https://doi.org/10.6028/NIST.AI.600-1']) expect(kapitel10).toContain(doi);
      expect(kapitel10).toContain('Republished courtesy of the National Institute of Standards and Technology');
      expect(kapitel10).toMatch(/3 (bis|to) 5 (PT|PD)/);
    });

    it('Kapitel 10: Bilanz aus subkategorien.yaml (Norm und Kit) und alle 12 GenAI-Risiken', () => {
      const n = d.nist;
      const tabelle = /<table class="nist-bilanz">[\s\S]*?<\/table>/.exec(html)?.[0] ?? '';
      const summe = /<tr class="summe">([\s\S]*?)<\/tr>/.exec(tabelle)?.[1] ?? '';
      const zahlen = [...summe.matchAll(/<td class="zahl">(\d+)<\/td>/g)].map((m) => Number(m[1]));
      const grad = (feld: 'abdeckung' | 'abdeckung_kit', g: string) => n.subkategorien.filter((s) => s[feld] === g).length;
      expect(zahlen).toEqual([72, grad('abdeckung', 'ganz'), grad('abdeckung', 'teilweise'), grad('abdeckung', 'nicht'), grad('abdeckung_kit', 'ganz'), grad('abdeckung_kit', 'teilweise'), grad('abdeckung_kit', 'nicht')]);
      expect(n.subkategorien).toHaveLength(72);
      for (const r of n.risiken) expect(kapitel10, r.id).toContain(n.t.genai_risiken[r.id].titel);
      expect(n.risiken).toHaveLength(12);
    });

    it('Landkarte der Regelwerke im Kapitel 7, ausdrücklich keine Pyramide', () => {
      // Abschnitt zwischen der Überschrift der Landkarte und der nächsten h2, nur in Kapitel 7
      const k7 = ohneTags(html.slice(html.indexOf('<h1 id="7-'), html.indexOf('<h1 id="8-')));
      const start = k7.indexOf(e.nist.landkarte);
      expect(start).toBeGreaterThanOrEqual(0);
      // bis zur nächsten Überschrift h2 (Abbildung und Tabelle der Landkarte)
      const ende = k7.indexOf(e.nist.nachLandkarte, start);
      const karte = k7.slice(start, ende > start ? ende : undefined);
      expect(karte).toMatch(e.nist.keinePyramide);
      for (const r of ['AI Act', e.nist.dsg, 'ISO/IEC 42001', 'ISO/IEC 27001', 'ISO/IEC 27090', 'NIST AI RMF', e.nist.europarat]) expect(karte, r).toContain(r);
    });

    it('Anhang F: Einseiter für Verwaltungsrat und Geschäftsleitung mit 8 bis 10 Fragen und Bezug OR 716a', () => {
      const teil = /<section class="einseiter">([\s\S]*?)<\/section>/.exec(html)?.[1] ?? '';
      expect(ohneTags(teil)).toContain(e.nist.einseiter);
      expect(ohneTags(teil)).toMatch(e.nist.or);
      const fragen = (/<ol>([\s\S]*?)<\/ol>/.exec(teil)?.[1] ?? '').match(/<li>/g) ?? [];
      expect(fragen.length).toBeGreaterThanOrEqual(8);
      expect(fragen.length).toBeLessThanOrEqual(10);
      expect(ohneTags(teil)).toContain(e.namensnennung);
    });

    it('OWASP nur als Quelle mit Lizenz genannt', () => {
      expect(text).toMatch(e.nist.owasp);
    });

    it('Poster nennt beide Module', () => {
      expect(posterText).toContain(e.nist.posterModul);
      for (const id of ['N-01', 'N-02', 'N-03', 'N-04']) expect(posterText).toContain(id);
    });
  });
});

describe('Leitfaden DE und EN gleich aufgebaut', () => {
  const de = ladeDaten('de');
  const en = ladeDaten('en');

  it('dieselben Dateien (EN zusätzlich normbegriffe.yaml)', () => {
    const dateienDe = readdirSync(leitfadenOrdner('de')).sort();
    const dateienEn = readdirSync(leitfadenOrdner('en')).filter((n) => n !== 'normbegriffe.yaml').sort();
    expect(dateienEn).toEqual(dateienDe);
  });

  it('leitfaden.yaml mit identischer Schlüsselstruktur und gleicher Kapitelfolge', () => {
    expect(schluessel(en.t).sort()).toEqual(schluessel(de.t).sort());
    expect(en.t.kapitel).toEqual(de.t.kapitel);
    expect(en.t.neue_seite).toEqual(de.t.neue_seite);
  });

  it('gleiche Überschriftenstruktur und gleiche Bausteine je Kapitel', () => {
    const struktur = (sprache: Sprache) =>
      (de.t.kapitel as string[]).map((k) => {
        const md = readFileSync(join(leitfadenOrdner(sprache), k), 'utf8');
        return { k, ebenen: [...md.matchAll(/^(#{1,3}) /gm)].map((m) => m[1]!.length), bausteine: [...md.matchAll(/^<!--\s*([a-z]+(?::[a-z0-9]+)?)\s*-->$/gm)].map((m) => m[1]) };
      });
    expect(struktur('en')).toEqual(struktur('de'));
  });

  it('EN ohne Normangaben auf Deutsch (bis, Anhang) in Steckbriefen und Übersicht', () => {
    const t = ohneTags(baueLeitfadenHtml(en).html);
    expect(t).not.toMatch(/\b(bis|Anhang|Überblick|Zertifizierung)\b/);
  });
});
