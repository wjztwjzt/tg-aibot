const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

async function askRequired({ question, validate, error }) {
  while (true) {
    const answer = await ask(question);
    if (validate(answer)) return answer;
    console.log(error);
  }
}

async function askOptional({ question, defaultValue = '', validate, error }) {
  while (true) {
    const answer = await ask(defaultValue ? `${question}（默认：${defaultValue}）: ` : `${question}: `);
    const value = answer || defaultValue;
    if (!validate || validate(value)) return value;
    console.log(error);
  }
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch (e) {
    return false;
  }
}

function isIntegerText(value) {
  return /^\d+$/.test(value);
}

function isNumberInRange(value, min, max) {
  if (value === '') return false;
  const num = Number(value);
  return Number.isFinite(num) && num >= min && num <= max;
}

function isCommaSeparatedIds(value) {
  if (!value) return true;
  return value.split(',').every((id) => isIntegerText(id.trim()));
}

function buildEnv(config) {
  return `# 从 @BotFather 获取
BOT_TOKEN=${config.botToken}

# AI 接口配置
# chat_completions：大多数 OpenAI 兼容中转站使用这个
# responses：Codex CLI 里 wire_api = "responses" 时使用这个
AI_API_TYPE=${config.apiType}
AI_BASE_URL=${config.baseUrl}
AI_API_KEY=${config.apiKey}
AI_MODEL=${config.model}
AI_DISABLE_RESPONSE_STORAGE=${config.disableResponseStorage}

# 手动管理员白名单，多个用户 ID 用英文逗号分隔；在群里发送 /my_id 可以查看自己的用户 ID
ADMIN_USER_IDS=${config.adminUserIds}

# 如果你的中转站给的是完整接口地址，也可以不用 AI_BASE_URL，直接填：
# AI_API_URL=https://example.com/v1/chat/completions

# 留空则使用 src/persona.js 中的默认人设
PERSONA_PROMPT=

# 普通消息中随机插话的概率 (0-1)
RANDOM_REPLY_CHANCE=${config.randomReplyChance}

# 两次"主动"发言之间最少间隔多少秒
MIN_REPLY_INTERVAL_SECONDS=${config.minReplyIntervalSeconds}

# 距离上次发言至少要再过多少条群消息才会考虑再次随机插话
MIN_MSGS_BETWEEN_REPLIES=${config.minMsgsBetweenReplies}

# 群里冷场超过多少分钟后考虑主动发话复活气氛
IDLE_THRESHOLD_MINUTES=${config.idleThresholdMinutes}

# 两次冷场复活发言之间最少间隔多少分钟，防止刷屏
IDLE_COOLDOWN_MINUTES=${config.idleCooldownMinutes}

# 每个群最多缓存多少条历史消息作为上下文
MAX_HISTORY=${config.maxHistory}
`;
}

