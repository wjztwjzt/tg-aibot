const { getChat } = require('./contextStore');

const MIN_INTERVAL_MS = parseInt(process.env.MIN_REPLY_INTERVAL_SECONDS || '60', 10) * 1000;
const MIN_MSGS_BETWEEN = parseInt(process.env.MIN_MSGS_BETWEEN_REPLIES || '3', 10);

function normalizeUsername(username) {
  return (username || '').replace(/^@/, '').toLowerCase();
}

function isMention(ctx, botInfo) {
  const msg = ctx.message;
  if (!msg) return false;

  const botId = botInfo?.id;
  const botUsername = normalizeUsername(botInfo?.username);
  const text = msg.text || '';
  const lowerText = text.toLowerCase();

  if (msg.reply_to_message?.from) {
    const repliedUser = msg.reply_to_message.from;
    if (botId && repliedUser.id === botId) return true;
    if (botUsername && normalizeUsername(repliedUser.username) === botUsername) return true;
  }

  if (botUsername && lowerText.includes(`@${botUsername}`)) return true;

  for (const entity of msg.entities || []) {
    if (entity.type === 'mention') {
      const mention = text.slice(entity.offset, entity.offset + entity.length);
      if (botUsername && normalizeUsername(mention) === botUsername) return true;
    }
    if (entity.type === 'text_mention' && botId && entity.user?.id === botId) {
      return true;
    }
  }

  return false;
}

// 返回 'mention' | 'random' | null
function decideTrigger(ctx, botInfo) {
  const chatId = ctx.chat.id;
  const state = getChat(chatId);
  if (!state.aiEnabled) return null;

  if (isMention(ctx, botInfo)) return 'mention';

  const now = Date.now();
  const cooledDown = now - state.lastBotReplyAt > MIN_INTERVAL_MS;
  const enoughGap = state.msgSinceBotReply >= MIN_MSGS_BETWEEN;

  if (cooledDown && enoughGap && Math.random() < state.randomChance) {
    return 'random';
  }

  return null;
}

module.exports = { decideTrigger };
