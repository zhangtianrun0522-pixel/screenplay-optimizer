# Progress

## 目标

继续优化剧本优化工作台，并修复本地预览反复卡死的问题。

## 范围

- 节奏检查 API 的提示词、解析与返回结构容错。
- 优化模块面板中的节拍图、筛选、节拍详情与正文定位交互。
- 优化页中节拍临时高亮与正式诊断问题列表的联动。
- 本地 Next 预览启动环境、Node 版本约束和残留进程防护。

## 当前状态

- 节奏 API 已要求模型输出更具体的因果诊断和可执行局部修改方案。
- 节奏结果面板已支持按集筛选、按偏弱指标筛选、点击节拍查看详情。
- 点击节拍可在中栏剧本文本中临时定位对应原文片段，并可通过弹出的方案执行局部 AI 修改。
- 节奏问题卡已可在右侧结果区直接选择推荐方案执行局部 AI 修改。
- 已确认预览卡死的第一层原因是残留 `next dev` 进程叠加 Node 版本混用，而不是业务页面问题。
- 已清理残留 Next 进程与 `.next` 缓存，并加入启动守卫防止同类问题无声复现。
- 已确认 `web/node_modules` 里广泛存在 macOS `com.apple.provenance` 扩展属性，但对其做递归删除后，属性仍会继续出现在抽样文件上，说明它不是当前唯一根因。
- 已在 Node `20.20.2` 下复测 `npm run dev:web`：`--webpack` 启动最终可 `ready` 并监听 `4000`，但首次路由请求仍长时间无响应。
- 已在同样环境下复测 `npm run dev:web:turbopack`：300ms 内 ready，但首页和 `/optimize` 的首次请求同样长期无响应。
- 已移除 `app/layout.tsx` 中的 `next/font/google`，并把全局字体切回系统字体变量；这没有消除首响无响应，说明字体不是唯一根因。
- 2026-05-11：4000 上旧 Next 进程已终止，默认 `npm run dev:web` 已恢复并正常返回 `/optimize`。
- 2026-05-11：新增可配置预览端口和可配置 Next `distDir`，用 `4100 + .next-preview-4100` 避开旧 4000 进程与 `.next/dev/lock`。
- 2026-05-11：移除代码里的硬编码默认 API Key，默认改为读取 `SCRIPT_AGENT_API_KEY`、`OPENAI_API_KEY` 或本地 `data/settings/api-settings.json`。

## 下一步

- 用真实短剧样例跑一次节奏优化，观察模型是否仍返回空泛建议。
- 如果仍不稳定，继续收紧 prompt 示例或增加服务端质量评分与重试。
- 继续优化前，优先使用独立预览命令：`PATH=/opt/homebrew/opt/node@20/bin:$PATH npm run dev:web:preview`，访问 `http://localhost:4100/optimize`。
- 默认 4000 已恢复；后续可继续用 `PATH=/opt/homebrew/opt/node@20/bin:$PATH npm run dev:web` 启动。
- 若仍无明显突破，再考虑在 Node 20 下重装 `web/node_modules` 或把项目复制到干净 ASCII 临时路径做 A/B 对照。

## 风险

- 模型仍可能返回找不到原文的 `textSnippet`，前端会展示节拍详情但无法准确高亮。
- 当前交互是诊断级增强，尚未做节奏模块的整集重排或批量改写工作流。
- 如果绕过 `npm run dev:web` 直接执行 `next dev`，仍可能跳过残留进程与 Node 版本检查。
- `com.apple.provenance` 不是当前唯一根因，直接清理属性没有带来稳定改善。
- 默认 4000 预览已恢复；4100 仍作为备用预览保留。
- 默认 `.next` 缓存清理两次被权限审批超时拦截，但 4000 重新启动与页面验收已经通过。
- 当前启动守卫能拦截 Node 版本、端口占用、同项目残留进程，但还没有对“Next 子进程模块加载阶段无输出卡住”做超时自杀保护。

