const formatoFecha = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function fechaLocal(fecha) {
  if (fecha instanceof Date) {
    return Number.isNaN(fecha.getTime()) ? null : new Date(fecha.getTime());
  }

  if (typeof fecha !== "string") return null;

  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!coincidencia) return null;

  const [, anio, mes, dia] = coincidencia;
  const resultado = new Date(Number(anio), Number(mes) - 1, Number(dia));
  if (
    resultado.getFullYear() !== Number(anio) ||
    resultado.getMonth() !== Number(mes) - 1 ||
    resultado.getDate() !== Number(dia)
  ) {
    return null;
  }

  return resultado;
}

export function formatearFecha(fecha) {
  const valor = fechaLocal(fecha);
  return valor ? formatoFecha.format(valor) : "Fecha no disponible";
}

export function yaPaso(fecha) {
  const valor = fechaLocal(fecha);
  if (!valor) return false;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  valor.setHours(0, 0, 0, 0);
  return valor < hoy;
}

export function ocultarBoleta(boleta) {
  const valor = String(boleta ?? "");
  return `${"*".repeat(Math.max(0, valor.length - 4))}${valor.slice(-4)}`;
}
