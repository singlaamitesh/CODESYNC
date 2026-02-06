# 🚀 Netlify Deployment Guide with Online Database

## 📌 Important: Netlify Limitations

**Netlify is ONLY for Frontend (Static Sites)**
- ✅ Can host: React, HTML, CSS, JavaScript
- ❌ Cannot host: FastAPI backend, Python servers, WebSocket servers
- ❌ Cannot host: PostgreSQL, Redis

## 🎯 Complete Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR PROJECT                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Frontend (React)     →  NETLIFY (FREE)                │
│  Backend (FastAPI)    →  RENDER/RAILWAY (FREE)         │
│  Y.js Server          →  RENDER/RAILWAY (FREE)         │
│  PostgreSQL Database  →  NEON/SUPABASE (FREE)          │
│  Redis                →  REDIS CLOUD (FREE)            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Step-by-Step Deployment Plan

### Step 1: Online Database Setup (PostgreSQL)

#### Option A: Neon.tech (RECOMMENDED - FREE Forever)

**Why Neon?**
- ✅ FREE 500MB PostgreSQL
- ✅ Never sleeps (unlike Render free tier)
- ✅ Auto-scaling
- ✅ Very fast setup

**Setup Steps:**

1. **Create Account:**
   - Go to https://neon.tech
   - Sign up with GitHub
   - Click "Create Project"

2. **Get Connection String:**
   ```
   After project creation, you'll see:
   
   postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```
   
   **Copy this entire URL!** ⬆️

3. **Create Tables:**
   - Neon has SQL Editor in dashboard
   - Or connect from your local machine:
   ```bash
   psql "postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require"
   ```
   
   Run this SQL:
   ```sql
   CREATE TABLE documents (
       id SERIAL PRIMARY KEY,
       title VARCHAR(255) NOT NULL,
       content TEXT,
       language VARCHAR(50) DEFAULT 'text',
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   CREATE TABLE embeddings (
       id SERIAL PRIMARY KEY,
       document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
       embedding FLOAT[],
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

#### Option B: Supabase (Alternative)

1. Go to https://supabase.com
2. Create new project
3. Get connection string from Settings → Database
4. Use SQL Editor to create tables

#### Option C: ElephantSQL (Simple)

1. Go to https://www.elephantsql.com
2. Create free "Tiny Turtle" plan (20MB)
3. Copy connection URL

---

### Step 2: Online Redis Setup

#### Redis Cloud (FREE 30MB)

1. **Create Account:**
   - Go to https://redis.com/try-free/
   - Sign up
   - Create "Free" subscription

2. **Create Database:**
   - Click "New Database"
   - Name: `codesync-redis`
   - Plan: **Free 30MB**
   - Region: Choose nearest

3. **Get Connection String:**
   ```
   redis://default:password@redis-xxxxx.redis.cloud:12345
   ```
   **Copy this!** ⬆️

---

### Step 3: Backend Deployment (FastAPI)

#### Option A: Render.com (FREE)

1. **Create Account:**
   - Go to https://render.com
   - Sign up with GitHub

2. **Deploy Backend:**
   - Dashboard → "New" → "Web Service"
   - Connect your GitHub repo
   - Settings:
     ```
     Name: codesync-backend
     Environment: Python 3
     Branch: main
     Root Directory: fastapi_backend
     Build Command: pip install -r requirements.txt
     Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
     ```

3. **Add Environment Variables:**
   Click "Environment" tab, add:
   ```
   DATABASE_URL=postgresql://username:password@ep-xxx.neon.tech/dbname
   REDIS_URL=redis://default:password@redis-xxxxx.redis.cloud:12345
   OPENROUTER_API_KEY=sk-or-v1-your-key-here
   FRONTEND_URL=https://your-site.netlify.app
   ```

4. **Deploy:**
   - Click "Create Web Service"
   - Wait 5-10 minutes
   - You'll get URL: `https://codesync-backend.onrender.com`

**⚠️ Important: Render Free Tier sleeps after 15 min inactivity**
- First request takes 30-60 seconds to wake up
- Upgrade to $7/month to keep always active

#### Option B: Railway.app (Better Free Tier)

1. Go to https://railway.app
2. Sign up with GitHub
3. "New Project" → "Deploy from GitHub"
4. Select your repo
5. Railway auto-detects Python and FastAPI
6. Add environment variables
7. Get URL: `https://codesync-backend.railway.app`

**Railway Free Tier: $5 credit/month** (usually enough!)

---

### Step 4: Y.js WebSocket Server Deployment

#### Deploy Y.js Separately on Render/Railway

