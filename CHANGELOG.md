# Changelog

## Week 3 (Days 15–21) — Integration & Polish
- Added JWT authentication with protected routes
- Added global error middleware with stack traces in dev mode
- Added input validation middleware across all routes
- Fixed race conditions with file-based mutex (mutex.util.js)
- Fixed merge edge cases: self-merge, already-merged, empty branch
- Added stuck build recovery on server startup
- Added 56-test suite covering all modules
- Added concurrent lock stress test (5 simultaneous lock attempts)
- Added API documentation and demo script

## Week 2 (Days 8–14) — Build Pipelines + Locking
- Java build pipeline: Maven/Gradle detection, subprocess spawn, SSE streaming
- Python build pipeline: virtualenv + pip + pytest, sequential steps
- Build history persistence to disk
- Exclusive file checkout: lock tokens, expiry, force release, auto-cleanup
- BuildPage and CheckoutPage frontend components

## Week 1 (Days 1–7) — Core Foundation
- Git-like object model: blob, tree, commit with SHA-1 hashing
- File-system loose object store
- init, add, commit, log, status API endpoints
- HEAD pointer, index (staging area), branch tips
- Branching engine: create, switch, fast-forward merge, conflict detection
- Full dark GitHub-like UI with 6 tabs
