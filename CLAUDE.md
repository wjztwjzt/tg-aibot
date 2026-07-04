# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Telegram 群组 AI 气氛机器人。基于 Telegraf（长轮询模式）+ OpenAI 兼容 API，根据群聊上下文在三种场景下发言：被 @ 一定回复、普通聊天随机插话、冷场时主动抛话题。

## 常用命令

```bash
# 本地启动（需 Node.js >= 18，配好 .env）
npm start

# 交互式配置 .env 文件
npm run setup

# Docker 部署（主要运行方式）
docker compose up -d --build

# 查看日志
docker compose logs -f

# 重启
docker compose restart

# 停止
docker compose down
```

没有测试框架、lint 或构建步骤。

## 架构

### 核心模块

- `src/index.js` — 入口。初始化 Telegraf bot，注册所有 `/` 命令处理器、`message` 事件处理器、冷场检测定时器（每 60 秒轮询）。
- `src/ai.js` — AI API 调用层。支持两种 API 类型：`chat_completions`（`POST /v1/chat/completions`）和 `responses`（`POST /v1/responses`，对应 Codex CLI 的 `wire_api = "responses"`）。构建 prompt → 调用 fetch → 解析 JSON 响应（`should_reply` / `reply` / `sticker` / `sticker_tag`）。
- `src/trigger.js` — 触发决策。判断消息是否 @ 机器人、是否回复机器人消息、是否满足随机插话条件（冷却时间 + 消息间隔 + 概率）。
- `src/contextStore.js` — 内存中的群聊状态（Map<chatId, {messages[], lastBotReplyAt, msgSinceBotReply, ...}>）。消息历史有上限（`MAX_HISTORY`），重启清空。
- `src/chatConfigStore.js` — 持久化群配置（JSON 文件，路径 `DATA_DIR/chat-config.json`）。每群可独立配置随机概率、冷却时间、人设规则等，通过 `/ai_set` 等命令修改后写入磁盘。
- `src/stickerStore.js` — 持久化贴纸池（JSON 文件，路径 `DATA_DIR/stickers.json`）。每群独立的贴纸 + 标签列表。
- `src/persona.js` — 默认人设 prompt。可通过 `.env` 的 `PERSONA_PROMPT` 覆盖，通过 `/persona_add` 追加群级规则。
- `scripts/setup-env.js` — 交互式 `.env` 生成向导。

### 数据流

```
Telegram message → index.js (bot.on('message'))
  → contextStore.pushMessage()       // 缓存消息
  → trigger.decideTrigger()          // 判断是否触发（mention/random/null）
  → ai.decideAndReply()              // 构建 prompt，调用 AI API
  → 发回复 + 可能发贴纸
  → contextStore.markBotReplied()    // 更新冷却计时
```

冷场检测独立于消息流：`setInterval` 每 60 秒遍历所有群，检查最后一条消息距今是否超过阈值。

### 配置优先级

群配置的值 = 磁盘持久化值（`chatConfigStore`）覆盖 `.env` 默认值。`contextStore` 中的 `aiEnabled` 和 `randomChance` 可能与 `chatConfigStore` 不同步——代码在两处都做了更新，但 `trigger.js` 只读 `contextStore`，而命令如 `/ai_set` 写 `chatConfigStore`，重启后 `contextStore` 初始值不反映持久化数据。这是已知的不一致点。

### 关键技术细节

- 使用 Telegraf v4 长轮询模式（非 webhook），不需要公网域名或 SSL。
- AI API 调用使用原生 `fetch()`（Node 18+ 内置），无额外 HTTP 客户端依赖。
- 支持按触发模式（mention/random/idle）使用不同模型（`AI_MODEL` / `AI_MODEL_RANDOM` / `AI_MODEL_IDLE`）。
- 管理员权限判断：先检查 `ADMIN_USER_IDS` 环境变量白名单，再查 Telegram 群管理员列表，同时兼容匿名管理员模式。
- 回复前有 1-3 秒随机延迟，模拟真人打字。
