# CivicAI – AI-Powered Workforce Intelligence & Recruiter Platform

An advanced, full-stack Workforce Intelligence platform combining **Classical Machine Learning (Multiple Linear Regression, Logistic Regression, Random Forest, K-Means)**, **Generative AI (Gemini 2.5/Flash)**, and a **Recruiter Management System** built with **Vanilla TypeScript**, **Tailwind CSS**, **Node.js/Express**, and **Python + SQLite**.

---

## 🌟 Key Features

### 1. 👥 Multi-Role Authentication & User Workspace
- **Role-Based Access Control (RBAC)**: Support for **Candidate** and **Recruiter** accounts.
- **Candidate Hub**:
  - Profile management, resume upload, live career readiness score, and skill gaps radar.
  - Interactive multi-step workforce census.
  - Real-time notification center tracking profile activations and recruiter actions.
  - Timestamp recording in **Indian Standard Time (IST)** (`YYYY-MM-DD HH:MM:SS`).
- **Recruiter Hub**:
  - Searchable and filterable candidate talent pool with multi-criteria filtering (role, minimum experience, education, minimum career score, cluster segment, relocation, etc.).
  - Candidate deep-dive modal featuring skill radar distributions, career history, and compensation predictions.
  - Interactive candidate management (status tagging, candidate deletion, shortlisted talent view).

### 2. 🧠 Unified Machine Learning Pipeline (`ml_db.py`)
All machine learning model training, dataset generation, inference, and persistence are consolidated into a **single, unified server-side Python module (`ml_db.py`)**:

- **Dataset Synthesizer**: Generates and manages realistic demographic workforce data (850+ records) based on Indian tech industry salary bands (INR), experience curves, and skill matrices across major tech hubs (Bengaluru, Hyderabad, Pune, Mumbai, Delhi NCR, etc.).
- **Multiple Linear Regression (Expected Salary in INR LPA)**:
  - Solves the closed-form **Normal Equation** with Ridge $L_2$ regularization: $\mathbf{w} = (\mathbf{X}^T \mathbf{X} + \lambda \mathbf{I})^{-1} \mathbf{X}^T \mathbf{y}$.
  - Features: Experience, education tier, Python, Java, SQL, Web Dev, ML, Problem Solving, Communication.
  - Metrics: $R^2 \approx 0.988$, $\text{RMSE} \approx ₹45,745$, $\text{MAE} \approx ₹35,997$.
- **Binary Logistic Regression (Employability Classifier)**:
  - Sigmoid cross-entropy gradient descent over 280 epochs predicting binary job readiness ($p \ge 0.5 \implies \text{Employable}$).
  - Live Out-of-Sample Confusion Matrix ($TP, FP, TN, FN$), Accuracy ($\approx 95.9\%$), Precision ($\approx 97.1\%$), Recall ($\approx 97.8\%$), $F_1$-Score ($\approx 97.4\%$).
- **Random Forest Ensemble (Career Readiness Score)**:
  - 12-tree bagging ensemble with randomized feature sub-sampling ($m = 5$) and variance reduction splits.
  - Computes global Gini feature importance rankings (Experience $\approx 30.0\%$, Tech Skills $\approx 28.8\%$, Soft Skills $\approx 13.5\%$, Problem Solving $\approx 5.9\%$).
- **Unsupervised K-Means Clustering (Workforce Demographics)**:
  - Lloyd's spatial convergence algorithm ($k=3$) grouping candidates into **Freshers**, **Skilled Professionals**, and **Career Changers**.
  - Evaluates spatial cluster cohesion using **Silhouette Score** ($\approx 0.60$–$0.82$).

### 3. 📊 Interactive Talent Analytics Dashboard
- **Salary Projections vs. Experience**: Interactive Plotly scatter plot with linear regression trendlines.
- **Cluster Distributions**: Demographic bar charts and talent segment breakdowns.
- **Skills Competency Heatmap**: Visual matrix comparing candidate technical vs. soft skill proficiencies.
- **Dynamic Model Benchmarks**: Live comparison matrix displaying Accuracy, Precision, Recall, $F_1$-Score, and algorithmic trade-offs for all 4 ML models.

