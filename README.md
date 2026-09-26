# Bluff

**Live: https://bluff-82py.onrender.com**

A live, fullstack multiplayer version of the classic card game Cheat / Bluff.

## What is real
- Account registration and login with bcrypt + JWT
- Persistent player records and match history in PostgreSQL
- Authoritative Express + Socket.IO game server
- Private room codes, reconnect state, 2–6 players
- Server-side deck, hands, turn order, bluff resolution and win detection
- Responsive React interface
- Optional AI seat ("House"): heuristic card brain that plays legally with zero API dependency, plus Gemini-powered table talk with canned fallback and quota-safe throttling

## The House (AI player)
The host can seat an AI player from the room lobby ("Seat the House"). The House plays the full game locally - rank grouping, bluff frequency, impossible-claim detection - and never needs the network to make a move. Its trash talk uses the Gemini free tier (`gemini-3.1-flash-lite`, ~500 requests/day free) only when `GEMINI_API_KEY` is set; on any failure, rate limit, or 8s timeout it falls back to canned lines, and LLM calls are throttled per room so normal play stays inside free-tier limits. No billing account is attached to the Google Cloud project holding the key.

## Stack
React, Vite, Express, Socket.IO, PostgreSQL / node-postgres, plain JavaScript.

## Local setup
```bash
cp .env.example .env
npm install && npm --prefix client install
npm run dev
```

## Rules
On your turn, play one to four cards face down and claim a rank. They can be truthful or not. The next player can let it pass or call bluff. If the claim was false, the player takes the pile; if it was true, the caller does. Empty your hand first to win.
