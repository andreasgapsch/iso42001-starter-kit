// Text mit einfacher Auszeichnung: **fett**, [[g:begriff]] bzw. [[g:begriff|Anzeige]] als Glossar-Tooltip,
// Leerzeilen als Absätze. Kein innerHTML: alles wird als Text gesetzt (Eingaben bleiben escaped).
import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { inhalt } from '../i18n.ts';

export function GlossarBegriff({ schluessel, anzeige }: { schluessel: string; anzeige?: string }) {
  const [offen, setOffen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const begriff = inhalt(`glossar.${schluessel}.begriff`);
  // Die Kurzerklärung (höchstens 20 Wörter, AF-135) hat Vorrang; Begriffe ohne `kurz` zeigen die ausführliche Erklärung
  const erklaerung = inhalt(`glossar.${schluessel}.kurz`) ?? inhalt(`glossar.${schluessel}.erklaerung`);
  useEffect(() => {
    if (!offen) return;
    const zu = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOffen(false);
    };
    document.addEventListener('keydown', zu);
    document.addEventListener('pointerdown', zu);
    return () => {
      document.removeEventListener('keydown', zu);
      document.removeEventListener('pointerdown', zu);
    };
  }, [offen]);
  const text = anzeige ?? begriff ?? schluessel;
  if (!erklaerung) return <>{text}</>;
  return (
    <span ref={ref} class="glossar-wrap" onMouseLeave={() => setOffen(false)}>
      {/* Span mit Rolle button statt <button> (U-33): ein Knopf ist ein unteilbares Element, der Zeilenumbruch fiel dann
          zwischen «(» und den Begriff. Enter und Leertaste wie bei einem Knopf. */}
      <span role="button" tabIndex={0} class="glossar" aria-expanded={offen} aria-describedby={offen ? id : undefined} onClick={() => setOffen(!offen)} onMouseEnter={() => setOffen(true)} onFocus={() => setOffen(true)} onBlur={() => setOffen(false)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOffen(!offen); } }}>
        {text}
      </span>
      {offen && (
        <span role="tooltip" id={id} class="tooltip">
          <strong>{begriff}</strong>
          <br />
          {erklaerung}
        </span>
      )}
    </span>
  );
}

const MUSTER = /\*\*(.+?)\*\*|\[\[g:([\w-]+)(?:\|([^\]]+))?\]\]|\[\[(.+?)\]\]/g;

export function inline(text: string): ComponentChildren[] {
  const r: ComponentChildren[] = [];
  let pos = 0;
  let n = 0;
  for (const m of text.matchAll(MUSTER)) {
    if (m.index! > pos) r.push(text.slice(pos, m.index));
    if (m[1] !== undefined) r.push(<strong key={n++}>{m[1]}</strong>);
    else if (m[2] !== undefined) r.push(<GlossarBegriff key={n++} schluessel={m[2]} anzeige={m[3]} />);
    else r.push(<span key={n++} class="ph">{m[4]}</span>);
    pos = m.index! + m[0].length;
  }
  if (pos < text.length) r.push(text.slice(pos));
  return r;
}

export function RichText({ text, als = 'p' }: { text: string | undefined; als?: 'p' | 'span' }) {
  if (!text) return null;
  if (als === 'span') return <span>{inline(text)}</span>;
  return (
    <>
      {text.split(/\n\s*\n/).map((a, i) => (
        <p key={i}>{inline(a.replace(/\s*\n\s*/g, ' '))}</p>
      ))}
    </>
  );
}
