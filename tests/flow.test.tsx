import { expect, mock, test } from 'claude-code/testing'

// A person typing `/tool-flow <args>`: where it came from is not what is tested.
const typed = (args: string) => ({ command: 'tool-flow', args }) as never

const BACKDROP = {
  plugin: 'tool-flow',
  component: 'Backdrop',
  requestId: 'backdrop',
  props: { scene: 'tool-flow', plugin: 'tool-flow', glass: false },
} as const

// What only one kind of tool throws off when its mole is whacked.
const PAPER = 'animation:t1 .95s ease-out'
const BOLT = 'animation:bz .6s ease-out'
const RIPPLE = 'animation:rg .8s ease-out'
const STARS = 'animation:ob 1.2s ease-out'
const COIN = 'animation:cn 1s ease-out'

test('a call pops its mole, and its end brings the mallet down', async ($, on) => {
  // Nothing sits beneath the plugin: each hook here stands for the engine.
  const clock = mock.clock(on, { now: 1_000_000 })

  on('tool.call', async () => {
    await clock.sleep(2000)

    return { result: {} }
  })
  const drawn = async () => {
    const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
    const source = String((await ui.find({ type: 'Svg' }))?.props.source)

    await ui.unmount()

    return source
  }

  // At rest: seven holes, every mole down and still. Nothing comes up that
  // no call asked for: it would look like a call that was never whacked.
  const idle = await drawn()

  // Each rests 24 rows down, deep enough to hide the tallest hat.
  expect(idle.split('<g style="transform:translateY(24px)">').length - 1).toBe(7)
  expect(idle.includes('animation:up ')).toBe(false)
  expect(idle.includes('animation:tap ')).toBe(false)
  expect(idle.includes(COIN)).toBe(false)

  const reading = $.tool.call({ tool: 'Read', file_path: '/a' })

  await clock.settle()
  const up = await drawn()

  // The mole comes up from the moment the call began, holding its book, and
  // Claude leaps over from the middle hole and stands ready.
  expect(up).toContain('animation:up .24s ease-out 0ms both')
  expect(up).toContain('class="pg"')
  expect(up).toContain('animation:in .26s ease-out 0ms both')
  expect(up).toContain('animation:out .2s ease-in 0ms both')
  expect(up).toContain('class="rdy"')
  // While the call runs Claude taps the mole once a second, and the mole
  // flinches on the same beat.
  expect(up).toContain('animation:tap 1000ms linear -0ms infinite')
  expect(up).toContain('animation:sqt 1000ms linear -0ms infinite')

  await clock.advance(2000)
  await reading
  const hit = await drawn()

  // The call has ended. The mallet lands 450 ms from now, so its swing, which
  // starts 166 ms before, is still to come and can be seen. With it come a
  // flash, a coin and sheets of paper, and then the mole goes down.
  expect(hit).toContain('swr .46s ease-in 284ms')
  expect(hit).toContain('animation:fl .28s ease-out 450ms both')
  expect(hit).toContain(`${PAPER} 450ms both`)
  expect(hit).toContain(`${COIN} 450ms both`)
  expect(hit).toContain('dn .3s ease-in 750ms forwards')
  // Drawn again a moment later, the whack has not moved: it lands when it
  // was first said to.
  await clock.advance(100)
  expect(await drawn()).toContain('swr .46s ease-in 184ms')
  expect(hit.includes('animation:tap ')).toBe(false)
  expect(hit.includes('class="pg"')).toBe(false)
  // Reading throws off paper, and nothing that belongs to another kind of tool.
  expect(hit.includes(BOLT)).toBe(false)
  expect(hit.includes(RIPPLE)).toBe(false)

  // Later the picture is drawn once more, at rest, without anyone asking.
  await clock.advance(3100)
  const rest = await drawn()

  expect(rest.includes(COIN)).toBe(false)
  expect(rest.includes('animation:up ')).toBe(false)
  // Claude stays where the last call was.
  expect(rest).toContain('animation:in .26s ease-out -5200ms both')
})

