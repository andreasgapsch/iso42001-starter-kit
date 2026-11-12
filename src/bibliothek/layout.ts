// Ordner-Layout der Bibliothek (gleich im verbundenen Ordner, im Browserspeicher und in der Sicherung als ZIP):
//   bibliothek.json
//   Firmendokumente/<Kennung>_<Titel>/v<Version>.<Endung>
//   Nachweise/<Kennung>_<Titel>/v<Version>.<Endung>
//   Eigene/<Kennung>_<Titel>/v<Version>.<Endung>
import type { BibliothekArt } from './modell.ts';

export const REGISTER_DATEI = 'bibliothek.json';

export const ORDNER: Record<'firmendokument' | 'nachweis' | 'eigene', string> = {
  firmendokument: 'Firmendokumente',
  nachweis: 'Nachweise',
  eigene: 'Eigene',
};

/** Ordnernamen für Projekte in englischer Dokumentsprache; bestehende Pfade bleiben, wie sie im Register stehen */
export const ORDNER_EN: Record<'firmendokument' | 'nachweis' | 'eigene', string> = {
  firmendokument: 'Company-documents',
  nachweis: 'Evidence',
  eigene: 'Own',
};

/** Teil eines Pfads ohne Zeichen, die Windows, macOS oder OneDrive ablehnen; Leerraum als Bindestrich */
export function pfadTeil(roh: string, max = 60): string {
  return (
    roh
      .normalize('NFC')
      .replace(/[\\/:*?"<>|#%\u0000-\u001f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^[.\-]+|[.\-]+$/g, '')
      .slice(0, max)
      .replace(/[.\-]+$/, '') || 'Dokument'
  );
}

export function endungVon(name: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(name);
  return m ? m[1]!.toLowerCase() : 'bin';
}

/** Ordner eines Eintrags, z. B. «Firmendokumente/D-07_KI-Risikoregister» */
export function eintragOrdner(art: BibliothekArt, id: string, titel: string, sprache?: string): string {
  const namen = sprache === 'en' ? ORDNER_EN : ORDNER;
  const basis = art === 'nachweis' ? namen.nachweis : art === 'eigene' ? namen.eigene : namen.firmendokument;
  return `${basis}/${pfadTeil(id, 40)}_${pfadTeil(titel)}`;
}

/** Pfad einer Version, z. B. «Firmendokumente/D-07_KI-Risikoregister/v1.4.xlsx» */
export function versionPfad(art: BibliothekArt, id: string, titel: string, version: string, endung: string): string {
  return `${eintragOrdner(art, id, titel)}/v${pfadTeil(version, 20)}.${endung.toLowerCase()}`;
}

/** Unter Windows reservierte Namen, auch mit Endung (con.txt) */
const RESERVIERT = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;

/** Pfad ist sicher: relativ, ohne «..», ohne leere Teile, ohne Laufwerksangabe, Steuerzeichen und reservierte Namen */
export function pfadSicher(pfad: string): boolean {
  if (typeof pfad !== 'string' || !pfad || pfad.startsWith('/') || pfad.includes('\\') || pfad.includes(':')) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(pfad)) return false;
  return pfad.split('/').every((t) => t !== '' && t !== '.' && t !== '..' && t !== '__proto__' && !RESERVIERT.test(t));
}

/** Dateien, die der Abgleich nie als neu meldet (Sperrdateien von Office, Systemdateien) */
export function ignorierteDatei(pfad: string): boolean {
  const name = pfad.split('/').at(-1) ?? '';
  return pfad === REGISTER_DATEI || /^(~\$|\.~lock|\.)/.test(name) || /^(desktop\.ini|thumbs\.db)$/i.test(name) || /\.(tmp|crdownload|part|crswap)$/i.test(name);
}

/** MIME-Typ für Download und Vorschau */
export function mimeVon(name: string): string {
  const e = endungVon(name);
  const typen: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    drawio: 'application/xml',
    zip: 'application/zip',
  };
  return typen[e] ?? 'application/octet-stream';
}

/** Grenze des Schemas für Titel (BibliothekEintrag.titel); längere Dateinamen machten die Projektdatei sonst unlesbar */
export const MAX_TITEL = 200;

/** Titel aus dem Dateinamen: ohne Endung, gekürzt auf die Grenze des Schemas */
export function titelAusName(name: string): string {
  return [...(name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || name)].slice(0, MAX_TITEL).join('').trim();
}

/** Dateiname im Register: höchstens 255 Zeichen, die Endung bleibt */
export function nameBegrenzt(name: string): string {
  return name.length <= 255 ? name : `${name.slice(0, 240)}${name.slice(name.lastIndexOf('.')).slice(0, 15)}`;
}
