import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { initDB } from './db.js';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import { requireAuth } from './middleware/auth.js';

dotenv.config();

// Fail loudly instead of silently breaking CORS or JWT verification for
// every client. A missing CLIENT_URL makes cors({ origin: undefined })
// block all cross-origin requests with no clear error — this is exactly
// what causes "works for me, broken for my collaborator" reports, since
// the failure happens per-browser with nothing obvious in server logs.
const REQUIRED_ENV = ['CLIENT_URL', 'JWT_SECRET'];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`Missing required environment variable(s): ${missingEnv.join(', ')}`);
  console.error('Set these in server/.env before starting the server.');
  process.exit(1);
}

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

// 1. Create HTTP server and attach Socket.io
const httpServer = createServer(app);
// server/src/index.js
const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_URL } });



initDB();

app.use('/auth', authRoutes);
app.use('/documents', documentRoutes);

app.get('/protected', requireAuth, (req, res) => {
  res.json({ message: 'You are authenticated!', userId: req.userId });
});

// 2. Authenticate the WebSocket connection
// This middleware verifies the token during the WebSocket handshake
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error'));
    socket.userId = decoded.userId;
    // Store expiry so we can re-check it later — jwt.verify only runs once
    // at handshake time, so without this a socket kept open past the
    // token's 1-day expiry (e.g. a laptop left open overnight) would keep
    // emitting yjs-update/awareness-update indefinitely with no further
    // auth check.
    socket.tokenExp = decoded.exp; // seconds since epoch
    next();
  });
});

// 3. Handle WebSocket connections and "Rooms"
// 3. Handle WebSocket connections and "Rooms"
// 3. Handle WebSocket connections and "Rooms"
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId}`);

  const expiryCheck = setInterval(() => {
    if (socket.tokenExp && Date.now() / 1000 > socket.tokenExp) {
      socket.emit('auth-expired');
      socket.disconnect(true);
    }
  }, 60_000);

  // STAGE 8: Cache the user's role on room join
  socket.on('join-document', async (documentId) => {
    try {
      const res = await pool.query('SELECT role FROM collaborators WHERE user_id = $1 AND document_id = $2', [socket.userId, documentId]);
      if (res.rows.length > 0) {
        socket.join(documentId);
        
        // Save the role directly onto the socket object for fast lookup
        if (!socket.roles) socket.roles = {};
        socket.roles[documentId] = res.rows[0].role;
        
        console.log(`User ${socket.userId} joined document ${documentId} as ${socket.roles[documentId]}`);
      } else {
        console.log(`Access denied for User ${socket.userId} to ${documentId}`);
      }
    } catch (err) {
      console.error('Socket DB Error', err);
    }
  });

  // Relay Yjs binary updates (Stage 5)
  socket.on('yjs-update', ({ documentId, update }) => {
    // STAGE 8 ENFORCEMENT: Silently drop keystrokes from Viewers
    if (socket.roles && socket.roles[documentId] === 'viewer') {
      return; 
    }
    socket.to(documentId).emit('yjs-update', update);
  });

  // Relay cursor and presence updates (Stage 6)
  socket.on('awareness-update', ({ documentId, update }) => {
    // Viewers are allowed to broadcast awareness (so you can see them looking at the doc)
    socket.to(documentId).emit('awareness-update', update);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
    clearInterval(expiryCheck);
  });
});

const PORT = process.env.PORT || 4000;
// CRITICAL: Listen on the httpServer, not the Express app directly
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});