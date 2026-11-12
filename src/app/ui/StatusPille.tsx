// StatusPille (V-07, V-15, Designsystem AIMS Nachtblau): der eine Baustein für Status, Ampel, Schwere, Entscheid und Etikett.
// Wort in der Statusfarbe auf deckendem Grund (--status-<art>-pille), dazu eine Form je Art: gut Kreis, warnung Dreieck,
// kritisch Raute, info Quadrat, neutral gestrichelter Kreis. Farbe trägt nie allein (immer Wort und Form).
import type { ComponentChildren, JSX } from 'preact';

export type StatusArt = 'gut' | 'warnung' | 'kritisch' | 'info' | 'neutral';

/** Entscheid ja / offen / nein, Grad ganz / teilweise / nicht, Stärke hoch / mittel / tief als Statusart */
export const ENTSCHEID_ART: Record<string, StatusArt> = { ja: 'gut', offen: 'warnung', nein: 'kritisch' };
export const GRAD_ART: Record<string, StatusArt> = { ganz: 'gut', teilweise: 'warnung', nicht: 'kritisch' };
export const STAERKE_ART: Record<string, StatusArt> = { hoch: 'gut', mittel: 'warnung', tief: 'neutral' };

type Eigenschaften = Omit<JSX.HTMLAttributes<HTMLElement>, 'class' | 'className' | 'children'> & {
  art: StatusArt;
  /** Element: span (Standard) oder button, z. B. der Stichtag im Seitenkopf mit Popover (V-20) */
  als?: 'span' | 'button';
  /** grössere Pille, z. B. für die Bereitschaft der Prüfung */
  gross?: boolean;
  /** abweichende Form: «aufbau» (noch im Aufbau, gestrichelt), «reife» (Füllgrad 0 bis 4, Wert in data-reife) */
  form?: 'aufbau' | 'reife';
  /** zusätzliche Klasse für Anordnung oder Tests, nie für Farben */
  klasse?: string;
  children?: ComponentChildren;
};

export function StatusPille({ art, gross, form, klasse, als = 'span', children, ...rest }: Eigenschaften) {
  const c = ['pille', `pille--${art}`, gross ? 'pille--gross' : '', form ? `pille--${form}` : '', klasse ?? ''].filter(Boolean).join(' ');
  if (als === 'button') return <button type="button" {...(rest as JSX.HTMLAttributes<HTMLButtonElement>)} class={c}>{children}</button>;
  return <span {...(rest as JSX.HTMLAttributes<HTMLSpanElement>)} class={c}>{children}</span>;
}
