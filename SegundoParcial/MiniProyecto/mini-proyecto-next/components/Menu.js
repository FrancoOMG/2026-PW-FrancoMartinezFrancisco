import Link from "next/link";
import estilos from "./Menu.module.css";

export default function Menu() {
  return (
    <header className={estilos.encabezado}>
      <nav aria-label="Navegación principal" className={estilos.navegacion}>
        <Link href="/">Inicio</Link>
        <Link href="/talleres">Talleres</Link>
        <Link href="/asistencia">Asistencia</Link>
        <Link href="/usuarios">Usuarios</Link>
        <Link href="/perfil">Mi perfil</Link>
      </nav>
    </header>
  );
}