test('each kind of tool is whacked with an effect of its own', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })

  on('tool.call', () => ({ result: {} }))
  const whacked = async (input: object) => {
    await $.tool.call(input as never)
    const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
    const source = String((await ui.find({ type: 'Svg' }))?.props.source)

    await ui.unmount()
    // Long enough for this whack to leave the picture before the next.
    await clock.advance(5000)

    return source
  }
  const bash = await whacked({ tool: 'Bash', command: 'ls' })

  // The mallet lands 450 ms after the picture is first drawn with the call
  // ended, however short the call.
  expect(bash).toContain(`${BOLT} 450ms both`)
  expect(bash).toContain('swr .46s ease-in 284ms')
  expect(bash.includes(PAPER)).toBe(false)

  const web = await whacked({ tool: 'WebFetch', url: 'https://example.com', prompt: 'x' })

  // Three ripples, one after another.
  expect(web).toContain(`${RIPPLE} 450ms both`)
  expect(web).toContain(`${RIPPLE} 750ms both`)
  expect(web.includes(BOLT)).toBe(false)

  const agent = await whacked({ tool: 'Agent', description: 'x', prompt: 'y' })

  expect(agent).toContain(`${STARS} 450ms both`)
  expect(agent.includes(RIPPLE)).toBe(false)
})

test('a failed call is a miss: the mole ducks, taunts, and no coin is given', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  on('tool.call', () => ({ deny: 'not here' }))

  await $.tool.call({ tool: 'Edit', file_path: '/a', old_string: 'a', new_string: 'b' })
  const ui = await $.ui.mount({ ...BACKDROP, surface: 'mobile' })
  const source = String((await ui.find({ type: 'Svg' }))?.props.source)

  expect(source.includes(COIN)).toBe(false)
  // Down 90 ms before the mallet lands, then up again with its tongue out.
  expect(source).toContain('dn .2s ease-in 360ms forwards')
  expect(source).toContain('up .2s ease-out 710ms forwards')
  expect(source).toContain('animation:tg .85s linear 750ms')
  // And Claude is left with a drop of sweat.
  expect(source).toContain('animation:dr .7s ease-in 570ms both')
  await ui.unmount()
})

test("another mod's backdrop is left to it", async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>theirs</Text>
  })

  const ui = await $.ui.mount({
    ...BACKDROP,
    props: { ...BACKDROP.props, plugin: 'someone-else' },
    surface: 'desktop',
  })

  expect((await ui.find({ type: 'Text' }))?.text).toBe('theirs')
  await ui.unmount()
})

test('status tells whether the app asked for the backdrop', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  on('session.surfaces', () => ({ value: ['desktop'] }))

  const before = await $.command.run(typed('status'))

  expect(before.text).toContain('No window has asked this mod for the backdrop yet')
  const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const after = await $.command.run(typed('status'))

  expect(after.text).toContain('drawn by this mod 1 times')
  expect(after.text).toContain('Last drawn for: desktop')
  await ui.unmount()
})

test('glass changes the veil and sets the backdrop again with it', async ($, on) => {
  const asked: string[] = []

  on('theme.set', (_, e) => {
    asked.push(JSON.stringify(e))

    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })

  const ran = await $.command.run(typed('glass 0 0.3'))

  expect(ran.text).toContain('blur 0, opacity 0.3')
  // The panels' color is kept: only the veil over the conversation changes.
  expect(asked[0]).toContain('"glass":{"blur":0,"opacity":0.3,"tint":"#16223a"}')
  // A value out of range changes nothing and says how to type it.
  const refused = await $.command.run(typed('glass 2 7'))

  expect(refused.text).toContain('Usage')
  expect(asked.length).toBe(1)
})

