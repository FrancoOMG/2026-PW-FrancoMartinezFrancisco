
const talleresModel = require('../Modelo/tallere');

// Función auxiliar para detectar duplicados
function esDuplicado(error){
    return error.code === 'ER_DUP_ENTRY' || error.code === '23505';
}

async function listarTalleres(req, res) {
    try {
        const talleres = await talleresModel.listar();
        res.json(talleres);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function consultarPorTaller(req, res) {
    try {
        const taller = await talleresModel.consultarportaller(req.params.id);
        if (!taller) return res.status(404).json({ error: 'Taller no encontrado' });
        res.json(taller);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function crearTaller(req, res) {
    const { nombre, descripcion, fecha, cupo } = req.body;
    if (!nombre || !fecha || !cupo) {
        return res.status(400).json({ error: 'Nombre, fecha y cupo son obligatorios, favor de verificar los datos' });
    }

    try {
        const taller = await talleresModel.crear({ nombre, descripcion, fecha, cupo });
        res.status(201).json(taller);
    } catch (error) {
        if (esDuplicado(error)) return res.status(409).json({ error: 'Ya existe un taller con ese nombre' });
        res.status(500).json({ error: error.message });
    }
}

async function registrarseEnUnTaller(req, res) {
    const { usuario_id, taller_id } = req.body;
    if (!usuario_id || !taller_id) {
        return res.status(400).json({ error: 'El usuario_id y el taller_id son obligatorios para el registro' });
    }

    try {
        const registrado = await talleresModel.registrarseEnUnTaller({ usuario_id, taller_id });
        if (!registrado) return res.status(400).json({ error: 'No se pudo completar el registro al taller' });
        res.status(201).json({ mensaje: 'Registro al taller exitoso' });
    } catch (error) {
        if (esDuplicado(error)) return res.status(409).json({ error: 'El usuario ya se encuentra registrado en este taller' });
        res.status(500).json({ error: error.message });
    }
}

module.exports = { listarTalleres, consultarPorTaller, crearTaller, registrarseEnUnTaller };