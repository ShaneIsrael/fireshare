# LDAP

Fireshare has LDAP support. The following environment variables are required to configure it:

### `LDAP_ENABLE`

Whether to enable LDAP support.  
Default: `false`

### `LDAP_URL`

LDAP Server connection URL.  
Example: `ldap://localhost:3890`

### `LDAP_BINDDN`

DN for the admin user.  
Example: `uid=admin,ou=people`

### `LDAP_PASSWORD`

Password for the admin user.

### `LDAP_BASEDN`

Base DN  
Example: `dc=example,dc=com`

### `LDAP_USER_FILTER`

User filter for LDAP login  
`{input}` replaced by username the user put in the webui  
Example for match email and uid: `(&(|(uid={input})(mail={input}))(objectClass=person))`

### `LDAP_ADMIN_GROUP`

LDAP group to be admin in fireshare. If not provided, everyone is admin.  
Uses `memberOf`  
Example: `lldap_admin`