test('the demo plays made-up calls and leaves no trace when it is over', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })

  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'backdrop' } }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  const drawn = async () => {
    const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
    const source = String((await ui.find({ type: 'Svg' }))?.props.source)

    await ui.unmount()

    return source
  }

  expect((await $.command.run(typed('demo'))).text).toContain('Demo time')
  // The first made-up call starts 300 ms into the demo, after its lead-in.
  await clock.advance(1200 + 300 + 20)
  expect(await drawn()).toContain('class="pg"')
  // In the thick of it: a command and a fetch running at once, in two holes.
  await clock.advance(3300)
  const busy = await drawn()

  expect(busy).toContain('class="jt"')
  expect(busy).toContain('class="w1"')
  // The whole picture stays within what one Svg may hold.
  expect(busy.length < 131072).toBe(true)
  // Three quick reads near the end bring confetti down.
  await clock.advance(5400)
  expect(await drawn()).toContain('animation:cf ')
  // When it is over, the made-up calls are gone and the count is the real one.
  await clock.advance(10_000)
  const after = await drawn()

  expect(after.includes('animation:up ')).toBe(false)
  expect(after.includes('animation:cf ')).toBe(false)
  expect((await $.command.run(typed('status'))).text).toContain('Tool calls counted: 0')
})

test("the desktop app's own bookkeeping tools are not part of the game", async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  on('tool.call', () => ({ result: {} }))
  on('session.surfaces', () => ({ value: ['desktop'] }))

  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan' } as never)
  const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const source = String((await ui.find({ type: 'Svg' }))?.props.source)

  expect(source.includes(COIN)).toBe(false)
  expect((await $.command.run(typed('status'))).text).toContain('Tool calls counted: 0')
  await ui.unmount()
})

test('the picture has no words and keeps to what the app animates', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })

  on('tool.call', () => ({ result: {} }))
  await $.tool.call({ tool: 'mcp__docs__search' } as never)
  await clock.advance(450)
  const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const source = String((await ui.find({ type: 'Svg' }))?.props.source)

  // No words: a kind of tool is told by its mole and its effect alone.
  expect(/<text|font-/i.test(source)).toBe(false)
  // The app holds a picture still if any element carries one of these.
  expect(/shape-rendering|vector-effect/i.test(source)).toBe(false)
  // And it loads nothing from outside the picture.
  expect(/url\(|href=|<image|foreignObject|calc\(/i.test(source)).toBe(false)
  // Held still, the clouds are spread over the sky by their own style.
  expect(source.split('style="transform:translateX(').length - 1).toBe(4)
  await ui.unmount()
})

test('tint colors the panels the app keeps opaque, or gives them back', async ($, on) => {
  const asked: string[] = []

  on('theme.set', (_, e) => {
    asked.push(JSON.stringify(e))

    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })

  // By day the panels take the meadow's light green, and the app's own light
  // surfaces are given the same color, so a sidebar that peeks out while
  // collapsed is not white before it turns green.
  await $.command.run(typed('day'))
  expect(asked[0]).toContain('"glass":{"blur":0,"opacity":0.5,"tint":"#d9f2d2"}')
  expect(asked[0]).toContain('"overrideColorScheme":"light"')
  expect(asked[0]).toContain('"inputs":{"light":{')
  // gray-0 is the color of the app's menus and of that peeking sheet.
  expect(asked[0]).toContain('"gray-0":"#d9f2d2"')
  expect(asked[0]).toContain('"gray-20":"#cfe7c9"')
  // The dark half is there too, for the pages outside a session when the app
  // itself is in dark mode.
  expect(asked[0]).toContain('"dark":{')
  expect(asked[0]).toContain('"gray-800":"#17281c"')

  expect((await $.command.run(typed('tint #cfe8ff'))).text).toContain('#cfe8ff')
  expect(asked[1]).toContain('"glass":{"blur":0,"opacity":0.5,"tint":"#cfe8ff"}')
  // The veil can change and the panels keep the color they were given.
  await $.command.run(typed('glass 0 0.4'))
  expect(asked[2]).toContain('"glass":{"blur":0,"opacity":0.4,"tint":"#cfe8ff"}')

  // Off leaves the panels to the app: no tint is sent at all.
  await $.command.run(typed('tint off'))
  expect(asked[3]).toContain('"glass":{"blur":0,"opacity":0.4}')
  expect(String(asked[3]).includes('"colors"')).toBe(false)

  // A dark tint has no readable light palette: the tint is sent alone, and
  // the backdrop is not put at risk.
  await $.command.run(typed('tint #2a3b2a'))
  expect(asked[4]).toContain('"tint":"#2a3b2a"')
  expect(String(asked[4]).includes('"colors"')).toBe(false)

  // Anything but a six-digit color is refused, and nothing is set.
  expect((await $.command.run(typed('tint green'))).text).toContain('Usage')
  expect(asked.length).toBe(5)
})

