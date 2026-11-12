// Gestaltung der Firma an einer Stelle nach der Vorlage einsetzen: Die rund 40 Vorlagen bleiben unverändert, die
// Aufrufer (Worker: set.ts, fragebogen.ts, inhalt.ts; Node: scripts/beispiele.mts) rufen nach der Vorlage diese Funktion.
// Leere Vorlagen des Kits (Modus «leer») bekommen nie eine Gestaltung, sie bleiben im Kit-Design.
import { druckGestaltung } from '../generator/gestaltung.ts';
import type { DocxDokument, XlsxMappe } from '../generator/ir.ts';
import { hatPlatzhalter, istLeer, klartext } from '../generator/texte.ts';
import type { Projekt } from '../model/typen.ts';
import type { Modus } from './kontext.ts';

/**
 * Dokument nicht freigegeben: Die Lenkungsangaben nennen kein Freigabedatum (Status statt Freigabe im Register, oder
 * Platzhalter, weil die Freigabe fehlt). Verzeichnisse ohne Kennung (Inhalt des Sets) sind nie Entwurf.
 */
export function istEntwurf(ir: DocxDokument | XlsxMappe): boolean {
  const l = ir.lenkung;
  return !!l.dokumentId && (istLeer(l.datum) || hatPlatzhalter(l.datum));
}

export function gestaltungEinsetzen<T extends DocxDokument | XlsxMappe>(ir: T, projekt: Projekt, modus: Modus): T {
  const g = projekt.organisation.gestaltung;
  if (modus === 'leer' || !g) return ir;
  const firmenname = klartext('kopf' in ir ? ir.kopf.firmenname : ir.firmenname) || projekt.organisation.name;
  const gestaltung = druckGestaltung(g, { sprache: ir.sprache, firmenname, dokumentId: ir.lenkung.dokumentId, entwurf: istEntwurf(ir) });
  return gestaltung ? { ...ir, gestaltung } : ir;
}

/**
 * Präfix der Dateinamen erzeugter Firmendokumente (Gestaltung: kennungPraefix mit kennungPraefixDateien), sonst leer.
 * Nur der Dateiname ändert sich («AIMS-D-07_Risikoregister.xlsx»); Kennungen in Dokumenten, Register und Verweisen
 * bleiben D-07, das Inhaltsverzeichnis des Satzes nennt die Dateinamen mit Präfix.
 */
export function dateiPraefix(projekt: Pick<Projekt, 'organisation'>): string {
  const g = projekt.organisation.gestaltung;
  const p = g?.kennungPraefix?.trim() ?? '';
  return g?.kennungPraefixDateien && /^[A-Za-z0-9._-]{1,12}$/.test(p) ? p : '';
}

/** Dateiname mit Präfix, sofern er nicht schon damit beginnt */
export function mitDateiPraefix(name: string, praefix: string): string {
  return praefix && !name.startsWith(praefix) ? `${praefix}${name}` : name;
}
