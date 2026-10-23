import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const CLIENT = fileURLToPath(new URL('../lib/client.js', import.meta.url))

let registered = null
const fakeWindow = {
  __ModuleLoader__: {
    load(definition) {
      registered = definition
    },
  },
}

const source = fs.readFileSync(CLIENT, 'utf8')
// eslint-disable-next-line no-new-func
const run = new Function('window', 'require', source)
run(fakeWindow, (id) => {
  if (id === 'react') return React
  throw new Error(`unexpected require: ${id}`)
})

if (registered === null) throw new Error('the bundle did not register a module')
console.log('registered id:', registered.id)

const plugin = registered.factory((id) => {
  if (id === 'react') return React
  return {}
})
console.log('exports:', Object.keys(plugin), 'inject:', plugin.inject.join(','))

// ---- fake client context -------------------------------------------------
let slotRegistration = null
const sessionsSnapshot = { byId: { s1: { id: 's1', retainedBy: { mainView: 1 } } } }
const sessionList = {
  getSnapshot: () => sessionsSnapshot,
  subscribe: () => () => {},
}
const catalog = { status: 'ready', sessionId: 's1', skills: [
  { name: 'ppt-master', description: 'AI-driven presentation workflow', modelInvocable: true, userInvocable: true, path: 'C:/Users/Administrator/.dsh/skills/ppt-master/SKILL.md' },
  { name: 'office', description: 'Create and edit Office documents', modelInvocable: true, userInvocable: true, path: '' },
] }

let loads = 0
const ctx = {
  effect(fn) {
    const dispose = fn()
    return dispose ?? (() => {})
  },
  locale: {
    register() {
      return () => {}
    },
    bind: () => (key) => key,
  },
  slots: {
    inject(name, produce) {
      slotRegistration = produce()
      console.log('slot injected:', name)
    },
    register(config, component) {
      return { config, component }
    },
  },
  sessions: { list: sessionList },
  remote: {
    skills: {
      list: async ({ sessionId }) => {
        loads += 1
        console.log('skills/list called for', sessionId)
        return { ok: true, value: { skills: catalog.skills } }
      },
    },
  },
}

plugin.apply(ctx)

if (slotRegistration === null) throw new Error('no slot registration')
console.log('slot:', slotRegistration.config.name, slotRegistration.config.id, 'order', slotRegistration.config.order)

const injected = slotRegistration.config.inject()
const props = {
  wide: true,
  t: (key) => key,
  ...injected,
  useSessionList: injected.hooks.sessionList.getSnapshot ? (selector) => selector(injected.hooks.sessionList.getSnapshot()) : () => undefined,
  useSkillsCatalog: (selector) => selector(injected.hooks.skillsCatalog.getSnapshot()),
  loadSkills: injected.loadSkills,
}

const wideHtml = renderToStaticMarkup(React.createElement(slotRegistration.component, props))
const railProps = { ...props, wide: false }
const railHtml = renderToStaticMarkup(React.createElement(slotRegistration.component, railProps))

console.log('wide markup length:', wideHtml.length)
console.log('rail markup length:', railHtml.length)
if (!wideHtml.includes('技能') && !wideHtml.includes('button.label')) {
  console.log('note: label key not translated by the stub t(), raw key rendered instead')
}
console.log('wide html:', wideHtml.slice(0, 400))
console.log('SMOKE-OK')
