# ResQAI — AI-Orchestrated Disaster Response & Humanitarian Relief Platform

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React Native](https://img.shields.io/badge/React_Native-Expo-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Vertex AI](https://img.shields.io/badge/Google_Cloud-Vertex_AI-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)](https://cloud.google.com/vertex-ai)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_PostGIS-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgis.net/)
[![Redis](https://img.shields.io/badge/Redis-7.0+-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

> **ResQAI** is a mission-critical, AI-powered disaster management ecosystem tailored for Sri Lanka and climate-vulnerable regions. It unifies real-time emergency triage, localized multi-channel early warnings, machine learning flood/landslide risk analytics, citizen SOS reporting, and humanitarian relief logistics into a cohesive, high-availability platform.

---

## Table of Contents
1. [Platform Architecture](#platform-architecture)
2. [Core Capabilities & Features](#core-capabilities--features)
3. [Emergency Sequence Flows](#emergency-sequence-flows)
4. [Ecosystem Tech Stack](#ecosystem-tech-stack)
5. [Repository Structure](#repository-structure)
6. [Prerequisites & Environment Configuration](#prerequisites--environment-configuration)
7. [Quickstart & Deployment](#quickstart--deployment)
   - [A. Docker Compose (Full Stack)](#a-docker-compose-full-stack)
   - [B. Local Development Setup](#b-local-development-setup)
   - [C. Vertex AI Setup](#c-vertex-ai-setup)
8. [API Reference & Documentation](#api-reference--documentation)
9. [Contributing & License](#contributing--license)

---

## Platform Architecture

ResQAI operates as a distributed microservice architecture designed for offline resilience, high concurrency during natural disasters, and real-time synchronization between citizens on the ground and command center coordinators:

```mermaid
flowchart TB
    subgraph Clients["Edge Clients"]
        Mobile["📱 ResQAI Mobile App<br/>(React Native / Expo)<br/>Citizens • Guests • Donors"]
        AdminWeb["💻 Ops Command Center<br/>(Next.js 14 / Turbopack)<br/>Disaster Management Centre (DMC)"]
    end

    subgraph Gateways["Ingress & Real-Time Layer"]
        FastAPI["⚡ Core API Service<br/>(FastAPI / Uvicorn :8000)<br/>Auth • Triage • Spatial Queries • Pledges"]
        NodeGateway["🌐 Real-time Gateway<br/>(Express / Socket.io :5000)<br/>WebSockets • Critical Alert Broadcasts"]
    end

    subgraph Intelligence["AI & Machine Learning Engine"]
        VertexAI["🧠 Vertex AI Gemini 1.5 Flash<br/>Emergency Triage • First-Aid Chatbot<br/>Multilingual (EN / SI / TA)"]
        MLModels["📊 ML Inference Service<br/>Flood & Landslide Risk Prediction<br/>(PyTorch / XGBoost)"]
    end

    subgraph Storage["Data & Cache Layer"]
        Postgres[("🐘 PostgreSQL 16 + PostGIS<br/>Spatial Zones • User Geometry<br/>Relief Missions • Incidents")]
        Redis[("⚡ Redis Cache & Message Broker<br/>OTP Store • Rate Limiting<br/>Pub/Sub")]
    end

    Mobile -->|REST / HTTPS| FastAPI
    Mobile -->|Real-Time SOS & Telemetry| NodeGateway
    AdminWeb -->|REST Management| FastAPI
    AdminWeb -->|Live Alert Subscriptions| NodeGateway

    FastAPI -->|Internal Dispatch| NodeGateway
    FastAPI -->|AI Evaluation| VertexAI
    FastAPI -->|Predictive Risk Assessment| MLModels
    FastAPI --> Postgres
    FastAPI --> Redis

    NodeGateway --> Redis
    NodeGateway --> Postgres
```

---

## Core Capabilities & Features

### 1. Autonomous Emergency Triage & SOS Dispatch
- **Urgency Scoring (1 to 5)**: User reports (voice, text, or category selection) are parsed in real-time by the AI Brain.
- **Automated Escalation**: Any incident categorized with **Urgency >= 4** instantly triggers a prioritized WebSocket dispatch to the Emergency Operations Center before database persistence.
- **Direct 1990 Suwa Seriya Link**: 1-tap phone dialer integrated with automatic GPS beacon transmission to Sri Lanka's national ambulance dispatch service.

### 2. Multilingual AI First-Aid & Crisis Assistant
- Powered by **Google Cloud Vertex AI** utilizing `gemini-1.5-flash-001`.
- Provides step-by-step first-aid guidance in **English, Sinhala, and Tamil**.
- Autonomous emergency classifier prevents dangerous medical hallucinations by routing life-threatening trauma directly to medical dispatchers.

### 3. PostGIS Geospatial Disaster Alerts
- Admins can create disaster warning zones via WKT (Well-Known Text) polygons or administrative districts.
- PostGIS spatial query (`ST_Within(user.gps_location, alert.affected_zone)`) accurately detects citizens in danger zones.
- Multi-channel notification pipeline targets affected citizens via push notifications and simulated SMS fallbacks with delivery reporting.

### 4. Humanitarian Relief Donations & Drop-off Coordination
- Donors can pledge goods or financial contributions to active relief missions.
- Automatically routes donors to designated provincial drop-off hubs (Colombo, Galle, Kandy, and Divisional Secretariats).
- Transparent fund and resource accumulation tracking for NGOs and public authorities.

### 5. "Lifeline Humanist" Mobile Experience
- Calming 60-30-10 design system engineered for high-stress crisis scenarios:
  - **60% Soft Base Canvas** (`#F8FAFC` / `#FFFFFF`) — anti-glare readability under sunlight or blackout.
  - **30% Structure** (`#0F172A`) — crisp typography and authoritative boundaries.
  - **10% Action Anchors** (`#E11D48` Crimson SOS / `#059669` Forest Mint for reassurance).

### 6. Command Center Web Portal
- Dark-mode telemetry console with live incident feeds, priority badges, responsive filter controls, and situational analytics.

---

## Emergency Sequence Flows

The platform implements 6 core operational workflows audited for production safety:

| Flow # | Title | Primary Actors | Key Mechanism |
|---|---|---|---|
| **Flow 1** | **Citizen Login** | Registered Citizen | Secure JWT authentication with role-based access control (RBAC). |
| **Flow 2** | **Citizen Registration & Verification** | New Citizen | National Identity Card (NIC) registration with rate-limited OTP verification. |
| **Flow 3** | **Emergency SOS & Triage** | Citizen in Danger | Vertex AI urgency evaluation, automatic escalation to Admin, and 1990 Suwa Seriya dialer. |
| **Flow 4** | **Guest Emergency Access** | Unregistered Citizen | Instant NIC regex + database verification; zero-friction one-tap SOS submission. |
| **Flow 5** | **Relief Goods Donation** | Donor / NGO | Relief mission pledge creation, fund updating, and localized drop-off point routing. |
| **Flow 6** | **Disaster Alert Broadcasting** | DMC / Admin | PostGIS spatial boundary intersection, push & SMS dispatch, delivery reports. |

*Detailed flow diagrams, audits, and failure mode analysis can be reviewed in [SEQUENCE_FLOW_AUDIT.md](./SEQUENCE_FLOW_AUDIT.md).*

---

## Ecosystem Tech Stack

| Domain | Technology | Purpose |
|---|---|---|
| **Core API** | Python 3.12, FastAPI, SQLAlchemy 2.0, GeoAlchemy2, Pydantic v2 | High-performance asynchronous REST API & database ORM |
| **Real-Time Gateway** | Node.js 18+, Express, Socket.io | WebSocket server, critical alert broadcasts, live telemetry |
| **AI / LLM Engine** | Google Cloud Vertex AI (`gemini-1.5-flash-001`), Python Vertex SDK | Structured first-aid generation, multilingual extraction, emergency scoring |
| **ML Models** | PyTorch, XGBoost, Scikit-learn, Pandas, NumPy | Flood inundation prediction & landslide hazard modeling |
| **Database & GIS** | PostgreSQL 16 + PostGIS 3.4 | Spatial queries, coordinates, polygon geofencing, relational store |
| **Caching & Messaging**| Redis 7 | Distributed session store, rate limits, OTP TTL caching |
| **Mobile App** | React Native, Expo SDK 52, TypeScript | Cross-platform citizen and volunteer disaster companion |
| **Command Center** | Next.js 14 (App Router), React 18, CSS Modules, Turbopack | Real-time disaster control room & resource coordination |
| **Infrastructure** | Docker, Docker Compose, Linux systemd | Containerized orchestration and reproducible builds |

---

## Repository Structure

```
resqai/
├── app/                              # Core Python FastAPI Application
│   ├── models/                       # SQLAlchemy models (User, HelpRequest, Alert, Donation)
│   ├── routers/                      # API Endpoints (auth, requests, alerts, donations, ai)
│   ├── middleware/                   # JWT verification & RBAC authorization
│   ├── config.py                     # App configuration via pydantic-settings
│   ├── database.py                   # Async SQLAlchemy engine & session factory
│   └── main.py                       # FastAPI application entry point & router mounting
├── ai-service/                       # Dedicated AI & LLM Microservice
│   ├── services/                     # Vertex AI client & prompt orchestration
│   ├── Dockerfile                    # Containerization for Vertex AI service
│   └── requirements.txt              # AI dependencies (google-cloud-aiplatform)
├── backend/                          # Real-Time Gateway (Node.js)
│   ├── middleware/                   # Multi-secret JWT authentication
│   ├── routes/                       # Express routes (critical-alert, locate)
│   ├── socket.js                     # Socket.io connection & broadcast handlers
│   └── server.js                     # Express server entry point (:5000)
├── mobile/                           # React Native / Expo Mobile App
│   ├── app/                          # Expo Router file-based navigation
│   │   ├── (auth)/                   # Login, register, OTP, guest verification
│   │   └── (people)/                 # Dashboard, help triage, alerts, donations
│   ├── components/                   # UI components (MinimalButton, MinimalInput)
│   ├── constants/                    # Theme, design system, colors, typography
│   └── config/                       # API endpoints & client configurations
├── resqai-admin/                     # Next.js Admin Command Center
│   ├── app/                          # Next.js App Router (dashboard, alerts, requests, login)
│   └── public/                       # Static assets
├── ml-models/                        # Jupyter notebooks & trained ML models
│   ├── Flood Prediction Model/       # Flood susceptibility models
│   └── Landslide Prediction Model/   # Terrain slope & rainfall hazard classifiers
├── database/                         # Database initialization & migrations
├── docker-compose.yml                # Multi-container orchestration specification
├── SEQUENCE_FLOW_AUDIT.md            # Comprehensive 6-flow system audit
├── VERTEX_AI_SETUP.md                # Google Cloud Vertex AI configuration guide
└── AI_SERVICE_FIX_SUMMARY.md         # Vertex AI migration & stability report
```

---

## Prerequisites & Environment Configuration

### Prerequisites
- **Docker** >= 24.0 and **Docker Compose** >= 2.20
- **Python** >= 3.11 with `pip`
- **Node.js** >= 18.x and `npm` >= 9.x
- **Google Cloud Platform** account with Vertex AI API enabled

### Environment Variables Template

Create `.env` in the root directory (or respective subdirectories):

```env
# Database & Cache
POSTGRES_USER=resqai_user
POSTGRES_PASSWORD=resqai_pass
POSTGRES_DB=resqai
DATABASE_URL=postgresql+asyncpg://resqai_user:resqai_pass@localhost:5432/resqai
REDIS_URL=redis://localhost:6379

# Security & Tokens
JWT_SECRET=your_super_secret_jwt_key_here
SECRET_KEY=your_super_secret_jwt_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Google Cloud Vertex AI
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
PROJECT_ID=your-gcp-project-id
LOCATION=us-central1
LLM_MODEL=gemini-1.5-flash-001

# Cross-Service Networking
NODE_BACKEND_URL=http://localhost:5000
FASTAPI_BACKEND_URL=http://localhost:8000
AI_SERVICE_URL=http://localhost:8001
```

---

## Quickstart & Deployment

### A. Docker Compose (Full Stack)

To run the complete platform (Postgres+PostGIS, Redis, FastAPI backend, Node.js gateway, and AI service) in containers:

```bash
# 1. Clone the repository
git clone git@github.com:dinathsv/resqai-platform.git
cd resqai-platform

# 2. Configure environment
cp .env.example .env  # or populate .env based on template above

# 3. Launch all services
docker compose up --build -d

# 4. Verify running containers
docker compose ps
```

The stack exposes:
- **FastAPI Core API**: `http://localhost:8000`
- **FastAPI OpenAPI Swagger UI**: `http://localhost:8000/docs`
- **Real-Time Gateway (Node.js)**: `http://localhost:5000`
- **AI Microservice**: `http://localhost:8001`
- **PostgreSQL / PostGIS**: `localhost:5432`
- **Redis**: `localhost:6379`

---

### B. Local Development Setup

#### 1. Core FastAPI Backend
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Real-Time Node.js Gateway
```bash
cd backend
npm install
npm run dev
```

#### 3. Command Center Web Admin
```bash
cd resqai-admin
npm install
npm run dev
# Accessible at http://localhost:3000
```

#### 4. Citizen Mobile App
```bash
cd mobile
npm install
npx expo start
# Scan the QR code with Expo Go (Android/iOS) or press 'a' for Android emulator
```

---

### C. Vertex AI Setup

The platform uses Vertex AI for production reliability and SLA-backed Gemini models:

1. Enable the **Vertex AI API** in your Google Cloud Console.
2. Create a service account with the role **Vertex AI User** (`roles/aiplatform.user`).
3. Download the service account JSON key to `ai-service/credentials.json`.
4. Detailed setup walkthrough is available in [VERTEX_AI_SETUP.md](./VERTEX_AI_SETUP.md).

---

## API Reference & Documentation

Once the backend is running, explore interactive API documentation at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### Key Endpoints Summary

| Method | Route | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register citizen account & trigger OTP |
| `POST` | `/api/auth/resend-otp` | Public | Rate-limited OTP resend |
| `POST` | `/api/auth/verify-otp` | Public | Verify OTP code & obtain JWT |
| `POST` | `/api/auth/login` | Public | Citizen / Admin email & password login |
| `POST` | `/api/auth/guest/verify-nic` | Public | National Identity Card validation for guests |
| `POST` | `/api/requests` | Citizen / Guest | Submit emergency SOS; triggers AI triage |
| `GET` | `/api/requests` | Authenticated | List incident requests filtered by status |
| `POST` | `/api/alerts` | Admin | Create PostGIS disaster zone & notify users |
| `GET` | `/api/alerts` | Public / Admin | Fetch active emergency warnings |
| `POST` | `/api/donations` | Citizen / NGO | Pledge relief supplies or financial aid |
| `POST` | `/api/ai/first-aid-chat` | Public | Interactive AI first-aid triage session |

---

## Contributing & License

Contributions are welcome! Please create a feature branch and submit a Pull Request following conventional commits:

```bash
git checkout -b feat/your-feature-name
git commit -m "feat(module): description of change"
git push origin feat/your-feature-name
```

Distributed under the **MIT License**.
