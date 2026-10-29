import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { pedirJSON } from "../lib/api";
import { formatearFecha } from "../lib/formato";
import { validarBoleta } from "../lib/validaciones";
import estilos from "../styles/Talleres.module.css";

export default function Perfil() {
  const [boleta, setBoleta] = useState("");
  const [buscada, setBuscada] = useState("");
  const [alumno, setAlumno] = useState(null);
  const [nombreInscrito, setNombreInscrito] = useState("");
  const [misTalleres, setMisTalleres] = useState([]);
  const [disponibles, setDisponibles] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function buscar(evento) {
    evento.preventDefault();
    setError("");
    setBuscada("");
    const valorBoleta = boleta.trim();
    if (!validarBoleta(valorBoleta)) {
      return setError("La boleta debe tener 10 dígitos.");
    }

    setCargando(true);
    try {
      const usuarios = await pedirJSON("/usuarios");
      const talleres = await pedirJSON("/talleres");
      if (!Array.isArray(usuarios) || !Array.isArray(talleres)) {
        throw new Error("La respuesta del backend no tiene el formato esperado.");
      }

      const listas = await Promise.all(
        talleres.map((taller) =>
          pedirJSON(`/talleres/${taller.id}/asistencias`),
        ),
      );
      if (!listas.every(Array.isArray)) {
        throw new Error("La respuesta de asistencias no tiene el formato esperado.");
      }

      const conAsistencias = talleres.map((taller, indice) => ({
        ...taller,
        asistencias: listas[indice],
      }));
      const mios = conAsistencias.filter((taller) =>
        taller.asistencias.some(
          (asistencia) => String(asistencia.boleta) === valorBoleta,
        ),
      );
      const conLugar = conAsistencias.filter(
        (taller) =>
          !mios.includes(taller) &&
          taller.asistencias.length < taller.cupo,
      );
      const inscripcion =
        mios.length > 0
          ? mios[0].asistencias.find(
              (asistencia) => String(asistencia.boleta) === valorBoleta,
            )
          : null;

      setAlumno(
        usuarios.find(
          (usuario) => String(usuario.boleta) === valorBoleta,
        ) || null,
      );
      setNombreInscrito(inscripcion ? inscripcion.nombre_alumno : "");
      setMisTalleres(mios);
      setDisponibles(conLugar);
      setBuscada(valorBoleta);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  const nombre = alumno ? alumno.nombre : nombreInscrito;

  return (
    <>
      <Head>
        <title>Mi perfil | Talleres</title>
      </Head>
      <main>
        <h1>Mi perfil</h1>
        <form onSubmit={buscar} className="formulario">
          <input
            aria-label="Tu boleta"
            placeholder="Tu boleta (10 dígitos)"
            value={boleta}
            onChange={(evento) => setBoleta(evento.target.value)}
          />
          <button type="submit" disabled={cargando}>
            {cargando ? "Buscando…" : "Ver mi perfil"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
        {buscada && (
          <>
            <section className={estilos.panel}>
              {alumno ? (
                <>
                  <h2>{alumno.nombre}</h2>
                  <p>
                    <strong>Correo:</strong> {alumno.correo}
                  </p>
                  <p>
                    <strong>Boleta:</strong> {alumno.boleta}
                  </p>
                  <p>
                    <strong>Rol:</strong> {alumno.rol}
                  </p>
                </>
              ) : (
                <p>
                  La boleta {buscada} no tiene cuenta registrada
                  {nombreInscrito
                    ? ` (inscripciones a nombre de ${nombreInscrito})`
                    : ""}
                  . Aun así puedes inscribirte en un taller.
                </p>
              )}
            </section>
            <h2>Mis talleres ({misTalleres.length})</h2>
            {misTalleres.length === 0 ? (
              <p>Todavía no estás inscrito en ningún taller.</p>
            ) : (
              <ul className={estilos.lista}>
                {misTalleres.map((taller) => (
                  <li key={taller.id}>
                    <Link href={`/talleres/${taller.id}`}>{taller.nombre}</Link>{" "}
                    — {formatearFecha(taller.fecha)}
                  </li>
                ))}
              </ul>
            )}
            <h2>Talleres con lugar disponible</h2>
            {disponibles.length === 0 ? (
              <p>No hay más talleres con lugar.</p>
            ) : (
              <ul className={estilos.lista}>
                {disponibles.map((taller) => {
                  const lugares = taller.cupo - taller.asistencias.length;
                  return (
                    <li key={taller.id}>
                      {taller.nombre} — {lugares}{" "}
                      {lugares === 1 ? "lugar" : "lugares"} ·{" "}
                      <Link
                        href={`/talleres/${taller.id}?boleta=${buscada}&nombre=${encodeURIComponent(nombre)}`}
                      >
                        Inscribirme
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </main>
    </>
  );
}
