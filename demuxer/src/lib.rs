use std::cmp::Ordering;

use video::frames::FrameCacheStore;
use js_sys::ArrayBuffer;
use web_sys::VideoDecoder;

mod log;
mod video;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Demuxer {
    first_render: bool,
    keyframes: FrameCacheStore,
    current_frame: usize,
    coded_width: u32,
    coded_height: u32,
    duration: f64,
    codec: Option<String>,
}

#[wasm_bindgen]
impl Demuxer {
    #[wasm_bindgen(js_name = codedWidth)]
    pub fn coded_width(&self) -> u32 {
        self.coded_width
    }

    #[wasm_bindgen(js_name = codedHeight)]
    pub fn coded_height(&self) -> u32 {
        self.coded_height
    }

    pub fn duration(&self) -> f64 {
        self.duration
    }

    #[wasm_bindgen(js_name = frameCount)]
    pub fn frame_count(&self) -> usize {
        self.keyframes.count()
    }

    #[wasm_bindgen(js_name = timestampToFrame)]
    pub fn timestamp_to_frame(&self, timestamp: u32) -> Option<usize> {
        self.keyframes.timestamp_to_frame(timestamp as u64)
    }

    pub fn codec(&self) -> Option<String> {
        self.codec.clone()
    }

    pub fn decode(&mut self, from: usize, to: usize, decoder: &VideoDecoder) -> usize {
        let skip_until = self.skip_to_keyframe(from);
        let mut decoded: usize = 0;

        for idx in (0..self.keyframes.count()).into_iter() {
            if idx < skip_until {
                continue;
            }

            if idx > to {
                break;
            }

            if self.current_frame == idx && !self.first_render {
                continue;
            }

            self.current_frame = idx;
            console_log!("decode frame: {idx}");
            self.render(decoder);
            self.first_render = false;
            decoded += 1;
        }

        decoded
    }

    pub fn seek(&mut self, frame: usize, decoder: &VideoDecoder) -> u32 {
        let skip_until = self.skip_to_keyframe(frame);

        for idx in (0..self.keyframes.count()).into_iter() {
            if idx < skip_until {
                continue;
            }

            if idx > frame {
                break;
            }

            if self.current_frame == idx && !self.first_render {
                continue;
            }

            self.current_frame = idx;
            self.render(decoder);
            self.first_render = false;
        }
        
        self.current_timestamp()
    }

    fn current_timestamp(&self) -> u32 {
        let frame = self.keyframes.get(self.current_frame).map(|f| f.timestamp).unwrap_or(0);

        frame as u32
    }

    fn skip_to_keyframe(&self, frame: usize) -> usize {
        match frame.cmp(&self.current_frame) {
            Ordering::Equal => self.current_frame,
            Ordering::Greater => {
                let next = self.keyframes.find_prev_key_frame_before(frame).unwrap_or(self.current_frame);
                if next < self.current_frame {
                    self.current_frame + 1
                } else {
                    next
                }
            },
            Ordering::Less => self.keyframes.find_prev_key_frame_before(frame).unwrap_or(0),
        }
    }

    fn render(&self, decoder: &VideoDecoder) -> bool {
        if let Some(frame) = self.keyframes.get(self.current_frame) {
            console_log!("idx: {}, ts: {}, keyframe: {:?}", self.current_frame, frame.timestamp, frame.keyframe);
            decoder.decode(&frame.chunk);
            return true;
        }

        console_error!("Could not render frame: {}", self.current_frame);

        false
    }
}

#[wasm_bindgen]
#[derive(Copy, Clone, Debug)]
pub enum ContainerFormat {
    Mkv = "mkv",
    Mp4 = "mp4",
}

impl From<video::DemuxError> for JsValue {
    fn from(value: video::DemuxError) -> Self {
        JsError::new(&value.to_string()).into()
    }
}

#[wasm_bindgen]
pub fn load(buffer: ArrayBuffer, format: ContainerFormat) -> Result<Demuxer, JsValue> {
    let buffer = js_sys::Uint8Array::new(&buffer).to_vec();
    let mut file: Box<dyn video::VideoFile> = match format {
        ContainerFormat::Mkv => Box::new(video::mkv::MkvVideoFile::init(buffer)?),
        ContainerFormat::Mp4 => Box::new(video::mp4::Mp4VideoFile::init(buffer)?),
        format => return Err(JsError::new(&format!("Invalid container format: {format:?}")).into()),
    };

    let codec = file.codec();
    let coded_width = file.coded_width()?;
    let coded_height = file.coded_height()?;
    let duration = file.duration()?;
    let keyframes = file.keyframes()?;

    Ok(Demuxer {
        first_render: true,
        keyframes,
        current_frame: 0,
        coded_width,
        coded_height,
        duration,
        codec,
    })
}
