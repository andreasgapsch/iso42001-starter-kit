// P12 Erstkontakt und Lesepfad (Runde 2b): START mit höchstens 3 Sätzen und 1 Knopf vor dem ersten Schritt (AF-131, AF-132),
// Begriffsliste mit Kurzerklärungen und Prüfung der Erstnennung (AF-134), Seite «Der erste Tag» und Stage 1 und 2 in
// Kapitel 1 (AF-136). Gegenproben arbeiten mit veränderten Kopien der Quellen, damit sie ohne Git-Verlauf laufen.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { TORE } from '../../scripts/pruefen/alle.mts';
import { GUIDE_SCHWERE, MAX_WOERTER_KURZ, kapitelTexte, ladeBegriffe, langeSaetze, pruefe as pruefeBegriffe, pruefeKopf, pruefeText, saetze, seitenTexte, treffer, type Begriff, type Sprache } from '../../scripts/pruefen/begriffe.mts';
import { MAX_KNOEPFE, MAX_SAETZE, bereich, pruefe as pruefeErstkontakt, zaehleKnoepfe, zaehleSaetze } from '../../scripts/pruefen/erstkontakt.mts';

const REPO = join(import.meta.dirname, '..', '..');
const lies = (rel: string): string => readFileSync(join(REPO, rel), 'utf8');
const START = lies('src/start/START.html.tpl');
const SPRACHEN: Sprache[] = ['de', 'en'];

/** Kopie von START mit geändertem Text eines Schlüssels (DE oder EN). */
function mitText(vorlage: string, sprache: Sprache, schluessel: string, neu: string): string {
  const m = vorlage.match(/(<script type="application\/json" id="texte">\s*)([\s\S]*?)(\s*<\/script>)/)!;
  const daten = JSON.parse(m[2]!) as Record<Sprache, Record<string, string>>;
  daten[sprache][schluessel] = neu;
  return vorlage.replace(m[0], `${m[1]}${JSON.stringify(daten)}${m[3]}`);
}

const BEGRIFFE: Begriff[] = [
  { id: 'control', begriff: 'Control', kurz: 'Eine einzelne Massnahme.', formen: ['Control'] },
  { id: 'stage-1', begriff: 'Stage-1-Audit', kurz: 'Erste Stufe.', formen: ['Stage-1-Audit', 'Stage 1'] },
  { id: 'aims', begriff: 'AIMS', kurz: 'Managementsystem.', formen: ['AIMS'] },
  { id: 'aims-manager', begriff: 'AIMS-Manager', kurz: 'Programm.', formen: ['AIMS-Manager'] },
];
const text = (...zeilen: string[]) => ({ name: 'Test', datei: 'x.md', zeilen: zeilen.map((t, i) => ({ text: t, zeile: i + 1 })) });

