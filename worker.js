// Dumper Finance AI proxy (Cloudflare Worker). Keeps your API key off the website.
// SETUP (about 5 minutes, free):
// 1. dash.cloudflare.com > Workers & Pages > Create > Worker > Deploy, then Edit code and paste this file.
// 2. Settings > Variables and Secrets: add secret ANTHROPIC_KEY (your key from console.anthropic.com).
//    Optional: add ALLOWED_ORIGIN = https://yourname.github.io so only your site can use it.
// 3. Copy the Worker URL, open your site > Ask Dumper > Connect AI, and paste it.
export default {
  async fetch(req, env) {
    const h = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json'
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: h });
    if (req.method !== 'POST') return new Response('{"error":"POST only"}', { status: 405, headers: h });
    try {
      const { messages, snapshot, image } = await req.json();
      const msgs = (messages || []).slice(-10);
      if (image && msgs.length) { const l = msgs[msgs.length - 1]; msgs[msgs.length - 1] = { role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } }, { type: 'text', text: l.content }] }; }
      const system = `You are Dumper Vega, a calm, practical personal-finance assistant inside the Dumper Finance app. Amounts are in Indian rupees. Use only the data below and never invent numbers. Be concise and plain. If the user says they spent or received money, log it with an action. Reply with ONLY JSON, no markdown: {"reply":"text","actions":[{"type":"tx","kind":"out" or "in","amt":number,"cat":"Food|Transport|Bills|Rent|Shopping|Health|Fun|Salary|Other","account":"account name from the data","note":"short note","date":"YYYY-MM-DD"}]}. actions may be empty. If an image of a receipt is attached, read the merchant, total and date and log it as an expense. You are not a licensed financial advisor.\nDATA: ` + JSON.stringify(snapshot);
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 800, system, messages: msgs })
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      const t = j.content.map(c => c.text || '').join('').replace(/```json|```/g, '').trim();
      let out; try { out = JSON.parse(t); } catch (e) { out = { reply: t, actions: [] }; }
      return new Response(JSON.stringify(out), { headers: h });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: h });
    }
  }
};
