// Hash-Routen des Werkzeugs und Abbildung der Sprungziele aus den Prüfregeln. Die Routen bis rc.9 (#/formular/…,
// #/gefuehrt/…, #/pruefung, #/dokumente, #/einstellungen, #/ueber, #/prozesse/…) bleiben unverändert gültig; der Rahmen
// (src/app/rahmen/bereiche.ts) bildet sie auf die Hauptbereiche ab. Neu ab rc.10: Übersicht, Bibliothek, Wissen, Hinweise, Hilfe.

/** Unterseiten der Einstellungen (ohne Angabe: alle Abschnitte auf einer Seite) */
export const EINSTELLUNGEN_BEREICHE = ['projekt', 'darstellung', 'gestaltung', 'normtexte', 'speicher'] as const;
export type EinstellungenBereich = (typeof EINSTELLUNGEN_BEREICHE)[number];

export type Route =
  /** unter «projekte»: nur Projekte und Beispiele */
  | { art: 'start'; unter?: 'projekte' }
  /** von: Herkunft eines Sprungs («pruefung» = Prüfansicht, «gefuehrt-pruefung» = Prüfseite E13-pruefung) für den Rückweg */
  /** feld: Pfad des Felds, das nach dem Sprung den Fokus erhält (z. B. «antragAm», Sprung aus der Prüfung, P14) */
  | { art: 'gefuehrt'; etappe?: string; seite?: string; eintrag?: string; von?: string; feld?: string }
  | { art: 'formular'; modul: string; id?: string; filter?: Record<string, string> }
  /** unter «stage1»: Stage-1-Bericht */
  | { art: 'pruefung'; unter?: 'stage1' }
  | { art: 'dokumente' }
  /** Übersicht: Fällig, Stage-1-Bereitschaft (das Lagebild bleibt #/formular/uebersicht) */
  | { art: 'uebersicht'; unter: 'faellig' | 'bereitschaft' }
  /** Bibliothek (src/app/ansichten/bibliothek): Unterbereich aus dem Untermenü der Bibliothek */
  | { art: 'bibliothek'; unter?: string; id?: string }
  /** Wissen: leitfaden/<kapitel>, regelwerk/<42001|27001|aiact|nist>, glossar, assistent; id: Abschnitt oder Eintrag */
  | { art: 'wissen'; unter?: string; id?: string }
  | { art: 'hinweise' }
  /** Hilfe: Kurzanleitung (ohne unter) und Tastenkürzel */
  | { art: 'hilfe'; unter?: 'tasten' }
  /** Prozesse: Liste mit Status-Dashboard, mit id die Detailseite (#/prozesse/PR-08); filter: art, pflicht */
  | { art: 'prozesse'; id?: string; filter?: Record<string, string> }
  /** bereich «gestaltung»: Unterseite Dokumentgestaltung (#/einstellungen/gestaltung); weitere Unterseiten ab rc.10 */
  | { art: 'einstellungen'; bereich?: EinstellungenBereich }
  | { art: 'ueber' };

export const MODULE = [
  'uebersicht', 'organisation', 'inventar', 'risiken', 'folgen', 'soa', 'dokumente', 'nachweise', 'massnahmen', 'lieferanten', 'ziele', 'kompetenz', 'audits', 'feststellungen', 'meldungen', 'generator', 'aiact', 'nistrmf', 'brucke27001', 'mitarbeitende',
] as const;
export type Modul = (typeof MODULE)[number];

function query(q: string | undefined): Record<string, string> | undefined {
  if (!q) return undefined;
  const r: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [k, v] of new URLSearchParams(q)) r[k] = v;
  return { ...r };
}

/** Teil einer Route: kaputte Kodierung (%E0%A4%A) darf das Zeichnen nicht beenden; Namen wie __proto__ sind nie ein Ziel */
function teil(x: string): string {
  let w = x;
  try {
    w = decodeURIComponent(x);
  } catch {
    /* unverändert lassen: führt zur Ersatzseite des Bereichs */
  }
  return w === '__proto__' || w === 'constructor' || w === 'prototype' ? '' : w;
}

