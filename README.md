# tool-flow: whack-a-mole for Claude Code

A mod for the Code tab of the Claude desktop app. It draws a pixel-art meadow behind the conversation where Claude's little crab plays whack-a-mole: every kind of tool has a hole, a mole pops up when a tool call starts, the crab taps it while the call runs, and brings the mallet down hard when it ends.

给 Claude 桌面端 Code 标签页用的一个 mod：对话后面是一片像素风草地，Claude 小螃蟹在上面打地鼠。每类工具一个地洞，工具调用开始时地鼠冒头，运行期间小螃蟹一下一下地敲，结束时一锤砸下去。中文回复用 `/tool-flow lang zh` 打开。

## Reading the game

There are no words in the picture. A kind of tool is told by its mole's costume and by what flies out when it is whacked:

| Tool | The mole | When whacked |
| :- | :- | :- |
| Read, Grep, Glob | round glasses, holding a book | sheets of paper |
| Edit, Write | a pencil behind the ear, holding a pad | pencil shavings and a scribble |
| Bash | a hard hat with a lamp | lightning |
| WebFetch, WebSearch | an aerial | ripples |
| Agent, Skill | a robot's visor | circling stars |
| MCP tools | the prongs of a plug | sparks |
| Everything else | a propeller cap | dust, a nut and a bolt |

A failed call is a miss: the mole ducks, then sticks its tongue out. Calls that finish together are whacked one after another. Three hits within four seconds bring confetti.

## Requirements

- The Code tab of the Claude desktop app, with Claude Code 2.1.324 or later (type `/status` in a session to see the version).
- Claude Code in a terminal loads the mod too, but a terminal draws no backdrop.

## Install

```sh
git clone https://github.com/haozhanghz/tool-flow ~/.claude/skills/tool-flow
```

Start a new session in the Code tab and send a message: the meadow appears and plays a short demo game once. In a session that is already open, type `/reload-plugins`.

Without git, download the repository as a ZIP and put the folder at `~/.claude/skills/tool-flow/`. To update later, run `git pull` in that folder.

If your sessions run on a remote machine over SSH, install it in that machine's `~/.claude/skills/`. A copy on your own computer does nothing for them.

## Commands

| Command | What it does |
| :- | :- |
| `/tool-flow night`, `/tool-flow day` | The night meadow or the day meadow (night by default) |
| `/tool-flow demo` | Plays a 13-second game |
| `/tool-flow glass <blur> <opacity>` | The veil over the conversation; smaller numbers show the picture more clearly, for example `glass 0 0.3` |
| `/tool-flow tint <#rrggbb>`, `/tool-flow tint off` | The panels' color, or back to the app's own |
| `/tool-flow off`, `/tool-flow on` | Off, or on again |
| `/tool-flow status` | What the mod sees |
| `/tool-flow lang zh`, `/tool-flow lang en` | Replies in Chinese or English |

## Known limits

These come from the desktop app and a mod cannot change them:

- The page a new session starts from has no backdrop until the first message is sent. It keeps the theme's colors only.
- The sidebar and the right panel stay nearly opaque and let only a blurred hint of color through. The title bar and the prompt box are fully opaque. Collapse the sidebar to give the meadow the whole window.
- That new-session page follows the app's own appearance setting. Night goes with a dark appearance and day with a light one.
- Cloud sessions do not load the mod.
- As a conversation grows, its text lies over the holes.
- Checked in the macOS desktop app 5.11492.5 only.

## Uninstall

Delete `~/.claude/skills/tool-flow/` and start a new session. If the app still shows the theme's colors, open Settings, search for `code appearance`, and choose Remove colors.

## Develop

```sh
claude plugin validate ~/.claude/skills/tool-flow
claude plugin test ~/.claude/skills/tool-flow
```

`hooks/scene.ts` draws the picture and `hooks/register.tsx` listens for tool calls and commands.

## Notes

- A mod is code that runs on your computer with your permissions. This one watches when tool calls start and end and draws a backdrop. It reads no conversation text and makes no network requests. The only things it saves are two small settings in Claude Code's own store for the mod: your reply language, and that the demo has played once.
- `hooks/make-colors.js` and `hooks/make-colors.d.ts` are copied unchanged from Claude Code's own plugin-authoring skill, and build the app's color palette.
- The character with the mallet is a pixel drawing after Claude's little crab. Claude and its likeness belong to Anthropic. This is a fan-made mod, not an Anthropic product.
- MIT license, see `LICENSE`. The two `make-colors` files keep whatever terms Claude Code gives them.
