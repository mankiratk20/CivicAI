<<<<<<< HEAD
# CivicAI
AI Powered Career Analytics and Recruiter Hub
=======
# CivicAI – AI-Powered Workforce Intelligence & Recruiter Hub
**Summer Training 2026 Project Submission**  
*An Advanced Full-Stack AI/ML Platform built with Vanilla TypeScript, Tailwind CSS, Express, Python, SQLite, and Gemini LLM integration.*

---

## 🚀 Project Overview

**CivicAI** is an advanced career intelligence census and recruiter workspace designed to solve matching, capability mapping, and upskilling roadmap planning for the modern workforce. 

Instead of showing workforce statistics publicly, the platform centers around a secure **Recruiter's Hub** where human resource teams can filter and search talent, coupled with an interactive **Workforce Census** that candidates can join to receive immediate deep learning capacity scoring.

### Key Objectives
1. **Gather High-Dimensional Data**: Implement a 20-question multi-step census tracking personal, educational, technical (Python, Java, SQL, Web, ML), and soft skills (Communication, Leadership, Problem Solving).
2. **Execute Multi-Model ML Pipeline**: Deploy classical and deep learning models to predict expected compensation (Linear Regression), job-readiness (Logistic Regression), talent grouping (Unsupervised K-Means), and overall capacity scoring (Random Forest vs. Deep Learning Multi-Layer Perceptron).
3. **Parse Goal Statements with NLP**: Analyze free-text aspirations to compute sentiment tone and extract core keywords.
4. **Interactive Gemini Suitability Analysis**: Empower recruiters to select standard roles or input custom target job descriptions, triggering real-time, server-side Gemini-3.5-Flash analysis for percentage suitability, gaps breakdown, and an upskilling roadmap.

---

## 🛠️ Technology Stack

### Frontend
- **Vanilla TypeScript (SPA)**: For building a highly modular, lightning-fast, and secure client-side interface without virtual DOM overhead.
- **Tailwind CSS v4**: High-contrast typography pairings (Inter, JetBrains Mono) with modern, utility-first layout architectures.
- **Plotly.js (via CDN)**: Interactive multi-colored scatter plots, clustering projections, and demographic analysis.

### Backend & Database
- **Express.js Server (Node.js)**: Custom REST services bound to port 3000, proxies requests to Gemini and coordinates with Python database CLI tools.
- **SQLite Database (`candidates.db`)**: Persistent database containing recruiter users, candidate profiles, suitability history, notifications, resumes, upskilling roadmaps, and recommendation logs.
- **Python CLI Database Bridge (`ml_db.py`)**: Handles ML model pipelines, SQLite database management, and authentication state verification.

### AI & Machine Learning Suite
- **Linear Regression**: Salary prediction modeled on experience, education, and specific tech scores.
- **Logistic Regression**: Employability status binary classifier using Sigmoid activation.
- **K-Means Clustering**: Euclidean distance calculation grouping candidates into 3 segment centroids:
  - *Fresher (Emerging Talent)*
  - *Skilled Professional*
  - *Career Changer*
- **Deep Learning MLP**: 3-layer backpropagation Neural Network using ReLU activations, mimicking forward-feed calculations to predict ultimate Career Scores.
- **NLP Text Parser**: Tokenizer filtering English stopwords, scoring sentiment tone, and building tag cloud frequencies.
- **Gemini-3.5-Flash Integration**: Server-side client utilizing the official `@google/genai` client, using structured response schema for secure candidate evaluation.

---

## 🗄️ Database Schema & File Structure

Our database tracks the following schema inside `/candidates.db`:

