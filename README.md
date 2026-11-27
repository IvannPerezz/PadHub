# PadHub

Hub ligero para mandos de terceros (Manba, Machenike…) en Windows. Rust + Tauri 2;
la interfaz es HTML/CSS/JS sin dependencias, en `ui/`.

## Qué hace
- Detecta los mandos XInput conectados (cable, 2.4G o Bluetooth) y los identifica
  por VID/PID, por el receptor 2.4G que hay en el mismo puerto USB o por nombre.
  Si no lo reconoce, se le puede asignar el modelo a mano (Info → Modelo).
- **Sticks:** posición cruda en directo, simulador de zona muerta, drift y circularidad.
- **Gatillos:** recorrido, máximo alcanzado y número de niveles.
- **Botones** y **vibración**: tests.
- **Batería:** la que reporte XInput (los receptores que imitan un Xbox 360 con cable no la dan).
- **Diagnóstico HID** (icono ☰).
- **Actualizaciones automáticas** desde GitHub Releases (píldora "Actualización pendiente").

## Soporte por modelo
| Modelo | Detección y tests | Configurar el mando |
|---|---|---|
| Manba One V2 | Sí | No (se hace en su pantalla) |
| Machenike G3 V2 / G5 Pro | Sí | Pendiente: capturar Keylinker → `GUIA-KEYLINKER.md` |

## Recursos opcionales (no incluidos)
Las fotos de los mandos y la fuente SF Pro Display son de terceros y **no se
distribuyen** en este repositorio. La app los busca en:

```
%APPDATA%\PadHub\recursos\img\     (manba-blanco.webp, front-negro.webp, g3-azul.webp…)
%APPDATA%\PadHub\recursos\fonts\   (sf-pro-display-400.otf … 700.otf)
```

Si no están, usa la fuente del sistema y dibujos vectoriales propios.

## Compilar
```
cd src-tauri
cargo build --release      # target/release/padhub.exe
```

## Publicar una versión
Requiere la clave de firma en `%USERPROFILE%\.tauri\padhub.key` (nunca en el repo)
y `gh` con sesión iniciada.
```
.\release.ps1 -Version 0.1.1 -Notes "Qué cambia"
```
Compila el instalador firmado, genera `latest.json`, crea el tag y la release.
Las apps instaladas ven la versión nueva en menos de 30 minutos (o al abrirse).
