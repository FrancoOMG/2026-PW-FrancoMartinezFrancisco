const pool = require('../db-local');

const COLUMNAS_ASISTENCIA = 'id, usuario_id, taller_id, estado, fecha_registro';

// Listar todas las asistencias registradas generales
async function listar() {
    const [filas] = await pool.query(`SELECT ${COLUMNAS_ASISTENCIA} FROM asistencia ORDER BY id`);
    return filas;
}

// Registrar asistencia en el taller (Función solicitada)
async function registrarAsistenciaEnElTaller({ usuario_id, taller_id, estado }) {
    const [info] = await pool.query(
        `INSERT INTO asistencia (usuario_id, taller_id, estado) VALUES (?, ?, ?)`,
        [usuario_id, taller_id, estado || 'presente']
    );
    
    // Retornar el registro insertado
    const [filas] = await pool.query(`SELECT ${COLUMNAS_ASISTENCIA} FROM asistencia WHERE id = ?`, [info.insertId]);
    return filas[0];
}

// Consultar lista de asistencia por taller (Función solicitada)
async function consultarListaDeAsistencia(taller_id) {
    const [filas] = await pool.query(
        `SELECT a.id, a.usuario_id, u.nombre as usuario_nombre, u.correo, a.taller_id, a.estado, a.fecha_registro 
         FROM asistencia a 
         JOIN usuarios u ON a.usuario_id = u.id 
         WHERE a.taller_id = ? 
         ORDER BY a.id`, 
        [taller_id]
    );
    return filas;
}

// Exportar las funciones del modelo de asistencia
module.exports = { listar, registrarAsistenciaEnElTaller, consultarListaDeAsistencia };