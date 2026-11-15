import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeColors } from 'claude-code'

// The design system's own palette maker, copied unchanged from the
// plugin-authoring skill: copy it again when Claude Code updates.
import { makeColors } from './make-colors.js'
import { FX_MS, HOME, hitAt, scene } from './scene'
import type { Call, Flow, Glass, Lane, Mode, Spot } from '../types'

// ---- What you may want to tune -------------------------------------------

// The meadow comes by day and by night: `/tool-flow day` and `/tool-flow
// night` switch. Day is made for the app's light mode and night for its dark
// mode, and the app takes that mode inside the session. Outside a session
// (the page a new one starts from) the app is in the mode of its own
// appearance setting, which a mod cannot switch.
const DEFAULT_MODE: Mode = 'night'

// How the app veils its panels over the picture, for each: `blur` in points
// (0 to 64), `opacity` of the veil over the conversation (0 to 1), and
// `tint`, the color the app paints its own panels with.
// `/tool-flow glass <blur> <opacity>` and `/tool-flow tint <#rrggbb|off>`
// change them while a session runs.
//
// The app keeps the sidebar and the right panel nearly opaque whatever a mod
// asks, behind a 56-point blur: 88% in light mode and 74% in dark mode, so
// the night shows through them about twice as much. The title bar and the
// prompt box are fully opaque. A tint has to be a light color in light mode
// and a dark one in dark mode, or the app drops it.
//
// With a tint the app's own surfaces are given the same color (`paletteOf`):
// a collapsed sidebar peeks out as a floating sheet in the color of the
// app's menus, which no tint reaches, and it would show in the app's own
// color before turning the tint's when pinned open.
const GLASS: Record<Mode, Glass> = {
  day: { blur: 0, opacity: 0.5, tint: '#d9f2d2' },
  night: { blur: 0, opacity: 0.35, tint: '#16223a' },
}

// ---- Fixed -----------------------------------------------------------------

const SCENE = 'tool-flow'
const COMMAND = 'tool-flow'
// Names this version of the picture: a new one plays its demo once.
const VERSION = 'whack-9'
const KEEP = 120
// A finished call is kept this long, for its whack to play out.
const KEEP_MS = 10_000
const STALE_MS = 30 * 60_000
// After the last call the picture is drawn once more, at rest. The app starts
// every animation over when its window changes size, and a picture drawn in
// the middle of a whack would play that whack again.
const SETTLE_MS = FX_MS + 1000

type Drawn = { isDrawn: boolean; reason?: string }
// Older engines name these calls otherwise, so they are reached loosely.
type AnyEngine = {
  theme?: { set(args: unknown): Promise<Drawn>; clear(): Promise<unknown> }
  ui: { backdrop?(args: unknown): Promise<Drawn> }
}

const shade = (hex: string, by: number) =>
  `#${[1, 3, 5]
    .map(at =>
      Math.round(parseInt(hex.slice(at, at + 2), 16) * (1 - by))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`

// The panel color of the other mode, for each meadow: what the app's pages
// take outside a session when the app itself is in the mode the meadow is
// not made for (a night meadow in an app left in light mode, and the other
// way round).
const OTHER_HALF: Record<Mode, string> = { day: '#17281c', night: '#dde6f6' }

const lightHalf = (surface: string) => ({
  gray: {
    anchors: {
      'surface-0': shade(surface, 0.045),
      'surface-1': shade(surface, 0.022),
      'surface-2': surface,
      'surface-3': surface,
      'text-primary': '#1a1f18',
      'text-secondary': '#3c4638',
      'text-muted': '#4f5a4b',
    },
  },
})
const darkHalf = (surface: string) => ({
  gray: {
    anchors: {
      'surface-0': shade(surface, 0.16),
      'surface-1': shade(surface, 0.08),
      'surface-2': surface,
      'surface-3': surface,
      'text-primary': '#e9eef8',
      'text-secondary': '#c2cde0',
      'text-muted': '#9eadc6',
    },
  },
})

// The app's own surfaces in the tint's color, so what the tint does not reach
// (menus, the sheet a collapsed sidebar peeks out as, the user's message
// bubbles) matches the panels it does.
//
// Both halves are given, light and dark. Inside a session the app takes the
// half the meadow asks for. Outside one, on the page a new session starts
// from, there is no backdrop and no asking: the app keeps the colors of the
// last theme set by a session on this computer and shows the half for its
// own mode. A palette with one half alone would leave that page in the app's
// default colors whenever the app is in the other mode.
//
// Nothing for a tint the design system cannot build a readable palette on,
// such as a dark one by day: the app would refuse the whole theme, backdrop
// and all.
function paletteOf(tint: string | undefined, mode: Mode): ThemeColors | undefined {
  if (tint === undefined) return undefined
  try {
    const { theme, problems } = makeColors({
      label: 'Tool flow',
      light: lightHalf(mode === 'day' ? tint : OTHER_HALF.night),
      dark: darkHalf(mode === 'night' ? tint : OTHER_HALF.day),
    })

    return problems.some(line => line.startsWith("Desktop won't paint"))
      ? undefined
      : theme
  } catch {
    return undefined
  }
}

