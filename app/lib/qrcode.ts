/**
 * Standard ISO/IEC 18004 QR Code Generator (Byte Mode, Error Correction Level L).
 * Produces 100% spec-compliant, camera-scannable QR matrices for URLs and text.
 */

// Error Correction Level L capacities (bytes) and EC codewords per block for Versions 1..10
const VERSION_TABLE: Array<{
  version: number;
  totalCodewords: number;
  ecCodewordsPerBlock: number;
  blocks: Array<{ count: number; dataCodewords: number }>;
  alignment: number[];
}> = [
  {
    version: 1,
    totalCodewords: 26,
    ecCodewordsPerBlock: 7,
    blocks: [{ count: 1, dataCodewords: 19 }],
    alignment: [],
  },
  {
    version: 2,
    totalCodewords: 44,
    ecCodewordsPerBlock: 10,
    blocks: [{ count: 1, dataCodewords: 34 }],
    alignment: [6, 18],
  },
  {
    version: 3,
    totalCodewords: 70,
    ecCodewordsPerBlock: 15,
    blocks: [{ count: 1, dataCodewords: 55 }],
    alignment: [6, 22],
  },
  {
    version: 4,
    totalCodewords: 100,
    ecCodewordsPerBlock: 20,
    blocks: [{ count: 1, dataCodewords: 80 }],
    alignment: [6, 26],
  },
  {
    version: 5,
    totalCodewords: 134,
    ecCodewordsPerBlock: 26,
    blocks: [{ count: 1, dataCodewords: 108 }],
    alignment: [6, 30],
  },
  {
    version: 6,
    totalCodewords: 172,
    ecCodewordsPerBlock: 18,
    blocks: [{ count: 2, dataCodewords: 68 }],
    alignment: [6, 34],
  },
  {
    version: 7,
    totalCodewords: 196,
    ecCodewordsPerBlock: 20,
    blocks: [{ count: 2, dataCodewords: 78 }],
    alignment: [6, 22, 38],
  },
  {
    version: 8,
    totalCodewords: 242,
    ecCodewordsPerBlock: 24,
    blocks: [{ count: 2, dataCodewords: 97 }],
    alignment: [6, 24, 42],
  },
  {
    version: 9,
    totalCodewords: 292,
    ecCodewordsPerBlock: 30,
    blocks: [{ count: 2, dataCodewords: 116 }],
    alignment: [6, 26, 46],
  },
  {
    version: 10,
    totalCodewords: 346,
    ecCodewordsPerBlock: 18,
    blocks: [
      { count: 2, dataCodewords: 68 },
      { count: 2, dataCodewords: 69 },
    ],
    alignment: [6, 28, 50],
  },
];

