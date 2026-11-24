// La página solo hace fetch a la API. El navegador manda la cookie solo (misma página, mismo servidor).
const $ = (id) => document.getElementById(id);

let tokenSesion = null;

// Centraliza las llamadas HTTP para que toda la página maneje respuestas y errores de forma uniforme.
async function llamar(metodo, url, cuerpo, opcionesExtra = {}) {
  const opciones = { method: metodo, ...opcionesExtra };
  opciones.headers = { ...(opcionesExtra.headers || {}) };
  if (cuerpo !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }

  let respuesta;
  try {
    respuesta = await fetch(url, opciones);
  } catch (error) {
    return { status: 0, datos: { error: `No se pudo conectar con el servidor (${error.message})` } };
  }
  let datos = null;
  try {
    datos = await respuesta.json();
  } catch (error) {
    datos = null;
  }
  return { status: respuesta.status, datos };
}

// Guarda un historial visible de peticiones para poder comprobar códigos y respuestas durante la demo.
function agregarBitacora(metodo, url, status, datos) {
  const li = document.createElement('li');

  const codigo = document.createElement('span');
  codigo.classList.add('codigo');
  if (status >= 200 && status < 300) {
    codigo.classList.add('ok');
  } else if (status === 401) {
    codigo.classList.add('e401');
  } else if (status === 403) {
    codigo.classList.add('e403');
  } else {
    codigo.classList.add('error');
  }
  codigo.textContent = String(status);

  const detalle = document.createElement('span');
  detalle.textContent = ` ${metodo} ${url}`;

  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(datos, null, 2);

  li.append(codigo, detalle, pre);
  $('bitacora').prepend(li);
}

function mostrarToken(info, mensajeEstado) {
  const estado = $('token-estado');
  const visible = $('token-visible');
  if (!estado || !visible) return;

  if (info && info.token) {
    tokenSesion = info.token;
    visible.textContent = info.token;
    const textoEstado = mensajeEstado || (info.estado === 'activa'
      ? `Token activo${typeof info.expiraEnSegundos === 'number' ? ` · vence en ${info.expiraEnSegundos} s` : ''}`
      : info.estado === 'vencida'
        ? 'Token vencido (puedes renovarlo si tu sesión sigue activa)'
        : info.revocado
          ? 'Token revocado'
          : 'Token obtenido');
    estado.textContent = textoEstado;
    estado.className = `estado ${info.estado === 'activa' ? 'con-sesion' : 'sin-sesion'}`;
  } else {
    tokenSesion = null;
    visible.textContent = '(inicia sesión y pulsa "Obtener token")';
    estado.textContent = mensajeEstado || 'Sin token';
    estado.className = 'estado sin-sesion';
  }
}

async function actualizarListaNegra() {
  const respuesta = await llamar('GET', '/api/diagnostico/tokens');
  const tbody = $('tabla-lista-negra');
  const estado = $('lista-negra-estado');
  if (!tbody || !estado) return;

  tbody.textContent = '';
  if (respuesta.status !== 200 || !respuesta.datos) {
    estado.textContent = `No se pudo consultar la lista negra (código ${respuesta.status})`;
    estado.className = 'estado-almacen';
    const fila = document.createElement('tr');
    const celda = document.createElement('td');
    celda.colSpan = 4;
    celda.textContent = '(sin datos)';
    fila.appendChild(celda);
    tbody.appendChild(fila);
    return;
  }

  estado.textContent = respuesta.datos.revocacion
    ? 'Revocación ACTIVA: tabla tokens_revocados en MySQL'
    : 'Revocación DESACTIVADA (jwtRevocar: false): el servidor no anota tokens revocados';
  estado.className = 'estado-almacen';

  const revocados = respuesta.datos.revocados || [];
  if (revocados.length === 0) {
    const fila = document.createElement('tr');
    const celda = document.createElement('td');
    celda.colSpan = 4;
    celda.textContent = '(vacía)';
    fila.appendChild(celda);
    tbody.appendChild(fila);
    return;
  }

  revocados.forEach((t) => {
    const fila = document.createElement('tr');
    const valores = [
      t.jti || '',
      t.usuario || '',
      t.expira ? new Date(t.expira).toLocaleString() : '',
      t.revocadoEn ? new Date(t.revocadoEn).toLocaleString() : '',
    ];
    valores.forEach((valor) => {
      const celda = document.createElement('td');
      celda.textContent = valor;
      fila.appendChild(celda);
    });
    tbody.appendChild(fila);
  });
}

