// Hilfebereich neben jeder Frage: Warum, Beispielantwort (Muster Maschinenbau AG) mit «als Vorlage übernehmen»,
// typische Fehler, Begriffe, Verweise (Normabschnitt, Kit-Vorlage, Leitfaden, AI-Act-Artikel und NIST-Dokumente im beigelegten PDF).
import { useState } from 'preact/hooks';
import type { Projekt } from '../../../model/typen.ts';
import { appDaten, musterProjekt } from '../../daten.ts';
import { datumText, inhalt, optionText, t, uiSprache } from '../../i18n.ts';
import type { EtappeDef, FeldDef, SeiteDef } from '../../logik/gefuehrt-typen.ts';
import { aktiveFelder } from '../../logik/gefuehrt.ts';
import { istLeer, lies } from '../../logik/pfad.ts';
import { wertText } from '../../logik/prompt.ts';
import { feldLabel } from '../../ui/Feld.tsx';
import { GlossarBegriff, RichText } from '../../ui/RichText.tsx';
import { melde } from '../../zustand/store.ts';
import { NormtextHilfe } from '../../normtexte/NormtextHilfe.tsx';
import { KiDialog } from './KiDialog.tsx';
import { nistNachlesen } from '../formular/NistZitat.tsx';

export function seitenText(e: EtappeDef, s: { id: string }, teil: string): string | undefined {
  return inhalt(`gefuehrt.${e.id}.${s.id}.${teil}`);
}

