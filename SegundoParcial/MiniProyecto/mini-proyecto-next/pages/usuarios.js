import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import { pedirJSON } from "../lib/api";
import { ocultarBoleta } from "../lib/formato";
import estilos from "../styles/Gestion.module.css";
import talleresEstilos from "../styles/Talleres.module.css";

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [boleta, setBoleta] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState("");

  const cargarUsuarios = useCallback(async () => {
    try {
      const datos = await pedirJSON("/usuarios");
      if (!Array.isArray(datos)) {
        throw new Error("La respuesta de usuarios no tiene el formato esperado.");
      }
      setUsuarios(datos);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarUsuarios();
  }, [cargarUsuarios]);

  async function crearUsuario(evento) {
    evento.preventDefault();
    setError("");
    setExito("");
    setGuardando(true);

    try {
      await pedirJSON("/usuarios", {
        method: "POST",
        body: JSON.stringify({ nombre, correo, contrasena, boleta }),
      });
      setNombre("");
      setCorreo("");
      setContrasena("");
      setBoleta("");
      setExito("Usuario creado correctamente.");
      await cargarUsuarios();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Head>
        <title>Usuarios | Talleres</title>
      </Head>
      <main>
        <h1>Usuarios</h1>
        <section className={talleresEstilos.panel}>
          <h2>Crear usuario</h2>
          <form onSubmit={crearUsuario} className={estilos.campos}>
            <label className={estilos.campo}>
              Nombre
              <input
                autoComplete="name"
                required
                maxLength={100}
                pattern="[^0-9]*"
                title="El nombre no puede contener números."
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
              />
            </label>
            <label className={estilos.campo}>
              Correo
              <input
                type="email"
                autoComplete="email"
                required
                maxLength={100}
                value={correo}
                onChange={(evento) => setCorreo(evento.target.value)}
              />
            </label>
            <label className={estilos.campo}>
              Contraseña (mínimo 8 caracteres)
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={contrasena}
                onChange={(evento) => setContrasena(evento.target.value)}
              />
            </label>
            <label className={estilos.campo}>
              Boleta (10 dígitos)
              <input
                inputMode="numeric"
                pattern="[0-9]{10}"
                maxLength={10}
                required
                value={boleta}
                onChange={(evento) => setBoleta(evento.target.value)}
              />
            </label>
            <button
              className={estilos.boton}
              type="submit"
              disabled={guardando}
            >
              {guardando ? "Creando…" : "Crear usuario"}
            </button>
          </form>
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

        {cargando ? (
          <p>Cargando usuarios…</p>
        ) : usuarios.length === 0 && !error ? (
          <p>No hay usuarios registrados.</p>
        ) : (
          <div className={estilos.tablaContenedor}>
            <table className={estilos.tabla}>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Correo</th>
                  <th scope="col">Boleta</th>
                  <th scope="col">Rol</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((usuario) => (
                  <tr key={usuario.id}>
                    <td>{usuario.nombre}</td>
                    <td>{usuario.correo}</td>
                    <td>{ocultarBoleta(usuario.boleta)}</td>
                    <td>{usuario.rol}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
