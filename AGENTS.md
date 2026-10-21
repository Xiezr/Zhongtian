# AGENTS.md — 本项目的工作规则（给 AI 助手看）

> 这些规则是**默认自动执行**的，不需要每轮再问一遍。
> 依据：老板 2026-10-21「定时任务每 15 分钟比较合适吧，基于你目前的一个停顿频率」。

## 一、每轮收尾必做（不问、直接做）

1. 改了 `js/*.js` → `python .workbuddy/tools/patch/build_bundle.py`
2. `node tools/selfcheck.js --fast`（约 1.5 分钟 · 八项）
3. 有改动就提交；**提交命令必须后台跑并重定向到文件**
   （pre-commit 门禁 3~4 分钟，前台 120 秒会被 SIGTERM，`git commit` 直接失败）
4. 追加记忆到 `.workbuddy/memory/YYYY-MM-DD.md`

**判据**：`selfcheck --fast` 全绿才允许说"本轮完成"。
红项必须当场解释清楚——是真问题，还是判据本身写错了（两种情况都要修）。

## 二、为什么是 --fast 而不是全量

全量含 e2e（约 2 分钟），一轮收尾跑不起；e2e 由**提交时的 pre-commit** 自然覆盖。
定时任务每小时跑一次 --fast 兜底（我不在的时间窗），全量留给提交与每天的首次运行。

## 三、定时任务

- `Deepseekdb 每小时自检`（automation）· `FREQ=HOURLY;INTERVAL=1` · 跑 `--fast`。
- 定时任务**只报告不提交**：它没有"这轮改了什么"的上下文，自动提交会把半成品固化。
- 定时任务的最小粒度是 **1 小时**（没有 MINUTELY），所以"每 15 分钟"由**每轮收尾**来覆盖，
  而不是硬凑一个时钟任务。

## 四、已知的坑（写在这里，省得下次再踩）

- **模块清单是四份**：`build_bundle.py ORDER` / `smoke-test.js` 守卫 ORDER /
  `audit.js MODULES` / `audit.js REF_MODULES`。加新模块四份都要加。
- **`data-action` / `data-view` / `data-side` / `data-tab` 是保留属性名**：
  自定义参数属性不要用这四个（audit 会把它们当成"动作"扫描）。
- **改大函数的收尾括号，不要拿 `}` 当 Edit 锚点**——会连带吃掉相邻块的闭合。
- **新模块第一行抄齐** `var GAME / var X / var U = GAME.utils`。
- 自检产物必须落在 `.workbuddy/tmp/`，**不要写进版本库**（否则检查污染工作区）。
