// Alle Ziele ohne Browser, je Eingabeart eines
import type { Eingabeart, Ziel, ZielName } from '../typen.ts';
import { drawio } from './drawio.ts';
import { kiErgebnis } from './ki-ergebnis.ts';
import { normPdf } from './norm-pdf.ts';
import { normpaket } from './normpaket.ts';
import { projektdatei } from './projektdatei.ts';
import { selbsttestZiele } from './selbsttest.ts';
import { sicherung } from './sicherung.ts';
import { gestaltungspaket, svgLogo } from './svg.ts';
import { wordVorlage } from './word-vorlage.ts';

export const ZIELE: Record<Eingabeart, Ziel> = {
  projektdatei,
  'ki-ergebnis': kiErgebnis,
  sicherung,
  gestaltungspaket,
  'svg-logo': svgLogo,
  'word-vorlage': wordVorlage,
  drawio,
  normpaket,
  'norm-pdf': normPdf,
};

/** Mit den Selbsttest-Zielen; nur der Selbsttest des Werkzeugs nutzt die zusätzlichen */
export const ALLE_ZIELE: Record<ZielName, Ziel> = { ...ZIELE, ...selbsttestZiele };
