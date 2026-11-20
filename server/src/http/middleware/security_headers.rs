use axum::{
    Router,
    http::{HeaderName, HeaderValue},
};
use tower_http::set_header::SetResponseHeaderLayer;

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

const HSTS: (&str, &str) = (
    "strict-transport-security",
    "max-age=63072000; includeSubDomains",
);

/// Sets browser hardening headers on every response.
pub fn security_headers(router: Router, hsts: bool) -> Router {
    let headers = HEADERS.iter().chain(hsts.then_some(&HSTS));
    headers.fold(router, |router, (name, value)| {
        router.layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static(name),
            HeaderValue::from_static(value),
        ))
    })
}
