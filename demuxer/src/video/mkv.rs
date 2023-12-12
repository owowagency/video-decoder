use std::io::Cursor;

use crate::{video::frames::FrameCache, console_log};

use super::{VideoFile, frames::FrameCacheStore};

pub struct MkvVideoFile {
    file: matroska_demuxer::MatroskaFile<Cursor<Vec<u8>>>,
    video_track: u64,
}

impl From<matroska_demuxer::DemuxError> for super::DemuxError {
    fn from(value: matroska_demuxer::DemuxError) -> Self {
        match value {
            matroska_demuxer::DemuxError::IoError(err) => super::DemuxError::Io(err.to_string()),
            err => super::DemuxError::Unknown(err.to_string()),
        }
    }
}

fn find_video_track(file: &matroska_demuxer::MatroskaFile<Cursor<Vec<u8>>>) -> super::Result<u64> {
    for track  in file.tracks().iter() {
        match track.video() {
            Some(_) => return Ok(track.track_number().get()),
            None => continue,
        }
    }

    Err(super::DemuxError::TrackNotFound("Could not find video track".to_string()))
}

impl MkvVideoFile {
    pub fn init(buffer: Vec<u8>) -> super::Result<Self> {
        let cursor = Cursor::new(buffer);
        let file = matroska_demuxer::MatroskaFile::open(cursor)?;
        let video_track = find_video_track(&file)?;

        Ok(MkvVideoFile { file, video_track })
    }
}

impl VideoFile for MkvVideoFile {
    fn codec(&self) -> Option<String> {
        // TODO: Figure out how to get a "FourCC" codec string that VideoDecoder accepts
        None
    }

    fn coded_width(&self) -> super::Result<u32> {
        for track in self.file.tracks().iter() {
            if track.track_number().get() != self.video_track {
                continue;
            }

            match track.video() {
                Some(video) => return Ok(video.pixel_width().get() as u32),
                None => return Err(super::DemuxError::TrackNotFound("Could not find video track".to_string())),
            }
        }

        Err(super::DemuxError::TrackNotFound("Could not find video track".to_string()))
    }

    fn coded_height(&self) -> super::Result<u32> {
        for track in self.file.tracks().iter() {
            if track.track_number().get() != self.video_track {
                continue;
            }

            match track.video() {
                Some(video) => return Ok(video.pixel_width().get() as u32),
                None => return Err(super::DemuxError::TrackNotFound("Could not find video track".to_string())),
            }
        }

        Err(super::DemuxError::TrackNotFound("Could not find video track".to_string()))
    }

    fn duration(&self) -> super::Result<f64> {
        self.file.info().duration().ok_or(super::DemuxError::InvalidData("No duration".to_string()))
    }

    fn keyframes(&mut self) -> super::Result<super::frames::FrameCacheStore> {
        let mut store = Vec::new();

        let mut frame = matroska_demuxer::Frame::default();
        loop {
            if !self.file.next_frame(&mut frame)? {
                break;
            }

            console_log!("next {} {}", frame.track, self.video_track);

            if frame.track != self.video_track {
                continue;
            }

            let keyframe = frame.is_keyframe.unwrap_or(false);

            if keyframe {
                console_log!("Found key frame {} [{}]", frame.timestamp, store.len() + 1);
            }

            let ts = frame.timestamp as f64;
            let chunk = FrameCache::init(&frame.data, ts, keyframe)?;

            store.push(chunk);
        }

        Ok(FrameCacheStore::new(store)?)
    }
}