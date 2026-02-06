# 🚀 Deployment Guide - CodeSync AI ko Live Karne Ka Poora Process

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Option 1: Simple Deployment (Render/Railway)](#option-1-simple-deployment)
3. [Option 2: Production Deployment (AWS/DigitalOcean)](#option-2-production-deployment)
4. [Environment Setup](#environment-setup)
5. [Database Migration](#database-migration)
6. [Domain & SSL Setup](#domain--ssl-setup)

---

## Prerequisites (Sabse Pehle Ye Cheezein Tayyar Karo)

### ✅ 1. Code Ready Karo
```bash
# Git repository banao
cd /Volumes/Amitesh/System\ Design/CodeSync_AI
git init
git add .
git commit -m "Initial commit - CodeSync AI"

# GitHub par upload karo
# GitHub.com par naya repository banao
git remote add origin https://github.com/YOUR_USERNAME/codesync-ai.git
git push -u origin main
```

### ✅ 2. Environment Variables Prepare Karo
Ye sab variables chahiye honge:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Redis
REDIS_URL=redis://host:6379

# OpenRouter AI
OPENROUTER_API_KEY=your_api_key_here

# CORS (Frontend URL)
FRONTEND_URL=https://your-frontend.com
```

### ✅ 3. Dependencies Check Karo
```bash
# Backend
cd fastapi_backend
pip freeze > requirements.txt

# Frontend
cd codesync/code-harmony-main
npm run build  # Production build test karo
```

---

## Option 1: Simple Deployment (Beginners Ke Liye - FREE!)

### 🎯 Platform: Render.com (FREE Tier Available)

#### Step 1: Database Setup (PostgreSQL)

**A. Render Par PostgreSQL Database:**
1. Render.com par account banao
2. "New" → "PostgreSQL" select karo
3. Database details:
   - Name: `codesync_db`
   - Region: Choose nearest
   - Plan: **Free** (shuru mein)
4. Create karo
5. **External Database URL** copy karo - ye lagega

#### Step 2: Redis Setup

**A. Redis Cloud (FREE 30MB):**
1. Redis.com par account banao
2. Free database create karo
3. Connection string copy karo: `redis://:password@host:port`

#### Step 3: Backend Deployment (FastAPI)

**A. Render.com Par Deploy:**
1. Render Dashboard → "New" → "Web Service"
2. GitHub repository connect karo
3. Settings:
   ```
   Name: codesync-backend
   Environment: Python 3
   Build Command: cd fastapi_backend && pip install -r requirements.txt
   Start Command: cd fastapi_backend && uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
4. Environment Variables add karo:
   ```
   DATABASE_URL=postgresql://... (from Step 1)
   REDIS_URL=redis://... (from Step 2)
   OPENROUTER_API_KEY=your_key
   FRONTEND_URL=https://your-frontend.onrender.com
   ```
5. Deploy karo!

**Backend URL milega:** `https://codesync-backend.onrender.com`

#### Step 4: Y.js Server Deployment

**Option A: Separate Service (Recommended):**
1. Render → "New" → "Web Service"
2. Settings:
   ```
   Name: codesync-yjs
   Environment: Python 3
   Build Command: pip install y-py ypy-websocket redis
   Start Command: python codesync/yjs_server.py
   ```
3. Environment Variables:
   ```
   PORT=8001
   REDIS_URL=redis://...
   ```

**Y.js URL:** `wss://codesync-yjs.onrender.com`

#### Step 5: Frontend Deployment (React)

**A. Frontend Build Prepare Karo:**
```bash
cd codesync/code-harmony-main

# API URLs update karo
# Edit src/lib/api.ts:
const API_BASE_URL = 'https://codesync-backend.onrender.com/api';

# Edit src/lib/yjs-provider.ts (agar separate file hai):
const YJS_WEBSOCKET_URL = 'wss://codesync-yjs.onrender.com';
```

**B. Render Par Deploy:**
1. Render → "New" → "Static Site"
2. Settings:
   ```
   Name: codesync-frontend
   Build Command: cd codesync/code-harmony-main && npm install && npm run build
   Publish Directory: codesync/code-harmony-main/dist
   ```
3. Environment Variables:
   ```
   VITE_API_URL=https://codesync-backend.onrender.com/api
   VITE_YJS_URL=wss://codesync-yjs.onrender.com
   ```

**Frontend URL:** `https://codesync-frontend.onrender.com`

---

## Option 2: Production Deployment (AWS/DigitalOcean)

### 🎯 Platform: DigitalOcean (Recommended for Production)

#### Step 1: Droplet Create Karo (Server)

```bash
# DigitalOcean par Ubuntu 22.04 droplet banao
# Size: $12/month (2GB RAM, 1 vCPU) - shuru ke liye kaafi hai
```

#### Step 2: Server Setup

```bash
# SSH se connect karo
ssh root@your_server_ip

# System update karo
apt update && apt upgrade -y

# Python 3.11 install karo
apt install python3.11 python3.11-venv python3-pip -y

# Node.js install karo (Frontend ke liye)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install nodejs -y

# PostgreSQL install karo
apt install postgresql postgresql-contrib -y

# Redis install karo
apt install redis-server -y

# Nginx install karo (Reverse Proxy)
apt install nginx -y

# SSL ke liye Certbot
apt install certbot python3-certbot-nginx -y
```

#### Step 3: Database Setup

```bash
# PostgreSQL configure karo
sudo -u postgres psql

CREATE DATABASE codesync_db;
CREATE USER codesync WITH PASSWORD 'strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE codesync_db TO codesync;
\q

# Redis configure karo
systemctl enable redis-server
systemctl start redis-server
```

#### Step 4: Code Deploy Karo

```bash
# Code directory banao
mkdir -p /var/www/codesync
cd /var/www/codesync

# Git se code clone karo
git clone https://github.com/YOUR_USERNAME/codesync-ai.git .

# Backend setup
cd fastapi_backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Environment variables file banao
nano .env
# Paste karo:
DATABASE_URL=postgresql://codesync:password@localhost:5432/codesync_db
REDIS_URL=redis://localhost:6379
OPENROUTER_API_KEY=your_key
FRONTEND_URL=https://yourdomain.com
# Save karo (Ctrl+X, Y, Enter)
```

#### Step 5: Systemd Services (Background Running)

**A. FastAPI Backend Service:**
```bash
nano /etc/systemd/system/codesync-backend.service
```

Paste karo:
```ini
[Unit]
Description=CodeSync FastAPI Backend
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/codesync/fastapi_backend
Environment="PATH=/var/www/codesync/fastapi_backend/venv/bin"
ExecStart=/var/www/codesync/fastapi_backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

**B. Y.js Server Service:**
```bash
nano /etc/systemd/system/codesync-yjs.service
```

Paste karo:
```ini
[Unit]
Description=CodeSync Y.js WebSocket Server
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/codesync
Environment="PATH=/var/www/codesync/fastapi_backend/venv/bin"
ExecStart=/var/www/codesync/fastapi_backend/venv/bin/python codesync/yjs_server.py
Restart=always

[Install]
WantedBy=multi-user.target
```

**Services Start Karo:**
```bash
systemctl daemon-reload
systemctl enable codesync-backend
systemctl enable codesync-yjs
systemctl start codesync-backend
systemctl start codesync-yjs

# Check status
systemctl status codesync-backend
systemctl status codesync-yjs
```

#### Step 6: Frontend Build & Deploy

```bash
cd /var/www/codesync/codesync/code-harmony-main

# API URLs update karo
nano src/lib/api.ts
# Change: const API_BASE_URL = 'https://yourdomain.com/api';

# Build karo
npm install
npm run build

# Build files copy karo
cp -r dist /var/www/html/codesync
```

#### Step 7: Nginx Configuration (Reverse Proxy)

```bash
nano /etc/nginx/sites-available/codesync
```

Paste karo:
```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    root /var/www/html/codesync;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Y.js WebSocket
    location /ws {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

Enable karo:
```bash
ln -s /etc/nginx/sites-available/codesync /etc/nginx/sites-enabled/
nginx -t  # Test configuration
systemctl reload nginx
```

#### Step 8: SSL Certificate (HTTPS)

```bash
# Certbot se SSL setup karo (FREE!)
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Email enter karo
# Terms agree karo
# Auto-renew enable ho jayega
```

---

## Environment Setup (Required Environment Variables)

### Backend (.env file)
```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/codesync_db

# Redis
REDIS_URL=redis://localhost:6379

# OpenRouter AI
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx

# CORS Settings
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=["https://yourdomain.com", "https://www.yourdomain.com"]

# Server
PORT=8000
HOST=0.0.0.0
```

### Frontend (Environment Variables)
```env
VITE_API_URL=https://yourdomain.com/api
VITE_YJS_URL=wss://yourdomain.com/ws
```

---

## Database Migration

```bash
# Server par run karo
cd /var/www/codesync/fastapi_backend
source venv/bin/activate

# Database tables create karo (automatically main.py startup par hoga)
# Manual check:
python -c "from app.database import engine, Base; Base.metadata.create_all(bind=engine); print('Tables created!')"
```

---

## Domain & SSL Setup

### Domain Purchase (Optional but Recommended)
1. **Namecheap** ya **GoDaddy** se domain kharido (~$10/year)
2. Domain DNS settings mein:
   ```
   Type: A Record
   Name: @
   Value: your_server_ip
   
   Type: A Record
   Name: www
   Value: your_server_ip
   ```
3. DNS propagation wait karo (1-24 hours)

### Free Domain Alternative
- **FreeDNS.afraid.org** - FREE subdomain
- **No-IP.com** - FREE dynamic DNS

---

## 🎯 Quick Start Commands (After Setup)

### Check Services:
```bash
# Backend
systemctl status codesync-backend

# Y.js Server
systemctl status codesync-yjs

# Nginx
systemctl status nginx

# PostgreSQL
systemctl status postgresql

# Redis
systemctl status redis-server
```

### View Logs:
```bash
# Backend logs
journalctl -u codesync-backend -f

# Y.js logs
journalctl -u codesync-yjs -f

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Restart Services:
```bash
systemctl restart codesync-backend
systemctl restart codesync-yjs
systemctl reload nginx
```

---

## 💰 Cost Estimation

### Option 1: Render.com (FREE Start)
- **PostgreSQL**: Free (1GB)
- **Redis**: Free at Redis Cloud (30MB)
- **Backend**: Free (750 hours/month)
- **Y.js**: Free (750 hours/month)
- **Frontend**: Free (100GB bandwidth)
- **Total**: **FREE** (with limitations)

### Option 2: DigitalOcean (Production)
- **Droplet**: $12/month (2GB RAM)
- **Database**: Included in droplet
- **Domain**: $10/year
- **SSL**: FREE (Let's Encrypt)
- **Total**: **~$12-15/month**

---

## 🔒 Security Checklist

- [ ] Environment variables secure rakho (.env file)
- [ ] Database password strong rakho
- [ ] CORS properly configure karo
- [ ] SSL certificate install karo (HTTPS)
- [ ] Firewall enable karo (UFW)
- [ ] Regular backups setup karo
- [ ] Rate limiting add karo
- [ ] API authentication implement karo (if needed)

---

## 🚨 Common Issues & Solutions

### Issue 1: WebSocket Connection Failed
```bash
# Nginx config check karo
nginx -t

# Proxy timeout badao
# /etc/nginx/sites-available/codesync mein add karo:
proxy_read_timeout 3600;
proxy_send_timeout 3600;
```

### Issue 2: Database Connection Error
```bash
# PostgreSQL running hai ya nahi?
systemctl status postgresql

# Database exists?
sudo -u postgres psql -c "\l"

# User privileges check karo
sudo -u postgres psql -c "\du"
```

### Issue 3: Redis Not Connecting
```bash
# Redis running?
systemctl status redis-server

# Redis test
redis-cli ping  # Should return "PONG"
```

---

## 📞 Need Help?

Agar koi problem aaye:
1. Logs check karo (journalctl)
2. Service status check karo (systemctl status)
3. Configuration files verify karo
4. Firewall rules check karo (ufw status)

---

## ✅ Final Checklist Before Going Live

- [ ] Git repository ready
- [ ] Environment variables configured
- [ ] Database migrated
- [ ] Services running
- [ ] Nginx configured
- [ ] SSL enabled (HTTPS)
- [ ] Domain pointing to server
- [ ] Frontend build deployed
- [ ] Backend API working
- [ ] WebSocket connecting
- [ ] Multi-user testing done
- [ ] Backups configured

---

**Ab aapka CodeSync AI project live hai! 🎉**

Choose Option 1 (Render) for quick start with FREE hosting,
or Option 2 (DigitalOcean) for full control and production-ready setup.
