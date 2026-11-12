// Globale Suche im Kopf (R6): Eingabefeld als Combobox, Treffer gruppiert in einer Liste (listbox mit Gruppen).
// Tastatur: «/» springt ins Feld, Pfeiltasten wählen, Eingabe öffnet, Escape schliesst.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { projekt } from '../zustand/store.ts';
import { suchen, type Suchgruppe } from './suche-quellen.ts';
import { standardQuellen } from './suche-standard.ts';
import { Symbol } from './symbole.tsx';
import { tr } from './text.ts';

export function Suche() {
  const [anfrage, setAnfrage] = useState('');
  const [offen, setOffen] = useState(false);
  const [aktiv, setAktiv] = useState(0);
  const feld = useRef<HTMLInputElement>(null);
  const huelle = useRef<HTMLDivElement>(null);
  standardQuellen();
  const p = projekt.value;
  const gruppen: Suchgruppe[] = useMemo(() => (offen ? suchen(anfrage, p) : []), [anfrage, p, offen]);
  const flach = gruppen.flatMap((g) => g.treffer.map((x) => ({ ...x, gruppe: g.id })));
  const anzahl = flach.length;
  // Auswahl nie hinter dem letzten Treffer (weniger Treffer nach neuer Eingabe; P20-Nacharbeit N10)
  const gewaehlt = anzahl ? Math.min(aktiv, anzahl - 1) : 0;
  // T5-O1: Auswahl im selben Ereignis wie die Eingabe zurücksetzen (nicht in einem Effekt nach dem Zeichnen), damit eine
  // schnelle Pfeiltaste direkt nach der Eingabe nicht verloren geht; Pfeiltasten rechnen mit dem jeweils aktuellen Stand
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const ziel = e.target as HTMLElement | null;
      if (ziel && (ziel.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ziel.tagName) || ziel.getAttribute('role') === 'combobox')) return;
      e.preventDefault();
      feld.current?.focus();
      feld.current?.select();
    };
    const klick = (e: MouseEvent) => {
      if (huelle.current && !huelle.current.contains(e.target as Node)) setOffen(false);
    };
    globalThis.addEventListener('keydown', taste);
    document.addEventListener('mousedown', klick);
    return () => {
      globalThis.removeEventListener('keydown', taste);
      document.removeEventListener('mousedown', klick);
    };
  }, []);
  const oeffne = (href: string) => {
    setOffen(false);
    setAnfrage('');
    setAktiv(0);
    globalThis.location.hash = href;
    feld.current?.blur();
  };
  const zeigen = offen && anfrage.trim().length >= 2;
  const taste = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' && anzahl) { e.preventDefault(); setOffen(true); setAktiv((a) => (a + 1) % anzahl); }
    else if (e.key === 'ArrowUp' && anzahl) { e.preventDefault(); setAktiv((a) => (a - 1 + anzahl) % anzahl); }
    else if (e.key === 'Home' && zeigen && anzahl) { e.preventDefault(); setAktiv(0); }
    else if (e.key === 'End' && zeigen && anzahl) { e.preventDefault(); setAktiv(anzahl - 1); }
    else if (e.key === 'Enter' && zeigen && flach[gewaehlt]) { e.preventDefault(); oeffne(flach[gewaehlt]!.href); }
    else if (e.key === 'Escape') {
      if (zeigen) { e.preventDefault(); e.stopPropagation(); setOffen(false); feld.current?.focus(); }
      else if (anfrage) { e.preventDefault(); setAnfrage(''); setAktiv(0); }
    }
  };
  let i = -1;
  return (
    <div class="suche kein-druck" ref={huelle} role="search">
      <label class="suche-feld">
        <Symbol name="suche" />
        <span class="nur-sr">{tr('suche.label')}</span>
        <input
          ref={feld} id="suche" type="search" autoComplete="off" spellcheck={false} placeholder={tr('suche.platzhalter')}
          role="combobox" aria-expanded={zeigen} aria-controls="suche-liste" aria-autocomplete="list"
          aria-activedescendant={zeigen && anzahl ? `suche-t-${gewaehlt}` : undefined} aria-describedby="suche-taste"
          value={anfrage}
          onInput={(e) => { setAnfrage(e.currentTarget.value); setAktiv(0); setOffen(true); }}
          onFocus={() => setOffen(true)}
          onKeyDown={taste}
        />
        <kbd class="taste" id="suche-taste" aria-label={tr('suche.taste')}>/</kbd>
      </label>
      {zeigen && (
        <div class="suche-ergebnis" id="suche-ergebnis">
          {/* Die Liste rollt bei vielen Treffern; tabIndex 0 macht sie auch ohne Maus erreichbar (Pfeiltasten wie im Feld) */}
          <div id="suche-liste" role="listbox" aria-label={tr('suche.ergebnisse')} tabIndex={0} onKeyDown={taste}>
            {gruppen.map((g) => (
              <div role="group" key={g.id} aria-labelledby={`suche-g-${g.id}`} class="suche-gruppe">
                <div class="suche-gruppe-titel" id={`suche-g-${g.id}`} role="presentation">{g.titel}</div>
                {g.treffer.map((x) => {
                  i++;
                  const nr = i;
                  return (
                    <div key={`${g.id}-${nr}`} id={`suche-t-${nr}`} role="option" aria-selected={nr === gewaehlt} class="suche-treffer"
                      onMouseDown={(e) => e.preventDefault()} onClick={() => oeffne(x.href)} onMouseEnter={() => setAktiv(nr)}>
                      <Symbol name={x.icon ?? 'rechts'} />
                      <span class="suche-text"><span class="suche-titel">{x.titel}</span>{x.unter && <span class="suche-unter">{x.unter}</span>}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p class="suche-status" role="status" aria-live="polite">{anzahl ? tr('suche.anzahl', { anzahl }) : tr('suche.keine')}</p>
        </div>
      )}
    </div>
  );
}
