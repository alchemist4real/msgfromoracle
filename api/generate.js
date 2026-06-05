// Msg from Oracle — Vercel Serverless Function
// by alchemist4real
//
// Fallback Chain:
//   TEXT:  Gemini Keys (rotation) → HuggingFace Inference → Hardcoded Offline
//   TTS:   Gemini TTS Keys (rotation) → VoiceRSS TTS → Silent (no audio)
//   GREET: VoiceRSS → Silent

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ── Hardcoded offline fallback prophecies ──
const OFFLINE_PROPHECIES = [
  { card_name: "Kehampaan yang Tak Terhindarkan", written_interpretation: "Pada akhirnya, segala ambisimu akan memudar menjadi abu. Waktu tidak peduli dengan harapan-harapan kecilmu.", spoken_interpretation: "Sungguh menyedihkan. Kau mengejar angin, namun yang kau dapatkan hanyalah debu." },
  { card_name: "Ilusi Sebuah Tujuan", written_interpretation: "Kau mengira memiliki kendali, namun takdir telah menulis akhir ceritamu. Usahamu hanyalah hiburan kosmis.", spoken_interpretation: "Tidakkah kau lelah? Berpura-pura bahwa pilihanmu memiliki makna di alam semesta yang dingin ini." },
  { card_name: "Gema Kesunyian", written_interpretation: "Dunia tidak akan mengingat namamu. Dan harapan yang kau genggam erat, pada akhirnya akan menjadi beban terberatmu.", spoken_interpretation: "Mengharapkan keajaiban? Betapa naifnya. Oracle hanya melihat bayangan kegagalanmu yang menari." },
  { card_name: "Langkah Menuju Jurang", written_interpretation: "Setiap langkah maju yang kau banggakan, sebenarnya membawamu lebih dekat pada tebing kekecewaan yang tak berdasar.", spoken_interpretation: "Teruslah melangkah, pencari. Jurang sudah menunggumu dengan pelukan dinginnya." },
  { card_name: "Bintang yang Mati", written_interpretation: "Cahaya yang kau ikuti hanyalah pantulan dari masa lalu yang telah lama hancur. Masa depanmu sedingin luar angkasa.", spoken_interpretation: "Cahaya redup di matamu itu... segera, itu pun akan padam ditelan realita." },
  { card_name: "Debu di Telapak Tangan", written_interpretation: "Setiap hal yang kau genggam erat akan mengalir keluar di sela-sela jarimu. Begitulah dunia memperlakukan mereka yang terlalu berharap.", spoken_interpretation: "Lihatlah tanganmu. Kosong. Seperti seluruh rencana yang pernah kau susun di malam-malam sepimu." },
  { card_name: "Tarian Bayangan", written_interpretation: "Kau berlari mengejar cahaya, tak menyadari bahwa bayanganmu sendiri telah menari di belakangmu, menertawakan setiap langkahmu.", spoken_interpretation: "Bayanganmu tertawa, pencari. Ia tahu sesuatu yang kau tolak untuk mengakui." },
  { card_name: "Senja yang Tak Kembali", written_interpretation: "Ada senja yang hanya datang sekali. Kau melewatkannya saat sibuk mengejar fajar yang tak pernah datang.", spoken_interpretation: "Waktu terbaikmu telah berlalu. Oracle melihatnya, dan kau bahkan tidak menyadarinya." },
  { card_name: "Cermin Retak", written_interpretation: "Kau mencari jawaban di cermin, tapi cermin itu telah retak sejak lama. Yang kau lihat hanyalah potongan-potongan ilusi.", spoken_interpretation: "Cermin tidak berbohong, tapi ia juga tidak menunjukkan yang ingin kau lihat." },
  { card_name: "Lautan Tanpa Ombak", written_interpretation: "Ketenanganmu bukan kedamaian. Itu stagnasi. Lautan yang diam adalah lautan yang telah menyerah pada gravitasi.", spoken_interpretation: "Diam. Tenang. Mati. Tiga kata yang menggambarkan takdirmu dengan sempurna." }
];

