// Seite «Für Mitarbeitende» (Rollentest RT-35): was erlaubt ist, wie man ein neues KI-Werkzeug beantragt, wo man meldet,
// in Alltagssprache und druckbar. Alle Angaben stammen aus dem Projekt (Inventar, Freigabeprozess, Meldeweg).
import { useEffect, useRef } from 'preact/hooks';
import type { Projekt } from '../../../model/typen.ts';
import { optionText, t } from '../../i18n.ts';
import { routeZuHash } from '../../logik/routen.ts';
import { DruckAktion } from '../../rahmen/aktionen.tsx';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { Hinweis } from '../../ui/Hinweis.tsx';

export function FuerMitarbeitende({ p }: { p: Projekt }) {
  const titelRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titelRef.current?.focus(), []);
  const person = (id: string | undefined) => {
    const x = p.personen.find((y) => y.id === id);
    return x ? (x.funktion ? `${x.name}, ${x.funktion}` : x.name) : '';
  };
  const erlaubt = p.kiSysteme.filter((s) => s.status === 'freigegeben' || s.status === 'eingeschraenkt');
  const verboten = p.kiSysteme.filter((s) => s.status === 'untersagt' || s.status === 'ausgesetzt');
  const fg = (p.meta.gefuehrt.antworten['werkzeugFreigabe'] ?? {}) as { wer?: string; kriterien?: string[]; fristTage?: number };
  const mw = p.organisation.meldeweg;
  return (
    <div class="inhalt mitarbeitende" id="mitarbeitende">
      <Seitenkopf titel={t('mitarbeitende.titel')} titelRef={titelRef} aktion={<DruckAktion text={t('mitarbeitende.drucken')} />}
        unter={<>
          <p class="kontext">{p.organisation.name || t('kopf.ohne_name')}</p>
          <p class="zweitext">{t('mitarbeitende.einleitung')}</p>
        </>} />

      <section class="karte abschnitt" id="ma-erlaubt" aria-labelledby="ma-erlaubt-titel">
        <h2 id="ma-erlaubt-titel">{t('mitarbeitende.erlaubt_titel')}</h2>
        {erlaubt.length === 0 ? <p class="ersatz">{t('mitarbeitende.erlaubt_leer')}</p> : (
          <div class="tabelle-feld">
            <table class="kartenliste">
              <thead><tr><th scope="col">{t('mitarbeitende.werkzeug')}</th><th scope="col">{t('mitarbeitende.stand')}</th><th scope="col">{t('mitarbeitende.datenklasse')}</th><th scope="col">{t('mitarbeitende.auflagen')}</th></tr></thead>
              <tbody>
                {erlaubt.map((s) => (
                  <tr key={s.id}>
                    <td class="k-titel"><strong>{s.name}</strong>{s.zweck ? <><br /><span class="zweitext">{s.zweck}</span></> : null}</td>
                    <td class="k-status">{optionText('kiStatus', s.status)}</td>
                    <td data-label={t('mitarbeitende.datenklasse')}>{s.datenklasse ? optionText('datenklasse', s.datenklasse) : ''}</td>
                    <td data-label={t('mitarbeitende.auflagen')}>{s.auflagen ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {verboten.length > 0 && (
          <Hinweis als="p" art="warnung" id="ma-verboten"><strong>{t('mitarbeitende.verboten')}</strong> {verboten.map((s) => s.name).join(', ')}</Hinweis>
        )}
        <p class="zweitext">{t('mitarbeitende.datenklassen')}</p>
      </section>

      <section class="karte abschnitt" id="ma-beantragen" aria-labelledby="ma-beantragen-titel">
        <h2 id="ma-beantragen-titel">{t('mitarbeitende.beantragen_titel')}</h2>
        <p>{fg.wer ? t('mitarbeitende.beantragen_bei', { wer: person(fg.wer) }) : t('mitarbeitende.beantragen_offen')}</p>
        {typeof fg.fristTage === 'number' && fg.fristTage > 0 && <p>{t('mitarbeitende.beantragen_frist', { tage: fg.fristTage })}</p>}
        {fg.kriterien?.length ? <p>{t('mitarbeitende.beantragen_kriterien')} {fg.kriterien.map((k) => optionText('freigabeKriterien', k)).join(', ')}.</p> : null}
        <p class="zweitext">{t('mitarbeitende.beantragen_bis')}</p>
      </section>

      <section class="karte abschnitt" id="ma-melden" aria-labelledby="ma-melden-titel">
        <h2 id="ma-melden-titel">{t('mitarbeitende.melden_titel')}</h2>
        <p>{t('mitarbeitende.melden_text')}</p>
        {mw && (mw.kanaele.length > 0 || mw.kanal) ? (
          <ul>
            {mw.kanaele.map((k) => <li key={k}>{optionText('meldekanal', k)}</li>)}
            {mw.kanal && <li><strong>{mw.kanal}</strong></li>}
            {mw.ausweichstelle && <li>{t('mitarbeitende.ausweich', { wer: person(mw.ausweichstelle) })}</li>}
            {mw.vertraulich && <li>{t('mitarbeitende.vertraulich')}</li>}
          </ul>
        ) : <p class="ersatz">{t('mitarbeitende.melden_offen')}</p>}
      </section>

      <section class="karte abschnitt kein-druck" id="ma-mehr" aria-labelledby="ma-mehr-titel">
        <h2 id="ma-mehr-titel">{t('mitarbeitende.mehr_titel')}</h2>
        <ul>
          <li><a href={routeZuHash({ art: 'formular', modul: 'inventar' })}>{t('mitarbeitende.fragebogen')}</a></li>
          <li><a href={routeZuHash({ art: 'dokumente' })}>{t('mitarbeitende.richtlinie')}</a></li>
        </ul>
      </section>
    </div>
  );
}
