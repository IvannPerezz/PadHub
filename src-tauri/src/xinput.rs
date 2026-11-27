//! Acceso directo a XInput (xinput1_4.dll).
//!
//! Funciona aunque la ventana no tenga el foco (a diferencia de
//! Windows.Gaming.Input, que con WebView2 cree que la app está en segundo plano).
//! Usa también las funciones "ocultas" por ordinal: GetStateEx (botón Guide)
//! y GetCapabilitiesEx (VID/PID de cada ranura).

#![allow(non_snake_case)]

use windows_sys::Win32::Foundation::FreeLibrary;
use windows_sys::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};

#[repr(C)]
#[derive(Default, Clone, Copy)]
pub struct Gamepad {
    pub buttons: u16,
    pub lt: u8,
    pub rt: u8,
    pub lx: i16,
    pub ly: i16,
    pub rx: i16,
    pub ry: i16,
}

#[repr(C)]
#[derive(Default, Clone, Copy)]
struct State {
    packet: u32,
    pad: Gamepad,
}

#[repr(C)]
#[derive(Default, Clone, Copy)]
struct Vibration {
    left: u16,
    right: u16,
}

#[repr(C)]
#[derive(Default, Clone, Copy)]
struct Capabilities {
    kind: u8,
    sub_type: u8,
    flags: u16,
    gamepad: Gamepad,
    vibration: Vibration,
}

#[repr(C)]
#[derive(Default, Clone, Copy)]
struct CapabilitiesEx {
    caps: Capabilities,
    vendor_id: u16,
    product_id: u16,
    product_version: u16,
    unk1: u16,
    unk2: u32,
}

#[repr(C)]
#[derive(Default, Clone, Copy)]
struct Battery {
    kind: u8,
    level: u8,
}

type FnGetState = unsafe extern "system" fn(u32, *mut State) -> u32;
type FnSetState = unsafe extern "system" fn(u32, *mut Vibration) -> u32;
type FnGetCapsEx = unsafe extern "system" fn(u32, u32, u32, *mut CapabilitiesEx) -> u32;
type FnGetCaps = unsafe extern "system" fn(u32, u32, *mut Capabilities) -> u32;
type FnGetBattery = unsafe extern "system" fn(u32, u8, *mut Battery) -> u32;

pub struct XInput {
    lib: *mut core::ffi::c_void,
    get_state: FnGetState,
    set_state: FnSetState,
    get_caps: FnGetCaps,
    get_caps_ex: Option<FnGetCapsEx>,
    get_battery: Option<FnGetBattery>,
}

unsafe impl Send for XInput {}

pub const SUBTYPE_GAMEPAD: u8 = 1;

pub struct PadState {
    pub packet: u32,
    pub pad: Gamepad,
}

pub struct Info {
    pub vid: Option<u16>,
    pub pid: Option<u16>,
    pub sub_type: u8,
    pub rumble: bool,
}

/// (tipo, nivel 0..=3). Tipo: 0 desconectado, 1 con cable, 2 alcalinas, 3 NiMH, 0xFF desconocido.
pub struct BatteryInfo {
    pub kind: u8,
    pub level: u8,
}

pub const ERROR_SUCCESS: u32 = 0;

impl XInput {
    pub fn load() -> Option<Self> {
        unsafe {
            for name in ["xinput1_4.dll", "xinput1_3.dll", "xinput9_1_0.dll"] {
                let w: Vec<u16> = name.encode_utf16().chain([0]).collect();
                let lib = LoadLibraryW(w.as_ptr());
                if lib.is_null() {
                    continue;
                }
                let ord = |n: usize| GetProcAddress(lib, n as *const u8);
                let named = |s: &[u8]| GetProcAddress(lib, s.as_ptr());
                // Ordinal 100 = XInputGetStateEx (incluye el botón Guide).
                let gs = ord(100).or_else(|| named(b"XInputGetState\0"));
                let ss = named(b"XInputSetState\0");
                let gc = named(b"XInputGetCapabilities\0");
                let (Some(gs), Some(ss), Some(gc)) = (gs, ss, gc) else {
                    FreeLibrary(lib);
                    continue;
                };
                return Some(Self {
                    lib,
                    get_state: core::mem::transmute(gs),
                    set_state: core::mem::transmute(ss),
                    get_caps: core::mem::transmute(gc),
                    // Ordinal 108 = XInputGetCapabilitiesEx (solo xinput1_4).
                    get_caps_ex: ord(108).map(|f| core::mem::transmute::<_, FnGetCapsEx>(f)),
                    get_battery: named(b"XInputGetBatteryInformation\0").map(|f| core::mem::transmute::<_, FnGetBattery>(f)),
                });
            }
            None
        }
    }

    pub fn state(&self, slot: u32) -> Option<PadState> {
        let mut s = State::default();
        let r = unsafe { (self.get_state)(slot, &mut s) };
        (r == ERROR_SUCCESS).then_some(PadState { packet: s.packet, pad: s.pad })
    }

    pub fn info(&self, slot: u32) -> Option<Info> {
        unsafe {
            if let Some(f) = self.get_caps_ex {
                let mut c = CapabilitiesEx::default();
                if f(1, slot, 0, &mut c) == ERROR_SUCCESS {
                    return Some(Info {
                        vid: Some(c.vendor_id).filter(|v| *v != 0),
                        pid: Some(c.product_id).filter(|_| c.vendor_id != 0),
                        sub_type: c.caps.sub_type,
                        rumble: c.caps.vibration.left != 0 || c.caps.vibration.right != 0,
                    });
                }
            }
            let mut c = Capabilities::default();
            if (self.get_caps)(slot, 0, &mut c) == ERROR_SUCCESS {
                return Some(Info {
                    vid: None,
                    pid: None,
                    sub_type: c.sub_type,
                    rumble: c.vibration.left != 0 || c.vibration.right != 0,
                });
            }
            None
        }
    }

    pub fn battery(&self, slot: u32) -> Option<BatteryInfo> {
        let f = self.get_battery?;
        let mut b = Battery::default();
        // 0 = BATTERY_DEVTYPE_GAMEPAD
        let r = unsafe { f(slot, 0, &mut b) };
        (r == ERROR_SUCCESS).then_some(BatteryInfo { kind: b.kind, level: b.level })
    }

    pub fn rumble(&self, slot: u32, left: u16, right: u16) {
        let mut v = Vibration { left, right };
        unsafe {
            (self.set_state)(slot, &mut v);
        }
    }
}

impl Drop for XInput {
    fn drop(&mut self) {
        unsafe {
            FreeLibrary(self.lib);
        }
    }
}

// Máscaras de botones XInput.
pub const BTN: &[(u16, &str)] = &[
    (0x0001, "up"),
    (0x0002, "down"),
    (0x0004, "left"),
    (0x0008, "right"),
    (0x0010, "menu"),
    (0x0020, "view"),
    (0x0040, "l3"),
    (0x0080, "r3"),
    (0x0100, "lb"),
    (0x0200, "rb"),
    (0x0400, "home"),
    (0x1000, "a"),
    (0x2000, "b"),
    (0x4000, "x"),
    (0x8000, "y"),
];
