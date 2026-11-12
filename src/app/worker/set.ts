// Welche Dokumente das Werkzeug für ein Projekt erzeugt (Modus «firma»), und deren Erzeugung als IR.
// Pfad mit ISMS: Vorlagen mit eb: true als Ergänzungsblatt D-xx-EB; Ergänzungsblätter zu Dokumenten ohne eb (D-03-EB)
// zusätzlich zum Dokument. Modul aus: keine E-xx.
// Isomorph: läuft im Worker und in Node-Tests.
import type { DocxDokument, XlsxMappe } from '../../generator/ir.ts';
import { xmlBereinigen } from '../../generator/xml-zeichen.ts';
import { erstelleUebersetzer, type Texte } from '../../i18n/texte.ts';
import type { Dokument, Kataloge } from '../../kataloge/typen.ts';
import type { Projekt, Sprache } from '../../model/typen.ts';
import type { NormtexteLaufzeit } from '../../normtexte/typen.ts';
import type { Vorlage, VorlagenKontext } from '../../vorlagen/kontext.ts';
import { EIGENE_EB_FORM, generischesErgaenzungsblatt, VORLAGEN, ZUSATZDATEIEN } from '../../vorlagen/index.ts';
import { ebDateistamm } from '../../vorlagen/ergaenzungsblatt.ts';
import { dateiPraefix, gestaltungEinsetzen, mitDateiPraefix } from '../../vorlagen/gestaltung.ts';
import { dokumentImModul } from '../logik/nistrmf.ts';

export interface SetEintrag {
  /** Dokument-ID wie im Register (D-06, D-06-EB, D-09) */
  id: string;
  /** Katalog-ID (ohne -EB) */
  katalogId: string;
  format: 'docx' | 'xlsx';
  form: 'dokument' | 'ergaenzungsblatt';
  kiSystemId?: string;
  /** Prozessbeschreibung eines einzelnen Prozesses (D-27) statt des Handbuchs */
  prozessId?: string;
  /** Zusatzdatei einer Vorlage (z. B. Register zu D-26): Bezeichnung in der Dokumentsprache */
  zusatz?: string;
  dateiname: string;
  vorlage: Vorlage;
}

export interface Ausgelassen {
  id: string;
  grund: 'keine-vorlage' | 'modul-aus' | 'pfad' | 'keine-systeme';
}

function sauber(s: string): string {
  return xmlBereinigen(s.normalize('NFC')).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, '-').slice(0, 60);
}

/**
 * Liste der zu erzeugenden Dateien. `ids` beschränkt auf diese Dokument-IDs (mit oder ohne -EB). `prozessId`: die
 * Prozessbeschreibung (D-27) nur für diesen Prozess, Dateiname D-27_PR-08_<Titel>.
 */
