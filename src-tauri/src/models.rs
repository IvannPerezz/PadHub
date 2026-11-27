//! Catálogo de modelos conocidos.
//!
//! Cada modelo se reconoce por VID/PID (lo más fiable) o, si no se conocen,
//! por fragmentos del nombre que reporta Windows. Los IDs marcados como
//! `confirmado: false` son provisionales hasta probarlos con el mando real.

use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
pub struct Model {
    pub id: &'static str,
    pub brand: &'static str,
    pub name: &'static str,
    /// Variante del dibujo del mando en la interfaz.
    pub art: &'static str,
    /// Color principal del cuerpo y color de acento.
    pub body: &'static str,
    pub accent: &'static str,
    /// Tiene pantalla integrada (se dibuja en el render).
    pub screen: bool,
    /// Se puede configurar el propio mando desde PadHub.
    pub onboard_config: bool,
    /// Texto que explica el estado de soporte.
    pub support: &'static str,
}

struct Rule {
    ids: &'static [(u16, u16)],
    /// VID/PID del receptor 2.4G en su modo propio (antes de pasar a XInput).
    dongles: &'static [(u16, u16)],
    name_hints: &'static [&'static str],
    model: Model,
}

const RULES: &[Rule] = &[
    Rule {
        ids: &[],
        // Observado 2026-11-27: en el puerto del receptor del Manba One V2 hubo un
        // 1A34:F517 (HID de fabricante) y con el mando encendido aparece 045E:028E
        // (clon de Xbox 360). 1A34 es un chip genérico: puede coincidir con otros.
        dongles: &[(0x1A34, 0xF517)],
        name_hints: &["manba", "mamba"],
        model: Model {
            id: "manba-one-v2",
            brand: "Manba",
            name: "One V2",
            art: "manba",
            body: "#f4f4f6",
            accent: "#7c5cff",
            screen: true,
            onboard_config: false,
            support: "Detección, test de sticks, gatillos, botones y batería. La configuración se hace en la pantalla del mando.",
        },
    },
    Rule {
        ids: &[],
        dongles: &[],
        name_hints: &["g5 pro", "g5pro"],
        model: Model {
            id: "machenike-g5-pro",
            brand: "Machenike",
            name: "G5 Pro",
            art: "g5pro",
            body: "#1d1e22",
            accent: "#e8b04a",
            screen: false,
            onboard_config: false,
            support: "Detección y test. Configuración en el mando pendiente de capturar el protocolo de Keylinker.",
        },
    },
    Rule {
        ids: &[],
        dongles: &[],
        name_hints: &["g3 v2", "g3v2", "g3"],
        model: Model {
            id: "machenike-g3-v2",
            brand: "Machenike",
            name: "G3 V2",
            art: "g3v2",
            body: "#e9eaee",
            accent: "#3aa0ff",
            screen: false,
            onboard_config: false,
            support: "Detección y test. Configuración en el mando pendiente de capturar el protocolo de Keylinker.",
        },
    },
    Rule {
        ids: &[],
        dongles: &[],
        name_hints: &["machenike"],
        model: Model {
            id: "machenike-generic",
            brand: "Machenike",
            name: "Mando",
            art: "g5pro",
            body: "#1d1e22",
            accent: "#e8b04a",
            screen: false,
            onboard_config: false,
            support: "Machenike sin identificar. Elige el modelo exacto para ver su ficha.",
        },
    },
];

pub fn generic() -> Model {
    Model {
        id: "generic",
        brand: "Mando",
        name: "Genérico",
        art: "generic",
        body: "#2a2b31",
        accent: "#9aa0ad",
        screen: false,
        onboard_config: false,
        support: "Mando no catalogado. Puedes asignarle un modelo a mano.",
    }
}

pub fn all() -> Vec<Model> {
    RULES.iter().map(|r| r.model.clone()).collect()
}

pub fn by_id(id: &str) -> Option<Model> {
    RULES.iter().find(|r| r.model.id == id).map(|r| r.model.clone())
}

/// ¿Hay en el mismo puerto un receptor 2.4G conocido? Si es así, el "con cable"
/// que dice XInput es falso: es el receptor imitando un Xbox 360 con cable.
pub fn has_known_dongle(siblings: &[(u16, u16)]) -> bool {
    RULES.iter().any(|r| r.dongles.iter().any(|d| siblings.contains(d)))
}

/// Devuelve el modelo y cómo se ha reconocido.
pub fn identify(
    vid: Option<u16>,
    pid: Option<u16>,
    names: &[&str],
    siblings: &[(u16, u16)],
) -> Option<(Model, String)> {
    if let (Some(v), Some(p)) = (vid, pid) {
        if let Some(r) = RULES.iter().find(|r| r.ids.contains(&(v, p))) {
            return Some((r.model.clone(), "Por su VID/PID".into()));
        }
    }
    for r in RULES {
        if let Some((v, p)) = r.dongles.iter().find(|d| siblings.contains(d)) {
            return Some((r.model.clone(), format!("Por su receptor {v:04X}:{p:04X} en el mismo puerto USB")));
        }
    }
    let hay: Vec<String> = names.iter().map(|n| n.to_lowercase()).collect();
    RULES
        .iter()
        .find(|r| r.name_hints.iter().any(|h| hay.iter().any(|n| n.contains(h))))
        .map(|r| (r.model.clone(), "Por su nombre".into()))
}
