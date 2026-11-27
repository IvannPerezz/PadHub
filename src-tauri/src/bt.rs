//! Mandos por Bluetooth que se presentan como mando Pro de Switch (057E:2009).
//! Así lo hacen, por ejemplo, el Manba One V2 y muchos mandos de terceros.
//!
//! Al conectar se envía el subcomando estándar 0x03 (argumento 0x30) para que
//! el mando mande informes completos, que incluyen la batería. Es lo mismo que
//! hacen SDL y Steam; no toca la configuración del mando.

use crate::pads::PadLive;
use std::collections::HashMap;
use std::ffi::CString;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub const VID: u16 = 0x057E;
pub const PID: u16 = 0x2009;

#[derive(Default)]
pub struct BtState {
    pub live: PadLive,
    /// (nivel 0..=8 en pasos de 2, cargando)
    pub battery: Option<(u8, bool)>,
    pub alive: bool,
    pub last: Option<Instant>,
}

pub type Shared = Arc<Mutex<BtState>>;

/// Lanza un hilo que lee el mando hasta que se desconecta.
pub fn spawn(path: CString) -> Shared {
    let st: Shared = Arc::new(Mutex::new(BtState { alive: true, ..Default::default() }));
    let out = st.clone();
    std::thread::Builder::new()
        .name("bt-pad".into())
        .spawn(move || {
            run(path, &st);
            st.lock().unwrap().alive = false;
        })
        .ok();
    out
}

fn full_mode_cmd(counter: u8) -> [u8; 49] {
    let mut out = [0u8; 49];
    out[..12].copy_from_slice(&[0x01, counter, 0x00, 0x01, 0x40, 0x40, 0x00, 0x01, 0x40, 0x40, 0x03, 0x30]);
    out
}

fn stick(b: &[u8]) -> [f32; 2] {
    let x = b[0] as u16 | ((b[1] as u16 & 0x0F) << 8);
    let y = (b[1] as u16 >> 4) | ((b[2] as u16) << 4);
    let n = |v: u16| ((v as f32 - 2048.0) / 1600.0).clamp(-1.0, 1.0);
    [n(x), n(y)]
}

fn run(path: CString, st: &Shared) {
    let Ok(api) = hidapi::HidApi::new() else { return };
    let Ok(dev) = api.open_path(&path) else { return };
    let mut counter: u8 = 0;
    let _ = dev.write(&full_mode_cmd(counter));
    let mut buf = [0u8; 128];
    let mut last_cmd = Instant::now();
    let mut last_ok = Instant::now();
    // Bits que llegan fijos desde el principio (algunos clones dejan uno activo):
    // se ignoran hasta que se suelten por primera vez.
    let mut stuck: u32 = u32::MAX;
    let mut seen = 0u32;

    loop {
        match dev.read_timeout(&mut buf, 100) {
            Err(_) => return,
            Ok(0) => {
                if last_ok.elapsed() > Duration::from_secs(5) {
                    return;
                }
            }
            Ok(n) if n >= 12 && (buf[0] == 0x30 || buf[0] == 0x21) => {
                last_ok = Instant::now();
                let raw = buf[3] as u32 | (buf[4] as u32) << 8 | (buf[5] as u32) << 16;
                if seen < 15 {
                    stuck &= raw;
                    seen += 1;
                } else {
                    stuck &= raw; // en cuanto un bit se suelta, deja de ignorarse
                }
                let b = raw & !stuck;
                let on = |m: u32| b & m != 0;
                let mut buttons = HashMap::new();
                // Distribución Nintendo -> posición equivalente en Xbox
                for (mask, name) in [
                    (0x000008, "b"),    // A (derecha)
                    (0x000004, "a"),    // B (abajo)
                    (0x000002, "y"),    // X (arriba)
                    (0x000001, "x"),    // Y (izquierda)
                    (0x000040, "rb"),   // R
                    (0x000100, "view"), // -
                    (0x000200, "menu"), // +
                    (0x000400, "r3"),
                    (0x000800, "l3"),
                    (0x001000, "home"),
                    (0x010000, "down"),
                    (0x020000, "up"),
                    (0x040000, "right"),
                    (0x080000, "left"),
                    (0x400000, "lb"),   // L
                ] {
                    if on(mask) {
                        buttons.insert(name, 1.0);
                    }
                }
                let nib = buf[2] >> 4;
                let mut s = st.lock().unwrap();
                s.live = PadLive {
                    ls: stick(&buf[6..9]),
                    rs: stick(&buf[9..12]),
                    lt: if on(0x800000) { 1.0 } else { 0.0 }, // ZL
                    rt: if on(0x000080) { 1.0 } else { 0.0 }, // ZR
                    buttons,
                    rate: 0,
                };
                s.battery = Some((nib & 0x0E, nib & 1 == 1));
                s.last = Some(Instant::now());
            }
            Ok(_) => {
                // Informe básico 0x3F u otro: el mando ha vuelto al modo simple
                // (p. ej. tras reconectar). Se le vuelve a pedir el modo completo.
                if last_cmd.elapsed() > Duration::from_secs(2) {
                    counter = counter.wrapping_add(1) & 0x0F;
                    let _ = dev.write(&full_mode_cmd(counter));
                    last_cmd = Instant::now();
                }
                last_ok = Instant::now();
            }
        }
    }
}

/// Batería aproximada a partir del nivel del protocolo (calibrado con un
/// Manba One V2: nivel 4 ≈ 50 %).
pub fn battery_pct(level: u8) -> u8 {
    match level {
        8.. => 100,
        6 => 75,
        4 => 50,
        2 => 25,
        _ => 5,
    }
}
