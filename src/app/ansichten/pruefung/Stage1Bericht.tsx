// Stage-1-Bericht als eigene Druckansicht: wird beim Drucken in einen Behälter direkt unter <body> gerendert; im Druck
// erscheint nur dieser Behälter (stil.css, @media print, body.druck-bericht), Meldungen nie.
import { render, type ComponentChildren } from 'preact';
import { erstelleUebersetzer } from '../../../i18n/texte.ts';
import { appDaten } from '../../daten.ts';
import { datumText, dokumentTitelUi, inhalt, optionText, t, uiSprache } from '../../i18n.ts';
import { befunde, projekt, stichtag, umfeld } from '../../zustand/store.ts';
import { befundText } from './Pruefung.tsx';
import { stage1Bericht, type Stage1Bericht } from './stage1.ts';
import { reifeText } from '../../logik/prozesse.ts';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { StatusPille, type StatusArt } from '../../ui/StatusPille.tsx';

// A-07: Ergebnis, Art der Regel, Stand der Etappen und Status der Dokumente als Pille wie in der Prüfung
const ERGEBNIS_ART: Record<string, StatusArt> = { aufbau: 'info', rot: 'kritisch', gelb: 'warnung', gruen: 'gut' };
const SCHWERE_ART: Record<string, StatusArt> = { fehler: 'kritisch', warnung: 'warnung', hinweis: 'warnung', offen: 'neutral' };
const ZUSTAND_ART: Record<string, StatusArt> = { erledigt: 'gut', teilweise: 'warnung', offen: 'neutral' };
const DOKUMENT_ART: Record<string, StatusArt> = { entwurf: 'neutral', 'in-pruefung': 'warnung', freigegeben: 'gut', veraltet: 'neutral' };

const personName = (id: string | undefined): string => projekt.value?.personen.find((x) => x.id === id)?.name ?? id ?? '';
/** Folgenabschätzungen D-09-KI-xxx mit dem Namen des KI-Systems */
const systemName = (id: string): string => {
  const ki = /^D-09-(KI-\d+)$/.exec(id)?.[1];
  const s = ki ? projekt.value?.kiSysteme.find((x) => x.id === ki) : undefined;
  return s ? ` (${s.name})` : '';
};

