<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License" />
</p>

# ⚡ VRel — A Self-Hosted GitHub Clone

> A full-stack, database-free GitHub-like platform built from scratch with **Node.js**, **React**, and a custom **Git-like content-addressable object store**. Designed for internal company use, VRel reimplements Git's core data model (blobs, trees, commits) with file-system storage, JWT authentication, CI/CD pipelines, pull requests, and real-time SSE log streaming.

---

## 📌 Problem Statement

Modern software teams rely heavily on platforms like GitHub for version control, code review, and CI/CD. However, many organizations require **self-hosted, lightweight alternatives** that:

- Operate without external database dependencies (no MongoDB, PostgreSQL, etc.)
- Provide full Git-like version control workflows through a web UI
- Support CI/CD build pipelines with real-time feedback
- Offer secure, JWT-based multi-user authentication
- Run entirely on commodity hardware or containers

**VRel** solves this by implementing a complete GitHub-like experience using only the file system as its storage engine — making it portable, simple to deploy, and easy to understand.

---

## 🎯 Objectives

1. **Recreate Git internals** — Implement content-addressable blob storage, tree structures, and commit objects using SHA-256 hashing
2. **Full web-based workflow** — Provide a React UI for repository management, branching, merging, code browsing, and pull requests
3. **Zero-database architecture** — Use the file system as the sole data store with JSON metadata files and content-addressed objects
4. **CI/CD build pipelines** — Support automated Maven/Gradle (Java) and virtualenv/pytest (Python) build pipelines with real-time SSE log streaming
5. **Secure multi-user access** — JWT-based authentication with role-based access and automatic token expiry handling
6. **Concurrent safety** — File-system-based mutex locks and exclusive checkout mechanisms for race-condition-free operations
7. **Container-ready deployment** — Docker Compose setup for one-command production deployment

---

## ✨ Features

