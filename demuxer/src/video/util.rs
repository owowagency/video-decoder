use bitter::{BitReader, BigEndianReader};

pub struct Bits<'a> {
    bits: BigEndianReader<'a>
}

impl<'a> Bits<'a> {
    pub fn new(data: &'a [u8]) -> Self {
        Self {
            bits: BigEndianReader::new(data)
        }
    }

    pub fn read_bool(&mut self, description: &str) -> Result<bool, String> {
        self.bits.read_bit().ok_or(format!("Could not read {description}"))
    }

    pub fn read_u8(&mut self, size: u8, description: &str) -> Result<u8, String> {
        Ok(self.bits.read_bits(size as u32).ok_or(format!("Could not read {description}"))? as u8)
    }

    pub fn skip(&mut self, size: u8, description: &str) -> Result<(), String> {
        self.bits.read_bits(size as u32).ok_or(format!("Could not read {description}"))?;
        Ok(())
    }
 }