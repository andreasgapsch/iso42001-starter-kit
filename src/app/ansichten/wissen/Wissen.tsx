// Bereich Wissen (R5): Leitfaden-Kapitel (Druckfassung bleibt das PDF), Regelwerke (ISO/IEC 42001 und 27001 mit
// eigenen Kurztiteln oder dem Normtext aus der eigenen Normausgabe, EU AI Act mit Auszügen im Wortlaut, NIST AI RMF mit
// den Originaltexten), Glossar und Hinweise zum KI-Assistenten. Inhalte aus dem komprimierten Block daten-wissen.
import { Symbol } from '../../rahmen/symbole.tsx';
import { funktionsName } from '../gefuehrt/NistProfil.tsx';
import { useEffect, useRef } from 'preact/hooks';
import { appDaten } from '../../daten.ts';
import { inhalt, inhaltRoh, t, uiSprache } from '../../i18n.ts';
import { routeZuHash } from '../../logik/routen.ts';
import { ausNorm, normErlaeuterung, normTitel } from '../../normtexte/zustand.ts';
import { NormtextSprache } from '../../normtexte/NormtextHilfe.tsx';
import { tr } from '../../rahmen/text.ts';
import { aiActAuszuege, kapitelInhalt, wissenKapitel } from '../../rahmen/wissen-daten.ts';
import { Baum } from '../../ui/Baum.tsx';
import { NistOriginal, NistVermerk } from '../formular/NistZitat.tsx';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { DruckAktion } from '../../rahmen/aktionen.tsx';
import { StatusPille } from '../../ui/StatusPille.tsx';
import { Hinweis } from '../../ui/Hinweis.tsx';

/** Titel fokussieren; Sprungziel (Abschnitt, Control, Begriff) in den Blick scrollen und öffnen */
function useSeite(schluessel: string, ziel?: string) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = ziel ? document.getElementById(ziel) : null;
    if (el) {
      if (el instanceof HTMLDetailsElement) el.open = true;
      el.scrollIntoView({ block: 'start' });
      (el.querySelector<HTMLElement>('summary') ?? el).focus?.({ preventScroll: true });
    } else ref.current?.focus();
  }, [schluessel, ziel]);
  return ref;
}

function Leitfaden({ id }: { id?: string }) {
  const kapitel = wissenKapitel();
  const [kId, abschnitt] = (id ?? '').split('/');
  const k = kapitel.find((x) => x.id === kId) ?? kapitel[0];
  const ref = useSeite(`leitfaden/${k?.id ?? ''}`, abschnitt ? `lf-${abschnitt}` : undefined);
  if (!k) return <div class="inhalt"><Seitenkopf titel={tr('wissen.leitfaden')} titelRef={ref} aktion={<DruckAktion />} /><p class="ersatz">{tr('wissen.fehlt')}</p></div>;
  const knoten = kapitelInhalt(k.id) ?? [];
  // Die erste Überschrift des Kapitels ist der Seitentitel
  const rumpf = knoten[0] && typeof knoten[0] !== 'string' && knoten[0][0] === 'h1' ? knoten.slice(1) : knoten;
  const i = kapitel.indexOf(k);
  const vor = kapitel[i - 1];
  const nach = kapitel[i + 1];
  return (
    <div class="inhalt wissen wissen-leitfaden" id="wissen-leitfaden">
      <Seitenkopf titel={k.titel} titelRef={ref} titelId={`lf-kapitel-${k.id}`} aktion={<DruckAktion />} unter={<p class="kontext">{tr('wissen.leitfaden')}</p>} />
      {k.abschnitte.length > 1 && (
        <nav class="karte wissen-inhalt" aria-label={tr('wissen.inhalt_kapitel')}>
          <ul>{k.abschnitte.map((a) => <li key={a.id}><a href={routeZuHash({ art: 'wissen', unter: 'leitfaden', id: `${k.id}/${a.id}` })}>{a.titel}</a></li>)}</ul>
        </nav>
      )}
      <article class="karte lesetext">
        <Baum knoten={rumpf} idPraefix="lf-" abbildung={(titel) => <Hinweis als="p" klasse="wissen-abb">{titel ? `${titel}. ` : ''}{tr('wissen.abbildung_pdf')}</Hinweis>} />
      </article>
      <nav class="leiste wissen-blaettern" aria-label={tr('wissen.blaettern')}>
        {vor && <a class="knopf" href={routeZuHash({ art: 'wissen', unter: 'leitfaden', id: vor.id })} rel="prev"><Symbol name="pfeil-links" klasse="sym sym-text" /> {vor.titel}</a>}
        {nach && <a class="knopf" href={routeZuHash({ art: 'wissen', unter: 'leitfaden', id: nach.id })} rel="next">{nach.titel} <Symbol name="pfeil-rechts" klasse="sym sym-text" /></a>}
      </nav>
      <p class="zweitext">{tr('wissen.druckfassung')}</p>
    </div>
  );
}

