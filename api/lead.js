// ============================================================
// /api/lead.js
// Vercel Function que recibe leads del bot de surlab.io
// y los envía por mail a surlab.tec@gmail.com vía Resend.
// ============================================================

export default async function handler(req, res) {
  // Solo aceptar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS (por si en el futuro lo llamás desde otro dominio)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { name, phone, message, interest, context, source, timestamp } = req.body;

    // Validación básica
    if (!name || !phone) {
      return res.status(400).json({ error: 'Faltan datos: nombre y teléfono son obligatorios' });
    }

    // Anti-spam súper básico (longitud y caracteres extraños)
    if (name.length > 100 || phone.length > 50 || (message && message.length > 2000)) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    // Construir el HTML del mail
    const fechaArg = new Date(timestamp || Date.now()).toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      dateStyle: 'short',
      timeStyle: 'short',
    });

    // Bloque de comentario (solo si lo dejó)
    const messageBlock = message
      ? `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666; font-size: 13px; vertical-align: top;">💬 Comentario</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #1a1a1a; line-height: 1.55; white-space: pre-wrap;">${escapeHtml(message)}</td>
        </tr>`
      : '';

    const emailHtml = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 20px;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <div style="border-bottom: 3px solid #f0c060; padding-bottom: 16px; margin-bottom: 24px;">
            <h1 style="margin: 0; font-size: 22px; color: #1a1a1a;">🎯 Nuevo lead en SurLab.io</h1>
            <p style="margin: 6px 0 0; color: #666; font-size: 14px;">Llegó desde el bot de la web</p>
          </div>

          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666; font-size: 13px; width: 110px;">👤 Nombre</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #1a1a1a; font-weight: 600;">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666; font-size: 13px;">📱 Teléfono</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #1a1a1a;">
                <a href="https://wa.me/${cleanPhone(phone)}" style="color: #25D366; text-decoration: none; font-weight: 600;">${escapeHtml(phone)}</a>
                <span style="color: #999; font-size: 12px; margin-left: 8px;">(click para WhatsApp)</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666; font-size: 13px;">💡 Interés</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #1a1a1a;">${escapeHtml(interest || 'No especificado')}</td>
            </tr>${messageBlock}
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666; font-size: 13px;">🏷️ Contexto</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #999; font-family: monospace; font-size: 12px;">${escapeHtml(context || '-')}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666; font-size: 13px;">📍 Origen</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #1a1a1a;">${escapeHtml(source || 'surlab.io')}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #666; font-size: 13px;">🕒 Fecha</td>
              <td style="padding: 12px 0; color: #1a1a1a;">${fechaArg}</td>
            </tr>
          </table>

          <div style="margin-top: 28px; padding: 16px; background: #fffbf0; border-left: 3px solid #f0c060; border-radius: 6px;">
            <p style="margin: 0; color: #6b5a2a; font-size: 13px;">
              ⏰ <strong>Recordá:</strong> Respondé en menos de 24hs para máxima conversión.
            </p>
          </div>
        </div>

        <p style="text-align: center; color: #999; font-size: 12px; margin-top: 16px;">
          SurLab · Notificación automática del bot · surlab.io
        </p>
      </div>
    `;

    // Enviar mail vía Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SurLab Bot <bot@surlab.io>',
        to: ['surlab.tec@gmail.com'],
        subject: `🎯 Nuevo lead: ${name} — ${interest || 'Consulta'}`,
        html: emailHtml,
        reply_to: 'surlab.tec@gmail.com',
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text();
      console.error('Resend error:', errorData);
      return res.status(500).json({ error: 'No se pudo enviar el mail' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error en /api/lead:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
}

// Helpers
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanPhone(phone) {
  // Limpia el teléfono para link de WhatsApp (solo números, agregar 549 si no está)
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('549')) return cleaned;
  if (cleaned.startsWith('54')) return '549' + cleaned.slice(2);
  if (cleaned.startsWith('11') || cleaned.startsWith('221')) return '549' + cleaned;
  return cleaned;
}
