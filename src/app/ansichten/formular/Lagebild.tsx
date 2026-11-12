// Übersicht als «Lagebild AIMS»: Kennzahlen, Etappen, Risikomatrix vor und nach Behandlung, SoA-Umsetzung je Gruppe,
// Massnahmen nach Fälligkeit, KI-Inventar nach Risikoklasse und Handlungsbefugnis, Ziele mit Verlauf, Kapitel und fällige
// Überprüfungen, Prozesse (Reife, fällige Durchführungen). Druckbar (Druck immer hell, A4). Jede Karte führt zum Modul. Daten aus src/grafik/daten.ts.
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import type { Projekt } from '../../../model/typen.ts';
import { HANDLUNGSBEFUGNISSE } from '../../../model/typen.ts';
import { inventarVerteilung, kennzahlVerlaeufe, kreuztabelle, massnahmenNachFaelligkeit, soaJeGruppe, ueberAkzeptanz, type Faelligkeit, type SoaKategorie } from '../../../grafik/daten.ts';
import { BalkenGestapelt, Etappenleiste, Kennzahl, Kennzahlen, Kreuztabelle } from '../../../grafik/preact/Diagramme.tsx';
import type { BalkenKategorie } from '../../../grafik/svg/balken.ts';
import { appDaten } from '../../daten.ts';
import { datumText, inhalt, optionText, t, zahlText } from '../../i18n.ts';
import { faelligeUeberpruefungen, kapitelFortschritt } from '../../logik/fortschritt.ts';
import { aktiveEtappen, gesamtFortschritt, seitenIndex, weitermachenZiel } from '../../logik/gefuehrt.ts';
import { etappenStand } from '../../logik/ueberblick.ts';
import { freigabeStand } from '../../logik/fahrplan.ts';
import { routeZuHash } from '../../logik/routen.ts';
import { RisikoMatrizen } from '../../ui/Grafik.tsx';
import { befunde, fehlerStand, stichtag as stichtagSignal, umfeld } from '../../zustand/store.ts';
import { AmpelAnzeige } from '../pruefung/Pruefung.tsx';
import { etappenKurz, etappenTitel, modulText, sprachTag } from '../gefuehrt/Gefuehrt.tsx';
import { normTitel } from '../../normtexte/zustand.ts';
import { ProzessDashboard } from '../prozesse/Prozesse.tsx';
import { staende } from '../../logik/prozesse.ts';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { Symbol } from '../../rahmen/symbole.tsx';

const zahl = (n: number, stellen = 0) => zahlText(n, stellen);

/** SoA: fünf Kategorien, die erwünschte zuerst, «nicht anwendbar» zuletzt; «teilweise» schraffiert. */
type SoaBalken = 'umgesetzt' | 'teilweise' | 'offen' | 'unentschieden' | 'ausgeschlossen';
function soaKategorien(): BalkenKategorie<SoaBalken>[] {
  return [
    { schluessel: 'umgesetzt', text: t('grafik.soa.umgesetzt'), ton: 'gut' },
    { schluessel: 'teilweise', text: t('grafik.soa.teilweise'), ton: 'warnung', muster: true },
    { schluessel: 'offen', text: t('grafik.soa.offen'), ton: 'info' },
    { schluessel: 'unentschieden', text: t('grafik.soa.unentschieden'), ton: 'leer' },
    { schluessel: 'ausgeschlossen', text: t('grafik.soa.ausgeschlossen'), ton: 'neutral' },
  ];
}
function soaWerte(a: Record<SoaKategorie, number>): Record<SoaBalken, number> {
  return { umgesetzt: a.wirksam + a.umgesetzt, teilweise: a.teilweise, offen: a.geplant + a.offen, unentschieden: a.unentschieden, ausgeschlossen: a.ausgeschlossen };
}

type FaelligBalken = Exclude<Faelligkeit, 'verworfen'>;
function faelligKategorien(): BalkenKategorie<FaelligBalken>[] {
  return [
    { schluessel: 'erledigt', text: t('grafik.faelligkeit.erledigt'), ton: 'gut' },
    { schluessel: 'spaeter', text: t('grafik.faelligkeit.spaeter'), ton: 'info' },
    { schluessel: 'bald', text: t('grafik.faelligkeit.bald'), ton: 'warnung', muster: true },
    { schluessel: 'ueberfaellig', text: t('grafik.faelligkeit.ueberfaellig'), ton: 'kritisch' },
    { schluessel: 'ohneTermin', text: t('grafik.faelligkeit.ohneTermin'), ton: 'leer' },
  ];
}