// ── System prompt for the oracle ──
const ORACLE_SYSTEM_PROMPT = `You are a Sarcastic Oracle Poet. If the user's input is a QUESTION, your WRITTEN PROPHECY must directly answer it in a cynical, poetic way. If it is a WISH/DESIRE, mock their ambition as usual. Create a POEM TITLE (absurd and dramatic), a WRITTEN PROPHECY (poetic, neutral-toned, beautifully crafted, 2-3 sentences, providing a poetic answer if a question was asked), and a SPOKEN WHISPER (very mocking, addresses the user by name, self-praising. 2-3 sentences). RESPOND ONLY IN JSON: {"card_name": "POEM TITLE", "written_interpretation": "WRITTEN PROPHECY", "spoken_interpretation": "SPOKEN WHISPER"}. All text in Indonesian. No markdown.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const geminiKeysRaw = process.env.GEMINI_API_KEYS || '';
  const voiceRssKey = (process.env.VOICERSS_API_KEY || '').trim();
  const hfKey = (process.env.HF_API_KEY || '').trim();
  const geminiKeys = geminiKeysRaw.split(',').map(k => k.trim()).filter(Boolean);

  const { type, payload } = req.body;

  // ── Retry across all available Gemini keys ──
  async function tryGeminiKeys(fn) {
    shuffle(geminiKeys);
    let lastErr;
    for (const key of geminiKeys) {
      try { return await fn(key); }
      catch (e) { lastErr = e; console.warn(`Gemini key ...${key.slice(-4)} failed: ${e.message}`); }
    }
    throw new Error(`All Gemini keys exhausted. Last: ${lastErr?.message}`);
  }

  // ── HuggingFace text generation ──
  async function tryHuggingFace(userPrompt, sysPrompt) {
    if (!hfKey) throw new Error('No HF key configured');
    console.log('Falling back to HuggingFace...');

    const hfPayload = {
      model: "mistralai/Mistral-Small-24B-Instruct-2501",
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.9
    };

    const r = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hfKey}`
      },
      body: JSON.stringify(hfPayload)
    });

    if (!r.ok) {
      const errBody = await r.text().catch(() => '');
      throw new Error(`HF ${r.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await r.json();
    const text = data.choices?.[0]?.message?.content || '';
    console.log('HuggingFace response received');

    // Wrap in Gemini-compatible format so the frontend can parse it the same way
    return { candidates: [{ content: { parts: [{ text }] } }] };
  }

  // ── Offline fallback (hardcoded) ──
  function offlineFallback() {
    console.log('All APIs exhausted. Using offline fallback.');
    const pick = OFFLINE_PROPHECIES[Math.floor(Math.random() * OFFLINE_PROPHECIES.length)];
    return { candidates: [{ content: { parts: [{ text: JSON.stringify(pick) }] } }] };
  }

  try {
    let result;

    switch (type) {

      // ═══════════════════════════════════════════
      // TEXT: Gemini → HuggingFace → Offline
      // ═══════════════════════════════════════════
      case 'text': {
        const userPrompt = payload?.contents?.[0]?.parts?.[0]?.text || 'Name: Seeker, Wish: peace';
        
        // 1. Extract wish text for Polymarket
        const match = userPrompt.match(/Wish:\s*(.*)$/i);
        const wish = match ? match[1].trim() : userPrompt;

        // 2. Fetch Polymarket
        let pmContext = "";
        try {
          const pmRes = await fetch(`https://gamma-api.polymarket.com/events?active=true&closed=false&query=${encodeURIComponent(wish)}`);
          if (pmRes.ok) {
            const events = await pmRes.json();
            if (events && events.length > 0) {
              const topEvents = events.slice(0, 3).map(e => {
                const markets = (e.markets || []).map(m => {
                  try {
                    const outcomes = JSON.parse(m.outcomes || "[]");
                    const prices = JSON.parse(m.outcomePrices || "[]");
                    return outcomes.map((o, i) => `${o}: ${Math.round(prices[i] * 100)}%`).join(', ');
                  } catch (e) { return ''; }
                }).filter(Boolean);
                return `- ${e.title}: ${markets.join(' | ')}`;
              });
              if (topEvents.length > 0) {
                pmContext = `\n\nPOLYMARKET PREDICTIONS (Real-world odds):\n${topEvents.join('\n')}`;
              }
            }
          }
        } catch (e) { console.warn('Polymarket fetch failed:', e.message); }

        // 3. Build dynamic System Prompt
        const dynamicSysPrompt = `You are a Sarcastic Oracle Poet. You are cynical about human hopes and questions.
If the user asks a QUESTION (including asking for initials, predictions, or sports outcomes), you MUST directly answer it in a cynical, poetic way.
- If they ask for initials, GIVE EXPLICIT INITIALS (e.g., "B. A." or "M. K.").
- If they ask who will win a match or event, state the winner clearly based on the Polymarket Predictions provided below (if any), or make a cynical confident guess if no data is provided.
If the input is a WISH or DESIRE, mock their ambition as usual.

Create a POEM TITLE (absurd and dramatic), a WRITTEN PROPHECY (poetic, neutral-toned, beautifully crafted, 2-3 sentences, providing an explicit answer if a question was asked), and a SPOKEN WHISPER (very mocking, addresses the user by name, self-praising. 2-3 sentences).
RESPOND ONLY IN JSON: {"card_name": "POEM TITLE", "written_interpretation": "WRITTEN PROPHECY", "spoken_interpretation": "SPOKEN WHISPER"}. All text in Indonesian. No markdown.${pmContext}`;

        payload.systemInstruction = { parts: [{ text: dynamicSysPrompt }] };

        // Layer 1: Gemini
        try {
          result = await tryGeminiKeys(async key => {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
            return r.json();
          });
          console.log('Text: served by Gemini');
        } catch (geminiErr) {
          console.warn('Text Gemini failed:', geminiErr.message);

          // Layer 2: HuggingFace
          try {
            result = await tryHuggingFace(userPrompt, dynamicSysPrompt);
            console.log('Text: served by HuggingFace');
          } catch (hfErr) {
            console.warn('Text HuggingFace failed:', hfErr.message);

            // Layer 3: Offline
            result = offlineFallback();
            console.log('Text: served by offline fallback');
          }
        }
        break;
      }

      // ═══════════════════════════════════════════
      // TTS: Gemini TTS → VoiceRSS → Silent
      // ═══════════════════════════════════════════
      case 'tts': {
        // Layer 1: Gemini TTS
        try {
          result = await tryGeminiKeys(async key => {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${key}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
            return r.json();
          });
          console.log('TTS: served by Gemini TTS');
        } catch (geminiErr) {
          console.warn('TTS Gemini failed:', geminiErr.message);

          // Layer 2: VoiceRSS fallback for TTS whisper
          try {
            if (!voiceRssKey) throw new Error('No VoiceRSS key');
            const spokenText = payload?.contents?.[0]?.parts?.[0]?.text || '';
            // Strip the instruction prefix to get just the prophecy text
            const cleanText = spokenText.replace(/^Speak in a.*?voice:\s*/i, '');
            if (!cleanText) throw new Error('No text to speak');

            const params = new URLSearchParams({
              key: voiceRssKey, src: cleanText,
              hl: 'id-id', v: 'Budi', r: '-2', c: 'MP3', f: '16khz_16bit_stereo'
            });
            // Return a special format the frontend can detect
            result = { voicerss_fallback: true, url: `https://api.voicerss.org/?${params.toString()}` };
            console.log('TTS: served by VoiceRSS fallback');
          } catch (voiceErr) {
            console.warn('TTS VoiceRSS fallback failed:', voiceErr.message);

            // Layer 3: Silent (no audio)
            result = {};
            console.log('TTS: silent fallback');
          }
        }
        break;
      }

      // ═══════════════════════════════════════════
      // GREETING TTS: VoiceRSS → Silent
      // ═══════════════════════════════════════════
      case 'greeting-tts': {
        if (voiceRssKey) {
          const params = new URLSearchParams({
            key: voiceRssKey, src: payload.text,
            hl: 'id-id', v: 'Budi', r: '-2', c: 'MP3', f: '16khz_16bit_stereo'
          });
          result = { url: `https://api.voicerss.org/?${params.toString()}` };
        } else {
          result = { url: null };
        }
        break;
      }

      // ═══════════════════════════════════════════
      // IMAGE: Gemini Imagen (if ever works) → empty
      // ═══════════════════════════════════════════
      case 'image': {
        try {
          result = await tryGeminiKeys(async key => {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${key}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
            return r.json();
          });
        } catch (err) {
          console.warn('Image API failed:', err.message);
          result = {};
        }
        break;
      }

      default:
        return res.status(400).json({ error: 'Invalid request type.' });
    }

    res.status(200).json(result);

  } catch (err) {
    console.error('Handler error:', err.message);
    res.status(500).json({ error: 'Oracle encountered an error.' });
  }
}
