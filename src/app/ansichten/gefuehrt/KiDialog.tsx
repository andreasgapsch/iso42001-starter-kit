// Dialog «Mit KI vertiefen»: zeigt die Anfrage, vertrauliche Angaben lassen sich abwählen, dann kopieren.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Projekt } from '../../../model/typen.ts';
import { inhalt, optionText, t } from '../../i18n.ts';
import type { EtappeDef, SeiteDef } from '../../logik/gefuehrt-typen.ts';
import { aktiveFelder, feldWert, seitenEintraege, type SeitenEintrag } from '../../logik/gefuehrt.ts';
import { baueprompt, wertText, type PromptFeld } from '../../logik/prompt.ts';
import { feldLabel } from '../../ui/Feld.tsx';
import { melde, umfeld } from '../../zustand/store.ts';

const VERTRAULICH = /name|eigner|verantwortlich|person|freigabe|lieferant|ablageort|standorte|auditor|teilnehmende/i;

export function KiDialog({ etappe, seite, projekt, schliessen }: { etappe: EtappeDef; seite: SeiteDef; projekt: Projekt; schliessen: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const basis = `gefuehrt.${etappe.id}.${seite.id}.felder`;
  const felder = useMemo(() => {
    const r: PromptFeld[] = [];
    const add = (e: SeitenEintrag | undefined) => {
      for (const f of aktiveFelder(seite, projekt, e?.objekt)) {
        const v = feldWert(f, projekt, e);
        let w = wertText(v);
        if (f.optionen && typeof v === 'string') w = optionText(f.optionen, v);
        const label = `${e ? `${e.id}: ` : ''}${feldLabel(f, basis)}`;
        r.push({ schluessel: `${e?.id ?? ''}|${f.pfad ?? f.schluessel}`, label, wert: w, vertraulich: VERTRAULICH.test(f.pfad ?? '') || f.typ === 'person' || f.typ === 'freigabe' });
      }
    };
    if (seite.typ === 'formular') add(undefined);
    else for (const e of seitenEintraege(seite, projekt, umfeld.value).slice(0, 30)) add(e);
    return r;
  }, [seite.id]);
  const firma = [
    { label: t('ki.firma_name'), wert: projekt.organisation.name },
    { label: t('ki.firma_branche'), wert: optionText('branche', projekt.organisation.branche) },
    { label: t('ki.firma_groesse'), wert: projekt.organisation.mitarbeitende === null ? '' : String(projekt.organisation.mitarbeitende) },
    { label: t('ki.firma_pfad'), wert: t(projekt.meta.mitIsms ? 'pfad.mit_isms' : 'pfad.ohne_isms') },
    { label: t('ki.firma_modul'), wert: t(projekt.meta.modulAiAct ? 'modul.ein' : 'modul.aus') },
  ];
  const [ab, setAb] = useState<Set<string>>(() => new Set([`firma.${t('ki.firma_name')}`, ...felder.filter((f) => f.vertraulich).map((f) => f.schluessel)]));
  const text = baueprompt({
    einleitung: t('ki.einleitung'),
    seite: { titel: inhalt(`gefuehrt.${etappe.id}.${seite.id}.titel`) ?? seite.id, frage: inhalt(`gefuehrt.${etappe.id}.${seite.id}.frage`), norm: seite.norm, vorlage: seite.vorlage },
    firma,
    felder,
    auftrag: t('ki.auftrag'),
    abgewaehlt: ab,
    labels: { seite: t('ki.l_seite'), frage: t('ki.l_frage'), norm: t('ki.l_norm'), vorlage: t('ki.l_vorlage'), firma: t('ki.l_firma'), angaben: t('ki.l_angaben'), leer: t('ki.l_leer'), auftrag: t('ki.l_auftrag') },
  });
  const umschalten = (k: string) => {
    const n = new Set(ab);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    setAb(n);
  };
  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(text);
      melde(t('ki.kopiert'), 'ok');
      ref.current?.close();
    } catch {
      melde(t('ki.kopieren_fehler'), 'fehler');
    }
  };
  return (
    <dialog ref={ref} onClose={schliessen} aria-labelledby="ki-titel">
      <h2 id="ki-titel">{t('ki.titel')}</h2>
      <p>{t('ki.dialog_hinweis')}</p>
      <fieldset>
        <legend>{t('ki.mitsenden')}</legend>
        <div class="auswahlbox">
          {[...firma.map((f) => ({ schluessel: `firma.${f.label}`, label: f.label })), ...felder].map((f) => (
            <label class="check" key={f.schluessel}>
              <input type="checkbox" checked={!ab.has(f.schluessel)} onChange={() => umschalten(f.schluessel)} />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <h3 style={{ marginTop: '12px' }}>{t('ki.vorschau')}</h3>
      <textarea readOnly rows={10} value={text} aria-label={t('ki.vorschau')} />
      <div class="leiste ende" style={{ marginTop: '12px' }}>
        <button type="button" onClick={() => ref.current?.close()}>{t('allgemein.abbrechen')}</button>
        <button type="button" class="primaer" onClick={() => void kopieren()}>{t('ki.kopieren')}</button>
      </div>
    </dialog>
  );
}
