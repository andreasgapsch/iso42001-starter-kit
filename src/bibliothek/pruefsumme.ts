// SHA-256 einer Datei als Hex (Web Crypto; unter file:// in Chromium, Firefox und WebKit verfügbar, ebenso in Node und im Worker).
import { liesBegrenzt, liesStueckweise } from '../eingang/lesen.ts';
export async function sha256(daten: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto nicht verfügbar');
  const h = new Uint8Array(await subtle.digest('SHA-256', daten as BufferSource));
  let s = '';
  for (const b of h) s += b.toString(16).padStart(2, '0');
  return s;
}

const K = /* @__PURE__ */ (() => {
  // Bruchteile der Kubikwurzeln der ersten 64 Primzahlen (FIPS 180-4)
  const aus: number[] = [];
  for (let n = 2; aus.length < 64; n++) {
    let prim = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) prim = false;
    if (prim) aus.push(Math.floor((Math.cbrt(n) % 1) * 2 ** 32));
  }
  return Uint32Array.from(aus);
})();

/** SHA-256 über Stücke: Web Crypto kennt nur einen Durchgang über den ganzen Inhalt, grosse Dateien passen aber nicht in den Speicher */
export class Sha256Strom {
  private readonly h = Uint32Array.of(0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19);
  private readonly w = new Uint32Array(64);
  private readonly rest = new Uint8Array(64);
  private restLaenge = 0;
  private laenge = 0;

  private block(b: Uint8Array, o: number): void {
    const w = this.w;
    const h = this.h;
    for (let i = 0; i < 16; i++) w[i] = (b[o + i * 4]! << 24) | (b[o + i * 4 + 1]! << 16) | (b[o + i * 4 + 2]! << 8) | b[o + i * 4 + 3]!;
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15]!;
      const c = w[i - 2]!;
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((c >>> 17) | (c << 15)) ^ ((c >>> 19) | (c << 13)) ^ (c >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) | 0;
    }
    let [a, b1, c, d, e, f, g, hh] = h as unknown as [number, number, number, number, number, number, number, number];
    for (let i = 0; i < 64; i++) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (hh + s1 + ((e & f) ^ (~e & g)) + K[i]! + w[i]!) | 0;
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (s0 + ((a & b1) ^ (a & c) ^ (b1 & c))) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b1;
      b1 = a;
      a = (t1 + t2) | 0;
    }
    h[0]! += a;
    h[1]! += b1;
    h[2]! += c;
    h[3]! += d;
    h[4]! += e;
    h[5]! += f;
    h[6]! += g;
    h[7]! += hh;
  }

  dazu(d: Uint8Array): void {
    this.laenge += d.length;
    let o = 0;
    if (this.restLaenge) {
      const n = Math.min(64 - this.restLaenge, d.length);
      this.rest.set(d.subarray(0, n), this.restLaenge);
      this.restLaenge += n;
      o = n;
      if (this.restLaenge < 64) return;
      this.block(this.rest, 0);
      this.restLaenge = 0;
    }
    for (; o + 64 <= d.length; o += 64) this.block(d, o);
    if (o < d.length) {
      this.rest.set(d.subarray(o));
      this.restLaenge = d.length - o;
    }
  }

  ende(): string {
    const bits = this.laenge * 8;
    const pad = new Uint8Array((this.restLaenge < 56 ? 56 : 120) - this.restLaenge + 8);
    pad[0] = 0x80;
    const dv = new DataView(pad.buffer);
    dv.setUint32(pad.length - 8, Math.floor(bits / 2 ** 32));
    dv.setUint32(pad.length - 4, bits >>> 0);
    this.dazu(pad);
    return [...this.h].map((x) => x.toString(16).padStart(8, '0')).join('');
  }
}

/** Bis zu dieser Grösse rechnet Web Crypto auf einmal; darüber Stück für Stück, die Oberfläche bleibt dazwischen frei */
const STROM_AB = 64 * 1024 * 1024;
const STUECK = 4 * 1024 * 1024;

/** Prüfsumme einer Datei, ohne sie ganz in den Speicher zu laden */
export async function sha256Datei(b: Blob): Promise<string> {
  if (b.size <= STROM_AB) return sha256(await liesBegrenzt(b, 'bibliotheksdatei'));
  const s = new Sha256Strom();
  for await (const stueck of liesStueckweise(b, STUECK)) s.dazu(stueck);
  return s.ende();
}
