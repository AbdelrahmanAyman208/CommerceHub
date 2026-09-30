# CommerceHub — Deployment & Operational Guide

CommerceHub is an open-source, bilingual (Arabic RTL / English LTR) university learning and examination platform tailored for faculty members (statistics, accounting, business) and up to ~1,000 concurrent students.

---

## 1. System Requirements & Architecture

- **Operating System:** Linux (Ubuntu 22.04 LTS / Debian 12 recommended) or Windows / macOS with Docker Desktop.
- **Hardware Profile:**
  - **Dev Environment:** Low-spec machine (total dev memory budget ~960 MB).
  - **Production Target:** Single VPS or university server (12 GB RAM target, budgeted at ~3.5 GB peak).
- **Core Stack:**
  - Frontend: React 18 + Vite + react-i18next (Cairo / Inter fonts, native RTL support)
  - Backend: Node.js (Express) + PostgreSQL 16 + Redis 7
  - Queue & Schedulers: BullMQ + node-cron
  - Web Server & Reverse Proxy: Nginx (least-connected load balancing across API replicas, rate limiting, and view-only PDF streaming)

---

## 2. Key Business Rules & Enforcements

1. **8-Digit Numeric Student IDs:**
   - Automatically generated via PostgreSQL sequence `student_id_seq` starting at `10000001`.
   - All student IDs follow the uniform 8-digit numeric pattern.
2. **Pass Mark Rule (50% Standard):**
   - The pass mark is dynamically calculated as `total_marks * 0.5`.
   - Example: A 20-point exam requires at least 10.0 points to pass.
3. **Role Permission Boundaries:**
   - **`super_admin` (The Doctor):** Full system authority, course management, exam creation, and **sole authorization to modify or override student grades**.
   - **`admin` (Teaching Assistants):** Can upload lecture PDFs, create courses, build exams, and send announcements, but **cannot edit student grades** (strictly rejected by backend with `403 Forbidden`).
   - **`student`:** Enrolled course access, view-only PDF lectures, timed exam attempts, and transcript access.
4. **Anti-Screenshot & Academic Integrity Shield:**
   - Applied to **exam room** and **PDF viewer**:
     - Right-click context menu disabled.
     - Keyboard shortcuts blocked: PrintScreen, Ctrl+P, Ctrl+S, Ctrl+C, F12, Ctrl+Shift+I.
     - Window blur / tab switch protection: instantly applies a 25px blur filter and security overlay if focus is lost.
     - CSS print media query: `@media print { body { display: none !important; } }`.
     - Visual watermark: diagonal low-opacity stamp displaying student's name and 8-digit ID.

---

## 3. Quick Start (Development Mode)

The lightweight dev Docker Compose requires under 1 GB RAM:

```bash
# 1. Clone repository and navigate to root
cd commerce_hub

# 2. Verify .env file is present
cp .env.example .env

# 3. Start development stack
docker-compose -f docker-compose.dev.yml up --build
```

### Seed Accounts Created Automatically:
- **Doctor (Super Admin):** `admin@commercehub.edu` / `admin123`
- **Teaching Assistant:** `assistant@commercehub.edu` / `admin123`
- **Student 1:** `10000001` (or `student1@commercehub.edu`) / `student123`
- **Student 2:** `10000002` (or `student2@commercehub.edu`) / `student123`

Client URL: `http://localhost:5173`  
API Server: `http://localhost:3000`  
Health Check: `http://localhost:3000/health`

---

## 4. Production Deployment

For production deployment behind Nginx with 2 API replicas and connection pooling:

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

### Production Checklist:
- Set strong secrets in `.env`: `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (minimum 32 random characters).
- Configure domain name and Let's Encrypt SSL in Nginx (`/etc/letsencrypt`).
- Backup PostgreSQL volume `pgdata_prod` regularly via `pg_dump`.

---

## 5. Running Automated Tests & Load Testing

### Run Unit Tests:
```bash
cd server
npm test
```

### Run k6 Load Test:
```bash
k6 run k6/exam-load.js
```
