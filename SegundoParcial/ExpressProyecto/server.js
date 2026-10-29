const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const express = require('express');
const pool = require('./db-local');

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 3001;

function obtenerFechaLocal() {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
}

const usuariosDemo = [
    {
        nombre: 'Admin Semilla',
        correo: 'admin@cecyt9.edu.mx',
        boleta: '0000000000',
        rol: 'admin',
    },
    {
        nombre: 'Ana López',
        correo: 'ana.lopez@cecyt9.edu.mx',
        boleta: '2026090001',
        rol: 'alumno',
    },
    {
        nombre: 'Luis Pérez',
        correo: 'luis.perez@cecyt9.edu.mx',
        boleta: '2026090002',
        rol: 'alumno',
    },
    {
        nombre: 'María Hernández',
        correo: 'maria.hernandez@cecyt9.edu.mx',
        boleta: '2026090003',
        rol: 'alumno',
    },
    {
        nombre: 'Alumno sin cuenta',
        correo: 'invitado.2026999999@cecyt9.local',
        boleta: '2026999999',
        rol: 'invitado',
    },
];

const talleresDemo = [
    {
        nombre: 'Introducción a Python',
        descripcion: 'Conceptos básicos de programación con Python.',
        instructor: 'Ing. Ana',
        fecha: '2026-10-26',
        cupo: 20,
    },
    {
        nombre: 'Next.js desde cero',
        descripcion: 'Creación de aplicaciones web con Next.js.',
        instructor: null,
        fecha: '2026-10-27',
        cupo: 2,
    },
    {
        nombre: 'Fundamentos de Redes',
        descripcion: 'Principios de redes y comunicación de datos.',
        instructor: 'Ing. Luis',
        fecha: '2026-10-28',
        cupo: 15,
    },
    {
        nombre: 'Git y GitHub en equipo',
        descripcion: 'Control de versiones y colaboración con GitHub.',
        instructor: 'Ing. Carlos',
        fecha: '2026-10-29',
        cupo: 3,
    },
    {
        nombre: 'Diseño de Bases de Datos',
        descripcion: 'Diseño relacional y modelado de datos.',
        instructor: 'Ing. Ana',
        fecha: '2026-10-30',
        cupo: 12,
    },
];

async function ensureUser(connection, usuario) {
    const [existing] = await connection.execute(
        'SELECT id FROM usuarios WHERE boleta = ?',
        [usuario.boleta],
    );
    if (existing.length > 0) return existing[0].id;

    const passwordHash = await bcrypt.hash(
        crypto.randomBytes(32).toString('hex'),
        10,
    );
    const [result] = await connection.execute(
        `INSERT INTO usuarios (nombre, correo, contraseña_hash, boleta, rol)
         VALUES (?, ?, ?, ?, ?)`,
        [
            usuario.nombre,
            usuario.correo,
            passwordHash,
            usuario.boleta,
            usuario.rol,
        ],
    );
    return result.insertId;
}

