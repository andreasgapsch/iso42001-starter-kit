// Dokumentengenerator: komplettes Set (mit ISMS als Ergänzungsblätter, mit Modul E-01 bis E-09) als ZIP,
// einzelne DOCX/XLSX, druckfertige Ansicht für PDF über den Browserdruck. Dokumentsprache DE oder EN.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { DocxDokument, XlsxMappe } from '../../../generator/ir.ts';
import type { Projekt, Sprache } from '../../../model/typen.ts';
import { appDaten } from '../../daten.ts';
import { dokumentTitelUi, t, zahlText } from '../../i18n.ts';
import { IrVorschau } from '../../ui/IrVorschau.tsx';
import { drawioExportieren, erzeugeIr, erzeugeSet, generatorFortschritt, herunterladen, type SetErgebnis } from '../../worker/client.ts';
import { aendere, melde } from '../../zustand/store.ts';
import { sichererDateiname } from '../../speicher/index.ts';
import { EIGENE_EB_FORM } from '../../../vorlagen/index.ts';
import { dokumentImModul } from '../../logik/nistrmf.ts';
import { modulText } from '../gefuehrt/Gefuehrt.tsx';
import { GestaltungStand } from '../einstellungen/Gestaltung.tsx';
import { InBibliothekLegen } from '../bibliothek/Ablegen.tsx';
import { Auswahl } from '../../ui/Auswahl.tsx';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { Symbol } from '../../rahmen/symbole.tsx';
import { fehlerVerstaendlich } from '../../worker/fehlertext.ts';
import { Hinweis } from '../../ui/Hinweis.tsx';
import { useBeschaeftigt, zweiterKlick } from '../../ui/beschaeftigt.ts';

