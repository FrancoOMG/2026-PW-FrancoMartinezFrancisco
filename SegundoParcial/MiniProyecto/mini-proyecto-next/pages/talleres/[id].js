import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { pedirJSON } from "../../lib/api";
import { ocultarBoleta, formatearFecha } from "../../lib/formato";
import { validarBoleta } from "../../lib/validaciones";
import estilos from "../../styles/Talleres.module.css";

export default function DetalleTaller() {
  const router = useRouter();
  const id = Array.isArray(router.query.id)
    ? router.query.id[0]
    : router.query.id;
  const [taller, setTaller] = useState(null);
  const [asistencias, setAsistencias] = useState([]);
  const [errorCarga, setErrorCarga] = useState("");
  const [nombre, setNombre] = useState("");
  const [boleta, setBoleta] = useState("");
  const [errorForm, setErrorForm] = useState("");
  const [exito, setExito] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setTaller(null);
    setAsistencias([]);
    setErrorCarga("");
    try {
      const datosTaller = await pedirJSON(`/talleres/${id}`);
      const datosAsistencias = await pedirJSON(`/talleres/${id}/asistencias`);
      if (!Array.isArray(datosAsistencias)) {
        throw new Error("La respuesta de asistencias no tiene el formato esperado.");
      }
      setTaller(datosTaller);
      setAsistencias(datosAsistencias);
    } catch (err) {
      setErrorCarga(err.message);
    }
  }, [id]);

  useEffect(() => {
    if (!router.isReady || !id) return;
    if (router.query.boleta) setBoleta(String(router.query.boleta));
    if (router.query.nombre) setNombre(String(router.query.nombre));
    cargar();
  }, [router.isReady, router.query.boleta, router.query.nombre, id, cargar]);

  const ocupados = asistencias.length;
  const libres = taller ? Math.max(0, taller.cupo - ocupados) : 0;
  const lleno = taller !== null && libres === 0;

  async function inscribir(evento) {
    evento.preventDefault();
    setErrorForm("");
    setExito("");

    const nombreLimpio = nombre.trim();
    const boletaLimpia = boleta.trim();
    if (!nombreLimpio) return setErrorForm("Escribe tu nombre.");
    if (!validarBoleta(boletaLimpia)) {
      return setErrorForm("La boleta debe tener 10 dígitos.");
    }
    if (
      asistencias.some(
        (asistencia) => String(asistencia.boleta) === boletaLimpia,
      )
    ) {
      return setErrorForm("Esa boleta ya está inscrita en este taller.");
    }
    if (lleno) return setErrorForm("El taller ya no tiene lugares.");

    setEnviando(true);
    try {
      await pedirJSON("/asistencias", {
        method: "POST",
        body: JSON.stringify({
          taller_id: id,
          nombre_alumno: nombreLimpio,
          boleta: boletaLimpia,
        }),
      });
      setExito(`¡Listo! ${nombreLimpio} quedó inscrito(a) en el taller.`);
      setNombre("");
      setBoleta("");
      await cargar();
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (errorCarga) {
    return (
      <main>
        <Head>
          <title>Error | Talleres</title>
        </Head>
        <p className="error">{errorCarga}</p>
        <Link className={estilos.volver} href="/talleres">
          ← Volver a talleres
        </Link>
      </main>
    );
  }

  if (!taller) {
    return (
      <main>
        <p>Cargando taller…</p>
      </main>
    );
  }

  const porcentaje =
    taller.cupo > 0 ? Math.min(100, (ocupados / taller.cupo) * 100) : 100;

  return (
    <>
      <Head>
        <title>{taller.nombre} | Talleres</title>
      </Head>
      <main>
        <Link className={estilos.volver} href="/talleres">
          ← Volver a talleres
        </Link>
        <h1>{taller.nombre}</h1>
        <section className={estilos.panel}>
          <p>
            <strong>Instructor:</strong> {taller.instructor || "Por confirmar"}
          </p>
          <p>
            <strong>Fecha:</strong> {formatearFecha(taller.fecha)}
          </p>
          <div
            className={estilos.barra}
            role="progressbar"
            aria-label="Lugares ocupados"
            aria-valuemin={0}
            aria-valuemax={taller.cupo}
            aria-valuenow={Math.min(ocupados, taller.cupo)}
          >
            <div
              className={estilos.relleno}
              style={{ width: `${porcentaje}%` }}
            />
          </div>
          <p>
            {ocupados} de {taller.cupo} lugares ocupados ·{" "}
            {lleno ? (
              <span className={estilos.lleno}>Taller lleno</span>
            ) : (
              `${libres} ${libres === 1 ? "lugar libre" : "lugares libres"}`
            )}
          </p>
        </section>
        <section className={estilos.panel}>
          <h2>Inscribirme</h2>
          <form onSubmit={inscribir} className="formulario">
            <input
              aria-label="Nombre completo"
              placeholder="Nombre completo"
              title="El nombre no puede contener números."
              maxLength={100}
              pattern="[^0-9]*"
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
            />
            <input
              aria-label="Boleta"
              placeholder="Boleta (10 dígitos)"
              value={boleta}
              onChange={(evento) => setBoleta(evento.target.value)}
            />
            <button type="submit" disabled={lleno || enviando}>
              {lleno ? "Sin lugares" : enviando ? "Inscribiendo…" : "Inscribirme"}
            </button>
          </form>
          {errorForm && <p className="error">{errorForm}</p>}
          {exito && <p className={estilos.exito}>{exito}</p>}
        </section>
        <h2>Inscritos ({ocupados})</h2>
        {ocupados === 0 ? (
          <p>Todavía no hay inscritos. ¡Sé el primero!</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Nombre</th>
                <th scope="col">Boleta</th>
              </tr>
            </thead>
            <tbody>
              {asistencias.map((asistencia, indice) => (
                <tr key={asistencia.id}>
                  <td>{indice + 1}</td>
                  <td>{asistencia.nombre_alumno}</td>
                  <td>{ocultarBoleta(asistencia.boleta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
