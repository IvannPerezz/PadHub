//! Pistas para identificar mandos que se hacen pasar por un Xbox 360
//! (VID 045E / PID 028E).
//!
//! Muchos receptores 2.4G arrancan con su propio VID/PID y, cuando el mando
//! se empareja, cambian al modo XInput en el mismo puerto USB. Windows guarda
//! los dos dispositivos con el mismo identificador de instancia (que codifica
//! el hub y el puerto), así que buscando "vecinos" con el mismo sufijo se puede
//! saber qué receptor está detrás del falso mando de Xbox.

/// Devuelve los VID/PID que Windows ha visto alguna vez en el mismo puerto
/// USB que un dispositivo con `vid:pid`.
#[cfg(windows)]
pub fn port_siblings(vid: u16, pid: u16) -> Vec<(u16, u16)> {
    let ids = usb_instance_ids(false);
    let me = format!("USB\\VID_{vid:04X}&PID_{pid:04X}\\");
    // Solo el puerto donde el dispositivo está conectado AHORA: si no, un mando
    // por cable heredaría el receptor que hubo en otro puerto.
    let present = usb_instance_ids(true);
    let suffixes: Vec<&str> = present
        .iter()
        .filter(|id| id.to_uppercase().starts_with(&me))
        .filter_map(|id| id.rsplit('\\').next())
        .collect();
    let mut out = Vec::new();
    for id in &ids {
        let Some(sfx) = id.rsplit('\\').next() else { continue };
        if !suffixes.contains(&sfx) {
            continue;
        }
        if let Some(vp) = parse_vid_pid(id) {
            if vp != (vid, pid) && !out.contains(&vp) {
                out.push(vp);
            }
        }
    }
    out
}

#[cfg(not(windows))]
pub fn port_siblings(_vid: u16, _pid: u16) -> Vec<(u16, u16)> {
    vec![]
}

fn parse_vid_pid(id: &str) -> Option<(u16, u16)> {
    let up = id.to_uppercase();
    let v = up.find("VID_")?;
    let p = up.find("PID_")?;
    let vid = u16::from_str_radix(up.get(v + 4..v + 8)?, 16).ok()?;
    let pid = u16::from_str_radix(up.get(p + 4..p + 8)?, 16).ok()?;
    Some((vid, pid))
}

/// Identificadores de instancia del enumerador USB: todos los que Windows
/// recuerda (`present_only = false`) o solo los conectados ahora.
#[cfg(windows)]
fn usb_instance_ids(present_only: bool) -> Vec<String> {
    use windows_sys::Win32::Devices::DeviceAndDriverInstallation::{
        CM_Get_Device_ID_ListW, CM_Get_Device_ID_List_SizeW, CM_GETIDLIST_FILTER_ENUMERATOR, CM_GETIDLIST_FILTER_PRESENT,
        CR_SUCCESS,
    };
    let filter: Vec<u16> = "USB\0".encode_utf16().collect();
    let flags = CM_GETIDLIST_FILTER_ENUMERATOR | if present_only { CM_GETIDLIST_FILTER_PRESENT } else { 0 };
    unsafe {
        let mut len = 0u32;
        if CM_Get_Device_ID_List_SizeW(&mut len, filter.as_ptr(), flags) != CR_SUCCESS {
            return vec![];
        }
        let mut buf = vec![0u16; len as usize];
        if CM_Get_Device_ID_ListW(filter.as_ptr(), buf.as_mut_ptr(), len, flags) != CR_SUCCESS {
            return vec![];
        }
        buf.split(|c| *c == 0)
            .filter(|s| !s.is_empty())
            .map(String::from_utf16_lossy)
            .collect()
    }
}
