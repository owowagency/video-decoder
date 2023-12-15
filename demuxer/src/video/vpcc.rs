use super::CodecPrivate;

#[derive(Debug, PartialEq, Eq)]
pub struct Vpcc {
    pub profile: u8,
    pub level: u8,
    pub bit_depth: u8,
    pub chroma_subsampling: u8,
}

impl CodecPrivate for Vpcc {
    fn to_codec_string(&self) -> String {
        // cccc.PP.LL.DD.CC.cp.tc.mc.FF
        format!(
            "vp09.{:02}.{:02}.{:02}.{:02}", 
            self.profile, 
            self.level, 
            self.bit_depth, 
            self.chroma_subsampling,
        )
    }
}