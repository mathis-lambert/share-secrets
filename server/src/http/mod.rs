//! HTTP layer: JSON API, middleware and the web client.
//!
//! ```text
//! GET    /api/config               public settings for the client
//! POST   /api/secrets              store an encrypted secret
//! GET    /api/secrets/{id}         key-derivation parameters, consumes nothing
//! POST   /api/secrets/{id}/reveal  prove the key, consume a view, get ciphertext
//! DELETE /api/secrets/{id}         prove the key, destroy the secret
//! GET    /healthz                  liveness
//! ```

mod error;
mod handlers;
mod json;
mod middleware;

use std::sync::Arc;

use axum::{
    Router,
    extract::DefaultBodyLimit,
    middleware::{from_fn, from_fn_with_state},
    routing::{get, post},
};

use crate::{config::Config, service::Service, storage::Store, web};
use error::ApiError;
use middleware::RateLimiter;

pub struct AppState<S> {
    pub service: Arc<Service<S>>,
    pub config: Arc<Config>,
}

impl<S> Clone for AppState<S> {
    fn clone(&self) -> Self {
        Self {
            service: self.service.clone(),
            config: self.config.clone(),
        }
    }
}

pub fn router<S: Store>(state: AppState<S>) -> Router {
    let config = state.config.clone();

    let mut api = Router::new()
        .route("/config", get(handlers::meta::config::<S>))
        .route("/secrets", post(handlers::secrets::create::<S>))
        .route(
            "/secrets/{id}",
            get(handlers::secrets::inspect::<S>).delete(handlers::secrets::destroy::<S>),
        )
        .route("/secrets/{id}/reveal", post(handlers::secrets::reveal::<S>))
        .route_layer(from_fn(middleware::access_log))
        .fallback(|| async { ApiError::not_found("Unknown endpoint.") })
        // base64 inflates by 4/3; 4 KiB covers the other fields.
        .layer(DefaultBodyLimit::max(config.max_secret_size * 4 / 3 + 4096))
        .with_state(state);

    if config.rate_limit > 0 {
        let limiter = Arc::new(RateLimiter::new(config.rate_limit, config.trust_proxy));
        api = api.layer(from_fn_with_state(limiter, middleware::rate_limit));
    }

    let app = Router::new()
        .route("/healthz", get(handlers::meta::health))
        .nest("/api", api)
        .fallback_service(web::service(&config.static_dir));
    middleware::security_headers(app, config.hsts)
}
