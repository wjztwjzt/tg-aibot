const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'chat-config.json');

let cache = null;

function ensureLoaded() {
  if (cache) return;

  try {
    cache = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (e) {
    cache = { chats: {} };
  }
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(cache, null, 2));
}

function numEnv(name, defaultValue) {
  const value = Number(process.env[name] || defaultValue);
  return Number.isFinite(value) ? value : defaultValue;
}

function getDefaultConfig() {
  return {
    aiEnabled: true,
    randomChance: numEnv('RANDOM_REPLY_CHANCE', 0.05),
    minReplyIntervalSeconds: numEnv('MIN_REPLY_INTERVAL_SECONDS', 60),
    minMsgsBetweenReplies: numEnv('MIN_MSGS_BETWEEN_REPLIES', 3),
    idleThresholdMinutes: numEnv('IDLE_THRESHOLD_MINUTES', 20),
    idleCooldownMinutes: numEnv('IDLE_COOLDOWN_MINUTES', 60),
    stickerReplyChance: numEnv('STICKER_REPLY_CHANCE', 0.15),
    personaRules: [],
  };
}

function getChatConfig(chatId) {
  ensureLoaded();
  const key = String(chatId);
  return { ...getDefaultConfig(), ...(cache.chats[key] || {}) };
}

function setChatConfig(chatId, patch) {
  ensureLoaded();
  const key = String(chatId);
  cache.chats[key] = { ...(cache.chats[key] || {}), ...patch };
  save();
  return getChatConfig(chatId);
}

module.exports = {
  getChatConfig,
  setChatConfig,
};
