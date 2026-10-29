export function validarBoleta(boleta) {
  return /^\d{10}$/.test(String(boleta));
}
