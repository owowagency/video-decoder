use std::ops::Deref;
use js_sys::Uint8Array;
use wasm_bindgen::JsValue;
use web_sys::{EncodedVideoChunkType, EncodedVideoChunkInit, EncodedVideoChunk};

pub struct FrameCache {
    pub keyframe: bool,
    pub timestamp: u64,
    pub size: u32,
    pub chunk: EncodedVideoChunk,
}

pub enum FrameCacheError {
    Init(String),
    NoFrames(String)
}

impl From<JsValue> for FrameCacheError {
    fn from(value: JsValue) -> Self {
        match value.as_string() {
            Some(err) => FrameCacheError::Init(err),
            None => FrameCacheError::Init(format!("{value:?}"))
        }
    }
}

impl FrameCache {
    pub fn init(bytes: &[u8], ts: f64, keyframe: bool) -> Result<Self, FrameCacheError> {
        let chunk_type = match keyframe {
            true => EncodedVideoChunkType::Key,
            false => EncodedVideoChunkType::Delta,
        };

        let size = bytes.len() as u32;
        let data = Uint8Array::new_with_length(size);

        data.copy_from(&bytes);
        let obj = data.deref();
        let init = EncodedVideoChunkInit::new(obj, ts as f64, chunk_type);
        let chunk = EncodedVideoChunk::new(&init)?;

        Ok(Self { keyframe, timestamp: ts as u64, size, chunk })
    }
}

pub struct FrameCacheStore {
    store: Vec<FrameCache>,
    count: usize,
}

impl FrameCacheStore {
    pub fn new(store: Vec<FrameCache>) -> Result<Self, FrameCacheError> {
        if store.len() < 1 {
            return Err(FrameCacheError::NoFrames("Cannot initialize frame store cache with 0 frames".to_string()))
        }

        let count = store.len() - 1;
        Ok(Self { store, count })
    }

    pub fn total_size(&self) -> u64 {
        self.store.iter().fold(0, |acc, el| acc + (el.size as u64))
    }

    pub fn count(&self) -> usize {
        self.count
    }

    pub fn get(&self, id: usize) -> Option<&FrameCache> {
        self.store.get(id)
    }

    pub fn timestamp_to_frame(&self, timestamp: u64) -> Option<usize> {
        for (idx, frame) in self.store.iter().enumerate() {
            if frame.timestamp == timestamp {
                return Some(idx);
            }
        }

        None
    }

    pub fn find_prev_key_frame_before(&self, before: usize) -> Option<usize> {
        for (idx, f) in self.store.iter().enumerate().rev() {
            if idx > before {
                continue;
            }

            if f.keyframe {
                return Some(idx);
            }
        }

        None
    }
}