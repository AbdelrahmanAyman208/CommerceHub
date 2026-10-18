# CommerceHub (كلية التجارة — المنصة التعليمية)

A high-performance, bilingual (Arabic RTL / English LTR) learning management system and exam engine designed for faculty lecturers, assistants, and students with strict academic integrity shields and cross-device responsiveness.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Stack](https://img.shields.io/badge/stack-React_·_Node.js_·_PostgreSQL_·_Redis-indigo.svg)
![Integrity](https://img.shields.io/badge/security-Anti--Screenshot_Shield-emerald.svg)
![Responsive](https://img.shields.io/badge/devices-Mobile_·_Tablet_·_Desktop-teal.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)

---

## 🎮 Live Demo

> **Try the interactive live demo directly in your browser:**  
> ### 👉 [https://AbdelrahmanAyman208.github.io/CommerceHub/](https://AbdelrahmanAyman208.github.io/CommerceHub/)
>
> **Demo Credentials (Pre-loaded):**
> | Role | Email | Password | Permissions & Highlights |
> | :--- | :--- | :--- | :--- |
> | **Doctor (Super Admin)** | `admin@commercehub.edu` | `admin123` | Full dashboard, create courses, set custom passing grades, student analytics, override scores. |
> | **Teaching Assistant** | `assistant@commercehub.edu` | `admin123` | Manage lectures & PDFs, exam builder, question authoring, view results. |
> | **Student** | `student1@commercehub.edu` | `student123` | Enrolled courses, view-only PDFs, take timed exams with Academic Integrity Shield, instant grading. |
>
> *The demo runs entirely in the browser with an interactive mock layer and local storage persistence — no backend installation required.*

---

## 🌟 Key Features

### 1. 🎓 Academic & Exam Engine
- **Flexible Passing Grade Criteria:** Instructors can configure custom pass marks (e.g. 60%, 40%, custom point thresholds) per exam with real-time percentage badges rather than being restricted to a fixed 50%.
- **Question Authoring (Exam Builder):** Supports Multiple Choice (MCQ with 2, 3, or 4 options) and True/False questions with live points allocation tracking (`Allocated / Target Marks`).
- **Idempotent Submissions & 15-Second Grace Window:** Server-enforced timers with a 15-second grace window to absorb mobile network latency and connection jitter near expiration.
- **Asynchronous & Synchronous Grading:** BullMQ Redis-backed worker queue with immediate fallback grading for instantaneous feedback.
- **Fisher-Yates Randomization:** Independent randomization of questions and options order per attempt.

### 2. 🛡️ Academic Integrity Shield (Anti-Cheat)
- **Tolerant Window Blur Detection:** Evaluates tab switches and minimizing via `document.visibilitychange` with a 1.2-second debounce on window blur to eliminate false positives on form inputs and iframes.
- **Interactive Resume:** Instant click-to-resume modal so students are never blocked by accidental micro-blurs.
- **Screenshot & Print Deterrents:** Intercepts `PrintScreen`, `Ctrl/Cmd+P`, and `Ctrl/Cmd+S`.
- **Dynamic Security Watermarking:** Low-opacity, rotating diagonal watermark stamped with the student's name and ID.
- **View-Only Lecture Streamer:** Embedded PDF viewer with right-click and text-selection protection.

### 3. ⚡ Optimized Complexity & Performance
- **$O(1)$ Batch Autosave:** Batch upserts all debounced answers in a single parameterized multi-row SQL transaction, reducing database round-trips from $O(N)$ to $O(1)$ and cutting connection lock times by >90%.
- **$O(1)$ CSV Import Lookup:** Bulk student import checks email uniqueness in-memory using a pre-fetched `Set`, replacing $O(N)$ sequential database queries.
- **Code-Splitting & Small Footprint:** Rollup `manualChunks` divides the bundle into `vendor` (133 kB), `i18n` (87 kB), and `app` (572 kB), reducing initial gzipped download by >30% and speeding up mobile JavaScript parsing.

### 4. 📱 Multi-Device Responsive Design
- **Cross-Device Ready:** Optimized layouts for smartphones (iPhone, Android), tablets, iPads (portrait & landscape), and laptops.
- **iOS Safari Auto-Zoom Fix:** Enforced 16px minimum font size on mobile inputs to eliminate disruptive viewport zooming.
- **Touch-Friendly Hit Targets:** Standardized touch targets ($\ge 42\text{px}$) for thumb navigation.
- **Mobile Bottom Sheets:** Modals on small phones (< 480px) dock as bottom sheets with smooth scrolling.

### 5. 🌐 Bilingual & Theming
- **Instant Language Switching:** Seamless toggle between Arabic (Cairo font, native RTL layout) and English (Inter font, LTR layout).
- **Dark & Light Modes:** Sleek dark glassmorphism and clean light themes with persistent user preferences.

---

## 🏗️ Architecture

```
┌─────────────────────────────────┐
│     Client (React 18 + Vite)    │
│  i18next · CSS Tokens · Mock DB │
└────────────────┬────────────────┘
                 │ REST API / JSON
┌────────────────▼────────────────┐
│      Express.js API Server      │
│  JWT · Helmet · Zod Validation  │
└───────┬─────────────────┬───────┘
        │                 │
┌───────▼────────┐ ┌──────▼───────┐
│   PostgreSQL   │ │    Redis     │
│   (pgBouncer)  │ │   (BullMQ)   │
└────────────────┘ └──────────────┘
```

---

## 🚀 Getting Started

### Option A: Local Development (Fastest)

```bash
# 1. Clone repository
git clone https://github.com/AbdelrahmanAyman208/CommerceHub.git
cd CommerceHub

# 2. Run Client (Runs with interactive Mock Engine)
cd client
npm install
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

### Option B: Full Stack with Docker Compose

```bash
# Start backend, client, PostgreSQL, and Redis
docker compose -f docker-compose.dev.yml up --build
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:3000](http://localhost:3000)
- **Health Check:** [http://localhost:3000/health](http://localhost:3000/health)

---

## 📁 Repository Structure

```
commerce_hub/
├── client/                     # React 18 + Vite Frontend
│   ├── public/locales/         # Bilingual translation files (EN & AR)
│   ├── src/
│   │   ├── api/                # Axios instance + offline mock fallback
│   │   ├── components/         # Shields, Layout, Modals
│   │   ├── hooks/              # Anti-Screenshot & security hooks
│   │   ├── pages/
│   │   │   ├── admin/          # Dashboard, Exams, ExamBuilder, Courses, Students
│   │   │   └── student/        # MyCourses, MyExams, TakeExam, MyGrades
│   │   └── styles/             # Responsive design system & tokens
│   └── vite.config.js          # Code-splitting & proxy configuration
├── server/                     # Node.js + Express REST API
│   ├── src/
│   │   ├── db/migrations/      # SQL migrations (001_init, 002_add_pass_mark)
│   │   ├── middleware/         # Auth, RBAC, Zod validation
│   │   ├── routes/             # Exams, results, students, courses, auth
│   │   ├── schemas/            # Zod validation schemas
│   │   └── workers/            # BullMQ grading background worker
├── docker-compose.dev.yml      # Development Docker stack
└── docker-compose.prod.yml     # Production Docker stack with Nginx
```

---

## 📄 License

This project is licensed under the MIT License.
