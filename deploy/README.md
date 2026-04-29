# CodeSync — $6 DigitalOcean deployment

One Droplet. One domain. Everything runs here: PocketBase (auth + DB),
FastAPI (AI routes + Y.js WebSocket), Caddy (TLS + static frontend).

## 1. Prerequisites

- A DigitalOcean account.
- A registered domain name (any registrar). You'll point it at the droplet.
- An OpenRouter API key for the AI features (or any compatible provider).

## 2. Create the droplet

1. DO Console → Create Droplet.
2. **Image:** Ubuntu 24.04 LTS.
3. **Plan:** Basic, Regular CPU, **$6/mo (1 GB / 1 vCPU / 25 GB SSD)**.
4. **Region:** pick the closest to you.
5. **Auth:** SSH key (recommended) or password.
6. Hostname: `codesync` (anything works).
7. Create.

Once provisioned, copy the public IPv4.

## 3. DNS

At your DNS provider for `amitesh.tech`, add an **A record**:

| Name       | Type | Value                | TTL |
|------------|------|----------------------|-----|
| `codesync` | A    | `<DROPLET_PUBLIC_IP>`| 300 |

Wait for propagation: `dig +short codesync.amitesh.tech` should return the
droplet's IP before continuing.

## 4. Log in and install Docker

```bash
ssh root@<DROPLET_IP>

apt-get update && apt-get upgrade -y
apt-get install -y ca-certificates curl git ufw
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
 https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
 > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Firewall
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable

# Swap: 1 GB RAM is tight. A 1 GB swapfile prevents OOM on short spikes.
fallocate -l 1G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 5. Clone the repo and build the frontend

```bash
cd /opt
git clone https://github.com/<you>/codesync.git
cd codesync

# Build the React bundle so Caddy can serve it from ./codesync/code-harmony-main/dist
apt-get install -y nodejs npm
cd codesync/code-harmony-main
npm install
npm run build
cd ../..
```

## 6. Configure environment

```bash
cd /opt/codesync/deploy
cp .env.example .env
vim .env   # fill in DOMAIN, FRONTEND_URL, OPENROUTER_API_KEY, PB_ADMIN_* 
```

Values:

- `DOMAIN` — `codesync.amitesh.tech` (no scheme; pre-filled in `.env.example`).
- `FRONTEND_URL` — `https://codesync.amitesh.tech`.
- `OPENROUTER_API_KEY` — your key from openrouter.ai.
- `EMBEDDINGS_API_KEY` — leave blank to disable semantic search, or paste a
  separate key. Defaults reuse `OPENROUTER_API_KEY` if this is empty.
- `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` — create whatever you like; you'll
  use these to log into PocketBase's admin UI at `/pb/_/`.

## 7. Boot the stack

```bash
cd /opt/codesync/deploy
docker compose up -d --build
docker compose logs -f
```

On first boot:

1. PocketBase runs its migration and creates the collections.
2. Open `https://codesync.amitesh.tech/pb/_/` in a browser and create the admin account
   using the `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` you set in `.env`.
3. Caddy fetches a Let's Encrypt certificate automatically (takes ~30s).
4. Open `https://codesync.amitesh.tech` — you'll see the CodeSync login page.
   Click "Sign up" to create a real user account.

## 8. Updating

```bash
cd /opt/codesync
git pull
cd codesync/code-harmony-main && npm install && npm run build && cd ../..
cd deploy
docker compose up -d --build
```

## 9. Backups

PocketBase data lives in the named volume `pb_data`. A simple daily backup:

```bash
cat > /etc/cron.daily/codesync-backup <<'EOF'
#!/bin/bash
set -e
OUT=/var/backups/codesync
mkdir -p "$OUT"
STAMP=$(date +%F)
docker run --rm -v deploy_pb_data:/src -v "$OUT":/out alpine \
  tar czf /out/pb-$STAMP.tgz -C /src .
find "$OUT" -type f -name 'pb-*.tgz' -mtime +7 -delete
EOF
chmod +x /etc/cron.daily/codesync-backup
```

Copy the tarballs off the droplet with `scp` whenever you want an off-site copy.

## 10. Troubleshooting

**OOM kills:** If `docker compose ps` shows a restart loop and `dmesg | grep -i kill`
has evidence of OOM, bump to the $12 plan (2 GB RAM). The compose file sets
`mem_limit: 320m` on FastAPI; you can relax this if you upgrade.

**Caddy won't get a cert:** make sure DNS has propagated (`dig codesync.amitesh.tech`) and
ports 80/443 are reachable from the public internet.

**Login fails with "Failed to authenticate":** verify PocketBase is healthy
via `https://codesync.amitesh.tech/pb/api/health`. If you see a 502, PocketBase didn't
start — check `docker compose logs pocketbase`.
