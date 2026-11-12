// Technikzeile eines Fehlers (Rohtext) ohne Abhängigkeit von der Oberfläche. Sie gehört in den Fehlerbericht und in den
// Speicherstatus, nie in eine Meldung (AF-015); Meldungen laufen über worker/fehlertext.ts.

/** Name und Text eines Fehlers; auch für Browserobjekte, die keine Error-Instanz sind (DOMException, ErrorEvent) */
export function rohtextVon(e: unknown): { name: string; roh: string } {
  if (e instanceof Error) return { name: e.name, roh: e.message };
  if (typeof e === 'object' && e !== null) {
    const o = e as { name?: unknown; message?: unknown };
    return { name: typeof o.name === 'string' ? o.name : '', roh: typeof o.message === 'string' ? o.message : '' };
  }
  return { name: '', roh: String(e) };
}

/** Rohtext für Fehlerbericht und Status */
export function technikText(e: unknown): string {
  const { name, roh } = rohtextVon(e);
  if (roh || name) return roh || name;
  try {
    return typeof e === 'object' && e !== null ? JSON.stringify(e) : String(e);
  } catch {
    return String(e);
  }
}
