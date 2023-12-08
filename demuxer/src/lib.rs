use std::{io::{Cursor, Read, Seek}, cmp::Ordering};

use frames::FrameCacheStore;
use js_sys::ArrayBuffer;
use matroska_demuxer::{MatroskaFile, TrackEntry, Video};
use web_sys::VideoDecoder;

mod frames;
mod log;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Demuxer {
    first_render: bool,
    keyframes: FrameCacheStore,
    current_frame: usize,
    coded_width: u32,
    coded_height: u32,
    display_width: Option<u32>,
    display_height: Option<u32>,
    duration: f64,
    codec: String,
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

    #[wasm_bindgen(js_name = displayWidth)]
    pub fn display_width(&self) -> Option<u32> {
        self.display_width
    }

    #[wasm_bindgen(js_name = displayHeight)]
    pub fn display_height(&self) -> Option<u32> {
        self.display_height
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

    pub fn codec(&self) -> String {
        self.codec.clone()
    }

    pub fn decode(&mut self, from: usize, to: usize, decoder: &VideoDecoder) -> Result<usize, JsValue> {
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
            self.render(decoder)?;
            self.first_render = false;
            decoded += 1;
        }

        Ok(decoded)
    }

    pub fn seek(&mut self, frame: usize, decoder: &VideoDecoder) -> Result<u32, JsValue> {
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
            self.render(decoder)?;
            self.first_render = false;
        }
        
        Ok(self.current_timestamp())
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

    fn render(&self, decoder: &VideoDecoder) -> Result<bool, JsValue> {
        let frame = self.keyframes.get(self.current_frame).ok_or(JsError::new(&format!("Could not render frame {}", self.current_frame)))?;
        console_log!("idx: {}, ts: {}, keyframe: {:?}", self.current_frame, frame.timestamp, frame.keyframe);
        decoder.decode(&frame.chunk);
        Ok(true)
    }
}

#[wasm_bindgen]
pub fn load(buffer: ArrayBuffer) -> Result<Demuxer, JsValue> {
    let buffer = js_sys::Uint8Array::new(&buffer).to_vec();
    let cursor = Cursor::new(buffer);

    let matroska = MatroskaFile::open(cursor).map_err(|e| JsError::new(&e.to_string()))?;

    let video_info = find_video_track(&matroska).map_err(|e| JsError::new(&e))?;

    let duration = matroska.info().duration().ok_or(JsError::new("Could not find duration"))?;
    let coded_width = video_info.video.pixel_width().get() as u32;
    let coded_height = video_info.video.pixel_height().get() as u32;
    let display_width = video_info.video.display_width().map(|n| n.get() as u32);
    let display_height = video_info.video.display_height().map(|n| n.get() as u32);

    let video_track = video_info.track.track_number().get();
    let codec = video_info.codec;

    let keyframes = FrameCacheStore::init(matroska, video_track)?;

    Ok(Demuxer {
        first_render: true,
        keyframes,
        current_frame: 0,
        coded_width,
        coded_height,
        display_width,
        display_height,
        duration,
        codec,
    })
}

struct VideoInfo<'a> {
    track: &'a TrackEntry,
    video: &'a Video,
    codec: String,
}

fn find_video_track<'a, R: Read + Seek>(matroska: &'a MatroskaFile<R>) -> Result<VideoInfo, String> {
    for track in matroska.tracks().iter().rev() {
        if let Some(video) = track.video() {
            let codec = get_codec(track)?;
            return Ok(VideoInfo { track, video, codec });
        }
    }

    Err("Did not find video track".to_string())
}

// https://www.webmproject.org/docs/container/#vp9-codec-feature-metadata-codecprivate
fn get_vp_codec(private: &[u8]) -> Result<String, String> {
    if private.len() >= 2 {
        let profile = private[0];
        let level = private[1];
        let bit_depth = private[2];

        return Ok(format!("vp09.{profile:#02}.{level:#02}.{bit_depth:#02}"));
    }

    Err("Invalid CodecPrivate data".to_string())
}

fn get_codec<'a>(track: &'a TrackEntry) -> Result<String, String> {
    match track.codec_id() {
        // VP9 *SHOULD* have codec private data, but so far I haven't been able to get a video with it
        "V_VP9" => match track.codec_private() {
            Some(codec_private) => get_vp_codec(codec_private),
            None => Ok("vp09.00.61.12".to_string())
        }
        // VP8 will never have codec private data, chrome seems to accept vp8
        "V_VP8" => Ok("vp8".to_string()),
        id => Err(format!("Unsupported codec id: {id:?}")),
    }
}