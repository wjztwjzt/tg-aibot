require('dotenv').config();
const { Telegraf } = require('telegraf');
const {
  chats,
  getChat,
  pushMessage,
  markBotReplied,
  markIdlePrompted,
} = require('./contextStore');
const { decideTrigger } = require('./trigger');
const { decideAndReply } = require('./ai');
const { DEFAULT_PERSONA } = require('./persona');

const bot = new Telegraf(process.env.BOT_TOKEN);
let botUsername = null;

const IDLE_THRESHOLD_MS = parseInt(process.env.IDLE_THRESHOLD_MINUTES || '20', 10) * 60 * 1000;
const IDLE_COOLDOWN_MS = parseInt(process.env.IDLE_COOLDOWN_MINUTES || '60', 10) * 60 * 1000;
const IDLE_CHECK_INTERVAL_MS = 60 * 1000;

function getManualAdminIds() {
  return (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

async function isAdmin(ctx) {
  const fromId = ctx.from?.id?.toString();
  const manualAdminIds = getManualAdminIds();

  if (fromId && manualAdminIds.includes(fromId)) return true;

  // Telegram 群开启“匿名管理员”时，消息来源会变成群本身，ctx.from 不再是真实管理员账号。
  // 这种情况下 sender_chat.id 等于当前 chat.id，可以视为管理员操作。
  if (ctx.message?.sender_chat?.id && ctx.message.sender_chat.id === ctx.chat.id) {
    return true;
  }

  if (!fromId || !ctx.chat?.id || ctx.chat.type === 'private') return false;

  try {
    const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    if (['administrator', 'creator'].includes(member.status)) return true;
  } catch (e) {
    console.error('检查管理员身份失败:', e.message);
  }

  try {
    const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
    return admins.some((admin) => admin.user?.id?.toString() === fromId);
  } catch (e) {
    console.error('获取管理员列表失败:', e.message);
    return false;
  }
}

// ---- 管理员指令 ----

bot.command('my_id', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return ctx.reply('没有获取到你的用户 ID');
  ctx.reply(`你的 Telegram 用户 ID 是：${userId}\n如果管理员判断失效，可以把它填进 .env 的 ADMIN_USER_IDS`);
});

bot.command('ai_on', async (ctx) => {
  if (!(await isAdmin(ctx))) return ctx.reply('只有管理员可以操作');
  getChat(ctx.chat.id).aiEnabled = true;
  ctx.reply('已开启 AI 互动');
});

bot.command('ai_off', async (ctx) => {
  if (!(await isAdmin(ctx))) return ctx.reply('只有管理员可以操作');
  getChat(ctx.chat.id).aiEnabled = false;
  ctx.reply('已关闭 AI 互动');
});

bot.command('ai_chance', async (ctx) => {
  if (!(await isAdmin(ctx))) return ctx.reply('只有管理员可以操作');
  const arg = ctx.message.text.split(' ')[1];
  const val = parseFloat(arg);
  if (Number.isNaN(val) || val < 0 || val > 1) {
    return ctx.reply('用法: /ai_chance 0.05  (范围 0-1，代表随机插话概率)');
  }
  getChat(ctx.chat.id).randomChance = val;
  ctx.reply(`随机插话概率已设置为 ${val}`);
});

bot.command('ai_status', async (ctx) => {
  const s = getChat(ctx.chat.id);
  ctx.reply(
    `AI互动: ${s.aiEnabled ? '开启' : '关闭'}\n随机插话概率: ${s.randomChance}\n当前缓存消息数: ${s.messages.length}`
  );
});

// ---- 普通消息处理 ----

bot.on('message', async (ctx) => {
  if (!ctx.message.text) return; // 暂不处理图片/贴纸等
  if (ctx.message.text.startsWith('/')) return;

  const chatId = ctx.chat.id;

  pushMessage(chatId, {
    user: ctx.from.username || ctx.from.first_name || '某人',
    text: ctx.message.text,
    ts: Date.now(),
    fromBot: false,
  });

  const trigger = decideTrigger(ctx, botUsername);
  if (!trigger) return;

  try {
    await ctx.sendChatAction('typing');
    const state = getChat(chatId);

    const { shouldReply, reply } = await decideAndReply({
      persona: process.env.PERSONA_PROMPT || DEFAULT_PERSONA,
      messages: state.messages,
      mode: trigger,
    });

    if (shouldReply && reply) {
      // 模拟打字延迟，不要瞬间秒回，显得更自然
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
      await ctx.reply(reply);
      pushMessage(chatId, { user: '[你]', text: reply, ts: Date.now(), fromBot: true });
      markBotReplied(chatId);
    }
  } catch (e) {
    console.error('AI 回复失败:', e.message);
  }
});

// ---- 冷场复活检测 ----

setInterval(async () => {
  const now = Date.now();
  for (const [chatId, state] of chats.entries()) {
    if (!state.aiEnabled) continue;
    if (state.messages.length === 0) continue;

    const lastMsg = state.messages[state.messages.length - 1];
    const idleFor = now - lastMsg.ts;
    const sinceLastIdlePrompt = now - state.lastIdlePromptAt;

    if (idleFor > IDLE_THRESHOLD_MS && sinceLastIdlePrompt > IDLE_COOLDOWN_MS) {
      try {
        const { shouldReply, reply } = await decideAndReply({
          persona: process.env.PERSONA_PROMPT || DEFAULT_PERSONA,
          messages: state.messages,
          mode: 'idle',
        });

        markIdlePrompted(chatId);

        if (shouldReply && reply) {
          await bot.telegram.sendMessage(chatId, reply);
          pushMessage(chatId, { user: '[你]', text: reply, ts: Date.now(), fromBot: true });
          markBotReplied(chatId);
        }
      } catch (e) {
        console.error('冷场检测失败:', e.message);
      }
    }
  }
}, IDLE_CHECK_INTERVAL_MS);

// ---- 启动 ----

bot
  .launch()
  .then(async () => {
    const me = await bot.telegram.getMe();
    botUsername = me.username;
    console.log(`机器人已启动: @${botUsername}`);
  })
  .catch((e) => {
    console.error('启动失败:', e.message);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