export function Dokumente({ p }: { p: Projekt }) {
  const [sprache, setSprache] = useState<Sprache>(p.meta.dokumentSprache);
  const [laeuft, setLaeuft] = useState(false);
  // V-05: welcher Knopf beschäftigt ist (aria-busy); die Sperre im Ref verhindert eine zweite Auslösung vor dem nächsten Zeichnen
  const [aktiv, setAktiv] = useState<string | null>(null);
  const sperre = useRef(false);
  const [drawioLaeuft, drawioLauf] = useBeschaeftigt();
  const [ergebnis, setErgebnis] = useState<SetErgebnis | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [druck, setDruck] = useState<DocxDokument | XlsxMappe | null>(null);
  const titelRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titelRef.current?.focus(), [druck === null]);
  const docs = appDaten().kataloge.dokumente.dokumente.filter((d) => dokumentImModul(d, p) && (d.ordner !== 'integration' || p.meta.mitIsms));
  const ebBlaetter = new Set(((appDaten().kataloge['ergaenzungsblaetter'] as { blaetter?: { id: string }[] } | undefined)?.blaetter ?? []).map((b) => b.id));
  // Titel wie im Dokumentkopf und im Register (dokumentTitelUi)
  const zeilen = docs.flatMap((d) => {
    const id = p.meta.mitIsms && d.eb ? `${d.id}-EB` : d.id;
    const haupt = { id, auswahl: d.id, titel: dokumentTitelUi(id), format: p.meta.mitIsms && d.eb && !EIGENE_EB_FORM.has(d.id) ? 'docx' : d.format };
    // Generisches Ergänzungsblatt (D-07-EB) und daneben das Register mit den Projektdaten (RT-03)
    if (p.meta.mitIsms && d.eb && !EIGENE_EB_FORM.has(d.id)) return [{ ...haupt, auswahl: `${d.id}-EB` }, { id: d.id, auswahl: d.id, titel: dokumentTitelUi(d.id), format: d.format }];
    if (!p.meta.mitIsms || d.eb || !ebBlaetter.has(`${d.id}-EB`)) return [haupt];
    return [haupt, { id: `${d.id}-EB`, auswahl: `${d.id}-EB`, titel: dokumentTitelUi(`${d.id}-EB`), format: 'docx' }];
  });
  // Kurzname der Gestaltung (z. B. «MMB») für den Dateinamen des Sets, sonst der Firmenname
  // Ohne Kurz- und Firmennamen kein Präfix: «AIMS-DE.zip» statt «AIMS_AIMS-DE.zip» (Prüfung Dokumente und Download, D3)
  const kurz = p.organisation.gestaltung?.kurzname || p.organisation.name;
  const stamm = kurz ? sichererDateiname(kurz).replace(/\.aims\.json$/, '') : '';
  const f = generatorFortschritt.value;

  const lauf = async (ids?: string[], einzeln = false) => {
    if (sperre.current) return;
    sperre.current = true;
    setAktiv(ids ? ids.join(',') : 'set');
    setLaeuft(true);
    setFehler(null);
    setErgebnis(null);
    try {
      const r = await erzeugeSet(p, sprache, { ids, einzeln, zipName: `${stamm ? `${stamm}_` : ''}AIMS-${sprache.toUpperCase()}.zip` });
      setErgebnis(r);
      if (r.dateien.length) {
        herunterladen(r.daten, r.name);
        melde(t('dokumente.fertig', { anzahl: r.dateien.length, sekunden: zahlText(r.ms / 1000) }), 'ok');
      } else melde(t('dokumente.nichts'), 'fehler');
    } catch (e) {
      setFehler(fehlerVerstaendlich(e));
    } finally {
      sperre.current = false;
      setAktiv(null);
      setLaeuft(false);
    }
  };
  const druckansicht = async (id: string) => {
    const r = await erzeugeIr(p, sprache, id, p.kiSysteme[0]?.id);
    if (r.ir) setDruck(r.ir);
    else melde(r.fehler ?? t('vorschau.nicht_verfuegbar'), 'fehler');
  };

  if (druck) {
    return (
      <div class="inhalt">
        <div class="leiste kein-druck" style={{ marginBottom: '16px' }}>
          <button type="button" onClick={() => setDruck(null)}>{t('dokumente.zurueck')}</button>
          <button type="button" class="primaer" onClick={() => window.print()}>{t('dokumente.drucken')}</button>
        </div>
        <h1 tabIndex={-1} ref={titelRef} class="nur-sr">{t('dokumente.druckansicht')}</h1>
        <div class="karte"><IrVorschau ir={druck} /></div>
      </div>
    );
  }
  return (
    <div class="inhalt">
      <Seitenkopf titel={t('dokumente.titel')} titelRef={titelRef} aktion={<button type="button" class="primaer" id="set-erzeugen" disabled={laeuft} aria-busy={aktiv === 'set' ? 'true' : undefined} onClick={(ev) => !zweiterKlick(ev) && void lauf()}><Symbol name="erzeugen" />{t('dokumente.set')}</button>} />
      <p>{t('dokumente.einleitung')}</p>
      {p.meta.mitIsms && <p class="zweitext" id="dok-eb-erklaerung">{t('dokumente.eb_erklaerung')}</p>}
      <div class="karte">
        <div class="leiste">
          <label for="dok-sprache"><strong>{t('dokumente.sprache')}</strong></label>
          <Auswahl id="dok-sprache" style={{ width: 'auto' }} value={sprache} onChange={(e) => {
            const s = e.currentTarget.value as Sprache;
            setSprache(s);
            aendere('meta.dokumentSprache', s);
          }}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </Auswahl>
          <span class="zweitext">{t(p.meta.mitIsms ? 'pfad.mit_isms' : 'pfad.ohne_isms')} · {modulText(p)}</span>
        </div>
        <GestaltungStand p={p} />
        <div class="leiste" style={{ marginTop: '12px' }}>
          {/* Bibliothek (ab rc.10): nur sichtbar, wenn ein Ordner oder der Browserspeicher verbunden ist */}
          <InBibliothekLegen p={p} gesperrt={laeuft} />
          {p.prozesse !== undefined && (
            <button type="button" id="dokumente-drawio" disabled={laeuft || drawioLaeuft} aria-busy={drawioLaeuft ? 'true' : undefined} onClick={(ev) => !zweiterKlick(ev) && void drawioLauf(async () => {
              try {
                const r = await drawioExportieren(p, sprache, undefined);
                herunterladen(r.text, r.name, 'application/xml');
                melde(t('prozesse.drawio_exportiert', { name: r.name }), 'ok');
              } catch (e) {
                melde(`${t('prozesse.drawio_fehler')}: ${fehlerVerstaendlich(e)}`, 'fehler');
              }
            })}>{t('prozesse.drawio_alle')}</button>
          )}
        </div>
        {laeuft && (
          <div style={{ marginTop: '12px' }} role="status" aria-live="polite">
            <p>{f && f.gesamt ? t('dokumente.fortschritt', { fertig: f.fertig, gesamt: f.gesamt, datei: f.datei }) : t('dokumente.startet')}</p>
            <div class="balken"><span style={{ width: `${f && f.gesamt ? (100 * f.fertig) / f.gesamt : 3}%` }} /></div>
          </div>
        )}
        {fehler && <Hinweis als="p" art="fehler" role="alert">{t('dokumente.fehler')}: {fehler}</Hinweis>}
        {ergebnis && (
          <div style={{ marginTop: '12px' }} id="set-ergebnis">
            <Hinweis als="p" art="ok">{t('dokumente.fertig', { anzahl: ergebnis.dateien.length, sekunden: zahlText(ergebnis.ms / 1000) })}</Hinweis>
            {ergebnis.fehler.length > 0 && (
              <Hinweis art="warnung">
                <p>{t('dokumente.teilweise', { anzahl: ergebnis.fehler.length })}</p>
                <ul>{ergebnis.fehler.map((x) => <li key={x.datei}>{x.datei}: {fehlerVerstaendlich(x.meldung)}</li>)}</ul>
              </Hinweis>
            )}
            {ergebnis.ausgelassen.filter((a) => a.grund === 'keine-vorlage').length > 0 && (
              <p class="zweitext">{t('dokumente.ohne_vorlage', { ids: ergebnis.ausgelassen.filter((a) => a.grund === 'keine-vorlage').map((a) => a.id).join(', ') })}</p>
            )}
          </div>
        )}
      </div>
      <div class="karte">
        <h2>{t('dokumente.einzeln')}</h2>
        <div class="tabelle-feld">
          <table class="kartenliste">
            <thead><tr><th scope="col">{t('liste.id')}</th><th scope="col">{t('liste.titel')}</th><th scope="col"><span class="nur-sr">{t('feld.aktionen')}</span></th></tr></thead>
            <tbody>
              {zeilen.map((z) => (
                <tr key={z.id}>
                  <td class="k-id"><span class="marke-id">{z.id}</span></td>
                  <td class="k-titel">{z.titel}</td>
                  <td class="k-status">
                    <div class="leiste">
                      <button type="button" class="klein" disabled={laeuft} aria-busy={aktiv === z.auswahl ? 'true' : undefined} onClick={(ev) => !zweiterKlick(ev) && void lauf([z.auswahl], true)}>{t('dokumente.herunterladen', { format: z.format.toUpperCase() })}</button>
                      <button type="button" class="klein leise" disabled={laeuft} onClick={() => void druckansicht(z.auswahl)}>{t('dokumente.druckansicht')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
