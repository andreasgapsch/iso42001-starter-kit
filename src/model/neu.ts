// Fabrik für ein neues, leeres Projekt.
import { SCHEMA_VERSION, type Projekt, type Sprache } from './typen.ts';
import { KIT_VERSION } from './version.ts';

export { KIT_VERSION };

/** Setzt in einer Projektdatei (JSON-Text) das Feld kitVersion auf KIT_VERSION, ohne die übrige Formatierung zu ändern. */
export function mitKitVersion(json: string, kitVersion: string = KIT_VERSION): string {
  return json.replace(/("kitVersion"\s*:\s*")[^"]*(")/, (_, a: string, b: string) => `${a}${kitVersion}${b}`);
}

function neueId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function leeresProjekt(optionen: { sprache?: Sprache; mitIsms?: boolean; modulAiAct?: boolean; jetzt?: string; projektId?: string } = {}): Projekt {
  const jetzt = optionen.jetzt ?? new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    kitVersion: KIT_VERSION,
    meta: {
      projektId: optionen.projektId ?? neueId(),
      erstellt: jetzt,
      geaendert: jetzt,
      dokumentSprache: optionen.sprache ?? 'de',
      mitIsms: optionen.mitIsms ?? false,
      ismsZertifiziert: false,
      modulAiAct: optionen.modulAiAct ?? false,
      gefuehrt: { aktuelleEtappe: 'E0', etappen: {}, antworten: {} },
      checklisten: {},
    },
    organisation: {
      name: '',
      branche: '',
      mitarbeitende: null,
      standorte: '',
      euBezug: {},
      kontext: { themen: [], klimawandelRelevant: 'offen', klimawandelBegruendung: '' },
      rollenIso: [],
      geltungsbereich: { beschreibung: '', grenzenOrganisation: '', grenzenTechnik: '', grenzenStandorte: '', schnittstellen: '', ausschluesse: [] },
      leitlinie: { version: '', grundsaetze: [], ausnahmeprozess: '' },
      risikokriterien: {
        zeitraum: '',
        wahrscheinlichkeit: [],
        auswirkung: [],
        akzeptanzBis: 4,
        unannehmbarAb: 12,
        ausIsmsUebernommen: false,
      },
    },
    personen: [],
    parteien: [],
    rollen: [],
    kiSysteme: [],
    risiken: [],
    folgenabschaetzungen: [],
    controls: [],
    eigeneControls: [],
    nachweise: [],
    dokumente: [],
    massnahmen: [],
    lieferanten: [],
    ziele: [],
    kompetenzen: [],
    kommunikation: [],
    audits: [],
    feststellungen: [],
    managementbewertungen: [],
  };
}
