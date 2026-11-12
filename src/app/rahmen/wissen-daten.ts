// Zugriff auf die Daten des Bereichs Wissen (scripts/wissen.mts): Kapitelverzeichnis im Datenblock daten-app,
// Kapitelinhalte und Auszüge aus dem EU AI Act im komprimierten Block daten-wissen (erst beim ersten Zugriff entpackt).
import { appDaten } from '../daten.ts';
import { uiSprache } from '../i18n.ts';

export type Knoten = string | [string, Record<string, string> | 0, ...Knoten[]];

export interface KapitelInfo {
  id: string;
  titel: string;
  abschnitte: { id: string; titel: string }[];
}

export interface AiActAuszug {
  id: string;
  titel: string;
  umfang: string;
  seiten: string;
  quelle: string;
  fassung: string;
  hinweis: string;
  knoten: Knoten[];
}

export interface WissenDaten {
  kapitel?: Partial<Record<'de' | 'en', KapitelInfo[]>>;
  leitfaden?: Partial<Record<'de' | 'en', Record<string, Knoten[]>>>;
  aiact?: Partial<Record<'de' | 'en', AiActAuszug[]>>;
}

function daten(): WissenDaten {
  return (appDaten() as unknown as { wissen?: WissenDaten }).wissen ?? {};
}

export function wissenKapitel(): KapitelInfo[] {
  const k = daten().kapitel;
  return k?.[uiSprache.value] ?? k?.de ?? [];
}

export function kapitelInhalt(id: string): Knoten[] | null {
  const l = daten().leitfaden;
  return l?.[uiSprache.value]?.[id] ?? l?.de?.[id] ?? null;
}

export function aiActAuszuege(): AiActAuszug[] {
  const a = daten().aiact;
  return a?.[uiSprache.value] ?? a?.de ?? [];
}
