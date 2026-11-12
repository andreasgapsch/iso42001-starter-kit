// Ablauf eines Prozesses als Inline-SVG (eigener Renderer, kein draw.io-Code): Bahnen je Rolle, Formen und Kanten aus
// dem Raster (src/prozesse/layout.ts), gezeichnet von src/grafik/svg/ablauf.ts ohne innerHTML (Trusted Types). Die
// Schritt-Tabelle daneben ist die gleichwertige Textfassung; das SVG trägt Titel und Kurzbeschreibung.
import { ablaufSzene } from '../svg/ablauf.ts';
import { SPALTE_PX, type ProzessRaster } from '../../prozesse/layout.ts';
import { SzeneSvg } from './Szene.tsx';

export function Prozessablauf({ raster, titel, beschreibung, id }: { raster: ProzessRaster; titel: string; beschreibung: string; id: string }) {
  const szene = ablaufSzene(raster, { titel, beschreibung }, { id, breite: SPALTE_PX * raster.spalten + 24, zeilenHoehe: raster.zeilenHoehe });
  return (
    <div class="g-figur prozess-ablauf" id={`${id}-figur`}>
      <SzeneSvg szene={szene} />
    </div>
  );
}
