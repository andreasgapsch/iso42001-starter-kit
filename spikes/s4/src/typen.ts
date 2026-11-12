// Typen des Prototyps.
export interface Kataloge {
  version: string;
  branchen: string[];
  controls: { id: string; gruppe: string; titel: string }[];
}
