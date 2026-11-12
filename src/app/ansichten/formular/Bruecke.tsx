// ISO 27001-Brücke: Zuordnung 42001 zu 27001 als Ansicht, Wiederverwendungsgrad, ISMS-Dokumente mit Ergänzungsblatt.
import { useState } from 'preact/hooks';
import type { Projekt } from '../../../model/typen.ts';
import { appDaten, controlIds42001 } from '../../daten.ts';
import { dokumentTitelUi, inhalt, optionText, t } from '../../i18n.ts';
import { NUR_ALS_EB_MIT_ISMS } from '../../../vorlagen/kontext.ts';
import { ergaenzungsblaetterKatalog, staerksteEntsprechung, vorgeschlagene27001, wiederverwendung, zuordnungen, type Staerke } from '../../logik/bruecke.ts';
import { REITER, routeZuHash } from '../../logik/routen.ts';
import { aendereMit, melde } from '../../zustand/store.ts';
import { ReiterModul } from './Reiter.tsx';
import { normTitel } from '../../normtexte/zustand.ts';
import { Auswahl } from '../../ui/Auswahl.tsx';
import { STAERKE_ART, StatusPille } from '../../ui/StatusPille.tsx';
import { Hinweis } from '../../ui/Hinweis.tsx';

const prozent = (x: number) => `${Math.round(x * 100)} %`;

function Kennzahl({ wert, text, id }: { wert: string; text: string; id: string }) {
  return (
    <div class="kennzahl" id={id}>
      <strong>{wert}</strong>
      <span>{text}</span>
    </div>
  );
}

/** Verknüpft die starken und mittleren 27001-Entsprechungen mit allen anwendbaren 42001-Controls ohne Verknüpfung. */
function verknuepfeVorschlaege(): number {
  const k = appDaten().kataloge;
  let n = 0;
  aendereMit((p) => {
    for (const c of p.controls) {
      if (c.rahmenwerk !== 'ISO42001' || c.anwendbar !== 'ja' || c.iso27001.length) continue;
      const v = vorgeschlagene27001(k, c.id);
      if (v.length) {
        c.iso27001 = v;
        n++;
      }
    }
  });
  return n;
}

