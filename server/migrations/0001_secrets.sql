-- One row per secret. Only ciphertext and public parameters: the key never
-- reaches the server.
CREATE TABLE secrets (
    id                    text PRIMARY KEY,
    ciphertext            bytea   NOT NULL,
    iv                    bytea   NOT NULL,
    salt                  bytea   NOT NULL,
    passphrase_salt       bytea,
    passphrase_iterations integer,
    auth_hash             bytea   NOT NULL,
    created_at            bigint  NOT NULL,
    expires_at            bigint  NOT NULL,
    views_left            integer NOT NULL CHECK (views_left >= 0),
    failed_attempts       integer NOT NULL DEFAULT 0
);

CREATE INDEX secrets_expires_at ON secrets (expires_at);
