import Head from "next/head";
import Link from "next/link";
import estilos from "../styles/Inicio.module.css";

const secciones = [
  {
    href: "/talleres",
    titulo: "Talleres",
    descripcion: "Consulta los talleres y registra nuevos.",
  },
  {
    href: "/asistencia",
    titulo: "Asistencia",
    descripcion: "Registra y consulta la asistencia de cada taller.",
  },
  {
    href: "/usuarios",
    titulo: "Usuarios",
    descripcion: "Consulta y agrega usuarios.",
  },
  {
    href: "/perfil",
    titulo: "Mi perfil",
    descripcion: "Busca tus talleres con tu número de boleta.",
  },
];

export default function Inicio() {
  return (
    <>
      <Head>
        <title>Inicio | Talleres</title>
        <meta
          name="description"
          content="Administración de talleres, usuarios y asistencias."
        />
      </Head>
      <main>
        <section className={estilos.presentacion}>
          <p className={estilos.eyebrow}>Programación Web</p>
          <h1>Esto es un ejemplo de Página Principal con Next</h1>
          <p>
            Administra los talleres, consulta a sus participantes y registra la
            asistencia desde un solo lugar.
          </p>
        </section>
        <section aria-label="Secciones del sistema" className={estilos.secciones}>
          {secciones.map((seccion) => (
            <Link
              className={estilos.tarjeta}
              href={seccion.href}
              key={seccion.href}
            >
              <h2>{seccion.titulo}</h2>
              <p>{seccion.descripcion}</p>
              <span>Ir a {seccion.titulo.toLowerCase()} →</span>
            </Link>
          ))}
        </section>
      </main>
    </>
  );
}
