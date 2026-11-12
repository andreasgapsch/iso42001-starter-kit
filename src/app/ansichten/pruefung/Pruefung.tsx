// Plausibilitätsprüfung: Ampel «bereit für Stage 1», Fehler und Hinweise mit Sprung zur Stelle, Stage-1-Bericht (Stage1Bericht.tsx).
import { useEffect, useRef } from 'preact/hooks';
import { datumText, inhalt, t, zahlText } from '../../i18n.ts';
import { gesamtFortschritt } from '../../logik/gefuehrt.ts';
import { ampel } from '../../logik/fortschritt.ts';
import type { Befund } from '../../logik/pruefung.ts';
import { gefuehrtSprung } from '../../logik/pruefsprung.ts';
import { routeZuHash, sprungRoute } from '../../logik/routen.ts';
import { befunde, bereitschaftStand, fehlerStand, navigiere, projekt, stichtag, umfeld } from '../../zustand/store.ts';
import { BEREITSCHAFT_REGELN, type Bereitschaft, type Luecke } from '../../logik/bereitschaft.ts';
import type { Route } from '../../logik/routen.ts';
import { bereichTitel, bereichVon } from '../../rahmen/bereiche.ts';
import type { FehlerDosiert } from '../../logik/fehler-dosiert.ts';
import { Stage1BerichtAnsicht, stage1Drucken } from './Stage1Bericht.tsx';
import { erstelleUebersetzer } from '../../../i18n/texte.ts';
import { appDaten } from '../../daten.ts';
import { uiSprache } from '../../i18n.ts';
import { stage1Bericht } from './stage1.ts';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { sprungMerken } from '../../rahmen/SprungLeiste.tsx';
import { Symbol } from '../../rahmen/symbole.tsx';
import { tr } from '../../rahmen/text.ts';
import { UI_TEXTE } from '../../logik/prozesse.ts';
import { rollenText } from '../../../prozesse/katalog.ts';
import { StatusPille, type StatusArt } from '../../ui/StatusPille.tsx';
import { Hinweis } from '../../ui/Hinweis.tsx';

export function befundText(b: Befund): { titel: string; erklaerung: string } {
  // F37 nennt Rollen in der Sprache der Oberfläche, F41 ein Datum im Format der Sprache (Runde 2b, Nacharbeit P11)
  const name = b.rollen?.length ? b.rollen.map((r) => rollenText(UI_TEXTE, r)).join(', ') : b.name || b.id || '';
  const werte = { name, fehlt: (b.fehlt ?? []).map((k) => t(`pruefung.fehlt_${k}`)).join(', ') || '…', datum: datumText(b.datum) || '…' };
  return {
    titel: inhalt(`regeln.${b.regel}.titel`, werte) ?? b.regel,
    erklaerung: inhalt(`regeln.${b.regel}.erklaerung`, werte) ?? '',
  };
}

/**
 * Ampel mit Zahlen. Für die Befunde des Projekts dosiert (U-07): Fehler aus Etappen, die noch kommen, erscheinen als
 * «offen»; ohne Fehler jetzt zeigt die Ampel neutral «im Aufbau» statt rot.
 */
export function AmpelAnzeige({ liste, dosiert = liste === befunde.value ? fehlerStand.value : undefined }: { liste: Befund[]; dosiert?: FehlerDosiert }) {
  const fehler = dosiert ? dosiert.jetzt.length : liste.filter((b) => b.schwere === 'fehler').length;
  const offen = dosiert?.spaeter.length ?? 0;
  // Bereitschaft des Projekts: Nie «Bereit», solange Etappen, Pflichtregister oder Freigaben fehlen (C-01)
  const bereit = liste === befunde.value ? bereitschaftStand.value : null;
  const a = ampelStufe(liste, fehler, offen, bereit);
  const hinweise = liste.filter((b) => b.schwere !== 'fehler').length;
  const luecken = bereit?.luecken.length ?? 0;
  return (
    <p>
      <StatusPille art={AMPEL_ART[a]} form={a === 'aufbau' ? 'aufbau' : undefined} gross role="status" data-bereitschaft={a}>{t(`pruefung.ampel.${a}`)}</StatusPille>{' '}
      <span class="zweitext ampel-zahlen">
        {t('pruefung.zahl_fehler', { anzahl: fehler })}{offen ? `, ${t('pruefung.zahl_offen', { anzahl: offen })}` : ''}, {t('pruefung.zahl_hinweise', { anzahl: hinweise })}{luecken ? `, ${t('pruefung.zahl_luecken', { anzahl: luecken })}` : ''}
      </span>
    </p>
  );
}

