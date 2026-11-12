// Hinweis (V-07, Designsystem AIMS Nachtblau): eine Komponente mit vier Arten. info (Kreis), warnung (Dreieck), fehler (Raute)
// und ok (Kreis in gut); Rand und Grund aus den Statusfarben, die Form steht vor dem Text. Fehler und Warnungen, die eine
// Handlung verlangen, erhalten role="alert" vom Aufrufer.
import type { ComponentChildren, JSX, Ref } from 'preact';

export type HinweisArt = 'info' | 'warnung' | 'fehler' | 'ok';
export const HINWEIS_ARTEN: readonly HinweisArt[] = ['info', 'warnung', 'fehler', 'ok'];

type Eigenschaften = Omit<JSX.HTMLAttributes<HTMLDivElement>, 'class' | 'className' | 'children' | 'ref'> & {
  art?: HinweisArt;
  klasse?: string;
  /** Element: p für einen Satz, div für mehrere Absätze, Listen oder Knöpfe, li in einer Liste, section mit Überschrift */
  als?: 'p' | 'div' | 'li' | 'section';
  innen?: Ref<HTMLDivElement & HTMLParagraphElement>;
  children?: ComponentChildren;
};

export function Hinweis({ art = 'info', klasse, als = 'div', innen, children, ...rest }: Eigenschaften) {
  const c = ['hinweis', art === 'info' ? '' : art, klasse ?? ''].filter(Boolean).join(' ');
  const El = als as 'div';
  return <El {...rest} ref={innen} class={c}>{children}</El>;
}
