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

function normalizeSticker(item) {
  if (typeof item === 'string') return { fileId: item, tags: [] };
  return {
    fileId: item.fileId || item.file_id || item.id,
    tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
  };
}

function getChatStickers(chatId) {
  ensureLoaded();
  return (cache.chats[String(chatId)] || []).map(normalizeSticker).filter((item) => item.fileId);
}

function getChatStickerIds(chatId) {
  return getChatStickers(chatId).map((item) => item.fileId);
}

function addChatSticker(chatId, stickerId, tags = []) {
  ensureLoaded();
  const key = String(chatId);
  const stickers = getChatStickers(chatId);
  const cleanTags = tags.map((tag) => String(tag).trim()).filter(Boolean);
  const existing = stickers.find((item) => item.fileId === stickerId);

  if (existing) {
    existing.tags = Array.from(new Set([...existing.tags, ...cleanTags]));
  } else {
    stickers.push({ fileId: stickerId, tags: cleanTags });
  }

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
  getChatStickers,
  getChatStickerIds,
  addChatSticker,
  clearChatStickers,
};
