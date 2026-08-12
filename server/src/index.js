import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { pool, initDB } from './db.js';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import { requireAuth } from './middleware/auth.js';

dotenv.config();

const REQUIRED_ENV = ['CLIENT_URL', 'JWT_SECRET'];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`Missing required env: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_URL } });
app.set('io', io);

initDB();

app.use('/auth', authRoutes);
app.use('/documents', documentRoutes);

// --- IMPROVEMENT C: REDIS PUB/SUB ADAPTER ---
// This allows your WebSocket server to scale across multiple instances
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const pubClient = createClient({ url: redisUrl });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  console.log('Redis Pub/Sub Adapter connected for horizontal scaling');
}).catch(err => console.error('Redis connection failed (Continuing without scaling):', err.message));
// --------------------------------------------

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error'));
    socket.userId = decoded.userId;
    socket.tokenExp = decoded.exp; 
    next();
  });
});

const rateLimits = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId}`);

  rateLimits.set(socket.id, { count: 0, lastReset: Date.now() });

  const expiryCheck = setInterval(() => {
    if (socket.tokenExp && Date.now() / 1000 > socket.tokenExp) {
      socket.emit('auth-expired');
      socket.disconnect(true);
    }
  }, 60_000);

  socket.on('join-document', async (documentId) => {
    try {
      const res = await pool.query('SELECT role FROM collaborators WHERE user_id = $1 AND document_id = $2', [socket.userId, documentId]);
      if (res.rows.length > 0) {
        socket.join(documentId);
        if (!socket.roles) socket.roles = {};
        socket.roles[documentId] = res.rows[0].role;
        console.log(`User ${socket.userId} joined ${documentId} as ${socket.roles[documentId]}`);
      }
    } catch (err) {
      console.error('Socket DB Error', err);
    }
  });

  // CRITICAL FIX: The missing WebSocket Relay + Dual-Layer RBAC Enforcement
  socket.on('yjs-update', ({ documentId, update }) => {
    // If they are a viewer, silently drop the keystrokes (Network-level RBAC)
    if (socket.roles && socket.roles[documentId] === 'viewer') return;
    
    // Relay the compressed binary delta to everyone else in the room
    socket.to(documentId).emit('yjs-update', update);
  });

  socket.on('awareness-update', ({ documentId, update }) => {
    const limit = rateLimits.get(socket.id);
    const now = Date.now();
    
    // Reset counter every 1 second
    if (now - limit.lastReset > 1000) { 
      limit.count = 0; 
      limit.lastReset = now; 
    }
    
    limit.count++;
    
    // Disconnect malicious clients blasting > 30 updates per second
    if (limit.count > 30) {
      console.warn(`DDoS Prevented: Rate limit exceeded for socket ${socket.id}`);
      return socket.disconnect(true);
    }
    
    socket.to(documentId).emit('awareness-update', update);
  });

  socket.on('disconnect', () => {
    clearInterval(expiryCheck);
    rateLimits.delete(socket.id); // Clean up memory
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});