describe('AF-131 und AF-132: START vor dem ersten Schritt', () => {
  it('Tore G42 und G43 sind in pruefen eingehängt', () => {
    expect(TORE.map((t) => t.id)).toEqual(expect.arrayContaining(['G42', 'G43']));
  });

  it('START: höchstens 3 Sätze und genau 1 Knopf vor dem ersten Schritt, Befunde 0', () => {
    const b = bereich(START)!;
    expect(b).not.toBeNull();
    expect(zaehleKnoepfe(b.markup)).toBe(MAX_KNOEPFE);
    for (const s of SPRACHEN) expect(zaehleSaetze(START, b, s), s).toBeLessThanOrEqual(MAX_SAETZE);
    expect(pruefeErstkontakt()).toEqual([]);
  });

  it('der eine Knopf ist der Hauptknopf zum AIMS-Manager, die Kurzanleitung ist ein Link danach', () => {
    const b = bereich(START)!;
    expect(b.markup).toContain('id="aims-oeffnen"');
    expect(START.indexOf('Kurzanleitung_DE.html')).toBeGreaterThan(START.indexOf('id="aims-oeffnen"'));
    expect(START).not.toMatch(/class="knopf"[^>]*Kurzanleitung/);
  });

  it('Gegenprobe: ein zweiter Knopf vor dem ersten Schritt ist ein Fehler', () => {
    const zweiter = START.replace('</div>\n      <p><a data-sprache="de"', '<a class="knopf" href="x.html" data-t="kurzanleitung">x</a></div>\n      <p><a data-sprache="de"');
    expect(zweiter).not.toBe(START);
    expect(pruefeErstkontakt({}, zweiter).map((b) => b.meldung)).toEqual(expect.arrayContaining([expect.stringContaining('2 Knöpfe')]));
  });

  it('Gegenprobe: vier Sätze sind ein Fehler, in DE wie in EN', () => {
    const lang = 'Satz eins. Satz zwei. Satz drei. Satz vier. Nichts verlässt Ihr Gerät.';
    for (const s of SPRACHEN) {
      const f = pruefeErstkontakt({}, mitText(START, s, 'lead', lang));
      expect(f.some((b) => b.meldung.includes(`${s.toUpperCase()}: 5 Sätze`)), s).toBe(true);
    }
  });

  it('Gegenprobe: ohne Satz zur Vertraulichkeit und mit unerklärtem Begriff ist der Befund rot', () => {
    const f = pruefeErstkontakt({}, mitText(START, 'de', 'lead', 'Öffnen Sie den AIMS-Manager. Er führt Sie zum Stage-1-Audit.'));
    const m = f.map((b) => b.meldung).join('\n');
    expect(m).toContain('nichts das Gerät verlässt');
    expect(m).toContain('«AIMS-Manager»');
    expect(m).toContain('«Stage-1-Audit»');
  });

  it('START nennt in beiden Sprachen Ziel mit Stage 1 und 2 und den ersten Tag', () => {
    for (const s of SPRACHEN) {
      const t = JSON.parse(START.match(/id="texte">\s*([\s\S]*?)\s*<\/script>/)![1]!) as Record<Sprache, Record<string, string>>;
      expect(t[s]['ziel_p'], s).toMatch(/[Ss]tage[- ]1/);
      expect(t[s]['ziel_p'], s).toMatch(/[Ss]tage[- ]2/);
      expect(t[s]['erster_tag_p'], s).toMatch(/60/);
    }
  });
});

