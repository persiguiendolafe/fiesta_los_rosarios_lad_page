(function(){
  const form = document.getElementById('form-compra');
  const UEPA = 'https://uepatickets.com/tickets/en/entradas-musica-gran-fiesta-a-la-virgen-de-las-mercedes';

  form?.addEventListener('submit',async function(ev){
    ev.preventDefault();
    const datos = new FormData(form);
    const nombre = (datos.get('nombre')||'').toString().trim();
    const telefono = (datos.get('telefono')||'').toString().trim();
    const cantidad = (datos.get('cantidad')||'').toString().trim();
    const correo = (datos.get('correo')||'').toString().trim();
    const tipo = (datos.get('tipo')||'').toString().trim();
    const precio = tipo === 'pareja' ? 4000 : 2500;
    const mensaje = (datos.get('mensaje')||'').toString().trim();
    const total = precio * cantidad;
    
    if(!nombre || !telefono || !cantidad || !correo || !tipo){
      alert('Completa todos los campos para continuar.');
      return;
    }
    // Guardar en localStorage (opcional) por si el usuario vuelve
    try{
      localStorage.setItem('fiesta:nombre', nombre);
      localStorage.setItem('fiesta:telefono', telefono);
      localStorage.setItem('fiesta:cantidad', cantidad);
      localStorage.setItem('fiesta:correo', correo);
      localStorage.setItem('fiesta:tipo', tipo);
      localStorage.setItem('fiesta:precio', precio);
      localStorage.setItem('fiesta:total', total);
      localStorage.setItem('fiesta:mensaje', mensaje);
    }catch(_e){}
    
    // enviar estos datos formateados a un char de WS
    try {
      const resp = await fetch('../api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          telefono,
          cantidad,
          correo,
          tipo,
          precio,
          total,
          mensaje
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Error desconocido');

    } catch (err) {
      console.error(err);
      alert('No pudimos enviar la solicitud. Inténtalo nuevamente.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = origText; }
    }

  });

  // Autocompletar si el usuario ya llenó antes
  try{
    const nombrePrev = localStorage.getItem('fiesta:nombre');
    const telPrev = localStorage.getItem('fiesta:telefono');
    const cantPrev = localStorage.getItem('fiesta:cantidad');
    const correoPrev = localStorage.getItem('fiesta:correo');
    const tipoPrev = localStorage.getItem('fiesta:tipo');
    const precioPrev = localStorage.getItem('fiesta:precio');
    const totalPrev = localStorage.getItem('fiesta:total');
    const mensajePrev = localStorage.getItem('fiesta:mensaje');
    if(nombrePrev) document.getElementById('nombre').value = nombrePrev;
    if(telPrev) document.getElementById('telefono').value = telPrev;
    if(cantPrev) document.getElementById('cantidad').value = cantPrev;
    if(correoPrev) document.getElementById('correo').value = correoPrev;
    if(tipoPrev) document.getElementById('tipo').value = tipoPrev;
    if(precioPrev) document.getElementById('precio').value = precioPrev;
    if(totalPrev) document.getElementById('total').value = totalPrev;
    if(mensajePrev) document.getElementById('mensaje').value = mensajePrev;
  }catch(_e){}
})();