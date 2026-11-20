use std::net::{IpAddr, SocketAddr};

use axum::{extract::ConnectInfo, http::Request};

/// The caller's address. Behind a trusted reverse proxy the last
/// X-Forwarded-For entry is the one the proxy itself observed; earlier
/// entries are client-supplied and ignored.
pub fn client_ip<B>(req: &Request<B>, trust_proxy: bool) -> Option<IpAddr> {
    if trust_proxy {
        let forwarded = req
            .headers()
            .get_all("x-forwarded-for")
            .iter()
            .next_back()
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.rsplit(',').next())
            .and_then(|ip| ip.trim().parse().ok());
        if forwarded.is_some() {
            return forwarded;
        }
    }
    req.extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|c| c.0.ip())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_trusts_the_proxy_entry() {
        let mut req = Request::builder()
            .header("x-forwarded-for", "6.6.6.6, 1.2.3.4")
            .body(())
            .unwrap();
        req.extensions_mut()
            .insert(ConnectInfo(SocketAddr::from(([10, 0, 0, 2], 1234))));
        assert_eq!(client_ip(&req, false), Some([10, 0, 0, 2].into()));
        assert_eq!(client_ip(&req, true), Some([1, 2, 3, 4].into()));
    }
}
