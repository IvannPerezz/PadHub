//! Hilo de entrada: lee los mandos por XInput y publica una instantánea que
//! la interfaz consulta.

use crate::models::{self, Model};
use crate::xinput::{self, XInput};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::mpsc::Receiver;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Serialize, Clone, Debug)]
pub struct Power {
    /// "wired" | "charging" | "discharging" | "charged" | "unknown"
    pub kind: &'static str,
    pub pct: Option<u8>,
}

#[derive(Serialize, Clone, Debug)]
pub struct PadInfo {
    pub id: usize,
    /// Clave estable para recordar el modelo asignado (VID:PID o ranura).
    pub key: String,
    pub name: String,
    pub os_name: String,
    pub vid: Option<u16>,
    pub pid: Option<u16>,
    pub hid_strings: Vec<String>,
    pub power: Power,
    pub rumble: bool,
    pub mapping: &'static str,
    pub model: Model,
    pub identified: bool,
    pub assigned: bool,
    /// Cómo se ha reconocido el modelo.
    pub how: Option<String>,
    /// Otros VID/PID vistos en el mismo puerto USB.
    pub siblings: Vec<String>,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct PadLive {
    pub ls: [f32; 2],
    pub rs: [f32; 2],
    pub lt: f32,
    pub rt: f32,
    pub buttons: HashMap<&'static str, f32>,
    /// Paquetes de estado nuevos por segundo (solo cambian al moverse algo).
    pub rate: u32,
}

#[derive(Default)]
pub struct Snapshot {
    pub pads: Vec<PadInfo>,
    pub live: HashMap<usize, PadLive>,
}

pub enum Cmd {
    Rumble { id: usize, strong: u16, weak: u16, ms: u32 },
    Refresh,
}

pub type Shared = Arc<Mutex<Snapshot>>;
pub type Assignments = Arc<Mutex<HashMap<String, String>>>;

fn axis(v: i16) -> f32 {
    if v < 0 { v as f32 / 32768.0 } else { v as f32 / 32767.0 }
}

fn power(b: Option<xinput::BatteryInfo>) -> Power {
    match b {
        Some(b) if b.kind == 1 => Power { kind: "wired", pct: None },
        Some(b) if b.kind == 2 || b.kind == 3 => {
            let pct = [5u8, 33, 67, 100][b.level.min(3) as usize];
            if pct == 100 { Power { kind: "charged", pct: Some(100) } } else { Power { kind: "discharging", pct: Some(pct) } }
        }
        _ => Power { kind: "unknown", pct: None },
    }
}

/// Cadenas de fabricante/producto de las interfaces HID con el mismo VID/PID.
fn hid_strings(api: &mut Option<hidapi::HidApi>, vid: u16, pid: u16) -> Vec<String> {
    let Some(api) = api.as_mut() else { return vec![] };
    let _ = api.refresh_devices();
    let mut out: Vec<String> = Vec::new();
    for d in api.device_list().filter(|d| d.vendor_id() == vid && d.product_id() == pid) {
        for s in [d.manufacturer_string(), d.product_string()].into_iter().flatten() {
            let s = s.trim().to_string();
            if !s.is_empty() && !out.contains(&s) {
                out.push(s);
            }
        }
    }
    out
}

pub fn spawn(shared: Shared, assign: Assignments, rx: Receiver<Cmd>) {
    std::thread::Builder::new()
        .name("pads".into())
        .spawn(move || run(shared, assign, rx))
        .expect("no se pudo crear el hilo de mandos");
}

struct Slot {
    connected: bool,
    last_packet: u32,
    packets: u32,
    rate: u32,
    rumble_until: Option<Instant>,
}

fn run(shared: Shared, assign: Assignments, rx: Receiver<Cmd>) {
    let Some(xi) = XInput::load() else {
        eprintln!("XInput no disponible");
        return;
    };
    let mut hid = hidapi::HidApi::new().ok();
    let mut hid_cache: HashMap<(u16, u16), Vec<String>> = HashMap::new();
    let mut sib_cache: HashMap<(u16, u16), Vec<(u16, u16)>> = HashMap::new();
    let mut slots: Vec<Slot> = (0..4)
        .map(|_| Slot { connected: false, last_packet: 0, packets: 0, rate: 0, rumble_until: None })
        .collect();
    let mut last_info = Instant::now() - Duration::from_secs(10);
    let mut last_rate = Instant::now();
    let mut dirty = true;

    loop {
        // Órdenes de la interfaz.
        while let Ok(cmd) = rx.try_recv() {
            match cmd {
                Cmd::Refresh => dirty = true,
                Cmd::Rumble { id, strong, weak, ms } if id < 4 => {
                    xi.rumble(id as u32, strong, weak);
                    slots[id].rumble_until = Some(Instant::now() + Duration::from_millis(ms as u64));
                }
                Cmd::Rumble { .. } => {}
            }
        }

        let mut live = HashMap::new();
        for (i, slot) in slots.iter_mut().enumerate() {
            if let Some(t) = slot.rumble_until {
                if Instant::now() >= t {
                    xi.rumble(i as u32, 0, 0);
                    slot.rumble_until = None;
                }
            }
            // Las ranuras vacías son lentas de consultar: solo se miran al refrescar info.
            if !slot.connected && !dirty && last_info.elapsed() < Duration::from_secs(1) {
                continue;
            }
            match xi.state(i as u32) {
                Some(s) => {
                    if !slot.connected {
                        slot.connected = true;
                        dirty = true;
                        hid_cache.clear();
                        sib_cache.clear();
                    }
                    if s.packet != slot.last_packet {
                        slot.packets += 1;
                        slot.last_packet = s.packet;
                    }
                    let p = s.pad;
                    let buttons = xinput::BTN
                        .iter()
                        .filter(|(m, _)| p.buttons & m != 0)
                        .map(|(_, n)| (*n, 1.0))
                        .collect();
                    live.insert(
                        i,
                        PadLive {
                            ls: [axis(p.lx), axis(p.ly)],
                            rs: [axis(p.rx), axis(p.ry)],
                            lt: p.lt as f32 / 255.0,
                            rt: p.rt as f32 / 255.0,
                            buttons,
                            rate: slot.rate,
                        },
                    );
                }
                None => {
                    if slot.connected {
                        slot.connected = false;
                        dirty = true;
                    }
                }
            }
        }
        if last_rate.elapsed() >= Duration::from_secs(1) {
            for s in slots.iter_mut() {
                s.rate = s.packets;
                s.packets = 0;
            }
            last_rate = Instant::now();
        }

        // Info (modelo, batería...) cada segundo o al conectar/desconectar.
        let refresh_info = dirty || last_info.elapsed() > Duration::from_secs(1);
        let mut infos = Vec::new();
        if refresh_info {
            let assign_map = assign.lock().unwrap().clone();
            for (i, slot) in slots.iter().enumerate() {
                if !slot.connected {
                    continue;
                }
                let info = xi.info(i as u32);
                let (vid, pid) = info.as_ref().map(|x| (x.vid, x.pid)).unwrap_or((None, None));
                let strings = match (vid, pid) {
                    (Some(v), Some(p)) => hid_cache.entry((v, p)).or_insert_with(|| hid_strings(&mut hid, v, p)).clone(),
                    _ => vec![],
                };
                let siblings = match (vid, pid) {
                    (Some(v), Some(p)) => sib_cache.entry((v, p)).or_insert_with(|| crate::usbhints::port_siblings(v, p)).clone(),
                    _ => vec![],
                };
                let key = match (vid, pid) {
                    (Some(v), Some(p)) => format!("{v:04x}:{p:04x}"),
                    _ => format!("xinput:{i}"),
                };
                let os_name = strings.last().cloned().unwrap_or_else(|| "Mando XInput".into());
                let names: Vec<&str> = strings.iter().map(|s| s.as_str()).collect();
                let auto = models::identify(vid, pid, &names, &siblings);
                let manual = assign_map.get(&key).and_then(|m| models::by_id(m));
                let assigned = manual.is_some();
                let identified = assigned || auto.is_some();
                let how = if assigned { Some("Asignado a mano".to_string()) } else { auto.as_ref().map(|(_, h)| h.clone()) };
                let auto = auto.map(|(m, _)| m);
                infos.push(PadInfo {
                    id: i,
                    key,
                    name: format!("Mando XInput · ranura {}", i + 1),
                    os_name,
                    vid,
                    pid,
                    hid_strings: strings,
                    power: match power(xi.battery(i as u32)) {
                        p if p.kind == "wired" && models::has_known_dongle(&siblings) => Power { kind: "dongle", pct: None },
                        p => p,
                    },
                    rumble: info.as_ref().map(|x| x.rumble).unwrap_or(true),
                    mapping: if info.as_ref().map(|x| x.sub_type) == Some(xinput::SUBTYPE_GAMEPAD) { "driver" } else { "other" },
                    model: manual.or(auto).unwrap_or_else(models::generic),
                    identified,
                    assigned,
                    how,
                    siblings: siblings.iter().map(|(v, p)| format!("{v:04X}:{p:04X}")).collect(),
                });
            }
        }

        {
            let mut snap = shared.lock().unwrap();
            snap.live = live;
            if refresh_info {
                snap.pads = infos;
                last_info = Instant::now();
                dirty = false;
            }
        }
        std::thread::sleep(Duration::from_millis(4));
    }
}
