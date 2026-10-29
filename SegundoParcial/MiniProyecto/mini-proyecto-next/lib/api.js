const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const BACKEND_CAIDO = "El backend no responde. Verifica que esté encendido.";

export async function pedirJSON(ruta, opciones = {}) {
  let res;

  try {
    res = await fetch(`${API_URL}/api${ruta}`, {
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        ...opciones.headers,
      },
    });
  } catch {
    throw new Error(BACKEND_CAIDO);
  }

  let datos = null;
  try {
    datos = await res.json();
  } catch {
    datos = null;
  }

  if (!res.ok) {
    if (datos && datos.error) throw new Error(datos.error);
    throw new Error(
      res.status === 500 ? BACKEND_CAIDO : `El backend respondió ${res.status}`,
    );
  }

  return datos;
}
