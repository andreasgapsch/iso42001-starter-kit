// Öffentliche Schnittstelle des Dokumentengenerators.
export type * from './ir.ts';
export { renderDocx } from './docx.ts';
export { renderXlsx } from './xlsx.ts';
export { zipErstellen, type ZipEintrag, type ZipOptionen } from './zip.ts';
export type { RenderOptionen } from './eigenschaften.ts';
