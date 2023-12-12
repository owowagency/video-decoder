use std::io::Cursor;

use crate::{video::frames::FrameCache, console_log};

use super::{VideoFile, frames::FrameCacheStore};

pub struct Mp4VideoFile {
    file: mp4::Mp4Reader<Cursor<Vec<u8>>>,
    video_track: u32,
}

impl From<mp4::Error> for super::DemuxError {
    fn from(value: mp4::Error) -> Self {
        match value {
            mp4::Error::IoError(_) => super::DemuxError::Io(value.to_string()),
            mp4::Error::InvalidData(_) => super::DemuxError::InvalidData(value.to_string()),
            mp4::Error::TrakNotFound(_) => super::DemuxError::TrackNotFound(value.to_string()),
            err => super::DemuxError::Unknown(err.to_string()),
        }
    }
}

impl From<super::frames::FrameCacheError> for super::DemuxError {
    fn from(value: super::frames::FrameCacheError) -> Self {
        match value {
            super::frames::FrameCacheError::Init(err) => super::DemuxError::InvalidData(err),
            super::frames::FrameCacheError::NoFrames(err) => super::DemuxError::NoFrames(err),
        }
    }
}

fn find_video_track(file: &mp4::Mp4Reader<Cursor<Vec<u8>>>) -> super::Result<u32> {
    for (id, track) in file.tracks().iter() {
        match track.track_type() {
            Ok(track_type) => if track_type == mp4::TrackType::Video {
                return Ok(*id)
            }
            Err(_) => continue,
        }
    }

    Err(super::DemuxError::TrackNotFound("Could not find video track".to_string()))
}

impl Mp4VideoFile {
    pub fn init(buffer: Vec<u8>) -> super::Result<Self> {
        let size = buffer.len() as u64;
        let cursor = Cursor::new(buffer);
        let file = mp4::Mp4Reader::read_header(cursor, size)?;
        let video_track = find_video_track(&file)?;

        Ok(Mp4VideoFile { file, video_track })
    }
}

impl VideoFile for Mp4VideoFile {
    fn codec(&self) -> Option<String> {
        // TODO: Figure out how to get a "FourCC" codec string that VideoDecoder accepts
        None
    }

    fn coded_width(&self) -> super::Result<u32> {
        for (id, track) in self.file.tracks().iter() {
            if self.video_track == *id {
                return Ok(track.width() as u32);
            }
        }

        Err(super::DemuxError::TrackNotFound("Could not find video track".to_string()))
    }

    fn coded_height(&self) -> super::Result<u32> {
        for (id, track) in self.file.tracks().iter() {
            if self.video_track == *id {
                return Ok(track.height() as u32);
            }
        }

        Err(super::DemuxError::TrackNotFound("Could not find video track".to_string()))
    }

    fn duration(&self) -> super::Result<f64> {
        Ok(self.file.duration().as_secs_f64())
    }

    fn keyframes(&mut self) -> super::Result<super::frames::FrameCacheStore> {
        let sample_count = self.file.sample_count(self.video_track)?;
        let mut store = Vec::new();

        for idx in 0..sample_count {
            let sample_id = idx + 1;
            let maybe_sample = self.file.read_sample(self.video_track, sample_id)?;

            if let Some(sample) = maybe_sample {
                let el = FrameCache::init(&sample.bytes, sample.start_time as f64, sample.is_sync)?;
                store.push(el);
            } else {
                console_log!("Did not find sample for id: {sample_id}");
            }
        }

        Ok(FrameCacheStore::new(store)?)
    }
}