/** Glossarbegriffe, die in den Texten einer Seite vorkommen. */
function begriffeIn(texte: (string | undefined)[]): string[] {
  const r = new Set<string>();
  for (const x of texte) for (const m of (x ?? '').matchAll(/\[\[g:([\w-]+)/g)) r.add(m[1]!);
  return [...r];
}

export function aiActLinks(schluessel: string[] | undefined): { text: string; href: string; seite?: number }[] {
  if (!schluessel?.length) return [];
  const a = appDaten().kataloge['artikelSeiten'] as { quelle: Record<string, string>; de: Record<string, number>; en: Record<string, number> } | undefined;
  if (!a) return [];
  const s = uiSprache.value;
  const datei = a.quelle[s] ?? a.quelle['de']!;
  return schluessel.map((k) => {
    const seite = a[s]?.[k] ?? a.de[k];
    const nummer = k.replace(/^art-/, '').replace(/^anhang-/, '');
    const artikel = k.startsWith('anhang') ? t('hilfe.anhang', { nummer: nummer.toUpperCase() }) : t('hilfe.artikel', { nummer });
    return {
      text: seite ? t('hilfe.aiact_link', { artikel, seite }) : artikel,
      href: `../Rechtstexte_Legal-Texts/EU-AI-Act/${datei}${seite ? `#page=${seite}` : ''}`,
      seite,
    };
  });
}

function kitOrdner(s: string): Record<string, string> | undefined {
  return (appDaten().kataloge['kitOrdner'] as { sprachen?: Record<string, Record<string, string>> } | undefined)?.sprachen?.[s];
}

export function vorlagenLink(id: string | undefined): { text: string; href: string } | null {
  if (!id) return null;
  const d = appDaten().kataloge.dokumente.dokumente.find((x) => x.id === id);
  if (!d) return null;
  const s = uiSprache.value;
  const ordner = kitOrdner(s);
  if (!ordner) return null;
  return { text: t('hilfe.vorlage', { id, titel: inhalt(`dokumente.${id}.titel`) ?? '' }), href: `../${ordner.ordner}/${ordner[d.ordner] ?? ''}/${d.datei[s]}.${d.format}` };
}

export function leitfadenLink(nummer: number | undefined): { text: string; href: string } | null {
  if (!nummer) return null;
  const s = uiSprache.value;
  const ordner = kitOrdner(s);
  const datei = appDaten().leitfaden?.[s];
  if (!ordner || !datei) return null;
  return { text: t('hilfe.leitfaden', { nummer }), href: `../${ordner.ordner}/${ordner['leitfaden']}/${datei}.pdf` };
}

/** Auditcheckliste im Beispiel kurz: die ersten Prüfpunkte mit Nachweis und Ergebnis. */
function prueflisteText(wert: unknown): string {
  if (!wert || typeof wert !== 'object') return '';
  const eintraege = Object.entries(wert as Record<string, { nachweis?: string; ergebnis?: string }>);
  const text = eintraege
    .slice(0, 3)
    .map(([k, e]) => `${k}: ${[e.nachweis, e.ergebnis ? optionText('checklistenErgebnis', e.ergebnis) : ''].filter(Boolean).join(', ')}`)
    .join('; ');
  return eintraege.length > 3 ? `${text}; ${t('hilfe.weitere', { anzahl: eintraege.length - 3 })}` : text;
}

/** Werte des Beispiels lesbar: Personen-IDs als Namen, Daten im Schweizer Format, Freigaben als «Name, Datum» */
function lesbar(v: unknown, muster: Record<string, unknown>): string {
  const personen = (lies(muster, 'personen') ?? []) as { id: string; name: string; funktion?: string }[];
  const name = (id: string) => personen.find((x) => x.id === id)?.name ?? id;
  const einzeln = (w: unknown): string => {
    if (typeof w === 'string') {
      if (/^P-\d{3}$/.test(w)) return name(w);
      if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(w)) return datumText(w.slice(0, 10));
      return w.trim();
    }
    if (typeof w === 'boolean') return t(w ? 'feld.ja' : 'feld.nein');
    if (Array.isArray(w)) return w.map(einzeln).filter(Boolean).join(', ');
    if (w && typeof w === 'object') {
      const o = w as Record<string, unknown>;
      // Freigabe { von, am }
      if (typeof o['von'] === 'string' && Object.keys(o).every((k) => k === 'von' || k === 'am')) return [einzeln(o['von']), einzeln(o['am'])].filter(Boolean).join(', ');
      return Object.values(o).map(einzeln).filter(Boolean).join(', ');
    }
    return wertText(w);
  };
  return einzeln(v);
}

/** Tabelle im Beispiel: Zeilen mit Werten unter den Spaltenbeschriftungen der Seite, Optionen übersetzt, ohne interne IDs */
function tabelleZeilen(f: FeldDef, wert: unknown, basis: string, muster: Record<string, unknown>): string[] {
  if (!Array.isArray(wert)) return [lesbar(wert, muster)];
  const spaltenBasis = `${basis}.${f.pfad}`;
  return wert.map((zeile) => {
    if (!zeile || typeof zeile !== 'object') return lesbar(zeile, muster);
    const z = zeile as Record<string, unknown>;
    return (f.spalten ?? [])
      .filter((sp) => sp.pfad && sp.pfad !== 'id')
      .map((sp) => {
        const w = lies(z, sp.pfad!);
        const s = sp.optionen && (typeof w === 'string' || typeof w === 'number') ? optionText(sp.optionen, String(w)) : lesbar(w, muster);
        return s ? `${feldLabel(sp, spaltenBasis)}: ${s}` : '';
      })
      .filter(Boolean)
      .join(' · ');
  }).filter(Boolean);
}

type BeispielWert = { feld: FeldDef; text: string; zeilen?: string[]; wert: unknown };

/** Beispiel des eigenen Pfads; hat es für diese Seite nichts, das andere Beispiel (z. B. Folgenabschätzung ohne ISMS) */
function beispielWerte(s: SeiteDef, p: Projekt, basisText: string): { werte: BeispielWert[]; muster: Record<string, unknown> | null } {
  // Risikokriterien: Text und Hilfe sprechen von vier Stufen, die Vorlage muss dazu passen (C-03); das vierstufige Beispiel zuerst
  const reihe = s.beispiel === 'organisation.risikokriterien' ? [true, false] : [p.meta.mitIsms, !p.meta.mitIsms];
  for (const mitIsms of reihe) {
    const muster = musterProjekt(uiSprache.value, mitIsms);
    const werte = muster ? beispielAus(muster, s, p, basisText) : [];
    if (werte.length) return { werte, muster };
  }
  return { werte: [], muster: null };
}

function beispielAus(muster: Record<string, unknown>, s: SeiteDef, p: Projekt, basisText: string): BeispielWert[] {
  if (!s.beispiel) return [];
  const basis = s.typ === 'formular' ? muster : lies(muster, s.beispiel);
  if (basis === undefined) return [];
  // Checklistenpunkte (z. B. Betreiberpflichten E-05): Stand im Beispiel unter meta.checklisten.<schluessel mit ID des Beispieleintrags>
  const checklisten = (lies(muster, 'meta.checklisten') ?? {}) as Record<string, { erledigt?: boolean; nachweis?: string } | undefined>;
  const basisId = String(lies(basis, 'id') ?? '');
  const checkText = (f: FeldDef): { feld: FeldDef; text: string; wert: unknown } | null => {
    const c = checklisten[(f.schluessel ?? '').replace('{id}', basisId)];
    if (!c) return null;
    // Offene Punkte mit Nachweis zeigen den ehrlichen Stand des Beispiels (z. B. Schulung noch offen), offene ohne Nachweis nichts
    if (!c.erledigt) return c.nachweis ? { feld: f, text: `${t('feld.noch_offen')}: ${c.nachweis}`, wert: c } : null;
    return { feld: f, text: c.nachweis ? `${t('feld.erledigt')}: ${c.nachweis}` : t('feld.erledigt'), wert: c };
  };
  const pruefpunkte = aktiveFelder(s, p, basis).filter((f) => f.typ === 'checkliste').map(checkText).filter((x) => x !== null);
  return aktiveFelder(s, p, basis)
    .filter((f) => f.pfad && f.typ !== 'checkliste')
    .map((f) => {
      const wert = lies(basis, f.pfad!);
      if (f.typ === 'tabelle') return { feld: f, text: '', zeilen: tabelleZeilen(f, wert, basisText, muster), wert };
      let text = f.typ === 'pruefliste' ? prueflisteText(wert) : lesbar(wert, muster);
      if (f.optionen && typeof wert === 'string') text = optionText(f.optionen, wert);
      if (f.optionen && Array.isArray(wert)) text = wert.map((w) => optionText(f.optionen, String(w))).join(', ');
      return { feld: f, text, wert };
    })
    .filter((x) => !istLeer(x.wert))
    .concat(pruefpunkte);
}

export function Hilfebereich(props: {
  etappe: EtappeDef;
  seite: SeiteDef;
  projekt: Projekt;
  /** Beispielwerte übernehmen (Formular: absolute Pfade; Liste: neuer Eintrag) */
  uebernehmen?: (werte: { feld: FeldDef; wert: unknown }[]) => number | Promise<number>;
}) {
  const { etappe, seite, projekt } = props;
  const [kiOffen, setKiOffen] = useState(false);
  const warum = seitenText(etappe, seite, 'warum');
  const fehler = seitenText(etappe, seite, 'fehler');
  const basis = `gefuehrt.${etappe.id}.${seite.id}.felder`;
  const hilfen = (seite.felder ?? []).map((f) => inhalt(`${basis}.${f.pfad ?? f.schluessel}.hilfe`));
  const begriffe = begriffeIn([seitenText(etappe, seite, 'titel'), seitenText(etappe, seite, 'frage'), warum, fehler, ...hilfen]);
  const bw = seite.typ !== 'info' ? beispielWerte(seite, projekt, basis) : { werte: [], muster: null };
  const beispiel = bw.werte;
  const vorlage = vorlagenLink(seite.vorlage);
  const leitfaden = leitfadenLink(seite.leitfaden);
  const aiact = projekt.meta.modulAiAct || seite.aiact?.length ? aiActLinks(seite.aiact) : [];
  // Modul NIST AI RMF: Sprung in die beigelegten NIST-PDFs (Seitenfeld «nist»)
  const nist = projekt.meta.modulNistRmf ? nistNachlesen(seite.nist) : [];
  return (
    <aside class="hilfe karte" id="hilfe" aria-labelledby="hilfe-titel">
      <h2 id="hilfe-titel">{t('hilfe.titel')}</h2>
      {warum && (
        <section>
          <h3>{t('hilfe.warum')}</h3>
          <RichText text={warum} />
        </section>
      )}
      {seite.beispiel && seite.typ !== 'info' && (
        <section>
          <h3>{t('hilfe.beispiel')}</h3>
          {beispiel.length ? (
            <>
              <p class="zweitext">{t('hilfe.beispiel_quelle', { firma: String(lies(bw.muster ?? {}, 'organisation.name') ?? '') })}</p>
              <dl>
                {beispiel.map((b) => (
                  <div key={b.feld.pfad ?? b.feld.schluessel}>
                    <dt><strong>{feldLabel(b.feld, basis)}</strong></dt>
                    <dd style={{ margin: '0 0 8px' }}>{b.zeilen ? <ul class="beispiel-zeilen">{b.zeilen.map((z, i) => <li key={i}>{z}</li>)}</ul> : b.text}</dd>
                  </div>
                ))}
              </dl>
              {props.uebernehmen && (
                <button type="button" class="klein" onClick={async () => { const n = await props.uebernehmen!(beispiel); melde(t(n ? 'hilfe.uebernommen' : 'hilfe.nichts_uebernommen'), n ? 'ok' : 'info'); }}>
                  {t('hilfe.als_vorlage')}
                </button>
              )}
            </>
          ) : (
            <p class="zweitext">{t('hilfe.beispiel_fehlt')}</p>
          )}
        </section>
      )}
      {fehler && (
        <section>
          <h3>{t('hilfe.fehler')}</h3>
          <RichText text={fehler} />
        </section>
      )}
      {begriffe.length > 0 && (
        <section>
          <h3>{t('hilfe.begriffe')}</h3>
          <ul class="begriffe">
            {begriffe.map((b) => (
              <li key={b}><GlossarBegriff schluessel={b} /></li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3>{t('hilfe.nachlesen')}</h3>
        <ul>
          {seite.norm && (
            <li>
              {t('hilfe.norm', { abschnitt: seite.norm })}
              <br />
              <span class="zweitext">{t('hilfe.norm_hinweis')}</span>
              <NormtextHilfe normbezug={seite.norm} />
            </li>
          )}
          {vorlage && <li><a href={vorlage.href} target="_blank" rel="noopener">{vorlage.text}</a></li>}
          {leitfaden && <li><a href={leitfaden.href} target="_blank" rel="noopener">{leitfaden.text}</a></li>}
          {aiact.map((a) => (
            <li key={a.href}><a href={a.href} target="_blank" rel="noopener">{a.text}</a></li>
          ))}
          {nist.map((a) => (
            <li key={a.href}><a href={a.href} target="_blank" rel="noopener">{a.text}</a></li>
          ))}
        </ul>
      </section>
      {seite.typ !== 'info' && (
        <section>
          <h3>{t('ki.titel')}</h3>
          <p class="zweitext">{t('ki.hinweis')}</p>
          <button type="button" class="klein" onClick={() => setKiOffen(true)}>{t('ki.knopf')}</button>
          {kiOffen && <KiDialog etappe={etappe} seite={seite} projekt={projekt} schliessen={() => setKiOffen(false)} />}
        </section>
      )}
    </aside>
  );
}
