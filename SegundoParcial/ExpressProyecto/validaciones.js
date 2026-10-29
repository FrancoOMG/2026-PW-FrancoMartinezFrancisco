
// Función para validar el correo institucional o general 
function validarCorreo(correo) {
    if (typeof correo !== 'string') return false;
    // Expresión regular estándar para verificar formato de correo
    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regexCorreo.test(correo);
}

// Función para validar la boleta 
function validarBoleta(boleta) {
   
    const boletaStr = String(boleta);
    if (typeof boletaStr !== 'string') return false;
    
    // Valida que tenga exactamente 10 dígitos numéricos
    const regexBoleta = /^\d{10}$/;
    return regexBoleta.test(boletaStr);
}

// Función para validar la contraseña (mínimo 8 caracteres)
function validarContrasena(contrasena) {
    if (typeof contrasena !== 'string') return false;
    return contrasena.length >= 8;
}

function validarNombreUsuario(nombre) {
    if (typeof nombre !== 'string') return false;
    const nombreLimpio = nombre.trim();
    return (
        nombreLimpio.length > 0 &&
        nombreLimpio.length <= 100 &&
        !/\p{N}/u.test(nombreLimpio)
    );
}

function validarNombreTaller(nombre) {
    if (typeof nombre !== 'string') return false;
    const nombreLimpio = nombre.trim();
    return nombreLimpio.length > 0 && nombreLimpio.length <= 150;
}

function validarNombreInstructor(nombre) {
    if (typeof nombre !== 'string') return false;
    const nombreLimpio = nombre.trim();
    return (
        nombreLimpio.length > 0 &&
        nombreLimpio.length <= 100 &&
        !/\p{N}/u.test(nombreLimpio)
    );
}

// Siempre es necesario exportar las funciones para poder usarlas en los controladores
module.exports = { 
    validarCorreo, 
    validarBoleta, 
    validarContrasena,
    validarNombreUsuario,
    validarNombreTaller,
    validarNombreInstructor,
};
