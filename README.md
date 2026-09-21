# Bluff

A live, fullstack multiplayer version of the classic card game Cheat / Bluff.

## What is real
- Account registration and login with bcrypt + JWT
- Persistent player records and match history in MongoDB
- Authoritative Express + Socket.IO game server
- Private room codes, reconnect state, 2–6 players
- Server-side deck, hands, turn order, bluff resolution and win detection
- Responsive React interface

## Stack
React, Vite, Express, Socket.IO, MongoDB / Mongoose, plain JavaScript.

## Local setup
```bash
cp .env.example .env
npm install && npm --prefix client install
npm run dev
```

## Rules
On your turn, play one to four cards face down and claim a rank. They can be truthful or not. The next player can let it pass or call bluff. If the claim was false, the player takes the pile; if it was true, the caller does. Empty your hand first to win.