// Sets the backdrop by whichever call this engine has. From 2.1.323 the scene
// is `scene`, before it `id`, and an engine drops the name it does not know;
// before 2.1.319 the call was `$.ui.backdrop`.
async function show($: AnyEngine, glass: Glass, mode: Mode): Promise<Drawn> {
  let reason = ''

  const colors = paletteOf(glass.tint, mode)

  try {
    return await $.theme!.set({
      backdrop: { scene: SCENE, id: SCENE, glass },
      // Each meadow asks for the app mode it is made for. The app follows
      // this inside the session, whatever its own setting is.
      overrideColorScheme: mode === 'night' ? 'dark' : 'light',
      ...(colors === undefined ? {} : { colors }),
    })
  } catch (error) {
    reason = String(error)
  }
  try {
    return await $.ui.backdrop!({ id: SCENE, glass })
  } catch {
    return { isDrawn: false, reason }
  }
}

async function hide($: AnyEngine): Promise<void> {
  try {
    await $.theme!.clear()
  } catch {
    try {
      await $.ui.backdrop!(undefined)
    } catch {
      // An engine with neither call drew no backdrop to take off.
    }
  }
}

const EMPTY: Flow = {
  calls: [],
  counts: { read: 0, edit: 0, run: 0, web: 0, agent: 0, mcp: 0, other: 0 },
}
// Change the tag when a call's fields change: it declines what an earlier
// version stored, which outlives a reload.
const flow = atom({ plugin: 'tool-flow', key: 'flow' } as const, EMPTY, {
  shape: 'flow-2',
})
const isOff = atom({ plugin: 'tool-flow', key: 'isOff' } as const, false)
const mode = atom({ plugin: 'tool-flow', key: 'mode' } as const, DEFAULT_MODE)
// The veil and the panels' color, as they stand: a mode's own until changed.
const glass = atom({ plugin: 'tool-flow', key: 'veil' } as const, GLASS[DEFAULT_MODE])
// Counts the redraws asked for on a timer; a drawing reads it to be asked again.
const tick = atom({ plugin: 'tool-flow', key: 'tick' } as const, 0)
// When the demo began, in clock time; 0 while none plays.
const demo = atom({ plugin: 'tool-flow', key: 'demo' } as const, 0)

// What /tool-flow status reports. Counted here, not in $.state, since a
// drawing may not write state; a reload starts them over.
let asks = 0
let renders = 0
let lastSurface = ''
let lastLength = 0
// The latest call's start or end, so only the last one settles the picture.
let lastEventAt = 0

function laneOf(tool: string): Lane {
  if (tool.startsWith('mcp__')) return 'mcp'
  if (/^(Read|Grep|Glob|LS|NotebookRead|ToolSearch)$/.test(tool)) return 'read'
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) return 'edit'
  if (/^(Bash|BashOutput|KillShell|Monitor|TaskStop)$/.test(tool)) return 'run'
  if (/^Web(Fetch|Search)$/.test(tool)) return 'web'
  if (/^(Agent|Task|Skill|SendMessage)$/.test(tool)) return 'agent'

  return 'other'
}

// Claude goes to the hole a call names: at once when it starts, and just
// ahead of the mallet when it ends somewhere Claude has left.
function moved(was: Flow, lane: Lane, at: number): Spot {
  const here = was.claude?.at ?? HOME

  return here === lane
    ? (was.claude ?? { at: lane, hopAt: 0 })
    : { at: lane, from: here, hopAt: at }
}

function started(was: Flow, call: Call): Flow {
  const kept = was.calls.filter(one =>
    one.endedAt === undefined
      ? one.startedAt > call.startedAt - STALE_MS
      : hitAt(one) > call.startedAt - KEEP_MS,
  )

  return {
    calls: [...kept, call].slice(-KEEP),
    counts: { ...was.counts, [call.lane]: was.counts[call.lane] + 1 },
    claude: moved(was, call.lane, call.startedAt),
  }
}

