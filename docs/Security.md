# Security Features

Fireshare includes two optional security systems on top of the standard username/password login:

- [Login IP Whitelist](#login-ip-whitelist) — restrict which IP addresses are allowed to log in.
- [Two-Factor Authentication (MFA)](#two-factor-authentication-mfa) — require a one-time code from an
  authenticator app after entering your password.

They are independent and can be used together.

---

## Login IP Whitelist

When enabled, only requests coming from whitelisted IP addresses may use the login endpoints. Everyone
else:

- receives a `403 — Your IP address is not permitted to log in.` from the login API, and
- is silently redirected away from the `/login` page (the page behaves as if it doesn't exist, and the
  sidebar Login button is hidden).

Public videos, shared links, and everything else that doesn't require logging in continue to work
normally for all visitors — the whitelist only gates authentication.

### Setup

Set the `LOGIN_IP_WHITELIST` environment variable to a comma-separated list of IP addresses and/or CIDR
ranges. Both IPv4 and IPv6 are supported. When the variable is unset or empty, the whitelist is
disabled and login works from anywhere.

```yaml
# docker-compose.yml
environment:
  # Allow a single home IP, an internal LAN range, and an IPv6 prefix
  - LOGIN_IP_WHITELIST=203.0.113.5,10.0.0.0/8,2001:db8::/32
```

```sh
# docker run
docker run -e LOGIN_IP_WHITELIST="203.0.113.5,10.0.0.0/8" ... shaneisrael/fireshare
```

Notes:

- Bare IPs (`203.0.113.5`) and CIDR ranges (`10.0.0.0/8`) can be mixed freely.
- **The container fails to start if any entry is malformed.** This is deliberate (fail-closed): a
  silently-ignored typo could either allow all IPs or lock you out without warning. Check the container
  logs for a `FATAL: LOGIN_IP_WHITELIST contains invalid entry` message.
- When active, startup logs a line like
  `Login IP whitelist active with 3 entries (1 trusted proxy hops)`.

### How the client IP is determined

Inside the container, requests pass through the bundled nginx before reaching the application, so the
real client address is carried in the `X-Forwarded-For` header. Fireshare determines the client IP by
counting **trusted proxy hops** from the right-hand end of that header — entries added by proxies you
control are trusted, and anything a client sends itself is ignored. This means the whitelist cannot be
bypassed by spoofing `X-Forwarded-For`.

The number of trusted hops is set with `LOGIN_IP_WHITELIST_TRUSTED_PROXIES`. The default of `1`
accounts for the bundled nginx and is correct when clients connect to the Fireshare container directly.

### Running behind an additional reverse proxy

If Fireshare sits behind another reverse proxy (Traefik, Nginx Proxy Manager, Caddy, Cloudflare
Tunnel, ...), that proxy is one more hop:

```
client ──> your reverse proxy ──> bundled nginx ──> Fireshare app
                (hop 2)               (hop 1)
```

Set:

```yaml
- LOGIN_IP_WHITELIST_TRUSTED_PROXIES=2
```

Each additional chained proxy adds one. Requirements for this to work:

- Every trusted proxy must **append** the client address to `X-Forwarded-For` (this is the default
  behavior for nginx's `$proxy_add_x_forwarded_for`, Traefik, NPM, and Cloudflare).
- Don't set the value higher than the number of proxies you actually control — extra hops would trust
  client-supplied header entries and make the whitelist spoofable.

If the whitelist blocks you unexpectedly, check the application logs: every blocked attempt logs
`Blocked login attempt from non-whitelisted IP <ip>`, which shows you exactly which address Fireshare
derived for you — whitelist that (or fix the hop count) as appropriate.

### Locked out?

The whitelist lives entirely in the environment variable. Remove or edit `LOGIN_IP_WHITELIST` in your
compose file / run command and restart the container.

---

## Two-Factor Authentication (MFA)

Fireshare supports TOTP-based two-factor authentication using any standard authenticator app (Google
Authenticator, Authy, Bitwarden, 1Password, Aegis, ...). Once enabled, logging in requires your
password **and** a current 6-digit code.

No environment variables are required — each account's secret is randomly generated at setup time, so
no two accounts or Fireshare instances ever share a secret.

### Enabling MFA

1. Log in and open **Settings → Security**.
2. Click **Enable Two-Factor Authentication**.
3. Scan the QR code with your authenticator app (or enter the displayed key manually).
4. Enter the 6-digit code your app shows and click **Confirm**.

MFA is active immediately: the next login will ask for a code after your password is accepted.

### Logging in with MFA

1. Enter your username and password as usual.
2. The form switches to a code prompt — enter the current 6-digit code from your authenticator app.

The code step allows 5 attempts within 5 minutes, after which you are returned to the password step.
Each code is accepted at most once (replay protection).

### Disabling MFA

Open **Settings → Security** and click **Disable Two-Factor Authentication**. You must enter a current
code from your authenticator app to confirm — a session cookie alone is not enough to strip MFA from
an account.

### Lost your authenticator? (recovery)

MFA can be disabled for any account from the command line inside the container:

```sh
docker exec fireshare fireshare disable-mfa -u admin
```

(replace `fireshare` with your container name and `admin` with the account's username). The account
then logs in with just its password and MFA can be set up again from Settings.

### Notes and limitations

- **Local accounts only.** LDAP accounts authenticate against your directory server and cannot enable
  Fireshare MFA (use your directory's own MFA). The demo account is also excluded.
- **Set a persistent `SECRET_KEY`.** Sessions (including the short-lived state between the password
  and code steps) are signed with it; without one, every container restart invalidates all sessions.
  See [EnvironmentVariables.md](./EnvironmentVariables.md).
- Codes are validated with a ±30 second tolerance window — make sure the clocks on the server and your
  phone are reasonably accurate.
