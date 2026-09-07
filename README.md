# ResQAI — AI-Orchestrated Disaster Response & Humanitarian Relief Platform

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8+-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React Native](https://img.shields.io/badge/React_Native-Expo_SDK_52-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev/)
[![Gemini AI](https://img.shields.io/badge/Google_Gemini-2.5_Flash-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15_PostGIS_3.3-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgis.net/)
[![Redis](https://img.shields.io/badge/Redis-7.0+-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

> **ResQAI** is a mission-critical, AI-orchestrated disaster response and humanitarian relief ecosystem tailored for Sri Lanka and climate-vulnerable regions. It integrates multilingual AI emergency triage, real-time Socket.IO broadcasts, PostGIS spatial early warnings, SMS gateway alerts, interactive Google Maps hospital/shelter routing, and relief fund/supply logistics into a unified high-availability platform.

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Key Capabilities](#key-capabilities)
3. [Ecosystem Tech Stack](#ecosystem-tech-stack)
4. [Repository Structure](#repository-structure)
5. [Environment Configuration](#environment-configuration)
6. [Quickstart & Deployment (Docker Compose)](#quickstart--deployment-docker-compose)
7. [Local Development Setup](#local-development-setup)
8. [API Reference & Endpoints](#api-reference--endpoints)
9. [Contributing & License](#contributing--license)

---

## System Architecture

ResQAI operates as a distributed microservice architecture designed for offline resilience, high concurrency during natural disasters, and real-time synchronization between citizens on the ground and command center coordinators:

```mermaid
flowchart TB
    subgraph Clients["Edge Client Applications"]
        Mobile["📱 ResQAI Mobile Web & App<br/>(React Native / Expo :8081)<br/>Citizens • Guests • Donors"]
        AdminWeb["💻 Disaster Command Center<br/>(Next.js 14 / Turbopack :3000)<br/>Disaster Management Centre (DMC)"]
    end

    subgraph Gateways["Ingress & Real-Time Layer"]
        NodeGateway["🌐 Real-Time API & Socket Gateway<br/>(Node.js / Express / Socket.io :5000)<br/>Alert Broadcasting • Telemetry • Auth Verification"]
        FastAPI["⚡ Core Python API Service<br/>(FastAPI / Uvicorn :8000)<br/>Spatial Queries • AI Triage • GeoAlchemy2"]
    end

    subgraph Intelligence["AI & External Integrations"]
        GeminiAI["🧠 Google Gemini AI<br/>Multilingual First-Aid Assistant<br/>(English • Sinhala • Tamil)"]
        SMSLenz["✉️ SMSlenz Gateway<br/>Sri Lanka Telco SMS Broadcasts<br/>(Dialog • Mobitel • Airtel • Hutch)"]
        GoogleMaps["🗺️ Google Maps Embed<br/>Medical Locator & Geocoded Routing"]
        SMTPEmail["📧 SMTP Email Dispatcher<br/>Citizen Registration OTPs"]
    end

    subgraph Storage["Data & Cache Layer"]
        Postgres[("🐘 PostgreSQL 15 + PostGIS<br/>Emergency Alerts • Rescue Requests<br/>Spatial Zones • Users • Donations")]
        Redis[("⚡ Redis 7<br/>OTP Store • Rate Limiting • Session Cache")]
    end

    Mobile -->|REST / HTTPS| NodeGateway
    Mobile -->|Real-Time SOS & Telemetry| NodeGateway
    AdminWeb -->|REST Management| NodeGateway
    AdminWeb -->|Live Alert Subscriptions| NodeGateway

    NodeGateway -->|AI Chat & Triage| GeminiAI
    NodeGateway -->|Emergency SMS Alerts| SMSLenz
    NodeGateway -->|SMTP Verification| SMTPEmail
    NodeGateway --> Postgres
    NodeGateway --> Redis

    FastAPI --> Postgres
    FastAPI --> Redis
    Mobile -.->|Embedded Maps| GoogleMaps
```

---

## Key Capabilities

### 1. Multilingual AI First-Aid & Crisis Assistant
- **Trilingual Support**: Fully automated first-aid recommendations in **English**, **Sinhala (සිංහල)**, and **Tamil (தமிழ்)** with automated language detection.
- **Crisis Triage Safety**: Automatically recognizes life-threatening trauma and immediately advises calling **1990 Suwa Seriya** or direct emergency lines without unsafe hallucinations.

### 2. Autonomous Emergency Triage & SOS Dispatch
- **Urgency Scoring (1 to 5)**: Reports are triaged automatically by urgency level.
- **Priority Escalation**: High-severity incidents broadcast instantly via WebSockets to the DMC Ops Dashboard.
- **Direct Emergency Links**: 1-tap dialer for **1990 Suwa Seriya** (Ambulance), **119** (Police), and **110** (Fire Service).

### 3. Real-Time PostGIS Disaster Alerts & SMS Broadcast
- **Admin Alert Issuer**: Administrators create targeted emergency warning zones (Floods, Landslides, Fires, etc.) with custom action plans.
- **Multi-Channel Dispatch**: Broadcasts real-time alerts through Socket.IO to connected mobile users and triggers real SMS notifications across Sri Lankan mobile networks via **SMSlenz**.
- **Visual Dashboard Hero**: Overlapping half-card alert banner with live alert updates and instant acknowledgment tracking.

### 4. Interactive Medical & Hospital Locator
- **Live Google Maps Embed**: Embedded interactive map centered on the user's location with dynamic search across Sri Lankan districts (Kelaniya, Colombo, Kandy, Galle, Gampaha, etc.).
- **Nearest Medical Facilities**: Direct 1-tap call and external Google Maps navigation to national, teaching, and base hospitals.

### 5. Citizen Activities & Relief Contributions
- **Personalized Incident Tracking**: Real-time monitoring of user-submitted rescue requests and statuses.
- **Humanitarian Relief Donations**: Transparent fund and supply pledges for disaster victims.
- **Interactive Disaster Preparedness Quiz**: Gamified educational quiz testing citizen readiness for natural hazards.

---

## Ecosystem Tech Stack

| Domain | Technology | Purpose |
|---|---|---|
| **Mobile App** | React Native, Expo SDK 52, TypeScript | Citizen mobile companion with offline-resilient local storage |
| **Command Center** | Next.js 14 (App Router), React 18, CSS Modules | Real-time disaster management and alert broadcasting dashboard |
| **Node.js Gateway** | Node.js 18+, Express, Socket.io | Primary API gateway, WebSocket hub, SMS and auth service |
| **Core Python API** | Python 3.12, FastAPI, SQLAlchemy 2.0, GeoAlchemy2 | Asynchronous spatial data processing and ML analytics |
| **AI / LLM Engine** | Google Gemini (2.5-Flash / 1.5-Flash) | Multilingual crisis guidance and emergency triage |
| **Database & GIS** | PostgreSQL 15 + PostGIS 3.3 | Geo-spatial indexing, polygon boundaries, relational data |
| **Cache & Sessions** | Redis 7 Alpine | Rate limiting, OTP TTL verification, distributed cache |
| **SMS Gateway** | SMSlenz API | Low-latency SMS delivery across Sri Lanka mobile operators |
| **Orchestration** | Docker & Docker Compose | Multi-container unified deployment |

---

## Repository Structure

```
resqai/
├── app/                              # Core Python FastAPI Application
│   ├── models/                       # SQLAlchemy / GeoAlchemy2 models
│   ├── routers/                      # Spatial alerts, triage, and ML endpoints
│   ├── database.py                   # Async database engine
│   └── main.py                       # FastAPI application entry point (:8000)
├── backend/                          # Real-Time Gateway & Node.js API (:5000)
│   ├── middleware/                   # JWT authentication & role-based access
│   ├── routes/                       # Auth, alerts, requests, donations, AI chat
│   ├── services/                     # SMSlenz SMS service, email OTP service
│   ├── socket.js                     # Socket.io broadcast handlers
│   └── server.js                     # Express server & WebSocket hub
├── mobile/                           # React Native / Expo Mobile App (:8081)
│   ├── app/                          # Expo Router file-based screens
│   │   ├── (auth)/                   # Login, registration, OTP verification
│   │   └── (people)/                 # Dashboard, locator, chatbot, help, activities
│   ├── assets/                       # Compressed high-res PNG/JPEG assets
│   ├── components/                   # TopBar, BottomNav, shared UI components
│   └── config/                       # API endpoints & WebSocket client
├── resqai-admin/                     # Next.js 14 Command Center (:3000)
│   ├── app/                          # Admin dashboard, alert issuance, triage
│   └── lib/                          # Admin API clients & telemetry hooks
├── ml-models/                        # Flood & Landslide prediction models
├── database/                         # PostGIS initialization & migration SQL
└── docker-compose.yml                # Unified multi-container orchestration
```

---

## Environment Configuration

Create a root `.env` file (or configure environment variables in your deployment environment):

```env
# --- Database & Cache ---
POSTGRES_DB=resqai
POSTGRES_USER=resqai_user
POSTGRES_PASSWORD=resqai_pass
DATABASE_URL=postgresql+asyncpg://resqai_user:resqai_pass@localhost:5432/resqai
REDIS_URL=redis://localhost:6379

# --- Security & Authentication ---
SECRET_KEY=your_secure_secret_key_here
JWT_SECRET=your_secure_jwt_secret_here
ADMIN_PASSWORD=your_admin_password_here

# --- Google Gemini AI ---
AI_API_KEY=your_gemini_api_key_here
AI_MODEL=gemini-2.5-flash

# --- Email OTP Dispatch (Gmail or SMTP) ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_specific_password
SMTP_FROM_EMAIL=your_email@gmail.com

# --- Sri Lanka SMS Gateway (SMSlenz) ---
SMSLENZ_USER_ID=your_smslenz_user_id
SMSLENZ_API_KEY=your_smslenz_api_key
SMSLENZ_SENDER_ID=SMSlenzDEMO
SMSLENZ_BASE_URL=https://smslenz.lk/api

# --- Google Maps Configuration ---
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_optional_google_maps_api_key
```

---

## Quickstart & Deployment (Docker Compose)

The complete ResQAI stack is containerized for zero-friction deployment:

```bash
# 1. Clone the repository
git clone git@github.com:dinathsv/resqai-platform.git
cd resqai-platform

# 2. Configure environment
cp .env.example .env  # Populate keys based on template above

# 3. Build and launch all 6 services
docker compose up --build -d

# 4. Inspect container health
docker compose ps
```

### Deployed Services & Ports

| Service Container | Port | Description |
|---|---|---|
| `resqai_mobile` | `http://localhost:8081` | Citizen Mobile Web Application (Expo) |
| `resqai_admin` | `http://localhost:3000` | Operations Command Center (Next.js) |
| `resqai_node_backend` | `http://localhost:5000` | Node.js Gateway & Socket.IO WebSockets |
| `resqai_python_api` | `http://localhost:8000` | Core Python FastAPI (Swagger: `/docs`) |
| `resqai_db` | `localhost:5433` (maps to 5432) | PostgreSQL 15 + PostGIS Spatial Engine |
| `resqai_redis` | `localhost:6379` | Redis 7 Cache & Rate Limiter |

---

## Local Development Setup

To run services individually outside Docker:

### 1. Node.js Gateway & Real-Time Server
```bash
cd backend
npm install
npm run dev
# Running on http://localhost:5000
```

### 2. Citizen Mobile App (Expo)
```bash
cd mobile
npm install
npx expo start
# Press 'w' for web (http://localhost:8081) or scan with Expo Go on Android / iOS
```

### 3. Command Center Web Admin
```bash
cd resqai-admin
npm install
npm run dev
# Running on http://localhost:3000
```

### 4. Core Python FastAPI Backend
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# Interactive API Documentation: http://localhost:8000/docs
```

---

## API Reference & Endpoints

### Authentication & Profiles
| Method | Route | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register new citizen account; dispatches email OTP |
| `POST` | `/api/auth/verify-otp` | Public | Verify 6-digit OTP and issue JWT access token |
| `POST` | `/api/auth/resend-otp` | Public | Request fresh OTP with rate-limit protection |
| `POST` | `/api/auth/login` | Public | Email & password authentication for citizens and admins |
| `POST` | `/api/auth/guest/verify-nic`| Public | Instant Sri Lankan NIC format validation for guest SOS |
| `GET` | `/api/auth/me` | Authenticated | Retrieve authenticated citizen profile and contact details |

### Disaster Alerts & Early Warnings
| Method | Route | Access | Description |
|---|---|---|---|
| `GET` | `/api/alerts` | Public / Auth | Retrieve list of active emergency alerts |
| `GET` | `/api/alerts/:id` | Public / Auth | Get comprehensive details of a specific disaster alert |
| `POST` | `/api/alerts` | Admin | Create disaster alert; triggers Socket.IO & SMS broadcasts |
| `POST` | `/api/alerts/:id/acknowledge` | Authenticated | Record citizen alert acknowledgment |

### Emergency Requests & Triage
| Method | Route | Access | Description |
|---|---|---|---|
| `POST` | `/api/requests` | Public / Auth | Submit emergency SOS request; evaluates AI urgency score |
| `GET` | `/api/requests` | Admin | View all submitted incidents with urgency filters |
| `GET` | `/api/requests/my` | Authenticated | Retrieve citizen's own submitted rescue requests |
| `POST` | `/api/requests/critical-alert` | Authenticated | Real-time high-urgency escalation dispatch |

### AI Crisis Chat & Assistance
| Method | Route | Access | Description |
|---|---|---|---|
| `POST` | `/api/ai/first-aid-chat` | Public / Auth | Multilingual (EN/SI/TA) AI first-aid consultation |
| `POST` | `/api/ai/triage` | Public / Auth | Automated disaster category extraction and urgency scoring |

### Donations & Medical Facilities
| Method | Route | Access | Description |
|---|---|---|---|
| `GET` | `/api/donations` | Public / Auth | List available relief missions and funds |
| `POST` | `/api/donations` | Authenticated | Pledge funds or essential supplies to a disaster mission |
| `GET` | `/api/locate` | Public | Find nearest hospitals, emergency rooms, and shelters |

---

## Contributing & License

1. Fork the repository and create a feature branch (`git checkout -b feat/your-feature-name`).
2. Commit your changes with descriptive commit messages (`git commit -m "feat(scope): concise summary"`).
3. Push to your branch (`git push origin feat/your-feature-name`) and open a Pull Request.

Distributed under the **MIT License**.
