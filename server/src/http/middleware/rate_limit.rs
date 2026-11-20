use std::{
    collections::HashMap,
    net::IpAddr,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use axum::{
    extract::{Request, State},
    http::{HeaderValue, StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
};

use super::client_ip;
use crate::http::error::ApiError;

/// In-memory token bucket per client IP: `per_minute` requests, with bursts
/// up to the same amount.
pub struct RateLimiter {
    per_minute: f64,
    trust_proxy: bool,
    state: Mutex<Buckets>,
}

struct Buckets {
    map: HashMap<IpAddr, Bucket>,
    pruned: Instant,
}

struct Bucket {
    tokens: f64,
    seen: Instant,
}

impl RateLimiter {
    pub fn new(per_minute: u32, trust_proxy: bool) -> Self {
        Self {
            per_minute: f64::from(per_minute),
            trust_proxy,
            state: Mutex::new(Buckets {
                map: HashMap::new(),
                pruned: Instant::now(),
            }),
        }
    }

    /// Takes a token for `ip`, or returns how long to wait for one.
    pub fn check(&self, ip: IpAddr, now: Instant) -> Result<(), Duration> {
        let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        if now.duration_since(state.pruned) > Duration::from_secs(60) {
            // Buckets idle for a minute are full again: forget them.
            state
                .map
                .retain(|_, b| now.duration_since(b.seen) < Duration::from_secs(60));
            state.pruned = now;
        }
        let rate = self.per_minute / 60.0;
        let bucket = state.map.entry(ip).or_insert(Bucket {
            tokens: self.per_minute,
            seen: now,
        });
        let elapsed = now.duration_since(bucket.seen).as_secs_f64();
        bucket.tokens = (bucket.tokens + elapsed * rate).min(self.per_minute);
        bucket.seen = now;
        if bucket.tokens >= 1.0 {
            bucket.tokens -= 1.0;
            Ok(())
        } else {
            Err(Duration::from_secs_f64((1.0 - bucket.tokens) / rate))
        }
    }
}

pub async fn rate_limit(
    State(limiter): State<Arc<RateLimiter>>,
    req: Request,
    next: Next,
) -> Response {
    let Some(ip) = client_ip(&req, limiter.trust_proxy) else {
        return next.run(req).await;
    };
    match limiter.check(ip, Instant::now()) {
        Ok(()) => next.run(req).await,
        Err(wait) => {
            let mut res = ApiError::new(
                StatusCode::TOO_MANY_REQUESTS,
                "too_many_requests",
                "Too many requests, try again shortly.",
            )
            .into_response();
            let secs = wait.as_secs().max(1).to_string();
            if let Ok(v) = HeaderValue::from_str(&secs) {
                res.headers_mut().insert(header::RETRY_AFTER, v);
            }
            res
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn limits_per_ip_and_refills() {
        let limiter = RateLimiter::new(2, false);
        let (a, b): (IpAddr, IpAddr) = ([1, 1, 1, 1].into(), [2, 2, 2, 2].into());
        let t0 = Instant::now();
        assert!(limiter.check(a, t0).is_ok());
        assert!(limiter.check(a, t0).is_ok());
        assert!(limiter.check(a, t0).is_err());
        assert!(limiter.check(b, t0).is_ok(), "limit leaked across IPs");
        assert!(
            limiter.check(a, t0 + Duration::from_secs(30)).is_ok(),
            "no refill"
        );
    }
}
