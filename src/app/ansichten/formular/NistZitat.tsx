// Originaltexte NIST (Modul NIST AI RMF): wörtliche Auszüge aus NIST AI 100-1 und NIST AI 600-1 (Englisch) mit eigener
// Übersetzung bei Oberflächensprache DE («Übersetzung KMU-CIO, nicht amtlich»), Vermerk «Republished courtesy of …» und
// Quelle mit Seite als Sprung ins beigelegte PDF (Rechtstexte_Legal-Texts/NIST-AI-RMF). Daten: src/nist-rmf/original-*.yaml.
// Verwendet im Profil (Formular und Guide), bei den Zusatz-Controls (Formular, E8-rmf), auf E3-merkmale, E9-messkonzept und
// E9-genai sowie im Hilfebereich (Seitenfeld «nist»).
import type { ComponentChildren, JSX } from 'preact';
import type { Kataloge, NistSeiten } from '../../../kataloge/typen.ts';
import { massnahmen600, nistZitat, zitatQuelle, type ZitatAngabe, type ZitatArt, type ZitatDok } from '../../../nist-rmf/original.ts';
import { appDaten } from '../../daten.ts';
import { inhalt, uiSprache } from '../../i18n.ts';

/** Texte der Anzeige aus src/i18n/<sprache>/nist.yaml (original.*) */
function tn(schluessel: string, werte?: Record<string, string | number>): string {
  return inhalt(schluessel, werte) ?? schluessel;
}

function kataloge(): Kataloge {
  return appDaten().kataloge;
}

/** Pfad zum beigelegten NIST-PDF mit Seitensprung (relativ zum Ordner des Werkzeugs) */
export function nistPdfHref(datei: string, seite: number): string {
  const ordner = (kataloge()['kitOrdner'] as { rechtstexte_nist?: string } | undefined)?.rechtstexte_nist ?? 'Rechtstexte_Legal-Texts/NIST-AI-RMF';
  return `../${ordner}/${datei}#page=${seite}`;
}

function Fundstelle({ z }: { z: ZitatAngabe }) {
  const text = z.bisSeite
    ? tn('nist.original.fundstelle_bis', { dokument: z.quelle.dokument, seite: z.seite, bis: z.bisSeite })
    : tn('nist.original.fundstelle', { dokument: z.quelle.dokument, seite: z.seite });
  return <a href={nistPdfHref(z.quelle.datei, z.seite)} target="_blank" rel="noopener">{text}</a>;
}

/** Vermerk, den NIST bei Nutzung seiner Inhalte erbittet */
export function NistVermerk({ dok, kinder }: { dok: ZitatDok; kinder?: ComponentChildren }) {
  const q = zitatQuelle(kataloge(), dok);
  if (!q) return null;
  return <p class="zweitext klein nist-vermerk" lang="en">{q.vermerk}{kinder}</p>;
}

const ZITAT_STIL = { margin: '8px 0', paddingLeft: '12px', borderLeft: '3px solid var(--linie, #c9ced6)' };

/** Ein Auszug: Originaltext (lang="en"), bei DE die Übersetzung, optional Vermerk und Fundstelle */
export function ZitatText({ z, mitQuelle = true, mitTitel = true }: { z: ZitatAngabe; mitQuelle?: boolean; mitTitel?: boolean }) {
  const de = uiSprache.value === 'de';
  return (
    <div class="nist-zitat" data-zitat={`${z.dok}:${z.id}`}>
      <blockquote lang="en" style={ZITAT_STIL}>
        <p style={{ margin: 0 }}>
          {mitTitel && z.titel && <strong>{z.titel}: </strong>}
          {z.zitat}
        </p>
      </blockquote>
      {de && (
        <p class="zweitext nist-uebersetzung" lang="de" style={{ margin: '0 0 8px' }}>
          <em>{tn('nist.original.uebersetzung')}:</em> {mitTitel && z.titelDe && <strong>{z.titelDe}: </strong>}
          {z.de}
        </p>
      )}
      {mitQuelle ? (
        <NistVermerk dok={z.dok} kinder={<> · <Fundstelle z={z} /></>} />
      ) : (
        <p class="zweitext klein" style={{ margin: '0 0 8px' }}><Fundstelle z={z} /></p>
      )}
    </div>
  );
}

/** Aufklappbarer Originaltext zu einer Funktion, Kategorie, Subkategorie, einem Merkmal, Risiko oder einer Massnahme */
export function NistOriginal({ art, id, offen }: { art: ZitatArt; id: string; offen?: boolean }) {
  const z = nistZitat(kataloge(), art, id);
  if (!z) return null;
  return (
    <details class="g-details nist-original" open={offen}>
      <summary>{tn('nist.original.aufklappen')}</summary>
      <ZitatText z={z} />
    </details>
  );
}

/** Liste von Auszügen mit Überschrift; ein Vermerk am Ende */
function ZitatListe({ titel, eintraege, dok, id }: { titel: string; eintraege: { kopf: string; z: ZitatAngabe }[]; dok: ZitatDok; id: string }) {
  if (!eintraege.length) return null;
  return (
    <details class="g-details nist-original" id={id}>
      <summary>{titel}</summary>
      {eintraege.map(({ kopf, z }) => (
        <div key={`${z.art}-${z.id}`}>
          <p style={{ margin: '8px 0 0' }}><span class="marke-id">{kopf}</span></p>
          <ZitatText z={z} mitQuelle={false} />
        </div>
      ))}
      <NistVermerk dok={dok} />
    </details>
  );
}