function KarteKopf({ titel, id, link }: { titel: string; id: string; link?: { href: string; text: string } }) {
  return (
    <div class="karte-kopf">
      <h2 id={id}>{titel}</h2>
      {link && <a class="kein-druck" href={link.href}>{link.text} <Symbol name="pfeil-rechts" klasse="sym sym-text" /></a>}
    </div>
  );
}

function Leer({ text }: { text: string }) {
  return <p class="g-leer">{text}</p>;
}

/**
 * Karte für die Geschäftsleitung (Rollentest RT-14): offene Freigaben aus dem Freigabekalender, Restrisiken über der
 * Grenze ohne Annahme, Termin des Stage-1-Audits, Link auf die Entscheidungsrechte.
 */
function FuerGeschaeftsleitung({ p, stichtag }: { p: Projekt; stichtag: string }) {
  const def = umfeld.value.gefuehrt.etappen.fahrplan;
  const ebIds = new Set(appDaten().kataloge.dokumente.dokumente.filter((d) => d.eb).map((d) => d.id));
  const pfad = p.meta.mitIsms ? 'mit_isms' : 'ohne_isms';
  const offen = (def?.freigaben ?? [])
    .filter((f) => f.wochen[pfad] !== undefined)
    .map((f) => freigabeStand(p, { id: f.id, vorlagen: f.vorlagen[pfad] ?? [] }, ebIds, stichtag))
    .filter((f) => !f.erledigt);
  const grenze = p.organisation.risikokriterien.akzeptanzBis;
  const restrisiken = p.risiken.filter((r) => r.art === 'risiko' && r.status !== 'geschlossen' && typeof r.wNach === 'number' && typeof r.aNach === 'number' && r.wNach * r.aNach > grenze && !r.restrisikoAkzeptiert);
  const stage1 = p.audits.filter((a) => a.art === 'extern-stage1').sort((a, b) => (a.geplant ?? '').localeCompare(b.geplant ?? ''))[0];
  const termin = stage1?.durchgefuehrt ?? stage1?.geplant;
  return (
    <section class="karte lb-breit" id="lb-gl" aria-labelledby="lb-gl-titel">
      <KarteKopf titel={t('lagebild.gl_titel')} id="lb-gl-titel" link={{ href: routeZuHash({ art: 'formular', modul: 'organisation', id: 'rollen' }), text: t('lagebild.gl_entscheidungsrechte') }} />
      <ul class="lb-liste">
        <li id="lb-gl-stage1"><span class="datum">{termin ? datumText(termin) : t('lagebild.gl_offen')}</span>{t(termin ? 'lagebild.gl_stage1' : 'lagebild.gl_stage1_fehlt')}{!termin && p.organisation.zielterminStage1 ? ` ${t('lagebild.gl_ziel', { datum: datumText(p.organisation.zielterminStage1) })}` : ''}</li>
        {offen.length === 0 ? <li class="zweitext">{t('lagebild.gl_keine_freigaben')}</li> : offen.map((f) => (
          <li key={f.id} data-freigabe={f.id}>
            <span class="datum">{t('lagebild.gl_freigeben')}</span>
            {inhalt(`app.fahrplan.freigaben.${f.id}`) ?? f.id}: {f.dokumente.filter((d) => !d.erledigt).map((d) => d.id).join(', ')}
          </li>
        ))}
        {restrisiken.length > 0 && (
          <li id="lb-gl-restrisiken"><span class="datum">{t('lagebild.gl_annehmen')}</span><a href={routeZuHash({ art: 'formular', modul: 'risiken', filter: { status: 'annahme-offen' } })}>{t('lagebild.gl_restrisiken', { ids: restrisiken.map((r) => r.id).join(', ') })}</a></li>
        )}
      </ul>
    </section>
  );
}

