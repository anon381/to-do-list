
## Todo List
wanna see it <a href="https://to-do-list-eight-ebon.vercel.app/"> live </a>


Simple React todo list bootstrapped with Vite. Now includes auth + JSON file backend (development mode) and supports configurable API base URL for deployment.

## Scripts
- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run preview` - preview production build

## Features
- Add / toggle / delete todos
- Clear completed
- Basic styling

## Getting Started (Frontend)
```
npm install
npm run dev
```
Open the shown local URL in your browser.

Create a `.env` file if you deploy a remote API:
```
VITE_API_BASE=https://your-api.example.com
```

## Backend Dev Server
Minimal Express JSON file server (`server.js`). Start it separately:
```
npm run server
```
Default URL: http://localhost:4000

---

---
## Deployment Notes
- Serverless API routes added under `/api` (signup, login, todos, toggle). These run on Vercel automatically.
- Frontend uses relative `/api/...` when not on localhost; in local dev still targets `http://localhost:4000` if you run the standalone server.
- If you do NOT want the local Express server anymore you can remove `server.js`.

---

## Environment Variables
Any variable prefixed with `VITE_` in `.env` is exposed to the client. `VITE_API_BASE` overrides the auto relative `/api` base; usually leave it un-set on Vercel.

---

---

## Vercel Deploy Steps
1. Add the repo to Vercel.
2. Build command: `npm run build` ; Output directory: `dist`.
3. Ensure `vercel.json` is present (already added) to route SPA + API.
4. Deploy. Test endpoints: `https://your-app.vercel.app/api/health` (add a simple health route if needed) or `/api/todos` (after auth).

---

### Serverless JSON storage path
When deployed on Vercel the writable directory is `/tmp`. The functions now auto-switch to `/tmp/db.json` so writes succeed instead of returning 500 errors. This still does not persist across deployments or some cold starts. Locally you can override with an env var:
```
# PowerShell
$Env:DB_FILE_DIR = "."; npm run dev
```
Or for one command:
```
cmd /c "set DB_FILE_DIR=.&& npm run dev"
```
