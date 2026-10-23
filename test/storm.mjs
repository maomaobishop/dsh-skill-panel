/**
 * 复现「点开就卡死」：让 skills/list 直接失败，观察面板是否发起无限重试。
 * 真实插槽渲染器用的就是 useSyncExternalStore，所以这里也用它。
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

const CLIENT = fileURLToPath(new URL('../lib/client.js', import.meta.url))
const REJECT = process.argv[2] !== 'ok'

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
const skills = [{ name: 'ppt-master', description: 'deck workflow', modelInvocable: true, userInvocable: true, path: 'C:/u/.dsh/skills/ppt-master/SKILL.md' }]
let slotRegistration = null
const ctx = {
  effect: (fn) => { fn() },
  locale: { register: () => () => {}, bind: () => (key) => key },
  slots: {
    inject: (_n, produce) => { slotRegistration = produce() },
    register: (config, component) => ({ config, component }),
  },
  sessions: {
    list: {
      getSnapshot: () => ({ byId: { s1: { id: 's1', retainedBy: { mainView: 1 } } } }),
      subscribe: () => () => {},
    },
  },
  remote: {
    skills: {
      list: async () => {
        listCalls += 1
        if (REJECT) throw new Error('session "s1" is not open')
        return { ok: true, value: { skills } }
      },
    },
  },
}
plugin.apply(ctx)

const injected = slotRegistration.config.inject()
const hooks = injected.hooks
const subscribeTo = (store) => (callback) => store.subscribe(callback)
const snapOf = (store) => (selector) => selector(store.getSnapshot())

const props = {
  wide: true,
  t: (key) => key,
  ...injected,
  useSessionList: (selector) =>
    React.useSyncExternalStore(subscribeTo(hooks.sessionList), () => snapOf(hooks.sessionList)(selector)),
  useSkillsCatalog: (selector) =>
    React.useSyncExternalStore(subscribeTo(hooks.skillsCatalog), () => snapOf(hooks.skillsCatalog)(selector)),
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
  await new Promise((r) => setTimeout(r, 1000))
})

console.log('mode:', REJECT ? 'rejecting' : 'ok')
console.log('skills.list calls in ~1s:', listCalls)
console.log('dialog text:', JSON.stringify(document.querySelector('[role="dialog"]')?.textContent ?? null).slice(0, 200))
if (listCalls > 5) {
  console.log('STORM-DETECTED — 面板在失败后无限重试')
  process.exitCode = 2
} else {
  console.log('NO-STORM')
}