async function prepararBaseDeDatos() {
    await pool.query('SELECT 1');

    const [columnas] = await pool.query(
        "SHOW COLUMNS FROM talleres LIKE 'instructor'",
    );
    if (columnas.length === 0) {
        await pool.query(
            'ALTER TABLE talleres ADD COLUMN instructor VARCHAR(100) NULL AFTER nombre',
        );
    }

    const [conteos] = await pool.query(
        'SELECT COUNT(*) AS cantidad FROM talleres',
    );
    if (conteos[0].cantidad > 0) {
        console.log('La tabla talleres ya contiene datos; se conservan sin cambios.');
        return;
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const usuariosPorBoleta = new Map();
        for (const usuario of usuariosDemo) {
            usuariosPorBoleta.set(
                usuario.boleta,
                await ensureUser(connection, usuario),
            );
        }

        const tallerIds = [];
        for (const taller of talleresDemo) {
            const [result] = await connection.execute(
                `INSERT INTO talleres
                    (nombre, descripcion, instructor, fecha, cupo)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    taller.nombre,
                    taller.descripcion,
                    taller.instructor,
                    taller.fecha,
                    taller.cupo,
                ],
            );
            tallerIds.push(result.insertId);
        }

        const inscripcionesDemo = [
            { taller: 0, boleta: '2026090001' },
            { taller: 0, boleta: '2026999999' },
            { taller: 1, boleta: '2026090002' },
            { taller: 1, boleta: '2026090003' },
            { taller: 3, boleta: '2026090001' },
            { taller: 3, boleta: '2026090002' },
        ];

        for (const inscripcion of inscripcionesDemo) {
            await connection.execute(
                `INSERT INTO asistencia (usuario_id, taller_id, estado)
                 VALUES (?, ?, 'presente')`,
                [
                    usuariosPorBoleta.get(inscripcion.boleta),
                    tallerIds[inscripcion.taller],
                ],
            );
        }

        await connection.commit();
        console.log('Se insertaron 5 talleres, 5 usuarios y 6 asistencias de ejemplo.');
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

app.get('/saludo', (req, res) => {
    res.json({ mensaje: 'Hola esto es una prueba en GET' });
});

app.post('/eco', (req, res) => {
    const { texto } = req.body;
    if (!texto) {
        return res.status(400).json({ error: 'El texto es obligatorio' });
    }
    return res.status(201).json({ eco: texto });
});

app.get('/api/talleres', async (req, res) => {
    const [talleres] = await pool.query(
        `SELECT id, nombre, descripcion, instructor, fecha, cupo
         FROM talleres ORDER BY id`,
    );
    res.json(talleres);
});

app.post('/api/talleres', async (req, res) => {
    const { nombre, descripcion = '', cupo, fecha, instructor = null } = req.body;
    const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
    const descripcionLimpia =
        typeof descripcion === 'string' ? descripcion.trim() : '';
    const fechaTaller =
        typeof fecha === 'string' && fecha ? fecha : obtenerFechaLocal();
    const cupoTaller = Number(cupo);

    if (!nombreLimpio) {
        return res.status(400).json({ error: 'El nombre del taller es obligatorio' });
    }
    if (!Number.isSafeInteger(cupoTaller) || cupoTaller < 1) {
        return res.status(400).json({ error: 'El cupo debe ser un entero mayor que cero' });
    }
    const [anio, mes, dia] = fechaTaller.split('-').map(Number);
    const fechaValidada = new Date(anio, mes - 1, dia);
    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(fechaTaller) ||
        fechaValidada.getFullYear() !== anio ||
        fechaValidada.getMonth() !== mes - 1 ||
        fechaValidada.getDate() !== dia
    ) {
        return res.status(400).json({ error: 'La fecha debe tener el formato AAAA-MM-DD' });
    }

    const [result] = await pool.execute(
        `INSERT INTO talleres (nombre, descripcion, instructor, fecha, cupo)
         VALUES (?, ?, ?, ?, ?)`,
        [
            nombreLimpio,
            descripcionLimpia || null,
            typeof instructor === 'string' && instructor.trim()
                ? instructor.trim()
                : null,
            fechaTaller,
            cupoTaller,
        ],
    );
    const [talleres] = await pool.execute(
        `SELECT id, nombre, descripcion, instructor, fecha, cupo
         FROM talleres WHERE id = ?`,
        [result.insertId],
    );
    return res.status(201).json(talleres[0]);
});

app.get('/api/asistencia', async (req, res) => {
    const tallerId = req.query.taller_id ? Number(req.query.taller_id) : null;
    if (tallerId !== null && (!Number.isSafeInteger(tallerId) || tallerId <= 0)) {
        return res.status(400).json({ error: 'El taller indicado no es válido' });
    }

    if (tallerId !== null) {
        const [talleres] = await pool.execute(
            'SELECT id FROM talleres WHERE id = ?',
            [tallerId],
        );
        if (talleres.length === 0) {
            return res.status(404).json({ error: 'Taller no encontrado' });
        }
    }

    const [asistencias] = tallerId === null
        ? await pool.query(
            `SELECT a.id, a.taller_id, t.nombre AS taller_nombre,
                    a.usuario_id, u.nombre AS nombre_alumno, u.correo, u.boleta,
                    a.estado, DATE_FORMAT(a.fecha_registro, '%Y-%m-%d') AS fecha
             FROM asistencia a
             JOIN usuarios u ON u.id = a.usuario_id
             JOIN talleres t ON t.id = a.taller_id
             ORDER BY a.fecha_registro DESC, a.id DESC`,
        )
        : await pool.execute(
            `SELECT a.id, a.taller_id, t.nombre AS taller_nombre,
                    a.usuario_id, u.nombre AS nombre_alumno, u.correo, u.boleta,
                    a.estado, DATE_FORMAT(a.fecha_registro, '%Y-%m-%d') AS fecha
             FROM asistencia a
             JOIN usuarios u ON u.id = a.usuario_id
             JOIN talleres t ON t.id = a.taller_id
             WHERE a.taller_id = ?
             ORDER BY a.fecha_registro DESC, a.id DESC`,
            [tallerId],
        );
    return res.json(asistencias);
});

app.post('/api/asistencia', async (req, res) => {
    const tallerId = Number(req.body.taller_id);
    const usuarioId = Number(req.body.usuario_id);
    const fecha = req.body.fecha;

    if (
        !Number.isSafeInteger(tallerId) ||
        tallerId <= 0 ||
        !Number.isSafeInteger(usuarioId) ||
        usuarioId <= 0
    ) {
        return res.status(400).json({
            error: 'Selecciona un taller y un usuario válidos',
        });
    }
    if (
        typeof fecha !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
        Number.isNaN(Date.parse(`${fecha}T12:00:00`))
    ) {
        return res.status(400).json({ error: 'Selecciona una fecha válida' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [registros] = await connection.execute(
            `SELECT id FROM asistencia
             WHERE taller_id = ? AND usuario_id = ?
             ORDER BY id LIMIT 1 FOR UPDATE`,
            [tallerId, usuarioId],
        );
        if (registros.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                error: 'El usuario no está inscrito en este taller',
            });
        }

        await connection.execute(
            `UPDATE asistencia
             SET estado = 'presente', fecha_registro = ?
             WHERE id = ?`,
            [`${fecha} 12:00:00`, registros[0].id],
        );
        await connection.commit();
        return res.json({ mensaje: 'Asistencia registrada correctamente' });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});

app.get('/api/talleres/:id/asistencias', async (req, res) => {
    const [talleres] = await pool.execute(
        'SELECT id FROM talleres WHERE id = ?',
        [req.params.id],
    );
    if (talleres.length === 0) {
        return res.status(404).json({ error: 'Taller no encontrado' });
    }

    const [asistencias] = await pool.execute(
        `SELECT a.id, a.taller_id, a.usuario_id,
                u.nombre AS nombre_alumno, u.boleta, a.estado,
                DATE_FORMAT(a.fecha_registro, '%Y-%m-%d') AS fecha
         FROM asistencia a
         JOIN usuarios u ON u.id = a.usuario_id
         WHERE a.taller_id = ?
         ORDER BY a.id`,
        [req.params.id],
    );
    return res.json(asistencias);
});

app.get('/api/talleres/:id', async (req, res) => {
    const [talleres] = await pool.execute(
        `SELECT id, nombre, descripcion, instructor, fecha, cupo
         FROM talleres WHERE id = ?`,
        [req.params.id],
    );
    if (talleres.length === 0) {
        return res.status(404).json({ error: 'Taller no encontrado' });
    }
    return res.json(talleres[0]);
});

app.get('/api/usuarios', async (req, res) => {
    const [usuarios] = await pool.query(
        `SELECT id, nombre, correo, boleta, rol
         FROM usuarios WHERE rol <> 'invitado' ORDER BY id`,
    );
    res.json(usuarios);
});

app.post('/api/usuarios', async (req, res) => {
    const { nombre, correo, contrasena, boleta } = req.body;
    const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
    const correoLimpio =
        typeof correo === 'string' ? correo.trim().toLowerCase() : '';
    const boletaLimpia = typeof boleta === 'string' ? boleta.trim() : '';

    if (!nombreLimpio || !correoLimpio || !contrasena || !boletaLimpia) {
        return res.status(400).json({
            error: 'Nombre, correo, contraseña y boleta son obligatorios',
        });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio)) {
        return res.status(400).json({ error: 'Escribe un correo válido' });
    }
    if (typeof contrasena !== 'string' || contrasena.length < 8) {
        return res.status(400).json({
            error: 'La contraseña debe tener al menos 8 caracteres',
        });
    }
    if (!/^\d{10}$/.test(boletaLimpia)) {
        return res.status(400).json({ error: 'La boleta debe tener 10 dígitos' });
    }

    const contrasenaHash = await bcrypt.hash(contrasena, 10);
    try {
        const [result] = await pool.execute(
            `INSERT INTO usuarios
                (nombre, correo, contraseña_hash, boleta, rol)
             VALUES (?, ?, ?, ?, 'alumno')`,
            [nombreLimpio, correoLimpio, contrasenaHash, boletaLimpia],
        );
        return res.status(201).json({
            id: result.insertId,
            nombre: nombreLimpio,
            correo: correoLimpio,
            boleta: boletaLimpia,
            rol: 'alumno',
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                error: 'Ya existe un usuario con esa boleta o ese correo',
            });
        }
        throw error;
    }
});

app.post('/api/asistencias', async (req, res) => {
    const { taller_id, nombre_alumno, boleta } = req.body;
    if (!taller_id || !nombre_alumno || !boleta) {
        return res.status(400).json({
            error: 'taller_id, nombre_alumno y boleta son obligatorios',
        });
    }

    const nombreLimpio = String(nombre_alumno).trim();
    const boletaLimpia = String(boleta).trim();
    const tallerId = Number(taller_id);
    if (!nombreLimpio) {
        return res.status(400).json({ error: 'Escribe tu nombre.' });
    }
    if (!/^\d{10}$/.test(boletaLimpia)) {
        return res.status(400).json({ error: 'La boleta debe tener 10 dígitos' });
    }
    if (!Number.isSafeInteger(tallerId) || tallerId <= 0) {
        return res.status(400).json({ error: 'El taller indicado no es válido' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [talleres] = await connection.execute(
            'SELECT id FROM talleres WHERE id = ?',
            [tallerId],
        );
        if (talleres.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Taller no encontrado' });
        }

        let [usuarios] = await connection.execute(
            'SELECT id FROM usuarios WHERE boleta = ?',
            [boletaLimpia],
        );
        let usuarioId;
        if (usuarios.length > 0) {
            usuarioId = usuarios[0].id;
        } else {
            usuarioId = await ensureUser(connection, {
                nombre: nombreLimpio,
                correo: `invitado.${boletaLimpia}@cecyt9.local`,
                boleta: boletaLimpia,
                rol: 'invitado',
            });
        }

        const [result] = await connection.execute(
            `INSERT INTO asistencia (usuario_id, taller_id, estado)
             VALUES (?, ?, 'presente')`,
            [usuarioId, tallerId],
        );
        await connection.commit();

        return res.status(201).json({
            id: result.insertId,
            taller_id: tallerId,
            nombre_alumno: nombreLimpio,
            boleta: boletaLimpia,
        });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});

app.use((error, req, res, next) => {
    console.error('Error en la solicitud:', error);
    if (res.headersSent) return next(error);
    return res.status(500).json({ error: 'Ocurrió un error interno del servidor' });
});

async function iniciarServidor() {
    await prepararBaseDeDatos();
    app.listen(PORT, () => {
        console.log(`Servidor escuchando en el puerto ${PORT} (BD: ${process.env.DB_NAME || 'cecyt9_local'})`);
    });
}

iniciarServidor().catch(async (error) => {
    console.error('No se pudo iniciar el backend ni conectar con MySQL:', error);
    await pool.end();
    process.exitCode = 1;
});

process.on('SIGINT', async () => {
    await pool.end();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await pool.end();
    process.exit(0);
});
