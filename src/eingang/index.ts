// Eingangsmodul (AF-018 bis AF-020): Grenzen, begrenztes Lesen, JSON aus Dateitext, Zeitgrenze und Herzschlag im Worker
export { EINGANGSARTEN, GRENZEN, JSON_MAX_TIEFE, LOGO_GRENZEN, XML_MAX_TIEFE, grenzPlatzhalter, grenzeVon, groesseText, type EingangsArt, type Grenze } from './grenzen.ts';
export { EingangsFehler, groessePruefen, jsonLesen, liesBegrenzt, liesJsonBegrenzt, liesStueckweise, liesTextBegrenzt, strukturPruefen, zipEintraegeVorab, type DateiQuelle, type EingangsGrund } from './lesen.ts';
export { wacheStarten, type Uhr, type Wache } from './zeit.ts';
