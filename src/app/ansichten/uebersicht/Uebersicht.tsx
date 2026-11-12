// Bereich Übersicht (R3): Fällig (alle fälligen Aufgaben) und Stage-1-Bereitschaft (Ampel, Kapitel 4 bis 10,
// Control-Gruppen, Etappen, offene Freigaben). Das Lagebild bleibt unter #/formular/uebersicht (Lagebild.tsx).
import { useEffect, useRef } from 'preact/hooks';
import type { Projekt } from '../../../model/typen.ts';
import { Kennzahl, Kennzahlen } from '../../../grafik/preact/Diagramme.tsx';
import { appDaten } from '../../daten.ts';
import { datumText, inhalt, t, zahlText } from '../../i18n.ts';
import { gruppenFortschritt, kapitelFortschritt, offeneMassnahmen } from '../../logik/fortschritt.ts';
import { routeZuHash } from '../../logik/routen.ts';
import { faelligListe } from '../../rahmen/faellig.ts';
import { tr } from '../../rahmen/text.ts';
import { befunde, bereitschaftStand, fehlerStand, stichtag, umfeld } from '../../zustand/store.ts';
import { etappenStaende, etappenTitel } from '../gefuehrt/Gefuehrt.tsx';
import { AmpelAnzeige, ampelStufe, LueckenListe } from '../pruefung/Pruefung.tsx';
import { FaelligTabelle } from '../start/Start.tsx';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { DruckAktion } from '../../rahmen/aktionen.tsx';

function useTitel(schluessel: string) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), [schluessel]);
  return ref;
}

