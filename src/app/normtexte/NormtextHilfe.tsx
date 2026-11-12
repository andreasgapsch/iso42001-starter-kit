// Hilfebereich: Wortlaut der genannten Abschnitte und Controls aus der eigenen Normausgabe (nur wenn geladen).
import { idsAusNormbezug, normEintrag } from '../../normtexte/aufloesung.ts';
import type { NormArt, NormId } from '../../normtexte/typen.ts';
import { appDaten } from '../daten.ts';
import { t, uiSprache } from '../i18n.ts';
import { normErlaeuterung, normpaket, normtextFremdsprache, normTitel } from './zustand.ts';
import { StatusPille } from '../ui/StatusPille.tsx';

/** Kennzeichnung «Normtext Englisch», wenn der angezeigte Normtext aus der anderen Sprache stammt (Rückfall-Regel). */
export function NormtextSprache({ id, art = 'text' }: { id: NormId; art?: NormArt }) {
  const s = normtextFremdsprache(id, art);
  if (!s) return null;
  return <StatusPille art="neutral" klasse="normtext-sprache" data-sprache={s}>{t(`normtexte.sprache_marke_${s}`)}</StatusPille>;
}

export function NormtextHilfe({ normbezug }: { normbezug: string }) {
  const teile = normpaket.value.teile;
  if (!teile.length) return null;
  const k = appDaten().kataloge;
  const bekannt = [...k.anforderungen42001.kapitel.flatMap((x) => x.abschnitte.map((a) => a.id)), ...k.controls42001.gruppen.flatMap((g) => g.controls.map((c) => c.id))];
  const ids = idsAusNormbezug(normbezug, bekannt).filter((id) => normEintrag(teile, id, uiSprache.value)?.eintrag.text);
  if (!ids.length) return null;
  const quelle = normEintrag(teile, ids[0]!, uiSprache.value)?.teil.bezeichnung ?? '';
  return (
    <details class="g-details normtext-hilfe">
      <summary>{t('normtexte.hilfe_normtext')}</summary>
      {ids.map((id) => {
        const fremd = normtextFremdsprache(id);
        return (
          <div key={id} {...(fremd ? { lang: fremd } : {})}>
            <p><strong>{id.replace(/^K-/, '')} {normTitel(id)}</strong> <NormtextSprache id={id} /></p>
            {(normErlaeuterung(id) ?? '').split('\n').map((z, i) => <p key={i}>{z}</p>)}
          </div>
        );
      })}
      <p class="zweitext">{t('normtexte.quelle_app', { bezeichnung: quelle })}</p>
    </details>
  );
}
