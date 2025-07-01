# HCHB Nurse Scheduler

React application for optimizing nurse visit schedules using HCHB FHIR API, Azure Maps routing, and Leaflet maps.

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
npm install
cd backend && npm install && cd ..
```

### 2. Environment Configuration

Create `backend/.env` file:

```bash
# HCHB FHIR API
HCHB_CLIENT_ID=your_client_id_here
HCHB_RESOURCE_SECURITY_ID=your_resource_security_id_here
HCHB_AGENCY_SECRET=your_agency_secret_here
HCHB_TOKEN_URL=https://your-hchb-token-endpoint.com/token
HCHB_API_BASE_URL=https://your-hchb-api-endpoint.com

# Azure Maps
AZURE_MAPS_KEY=your_azure_maps_subscription_key_here

# Optional
PORT=3001
DATABASE_PATH=./nurse-scheduler.db
```

### 3. Initial Setup
```bash
# Sync appointments from HCHB and geocode nurse addresses
npm run full-setup
```

### 4. Start Development
```bash
# Start both frontend and backend
npm run dev
```

Visit: `http://localhost:3000` (Frontend) and `http://localhost:3001` (Backend API)

## 📋 Available Scripts

```bash
npm run dev                     # Start frontend + backend
npm run full-setup              # Sync appointments + geocode addresses
npm run backend-sync            # Sync appointments from HCHB
npm run backend-geocode         # Geocode nurse addresses
npm run test-api               # Test all API endpoints
```

## 🗺️ API Endpoints

**Base URL**: `http://localhost:3001`

### Health
- `GET /health` - Server status

### Appointments
- `GET /api/appointments/options` - Filter options
- `GET /api/appointments/filter` - Filter appointments
- `GET /api/appointments/mappable` - Mappable appointments
- `GET /api/appointments/calendar` - Calendar view
- `GET /api/appointments/stats` - Statistics
- `POST /api/appointments/sync` - Trigger HCHB sync
- `GET /api/appointments/sync/status` - Sync status

### Coordinates
- `POST /api/coordinates/geocode` - Geocode nurse addresses
- `GET /api/coordinates/status` - Geocoding status
- `GET /api/coordinates/stats` - Coordinate statistics

### Routing
- `POST /api/routing/optimize` - Optimize multiple nurse routes
- `POST /api/routing/optimize-single` - Optimize single nurse route
- `GET /api/routing/appointments/:nurseId/:date` - Get nurse appointments
- `GET /api/routing/status` - Routing service status
- `GET /api/routing/nurses-with-routes/:date` - Available nurses for date
- `POST /api/routing/optimize-all-today` - Optimize all nurses today

## 🧪 Testing

```bash
# Test all endpoints
npm run backend/test-api
```

## 🏗️ Tech Stack

- **Frontend**: React, Leaflet Maps, OpenStreetMap
- **Backend**: Node.js, Express, SQLite
- **APIs**: HCHB FHIR, Azure Maps
- **Cost**: ~$30/month (Azure Maps only, free map rendering)