// /api/submit.js
// Guarda datos en Google Sheets y envía correo. NO envía WhatsApp.
// Requiere variables de entorno configuradas en Vercel.

const { google } = require('googleapis');
const { Resend } = require('resend');

const resend = new Resend(requireEnv('RESEND_API_KEY'));

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

async function appendToSheet(values) {
  const client_email = requireEnv('GOOGLE_CLIENT_EMAIL');
  // Las llaves privadas de GCP suelen llevar \n escapados en Vercel; reemplazamos para formar el PEM correcto
  const private_key = requireEnv('GOOGLE_PRIVATE_KEY').replace(/\\\\n/g, '\n');
  const spreadsheetId = requireEnv('GOOGLE_SHEET_ID');
  const sheetRange = process.env.GOOGLE_SHEET_RANGE || "VENTAS!A1";

  const auth = new google.auth.JWT(
    client_email,
    null,
    private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  const sheets = google.sheets({ version: 'v4', auth });
  sheets.spreadsheets.values.append({
    spreadsheetId,
    range: sheetRange,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  }).then((resp) => {
    console.log("Respuesta Sheet guardado:", resp);
    return { ok: true, savedToSheet: true };
  }).catch((err) => {
    console.error("Error guardando en Sheet:", err);
    return { ok: false, savedToSheet: false, error: err };
  });
}

async function sendEmail({ to, subject, html, text }) {

  const from = process.env.MAIL_FROM || `Notificaciones <onboarding@resend.dev>`;

  resend.emails.send({
    from,
    to,
    subject,
    html,
    text,
  }).then((resp) => {
    console.log("Respuesta Email enviado:", resp);
    return { ok: true, emailSent: true };
  
  }).catch((err) => {
    console.error("Error enviando email:", err);
    return { ok: false, emailSent: false, error: err };
  
  });
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const data = req.body || {};
    // Aceptamos application/json; si viene como texto, intentamos parsear
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch {}
    }

    const nombre = (data.nombre || '').toString().trim();
    const telefono = (data.telefono || '').toString().trim();
    const correo = (data.correo || '').toString().trim();
    const tipo = (data.tipo || '').toString().trim(); // 'sencilla' | 'pareja' (según UI)
    const cantidad = Number(data.cantidad || 1);
    const precio = Number(data.precio || (tipo === 'pareja' ? 4000 : 2500));
    const total = Number(data.total || (precio * cantidad));
    const mensaje = (data.mensaje || '').toString().trim();
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
    const ua = (req.headers['user-agent'] || '').toString();

    if (!nombre || !telefono || !correo || !tipo || !cantidad) {
      return res.status(400).json({ error: 'Campos obligatorios faltantes.' });
    }

    // 1) Guardar en Google Sheet
    const now = new Date();
    const iso = now.toISOString();
    const row = [
      iso, nombre, telefono, correo, tipo, cantidad, precio, total, mensaje, ua, ip
    ];
    const sheetResp = await appendToSheet(row);

    // 2) Enviar correo de aviso
    const adminTo = requireEnv('MAIL_TO'); // destinatario (parroquia/organizador)
    const subject = `Nueva solicitud de compra - ${nombre} (${tipo} x${cantidad})`;
    const html = `
      <h2>Nueva solicitud</h2>
      <ul>
        <li><b>Fecha:</b> ${iso}</li>
        <li><b>Nombre:</b> ${escapeHtml(nombre)}</li>
        <li><b>Teléfono:</b> ${escapeHtml(telefono)}</li>
        <li><b>Correo:</b> ${escapeHtml(correo)}</li>
        <li><b>Tipo:</b> ${escapeHtml(tipo)}</li>
        <li><b>Cantidad:</b> ${cantidad}</li>
        <li><b>Precio unitario:</b> RD$ ${precio}</li>
        <li><b>Total:</b> RD$ ${total}</li>
        <li><b>Mensaje:</b> ${escapeHtml(mensaje || '')}</li>
      </ul>
    `;
    const text = `Nueva solicitud
Fecha: ${iso}
Nombre: ${nombre}
Teléfono: ${telefono}
Correo: ${correo}
Tipo: ${tipo}
Cantidad: ${cantidad}
Precio unitario: RD$ ${precio}
Total: RD$ ${total}
Mensaje: ${mensaje || ''}
`;

    const emailResp = await sendEmail({ to: adminTo, subject, html, text });

    if(!sheetResp.ok || !emailResp.ok){
      return res.status(500).json({ 
        ok: false, 
        error: [ sheetResp.error || 'Error al guardar en Sheet', emailResp.error || 'Error al enviar correo' ] 
      });
    }else{
      return res.status(200).json({ 
        ok: true, 
        savedToSheet: sheetResp.savedToSheet, 
        emailSent: emailResp.emailSent,
        message: 'Solicitud procesada correctamente.'
      });
    }
    
  } catch (err) {
    console.error('Error en /api/submit:', err);
    return res.status(500).json({ ok: false, error: 'Error interno al procesar la solicitud.' });
  }
};

function escapeHtml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
