// Punktpfade in der Projektdatei: "organisation.kontext.themen[0].art" oder als Segmentliste.
// Lesen und unveränderliches Setzen (Kopie entlang des Pfads, Rest bleibt geteilt).

export type Segment = string | number;
export type Pfad = string | readonly Segment[];

/** Zerlegt "a.b[2].c" in ["a", "b", 2, "c"]. Segmentlisten bleiben unverändert. */
export function segmente(pfad: Pfad): Segment[] {
  if (typeof pfad !== 'string') return [...pfad];
  const s: Segment[] = [];
  for (const teil of pfad.split('.')) {
    if (teil === '') continue;
    const m = /^([^[\]]*)((?:\[\d+\])*)$/.exec(teil);
    if (!m) {
      s.push(teil);
      continue;
    }
    if (m[1]) s.push(m[1]);
    for (const i of (m[2] ?? '').matchAll(/\[(\d+)\]/g)) s.push(Number(i[1]));
  }
  return s;
}

export function lies(objekt: unknown, pfad: Pfad): unknown {
  let a: unknown = objekt;
  for (const s of segmente(pfad)) {
    if (a === null || typeof a !== 'object') return undefined;
    a = (a as Record<string | number, unknown>)[s];
  }
  return a;
}

/**
 * Setzt einen Wert und liefert ein neues Objekt. Fehlende Zwischenstufen werden angelegt
 * (Objekt, bei Zahl-Segment Liste). `undefined` entfernt den Schlüssel (optionale Felder).
 */
export function setze<T>(objekt: T, pfad: Pfad, wert: unknown): T {
  const s = segmente(pfad);
  if (s.length === 0) return wert as T;
  const rek = (knoten: unknown, i: number): unknown => {
    const k = s[i]!;
    const basis: Record<string | number, unknown> | unknown[] = Array.isArray(knoten)
      ? [...knoten]
      : knoten !== null && typeof knoten === 'object'
        ? { ...(knoten as Record<string, unknown>) }
        : typeof k === 'number'
          ? []
          : {};
    const b = basis as Record<string | number, unknown>;
    if (i === s.length - 1) {
      if (wert === undefined && !Array.isArray(basis)) delete b[k];
      else b[k] = wert;
    } else {
      b[k] = rek(b[k], i + 1);
    }
    return basis;
  };
  return rek(objekt, 0) as T;
}

/** Leer im Sinn von Pflichtfeldern: undefined, null, "", [], {} ohne Inhalt. false und 0 sind gesetzt. */
export function istLeer(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'number') return Number.isNaN(v);
  if (typeof v === 'object') return Object.values(v as object).every(istLeer);
  return false;
}
