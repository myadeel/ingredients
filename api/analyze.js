// File: api/analyze.js
import OpenAI from 'openai';

// Tell Vercel to run this as an Edge function
export const config = { runtime: 'edge' };

// Instantiate OpenAI with your secret (set in Vercel env vars)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req) {
  // Universal CORS headers
  const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // 1) Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }

  // Only POST is allowed
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: `Method ${req.method} Not Allowed` }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  // 2) Read & validate body
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
  const { imageBase64, detail = 'low' } = body;
  if (!imageBase64) {
    return new Response(
      JSON.stringify({ error: 'Missing imageBase64' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  // 3) Call OpenAI
  try {
    const messages = [
      {
        role: 'system',
        content: `
You are an AI assistant that analyzes food ingredient labels.
Extract and evaluate ingredients, then return JSON with keys:
  status (Healthy, Caution, Harmful),
  summary,
  keyIngredients: [{name, analysis}],
  concerns,
  recommendation.
Return JSON only.
        `.trim()
      },
      { role: 'user', content: 'Analyze this image:' },
      { role: 'user', image_url: `data:image/png;base64,${imageBase64}` }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages
    });

    const raw = completion.choices[0].message.content;

    // Attempt to parse JSON; if it fails, return raw anyway
    let output;
    try {
      output = JSON.parse(raw);
      return new Response(JSON.stringify(output), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    } catch {
      return new Response(JSON.stringify({ raw }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message || 'Internal Error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}