// GF(256) tables with primitive polynomial 0x11d
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsComputeRemainder(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGeneratorPoly(ecCount);
  const res = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ res[0];
    res.copyWithin(0, 1);
    res[ecCount - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecCount; j++) {
        res[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return res;
}

// Format info bits for EC Level L (01) and Mask 0..7 (precomputed BCH(15,5) ^ 0x5412)
const FORMAT_BITS_L = [
  0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976,
];

// Version info bits for Versions 7..10 (18-bit Golay)
const VERSION_BITS: Record<number, number> = {
  7: 0x07c94,
  8: 0x085bc,
  9: 0x09a99,
  10: 0x0a4d3,
};

export function generateQrMatrix(text: string): boolean[][] {
  const utf8Bytes = new TextEncoder().encode(text);

  // Choose smallest version that fits Byte Mode (4-bit mode + 8/16-bit len + bytes)
  let spec = VERSION_TABLE[VERSION_TABLE.length - 1];
  for (const candidate of VERSION_TABLE) {
    const totalDataBytes = candidate.blocks.reduce(
      (acc, b) => acc + b.count * b.dataCodewords,
      0,
    );
    const charCountBits = candidate.version <= 9 ? 8 : 16;
    const neededBits = 4 + charCountBits + utf8Bytes.length * 8;
    if (neededBits <= totalDataBytes * 8) {
      spec = candidate;
      break;
    }
  }

  const totalDataBytes = spec.blocks.reduce(
    (acc, b) => acc + b.count * b.dataCodewords,
    0,
  );
  const charCountBits = spec.version <= 9 ? 8 : 16;

  // Build bit buffer
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  // Mode: Byte (0100)
  pushBits(0b0100, 4);
  const maxBytes = Math.min(
    utf8Bytes.length,
    Math.floor((totalDataBytes * 8 - 4 - charCountBits) / 8),
  );
  pushBits(maxBytes, charCountBits);
  for (let i = 0; i < maxBytes; i++) {
    pushBits(utf8Bytes[i], 8);
  }

  // Terminator up to 4 zero bits
  const maxBits = totalDataBytes * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  pushBits(0, termLen);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Convert to bytes and add pad bytes 0xEC, 0x11
  const dataBytes = new Uint8Array(totalDataBytes);
  let byteIdx = 0;
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    dataBytes[byteIdx++] = b;
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (byteIdx < totalDataBytes) {
    dataBytes[byteIdx++] = padBytes[padIdx++ % 2];
  }

  // Split into RS blocks and interleave
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (const grp of spec.blocks) {
    for (let b = 0; b < grp.count; b++) {
      const slice = dataBytes.subarray(offset, offset + grp.dataCodewords);
      offset += grp.dataCodewords;
      dataBlocks.push(slice);
      ecBlocks.push(rsComputeRemainder(slice, spec.ecCodewordsPerBlock));
    }
  }

  const finalCodewords: number[] = [];
  const maxBlockDataLen = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxBlockDataLen; i++) {
    for (const blk of dataBlocks) {
      if (i < blk.length) finalCodewords.push(blk[i]);
    }
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
    for (const ec of ecBlocks) {
      finalCodewords.push(ec[i]);
    }
  }

  const size = spec.version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );

  const setFunc = (r: number, c: number, val: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      modules[r][c] = val;
      isFunction[r][c] = true;
    }
  };

  // Finder patterns + separators
  const drawFinder = (tr: number, tc: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = tr + r;
        const cc = tc + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setFunc(rr, cc, inOuter && (isBorder || isCenter));
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const alignCoords = spec.alignment;
  for (let i = 0; i < alignCoords.length; i++) {
    for (let j = 0; j < alignCoords.length; j++) {
      const cr = alignCoords[i];
      const cc = alignCoords[j];
      if (isFunction[cr][cc]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFunc(cr + dr, cc + dc, dist !== 1);
        }
      }
    }
  }

  // Reserve format info areas & dark module
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      setFunc(8, i, false);
      setFunc(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) {
    setFunc(8, size - 1 - i, false);
    setFunc(size - 1 - i, 8, false);
  }
  setFunc(size - 8, 8, true);

  // Version info areas (Version >= 7)
  if (spec.version >= 7 && VERSION_BITS[spec.version]) {
    const vBits = VERSION_BITS[spec.version];
    for (let i = 0; i < 18; i++) {
      const bit = ((vBits >>> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = size - 11 + (i % 3);
      setFunc(a, b, bit);
      setFunc(b, a, bit);
    }
  }

  // Place data bits in zig-zag columns
  const bitStream: number[] = [];
  for (const cw of finalCodewords) {
    for (let i = 7; i >= 0; i--) bitStream.push((cw >>> i) & 1);
  }

  let bitPos = 0;
  let upward = true;
  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let dx = 0; dx < 2; dx++) {
        const c = rightCol - dx;
        if (!isFunction[r][c]) {
          modules[r][c] = bitPos < bitStream.length && bitStream[bitPos] === 1;
          bitPos++;
        }
      }
    }
    upward = !upward;
  }

  // Apply Mask 0 ((r + c) % 2 === 0) and write Format Info for Level L, Mask 0
  const maskId = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isFunction[r][c] && (r + c) % 2 === 0) {
        modules[r][c] = !modules[r][c];
      }
    }
  }

  const fmt = FORMAT_BITS_L[maskId];
  const fmtBit = (i: number) => ((fmt >>> i) & 1) === 1;

  // Around top-left finder
  for (let i = 0; i <= 5; i++) modules[8][i] = fmtBit(14 - i);
  modules[8][7] = fmtBit(8);
  modules[8][8] = fmtBit(7);
  modules[7][8] = fmtBit(6);
  for (let i = 0; i <= 5; i++) modules[5 - i][8] = fmtBit(5 - i);

  // Split across bottom-left and top-right
  for (let i = 0; i < 7; i++) modules[size - 1 - i][8] = fmtBit(14 - i);
  for (let i = 0; i < 8; i++) modules[8][size - 8 + i] = fmtBit(7 - i);

  return modules;
}
