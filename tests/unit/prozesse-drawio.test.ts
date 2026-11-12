// draw.io (Plan Prozesse 3.1 bis 3.6): XML-Leser ohne DOM, Export, Import (auch komprimiert und .drawio.svg),
// Zuordnung nach Stil, doppelte Kennungen, Unterschied, verlustfreie Rundreise Export, Import, Export.
import { readFileSync } from 'node:fs';
import { deflateSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import {
  ablaufUnterschied, drawioExport, drawioImportieren, drawioSeite, drawioSeitenLesen, DrawioFehler, htmlZuText, sha256Hex, verweisAusText, type DrawioExportProzess,
} from '../../src/prozesse/drawio.ts';
import { bahnText, katalogAblauf, rollenText } from '../../src/prozesse/katalog.ts';
import { attr, elemente, kind, normalisiere, parseXml, serialisiere, setzeAttr, textInhalt, wurzel, XmlFehler, type XmlElement } from '../../src/prozesse/xml.ts';

const u = erstelleUebersetzer('de', ladeTexte('de'));
const kataloge = ladeKataloge();
const katalog = kataloge.prozesse_katalog!;
const ROLLEN = [...new Set(katalog.prozesse.flatMap((p) => p.schritte.map((s) => s.bahn)))].map((r) => ({ schluessel: r, text: rollenText(u, r) }));

function prozess(id: string): DrawioExportProzess {
  const kp = katalog.prozesse.find((p) => p.id === id)!;
  const ablauf = katalogAblauf(u, kp);
  return { id, titel: u.t(`prozesse.prozesse.${id}.titel`), ablauf, bahnTexte: Object.fromEntries(ablauf.bahnen.map((b) => [b.id, bahnText(u, b)])) };
}

const fehlerCode = (f: () => unknown): string | undefined => {
  try {
    f();
  } catch (e) {
    return (e as XmlFehler | DrawioFehler).code;
  }
  return undefined;
};

/** Alle Werte der Attribute mit Text für Menschen (Beschriftungen, Namen, Absender) */
const textWerte = (xml: string) => [...xml.matchAll(/\s(?:label|value|name|host|agent)="([^"]*)"/g)].map((m) => m[1]!);

describe('XML-Leser', () => {
  it('liest und schreibt verlustfrei (Deklaration, Kommentar, CDATA, PI, Anführungszeichen, Leerraum im Tag)', () => {
    const x = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Kopf -->\n<a b='1' c = "x &amp; y"  >\n  <![CDATA[<roh>]]><?pi test?>Text &lt;b&gt; &#228;&#x2192;<d e="&quot;"/>\n  <f\n   g="2"\n  ></f>\n</a >\n`;
    const d = parseXml(x);
    expect(serialisiere(d)).toBe(x);
    const a = wurzel(d)!;
    expect(attr(a, 'c')).toBe('x & y');
    expect(textInhalt(a)).toContain('Text <b> ä→');
    expect(textInhalt(a)).toContain('<roh>');
    expect(attr(kind(a, 'd'), 'e')).toBe('"');
  });

  it('setzt Attribute an ihrer Stelle mit gleichem Anführungszeichen, neue am Ende; gleicher Wert ändert nichts', () => {
    const d = parseXml(`<a x='1' y="2"/>`);
    const a = wurzel(d)!;
    setzeAttr(a, 'y', '2');
    expect(serialisiere(d)).toBe(`<a x='1' y="2"/>`);
    setzeAttr(a, 'x', "o'k <&>");
    setzeAttr(a, 'z', 'neu');
    expect(serialisiere(d)).toBe(`<a x='o&apos;k &lt;&amp;&gt;' y="2" z="neu"/>`);
  });

  it('lehnt DTD, fremde Entitäten, lose & und kaputtes XML ab; Grössen- und Tiefengrenze', () => {
    expect(fehlerCode(() => parseXml('<!DOCTYPE a [<!ENTITY b "x">]><a>&b;</a>'))).toBe('dtd');
    expect(fehlerCode(() => parseXml('<a>&b;</a>'))).toBe('entitaet');
    expect(fehlerCode(() => parseXml('<a x="&nbsp;"/>'))).toBe('entitaet');
    expect(fehlerCode(() => parseXml('<a>Tom & Jerry</a>'))).toBe('entitaet');
    expect(fehlerCode(() => parseXml('<a>&#0;</a>'))).toBe('entitaet');
    expect(fehlerCode(() => parseXml('<a><b></a>'))).toBe('kein-xml');
    expect(fehlerCode(() => parseXml('kein xml'))).toBe('kein-xml');
    expect(fehlerCode(() => parseXml(`<a>${'x'.repeat(100)}</a>`, { maxZeichen: 50 }))).toBe('zu-gross');
    expect(fehlerCode(() => parseXml(`${'<a>'.repeat(30)}${'</a>'.repeat(30)}`, { maxTiefe: 20 }))).toBe('tiefe');
    expect(fehlerCode(() => parseXml(`${'<a>'.repeat(30)}${'</a>'.repeat(30)}`))).toBeUndefined();
  });

  it('normalisiert für Vergleiche ohne Leerraum zwischen Elementen', () => {
    expect(normalisiere(parseXml('<a>\n  <b x="1"/>\n</a>'))).toEqual(normalisiere(parseXml('<a><b x="1"/></a>')));
  });
});

describe('draw.io: Export', () => {
  const datei = drawioExport([prozess('PR-07'), prozess('PR-08')], {
    landkarte: {
      titel: 'Prozesslandkarte',
      gruppen: [{ gruppe: 'kern', text: 'Kernprozesse KI' }, { gruppe: 'fuehrung', text: 'Führung' }],
      prozesse: [{ id: 'PR-07', gruppe: 'kern', text: 'PR-07 Freigabe' }, { id: 'PR-08', gruppe: 'kern', text: 'PR-08 Risiken' }, { id: 'PR-01', gruppe: 'fuehrung', text: 'PR-01 Kontext' }],
    },
    vars: { version: '1.0.0', projekt: 'abc' },
    geaendert: '2027-02-05T16:30:00.000Z',
  });
  const d = wurzel(parseXml(datei))!;

  it('mxfile mit Landkarte und einer Seite je Prozess, unkomprimiert, Pflichtzellen 0 und 1', () => {
    expect(d.name).toBe('mxfile');
    // Firmendokument: keine Angaben zum erzeugenden Werkzeug (host, agent)
    expect(attr(d, 'host')).toBeUndefined();
    expect(attr(d, 'agent')).toBeUndefined();
    expect(attr(d, 'pages')).toBe('3');
    expect(JSON.parse(attr(d, 'vars')!)).toEqual({ version: '1.0.0', projekt: 'abc' });
    const seiten = elemente(d, 'diagram');
    expect(seiten.map((s) => attr(s, 'id'))).toEqual(['landkarte', 'PR-07', 'PR-08']);
    for (const s of seiten) {
      const root = kind(kind(s, 'mxGraphModel'), 'root')!;
      const [z0, z1] = elemente(root);
      expect([attr(z0, 'id'), attr(z1, 'id'), attr(z1, 'parent')]).toEqual(['0', '1', '0']);
    }
  });

  it('Formen als object mit neutralen Kennungen, Schritte relativ in ihrer Bahn, Kanten mit Seiten und Zweigen', () => {
    const root = kind(kind(elemente(d, 'diagram')[1], 'mxGraphModel'), 'root')!;
    const obj = (id: string) => elemente(root, 'object').find((o) => attr(o, 'id') === id)!;
    const bahn = obj('PR-07:bahn:aims');
    expect([attr(bahn, 'element'), attr(bahn, 'role'), attr(bahn, 'tags')]).toEqual(['lane', 'aims', 'process']);
    expect(attr(bahn, 'kit')).toBeUndefined();
    expect(attr(kind(bahn, 'mxCell'), 'style')).toMatch(/^swimlane;startSize=34;/);
    const s = obj('PR-07.04');
    expect([attr(s, 'element'), attr(s, 'elementId'), attr(s, 'process'), attr(s, 'lane'), attr(s, 'processRefs')]).toEqual(['task', 'PR-07.04', 'PR-07', 'risikomanagement', 'PR-08 PR-09']);
    expect(attr(s, 'raci')).toBe('risikomanagement:R aims:A folgenabschaetzung:C');
    // Querverweise sichtbar in der Beschriftung (wie in D-27 und in der App)
    expect(attr(s, 'label')).toContain('→ PR-08, PR-09');
    expect(attr(kind(s, 'mxCell'), 'parent')).toBe('PR-07:bahn:risikomanagement');
    expect(attr(kind(obj('PR-07.03'), 'mxCell'), 'style')).toMatch(/^rhombus;/);
    expect(attr(kind(obj('PR-07.00'), 'mxCell'), 'style')).toMatch(/^rounded=1;arcSize=50;/);
    const k = obj('kante:PR-07.03:PR-07.04');
    expect(attr(k, 'label')).toBe('ja');
    expect(attr(kind(k, 'mxCell'), 'style')).toMatch(/exitX=1;exitY=0\.5;.*entryX=0\.5;entryY=0;/);
    expect([attr(kind(k, 'mxCell'), 'source'), attr(kind(k, 'mxCell'), 'target')]).toEqual(['PR-07.03', 'PR-07.04']);
  });

  it('Landkarte verlinkt nur auf vorhandene Seiten', () => {
    const root = kind(kind(elemente(d, 'diagram')[0], 'mxGraphModel'), 'root')!;
    const link = (id: string) => attr(elemente(root, 'object').find((o) => attr(o, 'id') === `karte:${id}`), 'link');
    expect(link('PR-07')).toBe('data:page/id,PR-07');
    expect(link('PR-01')).toBeUndefined();
  });

  it('keine Kit-Absender in Beschriftungen und Kopf', () => {
    for (const w of textWerte(datei)) expect(w, w).not.toMatch(/kmu-cio|\bKit\b|Starter/i);
  });
});

describe('draw.io: Rundreise', () => {
  it('Export, Import, Export ist bytegleich (mehrere Katalogprozesse mit Landkarte)', () => {
    const ids = ['PR-01', 'PR-07', 'PR-19', 'PS-05'];
    const o = { landkarte: { titel: 'Karte', gruppen: [{ gruppe: 'kern', text: 'Kern' }], prozesse: ids.map((id) => ({ id, gruppe: 'kern', text: id })) }, geaendert: '2027-01-01T00:00:00.000Z' };
    const erste = drawioExport(ids.map(prozess), o);
    const seiten = drawioSeitenLesen(erste);
    expect(seiten.map((s) => s.id)).toEqual(['landkarte', ...ids]);
    const zweite = drawioExport(
      ids.map((id, i) => {
        const imp = drawioImportieren(seiten[i + 1]!, { rollen: ROLLEN });
        const alt = prozess(id);
        expect(imp.prozessId).toBe(id);
        expect(imp.hinweise).toEqual([]);
        expect(imp.offen).toEqual({ bahnen: [], formen: [] });
        expect(imp.roh).toBe(seiten[i + 1]!.xml);
        expect(imp.hash).toBe(sha256Hex(imp.roh));
        // Gleicher Ablauf wie im Katalog (Reihenfolge, Text, Bahn, Nachfolger, Zweige, RACI, Verweise)
        expect([...imp.schritte].sort((a, b) => a.id.localeCompare(b.id))).toEqual([...alt.ablauf.schritte].sort((a, b) => a.id.localeCompare(b.id)));
        expect(ablaufUnterschied(alt.ablauf, imp)).toEqual({ neu: [], geaendert: [], entfernt: [], bahnenOhneRolle: [], formenOhneZuordnung: [] });
        return { ...alt, ablauf: { bahnen: imp.bahnen, schritte: imp.schritte, eigen: true }, roh: imp.roh };
      }),
      o,
    );
    expect(zweite).toBe(erste);
  });

  it('Einmischen: geänderter Text, entfernter und neuer Schritt; Geometrie bleibt, Entferntes wird grau markiert', () => {
    const p = prozess('PR-07');
    const roh = drawioSeitenLesen(drawioExport([p]))[0]!.xml;
    // Erwartung geändert (P20, M4-33): PR-07.08 gibt es im Katalog nicht mehr, PR-07.02 trägt einen Verweis; geändert wird
    // deshalb PR-07.01, entfernt PR-07.07 (gleiche Prüfung, andere Schritte)
    const schritte = p.ablauf.schritte
      .filter((s) => s.id !== 'PR-07.07')
      .map((s) => (s.id === 'PR-07.01' ? { ...s, text: 'Kurzprüfung mit Checkliste' } : s.id === 'PR-07.06' ? { ...s, naechste: ['PR-07.12'] } : s));
    schritte.push({ id: 'PR-07.12', art: 'aufgabe', text: 'Neu: Schulung anbieten', bahn: 'aims', naechste: ['PR-07.90'] });
    const neu = drawioSeite({ ...p, ablauf: { ...p.ablauf, schritte }, roh });
    const root = kind(kind(wurzel(parseXml(neu)), 'mxGraphModel'), 'root')!;
    const obj = (id: string) => elemente(root, 'object').find((o) => attr(o, 'id') === id);
    expect(attr(obj('PR-07.01'), 'label')).toBe('Kurzprüfung mit Checkliste');
    expect(attr(obj('PR-07.07'), 'tags')).toBe('process removed');
    expect(attr(kind(obj('PR-07.07'), 'mxCell'), 'style')).toContain('opacity=40;');
    expect(attr(obj('kante:PR-07.06:PR-07.07'), 'tags')).toBe('process removed');
    expect(attr(kind(obj('PR-07.12'), 'mxCell'), 'parent')).toBe('PR-07:bahn:aims');
    expect(obj('kante:PR-07.12:PR-07.90')).toBeDefined();
    // Geometrie eines unveränderten Schritts bleibt Zeichen für Zeichen
    const geo = (x: string) => serialisiere(kind(kind(elemente(kind(kind(wurzel(parseXml(x)), 'mxGraphModel'), 'root')!, 'object').find((o) => attr(o, 'id') === 'PR-07.05'), 'mxCell'), 'mxGeometry')!);
    expect(geo(neu)).toBe(geo(roh));
    // Wieder importiert: Unterschied zum Katalog
    const imp = drawioImportieren({ id: 'PR-07', name: '', xml: neu }, { rollen: ROLLEN });
    const u2 = ablaufUnterschied(p.ablauf, imp);
    expect(u2.neu).toEqual(['PR-07.12']);
    expect(u2.geaendert).toEqual(expect.arrayContaining(['PR-07.01', 'PR-07.06']));
  });
});

describe('draw.io: Import fremder Dateien', () => {
  const datei = readFileSync('tests/fixtures/drawio/desktop.drawio', 'utf8');
  const seiten = drawioSeitenLesen(datei);

  it('liest unkomprimierte und komprimierte Seiten', () => {
    expect(seiten.map((s) => [s.id, s.name])).toEqual([['PR-07', 'Freigabe Werkzeuge'], ['seite-zwei', 'Zugänge']]);
    expect(seiten[1]!.xml).toMatch(/^<diagram id="seite-zwei" name="Zugänge"><mxGraphModel/);
    const imp = drawioImportieren(seiten[1]!, { prozessId: 'PS-02', rollen: ROLLEN });
    expect(imp.schritte.map((s) => [s.id, s.art, s.text])).toEqual([['PS-02.01', 'aufgabe', 'Zugang beantragen']]);
  });

  it('deutet Formen nach Stil: Bahnen mit Rolle, Start und Ende, Entscheidung mit Zweigen, Notiz und Bild bleiben', () => {
    const imp = drawioImportieren(seiten[0]!, { rollen: ROLLEN });
    expect(imp.prozessId).toBe('PR-07');
    expect(imp.bahnen).toEqual([{ id: 'fachbereich', text: 'Fachbereich', rolle: 'fachbereich' }, { id: 'aims', text: 'AIMS-Verantwortliche/r', rolle: 'aims' }]);
    expect(imp.schritte.map((s) => [s.art, s.text, s.bahn])).toEqual([
      ['start', 'Antrag eingegangen', 'fachbereich'],
      ['aufgabe', 'Antrag\nerfassen', 'fachbereich'],
      ['entscheidung', 'Freigeben?', 'aims'],
      // Gleiche Höhe: links zuerst
      ['ende', 'Abgelehnt', 'fachbereich'],
      ['ende', 'Freigegeben', 'aims'],
    ]);
    const frage = imp.schritte[2]!;
    expect(Object.values(frage.zweige ?? {}).sort()).toEqual(['ja', 'nein']);
    expect(new Set(imp.schritte.map((s) => s.id)).size).toBe(5);
    for (const s of imp.schritte) expect(s.id).toMatch(/^PR-07\.\d{2}$/);
    expect(imp.offen).toEqual({ bahnen: [], formen: ['img'] });
  });

  it('erhält Fremdes: Ebene, Gruppe, Notiz, Bild, Kommentar, Punkte; Export mit Rohdaten ändert nichts mehr', () => {
    const imp = drawioImportieren(seiten[0]!, { rollen: ROLLEN });
    const p: DrawioExportProzess = { id: 'PR-07', titel: 'Freigabe', ablauf: { bahnen: imp.bahnen, schritte: imp.schritte, eigen: true }, bahnTexte: Object.fromEntries(imp.bahnen.map((b) => [b.id, b.text ?? ''])), roh: imp.roh };
    expect(drawioSeite(p)).toBe(imp.roh);
    const root = (x: string) => kind(kind(wurzel(parseXml(x)), 'mxGraphModel'), 'root')!;
    const fremd = (r: XmlElement) => r.kinder.filter((k) => k.art === 'kommentar' || (k.art === 'element' && k.name === 'mxCell' && ['0', '1', 'ebene2', 'g1', 'n1', 'img'].includes(attr(k, 'id') ?? '')));
    expect(fremd(root(imp.roh)).map((k) => serialisiere(k))).toEqual(fremd(root(seiten[0]!.xml)).map((k) => serialisiere(k)));
    expect(imp.roh).toContain('<mxPoint x="100" y="235" />');
    expect(imp.roh).toContain('tooltip="Ende gut"');
    // Normalisierte Bäume gleich bis auf die zu Kit-Formen gewordenen Zellen: object auspacken, Kit-Angaben weglassen
    const ohneKit = (x: string): unknown => {
      const r = root(x);
      return r.kinder.filter((k) => !(k.art === 'text' && !k.roh.trim())).map((k) => {
        if (k.art !== 'element' || k.name !== 'object' || (attr(k, 'kit') ?? attr(k, 'element')) === undefined || attr(k, 'tooltip')) return normalisiere(k);
        const zelle = kind(k, 'mxCell')!;
        return { ...(normalisiere(zelle) as object), id: attr(k, 'id'), wert: attr(k, 'label') };
      }).map((n) => {
        const e = n as { n?: string; a?: [string, string][]; id?: string; wert?: string };
        if (e.n !== 'mxCell' || !e.a) return n;
        const id = e.id ?? e.a.find(([a]) => a === 'id')?.[1];
        const wert = e.wert ?? e.a.find(([a]) => a === 'value')?.[1] ?? '';
        return { ...e, id, wert, a: e.a.filter(([a]) => a !== 'id' && a !== 'value') };
      });
    };
    const vorher = ohneKit(seiten[0]!.xml) as unknown[];
    const nachher = ohneKit(imp.roh) as unknown[];
    expect(nachher.length).toBe(vorher.length);
    expect(nachher.filter((n, i) => JSON.stringify(n) !== JSON.stringify(vorher[i])).length).toBe(1); // nur das UserObject s4 erhält Kit-Attribute
    // Zweiter Import der Rohdaten: gleiche Schritte, keine neuen Kennungen
    const imp2 = drawioImportieren({ ...seiten[0]!, xml: imp.roh }, { rollen: ROLLEN });
    expect(imp2.schritte).toEqual(imp.schritte);
    expect(imp2.roh).toBe(imp.roh);
  });

  it('doppelte Kit-Kennung (Kopie in draw.io): Kopie erhält die nächste freie Nummer', () => {
    const p = prozess('PR-07');
    const roh = drawioSeitenLesen(drawioExport([p]))[0]!.xml;
    const original = /<object id="PR-07\.02"[^]*?<\/object>/.exec(roh)![0];
    const kopie = roh.replace(original, `${original}\n        ${original.replace('id="PR-07.02"', 'id="kopie-1"')}`);
    const imp = drawioImportieren({ id: 'PR-07', name: '', xml: kopie }, { rollen: ROLLEN });
    expect(imp.hinweise.some((h) => h.includes('PR-07.02') && h.includes('PR-07.92'))).toBe(true);
    expect(imp.schritte.filter((s) => s.text === p.ablauf.schritte[2]!.text).map((s) => s.id).sort()).toEqual(['PR-07.02', 'PR-07.92']);
    expect(imp.roh).toMatch(/<object id="kopie-1"[^>]*elementId="PR-07\.92"/);
  });

  it('Bahnen ohne passende Rolle bleiben offen', () => {
    const xml = drawioSeitenLesen(datei.replace('value="Fachbereich"', 'value="Marketing"'))[0]!;
    const imp = drawioImportieren(xml, { rollen: ROLLEN });
    expect(imp.offen.bahnen).toEqual(['bahn-1']);
    expect(imp.bahnen[0]).toEqual({ id: 'bahn-1', text: 'Marketing' });
    expect(ablaufUnterschied({ schritte: [] }, imp).bahnenOhneRolle).toEqual(['bahn-1']);
  });

  it('.drawio.svg mit eingebettetem Diagramm, nacktes mxGraphModel, Bytes', () => {
    const inhalt = drawioExport([prozess('PR-05')]);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" content="${inhalt.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '&#10;')}"><rect/></svg>`;
    expect(drawioSeitenLesen(svg)[0]!.xml).toBe(drawioSeitenLesen(inhalt)[0]!.xml);
    expect(drawioSeitenLesen(new TextEncoder().encode(inhalt))).toEqual(drawioSeitenLesen(inhalt));
    const nackt = drawioSeitenLesen('<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>');
    expect(nackt.map((s) => s.id)).toEqual(['seite-1']);
  });

  it('komprimierte Seiten mit und ohne URL-Kodierung', () => {
    const modell = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" value="Prüfen &amp; freigeben" style="rounded=0;html=1;" vertex="1" parent="1"><mxGeometry width="80" height="40" as="geometry"/></mxCell></root></mxGraphModel>';
    for (const text of [encodeURIComponent(modell), modell]) {
      const b64 = Buffer.from(deflateSync(strToU8(text))).toString('base64');
      const s = drawioSeitenLesen(`<mxfile><diagram id="x" name="X">${b64}</diagram></mxfile>`)[0]!;
      expect(s.xml).toBe(`<diagram id="x" name="X">${modell}</diagram>`);
      expect(drawioImportieren(s, { prozessId: 'PR-27', rollen: ROLLEN }).schritte[0]!.text).toBe('Prüfen & freigeben');
    }
  });

  it('Fehler: keine draw.io-Datei, kaputte Kompression, zu gross, DTD', () => {
    expect(fehlerCode(() => drawioSeitenLesen('<html/>'))).toBe('kein-drawio');
    expect(fehlerCode(() => drawioSeitenLesen('<mxfile><diagram id="x">AAAA!!</diagram></mxfile>'))).toBe('kompression');
    expect(fehlerCode(() => drawioSeitenLesen(new Uint8Array(3 * 1024 * 1024)))).toBe('zu-gross');
    expect(fehlerCode(() => drawioSeitenLesen('<!DOCTYPE x><mxfile/>'))).toBe('dtd');
    expect(fehlerCode(() => drawioSeitenLesen('Hallo'))).toBe('kein-xml');
  });
});

