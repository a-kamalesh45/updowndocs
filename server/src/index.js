import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

import { initDB } from './db.js';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import { requireAuth } from './middleware/auth.js';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

// 1. Create HTTP server and attach Socket.io
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL }
});

initDB();

app.use('/auth', authRoutes);
app.use('/documents', documentRoutes);

app.get('/protected', requireAuth, (req, res) => {
  res.json({ message: 'You are authenticated!', userId: req.userId });
});

// 2. Authenticate the WebSocket connection
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error'));
    socket.userId = decoded.userId;
    next();
  });
});

// 3. Handle WebSocket connections and "Rooms"
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId}`);

  socket.on('join-document', (documentId) => {
    socket.join(documentId);
    console.log(`User ${socket.userId} joined document ${documentId}`);
  });

  socket.on('doc-update', ({ documentId, content }) => {
    // Broadcast the update to everyone ELSE in the room
    socket.to(documentId).emit('doc-update', content);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
  });
});

const PORT = process.env.PORT || 4000;
// CRITICAL: Listen on the httpServer, not the Express app directly
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});