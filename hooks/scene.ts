// The picture: a pixel-art meadow where Claude plays whack-a-mole. Each kind
// of tool has a hole. A mole pops up when a call starts and Claude brings the
// mallet down when it ends.
//
// It comes by day and by night. The night is the same meadow in darker,
// bluer colors under a moon and stars, with fireflies for butterflies and a
// pool of lamplight around each hole.
//
// There are no words in it. A kind of tool is told by its mole's costume, by
// what the mole does while its call runs, and by what flies out when it is
// whacked: paper for reading, pencil shavings for editing, lightning for
// commands, ripples for the web, circling stars for agents, sparks for MCP
// and dust for the rest.
//
// Everything is drawn as vector rectangles on a pixel grid, and everything
// that moves is a CSS animation: the app runs no script in a backdrop. The app
// starts every animation over each time the picture is drawn again, so each
// one is given a delay worked out from the clock: a loop takes up where it
// was, and a pop or a whack plays from the moment its call began or ended.

import type { Call, Flow, Lane } from '../types'

export const LANES: { lane: Lane; color: string }[] = [
  { lane: 'read', color: '#2563eb' },
  { lane: 'edit', color: '#d97706' },
  { lane: 'run', color: '#15803d' },
  { lane: 'web', color: '#0891b2' },
  { lane: 'agent', color: '#7c3aed' },
  { lane: 'mcp', color: '#db2777' },
  { lane: 'other', color: '#475569' },
]

// Where Claude waits before the first call: the hole in the middle.
export const HOME: Lane = 'web'
// The least time a mole is up before the mallet lands, so the quickest call
// still shows a pop and then a whack.
const POP_MS = 420
// How long after a call ends the mallet lands. The picture is only drawn
// again when the call ends, so a whack timed to that instant would begin
// with the mallet already down, and show for a frame or two. This leaves
// room for the swing to be seen.
const HIT_LAG_MS = 220
// Calls that end together in one hole are whacked one after another.
const HIT_GAP_MS = 200
// While a call runs, Claude taps its mole once in this long.
const TAP_MS = 1000
// How long after a whack what it threw off is still part of the picture.
export const FX_MS = 2200

const W = 1600
const H = 900
// One hole's own pixel grid. It keeps its shape while the window stretches.
const UW = 80
const UH = 64
// A hole's box in the window's coordinates. The sidebar lies over about the
// left fifth of the window and an open right panel over the right quarter, so
// the holes sit in rows of two, three and two across the conversation.
// Neighbors overlap by a little: the edges of a hole's grid are empty.
const BOX_W = 300
const BOX_H = 200
const SPOTS: [number, number][] = [
  [620, 222],
  [900, 222],
  [480, 408],
  [760, 408],
  [1040, 408],
  [620, 594],
  [900, 594],
]

type Palette = Record<string, string>

// A sprite from rows of letters, one letter a pixel: a path for each color,
// made of the runs of that color along each row.
function px(rows: string[], palette: Palette, ox = 0, oy = 0): string {
  const runs: Record<string, string> = {}

  rows.forEach((row, y) => {
    let x = 0

    while (x < row.length) {
      const letter = row[x] ?? '.'
      let end = x + 1

      while (end < row.length && row[end] === letter) end += 1
      if (palette[letter] !== undefined) {
        runs[letter] =
          (runs[letter] ?? '') + `M${ox + x} ${oy + y}h${end - x}v1h${x - end}z`
      }
      x = end
    }
  })

  return Object.entries(runs)
    .map(([letter, d]) => `<path fill="${palette[letter]}" d="${d}"/>`)
    .join('')
}

// A sprite in a box of the window that keeps its own proportions.
function boxed(
  x: number,
  y: number,
  width: number,
  height: number,
  columns: number,
  rows: number,
  inner: string,
  align = 'xMidYMid',
): string {
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 0 ${columns} ${rows}" preserveAspectRatio="${align} meet">${inner}</svg>`
}

function tint(hex: string, toWhite: number): string {
  const part = (at: number) => {
    const value = parseInt(hex.slice(at, at + 2), 16)

    return Math.round(value + (255 - value) * toWhite)
      .toString(16)
      .padStart(2, '0')
  }

  return `#${part(1)}${part(3)}${part(5)}`
}

// ---- Sprites ---------------------------------------------------------------

const INK = '#3b2416'

const MOLE = [
  '....HHHHHHHH....',
  '...HhhHHHHHHH...',
  '..HHhHHHHHHHHH..',
  '..kkkkkkkkkkkk..',
  '.kbbbbbbbbbbbbk.',
  '.kbwwebbbbwwebk.',
  '.kbwwebbbbwwebk.',
  '.kbbbbbppbbbbbk.',
  '.kbbllbppbllbbk.',
  '.kbbllwwwwllbbk.',
  '.kbblllwwlllbbk.',
  '.kbbbllllllbbbk.',
  'kkbbbbbbbbbbbbkk',
  'klkbbbbbbbbbbklk',
  'kkkbbbbbbbbbbkkk',
  '..kbbbbbbbbbbk..',
]
// Drawn over the mole's eyes when the mallet has landed.
const MOLE_DIZZY = [
  '................',
  '................',
  '................',
  '................',
  '...kbk....kbk...',
  '...bkb....bkb...',
  '...kbk....kbk...',
]
const moleOf = (color: string) =>
  px(MOLE, {
    H: color,
    h: tint(color, 0.55),
    k: INK,
    b: '#9a6845',
    l: '#d9b48a',
    p: '#ff8fa3',
    w: '#ffffff',
    e: '#1b1b1f',
  })
const DIZZY = px(MOLE_DIZZY, { b: '#9a6845', k: INK })

// Claude as the little crab: a boxy body, two upright eyes, an arm out on
// each side with a pincer's tip turned up, and four short legs. The right
// pincer holds the mallet.
const CLAUDE_ROWS = [
  '................',
  '................',
  '..oooooooooooo..',
  '..oooooooooooo..',
  '..ookooooookoo..',
  'o.ookooooookoo.o',
  'oooooooooooooooo',
  'oooooooooooooooo',
  '..oooooooooooo..',
  '..oooooooooooo..',
  '..dddddddddddd..',
  '..oo.oo..oo.oo..',
  '..oo.oo..oo.oo..',
  '..dd.dd..dd.dd..',
]
const CLAUDE_BLINK = [
  '................',
  '................',
  '................',
  '................',
  '....o......o....',
  '...kkk....kkk...',
]
const CLAUDE_PALETTE: Palette = {
  o: '#d97757',
  d: '#b65a3c',
  y: '#ffd166',
  e: '#2b1d16',
  w: '#ffffff',
  r: '#f6a58e',
  k: '#2b1d16',
}
const CLAUDE = px(CLAUDE_ROWS, CLAUDE_PALETTE, 4, 26)
const BLINK = px(CLAUDE_BLINK, CLAUDE_PALETTE, 4, 26)

