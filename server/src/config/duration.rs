//! Human durations: `90s`, `15m`, `12h`, `7d`.

use std::time::Duration;

pub fn parse_duration(s: &str) -> Result<Duration, String> {
    let invalid = || format!("invalid duration {s:?}, expected e.g. 30m, 12h or 7d");
    let split = s.find(|c: char| !c.is_ascii_digit()).ok_or_else(invalid)?;
    let (num, unit) = s.split_at(split);
    let n: u64 = num.parse().map_err(|_| invalid())?;
    let secs = match unit {
        "s" => n,
        "m" => n * 60,
        "h" => n * 3_600,
        "d" => n * 86_400,
        _ => return Err(invalid()),
    };
    Ok(Duration::from_secs(secs))
}

/// The largest whole unit, e.g. 86400s → "1d", 5400s → "90m".
pub fn format_duration(d: Duration) -> String {
    let s = d.as_secs();
    for (unit, size) in [("d", 86_400), ("h", 3_600), ("m", 60)] {
        if s >= size && s.is_multiple_of(size) {
            return format!("{}{unit}", s / size);
        }
    }
    format!("{s}s")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips() {
        for s in ["45s", "15m", "90m", "12h", "7d"] {
            assert_eq!(format_duration(parse_duration(s).unwrap()), s);
        }
    }

    #[test]
    fn rejects_garbage() {
        for s in ["", "d", "10", "1w", "-1d", "1.5h"] {
            assert!(parse_duration(s).is_err(), "{s}");
        }
    }
}
