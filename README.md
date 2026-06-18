# Telegram 群组 AI 气氛活跃机器人

一个可以放进 Telegram 群里的 AI 气氛机器人。它会根据群聊上下文偶尔接话、被 @ 时回复、冷场时主动抛话题。

项目基于 Telegraf + OpenAI 兼容格式的 AI 接口，支持 Groq、OpenAI、各种中转站。默认使用长轮询模式，不需要域名、不需要 SSL、不需要开放任何端口。

---

## 服务器配置要求

这个项目不在服务器本地跑大模型，只是接收 Telegram 消息，然后请求 AI 接口，所以配置要求很低。

### 最低配置

| 项目 | 最低要求 |
| --- | --- |
| CPU | 1 核 |
| 内存 | 512MB |
| 硬盘 | 5GB |
| 系统 | Ubuntu / Debian |
| 网络 | 能访问 Telegram 和你的 AI 中转站 |

### 推荐配置

| 项目 | 推荐 |
| --- | --- |
| CPU | 1 核 |
| 内存 | 1GB |
| 硬盘 | 10GB |
| 系统 | Ubuntu 22.04 / Debian 12 |

**1C1G + 10G 硬盘完全够用。**

如果你的服务器还要同时跑宝塔、Nginx、数据库、其他机器人，建议用 2G 内存会更稳。

---

## 一、创建 Telegram 机器人

1. 打开 Telegram，搜索 `@BotFather`。
2. 给 `@BotFather` 发送：

   ```text
   /newbot
   ```

3. 按提示设置机器人名称和用户名。
4. 创建完成后，BotFather 会给你一个 `BOT_TOKEN`，格式大概像这样：

   ```text
   123456789:AAxxxxxx_xxxxxxxxxxxxxxxxx
   ```

   这个后面要填进 `.env` 文件。

5. 继续给 `@BotFather` 发送：

   ```text
   /setprivacy
   ```

6. 选择你的机器人，然后选择：

   ```text
   Disable
   ```

这一步非常重要。只有关闭 privacy mode，机器人才能看到群里的普通消息。

如果机器人已经在群里了，改完 privacy 后，建议把机器人从群里踢出，再重新拉进群，否则可能不生效。

---

## 二、准备 AI 接口

本项目支持 OpenAI 兼容格式接口。一般中转站都会提供这三项：

| 配置项 | 说明 | 示例 |
| --- | --- | --- |
| `AI_BASE_URL` | 接口基础地址 | `https://api.example.com/v1` |
| `AI_API_KEY` | API Key | `sk-xxxxxx` |
| `AI_MODEL` | 模型名 | `gpt-4o-mini` |

如果你的中转站给的是完整接口地址，例如：

```text
https://api.example.com/v1/chat/completions
```

也可以直接填 `AI_API_URL`。

通常情况下，只需要填 `AI_BASE_URL`，不用填 `AI_API_URL`。

---

## 三、服务器安装 Docker

先登录你的服务器，然后执行下面命令安装 Docker：

```bash
curl -sSL https://get.docker.com | bash
systemctl enable --now docker
```

再安装 `git`，后面下载项目要用：

```bash
apt update
apt install -y git
```

检查 Docker 是否安装成功：

```bash
docker --version
docker compose version
```

能看到版本号就说明成功。

如果 `docker compose version` 有版本号，后面就使用：

```bash
docker compose up -d --build
```

如果你的系统只支持老版 `docker-compose`，则需要把后面的命令改成：

```bash
docker-compose up -d --build
```

说明：`https://get.docker.com` 是 Docker 官方提供的便捷安装脚本，适合大多数 Ubuntu / Debian / CentOS 服务器。

---

## 四、下载项目

在服务器执行：

```bash
git clone https://github.com/sanrokamlan-prog/tg-aibot.git
cd tg-aibot
```

---

## 五、配置环境变量

复制配置文件：

```bash
cp .env.example .env
```

编辑配置：

```bash
nano .env
```

至少需要填写下面几项：

```env
BOT_TOKEN=你的Telegram机器人Token

AI_BASE_URL=https://你的中转站地址/v1
AI_API_KEY=你的中转站APIKey
AI_MODEL=你的模型名
```

例如：

```env
BOT_TOKEN=123456789:AAxxxxxx_xxxxxxxxxxxxxxxxx

AI_BASE_URL=https://api.example.com/v1
AI_API_KEY=sk-xxxxxxxxxxxxxxxx
AI_MODEL=gpt-4o-mini
```

如果你的中转站给的是完整接口地址，可以这样写：

```env
BOT_TOKEN=123456789:AAxxxxxx_xxxxxxxxxxxxxxxxx

AI_API_URL=https://api.example.com/v1/chat/completions
AI_API_KEY=sk-xxxxxxxxxxxxxxxx
AI_MODEL=gpt-4o-mini
```

编辑完成后：

- `nano` 保存：按 `Ctrl + O`，回车
- 退出：按 `Ctrl + X`

---

## 六、推荐新手先用的参数

为了避免机器人太吵，也为了省中转站额度，建议一开始这样配置：

```env
RANDOM_REPLY_CHANCE=0.02
MIN_REPLY_INTERVAL_SECONDS=180
MIN_MSGS_BETWEEN_REPLIES=5
IDLE_THRESHOLD_MINUTES=30
IDLE_COOLDOWN_MINUTES=120
MAX_HISTORY=25
```

含义简单解释：

