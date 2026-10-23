import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

const CLIENT = fileURLToPath(new URL('../lib/client.js', import.meta.url))

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://127.0.0.1:55551/',
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

let copied = null
Object.defineProperty(window.navigator, 'clipboard', {
  value: { writeText: async (text) => { copied = text } },
  configurable: true,
})

let registered = null
window.__ModuleLoader__ = { load: (definition) => { registered = definition } }

// eslint-disable-next-line no-new-func
new Function('window', 'require', fs.readFileSync(CLIENT, 'utf8'))(window, (id) => {
  if (id === 'react') return React
  throw new Error(`unexpected require: ${id}`)
})

const skills = [
  { name: 'ppt-master', description: 'AI-driven presentation workflow for editable PPTX', modelInvocable: true, userInvocable: true, path: 'C:/Users/Administrator/.dsh/skills/ppt-master/SKILL.md' },
  { name: 'office', description: 'Create, edit, inspect Office documents', modelInvocable: true, userInvocable: true, path: '' },
  { name: 'hidden-helper', description: 'Only the user can call this one', modelInvocable: false, userInvocable: true, path: 'C:/project/.dsh/skills/hidden-helper/SKILL.md' },
]

const plugin = registered.factory((id) => (id === 'react' ? React : {}))
const sessionsSnapshot = { byId: { s1: { id: 's1', retainedBy: { mainView: 1 } } } }

let slotRegistration = null
const ctx = {
  effect: (fn) => { fn(); return () => {} },
  locale: { register: () => () => {}, bind: () => (key) => key },
  slots: {
    inject: (_name, produce) => { slotRegistration = produce() },
    register: (config, component) => ({ config, component }),
  },
  sessions: { list: { getSnapshot: () => sessionsSnapshot, subscribe: () => () => {} } },
  remote: { skills: { list: async () => ({ ok: true, value: { skills } }) } },
}
plugin.apply(ctx)

const injected = slotRegistration.config.inject()
const props = {
  wide: true,
  t: (key) => key,
  ...injected,
  useSessionList: (selector) => selector(injected.hooks.sessionList.getSnapshot()),
  useSkillsCatalog: (selector) =>
    React.useSyncExternalStore(
      (callback) => injected.hooks.skillsCatalog.subscribe(callback),
      () => selector(injected.hooks.skillsCatalog.getSnapshot()),
    ),
  loadSkills: injected.loadSkills,
}

const container = document.getElementById('root')
const root = createRoot(container)
await act(async () => {
  root.render(React.createElement(slotRegistration.component, props))
})

const button = container.querySelector('button')
console.log('button text:', button.textContent)
await act(async () => {
  button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 250))
})

const dialog = document.querySelector('[role="dialog"]')
console.log('dialog present:', dialog !== null)
await act(async () => {
  await new Promise((r) => setTimeout(r, 80))
})
const rows = [...document.querySelectorAll('[role="dialog"] li button')]
console.log('rows:', rows.length, rows.map((r) => r.textContent.slice(0, 40)))
console.log('DIALOG TEXT:', JSON.stringify(dialog ? dialog.textContent : null))
console.log('has search input:', document.querySelector('[role="dialog"] input') !== null)

// filter
const input = document.querySelector('[role="dialog"] input')
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
await act(async () => {
  setter.call(input, 'office')
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 30))
})
console.log('rows after filter:', document.querySelectorAll('[role="dialog"] li button').length)

// reset filter, click first row -> copy
await act(async () => {
  setter.call(input, '')
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 30))
})
const firstRow = document.querySelector('[role="dialog"] li button')
await act(async () => {
  firstRow.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 250))
})
console.log('copied:', copied)
console.log('footer text:', document.querySelector('[role="dialog"]')?.lastElementChild?.textContent)

// escape closes
await act(async () => {
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await new Promise((r) => setTimeout(r, 40))
})
console.log('dialog after escape:', document.querySelector('[role="dialog"]') !== null)
console.log('INTERACTION-OK')



