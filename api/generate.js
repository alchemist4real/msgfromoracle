// Msg from Oracle — Vercel Serverless Function
// by alchemist4real

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const geminiKeysRaw = process.env.GEMINI_API_KEYS || '';
  const voiceRssKey = (process.env.VOICERSS_API_KEY || '').trim();
  const geminiKeys = geminiKeysRaw.split(',').map(k => k.trim()).filter(Boolean);

  if (geminiKeys.length === 0 || !voiceRssKey) {
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const { type, payload } = req.body;

  // Retry across all available Gemini keys
  async function tryKeys(fn) {
    shuffle(geminiKeys);
    let lastErr;
    for (const key of geminiKeys) {
      try { return await fn(key); }
      catch (e) { lastErr = e; console.warn(`Key ...${key.slice(-4)} failed: ${e.message}`); }
    }
    throw new Error(`All keys exhausted. Last: ${lastErr?.message}`);
  }

  try {
    let result;

    switch (type) {
      case 'text':
        result = await tryKeys(async key => {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
          return r.json();
        });
        break;

      case 'image':
        result = await tryKeys(async key => {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
          return r.json();
        });
        break;

      case 'tts':
        result = await tryKeys(async key => {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
          return r.json();
        });
        break;

      case 'greeting-tts':
        const params = new URLSearchParams({
          key: voiceRssKey,
          src: payload.text,
          hl: 'en-us',
          v: 'John',
          r: '-2',
          c: 'MP3',
          f: '16khz_16bit_stereo'
        });
        result = { url: `https://api.voicerss.org/?${params.toString()}` };
        break;

      default:
        return res.status(400).json({ error: 'Invalid request type.' });
    }

    res.status(200).json(result);

  } catch (err) {
    console.error('Handler error:', err.message);
    res.status(500).json({ error: 'Oracle encountered an error.' });
  }
}
