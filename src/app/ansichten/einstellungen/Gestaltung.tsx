// Einstellungen › Dokumentgestaltung (#/einstellungen/gestaltung): Logo, CI-Farben, Schrift, weitere Angaben, Vorschau mit
// Musterdokument und Gestaltungspaket. Eigenständige Komponente, damit sie beim Umbau «Kit als Applikation» nur umgehängt
// wird. Kurzform für das Startinterview (Seitentyp «gestaltung», E0-gestaltung) und Zeile für Dokumente › Erzeugen.
import { Symbol } from '../../rahmen/symbole.tsx';
import { fehlerVerstaendlich } from '../../worker/fehlertext.ts';
import { liesTextBegrenzt } from '../../../eingang/lesen.ts';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { logoForm } from '../../../generator/bild.ts';
import { hexNormal, kontrast, type Fehlsicht } from '../../../generator/farbe.ts';
import { firmennameZeigen, schriften } from '../../../generator/gestaltung.ts';
import { palette, ROLLE, type FarbHinweis } from '../../../generator/palette.ts';
import { pngAusDataUrl } from '../../../generator/png.ts';
import { holePfad, ersetze } from '../../../i18n/texte.ts';
import { paketDateiname, paketErstellen, paketLesen, logoBereinigen } from '../../../model/gestaltung.ts';
import type { Gestaltung, Projekt } from '../../../model/typen.ts';
import { appDaten } from '../../daten.ts';
import { pruefeProjektDaten } from '../../import/laden.ts';
import { t, zahlText } from '../../i18n.ts';
import { dateiLesen, logoAnalyse, LogoImportFehlerMeldung, type LogoImport, type VorlageImport } from '../../logik/logo.ts';
import { musterDocx, musterXlsx, type MusterTexte } from '../../logik/gestaltung-muster.ts';
import { routeZuHash } from '../../logik/routen.ts';
import { FehlsichtFilter, IrVorschau } from '../../ui/IrVorschau.tsx';
import { herunterladen, rendereIr } from '../../worker/client.ts';
import { aendereMit, melde } from '../../zustand/store.ts';
import { Auswahl } from '../../ui/Auswahl.tsx';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { bestaetigen } from '../../zustand/bestaetigen.ts';
import { Hinweis } from '../../ui/Hinweis.tsx';
import { zweiterKlick } from '../../ui/beschaeftigt.ts';

type FarbSchluessel = 'primaer' | 'sekundaer' | 'akzent';
const FARBEN: FarbSchluessel[] = ['primaer', 'sekundaer', 'akzent'];
const PAARE = ['arial-cambria', 'arial', 'calibri', 'aptos', 'georgia', 'verdana', 'eigen'] as const;

/** Leere Werte und leere Unterobjekte entfernen; ganz leer: undefined (Dokumente im Kit-Design) */
export function aufraeumen(g: Gestaltung): Gestaltung | undefined {
  const sauber = (o: Record<string, unknown>): Record<string, unknown> | undefined => {
    const r: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (v === undefined || v === null || v === '') continue;
      if (typeof v === 'object' && !Array.isArray(v)) {
        const u = sauber(v as Record<string, unknown>);
        if (u) r[k] = u;
      } else r[k] = v;
    }
    return Object.keys(r).length ? r : undefined;
  };
  return sauber(g as Record<string, unknown>) as Gestaltung | undefined;
}

/** Gestaltung im Projekt ändern (eine Änderung, ein Eintrag «ungespeichert») */
function setze(f: (g: Gestaltung) => void): void {
  aendereMit((e) => {
    const g: Gestaltung = structuredClone(e.organisation.gestaltung ?? {});
    f(g);
    const r = aufraeumen(g);
    if (r) e.organisation.gestaltung = r;
    else delete e.organisation.gestaltung;
  });
}

function fehlerText(e: unknown): string {
  if (e instanceof LogoImportFehlerMeldung) return t(`gestaltung.logo.fehler.${e.art}`, { detail: e.art === 'svg-ungueltig' ? t(`gestaltung.logo.svg_code.${e.detail ?? 'aufbau'}`) : (e.detail ?? '') });
  return fehlerVerstaendlich(e);
}

/** Prüfung des gespeicherten Logos im Worker (Farbvorschläge, dunkler Grund, Höhe); neu bei jedem anderen Logo */
function useLogoAnalyse(g: Gestaltung | undefined) {
  const [a, setA] = useState<Awaited<ReturnType<typeof logoAnalyse>>>(undefined);
  const url = g?.logo?.png;
  useEffect(() => {
    setA(undefined);
    const png = pngAusDataUrl(url);
    if (!png) return;
    let gueltig = true;
    logoAnalyse(png).then((r) => gueltig && setA(r), () => undefined);
    return () => void (gueltig = false);
  }, [url]);
  return a;
}

/** Schrift auf diesem Rechner vorhanden? Breitenvergleich gegen zwei Ersatzschriften (Hinweis, kein Beweis) */
function schriftVorhanden(name: string): boolean | undefined {
  try {
    const c = document.createElement('canvas').getContext('2d');
    if (!c) return undefined;
    const probe = 'mmmmmmmmmmlliWWQ@#0123';
    return ['monospace', 'serif'].some((ersatz) => {
      c.font = `48px ${ersatz}`;
      const a = c.measureText(probe).width;
      c.font = `48px "${name.replace(/"/g, '')}", ${ersatz}`;
      return Math.abs(c.measureText(probe).width - a) > 0.5;
    });
  } catch {
    return undefined;
  }
}