### 4. 🤖 AI-Powered Recruiter Suitability Analysis (Gemini Integration)
- Evaluates candidate fit against custom target job descriptions or preset industry roles.
- Generates a structured breakdown with **Percentage Match Score**, **Strengths**, **Critical Skill Gaps**, and an **Actionable Upskilling Roadmap**.

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (SPA)                        │
│   Vanilla TypeScript + Tailwind CSS + Plotly.js Charts   │
│   (Home, Census Form, Recruiter Hub, Talent Analytics)   │
└────────────────────────────┬─────────────────────────────┘
                             │ REST API (JSON)
┌────────────────────────────▼─────────────────────────────┐
│                 Node.js / Express Server                 │
│                      (server.ts)                         │
│  - Serves static SPA bundle                              │
│  - Routes: /api/candidates, /api/auth, /api/ml/metrics   │
│  - Proxies Gemini LLM requests via @google/genai         │
│  - Bridges Python CLI actions (JSON stdio)               │
└──────────────┬─────────────────────────────┬─────────────┘
               │ Python CLI                  │ Gemini SDK
┌──────────────▼─────────────┐ ┌─────────────▼─────────────┐
│   ML & Database Engine     │ │   Google Gemini 2.5 API   │
│        (ml_db.py)          │ │ (Role Suitability Analysis│
│  - SQLite3 (candidates.db) │ │  & Upskilling Roadmaps)   │
│  - Classical ML Models     │ └───────────────────────────┘
│  - IST Timestamp Handler   │
└────────────────────────────┘
```

---

## 🗄️ Database Architecture (`candidates.db`)

The SQLite database (`candidates.db`) is managed via `ml_db.py` with the following key tables:

### 1. `users` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT PRIMARY KEY` | Unique user ID (`user-xxxxxx`) |
| `email` | `TEXT UNIQUE` | User login email |
| `password` | `TEXT` | Plain/hashed credentials |
| `role` | `TEXT` | Account role (`candidate` or `recruiter`) |
| `created_at` | `TEXT` | **IST Timestamp** (`YYYY-MM-DD HH:MM:SS`) |

### 2. `candidates` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT PRIMARY KEY` | Candidate ID (`cand-xxx`) |
| `user_id` | `TEXT` | Foreign key referencing `users.id` |
| `name`, `email`, `age`, `gender` | `TEXT / INT` | Personal demographic information |
| `city`, `state` | `TEXT` | Geographic location in India |
| `education`, `experience` | `TEXT / REAL` | Academic degree & years of experience |
| `current_role`, `preferred_role` | `TEXT` | Career designation & target role |
| `expected_salary` | `INTEGER` | Expected compensation in INR |
| `preferred_work_mode` | `TEXT` | Remote, Hybrid, or On-Site |
| `skills_json` | `TEXT` | 10 technical & soft skill ratings (1 to 5) |
| `career_score` | `INTEGER` | ML-predicted Career Score (30–100) |
| `employability_status` | `TEXT` | `Employable` or `Needs Upskilling` |
| `predicted_salary` | `INTEGER` | Linear Regression predicted salary (INR) |
| `cluster` | `TEXT` | K-Means cluster assignment |
| `suitabilityHistory_json` | `TEXT` | Stored Gemini role suitability evaluations |

### 3. `recruiters` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT PRIMARY KEY` | Recruiter profile ID (`rec-xxx`) |
| `user_id` | `TEXT` | Foreign key referencing `users.id` |
| `company_name` | `TEXT` | Employer / organization name |
| `designation` | `TEXT` | Job title (e.g., Talent Lead, HR Manager) |

