const { spawn } = require('child_process');
const { EdgeTTS } = require('node-edge-tts');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function textToSpeech(text) {
  const tts = new EdgeTTS({
    voice: process.env.TTS_VOICE || 'zh-CN-XiaoxiaoNeural',
    rate: process.env.TTS_RATE || 'default',
    pitch: process.env.TTS_PITCH || 'default',
    timeout: 15000,
  });

  const tmpDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, `.tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);

  try {
    await tts.ttsPromise(text, tmpFile);
    const mp3Buffer = fs.readFileSync(tmpFile);
    return mp3ToOgg(mp3Buffer);
  } catch (e) {
    throw new Error(typeof e === 'string' ? e : (e.message || String(e)));
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore */ }
  }
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