function Farbfeld({ hex, titel }: { hex: string; titel?: string }) {
  return <span class="farbfeld" style={{ background: `#${hex}` }} title={titel} aria-hidden="true" />;
}

// Logo

function LogoBereich({ p, kurz }: { p: Projekt; kurz?: boolean }) {
  const g = p.organisation.gestaltung;
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweise, setHinweise] = useState<LogoImport['hinweise']>([]);
  const [vorlage, setVorlage] = useState<{ datei: string; v: VorlageImport } | null>(null);
  const [aktiv, setAktiv] = useState(false);
  const eingabe = useRef<HTMLInputElement>(null);
  const analyse = useLogoAnalyse(g);
  const dauerhaft: LogoImport['hinweise'] = analyse ? [...(analyse.dunkel ? (['dunkler-grund'] as const) : []), ...(analyse.hoehe < 120 ? (['klein'] as const) : [])] : [];
  const alle = [...new Set([...hinweise, ...dauerhaft])];

  const logoSetzen = (r: LogoImport) => {
    setze((x) => void (x.logo = { ...r.logo, ...(x.logo?.alt ? { alt: x.logo.alt } : {}) }));
    setHinweise(r.hinweise);
  };
  const lesen = async (datei: File | undefined) => {
    if (!datei) return;
    setLaeuft(true);
    setFehler(null);
    setVorlage(null);
    try {
      const r = await dateiLesen(datei);
      if (r.art === 'bild') {
        logoSetzen(r.ergebnis);
        melde(t('gestaltung.logo.uebernommen'), 'ok');
      } else {
        const v = r.ergebnis;
        if (!v.logo && !v.vorschlag.primaer && !v.vorschlag.schrift) throw new LogoImportFehlerMeldung('vorlage-ohne-logo');
        setVorlage({ datei: datei.name, v });
      }
    } catch (e) {
      setFehler(fehlerText(e));
    } finally {
      setLaeuft(false);
      if (eingabe.current) eingabe.current.value = '';
    }
  };
  const vorlageUebernehmen = () => {
    if (!vorlage) return;
    const { v } = vorlage;
    setze((x) => {
      if (v.logo) x.logo = v.logo.logo;
      x.farben = { ...x.farben };
      for (const k of FARBEN) if (v.vorschlag[k]) x.farben[k] = v.vorschlag[k];
      const s = v.vorschlag.schrift;
      if (s) {
        const titel = s.titel ?? s.text ?? '';
        const text = s.text ?? s.titel ?? '';
        // Sichere Paare erkennen (Calibri Light und Calibri ergeben «calibri»), sonst eigene Schrift ohne Bestätigung
        const sicher: ['calibri' | 'aptos' | 'georgia' | 'verdana' | 'arial', RegExp][] = [['calibri', /^calibri/i], ['aptos', /^aptos/i], ['georgia', /^georgia/i], ['verdana', /^verdana/i], ['arial', /^arial/i]];
        const paar = sicher.find(([, m]) => m.test(titel) && m.test(text))?.[0];
        if (/^arial/i.test(titel) && /^cambria/i.test(text)) x.schrift = { paar: 'arial-cambria' };
        else if (paar) x.schrift = { paar };
        else x.schrift = { paar: 'eigen', titel, text, installiertBestaetigt: false };
      }
    });
    if (v.logo) setHinweise(v.logo.hinweise);
    setVorlage(null);
    melde(t('gestaltung.vorlage.uebernommen'), 'ok');
  };
  const png = g?.logo?.png;
  const form = g?.logo ? logoForm(g.logo.breite, g.logo.hoehe) : undefined;
  const kb = png ? zahlText((pngAusDataUrl(png)?.length ?? 0) / 1024) : '0';
  const hoehe = g?.kopfzeile?.logoHoeheMm;
  return (
    <section class="karte" aria-labelledby="gestaltung-logo-titel">
      <h2 id="gestaltung-logo-titel">{t('gestaltung.logo.titel')}</h2>
      <p class="feldhilfe">{t('gestaltung.logo.hilfe')}</p>
      <div
        class={`ablegen${aktiv ? ' aktiv' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setAktiv(true);
        }}
        onDragLeave={() => setAktiv(false)}
        onDrop={(e) => {
          e.preventDefault();
          setAktiv(false);
          void lesen(e.dataTransfer?.files[0]);
        }}
      >
        <p>{t('gestaltung.logo.ablegen')}</p>
        <div class="leiste" style={{ justifyContent: 'center' }}>
          <input ref={eingabe} type="file" id="gestaltung-datei" class="nur-sr" tabIndex={-1} aria-label={t('gestaltung.logo.waehlen')} accept=".png,.jpg,.jpeg,.svg,.webp,.gif,.dotx,.docx,image/png,image/jpeg,image/svg+xml,image/webp,image/gif" onChange={(e) => void lesen(e.currentTarget.files?.[0])} />
          <button type="button" id="gestaltung-waehlen" disabled={laeuft} onClick={() => eingabe.current?.click()}>{t('gestaltung.logo.waehlen')}</button>
          {png && <button type="button" id="gestaltung-logo-entfernen" onClick={() => { setze((x) => void delete x.logo); setHinweise([]); }}>{t('gestaltung.logo.entfernen')}</button>}
        </div>
      </div>
      {laeuft && <p role="status">{t('gestaltung.logo.laedt')}</p>}
      {fehler && <Hinweis als="p" art="fehler" role="alert" id="gestaltung-logo-fehler">{fehler}</Hinweis>}
      {vorlage && <VorlageVorschlag datei={vorlage.datei} v={vorlage.v} uebernehmen={vorlageUebernehmen} verwerfen={() => setVorlage(null)} />}
      {png && g?.logo && (
        <div class="logo-feld" style={{ marginTop: '12px' }}>
          <div class="logo-bild"><img src={png} alt={t('gestaltung.logo.vorschau_alt')} id="gestaltung-logo-bild" /></div>
          <div>
            <p id="gestaltung-logo-info">{t('gestaltung.logo.info', { breite: g.logo.breite, hoehe: g.logo.hoehe, kb, form: t(`gestaltung.logo.form_${form}`) })}</p>
            {g.logo.quelle && <p class="zweitext">{t('gestaltung.logo.quelle', { datei: g.logo.quelle.dateiname })}</p>}
          </div>
        </div>
      )}
      {alle.length > 0 && (
        <ul id="gestaltung-logo-hinweise">
          {alle.map((h) => <li key={h} class={h === 'dunkler-grund' ? 'hinweis warnung' : undefined} data-hinweis={h}>{t(`gestaltung.logo.hinweis.${h}`)}</li>)}
        </ul>
      )}
      {png && !kurz && (
        <>
          <fieldset class="feld">
            <legend>{t('gestaltung.logo.position')}</legend>
            <div class="optionen kompakt">
              {(['links', 'rechts'] as const).map((w) => (
                <label key={w}>
                  <input type="radio" name="gestaltung-position" checked={(g?.kopfzeile?.logoPosition ?? 'rechts') === w} onChange={() => setze((x) => void (x.kopfzeile = { ...x.kopfzeile, logoPosition: w }))} />
                  <span>{t(`gestaltung.logo.${w}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div class="feld">
            <label class="check">
              <input type="checkbox" id="gestaltung-name-zeigen" checked={firmennameZeigen(g)} onChange={(e) => {
                const an = e.currentTarget.checked;
                // Standard nach Art des Logos (Wortmarke: kein Name daneben); eine abweichende Wahl wird gespeichert
                setze((x) => void (x.kopfzeile = { ...x.kopfzeile, firmennameZeigen: an === firmennameZeigen({ logo: x.logo }) ? undefined : an }));
              }} />
              <span>{t('gestaltung.logo.name_zeigen')}</span>
            </label>
            <p class="feldhilfe">{t('gestaltung.logo.name_zeigen_hilfe')}</p>
          </div>
          <div class="feld">
            <label for="gestaltung-hoehe">{t('gestaltung.logo.hoehe', { mm: hoehe === undefined ? t('gestaltung.logo.hoehe_auto') : zahlText(hoehe) })}</label>
            <Auswahl id="gestaltung-hoehe" class="schmal" value={hoehe === undefined ? '' : String(hoehe)} onChange={(e) => {
              const v = e.currentTarget.value;
              setze((x) => void (x.kopfzeile = { ...x.kopfzeile, logoHoeheMm: v === '' ? undefined : Number(v) }));
            }}>
              <option value="">{t('gestaltung.logo.hoehe_auto')}</option>
              {[6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((mm) => <option key={mm} value={String(mm)}>{mm} mm</option>)}
            </Auswahl>
            <p class="feldhilfe">{t('gestaltung.logo.hoehe_hilfe')}</p>
          </div>
          <div class="feld">
            <label for="gestaltung-alt">{t('gestaltung.logo.alt')}</label>
            <input id="gestaltung-alt" type="text" maxLength={120} value={g?.logo?.alt ?? ''} onChange={(e) => {
              const v = e.currentTarget.value.trim();
              setze((x) => void (x.logo && (x.logo.alt = v || undefined)));
            }} />
            <p class="feldhilfe">{t('gestaltung.logo.alt_hilfe', { firma: p.organisation.name })}</p>
          </div>
        </>
      )}
    </section>
  );
}

