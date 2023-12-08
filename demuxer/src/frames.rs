use std::{io::{Read, Seek}, ops::Deref};
use js_sys::Uint8Array;
use matroska_demuxer::{MatroskaFile, Frame};
use wasm_bindgen::{JsError, JsValue};
use web_sys::{EncodedVideoChunkType, EncodedVideoChunkInit, EncodedVideoChunk};

use crate::console_log;

pub struct FrameCache {
    pub keyframe: bool,
    pub timestamp: u64,
    pub chunk: EncodedVideoChunk,
}

pub struct FrameCacheStore {
    store: Vec<FrameCache>,
    count: usize,
}

impl FrameCacheStore {
    pub fn init<R: Read + Seek>(mut file: MatroskaFile<R>, video_track: u64) -> Result<FrameCacheStore, JsValue> {
        let mut store = Vec::new();
        // file.seek(0).map_err(|err| JsError::new(&err.to_string()))?;

        let mut frame = Frame::default();
        loop {
            if !file.next_frame(&mut frame).map_err(|err| JsError::new(&err.to_string()))? {
                break;
            }

            console_log!("next {} {}", frame.track, video_track);

            if frame.track != video_track {
                continue;
            }

            let keyframe = frame.is_keyframe.unwrap_or(false);

            if keyframe {
                console_log!("Found key frame {} [{}]", frame.timestamp, store.len() + 1);
            }

            let chunk_type = match frame.is_keyframe {
                Some(true) => EncodedVideoChunkType::Key,
                _ => EncodedVideoChunkType::Delta,
            };

            let data = Uint8Array::new_with_length(frame.data.len() as u32);
            data.copy_from(&frame.data);
            let obj = data.deref();
            let init = EncodedVideoChunkInit::new(obj, frame.timestamp as f64, chunk_type);
            let chunk = EncodedVideoChunk::new(&init)?;

            store.push(FrameCache { keyframe, timestamp: frame.timestamp, chunk });
        }

        if store.len() == 0 {
            return Err(JsError::new("No video frames found").into());
        }

        let count = store.len() - 1;

        Ok(Self { store, count })
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