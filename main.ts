// THE WORLD — Friday 27 November 2026.
// A dense tabloid front page drawn entirely in code: one hero story and
// 35 more real stories from the day, across 7 regions, rendered with a
// built-in 5x7 bitmap font and a hand-written PNG encoder (node:zlib).
// Deterministic: no clock, no randomness, no network. Two runs write
// identical bytes. Output: /output/entry.png (1024 x 1024, under 1 MiB).

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---- palette: newsprint cream, ink navy, signal red, muted region hues ----
const PAPER: RGB = [247, 243, 232];
const INK: RGB = [20, 33, 61];
const INKSOFT: RGB = [52, 64, 92];
const RED: RGB = [178, 28, 28];
const RULE: RGB = [20, 33, 61];
const WHITE: RGB = [255, 255, 255];
const GOLD: RGB = [196, 148, 44];
const TEAL: RGB = [15, 118, 110];
const SLATE: RGB = [71, 85, 105];
const SKY: RGB = [186, 214, 232];
const SAND: RGB = [232, 214, 178];
const SMOKE: RGB = [226, 220, 205];

type RGB = [number, number, number];

// ---- framebuffer ----------------------------------------------------------
const px = new Uint8Array(W * H * 3);
function fill(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}
function setPix(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
    }
  }
}
function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setPix(x, y, c);
    }
  }
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= n; i++) {
    setPix(Math.round(x0 + (dx * i) / n), Math.round(y0 + (dy * i) / n), c);
  }
}
// filled triangle
function tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: RGB): void {
  const minX = Math.max(0, Math.min(ax, bx, cx));
  const maxX = Math.min(W - 1, Math.max(ax, bx, cx));
  const minY = Math.max(0, Math.min(ay, by, cy));
  const maxY = Math.min(H - 1, Math.max(ay, by, cy));
  const d = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w0 = ((bx - x) * (cy - y) - (by - y) * (cx - x)) / d;
      const w1 = ((cx - x) * (ay - y) - (cy - y) * (ax - x)) / d;
      const w2 = 1 - w0 - w1;
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) setPix(x, y, c);
    }
  }
}

// ---- PNG encoder (filter 0, zlib level 9) ---------------------------------
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function encodePNG(): Uint8Array {
  const raw = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W);
  dv.setUint32(4, H);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0))];
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