### `candidates` Table
- **id**: Primary Key (`TEXT`)
- **name**: Candidate Name (`TEXT`)
- **email**: Candidate Email (`TEXT`, Unique)
- **age**: Candidate Age (`INTEGER`)
- **gender**: Candidate Gender (`TEXT`)
- **city**: Candidate City (`TEXT`)
- **state**: Candidate State (`TEXT`)
- **education**: Qualification (`TEXT`)
- **employment_status**: Employment Status (`TEXT`)
- **experience**: Years of Experience (`INTEGER`)
- **current_role**: Current Role/Domain (`TEXT`)
- **preferred_role**: Preferred Role (`TEXT`)
- **expected_salary**: Expected Salary (`INTEGER`)
- **preferred_work_mode**: Remote / Hybrid / On-Site (`TEXT`)
- **skills**: Technical Skill Metrics (`TEXT` - JSON format)
- **soft_skills**: Soft Skill Metrics (`TEXT` - JSON format)
- **career_goals**: Text description of goals (`TEXT`)
- **career_score**: Random Forest / Analytical Capacity Score (`INTEGER`)
- **employability_status**: Employability category (`TEXT`)
- **predicted_salary**: Predicted compensation (`INTEGER`)
- **cluster**: Segment group (`TEXT`)
- **nlp_sentiment**: Goal statement sentiment (`TEXT`)
- **nlp_keywords**: Goal statement keywords (`TEXT` - JSON format)
- **user_id**: Owner user ID (`TEXT`)

### `users` Table
- **id**: Primary Key (`TEXT`)
- **email**: User Email (`TEXT`, Unique)
- **password_hash**: Hashed Password (`TEXT`)
- **role**: User Role (`TEXT` - recruiter / candidate)
- **company_name**: Company Name (`TEXT`, for recruiters)
- **designation**: Job Designation (`TEXT`, for recruiters)
- **created_at**: Account creation timestamp (`TEXT`)

### `notifications` Table
- **id**: Primary Key (`TEXT`)
- **user_id**: Receiver User ID (`TEXT`)
- **title**: Notification Header (`TEXT`)
- **message**: Notification Details (`TEXT`)
- **type**: Info / Success / Warning (`TEXT`)
- **is_read**: Unread/Read Flag (`INTEGER`)
- **created_at**: Timestamp (`TEXT`)

---

## 📝 Theoretical Model Definitions (Viva-Ready)

Keep these simple explanations in mind for your academic defense:

1. **Linear Regression (Expected Salary)**:
   - *Why*: Projects numeric output (salary).
   - *How*: Calculates weighted values for years of experience and skill scores plus fixed bonuses for degrees (e.g., $M.S. = +12k$, $PhD = +26k$).
2. **Logistic Regression (Employability)**:
   - *Why*: Binary classification (Employable vs. Needs Upskilling).
   - *How*: Normalizes technical and soft skill averages against experience, calculates a linear sum ($z$), and applies the Sigmoid function $1 / (1 + e^{-z})$. If the result is $\ge 0.5$, candidate is declared job-ready.
3. **K-Means Clustering (Workforce Segmentation)**:
   - *Why*: Groups unlabeled candidates into clusters (Emerging, Skilled, Career Changers).
   - *How*: Uses 3 predetermined multi-dimensional centroids (Experience, Tech Skills, Soft Skills). Calculates the Euclidean distance from the candidate to each centroid and assigns them to the closest one.
4. **Deep Learning Multi-Layer Perceptron (MLP)**:
   - *Why*: Captures complex, non-linear capability mappings.
   - *How*: Takes a 10-feature normalized vector. Passes through a 6-node Hidden Layer 1 (ReLU), then a 4-node Hidden Layer 2 (ReLU), and finally maps to a Sigmoid output representing the final 40-100 Career Score.

---

## 🏃 Setup & Local Execution

### Prerequisites
Make sure Node.js (v18+) is installed.

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environmental credentials:
   Create a `.env` file at root containing:
   ```env
   GEMINI_API_KEY="YOUR_ACTUAL_GEMINI_API_KEY"
   ```

### Execution
Run the full-stack development environment:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
>>>>>>> 75923f8 (Uploaded Project Files)
