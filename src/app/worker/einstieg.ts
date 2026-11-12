// Einstieg des Generator-Workers im AIMS-Manager. Wird als IIFE gebaut, deflate-komprimiert eingebettet
// und erst beim ersten Erzeugen über eine Blob-URL gestartet (scripts/app-bauen.mts).
import { renderDocx } from '../../generator/docx.ts';
import { renderXlsx } from '../../generator/xlsx.ts';
import { zipErstellen, type ZipEintrag } from '../../generator/zip.ts';
import { erstelleUebersetzer, type Texte } from '../../i18n/texte.ts';
import { prozessTexte } from '../../prozesse/katalog.ts';
import { projektDrawio, projektDrawioLesen } from '../../prozesse/drawio-projekt.ts';
import type { Kataloge } from '../../kataloge/typen.ts';
import type { Sprache } from '../../model/typen.ts';
import type { Antwort, Auftrag, BibliothekDatei, DateiFehler } from './protokoll.ts';
import { dokumentSet, erzeugeIr, istDocx } from './set.ts';
import { generatorVersion, mitEntwurf, registerIdVon, vergleichsProjekt } from '../../bibliothek/generator.ts';
import { sha256 } from '../../bibliothek/pruefsumme.ts';
import { sicherungEntpacken, sicherungPacken } from '../../bibliothek/sicherung.ts';
import { docxText } from '../../bibliothek/vorschau.ts';
import { KIT_VERSION, leeresProjekt } from '../../model/neu.ts';
import { VORLAGEN } from '../../vorlagen/index.ts';
import { dateiPraefix, mitDateiPraefix } from '../../vorlagen/gestaltung.ts';
import { fragebogenMappe, liesArbeitsmappe } from './fragebogen.ts';
import { inhaltsverzeichnis } from './inhalt.ts';
import { logoAufgabe } from './logo.ts';

interface Scope {
  postMessage(a: Antwort, transfer?: Transferable[]): void;
  addEventListener(t: 'message', f: (e: MessageEvent<Auftrag>) => void): void;
}
const scope = globalThis as unknown as Scope;
const texte: Partial<Record<Sprache, Texte>> = {};
let kataloge: Kataloge | null = null;
// Vorbelegung aus package.json (AF-177); die Nachricht «daten» setzt die Version des gebauten Werkzeugs
let kitVersion = KIT_VERSION;

function melde(a: Antwort, transfer?: Transferable[]): void {
  scope.postMessage(a, transfer);
}

