# Security Features

Two optional systems layer on top of the standard username/password login. They are independent and
can be used together.

- [Login IP Whitelist](#login-ip-whitelist) — restrict which IPs may log in.
- [Two-Factor Authentication (MFA)](#two-factor-authentication-mfa) — require a TOTP code after the password.

Separate from those, [Cookies and cross-origin access](#cookies-and-cross-origin-access) covers the
browser-facing defaults and the two variables that change them. The defaults suit a normal deployment;
you only need that section if you serve the frontend from a different origin, or you terminate HTTPS
and want to say so.

---

## Login IP Whitelist

Only whitelisted IPs may use the login endpoints. Everyone else gets a `403` from the login API and is
redirected away from `/login` (the page behaves as if it doesn't exist, and the sidebar Login button is
hidden).

Public videos, shared links, and anything else that doesn't require logging in keep working for all
visitors — the whitelist gates authentication only.

### Setup

| Variable                               | Description                                                                                   | Default     |
| -------------------------------------- | --------------------------------------------------------------------------------------------- | ----------- |
| `LOGIN_IP_WHITELIST`                 | Comma-separated IPs and/or CIDR ranges, IPv4 and IPv6. Unset or empty disables the whitelist. | *(unset)* |
| `LOGIN_IP_WHITELIST_TRUSTED_PROXIES` | Trusted reverse-proxy hops in front of the app. See [below](#how-the-client-ip-is-determined).  | `1`       |

```yaml
# docker-compose.yml
environment:
  - LOGIN_IP_WHITELIST=203.0.113.5,10.0.0.0/8,2001:db8::/32
  - LOGIN_IP_WHITELIST_TRUSTED_PROXIES=1
```

Bare IPs and CIDR ranges mix freely. On startup, an active whitelist logs:

```
Login IP whitelist active with 3 entries (1 trusted proxy hops)
```

> **The container fails to start if any entry is malformed.** This is deliberate — a silently ignored
> typo could allow every IP or lock you out with no warning. Look for `FATAL: LOGIN_IP_WHITELIST contains invalid entry` in the logs.

### How the client IP is determined

Requests pass through the bundled nginx before reaching the app, so the real client address travels in
`X-Forwarded-For`. Fireshare counts **trusted proxy hops from the right-hand end** of that header.
Entries added by proxies you control are trusted; anything the client sent itself is ignored, so the
whitelist can't be bypassed by spoofing the header.

| Your setup                                                            | Value |
| --------------------------------------------------------------------- | ----- |
| Clients reach the Fireshare container directly                        | `1` |
| Clients → your reverse proxy (Traefik, NPM, Caddy, ...) → Fireshare | `2` |
| Clients → Cloudflare → your reverse proxy → Fireshare              | `3` |

Each chained proxy adds one:

```
client ──> your reverse proxy ──> bundled nginx ──> Fireshare app
                (hop 2)               (hop 1)
```

For this to hold, every trusted proxy must contribute exactly one entry to `X-Forwarded-For` — either
appending the peer address (nginx's `$proxy_add_x_forwarded_for`, Traefik, Cloudflare) or replacing the
header with it (Nginx Proxy Manager's default). Both yield the same chain.

> **Never set this higher than the number of proxies you actually control.** Extra hops start trusting
> client-supplied entries and make the whitelist spoofable. If the whitelist isn't matching, diagnose
> the address rather than incrementing this value.

### Don't whitelist your own public IP

Your home public IP is what your router presents *outbound*, so it's never the source Fireshare sees:

- **From inside your LAN** — hairpin NAT rewrites the source to the router's LAN address (e.g.
  `192.168.0.1`), so every local device appears as that single IP.
- **From outside** — you arrive on whatever network you're using (cellular, work), not your home IP.

Whitelist the LAN or VPN ranges you actually connect from. For roaming access, put Fireshare behind a
VPN and whitelist the tunnel subnet — e.g. `100.64.0.0/10` for Tailscale — instead of chasing public
addresses. Keep reaching Fireshare through your reverse proxy over the tunnel; connecting to the
container directly changes the hop count.

### Finding the IP Fireshare sees

Blocked login attempts log the derived address:

```
Blocked login attempt from non-whitelisted IP 203.0.113.9
```

The hidden login page is evaluated separately on `/api/loggedin` and logs nothing, so a vanished login
form produces no output on its own. To force the log line, POST to the login endpoint:

```sh
curl -X POST https://your-domain/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"x","password":"y"}'
```

### Locked out?

The whitelist lives entirely in the environment variable. Edit or remove `LOGIN_IP_WHITELIST` in your
compose file or run command, then restart the container.

---

## Two-Factor Authentication (MFA)

TOTP-based 2FA using any standard authenticator app (Google Authenticator, Authy, Bitwarden, 1Password,
Aegis, ...). Once enabled, login requires your password **and** a current 6-digit code.

No environment variables needed — each account's secret is generated randomly at setup, so no two
accounts or instances share one.

### Enabling

1. Log in and open **Settings → Security**.
2. Click **Enable Two-Factor Authentication**.
3. Scan the QR code with your app, or enter the displayed key manually.
4. Enter the 6-digit code and click **Confirm**.

MFA takes effect immediately — the next login prompts for a code once the password is accepted.

### Logging in

Enter your username and password as usual; the form then switches to a code prompt.

You get **5 attempts within 5 minutes**, after which you're returned to the password step. Each code
works at most once (replay protection).

### Disabling

**Settings → Security → Disable Two-Factor Authentication.** You must enter a current code to confirm —
a session cookie alone can't strip MFA from an account.

### Lost your authenticator?

Disable MFA for an account from inside the container:

```sh
docker exec fireshare fireshare disable-mfa -u admin
```

Replace `fireshare` with your container name and `admin` with the username. The account then logs in
with its password alone, and MFA can be set up again from Settings.

### Notes and limitations

- **The demo account is excluded.**
- **Sessions are signed with the instance's session key**, including the short-lived state between the
  password and code steps. Fireshare generates and persists one for you — see
  [The session signing key](#the-session-signing-key).
- Codes validate with a ±30 second tolerance, so keep the server and phone clocks reasonably accurate.

---

## Cookies and cross-origin access

Fireshare serves its own frontend, so the browser calls the API from the same origin it loaded the page
from. The defaults assume exactly that, and **a normal deployment needs nothing here.**

| Variable         | Description                                                                                                     | Default     |
| ---------------- | --------------------------------------------------------------------------------------------------------------- | ----------- |
| `CORS_ORIGINS`   | Comma-separated origins allowed to call the API from a *different* origin, with cookies. Unset means same-origin only. | *(unset)* |
| `SECURE_COOKIES` | Set to `true` to mark the login cookies `Secure`, so browsers only ever send them over HTTPS.                     | `false`     |

### Cross-origin requests (`CORS_ORIGINS`)

Unset, the API answers no cross-origin request. This is what you want when Fireshare serves its own
frontend: the page and the API share an origin, so nothing is cross-origin in the first place.

Set it only if the frontend is served from somewhere else — a separate dev server, or a frontend hosted
apart from the backend:

```yaml
# docker-compose.yml
environment:
  - CORS_ORIGINS=https://fireshare.example.com,http://192.168.1.50:3000
```

Each entry is a full origin — scheme, host, and port if it isn't the default — matched exactly:

| Entry                       | Matches                                             |
| --------------------------- | --------------------------------------------------- |
| `https://app.example.com`   | ✅ `https://app.example.com`                         |
|                             | ❌ `http://app.example.com` — different scheme       |
|                             | ❌ `https://app.example.com:8443` — different port   |
| `http://192.168.1.50:3000`  | ✅ only that host **and** port                       |

No trailing slash, and no paths — `https://app.example.com/` is not an origin and matches nothing. On
startup, an active list logs:

```
CORS enabled for: https://fireshare.example.com
```

> **`*` is rejected.** Allowing any origin while also allowing cookies means any site your users visit
> could call the API as them, which browsers refuse to do in the literal `*` form for that exact reason.
> A `*` entry is dropped with a warning in the logs; list the origins you actually need.

### Cookie flags (`SECURE_COOKIES`)

The login cookies are always `HttpOnly` (unreadable from JavaScript) and always `SameSite=Lax`, so
another site's scripts cannot cause a browser to attach them to a background request aimed at your
instance. (`Lax` still allows them on an ordinary top-level link click, which is what keeps shared
links working when you are already signed in.)

`Secure` is the one part left to you, because it depends on how you reach your instance. It defaults to
off: plenty of instances are reached over plain HTTP on a LAN, and a `Secure` cookie is simply never
sent over HTTP, so defaulting it on would leave those users unable to log in at all.

**Set it to `true` if you reach Fireshare over HTTPS** — directly, or through a reverse proxy that
terminates TLS:

```yaml
environment:
  - SECURE_COOKIES=true
```

> **Turn this on only once HTTPS actually works.** With `SECURE_COOKIES=true` on a plain-HTTP instance,
> the login request succeeds and the browser then discards the cookie, so you land back on the login
> page with no error. If that happens, set it back to `false` and restart.

### The session signing key

Login cookies are signed with a per-instance key. You do not need to set one: Fireshare generates a
random key on first start and saves it to `/data/.secret_key`, so it survives restarts and upgrades and
sessions stay valid across them.

Set `SECRET_KEY` yourself only if several Fireshare containers have to share sessions, in which case
give them all the same long random value:

```sh
python3 -c "import secrets; print(secrets.token_hex(32))"
```

> **Don't paste an example value from any documentation, including this repo's.** A signing key is only
> worth anything while it is secret to your instance — a value published anywhere is a value anyone can
> sign a cookie with. Older compose files and README examples shipped with a placeholder filled in; if
> yours still has one, delete the line and let Fireshare generate its own. Those published placeholders
> are refused on startup and replaced with a generated key, which signs out existing sessions once.

---

## User accounts and permissions

Account creation, per-user permissions, password setup links, and the guardrails that keep an instance from losing its last administrator are documented in [Users, Permissions, and Profiles](./Users.md).
