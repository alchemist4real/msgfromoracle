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
        try {
          result = await tryKeys(async key => {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
            return r.json();
          });
        } catch (err) {
          console.warn("Text API failed, using fallback:", err.message);
          const fallbacks = [
            { card_name: "Kehampaan yang Tak Terhindarkan", written_interpretation: "Pada akhirnya, segala ambisimu akan memudar menjadi abu. Waktu tidak peduli dengan harapan-harapan kecilmu.", spoken_interpretation: "Sungguh menyedihkan. Kau mengejar angin, namun yang kau dapatkan hanyalah debu." },
            { card_name: "Ilusi Sebuah Tujuan", written_interpretation: "Kau mengira memiliki kendali, namun takdir telah menulis akhir ceritamu. Usahamu hanyalah hiburan kosmis.", spoken_interpretation: "Tidakkah kau lelah? Berpura-pura bahwa pilihanmu memiliki makna di alam semesta yang dingin ini." },
            { card_name: "Gema Kesunyian", written_interpretation: "Dunia tidak akan mengingat namamu. Dan harapan yang kau genggam erat, pada akhirnya akan menjadi beban terberatmu.", spoken_interpretation: "Mengharapkan keajaiban? Betapa naifnya. Oracle hanya melihat bayangan kegagalanmu yang menari." },
            { card_name: "Langkah Menuju Jurang", written_interpretation: "Setiap langkah maju yang kau banggakan, sebenarnya membawamu lebih dekat pada tebing kekecewaan yang tak berdasar.", spoken_interpretation: "Teruslah melangkah, pencari. Jurang sudah menunggumu dengan pelukan dinginnya." },
            { card_name: "Bintang yang Mati", written_interpretation: "Cahaya yang kau ikuti hanyalah pantulan dari masa lalu yang telah lama hancur. Masa depanmu sedingin luar angkasa.", spoken_interpretation: "Cahaya redup di matamu itu... segera, itu pun akan padam ditelan realita." }
          ];
          const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
          result = { candidates: [{ content: { parts: [{ text: JSON.stringify(fallback) }] } }] };
        }
        break;

      case 'image':
        result = await tryKeys(async key => {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
          return r.json();
        });
        break;

      case 'tts':
        try {
          result = await tryKeys(async key => {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${key}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
            return r.json();
          });
        } catch (err) {
          console.warn("TTS API failed, returning empty audio:", err.message);
          result = {}; 
        }
        break;

      case 'greeting-tts':
        const params = new URLSearchParams({
          key: voiceRssKey,
          src: payload.text,
          hl: 'id-id',
          v: 'Budi',
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