/** Zusatz-Control RMF-xx: Originaltexte der Subkategorien und der Massnahmen aus 600-1 (bezug_600_1) */
export function RmfControlOriginal({ id }: { id: string }) {
  const k = kataloge();
  const c = k.nistrmf_rmfControls?.controls.find((x) => x.id === id);
  if (!c) return null;
  const sub = c.subkategorien.map((s) => nistZitat(k, 'subkategorie', s)).filter((z): z is ZitatAngabe => z !== undefined);
  const mass = massnahmen600(k, c.bezug_600_1);
  if (!sub.length && !mass.length) return null;
  const nistId = (s: string) => k.nistrmf_subkategorien?.subkategorien.find((x) => x.id === s)?.nist_id ?? s;
  return (
    <details class="g-details nist-original" id={`rmf-original-${id}`}>
      <summary>{tn('nist.original.aufklappen')}</summary>
      {sub.length > 0 && <p style={{ margin: '4px 0' }}><strong>{tn('nist.original.subkategorien_control')}</strong></p>}
      {sub.map((z) => (
        <div key={z.id}>
          <p style={{ margin: '8px 0 0' }}><span class="marke-id">{z.id}</span> <span class="zweitext">{nistId(z.id)}</span></p>
          <ZitatText z={z} mitQuelle={false} />
        </div>
      ))}
      {mass.length > 0 && <p style={{ margin: '12px 0 4px' }}><strong>{tn('nist.original.massnahmen_600')}</strong></p>}
      {mass.map((z) => (
        <div key={z.id}>
          <p style={{ margin: '8px 0 0' }}><span class="marke-id">{z.id}</span></p>
          <ZitatText z={z} mitQuelle={false} />
        </div>
      ))}
      <NistVermerk dok={mass.length && !sub.length ? 'ai-600-1' : 'ai-100-1'} />
    </details>
  );
}

/** Originaltexte für Seiten des Guides mit Seitenfeld «nist» (merkmale, messen, risiken) */
export function NistSeitenOriginal({ schluessel }: { schluessel?: string[] }) {
  if (!schluessel?.length) return null;
  const k = kataloge();
  const teile: JSX.Element[] = [];
  if (schluessel.includes('merkmale')) {
    const e = (k.nistrmf_original1001?.merkmale ?? []).map((m) => ({ kopf: `${m.abschnitt}`, z: nistZitat(k, 'merkmal', m.id)! }));
    teile.push(<ZitatListe key="merkmale" id="nist-original-merkmale" titel={tn('nist.original.merkmale')} eintraege={e} dok="ai-100-1" />);
  }
  if (schluessel.includes('messen')) {
    const e = (k.nistrmf_subkategorien?.subkategorien ?? []).filter((s) => s.kategorie === 'MS-2').map((s) => ({ kopf: `${s.id} ${s.nist_id}`, z: nistZitat(k, 'subkategorie', s.id)! })).filter((x) => x.z);
    teile.push(<ZitatListe key="messen" id="nist-original-messen" titel={tn('nist.original.messen')} eintraege={e} dok="ai-100-1" />);
  }
  if (schluessel.includes('risiken')) {
    const e = [...(k.nistrmf_original6001?.risiken ?? [])].sort((a, b) => a.nr - b.nr).map((r) => ({ kopf: `${r.nr}`, z: nistZitat(k, 'risiko', r.id)! }));
    teile.push(<ZitatListe key="risiken" id="nist-original-risiken" titel={tn('nist.original.risiken')} eintraege={e} dok="ai-600-1" />);
  }
  return teile.length ? <div class="nist-seiten-original">{teile}</div> : null;
}

/** Sprunglinks des Hilfebereichs ins beigelegte PDF (Seitenfeld «nist»: kern, merkmale, messen, risiken, massnahmen) */
export function nistNachlesen(schluessel: string[] | undefined): { text: string; href: string }[] {
  if (!schluessel?.length) return [];
  const k = kataloge();
  const seiten = k['nistrmf_seiten'] as NistSeiten | undefined;
  const q100 = zitatQuelle(k, 'ai-100-1');
  const q600 = zitatQuelle(k, 'ai-600-1');
  const ziel: Record<string, { dok: ZitatDok; seite: number | undefined }> = {
    kern: { dok: 'ai-100-1', seite: seiten?.['ai-100-1']['GV-1'] },
    merkmale: { dok: 'ai-100-1', seite: k.nistrmf_original1001?.merkmale[0]?.seite },
    messen: { dok: 'ai-100-1', seite: seiten?.['ai-100-1']['MS-2'] },
    risiken: { dok: 'ai-600-1', seite: k.nistrmf_original6001?.risiken[0]?.seite },
    massnahmen: { dok: 'ai-600-1', seite: Math.min(...(k.nistrmf_original6001?.massnahmen ?? []).map((m) => m.seite)) },
  };
  const was: Record<string, string> = { kern: 'tabellen', merkmale: 'merkmale', messen: 'messen', risiken: 'risiken', massnahmen: 'massnahmen' };
  return schluessel.flatMap((s) => {
    const z = ziel[s];
    const q = z?.dok === 'ai-100-1' ? q100 : q600;
    if (!z || !q || !z.seite || !Number.isFinite(z.seite)) return [];
    return [{ text: tn(z.dok === 'ai-100-1' ? 'nist.original.nachlesen_100' : 'nist.original.nachlesen_600', { seite: z.seite, was: tn(`nist.original.was.${was[s]}`) }), href: nistPdfHref(q.datei, z.seite) }];
  });
}
