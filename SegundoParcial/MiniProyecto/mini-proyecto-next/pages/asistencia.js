import Head from "next/head";
import { useCallback, useEffect, useMemo, useState } from "react";
import { pedirJSON } from "../lib/api";
import { ocultarBoleta } from "../lib/formato";
import estilos from "../styles/Gestion.module.css";
import talleresEstilos from "../styles/Talleres.module.css";

function obtenerFechaLocal() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

export default function Asistencia() {
  const [talleres, setTalleres] = useState([]);
  const [tallerId, setTallerId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [fecha, setFecha] = useState(obtenerFechaLocal);
  const [asistencias, setAsistencias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  const cargarTalleres = useCallback(async () => {
    try {
      const datos = await pedirJSON("/talleres");
      if (!Array.isArray(datos)) {
        throw new Error("La respuesta de talleres no tiene el formato esperado.");
      }
      setTalleres(datos);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarTalleres();
  }, [cargarTalleres]);

  const cargarAsistencias = useCallback(async () => {
    if (!tallerId) {
      setAsistencias([]);
      setUsuarioId("");
      return;
    }

    setCargandoLista(true);
    try {
      const datos = await pedirJSON(`/asistencia?taller_id=${encodeURIComponent(tallerId)}`);
      if (!Array.isArray(datos)) {
        throw new Error("La respuesta de asistencias no tiene el formato esperado.");
      }
      setAsistencias(datos);
      setUsuarioId("");
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoLista(false);
    }
  }, [tallerId]);

  useEffect(() => {
    cargarAsistencias();
  }, [cargarAsistencias]);

  const usuariosInscritos = useMemo(
    () =>
      Array.from(
        new Map(
          asistencias.map((asistencia) => [
            String(asistencia.usuario_id),
            asistencia,
          ]),
        ).values(),
      ),
    [asistencias],
  );

  async function registrarAsistencia(evento) {
    evento.preventDefault();
    setError("");
    setExito("");
    setGuardando(true);

    try {
      await pedirJSON("/asistencia", {
        method: "POST",
        body: JSON.stringify({
          taller_id: tallerId,
          usuario_id: usuarioId,
          fecha,
        }),
      });
      setExito("Asistencia registrada correctamente.");
      await cargarAsistencias();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Head>
        <title>Asistencia | Talleres</title>
      </Head>
      <main>
        <h1>Asistencia</h1>
        {cargando ? (
          <p>Cargando talleres…</p>
        ) : talleres.length === 0 ? (
          <p>No hay talleres disponibles para registrar asistencia.</p>
        ) : (
          <>
            <section className={talleresEstilos.panel}>
              <h2>Registrar asistencia</h2>
              <form
                onSubmit={registrarAsistencia}
                className={estilos.campos}
              >
                <label className={estilos.campo}>
                  Taller
                  <select
                    required
                    value={tallerId}
                    onChange={(evento) => {
                      setTallerId(evento.target.value);
                      setUsuarioId("");
                      setError("");
                      setExito("");
                    }}
                  >
                    <option value="">Selecciona un taller</option>
                    {talleres.map((taller) => (
                      <option key={taller.id} value={taller.id}>
                        {taller.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={estilos.campo}>
                  Usuario inscrito
                  <select
                    required
                    value={usuarioId}
                    onChange={(evento) => setUsuarioId(evento.target.value)}
                    disabled={!tallerId || cargandoLista}
                  >
                    <option value="">Selecciona un usuario</option>
                    {usuariosInscritos.map((asistencia) => (
                      <option
                        key={asistencia.usuario_id}
                        value={asistencia.usuario_id}
                      >
                        {asistencia.nombre_alumno} ({asistencia.boleta})
                      </option>
                    ))}
                  </select>
                </label>
                <label className={estilos.campo}>
                  Fecha
                  <input
                    required
                    type="date"
                    value={fecha}
                    onChange={(evento) => setFecha(evento.target.value)}
                  />
                </label>
                <button
                  className={estilos.boton}
                  type="submit"
                  disabled={
                    guardando ||
                    cargandoLista ||
                    !tallerId ||
                    usuariosInscritos.length === 0
                  }
                >
                  {guardando ? "Registrando…" : "Registrar asistencia"}
                </button>
              </form>
              {tallerId &&
                !cargandoLista &&
                usuariosInscritos.length === 0 && (
                  <p className={estilos.mensaje}>
                    Este taller todavía no tiene usuarios inscritos.
                  </p>
                )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              {exito && (
                <p className={talleresEstilos.exito} role="status">
                  {exito}
                </p>
              )}
            </section>

            <h2>Asistencias registradas</h2>
            {!tallerId ? (
              <p>Selecciona un taller para consultar sus asistencias.</p>
            ) : cargandoLista ? (
              <p>Cargando asistencias…</p>
            ) : asistencias.length === 0 ? (
              <p>No hay asistencias registradas para este taller.</p>
            ) : (
              <div className={estilos.tablaContenedor}>
                <table className={estilos.tabla}>
                  <thead>
                    <tr>
                      <th scope="col">Nombre</th>
                      <th scope="col">Boleta</th>
                      <th scope="col">Fecha</th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asistencias.map((asistencia) => (
                      <tr key={asistencia.id}>
                        <td>{asistencia.nombre_alumno}</td>
                        <td>{ocultarBoleta(asistencia.boleta)}</td>
                        <td>{asistencia.fecha}</td>
                        <td>{asistencia.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        {!cargando && error && !talleres.length && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </main>
    </>
  );
}