function ended(was: Flow, id: string, endedAt: number, hasFailed: boolean): Flow {
  const call = was.calls.find(one => one.id === id)

  if (call === undefined) return was
  const done = { ...call, endedAt, hasFailed }

  return {
    ...was,
    calls: was.calls.map(one => (one.id === id ? done : one)),
    claude: moved(was, call.lane, endedAt),
  }
}

// ---- The demo: a short game played with made-up calls ------------------------

// Each: the tool, when it starts and how long it runs, in milliseconds, and
// whether it fails.
const DEMO: [string, number, number, boolean][] = [
  ['Read', 300, 500, false],
  ['Read', 1000, 400, false],
  ['Edit', 1900, 900, false],
  ['Bash', 3100, 2600, false],
  ['WebFetch', 3500, 1300, false],
  ['Agent', 6000, 1200, false],
  ['mcp__demo__search', 7500, 500, false],
  ['TodoWrite', 8300, 600, true],
  ['Read', 9200, 250, false],
  ['Read', 9500, 250, false],
  ['Read', 9800, 250, false],
  ['Bash', 10_600, 900, false],
  ['Edit', 11_800, 500, false],
]
const DEMO_MS = 14_000
const DEMO_LEAD_MS = 1200

// The made-up calls as far as they have got at `now`, on top of the real
// counts and from where Claude really stands.
function demoFlow(began: number, now: number, real: Flow): Flow {
  const steps = DEMO.flatMap(([tool, start, length, hasFailed], index) => [
    {
      at: began + start,
      apply: (was: Flow) =>
        started(was, {
          id: `demo-${index}`,
          tool,
          lane: laneOf(tool),
          startedAt: began + start,
        }),
    },
    {
      at: began + start + length,
      apply: (was: Flow) =>
        ended(was, `demo-${index}`, began + start + length, hasFailed),
    },
  ])

  return steps
    .filter(step => step.at <= now)
    .sort((a, b) => a.at - b.at)
    .reduce<Flow>((was, step) => step.apply(was), {
      calls: [],
      counts: real.counts,
      ...(real.claude === undefined ? {} : { claude: real.claude }),
    })
}

// Starts the demo: the picture is asked for again at each made-up call's
// start and end, as a real call would ask, and once more when it is over.
async function play($: EngineInterface): Promise<void> {
  const began = (await $.clock.now()) + DEMO_LEAD_MS
  const redraw = () => {
    void update($, tick, count => count + 1).catch(() => {})
  }

  await update($, demo, () => began)
  new Set(DEMO.flatMap(([, start, length]) => [start, start + length])).forEach(
    at => {
      $.clock.after(DEMO_LEAD_MS + at + 20, redraw)
    },
  )
  $.clock.after(DEMO_LEAD_MS + DEMO_MS + SETTLE_MS, () => {
    void update($, demo, () => 0).catch(() => {})
  })
}

// The mod answers its commands in English, or in Chinese for someone who
// chose it with `/tool-flow lang zh`. The choice is kept for every session on
// this computer.
type Lang = 'en' | 'zh'

async function langOf($: EngineInterface): Promise<Lang> {
  try {
    return (await $.store.get('lang')) === 'zh' ? 'zh' : 'en'
  } catch {
    return 'en'
  }
}

const NOT_DRAWN: Record<Lang, string> = {
  en: 'no window that draws backdrops is attached to this session',
  zh: '没有能画背景的界面连着这个会话',
}

// Draws the picture once more when no call has come since `at`.
function settleLater($: EngineInterface, at: number): void {
  lastEventAt = at
  $.clock.after(SETTLE_MS, () => {
    if (lastEventAt === at) {
      void update($, tick, count => count + 1).catch(() => {})
    }
  })
}

const isWindow = (surface: string) => surface === 'desktop' || surface === 'mobile'

