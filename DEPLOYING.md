# Deploying PostureGuard on a VPS

PostureGuard is a pure client-side app — there is no backend server. Deployment means building the static files once and serving them over **HTTPS** (required by browsers for camera access).

## Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| CPU | 1 vCPU | 1–2 vCPU |
| RAM | 512 MB | 1 GB |
| Disk | 2 GB | 5 GB |
| Network | Any | Static IP + domain name |

A domain name is required for a free Let's Encrypt TLS certificate. Without HTTPS, browsers block camera access entirely.

---

## 1 — Initial server setup

```bash
# As root or a sudo user
apt update && apt upgrade -y
apt install -y git curl nginx ufw certbot python3-certbot-nginx
```

Create a non-root deploy user (optional but recommended):

```bash
adduser deploy
usermod -aG sudo deploy
su - deploy
```

---

## 2 — Install Node.js 18+

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # should print v22.x.x or newer
```

---

## 3 — Clone and build

```bash
cd /var/www
sudo mkdir postureguard
sudo chown deploy:deploy postureguard
git clone https://github.com/2025ultimate/Posture.git postureguard
cd postureguard

npm install
npm run bundle-assets   # copies MediaPipe WASM + downloads the pose model (~5.5 MB)
npm run build           # Vite outputs to dist/
```

The `dist/` folder now contains the complete self-contained app including the WASM runtime and pose-landmarker model — no CDN needed at runtime.

To update the app later:

```bash
cd /var/www/postureguard
git pull origin main
npm install
npm run bundle-assets
npm run build
```

---

## 4 — Nginx configuration

Create `/etc/nginx/sites-available/postureguard`:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    root /var/www/postureguard/dist;
    index index.html;

    # SPA fallback — every unknown path serves index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache WASM and model files aggressively (they are content-addressed)
    location ~* \.(task|wasm)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Cache JS/CSS with hash filenames
    location ~* \.(js|css|png|svg|ico|woff2?)$ {
        expires 6M;
        add_header Cache-Control "public, immutable";
    }

    # Security headers — required for SharedArrayBuffer (MediaPipe WASM threads)
    add_header Cross-Origin-Opener-Policy  "same-origin" always;
    add_header Cross-Origin-Embedder-Policy "require-corp" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/postureguard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5 — HTTPS with Let's Encrypt

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Certbot edits the Nginx config automatically and installs a cron/systemd timer to renew the certificate before it expires. Verify auto-renewal works:

```bash
sudo certbot renew --dry-run
```

After this step the site is live at `https://your-domain.com`.

---

## 6 — Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # ports 80 and 443
sudo ufw enable
sudo ufw status
```

---

## 7 — DNS

At your domain registrar or DNS provider, add:

| Type | Name | Value |
|------|------|-------|
| A | @ | `<your-server-ip>` |
| A | www | `<your-server-ip>` |

DNS propagation can take a few minutes to a few hours. Once it resolves, HTTPS and camera access will work.

---

## 8 — Verify camera access

Open `https://your-domain.com` in Chrome or Firefox. The browser should prompt for camera permission. If the prompt never appears:

- Confirm you are on `https://` (not `http://`).
- Check that the COOP/COEP headers are present: open DevTools → Network → click the HTML document → Response Headers.
- On Firefox, `Cross-Origin-Embedder-Policy: require-corp` can block some third-party resources. PostureGuard loads everything locally so this should be fine.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Camera permission never asked | Site served over HTTP | Ensure HTTPS cert is installed and Nginx redirects port 80 → 443 |
| 404 on page refresh | Missing SPA fallback | Confirm `try_files $uri $uri/ /index.html` in Nginx config |
| WASM fails to load | Missing `bundle-assets` step | Re-run `npm run bundle-assets && npm run build` |
| SharedArrayBuffer error in console | Missing COOP/COEP headers | Add the two `add_header` lines shown in the Nginx config above |
| `npm run bundle-assets` stalls | Proxy or firewall blocks outbound HTTPS | Set `export HTTPS_PROXY=...` before running, or pre-download the model manually |
| Certbot fails | Port 80 not reachable | Open port 80 in ufw and your cloud provider's security group |

---

## Keeping it up

Nginx is managed by systemd and starts automatically on reboot — no extra process manager is needed since there is no Node.js server process.

```bash
sudo systemctl enable nginx   # already enabled by default on Ubuntu
sudo systemctl status nginx
```

To set up automated builds on every `git push`, see GitHub Actions or a simple cron-based `git pull && npm run build && nginx -s reload` script run as the deploy user.
