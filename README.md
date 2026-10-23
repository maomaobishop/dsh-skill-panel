# dsh-skill-panel

A **Skills** button for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) sidebar: one click lists every skill the current session can use, with its description and where it comes from. Click a row to copy its `/name` invocation into the composer.

[中文说明](#中文说明)

```
侧边栏底部  [📖 技能 12]  →  浮层：搜索 / 列表 / 点一行复制 /ppt-master
```

- Reads the official `skills/list` Remote, so the list is exactly what typing `/` in the composer would offer.
- Project `.dsh/skills`, user `~/.dsh/skills`, `~/.agents/skills`, and plugin-bundled skills all show up.
- Search filter, refresh, `Esc` / click-outside to close, light/dark via `--dsw-alias-*` theme tokens.
- No build step: the client half is a hand-written lazy-CJS bundle, same shape as the shipped ones.

## Install

```powershell
git clone https://github.com/maomaobishop/dsh-skill-panel.git
cd dsh-skill-panel
.\install.ps1                 # desktop profile; -Profile web for the web profile
```

`install.ps1` copies the package into `<profile>\plugins\`, links it into `<profile>\node_modules\`, and registers it in the profile's `package.json` (`dependencies` + `dsh.profile.bundles`). **Restart DeepSeek Harness** afterwards — `bundles` is a boot-time composition.

To remove it again: `.\uninstall.ps1`.

## How it works

| Half | File | Role |
|---|---|---|
| Host | `lib/index.js` | Occupies one Loader row so the Web composition serves the client bundle |
| Client | `lib/client.js` | Renders the button in the `sidebar.footer.action` slot and the popover above it |

Data comes from `ctx.remote.skills.list({ sessionId })`. The session id is the one whose `retainedBy.mainView > 0` — the footer slot is frame-level, so it has no session scope of its own.

## Tests

```powershell
npm install
npm test
```

`test/render.mjs` renders the button with `react-dom/server`; `test/interact.mjs` drives open → filter → copy → escape in jsdom; `test/storm.mjs` / `test/storm2.mjs` are regression cases for the retry-storm bug described below (a failed `skills/list` must never turn into a request loop).

## License

MIT

---

# 中文说明

## 它解决什么

DSH 里调用 skill 要在输入框敲 `/` 再选。这个插件把同一份目录搬到侧边栏：底部一枚「技能」按钮，点开就是当前会话可见的全部 skill，带描述和来源；点一行把 `/名称` 复制到剪贴板，粘贴即可调用。

数据走官方 `skills/list` Remote，所以和 `/` 菜单看到的是同一份目录——项目 `.dsh/skills`、用户 `~/.dsh/skills`、`~/.agents/skills`、插件自带的 skill 都在里面。

## 安装

```powershell
git clone https://github.com/maomaobishop/dsh-skill-panel.git
cd dsh-skill-panel
.\install.ps1              # 默认装进 desktop profile
.\install.ps1 -Profile web # 或 web profile
```

脚本只做三件事：复制到 `<profile>\plugins\`、在 `<profile>\node_modules\` 建 junction、在 profile 的 `package.json` 里登记 `dependencies` 与 `dsh.profile.bundles`。改完**重启 DSH**（bundles 是启动期组合）。

卸载：`.\uninstall.ps1`（会解链接、删副本、从 `package.json` 摘掉登记）。

## 结构

| 半 | 文件 | 作用 |
|---|---|---|
| Host | `lib/index.js` | 只占一条 Loader row，让 Web 组合把这个包当作已装载插件 |
| Client | `lib/client.js` | `sidebar.footer.action` 插槽里的按钮 + 向上弹出的浮层 |

- 全部颜色取自 `--dsw-alias-*` 主题 token，深浅色自动跟随。
- 每条 skill 的 `SKILL.md` 路径压成短来源标签（`.dsh/skills` / `.agents/skills` / `plugin`），完整路径在 hover 的 `title` 里。
- `modelInvocable: false` 的条目带「仅用户」标记。
- 客户端是手写的 lazy-CJS 工厂（`window.__ModuleLoader__.load({ id, factory })`），格式与官方发布的 client bundle 一致：外层只注册工厂，模块体在首次物化时才执行，**不需要构建步骤**。

## 测试

```powershell
npm install
npm test
```

- `test/render.mjs`：用 `react-dom/server` 渲染按钮
- `test/interact.mjs`：jsdom 里跑「打开 → 3 行 → 搜索过滤 → 点行复制 → Esc 关闭」
- `test/storm.mjs` / `test/storm2.mjs`：失败路径回归，断言一次点击只产生 1–2 次请求且不自我重试

## 排错记录（都是真踩过的坑）

### 0.1.1 点开面板把界面卡死

把 `catalog` 放进了加载 effect 的依赖数组。store 每次写入都是新对象，失败时状态落回「未就绪」，于是 `失败 → 依赖变化 → 再请求 → 再失败` 变成同步微任务死循环，渲染进程被占满，整个窗口卡死。

修法：加载 effect 不再依赖 `catalog`，改用 `requestedRef`——每次打开最多自动请求一次，关闭时清空；失败只留面板里的「重试」；`loadSkills` 对同一会话的在飞请求去重。

### 0.1.2 面板显示 `cannot get property "remote" without inject`

`inject` 里只写了子路径 `remote.skills`，但代码读的是根服务 `ctx.remote`。Cordis 只注入 `inject` 里列出的名字，根服务没声明就会抛这句。

修法：两层都写上（与官方 `ui-skill` 一致）：

```js
const inject = ['slots', 'locale', 'sessions', 'remote', 'remote.skills']
```

**规则**：访问 `ctx.<根>.<子>` 时，`inject` 里必须同时有 `<根>` 和 `<根>.<子>`。

### 另外两条硬规则

1. 客户端 bundle 的 `id` 必须与包名（Loader row id）完全一致，否则 client-modules 会退回单资源 URL 再执行一次，变成重复注册、web boot 失败。
2. 改了客户端代码要**重启 DSH**：bundle 内容是宿主启动时快照进模块图的，`Ctrl+R` 刷页面拿到的还是旧快照。

## 许可

MIT
