use std::io::Cursor;

use crate::video::frames::FrameCache;
use super::{VideoFile, frames::FrameCacheStore, CodecPrivate, util::Bits, av1::Av1, vpcc::Vpcc};

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

impl Av1 {
    fn from(codec_private: &[u8]) -> Result<Self, String> {
        let mut bits = Bits::new(codec_private);
        bits.skip(1, "marker")?;
        bits.skip(7, "version")?;
        let seq_profile = bits.read_u8(3, "seq_profile")?;
        let seq_level_idx_0 = bits.read_u8(5, "seq_level_idx_0")?;
        let seq_tier_0 = bits.read_bool("seq_tier_0")?;
        let high_bitdepth = bits.read_bool("high_bitdepth")?;
        let twelve_bit = bits.read_bool("twelve_bit")?;
        Ok(Self {
            seq_profile,
            seq_level_idx_0,
            seq_tier_0,
            high_bitdepth,
            twelve_bit,
        })
    }
}

#[derive(Debug)]
enum VpccFeature {
    Profile = 1,
    Level = 2,
    BitDepth = 3,
    ChromaSubsampling = 4
}

impl VpccFeature {
    fn from(id: u8) -> Result<VpccFeature, String> {
        match id {
            1 => Ok(VpccFeature::Profile),
            2 => Ok(VpccFeature::Level),
            3 => Ok(VpccFeature::BitDepth),
            4 => Ok(VpccFeature::ChromaSubsampling),
            unknown => Err(format!("Unknown vpcc feature {unknown}")),
        }
    }

    fn length(&self) -> u8 {
        match self {
            VpccFeature::Profile => 1,
            VpccFeature::Level => 1,
            VpccFeature::BitDepth => 1,
            VpccFeature::ChromaSubsampling => 1,
        }
    }
}

struct VpccCodecPrivateReader<'a> {
    data: &'a [u8],
    offset: usize,
}

impl<'a> VpccCodecPrivateReader<'a> {
    fn from(data: &'a [u8]) -> Self {
        Self {
            data,
            offset: 0
        }
    }

    // https://github.com/webmproject/libwebm/blob/6745fd29e0245fc584b0bb9f65018ea2366fe7fb/common/hdr_util.cc#L143
    fn next(&mut self) -> Result<(VpccFeature, u8), String> {
        let id = self.data
            .get(self.offset)
            .map(|id| VpccFeature::from(*id))
            .ok_or("Could not get id byte")??;
        self.offset += 1;
        let length = self.data.get(self.offset).ok_or("Could not get length byte")?;
        self.offset += 1;

        if *length != id.length() {
            return Err(format!("Invalid length for feature {id:?}"));
        }

        // TODO: Verify that level, profile, bit_depth & chroma subsampling have valid values based on spec
        let return_value = match id {
            // https://github.com/webmproject/libwebm/blob/6745fd29e0245fc584b0bb9f65018ea2366fe7fb/common/hdr_util.cc#L166
            VpccFeature::Profile => (VpccFeature::Level, *self.data.get(self.offset).ok_or("Could not get level byte")?),
            // https://github.com/webmproject/libwebm/blob/6745fd29e0245fc584b0bb9f65018ea2366fe7fb/common/hdr_util.cc#L175
            VpccFeature::Level => (VpccFeature::Profile, *self.data.get(self.offset).ok_or("Could not get profile byte")?),
            // https://github.com/webmproject/libwebm/blob/6745fd29e0245fc584b0bb9f65018ea2366fe7fb/common/hdr_util.cc#L194
            VpccFeature::BitDepth => (VpccFeature::BitDepth, *self.data.get(self.offset).ok_or("Could not get bit_depth byte")?),
            // https://github.com/webmproject/libwebm/blob/6745fd29e0245fc584b0bb9f65018ea2366fe7fb/common/hdr_util.cc#L203
            VpccFeature::ChromaSubsampling => (VpccFeature::ChromaSubsampling, *self.data.get(self.offset).ok_or("Could not get chroma_subsampling byte")?),
        };

        self.offset += 1;

        Ok(return_value)
    }

    fn read(&mut self) -> Result<Vpcc, String> {
        self.offset = 0;
        let mut vpcc = Vpcc { profile: 0, level: 0, bit_depth: 0, chroma_subsampling: 0 };
        for _ in 0..3 {
            let (id, value) = self.next()?;
            match id {
                VpccFeature::Profile => vpcc.profile = value,
                VpccFeature::Level => vpcc.level = value,
                VpccFeature::BitDepth => vpcc.bit_depth = value,
                VpccFeature::ChromaSubsampling => vpcc.chroma_subsampling = value,
            }
        }

        Ok(vpcc)
    }
}

impl Vpcc {
    fn from(codec_private: &[u8]) -> Result<Self, String> {
        let mut reader = VpccCodecPrivateReader::from(codec_private);
        reader.read()
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
        for track in self.file.tracks().iter() {
            if track.track_number().get() != self.video_track {
                continue;
            }

            match track.codec_id() {
                "V_AV1" => return track.codec_private()
                    .map(|codec_private| Av1::from(codec_private).ok())
                    .flatten()
                    .map(|seq| seq.to_codec_string()),
                // Codec private data SHOULD be set according to webm spec, but videos encoded using vpx-vp9 never set this data
                "V_VP9" => return track.codec_private()
                    .map(|codec_private| Vpcc::from(codec_private).ok())
                    .flatten()
                    .map(|seq| seq.to_codec_string()),
                "V_VP8" => return Some("vp8".to_string()),
                // TODO: More codecs?
                _ => return None,
            };
        }

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

            if frame.track != self.video_track {
                continue;
            }

            let keyframe = frame.is_keyframe.unwrap_or(false);

            let ts = frame.timestamp as f64;
            let chunk = FrameCache::init(&frame.data, ts, keyframe)?;

            store.push(chunk);
        }

        Ok(FrameCacheStore::new(store)?)
    }
}