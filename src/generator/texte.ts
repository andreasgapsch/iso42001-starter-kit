// Feste Beschriftungen des Generators je Dokumentsprache.
// Übergangslösung bis zur Ablage in src/i18n (Schlüssel bleiben gleich).
import type { HinweisArt, Lauf, Lenkungsangaben, Text } from './ir.ts';

export interface GeneratorTexte {
  lenkung: Record<keyof Lenkungsangaben, string>;
  lenkungTitel: string;
  hinweis: Record<HinweisArt, string>;
  seite: [string, string]; // Text vor Seitenzahl und vor Seitenanzahl
  firmaPlatzhalter: string;
  unterschrift: { funktion: string; name: string; datum: string; unterschrift: string };
  blattDokument: string;
  druckHinweis: string;
  blattListen: string;
}

const DE: GeneratorTexte = {
  lenkung: {
    dokumentId: 'Dokument-ID',
    titel: 'Titel',
    version: 'Version',
    eigner: 'Eigner/in',
    geprueftDurch: 'Geprüft durch',
    freigabeDurch: 'Freigabe durch',
    datum: 'Datum',
    aenderung: 'Letzte Änderung',
    bestaetigt: 'Bestätigt ohne Änderung',
    klassifikation: 'Klassifikation',
    normbezug: 'Normbezug',
    ismsBezug: 'ISMS-Bezug',
    pfad: 'Pfad',
  },
  lenkungTitel: 'Dokumentlenkung',
  hinweis: {
    ausfuellhinweis: 'Ausfüllhinweis',
    namensnennung: 'Hinweis zur Vorlage',
    normverweis: 'Normverweis',
    ausbau: 'Ausbaustufe (optional)',
    beispiel: 'Beispiel',
  },
  seite: ['Seite ', ' von '],
  firmaPlatzhalter: '[Firmenname]',
  unterschrift: { funktion: 'Funktion', name: 'Name', datum: 'Datum', unterschrift: 'Unterschrift' },
  blattDokument: 'Dokument',
  druckHinweis: 'Druck: Breite Tabellen verteilen sich auf mehrere Seiten, und die Zeilenhöhe folgt dem längsten Eintrag. Für einen Ausdruck eignen sich A3 quer oder ein Filter auf die nötigen Zeilen.',
  blattListen: 'Listen',
};

const EN: GeneratorTexte = {
  lenkung: {
    dokumentId: 'Document ID',
    titel: 'Title',
    version: 'Version',
    eigner: 'Owner',
    geprueftDurch: 'Reviewed by',
    freigabeDurch: 'Approved by',
    datum: 'Date',
    aenderung: 'Last change',
    bestaetigt: 'Confirmed without change',
    klassifikation: 'Classification',
    normbezug: 'Standard reference',
    ismsBezug: 'ISMS relation',
    pfad: 'Path',
  },
  lenkungTitel: 'Document control',
  hinweis: {
    ausfuellhinweis: 'Guidance',
    namensnennung: 'About this template',
    normverweis: 'Standard reference',
    ausbau: 'Extension (optional)',
    beispiel: 'Example',
  },
  seite: ['Page ', ' of '],
  firmaPlatzhalter: '[Company name]',
  unterschrift: { funktion: 'Role', name: 'Name', datum: 'Date', unterschrift: 'Signature' },
  blattDokument: 'Document',
  druckHinweis: 'Printing: wide tables spread over several pages, and row height follows the longest entry. For a printout, use A3 landscape or filter to the rows you need.',
  blattListen: 'Lists',
};

export function texte(sprache: 'de' | 'en'): GeneratorTexte {
  return sprache === 'en' ? EN : DE;
}

/** Reihenfolge der Lenkungsangaben in Tabelle und Blatt «Dokument». */
export const LENKUNG_FELDER: (keyof Lenkungsangaben)[] = [
  'dokumentId',
  'titel',
  'version',
  'eigner',
  'geprueftDurch',
  'freigabeDurch',
  'datum',
  'aenderung',
  'bestaetigt',
  'klassifikation',
  'normbezug',
  'ismsBezug',
  'pfad',
];

/** Text in Läufe zerlegen. */
export function laeufe(t: Text): Lauf[] {
  return typeof t === 'string' ? [{ text: t }] : t;
}

/** Reiner Text ohne Formatierung. */
export function klartext(t: Text): string {
  return laeufe(t)
    .map((l) => l.text)
    .join('');
}

export function hatPlatzhalter(t: Text): boolean {
  return typeof t !== 'string' && t.some((l) => l.platzhalter === true);
}

/** Leerer Text (auch Läufe ohne Inhalt). */
export function istLeer(t: Text): boolean {
  return klartext(t).trim() === '';
}

/** Beschriftung eines Hinweises; Ausbau und Beispiel tragen immer ihre Kennzeichnung. */
export function hinweisLabel(art: HinweisArt, titel: string | undefined, tx: GeneratorTexte): string {
  const marke = tx.hinweis[art];
  if (!titel) return marke;
  return art === 'ausbau' || art === 'beispiel' ? `${marke}: ${titel}` : titel;
}