| 配置项 | 说明 |
| --- | --- |
| `RANDOM_REPLY_CHANCE` | 普通聊天时随机插话概率，越大越活跃 |
| `MIN_REPLY_INTERVAL_SECONDS` | 两次主动发言最少间隔多少秒 |
| `MIN_MSGS_BETWEEN_REPLIES` | 距离上次发言至少过多少条群消息才会再次插话 |
| `IDLE_THRESHOLD_MINUTES` | 群里安静多久后尝试主动抛话题 |
| `IDLE_COOLDOWN_MINUTES` | 两次冷场发言之间的最少间隔 |
| `MAX_HISTORY` | 每个群最多保留多少条历史消息作为上下文 |

如果觉得机器人太安静，可以慢慢把 `RANDOM_REPLY_CHANCE` 调高，比如：

```env
RANDOM_REPLY_CHANCE=0.05
```

不建议一开始设置太高，比如 `0.2`、`0.5`，容易刷屏，也更费额度。

---

## 七、启动机器人

在项目目录里执行：

```bash
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f
```

如果看到类似下面的内容，说明启动成功：

```text
机器人已启动: @你的机器人用户名
```

然后把机器人拉进 Telegram 群，就可以使用了。

---

## 八、常用管理命令

这些命令在群里发送。`/my_id` 所有人都可以用，其它管理命令只有群管理员或 `ADMIN_USER_IDS` 白名单用户可以操作：

```text
/my_id
```

查看自己的 Telegram 用户 ID。如果机器人一直提示“只有管理员可以操作”，可以把这个 ID 填进 `.env` 的 `ADMIN_USER_IDS`。

```text
/ai_on
```

开启当前群的 AI 互动。

```text
/ai_off
```

关闭当前群的 AI 互动。机器人还在群里，但不会主动说话。

```text
/ai_chance 0.05
```

调整随机插话概率。数字范围是 `0` 到 `1`。

例如：

- `0.01`：很少说话
- `0.05`：适中
- `0.1`：比较活跃
- `0.3`：很吵，不建议

```text
/ai_status
```

查看当前群的 AI 状态。

---

## 九、更新项目

如果后面仓库有更新，在服务器项目目录执行：

```bash
git pull
docker compose up -d --build
```

---

## 十、停止和重启

停止机器人：

```bash
docker compose down
```

重启机器人：

```bash
docker compose restart
```

查看日志：

```bash
docker compose logs -f
```

---

## 十一、常见问题

### 1. 日志显示机器人启动失败

先检查 `.env` 里的 `BOT_TOKEN` 是否正确。

```bash
nano .env
```

常见错误：

- Token 前后多了空格
- Token 复制不完整
- 填成了 BotFather 里的机器人用户名，而不是 token

### 2. 机器人进群后不看普通消息

检查 BotFather 的 privacy mode 是否关闭：

```text
/setprivacy
```

选择机器人后设置为：

```text
Disable
```

如果之前已经把机器人拉进群，关闭 privacy 后需要把机器人踢出群，再重新拉进群。

### 3. 管理员发送 `/ai_on` 仍提示“只有管理员可以操作”

先在群里发送：

```text
/my_id
```

机器人会回复你的 Telegram 用户 ID。

然后编辑 `.env`：

```bash
nano .env
```

把你的用户 ID 填进去：

```env
ADMIN_USER_IDS=123456789
```

如果有多个管理员，使用英文逗号分隔：

```env
ADMIN_USER_IDS=123456789,987654321
```

保存后重启：

```bash
docker compose restart
```

再回群里发送：

```text
/ai_on
```

### 4. 被 @ 也不回复

查看日志：

```bash
docker compose logs -f
```

如果日志里出现 AI API 报错，通常是这些原因：

- `AI_BASE_URL` 写错
- `AI_API_KEY` 写错
- `AI_MODEL` 模型名不对
- 中转站余额不足
- 中转站接口暂时不可用

### 5. 日志里出现 401 / 403

一般是 API Key 错误，或者中转站没有权限使用这个模型。

检查：

```env
AI_API_KEY=
AI_MODEL=
```

### 6. 日志里出现 429

一般是请求太频繁或额度不够。

可以把参数调低：

```env
RANDOM_REPLY_CHANCE=0.01
MIN_REPLY_INTERVAL_SECONDS=300
MIN_MSGS_BETWEEN_REPLIES=8
MAX_HISTORY=20
```

然后重启：

```bash
docker compose restart
```

### 7. 怎么确认容器还在运行

```bash
docker ps
```

能看到 `tg-ai-bot` 就说明容器还在。

---

## 十二、安全注意事项

- 不要把 `.env` 发给别人。
- 不要把 `.env` 上传到 GitHub。
- 如果 `BOT_TOKEN` 泄露，去 `@BotFather` 使用 `/revoke` 重新生成。
- 如果 `AI_API_KEY` 泄露，去中转站后台删除旧 key，重新创建。
- 群聊天内容会发送给你的 AI 接口或中转站，建议在群公告里说明有 AI 机器人在场。

---

## 十三、工作原理简述

机器人会把每个群最近的若干条文字消息缓存在内存里，作为上下文发给模型。

触发方式有三种：

1. 群友 @ 机器人，或回复机器人的消息：一定尝试回复。
2. 普通聊天：满足冷却时间、消息间隔和概率条件后，随机插话。
3. 群里冷场：安静一段时间后，主动抛一个话题。

注意：

- 聊天上下文只存在内存里，重启会清空。
- 目前只处理文字消息，不处理图片、贴纸、语音。
- `/ai_off`、`/ai_chance` 这些群配置目前也只存在内存里，重启后会恢复 `.env` 默认值。

---

## 后续可以加的功能

- 按不同群设置不同人设
- 关键词触发固定回复
- 使用 SQLite 持久化群配置和上下文
- 支持图片、贴纸、语音消息
- 增加限流退避，遇到 429 自动降低发言频率
