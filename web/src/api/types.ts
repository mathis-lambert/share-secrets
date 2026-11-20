/** Wire types of the server API. Byte fields are unpadded base64url. */

export interface PublicConfig {
  siteName: string;
  maxSecretSize: number;
  /** Seconds. */
  ttlOptions: number[];
  defaultTtl: number;
  maxViews: number;
  maxFailedAttempts: number;
  legal: {
    publisher: string | null;
    contact: string | null;
    hosting: string | null;
  };
}

export interface PassphraseDto {
  salt: string;
  iterations: number;
}

export interface CreateRequest {
  ciphertext: string;
  iv: string;
  salt: string;
  passphrase: PassphraseDto | null;
  auth: string;
  ttl: number;
  views: number;
}

export interface CreateResponse {
  id: string;
  /** Unix seconds. */
  expiresAt: number;
}

export interface InspectResponse {
  salt: string;
  passphrase: PassphraseDto | null;
  expiresAt: number;
  viewsLeft: number;
}

export interface RevealResponse {
  ciphertext: string;
  iv: string;
  viewsLeft: number;
}

export type ErrorCode =
  | "invalid_request"
  | "not_found"
  | "wrong_key"
  | "too_many_requests"
  | "too_large"
  | "internal"
  | "network";
