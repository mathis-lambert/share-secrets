//! Runtime settings, read from environment variables.

mod duration;

use std::{net::SocketAddr, path::PathBuf, time::Duration};

pub use duration::format_duration;
use duration::parse_duration;

#[derive(Debug, thiserror::Error)]
#[error("{key}: {reason}")]
pub struct ConfigError {
    key: &'static str,
    reason: String,
}

fn err(key: &'static str, reason: impl Into<String>) -> ConfigError {
    ConfigError {
        key,
        reason: reason.into(),
    }
}

/// Legal notice details, displayed as given.
#[derive(Debug, Clone)]
pub struct Legal {
    pub publisher: Option<String>,
    pub contact: Option<String>,
    pub hosting: Option<String>,
}

/// Every setting, with defaults filled in. See README for the full list.
#[derive(Debug, Clone)]
pub struct Config {
    pub listen_addr: SocketAddr,
    /// PostgreSQL URL; when unset, secrets are stored as files in `data_dir`.
    pub database_url: Option<String>,
    pub data_dir: PathBuf,
    pub static_dir: PathBuf,
    pub site_name: String,
    /// Shown on the legal page; each is optional.
    pub legal: Legal,
    /// Largest accepted plaintext, in bytes.
    pub max_secret_size: usize,
    /// Allowed lifetimes, sorted and deduplicated.
    pub ttl_options: Vec<Duration>,
    pub default_ttl: Duration,
    pub max_views: u32,
    /// Wrong keys tolerated before a secret is destroyed.
    pub max_failed_attempts: u32,
    /// API requests per minute and client IP; 0 disables the limit.
    pub rate_limit: u32,
    /// Read the client IP from X-Forwarded-For (only behind a reverse proxy).
    pub trust_proxy: bool,
    pub hsts: bool,
    pub sweep_interval: Duration,
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        Self::from_lookup(|k| std::env::var(k).ok())
    }

    pub fn from_lookup(lookup: impl Fn(&str) -> Option<String>) -> Result<Self, ConfigError> {
        let get = |key: &'static str, default: &str| -> String {
            lookup(key)
                .map(|v| v.trim().to_owned())
                .filter(|v| !v.is_empty())
                .unwrap_or_else(|| default.to_owned())
        };
        let optional = |key: &'static str| Some(get(key, "")).filter(|v| !v.is_empty());
        let parse_num = |key: &'static str, default: &str| -> Result<u64, ConfigError> {
            get(key, default)
                .parse()
                .map_err(|_| err(key, "expected a whole number"))
        };
        let parse_bool = |key: &'static str, default: &str| -> Result<bool, ConfigError> {
            match get(key, default).to_ascii_lowercase().as_str() {
                "1" | "true" | "yes" | "on" => Ok(true),
                "0" | "false" | "no" | "off" => Ok(false),
                _ => Err(err(key, "expected true or false")),
            }
        };
        let parse_dur = |key: &'static str, default: &str| -> Result<Duration, ConfigError> {
            parse_duration(&get(key, default)).map_err(|e| err(key, e))
        };

        let mut ttl_options = get("TTL_OPTIONS", "1h,1d,7d")
            .split(',')
            .map(|p| parse_duration(p.trim()).map_err(|e| err("TTL_OPTIONS", e)))
            .collect::<Result<Vec<_>, _>>()?;
        ttl_options.sort();
        ttl_options.dedup();

        let config = Self {
            listen_addr: get("LISTEN_ADDR", "0.0.0.0:8080")
                .parse()
                .map_err(|_| err("LISTEN_ADDR", "expected host:port"))?,
            database_url: optional("DATABASE_URL"),
            data_dir: get("DATA_DIR", "./data").into(),
            static_dir: get("STATIC_DIR", "./web/dist").into(),
            site_name: get("SITE_NAME", "Share Secrets"),
            legal: Legal {
                publisher: optional("LEGAL_PUBLISHER"),
                contact: optional("LEGAL_CONTACT"),
                hosting: optional("LEGAL_HOSTING"),
            },
            max_secret_size: parse_num("MAX_SECRET_SIZE", "65536")? as usize,
            ttl_options,
            default_ttl: parse_dur("DEFAULT_TTL", "1d")?,
            max_views: parse_num("MAX_VIEWS", "10")? as u32,
            max_failed_attempts: parse_num("MAX_FAILED_ATTEMPTS", "5")? as u32,
            rate_limit: parse_num("RATE_LIMIT", "60")? as u32,
            trust_proxy: parse_bool("TRUST_PROXY", "false")?,
            hsts: parse_bool("HSTS", "false")?,
            sweep_interval: parse_dur("SWEEP_INTERVAL", "1m")?,
        };
        config.validate()?;
        Ok(config)
    }

    fn validate(&self) -> Result<(), ConfigError> {
        const DAY: u64 = 86_400;
        if !(1..=1 << 20).contains(&self.max_secret_size) {
            return Err(err("MAX_SECRET_SIZE", "must be between 1 and 1048576"));
        }
        if self
            .ttl_options
            .iter()
            .any(|d| d.as_secs() < 60 || d.as_secs() > 365 * DAY)
        {
            return Err(err("TTL_OPTIONS", "entries must be between 1m and 365d"));
        }
        if !self.ttl_options.contains(&self.default_ttl) {
            return Err(err("DEFAULT_TTL", "must be one of TTL_OPTIONS"));
        }
        if !(1..=100).contains(&self.max_views) {
            return Err(err("MAX_VIEWS", "must be between 1 and 100"));
        }
        if self.max_failed_attempts == 0 {
            return Err(err("MAX_FAILED_ATTEMPTS", "must be at least 1"));
        }
        if self.sweep_interval < Duration::from_secs(1) {
            return Err(err("SWEEP_INTERVAL", "must be at least 1s"));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn load(pairs: &[(&str, &str)]) -> Result<Config, ConfigError> {
        let map: HashMap<String, String> = pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();
        Config::from_lookup(|k| map.get(k).cloned())
    }

    #[test]
    fn defaults_are_valid() {
        let c = load(&[]).unwrap();
        assert_eq!(c.default_ttl, Duration::from_secs(86_400));
        assert_eq!(c.ttl_options.len(), 3);
        assert!(!c.trust_proxy);
    }

    #[test]
    fn options_are_sorted_and_deduplicated() {
        let c = load(&[("TTL_OPTIONS", "30d, 15m,1d,1d"), ("DEFAULT_TTL", "15m")]).unwrap();
        let secs: Vec<u64> = c.ttl_options.iter().map(Duration::as_secs).collect();
        assert_eq!(secs, [900, 86_400, 30 * 86_400]);
    }

    #[test]
    fn rejects_invalid_values() {
        for pairs in [
            &[("DEFAULT_TTL", "2h")][..],
            &[("MAX_VIEWS", "0")],
            &[("MAX_SECRET_SIZE", "abc")],
            &[("TTL_OPTIONS", "10s"), ("DEFAULT_TTL", "10s")],
            &[("HSTS", "maybe")],
        ] {
            assert!(load(pairs).is_err(), "{pairs:?} should fail");
        }
    }
}
