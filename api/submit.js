// /api/submit.js
const { Resend } = require('resend');

async function sendWhatsAppTemplate({ to, params }) {
  const endpoint = `https://graph.facebook.com/v20.0/${process.env.META_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to, // E.164 sin espacios ni '+', ej: "1809XXXXXXX"
    type: "template",
    template: {
      name: process.env.WA_TEMPLATE_NAME || "nueva_solicitud",
      language: { code: process.env.WA_TEMPLATE_LANG || "es" },
      components: [
        {
          type: "body",
          parameters: params.map(t => ({ type: "text", text: String(t ?? "") }))
        }
      ]
    }
  };

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.META_WABA_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`WhatsApp API error (${resp.status}): ${errText}`);
  }

  return true;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { nombre, telefono, correo, tipo, cantidad, mensaje } = body;

    if (!nombre || !telefono || !correo || !tipo || !cantidad) {
      return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }

    const fecha = new Date().toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo' });

    // 1) EMAIL (Resend)
    const resumen =
`Nueva solicitud de compra:
• Nombre: ${nombre}
• Teléfono: ${telefono}
• Correo: ${correo}
• Tipo: ${tipo}
• Cantidad: ${cantidad}
• Mensaje: ${mensaje || '(sin mensaje)'}
• Fecha/Hora: ${fecha}`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    const toList = (process.env.EMAIL_TO || '').split(',').map(s => s.trim()).filter(Boolean);
    let emailSent = false;
    if (toList.length) {
      const r = await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: toList,
        subject: 'Nueva solicitud de taquillas – Fiesta Pro-Fondos',
        text: resumen
      });
      emailSent = !!r?.id;
    }

    // 2) WHATSAPP (Cloud API con plantilla)
    const waTargets = (process.env.WA_ADMIN_TO || '').split(',').map(s => s.trim()).filter(Boolean);
    let waResults = [];

    if (waTargets.length && process.env.META_WABA_TOKEN && process.env.META_PHONE_NUMBER_ID) {
      const params = [
        nombre, telefono, correo, tipo, String(cantidad),
        mensaje || '(sin mensaje)', fecha
      ];

      for (const to of waTargets) {
        try {
          await sendWhatsAppTemplate({ to, params });
          waResults.push(true);
        } catch (e) {
          console.error('WA send error for', to, e.message);
          waResults.push(false);
        }
      }
    }

    const waSent = waResults.length > 0 && waResults.every(Boolean);

    return res.status(200).json({ ok: true, emailSent, waSent });
  } catch (err) {
    console.error('Submit error:', err);
    return res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
};
