// ═══════════════════════════════════════════════════════════════════════
// api/chat.js — Vercel Serverless Function
// ─────────────────────────────────────────────────────────────────────
// Proxy entre el bot del navegador y la API de Anthropic.
// La API key SOLO vive acá (server-side), nunca llega al frontend.
// ═══════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // Solo POST permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validación básica del body
  const { model, max_tokens, system, messages } = req.body || {};
  if (!model || !messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  // ─── Protecciones contra abuso ──────────────────────────────────────
  // Limitar historial: nadie necesita más de 20 mensajes acumulados
  if (messages.length > 20) {
    return res.status(400).json({ error: 'Conversation too long' });
  }

  // Limitar max_tokens del cliente para evitar respuestas gigantes y caras
  const safeMaxTokens = Math.min(Number(max_tokens) || 600, 1024);

  // Limitar longitud de cada mensaje (anti-spam)
  for (const msg of messages) {
    if (typeof msg.content !== 'string' || msg.content.length > 4000) {
      return res.status(400).json({ error: 'Message too long' });
    }
  }
  // ────────────────────────────────────────────────────────────────────

  // Verificar que la API key esté configurada
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Missing ANTHROPIC_API_KEY env var');
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: safeMaxTokens,
        system,
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', response.status, data);
      return res.status(response.status).json({
        error: 'AI service error',
        details: data?.error?.message || 'unknown'
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