1. **Render:** New Web Service
   - Name: `codesync-yjs`
   - Build: `pip install y-py ypy-websocket redis`
   - Start: `python codesync/yjs_server.py`
   - Environment:
     ```
     PORT=$PORT
     REDIS_URL=redis://...
     ```

2. **Get WebSocket URL:**
   ```
   wss://codesync-yjs.onrender.com
   ```

---

### Step 5: Frontend Deployment (Netlify)

#### Prepare Frontend for Deployment

1. **Update API URLs:**

   Edit `codesync/code-harmony-main/src/lib/api.ts`:
   ```typescript
   // Change this line:
   const API_BASE_URL = 'http://127.0.0.1:8000/api';
   
   // To this (use your Render backend URL):
   const API_BASE_URL = 'https://codesync-backend.onrender.com/api';
   ```

2. **Update Y.js WebSocket URL:**

   Edit `codesync/code-harmony-main/src/components/editor/CollaborativeEditor.tsx`:
   
   Find line ~188:
   ```typescript
   const wsUrl = 'ws://127.0.0.1:8001';
   ```
   
   Change to:
   ```typescript
   const wsUrl = 'wss://codesync-yjs.onrender.com';
   ```

3. **Build Locally to Test:**
   ```bash
   cd codesync/code-harmony-main
   npm install
   npm run build
   
   # Test the build locally
   npm run preview
   ```

#### Deploy to Netlify

**Method 1: Drag & Drop (Easiest)**

1. Go to https://netlify.com
2. Sign up
3. Dashboard → "Add new site" → "Deploy manually"
4. Drag the `dist` folder from:
   ```
   /Volumes/Amitesh/System Design/CodeSync_AI/codesync/code-harmony-main/dist
   ```
5. Done! You'll get URL: `https://random-name.netlify.app`

**Method 2: GitHub Auto-Deploy (Recommended)**

1. **Push Code to GitHub:**
   ```bash
   cd /Volumes/Amitesh/System\ Design/CodeSync_AI
   git add .
   git commit -m "Updated API URLs for production"
   git push origin main
   ```

2. **Connect to Netlify:**
   - Netlify Dashboard → "Add new site" → "Import from Git"
   - Choose GitHub
   - Select your repository
   - Build settings:
     ```
     Base directory: codesync/code-harmony-main
     Build command: npm run build
     Publish directory: codesync/code-harmony-main/dist
     ```

3. **Environment Variables (if needed):**
   - Site settings → Environment variables
   - Add:
     ```
     VITE_API_URL=https://codesync-backend.onrender.com/api
     VITE_YJS_URL=wss://codesync-yjs.onrender.com
     ```

4. **Deploy:**
   - Click "Deploy site"
   - Wait 2-3 minutes
   - Get URL: `https://your-site.netlify.app`

5. **Custom Domain (Optional):**
   - Site settings → Domain management
   - Add custom domain
   - Follow DNS setup instructions

---

## 🔧 Update Backend CORS

Your backend needs to allow requests from Netlify frontend:

Edit `fastapi_backend/main.py`:

