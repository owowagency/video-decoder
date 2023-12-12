use self::frames::FrameCacheStore;

pub mod mp4;
pub mod mkv;
pub mod frames;

pub enum DemuxError {
    Io(String),
    InvalidData(String),
    TrackNotFound(String),
    Unknown(String),
    NoFrames(String),
}

impl ToString for DemuxError {
    fn to_string(&self) -> String {
        match self {
            DemuxError::Io(msg) => msg.clone(),
            DemuxError::InvalidData(msg) => msg.clone(),
            DemuxError::TrackNotFound(msg) => msg.clone(),
            DemuxError::Unknown(msg) => msg.clone(),
            DemuxError::NoFrames(msg) => msg.clone(),
        }
    }
}

type Result<T> = std::result::Result<T, DemuxError>;

pub trait VideoFile {
    fn codec(&self) -> Option<String>;
    fn coded_width(&self) -> Result<u32>;
    fn coded_height(&self) -> Result<u32>;
    fn duration(&self) -> Result<f64>;
    fn keyframes(&mut self) -> Result<FrameCacheStore>;
}
