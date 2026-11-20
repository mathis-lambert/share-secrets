# syntax=docker/dockerfile:1

# ── Web client ────────────────────────────────────────────────────────────────
FROM node:26-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ── Server ────────────────────────────────────────────────────────────────────
FROM rust:1.99-alpine AS server
RUN apk add --no-cache musl-dev
WORKDIR /server
# Build dependencies first so source edits do not invalidate them.
COPY server/Cargo.toml server/Cargo.lock ./
RUN mkdir src && echo 'fn main() {}' > src/main.rs && touch src/lib.rs \
    && cargo build --release --locked && rm -rf src
COPY server/migrations ./migrations
COPY server/src ./src
RUN touch src/main.rs src/lib.rs && cargo build --release --locked \
    && mkdir -p /out/data && cp target/release/share-secrets /out/

# ── Runtime: static binary, no shell, non-root ───────────────────────────────
FROM gcr.io/distroless/static-debian12:nonroot
ARG VERSION=dev
LABEL org.opencontainers.image.title="share-secrets" \
      org.opencontainers.image.description="End-to-end encrypted, self-destructing secret sharing" \
      org.opencontainers.image.source="https://github.com/mathis-lambert/share-secrets" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}"
COPY --from=server /out/share-secrets /app/share-secrets
COPY --from=web /web/dist /app/web
COPY --from=server --chown=nonroot:nonroot /out/data /data
ENV LISTEN_ADDR=0.0.0.0:8080 \
    DATA_DIR=/data \
    STATIC_DIR=/app/web
USER nonroot
EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD ["/app/share-secrets", "healthcheck"]
ENTRYPOINT ["/app/share-secrets"]
