export type Lane = 'read' | 'edit' | 'run' | 'web' | 'agent' | 'mcp' | 'other'

export type Call = {
  id: string
  tool: string
  lane: Lane
  startedAt: number
  endedAt?: number
  hasFailed?: boolean
  isSub?: boolean
}

/** Where Claude stands: at one hole, having leapt from another at `hopAt`. */
export type Spot = { at: Lane; from?: Lane; hopAt: number }

export type Flow = {
  calls: Call[]
  counts: Record<Lane, number>
  claude?: Spot
}

/**
 * How the app covers the picture: `blur` and `opacity` for the veil over the
 * conversation, and `tint`, the color the app paints its own panels with.
 */
export type Glass = { blur: number; opacity: number; tint?: string }

/** Which meadow is drawn, and which of the app's modes its colors are for. */
export type Mode = 'day' | 'night'

declare module 'claude-code' {
  interface PluginState {
    'tool-flow': {
      flow: Shaped<Flow>
      isOff: boolean
      veil: Glass
      mode: Mode
      tick: number
      demo: number
    }
  }
}
