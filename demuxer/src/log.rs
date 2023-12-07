use wasm_bindgen::prelude::*;

pub const LOG: bool = false;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    pub fn log(s: &str);
}

#[macro_export]
macro_rules! console_log {
    ($($arg:tt)*) => (
        if $crate::log::LOG {
            $crate::log::log(&format!($($arg)*))
        }
    )
}