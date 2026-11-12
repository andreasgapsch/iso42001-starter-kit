// Vite bündelt CSS-Importe als Seiteneffekt (src/app/main.tsx).
declare module '*.css';
// Lizenztexte der eingebetteten Schriften als Text (Vite ?raw)
declare module '*.txt?raw' {
  const text: string;
  export default text;
}
// import.meta.glob von Vite (src/app/rahmen/bibliothek-anbindung.tsx): fehlende Dateien ergeben ein leeres Objekt
interface ImportMeta {
  glob<M = Record<string, unknown>>(muster: string | string[], optionen: { eager: true; import?: string }): Record<string, M>;
}
