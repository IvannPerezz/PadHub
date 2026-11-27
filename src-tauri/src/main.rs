#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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
            if !to.exists() {
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
            recursos, recurso, check_update, install_update, app_version
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar PadHub");
}
