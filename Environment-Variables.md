(1.20.0) For non-Docker users, you can create a new file named `.env` in the root directory. The format is like this:

```.env
UPTIME_KUMA_HOST=127.0.0.1
UPTIME_KUMA_PORT=8080
```

Server Argument Usage:

```bash
node server/server.js --host=127.0.0.1 --port=8080
```

## Server Environment Variables

| Environment Variable                                     | Server Argument               | Description                                                                                                                                                                                                                                                                                                                                                                |     Default |
| -------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------: |
| `DATA_DIR`                                               | `--data-dir=`                 | Set the directory where the data should be stored (could be relative)                                                                                                                                                                                                                                                                                                      |   `./data/` |
| `UPTIME_KUMA_HOST` or `HOST`                             | `--host=`                     | Host to bind to, could be an ip.                                                                                                                                                                                                                                                                                                                                           |        `::` |
| `UPTIME_KUMA_PORT` or `PORT`                             | `--port=`                     | Port to listen to                                                                                                                                                                                                                                                                                                                                                          |      `3001` |
| `UPTIME_KUMA_SSL_KEY` or `SSL_KEY`                       | `--ssl-key=`                  | Path to SSL key                                                                                                                                                                                                                                                                                                                                                            |             |
| `UPTIME_KUMA_SSL_CERT` or `SSL_CERT`                     | `--ssl-cert=`                 | Path to SSL certificate                                                                                                                                                                                                                                                                                                                                                    |             |
| `UPTIME_KUMA_SSL_KEY_PASSPHRASE` or `SSL_KEY_PASSPHRASE` | `--ssl-key-passphrase=`       | (1.21.1) SSL Key Passphrase                                                                                                                                                                                                                                                                                                                                                |             |
| `UPTIME_KUMA_CLOUDFLARED_TOKEN`                          | `--cloudflared-token=`        | (1.14.0) Cloudflare Tunnel Token                                                                                                                                                                                                                                                                                                                                           |             |
| `UPTIME_KUMA_DISABLE_FRAME_SAMEORIGIN`                   | `--disable-frame-sameorigin=` | By default, Uptime Kuma is not allowed in iframe if the domain name is not the same as the parent. It protects your Uptime Kuma to be a phishing website. If you don't need this protection, you can set it to `true`                                                                                                                                                      |     `false` |
| `UPTIME_KUMA_WS_ORIGIN_CHECK`                            |                               | By default, Uptime Kuma is verifying that the websockets [`ORIGIN`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Origin)-Header matches your servers hostname. If you don't need this protection, you can set it to `bypass`. See [GHSA-mj22-23ff-2hrr](https://github.com/louislam/uptime-kuma/security/advisories/GHSA-mj22-23ff-2hrr) for further context. | `cors-like` |
| `UPTIME_KUMA_ALLOW_ALL_CHROME_EXEC`                      | `--allow-all-chrome-exec=`    | (1.23.0) Allow to specify any executables as Chromium                                                                                                                                                                                                                                                                                                                      |         `0` |
| `NODE_EXTRA_CA_CERTS`                                    |                               | Add your self-signed ca certs. (e.g. /cert/path/CAcert.pem) [Read more](https://github.com/louislam/uptime-kuma/issues/1380)                                                                                                                                                                                                                                               |             |
| `NODE_TLS_REJECT_UNAUTHORIZED`                           |                               | Ignore all TLS errors                                                                                                                                                                                                                                                                                                                                                      |         `0` |
| `NODE_OPTIONS`                                           |                               | Set it to `--insecure-http-parser`, if you encountered error `Invalid header value char` when your website using WAF                                                                                                                                                                                                                                                       |             |
| `NOTIFICATION_PROXY`                                     |                               | (2.0.0) Specify a network proxy to be used for sending out notifications. The proxy must be given as a full URL, for example: `http://proxy.example.com:8080`. The following protocols are supported: `http:`, `https:`, `socks:`, `socks4:`, `socks5:` and `socks5h:`.                                                                                                    |             |


## MariaDB Environment Variables

| Environment Variable                  | Description                                                            |
|---------------------------------------|------------------------------------------------------------------------|
| `UPTIME_KUMA_DB_TYPE`                 | (2.0.0) Database Type `sqlite`, `mariadb`                              |
| `UPTIME_KUMA_DB_HOSTNAME`             | (2.0.0) Database hostname. for mariadb                                 |
| `UPTIME_KUMA_DB_PORT`                 | (2.0.0) Database port. for mariadb, `3306`                             |
| `UPTIME_KUMA_DB_SOCKET`               | (2.1.0) Database Unix socket. If used, `hostname` and `port` are ignored |
| `UPTIME_KUMA_DB_POOL_MAX_CONNECTIONS` | (2.1.0) Maximum number of concurrent pool connections, `10` by default |
| `UPTIME_KUMA_DB_NAME`                 | (2.0.0) Database name                                                  |
| `UPTIME_KUMA_DB_USERNAME`             | (2.0.0) Database username                                              |
| `UPTIME_KUMA_DB_PASSWORD`             | (2.0.0) Database password                                              |
| `UPTIME_KUMA_DB_SSL`                  | (2.1.0) Optional. Enable SSL for database connection (`true`/`false`, default: `false`) |
| `UPTIME_KUMA_DB_CA`                   | (2.1.0) Optional. CA certificate content in PEM format for SSL connection |

The following Variables are also avaliable in the `*_FILE` variant, which can be usefull for using docker secrets.
Other than that they are loaded from this path, they are identical.
- `UPTIME_KUMA_DB_PASSWORD_FILE`
- `UPTIME_KUMA_DB_USERNAME_FILE`
- `UPTIME_KUMA_DB_CA_FILE`



## For Development only

| Environment variable                       | Server argument | Description                                                                     |    Default |
| ------------------------------------------ | --------------- | ------------------------------------------------------------------------------- | ---------: |
| `NODE_ENV`                                 |                 | Set the NodeJS environment flag. `development`, `production`                    | production |
| `UPTIME_KUMA_LOG_RESPONSE_BODY_MONITOR_ID` |                 | Monitor ID - If provided, it will output the monitor's response to your console |            |
| `UPTIME_KUMA_HIDE_LOG`                     |                 | (1.15.0) Examples: `debug_monitor,info_monitor,debug_cert,warn_monitor`         |            |
| `SQL_LOG`                                  |                 | Set `1` to enable                                                               |            |
| `UPTIME_KUMA_ENABLE_EMBEDDED_MARIADB`      |                 | (2.0.0) Set `1` to enable                                                       |            |
| `UPTIME_KUMA_IN_CONTAINER`                 |                 | (1.23.0) Is Uptime Kuma inside a container?                                     |            |
