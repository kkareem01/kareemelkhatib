# crm.kareemelkhatib.com — Convenience Center

A private, single-user vault at **crm.kareemelkhatib.com**: file storage
that syncs across devices, quick-access links, a synced clipboard, notes,
and expiring share links with QR codes. Built on Cloudflare Workers + R2
(files) + D1 (metadata), secured with WebAuthn passkeys (Face ID / Touch
ID) plus a backup passphrase.

## Local development

```bash
cd crm
npm install
cp .dev.vars.example .dev.vars        # then edit SETUP_TOKEN
npm run db:migrate:local
npm run dev                            # http://localhost:8787
```

First run locally: open http://localhost:8787/setup, paste the
`SETUP_TOKEN` from `.dev.vars`, and register a passkey (Chrome DevTools →
WebAuthn tab has a virtual authenticator if you don't want to use Touch ID
during dev).

Tests + typecheck:

```bash
npm test          # 62 tests, runs inside workerd with real (local) D1 + R2
npm run typecheck
```

## Going live — one-time checklist

### 1. Move DNS to Cloudflare (~20 min + propagation)

1. Find your registrar: `whois kareemelkhatib.com | grep -i registrar`
2. **Export your current DNS records first** (screenshot every record at
   the current DNS host — especially MX/TXT if you use email on the
   domain). Cloudflare imports records automatically, but verify against
   your screenshot after import.
3. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) (free
   plan) and turn on 2FA.
4. "Add a domain" → `kareemelkhatib.com` → Free plan. Confirm the imported
   records match your export.
5. At your registrar, replace the nameservers with the two Cloudflare
   gives you. Propagation is minutes to 24h; the domain itself stays at
   your registrar.
6. Once the zone shows **Active**: SSL/TLS → set mode **Full (strict)**,
   and enable **Always Use HTTPS**.

### 2. Create the backend resources

```bash
cd crm
npx wrangler login
npx wrangler d1 create crm-db          # copy the database_id it prints
# → paste that id into wrangler.toml (database_id = "...")
npx wrangler r2 bucket create crm-vault
npm run db:migrate:remote
```

Keep the R2 bucket private — never enable public access or an r2.dev URL.
Every byte is served through the session-checked Worker.

### 3. Set the setup secret and deploy

```bash
openssl rand -base64 32                # copy the output
npx wrangler secret put SETUP_TOKEN    # paste it when prompted
```

In `wrangler.toml`, uncomment the `routes` line:

```toml
routes = [{ pattern = "crm.kareemelkhatib.com", custom_domain = true }]
```

Then:

```bash
npm run deploy
```

The custom domain auto-creates the DNS record and TLS certificate.

### 4. Claim the vault (first-time setup)

1. Visit **https://crm.kareemelkhatib.com/setup** on your main device.
2. Paste the setup token, name the device, approve the passkey prompt
   (Face ID / Touch ID).
3. Save the suggested backup passphrase somewhere safe (password manager).
4. Delete the setup secret — the gate is already closed after step 2, this
   is belt-and-suspenders:

   ```bash
   npx wrangler secret delete SETUP_TOKEN
   ```

5. On your phone: sign in with the backup passphrase once, then go to
   **Shares → + Add this device** to register the phone's passkey.

## Post-deploy verification

- `curl -I https://crm.kareemelkhatib.com/login` → check
  `content-security-policy`, `strict-transport-security`,
  `x-robots-tag: noindex` headers are present.
- Vault: upload from phone camera → appears on laptop.
- Clipboard: type on one device → appears on the other within ~3s.
- Share a file → open the link in a private window → revoke → link 404s.
- `https://crm.kareemelkhatib.com/s/anything` → generic 404 page.

## Architecture notes

- **Auth**: WebAuthn passkeys (rpID `crm.kareemelkhatib.com`), sessions
  are 256-bit tokens stored as SHA-256 hashes in D1, `__Host-` HttpOnly
  SameSite=Strict cookies, 7-day sliding / 30-day absolute expiry.
  Backup passphrase is PBKDF2-SHA256 with strict rate limits
  (5/15min/IP + 10/hour globally).
- **Files**: streamed straight to R2 (95MB cap — Workers request body
  limit), R2 keys are server UUIDs, user filenames are display-only.
  Inline preview only for a safe MIME allowlist; everything else (SVG,
  HTML, …) is forced to sandboxed download to block stored XSS.
- **Shares**: 256-bit tokens (hash stored), expiry presets 1h/24h/7d,
  optional max-download cap enforced with an atomic conditional UPDATE.
  Invalid/expired/revoked links return identical 404s.
- **Cron** (3am UTC daily): purges expired sessions/challenges/shares,
  audit rows older than 90 days, and soft-deleted files older than 30
  days (including their R2 objects).
- **Free-tier limits**: 100k Worker requests/day (static assets are free
  and unlimited), 10GB R2, 5GB D1. Clipboard polling pauses when the tab
  is hidden.

## Deferred to v2 (designed for, not built)

- Claude AI assistant: ask questions about uploaded docs, auto-tagging.
  API key would live as a Worker secret (`wrangler secret put
  ANTHROPIC_API_KEY`) — never in client code.
- ⌘K command palette across files/notes/links.
- WebSocket realtime clipboard (Durable Objects) instead of polling.
- Direct-to-R2 presigned uploads to lift the 95MB cap.
