// Formularmodul NIST AI RMF (nur mit Modul): Profil Ist und Ziel je Subkategorie, Zusatz-Controls RMF-xx übernehmen
// oder begründet ablehnen (je Control aufklappbar die Originaltexte NIST: Subkategorien und Massnahmen aus 600-1), Stand der Fassung. Ausgeschaltet bleiben alle Angaben in der Projektdatei erhalten.
import { useState } from 'preact/hooks';
import type { Projekt } from '../../../model/typen.ts';
import { rmfControls } from '../../daten.ts';
import { inhalt, t } from '../../i18n.ts';
import { REITER, routeZuHash } from '../../logik/routen.ts';
import { soaVorschlaege } from '../../logik/vorschlaege.ts';
import { RichText } from '../../ui/RichText.tsx';
import { melde } from '../../zustand/store.ts';
import { NistProfil, NistStandAnzeige } from '../gefuehrt/NistProfil.tsx';
import { RmfControlOriginal } from './NistZitat.tsx';
import { entscheideZusatzControl } from './AiAct.tsx';
import { ReiterModul } from './Reiter.tsx';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { ENTSCHEID_ART, StatusPille } from '../../ui/StatusPille.tsx';

function Controls({ p }: { p: Projekt }) {
  const [ablehnen, setAblehnen] = useState<string | null>(null);
  const [grund, setGrund] = useState('');
  const vorschlaege = soaVorschlaege(p, [], rmfControls()).filter((v) => v.grund === 'nistrmf');
  const entschieden = p.controls.filter((c) => c.rahmenwerk === 'NISTRMF' && !vorschlaege.some((v) => v.id === c.id));
  const liste = [...vorschlaege.map((v) => ({ id: v.id, quellen: v.quellen })), ...entschieden.map((c) => ({ id: c.id, quellen: [] as string[] }))];
  if (liste.length === 0) return <p class="ersatz">{t('nist.keine_vorschlaege')}</p>;
  return (
    <div>
      <p class="zweitext">{t('nist.vorschlaege_text')}</p>
      {liste.map(({ id, quellen }) => {
        const c = p.controls.find((x) => x.id === id);
        const status = !c || c.anwendbar === 'offen' ? 'offen' : c.anwendbar;
        return (
          <section class="karte abschnitt" key={id} id={`rmf-${id}`} aria-labelledby={`rmf-${id}-titel`}>
            <h3 id={`rmf-${id}-titel`}><span class="marke-id">{id}</span> {inhalt(`nist.controls.${id}.titel`) ?? ''}</h3>
            <RichText text={inhalt(`nist.controls.${id}.zweck`)} />
            <RmfControlOriginal id={id} />
            {quellen.length > 0 && <p class="zweitext">{t('aiact.ausgeloest', { systeme: quellen.map((q) => `${q} ${p.kiSysteme.find((s) => s.id === q)?.name ?? ''}`.trim()).join(', ') })}</p>}
            <p>
              <StatusPille art={ENTSCHEID_ART[status] ?? 'neutral'}>{t(`aiact.entscheid.${status}`)}</StatusPille>
              {c?.begruendung && <span class="zweitext"> {c.begruendung}</span>}
            </p>
            {ablehnen === id ? (
              <div class="feld">
                <label for={`rmf-grund-${id}`}>{t('aiact.ablehnen_grund')}</label>
                <textarea id={`rmf-grund-${id}`} value={grund} onInput={(e) => setGrund(e.currentTarget.value)} rows={3} />
                <div class="leiste">
                  <button type="button" disabled={!grund.trim()} onClick={() => { entscheideZusatzControl(id, 'nein', grund.trim(), 'nistrmf'); setAblehnen(null); setGrund(''); }}>{t('aiact.ablehnen_bestaetigen')}</button>
                  <button type="button" class="leise" onClick={() => setAblehnen(null)}>{t('allgemein.abbrechen')}</button>
                </div>
              </div>
            ) : (
              <div class="leiste">
                {status !== 'ja' && (
                  <button type="button" id={`rmf-uebernehmen-${id}`} onClick={() => {
                    entscheideZusatzControl(id, 'ja', c?.begruendung?.trim() && c.anwendbar === 'ja' ? c.begruendung : t('soa.begruendung_nistrmf', { quellen: quellen.join(', ') || id }), 'nistrmf');
                    melde(t('aiact.uebernommen', { id }), 'ok');
                  }}>{t('aiact.in_soa')}</button>
                )}
                {status !== 'nein' && <button type="button" onClick={() => { setAblehnen(id); setGrund(''); }}>{t('aiact.ablehnen')}</button>}
                <a class="knopf leise" href={routeZuHash({ art: 'formular', modul: 'soa', id })}>{t('aiact.in_soa_oeffnen')}</a>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function NistRmfModul({ p, reiter, fokus }: { p: Projekt; reiter?: string; fokus?: string }) {
  const alle = REITER.nistrmf!;
  const r = alle.includes(reiter ?? '') ? reiter! : 'profil';
  if (!p.meta.modulNistRmf) {
    return (
      <div class="inhalt">
        <Seitenkopf titel={t('module.nistrmf')} aktion={<a class="knopf primaer" href={routeZuHash({ art: 'einstellungen', bereich: 'projekt' })}>{t('navi.einstellungen')}</a>} />
        <p class="ersatz">{t('nist.modul_aus')}</p>
      </div>
    );
  }
  return (
    <ReiterModul modul="nistrmf" titel={t('module.nistrmf')} einleitung={t('module.nistrmf_text')} reiter={alle.map((id) => ({ id, text: t(`reiter.nistrmf.${id}`) }))} aktiv={r}>
      {r === 'controls' ? <Controls p={p} /> : r === 'stand' ? <NistStandAnzeige /> : <NistProfil p={p} fokus={fokus} />}
    </ReiterModul>
  );
}