// The mallet, standing up from Claude's hand at (20, 33), which it turns on.
const MALLET = px(
  [
    '.kkkkkkkk.',
    'kRRRrRRRRk',
    'kRRRrRRRRk',
    'kWWWwWWWWk',
    'kRRRrRRRRk',
    '.kkkkkkkk.',
    ...Array.from({ length: 14 }, () => '....nN....'),
  ],
  { k: INK, R: '#e5484d', r: '#ff8a8e', W: '#ffffff', w: '#f1f5f9', n: '#8a5a3c', N: '#b98a5e' },
  15,
  13,
)

const STUMP = px(
  [
    '..kkkkkkkkkkkk..',
    '.kttttttttttttk.',
    '.ktttnnnnnntttk.',
    '.kttttttttttttk.',
    '..kkkkkkkkkkkk..',
    '..knnnnnnnnnnk..',
    '..knnsnnnnnnnk..',
    '..knnsnnnnsnnk..',
    '..knnnnnnnsnnk..',
    '..knnnnnnnnnnk..',
    '..knnsnnnnnnnk..',
    '..knnsnnnnnnnk..',
    '.kknnnnnnnnnnkk.',
    'kknnnnnnnnnnnnkk',
    'kkkkkkkkkkkkkkkk',
  ],
  { k: INK, t: '#e0b07a', n: '#9b6a43', s: '#7a4f30' },
  4,
  40,
)

const DIRT: Palette = { m: '#a8774c', M: '#c99766', d: '#7d5536', k: '#24160f' }
const HOLE_BACK = px(
  [
    '....mmmmmmmmmmmmmmmmmm....',
    '..mmMMMMMMMMMMMMMMMMMMmm..',
    '.mmMMkkkkkkkkkkkkkkkkMMmm.',
    '.mMMkkkkkkkkkkkkkkkkkkMMm.',
    'mmMkkkkkkkkkkkkkkkkkkkkMmm',
    // One row more, under the near edge: without it the grass shows through
    // as a hairline where the two halves meet.
    'mmMkkkkkkkkkkkkkkkkkkkkMmm',
  ],
  DIRT,
  23,
  40,
)
// Drawn over the mole, so it rises from behind the near edge of the hole. A
// hidden mole rests 24 rows down, not 21: its hat may stand three rows taller
// than its head, and would otherwise show in the mouth of the hole.
const HOLE_FRONT = px(
  [
    'mmMMkkkkkkkkkkkkkkkkkkMMmm',
    'mmmMMMMMMMMMMMMMMMMMMMMmmm',
    '.mmmmmmmmmmmmmmmmmmmmmmmm.',
    '..ddmmmmmmmmmmmmmmmmmmdd..',
    '....dddddddddddddddddd....',
  ],
  DIRT,
  23,
  45,
)

const BURST =
  '<path fill="#ffffff" d="M34 22h4v4h4v4h-4v4h-4v-4h-4v-4h4z"/><path fill="#fff3b0" d="M35 25h2v2h2v2h-2v2h-2v-2h-2v-2h2z"/>'
const PUFF =
  '<path fill="#b9a488" stroke="#6b5a45" stroke-width=".5" d="M33 39h6v1h1v3h-1v1h-6v-1h-1v-3h1z"/>'

const TREE = px(
  [
    '......gggg......',
    '....gggggggg....',
    '...gGGggggggg...',
    '..gGGggggggggg..',
    '..gGgggggggggg..',
    '.gggggggggggggD.',
    '.ggggggggggggDD.',
    '.gggggggggggDDD.',
    '..ggggggggDDDD..',
    '..gDggggDDDDDD..',
    '...DDDDDDDDDD...',
    '....DDDDDDDD....',
    '......nNnn......',
    '......nNnn......',
    '......nNnn......',
    '......nNnn......',
    '.....nnNnnn.....',
  ],
  { g: '#35a257', G: '#7fdc8c', D: '#227a41', n: '#8a5a3c', N: '#b98a5e' },
)
const CLOUD = px(
  [
    '........wwwwww........',
    '......wwwwwwwwww......',
    '...wwwwwwwwwwwwwww....',
    '..wwwwwwwwwwwwwwwwww..',
    '.wwwwwwwwwwwwwwwwwwww.',
    'wwwwwwwwwwwwwwwwwwwwww',
    'wssswwwwwwwwwwwwssswww',
    '.sssssssssssssssssss..',
  ],
  { w: '#ffffff', s: '#cfe6f7' },
)
const SUN = px(
  [
    '....yyyyyy....',
    '..yyyyyyyyyy..',
    '.yyyYYyyyyyyy.',
    '.yyYYyyyyyyyy.',
    'yyyyyyyyyyyyyy',
    'yyyekyyyyekyyy',
    'yyyeeyyyyeeyyy',
    'yyyyyyyyyyyyyy',
    'yyoyyyyyyyyoyy',
    'yyyykyyyykyyyy',
    '.yyyykkkkyyyy.',
    '.yyyyyyyyyyyy.',
    '..yyyyyyyyyy..',
    '....yyyyyy....',
  ],
  { y: '#ffd23f', Y: '#fff1a8', e: '#5a3a12', k: '#5a3a12', o: '#ff9f4a' },
  4,
  4,
)
const TENT = px(
  [
    '.........kk.........',
    '........krrk........',
    '.......krrwwk.......',
    '......krrwwrrk......',
    '.....krrwwrrwwk.....',
    '....krrwwrrwwrrk....',
    '...krrwwrrwwrrwwk...',
    '..krrwwrrkkrrwwrrk..',
    '.krrwwrrkddkrrwwrrk.',
    'krrwwrrkddddkrrwwrrk',
    'kkkkkkkkddddkkkkkkkk',
  ],
  { k: INK, r: '#e5484d', w: '#fff5f5', d: '#5b2333' },
)
const POND = px(
  [
    '......bbbbbbbbbbbb......',
    '...bbbbbbbbbbbbbbbbbb...',
    '.bbbbBBBBbbbbbbbbbbbbbb.',
    'bbbbbbbbbbbbbbbBBBbbbbbb',
    'bbbbbbbbbbbbbbbbbbbbbbbb',
    'bbbBBBbbbbbbbbbbbbbbbbbb',
    '.bbbbbbbbbbbbbbbbbbbbbb.',
    '...bbbbbbbbbbbbbbbbbb...',
    '......bbbbbbbbbbbb......',
  ],
  { b: '#38a3ee', B: '#b7e3ff' },
)
const DUCK = px(['...yy..', '..yyko.', 'y.yyy..', 'yyyyyy.', '.yyyy..'], {
  y: '#ffe066',
  k: '#2b1d16',
  o: '#ff8c1a',
})
const flowerOf = (petal: string) =>
  px(['.f.', 'fyf', '.f.', '.g.', '.g.'], { f: petal, y: '#ffd23f', g: '#227a41' })
const TUFT = px(['g...g', '.g.g.', '.ggg.'], { g: '#2f9a4c' })
const MUSHROOM = px(['.rrr.', 'rwrwr', 'rrrrr', '.www.', '.www.'], {
  r: '#e5484d',
  w: '#fff5f5',
})
const STONE = px(['.ss.', 'sSss', 'ssss'], { s: '#9aa5b1', S: '#cfd8e3' })
const butterflyOf = (wing: string) =>
  px(['pp...pp', 'ppp.ppp', '.ppkpp.', 'ppp.ppp', 'pp...pp'], { p: wing, k: INK })