### 4. `notifications` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT PRIMARY KEY` | Notification ID (`ntf-xxxxxx`) |
| `user_id` | `TEXT` | Recipient user ID |
| `title`, `message`, `type` | `TEXT` | Notification header, body, and category |
| `is_read` | `INTEGER` | Read flag (0 = unread, 1 = read) |
| `created_at` | `TEXT` | **IST Timestamp** (`YYYY-MM-DD HH:MM:SS`) |

---

## 🔬 Mathematical ML Models Summary

| Algorithm | Type | Target Output | Key Equations / Techniques | Performance |
| :--- | :--- | :--- | :--- | :--- |
| **Multiple Linear Regression** | Supervised Regression | Expected Salary (INR) | Normal Equation: $\mathbf{w} = (\mathbf{X}^T \mathbf{X} + \lambda \mathbf{I})^{-1} \mathbf{X}^T \mathbf{y}$ | $R^2 = 0.988$<br>$\text{Accuracy} = 97.1\%$ |
| **Binary Logistic Regression** | Supervised Classification | Employability (`Employable` / `Needs Upskilling`) | Sigmoid: $\sigma(z) = \frac{1}{1 + e^{-z}}$<br>Loss: Binary Cross-Entropy | $\text{Accuracy} = 95.9\%$<br>$F_1\text{-Score} = 97.4\%$ |
| **Random Forest** | Supervised Ensemble | Career Readiness Score (30–100) | 12 Decision Trees with Bagging & feature sub-sampling | $\text{Accuracy} = 97.1\%$<br>$F_1\text{-Score} = 96.5\%$ |
| **K-Means Clustering** | Unsupervised Partitioning | 3 Demographic Clusters | Lloyd's Algorithm: $\min \sum \|\mathbf{x} - \boldsymbol{\mu}_i\|^2$<br>Silhouette Cohesion Metric | $\text{Accuracy} = 85.0\%$<br>$\text{Silhouette} = 0.60\text{--}0.82$ |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18.0.0 or higher)
- **Python 3** (Standard library with `sqlite3`, `math`, `random`, `json`, `datetime`)
- **Google Gemini API Key** (for AI suitability analysis)

### Installation & Setup

1. **Clone the repository and install dependencies**:
   ```bash
   git clone <repository-url>
   cd civicai
   npm install
   ```

2. **Set up Environment Variables**:
   Create a `.env` file in the project root:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   The application will be accessible at:
   ```
   http://localhost:3000
   ```

4. **Production Build & Execution**:
   ```bash
   npm run build
   node server.ts
   ```

---

## 📁 Project Directory Structure

```
civicai/
├── data/
│   ├── trained_models.json       # Cached ML model weights & benchmark metrics
│   └── workforce_dataset.json    # 850-record training dataset
├── src/
│   ├── components/
│   │   ├── AuthView.ts           # Login / Register modals & auth flows
│   │   └── CandidateDashboard.ts # Candidate profile, resume & readiness view
│   ├── data/
│   │   ├── avatars.ts            # Dynamic avatar generation
│   │   ├── mlAlgorithms.ts       # Client-side ML evaluation & NLP tokenization
│   │   └── mlTrainingEngine.ts   # Bridge for live ML metrics & model benchmarks
│   ├── index.css                 # Tailwind CSS styles & custom animations
│   ├── main.ts                   # Main SPA controller (Census, Recruiter Hub, Analytics)
│   └── types.ts                  # Full TypeScript interface definitions
├── candidates.db                 # SQLite database for users, candidates, notifications
├── ml_db.py                      # Unified Python ML training, inference, and DB engine
├── server.ts                     # Express.js REST server & Gemini API integration
├── package.json                  # Dependencies and build scripts
└── README.md                     # Project documentation
```

---

## 🔐 Default Credentials for Testing

| Role | Email | Password | Features Accessible |
| :--- | :--- | :--- | :--- |
| **Recruiter** | `recruiter@civicai.com` | `recruiter123` | Recruiter Hub, Candidate Search/Filter, AI Suitability Scoring, Candidate Management |
| **Candidate** | `hr@gmail.com` | `hr123` | Candidate Profile Dashboard, Resume Upload, Skills Radar, Notifications |
