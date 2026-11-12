// Prototyp-Shell für Spike S4: Kopf, Etappenleiste, eine Formularseite, Generator im Worker.
import { render } from 'preact';
import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { erzeugeWorker, ladeKataloge } from '#einbettung';
import './stil.css';

performance.mark('skript-start');
const kataloge = await ladeKataloge();
performance.mark('kataloge-geladen');

const ETAPPEN = ['Start', 'Kontext', 'Führung', 'Planung', 'Unterstützung', 'Betrieb', 'Bewertung', 'Verbesserung'];
const etappe = signal(0);
const organisation = signal('');
const branche = signal(kataloge.branchen[0] ?? '');
const status = signal('bereit');
const thema = signal<'hell' | 'dunkel'>('hell');

function Kopf() {
  return (
    <header class="kopf">
      <strong>AIMS-Manager (Spike S4)</strong>
      <span class="namensnennung">ISO/IEC 42001 Starter-Kit von KMU-CIO</span>
      <button type="button" onClick={() => (thema.value = thema.value === 'hell' ? 'dunkel' : 'hell')}>
        Thema: {thema.value}
      </button>
    </header>
  );
}

function Etappenleiste() {
  return (
    <nav class="etappen" aria-label="Etappen">
      {ETAPPEN.map((t, i) => (
        <button type="button" key={t} aria-current={etappe.value === i ? 'step' : undefined} onClick={() => (etappe.value = i)}>
          {i + 1}. {t}
        </button>
      ))}
    </nav>
  );
}

async function dokumenteErzeugen(): Promise<void> {
  status.value = 'erzeuge';
  const t0 = performance.now();
  const w = erzeugeWorker();
  const antwort = await new Promise<{ ok: boolean; docx?: Uint8Array; xlsx?: Uint8Array; fehler?: string; ms?: number }>((ok) => {
    w.onmessage = (e) => ok(e.data);
    w.onerror = (e) => ok({ ok: false, fehler: e.message || 'Worker-Fehler' });
    w.postMessage({ controls: kataloge.controls });
  });
  w.terminate();
  const ms = Math.round(performance.now() - t0);
  const pk = (u?: Uint8Array) => (u && u[0] === 0x50 && u[1] === 0x4b ? u.length : -1);
  Object.assign(window, { s4Generator: { ok: antwort.ok, fehler: antwort.fehler, docx: pk(antwort.docx), xlsx: pk(antwort.xlsx), ms, workerMs: antwort.ms } });
  status.value = antwort.ok ? `fertig in ${ms} ms` : `Fehler: ${antwort.fehler}`;
}

function Formular() {
  useEffect(() => {
    // Nach dem ersten Zeichnen gilt die Seite als bedienbar.
    requestAnimationFrame(() =>
      setTimeout(() => {
        performance.mark('bedienbar');
        document.body.dataset['bedienbar'] = '1';
      }, 0),
    );
  }, []);
  return (
    <main class="seite">
      <h1>
        Etappe {etappe.value + 1}: {ETAPPEN[etappe.value]}
      </h1>
      <label>
        Organisation
        <input value={organisation.value} onInput={(e) => (organisation.value = e.currentTarget.value)} />
      </label>
      <label>
        Branche
        <select value={branche.value} onChange={(e) => (branche.value = e.currentTarget.value)}>
          {kataloge.branchen.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </label>
      <p>{kataloge.controls.length} Katalogeinträge geladen.</p>
      <p class="knoepfe">
        <button type="button" id="weiter" onClick={() => (etappe.value = Math.min(etappe.value + 1, ETAPPEN.length - 1))}>
          Weiter
        </button>
        <button type="button" id="erzeugen" onClick={() => void dokumenteErzeugen()}>
          Dokumente erzeugen
        </button>
      </p>
      <p id="status" role="status">
        {status.value}
      </p>
    </main>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.dataset['thema'] = thema.value;
  });
  return (
    <>
      <Kopf />
      <Etappenleiste />
      <Formular />
    </>
  );
}

render(<App />, document.getElementById('app')!);
