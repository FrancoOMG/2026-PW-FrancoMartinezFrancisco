// La aplicación de la demo. server.js la arranca; las pruebas la arrancan con otras configuraciones.
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const jwt = require('jsonwebtoken');
const { crearModeloUsuarios } = require('./modelos/usuarios.modelo');
const { crearModeloTokens } = require('./modelos/tokens.modelo');

const NOMBRE_COOKIE = 'connect.sid';

function todasLasSesiones(almacen) {
  return new Promise((resolve, reject) => {
    const promesa = almacen.all((error, sesiones) => (error ? reject(error) : resolve(sesiones || {})));
    if (promesa && typeof promesa.then === 'function') promesa.then(resolve, reject);
  });
}

function crearApp(config, pool) {
  const app = express();
  app.use(express.json());

  const usuarios = crearModeloUsuarios(pool);
  const tokensModelo = crearModeloTokens(pool);
  const almacen = config.almacen === 'memoria'
    ? new session.MemoryStore()
    : new MySQLStore({ createDatabaseTable: false, clearExpired: false }, pool);
  app.locals.almacen = almacen;

  const maxAge = config.maxAgeMs;
  const secretoJwt = process.env.SESSION_SECRET || 'secreto-solo.para-la-demo';
  const jwtExpiraSeg = () => Number(config.jwtExpiraSeg ?? config.jwtExpira ?? 300);
  const revocacionActiva = () => config.jwtRevocar !== false && config.jwtRevocado !== false;
  const idCorto = (id) => (id ? `${id.slice(0, 8)}…` : null);

  app.use(
    session({
      name: NOMBRE_COOKIE,
      secret: secretoJwt,
      store: almacen,
      resave: false,
      saveUninitialized: false,
      rolling: Boolean(config.rolling),
      cookie: {
        maxAge,
        httpOnly: config.httpOnly !== false,
        sameSite: config.sameSite || 'lax',
        secure: Boolean(config.secure),
      },
    })
  );

  function emitirToken(usuario) {
    const duracion = jwtExpiraSeg();
    const jti = (typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString('hex');
    const payload = {
      sub: usuario.usuario,
      id: usuario.id,
      usuario: usuario.usuario,
      nombre: usuario.nombre,
      rol: usuario.rol,
      jti,
    };
    const token = jwt.sign(payload, secretoJwt, { algorithm: 'HS256', expiresIn: duracion });
    const decodificado = jwt.decode(token);
    return { token, jti, iat: decodificado.iat, exp: decodificado.exp, duracion };
  }

  async function revocarToken(jti, usuario, exp) {
    if (!revocacionActiva() || !jti) return false;
    await tokensModelo.revocar(jti, usuario, exp);
    return true;
  }

  function estadoDeToken(decodificado, revocado) {
    if (revocado) return 'revocado';
    if (!decodificado || !decodificado.exp) return 'invalido';
    return decodificado.exp * 1000 > Date.now() ? 'activa' : 'vencida';
  }

  async function infoDeToken(token, { forzarEstado } = {}) {
    let decodificado = null;
    try {
      decodificado = jwt.decode(token) || null;
    } catch {
      decodificado = null;
    }
    const jti = decodificado && decodificado.jti;
    const revocado = jti ? await tokensModelo.estaRevocado(jti) : false;
    const estado = forzarEstado || estadoDeToken(decodificado, revocado);
    const iat = decodificado && decodificado.iat;
    const exp = decodificado && decodificado.exp;
    return {
      token,
      jti,
      sesion: jti ? idCorto(jti) : null,
      usuario: decodificado ? {
        id: decodificado.id,
        usuario: decodificado.usuario || decodificado.sub,
        nombre: decodificado.nombre,
        rol: decodificado.rol,
      } : null,
      emitidoEn: iat ? new Date(iat * 1000).toISOString() : null,
      expiraEn: exp ? new Date(exp * 1000).toISOString() : null,
      duracionSegundos: (iat && exp) ? (exp - iat) : jwtExpiraSeg(),
      expiraEnSegundos: exp ? Math.max(0, Math.round(exp - Date.now() / 1000)) : 0,
      algoritmo: 'HS256',
      tipo: 'JWT',
      estado,
      revocado,
      dondeVive: 'En el token (JWT): el servidor no guarda la sesión, solo la lista negra de revocados',
      revocacion: revocacionActiva()
        ? 'Revocación ACTIVA: los tokens revocados se anotan en la tabla tokens_revocados'
        : 'Revocación DESACTIVADA (jwtRevocar: false): el servidor no anota tokens revocados',
    };
  }

  async function asegurarTokenSesion(req) {
    if (!req.session.usuario) return null;
    if (req.session.jwt && req.session.jwt.token) {
      return infoDeToken(req.session.jwt.token);
    }
    const emitido = emitirToken(req.session.usuario);
    req.session.jwt = { token: emitido.token, jti: emitido.jti, iat: emitido.iat, exp: emitido.exp };
    return infoDeToken(emitido.token);
  }

  function leerBearer(req) {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return null;
    return auth.slice(7).trim();
  }

  async function autenticarJwt(req, res, next) {
    const token = leerBearer(req);
    if (!token) {
      return res.status(401).json({ error: '401 · Falta el token: envía Authorization: Bearer <token>' });
    }
    let decodificado;
    try {
      decodificado = jwt.verify(token, secretoJwt, { algorithms: ['HS256'] });
    } catch (error) {
      if (error && error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: '401 · Tu token ya expiró (expirado)' });
      }
      return res.status(401).json({ error: '401 · El token es inválido (firma o formato incorrecto)' });
    }
    if (revocacionActiva() && decodificado.jti && await tokensModelo.estaRevocado(decodificado.jti)) {
      return res.status(401).json({ error: '401 · El token fue revocado y ya no sirve' });
    }
    req.jwt = { token, datos: decodificado };
    next();
  }

  function vencida(sesion) {
    const desde = config.rolling ? sesion.ultimoUso : sesion.creada;
    return Date.now() - desde > maxAge;
  }

  // Revisa que exista sesión y que el servidor no la considere vencida antes de dejar pasar.
  function requiereSesion(req, res, next) {
    if (req.session.usuario && vencida(req.session)) {
      return req.session.destroy(() => {
        res.clearCookie(NOMBRE_COOKIE);
        res.status(401).json({ error: '401 · Tu sesión ya expiró: vuelve a iniciar sesión' });
      });
    }
    if (!req.session.usuario) {
      return res.status(401).json({ error: '401 · No has iniciado sesión (o tu sesión ya venció)' });
    }
    req.session.ultimoUso = Date.now();
    next();
  }

  // Exige un rol específico cuando la ruta es solo para cierto tipo de usuario.
  function requiereRol(rol) {
    return (req, res, next) => {
      if (req.session.usuario.rol !== rol) {
        return res.status(403).json({ error: `403 · Eres ${req.session.usuario.usuario}, pero esta ruta es solo para ${rol}` });
      }
      next();
    };
  }

  app.get('/api/config', (req, res) => res.json(config));

  // Crea o reutiliza la sesión anónima para demostrar que la cookie identifica al visitante.
  app.post('/api/visita', (req, res) => {
    req.session.visitas = (req.session.visitas || 0) + 1;
    res.json({ visitas: req.session.visitas, sesion: idCorto(req.sessionID) });
  });

  app.post('/api/login', async (req, res, next) => {
    try {
      const { usuario, contrasena } = req.body || {};
      const datos = await usuarios.verificar(usuario, contrasena);
      if (!datos) {
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      }

      const antes = req.session.visitas !== undefined ? idCorto(req.sessionID) : null;
      const visitas = req.session.visitas || 0;

      const guardar = () => {
        req.session.usuario = datos;
        req.session.visitas = visitas;
        req.session.creada = Date.now();
        req.session.ultimoUso = Date.now();
        const emitido = emitirToken(datos);
        req.session.jwt = { token: emitido.token, jti: emitido.jti, iat: emitido.iat, exp: emitido.exp };
        req.session.save((error) => {
          if (error) return next(error);
          res.json({
            usuario: datos,
            sesionAntes: antes,
            sesionDespues: idCorto(req.sessionID),
            token: emitido.token,
          });
        });
      };

      if (config.regenerarAlEntrar) {
        req.session.regenerate((error) => (error ? next(error) : guardar()));
      } else {
        guardar();
      }
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/logout', async (req, res, next) => {
    try {
      const jwtSesion = req.session && req.session.jwt;
      let tokenRevocado = false;
      if (jwtSesion && jwtSesion.jti) {
        tokenRevocado = await revocarToken(jwtSesion.jti, req.session.usuario && req.session.usuario.usuario, jwtSesion.exp);
      }
      req.session.destroy(() => {
        res.clearCookie(NOMBRE_COOKIE);
        res.json({ mensaje: 'Sesión cerrada: el servidor la borró', tokenRevocado });
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/sesion', requiereSesion, async (req, res, next) => {
    try {
      const desde = config.rolling ? req.session.ultimoUso : req.session.creada;
      const jwtInfo = await asegurarTokenSesion(req);
      // Si el token venció pero la sesión de cookie sigue viva, se reporta como vencida.
      if (jwtInfo && jwtInfo.estado === 'activa' && jwtInfo.expiraEnSegundos === 0) {
        jwtInfo.estado = 'vencida';
      }
      req.session.save((error) => {
        if (error) return next(error);
        res.json({
          usuario: req.session.usuario,
          sesion: idCorto(req.sessionID),
          expiraEnSegundos: Math.max(0, Math.round((desde + maxAge - Date.now()) / 1000)),
          jwt: jwtInfo,
        });
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/sesion/token', requiereSesion, async (req, res, next) => {
    try {
      const jwtInfo = await asegurarTokenSesion(req);
      if (jwtInfo && jwtInfo.estado === 'activa' && jwtInfo.expiraEnSegundos === 0) {
        jwtInfo.estado = 'vencida';
      }
      req.session.save((error) => {
        if (error) return next(error);
        res.json(jwtInfo);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/sesion/token', requiereSesion, async (req, res, next) => {
    try {
      const anterior = req.session.jwt;
      let anteriorRevocado = false;
      if (anterior && anterior.jti) {
        anteriorRevocado = await revocarToken(anterior.jti, req.session.usuario && req.session.usuario.usuario, anterior.exp);
      }
      const emitido = emitirToken(req.session.usuario);
      req.session.jwt = { token: emitido.token, jti: emitido.jti, iat: emitido.iat, exp: emitido.exp };
      const jwtInfo = await infoDeToken(emitido.token);
      req.session.save((error) => {
        if (error) return next(error);
        res.json({ anteriorRevocado, jwt: jwtInfo });
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/perfil', requiereSesion, (req, res) => {
    req.session.visitas = (req.session.visitas || 0) + 1;
    res.json({
      mensaje: `Hola, ${req.session.usuario.nombre}`,
      rol: req.session.usuario.rol,
      visitas: req.session.visitas,
    });
  });

  app.get('/api/admin/reporte', requiereSesion, requiereRol('admin'), (req, res) => {
    res.json({ reporte: 'Talleres: 3 · Inscritos: 57 · Cupo libre: 18' });
  });

  app.get('/api/diagnostico/sesiones', async (req, res, next) => {
    try {
      const sesiones = await todasLasSesiones(almacen);
      const lista = Object.entries(sesiones || {}).map(([id, s]) => ({
        sesion: idCorto(id),
        esLaTuya: id === req.sessionID,
        usuario: s.usuario ? s.usuario.usuario : 'sin iniciar sesión',
        visitas: s.visitas || 0,
        expira: s.cookie && s.cookie.expires,
      }));
      res.json({ almacen: config.almacen, sesiones: lista });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/diagnostico/tokens', async (req, res, next) => {
    try {
      const filas = await tokensModelo.listar();
      const revocados = (filas || []).map((t) => ({
        jti: t.jti,
        usuario: t.usuario,
        expira: t.expira,
        revocadoEn: t.revocado_en || t.revocadoEn,
      }));
      res.json({ revocados, revocacion: revocacionActiva() });
    } catch (error) {
      next(error);
    }
  });

  // --- JWT (sin cookie): validación con Authorization: Bearer <token> ---
  app.get('/api/jwt/sesion', autenticarJwt, async (req, res, next) => {
    try {
      const info = await infoDeToken(req.jwt.token);
      info.estado = 'activa';
      res.json(info);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/jwt/perfil', autenticarJwt, (req, res) => {
    res.json({ mensaje: `Hola, ${req.jwt.datos.nombre}`, rol: req.jwt.datos.rol });
  });

  app.get('/api/jwt/reporte', autenticarJwt, (req, res) => {
    if (req.jwt.datos.rol !== 'admin') {
      return res.status(403).json({ error: `403 · Eres ${req.jwt.datos.usuario || req.jwt.datos.sub}, pero esta ruta es solo para admin` });
    }
    res.json({ reporte: 'Talleres: 3 · Inscritos: 57 · Cupo libre: 18' });
  });

  app.post('/api/jwt/login', async (req, res, next) => {
    try {
      const { usuario, contrasena } = req.body || {};
      const datos = await usuarios.verificar(usuario, contrasena);
      if (!datos) {
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      }
      const emitido = emitirToken(datos);
      res.json({ token: emitido.token, usuario: datos });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/jwt/refresh', autenticarJwt, async (req, res, next) => {
    try {
      const anterior = req.jwt.datos;
      const anteriorRevocado = await revocarToken(anterior.jti, anterior.usuario || anterior.sub, anterior.exp);
      const usuario = {
        id: anterior.id,
        usuario: anterior.usuario || anterior.sub,
        nombre: anterior.nombre,
        rol: anterior.rol,
      };
      const emitido = emitirToken(usuario);
      res.json({ token: emitido.token, anteriorRevocado });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/jwt/logout', async (req, res, next) => {
    try {
      const token = leerBearer(req);
      if (!token) return res.status(401).json({ error: '401 · Falta el token: envía Authorization: Bearer <token>' });
      let decodificado;
      try {
        decodificado = jwt.verify(token, secretoJwt, { algorithms: ['HS256'] });
      } catch (error) {
        if (error && error.name === 'TokenExpiredError') {
          return res.status(401).json({ error: '401 · Tu token ya expiró (expirado)' });
        }
        return res.status(401).json({ error: '401 · El token es inválido (firma o formato incorrecto)' });
      }
      const revocado = await revocarToken(decodificado.jti, decodificado.usuario || decodificado.sub, decodificado.exp);
      res.json({ revocado });
    } catch (error) {
      next(error);
    }
  });

  app.use(express.static(path.join(__dirname, 'public')));

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  });

  return app;
}

module.exports = { crearApp, NOMBRE_COOKIE };