| Category | Feature | Description |
|----------|---------|-------------|
| **Repository** | Init / Stage / Commit | Create repositories, stage files, and create commits with author & message |
| **Repository** | Commit Log & Status | View full commit history and current staging area status |
| **Repository** | File Browser | Navigate directory trees and view file contents with code highlighting |
| **Branching** | Create / Switch / Delete | Full branch lifecycle management |
| **Branching** | Merge & Conflict Detection | Three-way merge with automatic conflict detection and resolution |
| **Branching** | Branch Comparison | Compare branches to see diverged commits and file differences |
| **Pull Requests** | Create / Review / Merge | Full PR workflow with status tracking (open → approved → merged/closed) |
| **CI/CD** | Java Build Pipeline | Maven/Gradle detection, automated test execution with live streaming |
| **CI/CD** | Python Build Pipeline | virtualenv + pip + pytest with sequential step execution |
| **CI/CD** | Real-time Build Logs | Server-Sent Events (SSE) stream build output line-by-line to the browser |
| **CI/CD** | Build History & Artifacts | Track all builds with status, logs, and artifact storage |
| **Environments** | Environment Management | Create and configure deployment environments (dev/staging/production) |
| **Environments** | Environment Variables | Per-environment configuration with custom env vars and build overrides |
| **Locking** | Exclusive File Checkout | Lock files for exclusive editing with TTL-based expiry |
| **Locking** | Force Release & Cleanup | Admin force-release and automatic expired lock cleanup |
| **Auth** | JWT Authentication | Secure login with token-based authentication on all protected routes |
| **Auth** | Auto Token Refresh | Automatic 401 detection and session expiry handling |
| **Push/Pull** | Activity Feed | Real-time activity tracking for pushes, pulls, and operations |
| **Concurrency** | File-based Mutex | Directory-based mutex locks preventing race conditions on shared resources |
| **Search** | Quick Repository Search | Keyboard-driven (`/` hotkey) repository search with instant filtering |

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 | Component-based UI |
| **Frontend** | Vite 5 | Dev server with HMR & production bundling |
| **Frontend** | Axios | HTTP client with JWT interceptors |
| **Frontend** | React Router v6 | Client-side routing |
| **Backend** | Node.js 20+ | Server runtime |
| **Backend** | Express.js 4 | REST API framework |
| **Backend** | jsonwebtoken | JWT authentication |
| **Backend** | dotenv | Environment configuration |
| **Storage** | File System | Content-addressable object store (SHA-256) |
| **Real-time** | Server-Sent Events (SSE) | Live build log streaming & activity feed |
| **Testing** | Jest + Supertest | Integration & E2E test suites |
| **DevOps** | Docker + Docker Compose | Containerized deployment |
| **Web Server** | Nginx | Frontend static file serving & API proxy (production) |
| **Dev Tools** | Nodemon | Auto-restart backend on code changes |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                         │
│                                                                 │
│   React 18 + Vite       Axios HTTP Client      EventSource     │
│   ┌──────────────┐      ┌──────────────┐      ┌────────────┐   │
│   │  Pages &     │ ───▶ │  API Client  │ ───▶ │  SSE Live  │   │
│   │  Components  │      │  (JWT Auth)  │      │  Streams   │   │
│   └──────────────┘      └──────┬───────┘      └─────┬──────┘   │
└────────────────────────────────┼─────────────────────┼──────────┘
                                 │ HTTP/REST           │ SSE
                    ┌────────────▼─────────────────────▼──────────┐
                    │           Express.js Backend                │
                    │                                             │
                    │  ┌─────────┐  ┌────────────┐  ┌─────────┐  │
                    │  │ Routes  │──│Controllers  │──│Services │  │
                    │  └─────────┘  └────────────┘  └────┬────┘  │
                    │                                    │        │
                    │  ┌──────────────┐  ┌───────────────▼─────┐  │
                    │  │  Middleware   │  │   Models (Git-like) │  │
                    │  │ JWT │ Error │  │  │ Blob │ Tree │ Commit│  │
                    │  │  Validate   │  │  │      Lock          │  │
                    │  └──────────────┘  └───────────────┬─────┘  │
                    └────────────────────────────────────┼────────┘
                                                        │
                    ┌───────────────────────────────────▼─────────┐
                    │         File System Storage Engine           │
                    │                                              │
                    │  storage/                                    │
                    │  ├── repos/          # Repository metadata   │
                    │  │   └── <repo>/     # Branch refs & index   │
                    │  ├── objects/        # SHA-256 hashed blobs  │
                    │  ├── locks/          # File lock records     │
                    │  ├── builds/         # Build logs & artifacts│
                    │  ├── environments/   # Env configurations    │
                    │  ├── pull-requests/  # PR metadata           │
                    │  └── .mutex          # Global mutex file     │
                    └─────────────────────────────────────────────┘
```

### How It Works

**Git-like Object Model** — Files are saved as content-addressed objects. Raw file contents are SHA-256 hashed and written to disk as **blobs**. Directories are stored as **trees** mapping filenames to blob hashes. **Commits** record metadata (author, message, timestamp, parent) alongside a pointer to the root tree hash.

**Build Pipeline** — When builds are triggered, the system detects the project type (Maven/Gradle/Python) and spawns a child process. stdout/stderr are captured line-by-line and streamed to the frontend in real-time via SSE.

**Exclusive Checkout** — Binary and critical files use an exclusive locking mechanism. Lock records contain a unique `lockId`, timestamp, and TTL expiration. Concurrent operations are serialized through file-system directory mutex locks.

---

## 📋 Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | ≥ 18.0.0 | Backend & frontend runtime |
| npm | ≥ 9.0.0 | Package management |
| Java (optional) | ≥ 11 | Java build pipeline (Maven/Gradle) |
| Python (optional) | ≥ 3.8 | Python build pipeline (pytest) |
| Docker (optional) | Latest | Containerized deployment |

---

## ⚙️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/VRel.git
cd VRel
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory (or copy from `.env.example`):

```env
# Server
PORT=3000
NODE_ENV=development

# JWT — generate a secure secret:
#   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=replace-with-a-long-random-secret

# CORS — frontend dev server origin
CORS_ORIGIN=http://localhost:5173
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

### 4. Run the Application

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

### 5. Open in Browser

| Service | URL |
|---------|-----|
| Frontend UI | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| Health Check | http://localhost:3000/health |

### 6. Default Login Credentials

| Username | Password | Role |
|----------|----------|------|
| prabhaharan | admin123 | Admin |
| friend | dev123 | Developer |
| admin | admin123 | Admin |

