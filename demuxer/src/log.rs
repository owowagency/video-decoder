use wasm_bindgen::prelude::*;

pub const LOG: bool = false;
pub const WARN: bool = true;
pub const ERROR: bool = true;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    pub fn log(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    pub fn warn(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    pub fn error(s: &str);
}

#[macro_export]
macro_rules! console_log {
    ($($arg:tt)*) => (
        if $crate::log::LOG {
            $crate::log::log(&format!($($arg)*))
        }
    )
}

#[macro_export]
macro_rules! console_warn {
    ($($arg:tt)*) => (
        if $crate::log::WARN {
            $crate::log::warn(&format!($($arg)*))
        }
    )
}

#[macro_export]
macro_rules! console_error {
    ($($arg:tt)*) => (
        if $crate::log::ERROR {
            $crate::log::error(&format!($($arg)*))
        }
    )
}