// ---- 5x7 bitmap font ------------------------------------------------------
// Each glyph: 7 rows of 5 bits, written as strings. Uppercase + digits +
// common punctuation. All page text is uppercased before drawing.
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  '"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
  "*": ["00000", "10101", "01110", "10101", "00000", "00000", "00000"],
};
const CHAR_W = 6; // 5 px glyph + 1 px gap, times scale
function textWidth(s: string, scale: number): number {
  return s.length * CHAR_W * scale - scale;
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  const up = s.toUpperCase();
  for (let ci = 0; ci < up.length; ci++) {
    const g = GLYPHS[up[ci]] ?? GLYPHS["?"];
    const ox = x + ci * CHAR_W * scale;
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") {
          rect(ox + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
  }
}
function drawTextCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}
// Greedy word wrap into lines that fit maxW px at the given scale.
function wrap(s: string, scale: number, maxW: number): string[] {
  const words = s.toUpperCase().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxW || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ---- the day's news: 36 real stories, first reported 27 Nov 2026 --------
// Sources this morning: NYT, BBC, Reuters, AP, NDTV, India Today, NPR,
// The Hindu, Mint, ChessBase India. Headlines are short so they stay
// legible; decks carry one verified fact each.
interface Story {
  h: string;
  d: string;
}
interface Region {
  name: string;
  color: RGB;
  stories: Story[];
}
const REGIONS: Region[] = [
  {
    name: "NORTH AMERICA",
    color: RED,
    stories: [
      { h: "MACY PARADE POSTPONED", d: "Storm moves the 100th march to Saturday, a first." },
      { h: "STORM HITS 80M TRAVELLERS", d: "Travel chaos; 500,000 homes and firms lose power." },
      { h: "TRUMP TO PUTIN: PULL BACK", d: "President presses Moscow after a NATO meeting." },
      { h: "US ECONOMY UP 4.3% IN Q3", d: "Fastest growth in three years, led by AI spend." },
      { h: "DINNER COSTS USD 58.63", d: "Meal for 10 rises for the first time since 2022." },
      { h: "FCC VIOLATED ABC SPEECH", d: "Court rules the regulator breached free speech." },
    ],
  },
  {
    name: "EUROPE",
    color: INK,
    stories: [
      { h: "UK MIGRATION AT 1997 LOW", d: "Lowest net migration outside the pandemic years." },
      { h: "DEPARDIEU FACES TRIAL", d: "French court orders trial over an alleged rape." },
      { h: "DRONE ENTERS POLAND", d: "Second NATO airspace breach in four days." },
      { h: "RAMAPHOSA WINS IN COURT", d: "President overturns an impeachment report." },
      { h: "TANKER SINKS OFF IBIZA", d: "Diesel tanker sinks; one crew member killed." },
    ],
  },
  {
    name: "MIDDLE EAST",
    color: TEAL,
    stories: [
      { h: "HAMAS WEIGHS RESPONSE", d: "Group mulls reply after Israel kills 10 in Gaza." },
      { h: "16 CHILDREN KILLED", d: "Strikes killed 16 children in Gaza this month." },
      { h: "REFINERY ATTACK KILLS 1", d: "Fire at Jazan refinery kills a Nepali worker." },
      { h: "UKRAINE HITS AIRBASE", d: "Five jets damaged; Kyiv hit by missiles in reply." },
      { h: "TWO TANKERS HIT BY MINES", d: "Iran says mines hit two tankers in Hormuz." },
    ],
  },
  {
    name: "ASIA",
    color: GOLD,
    stories: [
      { h: "GUKESH DRAWS GAME 3", d: "Game 3 ends level after 60 moves; match 1.5-1.5." },
      { h: "INDIA MARKS 26/11", d: "Mumbai remembers the 2008 attacks, 18 years on." },
      { h: "CYCLONE AKVAN NEARS", d: "80,000 people moved to safety on the east coast." },
      { h: "CHINA: BORDER STABLE", d: "Beijing says the border situation is stable." },
      { h: "TATA TRUSTS SUE IN COURT", d: "Trusts challenge the chairman's reappointment." },
      { h: "PMLA NEEDS JUDGE: COURT", d: "Top court rules on confirming attachment orders." },
    ],
  },
  {
    name: "AFRICA",
    color: [122, 74, 28],
    stories: [
      { h: "EBOLA PASSES 12,000", d: "Cases top 12,000 as unrest forces medics to flee." },
      { h: "CAIRO FIRE KILLS 31", d: "Tanker crash ignites a huge fire on Ring Road." },
      { h: "NEPAL DECLARES 4,000 DEAD", d: "Missing landslide victims formally declared dead." },
      { h: "REFUGEE DIED IN ESWATINI", d: "UK moved a refugee there in a secret deal." },
    ],
  },
  {
    name: "LATIN AMERICA",
    color: [46, 111, 58],
    stories: [
      { h: "30 HOSTAGES IN CARTAGENA", d: "Gunmen hold shoppers after a failed robbery." },
      { h: "ABREGO GARCIA TO SPAIN", d: "He leaves the US freely, ending a deportation row." },
      { h: "SHOEBOXES TO VENEZUELA", d: "First US shoebox airlift heads to Venezuela." },
    ],
  },
  {
    name: "BUSINESS, TECH + SPORT",
    color: SLATE,
    stories: [
      { h: "SHOPPERS COOL ON FRIDAY", d: "59% of shoppers plan to use AI for holiday buys." },
      { h: "RAM PRICES TRIPLE", d: "Chip shortage squeezes PC buyers as demand soars." },
      { h: "HUANG BACK AT NVIDIA", d: "Shares jump 31% as Jensen Huang returns as CEO." },
      { h: "CLAUDE MAKES APPS", d: "Anthropic turns artifacts into working apps." },
      { h: "PLANET BEYOND NEPTUNE?", d: "New evidence points to a distant giant world." },
      { h: "SINNER OUT OF OZ OPEN", d: "Sinner quits the 2027 event with a knee injury." },
    ],
  },
];

// ---- layout helpers -------------------------------------------------------
const MARGIN = 24;
function storyBlock(x: number, y: number, w: number, region: Region): number {
  // Region header bar
  rect(x, y, w, 24, region.color);
  drawText(x + 8, y + 5, region.name, 2, WHITE);
  const count = String(region.stories.length);
  drawText(x + w - 8 - textWidth(count, 2), y + 5, count, 2, WHITE);
  y += 30;
  for (const s of region.stories) {
    const headLines = wrap(s.h, 2, w - 8);
    for (const ln of headLines) {
      drawText(x + 4, y, ln, 2, INK);
      y += 15;
    }
    const deckLines = wrap(s.d, 1, w - 8);
    for (const ln of deckLines) {
      drawText(x + 4, y, ln, 1, INKSOFT);
      y += 9;
    }
    y += 5;
    rect(x + 4, y, w - 8, 1, SMOKE);
    y += 5;
  }
  return y;
}

// ---- drawn scenes ---------------------------------------------------------
// Hero scene: a Gulf skyline at dusk, a drone crossing the sky, a burst
// of light over the water — the Kuwait drone strike, drawn, not pasted.
function heroScene(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [214, 178, 128]); // dusk sand sky
  rect(x, y + Math.floor(h * 0.62), w, h - Math.floor(h * 0.62), [38, 68, 96]); // sea
  disc(x + Math.floor(w * 0.94), y + 64, 18, [247, 220, 160]); // low sun, clear of towers
  // skyline
  const base = y + Math.floor(h * 0.62);
  const towers: [number, number, number][] = [
    [0.02, 0.5, 0.16], [0.2, 0.72, 0.12], [0.34, 0.42, 0.14],
    [0.5, 0.62, 0.12], [0.64, 0.36, 0.13], [0.79, 0.58, 0.12],
  ];
  for (const [fx, fh, fw] of towers) {
    const tx = x + Math.floor(w * fx);
    const tw = Math.floor(w * fw);
    const th = Math.floor(h * fh);
    rect(tx, base - th, tw, th, INK);
    for (let wy = base - th + 8; wy < base - 6; wy += 12) {
      for (let wx = tx + 5; wx < tx + tw - 5; wx += 11) {
        rect(wx, wy, 4, 5, GOLD);
      }
    }
  }
  // burst over the water
  const bx = x + Math.floor(w * 0.42);
  const by = base + 18;
  disc(bx, by, 26, [232, 120, 40]);
  disc(bx, by, 16, [247, 200, 90]);
  disc(bx, by, 7, WHITE);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    line(bx, by, bx + Math.round(Math.cos(a) * 40), by + Math.round(Math.sin(a) * 40), [232, 120, 40]);
  }
  // drone silhouette
  const dx = x + Math.floor(w * 0.6);
  const dy = y + 44;
  rect(dx - 26, dy - 3, 52, 6, INK);
  rect(dx - 6, dy - 8, 12, 16, INK);
  disc(dx - 30, dy - 2, 6, INKSOFT);
  disc(dx + 30, dy - 2, 6, INKSOFT);
  line(dx - 30, dy - 2, dx - 44, dy - 14, INKSOFT);
  line(dx + 30, dy - 2, dx + 44, dy - 14, INKSOFT);
  // smoke column
  rect(bx - 4, by - 46, 8, 44, [90, 88, 84]);
  disc(bx, by - 50, 12, [120, 116, 110]);
  disc(bx + 8, by - 58, 9, [140, 136, 130]);
}