// ---- The meadow, drawn once -------------------------------------------------

// The same scatter every time: a picture that moved its flowers on each
// redraw would flicker.
function scatter(seed: number): () => number {
  let state = seed

  return () => {
    state = (state * 1103515245 + 12345) % 2147483648

    return state / 2147483648
  }
}

// The pond and the tent, in the corners beside the bottom row of holes.
const isOnTheCamp = (x: number, y: number) =>
  y > 610 && y < 770 && ((x > 300 && x < 500) || (x > 1030 && x < 1210))

const isOnAHole = (x: number, y: number) =>
  isOnTheCamp(x, y) ||
  SPOTS.some(
    ([cx, top]) =>
      x > cx - BOX_W / 2 - 30 &&
      x < cx + BOX_W / 2 &&
      y > top - 20 &&
      y < top + BOX_H,
  )

// The moon, asleep, for the night.
const MOON = px(
  [
    '....mmmmmm....',
    '..mmmmmmmmmm..',
    '.mmmMMmmmmmmm.',
    '.mmMMmmmmcmmm.',
    'mmmmmmmmmccmmm',
    'mmmmmmmmmmmmmm',
    'mmkkkmmmmkkkmm',
    'mmmmmmmmmmmmmm',
    'mmommmmmmmmomm',
    'mmmmmkmmkmmmmm',
    '.mmmmmkkmmmmm.',
    '.mmcmmmmmmmmm.',
    '..mmmmmmmmmm..',
    '....mmmmmm....',
  ],
  { m: '#fdf3c4', M: '#ffffff', c: '#e3d79b', k: '#6b5a2a', o: '#f5c9a0' },
  4,
  4,
)
const FIREFLY = px(['.g.', 'gyg', '.g.'], { g: '#d9f99d', y: '#fef9c3' })

// Day's colors as the night sees them: darker, and toward blue. Everything on
// the ground is drawn once in daylight and passed through this for the night,
// so the two pictures cannot drift apart.
function atNight(markup: string): string {
  return markup.replace(/fill="#([0-9a-f]{6})"/gi, (_, hex: string) => {
    const part = (at: number, share: number, lift: number) =>
      Math.min(255, Math.round(parseInt(hex.slice(at, at + 2), 16) * share + lift))
        .toString(16)
        .padStart(2, '0')

    return `fill="#${part(0, 0.34, 6)}${part(2, 0.46, 10)}${part(4, 0.6, 28)}"`
  })
}

function meadow(isNight: boolean): [string, string] {
  const random = scatter(20261114)
  const lit = (markup: string) => (isNight ? atNight(markup) : markup)

  // Sky in bands, as pixel art shades it.
  const bands = isNight
    ? ['#0a0f24', '#0e1733', '#132045', '#1a2c59', '#243c6e']
    : ['#4fb0f2', '#6fc0f6', '#93d2f9', '#bfe6fc', '#e3f5ff']
  let sky = ''

  bands.forEach((color, band) => {
    sky += `<rect x="0" y="${band * 46}" width="${W}" height="47" fill="${color}"/>`
  })
  if (isNight) {
    // Stars, in two sets that twinkle in turn.
    const stars = ['', '']

    for (let count = 0; count < 70; count += 1) {
      const x = Math.round(random() * W)
      const y = Math.round(4 + random() * 180)
      const size = random() < 0.2 ? 6 : 4

      stars[count % 2] += `M${x} ${y}h${size}v${size}h-${size}z`
    }
    sky += `<path class="ra" fill="#ffffff" d="${stars[0]}"/><path class="rb" fill="#c7d9ff" d="${stars[1]}"/>`
  }

  // Hills in steps, two rows deep.
  const hills = (base: number, height: number, step: number, phase: number) => {
    let d = `M0 ${base}`

    for (let x = 0; x <= W; x += step) {
      const rise =
        Math.sin(x / 190 + phase) * 0.6 + Math.sin(x / 71 + phase * 2) * 0.4
      const y = base - Math.round(((rise + 1) / 2) * height / 8) * 8

      d += `V${y}H${Math.min(W, x + step)}`
    }

    return `${d}V${base + 60}H0z`
  }
  let land = ''

  land += `<path fill="#8fd694" d="${hills(214, 96, 24, 0.4)}"/>`
  land += `<path fill="#5fbf6b" d="${hills(226, 56, 16, 2.1)}"/>`
  // The field, mown in stripes, with a checkered hem under the hills.
  land += `<rect x="0" y="226" width="${W}" height="${H - 226}" fill="#7fd36a"/>`
  for (let y = 226; y < H; y += 96) {
    land += `<rect x="0" y="${y}" width="${W}" height="48" fill="#8bdb74"/>`
  }
  let hem = ''

  for (let x = 0; x < W; x += 32) hem += `M${x} 226h16v8h-16z`
  land += `<path fill="#4fae5c" d="${hem}"/>`
  // A fence along the horizon.
  let posts = ''

  for (let x = 6; x < W; x += 44) posts += `M${x} 196h10v34h-10z`
  land += `<path fill="#f3e3c3" d="${posts}M0 204h${W}v6H0zM0 218h${W}v6H0z"/>`
  land += `<path fill="#c9a66b" d="${posts.replace(/h10v34h-10z/g, 'h10v3h-10z')}"/>`

  // The clouds come between the two halves: behind the sun or the moon and
  // the trees. See `clouds`.
  const back = sky + lit(land)

  // The sun, with rays that take turns; at night the moon, with a halo.
  const rays = (list: [number, number, number, number][]) =>
    list.map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h-${w}z`).join('')
  const orb = boxed(
    1004,
    60,
    130,
    130,
    22,
    22,
    isNight
      ? `<path class="ra" fill="#fdf3c4" fill-opacity=".22" d="${rays([[3, 1, 16, 20]])}${rays([[1, 3, 20, 16]])}"/>${MOON}`
      : `<path class="ra" fill="#ffd23f" d="${rays([
          [10, 0, 2, 3],
          [10, 19, 2, 3],
          [0, 10, 3, 2],
          [19, 10, 3, 2],
        ])}"/><path class="rb" fill="#ffd23f" d="${rays([
          [3, 3, 2, 2],
          [17, 3, 2, 2],
          [3, 17, 2, 2],
          [17, 17, 2, 2],
        ])}"/>${SUN}`,
  )

  // Under the sidebar and the right panel only strong, large shapes show, so
  // the sides are woods.
  let things = ''

  ;[
    [-20, 150, 230],
    [130, 250, 250],
    [-30, 430, 270],
    [170, 500, 200],
    [1290, 140, 250],
    [1430, 250, 230],
    [1250, 330, 190],
    [1470, 470, 200],
  ].forEach(([x, y, size]) => {
    things += boxed(Number(x), Number(y), Number(size), Math.round(Number(size) * 1.1), 16, 17, TREE, 'xMidYMax')
  })
  things += boxed(1300, 600, 250, 250, 16, 17, TREE, 'xMidYMax')
  things += boxed(336, 668, 150, 76, 24, 9, POND)
  things += `<g class="dk">${boxed(388, 680, 44, 36, 7, 5, DUCK)}</g>`
  things += boxed(1062, 636, 136, 110, 20, 11, TENT, 'xMidYMax')

  // Small things in the grass, kept clear of the holes.
  const petals = ['#ffffff', '#ff8fa3', '#ffd23f', '#c4b5fd', '#ff9f4a']
  let swayA = ''
  let swayB = ''

  for (let count = 0; count < 150; count += 1) {
    const x = Math.round(random() * (W - 40))
    const y = Math.round(250 + random() * (H - 290))
    const kind = random()
    const pick = Math.floor(random() * petals.length)

    if (isOnAHole(x, y)) continue
    if (kind < 0.42) {
      const tuft = boxed(x, y, 34, 22, 5, 3, TUFT)

      if (count % 2 === 0) swayA += tuft
      else swayB += tuft
    } else if (kind < 0.8) {
      things += boxed(x, y, 22, 36, 3, 5, flowerOf(petals[pick] ?? '#ffffff'))
    } else if (kind < 0.9) {
      things += boxed(x, y, 32, 32, 5, 5, MUSHROOM)
    } else {
      things += boxed(x, y, 30, 22, 4, 3, STONE)
    }
  }
  things += `<g class="sa">${swayA}</g><g class="sb">${swayB}</g>`

  // By night a pool of lamplight lies around each hole, so the moles, the
  // stumps and the signs, which keep their daytime colors, sit in light.
  let pools = ''

  if (isNight) {
    SPOTS.forEach(([cx, top]) => {
      const x = cx - 22
      const y = top + 148

      pools +=
        `<path fill="#ffe7a3" fill-opacity=".1" d="M${x - 150} ${y}h300v36h-300z"/>` +
        `<path fill="#ffe7a3" fill-opacity=".1" d="M${x - 118} ${y - 14}h236v64h-236z"/>` +
        `<path fill="#ffe7a3" fill-opacity=".12" d="M${x - 78} ${y - 26}h156v88h-156z"/>`
    })
  }

  // Butterflies by day and fireflies by night, each on its own round.
  let fliers = ''

  ;(isNight
    ? [
        ['b1', '', 380, 300],
        ['b2', '', 980, 520],
        ['b3', '', 700, 700],
        ['b2', '', 520, 640],
        ['b3', '', 1100, 330],
        ['b1', '', 840, 760],
      ]
    : [
        ['b1', '#ff8fa3', 380, 300],
        ['b2', '#fde047', 980, 520],
        ['b3', '#93c5fd', 700, 700],
      ]
  ).forEach(([name, wing, x, y]) => {
    fliers += `<g class="${name}">${boxed(
      Number(x),
      Number(y),
      isNight ? 22 : 40,
      isNight ? 22 : 30,
      isNight ? 3 : 7,
      isNight ? 3 : 5,
      `<g class="fp">${isNight ? FIREFLY : butterflyOf(String(wing))}</g>`,
    )}</g>`
  })

  return [back, orb + lit(things) + pools + fliers]
}