export function parseRoute(hash: string): Route {
  const roh = hash.replace(/^#\/?/, '');
  const [pfad, q] = roh.split('?') as [string, string | undefined];
  const t = pfad.split('/').filter(Boolean).map(teil).filter(Boolean);
  switch (t[0]) {
    case 'gefuehrt': {
      const w = query(q);
      return { art: 'gefuehrt', etappe: t[1], seite: t[2], eintrag: w?.['eintrag'], ...(w?.['von'] ? { von: w['von'] } : {}), ...(w?.['feld'] ? { feld: w['feld'] } : {}) };
    }
    case 'formular':
      return { art: 'formular', modul: t[1] ?? 'uebersicht', id: t[2], filter: query(q) };
    case 'einstellungen':
      return (EINSTELLUNGEN_BEREICHE as readonly string[]).includes(t[1] ?? '') ? { art: 'einstellungen', bereich: t[1] as EinstellungenBereich } : { art: 'einstellungen' };
    case 'prozesse': {
      const f = query(q);
      return { art: 'prozesse', ...(t[1] ? { id: t[1] } : {}), ...(f ? { filter: f } : {}) };
    }
    case 'start':
      return t[1] === 'projekte' ? { art: 'start', unter: 'projekte' } : { art: 'start' };
    case 'pruefung':
      return t[1] === 'stage1' ? { art: 'pruefung', unter: 'stage1' } : { art: 'pruefung' };
    case 'uebersicht':
      return t[1] === 'bereitschaft' ? { art: 'uebersicht', unter: 'bereitschaft' } : t[1] === 'faellig' ? { art: 'uebersicht', unter: 'faellig' } : { art: 'formular', modul: 'uebersicht' };
    case 'bibliothek':
      return { art: 'bibliothek', ...(t[1] ? { unter: t[1] } : {}), ...(t[1] && t[2] ? { id: t[2] } : {}) };
    case 'wissen':
      return { art: 'wissen', ...(t[1] ? { unter: t[1] } : {}), ...(t[2] ? { id: t.slice(2).join('/') } : {}) };
    case 'hilfe':
      return t[1] === 'tasten' ? { art: 'hilfe', unter: 'tasten' } : { art: 'hilfe' };
    case 'dokumente':
    case 'ueber':
    case 'hinweise':
      return { art: t[0] };
    default:
      return { art: 'start' };
  }
}

export function routeZuHash(r: Route): string {
  const e = (s: string) => encodeURIComponent(s);
  switch (r.art) {
    case 'gefuehrt': {
      const q = new URLSearchParams();
      if (r.eintrag) q.set('eintrag', r.eintrag);
      if (r.von) q.set('von', r.von);
      if (r.feld) q.set('feld', r.feld);
      const qs = q.toString();
      return `#/gefuehrt${r.etappe ? `/${e(r.etappe)}` : ''}${r.seite ? `/${e(r.seite)}` : ''}${qs ? `?${qs}` : ''}`;
    }
    case 'formular': {
      const q = r.filter && Object.keys(r.filter).length ? `?${new URLSearchParams(r.filter).toString()}` : '';
      return `#/formular/${e(r.modul)}${r.id ? `/${e(r.id)}` : ''}${q}`;
    }
    case 'einstellungen':
      return r.bereich ? `#/einstellungen/${r.bereich}` : '#/einstellungen';
    case 'prozesse': {
      const q = r.filter && Object.keys(r.filter).length ? `?${new URLSearchParams(r.filter).toString()}` : '';
      return `#/prozesse${r.id ? `/${e(r.id)}` : ''}${q}`;
    }
    case 'start':
    case 'pruefung':
    case 'hilfe':
      return `#/${r.art}${r.unter ? `/${r.unter}` : ''}`;
    case 'uebersicht':
      return `#/uebersicht/${r.unter}`;
    case 'bibliothek':
      return `#/bibliothek${r.unter ? `/${e(r.unter)}` : ''}${r.unter && r.id ? `/${e(r.id)}` : ''}`;
    case 'wissen':
      return `#/wissen${r.unter ? `/${e(r.unter)}` : ''}${r.unter && r.id ? `/${r.id.split('/').map(e).join('/')}` : ''}`;
    default:
      return `#/${r.art}`;
  }
}

/** Bereiche der Prüfregeln (Ziel «bereich/id» oder «bereich?ki=…») auf Formularmodule. */
const BEREICH_MODUL: Record<string, Modul> = {
  inventar: 'inventar', risiken: 'risiken', folgen: 'folgen', soa: 'soa', dokumente: 'dokumente', organisation: 'organisation',
  ziele: 'ziele', audits: 'audits', massnahmen: 'massnahmen',
  kompetenz: 'kompetenz', kommunikation: 'kompetenz', lieferanten: 'lieferanten', aiact: 'aiact', nistrmf: 'nistrmf',
};

/** Unterseiten (Reiter) von Modulen; im Sprungziel steht der Reiter an der Stelle der ID. */
export const REITER: Partial<Record<Modul, readonly string[]>> = Object.assign(Object.create(null) as object, {
  organisation: ['kontext', 'parteien', 'geltungsbereich', 'leitlinie', 'rollen', 'risikokriterien'],
  kompetenz: ['kompetenzen', 'kommunikation'],
  aiact: ['systeme', 'pflichten', 'vorschlaege', 'fristen'],
  nistrmf: ['profil', 'controls', 'stand'],
  brucke27001: ['mapping', 'dokumente'],
});

/** Abweichende Reiter für Sprungziele (Bereich/Unterziel der Prüfregeln). */
const REITER_ZIEL: Record<string, string> = {
  'aiact/stand': 'fristen', 'aiact/pflichten': 'vorschlaege', kommunikation: 'kommunikation', kompetenz: 'kompetenzen',
  'nistrmf/stand': 'stand', 'nistrmf/controls': 'controls', 'nistrmf/profil': 'profil',
};

/** «inventar/KI-001» → #/formular/inventar/KI-001; «risiken?ki=KI-001» → #/formular/risiken?ki=KI-001 */
export function sprungZiel(ziel: string): Route {
  const [pfad, q] = ziel.split('?') as [string, string | undefined];
  const [bereich, id] = pfad.split('/') as [string, string | undefined];
  const modul = BEREICH_MODUL[bereich] ?? 'uebersicht';
  const reiter = REITER_ZIEL[`${bereich}/${id ?? ''}`] ?? REITER_ZIEL[bereich];
  if (reiter) return { art: 'formular', modul, id: reiter, filter: query(q) };
  // Reitermodule: unbekannte Unterziele (z. B. eine ID) als Auswahl im ersten Reiter
  const r = REITER[modul];
  if (r && id && !r.includes(id)) return { art: 'formular', modul, id: r[0], filter: { ...query(q), eintrag: id } };
  return { art: 'formular', modul, id: id || undefined, filter: query(q) };
}

/** Formularmodule, die im Werkzeug bereits umgesetzt sind; übrige Sprungziele führen in den Guide. */
export const FORMULAR_FERTIG = new Set<string>([
  'uebersicht', 'organisation', 'inventar', 'risiken', 'soa', 'massnahmen', 'lieferanten', 'ziele', 'kompetenz', 'folgen', 'audits', 'dokumente', 'generator', 'aiact', 'nistrmf', 'brucke27001',
]);

/** Ersatzziel im Guide je Bereich bzw. Bereich/Unterziel. */
const GEFUEHRT_ZIEL: Record<string, [string, string]> = {
  'organisation/geltungsbereich': ['E2', 'E2-grenzen'],
  'organisation/leitlinie': ['E3', 'E3-grundsaetze'],
  'organisation/rollen': ['E3', 'E3-pflichtrollen'],
  'organisation/risikokriterien': ['E6', 'E6-skalen'],
  'organisation/parteien': ['E2', 'E2-parteien'],
  organisation: ['E2', 'E2-grenzen'],
  folgen: ['E7', 'E7-triage'],
  dokumente: ['E11', 'E11-dokumente'],
  'dokumente/D-07': ['E8', 'E8-plan-freigabe'],
  'dokumente/D-07-EB': ['E8', 'E8-plan-freigabe-eb'],
  ziele: ['E11', 'E11-ziele'],
  audits: ['E12', 'E12-audit'],
  managementbewertung: ['E12', 'E12-mb'],
  feststellungen: ['E12', 'E12-feststellungen'],
  kompetenz: ['E10', 'E10-kompetenzen'],
  kommunikation: ['E10', 'E10-kommunikation'],
  lieferanten: ['E9', 'E9-lieferanten'],
  'aiact/pflichten': ['E8', 'E8-euaia'],
  'aiact/stand': ['E5', 'E5-risikoklasse'],
  aiact: ['E5', 'E5-risikoklasse'],
  'nistrmf/stand': ['J', 'J-rmf'],
  nistrmf: ['E12', 'E12-rmf-profil'],
};

/** Sprungziel einer Prüfregel als Route: Formularmodul, sonst passende Seite im Guide. */
export function sprungRoute(ziel: string): Route {
  // Prozesse (F31, F32, H55 bis H63, H67, H68, H71 bis H75): eigener Bereich mit Detailseite
  if (/^prozesse(?:\/|$)/.test(ziel)) {
    const id = ziel.split(/[/?]/)[1];
    return { art: 'prozesse', ...(id ? { id } : {}) };
  }
  // Bibliothek (H76 bis H80): Eintrag in «Alle Dokumente» gewählt
  if (/^bibliothek(?:\/|$)/.test(ziel)) {
    const id = ziel.split(/[/?]/)[1];
    return { art: 'bibliothek', unter: 'alle', ...(id ? { id } : {}) };
  }
  // Gestaltung der Firmendokumente (H64, H65): Einstellungen › Dokumentgestaltung
  if (/^einstellungen(?:\/|$)/.test(ziel)) return ziel.split('/')[1] === 'gestaltung' ? { art: 'einstellungen', bereich: 'gestaltung' } : { art: 'einstellungen' };
  const r = sprungZiel(ziel);
  const bekannt = (ziel.split(/[/?]/)[0] ?? '') in BEREICH_MODUL;
  if (r.art === 'formular' && bekannt && FORMULAR_FERTIG.has(r.modul)) return r;
  const [pfad] = ziel.split('?') as [string];
  const [bereich, id] = pfad.split('/') as [string, string | undefined];
  const g = GEFUEHRT_ZIEL[`${bereich}/${id ?? ''}`] ?? GEFUEHRT_ZIEL[bereich];
  if (g) return { art: 'gefuehrt', etappe: g[0], seite: g[1], eintrag: id && !GEFUEHRT_ZIEL[`${bereich}/${id}`] ? id : undefined };
  return r;
}
