const { getChat } = require('./contextStore');
const { getChatConfig } = require('./chatConfigStore');

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

function hasKeyword(ctx) {
  const keyword = (process.env.BOT_KEYWORD || '小可').trim();
  if (!keyword) return false;
  const text = ctx.message?.text || '';
  return text.includes(keyword);
}

// 返回 'mention' | 'random' | null
function decideTrigger(ctx, botInfo) {
  const chatId = ctx.chat.id;
  const state = getChat(chatId);
  const config = getChatConfig(chatId);
  if (!state.aiEnabled || !config.aiEnabled) return null;

  if (isMention(ctx, botInfo)) return 'mention';
  if (hasKeyword(ctx)) return 'mention';

  const now = Date.now();
  const cooledDown = now - state.lastBotReplyAt > config.minReplyIntervalSeconds * 1000;
  const enoughGap = state.msgSinceBotReply >= config.minMsgsBetweenReplies;

  if (cooledDown && enoughGap && Math.random() < config.randomChance) {
    return 'random';
  }

  return null;
}

module.exports = { decideTrigger };
