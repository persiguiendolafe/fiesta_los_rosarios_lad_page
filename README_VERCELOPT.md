# Fiesta – Guardado en Google Sheets + Email (Vercel)

Este proyecto guarda los envíos del formulario en **Google Sheets** y envía un **correo** de aviso. **No** envía WhatsApp.

## 1) Google Cloud – Service Account
1. Ve a https://console.cloud.google.com/  → crea un proyecto o usa uno existente.
2. Habilita **Google Sheets API**.
3. Crea una **Cuenta de servicio** y genera una **clave JSON**.
4. Copia el `client_email` y `private_key` de esa clave.
5. Abre tu hoja de cálculo (Google Sheets) y **compártela** con el correo de la cuenta de servicio (como editor).

> Consejo: crea una hoja llamada `Hoja1` con encabezados en la fila 1:
> `fecha, nombre, telefono, correo, tipo, cantidad, precio, total, mensaje, userAgent, ip`

## 2) Variables de Entorno en Vercel
En tu proyecto Vercel añade (Settings → Environment Variables):

- `GOOGLE_CLIENT_EMAIL` → del JSON de la cuenta de servicio
- `GOOGLE_PRIVATE_KEY` → del JSON (pegar tal cual; Vercel insertará `\n`, el código ya lo corrige)
- `GOOGLE_SHEET_ID` → ID de la hoja (lo que va entre `/d/` y `/edit` en la URL)
- `GOOGLE_SHEET_RANGE` *(opcional)* → por defecto `Hoja1!A1`

- `SMTP_HOST` → servidor SMTP (ej. `smtp.gmail.com` o el de tu proveedor)
- `SMTP_PORT` → `465` (SSL) o `587` (StartTLS)
- `SMTP_USER` → usuario/correo SMTP
- `SMTP_PASS` → contraseña o **App Password**
- `MAIL_TO` → destinatario de aviso (correo del organizador)
- `MAIL_FROM` *(opcional)* → remitente amigable. Si se omite se usa `SMTP_USER`

> **Gmail**: activa 2FA y crea un **App Password** para usar con SMTP. (No funciona con “acceso de apps menos seguras”).

## 3) Despliegue
```bash
npm i
vercel
vercel --prod
```
El endpoint queda en `/api/submit` (POST). El frontend ya lo usa.

## 4) Prueba local
```bash
vercel dev
```
Luego:
```bash
curl -X POST http://localhost:3000/api/submit \
  -H 'Content-Type: application/json' \
  -d '{ "nombre":"Prueba", "telefono":"8090000000", "correo":"a@b.com", "tipo":"sencilla", "cantidad":2, "precio":2500, "total":5000, "mensaje":"Hola"}'
```

## 5) ¿Cambios en el Frontend?
Tu `js/acciones.js` ya hace `fetch('/api/submit', ...)`. No necesitas frameworks ni librerías en el navegador.

---

### Seguridad
- No expongas tu clave privada. Úsala **solo** en variables de entorno.
- Valida y sanea entradas. El endpoint ya hace validaciones básicas.

### Errores comunes
- **403/404 en Sheets**: olvido de **compartir** la hoja con la cuenta de servicio.
- **Auth fallo**: `GOOGLE_PRIVATE_KEY` mal pegada (líneas `\n`).