// The meadow by day and by night: for each, what lies behind the clouds and
// what lies in front of them.
const MEADOWS = { day: meadow(false), night: meadow(true) }

// Clouds that cross the whole window, each at its own pace: its class, its
// height in the sky, its width, and its period and offset in milliseconds.
const CLOUDS: [string, number, number, number, number][] = [
  ['c1', 58, 170, 150_000, 20_000],
  ['c2', 104, 120, 210_000, 95_000],
  ['c3', 66, 150, 180_000, 140_000],
  ['c4', 128, 100, 260_000, 60_000],
]
const CLOUD_NIGHT = CLOUD.replace(/#ffffff/g, '#3a4a70').replace(/#cfe6f7/g, '#2a3757')

// Each cloud where the clock puts it. Its drift is an animation, but where
// the app holds the picture still, the clouds are still spread over the sky.
function clouds(now: number, isNight: boolean): string {
  return CLOUDS.map(([name, y, width, period, offset]) => {
    const at = Math.round(-200 + 1840 * (((now + offset) % period) / period))

    return `<g class="${name}" style="transform:translateX(${at}px)">${boxed(0, y, width, 70, 22, 8, isNight ? CLOUD_NIGHT : CLOUD)}</g>`
  }).join('')
}

// Every looping animation, by class, with its period in milliseconds and an
// offset that sets one loop apart from the next of its kind.
const LOOPS: [string, string, number, number][] = [
  ['.c1', 'cl 150s linear infinite', 150_000, 20_000],
  ['.c2', 'cl 210s linear infinite', 210_000, 95_000],
  ['.c3', 'cl 180s linear infinite', 180_000, 140_000],
  ['.c4', 'cl 260s linear infinite', 260_000, 60_000],
  ['.ra', 'ry 1.6s steps(1) infinite', 1600, 0],
  ['.rb', 'ry 1.6s steps(1) infinite', 1600, 800],
  ['.sa', 'sw 1.8s steps(1) infinite', 1800, 0],
  ['.sb', 'sw 1.8s steps(1) infinite', 1800, 900],
  ['.dk', 'dk 3s steps(1) infinite', 3000, 0],
  ['.b1', 'b1 17s linear infinite', 17_000, 0],
  ['.b2', 'b2 23s linear infinite', 23_000, 5000],
  ['.b3', 'b3 19s linear infinite', 19_000, 11_000],
  ['.fp', 'fp .36s steps(1) infinite', 360, 0],
  ['.bob', 'bob .7s steps(1) infinite', 700, 0],
  ['.cb', 'cb .9s steps(1) infinite', 900, 0],
  ['.rdy', 'cb .36s steps(1) infinite', 360, 0],
  ['.bl', 'bl 4.3s steps(1) infinite', 4300, 0],
  // What a mole does while its call runs.
  ['.pg', 'fp .5s steps(1) infinite', 500, 0],
  ['.wg', 'wg .3s steps(1) infinite', 300, 0],
  ['.lp', 'ry .24s steps(1) infinite', 240, 0],
  ['.jt', 'jt .14s steps(1) infinite', 140, 0],
  ['.w1', 'wv .9s steps(1) infinite', 900, 0],
  ['.w2', 'wv .9s steps(1) infinite', 900, 600],
  ['.w3', 'wv .9s steps(1) infinite', 900, 300],
  ['.sc', 'sc 1.2s steps(6) infinite alternate', 2400, 0],
  ['.sk', 'ry .18s steps(1) infinite', 180, 0],
  ['.sj', 'ry .18s steps(1) infinite', 180, 90],
  ['.pp', 'ry .2s steps(1) infinite', 200, 0],
  ['.cs', 'cs .3s steps(1) infinite', 300, 0],
]

const KEYFRAMES =
  '@keyframes cl{from{transform:translateX(-200px)}to{transform:translateX(1640px)}}' +
  '@keyframes ry{0%{opacity:1}50%{opacity:.25}}' +
  '@keyframes sw{0%{transform:translateX(0)}50%{transform:translateX(3px)}}' +
  '@keyframes dk{0%{transform:translate(0,0)}50%{transform:translate(8px,3px)}}' +
  '@keyframes b1{0%{transform:translate(0,0)}25%{transform:translate(160px,-70px)}50%{transform:translate(300px,30px)}75%{transform:translate(120px,90px)}100%{transform:translate(0,0)}}' +
  '@keyframes b2{0%{transform:translate(0,0)}30%{transform:translate(-220px,-90px)}55%{transform:translate(-120px,110px)}80%{transform:translate(90px,40px)}100%{transform:translate(0,0)}}' +
  '@keyframes b3{0%{transform:translate(0,0)}20%{transform:translate(180px,60px)}50%{transform:translate(60px,-140px)}80%{transform:translate(-160px,-40px)}100%{transform:translate(0,0)}}' +
  '@keyframes fp{0%{opacity:1}50%{opacity:.45}}' +
  '@keyframes bob{0%{transform:translateY(0)}50%{transform:translateY(1px)}}' +
  '@keyframes cb{0%{transform:translateY(0)}50%{transform:translateY(-1px)}}' +
  '@keyframes bl{0%{opacity:0}94%{opacity:1}}' +
  // A mole: up out of its hole with a small overshoot, down again, and the
  // squash of a whack.
  '@keyframes up{0%{transform:translateY(24px)}65%{transform:translateY(1px)}100%{transform:translateY(3px)}}' +
  '@keyframes dn{0%{transform:translateY(3px)}100%{transform:translateY(24px)}}' +
  '@keyframes sq{0%{transform:scaleY(1)}25%{transform:scaleY(.42)}55%{transform:scaleY(.6)}100%{transform:scaleY(1)}}' +
  '@keyframes dz{0%,100%{opacity:1}}' +
  // Claude: dropping in on a stump, leaping off one, and the swing, which
  // ends with the mallet on the shoulder or raised again.
  '@keyframes in{0%{transform:translateY(-36px);opacity:0}70%{transform:translateY(2px);opacity:1}100%{transform:translateY(0);opacity:1}}' +
  '@keyframes out{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-36px);opacity:0}}' +
  // The swing: down in the first third, held on the mole, then back.
  '@keyframes swr{0%{transform:rotate(-55deg)}36%,62%{transform:rotate(82deg)}100%{transform:rotate(-25deg)}}' +
  '@keyframes sww{0%{transform:rotate(-55deg)}36%,62%{transform:rotate(82deg)}100%{transform:rotate(-55deg)}}' +
  // While a call runs: a tap once a second, the mole flinching under it and
  // a small flash where the mallet lands, all three on the same beat.
  '@keyframes tap{0%,28%{transform:rotate(-55deg)}44%,56%{transform:rotate(82deg)}76%,100%{transform:rotate(-55deg)}}' +
  '@keyframes sqt{0%,43%{transform:scaleY(1)}49%{transform:scaleY(.62)}62%{transform:scaleY(.8)}80%,100%{transform:scaleY(1)}}' +
  '@keyframes tf{0%,43%{opacity:0;transform:scale(.5)}47%{opacity:.95;transform:scale(1)}62%,100%{opacity:0;transform:scale(1.3)}}' +
  // What a whack throws off.
  '@keyframes shk{0%{transform:translate(0,0)}25%{transform:translate(1px,1px)}50%{transform:translate(-1px,0)}75%{transform:translate(1px,-1px)}100%{transform:translate(0,0)}}' +
  '@keyframes fl{0%{opacity:0;transform:scale(.3)}25%{opacity:1;transform:scale(1.15)}100%{opacity:0;transform:scale(1.7)}}' +
  '@keyframes s1{0%{opacity:0;transform:translate(0,0)}10%{opacity:1}100%{opacity:0;transform:translate(-15px,-12px)}}' +
  '@keyframes s2{0%{opacity:0;transform:translate(0,0)}10%{opacity:1}100%{opacity:0;transform:translate(14px,-14px)}}' +
  '@keyframes s3{0%{opacity:0;transform:translate(0,0)}10%{opacity:1}100%{opacity:0;transform:translate(-17px,3px)}}' +
  '@keyframes s4{0%{opacity:0;transform:translate(0,0)}10%{opacity:1}100%{opacity:0;transform:translate(16px,1px)}}' +
  '@keyframes wg{0%{transform:rotate(-10deg)}50%{transform:rotate(12deg)}}' +
  '@keyframes jt{0%{transform:translateX(0)}50%{transform:translateX(1px)}}' +
  '@keyframes wv{0%{opacity:1}34%{opacity:0}}' +
  '@keyframes sc{from{transform:translateX(0)}to{transform:translateX(10px)}}' +
  '@keyframes cs{0%{transform:scaleX(1)}50%{transform:scaleX(.3)}}' +
  // Paper tumbles out and falls; shavings and dust fly straight; lightning
  // jumps up; ripples widen; stars circle; sparks crackle; a coin rises.
  '@keyframes t1{0%{opacity:0;transform:translate(0,0) rotate(0)}10%{opacity:1}45%{transform:translate(-13px,-15px) rotate(-150deg)}100%{opacity:0;transform:translate(-19px,7px) rotate(-320deg)}}' +
  '@keyframes t2{0%{opacity:0;transform:translate(0,0) rotate(0)}10%{opacity:1}45%{transform:translate(12px,-17px) rotate(160deg)}100%{opacity:0;transform:translate(18px,5px) rotate(330deg)}}' +
  '@keyframes t3{0%{opacity:0;transform:translate(0,0) rotate(0)}10%{opacity:1}45%{transform:translate(-4px,-20px) rotate(110deg)}100%{opacity:0;transform:translate(-7px,2px) rotate(250deg)}}' +
  '@keyframes t4{0%{opacity:0;transform:translate(0,0) rotate(0)}10%{opacity:1}45%{transform:translate(6px,-19px) rotate(-120deg)}100%{opacity:0;transform:translate(9px,3px) rotate(-260deg)}}' +
  '@keyframes s5{0%{opacity:0;transform:translate(0,0)}10%{opacity:1}100%{opacity:0;transform:translate(-9px,-18px)}}' +
  '@keyframes s6{0%{opacity:0;transform:translate(0,0)}10%{opacity:1}100%{opacity:0;transform:translate(8px,-19px)}}' +
  '@keyframes bz{0%{opacity:0;transform:translateY(6px) scale(.5)}15%{opacity:1;transform:translateY(-4px) scale(1.2)}30%{opacity:.2}45%{opacity:1}100%{opacity:0;transform:translateY(-16px) scale(1)}}' +
  '@keyframes rg{0%{opacity:0;transform:scale(.2)}15%{opacity:1}100%{opacity:0;transform:scale(2.4)}}' +
  '@keyframes ob{0%{opacity:0;transform:rotate(0)}8%,80%{opacity:1}100%{opacity:0;transform:rotate(720deg)}}' +
  '@keyframes ck{0%{opacity:0}8%{opacity:1}18%{opacity:0}28%{opacity:1}42%{opacity:.2}56%{opacity:1}70%{opacity:0}82%{opacity:1}100%{opacity:0}}' +
  '@keyframes cn{0%{opacity:0;transform:translateY(6px)}12%,75%{opacity:1}100%{opacity:0;transform:translateY(-15px)}}' +
  '@keyframes dr{0%{opacity:0;transform:translate(0,0)}15%{opacity:1}100%{opacity:0;transform:translate(3px,9px)}}' +
  '@keyframes tg{0%,100%{opacity:1}}' +
  '@keyframes cf{0%{opacity:0;transform:translateY(0)}6%,80%{opacity:1}100%{opacity:0;transform:translateY(430px)}}' +
  // Where motion is unwelcome the picture rests: holes, signs and Claude.
  '@media (prefers-reduced-motion:reduce){*{animation:none!important}}'

// ---- Costumes, acts and effects: one set for each kind of tool ----------------

const DARK = '#111827'

// What each mole wears, drawn over the plain mole and moving with it. Some of
// it only moves while the mole's call runs.
function wear(lane: Lane, isRunning: boolean): string {
  switch (lane) {
    case 'read':
      // Round glasses.
      return px(
        ['..kkkkk..kkkkk..', '..k...kkkk...k..', '..k...k..k...k..', '..kkkkk..kkkkk..'],
        { k: DARK },
        0,
        4,
      )
    case 'edit':
      // A pencil behind the ear, which wags while it writes.
      return `<g${isRunning ? ' class="wg"' : ''} style="transform-origin:13px 3px">${px(
        ['pp', 'yy', 'yy', 'yy', 'yy', 'nn', '.k'],
        { p: '#fb7185', y: '#fbbf24', n: '#fde68a', k: DARK },
        12,
        -3,
      )}</g>`
    case 'run':
      // A hard hat with a lamp, which flashes while the command runs.
      return (
        px(['yyyyyyyyyyyyyy'], { y: '#facc15' }, 1, 3) +
        `<g${isRunning ? ' class="lp"' : ''}>${px(['ww', 'ww'], { w: '#fef9c3' }, 7, 0)}</g>`
      )
    case 'web':
      // An aerial with a red tip.
      return px(['rr', 'rr', 'ss', 'ss'], { r: '#f43f5e', s: '#cbd5e1' }, 7, -3)
    case 'agent':
      // A robot's visor with a light that scans, and two feelers.
      return (
        px(['k......k'], { k: '#c4b5fd' }, 4, -1) +
        px(['cccccccccccc', 'cccccccccccc'], { c: '#22d3ee' }, 2, 5) +
        `<g class="sc"><path fill="#ffffff" d="M2 5h2v2h-2z"/></g>`
      )
    case 'mcp':
      // The two prongs of a plug.
      return px(['ss..ss', 'ss..ss', 'ss..ss'], { s: '#e2e8f0' }, 5, -3)
    default:
      // A propeller cap, which spins while the call runs.
      return (
        px(['rr'], { r: '#ef4444' }, 7, -1) +
        px(['bb'], { b: '#fbbf24' }, 7, -2) +
        `<g${isRunning ? ' class="pp"' : ''}>${px(['bbb..bbb'], { b: '#fbbf24' }, 4, -2)}</g>`
      )
  }
}

// What a mole holds up while its call runs.
function act(lane: Lane): string {
  if (lane === 'read') {
    // An open book, a page turning.
    return (
      px(
        ['..kkkkkkkkkkkk..', '..kwwwwkkwwwwk..', '..kwggwkkwggwk..', '..kwwwwkkwwwwk..', '..kkkkkkkkkkkk..'],
        { k: DARK, w: '#ffffff', g: '#94a3b8' },
        0,
        9,
      ) + `<g class="pg">${px(['wwww'], { w: '#bfdbfe' }, 9, 11)}</g>`
    )
  }
  if (lane === 'edit') {
    // A pad, a line being scribbled on it.
    return (
      px(
        ['...kkkkkkkkkk...', '...kwwwwwwwwk...', '...kwyywwyywk...', '...kwwyywwwwk...', '...kkkkkkkkkk...'],
        { k: DARK, w: '#ffffff', y: '#f59e0b' },
        0,
        9,
      ) + `<g class="pg">${px(['yyy'], { y: '#f59e0b' }, 8, 12)}</g>`
    )
  }

  return ''
}

// What shows around a mole while its call runs, in the hole's own grid.
function aura(lane: Lane): string {
  if (lane === 'web') {
    // Radio waves from the aerial, one after another.
    const wave = (name: string, d: string) =>
      `<path class="${name}" fill="#22d3ee" d="${d}"/>`

    return (
      wave('w1', 'M32 22h1v1h-1zM31 23h1v3h-1zM32 26h1v1h-1zM38 22h1v1h-1zM39 23h1v3h-1zM38 26h1v1h-1z') +
      wave('w3', 'M30 20h1v1h-1zM29 21h1v7h-1zM30 28h1v1h-1zM40 20h1v1h-1zM41 21h1v7h-1zM40 28h1v1h-1z') +
      wave('w2', 'M28 18h1v1h-1zM27 19h1v11h-1zM28 30h1v1h-1zM42 18h1v1h-1zM43 19h1v11h-1zM42 30h1v1h-1z')
    )
  }
  if (lane === 'mcp') {
    // Sparks at the prongs.
    return (
      `<path class="sk" fill="#fde047" d="M29 23h2v1h-2zM30 24h1v2h-1zM43 21h1v2h-1zM42 23h2v1h-2z"/>` +
      `<path class="sj" fill="#f9a8d4" d="M31 20h1v2h-1zM30 22h2v1h-2zM41 24h2v1h-2zM41 25h1v2h-1z"/>`
    )
  }

  return ''
}

const ICONS: Record<Lane, string[]> = {
  read: ['www...www', 'wwww.wwww', 'wwww.wwww', 'wwww.wwww', 'wwww.wwww', '.wwwwwww.'],
  edit: ['......ww.', '.....www.', '....www..', '...www...', '..www....', '.www.....', 'ww.......', 'w........'],
  run: ['.........', 'w........', '.w.......', '..w......', '.w.......', 'w...wwww.'],
  web: ['..wwwww..', '.w..w..w.', 'w...w...w', 'wwwwwwwww', 'w...w...w', '.w..w..w.', '..wwwww..'],
  agent: ['....w....', '.wwwwwww.', '.w.www.w.', '.wwwwwww.', '.ww...ww.', '.wwwwwww.'],
  mcp: ['..w...w..', '..w...w..', '.wwwwwww.', '.wwwwwww.', '..wwwww..', '...www...', '....w....'],
  other: ['...w.w...', '.wwwwwww.', '..ww.ww..', '.ww...ww.', '..ww.ww..', '.wwwwwww.', '...w.w...'],
}

const COIN =
  '<path fill="#fbbf24" stroke="#92400e" stroke-width=".5" d="M34 17h4v1h1v4h-1v1h-4v-1h-1v-4h1z"/><path fill="#fef3c7" d="M35 18h1v4h-1z"/>'
const PAPER =
  '<path fill="#ffffff" stroke="#64748b" stroke-width=".5" d="M34 25h5v6h-5z"/><path fill="#94a3b8" d="M35 27h3v1h-3zM35 29h2v1h-2z"/>'
const BOLT =
  '<path fill="#fde047" stroke="#854d0e" stroke-width=".5" d="M37 17h3l-2 5h3l-6 8 1-6h-3z"/>'
const NUT =
  '<path fill="#94a3b8" stroke="#334155" stroke-width=".5" d="M35 26h2l1 1v2l-1 1h-2l-1-1v-2z"/>'
const DROP = '<path fill="#60a5fa" d="M20 25h1v1h1v2h-1v1h-1v-1h-1v-2h1z"/>'
const TONGUE = px(['pp', 'pp', 'pp'], { p: '#fb7185' }, 7, 10)
const plus = (x: number, y: number, color: string) =>
  `<path fill="${color}" stroke="#4c1d95" stroke-width=".5" d="M${x} ${y - 2}h1v2h2v1h-2v2h-1v-2h-2v-1h2z"/>`

// One piece of an effect: unseen until its moment, `at` milliseconds from now,
// then moved by `motion`.
const piece = (motion: string, at: number, inner: string, origin = '') =>
  `<g opacity="0" style="${origin === '' ? '' : `transform-origin:${origin};`}animation:${motion} ease-out ${at}ms both">${inner}</g>`

// What flies out of a hole when its mole is whacked. Each kind of tool has
// its own, so a glance tells which one just finished.
function burst(lane: Lane, at: number): string {
  const bit = (color: string, d: string) => `<path fill="${color}" d="${d}"/>`

  switch (lane) {
    case 'read':
      // Sheets of paper tumble out and drift down.
      return [1, 2, 3, 4]
        .map(sheet => piece(`t${sheet} .95s`, at, PAPER, '36px 28px'))
        .join('')
    case 'edit':
      // Pencil shavings in every direction, and a scribble.
      return (
        piece('s1 .6s', at, bit('#f59e0b', 'M35 27h3v1h-3z')) +
        piece('s2 .6s', at, bit('#fb7185', 'M36 26h1v3h-1z')) +
        piece('s3 .6s', at, bit('#fde047', 'M35 28h2v2h-2z')) +
        piece('s4 .6s', at, bit('#f59e0b', 'M36 27h1v3h-1z')) +
        piece('s5 .6s', at, bit('#fb7185', 'M35 27h3v1h-3z')) +
        piece('s6 .6s', at, bit('#fde047', 'M35 27h2v2h-2z')) +
        piece(
          'ck .5s',
          at,
          '<path fill="none" stroke="#f59e0b" stroke-width="1.4" d="M27 21l3 3 3-3 3 3 3-3 3 3 3-3"/>',
        )
      )
    case 'run':
      // Lightning jumps up, and green blocks scatter.
      return (
        `<g transform="translate(-9 3)">${piece('bz .55s', at, BOLT, '37px 26px')}</g>` +
        piece('bz .6s', at, BOLT, '37px 26px') +
        `<g transform="translate(9 2)">${piece('bz .5s', at, BOLT, '37px 26px')}</g>` +
        [1, 2, 3, 4]
          .map(block => piece(`s${block} .6s`, at, bit('#4ade80', 'M35 27h2v2h-2z')))
          .join('')
      )
    case 'web':
      // Ripples widen from where the mallet landed.
      return ['#22d3ee', '#ffffff', '#22d3ee']
        .map((color, ring) =>
          piece(
            'rg .8s',
            at + ring * 150,
            `<path fill="none" stroke="${color}" stroke-width="1.6" d="M33 22h6l3 3v6l-3 3h-6l-3-3v-6z"/>`,
            '36px 28px',
          ),
        )
        .join('')
    case 'agent':
      // Stars circle the mole's head.
      return piece(
        'ob 1.2s',
        at,
        plus(36, 14, '#fde047') +
          plus(46, 22, '#ffffff') +
          plus(42, 33, '#c4b5fd') +
          plus(30, 33, '#fde047') +
          plus(26, 22, '#ffffff'),
        '36px 25px',
      )
    case 'mcp':
      // Sparks crackle on both sides.
      return (
        piece(
          'ck .7s',
          at,
          '<path fill="none" stroke="#f472b6" stroke-width="1.3" d="M30 22l-4 3 3 1-4 4M42 22l4 3-3 1 4 4"/>',
        ) +
        piece(
          'ck .7s',
          at + 90,
          '<path fill="none" stroke="#fde047" stroke-width="1.3" d="M33 19l-2-4 3 1-1-4M39 19l2-4-3 1 1-4"/>',
        )
      )
    default:
      // Dust, and a nut and a bolt knocked loose.
      return (
        piece('s1 .7s', at, PUFF) +
        piece('s4 .7s', at, PUFF) +
        piece('s5 .7s', at, PUFF) +
        piece('t1 .9s', at, NUT, '36px 28px') +
        piece('t2 .9s', at, NUT, '36px 28px')
      )
  }
}

// ---- One hole ------------------------------------------------------------------

// When the mallet lands on a finished call: a moment after it ends, and never
// before its mole has had time to come up.
export function hitAt(call: Call): number {
  return Math.max(
    (call.endedAt ?? Infinity) + HIT_LAG_MS,
    call.startedAt + POP_MS,
  )
}

function hole(index: number, state: Flow, now: number): string {
  const { lane, color } = LANES[index] ?? LANES[0]!
  const [cx, top] = SPOTS[index] ?? SPOTS[0]!
  const calls = state.calls.filter(call => call.lane === lane)
  const running = calls
    .filter(call => call.endedAt === undefined)
    .sort((a, b) => a.startedAt - b.startedAt)
  // The whacks still playing, each with the moment it lands. Calls that
  // ended together are spaced out, so each gets a whack that can be seen.
  let previous = -Infinity
  const hits = calls
    .filter(call => call.endedAt !== undefined && hitAt(call) > now - FX_MS)
    .sort((a, b) => hitAt(a) - hitAt(b))
    .slice(-4)
    .map(call => {
      previous = Math.max(hitAt(call), previous + HIT_GAP_MS)

      return { call, at: previous }
    })
  const landed = hits.filter(hit => hit.call.hasFailed !== true)
  const last = hits[hits.length - 1]
  const lastLanded = landed[landed.length - 1]
  const isRunning = running[0] !== undefined
  const spot = state.claude ?? { at: HOME, hopAt: 0 }
  const isHere = spot.at === lane
  const delay = (at: number) => `${Math.round(at - now)}ms`
  // Where in its one-second beat a tap is, from the clock, so the tapping
  // does not start over each time the picture is drawn again.
  const beat = `-${now % TAP_MS}ms`
  const isTapped = isRunning && isHere

  // The mole: up while a call runs and down after the last whack. A hole
  // nothing calls on stays empty: a mole that came up there would look like
  // a call that was never whacked.
  let pop: string
  let tongue = ''

  if (running[0] !== undefined) {
    pop = `transform:translateY(3px);animation:up .24s ease-out ${delay(running[0].startedAt)} both`
  } else if (last !== undefined && last.call.hasFailed === true) {
    // A failed call's mole ducks under the mallet, then comes back up to
    // stick its tongue out.
    pop =
      `transform:translateY(24px);animation:up .24s ease-out ${delay(last.call.startedAt)} both,dn .2s ease-in ${delay(last.at - 90)} forwards,` +
      `up .2s ease-out ${delay(last.at + 260)} forwards,dn .3s ease-in ${delay(last.at + 1100)} forwards`
    tongue = `<g opacity="0" style="animation:tg .85s linear ${delay(last.at + 300)}">${TONGUE}</g>`
  } else if (last !== undefined) {
    pop = `transform:translateY(24px);animation:up .24s ease-out ${delay(last.call.startedAt)} both,dn .3s ease-in ${delay(last.at + 300)} forwards`
  } else {
    pop = 'transform:translateY(24px)'
  }
  const squash = [
    ...(isTapped ? [`sqt ${TAP_MS}ms linear ${beat} infinite`] : []),
    ...landed.map(hit => `sq .36s ease-out ${delay(hit.at)}`),
  ].join(',')
  const dizzy =
    lastLanded === undefined
      ? ''
      : ` style="animation:dz .9s linear ${delay(lastLanded.at)}"`
  const mole =
    `<svg x="28" y="24" width="16" height="21" viewBox="0 0 16 21"><g style="${pop}">` +
    `<g style="transform-origin:8px 19px${squash === '' ? '' : `;animation:${squash}`}"><g class="${isRunning && lane === 'run' ? 'jt' : 'bob'}">` +
    `${moleOf(color)}${wear(lane, isRunning)}${isRunning ? act(lane) : ''}${tongue}<g opacity="0"${dizzy}>${DIZZY}</g></g></g></g></svg>`

  // The sign: a picture of the kind of tool, on the lane's color.
  const icon = ICONS[lane]
  const sign =
    `<path fill="#8a5a3c" d="M62 34h3v21h-3z"/><path fill="${INK}" d="M54 19h19v16h-19z"/>` +
    `<path fill="${color}" d="M55 20h17v14h-17z"/><path fill="${tint(color, 0.45)}" d="M55 20h17v2h-17z"/>` +
    px(icon, { w: '#ffffff' }, 59, 23 + Math.floor((8 - icon.length) / 2))

  // Claude, where Claude is: tapping the mole while its call runs, bringing
  // the mallet down hard when the call ends, and leaping between stumps.
  const figure = (motion: string, isAtWork: boolean) => {
    const swings = isAtWork
      ? [
          ...(isRunning ? [`tap ${TAP_MS}ms linear ${beat} infinite`] : []),
          // Each swing starts early enough to land on its moment: the
          // mallet is down 36% of the way through.
          ...hits.map(
            hit => `${isRunning ? 'sww' : 'swr'} .46s ease-in ${delay(hit.at - 166)}`,
          ),
        ].join(',')
      : ''
    const rest = isAtWork && isRunning ? -55 : -25
    // A miss leaves Claude with a drop of sweat.
    const sweat =
      isAtWork && last !== undefined && last.call.hasFailed === true
        ? `<g opacity="0" style="animation:dr .7s ease-in ${delay(last.at + 120)} both">${DROP}</g>`
        : ''

    // The mallet is drawn first, so at rest its handle passes behind the
    // crab, over the shoulder, and does not cross the face.
    return (
      `<g style="${motion}"><g class="${isAtWork && isRunning ? 'rdy' : 'cb'}">` +
      `<g style="transform-origin:20px 33px;transform:rotate(${rest}deg)${swings === '' ? '' : `;animation:${swings}`}">${MALLET}</g>` +
      `${CLAUDE}<g class="bl">${BLINK}</g>${sweat}</g></g>`
    )
  }
  let claude = ''

  if (isHere) {
    claude = figure(`animation:in .26s ease-out ${delay(spot.hopAt)} both`, true)
  } else if (spot.from === lane && now - spot.hopAt < 400) {
    claude = figure(`animation:out .2s ease-in ${delay(spot.hopAt)} both`, false)
  }

  // What each whack throws off: a flash, a coin, and the lane's own burst. A
  // miss throws up only dust. A tap, while the call still runs, a small flash.
  const effects =
    (isTapped
      ? `<g opacity="0" style="transform-origin:36px 28px;animation:tf ${TAP_MS}ms linear ${beat} infinite"><path fill="#fff3b0" d="M35 25h2v2h2v2h-2v2h-2v-2h-2v-2h2z"/></g>`
      : '') +
    hits
      .map(hit => {
        const at = Math.round(hit.at - now)

        if (hit.call.hasFailed === true) {
          return piece('s1 .6s', at, PUFF) + piece('s4 .6s', at, PUFF)
        }

        return (
          piece('fl .28s', at, BURST, '36px 28px') +
          burst(lane, at) +
          piece('cn 1s', at, `<g class="cs" style="transform-origin:36px 20px">${COIN}</g>`)
        )
      })
      .join('')
  const shake = landed
    .map(hit => `shk .2s steps(4) ${delay(hit.at)}`)
    .join(',')

  return (
    `<svg x="${cx - BOX_W / 2}" y="${top}" width="${BOX_W}" height="${BOX_H}" viewBox="0 0 ${UW} ${UH}" preserveAspectRatio="xMidYMax meet">` +
    `<g${shake === '' ? '' : ` style="animation:${shake}"`}>${sign}${STUMP}${HOLE_BACK}${mole}${HOLE_FRONT}${isRunning ? aura(lane) : ''}${claude}${effects}</g></svg>`
  )
}

// ---- The whole picture --------------------------------------------------------

// Three whacks within four seconds bring confetti down over the field.
function confetti(state: Flow, now: number): string {
  const recent = state.calls
    .filter(call => call.endedAt !== undefined && call.hasFailed !== true)
    .map(hitAt)
    .filter(at => at > now - 4000)

  if (recent.length < 3) return ''
  const from = Math.round(Math.max(...recent) - now)
  const random = scatter(recent.length * 7919)
  let out = ''

  for (let count = 0; count < 26; count += 1) {
    const x = Math.round(350 + random() * 820)
    const color = LANES[count % LANES.length]?.color ?? '#ffffff'
    const size = 8 + Math.round(random() * 8)

    out += `<g opacity="0" style="animation:cf ${(1.5 + random()).toFixed(2)}s linear ${from + Math.round(random() * 500)}ms both"><path fill="${tint(color, 0.25)}" d="M${x} ${150 + Math.round(random() * 60)}h${size}v${size + 4}h-${size}z"/></g>`
  }

  return out
}

export function scene(state: Flow, now: number, isNight = false): string {
  const [back, front] = isNight ? MEADOWS.night : MEADOWS.day
  const loops = LOOPS.map(
    ([name, animation, period, offset]) =>
      `${name}{animation:${animation};animation-delay:-${(now + offset) % period}ms}`,
  ).join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="none">` +
    `<style>${KEYFRAMES}${loops}</style>${back}${clouds(now, isNight)}${front}` +
    `${LANES.map((_, index) => hole(index, state, now)).join('')}${confetti(state, now)}</svg>`
  )
}
