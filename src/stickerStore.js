const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'stickers.json');

let cache = null;

function ensureLoaded() {
  if (cache) return;

  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    cache = JSON.parse(raw);
  } catch (e) {
    cache = { chats: {} };
  }
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(cache, null, 2));
}

function getChatStickerIds(chatId) {
  ensureLoaded();
  return cache.chats[String(chatId)] || [];
}

function addChatSticker(chatId, stickerId) {
  ensureLoaded();
  const key = String(chatId);
  const stickers = cache.chats[key] || [];
  if (!stickers.includes(stickerId)) stickers.push(stickerId);
  cache.chats[key] = stickers;
  save();
  return stickers;
}

function clearChatStickers(chatId) {
  ensureLoaded();
  cache.chats[String(chatId)] = [];
  save();
}

module.exports = {
  getChatStickerIds,
  addChatSticker,
  clearChatStickers,
};
