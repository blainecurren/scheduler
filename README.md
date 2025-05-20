# Nurse Scheduler Application

A React application for optimizing nurse visit schedules using FHIR API, Azure Maps, and GraphHopper routing.

## Project Overview

This application helps healthcare schedulers optimize nurse visit schedules by:

1. Fetching nurse, patient, and appointment data via FHIR API
2. Geocoding addresses using Azure Maps
3. Building optimal routes using GraphHopper routing engine
4. Providing an interactive scheduler interface

## Technology Stack

- **Frontend**: React
- **API Integration**: FHIR API for healthcare data
- **Geocoding**: Azure Maps
- **Route Optimization**: GraphHopper
- **API Layer**: GraphQL 
- **Deployment**: Azure Container Apps

## Project Structure

```
nurse-scheduler/
├── src/
│   ├── components/           # React components
│   │   ├── layout/           # Layout components (Header, Sidebar, etc.)
│   │   ├── scheduler/        # Scheduler components
│   │   ├── maps/             # Map visualization components
│   │   ├── nurses/           # Nurse management components
│   │   ├── patients/         # Patient management components
│   │   ├── routes/           # Route optimization components
│   │   └── appointments/     # Appointment management components
│   ├── services/             # API services
│   │   ├── fhir/             # FHIR API service
│   │   ├── maps/             # Azure Maps service
│   │   └── routing/          # GraphHopper routing service
│   ├── utils/                # Utility functions
│   ├── hooks/                # Custom React hooks
│   ├── store/                # State management
│   ├── containers/           # Container components
│   ├── config/               # Configuration files
│   ├── assets/               # Static assets
│   └── types/                # TypeScript type definitions
├── public/                   # Public assets
├── infra/                    # Infrastructure as code
├── Dockerfile                # Docker configuration
├── docker-compose.yml        # Docker Compose configuration
└── .env.example              # Environment variables example
```

## Getting Started

### Prerequisites

- Node.js (v16+)
- Docker and Docker Compose (for local development with GraphHopper)
- Azure Maps API key
- Access to a FHIR server

### Installation

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your API keys and URLs
3. Install dependencies:

```bash
npm install
```

4. Start the development server:

```bash
npm start
```

### Using Docker

To run the full application stack with GraphHopper and GraphQL:

```bash
docker-compose up
```

## Deployment

The application is designed to be deployed to Azure Container Apps.

1. Build and push the Docker image
2. Deploy using the Azure CLI or Azure Portal
3. Configure environment variables in the Azure Container Apps configuration

## License

[MIT](LICENSE)

---

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).