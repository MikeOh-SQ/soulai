# ADHDQQ.COM nginx deployment

Current server status checked from this workspace:

- App process is listening on `0.0.0.0:3333`
- Active listener: `node` on port `3333`
- nginx is not installed yet on this server

Prepared nginx config:

- [adhdqq.com.conf](/home/sqmini/soulai/deploy/nginx/adhdqq.com.conf)

## Install nginx

Run these commands on the server with a user that has sudo privileges:

```bash
sudo apt-get update
sudo apt-get install -y nginx
```

## Deploy config

```bash
sudo cp /home/sqmini/soulai/deploy/nginx/adhdqq.com.conf /etc/nginx/sites-available/adhdqq.com.conf
sudo ln -sf /etc/nginx/sites-available/adhdqq.com.conf /etc/nginx/sites-enabled/adhdqq.com.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## DNS

Point these records to `118.221.71.38`:

- `A @`
- `A www`

## HTTPS

After DNS resolves and port `80` is reachable:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d adhdqq.com -d www.adhdqq.com
```

## Notes

- The app currently listens on `3333`, so nginx proxies to `127.0.0.1:3333`
- After nginx is enabled, external users should access `https://adhdqq.com` instead of `:3333`
- It is better to close external access to port `3333` once nginx is in front
