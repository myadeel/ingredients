import OpenAI from 'openai';

export const config = { runtime: 'edge' };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  }
  const { imageBase64, detail = 'low' } = await req.json();
  if (!imageBase64) {
    return new Response(JSON.stringify({ error: 'Missing imageBase64' }), { status: 400 });
  }

  // Build messages for vision-capable chat
  const messages = [
    { role: 'system', content: `
You are an AI assistant that analyzes food ingredient labels.
Extract and evaluate ingredients, then return JSON with:
  status (Healthy, Caution, Harmful),
  summary,
  keyIngredients: [{name, analysis}],
  concerns,
  recommendation.
Return JSON only.
    `.trim() },
    { role: 'user', content: 'Analyze this image:' },
    { role: 'user', image_url: `data:image/png;base64,${imageBase64}` }
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages
    });
    const raw = completion.choices[0].message.content;
    try {
      return new Response(raw, { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch {
      return new Response(JSON.stringify({ raw }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
