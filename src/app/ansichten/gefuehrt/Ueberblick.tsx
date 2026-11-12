// Überblick des Guides (Route #/gefuehrt, vor E0): wo man steht, auf einer Seite. Kennzahlen (Gesamtfortschritt,
// aktuelle Etappe mit «Weitermachen», Kalenderwoche gegen den Fahrplan, Prüfung), Etappen als gestapelte Balken mit
// Status und Prozent, nächste offene und zurückgestellte Seiten, Fahrplan mit Linie heute, offene Fehler der Prüfregeln,
// Module. Druckbar (Druck hell, ohne Bedienung). Daten aus src/app/logik/ueberblick.ts.
import { Symbol } from '../../rahmen/symbole.tsx';
import { useEffect, useRef } from 'preact/hooks';
import type { Projekt } from '../../../model/typen.ts';
import { BalkenGestapelt, FortschrittsKnoten, Kennzahl, Kennzahlen } from '../../../grafik/preact/Diagramme.tsx';
import type { BalkenKategorie } from '../../../grafik/svg/balken.ts';
import { datumText, inhalt, t, zahlText } from '../../i18n.ts';
import { kalenderwoche } from '../../logik/fahrplan.ts';
import { gefuehrtSprung } from '../../logik/pruefsprung.ts';
import { routeZuHash, sprungRoute } from '../../logik/routen.ts';
import { ueberblickDaten, type EtappenStand, type SeitenVerweis } from '../../logik/ueberblick.ts';
import { seitenIndex } from '../../logik/gefuehrt.ts';
import { befunde, fehlerStand, stichtag as stichtagSignal, umfeld } from '../../zustand/store.ts';
import { AmpelAnzeige, befundText } from '../pruefung/Pruefung.tsx';
import { seitenText } from './Hilfe.tsx';
import { etappenTitel, FahrplanGantt, modulText, SEITEN_FORM, statusSchluessel } from './Gefuehrt.tsx';
import { DruckAktion } from '../../rahmen/aktionen.tsx';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { StatusPille, type StatusArt } from '../../ui/StatusPille.tsx';
import { Hinweis } from '../../ui/Hinweis.tsx';

type Kat = 'erledigt' | 'unvollstaendig' | 'spaeter' | 'offen';

function kategorien(): BalkenKategorie<Kat>[] {
  return [
    { schluessel: 'erledigt', text: t('ueberblick.kategorie.erledigt'), ton: 'gut' },
    { schluessel: 'unvollstaendig', text: t('ueberblick.kategorie.unvollstaendig'), ton: 'warnung', muster: true },
    { schluessel: 'spaeter', text: t('ueberblick.kategorie.spaeter'), ton: 'info' },
    { schluessel: 'offen', text: t('ueberblick.kategorie.offen'), ton: 'leer' },
  ];
}

const PILLE: Record<EtappenStand['zustand'], 'gut' | 'info' | 'neutral'> = { erledigt: 'gut', teilweise: 'info', offen: 'neutral' };

function KarteKopf({ titel, id, link }: { titel: string; id: string; link?: { href: string; text: string } }) {
  return (
    <div class="karte-kopf">
      <h2 id={id}>{titel}</h2>
      {link && <a class="kein-druck" href={link.href}>{link.text} <Symbol name="pfeil-rechts" klasse="sym sym-text" /></a>}
    </div>
  );
}

function seitenTitel(v: { etappe: string; seite: string }): string {
  const e = umfeld.value.gefuehrt.etappen.etappen.find((x) => x.id === v.etappe);
  const s = seitenIndex(umfeld.value.gefuehrt).get(v.seite);
  return (e && s && seitenText(e, s, 'titel')) ?? v.seite;
}