test('the meadow comes by night and by day, each with its own colors', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  on('session.surfaces', () => ({ value: ['desktop'] }))
  const asked: string[] = []

  on('theme.set', (_, e) => {
    asked.push(JSON.stringify(e))

    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })
  const drawn = async () => {
    const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
    const source = String((await ui.find({ type: 'Svg' }))?.props.source)

    await ui.unmount()

    return source
  }

  // Out of the box it is night: a dark sky, and nothing of the day's.
  const night = await drawn()

  expect(night).toContain('fill="#0a0f24"')
  expect(night.includes('fill="#4fb0f2"')).toBe(false)
  // The grass is the day's green as the night sees it, not the day's itself.
  expect(night.includes('fill="#7fd36a"')).toBe(false)
  expect(night).toContain('fill="#316b5c"')
  // The moles and the signs keep their own colors, in pools of lamplight.
  expect(night).toContain('fill="#9a6845"')
  expect(night.split('fill="#ffe7a3"').length - 1).toBe(21)

  // Asked for by name, the night comes with a dark panel color, the app's
  // dark surfaces in it, and a request for the app's dark mode.
  expect((await $.command.run(typed('night'))).text).toContain('Night it is')
  expect(asked[0]).toContain('"glass":{"blur":0,"opacity":0.35,"tint":"#16223a"}')
  expect(asked[0]).toContain('"overrideColorScheme":"dark"')
  expect(asked[0]).toContain('"gray-800":"#16223a"')
  // And a light half, a pale blue, for the new-session page of an app left
  // in light mode: with the dark half alone that page would stay white.
  expect(asked[0]).toContain('"inputs":{"light":{')
  expect(asked[0]).toContain('"gray-0":"#dde6f6"')

  // And the day brings the light ones back.
  expect((await $.command.run(typed('day'))).text).toContain('Day it is')
  expect(asked[1]).toContain('"tint":"#d9f2d2"')
  const day = await drawn()

  expect(day).toContain('fill="#4fb0f2"')
  expect(day).toContain('fill="#7fd36a"')
  expect(day.includes('fill="#0a0f24"')).toBe(false)
  expect(day.includes('fill="#ffe7a3"')).toBe(false)
  expect((await $.command.run(typed('status'))).text).toContain('Meadow: day')
})

test('replies are in English, or in Chinese for someone who chose it', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'backdrop' } }))
  on('theme.clear', () => ({ value: { isDrawn: false, reason: 'cleared' } }))

  expect((await $.command.run(typed('on'))).text).toBe('Whack-a-mole is on. Try /tool-flow demo.')
  expect((await $.command.run(typed('lang zh'))).text).toBe('之后用中文回复。')
  // The choice is kept in the store, for this and every later session.
  expect((await $.command.run(typed('on'))).text).toBe('打地鼠背景已打开。/tool-flow demo 可以看一段演示。')
  expect((await $.command.run(typed('lang fr'))).text).toContain('用法')
  expect((await $.command.run(typed('lang en'))).text).toBe('Replies are in English from now on.')
  expect((await $.command.run(typed('off'))).text).toContain('Whack-a-mole is off')
})

test('calls that end together in one hole are whacked one after another', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })

  on('tool.call', async () => {
    await clock.sleep(1000)

    return { result: {} }
  })
  const three = [1, 2, 3].map(file => $.tool.call({ tool: 'Read', file_path: `/${file}` }))

  await clock.advance(1000)
  await Promise.all(three)
  const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const source = String((await ui.find({ type: 'Svg' }))?.props.source)

  // Three whacks, 220 ms apart, each with its own swing and its own coin.
  for (const at of [450, 670, 890]) {
    expect(source).toContain(`swr .46s ease-in ${at - 166}ms`)
    expect(source).toContain(`${COIN} ${at}ms both`)
  }
  // The mole stays up until the last one has landed.
  expect(source).toContain('dn .3s ease-in 1190ms forwards')
  await ui.unmount()
})