// Consulta al servidor quién es la sesión actual para reflejar el estado real sin confiar en el cliente.
async function actualizarEstado() {
  const respuesta = await llamar('GET', '/api/sesion');
  const estado = $('estado');

  if (respuesta.status === 200 && respuesta.datos) {
    const { usuario, sesion, expiraEnSegundos } = respuesta.datos;
    estado.textContent = `Con sesión: ${usuario.nombre} (${usuario.rol}) · sesión ${sesion} · vence en ${expiraEnSegundos} s`;
    estado.className = 'estado con-sesion';
  } else {
    estado.textContent = 'Sin sesión (el servidor responde 401)';
    estado.className = 'estado sin-sesion';
    if (tokenSesion) {
      mostrarToken(null, 'Sin sesión: el token de la sesión ya no aplica');
    }
  }

  $('cookie-js').textContent = document.cookie || '(vacío)';
}

// Muestra las sesiones guardadas en el servidor para evidenciar dónde vive el estado y cuál es la propia.
async function actualizarTabla() {
  const respuesta = await llamar('GET', '/api/diagnostico/sesiones');
  const tbody = $('tabla-sesiones');
  const donde = $('donde');

  if (respuesta.status !== 200 || !respuesta.datos) {
    donde.textContent = 'No se pudo consultar el diagnóstico de sesiones.';
    tbody.textContent = '';
    const fila = document.createElement('tr');
    const celda = document.createElement('td');
    celda.colSpan = 4;
    celda.textContent = '(sin sesiones)';
    fila.appendChild(celda);
    tbody.appendChild(fila);
    return;
  }

  const { almacen, sesiones } = respuesta.datos;
  donde.textContent = almacen === 'mysql'
    ? 'En MySQL, tabla sessions'
    : 'En memoria del servidor';

  tbody.textContent = '';
  if (!sesiones || sesiones.length === 0) {
    const fila = document.createElement('tr');
    const celda = document.createElement('td');
    celda.colSpan = 4;
    celda.textContent = '(sin sesiones)';
    fila.appendChild(celda);
    tbody.appendChild(fila);
    return;
  }

  sesiones.forEach((s) => {
    const fila = document.createElement('tr');
    if (s.esLaTuya) fila.classList.add('tuya');

    const valores = [
      `${s.sesion}${s.esLaTuya ? ' (la tuya)' : ''}`,
      s.usuario,
      String(s.visitas),
      s.expira ? new Date(s.expira).toLocaleString() : '',
    ];

    valores.forEach((valor) => {
      const celda = document.createElement('td');
      celda.textContent = valor;
      fila.appendChild(celda);
    });

    tbody.appendChild(fila);
  });
}

// Actualiza juntas la vista personal y la vista del servidor para que la interfaz muestre el mismo momento.
async function refrescarTodo() {
  await Promise.all([actualizarEstado(), actualizarTabla()]);
}

// Envía las credenciales sin recargar la página para observar la respuesta y el cambio de sesión.
$('form-login').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const usuario = $('usuario').value;
  const contrasena = $('contrasena').value;
  const respuesta = await llamar('POST', '/api/login', { usuario, contrasena });
  agregarBitacora('POST', '/api/login', respuesta.status, respuesta.datos);
  if (respuesta.status === 200 && respuesta.datos && respuesta.datos.token) {
    mostrarToken({ token: respuesta.datos.token, estado: 'activa' }, 'Token recibido al iniciar sesión');
  } else if (respuesta.status !== 200) {
    mostrarToken(null, 'Sin token');
  }
  await refrescarTodo();
  await actualizarListaNegra();
});

