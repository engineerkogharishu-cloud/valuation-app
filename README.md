# Nepal Property Valuation Report

A full-stack **React + Node.js + SQLite** application for creating, managing, and printing property valuation reports for Nepali banks.

---

## Project Structure

```
valuation-app/
├── backend/                    ← Express API + SQLite
│   ├── server.js               ← API server (default port 3001)
│   ├── package.json
│   ├── .env.example            ← Copy to .env and fill in values
│   └── valuation.db            ← Auto-created on first run (not in git)
│
├── frontend/                   ← React (Create React App)
│   ├── public/
│   │   ├── index.html
│   │   └── img/                ← Static images
│   └── src/
│       ├── index.js
│       ├── App.js
│       ├── api.js              ← All API calls
│       ├── constants.js        ← Shared constants
│       ├── ValuationForm.jsx   ← Main form
│       ├── Dashboard.js        ← Reports list
│       ├── AdminDashboard.js   ← Company admin panel
│       ├── SuperUserDashboard.js ← Super admin panel
│       ├── components/         ← Reusable UI components
│       ├── utils/              ← Utility functions
│       └── report/             ← HTML report builders
│
├── database/
│   └── schema.sql              ← Schema reference
│
├── start.sh                    ← One-command start (Mac/Linux)
├── start.bat                   ← One-command start (Windows)
├── netlify.toml                ← Frontend deploy config
└── README.md
```

---

## Quick Start (Local Development)

### Requirements
- **Node.js** v20+ — [nodejs.org](https://nodejs.org)
- **npm** v9+

### 1. Configure the backend

```bash
cd backend
cp .env.example .env
# Edit .env — set JWT_SECRET and SUPER_ADMIN_INITIAL_PASSWORD
```

### 2. Start both servers

**Mac / Linux:**
```bash
chmod +x start.sh
./start.sh
```

**Windows:**
```
Double-click start.bat
```

**Manual:**
```bash
# Terminal 1
cd backend && npm install && npm run dev

# Terminal 2
cd frontend && npm install && npm start
```

Open **http://localhost:3000**

---

## Deployment

### Frontend — Netlify (or any static host)

```bash
cd frontend
npm install
npm run build
# Deploy the frontend/build/ folder
```

The `netlify.toml` at the root is pre-configured for Netlify auto-deploy.

### Backend — Railway / Render / VPS

1. Set environment variables from `.env.example`
2. `npm install && npm start`
3. Update `CORS_ORIGIN` in backend `.env` to your frontend URL
4. Update the API base URL in `frontend/src/api.js` to your backend URL

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | API port (default 3001) |
| `NODE_ENV` | Yes | `production` or `development` |
| `DB_PATH` | No | SQLite file path (default `./valuation.db`) |
| `CORS_ORIGIN` | Yes | Comma-separated allowed frontend origins |
| `JWT_SECRET` | Yes | ≥32 random chars — generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `SUPER_ADMIN_INITIAL_PASSWORD` | Yes | Strong password for first super admin login |
| `TRUST_PROXY` | No | Set `1` behind nginx/Cloudflare/Railway/Render |

---

## User Roles

| Role | Access |
|---|---|
| `super_user` | All companies, letterhead setup, user management |
| `admin` | Own company — valuators, banks, reports |
| `user` | Create and view reports for own company |

---

## Database

SQLite — no installation needed. The file is created automatically on first run.

**Backup:** copy `backend/valuation.db`  
**Reset:** delete `backend/valuation.db` and restart

---

## Troubleshooting

**Port in use:**
```bash
# Mac/Linux
lsof -ti:3001 | xargs kill
# Windows
netstat -ano | findstr :3001
```

**Frontend can't reach backend:**
- Confirm backend is running on port 3001
- Check `CORS_ORIGIN` in `backend/.env` matches your frontend URL

**Database errors:**
- Delete `backend/valuation.db` and restart to recreate from scratch
