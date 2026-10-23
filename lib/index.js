/**
 * dsh-skill-panel — Host half.
 *
 * 前端那半（lib/client.js）用 `skills/list` Remote 读 skill 目录，再把它画成
 * 侧边栏按钮和浮层。这半只做两件事：
 *
 *   1. 占一条 Loader row，让 Web 组合愿意把 client bundle 发出去；
 *   2. 提供 `GET /skill-panel/dictionary`，把 lib/zh.json 里的中文说明发给面板。
 *
 * 中文词典放在文件里而不是写死在 bundle 里，是为了让使用者能直接编辑 JSON
 * 加自己的翻译，改完刷新面板即可生效，不需要重新构建任何东西。
 *
 * @module dsh-skill-panel
 */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'skill-panel'

/** 本插件占用的路由前缀。 */
export const ROUTE_PREFIX = '/skill-panel'

/** 词典文件就在本文件旁边。 */
const DICTIONARY_PATH = join(dirname(fileURLToPath(import.meta.url)), 'zh.json')

/**
 * `webServer` 是唯一的宿主依赖：桌面端和 Web 端都由它对外提供界面，
 * 所以这个插件只在这两种组合里出现——本来也只对它们有意义。
 */
export const inject = ['webServer']

/**
 * 读词典。文件缺失或写坏了都不算致命：面板退回英文描述，中文一栏留空。
 *
 * @returns {Promise<{ok: boolean, skills: Record<string, unknown>, error?: string}>}
 */
export async function readDictionary() {
  try {
    const raw = await readFile(DICTIONARY_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    const skills =
      parsed !== null && typeof parsed === 'object' && typeof parsed.skills === 'object' && parsed.skills !== null
        ? parsed.skills
        : {}
    return { ok: true, skills }
  } catch (error) {
    return {
      ok: false,
      skills: {},
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * 挂载词典路由。webServer.register 返回卸载函数，交给 `ctx.effect` 管理。
 */
export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: ROUTE_PREFIX,
        handler: async (req, res) => {
          const url = new URL(req.url ?? '/', 'http://dsh.internal')
          const pathname = url.pathname.replace(/\/+$/, '')

          if ((req.method === 'GET' || req.method === 'HEAD') && pathname === `${ROUTE_PREFIX}/dictionary`) {
            const payload = await readDictionary()
            res.statusCode = 200
            res.setHeader('content-type', 'application/json; charset=utf-8')
            // 词典是本地文件，别让浏览器缓存住——改完 zh.json 刷新面板就该看到。
            res.setHeader('cache-control', 'no-store')
            res.end(req.method === 'HEAD' ? undefined : JSON.stringify(payload))
            return
          }

          res.statusCode = 404
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: false, error: 'not found' }))
        },
      }),
    'dsh-skill-panel: /skill-panel/dictionary route',
  )
}