---

## 🐳 Docker Deployment

Build and run the entire stack with a single command:

```bash
docker-compose up --build
```

| Service | URL |
|---------|-----|
| Frontend UI | http://localhost:5174 |
| Backend API | http://localhost:3000 |

To stop:
```bash
docker-compose down
```

---

## 🗂️ Project Structure

```
VRel/
├── backend/
│   ├── src/
│   │   ├── controllers/       # HTTP request handlers
│   │   │   ├── activity.controller.js
│   │   │   ├── branch.controller.js
│   │   │   ├── build.controller.js
│   │   │   ├── checkout.controller.js
│   │   │   ├── environment.controller.js
│   │   │   ├── pullRequest.controller.js
│   │   │   ├── repo.controller.js
│   │   │   └── tree.controller.js
│   │   ├── middleware/        # Express middleware
│   │   │   ├── auth.middleware.js       # JWT verification
│   │   │   ├── error.middleware.js      # Global error handler
│   │   │   └── validate.middleware.js   # Request validation
│   │   ├── models/            # Git object model implementations
│   │   │   ├── blob.model.js           # Content-addressable file storage
│   │   │   ├── commit.model.js         # Commit objects with tree refs
│   │   │   ├── lock.model.js           # File locking mechanism
│   │   │   └── tree.model.js           # Directory tree structures
│   │   ├── routes/            # Express route definitions
│   │   │   ├── activity.routes.js
│   │   │   ├── auth.routes.js
│   │   │   ├── branch.routes.js
│   │   │   ├── build.routes.js
│   │   │   ├── checkout.routes.js
│   │   │   ├── environment.routes.js
│   │   │   ├── pullRequest.routes.js
│   │   │   ├── repo.routes.js
│   │   │   └── tree.routes.js
│   │   ├── services/          # Business logic layer
│   │   │   ├── activity.service.js
│   │   │   ├── branch.service.js
│   │   │   ├── buildStore.service.js
│   │   │   ├── environment.service.js
│   │   │   ├── javaBuild.service.js
│   │   │   ├── lock.service.js
│   │   │   ├── merge.service.js
│   │   │   ├── objectStore.service.js   # Core content-addressable store
│   │   │   ├── pullRequest.service.js
│   │   │   ├── pythonBuild.service.js
│   │   │   ├── repoMeta.service.js
│   │   │   └── tree.service.js
│   │   ├── utils/             # Utility modules
│   │   │   ├── hash.util.js            # SHA-256 hashing
│   │   │   ├── integrationCheck.js     # Startup health checks
│   │   │   ├── mutex.util.js           # File-system mutex
│   │   │   ├── seedWorkspace.js        # Initial data seeding
│   │   │   └── sse.util.js             # Server-Sent Events helper
│   │   └── app.js             # Express application entry point
│   ├── storage/               # Runtime data (git-ignored)
│   ├── Dockerfile
│   ├── nodemon.json
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js      # Axios client with JWT interceptors
│   │   ├── components/
│   │   │   ├── BuildLog.jsx
│   │   │   ├── CommitHistory.jsx
│   │   │   └── FileLockBadge.jsx
│   │   ├── pages/
│   │   │   ├── BranchPage.jsx
│   │   │   ├── BuildPage.jsx
│   │   │   ├── CheckoutPage.jsx
│   │   │   ├── EnvironmentsPage.jsx
│   │   │   ├── FileBrowserPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── PullRequestsPage.jsx
│   │   │   ├── PushPullPage.jsx
│   │   │   └── RepoPage.jsx
│   │   ├── App.jsx            # Root component with routing
│   │   ├── index.css
│   │   └── main.jsx           # React entry point
│   ├── Dockerfile
│   ├── nginx.conf             # Production Nginx configuration
│   ├── vite.config.js
│   └── package.json
├── tests/                     # Integration & E2E test suites
│   ├── repo.test.js
│   ├── branch.test.js
│   ├── build.test.js
│   ├── lock.test.js
│   ├── environment.test.js
│   ├── tree.test.js
│   ├── activity-pr.test.js
│   ├── e2e.test.js
│   ├── helpers.js
│   └── run-all-tests.js
├── docker-compose.yml         # Multi-container deployment
├── API_DOCS.md                # Comprehensive API documentation
├── CHANGELOG.md               # 60-day development log
├── PROJECT_COMPLETE.md        # Project completion summary
├── demo.sh                    # cURL demo script
├── .gitignore
├── .env.example               # Environment variable template
└── README.md
```

