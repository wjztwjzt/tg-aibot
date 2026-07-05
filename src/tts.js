const crypto = require('crypto');
const { spawn } = require('child_process');

const TENCENT_SECRET_ID = process.env.TENCENT_SECRET_ID || '';
const TENCENT_SECRET_KEY = process.env.TENCENT_SECRET_KEY || '';
const TTS_VOICE_TYPE = process.env.TTS_VOICE_TYPE || '502001'; // 智小柔

function sign(secretId, secretKey, timestamp, payload) {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const service = 'tts';
  const host = 'tts.tencentcloudapi.com';
  const algorithm = 'TC3-HMAC-SHA256';
  const httpMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQueryString = '';

  const contentType = 'application/json; charset=utf-8';
  const signedHeaders = 'content-type;host';
  const hashedPayload = crypto.createHash('sha256').update(payload).digest('hex');

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
  const canonicalRequest = [
    httpMethod,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join('\n');

  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = [algorithm, timestamp, credentialScope, hashedCanonicalRequest].join('\n');

  const kDate = crypto.createHmac('sha256', `TC3${secretKey}`).update(date).digest();
  const kService = crypto.createHmac('sha256', kDate).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('tc3_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  return `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

async function textToSpeech(text) {
  if (!TENCENT_SECRET_ID || !TENCENT_SECRET_KEY) {
    throw new Error('缺少 TENCENT_SECRET_ID / TENCENT_SECRET_KEY');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const payload = JSON.stringify({
    Text: text,
    SessionId: sessionId,
    VoiceType: parseInt(TTS_VOICE_TYPE, 10),
    Codec: 'mp3',
    SampleRate: 16000,
    Speed: parseFloat(process.env.TTS_SPEED || '0'),
    Volume: parseFloat(process.env.TTS_VOLUME || '0'),
    PrimaryLanguage: 1,
  });

  const authorization = sign(TENCENT_SECRET_ID, TENCENT_SECRET_KEY, timestamp, payload);

  const resp = await fetch('https://tts.tencentcloudapi.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Host': 'tts.tencentcloudapi.com',
      'X-TC-Action': 'TextToVoice',
      'X-TC-Version': '2019-08-23',
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Region': 'ap-guangzhou',
      'Authorization': authorization,
    },
    body: payload,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`腾讯云TTS HTTP ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  if (data.Response.Error) {
    throw new Error(`腾讯云TTS error ${data.Response.Error.Code}: ${data.Response.Error.Message}`);
  }

  const audioBase64 = data.Response.Audio;
  if (!audioBase64) {
    throw new Error('腾讯云TTS 返回空音频');
  }

  const mp3Buffer = Buffer.from(audioBase64, 'base64');
  return mp3ToOgg(mp3Buffer);
}

function mp3ToOgg(mp3Buffer) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', 'pipe:0',
      '-c:a', 'libopus',
      '-b:a', '32k',
      '-vbr', 'on',
      '-compression_level', '10',
      '-frame_duration', '60',
      '-application', 'voip',
      '-f', 'ogg',
      'pipe:1',
    ]);
    const chunks = [];
    ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
    ffmpeg.stderr.on('data', () => {});
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
    ffmpeg.on('error', reject);
    ffmpeg.stdin.write(mp3Buffer);
    ffmpeg.stdin.end();
  });
}

module.exports = { textToSpeech };