describe('AF-134: Begriffsliste und Erstnennung', () => {
  it('jeder Begriff der Liste hat in DE und EN eine Kurzerklärung mit höchstens 20 Wörtern und Schreibweisen', () => {
    const kat = parse(lies('src/kataloge/glossar.yaml')) as { begriffe: { id: string; liste?: boolean }[] };
    const ids = kat.begriffe.filter((b) => b.liste).map((b) => b.id);
    expect(ids.length).toBeGreaterThanOrEqual(12);
    expect(ids).toEqual(expect.arrayContaining(['aims', 'aims-manager', 'control', 'anhang-a', 'soa', 'stage-1', 'stage-2', 'betreiber', 'anbieter', 'schatten-ki']));
    for (const s of SPRACHEN) {
      const { liste, befunde } = ladeBegriffe(s);
      expect(befunde, s).toEqual([]);
      expect(liste.map((b) => b.id), s).toEqual(ids);
      for (const b of liste) {
        expect(b.kurz.split(/\s+/).length, `${s} ${b.id}`).toBeLessThanOrEqual(MAX_WOERTER_KURZ);
        expect(b.formen.length, `${s} ${b.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('Gegenprobe: 21 Wörter oder fehlende Felder sind ein Fehler', () => {
    const kat = 'begriffe:\n  - { id: a, liste: true }\n  - { id: b, liste: true }\n  - { id: c }\n';
    const kurz21 = Array.from({ length: 21 }, (_, i) => `w${i}`).join(' ');
    const { befunde } = ladeBegriffe('de', kat, `a:\n  begriff: A\n  kurz: "${kurz21}"\n  formen: "A"\nb:\n  begriff: B\n`);
    expect(befunde.map((b) => b.meldung)).toEqual([expect.stringContaining('21 Wörter'), expect.stringContaining('kurz und formen fehlen')]);
  });

  it('Erstnennung ohne Erklärung ist ein Fehler, Erklärung oder Verweis macht sie grün', () => {
    expect(pruefeText(text('Jedes Control gilt oder gilt nicht.'), BEGRIFFE)).toHaveLength(1);
    expect(pruefeText(text('Jedes Control (eine einzelne Massnahme aus dem Katalog) gilt oder nicht.'), BEGRIFFE)).toEqual([]);
    expect(pruefeText(text('Ein Control ist eine einzelne Massnahme.'), BEGRIFFE)).toEqual([]);
    expect(pruefeText(text('Jedes Control gilt oder nicht. Ein Control ist eine einzelne Massnahme.'), BEGRIFFE)).toEqual([]);
    expect(pruefeText(text('Jedes [[g:control]] gilt oder nicht.'), BEGRIFFE)).toEqual([]);
    expect(pruefeText(text('Jedes [[g:control|Massnahme]] gilt oder nicht.'), BEGRIFFE)).toEqual([]);
    expect(pruefeText(text('Jedes Control gilt oder nicht (siehe Glossar).'), BEGRIFFE)).toEqual([]);
  });

  it('nur die Erstnennung zählt, Überschriften und Zusammensetzungen nicht, der längste Treffer gewinnt', () => {
    const md = kapitelTexte('# Control im Titel\n\nDas Control (eine einzelne Massnahme) gilt. Das Control gilt weiter.\n', 'de');
    expect(pruefeText(md, BEGRIFFE)).toEqual([]);
    expect(treffer('Der AIMS-Manager hilft.', BEGRIFFE).map((t) => t.id)).toEqual(['aims-manager']);
    expect(treffer('Das Subcontrol-Konzept', BEGRIFFE)).toEqual([]);
  });

  it('Tabellenzeile: erste Zelle wird durch die übrigen beschrieben', () => {
    const md = kapitelTexte('| Baustein | Inhalt |\n|---|---|\n| AIMS-Manager | Das Programm im Browser |\n', 'de');
    expect(pruefeText(md, BEGRIFFE)).toEqual([]);
  });

  it('englisches «control» im allgemeinen Sinn ist keine Nennung des Begriffs', () => {
    const en: Begriff[] = [{ id: 'control', begriff: 'control', kurz: 'A measure.', formen: ['control'] }];
    for (const t of ['Document control is simple.', 'Export control applies.', 'Access control matters.', 'Keep the risk under control.', 'Take control of the process.']) {
      expect(treffer(t, en), t).toEqual([]);
    }
    expect(treffer('Each control in Annex A applies.', en)).toHaveLength(1);
    expect(pruefeText(text('Document control comes first. Each control (a single measure) applies.'), en)).toEqual([]);
  });

  it('Anbieter: Kurzerklärung nennt beide Merkmale, Leitplanke 4 in DE und EN ebenso', () => {
    for (const s of SPRACHEN) {
      const k = ladeBegriffe(s).liste.find((b) => b.id === 'anbieter')!.kurz;
      expect(k, s).toMatch(s === 'de' ? /entwickelt oder entwickeln lässt.*Namen.*Verkehr.*Betrieb/ : /develops or has built.*service.*name/);
      const zeile = lies(`src/leitfaden/${s}/01-minimal-viable-aims.md`).split('\n').find((z) => /^\| 4 /.test(z))!;
      expect(zeile, s).toMatch(s === 'de' ? /entwickeln ein System oder lassen es entwickeln und bringen es unter eigenem Namen oder eigener Marke auf den Markt oder nehmen es in Betrieb/ : /develop a system or have one developed, and place it on the market or put it into service under your own name or brand/);
    }
  });

  it('Sätze trennen nicht nach Abkürzungen', () => {
    expect(saetze('Das gilt z. B. für Art. 3 nach d. h. der Norm. Danach folgt ein Satz.')).toHaveLength(2);
  });

  it('START und Kapitel 1 sind in DE und EN ohne Erstnennung ohne Erklärung', async () => {
    const befunde = (await pruefeBegriffe()).filter((b) => b.schwere === 'fehler');
    expect(befunde.map((b) => `${b.datei}: ${b.meldung}`)).toEqual([]);
  });

  it('Gegenprobe: aus dem alten Wortlaut von Kapitel 1 (Control und Anhang A ohne Erklärung) wird ein Befund', () => {
    const alt = 'Es erfüllt alle Anforderungen und entscheidet für jedes Control aus Anhang A begründet, ob es gilt.';
    const f = pruefeText(text(alt), ladeBegriffe('de').liste);
    expect(f.map((b) => b.meldung).join('\n')).toMatch(/«Control»[\s\S]*«Anhang A»/);
  });

  it('Guide-Seiten werden geprüft; ab AF-135 als Fehler, und alle Seiten erklären ihre Fachbegriffe', async () => {
    // Geänderte Erwartung (G33): bis P16 war GUIDE_SCHWERE «warnung» (30 Sammelwarnungen, DE 95 und EN 100 Seiten); AF-135 hat die
    // Erklärungen an allen Fundstellen gesetzt, das Tor ist jetzt hart.
    expect(GUIDE_SCHWERE).toBe('fehler');
    const t = seitenTexte('x.yaml', { 'E0-start': { titel: 'Titel', warum: 'Ein [[g:aims]] hilft.', fehler: 'Das Control fehlt.' } });
    expect(t).toHaveLength(1);
    const f = pruefeText(t[0]!, BEGRIFFE, GUIDE_SCHWERE);
    expect(f).toHaveLength(1);
    expect(f[0]!.schwere).toBe('fehler');
    const guide = (await pruefeBegriffe()).filter((b) => b.meldung.startsWith('Guide:'));
    expect(guide.map((b) => `${b.datei}: ${b.meldung}`)).toEqual([]);
  });

  it('Überschriften (titel, label) zählen nicht als Erstnennung; der Begriff muss aber im Text der Seite erklärt sein', () => {
    const erklaert = seitenTexte('x.yaml', { 'E3-isms': { titel: 'Rollen aus dem ISMS', felder: { a: { label: 'ISMS-Rolle', hilfe: 'Wer im [[g:isms]] zuständig ist.' } } } });
    expect(erklaert[0]!.zeilen.map((z) => z.text)).toEqual(['Wer im [[g:isms]] zuständig ist.']);
    expect(pruefeText(erklaert[0]!, ladeBegriffe('de').liste, GUIDE_SCHWERE)).toEqual([]);
    expect(pruefeKopf(erklaert[0]!, ladeBegriffe('de').liste, GUIDE_SCHWERE)).toEqual([]);
    // Gegenprobe: nur im Titel, nirgends im Text: Fehler
    const nurTitel = seitenTexte('x.yaml', { 'E3-isms': { titel: 'Rollen aus dem ISMS', frage: 'Wer ist zuständig?' } });
    const f = pruefeKopf(nurTitel[0]!, ladeBegriffe('de').liste, GUIDE_SCHWERE);
    expect(f).toHaveLength(1);
    expect(f[0]!.schwere).toBe('fehler');
    expect(f[0]!.meldung).toMatch(/\(isms\) steht nur in Titel oder Bezeichnung/);
  });

  it('Allgemeine Wendungen mit «control» (under their control, you control, machine control, operation and control) sind keine Nennung', () => {
    const t = (s: string) => text(s);
    for (const satz of ['Soweit die Logs under their control sind.', 'As far as you control the input data.', 'For example machine control and safety.', 'Operation and control of the system.']) {
      expect(pruefeText(t(satz), ladeBegriffe('en').liste), satz).toEqual([]);
    }
  });

  it('Lesbarkeit: lange Sätze erscheinen als Hinweis, nie als Fehler (W16)', () => {
    const lang = Array.from({ length: 40 }, () => 'wort').join(' ') + '.';
    const f = langeSaetze(text(lang));
    expect(f).toHaveLength(1);
    expect(f[0]!.schwere).toBe('warnung');
  });
});

describe('AF-136: Seite «Der erste Tag» und Stage 1 und 2 in Kapitel 1', () => {
  const yaml = (s: Sprache) => parse(lies(`src/leitfaden/${s}/leitfaden.yaml`)) as { erster_tag: { minuten: number; schritte: number; entfallen: number[] } };
  const kapitel = (s: Sprache) => lies(`src/leitfaden/${s}/01-minimal-viable-aims.md`);
  const abschnitt = (md: string, titel: RegExp): string => {
    const teile = md.split(/^## /m);
    const a = teile.find((t) => titel.test(t.split('\n')[0]!));
    expect(a, `Abschnitt ${titel}`).toBeTruthy();
    return a!;
  };

  it('leitfaden.yaml (DE und EN): 60 Minuten, höchstens 3 Schritte, Kapitel 4 bis 11 entfallen', () => {
    for (const s of SPRACHEN) {
      const e = yaml(s).erster_tag;
      expect(e.minuten, s).toBe(60);
      expect(e.schritte, s).toBeLessThanOrEqual(3);
      expect(e.entfallen, s).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
    }
  });

  it('Kapitel 1: Abschnitt «Der erste Tag» mit höchstens 3 Schritten, Minutenangaben, Abbruchkriterium und entfallenden Kapiteln', () => {
    const titel = { de: /^Der erste Tag/, en: /^The first day/ };
    const aufhoeren = { de: /Wann Sie aufhören dürfen/, en: /When you may stop/ };
    const entfaellt = { de: /Kapitel 4 bis 11/, en: /chapters 4 to 11/ };
    const rund = { de: /rund 60 Minuten/, en: /about 60 minutes/ };
    for (const s of SPRACHEN) {
      const a = abschnitt(kapitel(s), titel[s]);
      const schritte = a.split('\n').filter((z) => /^\d+\. /.test(z));
      expect(schritte.length, s).toBeGreaterThan(0);
      expect(schritte.length, s).toBeLessThanOrEqual(yaml(s).erster_tag.schritte);
      expect(a.split('\n')[0], s).toMatch(rund[s]);
      expect(a, s).toMatch(aufhoeren[s]);
      expect(a, s).toMatch(entfaellt[s]);
      // Summe der Minutenangaben der Schritte entspricht der Zeitschätzung
      const minuten = schritte.map((z) => Number(/(?:rund|about) (\d+) (?:Minuten|minutes)/.exec(z)?.[1]));
      expect(minuten.reduce((x, y) => x + y, 0), s).toBe(yaml(s).erster_tag.minuten);
    }
  });

  it('Kapitel 1 erklärt Stage 1 und Stage 2 (Abschnitt in DE und EN)', () => {
    const titel = { de: /Stage 1 und Stage 2/, en: /stage 1 and stage 2/ };
    const w = { de: [/Stage-1-Audit ist die erste Stufe/, /Stage-2-Audit ist die zweite Stufe/, /freiwillig/], en: [/stage 1 audit is the first stage/, /stage 2 audit is the second stage/, /voluntary/] };
    for (const s of SPRACHEN) {
      const a = abschnitt(kapitel(s), titel[s]);
      for (const re of w[s]) expect(a, `${s} ${re}`).toMatch(re);
    }
  });
});