export function Lagebild({ p }: { p: Projekt }) {
  // Fokus auf den Titel wie in allen Ansichten: Tastatur und Bildschirmleser starten hier (D-09)
  const titelRef = useRef<HTMLHeadingElement>(null);
  // Vor dem Zeichnen: sonst nähme der Effekt einem schon bedienten Element den Fokus wieder weg
  useLayoutEffect(() => titelRef.current?.focus(), []);
  const u = umfeld.value;
  const k = appDaten().kataloge;
  const stichtag = stichtagSignal.value;
  const b = befunde.value;
  const g = gesamtFortschritt(p, u);
  const weiter = weitermachenZiel(p, u);
  const ua = ueberAkzeptanz(p);
  const faellig = massnahmenNachFaelligkeit(p.massnahmen, stichtag);
  const anzahl = (art: Faelligkeit) => faellig.find((f) => f.art === art)?.ids.length ?? 0;
  const ueberfaellig = faellig.find((f) => f.art === 'ueberfaellig')?.ids ?? [];
  const soa = soaJeGruppe(p, k.controls42001.gruppen);
  const index = seitenIndex(u.gefuehrt);
  const etappen = aktiveEtappen(u.gefuehrt, p).filter((e) => e.id !== 'J');
  const aktuelle = weiter?.etappe ?? p.meta.gefuehrt.aktuelleEtappe;
  const verlaeufe = kennzahlVerlaeufe(p, stichtag).slice(0, 4);
  const kap = kapitelFortschritt(p, u, k);
  const pruefFaellig = faelligeUeberpruefungen(p, stichtag);
  // Inventar: aktive Systeme, Zeilen nur mit Systemen, Spalten alle Stufen der Handlungsbefugnis
  const systeme = p.kiSysteme.filter((s) => s.status !== 'abgeloest');
  const iv = inventarVerteilung(systeme);
  const klassen = iv.risikoklasse.filter((x) => x.anzahl > 0).map((x) => x.wert);
  const befugnisse: string[] = [...HANDLUNGSBEFUGNISSE, ...(iv.handlungsbefugnis.some((x) => x.wert === '' && x.anzahl > 0) ? [''] : [])];
  const kreuz = kreuztabelle(systeme, (s) => s.aiAct?.risikoklasse ?? 'offen', (s) => s.handlungsbefugnis ?? '', klassen, befugnisse);
  const prozent = g.gesamt ? Math.round((100 * g.erledigt) / g.gesamt) : 0;
  return (
    <div class="inhalt lagebild" id="lagebild">
      <Seitenkopf titel={t('lagebild.titel')} titelRef={titelRef} aktion={<button type="button" class="primaer" id="lagebild-drucken" onClick={() => window.print()}><Symbol name="drucken" />{t('lagebild.drucken')}</button>}
        unter={<>
          <p class="kontext">{p.organisation.name || t('kopf.ohne_name')} · {t(p.meta.mitIsms ? 'pfad.mit_isms' : 'pfad.ohne_isms')} · {modulText(p)}</p>
          <p class="zweitext">{t('lagebild.einleitung', { datum: datumText(stichtag) })}<span class="kein-druck"> {t('lagebild.einleitung_bildschirm')}</span></p>
        </>} />

      <Kennzahlen beschriftung={t('lagebild.kennzahlen')}>
        <Kennzahl id="kz-pruefung" beschriftung={t('lagebild.pruefung')} wert={fehlerStand.value.jetzt.length} einheit={t('pruefung.einheit_fehler', { anzahl: fehlerStand.value.jetzt.length })} href={routeZuHash({ art: 'pruefung' })}
          text={<AmpelAnzeige liste={b} />} />
        <Kennzahl id="kz-gefuehrt" beschriftung={t('lagebild.gefuehrt')} wert={zahl(prozent)} einheit="%"
          text={
            <>
              <p class="g-kennzahl__text">{t('lagebild.gefuehrt_wert', { erledigt: g.erledigt, gesamt: g.gesamt })} {t('lagebild.gefuehrt_text')}</p>
              {weiter && <a class="knopf klein kein-druck" href={routeZuHash({ art: 'gefuehrt', etappe: weiter.etappe, seite: weiter.seite })}>{t('uebersicht.weitermachen')}</a>}
            </>
          } />
        <Kennzahl id="kz-ueberfaellig" beschriftung={t('lagebild.ueberfaellig')} wert={ueberfaellig.length} href={routeZuHash({ art: 'formular', modul: 'massnahmen' })}
          text={t('lagebild.ueberfaellig_text', { bald: anzahl('bald') })} />
        <Kennzahl id="kz-risiken" beschriftung={t('lagebild.ueber_akzeptanz')} wert={ua.anzahl} href={routeZuHash({ art: 'formular', modul: 'risiken', filter: { status: 'ueber' } })}
          text={`${t('lagebild.ueber_akzeptanz_text', { vor: ua.vor })}${ua.ohneBehandlung ? ` ${t('lagebild.ueber_akzeptanz_offen', { anzahl: ua.ohneBehandlung })}` : ''}`} />
      </Kennzahlen>

      {/* V-21 (A-16, A-17): zwei Raster. Das erste ist im Druck Seite 1, das Blatt für die Geschäftsleitung (Kennzahlen, Für die
          Geschäftsleitung, Risikomatrix vor und nach Behandlung, Massnahmen); das zweite der Anhang mit Controls und KI-Inventar,
          im Druck mit festem Umbruch davor. Am Bildschirm wirken beide wie ein Raster. */}
      <div class="lagebild-raster lb-blatt">
        <section class="karte lb-breit kein-druck" aria-labelledby="lb-etappen-titel">
          <KarteKopf titel={t('lagebild.etappen')} id="lb-etappen-titel" link={{ href: routeZuHash({ art: 'gefuehrt' }), text: t('lagebild.gefuehrt') }} />
          <Etappenleiste
            beschriftung={t('lagebild.etappen')}
            mitMeta
            sprache={sprachTag()}
            schritte={etappen.map((e) => {
              // Gleicher Stand wie im Guide: Haken nur bei vollständiger Etappe
              const f = etappenStand(e, p, u, index);
              return {
                kuerzel: e.id, titel: etappenTitel(e.id), kurz: etappenKurz(e.id), zustand: f.leiste, zustandText: t(`gefuehrt.status.${f.leiste}`), anteil: f.gesamt ? f.erledigt / f.gesamt : 0,
                aktiv: e.id === aktuelle, href: routeZuHash({ art: 'gefuehrt', etappe: e.id }), meta: `${f.erledigt}/${f.gesamt}`,
              };
            })}
          />
        </section>

        <FuerGeschaeftsleitung p={p} stichtag={stichtag} />

        <section class="karte lb-zweidrittel" id="lb-risiken" aria-labelledby="lb-risiken-titel">
          <KarteKopf titel={t('lagebild.risiken')} id="lb-risiken-titel" link={{ href: routeZuHash({ art: 'formular', modul: 'risiken' }), text: t('lagebild.zu_risiken') }} />
          <RisikoMatrizen p={p} id="lb-matrix" />
        </section>

        <section class="karte lb-drittel" id="lb-massnahmen" aria-labelledby="lb-massnahmen-titel">
          <KarteKopf titel={t('lagebild.massnahmen')} id="lb-massnahmen-titel" link={{ href: routeZuHash({ art: 'formular', modul: 'massnahmen' }), text: t('lagebild.zu_massnahmen') }} />
          {p.massnahmen.filter((m) => m.status !== 'verworfen').length === 0 ? <Leer text={t('lagebild.massnahmen_leer')} /> : (
            <>
              <BalkenGestapelt
                beschriftung={t('lagebild.massnahmen')}
                kategorien={faelligKategorien()}
                zeilen={[{ titel: t('lagebild.massnahmen_zeile'), werte: Object.fromEntries(faellig.map((f) => [f.art, f.ids.length])), summe: String(p.massnahmen.filter((m) => m.status !== 'verworfen').length) }]}
                zusammen={(n) => t('grafik.zusammen', { anzahl: n })}
              />
              {ueberfaellig.length > 0 && (
                <>
                  <h3 class="klein" style={{ marginTop: '16px' }}>{t('lagebild.ueberfaellige')}</h3>
                  <ul class="lb-liste">
                    {ueberfaellig.slice(0, 6).map((id) => {
                      const m = p.massnahmen.find((x) => x.id === id)!;
                      return <li key={id}><span class="datum">{datumText(m.termin)}</span><a href={routeZuHash({ art: 'formular', modul: 'massnahmen', id })}>{id}</a> {m.titel}</li>;
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </section>

      </div>

      <div class="lagebild-raster lb-anhang">
        <section class="karte lb-drittel" id="lb-soa" aria-labelledby="lb-soa-titel">
          <KarteKopf titel={t('lagebild.soa')} id="lb-soa-titel" link={{ href: routeZuHash({ art: 'formular', modul: 'soa' }), text: t('lagebild.zu_soa') }} />
          {soa.length === 0 ? <Leer text={t('lagebild.soa_leer')} /> : (
            <BalkenGestapelt
              beschriftung={t('lagebild.soa')}
              kategorien={soaKategorien()}
              zeilen={soa.map((gr) => ({
                titel: `${gr.id} ${normTitel(gr.id) ?? ''}`.trim(),
                werte: soaWerte(gr.anzahl),
                summe: gr.anwendbar ? `${Math.round(gr.anteilUmgesetzt * 100)} %` : '0 %',
              }))}
              zusammen={(n) => t('grafik.zusammen', { anzahl: n })}
            />
          )}
        </section>

        <section class="karte lb-zweidrittel" id="lb-inventar" aria-labelledby="lb-inventar-titel">
          <KarteKopf titel={t('lagebild.inventar')} id="lb-inventar-titel" link={{ href: routeZuHash({ art: 'formular', modul: 'inventar' }), text: t('lagebild.zu_inventar') }} />
          {systeme.length === 0 ? <Leer text={t('lagebild.inventar_leer')} /> : (
            <Kreuztabelle
              id="lb-inventar-tabelle"
              beschriftung={t('lagebild.inventar')}
              ecke={t('lagebild.inventar_ecke')}
              zeilen={klassen.map((x) => optionText('risikoklasse', x))}
              spalten={befugnisse.map((x) => (x ? optionText('handlungsbefugnis', x) : t('lagebild.inventar_ohne')))}
              werte={kreuz}
              summe={t('lagebild.summe')}
            />
          )}
        </section>

        <section class="karte lb-halb" id="lb-ziele" aria-labelledby="lb-ziele-titel">
          <KarteKopf titel={t('lagebild.ziele')} id="lb-ziele-titel" link={{ href: routeZuHash({ art: 'formular', modul: 'ziele' }), text: t('lagebild.zu_ziele') }} />
          {verlaeufe.length === 0 ? <Leer text={t('lagebild.ziele_leer')} /> : (
            <div class="g-kennzahlen">
              {verlaeufe.map((v) => {
                const zahlen = v.punkte.filter((x) => x.zahl !== null);
                const letzter = zahlen.at(-1)!;
                return (
                  <Kennzahl key={v.id} id={`kz-${v.id}`} beschriftung={`${v.id} ${v.kennzahl}`} wert={zahl(letzter.zahl!, 1)} einheit={v.einheit || undefined}
                    href={routeZuHash({ art: 'formular', modul: 'ziele', id: v.id })}
                    verlauf={zahlen.map((x) => x.zahl!)} soll={v.soll?.zahl}
                    verlaufText={t('lagebild.ziel_verlauf', { kennzahl: v.kennzahl, werte: zahlen.map((x) => `${datumText(x.datum)} ${x.text}`).join(', ') })}
                    text={v.soll ? t('lagebild.ziel_soll', { soll: `${zahl(v.soll.zahl, 1)}${v.einheit ? ` ${v.einheit}` : ''}` }) : datumText(letzter.datum)} />
                );
              })}
            </div>
          )}
        </section>

        <section class="karte lb-halb" id="lb-kapitel" aria-labelledby="lb-kapitel-titel">
          <KarteKopf titel={t('lagebild.kapitel')} id="lb-kapitel-titel" />
          {kap.map((x) => (
            <div class="fortschritt-zeile" key={x.id}>
              <span>{x.id.replace('K-', t('uebersicht.kapitel_kurz'))}</span>
              <div class={`balken${Math.round(x.anteil * 100) >= 100 ? ' voll' : ''}`} role="progressbar" aria-label={x.id.replace('K-', t('uebersicht.kapitel_kurz'))} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(x.anteil * 100)}>
                <span style={{ width: `${Math.round(x.anteil * 100)}%` }} />
              </div>
              <span>{Math.round(x.anteil * 100)} %</span>
            </div>
          ))}
          <h3 class="klein" style={{ marginTop: '16px' }}>{t('lagebild.faellig')}</h3>
          {pruefFaellig.length === 0 ? <p class="zweitext">{t('uebersicht.nichts_faellig')}</p> : (
            <ul class="lb-liste">
              {pruefFaellig.slice(0, 8).map((f) => <li key={`${f.bereich}-${f.id}`}><span class="datum">{datumText(f.datum)}</span>{f.name}</li>)}
            </ul>
          )}
        </section>

        <section class="karte lb-breit" id="lb-prozesse" aria-labelledby="lb-prozesse-titel">
          <KarteKopf titel={t('lagebild.prozesse')} id="lb-prozesse-titel" link={{ href: routeZuHash({ art: 'prozesse' }), text: t('lagebild.zu_prozesse') }} />
          {p.prozesse === undefined ? <Leer text={t('lagebild.prozesse_leer')} /> : <ProzessDashboard p={p} liste={staende(p, stichtag)} stichtag={stichtag} kompakt />}
        </section>
      </div>
    </div>
  );
}