## 关键决策

- 节拍点击只创建临时正文焦点，不写入正式问题列表，避免把每个节拍都变成待处理 issue。
- report 只做总览，主要可执行建议放入 beats 和 issues。
- 本地预览固定 Node `20.20.2`，`dev:web` 通过 `scripts/safe-next-dev.mjs` 启动并检查单实例。
- 当默认 4000 被旧进程占用时，使用 `dev:web:preview` 在 4100 和 `.next-preview-4100` 下启动，先保证可预览，再择机清理旧进程。
- Next dev 通过启动守卫默认加 `--disable-source-maps`，避免启动前大量读取 Next 自带 `.map` 文件。
- 不再把 `.next` 缓存视为根因；只有在确认 Next 进程完全退出后，才把清 `.next` 当恢复步骤。
- 剩余排查优先处理生成依赖目录的本机元数据，不先改业务代码。

## 验证结果

- `npm run lint -- app/optimize/page.tsx components/OptimizeModulesPanel.tsx app/api/optimize/pacing-check/route.ts lib/safe-parse-json.ts`
- `npx tsc --noEmit`
- `curl -I http://localhost:4000/optimize` 返回 200。
- `PATH=/opt/homebrew/opt/node@20/bin:$PATH npm run dev:web` 可以启动并在约 83 秒后 ready，`4000` 监听正常，但首个页面请求长时间无响应。
- `PATH=/opt/homebrew/opt/node@20/bin:$PATH npm run dev:web:turbopack` 约 300ms ready，但首页和 `/optimize` 首次请求仍无响应。
- 发现并修正：此前节拍临时高亮项无法进入局部 AI 修改；右侧节奏问题卡也没有直接执行方案入口。
- 2026-05-11：清理残留 Next 进程后确认 4000 无监听；新增 Node 版本声明和安全启动脚本。
- 2026-05-11：追加确认 Next 16 dev 会在监听前读取大量 server source maps；启动脚本已默认禁用 source maps。
- 2026-05-11：Node 20 + `--disable-source-maps` 后仍未进入 `ready`，`4000` 无监听；采样显示 Next / ESLint 都卡在读取 `node_modules` 文件。
- 2026-05-11：确认被卡住读取的依赖文件带有 `com.apple.provenance`，且 `node_modules` 中该扩展属性广泛存在；最新挂起的 Next 进程已终止，等待下一轮清理扩展属性后复测。
- 2026-05-11：递归删除 `com.apple.provenance` 后，属性仍会重新出现在抽样文件上；当前更像是本机生成依赖目录与 Next 首次编译路径的组合问题，而不是单一文件属性。
- 2026-05-11：`npm run lint -- lib/server-settings.ts scripts/safe-next-dev.mjs next.config.ts` 通过。
- 2026-05-11：`npx tsc --noEmit` 通过。
- 2026-05-11：`PATH=/opt/homebrew/opt/node@20/bin:$PATH SCRIPT_AGENT_PREVIEW_PORT=4100 SCRIPT_AGENT_NEXT_DIST_DIR=.next-preview-4100 npm run dev:web` ready in 334ms。
- 2026-05-11：`curl -I http://127.0.0.1:4100/` 返回 307 到 `/optimize`；`curl -I http://127.0.0.1:4100/optimize` 返回 200；`/api/settings` 返回脱敏配置。
- 2026-05-11：`kill 30590` 后确认 4000 无监听，4100 备用预览仍在。
- 2026-05-11：`PATH=/opt/homebrew/opt/node@20/bin:$PATH npm run dev:web` 在 4000 ready in 294ms。
- 2026-05-11：`curl -I http://127.0.0.1:4000/` 返回 307 到 `/optimize`；`curl -I http://127.0.0.1:4000/optimize` 返回 200；`/api/settings` 返回脱敏配置。
