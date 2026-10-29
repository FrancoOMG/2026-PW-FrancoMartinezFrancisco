# Backend de talleres

Este servidor guarda los talleres, usuarios y asistencias en MySQL (`cecyt9_local`).
Al iniciarse agrega los datos de ejemplo de la guía solamente si la tabla
`talleres` está vacía; no borra los datos que ya existan. También agrega la
columna `instructor` a `talleres` si todavía no está creada.

## Preparar MySQL

1. Inicia el servicio MySQL.
2. Ejecuta el script SQL que crea `cecyt9_local` y sus tablas.
3. En PowerShell, desde esta carpeta, configura las credenciales de tu MySQL y
   arranca el servidor:

```powershell
$env:DB_USER = "root"
$env:DB_PASSWORD = "tu_contraseña_de_MySQL"
npm start
```

Si tu instalación usa otros valores, también puedes configurar `DB_HOST`,
`DB_PORT` y `DB_NAME`. El servidor queda disponible en `http://localhost:3001`.
Conserva abierta esa terminal mientras uses el front.

El front incluye inicio, talleres, usuarios, asistencia y perfil. Las rutas
`POST /api/talleres` y `POST /api/usuarios` guardan nuevos registros en MySQL.
En `/asistencia`, el registro corresponde a un usuario ya inscrito en el taller:
se actualiza el estado y la fecha de su fila en `asistencia`, sin duplicarla.

Para comprobar que los talleres quedaron guardados, ejecuta en MySQL:

```sql
USE cecyt9_local;
SELECT id, nombre, instructor, fecha, cupo FROM talleres ORDER BY id;
SELECT * FROM asistencia ORDER BY id;
```

La columna `instructor` es una migración compatible con la tabla `talleres` del
script de la actividad. El usuario invitado para la boleta `2026999999` permite
guardar su asistencia con la clave foránea de `asistencia`; no aparece en la
ruta pública de usuarios.
