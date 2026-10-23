/**
 * 交互回归：打开面板 → 中文说明 → 搜索（含中文）→ 键盘选择 → Enter 复制 → Esc 关闭。
 * 用 jsdom + react-dom 跑真实组件，不是快照。
 */
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

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`)
  console.log(`ok  ${message}`)
}

// ── 假宿主：词典路由 + 剪贴板 ───────────────────────────────────────────────
const DICTIONARY = {
  'ppt-master': { title: 'PPT 大师', summary: '把文档做成原生可编辑的 PPTX。' },
  'office-xlsx': { title: 'Excel 表格', summary: '读取、创建、编辑工作簿与公式。' },
}
globalThis.fetch = async (url) => {
  if (String(url).includes('/skill-panel/dictionary')) {
    return { ok: true, json: async () => ({ ok: true, skills: DICTIONARY }) }
  }
  return { ok: false, json: async () => ({}) }
}

let copied = null
Object.defineProperty(window.navigator, 'clipboard', {
  value: { writeText: async (text) => { copied = text } },
  configurable: true,
})

// ── 装载 bundle ────────────────────────────────────────────────────────────
let registered = null
window.__ModuleLoader__ = { load: (definition) => { registered = definition } }
new Function('window', 'require', fs.readFileSync(CLIENT, 'utf8'))(window, (id) => {
  if (id === 'react') return React
  throw new Error(`unexpected require: ${id}`)
})
const plugin = registered.factory((id) => (id === 'react' ? React : {}))
assert(registered.id === 'dsh-skill-panel', 'bundle id matches the package name')

const SKILLS = [
  { name: 'ppt-master', description: 'AI-driven presentation workflow', modelInvocable: true, userInvocable: true, path: 'C:/u/.dsh/skills/ppt-master/SKILL.md' },
  { name: 'office-xlsx', description: 'Read, create and edit workbooks', modelInvocable: true, userInvocable: true, path: 'C:/u/.dsh/skills/office-xlsx/SKILL.md' },
  { name: 'hidden-helper', description: 'Only the user can call this one', modelInvocable: false, userInvocable: true, path: 'C:/p/.dsh/skills/hidden-helper/SKILL.md' },
]

let slotRegistration = null
const sessionsSnapshot = { byId: { s1: { id: 's1', retainedBy: { mainView: 1 } } } }
const ctx = {
  effect: (fn) => { fn() },
  locale: { register: () => () => {}, bind: () => (key) => key },
  slots: {
    inject: (_name, produce) => { slotRegistration = produce() },
    register: (config, component) => ({ config, component }),
  },
  sessions: { list: { getSnapshot: () => sessionsSnapshot, subscribe: () => () => {} } },
  remote: { skills: { list: async () => ({ ok: true, value: { skills: SKILLS } }) } },
}
plugin.apply(ctx)
assert(slotRegistration.config.name === 'sidebar.footer.action', 'registers into the sidebar footer slot')

const injected = slotRegistration.config.inject()
const hooks = injected.hooks
const props = {
  wide: true,
  t: (key) => key,
  ...injected,
  useSessionList: (selector) =>
    React.useSyncExternalStore((cb) => hooks.sessionList.subscribe(cb), () => selector(hooks.sessionList.getSnapshot())),
  useSkillsCatalog: (selector) =>
    React.useSyncExternalStore((cb) => hooks.skillsCatalog.subscribe(cb), () => selector(hooks.skillsCatalog.getSnapshot())),
  loadSkills: injected.loadSkills,
}

const container = document.getElementById('root')
const root = createRoot(container)
await act(async () => {
  root.render(React.createElement(slotRegistration.component, props))
})

const button = container.querySelector('button')
assert(button.textContent.includes('技能'), 'button label is rendered')

const flush = async (ms = 120) => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
}

await act(async () => {
  button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
})
await flush()
const dialog = document.querySelector('[role="dialog"]')
assert(dialog !== null, 'panel opens')

const rows = () => [...document.querySelectorAll('[role="dialog"] li button')]
assert(rows().length === 3, 'three skills listed')
assert(dialog.textContent.includes('PPT 大师｜把文档做成原生可编辑的 PPTX。'), 'Chinese title and summary render')
assert(dialog.textContent.includes('Excel 表格'), 'second translation renders')
assert(dialog.textContent.includes('Only the user can call this one'), 'untranslated skill keeps its English description')
assert(dialog.textContent.includes('仅用户'), 'user-only tag renders')
assert(dialog.textContent.includes('2/3'), 'translation coverage is shown in the footer')

// 搜索：中文命中
const input = dialog.querySelector('input')
const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
await act(async () => {
  setValue.call(input, '表格')
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
})
await flush(60)
assert(rows().length === 1, 'Chinese query filters down to one skill')
assert(rows()[0].textContent.includes('office-xlsx'), 'the Chinese match is the Excel skill')

// 清空搜索，键盘选择 + Enter
await act(async () => {
  setValue.call(input, '')
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
})
await flush(60)
assert(rows().length === 3, 'clearing the query restores all rows')

await act(async () => {
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
})
await flush(40)
const highlighted = rows().find((row) => row.getAttribute('data-skill-active') === 'true')
assert(highlighted !== undefined && highlighted.textContent.includes('office-xlsx'), 'ArrowDown moves the highlight to the second row')

await act(async () => {
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
})
await flush(60)
assert(copied === '/office-xlsx', `Enter copies the active row (got ${copied})`)
assert(dialog.textContent.includes('已复制 /office-xlsx'), 'footer reports the copy')

// 最近使用
const recent = JSON.parse(window.localStorage.getItem('dsh.skill-panel.recent.v1') ?? '[]')
assert(recent[0] === 'office-xlsx', 'the copied skill becomes the most recent')
await flush(40)
assert(rows()[0].textContent.includes('office-xlsx'), 'recent skill is pinned to the top')
assert(rows()[0].textContent.includes('最近'), 'recent tag renders')

// Esc 关闭
await act(async () => {
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
})
await flush(40)
assert(document.querySelector('[role="dialog"]') === null, 'Escape closes the panel')

await act(async () => {
  root.unmount()
})

console.log('INTERACTION-OK')