/** Statusart der Bereitschaft: Form und Wort zur Farbe */
const AMPEL_ART: Record<'aufbau' | 'rot' | 'gelb' | 'gruen', StatusArt> = { aufbau: 'info', rot: 'kritisch', gelb: 'warnung', gruen: 'gut' };

/** Stufe der Anzeige: «im Aufbau» nur, solange Fehler aus kommenden Etappen zurückgestellt sind; sonst Fehler und Lücken */
export function ampelStufe(liste: readonly Befund[], fehler: number, offen: number, bereit: Bereitschaft | null): 'aufbau' | 'rot' | 'gelb' | 'gruen' {
  if (offen && !fehler) return 'aufbau';
  return bereit ? bereit.stufe : ampel(liste);
}

/**
 * Erklärung der Bereitschaft wie in logik/bereitschaft.ts (V-12): rot bei Fehlern oder Lücken, gelb nur mit Hinweisen, die nicht
 * binden; die bindenden Hinweise kommen aus BEREITSCHAFT_REGELN.
 */
export function BereitschaftErklaerung() {
  const ausnahmen = new Intl.ListFormat(uiSprache.value === 'de' ? 'de-CH' : 'en-GB', { type: 'conjunction' }).format(BEREITSCHAFT_REGELN.map((r) => t(`pruefung.bindend_${r}`)));
  return <p class="zweitext" id="bereitschaft-erklaerung">{t('pruefung.bereitschaft_regel', { ausnahmen })}</p>;
}

/** Fortschritt zur Bereitschaft (V-17): erledigte Seiten des Guides; die Spur ist grün erst bei «Bereit für Stage 1» */
function BereitschaftSpur() {
  const p = projekt.value;
  if (!p) return null;
  const g = gesamtFortschritt(p, umfeld.value);
  const bereit = bereitschaftStand.value?.stufe === 'gruen';
  const prozent = g.gesamt ? Math.round((100 * g.erledigt) / g.gesamt) : 0;
  return (
    <div class="bereitschaft-spur">
      <div class="leiste"><span class="zweitext" id="bereitschaft-spur-text">{t('pruefung.spur', { erledigt: g.erledigt, gesamt: g.gesamt })}</span><span class="zweitext">{zahlText(prozent, 0)} %</span></div>
      <div class={`balken${bereit ? ' voll' : ''}`} role="progressbar" aria-labelledby="bereitschaft-spur-text" aria-valuemin={0} aria-valuemax={g.gesamt} aria-valuenow={g.erledigt}>
        <span style={{ width: `${prozent}%` }} />
      </div>
    </div>
  );
}

/** Ort eines Sprungziels in Worten (V-12): «Guide E8, Behandlung je Risiko», «Register, Risiken» */
export function ortVon(r: Route): string {
  if (r.art === 'gefuehrt' && r.etappe) {
    const seite = r.seite ? inhalt(`gefuehrt.${r.etappe}.${r.seite}.titel`) : undefined;
    return `${bereichTitel('guide')} ${r.etappe}, ${seite ?? inhalt(`gefuehrt.etappen.${r.etappe}.titel`) ?? ''}`.replace(/, $/, '');
  }
  if (r.art === 'formular' && r.modul !== 'uebersicht') return `${bereichTitel('register')}, ${t(`module.${r.modul}`)}`;
  return bereichTitel(bereichVon(r));
}

