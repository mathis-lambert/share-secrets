use axum::{extract::State, response::Response};
use serde::Serialize;

use crate::{
    http::{AppState, json::no_store},
    storage::Store,
};

pub async fn health() -> &'static str {
    "ok"
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PublicConfig<'a> {
    site_name: &'a str,
    max_secret_size: usize,
    /// Seconds.
    ttl_options: Vec<u64>,
    default_ttl: u64,
    max_views: u32,
    max_failed_attempts: u32,
    legal: LegalInfo<'a>,
}

#[derive(Serialize)]
struct LegalInfo<'a> {
    publisher: Option<&'a str>,
    contact: Option<&'a str>,
    hosting: Option<&'a str>,
}

pub async fn config<S: Store>(State(state): State<AppState<S>>) -> Response {
    let c = &state.config;
    no_store(PublicConfig {
        site_name: &c.site_name,
        max_secret_size: c.max_secret_size,
        ttl_options: c.ttl_options.iter().map(|d| d.as_secs()).collect(),
        default_ttl: c.default_ttl.as_secs(),
        max_views: c.max_views,
        max_failed_attempts: c.max_failed_attempts,
        legal: LegalInfo {
            publisher: c.legal.publisher.as_deref(),
            contact: c.legal.contact.as_deref(),
            hosting: c.legal.hosting.as_deref(),
        },
    })
}
