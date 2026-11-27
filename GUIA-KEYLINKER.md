# Captura del protocolo de Keylinker (mandos Machenike)

Objetivo: grabar lo que la app **Keylinker** (móvil) le envía al mando cuando
cambias un ajuste, para que PadHub pueda hacer lo mismo desde el PC.

No modifica el mando ni el móvil: solo se graba el tráfico Bluetooth.

## Lo que necesitas
- Un móvil **Android** con Keylinker instalado (en iPhone no se puede capturar).
- El mando (G3 V2 o G5 Pro) emparejado con el móvil por **Bluetooth**.

## 1. Activar el registro Bluetooth
1. Ajustes → Información del teléfono → pulsa 7 veces en **Número de compilación**.
2. Ajustes → Sistema → **Opciones de desarrollador**.
3. Activa **Registro de rastreo HCI de Bluetooth** (en algunos móviles: “Habilitado”).
4. Apaga y enciende el Bluetooth para que empiece a grabar.

## 2. Grabar los cambios (uno a uno y apuntando la hora)
Abre Keylinker con el mando conectado y haz **un cambio cada vez**, esperando unos
5 segundos entre uno y otro. Apunta qué hiciste y a qué hora (con segundos):

| Hora     | Acción                                            |
|----------|---------------------------------------------------|
| 18:02:10 | Abrir la app y conectar el mando                   |
| 18:02:30 | Zona muerta stick izquierdo: 0 → 10               |
| 18:02:40 | Zona muerta stick izquierdo: 10 → 20              |
| 18:02:50 | Remapear A → B                                     |
| 18:03:00 | Deshacer el remapeo (B → A)                        |
| 18:03:10 | Vibración: cambiar intensidad                      |
| 18:03:20 | Cambiar de perfil                                  |
| 18:03:30 | Mirar batería / versión de firmware (si sale)      |

Cuanto más ordenado, más fácil es descifrarlo. Valores “de 0 a 10 a 20” ayudan
mucho a ver qué byte cambia.

**No actualices el firmware durante la captura.**

## 3. Sacar el archivo
- **Forma fácil:** Opciones de desarrollador → **Crear informe de errores**
  → informe completo. Se genera un `.zip`; el archivo que interesa está dentro,
  en `FS/data/misc/bluetooth/logs/btsnoop_hci.log` (o una ruta parecida).
- **Con PC (adb):** `adb bugreport captura.zip`

Pásame el `.zip` (o solo el `btsnoop_hci.log`) junto con la tabla de horas.

## Plan B: si Keylinker usa cable USB en vez de Bluetooth
Si el mando solo se configura conectado por cable al móvil, el registro
Bluetooth no lo verá. En ese caso:
- Comprobar en global.machenike.com si hay versión de Keylinker para Windows
  (el manual del G5 Pro menciona un programa de configuración para PC). Si existe,
  se captura en el PC con **USBPcap + Wireshark**.
- Si no, se puede probar con un emulador de Android en el PC que pase el USB al
  mando y capturar con USBPcap.

## Qué pasa después
Con la captura se identifica:
1. El canal (servicio BLE o informe HID “de fabricante”) que usa Keylinker.
2. El formato de cada comando (cabecera, número de ajuste, valor, checksum).
3. Si el mando responde con datos útiles (batería, firmware, ajustes actuales).

Con eso se activa la pestaña **Configuración** de PadHub para ese modelo,
empezando por **leer** los ajustes (sin riesgo) y solo después **escribirlos**.
