# 🌐 FinFlow Production Deployment Guide
## Architecture: Vercel (Frontend) + Railway or Render (Backend API)

This guide provides step-by-step instructions to deploy FinFlow to production using **Vercel** for the React frontend and **Railway** (or **Render**) for the Express + Prisma backend API.

---

## 📋 Pre-Deployment Summary

| Component | Recommended Platform | Build Command | Output Directory / Start |
| :--- | :--- | :--- | :--- |
| **Frontend** (`client/`) | **Vercel** | `npm run build` | `dist` |
| **Backend** (`server/`) | **Railway** or **Render** | `npm install && npx prisma db push && npm run build` | `npm start` |

---

## 🚀 STEP 1: Deploy Backend API (Railway or Render)

> **Important**: Deploy the backend first so you have your production backend URL (e.g. `https://finflow-api.up.railway.app` or `https://finflow-api.onrender.com`) to connect to Vercel.

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
   * `DATABASE_URL`: `file:./dev.db` (or attach a Railway PostgreSQL database)
   * `JWT_SECRET`: Any random 32+ character string (e.g. `super_secret_finflow_production_key_2026`)
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
   * **Build Command**: `npm install && npx prisma db push && npm run build`
   * **Start Command**: `npm start`
4. Add Environment Variables:
   * `NODE_ENV`: `production`
   * `DATABASE_URL`: `file:./dev.db`
   * `JWT_SECRET`: A secure random secret string
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

## 🗄️ Optional: Upgrading to Hosted PostgreSQL (Supabase / Neon / Railway)

If you prefer cloud-hosted PostgreSQL over SQLite:
1. Create a free PostgreSQL database on [Supabase](https://supabase.com/) or [Neon.tech](https://neon.tech/).
2. In `server/prisma/schema.prisma`, change line 2:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Set your Railway / Render `DATABASE_URL` to your PostgreSQL connection string:
   ```text
   postgresql://postgres:password@db.supabase.co:5432/postgres
   ```
4. Push migrations:
   ```bash
   npx prisma db push
   ```

---

## ✅ Deployment Checklist

- [x] `client/vercel.json` configured with SPA routing rules (prevents 404 on page refresh)
- [x] `client/src/api/client.ts` configured to read dynamic `VITE_API_URL`
- [x] `server/render.yaml` and `server/railway.json` blueprint files generated
- [x] `server/Procfile` process definition generated
- [x] `server/package.json` configured with `postinstall: prisma generate`
- [x] CORS middleware updated to support Vercel preview and production domains
