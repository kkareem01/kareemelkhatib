/** Worker bindings. SETUP_TOKEN is a secret; DEV=1 only in local/test env. */
export interface Env {
  readonly DB: D1Database;
  readonly VAULT: R2Bucket;
  readonly ASSETS: Fetcher;
  readonly SETUP_TOKEN?: string;
  readonly DEV?: string;
  readonly TEST_MIGRATIONS?: unknown;
}

/** Per-request context handed to every route handler. */
export interface Ctx {
  readonly req: Request;
  readonly env: Env;
  readonly exec: ExecutionContext;
  readonly url: URL;
  readonly params: Readonly<Record<string, string>>;
}

export type Handler = (ctx: Ctx) => Promise<Response>;

export interface FileRecord {
  readonly id: string;
  readonly r2_key: string;
  readonly name: string;
  readonly mime: string;
  readonly size: number;
  readonly sha256: string | null;
  readonly tags: string; // JSON array
  readonly created_at: number;
  readonly updated_at: number;
  readonly deleted_at: number | null;
}

export interface CredentialRecord {
  readonly id: string;
  readonly public_key: ArrayBuffer;
  readonly counter: number;
  readonly transports: string | null;
  readonly label: string;
  readonly created_at: number;
  readonly last_used_at: number | null;
}

export interface SessionRecord {
  readonly token_hash: string;
  readonly created_at: number;
  readonly last_seen_at: number;
  readonly expires_at: number;
  readonly ip: string | null;
  readonly user_agent: string | null;
}

export interface ShareRecord {
  readonly id: string;
  readonly token_hash: string;
  readonly file_id: string;
  readonly expires_at: number;
  readonly max_downloads: number | null;
  readonly download_count: number;
  readonly revoked_at: number | null;
  readonly created_at: number;
}

export interface LinkRecord {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly icon: string | null;
  readonly position: number;
  readonly created_at: number;
}

export interface NoteRecord {
  readonly id: string;
  readonly title: string;
  readonly body_md: string;
  readonly created_at: number;
  readonly updated_at: number;
}