export function dokumentSet(projekt: Projekt, kataloge: Kataloge, sprache: Sprache, ids?: readonly string[], prozessId?: string, prozessTitel?: string): { dateien: SetEintrag[]; ausgelassen: Ausgelassen[] } {
  const dateien: SetEintrag[] = [];
  const ausgelassen: Ausgelassen[] = [];
  const mitIsms = projekt.meta.mitIsms;
  const ebKatalog = new Set(((kataloge['ergaenzungsblaetter'] as { blaetter?: { id: string }[] } | undefined)?.blaetter ?? []).map((b) => b.id));
  const aktiveSysteme = projekt.kiSysteme.filter((s) => s.status !== 'abgeloest' && s.status !== 'untersagt');
  for (const d of kataloge.dokumente.dokumente as Dokument[]) {
    if (ids && !ids.includes(d.id) && !ids.includes(`${d.id}-EB`)) continue;
    // Prozessbeschreibung (D-27) nur, wenn das Projekt Prozesse führt; kein Modul, deshalb ohne Eintrag in «ausgelassen».
    // Ausnahme: die Beschreibung eines Prozesses, die auf seiner Seite verlangt wird (Prüfung Dokumente und Download, D9:
    // ohne Prozessliste im Projekt kam ein ZIP nur mit dem Inhaltsverzeichnis)
    if (d.je_prozess && projekt.prozesse === undefined && !prozessId) continue;
    if (!(d.je_prozess && prozessId) && !dokumentImModul(d, projekt)) {
      ausgelassen.push({ id: d.id, grund: 'modul-aus' });
      continue;
    }
    if (d.ordner === 'integration' && !mitIsms) {
      ausgelassen.push({ id: d.id, grund: 'pfad' });
      continue;
    }
    const haupt = VORLAGEN[d.id];
    const alsEb = mitIsms && d.eb;
    let vorlage: Vorlage | undefined = haupt;
    if (alsEb && !EIGENE_EB_FORM.has(d.id)) {
      vorlage = ebKatalog.has(`${d.id}-EB`) ? generischesErgaenzungsblatt(`${d.id}-EB`) : undefined;
      // Das generische Blatt trägt keine Projektdaten: das Register selbst (D-07) liegt daneben
      if (haupt && (!ids || ids.includes(d.id))) dateien.push({ id: d.id, katalogId: d.id, format: d.format, form: 'dokument', dateiname: `${d.datei[sprache]}.${d.format}`, vorlage: haupt });
      if (ids && !ids.includes(`${d.id}-EB`)) continue;
    }
    if (!vorlage) {
      ausgelassen.push({ id: alsEb ? `${d.id}-EB` : d.id, grund: 'keine-vorlage' });
      continue;
    }
    const id = alsEb ? `${d.id}-EB` : d.id;
    // Dateinamen wie im Kit und in den Beispielen: D-04-EB_Rollen, D-03-EB_Sicherheitsleitlinie (ebDateistamm)
    const stamm = alsEb ? ebDateistamm(kataloge, id, sprache) : d.datei[sprache];
    const format = alsEb && !EIGENE_EB_FORM.has(d.id) ? 'docx' : d.format;
    const form = alsEb ? 'ergaenzungsblatt' : 'dokument';
    if (d.je_prozess && prozessId) {
      dateien.push({ id, katalogId: d.id, format, form, prozessId, dateiname: `${stamm.split('_')[0]}_${prozessId}_${sauber(prozessTitel ?? '')}.${format}`.replace(/_\./, '.'), vorlage });
      continue;
    }
    if (d.je_system) {
      if (aktiveSysteme.length === 0) ausgelassen.push({ id, grund: 'keine-systeme' });
      for (const s of aktiveSysteme) {
        dateien.push({ id, katalogId: d.id, format, form, kiSystemId: s.id, dateiname: `${stamm}_${s.id}_${sauber(s.name)}.${format}`, vorlage });
      }
      continue;
    }
    // Auswahl nur des Zusatzblatts (D-03-EB): das Dokument selbst auslassen
    const nurZusatzblatt = !!ids && !ids.includes(d.id) && !d.eb;
    if (!nurZusatzblatt) {
      dateien.push({ id, katalogId: d.id, format, form, dateiname: `${stamm}.${format}`, vorlage });
      for (const z of ZUSATZDATEIEN[d.id] ?? []) {
        dateien.push({ id: `${id}-${z.suffix.de}`, katalogId: d.id, format: 'xlsx', form, zusatz: z.suffix[sprache], dateiname: `${stamm}_${z.suffix[sprache]}.xlsx`, vorlage: z.vorlage });
      }
    }
    // Eigenes Dokument und zusätzlich ein Ergänzungsblatt für das ISMS-Gegenstück (D-03: KI-Leitlinie und D-03-EB zur Sicherheitsleitlinie)
    if (mitIsms && !d.eb && ebKatalog.has(`${d.id}-EB`) && (!ids || ids.includes(`${d.id}-EB`))) {
      dateien.push({ id: `${d.id}-EB`, katalogId: d.id, format: 'docx', form: 'ergaenzungsblatt', dateiname: `${ebDateistamm(kataloge, `${d.id}-EB`, sprache)}.docx`, vorlage: generischesErgaenzungsblatt(`${d.id}-EB`) });
    }
  }
  // Präfix der Dokumentkennung auch im Dateinamen (Gestaltung, ab rc.9); ohne Wahl bleiben die Namen unverändert
  const praefix = dateiPraefix(projekt);
  if (praefix) for (const d of dateien) d.dateiname = mitDateiPraefix(d.dateiname, praefix);
  // Dateinamen eindeutig (Windows unterscheidet nicht nach Gross- und Kleinschreibung): gleich benannte KI-Systeme sollen
  // nicht das ganze Set scheitern lassen
  const namen = new Set<string>();
  for (const d of dateien) {
    const punkt = d.dateiname.lastIndexOf('.');
    const [stamm, endung] = [d.dateiname.slice(0, punkt), d.dateiname.slice(punkt)];
    for (let n = 2; namen.has(d.dateiname.toLowerCase()); n++) d.dateiname = `${stamm}_${n}${endung}`;
    namen.add(d.dateiname.toLowerCase());
  }
  return { dateien, ausgelassen };
}

export function erzeugeIr(e: SetEintrag, projekt: Projekt, texte: Texte, kataloge: Kataloge, sprache: Sprache, kitVersion: string, normtexte?: NormtexteLaufzeit): DocxDokument | XlsxMappe {
  const ctx: VorlagenKontext = {
    // Normtexte der Firma: Laufzeitparameter, nur nach Bestätigung (src/app/normtexte/zustand.ts); nie im Projekt
    ...(normtexte?.teile.length ? { normtexte } : {}),
    u: erstelleUebersetzer(sprache, texte),
    modus: 'firma',
    form: e.form,
    projekt,
    kataloge,
    kitVersion,
    kiSystemId: e.kiSystemId,
    ...(e.prozessId ? { prozessId: e.prozessId } : {}),
  };
  // Gestaltung der Firma (Logo, CI-Farben, Schrift …) an einer Stelle nach der Vorlage
  return gestaltungEinsetzen(e.vorlage(ctx), projekt, 'firma');
}

export function istDocx(ir: DocxDokument | XlsxMappe): ir is DocxDokument {
  return 'bloecke' in ir;
}
