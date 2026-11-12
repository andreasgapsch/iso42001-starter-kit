// Live-Vorschau des entstehenden Dokuments. Startet den Generator-Worker erst beim Aufklappen (Startzeit).
import { useEffect, useState } from 'preact/hooks';
import type { DocxDokument, XlsxMappe } from '../../../generator/ir.ts';
import type { Projekt } from '../../../model/typen.ts';
import { inhalt, t } from '../../i18n.ts';
import { IrVorschau } from '../../ui/IrVorschau.tsx';
import { erzeugeIr } from '../../worker/client.ts';
import { fehlerVerstaendlich } from '../../worker/fehlertext.ts';

export function LiveVorschau({ p, vorlage }: { p: Projekt; vorlage: string }) {
  // Dokumente eines ausgeschalteten Moduls gibt es für dieses Projekt nicht (C-28)
  if (/^E-/.test(vorlage) && !p.meta.modulAiAct) return null;
  const [offen, setOffen] = useState(false);
  const [ir, setIr] = useState<DocxDokument | XlsxMappe | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    if (!offen) return;
    let gueltig = true;
    const timer = setTimeout(() => {
      const kiSystem = p.kiSysteme[0]?.id;
      erzeugeIr(p, p.meta.dokumentSprache, vorlage, kiSystem).then(
        (r) => {
          if (!gueltig) return;
          setIr(r.ir);
          setFehler(r.ir ? null : fehlerVerstaendlich(r.fehler ?? ''));
        },
        (e: unknown) => gueltig && setFehler(fehlerVerstaendlich(e)),
      );
    }, 600);
    return () => {
      gueltig = false;
      clearTimeout(timer);
    };
  }, [offen, p, vorlage]);
  return (
    <details class="karte kein-druck" onToggle={(e) => setOffen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary><strong>{t('vorschau.titel', { id: vorlage, titel: inhalt(`dokumente.${vorlage}.titel`) ?? '' })}</strong></summary>
      <p class="zweitext">{t('vorschau.hinweis')}</p>
      {fehler !== null && <p class="ersatz">{t('vorschau.nicht_verfuegbar')}{fehler && <><br /><span class="zweitext">{fehler}</span></>}</p>}
      {ir && fehler === null && <div class="vorschau"><IrVorschau ir={ir} /></div>}
      {!ir && fehler === null && offen && <p class="zweitext" role="status">{t('vorschau.laedt')}</p>}
    </details>
  );
}
