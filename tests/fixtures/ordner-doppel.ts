// Test-Doppel eines Ordners der File System Access API im Arbeitsspeicher (FileSystemDirectoryHandle).
import type { DateiGriff, OrdnerGriff } from '../../src/bibliothek/ablage.ts';

export class SpeicherDatei implements DateiGriff {
  readonly kind = 'file' as const;
  daten = new Uint8Array();
  geaendert = 1;
  nichtLokal = false;
  constructor(readonly name: string, private readonly uhr: () => number) {}
  async getFile(): Promise<File> {
    if (this.nichtLokal) throw Object.assign(new Error('nur in der Cloud'), { name: 'NotReadableError' });
    return new File([this.daten as BlobPart], this.name, { lastModified: this.geaendert });
  }
  async createWritable() {
    const teile: Uint8Array[] = [];
    return {
      write: async (d: BufferSource | Blob) => {
        teile.push(d instanceof Blob ? new Uint8Array(await d.arrayBuffer()) : new Uint8Array(ArrayBuffer.isView(d) ? d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) : d));
      },
      close: async () => {
        const n = teile.reduce((s, t) => s + t.length, 0);
        const u = new Uint8Array(n);
        let o = 0;
        for (const t of teile) {
          u.set(t, o);
          o += t.length;
        }
        this.daten = u;
        this.geaendert = this.uhr();
      },
    };
  }
}

export class SpeicherOrdner implements OrdnerGriff {
  readonly kind = 'directory' as const;
  readonly kinder = new Map<string, SpeicherOrdner | SpeicherDatei>();
  berechtigung: PermissionState = 'granted';
  constructor(readonly name: string, readonly uhr: () => number = (() => { let t = 1_700_000_000_000; return () => (t += 1000); })()) {}
  async getDirectoryHandle(name: string, o?: { create?: boolean }): Promise<SpeicherOrdner> {
    const k = this.kinder.get(name);
    if (k instanceof SpeicherOrdner) return k;
    if (k || !o?.create) throw Object.assign(new Error(`fehlt: ${name}`), { name: k ? 'TypeMismatchError' : 'NotFoundError' });
    const neu = new SpeicherOrdner(name, this.uhr);
    this.kinder.set(name, neu);
    return neu;
  }
  async getFileHandle(name: string, o?: { create?: boolean }): Promise<SpeicherDatei> {
    const k = this.kinder.get(name);
    if (k instanceof SpeicherDatei) return k;
    if (k || !o?.create) throw Object.assign(new Error(`fehlt: ${name}`), { name: k ? 'TypeMismatchError' : 'NotFoundError' });
    const neu = new SpeicherDatei(name, this.uhr);
    this.kinder.set(name, neu);
    return neu;
  }
  async removeEntry(name: string): Promise<void> {
    if (!this.kinder.delete(name)) throw Object.assign(new Error(`fehlt: ${name}`), { name: 'NotFoundError' });
  }
  async *values(): AsyncIterable<SpeicherOrdner | SpeicherDatei> {
    yield* this.kinder.values();
  }
  async queryPermission(): Promise<PermissionState> {
    return this.berechtigung;
  }
  async requestPermission(): Promise<PermissionState> {
    this.berechtigung = 'granted';
    return 'granted';
  }
  /** Datei über ihren Pfad (für Änderungen «ausserhalb» im Test) */
  async datei(pfad: string): Promise<SpeicherDatei> {
    const teile = pfad.split('/');
    let o: SpeicherOrdner = this;
    for (const t of teile.slice(0, -1)) o = await o.getDirectoryHandle(t);
    return o.getFileHandle(teile.at(-1)!);
  }
}