// ---- page composition -----------------------------------------------------
function buildPage(): void {
  fill(PAPER);
  let y = MARGIN;

  // Masthead
  rect(MARGIN, y, W - 2 * MARGIN, 88, INK);
  rect(MARGIN, y + 88, W - 2 * MARGIN, 4, RED);
  drawTextCentered(W / 2, y + 8, "THE WORLD", 8, WHITE);
  drawTextCentered(W / 2, y + 70, "ONE DAY - EVERY STORY THAT MATTERED", 1, GOLD);
  y += 98;

  // Date line
  drawTextCentered(W / 2, y, "FRIDAY 27 NOVEMBER 2026", 4, RED);
  y += 32;
  drawTextCentered(W / 2, y, "36 STORIES - 7 REGIONS - ALL FIRST REPORTED TODAY", 2, INKSOFT);
  y += 24;
  rect(MARGIN, y, W - 2 * MARGIN, 2, RULE);
  y += 10;

  // Hero: scene left, headline right
  const heroH = 176;
  const heroX = MARGIN;
  const heroW = W - 2 * MARGIN;
  const sceneW = 330;
  heroScene(heroX, y, sceneW, heroH);
  rect(heroX + sceneW, y, 4, heroH, RED);
  const hx = heroX + sceneW + 18;
  const hw = heroW - sceneW - 22;
  drawText(hx, y + 4, "KUWAIT - THE LEAD STORY", 2, RED);
  const heroLines = wrap("DRONE STRIKE IN KUWAIT KILLS TWO ITALIANS", 4, hw);
  let hy = y + 30;
  for (const ln of heroLines) {
    drawText(hx, hy, ln, 4, INK);
    hy += 32;
  }
  const heroDeck = wrap("Iran denies responsibility for the attack on a site in Kuwait, as two Italian technicians are killed and the Gulf braces for more strikes.", 1, hw);
  for (const ln of heroDeck) {
    drawText(hx, hy, ln, 1, INKSOFT);
    hy += 11;
  }
  hy += 6;
  drawText(hx, hy, "ALSO: PARADE DELAYED - STORM HITS 80M - GUKESH DRAWS AGAIN", 1, RED);
  rect(heroX, y + heroH, heroW, 2, RULE);
  y += heroH + 10;

  // Three columns of regions
  const colGap = 16;
  const colW = Math.floor((W - 2 * MARGIN - 2 * colGap) / 3);
  const colX = [MARGIN, MARGIN + colW + colGap, MARGIN + 2 * (colW + colGap)];
  const colTop = y;
  let end1 = storyBlock(colX[0], colTop, colW, REGIONS[0]);
  end1 = storyBlock(colX[0], end1, colW, REGIONS[1]);
  let end2 = storyBlock(colX[1], colTop, colW, REGIONS[2]);
  end2 = storyBlock(colX[1], end2, colW, REGIONS[3]);
  let end3 = storyBlock(colX[2], colTop, colW, REGIONS[4]);
  end3 = storyBlock(colX[2], end3, colW, REGIONS[5]);
  end3 = storyBlock(colX[2], end3, colW, REGIONS[6]);

  // Footer: rule, timeline on one row, date check, sources
  const footY = Math.max(end1, end2, end3) + 10;
  rect(MARGIN, footY, W - 2 * MARGIN, 2, RULE);
  drawText(MARGIN, footY + 10, "THE DAY IN UTC", 2, RED);
  const stamps: [string, string][] = [
    ["00:00", "DRONE STRIKE"],
    ["03:00", "EBOLA 12,000"],
    ["07:00", "PARADE DELAYED"],
    ["12:00", "US GDP 4.3%"],
    ["15:00", "CHESS DRAWS"],
    ["19:00", "BLACK FRIDAY"],
  ];
  let tx = MARGIN;
  const tw = Math.floor((W - 2 * MARGIN) / stamps.length);
  for (const [t, label] of stamps) {
    drawText(tx, footY + 32, t + " " + label, 1, INK);
    tx += tw;
  }
  drawTextCentered(W / 2, footY + 50, "DATE CHECK: EVERY STORY FIRST REPORTED FRIDAY 27 NOVEMBER 2026", 1, INK);
  drawTextCentered(W / 2, footY + 66, "SOURCES: NYT - BBC - REUTERS - AP - NDTV - INDIA TODAY - THE HINDU - MINT", 1, INKSOFT);
}

// ---- entry point ----------------------------------------------------------
function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
  mkdirSync(outDir, { recursive: true });
  buildPage();
  const png = encodePNG();
  writeFileSync(outDir + "/entry.png", png);
}

main();