function Anteile({ zeilen, id }: { zeilen: { titel: string; anteil: number; href?: string }[]; id: string }) {
  return (
    <ul class="anteile" id={id}>
      {zeilen.map((z) => {
        const prozent = Math.round(z.anteil * 100);
        return (
          <li key={z.titel} class="anteil-zeile">
            <span class="anteil-titel">{z.href ? <a href={z.href}>{z.titel}</a> : z.titel}</span>
            <span class={`balken${prozent >= 100 ? ' voll' : ''}`} role="progressbar" aria-label={z.titel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={prozent}><span style={{ width: `${Math.max(prozent, 1)}%` }} /></span>
            <span class="anteil-wert">{zahlText(prozent, 0)} %</span>
          </li>
        );
      })}
    </ul>
  );
}

function Faellig({ p }: { p: Projekt }) {
  const ref = useTitel('faellig');
  const liste = faelligListe.value;
  const ueber = liste.filter((a) => a.stand === 'ueberfaellig').length;
  return (
    <div class="inhalt uebersicht-faellig">
      <Seitenkopf titel={tr('uebersicht.faellig')} titelRef={ref} aktion={<DruckAktion />} />
      <p class="zweitext">{tr('uebersicht.faellig_text', { datum: datumText(stichtag.value) })}</p>
      <Kennzahlen beschriftung={tr('uebersicht.faellig')}>
        <Kennzahl id="kz-ueberfaellig" beschriftung={tr('faellig.ueberfaellig')} wert={ueber} />
        <Kennzahl id="kz-bald" beschriftung={tr('faellig.bald')} wert={liste.length - ueber} />
        <Kennzahl id="kz-massnahmen" beschriftung={tr('uebersicht.massnahmen_offen')} wert={offeneMassnahmen(p)} href={routeZuHash({ art: 'formular', modul: 'massnahmen' })} />
      </Kennzahlen>
      <section class="karte" aria-labelledby="faellig-liste-titel">
        <div class="karte-kopf">
          <h2 id="faellig-liste-titel">{tr('uebersicht.faellig_liste')}</h2>
          <a href={routeZuHash({ art: 'gefuehrt', etappe: 'J', seite: 'J-kalender' })}>{tr('guide.jahreskalender')}</a>
        </div>
        <FaelligTabelle liste={liste} />
      </section>
    </div>
  );
}

function Bereitschaft({ p }: { p: Projekt }) {
  const ref = useTitel('bereitschaft');
  const u = umfeld.value;
  const k = appDaten().kataloge;
  const b = befunde.value;
  // Fehler jetzt; Fehler aus Etappen, die noch kommen, als «offen» (U-07)
  const fehler = fehlerStand.value.jetzt.length;
  const offen = fehlerStand.value.spaeter.length;
  const staende = etappenStaende(p).filter((e) => e.id !== 'J');
  const erledigt = staende.filter((e) => e.zustand === 'erledigt').length;
  const kapitel = kapitelFortschritt(p, u, k).map((x) => ({ titel: `${x.id.replace(/^K-/, '')} ${inhalt(`anforderungen42001.kapitel.${x.id}`) ?? ''}`.trim(), anteil: x.anteil }));
  const gruppen = gruppenFortschritt(p, k).map((x) => ({
    titel: `${x.id} ${inhalt(`controls42001.gruppen.${x.id}`) ?? ''}`.trim(),
    anteil: x.anteil,
    href: routeZuHash({ art: 'formular', modul: 'soa' }),
  }));
  const a = ampelStufe(b, fehler, offen, bereitschaftStand.value);
  return (
    <div class="inhalt uebersicht-bereitschaft">
      <Seitenkopf titel={tr('uebersicht.bereitschaft')} titelRef={ref} aktion={<a class="knopf primaer" href={routeZuHash({ art: 'pruefung', unter: 'stage1' })}>{tr('pruefung.stage1')}</a>} />
      <p class="zweitext">{tr('uebersicht.bereitschaft_text')}</p>
      <section class="karte" aria-labelledby="bereit-ampel-titel">
        <div class="karte-kopf">
          <h2 id="bereit-ampel-titel">{t('uebersicht.stage1')}</h2>
          <a href={routeZuHash({ art: 'pruefung' })}>{t('uebersicht.zur_pruefung')}</a>
        </div>
        <AmpelAnzeige liste={b} />
        <p class="zweitext">{tr(`uebersicht.bereitschaft_${a}`)}</p>
        <LueckenListe luecken={bereitschaftStand.value?.luecken ?? []} />
        <Kennzahlen beschriftung={tr('uebersicht.bereitschaft')}>
          <Kennzahl id="kz-fehler" beschriftung={t('lagebild.pruefung')} wert={fehler} einheit={t('pruefung.einheit_fehler', { anzahl: fehler })} href={routeZuHash({ art: 'pruefung' })}
            text={offen ? t('pruefung.zahl_offen', { anzahl: offen }) : undefined} />
          <Kennzahl id="kz-etappen" beschriftung={tr('uebersicht.etappen_erledigt')} wert={`${erledigt}/${staende.length}`} href={routeZuHash({ art: 'gefuehrt' })} />
          <Kennzahl id="kz-bericht" beschriftung={tr('pruefung.stage1')} wert={<span class="kz-linktext">{tr('uebersicht.bericht_ansehen')}</span>} href={routeZuHash({ art: 'pruefung', unter: 'stage1' })} />
        </Kennzahlen>
      </section>
      <div class="lagebild-raster">
        <section class="karte lb-halb" aria-labelledby="bereit-kapitel">
          <h2 id="bereit-kapitel">{t('uebersicht.kapitel')}</h2>
          <Anteile zeilen={kapitel} id="bereit-kapitel-liste" />
        </section>
        <section class="karte lb-halb" aria-labelledby="bereit-gruppen">
          <h2 id="bereit-gruppen">{t('uebersicht.gruppen')}</h2>
          <Anteile zeilen={gruppen} id="bereit-gruppen-liste" />
        </section>
        <section class="karte lb-breit" aria-labelledby="bereit-etappen">
          <h2 id="bereit-etappen">{tr('guide.etappen')}</h2>
          <ul class="etappen-stand">
            {staende.map((e) => (
              <li key={e.id}>
                <span class={`schritt ${e.zustand === 'erledigt' ? 'erledigt' : e.zustand === 'teilweise' ? 'laeuft' : 'offen'}`} aria-hidden="true" />
                <a href={routeZuHash({ art: 'gefuehrt', etappe: e.id })}>{e.id} {etappenTitel(e.id)}</a>
                <span class="zweitext">{tr(`guide.stand.${e.zustand === 'erledigt' ? 'erledigt' : e.zustand === 'teilweise' ? 'laeuft' : 'offen'}`)} · {e.erledigt}/{e.gesamt}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export function Uebersicht({ p, unter }: { p: Projekt; unter: 'faellig' | 'bereitschaft' }) {
  return unter === 'faellig' ? <Faellig p={p} /> : <Bereitschaft p={p} />;
}