/** aktionen: Knöpfe rechts neben dem Titel (Ansicht in der App, nicht im Druck; U-32) */
export function Stage1BerichtAnsicht({ b, aktionen }: { b: Stage1Bericht; aktionen?: ComponentChildren }) {
  const mitBefund = b.regeln.liste.filter((r) => r.befunde > 0);
  const ohneBefund = b.regeln.liste.filter((r) => r.befunde === 0).sort((x, y) => x.id.localeCompare(y.id, 'de', { numeric: true }));
  const etappenOffen = b.etappen.filter((e) => e.zustand !== 'erledigt').map((e) => e.id);
  const module = [b.module.aiAct && t('stage1.modul_aiact'), b.module.nistRmf && t('stage1.modul_nist')].filter(Boolean).join(', ') || t('stage1.module_keine');
  const au = b.stage1Audit;
  const termin = au ? `${datumText(au.durchgefuehrt ?? au.geplant)}${au.durchgefuehrtBis ? ` ${t('stage1.bis')} ${datumText(au.durchgefuehrtBis)}` : ''} (${au.id}${au.auditor ? `, ${au.auditor}` : ''})` : t('stage1.termin_offen');
  return (
    <article class="s1-bericht" aria-label={t('stage1.titel')}>
      {aktionen ? <Seitenkopf titel={t('stage1.titel')} aktion={aktionen} /> : <h1 tabIndex={-1}>{t('stage1.titel')}</h1>}
      <p class="zweitext">{t('stage1.untertitel')}</p>
      <table data-kopf="">
        <tbody>
          <tr><th scope="row">{t('stage1.firma')}</th><td>{b.firma}</td></tr>
          <tr><th scope="row">{t('stage1.datum')}</th><td>{datumText(b.datum)}</td></tr>
          <tr><th scope="row">{t('stage1.pfad')}</th><td>{t(b.mitIsms ? (b.ismsZertifiziert ? 'stage1.pfad_zertifiziert' : 'stage1.pfad_mit_isms') : 'stage1.pfad_ohne_isms')}</td></tr>
          <tr><th scope="row">{t('stage1.module')}</th><td>{module}</td></tr>
          <tr><th scope="row">{t('stage1.termin')}</th><td>{termin}</td></tr>
          {b.zielStage1 && <tr><th scope="row">{t('stage1.ziel')}</th><td>{datumText(b.zielStage1)}</td></tr>}
          <tr><th scope="row">{t('stage1.ergebnis')}</th><td id="s1-ergebnis"><StatusPille art={ERGEBNIS_ART[b.bereitschaft.stufe] ?? 'neutral'}>{t(`pruefung.ampel.${b.bereitschaft.stufe}`)}</StatusPille>{b.bereitschaft.stufe === 'rot' ? ` ${t('stage1.ergebnis_zahlen', { fehler: b.bereitschaft.fehler, luecken: b.bereitschaft.luecken.length })}` : ''}</td></tr>
        </tbody>
      </table>

      <h2>{t('stage1.regeln_titel')}</h2>
      <p>{t('stage1.regeln_text', { geprueft: b.regeln.geprueft, fehler: t('stage1.regeln_fehler', { anzahl: b.regeln.fehler }), hinweise: t('stage1.regeln_hinweise', { anzahl: b.regeln.hinweise }) })}</p>
      {mitBefund.length > 0 && (
        <table>
          <thead><tr><th scope="col">{t('stage1.regel')}</th><th scope="col">{t('stage1.art')}</th><th scope="col">{t('stage1.norm')}</th><th scope="col">{t('stage1.befunde')}</th></tr></thead>
          <tbody>
            {mitBefund.map((r) => (
              <tr key={r.id}><td>{r.id}</td><td><StatusPille art={SCHWERE_ART[r.schwere] ?? 'neutral'}>{t(`pruefung.schwere.${r.schwere}`)}</StatusPille></td><td>{r.norm}</td><td>{r.befunde}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <p class="zweitext">{t('stage1.ohne_befund', { anzahl: ohneBefund.length, regeln: ohneBefund.map((r) => r.id).join(', ') })}</p>

      <h2>{t('stage1.etappen_titel')}</h2>
      <table>
        <thead><tr><th scope="col">{t('stage1.etappe')}</th><th scope="col">{t('stage1.stand')}</th><th scope="col">{t('stage1.seiten')}</th></tr></thead>
        <tbody>
          {b.etappen.map((e) => (
            <tr key={e.id}><td>{e.id} {inhalt(`gefuehrt.etappen.${e.id}.titel`) ?? ''}</td><td><StatusPille art={ZUSTAND_ART[e.zustand] ?? 'neutral'}>{t(`stage1.zustand.${e.zustand}`)}</StatusPille></td><td>{t('stage1.seiten_wert', { erledigt: e.erledigt, gesamt: e.gesamt })}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>{t('stage1.dokumente_titel')}</h2>
      <table>
        <thead><tr><th scope="col">{t('stage1.id')}</th><th scope="col">{t('stage1.dokument')}</th><th scope="col">{t('stage1.version')}</th><th scope="col">{t('stage1.status')}</th><th scope="col">{t('stage1.freigabe')}</th></tr></thead>
        <tbody>
          {b.dokumente.map((d) => (
            <tr key={d.id}>
              <td>{d.id}</td>
              <td>{dokumentTitelUi(d.id)}{systemName(d.id)}</td>
              <td>{d.version ?? ''}</td>
              <td><StatusPille art={d.status ? DOKUMENT_ART[d.status] ?? 'neutral' : 'kritisch'}>{d.status ? optionText('dokumentStatus', d.status) : t('stage1.nicht_im_register')}</StatusPille></td>
              <td>{d.freigabe?.am ? `${datumText(d.freigabe.am)}, ${personName(d.freigabe.von)}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {b.prozesse && (
        <>
          <h2>{t('stage1.prozesse_titel')}</h2>
          <table id="s1-prozesse">
            <thead><tr><th scope="col">{t('stage1.id')}</th><th scope="col">{t('prozesse.prozess')}</th><th scope="col">{t('prozesse.eigner')}</th><th scope="col">{t('prozesse.reife')}</th></tr></thead>
            <tbody>
              {b.prozesse.map((x) => (
                <tr key={x.id}><td>{x.id}</td><td>{inhalt(`prozesse.prozesse.${x.id}.titel`) ?? projekt.value?.eigeneProzesse?.find((e) => e.id === x.id)?.titel ?? x.id}</td><td>{x.eigner ? personName(x.eigner) : t('prozesse.kein_eigner')}</td><td>{reifeText(x.reife)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>{t('stage1.offen_titel')}</h2>
      {/* Was muss vor dem Audit erledigt sein? (Bericht C): Fehler und Lücken ja, Hinweise sind Empfehlungen */}
      {b.bereitschaft.stufe === 'rot' && <p id="s1-vor-audit">{t('stage1.vor_audit')}</p>}
      {b.offen.befunde.length === 0 && b.offen.ohneFreigabe.length === 0 && b.offen.massnahmen.length === 0 && etappenOffen.length === 0 ? <p>{t('stage1.offen_keine')}</p> : (
        <ul>
          {b.bereitschaft.luecken.filter((l) => l.art === 'register').map((l) => <li key={l.id}>{t('pruefung.luecke_register', { register: t(`pruefung.register.${l.id}`) })}</li>)}
          {b.offen.befunde.map((x, i) => (
            <li key={`${x.regel}-${x.id ?? ''}-${i}`}>{t(`pruefung.schwere.${x.schwere}`)} {x.regel}: {befundText(x).titel}</li>
          ))}
          {etappenOffen.length > 0 && <li>{t('stage1.offen_etappen', { etappen: etappenOffen.join(', ') })}</li>}
          {b.offen.ohneFreigabe.length > 0 && <li>{t('stage1.offen_dokumente', { ids: b.offen.ohneFreigabe.join(', ') })}</li>}
          {b.offen.massnahmen.map((m) => (
            <li key={m.id}>{t('stage1.offen_massnahme', { id: m.id, titel: m.titel, termin: m.termin ? datumText(m.termin) : t('stage1.ohne_termin') })}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

/**
 * Setzt den Seitenfuss des Drucks (links Organisation und Stand, rechts Seite x / y); liefert das Entfernen oder null, wenn
 * die Engine keine Randfelder von @page kennt (Firefox, WebKit: die Regel bleibt ohne @bottom-left stehen, B12).
 */
function fussRegel(links: string, seite: string): (() => void) | null {
  const blatt = document.styleSheets[0];
  if (!blatt) return null;
  const text = (x: string) => `"${x.replace(/[\\"]/g, '\\$&').replace(/\s+/g, ' ')}"`;
  let regel: CSSRule | undefined;
  try {
    const i = blatt.insertRule(`@page { @bottom-left { content: ${text(links)}; font-family: 'Inter Variable', sans-serif; font-size: 9pt; } @bottom-right { content: ${text(seite)} " " counter(page) " / " counter(pages); font-family: 'Inter Variable', sans-serif; font-size: 9pt; } }`, blatt.cssRules.length);
    regel = blatt.cssRules[i];
  } catch {
    return null;
  }
  const entfernen = () => {
    const i = [...blatt.cssRules].indexOf(regel!);
    if (i >= 0) blatt.deleteRule(i);
  };
  if (!regel?.cssText.includes('@bottom-left')) {
    entfernen();
    return null;
  }
  return entfernen;
}

/**
 * Rückfall ohne Randfelder (B12): Der Bericht steht in einer Tabelle, deren Fusszeile (tfoot) die Engines im Druck auf jeder
 * Seite wiederholen und für die sie Platz lassen; ohne Seitenzahl, weil counter(page) nur in den Randfeldern wirkt.
 */
function MitFuss({ fuss, children }: { fuss: string; children: ComponentChildren }) {
  return (
    <table data-druck-rahmen="" role="presentation">
      <tfoot><tr><td class="druck-fuss" id="druck-fuss">{fuss}</td></tr></tfoot>
      <tbody><tr><td>{children}</td></tr></tbody>
    </table>
  );
}

/** Rendert den Bericht in den Druckbehälter und öffnet den Druckdialog; nach dem Druck wird der Behälter geleert. */
export function stage1Drucken(): void {
  const p = projekt.value;
  if (!p) return;
  const sprache = uiSprache.value;
  const daten = appDaten();
  const b = stage1Bericht(p, { u: erstelleUebersetzer(sprache, daten.texte[sprache]), umfeld: umfeld.value, kataloge: daten.kataloge, regeln: daten.regeln.regeln, befunde: befunde.value, heute: stichtag.value });
  let ziel = document.getElementById('druck-bericht');
  if (!ziel) {
    ziel = document.createElement('div');
    ziel.id = 'druck-bericht';
    ziel.className = 'nur-druck';
    document.body.appendChild(ziel);
  }
  // Fuss jeder Seite (Abnahme Entwurf 0.4, G8): Organisation, Stand und Seite, ohne Bezug zum Kit; als @page-Regel über
  // CSSOM, weil die Randfelder einer Druckseite nur feste Texte kennen; ohne Randfelder als wiederholte Tabellenfusszeile
  const links = t('stage1.fuss', { firma: b.firma, datum: datumText(b.datum) });
  const fuss = fussRegel(links, t('stage1.seite'));
  render(fuss ? <Stage1BerichtAnsicht b={b} /> : <MitFuss fuss={links}><Stage1BerichtAnsicht b={b} /></MitFuss>, ziel);
  document.body.classList.add('druck-bericht');
  const aufraeumen = () => {
    fuss?.();
    document.body.classList.remove('druck-bericht');
    if (ziel) render(null, ziel);
    globalThis.removeEventListener('afterprint', aufraeumen);
  };
  globalThis.addEventListener('afterprint', aufraeumen);
  window.print();
}
