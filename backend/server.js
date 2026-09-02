// Load environment variables immediately before any other modules
require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

// Connect to Database
connectDB();

const app = express();

// Create raw HTTP server for Express and Socket.io
const server = http.createServer(app);

// In-memory mapping of studentId -> socket.id
// Used to route real-time notifications to specific connected students
const userSocketMap = {};

// Initialize Socket.io on top of the raw HTTP server
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Socket.io Connection & Event Handling
io.on('connection', (socket) => {
  console.log(`[Socket.io] New client connected: ${socket.id}`);

  // Event: "register"
  // When a student client connects, it emits "register" with their studentId
  socket.on('register', (studentId) => {
    if (studentId) {
      userSocketMap[studentId.toString()] = socket.id;
      socket.studentId = studentId.toString();
      console.log(`[Socket.io] Registered student: ${studentId} -> socket: ${socket.id}`);
    }
  });

  // Event: "disconnect"
  // Clean up studentId mapping when a student disconnects / closes tab
  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    if (socket.studentId && userSocketMap[socket.studentId] === socket.id) {
      delete userSocketMap[socket.studentId];
      console.log(`[Socket.io] Removed socket mapping for student: ${socket.studentId}`);
    }
  });
});

// Make io and userSocketMap accessible across all Express route handlers via req.app.get(...)
app.set('io', io);
app.set('userSocketMap', userSocketMap);

// Core Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Incoming HTTP request logger
app.use((req, res, next) => {
  const bodyInfo = req.method !== 'GET' && req.body ? JSON.stringify(req.body) : '';
  console.log(`[HTTP INCOMING] ${req.method} ${req.originalUrl} ${bodyInfo}`);
  next();
});

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Placement Analytics Backend is running' });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/companies', require('./routes/companyRoutes'));
app.use('/api/applications', require('./routes/applicationRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));

// 404 handler for unknown routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// Centralized Error-Handling Middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack || err.message);

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Port configuration
const PORT = process.env.PORT || 5000;

// Start server on raw HTTP server (with Socket.io support)
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT} (Socket.io ready)`);
});

module.exports = { app, server, io, userSocketMap };

