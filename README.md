# Todo List

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

## Deployment Notes
- Serverless API routes added under `/api` (signup, login, todos, toggle). These run on Vercel automatically.
- Frontend uses relative `/api/...` when not on localhost; in local dev still targets `http://localhost:4000` if you run the standalone server.
- If you do NOT want the local Express server anymore you can remove `server.js`.

## Environment Variables
Any variable prefixed with `VITE_` in `.env` is exposed to the client. `VITE_API_BASE` overrides the auto relative `/api` base; usually leave it unset on Vercel.

## Vercel Deploy Steps
1. Add the repo to Vercel.
2. Build command: `npm run build` ; Output directory: `dist`.
3. Ensure `vercel.json` is present (already added) to route SPA + API.
4. Deploy. Test endpoints: `https://your-app.vercel.app/api/health` (add a simple health route if needed) or `/api/todos` (after auth).

## Notes
- JSON file persistence (`db.json`) in serverless functions is ephemeral; each cold start may have older or empty state and concurrent writes can race. For production use a real database (PlanetScale, Neon, KV, Upstash, etc.).
- To avoid data loss, replace file write logic with a database adapter.
