#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bt;
mod models;
mod pads;
mod usbhints;
mod xinput;

use pads::{Assignments, Cmd, PadInfo, PadLive, Shared};
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::mpsc::Sender;
use std::sync::{Arc, Mutex};
use tauri::State;

struct App {
    shared: Shared,
    assign: Assignments,
    tx: Mutex<Sender<Cmd>>,
}

fn assign_path() -> Option<PathBuf> {
    std::env::var_os("APPDATA").map(|p| PathBuf::from(p).join("PadHub").join("asignaciones.json"))
}

fn load_assign() -> HashMap<String, String> {
    assign_path()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn list_pads(app: State<App>) -> Vec<PadInfo> {
    app.shared.lock().unwrap().pads.clone()
}

#[tauri::command]
fn pad_live(app: State<App>, id: usize) -> Option<PadLive> {
    app.shared.lock().unwrap().live.get(&id).cloned()
}

#[tauri::command]
fn rumble(app: State<App>, id: usize, strong: u16, weak: u16, ms: u32) {
    let _ = app.tx.lock().unwrap().send(Cmd::Rumble { id, strong, weak, ms: ms.min(3000) });
}

#[tauri::command]
fn models() -> Vec<models::Model> {
    models::all()
}

#[tauri::command]
fn assign_model(app: State<App>, key: String, model: Option<String>) -> Result<(), String> {
    let snapshot = {
        let mut map = app.assign.lock().unwrap();
        match model {
            Some(m) if models::by_id(&m).is_some() => {
                map.insert(key, m);
            }
            Some(_) => return Err("modelo desconocido".into()),
            None => {
                map.remove(&key);
            }
        }
        map.clone()
    };
    if let Some(p) = assign_path() {
        if let Some(dir) = p.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        std::fs::write(&p, serde_json::to_string_pretty(&snapshot).unwrap()).map_err(|e| e.to_string())?;
    }
    let _ = app.tx.lock().unwrap().send(Cmd::Refresh);
    Ok(())
}

/// Recursos opcionales que viven fuera del ejecutable (fotos de los mandos y
/// fuente SF Pro): %APPDATA%\PadHub\recursos. No se publican en el repositorio.
#[derive(Serialize)]
struct Recursos {
    dir: String,
    files: Vec<String>,
}

fn recursos_dir() -> PathBuf {
    std::env::var_os("APPDATA")
        .map(|p| PathBuf::from(p).join("PadHub").join("recursos"))
        .unwrap_or_default()
}

/// El instalador "completo" (solo para compartir en privado) lleva los recursos
/// junto al ejecutable. Se copian a %APPDATA% para que sobrevivan a las
/// actualizaciones públicas, que no los incluyen. No sobrescribe nada existente.
fn instalar_recursos_empaquetados(app: &tauri::App) {
    use tauri::Manager;
    let Ok(res) = app.path().resource_dir() else { return };
    let src = res.join("recursos");
    let dst = recursos_dir();
    for sub in ["img", "fonts"] {
        let Ok(rd) = std::fs::read_dir(src.join(sub)) else { continue };
        let _ = std::fs::create_dir_all(dst.join(sub));
        for e in rd.flatten() {
            let to = dst.join(sub).join(e.file_name());
            // Copia si falta o si el empaquetado es distinto (fotos mejoradas).
            let size = |p: &std::path::Path| std::fs::metadata(p).map(|m| m.len()).ok();
            if size(&to) != size(&e.path()) {
                let _ = std::fs::copy(e.path(), to);
            }
        }
    }
}

#[tauri::command]
fn recursos() -> Recursos {
    let dir = recursos_dir();
    let mut files = Vec::new();
    for sub in ["img", "fonts"] {
        if let Ok(rd) = std::fs::read_dir(dir.join(sub)) {
            for e in rd.flatten() {
                if let Some(n) = e.file_name().to_str() {
                    files.push(format!("{sub}/{n}"));
                }
            }
        }
    }
    Recursos { dir: dir.to_string_lossy().into_owned(), files }
}

/// Devuelve un recurso local como data URL (base64). Así la interfaz no depende
/// de rutas de disco (usuarios con tildes, carpetas virtualizadas…).
#[tauri::command]
fn recurso(rel: String) -> Option<String> {
    let (sub, name) = rel.split_once('/')?;
    let valid = matches!(sub, "img" | "fonts")
        && !name.is_empty()
        && name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'));
    if !valid {
        return None;
    }
    let mime = match name.rsplit('.').next()?.to_ascii_lowercase().as_str() {
        "webp" => "image/webp",
        "png" => "image/png",
        "otf" => "font/otf",
        "ttf" => "font/ttf",
        _ => return None,
    };
    let bytes = std::fs::read(recursos_dir().join(sub).join(name)).ok()?;
    use base64::Engine;
    Some(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
}

#[derive(Serialize)]
struct UpdateInfo {
    version: String,
    current: String,
    notes: Option<String>,
}

#[tauri::command]
async fn check_update(app: tauri::AppHandle) -> Result<Option<UpdateInfo>, String> {
    use tauri_plugin_updater::UpdaterExt;
    let update = app.updater().map_err(|e| e.to_string())?.check().await.map_err(|e| e.to_string())?;
    Ok(update.map(|u| UpdateInfo { version: u.version.clone(), current: u.current_version.clone(), notes: u.body.clone() }))
}

/// Descarga e instala la actualización (emitiendo el progreso) y reinicia la app.
#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Emitter;
    use tauri_plugin_updater::UpdaterExt;
    let Some(update) = app.updater().map_err(|e| e.to_string())?.check().await.map_err(|e| e.to_string())? else {
        return Ok(());
    };
    let mut done: u64 = 0;
    let progress = app.clone();
    update
        .download_and_install(
            move |chunk, total| {
                done += chunk as u64;
                let _ = progress.emit("update-progress", (done, total));
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())?;
    app.restart();
}

#[tauri::command]
fn app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

#[derive(Serialize)]
struct VendorCapture {
    interface: i32,
    usage: String,
    /// Informes recibidos, en hexadecimal (máximo 200 por interfaz).
    reports: Vec<String>,
    error: Option<String>,
}

/// Escucha PASIVA de las interfaces de fabricante (usage page >= 0xFF00) de un
/// mando: solo lee lo que el mando envía por su cuenta. Nunca escribe nada.
#[tauri::command]
async fn listen_vendor(vid: u16, pid: u16, ms: u64) -> Result<Vec<VendorCapture>, String> {
    let ms = ms.min(10_000);
    tauri::async_runtime::spawn_blocking(move || {
        let api = hidapi::HidApi::new().map_err(|e| e.to_string())?;
        let targets: Vec<_> = api
            .device_list()
            .filter(|d| d.vendor_id() == vid && d.product_id() == pid && d.usage_page() >= 0xFF00)
            .map(|d| (d.path().to_owned(), d.interface_number(), format!("0x{:x}:0x{:x}", d.usage_page(), d.usage())))
            .collect();
        let mut out = Vec::new();
        for (path, interface, usage) in targets {
            let mut cap = VendorCapture { interface, usage, reports: vec![], error: None };
            match api.open_path(&path) {
                Ok(dev) => {
                    let until = std::time::Instant::now() + std::time::Duration::from_millis(ms);
                    let mut buf = [0u8; 256];
                    while std::time::Instant::now() < until && cap.reports.len() < 200 {
                        match dev.read_timeout(&mut buf, 100) {
                            Ok(0) => {}
                            Ok(n) => cap.reports.push(buf[..n].iter().map(|b| format!("{b:02x}")).collect::<Vec<_>>().join(" ")),
                            Err(e) => {
                                cap.error = Some(e.to_string());
                                break;
                            }
                        }
                    }
                }
                Err(e) => cap.error = Some(e.to_string()),
            }
            out.push(cap);
        }
        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
struct HidEntry {
    vid: u16,
    pid: u16,
    usage_page: u16,
    usage: u16,
    interface: i32,
    manufacturer: Option<String>,
    product: Option<String>,
    path: String,
}

/// Diagnóstico: todas las interfaces HID (útil para identificar mandos nuevos).
#[tauri::command]
fn hid_devices() -> Result<Vec<HidEntry>, String> {
    let api = hidapi::HidApi::new().map_err(|e| e.to_string())?;
    let mut v: Vec<HidEntry> = api
        .device_list()
        .map(|d| HidEntry {
            vid: d.vendor_id(),
            pid: d.product_id(),
            usage_page: d.usage_page(),
            usage: d.usage(),
            interface: d.interface_number(),
            manufacturer: d.manufacturer_string().map(str::to_string),
            product: d.product_string().map(str::to_string),
            path: d.path().to_string_lossy().into_owned(),
        })
        .collect();
    v.sort_by_key(|e| (e.vid, e.pid, e.interface, e.usage_page, e.usage));
    Ok(v)
}

fn main() {
    let shared: Shared = Arc::new(Mutex::new(Default::default()));
    let assign: Assignments = Arc::new(Mutex::new(load_assign()));
    let (tx, rx) = std::sync::mpsc::channel();
    pads::spawn(shared.clone(), assign.clone(), rx);

    // `padhub --listen VID:PID MS`: escucha pasiva (solo lectura) de todas las
    // interfaces HID de un dispositivo e imprime los informes. Solo diagnóstico.
    let args: Vec<String> = std::env::args().collect();
    if let Some(i) = args.iter().position(|a| a == "--listen") {
        let (v, p) = args.get(i + 1).and_then(|s| s.split_once(':')).unwrap_or(("0", "0"));
        let (vid, pid) = (u16::from_str_radix(v, 16).unwrap_or(0), u16::from_str_radix(p, 16).unwrap_or(0));
        let ms: u64 = args.get(i + 2).and_then(|s| s.parse().ok()).unwrap_or(3000);
        let api = hidapi::HidApi::new().expect("hidapi");
        for d in api.device_list().filter(|d| d.vendor_id() == vid && d.product_id() == pid) {
            println!("== iface {} usage 0x{:x}:0x{:x} {:?}", d.interface_number(), d.usage_page(), d.usage(), d.product_string());
            match api.open_path(d.path()) {
                Ok(dev) => {
                    let until = std::time::Instant::now() + std::time::Duration::from_millis(ms);
                    let mut buf = [0u8; 128];
                    let mut n_rep = 0;
                    while std::time::Instant::now() < until && n_rep < 40 {
                        if let Ok(n) = dev.read_timeout(&mut buf, 100) {
                            if n > 0 {
                                n_rep += 1;
                                println!("{}", buf[..n].iter().map(|b| format!("{b:02x}")).collect::<Vec<_>>().join(" "));
                            }
                        }
                    }
                    println!("({n_rep} informes)");
                }
                Err(e) => println!("no se pudo abrir: {e}"),
            }
        }
        return;
    }

    // `padhub --procon-full VID:PID MS`: envía SOLO el subcomando estándar del
    // protocolo Pro Controller "cambiar a informes completos" (0x03, arg 0x30) y
    // escucha. Es lo mismo que hacen SDL/Steam al conectar el mando.
    if let Some(i) = args.iter().position(|a| a == "--procon-full") {
        let (v, p) = args.get(i + 1).and_then(|s| s.split_once(':')).unwrap_or(("0", "0"));
        let (vid, pid) = (u16::from_str_radix(v, 16).unwrap_or(0), u16::from_str_radix(p, 16).unwrap_or(0));
        let ms: u64 = args.get(i + 2).and_then(|s| s.parse().ok()).unwrap_or(3000);
        let api = hidapi::HidApi::new().expect("hidapi");
        let dev = api.open(vid, pid).expect("no se pudo abrir el mando");
        // Informe de salida 0x01: contador, vibración neutra (8 bytes), subcomando 0x03, argumento 0x30.
        let mut out = [0u8; 49];
        out[..12].copy_from_slice(&[0x01, 0x00, 0x00, 0x01, 0x40, 0x40, 0x00, 0x01, 0x40, 0x40, 0x03, 0x30]);
        match dev.write(&out) {
            Ok(n) => println!("enviado ({n} bytes): subcomando 0x03 -> modo 0x30"),
            Err(e) => println!("error al enviar: {e}"),
        }
        let until = std::time::Instant::now() + std::time::Duration::from_millis(ms);
        let mut buf = [0u8; 128];
        let (mut shown, mut full) = (0, 0);
        while std::time::Instant::now() < until {
            if let Ok(n) = dev.read_timeout(&mut buf, 100) {
                if n == 0 {
                    continue;
                }
                let id = buf[0];
                if id == 0x30 || id == 0x21 {
                    full += 1;
                    let nib = buf[2] >> 4;
                    let nivel = match nib & 0x0E { 8 => "lleno", 6 => "medio", 4 => "bajo", 2 => "crítico", 0 => "vacío", _ => "?" };
                    if shown < 6 {
                        println!(
                            "informe 0x{id:02x} | byte2=0x{:02x} -> batería {nivel} (nibble {nib}){} | {}",
                            buf[2],
                            if nib & 1 == 1 { ", cargando" } else { "" },
                            buf[..n.min(16)].iter().map(|b| format!("{b:02x}")).collect::<Vec<_>>().join(" ")
                        );
                        shown += 1;
                    }
                } else if shown < 6 {
                    println!("informe 0x{id:02x} (otro tipo): {}", buf[..n.min(16)].iter().map(|b| format!("{b:02x}")).collect::<Vec<_>>().join(" "));
                    shown += 1;
                }
            }
        }
        println!("({full} informes completos/respuestas en {ms} ms)");
        return;
    }

    // `padhub --dump`: imprime lo detectado y sale (diagnóstico sin ventana).
    if std::env::args().any(|a| a == "--dump") {
        std::thread::sleep(std::time::Duration::from_millis(2500));
        let s = shared.lock().unwrap();
        println!("{}", serde_json::to_string_pretty(&s.pads).unwrap());
        println!("{}", serde_json::to_string_pretty(&s.live).unwrap());
        return;
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            instalar_recursos_empaquetados(app);
            Ok(())
        })
        .manage(App { shared, assign, tx: Mutex::new(tx) })
        .invoke_handler(tauri::generate_handler![
            list_pads, pad_live, rumble, models, assign_model, hid_devices,
            recursos, recurso, check_update, install_update, app_version, listen_vendor
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar PadHub");
}
