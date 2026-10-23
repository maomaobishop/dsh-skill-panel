/**
 * 三种上下文各跑一遍，确认「打开面板」最多只发两次 skills/list，且失败不会自我重试。
 *   node storm2.mjs no-using      没有 sessions.using
 *   node storm2.mjs using-ok      sessions.using 正常执行回调
 *   node storm2.mjs using-reject  sessions.using 自己抛错（退回裸调用）
 *   node storm2.mjs ok            一切正常
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

const CLIENT = fileURLToPath(new URL('../lib/client.js', import.meta.url))
const MODE = process.argv[2] ?? 'no-using'
const REJECT = process.argv[3] !== 'ok'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://127.0.0.1:52483/',
  pretendToBeVisual: true,
})
const { window } = dom
globalThis.window = window
globalThis.document = window.document
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
globalThis.HTMLElement = window.HTMLElement
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window)
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const React = (await import('react')).default
const { createRoot } = await import('react-dom/client')
const { act } = await import('react-dom/test-utils')

let registered = null
window.__ModuleLoader__ = { load: (definition) => { registered = definition } }
new Function('window', 'require', fs.readFileSync(CLIENT, 'utf8'))(window, (id) => {
  if (id === 'react') return React
  throw new Error(`unexpected require: ${id}`)
})
const plugin = registered.factory((id) => (id === 'react' ? React : {}))

let listCalls = 0
let usingCalls = 0
const skills = [
  { name: 'ppt-master', description: 'deck workflow', modelInvocable: true, userInvocable: true, path: 'C:/u/.dsh/skills/ppt-master/SKILL.md' },
]

let slotRegistration = null
const sessions = {
  list: {
    getSnapshot: () => ({ byId: { s1: { id: 's1', retainedBy: { mainView: 1 } } } }),
    subscribe: () => () => {},
  },
}
if (MODE === 'using-ok' || MODE === 'using-reject') {
  sessions.using = async (_id, _options, callback) => {
    usingCalls += 1
    if (MODE === 'using-reject') throw new Error('retention source is not registered')
    return callback({ binding: { session: { getSnapshot: () => ({ openState: 'open' }) } } })
  }
}

const ctx = {
  effect: (fn) => { fn() },
  locale: { register: () => () => {}, bind: () => (key) => key },
  slots: {
    inject: (_n, produce) => { slotRegistration = produce() },
    register: (config, component) => ({ config, component }),
  },
  sessions,
  remote: {
    skills: {
      list: async () => {
        listCalls += 1
        if (REJECT) throw new Error('skills/list failed: session-not-found')
        return { ok: true, value: { skills } }
      },
    },
  },
}
plugin.apply(ctx)

const injected = slotRegistration.config.inject()
const hooks = injected.hooks
const props = {
  wide: true,
  t: (key) => key,
  ...injected,
  useSessionList: (selector) =>
    React.useSyncExternalStore(
      (cb) => hooks.sessionList.subscribe(cb),
      () => selector(hooks.sessionList.getSnapshot()),
    ),
  useSkillsCatalog: (selector) =>
    React.useSyncExternalStore(
      (cb) => hooks.skillsCatalog.subscribe(cb),
      () => selector(hooks.skillsCatalog.getSnapshot()),
    ),
  loadSkills: injected.loadSkills,
}

const container = document.getElementById('root')
const root = createRoot(container)
await act(async () => {
  root.render(React.createElement(slotRegistration.component, props))
})
const button = container.querySelector('button')
await act(async () => {
  button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 800))
})

// 再点一次「刷新」和一次「重试」，确认手动操作也只发一次
const refresh = [...container.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === '↻')
if (refresh) {
  await act(async () => {
    refresh.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 300))
  })
}

console.log(JSON.stringify({ mode: MODE, reject: REJECT, listCalls, usingCalls }))
if (listCalls > 3) {
  console.log('STORM-DETECTED')
  process.exitCode = 2
} else {
  console.log('NO-STORM')
}
