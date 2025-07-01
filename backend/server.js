// backend/server.js
// Express server for HCHB appointment dashboard API with routing

const express = require('express');
const cors = require('cors');
const appointmentRoutes = require('./api/appointments');
const coordinatesRoutes = require('./api/coordinates');
const routingRoutes = require('./api/routing');  // NEW: Add routing API

const app = express();
const PORT = process.env.PORT || 3001;

// ===================
// MIDDLEWARE
// ===================

// CORS - Allow frontend to connect from different ports
app.use(cors({
  origin: [
    'http://localhost:3000',  // React dev server
    'http://localhost:3001',  // Same port (for testing)
    'http://127.0.0.1:3000',  // Alternative localhost
    'http://127.0.0.1:3001'   // Alternative localhost
  ],
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ===================
// ROUTES
// ===================

// Appointment API routes
app.use('/api/appointments', appointmentRoutes);

// Coordinates API routes
app.use('/api/coordinates', coordinatesRoutes);

// Routing API routes
app.use('/api/routing', routingRoutes);  // NEW: Add routing endpoints

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'HCHB Backend server running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'HCHB Appointment Dashboard API',
    endpoints: {
      health: '/health',
      appointments: {
        options: 'GET /api/appointments/options',
        filter: 'GET /api/appointments/filter',
        mappable: 'GET /api/appointments/mappable',
        calendar: 'GET /api/appointments/calendar',
        stats: 'GET /api/appointments/stats',
        sync: 'POST /api/appointments/sync',
        syncStatus: 'GET /api/appointments/sync/status'
      },
      coordinates: {
        geocode: 'POST /api/coordinates/geocode',
        status: 'GET /api/coordinates/status',
        stats: 'GET /api/coordinates/stats'
      },
      routing: {  // NEW: Document routing endpoints
        optimize: 'POST /api/routing/optimize',
        optimizeSingle: 'POST /api/routing/optimize-single',
        appointments: 'GET /api/routing/appointments/:nurseId/:date',
        status: 'GET /api/routing/status',
        nursesWithRoutes: 'GET /api/routing/nurses-with-routes/:date',
        optimizeAllToday: 'POST /api/routing/optimize-all-today'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Endpoint ${req.method} ${req.originalUrl} not found`,
    availableEndpoints: ['/health', '/api/appointments', '/api/coordinates', '/api/routing'],  // Updated
    timestamp: new Date().toISOString()
  });
});

// ===================
// START SERVER
// ===================

app.listen(PORT, () => {
  console.log('🚀 HCHB Backend Server Started');
  console.log(`📊 API Server: http://localhost:${PORT}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`📋 API Endpoints: http://localhost:${PORT}/api/appointments`);
  console.log(`🗺️  Coordinates API: http://localhost:${PORT}/api/coordinates`);
  console.log(`🚗 Routing API: http://localhost:${PORT}/api/routing`);  // NEW
  console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
  
  // Show available endpoints
  console.log('📡 Available API Endpoints:');
  console.log('   === APPOINTMENTS ===');
  console.log('   GET  /api/appointments/options     - Filter options');
  console.log('   GET  /api/appointments/filter      - Filter appointments');
  console.log('   GET  /api/appointments/mappable    - Mappable appointments');
  console.log('   GET  /api/appointments/calendar    - Calendar view');
  console.log('   GET  /api/appointments/stats       - Statistics');
  console.log('   POST /api/appointments/sync        - Trigger sync');
  console.log('   GET  /api/appointments/sync/status - Sync status');
  console.log('   === COORDINATES ===');
  console.log('   POST /api/coordinates/geocode      - Geocode nurse addresses');
  console.log('   GET  /api/coordinates/status       - Geocoding status');
  console.log('   GET  /api/coordinates/stats        - Coordinate statistics');
  console.log('   === ROUTING ===');  // NEW
  console.log('   POST /api/routing/optimize         - Optimize routes for multiple nurses');
  console.log('   POST /api/routing/optimize-single  - Optimize route for single nurse');
  console.log('   GET  /api/routing/appointments/:nurseId/:date - Get nurse appointments');
  console.log('   GET  /api/routing/status           - Routing service status');
  console.log('   GET  /api/routing/nurses-with-routes/:date - Nurses with routable appointments');
  console.log('   POST /api/routing/optimize-all-today - Optimize all nurses today');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;