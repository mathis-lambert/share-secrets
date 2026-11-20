use axum::{
    extract::{Request, State},
    http::{HeaderName, HeaderValue},
    middleware::Next,
    response::Response,
};

/// The page loads only its own scripts and styles and talks only to its own
/// API, so a strict policy costs nothing and blocks injected code.
const CSP: &str = "default-src 'none'; script-src 'self'; style-src 'self'; \
    img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; \
    base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

const HEADERS: &[(&str, &str)] = &[
    ("content-security-policy", CSP),
    ("referrer-policy", "no-referrer"),
    ("x-content-type-options", "nosniff"),
    ("x-frame-options", "DENY"),
    ("cross-origin-opener-policy", "same-origin"),
    ("cross-origin-resource-policy", "same-origin"),
    (
        "permissions-policy",
        "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    ),
];

pub async fn security_headers(State(hsts): State<bool>, req: Request, next: Next) -> Response {
    let mut res = next.run(req).await;
    let headers = res.headers_mut();
    for (name, value) in HEADERS {
        headers.insert(
            HeaderName::from_static(name),
            HeaderValue::from_static(value),
        );
    }
    if hsts {
        headers.insert(
            HeaderName::from_static("strict-transport-security"),
            HeaderValue::from_static("max-age=63072000; includeSubDomains"),
        );
    }
    res
}
