const pool = require('../db-local');

const COLUMNAS_TALLERES = 'id, nombre, descripcion, fecha, cupo';

// Consultar todos los talleres
async function listar() {
    const [filas] = await pool.query(`SELECT ${COLUMNAS_TALLERES} FROM talleres ORDER BY id`);
    return filas;
}

// Consultar taller específico 
async function consultarportaller(id) {
    const [filas] = await pool.query(`SELECT ${COLUMNAS_TALLERES} FROM talleres WHERE id = ?`, [id]);
    return filas[0];
}

// Crear un taller nuevo
async function crear({ nombre, descripcion, fecha, cupo }) {
    const [info] = await pool.query(
        `INSERT INTO talleres (nombre, descripcion, fecha, cupo) VALUES (?, ?, ?, ?)`,
        [nombre, descripcion, fecha, cupo]
    );
    return consultarportaller(info.insertId);
}

// Registrarse en un taller 
async function registrarseEnUnTaller({ usuario_id, taller_id }) {
    const [info] = await pool.query(
        `INSERT INTO inscripciones_talleres (usuario_id, taller_id) VALUES (?, ?)`,
        [usuario_id, taller_id]
    );
    return info.affectedRows > 0;
}

// Exportar las funciones del modelo de talleres
module.exports = { listar, consultarportaller, crear, registrarseEnUnTaller };