// Vorschlagsliste für das Risikoregister (Seitentyp «vorschlaege»): GenAI-Sicherheit GS-01 bis GS-22 (D-07, Katalog
// src/kataloge/genai-risiken.yaml). Übernahme je KI-System mit generativer KI als normales Risiko (Titel, Quelle,
// Ursache, Folge, Folgenebenen); Bewertung und Behandlung folgen im Register. Einträge mit nur_handelnd (handelnde KI)
// erscheinen nur für Systeme mit Handlungsbefugnis ab «bereitet vor» oder Gedächtnis; mit Modul NIST AI RMF zeigt die
// Liste zusätzlich die Zusatz-Controls RMF-Gxx der verwandten Risiken nach NIST AI 600-1.
import { useState } from 'preact/hooks';
import { HANDLUNGSBEFUGNISSE, type KiSystem, type Projekt } from '../../../model/typen.ts';
import { appDaten } from '../../daten.ts';
import { inhalt, inhaltRoh, optionText, t } from '../../i18n.ts';
import { neuerEintrag } from '../../logik/eintraege.ts';
import { routeZuHash, type Route } from '../../logik/routen.ts';
import { RichText } from '../../ui/RichText.tsx';
import { aendereMit, melde } from '../../zustand/store.ts';
import { Auswahl } from '../../ui/Auswahl.tsx';
import { StatusPille } from '../../ui/StatusPille.tsx';
import { Hinweis } from '../../ui/Hinweis.tsx';

export interface KatalogVorschlag {
  id: string;
  titel: string;
  ursache: string;
  folge: string;
  quelle: string;
  ebenen: string[];
  /** Zusatzangaben für die Anzeige: typische Massnahmen, Controls, Zielgruppe, Herkunft */
  massnahmen: string[];
  controls: string[];
  etiketten: string[];
  verweis: string;
  /** Nur für handelnde KI oder Systeme mit Gedächtnis (Katalogfeld nur_handelnd) */
  nurHandelnd: boolean;
  /** Verwandte Risiken nach NIST AI 600-1 (IDs gai-…) */
  nist: string[];
}

/** System bereitet Aktionen vor oder führt sie aus oder hat ein Gedächtnis über Sitzungen */
export const handelndeKi = (s: Pick<KiSystem, 'handlungsbefugnis' | 'gedaechtnis'>): boolean =>
  s.gedaechtnis === true || (!!s.handlungsbefugnis && HANDLUNGSBEFUGNISSE.indexOf(s.handlungsbefugnis) >= 2);

const texte = (schluessel: string): string[] => {
  const r = inhaltRoh(schluessel);
  return Array.isArray(r) ? r.map(String) : [];
};

/** Einträge eines Vorschlagskatalogs in der Sprache der Oberfläche. */
export function katalogVorschlaege(katalog: string): KatalogVorschlag[] {
  const k = appDaten().kataloge;
  if (katalog === 'genaiRisiken') {
    const liste = (k['genaiRisiken'] as { risiken?: { id: string; owasp?: string; quelle: string; ebenen: string[]; controls: string[]; zielgruppe: string[]; nur_handelnd?: boolean; nist_600_1?: string[] }[] } | undefined)?.risiken ?? [];
    return liste.map((r) => ({
      id: r.id,
      titel: inhalt(`genai-risiken.${r.id}.titel`) ?? r.id,
      ursache: inhalt(`genai-risiken.${r.id}.ursache`) ?? '',
      folge: inhalt(`genai-risiken.${r.id}.folge`) ?? '',
      quelle: r.quelle,
      ebenen: r.ebenen,
      massnahmen: texte(`genai-risiken.${r.id}.massnahmen`),
      controls: r.controls,
      etiketten: r.zielgruppe.map((z) => inhalt(`genai-risiken.zielgruppe.${z}`) ?? z),
      verweis: r.owasp ? `OWASP ${r.owasp}` : (inhalt('genai-risiken.eigener_vorschlag') ?? ''),
      nurHandelnd: r.nur_handelnd === true,
      nist: r.nist_600_1 ?? [],
    }));
  }
  return [];
}

/** Kennzeichen in der Beschreibung des übernommenen Risikos, z. B. «Vorschlag GS-01 (OWASP LLM01:2026)». */
const kennzeichen = (v: KatalogVorschlag) => t('vorschlaege.kennzeichen', { id: v.id, verweis: v.verweis });

/**
 * Bereits übernommenes Risiko für Vorschlag und System: Feld vorschlag am Risiko, als Rückfall für ältere Projekte das
 * Kennzeichen «GS-01 (» in der Beschreibung.
 */
export function uebernommenesRisiko(p: Pick<Projekt, 'risiken'>, v: Pick<KatalogVorschlag, 'id'>, system: string): string | undefined {
  const je = p.risiken.filter((r) => r.kiSystem === system);
  return (je.find((r) => r.vorschlag === v.id) ?? je.find((r) => !r.vorschlag && r.beschreibung.includes(`${v.id} (`)))?.id;
}