function VorlageVorschlag({ datei, v, uebernehmen, verwerfen }: { datei: string; v: VorlageImport; uebernehmen: () => void; verwerfen: () => void }) {
  const s = v.vorschlag;
  return (
    <Hinweis id="gestaltung-vorlage" style={{ marginTop: '12px' }}>
      <p><strong>{t('gestaltung.vorlage.titel')}</strong></p>
      <p>{t('gestaltung.vorlage.text', { datei })}</p>
      {s.farben.length > 0 && (
        <p>
          {t('gestaltung.vorlage.farben', { farben: '' })}
          {s.farben.map((f) => <span key={f.name} style={{ marginRight: '8px' }}><Farbfeld hex={f.hex} titel={f.name} /> #{f.hex}</span>)}
        </p>
      )}
      {s.schrift && <p>{t('gestaltung.vorlage.schriften', { titel: s.schrift.titel ?? '', text: s.schrift.text ?? '' })}</p>}
      {v.logo && <div class="logo-bild" style={{ display: 'inline-block' }}><img src={v.logo.logo.png} alt={t('gestaltung.logo.vorschau_alt')} /></div>}
      {s.logoNichtLesbar && <p>{t('gestaltung.vorlage.logo_nicht_lesbar', { format: s.logoNichtLesbar })}</p>}
      <div class="leiste" style={{ marginTop: '8px' }}>
        <button type="button" id="gestaltung-vorlage-uebernehmen" onClick={uebernehmen}>{t('gestaltung.vorlage.uebernehmen')}</button>
        <button type="button" onClick={verwerfen}>{t('gestaltung.vorlage.verwerfen')}</button>
      </div>
    </Hinweis>
  );
}

// Farben

function FarbEingabe({ g, k }: { g: Gestaltung | undefined; k: FarbSchluessel }) {
  const wert = g?.farben?.[k];
  const [text, setText] = useState(wert ? `#${wert}` : '');
  const [ungueltig, setUngueltig] = useState(false);
  useEffect(() => {
    setText(wert ? `#${wert}` : '');
    setUngueltig(false);
  }, [wert]);
  const setzeFarbe = (hex: string | undefined) => setze((x) => void (x.farben = { ...x.farben, [k]: hex }));
  const uebernehmen = (roh: string) => {
    if (roh.trim() === '') {
      setUngueltig(false);
      setzeFarbe(undefined);
      return;
    }
    const hex = hexNormal(roh);
    setUngueltig(!hex);
    if (hex) setzeFarbe(hex);
  };
  const id = `gestaltung-farbe-${k}`;
  return (
    <div class="feld">
      <label for={id}>{t(`gestaltung.farben.${k}`)}</label>
      <div class="farbe-zeile">
        <input id={id} type="text" inputMode="text" autoComplete="off" spellcheck={false} value={text} placeholder="#1C5D94" aria-invalid={ungueltig ? 'true' : undefined} aria-describedby={ungueltig ? `${id}-fehler` : undefined}
          onInput={(e) => setText(e.currentTarget.value)} onChange={(e) => uebernehmen(e.currentTarget.value)} />
        <input type="color" aria-label={t('gestaltung.farben.waehler', { farbe: t(`gestaltung.farben.${k}`) })} value={`#${(wert ?? '1C5D94').toLowerCase()}`} onChange={(e) => uebernehmen(e.currentTarget.value)} />
        {wert && <span class="zweitext">{t('gestaltung.farben.kontrast', { wert: zahlText(kontrast(wert, 'FFFFFF'), 2) })}</span>}
        {wert && <button type="button" class="klein leise" onClick={() => setzeFarbe(undefined)}>{t('gestaltung.farben.leeren')}</button>}
      </div>
      {ungueltig && <Hinweis als="p" art="fehler" role="alert" id={`${id}-fehler`}>{t('gestaltung.farben.ungueltig')}</Hinweis>}
    </div>
  );
}

function hinweisText(h: FarbHinweis): string {
  const quelle = t(`gestaltung.farben.quelle_${h.quelle}`);
  if (h.art === 'korrigiert') return t(`gestaltung.farben.korrigiert_${h.wofuer}`, { quelle, original: `#${h.original}`, ersatz: `#${h.ersatz}`, kontrast: zahlText(h.kontrast, 2) });
  if (h.art === 'nahe-status') {
    const sicht = h.sicht === 'normal' ? '' : t('gestaltung.farben.nahe_sicht', { sicht: t(`gestaltung.farben.sicht.${h.sicht}`) });
    return t('gestaltung.farben.nahe_status', { quelle, status: t(`gestaltung.farben.status.${h.status}`), sicht });
  }
  return t('gestaltung.farben.reihe_ersetzt', { reihe: h.reihe, sicht: t(`gestaltung.farben.sicht.${h.sicht}`) });
}

function FarbBereich({ p }: { p: Projekt }) {
  const g = p.organisation.gestaltung;
  const [zeigen, setZeigen] = useState(false);
  const analyse = useLogoAnalyse(g);
  const vorschlaege = zeigen && analyse ? analyse.vorschlaege : null;
  const pal = useMemo(() => palette(g?.farben), [JSON.stringify(g?.farben ?? {})]);
  const f = g?.farben;
  const schalter = (k: 'ueberschriften' | 'tabellenkopf' | 'diagramme' | 'tabellenkopfKraeftig', standard: boolean) => (
    <label class="check" key={k}>
      <input type="checkbox" id={`gestaltung-${k}`} checked={f?.[k] ?? standard} onChange={(e) => {
        const an = e.currentTarget.checked;
        setze((x) => void (x.farben = { ...x.farben, [k]: an === standard ? undefined : an }));
      }} />
      <span>{t(`gestaltung.farben.${k === 'tabellenkopfKraeftig' ? 'kraeftig' : k}`)}</span>
    </label>
  );
  const vorschlagen = () => setZeigen(true);
  return (
    <section class="karte" aria-labelledby="gestaltung-farben-titel">
      <h2 id="gestaltung-farben-titel">{t('gestaltung.farben.titel')}</h2>
      <p class="feldhilfe">{t('gestaltung.farben.hilfe')}</p>
      {FARBEN.map((k) => <FarbEingabe key={k} g={g} k={k} />)}
      {g?.logo && <button type="button" id="gestaltung-vorschlagen" onClick={vorschlagen}>{t('gestaltung.farben.vorschlagen')}</button>}
      {vorschlaege && (vorschlaege.length === 0 ? <p class="zweitext">{t('gestaltung.farben.keine_vorschlaege')}</p> : (
        <div id="gestaltung-vorschlaege">
          <p>{t('gestaltung.farben.vorschlaege')}</p>
          <ul class="farb-vorschlaege" style={{ listStyle: 'none', padding: 0 }}>
            {vorschlaege.map((hex) => (
              <li key={hex} class="leiste">
                <Farbfeld hex={hex} /> <code>#{hex}</code>
                {FARBEN.map((k) => (
                  <button type="button" class="klein" key={k} aria-label={`#${hex}: ${t(`gestaltung.farben.${k}`)}`} onClick={() => setze((x) => void (x.farben = { ...x.farben, [k]: hex }))}>{t(`gestaltung.farben.${k}`)}</button>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {pal.hinweise.length > 0 && (
        <ul id="gestaltung-farb-hinweise">
          {pal.hinweise.map((h, i) => (
            <Hinweis als="li" art="warnung" key={i} data-art={h.art}>
              {h.art === 'korrigiert' && <><Farbfeld hex={h.original} /> <Symbol name="pfeil-rechts" klasse="sym sym-text" /> <Farbfeld hex={h.ersatz} />{' '}</>}
              {hinweisText(h)}
            </Hinweis>
          ))}
        </ul>
      )}
      <p class="zweitext" id="gestaltung-semantisch">{t('gestaltung.farben.semantisch')}</p>
      {f?.primaer && (
        <fieldset class="feld">
          <legend>{t('gestaltung.farben.wo')}</legend>
          {schalter('ueberschriften', true)}
          {schalter('tabellenkopf', true)}
          {f.tabellenkopf !== false && schalter('tabellenkopfKraeftig', false)}
          {schalter('diagramme', true)}
        </fieldset>
      )}
    </section>
  );
}

// Schrift

function SchriftBereich({ p }: { p: Projekt }) {
  const s = p.organisation.gestaltung?.schrift;
  const paar = s?.paar ?? 'arial-cambria';
  const wirksam = schriften(s);
  const namen = [...new Set([wirksam.titel, wirksam.text, ...(paar === 'eigen' ? [s?.titel, s?.text].filter((x): x is string => !!x) : [])])];
  return (
    <section class="karte" aria-labelledby="gestaltung-schrift-titel">
      <h2 id="gestaltung-schrift-titel">{t('gestaltung.schrift.titel')}</h2>
      <p class="feldhilfe">{t('gestaltung.schrift.hilfe')}</p>
      <div class="feld">
        <label for="gestaltung-paar">{t('gestaltung.schrift.paar')}</label>
        <Auswahl id="gestaltung-paar" value={paar} onChange={(e) => {
          const v = e.currentTarget.value as (typeof PAARE)[number];
          setze((x) => void (x.schrift = v === 'arial-cambria' ? undefined : { ...(v === 'eigen' ? x.schrift : {}), paar: v }));
        }}>
          {PAARE.map((k) => <option key={k} value={k}>{t(`gestaltung.schrift.paare.${k}`)}</option>)}
        </Auswahl>
      </div>
      {paar === 'eigen' && (
        <>
          {(['titel', 'text'] as const).map((k) => (
            <div class="feld" key={k}>
              <label for={`gestaltung-schrift-${k}`}>{t(`gestaltung.schrift.eigen_${k}`)}</label>
              <input id={`gestaltung-schrift-${k}`} type="text" maxLength={60} value={s?.[k] ?? ''} onChange={(e) => {
                const v = e.currentTarget.value.replace(/[;,"<>]/g, '').trim();
                setze((x) => void (x.schrift = { ...x.schrift, paar: 'eigen', [k]: v || undefined }));
              }} />
            </div>
          ))}
          <label class="check">
            <input type="checkbox" id="gestaltung-schrift-bestaetigt" checked={s?.installiertBestaetigt === true} onChange={(e) => {
              const an = e.currentTarget.checked;
              setze((x) => void (x.schrift = { ...x.schrift, paar: 'eigen', installiertBestaetigt: an || undefined }));
            }} />
            <span>{t('gestaltung.schrift.bestaetigung')}</span>
          </label>
          {!s?.installiertBestaetigt && <Hinweis als="p" art="warnung">{t('gestaltung.schrift.ohne_bestaetigung')}</Hinweis>}
        </>
      )}
      <ul class="zweitext" id="gestaltung-schrift-vorhanden">
        {namen.map((n) => {
          const da = schriftVorhanden(n);
          return da === undefined ? null : <li key={n}>{t(da ? 'gestaltung.schrift.vorhanden' : 'gestaltung.schrift.fehlt', { schrift: n })}</li>;
        })}
      </ul>
    </section>
  );
}

// Weitere Angaben

function WeitereBereich({ p }: { p: Projekt }) {
  const g = p.organisation.gestaltung;
  const [praefix, setPraefix] = useState(g?.kennungPraefix ?? '');
  const praefixOk = /^[A-Za-z0-9._-]{0,12}$/.test(praefix);
  useEffect(() => setPraefix(g?.kennungPraefix ?? ''), [g?.kennungPraefix]);
  const text = (k: 'kurzname' | 'fusszeileZusatz', max: number, id: string, label: string, hilfe: string) => (
    <div class="feld">
      <label for={id}>{t(label)}</label>
      <input id={id} type="text" maxLength={max} value={g?.[k] ?? ''} aria-describedby={`${id}-hilfe`} onChange={(e) => {
        const v = e.currentTarget.value.replace(/[\r\n]+/g, ' ').trim();
        setze((x) => void (x[k] = v || undefined));
      }} />
      <p class="feldhilfe" id={`${id}-hilfe`}>{t(hilfe)}</p>
    </div>
  );
  return (
    <section class="karte" aria-labelledby="gestaltung-weitere-titel">
      <h2 id="gestaltung-weitere-titel">{t('gestaltung.weitere.titel')}</h2>
      {text('kurzname', 30, 'gestaltung-kurzname', 'gestaltung.weitere.kurzname', 'gestaltung.weitere.kurzname_hilfe')}
      {text('fusszeileZusatz', 160, 'gestaltung-zusatz', 'gestaltung.weitere.zusatz', 'gestaltung.weitere.zusatz_hilfe')}
      <div class="feld">
        <label for="gestaltung-titelseite">{t('gestaltung.weitere.titelseite')}</label>
        <Auswahl id="gestaltung-titelseite" value={g?.titelseite ?? 'keine'} onChange={(e) => {
          const v = e.currentTarget.value as NonNullable<Gestaltung['titelseite']>;
          setze((x) => void (x.titelseite = v === 'keine' ? undefined : v));
        }}>
          {(['keine', 'grundlagen', 'alle'] as const).map((k) => <option key={k} value={k}>{t(`gestaltung.weitere.titelseite_${k}`)}</option>)}
        </Auswahl>
      </div>
      <div class="feld">
        <label class="check">
          <input type="checkbox" id="gestaltung-wasserzeichen" checked={g?.wasserzeichenEntwurf !== false} onChange={(e) => {
            const an = e.currentTarget.checked;
            setze((x) => void (x.wasserzeichenEntwurf = an ? undefined : false));
          }} />
          <span>{t('gestaltung.weitere.wasserzeichen')}</span>
        </label>
        <p class="feldhilfe">{t('gestaltung.weitere.wasserzeichen_hilfe')}</p>
      </div>
      <div class="feld">
        <label for="gestaltung-praefix">{t('gestaltung.weitere.praefix')}</label>
        <input id="gestaltung-praefix" type="text" class="schmal" maxLength={12} value={praefix} aria-invalid={praefixOk ? undefined : 'true'} aria-describedby="gestaltung-praefix-hilfe"
          onInput={(e) => setPraefix(e.currentTarget.value)} onChange={(e) => {
            const v = e.currentTarget.value.trim();
            if (/^[A-Za-z0-9._-]{0,12}$/.test(v)) setze((x) => void (x.kennungPraefix = v || undefined));
          }} />
        {!praefixOk && <Hinweis als="p" art="fehler" role="alert">{t('gestaltung.weitere.praefix_ungueltig')}</Hinweis>}
        <p class="feldhilfe" id="gestaltung-praefix-hilfe">{t('gestaltung.weitere.praefix_hilfe')}</p>
        <label class="check">
          <input type="checkbox" id="gestaltung-praefix-dateien" checked={g?.kennungPraefixDateien === true} disabled={!g?.kennungPraefix} aria-describedby="gestaltung-praefix-dateien-hilfe" onChange={(e) => {
            const an = e.currentTarget.checked;
            setze((x) => void (x.kennungPraefixDateien = an || undefined));
          }} />
          <span>{t('gestaltung.weitere.praefix_dateien')}</span>
        </label>
        <p class="feldhilfe" id="gestaltung-praefix-dateien-hilfe">{t('gestaltung.weitere.praefix_dateien_hilfe')}</p>
      </div>
    </section>
  );
}

// Vorschau

/** Texte des Musterdokuments in der Dokumentsprache */
export function musterTexte(p: Projekt): MusterTexte {
  const s = p.meta.dokumentSprache;
  const tx = appDaten().texte[s];
  const roh = holePfad(tx, 'app.gestaltung.muster') as Omit<MusterTexte, 'fusszeile' | 'status'>;
  const text = (k: string, w?: Record<string, string>) => {
    const v = holePfad(tx, k);
    return typeof v === 'string' ? ersetze(v, w) : k;
  };
  return {
    ...roh,
    fusszeile: text('allgemein.fusszeile', { klassifikation: roh.klassifikation }),
    status: text('allgemein.lenkung.nicht_freigegeben', { status: text('gefuehrt.optionen.dokumentStatus.entwurf') }),
  };
}

function VorschauBereich({ p }: { p: Projekt }) {
  const [fehlsicht, setFehlsicht] = useState<Fehlsicht | ''>('');
  const [laeuft, setLaeuft] = useState(false);
  const texte = musterTexte(p);
  const ir = useMemo(() => musterDocx(p, p.meta.dokumentSprache, texte), [p.organisation.gestaltung, p.organisation.name, p.meta.dokumentSprache]);
  const sperre = useRef(false);
  const laden = async (art: 'docx' | 'xlsx') => {
    if (sperre.current) return;
    sperre.current = true;
    setLaeuft(true);
    try {
      const muster = art === 'docx' ? ir : musterXlsx(p, p.meta.dokumentSprache, texte);
      const name = `${paketDateiname(p.organisation.gestaltung ?? {}, p.organisation.name).replace(/-gestaltung\.json$/, '')}-Muster.${art}`;
      const r = await rendereIr(muster, name);
      herunterladen(r.daten, r.name, art === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (e) {
      melde(fehlerVerstaendlich(e), 'fehler');
    } finally {
      sperre.current = false;
      setLaeuft(false);
    }
  };
  return (
    <section class="karte gestaltung-vorschau" aria-labelledby="gestaltung-vorschau-titel">
      <h2 id="gestaltung-vorschau-titel">{t('gestaltung.vorschau.titel')}</h2>
      <p class="feldhilfe">{t('gestaltung.vorschau.hilfe')}</p>
      <div class="leiste" style={{ marginBottom: '12px' }}>
        <label for="gestaltung-fehlsicht">{t('gestaltung.vorschau.fehlsicht')}</label>
        <Auswahl id="gestaltung-fehlsicht" class="schmal" value={fehlsicht} onChange={(e) => setFehlsicht(e.currentTarget.value as Fehlsicht | '')}>
          <option value="">{t('gestaltung.vorschau.fehlsicht_keine')}</option>
          {(['protanopie', 'deuteranopie', 'tritanopie'] as const).map((f) => <option key={f} value={f}>{t(`gestaltung.farben.sicht.${f}`)}</option>)}
        </Auswahl>
      </div>
      <FehlsichtFilter />
      <div id="gestaltung-muster">
        <IrVorschau ir={ir} fehlsicht={fehlsicht || undefined} />
      </div>
      <p class="zweitext" style={{ marginTop: '8px' }}>
        {t('gestaltung.vorschau.semantisch')}{' '}
        {(['risiko-tief', 'risiko-mittel', 'risiko-hoch', 'status-gut', 'status-warnung', 'status-kritisch'] as const).map((r) => (
          <span key={r} style={{ marginRight: '8px' }}><Farbfeld hex={r.startsWith('risiko') ? ROLLE[r].fill : ROLLE[r].linie} titel={r} /></span>
        ))}
      </p>
      <div class="leiste">
        <button type="button" id="gestaltung-muster-word" disabled={laeuft} onClick={(ev) => !zweiterKlick(ev) && void laden('docx')}>{t('gestaltung.vorschau.word')}</button>
        <button type="button" id="gestaltung-muster-excel" disabled={laeuft} onClick={(ev) => !zweiterKlick(ev) && void laden('xlsx')}>{t('gestaltung.vorschau.excel')}</button>
      </div>
    </section>
  );
}

// Paket

function PaketBereich({ p }: { p: Projekt }) {
  const g = p.organisation.gestaltung;
  const eingabe = useRef<HTMLInputElement>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const exportieren = () => {
    if (!g) return;
    herunterladen(`${JSON.stringify(paketErstellen(g), null, 2)}\n`, paketDateiname(g, p.organisation.name), 'application/json');
  };
  const importieren = async (datei: File | undefined) => {
    if (!datei) return;
    setFehler(null);
    let text: string;
    try {
      // Eingangsmodul: Grösse vor dem Lesen (AF-018)
      text = await liesTextBegrenzt(datei, 'gestaltungspaket');
    } catch (e) {
      if (eingabe.current) eingabe.current.value = '';
      setFehler(fehlerVerstaendlich(e));
      return;
    }
    const r = paketLesen(text);
    if (eingabe.current) eingabe.current.value = '';
    if (!r.ok) {
      setFehler(t('gestaltung.logo.fehler.paket', { grund: t(`gestaltung.paket.grund.${r.grund}`) }));
      return;
    }
    // Logo wie beim Hochladen bereinigen: Pakete stammen von Dritten, Skripte und externe Bezüge dürfen nicht in die Dokumente
    const logoHinweis = logoBereinigen(r.gestaltung);
    // Prüfung mit dem Schema der Projektdatei: Gestaltung ins offene Projekt einsetzen und prüfen
    const probe = structuredClone(p);
    probe.organisation.gestaltung = r.gestaltung;
    if (!pruefeProjektDaten(probe).ok) {
      setFehler(t('gestaltung.logo.fehler.paket', { grund: t('gestaltung.paket.grund.schema') }));
      return;
    }
    aendereMit((e) => void (e.organisation.gestaltung = r.gestaltung));
    melde(logoHinweis ? `${t('gestaltung.paket.importiert')} ${t('gestaltung.paket.logo_bereinigt')}` : t('gestaltung.paket.importiert'), 'ok');
  };
  return (
    <section class="karte" aria-labelledby="gestaltung-paket-titel">
      <h2 id="gestaltung-paket-titel">{t('gestaltung.paket.titel')}</h2>
      <p class="feldhilfe">{t('gestaltung.paket.hilfe')}</p>
      <input ref={eingabe} type="file" id="gestaltung-paket-datei" class="nur-sr" tabIndex={-1} aria-label={t('gestaltung.paket.importieren')} accept=".json,application/json" onChange={(e) => void importieren(e.currentTarget.files?.[0])} />
      <div class="leiste">
        <button type="button" id="gestaltung-exportieren" disabled={!g} onClick={(ev) => !zweiterKlick(ev) && exportieren()}>{t('gestaltung.paket.exportieren')}</button>
        <button type="button" id="gestaltung-importieren" onClick={() => eingabe.current?.click()}>{t('gestaltung.paket.importieren')}</button>
        <button type="button" id="gestaltung-zuruecksetzen" disabled={!g} onClick={async () => {
          if (!(await bestaetigen({ text: t('gestaltung.paket.zuruecksetzen_frage'), titel: t('bestaetigen.titel_gestaltung_entfernen'), ja: t('bestaetigen.gestaltung_entfernen'), gefahr: true }))) return;
          aendereMit((e) => void delete e.organisation.gestaltung);
          melde(t('gestaltung.paket.zurueckgesetzt'), 'ok');
        }}>{t('gestaltung.paket.zuruecksetzen')}</button>
      </div>
      {fehler && <Hinweis als="p" art="fehler" role="alert" id="gestaltung-paket-fehler">{fehler}</Hinweis>}
    </section>
  );
}

export function GestaltungSeite({ p }: { p: Projekt | null }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div class="inhalt">
      <Seitenkopf titel={t('gestaltung.titel')} titelRef={ref} speichernAlsAktion unter={<p class="kein-druck"><a href={routeZuHash({ art: 'einstellungen' })} id="gestaltung-zurueck"><Symbol name="pfeil-links" klasse="sym sym-text" /> {t('gestaltung.zurueck')}</a></p>} />
      {!p ? <Hinweis als="p">{t('gestaltung.ohne_projekt')}</Hinweis> : (
        <>
          <p>{t('gestaltung.einleitung')}</p>
          <div class="gestaltung-raster">
            <div>
              <LogoBereich p={p} />
              <FarbBereich p={p} />
              <SchriftBereich p={p} />
              <WeitereBereich p={p} />
              <PaketBereich p={p} />
            </div>
            <VorschauBereich p={p} />
          </div>
        </>
      )}
    </div>
  );
}

/** Kurzform im Startinterview (E0-gestaltung): Logo und Primärfarbe mit Vorschlag aus dem Logo */
export function GestaltungKurz({ p }: { p: Projekt }) {
  const g = p.organisation.gestaltung;
  const vorschlaege = useLogoAnalyse(g)?.vorschlaege ?? [];
  return (
    <div id="gestaltung-kurz">
      <p class="feldhilfe">{t('gestaltung.kurz.hilfe')}</p>
      <LogoBereich p={p} kurz />
      <section class="karte">
        <FarbEingabe g={g} k="primaer" />
        {vorschlaege.length > 0 && (
          <div class="farb-vorschlaege" id="gestaltung-vorschlaege">
            <span>{t('gestaltung.farben.vorschlaege')}</span>
            {vorschlaege.map((hex) => (
              <button type="button" class="klein" key={hex} aria-label={t('gestaltung.farben.vorschlag_setzen', { farbe: `#${hex}` })} onClick={() => setze((x) => void (x.farben = { ...x.farben, primaer: hex }))}>
                <Farbfeld hex={hex} /> #{hex}
              </button>
            ))}
          </div>
        )}
        {palette(g?.farben).hinweise.filter((h) => h.quelle === 'primaer').map((h, i) => <Hinweis als="p" art="warnung" key={i}>{hinweisText(h)}</Hinweis>)}
        <p class="zweitext">{t('gestaltung.farben.semantisch')}</p>
      </section>
      <p><a href={routeZuHash({ art: 'einstellungen', bereich: 'gestaltung' })} id="gestaltung-alle">{t('gestaltung.kurz.alle')}</a></p>
    </div>
  );
}

/** Zeile in Dokumente › Erzeugen: Stand der Gestaltung mit Link auf die Einstellungen (ein Ort je Sache) */
export function GestaltungStand({ p }: { p: Projekt }) {
  const g = p.organisation.gestaltung;
  const teile = [
    ...(g?.logo ? [t('gestaltung.stand_logo')] : []),
    ...(g?.farben?.primaer ? [t('gestaltung.stand_farben', { farbe: `#${g.farben.primaer}` })] : []),
    ...(g?.schrift?.paar && g.schrift.paar !== 'arial-cambria' ? [t('gestaltung.stand_schrift', { schrift: schriften(g.schrift).titel })] : []),
  ];
  return (
    <p class="zweitext" id="dok-gestaltung">
      {teile.length ? t('gestaltung.stand', { teile: teile.join(', ') }) : t('gestaltung.stand_keine')}
      {' · '}
      <a href={routeZuHash({ art: 'einstellungen', bereich: 'gestaltung' })}>{t('gestaltung.aendern')}</a>
    </p>
  );
}
