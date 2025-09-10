// /api/submit.js
const { Resend } = require('resend');
const twilio = require('twilio');

module.exports = async (req, res) => {
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

    // --- Arma el resumen ---
    const resumen =
`Nueva solicitud de compra:
• Nombre: ${nombre}
• Teléfono: ${telefono}
• Correo: ${correo}
• Tipo: ${tipo}
• Cantidad: ${cantidad}
• Mensaje: ${mensaje || '(sin mensaje)'}
• Fecha/Hora: ${new Date().toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo' })}`;

    // --- Enviar EMAIL con Resend ---
    const resend = new Resend(process.env.RESEND_API_KEY);
    const toList = (process.env.EMAIL_TO || '').split(',').map(s => s.trim()).filter(Boolean);

    let emailSent = false;
    if (toList.length) {
      const emailResp = await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: toList,
        subject: 'Nueva solicitud de taquillas – Fiesta Pro-Fondos',
        text: resumen
      });
      emailSent = !!emailResp?.id;
    }

    // --- Enviar WhatsApp con Twilio ---
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const waTargets = (process.env.WHATSAPP_ADMIN_TO || '').split(',').map(s => s.trim()).filter(Boolean);

    let waResults = [];
    for (const to of waTargets) {
      const msg = await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_FROM, // ej: whatsapp:+14155238886 (sandbox) o tu número habilitado
        to,
        body: resumen
      });
      waResults.push(!!msg?.sid);
    }
    const waSent = waResults.every(Boolean) && waResults.length > 0;

    return res.status(200).json({ ok: true, emailSent, waSent });
  } catch (err) {
    console.error('Submit error:', err);
    return res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
};