function Mapping({ p }: { p: Projekt }) {
  const k = appDaten().kataloge;
  const [filter, setFilter] = useState<'' | Staerke>('');
  const ids = controlIds42001();
  const w = wiederverwendung(k, ids, p);
  const karte = new Map(zuordnungen(k).map((z) => [z.id, z]));
  const zeilen = ids.filter((id) => !filter || staerksteEntsprechung(karte.get(id)) === filter);
  return (
    <div>
      <p class="zweitext">{inhalt('mapping.hinweis') ?? ''}</p>
      {!p.meta.mitIsms && <Hinweis als="p">{t('bruecke.ohne_isms')} <a href={routeZuHash({ art: 'einstellungen' })}>{t('navi.einstellungen')}</a></Hinweis>}
      <div class="kennzahlen">
        <Kennzahl id="wv-grad" wert={prozent(w.grad)} text={t('bruecke.grad')} />
        <Kennzahl id="wv-hoch" wert={`${w.hoch} / ${w.gesamt}`} text={t('bruecke.hoch')} />
        <Kennzahl id="wv-mittel" wert={`${w.mindestensMittel} / ${w.gesamt}`} text={t('bruecke.mittel')} />
        <Kennzahl id="wv-projekt" wert={w.anwendbar ? prozent(w.verknuepft / w.anwendbar) : '0 %'} text={t('bruecke.projekt', { verknuepft: w.verknuepft, anwendbar: w.anwendbar })} />
      </div>
      <p class="zweitext">{t('bruecke.grad_erklaerung')}</p>
      {p.meta.mitIsms && w.verknuepft < w.anwendbar && (
        <p><button type="button" onClick={() => melde(t('bruecke.verknuepft_meldung', { anzahl: verknuepfeVorschlaege() }), 'ok')}>{t('bruecke.verknuepfen')}</button></p>
      )}
      <div class="leiste">
        <label for="bruecke-filter">{t('bruecke.filter')}</label>
        <Auswahl id="bruecke-filter" class="schmal" value={filter} onChange={(e) => setFilter(e.currentTarget.value as '' | Staerke)}>
          <option value="">{t('bruecke.alle')}</option>
          {(['hoch', 'mittel', 'tief'] as const).map((s) => <option key={s} value={s}>{t(`bruecke.staerke.${s}`)}</option>)}
        </Auswahl>
      </div>
      <div class="tabelle-feld">
        <table>
          <caption class="nur-sr">{t('reiter.brucke27001.mapping')}</caption>
          <thead><tr><th scope="col">{t('bruecke.control42001')}</th><th scope="col">{t('bruecke.control27001')}</th><th scope="col">{t('bruecke.im_projekt')}</th></tr></thead>
          <tbody>
            {zeilen.map((id) => {
              const z = karte.get(id);
              const c = p.controls.find((x) => x.id === id);
              return (
                <tr key={id}>
                  <td><a href={routeZuHash({ art: 'formular', modul: 'soa', id })}><strong>{id}</strong></a> {normTitel(id) ?? ''}</td>
                  <td>
                    {(z?.verwandt ?? []).length === 0 ? <span class="zweitext">{t('bruecke.keine')}</span> : (
                      <ul class="schlicht">
                        {z!.verwandt.map((v) => (
                          <li key={v.control}>
                            <StatusPille art={STAERKE_ART[v.staerke] ?? 'neutral'}>{t(`bruecke.staerke.${v.staerke}`)}</StatusPille> {v.control.replace(/^27001-/, '')} {normTitel(v.control) ?? ''}
                            <br /><span class="zweitext">{inhalt(`mapping.begruendung.${v.begruendung}`) ?? ''}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td>{c ? `${optionText('jaNeinOffen', c.anwendbar)}${c.iso27001.length ? ` · ${c.iso27001.map((x) => x.replace(/^27001-/, '')).join(', ')}` : ''}` : t('liste.offen')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Dokumente({ p }: { p: Projekt }) {
  const blaetter = ergaenzungsblaetterKatalog(appDaten().kataloge);
  return (
    <div>
      <p class="zweitext">{t('bruecke.dokumente_text')}</p>
      {!p.meta.mitIsms && <Hinweis als="p">{t('bruecke.ohne_isms')}</Hinweis>}
      <div class="tabelle-feld">
        <table>
          <caption class="nur-sr">{t('reiter.brucke27001.dokumente')}</caption>
          <thead><tr><th scope="col">{t('bruecke.isms_dokument')}</th><th scope="col">{t('bruecke.blatt')}</th><th scope="col">{t('bruecke.normbezug')}</th><th scope="col">{t('liste.status')}</th></tr></thead>
          <tbody>
            {blaetter.map((b) => {
              const e = p.dokumente.find((d) => d.id === b.id);
              return (
                <tr key={b.id}>
                  <td>{inhalt(`ergaenzungsblaetter.ismsDokumente.${b.ismsDokument}`) ?? b.ismsDokument}<br /><span class="zweitext">{[...(b.iso27001Kapitel ?? []).map((x) => t('bruecke.kapitel27001', { abschnitt: x })), ...b.iso27001.map((x) => x.replace(/^27001-/, 'ISO/IEC 27001 '))].join(', ')}</span></td>
                  <td><strong>{b.id}</strong> {dokumentTitelUi(b.id)}{!NUR_ALS_EB_MIT_ISMS.has(b.vorlage) && <><br /><span class="zweitext">{t('bruecke.zu', { id: b.vorlage, titel: inhalt(`dokumente.${b.vorlage}.titel`) ?? '' })}</span></>}</td>
                  <td>{b.normbezug.map((x) => x.replace(/^K-/, '')).join(', ')}</td>
                  <td>{e ? optionText('dokumentStatus', e.status) : <a href={routeZuHash({ art: 'formular', modul: 'dokumente', id: b.id })}>{t('bruecke.erfassen')}</a>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BrueckeModul({ p, reiter }: { p: Projekt; reiter?: string }) {
  const alle = REITER.brucke27001!;
  const r = alle.includes(reiter ?? '') ? reiter! : 'mapping';
  return (
    <ReiterModul modul="brucke27001" titel={t('module.brucke27001')} einleitung={t('module.brucke27001_text')} reiter={alle.map((id) => ({ id, text: t(`reiter.brucke27001.${id}`) }))} aktiv={r}>
      {r === 'dokumente' ? <Dokumente p={p} /> : <Mapping p={p} />}
    </ReiterModul>
  );
}