/** Was vor Stage 1 noch fehlt: je Lücke ein Satz und der Weg dorthin */
export function LueckenListe({ luecken }: { luecken: readonly Luecke[] }) {
  if (!luecken.length) return null;
  const titel = (e: string) => `${e} ${inhalt(`gefuehrt.etappen.${e}.titel`) ?? ''}`.trim();
  const ziel = (l: Luecke) => routeZuHash(l.art === 'regel' ? { art: 'gefuehrt', etappe: l.id === 'H88' ? 'E3' : 'E12' } : l.art === 'etappe' ? { art: 'gefuehrt', etappe: l.id } : l.art === 'dokumente' ? { art: 'bibliothek', unter: 'alle' } : { art: 'formular', modul: REGISTER_MODUL[l.id] ?? 'uebersicht' });
  return (
    <section class="karte luecken" aria-labelledby="luecken-titel" id="pruefung-luecken">
      <h2 id="luecken-titel">{t('pruefung.luecken_titel')}</h2>
      <p class="zweitext">{t('pruefung.luecken_text')}</p>
      <ul>
        {luecken.map((l) => (
          <li key={`${l.art}-${l.id}`} data-luecke={l.art}>
            <a href={ziel(l)}>
              {l.art === 'etappe' ? t('pruefung.luecke_etappe', { etappe: titel(l.id), erledigt: l.erledigt ?? 0, gesamt: l.gesamt ?? 0 })
                : l.art === 'register' ? t('pruefung.luecke_register', { register: t(`pruefung.register.${l.id}`) })
                : l.art === 'regel' ? t(`pruefung.luecke_regel_${l.id}`, { anzahl: l.erledigt ?? 0 })
                : t('pruefung.luecke_dokumente', { anzahl: Number(l.id) })}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

const REGISTER_MODUL: Record<string, string> = { kiSysteme: 'inventar', risiken: 'risiken', ziele: 'ziele', kompetenzen: 'kompetenz', kommunikation: 'kompetenz' };

/** imGefuehrt: Prüfseite im Guide; Sprünge führen dann auf die passende Seite des Guides. */
export function PruefungInhalt({ imGefuehrt = false }: { imGefuehrt?: boolean }) {
  const liste = befunde.value;
  const p = projekt.value;
  if (!p) return null;
  // Fehler aus Etappen, die noch kommen, als «offen» (U-07); Reihenfolge: Fehler, offen, Hinweise, je nach Regel
  const spaeter = new Set(fehlerStand.value.spaeter);
  const art = (b: Befund) => (b.schwere !== 'fehler' ? 'hinweis' : spaeter.has(b) ? 'offen' : 'fehler');
  const rang = { fehler: 0, offen: 1, hinweis: 2 } as const;
  const sortiert = [...liste].sort((a, b) => rang[art(a)] - rang[art(b)] || a.regel.localeCompare(b.regel));
  // Je Regel eine Gruppe mit Anzahl und Stellen (U-16), statt gleichlautender Einträge untereinander
  const gruppen: Befund[][] = [];
  for (const b of sortiert) {
    const g = gruppen.at(-1);
    if (g && g[0]!.regel === b.regel && art(g[0]!) === art(b)) g.push(b);
    else gruppen.push([b]);
  }
  // Befunde mit Feld (F43, P14) springen auch aus der Formularansicht direkt ins Feld im Guide
  const zielRoute = (b: Befund) => (imGefuehrt || b.feld ? gefuehrtSprung(b, p, umfeld.value.gefuehrt) : null) ?? sprungRoute(b.ziel);
  const ziel = (b: Befund) => {
    const roh = zielRoute(b);
    // Rückweg: Seiten im Guide zeigen nach dem Sprung einen Link zurück zur Prüfung
    return routeZuHash(roh.art === 'gefuehrt' ? { ...roh, von: imGefuehrt ? 'gefuehrt-pruefung' : 'pruefung' } : roh);
  };
  const ort = (b: Befund) => <span class="zweitext befund-ort">{ortVon(zielRoute(b))}</span>;
  const schwere = (b: Befund) => <StatusPille art={art(b) === 'fehler' ? 'kritisch' : art(b) === 'offen' ? 'neutral' : 'warnung'} data-schwere={art(b)}>{t(`pruefung.schwere.${art(b)}`)}</StatusPille>;
  return (
    <div>
      <section class="karte bereitschaft" id="bereitschaft" aria-labelledby="bereitschaft-titel">
        <p class="kontext" id="bereitschaft-titel">{t('pruefung.bereitschaft_titel')}</p>
        <AmpelAnzeige liste={liste} />
        <BereitschaftSpur />
        <BereitschaftErklaerung />
      </section>
      <LueckenListe luecken={bereitschaftStand.value?.luecken ?? []} />
      <div class="leiste kein-druck pruefung-knoepfe">
        <button type="button" id="stage1-bericht" onClick={stage1Drucken}>{t('pruefung.bericht')}</button>
        <a class="knopf" href={routeZuHash({ art: 'dokumente' })}>{t('pruefung.dokumente')}</a>
      </div>
      {sortiert.length === 0 ? (
        <Hinweis als="p" art="ok">{t(bereitschaftStand.value?.luecken.length ? 'pruefung.keine_befunde_luecken' : 'pruefung.keine_befunde')}</Hinweis>
      ) : (
        <ul class="befunde" aria-label={t('pruefung.liste')}>
          {gruppen.map((g) => {
            const b = g[0]!;
            if (g.length === 1) {
              const tx = befundText(b);
              return (
                <li key={`${b.regel}-${b.id ?? ''}`} data-regel={b.regel}>
                  {schwere(b)}
                  <div class="text">
                    <strong>{tx.titel}</strong>
                    <p class="befund-erklaerung befund-warum">{t('pruefung.warum', { text: tx.erklaerung })}</p>
                    <span class="zweitext">{b.regel} · {t('hilfe.norm', { abschnitt: b.norm })}</span>
                  </div>
                  {ort(b)}
                  <a class="knopf klein kein-druck" href={ziel(b)} onClick={() => sprungMerken([ziel(b)])} aria-label={`${t('pruefung.springen')}: ${tx.titel}`}>{t('pruefung.springen')}</a>
                </li>
              );
            }
            // Gruppe: Titel ohne einzelnen Namen, kein «…» im Satz
            const allgemein = befundText({ ...b, name: '…', id: '…' });
            allgemein.titel = allgemein.titel.replace(/\s*[«“]?…[»”]?/g, '').trim();
            return (
              <li key={`${b.regel}-gruppe-${art(b)}`} class="befund-gruppe" data-regel={b.regel}>
                <details open>
                  <summary>
                    {schwere(b)}
                    <span class="text"><strong>{allgemein.titel}</strong> <span class="zahl-pille">{t('pruefung.stellen', { anzahl: g.length })}</span></span>
                  </summary>
                  <p class="befund-erklaerung befund-warum">{t('pruefung.warum', { text: allgemein.erklaerung })}</p>
                  <span class="zweitext">{b.regel} · {t('hilfe.norm', { abschnitt: b.norm })}</span>
                  <div class="befund-stellen" role="list">
                    {g.map((x, i) => {
                      const tx = befundText(x);
                      return (
                        <div role="listitem" class="befund-stelle" key={`${x.id ?? ''}-${i}`}>
                          <span>{x.name ?? x.id ?? tx.titel}</span>
                          {ort(x)}
                          <a class="knopf klein kein-druck" href={ziel(x)} onClick={() => sprungMerken(g.map(ziel))} aria-label={`${t('pruefung.springen')}: ${tx.titel}`}>{t('pruefung.springen')}</a>
                        </div>
                      );
                    })}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function Pruefung() {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const p = projekt.value;
  if (!p) {
    navigiere({ art: 'start' });
    return null;
  }
  return (
    <div class="inhalt">
      <Seitenkopf titel={t('pruefung.titel')} titelRef={ref} aktion={<a class="knopf primaer" id="pruefung-stage1" href={routeZuHash({ art: 'pruefung', unter: 'stage1' })}>{tr('pruefung.stage1')}</a>} />
      <p class="zweitext">{t('pruefung.einleitung')}</p>
      <p class="nur-druck zweitext">{p.organisation.name} · {datumText(stichtag.value)}</p>
      <PruefungInhalt />
    </div>
  );
}

/** Prüfung › Stage-1-Bericht: Bericht am Bildschirm, Druck über den Druckbehälter (stage1Drucken) */
export function Stage1Seite() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.querySelector<HTMLElement>('h1')?.focus(), []);
  const p = projekt.value;
  if (!p) return null;
  const sprache = uiSprache.value;
  const daten = appDaten();
  const b = stage1Bericht(p, { u: erstelleUebersetzer(sprache, daten.texte[sprache]), umfeld: umfeld.value, kataloge: daten.kataloge, regeln: daten.regeln.regeln, befunde: befunde.value, heute: stichtag.value });
  return (
    <div class="inhalt stage1-seite" ref={ref}>
      <Stage1BerichtAnsicht b={b} aktionen={
        <button type="button" class="primaer" id="stage1-drucken" onClick={stage1Drucken}><Symbol name="drucken" />{t('pruefung.bericht')}</button>
      } />
    </div>
  );
}
