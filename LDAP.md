# LDAP

Fireshare has LDAP support. The following environment variables are required to configure it:

| Environment Variable | Description | Example | Default |
|----------------------|-------------|---------|----------|
| `LDAP_ENABLE` | Whether to enable LDAP support. || false | 
| `LDAP_URL` | LDAP Server connection URL |`ldap://localhost:3890`| |
| `LDAP_BINDDN` | DN for the admin user |`uid=admin,ou=people` | |
| `LDAP_PASSWORD` | Password for the admin user. | |
| `LDAP_BASEDN` | Base DN |`dc=example,dc=com` | |
| `LDAP_USER_FILTER` | User filter for LDAP login. `{input}` is replaced by the UI username. | |
| `LDAP_ADMIN_GROUP` | LDAP group for admin privileges via `memberOf`. If empty, everyone is admin. | |