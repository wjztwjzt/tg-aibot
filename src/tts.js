const { spawn } = require('child_process');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '9lHjugDhwqoxA5MhX0az';
const ELEVENLABS_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';

async function textToSpeech(text) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('缺少 ELEVENLABS_API_KEY');
  }

  const resp = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL,
        voice_settings: {
          stability: parseFloat(process.env.ELEVENLABS_STABILITY || '0.5'),
          similarity_boost: parseFloat(process.env.ELEVENLABS_SIMILARITY || '0.75'),
        },
      }),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`ElevenLabs error ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const mp3Buffer = Buffer.from(await resp.arrayBuffer());
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
