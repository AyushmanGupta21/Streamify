# 🎥 Video Meet — Fullstack Chat & Video Calling App

A fullstack real-time chat and video calling application built with React, Express, MongoDB, and Stream.

## ✨ Features

- 🔐 JWT Authentication & Protected Routes
- 💬 Real-time Messaging with Typing Indicators & Reactions
- 📹 1-on-1 Video Calls with Screen Sharing & Recording
- 👥 Friend Requests System
- 🎨 32 UI Themes (DaisyUI)
- 🌍 User Onboarding with Profile Setup

## 🛠 Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, TailwindCSS, DaisyUI |
| State | Zustand, TanStack Query |
| Chat & Video | Stream Chat + Stream Video SDK |
| Backend | Node.js, Express.js |
| Database | MongoDB (Mongoose) |
| Auth | JWT, bcryptjs |

---

## ⚙️ Environment Variables

### Backend — `backend/.env`
```env
PORT=5001
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/videomeet?retryWrites=true&w=majority
STEAM_API_KEY=your_stream_api_key
STEAM_API_SECRET=your_stream_api_secret
JWT_SECRET_KEY=your_long_random_secret_key
NODE_ENV=development
```

### Frontend — `frontend/.env`
```env
VITE_STREAM_API_KEY=your_stream_api_key
```

> Copy the `.env.example` files in each folder as a starting point.

---

## 🚀 Running Locally

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd streamify-video-calls

# Install dependencies for both folders
npm run install:all
```

### 2. Set up environment variables
```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your values

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env with your Stream API Key
```

### 3. Run both servers (open 2 terminals)

**Terminal 1 — Backend:**
```bash
npm run dev:backend
# Runs on http://localhost:5001
```

**Terminal 2 — Frontend:**
```bash
npm run dev:frontend
# Runs on http://localhost:5173
```

---

## ☁️ Deploying to Render (Free)

This project includes a `render.yaml` blueprint for one-click deployment.

### Step 1 — Push to GitHub
```bash
git add .
git commit -m "ready to deploy"
git remote add origin https://github.com/yourusername/video-meet.git
git push -u origin main
```

### Step 2 — Create Render Account
Go to [render.com](https://render.com) and sign up with GitHub.

### Step 3 — Deploy via Blueprint
1. In Render dashboard → click **"New"** → **"Blueprint"**
2. Connect your GitHub repo
3. Render will read `render.yaml` and create **2 services**:
   - `videomeet-backend` (Web Service)
   - `videomeet-frontend` (Static Site)

### Step 4 — Set Environment Variables
In Render dashboard for **videomeet-backend**, add:
| Variable | Value |
|---|---|
| `MONGO_URI` | Your MongoDB Atlas URI |
| `STEAM_API_KEY` | Your Stream API Key |
| `STEAM_API_SECRET` | Your Stream API Secret |
| `JWT_SECRET_KEY` | Your JWT secret |
| `FRONTEND_URL` | Your frontend Render URL (e.g. `https://videomeet-frontend.onrender.com`) |
| `NODE_ENV` | `production` |

In Render dashboard for **videomeet-frontend**, add:
| Variable | Value |
|---|---|
| `VITE_STREAM_API_KEY` | Your Stream API Key |

### Step 5 — Deploy
Click **"Apply"** and wait for both services to build (~3-5 min).

Your app will be live at your Render frontend URL! 🎉

---

## 🔑 Getting API Keys

### Stream (Chat + Video)
1. Go to [getstream.io](https://getstream.io) → Sign up free
2. Create an App → copy **API Key** and **API Secret**

### MongoDB Atlas
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → Sign up free
2. Create a free M0 cluster → copy the connection string
3. Whitelist your IP (or `0.0.0.0/0` for Render)