test('someone new is shown the demo once, when the app joins the session', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })

  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'backdrop' } }))
  mock.store(on)
  on('session.attach', () => ({ clientId: 'desktop:default' }))
  const drawn = async () => {
    const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
    const source = String((await ui.find({ type: 'Svg' }))?.props.source)

    await ui.unmount()

    return source
  }

  // A terminal draws no backdrop, so it is not greeted.
  await $.session.attach({ surface: 'terminal', clientId: 'terminal:default' })
  await clock.advance(1200 + 300 + 20)
  expect((await drawn()).includes('animation:up ')).toBe(false)
  // The app joins: the demo starts by itself.
  await $.session.attach({ surface: 'desktop', clientId: 'desktop:default' })
  await clock.advance(1200 + 300 + 20)
  expect(await drawn()).toContain('animation:up ')
  await clock.advance(30_000)
  expect((await drawn()).includes('animation:up ')).toBe(false)
  // It joins again, as it does in every later session: no second demo.
  await $.session.attach({ surface: 'desktop', clientId: 'desktop:default' })
  await clock.advance(1200 + 300 + 20)
  expect((await drawn()).includes('animation:up ')).toBe(false)
})

test('with calls running in two holes, Claude goes round them and whacks each as it ends', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })

  on('tool.call', async ($, e) => {
    await clock.sleep((e as { tool: string }).tool === 'Bash' ? 8000 : 3000)

    return { result: {} }
  })
  const drawn = async () => {
    const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
    const source = String((await ui.find({ type: 'Svg' }))?.props.source)

    await ui.unmount()

    return source
  }
  const slow = $.tool.call({ tool: 'Bash', command: 'sleep 8' })
  const fetched = $.tool.call({ tool: 'WebFetch', url: 'https://example.com', prompt: 'x' })

  await clock.settle()
  const both = await drawn()

  // Two seconds at each hole in turn, four seconds the round: the command's
  // hole has the first turn and the fetch's the second, and each mole
  // flinches only during its own.
  expect(both).toContain('@keyframes cy2{')
  expect(both).toContain('animation:cy2 4000ms linear -0ms infinite')
  expect(both).toContain('animation:cy2 4000ms linear -2000ms infinite')
  expect(both).toContain('animation:fq2 4000ms linear -0ms infinite')
  expect(both).toContain('animation:fq2 4000ms linear -2000ms infinite')

  await clock.advance(3000)
  await fetched
  const one = await drawn()

  // The fetch has ended: Claude hops to it 260 ms before the mallet lands and
  // leaves 300 ms after. The Claude beside the command still running is
  // hidden for that long, and then comes back to tap.
  expect(one).toContain('animation:in .18s ease-out 190ms both,out .14s ease-in 750ms forwards')
  expect(one).toContain('swr .46s ease-in 284ms')
  expect(one).toContain(`${RIPPLE} 450ms both`)
  expect(one).toContain('opacity:1;animation:off 1ms linear 230ms forwards,on 1ms linear 690ms forwards')
  expect(one).toContain('animation:in .18s ease-out 690ms forwards')
  // Drawn again in the middle of the visit, nothing has moved.
  await clock.advance(500)
  const during = await drawn()

  expect(during).toContain('animation:in .18s ease-out -310ms both,out .14s ease-in 250ms forwards')
  expect(during).toContain('opacity:0;animation:on 1ms linear 190ms forwards')
  expect(one.includes('animation:cy2 ')).toBe(false)

  await clock.advance(4500)
  await slow
  const none = await drawn()

  // The command has ended with Claude beside it: no hop, only the swing.
  expect(none).toContain('swr .46s ease-in 284ms')
  expect(none).toContain(`${BOLT} 450ms both`)
  expect(none.includes('animation:in .18s')).toBe(false)
  expect(none.includes('animation:tap ')).toBe(false)
})