---

## 📡 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Login and receive JWT |
| `POST` | `/api/auth/verify` | Verify token validity |

### Repository Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/repos` | List all repositories |
| `POST` | `/api/repos/:repo/init` | Initialize a new repository |
| `POST` | `/api/repos/:repo/add` | Stage a file |
| `POST` | `/api/repos/:repo/commit` | Create a commit |
| `GET` | `/api/repos/:repo/log` | View commit history |
| `GET` | `/api/repos/:repo/status` | Get staging area status |
| `GET` | `/api/repos/:repo/objects/:hash` | Retrieve content-addressed object |

### Branch Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/repos/:repo/branches` | List all branches |
| `POST` | `/api/repos/:repo/branches` | Create a new branch |
| `POST` | `/api/repos/:repo/branches/switch` | Switch active branch |
| `POST` | `/api/repos/:repo/branches/merge` | Merge a branch |
| `DELETE` | `/api/repos/:repo/branches` | Delete a branch |
| `GET` | `/api/repos/:repo/branches/merge-status` | Check merge compatibility |

### Pull Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/repos/:repo/pulls` | List all pull requests |
| `POST` | `/api/repos/:repo/pulls` | Create a pull request |
| `GET` | `/api/repos/:repo/pulls/:id` | Get PR details |
| `PATCH` | `/api/repos/:repo/pulls/:id` | Update PR status |
| `POST` | `/api/repos/:repo/pulls/:id/merge` | Merge a pull request |

### Build Pipeline
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/repos/:repo/builds/trigger` | Trigger build (SSE stream) |
| `GET` | `/api/repos/:repo/builds` | List build history |
| `GET` | `/api/repos/:repo/builds/:id` | Get build details |
| `POST` | `/api/repos/:repo/builds/seed` | Seed Maven workspace |
| `POST` | `/api/repos/:repo/builds/seed-python` | Seed Python workspace |
| `POST` | `/api/repos/:repo/builds/recover` | Recover stuck builds |

### File Locking (Exclusive Checkout)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/repos/:repo/locks` | Acquire file lock |
| `DELETE` | `/api/repos/:repo/locks` | Release file lock |
| `GET` | `/api/repos/:repo/locks` | List active locks |
| `GET` | `/api/repos/:repo/locks/file` | Check file lock status |
| `DELETE` | `/api/repos/:repo/locks/force` | Force release (admin) |
| `POST` | `/api/repos/:repo/locks/clean` | Clean expired locks |

### File Browser
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/repos/:repo/tree` | Get root directory listing |
| `GET` | `/api/repos/:repo/tree/:path` | Get subdirectory listing |
| `GET` | `/api/repos/:repo/blob/:path` | Get file content |

### Environments
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/repos/:repo/environments` | List environments |
| `POST` | `/api/repos/:repo/environments` | Create environment |
| `GET` | `/api/repos/:repo/environments/:name` | Get environment config |
| `PATCH` | `/api/repos/:repo/environments/:name` | Update environment |
| `DELETE` | `/api/repos/:repo/environments/:name` | Delete environment |

### Activity & Push/Pull
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/repos/:repo/activity` | Get activity log |
| `POST` | `/api/repos/:repo/push` | Push to branch |
| `POST` | `/api/repos/:repo/pull` | Pull from branch |

> 📖 For detailed request/response schemas, see [API_DOCS.md](./API_DOCS.md)

---

## 🧪 Running Tests

```bash
# Run all tests (backend must be running)
cd backend
npm test

# Run integration checks
npm run test:integration
```

The test suite covers repositories, branches, builds, locks, environments, trees, activity, pull requests, and full E2E workflows.

---

## 🔧 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Backend server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `JWT_SECRET` | **Yes** | — | Secret key for JWT signing (use a long random string) |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed frontend origin for CORS |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

---

<p align="center">
  Built with ❤️ using Node.js, React, and pure file-system magic
</p>