// Sincroniza la contraseña de ejemplo con el usuario elegido para facilitar las pruebas en clase.
$('usuario').addEventListener('change', () => {
  $('contrasena').value = `${$('usuario').value}12345`;
});

// Reutiliza los atributos data-* de los botones para ejecutar acciones de la API sin repetir código por botón.
document.querySelectorAll('button[data-url]').forEach((boton) => {
  boton.addEventListener('click', async () => {
    const metodo = boton.dataset.metodo;
    const url = boton.dataset.url;
    const respuesta = await llamar(metodo, url);
    agregarBitacora(metodo, url, respuesta.status, respuesta.datos);
    if (url === '/api/logout') {
      if (respuesta.status === 200) {
        mostrarToken(null, 'Sesión cerrada: token revocado en el servidor');
      }
      await actualizarListaNegra();
    }
    await refrescarTodo();
  });
});

// Permite volver a consultar el estado cuando se quiere confirmar cambios sin ejecutar otra acción.
$('btn-refrescar').addEventListener('click', async () => {
  await refrescarTodo();
});

// Permite actualizar solo la tabla del servidor para observar su contenido sin alterar la sesión actual.
$('btn-sesiones').addEventListener('click', async () => {
  await actualizarTabla();
});

const btnTokenObtener = $('btn-token-obtener');
if (btnTokenObtener) {
  btnTokenObtener.addEventListener('click', async () => {
    const respuesta = await llamar('GET', '/api/sesion/token');
    agregarBitacora('GET', '/api/sesion/token', respuesta.status, respuesta.datos);
    if (respuesta.status === 200 && respuesta.datos) {
      mostrarToken(respuesta.datos);
    } else {
      mostrarToken(null, respuesta.datos && respuesta.datos.error ? respuesta.datos.error : 'No se pudo obtener el token');
    }
  });
}

const btnTokenRenovar = $('btn-token-renovar');
if (btnTokenRenovar) {
  btnTokenRenovar.addEventListener('click', async () => {
    const respuesta = await llamar('POST', '/api/sesion/token');
    agregarBitacora('POST', '/api/sesion/token', respuesta.status, respuesta.datos);
    if (respuesta.status === 200 && respuesta.datos && respuesta.datos.jwt) {
      mostrarToken(respuesta.datos.jwt, 'Token renovado (el anterior fue revocado)');
      await actualizarListaNegra();
    } else {
      mostrarToken(null, respuesta.datos && respuesta.datos.error ? respuesta.datos.error : 'No se pudo renovar el token');
    }
  });
}

const btnTokenComprobar = $('btn-token-comprobar');
if (btnTokenComprobar) {
  btnTokenComprobar.addEventListener('click', async () => {
    if (!tokenSesion) {
      mostrarToken(null, 'Primero obtén un token');
      return;
    }
    const respuesta = await llamar('GET', '/api/jwt/sesion', undefined, {
      headers: { Authorization: `Bearer ${tokenSesion}` },
      credentials: 'omit',
    });
    agregarBitacora('GET', '/api/jwt/sesion', respuesta.status, respuesta.datos);
    if (respuesta.status === 200 && respuesta.datos) {
      mostrarToken(respuesta.datos, 'Token válido (comprobado sin cookie, solo con Authorization)');
    } else {
      const msg = respuesta.datos && respuesta.datos.error ? respuesta.datos.error : `Token rechazado (código ${respuesta.status})`;
      $('token-estado').textContent = msg;
      $('token-estado').className = 'estado sin-sesion';
    }
  });
}

const btnListaNegra = $('btn-lista-negra');
if (btnListaNegra) {
  btnListaNegra.addEventListener('click', async () => {
    await actualizarListaNegra();
  });
}

// Carga la configuración y el estado inicial al abrir la página para que la interfaz arranque con datos reales.
(async () => {
  const config = await llamar('GET', '/api/config');
  $('config').textContent = JSON.stringify(config.datos, null, 2);
  await refrescarTodo();
  await actualizarListaNegra();
})();
