use super::CodecPrivate;

pub struct Av1 {
    pub seq_profile: u8,
    pub seq_level_idx_0: u8,
    pub seq_tier_0: bool,
    pub high_bitdepth: bool,
    pub twelve_bit: bool,
}

impl Av1 {
    fn tier(&self) -> String {
        match self.seq_tier_0 {
            true => "M".to_string(),
            false => "H".to_string(),
        }
    }

    fn bit_depth(&self) -> u8 {
        if self.seq_profile == 2 && self.high_bitdepth {
            if self.twelve_bit {
                12
            } else {
                10
            }
        } else {
            if self.high_bitdepth {
                10
            } else {
                8
            }
        }
    }
}

impl CodecPrivate for Av1 {
    fn to_codec_string(&self) -> String {
        format!("av01.{}.{:02}{}.{:02}", self.seq_profile, self.seq_level_idx_0, self.tier(), self.bit_depth())
    }
}