// Plays the demo once for each version of the picture, the first time a
// window that shows it is there: what the mod does is plain at once to
// someone who has just installed it.
async function greet($: EngineInterface): Promise<void> {
  try {
    if (await read($, isOff)) return
    if ((await $.store.get('demo')) === VERSION) return
    await $.store.set('demo', VERSION)
    await play($)
  } catch {
    // No demo is no loss: /tool-flow demo plays it on request.
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description:
        'Whack-a-mole behind the conversation, one hole per kind of tool: on, off, day, night, demo, status, glass <blur> <opacity>, tint <#rrggbb|off>, or lang <en|zh>',
    })
    // Neither a reload nor --resume keeps a backdrop, so set it here.
    if (!(await read($, isOff))) {
      await show($ as unknown as AnyEngine, await read($, glass), await read($, mode))
      // After a reload the app is attached already. In a new session it
      // attaches later, and `session.attach` below greets it.
      try {
        const surfaces = await $.session.surfaces()

        if (surfaces.some(isWindow)) await greet($)
      } catch {
        // No demo is no loss: /tool-flow demo plays it on request.
      }
    }

    return next(e)
  })

  // The app joins a new session a moment after it starts, with the first
  // message, so someone who has just installed the mod is greeted here.
  on('session.attach', async ($, e, next) => {
    if (isWindow(e.surface)) await greet($)

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const words = e.args.trim().split(/\s+/)
    const word = words[0] ?? ''
    const lang = await langOf($)
    const say = (en: string, zh: string) => (lang === 'zh' ? zh : en)

    if (word === 'lang') {
      const chosen = words[1]

      if (words.length !== 2 || (chosen !== 'en' && chosen !== 'zh')) {
        return { text: say('Usage: /tool-flow lang en, or /tool-flow lang zh.', '用法：/tool-flow lang zh 或 /tool-flow lang en。') }
      }
      await $.store.set('lang', chosen)

      return { text: chosen === 'zh' ? '之后用中文回复。' : 'Replies are in English from now on.' }
    }

    if (word === 'status') {
      const surfaces = await $.session.surfaces()
      const { counts } = await read($, flow)
      const total = Object.values(counts).reduce((sum, one) => sum + one, 0)
      const veil = await read($, glass)

      return {
        text: [
          say(
            `Surfaces attached to this session: ${surfaces.join(', ') || 'none'}`,
            `连着这个会话的界面：${surfaces.join('、') || '无'}`,
          ),
          say(
            `Backdrop asked for ${asks} times, drawn by this mod ${renders} times`,
            `背景绘制请求：收到 ${asks} 次，本 mod 画了 ${renders} 次`,
          ),
          renders > 0
            ? say(
                `Last drawn for: ${lastSurface}, an SVG of ${lastLength} characters`,
                `最近一次画给：${lastSurface}，SVG ${lastLength} 字符`,
              )
            : say('No window has asked this mod for the backdrop yet', '界面还没有向本 mod 要过背景'),
          say(`Tool calls counted: ${total}`, `已记录的工具调用：${total} 次`),
          say(
            `Meadow: ${(await read($, mode)) === 'night' ? 'night' : 'day'}`,
            `画面：${(await read($, mode)) === 'night' ? '夜晚' : '白天'}`,
          ),
          say(
            `Veil: blur ${veil.blur}, opacity ${veil.opacity}, panel color ${veil.tint ?? "the app's own"}`,
            `面板遮罩：模糊 ${veil.blur}，不透明度 ${veil.opacity}，面板颜色 ${veil.tint ?? '应用自己的'}`,
          ),
        ].join('\n'),
      }
    }
    if (word === 'day' || word === 'night') {
      // Each comes with its own veil and panel color.
      await update($, mode, () => word)
      await update($, glass, () => GLASS[word])
      await update($, isOff, () => false)
      const set = await show($ as unknown as AnyEngine, GLASS[word], word)

      return {
        text: !set.isDrawn
          ? say(
              `Switched, but nothing draws it now: ${set.reason ?? NOT_DRAWN.en}`,
              `已切换，但当前没有画出来：${set.reason ?? NOT_DRAWN.zh}`,
            )
          : word === 'night'
            ? say('Night it is. This session goes dark.', '已换成夜晚，这个会话里的界面会变成深色。')
            : say('Day it is. This session goes light.', '已换成白天，这个会话里的界面会变成浅色。'),
      }
    }
    if (word === 'glass') {
      const blur = Number(words[1])
      const opacity = Number(words[2])
      const isValid =
        words.length === 3 &&
        blur >= 0 &&
        blur <= 64 &&
        opacity >= 0 &&
        opacity <= 1

      if (!isValid) {
        return {
          text: say(
            'Usage: /tool-flow glass <blur 0-64> <opacity 0-1>, for example /tool-flow glass 0 0.5. Smaller numbers show the picture more clearly.',
            '用法：/tool-flow glass <模糊 0–64> <不透明度 0–1>，例如 /tool-flow glass 0 0.5。数值越小，画面越清楚。',
          ),
        }
      }
      const veil = { ...(await read($, glass)), blur, opacity }

      await update($, glass, () => veil)
      await update($, isOff, () => false)
      const set = await show($ as unknown as AnyEngine, veil, await read($, mode))

      return {
        text: set.isDrawn
          ? say(
              `Veil set: blur ${blur}, opacity ${opacity}.`,
              `面板遮罩已改为：模糊 ${blur}，不透明度 ${opacity}。`,
            )
          : say(
              `Saved, but nothing draws it now: ${set.reason ?? NOT_DRAWN.en}`,
              `已保存，但当前没有画出来：${set.reason ?? NOT_DRAWN.zh}`,
            ),
      }
    }
    if (word === 'tint') {
      const color = words[1] ?? ''
      const isHex = /^#[0-9a-f]{6}$/i.test(color)

      if (words.length !== 2 || (!isHex && color !== 'off')) {
        return {
          text: say(
            'Usage: /tool-flow tint <#rrggbb>, or /tool-flow tint off. Use a light color by day and a dark one by night, or the app drops it.',
            '用法：/tool-flow tint <#rrggbb> 或 /tool-flow tint off。浅色模式要用浅色，深色模式要用深色，否则桌面端会忽略它。',
          ),
        }
      }
      const { blur, opacity } = await read($, glass)
      const veil: Glass = isHex ? { blur, opacity, tint: color } : { blur, opacity }

      await update($, glass, () => veil)
      await update($, isOff, () => false)
      const set = await show($ as unknown as AnyEngine, veil, await read($, mode))

      return {
        text: !set.isDrawn
          ? say(
              `Saved, but nothing draws it now: ${set.reason ?? NOT_DRAWN.en}`,
              `已保存，但当前没有画出来：${set.reason ?? NOT_DRAWN.zh}`,
            )
          : isHex
            ? say(`Panels are ${color} now.`, `面板颜色已改为 ${color}。`)
            : say("Panels are back to the app's own color.", '面板颜色已恢复为应用自己的颜色。'),
      }
    }
    if (word === 'off') {
      await update($, isOff, () => true)
      await hide($ as unknown as AnyEngine)

      return {
        text: say(
          'Whack-a-mole is off. /tool-flow on brings it back.',
          '打地鼠背景已关闭。/tool-flow on 可重新打开。',
        ),
      }
    }
    await update($, isOff, () => false)
    const set = await show($ as unknown as AnyEngine, await read($, glass), await read($, mode))

    if (!set.isDrawn) {
      return {
        text: say(
          `Set, but nothing draws it now: ${set.reason ?? NOT_DRAWN.en}`,
          `已设置，但当前没有画出来：${set.reason ?? NOT_DRAWN.zh}`,
        ),
      }
    }
    if (word === 'demo') {
      await play($)

      return {
        text: say(
          'Demo time: 13 seconds, every hole gets a whack.',
          '演示开始：约 13 秒，Claude 会把七个洞各打一遍。',
        ),
      }
    }

    return {
      text: say(
        'Whack-a-mole is on. Try /tool-flow demo.',
        '打地鼠背景已打开。/tool-flow demo 可以看一段演示。',
      ),
    }
  }).catch(() => ({ text: 'tool-flow: that command failed.' }))

  on('tool.call', async ($, e, next) => {
    // The desktop app's own bookkeeping tools are no part of the game.
    if (e.tool.startsWith('mcp__ccd_')) {
      return next(e)
    }
    const call: Call = {
      id: e.tool_use_id,
      tool: e.tool,
      lane: laneOf(e.tool),
      startedAt: await $.clock.now(),
      isSub: e.agentId !== undefined,
    }
    let hasFailed = true

    await update($, flow, was => started(was, call))
    settleLater($, call.startedAt)
    try {
      const ran = await next(e)

      hasFailed = ran.deny !== undefined || ran.isError === true

      return ran
    } finally {
      const endedAt = await $.clock.now()

      await update($, flow, was => ended(was, call.id, endedAt, hasFailed))
      settleLater($, endedAt)
    }
    // Only watching: if the picture's bookkeeping fails, the call goes on.
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    asks += 1
    // This hook hears every mod's backdrop.
    const props = e.props as { plugin: string; scene?: string; id?: string }

    if (props.plugin !== $.plugin.name || (props.scene ?? props.id) !== SCENE) {
      return next(e)
    }
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)
    const real = await read($, flow)
    const began = await read($, demo)

    // Read only to be asked again when a timer counts on.
    await read($, tick)
    const now = await $.clock.now()
    const source = scene(
      began > 0 ? demoFlow(began, now, real) : real,
      now,
      (await read($, mode)) === 'night',
    )

    renders += 1
    lastSurface = e.surface
    lastLength = source.length

    return (
      <Svg
        source={source}
        alt="A pixel-art meadow where Claude's little crab plays whack-a-mole: one hole for each kind of tool, a mole up while a call runs, the mallet down when it ends"
        isInteractive
      />
    )
  })
}
