// «Mit KI vertiefen»: Anfrage mit Kontext für den Skill zum Kopieren. Vertrauliche Felder lassen sich vorher abwählen.
export interface PromptFeld {
  schluessel: string;
  label: string;
  wert: string;
  vertraulich: boolean;
}

export interface PromptKontext {
  einleitung: string;
  seite: { titel: string; frage?: string; norm?: string; vorlage?: string };
  firma: { label: string; wert: string }[];
  felder: PromptFeld[];
  auftrag: string;
  abgewaehlt: ReadonlySet<string>;
  labels: { seite: string; frage: string; norm: string; vorlage: string; firma: string; angaben: string; leer: string; auftrag: string };
}

/** Werte als Text; Listen mit Komma, Objekte als Schlüssel: Wert. Nie vertrauliche abgewählte Felder. */
export function wertText(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(wertText).filter(Boolean).join('; ');
  return Object.entries(v as Record<string, unknown>)
    .map(([k, w]) => (wertText(w) ? `${k}: ${wertText(w)}` : ''))
    .filter(Boolean)
    .join(', ');
}

export function baueprompt(k: PromptKontext): string {
  const z: string[] = [k.einleitung, ''];
  z.push(`${k.labels.seite}: ${k.seite.titel}`);
  if (k.seite.frage) z.push(`${k.labels.frage}: ${k.seite.frage}`);
  if (k.seite.norm) z.push(`${k.labels.norm}: ISO/IEC 42001 ${k.seite.norm}`);
  if (k.seite.vorlage) z.push(`${k.labels.vorlage}: ${k.seite.vorlage}`);
  const firma = k.firma.filter((f) => f.wert && !k.abgewaehlt.has(`firma.${f.label}`));
  if (firma.length) {
    z.push('', `${k.labels.firma}:`);
    for (const f of firma) z.push(`- ${f.label}: ${f.wert}`);
  }
  z.push('', `${k.labels.angaben}:`);
  const felder = k.felder.filter((f) => !k.abgewaehlt.has(f.schluessel));
  if (felder.length === 0) z.push(`- ${k.labels.leer}`);
  for (const f of felder) z.push(`- ${f.label}: ${f.wert || k.labels.leer}`);
  z.push('', `${k.labels.auftrag}: ${k.auftrag}`);
  return z.join('\n');
}
