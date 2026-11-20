//! Serves the compiled web client from `STATIC_DIR`.
//!
//! Unknown paths fall back to `index.html` so the client routes `/s/{id}`
//! itself. Fingerprinted files under `/assets/` are cached for a year; the
//! rest must be revalidated so a release is picked up at once. Responses are
//! compressed (brotli or gzip) when the browser accepts it.

use std::{convert::Infallible, path::Path};

use axum::{
    extract::Request,
    http::{HeaderValue, Method, StatusCode, header},
    response::IntoResponse,
    routing::{MethodRouter, any_service},
};
use tower::ServiceExt;
use tower_http::{
    compression::CompressionLayer,
    services::{ServeDir, ServeFile},
};

pub fn service(dir: &Path) -> MethodRouter {
    let files = ServeDir::new(dir)
        .append_index_html_on_directories(false)
        .fallback(ServeFile::new(dir.join("index.html")));

    any_service(tower::service_fn(move |req: Request| {
        let files = files.clone();
        async move {
            if !matches!(*req.method(), Method::GET | Method::HEAD) {
                return Ok::<_, Infallible>(StatusCode::METHOD_NOT_ALLOWED.into_response());
            }
            let immutable = req.uri().path().starts_with("/assets/");
            let mut res = files.oneshot(req).await.into_response();
            let cache = if immutable && res.status().is_success() {
                "public, max-age=31536000, immutable"
            } else {
                "no-cache"
            };
            res.headers_mut()
                .insert(header::CACHE_CONTROL, HeaderValue::from_static(cache));
            Ok(res)
        }
    }))
    // Only static files: API payloads are ciphertext, which does not compress.
    .layer(CompressionLayer::new())
}