describe('Hilfen', () => {
  it('HTML-Beschriftung nur als Text', () => {
    expect(htmlZuText('<div>Antrag</div><div>&lt;b&gt; &amp; <b>fett</b></div><script>x</script>')).toBe('Antrag\n<b> & fettx');
  });
  it('SHA-256 (Testvektoren)', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('ä'.repeat(100))).toHaveLength(64);
  });
});

describe('draw.io: neutrale Attribute und ältere Dateien', () => {
  it('Rohdaten mit kit, kitId, kitRaci und Tag kit werden gelesen und beim Export neutral geschrieben', () => {
    const p = prozess('PR-09');
    const neu = drawioSeitenLesen(drawioExport([p]))[0]!.xml;
    // Ältere Datei nachbilden: neutrale Namen zurück auf die Namen des Kits
    const alt = neu
      .replace(/\belement="lane"/g, 'kit="bahn"').replace(/\belement="task"/g, 'kit="schritt"').replace(/\belement="decision"/g, 'kit="entscheid"')
      .replace(/\belement="end"/g, 'kit="ende"').replace(/\belement="edge"/g, 'kit="kante"').replace(/\belement="start"/g, 'kit="start"')
      .replace(/\belementId=/g, 'kitId=').replace(/\bprocess="/g, 'kitProzess="').replace(/\brole=/g, 'kitRolle=').replace(/\blane=/g, 'kitBahn=')
      .replace(/\braci=/g, 'kitRaci=').replace(/\bprocessRefs=/g, 'kitVerweis=').replace(/\bdecisionRight=/g, 'kitEntscheid=').replace(/tags="process"/g, 'tags="kit"');
    expect(alt).toContain('kitRaci=');
    const imp = drawioImportieren({ id: 'PR-09', name: '', xml: alt }, { rollen: ROLLEN });
    expect([...imp.schritte].sort((a, b) => a.id.localeCompare(b.id))).toEqual([...p.ablauf.schritte].sort((a, b) => a.id.localeCompare(b.id)));
    const export2 = drawioSeite({ ...p, roh: imp.roh });
    expect(export2).not.toMatch(/\bkit(?:Id|Prozess|Rolle|Art|Bahn|Raci|Verweis|Dokumente|Entscheid)?=|tags="kit/);
    expect(export2).toContain('decisionRight="abschaetzung"');
  });

  it('Verweis als letzte Zeile der Beschriftung wird beim Import gelesen', () => {
    expect(verweisAusText('Risiko beurteilen\n→ PR-08, PR-09')).toEqual({ text: 'Risiko beurteilen', verweis: ['PR-08', 'PR-09'] });
    expect(verweisAusText('Ohne Verweis')).toEqual({ text: 'Ohne Verweis', verweis: [] });
  });

  it('Lenkungsangaben als Textfeld über den Bahnen, beim Import ignoriert', () => {
    const p = prozess('PR-05');
    const datei = drawioExport([p], { kopf: 'D-27-A Prozessdiagramme, Version 1.0' });
    expect(datei).toContain('element="header"');
    const imp = drawioImportieren(drawioSeitenLesen(datei)[0]!, { rollen: ROLLEN });
    expect(imp.schritte.length).toBe(p.ablauf.schritte.length);
    expect(imp.offen.formen).toEqual([]);
  });
});
