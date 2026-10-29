import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import TarjetaTaller from "../../components/TarjetaTaller";
import { pedirJSON } from "../../lib/api";
import estilos from "../../styles/Talleres.module.css";
import gestion from "../../styles/Gestion.module.css";

export default function Talleres() {
  const [talleres, setTalleres] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [instructor, setInstructor] = useState("");
  const [cupo, setCupo] = useState("15");
  const [enviando, setEnviando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState("");
  const [exito, setExito] = useState("");

  const hoy = new Date();
  const fechaMinima = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  const cargarTalleres = useCallback(async () => {
    try {
      const datos = await pedirJSON("/talleres");
      if (!Array.isArray(datos)) {
        throw new Error("La respuesta del backend no tiene el formato esperado.");
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

  async function crearTaller(evento) {
    evento.preventDefault();
    setErrorFormulario("");
    setExito("");

    if (/\p{N}/u.test(instructor.trim())) {
      setErrorFormulario("El nombre del instructor no puede contener números.");
      return;
    }
    if (fecha < fechaMinima) {
      setErrorFormulario("La fecha de inicio no puede ser anterior al día actual.");
      return;
    }
    if (fecha > "2030-12-31") {
      setErrorFormulario("La fecha de inicio no puede ser posterior al año 2030.");
      return;
    }

    setEnviando(true);

    try {
      await pedirJSON("/talleres", {
        method: "POST",
        body: JSON.stringify({ nombre, descripcion, fecha, instructor, cupo }),
      });
      setNombre("");
      setDescripcion("");
      setFecha("");
      setInstructor("");
      setCupo("15");
      setExito("Taller creado correctamente.");
      await cargarTalleres();
    } catch (err) {
      setErrorFormulario(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const texto = busqueda.trim().toLowerCase();
  const visibles = talleres.filter((taller) =>
    `${taller.nombre}${taller.descripcion || ""}${taller.instructor || ""}`
      .toLowerCase()
      .includes(texto),
  );

  return (
    <>
      <Head>
        <title>Talleres | Mini proyecto</title>
      </Head>
      <main>
        <h1>Talleres</h1>
        <section className={estilos.panel}>
          <h2>Crear taller</h2>
          <form onSubmit={crearTaller} className={gestion.campos}>
            <label className={gestion.campo}>
              Nombre
              <input
                required
                maxLength={150}
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
              />
            </label>
            <label className={gestion.campo}>
              Descripción
              <textarea
                value={descripcion}
                onChange={(evento) => setDescripcion(evento.target.value)}
              />
            </label>
            <label className={gestion.campo}>
              Fecha de inicio
              <input
                required
                type="date"
                min={fechaMinima}
                max="2030-12-31"
                value={fecha}
                onChange={(evento) => setFecha(evento.target.value)}
              />
            </label>
            <label className={gestion.campo}>
              Instructor
              <input
                required
                maxLength={100}
                pattern="[^0-9]*"
                title="El nombre del instructor no puede contener números."
                value={instructor}
                onChange={(evento) => setInstructor(evento.target.value)}
              />
            </label>
            <label className={gestion.campo}>
              Cupo
              <input
                required
                type="number"
                min="1"
                step="1"
                value={cupo}
                onChange={(evento) => setCupo(evento.target.value)}
              />
            </label>
            <button className={gestion.boton} type="submit" disabled={enviando}>
              {enviando ? "Creando…" : "Crear taller"}
            </button>
          </form>
          {errorFormulario && (
            <p className="error" role="alert">
              {errorFormulario}
            </p>
          )}
          {exito && (
            <p className={estilos.exito} role="status">
              {exito}
            </p>
          )}
        </section>
        <input
          className={estilos.buscador}
          type="search"
          placeholder="Buscar por nombre o instructor"
          aria-label="Buscar talleres por nombre o instructor"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
        />
        {cargando && <p>Cargando talleres…</p>}
        {error && <p className="error">{error}</p>}
        {!cargando && !error && talleres.length === 0 && (
          <p>No hay talleres registrados.</p>
        )}
        {!cargando && !error && talleres.length > 0 && visibles.length === 0 && (
          <p>No hay talleres que coincidan con la búsqueda.</p>
        )}
        {!error && visibles.length > 0 && (
          <div className={estilos.rejilla}>
            {visibles.map((taller) => (
              <TarjetaTaller key={taller.id} taller={taller} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
