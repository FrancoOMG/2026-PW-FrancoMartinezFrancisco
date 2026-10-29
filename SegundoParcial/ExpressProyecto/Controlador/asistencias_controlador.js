const asistenciaModel = require('../Modelo/asistencia');

function esDuplicado(error){
    return error.code === 'ER_DUP_ENTRY' || error.code === '23505';
}

async function listarAsistencias(req, res) {
    try {
        const asistencias = await asistenciaModel.listar();
        res.json(asistencias);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function registrarAsistenciaEnElTaller(req, res) {
    const { usuario_id, taller_id, estado } = req.body;
    if (!usuario_id || !taller_id) {
        return res.status(400).json({ error: 'usuario_id y taller_id son obligatorios para registrar la asistencia' });
    }

    try {
        const asistencia = await asistenciaModel.registrarAsistenciaEnElTaller({ usuario_id, taller_id, estado });
        res.status(201).json(asistencia);
    } catch (error) {
        if (esDuplicado(error)) return res.status(409).json({ error: 'La asistencia de este usuario para este taller ya fue registrada' });
        res.status(500).json({ error: error.message });
    }
}

async function consultarListaDeAsistencia(req, res) {
    const { taller_id } = req.params;
    try {
        const lista = await asistenciaModel.consultarListaDeAsistencia(taller_id);
        res.json(lista);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = { listarAsistencias, registrarAsistenciaEnElTaller, consultarListaDeAsistencia };