async function ausfuehren(a: Auftrag): Promise<void> {
  if (a.art === 'daten') {
    texte[a.sprache] = a.daten.texte;
    kataloge = a.daten.kataloge;
    kitVersion = a.daten.kitVersion;
    melde({ nr: a.nr, art: 'bereit' });
    return;
  }
  if (a.art === 'render') {
    const daten = istDocx(a.ir) ? await renderDocx(a.ir, { zeitpunkt: new Date() }) : await renderXlsx(a.ir, { zeitpunkt: new Date() });
    melde({ nr: a.nr, art: 'datei', daten, name: a.name }, [daten.buffer as ArrayBuffer]);
    return;
  }
  if (a.art === 'logo') {
    melde({ nr: a.nr, art: 'logo', ergebnis: logoAufgabe(a.auftrag) });
    return;
  }
  if (a.art === 'drawio-export' || a.art === 'drawio-lesen') {
    const tx2 = texte[a.sprache];
    if (!tx2 || !kataloge) throw new Error('Worker ohne Grunddaten');
    const u = erstelleUebersetzer(a.sprache, tx2);
    if (a.art === 'drawio-export') {
      const r = projektDrawio(a.projekt, kataloge, u, { ...(a.ids ? { ids: a.ids } : {}), geaendert: a.projekt.meta.geaendert });
      melde({ nr: a.nr, art: 'drawio', text: r.text, name: mitDateiPraefix(r.name, dateiPraefix(a.projekt)) });
    } else {
      melde({ nr: a.nr, art: 'drawio-gelesen', seiten: projektDrawioLesen(a.projekt, kataloge, u, a.daten, a.datei, a.prozessId) });
    }
    return;
  }
  // Bibliothek (ab rc.10): Sicherung als ZIP, Textvorschau von Word-Dateien
  if (a.art === 'zip-packen') {
    const daten = sicherungPacken(a.dateien, a.register);
    melde({ nr: a.nr, art: 'datei', daten, name: 'bibliothek.zip' }, [daten.buffer as ArrayBuffer]);
    return;
  }
  if (a.art === 'zip-entpacken') {
    const r = sicherungEntpacken(a.daten);
    melde({ nr: a.nr, art: 'zip-entpackt', ...r }, r.dateien.map((d) => d.daten.buffer as ArrayBuffer));
    return;
  }
  if (a.art === 'docx-text') {
    melde({ nr: a.nr, art: 'docx-text', absaetze: docxText(a.daten) });
    return;
  }
  if (a.art === 'xlsx-lesen') {
    melde({ nr: a.nr, art: 'xlsx-gelesen', blaetter: await liesArbeitsmappe(a.daten) });
    return;
  }
  const tx = texte[a.sprache];
  if (!tx || !kataloge) throw new Error('Worker ohne Grunddaten');
  if (a.art === 'fragebogen') {
    const { mappe, name } = fragebogenMappe(a.projekt, tx, kataloge, a.sprache, kitVersion, a.fachbereich);
    const daten = await renderXlsx(mappe, { zeitpunkt: new Date() });
    melde({ nr: a.nr, art: 'datei', daten, name }, [daten.buffer as ArrayBuffer]);
    return;
  }
  if (a.art === 'vorlage') {
    const d = kataloge.dokumente.dokumente.find((x) => x.id === a.id);
    const vorlage = VORLAGEN[a.id];
    if (!d || !vorlage) throw new Error(`Keine Vorlage ${a.id}`);
    const ir = vorlage({ u: erstelleUebersetzer(a.sprache, tx), modus: 'leer', form: 'dokument', projekt: leeresProjekt({ sprache: a.sprache, projektId: 'kit' }), kataloge, kitVersion });
    const daten = istDocx(ir) ? await renderDocx(ir, { zeitpunkt: new Date() }) : await renderXlsx(ir, { zeitpunkt: new Date() });
    melde({ nr: a.nr, art: 'datei', daten, name: `${d.datei[a.sprache]}.${d.format}` }, [daten.buffer as ArrayBuffer]);
    return;
  }
  if (a.art === 'bibliothek-freigabe') {
    // Nach der Freigabe: dieselbe Datei neu erzeugen, jetzt mit Version, Prüfung und Freigabe aus dem Register im Kopf
    const basisId = /^[A-Z]-\d{2}(?:-EB)?/.exec(a.id)?.[0] ?? a.id;
    const { dateien } = dokumentSet(a.projekt, kataloge, a.sprache, [basisId]);
    const d = dateien.find((x) => (x.zusatz ? x.id : registerIdVon(x.id, x.kiSystemId)) === a.id);
    if (!d) {
      melde({ nr: a.nr, art: 'bibliothek-freigabe', datei: null });
      return;
    }
    const ir = erzeugeIr(d, a.projekt, tx, kataloge, a.sprache, kitVersion, a.normtexte);
    const basis = await sha256(new TextEncoder().encode(JSON.stringify(erzeugeIr(d, vergleichsProjekt(a.projekt, a.id), tx, kataloge, a.sprache, kitVersion, a.normtexte))));
    const daten = istDocx(ir) ? await renderDocx(ir, { zeitpunkt: new Date() }) : await renderXlsx(ir, { zeitpunkt: new Date() });
    melde({ nr: a.nr, art: 'bibliothek-freigabe', datei: { daten, basis, dateiname: d.dateiname } }, [daten.buffer as ArrayBuffer]);
    return;
  }
  if (a.art === 'bibliothek-set') {
    // Je Datei: Inhalt ohne Änderung des Registers prüfen (gleich wie die letzte erzeugte Version: keine neue Version),
    // sonst mit der neuen Version als Entwurf im Dokumentkopf erzeugen
    const { dateien, ausgelassen } = dokumentSet(a.projekt, kataloge, a.sprache, a.ids);
    const zeitpunkt = new Date();
    const aus: BibliothekDatei[] = [];
    const fehler: DateiFehler[] = [];
    const unveraendert: string[] = [];
    let fertig = 0;
    for (const d of dateien) {
      melde({ nr: a.nr, art: 'fortschritt', fertig: fertig++, gesamt: dateien.length, datei: d.dateiname });
      const regId = d.zusatz ? d.id : registerIdVon(d.id, d.kiSystemId);
      try {
        const basis = await sha256(new TextEncoder().encode(JSON.stringify(erzeugeIr(d, vergleichsProjekt(a.projekt, regId), tx, kataloge, a.sprache, kitVersion, a.normtexte))));
        const g = generatorVersion(a.projekt, regId);
        // Ältere Bibliotheken führen die Prüfsumme des vollen Stands: nur dafür beim ersten Lauf zusätzlich rechnen
        if (g.basis === basis || (g.basis && g.basis === (await sha256(new TextEncoder().encode(JSON.stringify(erzeugeIr(d, a.projekt, tx, kataloge, a.sprache, kitVersion, a.normtexte))))))) {
          unveraendert.push(regId);
          continue;
        }
        // Zusatzdateien (Register zu D-26) tragen die Lenkung ihres Dokuments; nur Dokumente erhalten die neue Version im Kopf
        const ir = erzeugeIr(d, d.zusatz || g.freigegeben ? a.projekt : mitEntwurf(a.projekt, regId, g.version), tx, kataloge, a.sprache, kitVersion, a.normtexte);
        const daten = istDocx(ir) ? await renderDocx(ir, { zeitpunkt }) : await renderXlsx(ir, { zeitpunkt });
        aus.push({ id: regId, katalogId: d.katalogId, dateiname: d.dateiname, format: d.format, daten, version: g.version, basis, ...(d.zusatz ? { zusatz: d.zusatz } : {}), ...(g.freigegeben ? { freigegeben: true } : {}) });
      } catch (x) {
        fehler.push({ id: regId, datei: d.dateiname, meldung: x instanceof Error ? x.message : String(x) });
      }
    }
    melde({ nr: a.nr, art: 'fortschritt', fertig, gesamt: dateien.length, datei: '' });
    melde({ nr: a.nr, art: 'bibliothek-set', dateien: aus, unveraendert, fehler, ausgelassen }, aus.map((x) => x.daten.buffer as ArrayBuffer));
    return;
  }
  if (a.art === 'ir') {
    const { dateien } = dokumentSet(a.projekt, kataloge, a.sprache, [a.id], a.prozessId);
    // Nur Dokumente je KI-System (D-09) nach System wählen; alle übrigen haben keine kiSystemId
    const passend = dateien.filter((d) => d.id === a.id || d.katalogId === a.id).sort((x, y) => Number(y.id === a.id) - Number(x.id === a.id));
    const e = passend.find((d) => !!a.kiSystemId && d.kiSystemId === a.kiSystemId) ?? passend.find((d) => !d.kiSystemId) ?? passend[0] ?? null;
    if (!e) {
      melde({ nr: a.nr, art: 'ir', ir: null });
      return;
    }
    try {
      melde({ nr: a.nr, art: 'ir', ir: erzeugeIr(e, a.projekt, tx, kataloge, a.sprache, kitVersion, a.normtexte) });
    } catch (x) {
      melde({ nr: a.nr, art: 'ir', ir: null, fehler: x instanceof Error ? x.message : String(x) });
    }
    return;
  }
  const t0 = performance.now();
  const { dateien, ausgelassen } = dokumentSet(a.projekt, kataloge, a.sprache, a.ids, a.prozessId, a.prozessId ? (prozessTexte(erstelleUebersetzer(a.sprache, tx), a.prozessId, a.projekt)?.titel ?? '') : undefined);
  const zeitpunkt = new Date();
  const eintraege: ZipEintrag[] = [];
  const fehler: DateiFehler[] = [];
  let fertig = 0;
  for (const d of dateien) {
    melde({ nr: a.nr, art: 'fortschritt', fertig, gesamt: dateien.length, datei: d.dateiname });
    try {
      const ir = erzeugeIr(d, a.projekt, tx, kataloge, a.sprache, kitVersion, a.normtexte);
      const bytes = istDocx(ir) ? await renderDocx(ir, { zeitpunkt }) : await renderXlsx(ir, { zeitpunkt });
      eintraege.push({ pfad: d.dateiname, inhalt: bytes });
    } catch (x) {
      fehler.push({ id: d.id, datei: d.dateiname, meldung: x instanceof Error ? x.message : String(x) });
    }
    fertig++;
  }
  melde({ nr: a.nr, art: 'fortschritt', fertig, gesamt: dateien.length, datei: '' });
  // Prozesse als Datei für draw.io neben D-27 (ganzes Set oder Auswahl mit D-27, nur wenn das Projekt Prozesse führt)
  if (!a.einzeln && !a.prozessId && a.projekt.prozesse !== undefined && (!a.ids || a.ids.includes('D-27'))) {
    try {
      const r = projektDrawio(a.projekt, kataloge, erstelleUebersetzer(a.sprache, tx), { geaendert: a.projekt.meta.geaendert });
      eintraege.push({ pfad: mitDateiPraefix(r.name, dateiPraefix(a.projekt)), inhalt: new TextEncoder().encode(r.text) });
    } catch (x) {
      fehler.push({ id: 'D-27', datei: 'drawio', meldung: x instanceof Error ? x.message : String(x) });
    }
  }
  let daten: Uint8Array;
  let name: string;
  if (a.einzeln && eintraege.length === 1) {
    daten = eintraege[0]!.inhalt;
    name = eintraege[0]!.pfad;
  } else {
    // Inhaltsverzeichnis als erste Datei des ZIP, nur über die erzeugten Dateien
    try {
      const erzeugt = new Set(eintraege.map((e) => e.pfad));
      const iv = inhaltsverzeichnis(a.projekt, tx, kataloge, a.sprache, kitVersion, dateien.filter((d) => erzeugt.has(d.dateiname)), zeitpunkt.toISOString().slice(0, 10));
      eintraege.unshift({ pfad: iv.name, inhalt: await renderXlsx(iv.mappe, { zeitpunkt }) });
    } catch (x) {
      fehler.push({ id: '00', datei: 'Inhalt', meldung: x instanceof Error ? x.message : String(x) });
    }
    daten = zipErstellen(eintraege, { zeitpunkt });
    name = a.zipName ?? 'AIMS-Dokumente.zip';
  }
  melde(
    { nr: a.nr, art: 'set', daten, name, dateien: eintraege.map((e) => e.pfad), fehler, ausgelassen, ms: Math.round(performance.now() - t0) },
    [daten.buffer as ArrayBuffer],
  );
}

scope.addEventListener('message', (e) => {
  ausfuehren(e.data).catch((x: unknown) => melde({ nr: e.data.nr, art: 'fehler', meldung: x instanceof Error ? x.message : String(x) }));
});
