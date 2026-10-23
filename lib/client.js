/**
 * dsh-skill-panel —— 前端半。
 *
 * 给 Web / 桌面端侧边栏底部加一个「技能」按钮：点开后列出当前会话可见的
 * skill 目录，带中文说明、来源、最近使用，点一行就把 `/名称` 复制到剪贴板。
 *
 * 数据来源：
 *   - 目录：官方 `skills/list` Remote（`ctx.remote.skills.list`），与输入框里
 *     敲 `/` 得到的候选完全一致；
 *   - 中文说明：宿主半的 `GET /skill-panel/dictionary`，内容来自 lib/zh.json。
 *     读不到就退回英文描述，不当错误处理。
 *
 * 本文件是手写的 lazy-CJS 工厂，格式与官方 client bundle 一致：
 * 外层只注册工厂，模块体（含样式）在首次物化时才执行。
 */
window.__ModuleLoader__.load({
  // 必须与包名（Loader row id）完全一致：client-modules 用它校验注册结果，
  // 不匹配会退回单资源 URL 再执行一次，那一次就变成重复注册。
  id: 'dsh-skill-panel',
  factory: (require) => {
    const React = require('react')

    /** 语言命名空间；`zh` 是键集的真源。 */
    const NS = 'skillPanel'

    const zh = {
      'button.label': '技能',
      'button.title': '查看已安装的 Skill',
      'panel.title': '已安装的 Skill',
      'panel.search': '搜索名称或说明…',
      'panel.refresh': '刷新',
      'panel.close': '关闭',
      'panel.loading': '正在读取 skill 目录…',
      'panel.empty': '没有匹配的 skill。',
      'panel.emptyHint': '把 skill 放进 ~/.dsh/skills、~/.agents/skills 或项目的 .dsh/skills 即可出现。',
      'panel.noSession': '先打开一个会话，再查看它可见的 skill 目录。',
      'panel.error': '读取 skill 目录失败：{message}',
      'panel.retry': '重试',
      'panel.copied': '已复制 {command} — 粘贴到输入框即可调用',
      'panel.count': '{count} 个',
      'panel.recent': '最近',
      'panel.userOnly': '仅用户',
      'panel.hint': '↑↓ 选择 · Enter 复制 · Esc 关闭',
      'panel.noZh': '{count} 个还没有中文说明，可在 lib/zh.json 里补',
    }

    const en = {
      'button.label': 'Skills',
      'button.title': 'Browse installed skills',
      'panel.title': 'Installed skills',
      'panel.search': 'Search name or description…',
      'panel.refresh': 'Refresh',
      'panel.close': 'Close',
      'panel.loading': 'Reading the skill catalog…',
      'panel.empty': 'No skill matches.',
      'panel.emptyHint': 'Drop a skill into ~/.dsh/skills, ~/.agents/skills or the project .dsh/skills.',
      'panel.noSession': 'Open a session first to see the skills it can use.',
      'panel.error': 'Could not read the skill catalog: {message}',
      'panel.retry': 'Retry',
      'panel.copied': 'Copied {command} — paste it into the composer',
      'panel.count': '{count} skill(s)',
      'panel.recent': 'recent',
      'panel.userOnly': 'user-only',
      'panel.hint': '↑↓ move · Enter copy · Esc close',
      'panel.noZh': '{count} without a Chinese description — add one in lib/zh.json',
    }

    /** 用 `{name}` 占位符格式化一条语言条目。 */
    function format(template, values) {
      return String(template).replace(/\{(\w+)\}/g, (_match, name) =>
        Object.hasOwn(values, name) ? String(values[name]) : `{${name}}`,
      )
    }

    /** 通过命名空间座位翻译一个键；拿不到座位时回退到 `zh` 模板。 */
    function translate(t, key, values) {
      let template
      if (typeof t === 'function') {
        template = t(key)
      }
      if (template === undefined || template === null || template === key) {
        template = zh[key] ?? key
      }
      return values === undefined ? template : format(template, values)
    }

    // ── 样式 ────────────────────────────────────────────────────────────────
    // 所有颜色都取自主题 token，深浅色主题自动跟随。
    const styles = {
      wrap: { position: 'relative', display: 'inline-flex' },
      button: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        height: '28px',
        maxWidth: '100%',
        padding: '0 8px',
        border: '1px solid transparent',
        borderRadius: '8px',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        font: 'inherit',
        fontSize: '12px',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      },
      buttonRail: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        padding: '0',
        border: '1px solid transparent',
        borderRadius: '8px',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        font: 'inherit',
        cursor: 'pointer',
      },
      buttonOpen: {
        background: 'var(--dsw-alias-bg-hover, rgba(127,127,127,0.12))',
        color: 'var(--dsw-alias-label-primary)',
      },
      buttonLabel: { overflow: 'hidden', textOverflow: 'ellipsis' },
      badge: {
        minWidth: '16px',
        height: '16px',
        padding: '0 4px',
        borderRadius: '999px',
        background: 'var(--dsw-alias-bg-subtle, rgba(127,127,127,0.16))',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '10px',
        lineHeight: '16px',
        textAlign: 'center',
      },
      panel: {
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '12px',
        background: 'var(--dsw-alias-bg-overlay)',
        color: 'var(--dsw-alias-label-primary)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.26)',
        zIndex: 80,
      },
      head: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px 8px' },
      title: { flex: '1 1 auto', margin: 0, fontSize: '13px', fontWeight: 600 },
      count: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary))' },
      iconButton: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
        padding: 0,
        border: 'none',
        borderRadius: '6px',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        font: 'inherit',
        fontSize: '14px',
        lineHeight: '1',
        cursor: 'pointer',
      },
      searchRow: { padding: '0 12px 8px' },
      search: {
        boxSizing: 'border-box',
        width: '100%',
        height: '28px',
        padding: '0 8px',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '8px',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        fontSize: '12px',
        outline: 'none',
      },
      body: { flex: '1 1 auto', overflowY: 'auto', padding: '0 6px 6px' },
      list: { listStyle: 'none', margin: 0, padding: 0 },
      row: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        width: '100%',
        padding: '7px 8px',
        border: '1px solid transparent',
        borderRadius: '8px',
        background: 'transparent',
        color: 'inherit',
        font: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
      },
      rowActive: {
        background: 'var(--dsw-alias-bg-hover, rgba(127,127,127,0.12))',
        border: '1px solid var(--dsw-alias-border-l1)',
      },
      rowHead: { display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 },
      name: {
        flex: '0 1 auto',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '12px',
        fontWeight: 600,
      },
      tag: {
        flex: '0 0 auto',
        padding: '0 5px',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '999px',
        color: 'var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary))',
        fontSize: '10px',
        lineHeight: '15px',
      },
      tagRecent: {
        flex: '0 0 auto',
        padding: '0 5px',
        borderRadius: '999px',
        background: 'var(--dsw-alias-bg-subtle, rgba(127,127,127,0.16))',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '10px',
        lineHeight: '15px',
      },
      summary: {
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: 2,
        overflow: 'hidden',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '11.5px',
        lineHeight: '16px',
      },
      meta: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: 'var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary))',
        fontSize: '10.5px',
      },
      state: { padding: '18px 14px', color: 'var(--dsw-alias-label-secondary)', fontSize: '12px', lineHeight: '18px' },
      error: { padding: '14px 12px', color: 'var(--dsw-alias-state-error-primary)', fontSize: '12px', lineHeight: '18px' },
      foot: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '6px 12px 8px',
        borderTop: '1px solid var(--dsw-alias-border-l1)',
        color: 'var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary))',
        fontSize: '10.5px',
      },
      footHint: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      copied: { color: 'var(--dsw-alias-state-success-primary, var(--dsw-alias-label-secondary))' },
      smallButton: {
        height: '22px',
        padding: '0 8px',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '6px',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        fontSize: '11px',
        cursor: 'pointer',
      },
    }

    /** 一枚书本样式的图标，避免依赖未在共享表里登记的具体图标名。 */
    function SkillIcon({ size }) {
      const s = size ?? 16
      return React.createElement(
        'svg',
        {
          width: s,
          height: s,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
        },
        React.createElement('path', {
          key: 'spine',
          d: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15.5H6.5A2.5 2.5 0 0 0 4 21z',
        }),
        React.createElement('path', { key: 'line1', d: 'M8 7.5h7' }),
        React.createElement('path', { key: 'line2', d: 'M8 11h5' }),
      )
    }

    /** 从 SKILL.md 路径推出一个短来源标签。 */
    function sourceLabel(path) {
      if (typeof path !== 'string' || path === '') return ''
      const normalized = path.replace(/\\/g, '/')
      if (normalized.includes('/.dsh/skills/')) return '.dsh/skills'
      if (normalized.includes('/.agents/skills/')) return '.agents/skills'
      if (normalized.includes('/node_modules/')) return 'plugin'
      const parts = normalized.split('/').filter(Boolean)
      return parts.length >= 2 ? `${parts[parts.length - 3] ?? ''}/${parts[parts.length - 2]}` : normalized
    }

    /** 当前主视图持有的会话 id；侧边栏底部是框架级插槽，只能这样拿到会话。 */
    function selectCurrentSessionId(state) {
      if (state === undefined || state === null || state.byId === undefined) return undefined
      for (const session of Object.values(state.byId)) {
        if (session === null || typeof session !== 'object') continue
        const retained = session.retainedBy
        if (retained !== undefined && retained !== null && (retained.mainView ?? 0) > 0) {
          return session.id
        }
      }
      return undefined
    }

    /** 一个最小快照 store：`getSnapshot` + `subscribe`，写入按微任务批处理。 */
    function createStore(initial) {
      let value = initial
      const listeners = new Set()
      let scheduled = false
      const notify = () => {
        scheduled = false
        for (const listener of [...listeners]) listener()
      }
      return {
        getSnapshot: () => value,
        subscribe: (listener) => {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
        set: (next) => {
          if (Object.is(next, value)) return
          value = next
          if (scheduled) return
          scheduled = true
          queueMicrotask(notify)
        },
      }
    }

    /** 读取当前会话可见的 skill 目录。 */
    async function readCatalog(ctx, sessionId) {
      const remote = ctx.remote !== undefined ? ctx.remote.skills : undefined
      if (remote === undefined || typeof remote.list !== 'function') {
        throw new Error('the skills/list Remote is unavailable in this composition')
      }
      const controller = new AbortController()
      const list = async () => {
        const result = await remote.list({ sessionId }, controller.signal)
        if (result === undefined || result.ok !== true) {
          const error = result !== undefined ? result.error : undefined
          throw new Error(error !== undefined ? `${error.code}: ${error.message}` : 'skills/list returned no result')
        }
        const skills = result.value !== undefined && Array.isArray(result.value.skills) ? result.value.skills : []
        return skills.map((skill) => ({
          name: String(skill.name ?? ''),
          description: typeof skill.description === 'string' ? skill.description : '',
          modelInvocable: skill.modelInvocable !== false,
          userInvocable: skill.userInvocable !== false,
          path: typeof skill.path === 'string' ? skill.path : '',
        }))
      }
      // 优先走官方的「临时保留会话」包装——`/` 菜单读目录用的就是这条路径；
      // 包装层自己拒绝这次读取、或迟迟不返回时，退回裸调用。两条路径合计最多
      // 两次请求，且都不带重试；失败只留手动「重试」。
      const sessions = ctx.sessions
      if (sessions !== undefined && typeof sessions.using === 'function') {
        let timer
        try {
          return await Promise.race([
            sessions.using(sessionId, { source: 'skillPanel', signal: controller.signal }, list),
            new Promise((_resolve, reject) => {
              timer = setTimeout(() => reject(new Error('retained read timed out')), 4000)
            }),
          ])
        } catch (error) {
          const reason =
            error !== null && error !== undefined && typeof error.message === 'string' ? error.message : String(error)
          console.warn(`[skill-panel] retained read unavailable (${reason}); falling back to a direct call`)
        } finally {
          clearTimeout(timer)
        }
      }
      return await list()
    }

    /**
     * 读中文词典。失败返回空表：中文一栏空着，英文描述照常显示，
     * 不把「没有翻译」当成面板错误。
     */
    async function readDictionary() {
      try {
        const response = await fetch('/skill-panel/dictionary', { credentials: 'same-origin' })
        if (!response.ok) return {}
        const payload = await response.json()
        const skills = payload !== null && typeof payload === 'object' ? payload.skills : undefined
        return skills !== null && typeof skills === 'object' ? skills : {}
      } catch {
        return {}
      }
    }

    // ── 最近使用 ────────────────────────────────────────────────────────────
    const RECENT_KEY = 'dsh.skill-panel.recent.v1'
    const RECENT_MAX = 3

    function readRecent() {
      try {
        const raw = window.localStorage?.getItem(RECENT_KEY)
        if (raw === null || raw === undefined) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').slice(0, RECENT_MAX) : []
      } catch {
        return []
      }
    }

    function pushRecent(name) {
      const next = [name, ...readRecent().filter((item) => item !== name)].slice(0, RECENT_MAX)
      try {
        window.localStorage?.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {
        // 隐私模式 / 配额满：最近使用退化成「本次会话内」的行为，不值得报错。
      }
      return next
    }

    /** 最近用过的排前面，其余按名称排；搜索时也保持这个顺序。 */
    function orderSkills(skills, recent) {
      const rank = new Map(recent.map((name, index) => [name, index]))
      return [...skills].sort((a, b) => {
        const ra = rank.has(a.name) ? rank.get(a.name) : Number.POSITIVE_INFINITY
        const rb = rank.has(b.name) ? rank.get(b.name) : Number.POSITIVE_INFINITY
        if (ra !== rb) return ra - rb
        return a.name.localeCompare(b.name)
      })
    }

    /**
     * 面板：一枚侧边栏按钮 + 一个向上弹出的浮层。浮层自己定位在按钮上方，
     * 因而不会被侧边栏的裁切吃掉。
     */
    function SkillPanel(props) {
      const { wide, useSessionList, useSkillsCatalog, loadSkills, t } = props
      const sessionId = useSessionList(selectCurrentSessionId)
      const catalog = useSkillsCatalog((snapshot) => snapshot)
      const [open, setOpen] = React.useState(false)
      const [query, setQuery] = React.useState('')
      const [copied, setCopied] = React.useState(null)
      const [anchor, setAnchor] = React.useState(null)
      const [active, setActive] = React.useState(0)
      const [recent, setRecent] = React.useState(readRecent)
      const rootRef = React.useRef(null)
      const buttonRef = React.useRef(null)
      const inputRef = React.useRef(null)
      const rowRefs = React.useRef([])
      const copiedTimerRef = React.useRef(undefined)

      const status = catalog !== undefined && catalog !== null ? catalog.status : 'idle'
      const skills = catalog !== undefined && catalog !== null && Array.isArray(catalog.skills) ? catalog.skills : []
      const dictionary = catalog !== undefined && catalog !== null && catalog.dictionary !== undefined ? catalog.dictionary : {}
      const label = translate(t, 'button.label')

      // 打开时把浮层定位到按钮上方；窗口尺寸变化时重新定位。
      React.useLayoutEffect(() => {
        if (!open) return undefined
        const place = () => {
          const rect = buttonRef.current?.getBoundingClientRect()
          if (rect === undefined) return
          const width = Math.min(420, Math.max(280, window.innerWidth - 16))
          setAnchor({
            left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
            bottom: window.innerHeight - rect.top + 8,
            width,
          })
        }
        place()
        window.addEventListener('resize', place)
        return () => {
          window.removeEventListener('resize', place)
        }
      }, [open])

      // 点外部关闭；Esc 关闭；↑↓ 选择，Enter 复制。
      // 监听只挂一次（依赖只有 open），方向键读 activeRef，避免每次移动都重挂。
      const activeRef = React.useRef(0)
      activeRef.current = active
      React.useEffect(() => {
        if (!open) return undefined
        const onPointerDown = (event) => {
          const root = rootRef.current
          if (root !== null && root !== undefined && !root.contains(event.target)) setOpen(false)
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            setOpen(false)
            return
          }
          const rows = rowRefs.current.filter(Boolean)
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (rows.length === 0) return
            event.preventDefault()
            const step = event.key === 'ArrowDown' ? 1 : -1
            setActive((activeRef.current + step + rows.length) % rows.length)
            return
          }
          if (event.key === 'Enter') {
            const target = rows[activeRef.current]
            if (target !== undefined) {
              event.preventDefault()
              target.click()
            }
          }
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown)
        }
      }, [open])

      // 键盘移动后把当前行滚进视野（副作用不能写在 setState 的更新函数里）。
      React.useEffect(() => {
        if (!open) return
        rowRefs.current[active]?.scrollIntoView?.({ block: 'nearest' })
      }, [open, active])

      // 卸载时清掉「已复制」的定时器，别在组件消失后还 setState。
      React.useEffect(() => () => clearTimeout(copiedTimerRef.current), [])

      // 每次「打开」最多自动拉一次。这里刻意不把 catalog 放进依赖里：
      // store 每次写入都是新对象，一旦失败状态又落回「未就绪」，依赖驱动
      // 的重试会变成同步死循环（界面直接卡死）。失败后只留一个手动「重试」。
      const requestedRef = React.useRef(new Set())
      React.useEffect(() => {
        if (!open) {
          requestedRef.current.clear()
          return
        }
        if (sessionId === undefined) return
        if (requestedRef.current.has(sessionId)) return
        requestedRef.current.add(sessionId)
        loadSkills(sessionId)
      }, [open, sessionId, loadSkills])

      // 打开后把焦点放到搜索框。
      React.useEffect(() => {
        if (!open) return
        const handle = setTimeout(() => inputRef.current?.focus(), 30)
        return () => {
          clearTimeout(handle)
        }
      }, [open])

      const copy = (name) => {
        const command = `/${name}`
        const done = () => {
          setCopied(name)
          setRecent(pushRecent(name))
          clearTimeout(copiedTimerRef.current)
          copiedTimerRef.current = setTimeout(
            () => setCopied((current) => (current === name ? null : current)),
            1800,
          )
        }
        const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
        if (clipboard !== undefined && typeof clipboard.writeText === 'function') {
          clipboard.writeText(command).then(done, done)
          return
        }
        try {
          const area = document.createElement('textarea')
          area.value = command
          area.style.position = 'fixed'
          area.style.opacity = '0'
          document.body.appendChild(area)
          area.select()
          document.execCommand('copy')
          document.body.removeChild(area)
          done()
        } catch {
          done()
        }
      }

      const needle = query.trim().toLowerCase()
      const ordered = orderSkills(skills, recent)
      const visible =
        needle === ''
          ? ordered
          : ordered.filter((skill) => {
              const entry = dictionary[skill.name]
              const zhText = entry !== undefined && entry !== null ? `${entry.title ?? ''} ${entry.summary ?? ''}` : ''
              return (
                skill.name.toLowerCase().includes(needle) ||
                skill.description.toLowerCase().includes(needle) ||
                zhText.toLowerCase().includes(needle)
              )
            })

      // 过滤之后别让高亮跑到列表外面。
      React.useEffect(() => {
        setActive((current) => (current >= visible.length ? 0 : current))
      }, [visible.length])

      const zhCount = skills.reduce((count, skill) => {
        const entry = dictionary[skill.name]
        return entry !== undefined && entry !== null && typeof entry.summary === 'string' && entry.summary !== ''
          ? count + 1
          : count
      }, 0)

      const renderBody = () => {
        if (sessionId === undefined) {
          return React.createElement('div', { style: styles.state, children: translate(t, 'panel.noSession') })
        }
        if (status === 'loading' && skills.length === 0) {
          return React.createElement('div', { style: styles.state, children: translate(t, 'panel.loading') })
        }
        if (status === 'error') {
          return React.createElement(
            'div',
            { style: styles.error, role: 'alert' },
            React.createElement('div', { children: translate(t, 'panel.error', { message: catalog.error ?? '' }) }),
            React.createElement('button', {
              type: 'button',
              style: { ...styles.smallButton, marginTop: '8px' },
              onClick: () => loadSkills(sessionId),
              children: translate(t, 'panel.retry'),
            }),
          )
        }
        if (visible.length === 0) {
          return React.createElement(
            'div',
            { style: styles.state },
            React.createElement('div', { children: translate(t, 'panel.empty') }),
            React.createElement('div', {
              style: { marginTop: '4px', fontSize: '11px' },
              children: translate(t, 'panel.emptyHint'),
            }),
          )
        }
        return React.createElement(
          'ul',
          { style: styles.list },
          visible.map((skill, index) => {
            const entry = dictionary[skill.name]
            const zhTitle = entry !== undefined && entry !== null && typeof entry.title === 'string' ? entry.title : ''
            const zhSummary =
              entry !== undefined && entry !== null && typeof entry.summary === 'string' ? entry.summary : ''
            const primary =
              zhSummary === ''
                ? skill.description
                : zhTitle === ''
                  ? zhSummary
                  : `${zhTitle}｜${zhSummary}`
            const secondary = zhSummary !== '' && skill.description !== '' ? skill.description : ''
            const source = sourceLabel(skill.path)
            const isRecent = recent.includes(skill.name)
            const rowStyle = index === active ? { ...styles.row, ...styles.rowActive } : styles.row
            const tooltip = [skill.path, skill.description].filter((part) => part !== '').join('\n')
            return React.createElement(
              'li',
              { key: skill.name },
              React.createElement(
                'button',
                {
                  type: 'button',
                  ref: (element) => {
                    rowRefs.current[index] = element
                  },
                  style: rowStyle,
                  title: tooltip,
                  'data-skill-active': index === active ? 'true' : undefined,
                  onClick: () => copy(skill.name),
                  onMouseEnter: () => setActive(index),
                },
                React.createElement(
                  'div',
                  { style: styles.rowHead },
                  React.createElement('span', { style: styles.name, children: skill.name }),
                  isRecent ? React.createElement('span', { style: styles.tagRecent, children: translate(t, 'panel.recent') }) : null,
                  skill.userInvocable ? null : React.createElement('span', { style: styles.tag, children: 'model' }),
                  skill.modelInvocable
                    ? null
                    : React.createElement('span', { style: styles.tag, children: translate(t, 'panel.userOnly') }),
                ),
                primary === ''
                  ? null
                  : React.createElement('div', { style: styles.summary, children: primary }),
                source === '' && secondary === ''
                  ? null
                  : React.createElement('div', {
                      style: styles.meta,
                      children: [source, secondary].filter((part) => part !== '').join(' · '),
                    }),
              ),
            )
          }),
        )
      }

      const panel =
        open && anchor !== null
          ? React.createElement(
              'div',
              {
                style: {
                  ...styles.panel,
                  position: 'fixed',
                  left: `${anchor.left}px`,
                  bottom: `${anchor.bottom}px`,
                  width: `${anchor.width}px`,
                  maxHeight: 'min(560px, calc(100vh - 96px))',
                },
                role: 'dialog',
                'aria-label': translate(t, 'panel.title'),
              },
              React.createElement(
                'div',
                { style: styles.head },
                React.createElement('h2', { style: styles.title, children: translate(t, 'panel.title') }),
                skills.length > 0
                  ? React.createElement('span', {
                      style: styles.count,
                      children: translate(t, 'panel.count', { count: skills.length }),
                    })
                  : null,
                React.createElement('button', {
                  type: 'button',
                  style: styles.iconButton,
                  title: translate(t, 'panel.refresh'),
                  'aria-label': translate(t, 'panel.refresh'),
                  onClick: () => {
                    if (sessionId !== undefined) loadSkills(sessionId)
                  },
                  children: '↻',
                }),
                React.createElement('button', {
                  type: 'button',
                  style: styles.iconButton,
                  title: translate(t, 'panel.close'),
                  'aria-label': translate(t, 'panel.close'),
                  onClick: () => setOpen(false),
                  children: '✕',
                }),
              ),
              React.createElement(
                'div',
                { style: styles.searchRow },
                React.createElement('input', {
                  ref: inputRef,
                  type: 'search',
                  value: query,
                  placeholder: translate(t, 'panel.search'),
                  style: styles.search,
                  onChange: (event) => setQuery(event.target.value),
                }),
              ),
              React.createElement('div', { style: styles.body }, renderBody()),
              React.createElement(
                'div',
                { style: styles.foot },
                React.createElement('span', {
                  style: copied !== null ? { ...styles.footHint, ...styles.copied } : styles.footHint,
                  children:
                    copied !== null
                      ? translate(t, 'panel.copied', { command: `/${copied}` })
                      : translate(t, 'panel.hint'),
                }),
                copied === null && skills.length > 0 && zhCount < skills.length
                  ? React.createElement('span', {
                      style: styles.footHint,
                      title: translate(t, 'panel.noZh', { count: skills.length - zhCount }),
                      children: `${zhCount}/${skills.length}`,
                    })
                  : null,
              ),
            )
          : null

      return React.createElement(
        'div',
        { ref: rootRef, style: styles.wrap },
        React.createElement(
          'button',
          {
            ref: buttonRef,
            type: 'button',
            style: open
              ? { ...(wide ? styles.button : styles.buttonRail), ...styles.buttonOpen }
              : wide
                ? styles.button
                : styles.buttonRail,
            title: translate(t, 'button.title'),
            'aria-label': translate(t, 'button.title'),
            'aria-expanded': open,
            onClick: () => setOpen((current) => !current),
          },
          React.createElement(SkillIcon, { size: wide ? 16 : 18 }),
          wide ? React.createElement('span', { style: styles.buttonLabel, children: label }) : null,
          skills.length > 0 ? React.createElement('span', { style: styles.badge, children: skills.length }) : null,
        ),
        panel,
      )
    }

    /**
     * 前端半需要的客户端服务。
     *
     * `remote` 与 `remote.skills` 必须**同时**声明：Cordis 只把 `inject` 里
     * 列出的名字注入 `ctx`，`ctx.remote` 是根服务、`ctx.remote.skills` 只是
     * 它下面的子路径。只写 `remote.skills` 时读 `ctx.remote` 会抛
     * `cannot get property "remote" without inject`。
     */
    const inject = ['slots', 'locale', 'sessions', 'remote', 'remote.skills']

    /**
     * 装载插件：语言字典、一份目录 + 中文词典的缓存，以及侧边栏底部的那枚按钮。
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-skill-panel: dictionaries')

      const store = createStore({
        status: 'idle',
        sessionId: undefined,
        skills: [],
        dictionary: {},
        error: undefined,
      })
      let token = 0

      const loadSkills = (sessionId) => {
        const previous = store.getSnapshot()
        // 同一个会话的请求还在飞就别再发一份。
        if (previous.status === 'loading' && previous.sessionId === sessionId) return
        const current = ++token
        store.set({
          status: 'loading',
          sessionId,
          skills: previous.sessionId === sessionId ? previous.skills : [],
          dictionary: previous.dictionary,
          error: undefined,
        })
        Promise.all([readCatalog(ctx, sessionId), readDictionary()]).then(
          ([skills, dictionary]) => {
            if (current !== token) return
            store.set({ status: 'ready', sessionId, skills, dictionary, error: undefined })
          },
          (error) => {
            if (current !== token) return
            const message =
              error !== null && error !== undefined && typeof error.message === 'string' ? error.message : String(error)
            store.set({ status: 'error', sessionId, skills: [], dictionary: previous.dictionary, error: message })
          },
        )
      }

      ctx.slots.inject('sidebar.footer.action', () =>
        ctx.slots.register(
          {
            name: 'sidebar.footer.action',
            id: 'skill-panel',
            order: 60,
            locale: NS,
            inject: () => ({
              hooks: { sessionList: ctx.sessions.list, skillsCatalog: store },
              loadSkills,
            }),
          },
          SkillPanel,
        ),
      )
    }

    return { name: 'dsh-skill-panel', apply, inject }
  },
})