export function vorschlagAlsRisiko(v: KatalogVorschlag, system: string): string {
  let id = '';
  aendereMit((p) => {
    // Eigner/in des KI-Systems als Vorbelegung: Die nächste Seite hat dieses Feld nicht (C2-04)
    const eigner = p.kiSysteme.find((s) => s.id === system)?.eigner;
    const r = neuerEintrag(p, 'risiken', {
      ...(eigner ? { eigner } : {}),
      art: 'risiko', status: 'offen', titel: v.titel, quelle: v.quelle, ebenen: v.ebenen, ursache: v.ursache, folge: v.folge, kiSystem: system,
      beschreibung: kennzeichen(v), vorschlag: v.id,
      // Die Controls des Vorschlags gehören zum Risiko: Sonst bleibt die Spalte «Vorschlag» der SoA leer (C-06)
      controls: v.controls,
    });
    id = String(r['id']);
    p.risiken.push(r as never);
  });
  return id;
}

export function KatalogVorschlaege({ p, katalog, risikoRoute }: { p: Projekt; katalog: string; risikoRoute: (id: string) => Route }) {
  const systeme = p.kiSysteme.filter((s) => s.generativ === true && s.status !== 'abgeloest' && s.status !== 'untersagt');
  const [wahl, setWahl] = useState<string>(systeme[0]?.id ?? '');
  const system = systeme.find((s) => s.id === wahl) ?? systeme[0];
  if (!system) return <p class="ersatz" id="vorschlaege-leer">{t('vorschlaege.keine_systeme')}</p>;
  // Zusatz-Controls RMF-Gxx der verwandten GenAI-Risiken (nur mit Modul NIST AI RMF)
  const gai = p.meta.modulNistRmf ? ((appDaten().kataloge['nistrmf_genaiRisiken'] as { risiken?: { id: string; controls: string[] }[] } | undefined)?.risiken ?? []) : [];
  const rmfG = (v: KatalogVorschlag) => [...new Set(v.nist.flatMap((id) => gai.find((r) => r.id === id)?.controls ?? []).filter((c) => c.startsWith('RMF-G')))];
  const liste = katalogVorschlaege(katalog).filter((v) => !v.nurHandelnd || handelndeKi(system));
  const offen = liste.filter((v) => !uebernommenesRisiko(p, v, system.id)).length;
  return (
    <div id={`vorschlaege-${katalog}`}>
      <div class="feld">
        <label for="vorschlaege-system">{t('vorschlaege.system')}</label>
        <Auswahl id="vorschlaege-system" value={system.id} onChange={(e) => setWahl(e.currentTarget.value)} style={{ maxWidth: '420px' }}>
          {systeme.map((s) => <option key={s.id} value={s.id}>{s.id} {s.name}</option>)}
        </Auswahl>
        <p class="zweitext" aria-live="polite">{t('vorschlaege.stand', { offen, gesamt: liste.length })}</p>
      </div>
      <h2 class="nur-sr">{t('gefuehrt.eintraege_titel')}</h2>
      {liste.map((v) => {
        const risiko = uebernommenesRisiko(p, v, system.id);
        return (
          <section class="eintrag" key={v.id} id={`vorschlag-${v.id}`}>
            <h3 id={`vorschlag-${v.id}-titel`}>
              <span class="marke-id">{v.id}</span> <span>{v.titel}</span>
              {v.etiketten.map((e) => <StatusPille key={e} art="neutral">{e}</StatusPille>)}
            </h3>
            {v.ursache && <p><strong>{t('vorschlaege.ursache')}:</strong> {v.ursache}</p>}
            {v.folge && <p><strong>{t('vorschlaege.folge')}:</strong> {v.folge}</p>}
            {v.massnahmen.length > 0 && (
              <details>
                <summary>{t('vorschlaege.massnahmen')}</summary>
                <ul>{v.massnahmen.map((m) => <li key={m}><RichText text={m} als="span" /></li>)}</ul>
              </details>
            )}
            <p class="zweitext">
              {t('vorschlaege.quelle_text', { quelle: optionText('risikoquelle', v.quelle) })}
              {v.controls.length > 0 && <> · {t('vorschlaege.controls', { controls: [...v.controls, ...rmfG(v)].join(', ') })}</>} · {v.verweis}
              {v.nist.length > 0 && p.meta.modulNistRmf && <> · {t('vorschlaege.nist', { risiken: v.nist.join(', ') })}</>}
            </p>
            {risiko ? (
              <Hinweis als="p" art="ok">
                {t('vorschlaege.uebernommen', { id: risiko })} <a href={routeZuHash(risikoRoute(risiko))}>{t('vorschlaege.oeffnen')}</a>
              </Hinweis>
            ) : (
              <button type="button" class="klein" id={`vorschlag-${v.id}-uebernehmen`} onClick={() => melde(`${t('vorschlaege.angelegt', { id: vorschlagAlsRisiko(v, system.id), system: system.id })}${v.controls.length ? ` ${t('vorschlaege.controls_uebernommen', { controls: v.controls.join(', ') })}` : ''}`, 'ok')}>
                {t('vorschlaege.als_risiko')}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