async function main() {
  console.log('Telegram 群组 AI 机器人交互式配置');
  console.log('按提示填写，填错会提示重新输入。\n');

  if (fs.existsSync('.env')) {
    const overwrite = await askOptional({
      question: '检测到当前目录已有 .env，是否覆盖？输入 yes 覆盖，输入 no 退出',
      defaultValue: 'no',
      validate: (value) => ['yes', 'no'].includes(value.toLowerCase()),
      error: '请输入 yes 或 no',
    });

    if (overwrite.toLowerCase() !== 'yes') {
      console.log('已取消，没有修改 .env。');
      rl.close();
      return;
    }
  }

  const botToken = await askRequired({
    question: '请输入 Telegram BOT_TOKEN: ',
    validate: (value) => /^\d+:[A-Za-z0-9_-]{20,}$/.test(value),
    error: 'BOT_TOKEN 格式不对，应该类似 123456789:AAxxxxxxxxxxxxxxxxxxxx，请重新输入。',
  });

  const apiType = await askOptional({
    question: '请选择 API 类型，输入 chat_completions 或 responses',
    defaultValue: 'chat_completions',
    validate: (value) => ['chat_completions', 'responses'].includes(value.toLowerCase()),
    error: '只能输入 chat_completions 或 responses。Codex CLI 配置里 wire_api = "responses" 就选 responses。',
  });

  const baseUrlInput = await askRequired({
    question: '请输入 AI_BASE_URL，例如 https://api.example.com/v1 或 https://openapi.xz.wtf: ',
    validate: isValidUrl,
    error: 'URL 格式不对，必须以 http:// 或 https:// 开头，请重新输入。',
  });

  const apiKey = await askRequired({
    question: '请输入 AI_API_KEY: ',
    validate: (value) => value.length >= 8 && !/\s/.test(value),
    error: 'API Key 看起来不对，至少 8 个字符且不能包含空格，请重新输入。',
  });

  const model = await askRequired({
    question: '请输入 AI_MODEL，例如 gpt-4o-mini / gpt-5.5 / llama-3.3-70b-versatile: ',
    validate: (value) => value.length >= 2 && !/\s/.test(value),
    error: '模型名不能为空，也不能包含空格，请重新输入。',
  });

  const disableResponseStorage = await askOptional({
    question: '是否禁用 Responses API 响应存储？输入 true 或 false',
    defaultValue: 'true',
    validate: (value) => ['true', 'false'].includes(value.toLowerCase()),
    error: '请输入 true 或 false。',
  });

  const adminUserIds = await askOptional({
    question: '请输入管理员 Telegram 用户 ID，多个用英文逗号分隔；不知道可以先留空，启动后在群里发 /my_id 再补',
    defaultValue: '',
    validate: isCommaSeparatedIds,
    error: '管理员 ID 只能是数字，多个 ID 用英文逗号分隔，例如 123456789,987654321。',
  });

  console.log('\n下面是发言频率配置。不懂就直接回车使用默认值。');

  const randomReplyChance = await askOptional({
    question: '随机插话概率，建议 0.02，新手不要超过 0.05',
    defaultValue: '0.02',
    validate: (value) => isNumberInRange(value, 0, 1),
    error: '请输入 0 到 1 之间的数字，例如 0.02。',
  });

  const minReplyIntervalSeconds = await askOptional({
    question: '两次主动发言最少间隔秒数',
    defaultValue: '180',
    validate: (value) => isIntegerText(value) && Number(value) >= 0,
    error: '请输入大于等于 0 的整数。',
  });

  const minMsgsBetweenReplies = await askOptional({
    question: '距离上次发言至少间隔多少条群消息',
    defaultValue: '5',
    validate: (value) => isIntegerText(value) && Number(value) >= 0,
    error: '请输入大于等于 0 的整数。',
  });

  const idleThresholdMinutes = await askOptional({
    question: '群里安静多少分钟后尝试主动抛话题',
    defaultValue: '30',
    validate: (value) => isIntegerText(value) && Number(value) >= 1,
    error: '请输入大于等于 1 的整数。',
  });

  const idleCooldownMinutes = await askOptional({
    question: '两次冷场发言之间最少间隔多少分钟',
    defaultValue: '120',
    validate: (value) => isIntegerText(value) && Number(value) >= 1,
    error: '请输入大于等于 1 的整数。',
  });

  const maxHistory = await askOptional({
    question: '每个群最多缓存多少条历史消息',
    defaultValue: '25',
    validate: (value) => isIntegerText(value) && Number(value) >= 1,
    error: '请输入大于等于 1 的整数。',
  });

  const env = buildEnv({
    botToken,
    apiType: apiType.toLowerCase(),
    baseUrl: normalizeBaseUrl(baseUrlInput),
    apiKey,
    model,
    disableResponseStorage: disableResponseStorage.toLowerCase(),
    adminUserIds,
    randomReplyChance,
    minReplyIntervalSeconds,
    minMsgsBetweenReplies,
    idleThresholdMinutes,
    idleCooldownMinutes,
    maxHistory,
  });

  fs.writeFileSync('.env', env);
  console.log('\n配置完成，已生成 .env。');
  console.log('现在可以执行：');
  console.log('docker compose up -d --build');
}

main()
  .catch((err) => {
    console.error('配置失败:', err.message);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
