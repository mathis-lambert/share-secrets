use std::time::Instant;

use axum::{
    extract::{MatchedPath, Request},
    middleware::Next,
    response::Response,
};

/// One log line per API call. It records the route template, never the
/// concrete path, so secret identifiers and client IPs stay out of logs.
pub async fn access_log(req: Request, next: Next) -> Response {
    let method = req.method().clone();
    let route = req
        .extensions()
        .get::<MatchedPath>()
        .map_or_else(|| "unmatched".to_owned(), |p| p.as_str().to_owned());
    let start = Instant::now();
    let res = next.run(req).await;
    tracing::info!(
        %method,
        route,
        status = res.status().as_u16(),
        ms = start.elapsed().as_millis() as u64,
        "request"
    );
    res
}