function ControlEintrag({ id, felder }: { id: string; felder: boolean }) {
  const titel = normTitel(id) ?? inhalt(`controls42001.controls.${id}.titel`) ?? id;
  const ausNormtext = ausNorm(id, 'text');
  const anzeigeId = id.replace(/^27001-/, '');
  return (
    <details class="regel-eintrag" id={`rw-${id}`}>
      <summary><span class="marke-id">{anzeigeId}</span> {titel} <NormtextSprache id={id} art="titel" /></summary>
      {ausNormtext ? (
        <div class="normtext">
          <p><StatusPille art="neutral">{tr('wissen.aus_normausgabe')}</StatusPille></p>
          {(normErlaeuterung(id) ?? '').split('\n').map((z, i) => <p key={i}>{z}</p>)}
        </div>
      ) : null}
      {felder && (
        <dl class="regel-felder">
          {(['zweck', 'umsetzung', 'nachweis', 'auditor'] as const).map((f) => {
            const text = inhalt(`controls42001.controls.${id}.${f}`);
            return text ? <div key={f}><dt>{tr(`wissen.feld.${f}`)}</dt><dd>{text}</dd></div> : null;
          })}
        </dl>
      )}
      {id.startsWith('A.') && <p><a href={routeZuHash({ art: 'formular', modul: 'soa', id })}>{tr('wissen.zur_soa')}</a></p>}
    </details>
  );
}