```python
# Find the CORS middleware section
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8080",
        "https://your-site.netlify.app",  # ← Add your Netlify URL
        "https://your-custom-domain.com"  # If you have custom domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Then redeploy backend:
```bash
git add .
git commit -m "Updated CORS for Netlify"
git push
# Render will auto-redeploy
```

---

## 🗂️ Migration: Local Database → Online Database

### Export Your Current Data

1. **Export from Local PostgreSQL:**
   ```bash
   pg_dump -U amitesh -d codesync_db > backup.sql
   ```

2. **Import to Neon/Supabase:**
   ```bash
   # For Neon:
   psql "postgresql://username:password@ep-xxx.neon.tech/dbname" < backup.sql
   
   # Or use Neon SQL Editor and paste the SQL
   ```

### Alternative: Manual Data Copy

If you have few documents:

1. **Export data:**
   ```bash
   psql -U amitesh -d codesync_db -c "COPY documents TO '/tmp/documents.csv' CSV HEADER;"
   ```

2. **Import to online database:**
   - Open Neon SQL Editor
   - Upload CSV
   - Or manually insert records

---

## 📊 Complete Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  USER'S BROWSER                                             │
│       ↓                                                     │
│  https://your-site.netlify.app  (Frontend - Netlify)       │
│       ↓                           ↓                         │
│       ↓                           ↓                         │
│  FastAPI Backend            Y.js WebSocket                  │
│  (Render.com)               (Render.com)                    │
│       ↓                           ↓                         │
│       ↓                           ↓                         │
│  PostgreSQL                 Redis Cloud                     │
│  (Neon.tech)                (redis.com)                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 💰 Total Cost (All FREE for Beginners!)

| Service | Plan | Cost |
|---------|------|------|
| Frontend (Netlify) | Free | $0 |
| Backend (Render) | Free | $0 |
| Y.js Server (Render) | Free | $0 |
| PostgreSQL (Neon) | Free | $0 |
| Redis (Redis Cloud) | Free | $0 |
| **TOTAL** | | **$0/month** |

**Limitations:**
- Render free services sleep after 15 min
- First request slow (30-60 sec wake up)
- 750 hours/month limit per service

**Upgrade Path (Production):**
| Service | Upgraded Plan | Cost |
|---------|---------------|------|
| Render Backend | Starter | $7/month |
| Neon PostgreSQL | Pro | $19/month |
| Redis Cloud | 250MB | $5/month |
| **TOTAL** | | **$31/month** |

---

## 🔒 Security Checklist

- [ ] Keep `.env` files private (never commit to Git)
- [ ] Use environment variables on Netlify/Render
- [ ] Enable HTTPS (automatic on Netlify/Render)
- [ ] Set strong database password
- [ ] Configure CORS properly
- [ ] Keep OPENROUTER_API_KEY secret
- [ ] Regular backups of database

---

## 🚨 Common Issues & Solutions

### Issue 1: "Failed to fetch" Error
**Problem:** Frontend can't connect to backend

**Solution:**
```javascript
// Check API URL in src/lib/api.ts
const API_BASE_URL = 'https://codesync-backend.onrender.com/api'; // ✅ Correct
// NOT:
const API_BASE_URL = 'http://localhost:8000/api'; // ❌ Wrong for production
```

### Issue 2: CORS Error
**Problem:** "Access-Control-Allow-Origin" error

**Solution:** Update backend CORS settings:
```python
allow_origins=[
    "https://your-site.netlify.app",  # Add your Netlify URL
]
```

### Issue 3: WebSocket Connection Failed
**Problem:** Real-time collaboration not working

**Solutions:**
1. Check Y.js URL uses `wss://` (not `ws://`)
2. Ensure Y.js server is deployed separately
3. Check firewall/proxy settings

### Issue 4: Database Connection Error
**Problem:** "could not connect to server"

**Solution:**
1. Verify DATABASE_URL in Render environment variables
2. Check Neon database is active (doesn't sleep)
3. Test connection:
   ```bash
   psql "your_database_url"
   ```

### Issue 5: Render Service Sleeping
**Problem:** First request very slow

**Solutions:**
1. Use a "ping" service to keep it awake:
   - https://cron-job.org
   - Ping your backend every 10 minutes
2. Upgrade to Render paid plan ($7/month)
3. Use Railway instead (better free tier)

---

## ✅ Final Deployment Checklist

### Before Deployment:
- [ ] Code pushed to GitHub
- [ ] Local testing done
- [ ] Environment variables prepared
- [ ] API URLs updated in frontend code

### Deploy Services (In Order):
1. [ ] PostgreSQL Database (Neon.tech)
2. [ ] Redis (Redis Cloud)
3. [ ] FastAPI Backend (Render.com)
4. [ ] Y.js WebSocket Server (Render.com)
5. [ ] Frontend (Netlify)

### After Deployment:
- [ ] Test frontend loads
- [ ] Test file operations (create/edit/delete)
- [ ] Test multi-user collaboration
- [ ] Test AI features
- [ ] Check browser console for errors
- [ ] Test on mobile device

---

## 🎯 Quick Start Commands

### 1. Update Frontend URLs:
```bash
cd codesync/code-harmony-main

# Edit src/lib/api.ts
# Change API_BASE_URL to your Render backend URL

# Edit src/components/editor/CollaborativeEditor.tsx  
# Change wsUrl to your Y.js WebSocket URL
```

### 2. Build & Test:
```bash
npm run build
npm run preview  # Test locally before deploying
```

### 3. Deploy to Netlify:
```bash
# Either drag & drop the dist folder to Netlify
# Or connect GitHub for auto-deploy
```

---

## 📞 Need Help?

**Resources:**
- Neon Docs: https://neon.tech/docs
- Render Docs: https://render.com/docs
- Netlify Docs: https://docs.netlify.com
- Redis Cloud: https://redis.io/docs/

**Common Commands:**
```bash
# Check backend is running
curl https://codesync-backend.onrender.com/api/documents/

# Test database connection
psql "your_neon_database_url"

# View Render logs
# Go to Render dashboard → Your service → Logs tab
```

---

## 🎉 You're Ready to Deploy!

Follow the steps in order:
1. Create online database (Neon)
2. Setup Redis (Redis Cloud)
3. Deploy backend (Render)
4. Deploy Y.js server (Render)
5. Update frontend URLs
6. Deploy frontend (Netlify)

**Your app will be live at: `https://your-site.netlify.app`** 🚀
