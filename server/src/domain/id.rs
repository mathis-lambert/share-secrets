use std::{fmt, str::FromStr};

use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};

const ID_BYTES: usize = 12;
const ID_LEN: usize = 16; // base64 of 12 bytes, no padding

/// A random, URL-safe, 96-bit identifier. Parsing guarantees the value is
/// safe to use as a file name.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct SecretId(String);

impl SecretId {
    pub fn random() -> Self {
        let mut bytes = [0u8; ID_BYTES];
        rand::fill(&mut bytes);
        Self(URL_SAFE_NO_PAD.encode(bytes))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl FromStr for SecretId {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, ()> {
        let valid = s.len() == ID_LEN
            && s.bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_');
        valid.then(|| Self(s.to_owned())).ok_or(())
    }
}

impl fmt::Display for SecretId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn random_ids_parse() {
        let id = SecretId::random();
        assert_eq!(id.as_str().parse::<SecretId>(), Ok(id));
    }

    #[test]
    fn rejects_unsafe_input() {
        for s in [
            "",
            "short",
            "../../etc/passwd",
            "aaaaaaaaaaaaaaa/",
            "aaaaaaaaaaaaaaa.",
        ] {
            assert!(s.parse::<SecretId>().is_err(), "{s}");
        }
    }
}