function Regelwerk42001({ ziel }: { ziel?: string }) {
  const ref = useSeite('regelwerk/42001', ziel ? `rw-${ziel}` : undefined);
  const k = appDaten().kataloge;
  return (
    <div class="inhalt wissen" id="wissen-42001">
      <p class="kontext">{tr('wissen.regelwerke')}</p>
      <Seitenkopf titel={'ISO/IEC 42001'} titelRef={ref} aktion={<DruckAktion />} />
      <Hinweis als="p">{tr('wissen.hinweis_norm')} <a href={routeZuHash({ art: 'einstellungen', bereich: 'normtexte' })}>{tr('einstellungen.normtexte')}</a></Hinweis>
      <section class="karte" aria-labelledby="rw-kapitel">
        <h2 id="rw-kapitel">{tr('wissen.kapitel_4_10')}</h2>
        {k.anforderungen42001.kapitel.map((kap) => (
          <details class="regel-gruppe" key={kap.id} id={`rw-${kap.id}`}>
            <summary><strong>{kap.id.replace(/^K-/, '')} {normTitel(kap.id) ?? inhalt(`anforderungen42001.kapitel.${kap.id}`) ?? kap.id}</strong></summary>
            <ul class="schlicht regel-abschnitte">
              {kap.abschnitte.map((a) => (
                <li key={a.id} id={`rw-${a.id}`}>
                  <span class="marke-id">{a.id.replace(/^K-/, '')}</span> {normTitel(a.id) ?? inhalt(`anforderungen42001.abschnitte.${a.id}.titel`) ?? ''}
                  {ausNorm(a.id, 'text') && <details class="g-details"><summary>{tr('wissen.aus_normausgabe')}</summary>{(normErlaeuterung(a.id) ?? '').split('\n').map((z, i) => <p key={i}>{z}</p>)}</details>}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>
      <section class="karte" aria-labelledby="rw-anhang">
        <h2 id="rw-anhang">{tr('wissen.anhang_a')}</h2>
        {k.controls42001.gruppen.map((g) => (
          <section key={g.id} class="regel-gruppe-offen" aria-labelledby={`rw-g-${g.id}`}>
            <h3 id={`rw-g-${g.id}`}>{g.id} {normTitel(g.id) ?? inhalt(`controls42001.gruppen.${g.id}`) ?? ''}</h3>
            {g.controls.map((c) => <ControlEintrag key={c.id} id={c.id} felder={true} />)}
          </section>
        ))}
      </section>
    </div>
  );
}

function Regelwerk27001({ ziel }: { ziel?: string }) {
  const ref = useSeite('regelwerk/27001', ziel ? `rw-${ziel}` : undefined);
  const controls = (inhaltRoh('iso27001.controls') ?? {}) as Record<string, { titel?: string }>;
  const themen = (inhaltRoh('iso27001.themen') ?? {}) as Record<string, string>;
  const katalog = (appDaten().kataloge['controls27001'] as { controls?: { id: string; thema?: string }[] } | undefined)?.controls ?? [];
  const nachThema = Object.keys(themen).map((th) => ({ th, ids: katalog.filter((c) => c.thema === th).map((c) => c.id) }));
  const ohneKatalog = !katalog.length || nachThema.every((x) => !x.ids.length);
  return (
    <div class="inhalt wissen" id="wissen-27001">
      <p class="kontext">{tr('wissen.regelwerke')}</p>
      <Seitenkopf titel={'ISO/IEC 27001'} titelRef={ref} aktion={<DruckAktion />} />
      <Hinweis als="p">{inhalt('iso27001.hinweis') ?? ''}</Hinweis>
      {ohneKatalog ? (
        <section class="karte">{Object.keys(controls).map((id) => <ControlEintrag key={id} id={id} felder={false} />)}</section>
      ) : (
        nachThema.map(({ th, ids }) => (
          <section class="karte" key={th} aria-labelledby={`rw-t-${th}`}>
            <h2 id={`rw-t-${th}`}>{themen[th]}</h2>
            {ids.map((id) => <ControlEintrag key={id} id={id} felder={false} />)}
          </section>
        ))
      )}
    </div>
  );
}

function RegelwerkAiAct({ ziel }: { ziel?: string }) {
  const ref = useSeite('regelwerk/aiact', ziel ? `rw-${ziel}` : undefined);
  const auszuege = aiActAuszuege();
  const erster = auszuege[0];
  return (
    <div class="inhalt wissen" id="wissen-aiact">
      <p class="kontext">{tr('wissen.regelwerke')}</p>
      <Seitenkopf titel={'EU AI Act'} titelRef={ref} aktion={<DruckAktion />} />
      {erster && <Hinweis als="p">{erster.hinweis}</Hinweis>}
      {erster && <p class="zweitext">{erster.quelle}. {erster.fassung}.</p>}
      <p class="zweitext">{tr('wissen.aiact_pdf')}</p>
      <section class="karte" aria-label={tr('wissen.auszuege')}>
        {auszuege.map((a) => (
          <details class="regel-eintrag" key={a.id} id={`rw-${a.id}`}>
            <summary><strong>{a.titel}</strong> <span class="zweitext">{a.umfang} · {tr('wissen.seiten_pdf', { seiten: a.seiten })}</span></summary>
            <div class="lesetext aiact-auszug" lang={undefined}>
              <Baum knoten={a.knoten} ebenen={2} idPraefix={`${a.id}-`} />
            </div>
          </details>
        ))}
      </section>
      <p><a href={routeZuHash({ art: 'formular', modul: 'aiact' })}>{tr('wissen.zum_modul_aiact')}</a></p>
    </div>
  );
}

function RegelwerkNist({ ziel }: { ziel?: string }) {
  const ref = useSeite('regelwerk/nist', ziel ? `rw-${ziel}` : undefined);
  const k = appDaten().kataloge;
  const s = k.nistrmf_subkategorien;
  const funktionen = (s as unknown as { funktionen?: { id: string; nist_id: string }[] } | undefined)?.funktionen ?? [];
  const kategorien = (s as unknown as { kategorien?: { id: string; nist_id: string; funktion: string }[] } | undefined)?.kategorien ?? [];
  return (
    <div class="inhalt wissen" id="wissen-nist">
      <p class="kontext">{tr('wissen.regelwerke')}</p>
      <Seitenkopf titel={'NIST AI RMF'} titelRef={ref} aktion={<DruckAktion />} />
      <Hinweis als="p">{tr('wissen.hinweis_nist')}</Hinweis>
      {funktionen.map((f) => (
        <section class="karte" key={f.id} aria-labelledby={`rw-f-${f.id}`}>
          <h2 id={`rw-f-${f.id}`}>{f.nist_id}{funktionsName(f.nist_id, f.id) ? ` · ${funktionsName(f.nist_id, f.id)}` : ''}</h2>
          <p class="zweitext">{inhalt(`nist.funktionen.${f.id}.kurz`) ?? ''}</p>
          <NistOriginal art="funktion" id={f.id} />
          {kategorien.filter((x) => x.funktion === f.id).map((kat) => (
            <details class="regel-gruppe" key={kat.id} id={`rw-${kat.id}`}>
              <summary><span class="marke-id">{kat.nist_id}</span> {inhalt(`nist.kategorien.${kat.id}.titel`) ?? kat.id}</summary>
              <NistOriginal art="kategorie" id={kat.id} />
              {(s?.subkategorien ?? []).filter((x) => x.kategorie === kat.id).map((sub) => (
                <div class="regel-eintrag offen" key={sub.id} id={`rw-${sub.id}`}>
                  <p><span class="marke-id">{sub.nist_id}</span> {inhalt(`nist.subkategorien.${sub.id}.titel`) ?? sub.id}</p>
                  <NistOriginal art="subkategorie" id={sub.id} />
                </div>
              ))}
            </details>
          ))}
        </section>
      ))}
      <NistVermerk dok="ai-100-1" />
    </div>
  );
}

function Glossar({ ziel }: { ziel?: string }) {
  const ref = useSeite('glossar', ziel ? `gl-${ziel}` : undefined);
  const g = (inhaltRoh('glossar') ?? {}) as Record<string, { begriff?: string; erklaerung?: string; en?: string }>;
  const eintraege = Object.entries(g).filter(([, x]) => x && typeof x === 'object' && x.begriff).sort(([, a], [, b]) => (a.begriff ?? '').localeCompare(b.begriff ?? '', 'de'));
  return (
    <div class="inhalt wissen" id="wissen-glossar">
      <Seitenkopf titel={tr('wissen.glossar')} titelRef={ref} aktion={<DruckAktion />} />
      <p class="zweitext">{tr('wissen.glossar_text', { anzahl: eintraege.length })}</p>
      <dl class="karte glossar-liste">
        {eintraege.map(([id, x]) => (
          <div key={id} id={`gl-${id}`} tabIndex={-1} class="glossar-eintrag">
            <dt>{x.begriff}{x.en && uiSprache.value === 'de' && <span class="zweitext" lang="en"> · {x.en}</span>}</dt>
            <dd>{x.erklaerung}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Assistent() {
  const ref = useSeite('assistent');
  const kapitel = wissenKapitel().find((k) => k.id === '09');
  const knoten = kapitel ? (kapitelInhalt(kapitel.id) ?? []) : [];
  const rumpf = knoten[0] && typeof knoten[0] !== 'string' && knoten[0][0] === 'h1' ? knoten.slice(1) : knoten;
  return (
    <div class="inhalt wissen" id="wissen-assistent">
      <Seitenkopf titel={tr('wissen.assistent')} titelRef={ref} aktion={<DruckAktion />} />
      <section class="karte">
        <p>{tr('wissen.assistent_text')}</p>
        <p class="zweitext">{tr('wissen.assistent_daten')}</p>
        <p><a class="knopf" href={routeZuHash({ art: 'start', unter: 'projekte' })}>{t('ki_import.titel')}</a></p>
      </section>
      {kapitel && (
        <article class="karte lesetext" aria-labelledby="assistent-kapitel">
          <h2 id="assistent-kapitel">{kapitel.titel}</h2>
          <Baum knoten={rumpf} ebenen={1} idPraefix="as-" abbildung={(titel) => <Hinweis als="p" klasse="wissen-abb">{titel ? `${titel}. ` : ''}{tr('wissen.abbildung_pdf')}</Hinweis>} />
        </article>
      )}
    </div>
  );
}

export function Wissen({ unter, id }: { unter?: string; id?: string }) {
  if (unter === 'regelwerk') {
    const [rw, ziel] = (id ?? '42001').split('/');
    if (rw === '27001') return <Regelwerk27001 ziel={ziel} />;
    if (rw === 'aiact') return <RegelwerkAiAct ziel={ziel} />;
    if (rw === 'nist') return <RegelwerkNist ziel={ziel} />;
    return <Regelwerk42001 ziel={ziel} />;
  }
  if (unter === 'glossar') return <Glossar ziel={id} />;
  if (unter === 'assistent') return <Assistent />;
  return <Leitfaden id={id} />;
}
