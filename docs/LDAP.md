# LDAP

Fireshare has LDAP support. The following environment variables configure it:

| Environment Variable | Description | Example | Default |
|----------------------|-------------|---------|----------|
| `LDAP_ENABLE` | Whether to enable LDAP support. Accepts `true`/`false`. |`true`| `false` |
| `LDAP_URL` | LDAP Server connection URL. Use `ldaps://` for LDAP over TLS. |`ldap://localhost:3890`| |
| `LDAP_BINDDN` | DN for the admin user |`uid=admin,ou=people` | |
| `LDAP_PASSWORD` | Password for the admin user. | | |
| `LDAP_BASEDN` | Base DN |`dc=example,dc=com` | |
| `LDAP_USER_FILTER` | User filter for LDAP login. `{input}` is replaced by the UI username. |`(uid={input})` | |
| `LDAP_ADMIN_GROUP` | LDAP group for admin privileges via `memberOf`. If empty, everyone is admin. | | |
| `LDAP_STARTLS` | Upgrade a plain `ldap://` connection to TLS with STARTTLS. Do not combine with an `ldaps://` URL. |`true`| `false` |
| `LDAP_TLS_CACERT` | CA certificate used to verify the LDAP server, for servers with a private or self-signed CA. |`/certs/my-ca.crt`| system CA bundle |
| `LDAP_TLS_REQCERT` | How strictly the server certificate is checked: `never`, `allow`, `try`, `demand`, `hard`. |`demand`| OpenLDAP default (`demand`) |

`LDAP_ENABLE` must be unset or set to a falsy value (`false`, `0`, `no`) to keep LDAP off.

## TLS (LDAPS and STARTTLS)

For `ldaps://` URLs and for `LDAP_STARTLS=true`, Fireshare verifies the server certificate
against the system CA bundle (`/etc/ssl/certs/ca-certificates.crt` in the official images), so
a certificate from a public CA such as Let's Encrypt works with no extra configuration.

If your LDAP server uses a private or self-signed CA, point `LDAP_TLS_CACERT` at the CA
certificate that signed it:

```yaml
environment:
  - LDAP_URL=ldaps://ldap.example.com:636
  - LDAP_TLS_CACERT=/certs/my-ca.crt
volumes:
  - ./my-ca.crt:/certs/my-ca.crt:ro
```

As a last resort, `LDAP_TLS_REQCERT=never` skips certificate verification entirely. This
leaves the connection open to interception, so prefer fixing the trust chain.

OpenLDAP's own `LDAPTLS_CACERT` and `LDAPTLS_REQCERT` environment variables still work and
take precedence over the Fireshare settings above.

### When TLS fails

OpenLDAP reports a failed TLS handshake with the same error it uses for an unreachable
server:

```
ldap.SERVER_DOWN: Can't contact LDAP server
```

So if the host and port are reachable, a `SERVER_DOWN` on an `ldaps://` URL is almost always
a certificate problem. Fireshare logs which CA bundle it is verifying against along with the
error. The two usual causes are:

1. **The certificate is signed by a CA that is not in the bundle** — set `LDAP_TLS_CACERT`.
2. **The certificate's name does not match the host in `LDAP_URL`** — use the hostname the
   certificate was issued for, not an IP address or an alias.

Check both from the host with:

```sh
openssl s_client -connect ldap.example.com:636
```

`Verify return code: 0 (ok)` means the chain and hostname are fine.

If Fireshare cannot reach the LDAP server at startup it logs the error and keeps running, so
local (non-LDAP) accounts can still sign in; each login attempt retries the connection.
