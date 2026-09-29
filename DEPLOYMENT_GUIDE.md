# 🌐 FinFlow Production Deployment & Persistence Guide
## Architecture: Vercel (Frontend) + Railway or Render (Backend API) + Persistent DB

This guide provides step-by-step instructions to deploy FinFlow to production using **Vercel** for the React frontend, **Railway** (or **Render**) for the Express + Prisma backend API, and a **persistent database** so user accounts and transactions are never lost.

---

## 📋 Pre-Deployment Summary

| Component | Recommended Platform | Build Command | Output Directory / Start |
| :--- | :--- | :--- | :--- |
| **Frontend** (`client/`) | **Vercel** | `npm run build` | `dist` |
| **Backend** (`server/`) | **Railway** or **Render** | `npm install && npm run build` | `npm start` |
| **Database** (Permanent) | **Neon.tech** or **Supabase** (Free Postgres) | Automated via `DATABASE_URL` | Automatic sync |

---

## 🔒 PERMANENT DATA PERSISTENCE: Why Hosted PostgreSQL is Recommended

Cloud hosts like Render and Railway use **ephemeral containers** on their free tiers. If an app uses a local SQLite file (`file:./dev.db`), restarting, redeploying, or waking from sleep can recreate the container filesystem and wipe the database.

**The Solution**: FinFlow includes an automated dual-engine database script (`scripts/prepare-db.js`).
- If `DATABASE_URL` is a PostgreSQL connection string (`postgresql://...` or `postgres://...`), FinFlow automatically adapts Prisma to PostgreSQL!
- If `DATABASE_URL` is a local SQLite path (`file:...`), FinFlow ensures the directory exists and uses SQLite.

### 🌟 30-Second Setup for Free Permanent Database (Neon or Supabase):
1. Go to [neon.tech](https://neon.tech/) or [supabase.com](https://supabase.com/) and create a free account.
2. Create a new project named `finflow`.
3. Copy the PostgreSQL connection string provided:
   ```text
   postgresql://user:password@ep-cool-fog-12345.neon.tech/finflow?sslmode=require
   ```
4. Set this URL as your `DATABASE_URL` environment variable in Railway or Render. FinFlow handles the rest automatically!

---

## 🚀 STEP 1: Deploy Backend API (Railway or Render)

> **Important**: Deploy the backend first so you have your production backend URL (e.g. `https://finflow-production.up.railway.app` or `https://finflow-api.onrender.com`) to connect to Vercel.

### Option A: Deploy to Railway (Recommended - Fastest)

1. **Push your code to GitHub**:
   Ensure your code is committed to a GitHub repository (private or public).
2. **Open Railway**:
   Go to [railway.app](https://railway.app/) and click **"New Project"** -> **"Deploy from GitHub repo"**.
3. **Select Repository**:
   Choose your FinFlow repository.
4. **Configure Root Directory**:
   In Railway project settings, set the **Root Directory** to:
   ```text
   server
   ```
5. **Set Environment Variables**:
   Under **Variables**, add:
   * `NODE_ENV`: `production`
   * `PORT`: `5000` (or leave default, Railway assigns dynamically)
   * `DATABASE_URL`: Your Neon/Supabase PostgreSQL connection string (or add a Railway Postgres plugin)
   * `JWT_SECRET`: Any stable 32+ character string (e.g. `finflow_production_jwt_secret_token_secure_permanent_key_2026`)
   * `CORS_ORIGIN`: `*` (or your Vercel URL once deployed)
   * `UPLOAD_DIR`: `./uploads`
6. **Generate Domain**:
   Under **Settings** -> **Networking**, click **"Generate Domain"** to get your public API URL (e.g. `https://finflow-production.up.railway.app`).
7. **Verify**:
   Visit `https://YOUR_RAILWAY_URL/api/health` in your browser. You should see `{ "status": "healthy" }`.

---

### Option B: Deploy to Render

1. Go to [render.com](https://render.com/) and click **"New +"** -> **"Web Service"**.
2. Connect your GitHub repository.
3. Configure the service:
   * **Root Directory**: `server`
   * **Environment**: `Node`
   * **Build Command**: `npm install && npm run build`
   * **Start Command**: `npm start`
4. Add Environment Variables:
   * `NODE_ENV`: `production`
   * `DATABASE_URL`: Your persistent PostgreSQL connection string (e.g. from Neon or Supabase) or persistent SQLite path
   * `JWT_SECRET`: A stable secret string (e.g. `finflow_production_jwt_secret_token_secure_permanent_key_2026`) — *do NOT regenerate this on redeploys so user sessions remain active*
   * `CORS_ORIGIN`: `*`
   * `UPLOAD_DIR`: `./uploads`
5. Click **"Create Web Service"**.
6. Copy your public URL (e.g. `https://finflow-api.onrender.com`).

---

## ⚡ STEP 2: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com/) and log in with GitHub.
2. Click **"Add New..."** -> **"Project"**.
3. Select your FinFlow GitHub repository.
4. In the configuration screen:
   * **Framework Preset**: `Vite`
   * **Root Directory**: Click "Edit" and choose:
     ```text
     client
     ```
   * **Build Command**: `npm run build` (automatic)
   * **Output Directory**: `dist` (automatic)
5. **Environment Variables**:
   Add this environment variable:
   * **Key**: `VITE_API_URL`
   * **Value**: Your deployed backend URL from Step 1 (e.g. `https://finflow-production.up.railway.app` or `https://finflow-api.onrender.com`)
     *(Do not include trailing `/api` — the client app automatically appends `/api`)*
6. Click **"Deploy"**.

---

## 🔒 STEP 3: Lock Down CORS (Production Polish)

Once Vercel gives you your production frontend domain (e.g. `https://finflow-app.vercel.app`):
1. Go back to your **Railway / Render** dashboard.
2. Update the `CORS_ORIGIN` environment variable from `*` to:
   ```text
   https://your-finflow-app.vercel.app
   ```
3. The server will redeploy automatically with strict CORS protection.

---

## ✅ Deployment Checklist

- [x] Automated database adapter (`scripts/prepare-db.js`) supporting SQLite & PostgreSQL
- [x] Stable `JWT_SECRET` configuration preventing session invalidation on redeploys
- [x] Case-insensitive email authentication with bcrypt password hashing
- [x] Multi-device login support and strict `userId` data isolation
- [x] `client/vercel.json` configured with SPA routing rules (prevents 404 on page refresh)
- [x] `client/src/api/client.ts` configured to read dynamic `VITE_API_URL`
- [x] `server/render.yaml` configured with build & start commands
- [x] CORS middleware updated to support Vercel preview and production domains
