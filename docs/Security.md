# Security Features

Two optional systems layer on top of the standard username/password login. They are independent and
can be used together.

- [Login IP Whitelist](#login-ip-whitelist) — restrict which IPs may log in.
- [Two-Factor Authentication (MFA)](#two-factor-authentication-mfa) — require a TOTP code after the password.

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
| `LOGIN_IP_WHITELIST_TRUSTED_PROXIES` | Trusted reverse-proxy hops in front of the app. See[below](#how-the-client-ip-is-determined).  | `1`       |

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

- **Local accounts only.** LDAP accounts authenticate against your directory server and can't enable
  Fireshare MFA — use your directory's own. The demo account is excluded too.
- **Set a persistent `SECRET_KEY`.** Sessions, including the short-lived state between the password and
  code steps, are signed with it; without one, every restart invalidates all sessions. See
  [EnvironmentVariables.md](./EnvironmentVariables.md).
- Codes validate with a ±30 second tolerance, so keep the server and phone clocks reasonably accurate.