function SeitenListe({ p, liste, id, leer }: { p: Projekt; liste: readonly SeitenVerweis[]; id: string; leer: string }) {
  const u = umfeld.value;
  const index = seitenIndex(u.gefuehrt);
  // «Prüfung meldet einen Befund», wenn nur die Prüfregeln die Seite offen halten (wie im Kopf des Guides)
  const status = (v: SeitenVerweis) => { const def = index.get(v.seite); return def ? statusSchluessel(def, v.etappe, p, u) : v.status; };
  if (liste.length === 0) return <p class="g-leer" id={id}>{leer}</p>;
  return (
    <ol class="ub-seiten" id={id}>
      {liste.map((v) => (
        <li key={`${v.etappe}-${v.seite}`} data-status={v.status}>
          <FortschrittsKnoten zustand={SEITEN_FORM[v.status] ?? 'offen'} groesse={14} />
          <span class="ub-etappe">{v.etappe}</span>
          <a href={routeZuHash({ art: 'gefuehrt', etappe: v.etappe, seite: v.seite })}>{seitenTitel(v)}</a>
          <span class="zweitext">{t(`gefuehrt.seitenstatus.${status(v)}`)}</span>
        </li>
      ))}
    </ol>
  );
}

export function Ueberblick({ p }: { p: Projekt }) {
  const u = umfeld.value;
  const stichtag = stichtagSignal.value;
  const b = befunde.value;
  const d = ueberblickDaten(p, u, { heute: stichtag, befunde: b });
  const titelRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titelRef.current?.focus(), []);
  const kw = (x: { woche: number; jahr: number } | undefined) => (x ? t('fahrplan.kw', { woche: x.woche, jahr: x.jahr }) : '');
  const z = d.zeit;
  const a = d.aktuell;
  const weiterHref = a ? routeZuHash({ art: 'gefuehrt', etappe: a.etappe, seite: a.seite }) : undefined;
  const weiterText = a ? t('ueberblick.weitermachen_ziel', { etappe: a.etappe, titel: etappenTitel(a.etappe), nummer: a.nummer, anzahl: a.anzahl }) : '';
  // Fehler dosieren (Rollentest RT-12, U-07; logik/fehler-dosiert.ts): Fehler aus Etappen, die noch kommen, gesammelt als «später»
  const fehler = fehlerStand.value.jetzt;
  const spaeterFehler = fehlerStand.value.spaeter.length;
  const meilensteinText = (id: string) => inhalt(`app.fahrplan.meilensteine.${id}`) ?? id;
  const pille = (ton: string, text: string, id?: string) => <StatusPille art={ton as StatusArt} id={id}>{text}</StatusPille>;
  let zeitPille;
  if (!z.mitTermin) zeitPille = pille('neutral', t('ueberblick.ohne_termin'), 'ub-verzug');
  else zeitPille = z.verzug ? pille('warnung', t('ueberblick.im_verzug'), 'ub-verzug') : pille('gut', t('ueberblick.im_plan'), 'ub-verzug');
  const f = z.fahrplan;
  let zeitText = '';
  if (z.mitTermin && f) {
    if (z.planWoche !== undefined && z.planWoche < 1) zeitText = t('ueberblick.zeit_vor', { kw: kw(f.schritte[0]?.von.kw) });
    else if (z.planWoche !== undefined && z.planWoche > z.wochen) zeitText = t('ueberblick.zeit_nach', { datum: datumText(f.ziel) });
    else if (z.sollSchritt) {
      const s = z.sollSchritt;
      zeitText = t('ueberblick.zeit_plan', { nr: s.nr, etappen: s.etappen.join(', '), von: kw(s.von.kw), bis: kw(s.bis.kw) });
    }
  }
  return (
    <div>
      <div class="inhalt lagebild ueberblick" id="ueberblick">
        <Seitenkopf titel={t('ueberblick.titel')} titelRef={titelRef} titelId="ueberblick-titel"
          aktion={weiterHref ? <a class="knopf primaer" id="ueberblick-weiter" href={weiterHref} aria-describedby="ub-weiter-ziel">{t('ueberblick.weitermachen')} <Symbol name="pfeil-rechts" klasse="sym sym-text" /></a> : <DruckAktion text={t('ueberblick.drucken')} />}
          unter={<>
            <p class="kontext">{p.organisation.name || t('kopf.ohne_name')} · {t(p.meta.mitIsms ? 'pfad.mit_isms' : 'pfad.ohne_isms')} · {modulText(p)}</p>
            <p class="zweitext">{t('ueberblick.einleitung', { datum: datumText(stichtag) })}</p>
            {weiterHref && <p class="kein-druck"><button type="button" class="klein" id="ueberblick-drucken" onClick={() => window.print()}>{t('ueberblick.drucken')}</button></p>}
          </>} />

        <Kennzahlen beschriftung={t('ueberblick.kennzahlen')}>
          <Kennzahl id="ub-gesamt" beschriftung={t('ueberblick.gesamt')} wert={zahlText(d.gesamt.prozent, 0)} einheit="%"
            text={
              <>
                <p class="g-kennzahl__text">{t('ueberblick.gesamt_text', { erledigt: d.gesamt.erledigt, gesamt: d.gesamt.gesamt })}</p>
                <div class={`balken${d.gesamt.gesamt && d.gesamt.erledigt === d.gesamt.gesamt ? ' voll' : ''}`} role="progressbar" aria-label={t('ueberblick.gesamt')} aria-valuemin={0} aria-valuemax={d.gesamt.gesamt} aria-valuenow={d.gesamt.erledigt}>
                  <span style={{ width: `${d.gesamt.prozent}%` }} />
                </div>
                <p class="g-kennzahl__text">{t('ueberblick.etappen_zahlen', { vollstaendig: d.gesamt.vollstaendig, teilweise: d.gesamt.teilweise, offen: d.gesamt.offen })}</p>
              </>
            } />
          <Kennzahl id="ub-aktuell" beschriftung={t('ueberblick.aktuell')} wert={a?.etappe ?? '0'} href={weiterHref}
            text={a && <p class="g-kennzahl__text" id="ub-weiter-ziel">{t('ueberblick.aktuell_text', { titel: etappenTitel(a.etappe), nummer: a.nummer, anzahl: a.anzahl })}</p>} />
          <Kennzahl id="ub-zeit" beschriftung={t('ueberblick.zeit')} wert={`${t('grafik.kurz_kw')} ${z.kw.woche}`}
            text={
              <>
                <p class="g-kennzahl__text">{zeitPille}</p>
                {zeitText && <p class="g-kennzahl__text">{zeitText}</p>}
                {!z.mitTermin && <p class="g-kennzahl__text"><a href={routeZuHash({ art: 'gefuehrt', etappe: 'E0', seite: 'E0-termin' })}>{t('ueberblick.zum_termin')}</a></p>}
              </>
            } />
          <Kennzahl id="ub-pruefung" beschriftung={t('ueberblick.fehler_jetzt')} wert={fehler.length} einheit={t('pruefung.einheit_fehler', { anzahl: fehler.length })} href={routeZuHash({ art: 'pruefung' })}
            text={spaeterFehler > 0 ? <p class="g-kennzahl__text">{t('ueberblick.fehler_spaeter', { anzahl: spaeterFehler })}</p> : <AmpelAnzeige liste={b} />} />
        </Kennzahlen>

        <div class="lagebild-raster">
          <section class="karte lb-breit ub-etappen" id="ub-etappen" aria-labelledby="ub-etappen-titel">
            <KarteKopf titel={t('ueberblick.etappen')} id="ub-etappen-titel" />
            <p class="zweitext">{t('ueberblick.etappen_text')}</p>
            <BalkenGestapelt
              id="ub-etappen-balken"
              beschriftung={t('ueberblick.etappen')}
              kategorien={kategorien()}
              zusammen={(n) => t('grafik.zusammen', { anzahl: n })}
              zeilen={d.etappen.map((st) => ({
                titel: `${st.id} ${etappenTitel(st.id)}`,
                href: routeZuHash({ art: 'gefuehrt', etappe: st.id }),
                werte: { erledigt: st.erledigt, unvollstaendig: st.unvollstaendig, spaeter: st.spaeter, offen: st.gesamt - st.erledigt - st.unvollstaendig - st.spaeter },
                summe: `${st.prozent} %`,
                marke: <FortschrittsKnoten zustand={st.zustand === 'erledigt' ? 'erledigt' : st.zustand === 'teilweise' ? 'teilweise' : 'offen'} anteil={st.gesamt ? st.erledigt / st.gesamt : 0} groesse={16} />,
                zusatz: <StatusPille art={PILLE[st.zustand] as StatusArt} data-zustand={st.zustand}>{t(`gefuehrt.status.${st.leiste}`)}</StatusPille>,
              }))}
            />
          </section>

          <section class="karte lb-halb" id="ub-naechste" aria-labelledby="ub-naechste-titel">
            <KarteKopf titel={t('ueberblick.naechste')} id="ub-naechste-titel" />
            <SeitenListe p={p} liste={d.naechste} id="ub-naechste-liste" leer={t('ueberblick.naechste_leer')} />
          </section>

          <section class="karte lb-halb" id="ub-spaeter" aria-labelledby="ub-spaeter-titel">
            <KarteKopf titel={t('ueberblick.spaeter')} id="ub-spaeter-titel" />
            <SeitenListe p={p} liste={d.spaeter} id="ub-spaeter-liste" leer={t('ueberblick.spaeter_leer')} />
          </section>

          <section class="karte lb-zweidrittel" id="ub-fahrplan" aria-labelledby="ub-fahrplan-titel">
            <KarteKopf titel={t('ueberblick.fahrplan')} id="ub-fahrplan-titel" link={{ href: routeZuHash({ art: 'gefuehrt', etappe: 'E0', seite: 'E0-fahrplan' }), text: t('ueberblick.zum_fahrplan') }} />
            {z.mitTermin && f ? (
              <>
                <p>{t('ueberblick.zeit_ziel', { datum: datumText(f.ziel), kw: kw(f.ziel ? kalenderwoche(f.ziel) : undefined), wochen: f.wochen })} {zeitText}</p>
                {z.verzug && <Hinweis als="p" art="warnung" id="ub-verzug-text">{t('ueberblick.verzug_text', { etappen: z.faelligOffen.map((e) => `${e} ${etappenTitel(e)}`).join(', ') })}</Hinweis>}
              </>
            ) : (
              <Hinweis als="p">{t('ueberblick.ohne_termin_text')} <a href={routeZuHash({ art: 'gefuehrt', etappe: 'E0', seite: 'E0-termin' })}>{t('ueberblick.zum_termin')}</a></Hinweis>
            )}
            {f && <FahrplanGantt p={p} f={f} meilensteinText={meilensteinText} />}
          </section>

          <div class="lb-drittel ub-stapel">
            <section class="karte" id="ub-pruefung" aria-labelledby="ub-pruefung-titel">
              <KarteKopf titel={t('ueberblick.fehler')} id="ub-pruefung-titel" link={{ href: routeZuHash({ art: 'pruefung' }), text: t('ueberblick.zur_pruefung') }} />
              <AmpelAnzeige liste={b} />
              {fehler.length === 0 ? <p class="zweitext">{t('ueberblick.keine_fehler')}</p> : (
                <ul class="lb-liste ub-fehler">
                  {fehler.slice(0, 5).map((x, i) => {
                    const ziel = gefuehrtSprung(x, p, u.gefuehrt) ?? sprungRoute(x.ziel);
                    return <li key={`${x.regel}-${x.id ?? ''}-${i}`}><span class="datum">{x.regel}</span><a href={routeZuHash(ziel)}>{befundText(x).titel}</a></li>;
                  })}
                  {fehler.length > 5 && <li class="zweitext">{t('ueberblick.weitere_fehler', { anzahl: fehler.length - 5 })}</li>}
                </ul>
              )}
              {spaeterFehler > 0 && <p class="zweitext" id="ub-fehler-spaeter">{t('ueberblick.fehler_spaeter', { anzahl: spaeterFehler })}</p>}
            </section>
            <section class="karte" id="ub-module" aria-labelledby="ub-module-titel">
              <KarteKopf titel={t('ueberblick.module')} id="ub-module-titel" link={{ href: routeZuHash({ art: 'einstellungen' }), text: t('ueberblick.zu_einstellungen') }} />
              <ul class="lb-liste">
                <li><span class="ub-modul">{t('ueberblick.modul_aiact')}</span>{pille(d.module.aiAct ? 'gut' : 'neutral', t(d.module.aiAct ? 'ueberblick.modul_ein' : 'ueberblick.modul_aus'), 'ub-modul-aiact')}</li>
                <li><span class="ub-modul">{t('ueberblick.modul_nist')}</span>{pille(d.module.nistRmf ? 'gut' : 'neutral', t(d.module.nistRmf ? 'ueberblick.modul_ein' : 'ueberblick.modul_aus'), 'ub-modul-nist')}</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
