# Milaad Fest MVP

A fast, local-server-only MVP scoring system for Milaad arts and festival competitions.

## Features
- Complete offline local operation (SQLite database)
- Rapid result entry with on-the-fly item and candidate creation
- Real-time Leaderboard with automatic score calculation
- Team management
- Adjustable Score Settings (defaults: 10, 6, 3 points)
- Fully responsive/mobile-friendly UI (Tailwind CSS)

## Tech Stack
- Frontend: React + Vite + Tailwind CSS + Lucide Icons
- Backend: Node.js + Express
- Database: SQLite (Native `node:sqlite`)
- Package Manager: npm

## Prerequisites
- Node.js (v22.5.0 or higher is required for native `node:sqlite` support)
- npm

## Quick Start

1. Install dependencies for the root, backend, and frontend:
   ```bash
   npm run install:all
   ```

2. Start the development server (runs both backend and frontend concurrently):
   ```bash
   npm run dev
   ```

3. Open your browser:
   - Frontend app: `http://localhost:5173`
   - Backend API: `http://localhost:3000`

## Database
The SQLite database file (`miladfest.sqlite`) will be automatically created in the `backend/` directory when the backend server starts for the first time. It will also initialize the schema and default score settings automatically.

## Notes
- To reset the data, you can simply delete the `backend/miladfest.sqlite` file and restart the server.
- The UI is designed to be mobile-friendly. You can easily access the site from your mobile phone connected to the same local network by using your computer's local IP address (e.g. `http://192.168.x.x:5173`). For this to work seamlessly, ensure you run vite with `--host` if necessary, or modify `frontend/package.json` to `"dev": "vite --host"`.

## Project Structure
- `backend/`: Express API and SQLite database integration.
- `frontend/`: React + Vite application.
- `package.json`: Root package.json for easily running both concurrently.
