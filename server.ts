import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { spawnSync } from "child_process";

// Import candidate seeding and helper algorithms
import { INITIAL_CANDIDATES } from "./src/data/initialCandidates";
import { analyzeCandidate, MODEL_BENCHMARKS } from "./src/data/mlAlgorithms";
import { Candidate, RoleSuitabilityResult } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client server-side (only initialized if key is provided)
let ai: GoogleGenAI | null = null;
const API_KEY =  process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || null;

if (API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'civicai-build',
        }
      }
    });
    console.log("Server-side Gemini AI Client initialized successfully.");
  } catch (error) {
    console.error("Error initializing Gemini AI Client:", error);
  }
} else {
  console.log("No GEMINI_API_KEY environment variable found. Falling back to rule-based evaluation.");
}

// Ensure database path exists
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "database.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Seed database.json on startup if missing or empty to guarantee local availability
if (!fs.existsSync(DB_FILE) || fs.readFileSync(DB_FILE, "utf-8").trim() === "" || fs.readFileSync(DB_FILE, "utf-8").trim() === "[]") {
  console.log("No seed database found or empty. Initializing data/database.json with default candidates...");
  fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_CANDIDATES, null, 2));
}

// Python SQLite Database & ML Engine Bridge Helpers
function runPythonCLI(args: string[]): string {
  let proc = spawnSync("python3", ["ml_db.py", ...args], { encoding: "utf-8" });
  if (proc.error && (proc.error as any).code === "ENOENT") {
    proc = spawnSync("python", ["ml_db.py", ...args], { encoding: "utf-8" });
  }
  if (proc.status !== 0) {
    throw new Error(proc.stderr || proc.error?.message || "Python process exited with error");
  }
  return proc.stdout;
}

function getCandidatesFromPython(): Candidate[] {
  try {
    const stdout = runPythonCLI(["get_all"]);
    return JSON.parse(stdout);
  } catch (e: any) {
    console.warn("Python database command failed or 'python3' is missing locally. Falling back to direct JSON storage reader.", e.message || e);
    if (fs.existsSync(DB_FILE)) {
      try {
        const fileContent = fs.readFileSync(DB_FILE, "utf-8");
        return JSON.parse(fileContent);
      } catch (jsonErr) {
        console.error("Failed to parse database.json backup:", jsonErr);
      }
    }
    return INITIAL_CANDIDATES;
  }
}

function insertCandidateFromPython(candData: any): Candidate {
  try {
    const stdout = runPythonCLI(["insert", JSON.stringify(candData)]);
    return JSON.parse(stdout);
  } catch (e: any) {
    console.warn("Python database command failed or 'python3' is missing locally. Falling back to JS-based candidate modeling and storage.", e.message || e);
    // Fully compatible JS-based analysis fallback from mlAlgorithms.ts
    const processed = analyzeCandidate(candData);
    
    let current: Candidate[] = [];
    if (fs.existsSync(DB_FILE)) {
      try {
        current = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      } catch (err) {}
    }
    
    const idx = current.findIndex(c => c.id === processed.id || c.email === processed.email);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...processed };
    } else {
      current.push(processed);
    }
    
    fs.writeFileSync(DB_FILE, JSON.stringify(current, null, 2));
    return processed;
  }
}

function deleteCandidateFromPython(id: string): any {
  try {
    const stdout = runPythonCLI(["delete", id]);
    return JSON.parse(stdout);
  } catch (e: any) {
    console.warn("Python database command failed or 'python3' is missing locally. Falling back to JS-based candidate removal.", e.message || e);
    let current: Candidate[] = [];
    if (fs.existsSync(DB_FILE)) {
      try {
        current = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      } catch (err) {}
    }
    const filtered = current.filter(c => c.id !== id);
    fs.writeFileSync(DB_FILE, JSON.stringify(filtered, null, 2));
    return { success: true };
  }
}

function saveSuitabilityFromPython(id: string, roleName: string, evalResult: any): void {
  try {
    runPythonCLI(["save_suitability", id, roleName, JSON.stringify(evalResult)]);
  } catch (e: any) {
    console.warn("Python database command failed or 'python3' is missing locally. Falling back to JS-based suitability history persistence.", e.message || e);
    if (fs.existsSync(DB_FILE)) {
      try {
        const fileContent = fs.readFileSync(DB_FILE, "utf-8");
        const candidates = JSON.parse(fileContent) as Candidate[];
        const index = candidates.findIndex(c => c.id === id);
        if (index !== -1) {
          if (!candidates[index].suitabilityHistory) {
            candidates[index].suitabilityHistory = {};
          }
          candidates[index].suitabilityHistory![roleName] = evalResult;
          fs.writeFileSync(DB_FILE, JSON.stringify(candidates, null, 2));
        }
      } catch (jsonErr) {
        console.error("Failed to update database.json directly:", jsonErr);
      }
    }
  }
}

function loginUserFromPython(email: string, password: string): any {
  try {
    const stdout = runPythonCLI(["login", email, password]);
    return JSON.parse(stdout);
  } catch (e: any) {
    console.error("Login through Python CLI failed:", e.message || e);
    return { success: false, error: "Authentication system is initializing. Please try again." };
  }
}

function signupUserFromPython(signupData: any): any {
  try {
    const stdout = runPythonCLI(["signup", JSON.stringify(signupData)]);
    return JSON.parse(stdout);
  } catch (e: any) {
    console.error("Signup through Python CLI failed:", e.message || e);
    return { success: false, error: "Authentication system is initializing. Please try again." };
  }
}

function getNotificationsFromPython(userId: string): any[] {
  try {
    const stdout = runPythonCLI(["get_notifications", userId]);
    return JSON.parse(stdout);
  } catch (e: any) {
    return [];
  }
}

function addNotificationFromPython(userId: string, title: string, message: string, type: string): any {
  try {
    const stdout = runPythonCLI(["add_notification", userId, title, message, type]);
    return JSON.parse(stdout);
  } catch (e: any) {
    return { success: false };
  }
}

function markNotificationReadFromPython(id: string): any {
  try {
    const stdout = runPythonCLI(["mark_notification_read", id]);
    return JSON.parse(stdout);
  } catch (e: any) {
    return { success: false };
  }
}

function getRoadmapFromPython(candId: string): any {
  try {
    const stdout = runPythonCLI(["get_roadmap", candId]);
    return JSON.parse(stdout);
  } catch (e: any) {
    return null;
  }
}

function saveRoadmapFromPython(candId: string, rData: any): any {
  try {
    const stdout = runPythonCLI(["save_roadmap", candId, JSON.stringify(rData)]);
    return JSON.parse(stdout);
  } catch (e: any) {
    return { success: false };
  }
}

function getResumeFromPython(candId: string): any {
  try {
    const stdout = runPythonCLI(["get_resume", candId]);
    return JSON.parse(stdout);
  } catch (e: any) {
    return null;
  }
}

function saveResumeFromPython(candId: string, filename: string, textContent: string, parsedData: any): any {
  try {
    const stdout = runPythonCLI(["save_resume", candId, filename, textContent, JSON.stringify(parsedData)]);
    return JSON.parse(stdout);
  } catch (e: any) {
    return { success: false };
  }
}

function getJobRecommendationsFromPython(candId: string): any[] {
  try {
    const stdout = runPythonCLI(["get_job_recommendations", candId]);
    return JSON.parse(stdout);
  } catch (e: any) {
    return [];
  }
}

function saveJobRecommendationFromPython(candId: string, jobRec: any): any {
  try {
    const stdout = runPythonCLI(["save_job_recommendation", candId, JSON.stringify(jobRec)]);
    return JSON.parse(stdout);
  } catch (e: any) {
    return { success: false };
  }
}

function getMLMetricsFromPython(): any {
  try {
    const stdout = runPythonCLI(["get_ml_metrics"]);
    return JSON.parse(stdout);
  } catch (e: any) {
    console.error("Failed to fetch ML metrics from Python CLI:", e);
    // Fallback to trained_models.json directly if exists
    try {
      const trainedPath = path.join(process.cwd(), "data", "trained_models.json");
      if (fs.existsSync(trainedPath)) {
        return JSON.parse(fs.readFileSync(trainedPath, "utf-8"));
      }
    } catch (_) {}
    return { error: "Failed to load ML metrics" };
  }
}

function retrainModelsFromPython(datasetSize: number = 850, trainSplit: number = 0.8, seed: number = 42): any {
  try {
    const stdout = runPythonCLI(["retrain_models", String(datasetSize), String(trainSplit), String(seed)]);
    return JSON.parse(stdout);
  } catch (e: any) {
    console.error("Failed to retrain models from Python CLI:", e);
    return { error: "Failed to retrain ML models" };
  }
}

function getDatasetSampleFromPython(limit: number = 20): any[] {
  try {
    const stdout = runPythonCLI(["get_dataset_sample", String(limit)]);
    return JSON.parse(stdout);
  } catch (e: any) {
    return [];
  }
}


// ==========================================
// API Endpoints
// ==========================================

// 1. Get all candidates
app.get("/api/candidates", (req: Request, res: Response) => {
  try {
    const candidates = getCandidatesFromPython();
    res.json(candidates);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Internal server error" });
  }
});

// 2. Get individual candidate
app.get("/api/candidates/:id", (req: Request, res: Response) => {
  try {
    const candidates = getCandidatesFromPython();
    const cand = candidates.find(c => c.id === req.params.id);
    if (!cand) {
      res.status(404).json({ error: "Candidate not found" });
      return;
    }
    res.json(cand);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Internal server error" });
  }
});

// 3. Register census candidate
app.post("/api/candidates", (req: Request, res: Response) => {
  try {
    const candidateInput = req.body;
    
    // Validate required fields
    if (!candidateInput.name || !candidateInput.email) {
      res.status(400).json({ error: "Name and Email are required fields." });
      return;
    }

    // Process and insert via Python SQLite & ML script
    const processedCandidate = insertCandidateFromPython(candidateInput);
    
    console.log(`Successfully registered candidate in Python SQLite: ${processedCandidate.name}`);
    res.status(201).json(processedCandidate);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to register candidate" });
  }
});

// 4. Delete candidate
app.delete("/api/candidates/:id", (req: Request, res: Response) => {
  try {
    const candidates = getCandidatesFromPython();
    const exists = candidates.some(c => c.id === req.params.id);
    if (!exists) {
      res.status(404).json({ error: "Candidate not found" });
      return;
    }

    deleteCandidateFromPython(req.params.id);
    res.json({ success: true, message: "Candidate removed successfully from Python SQLite database." });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Internal server error" });
  }
});

// 5. Get model benchmarks
app.get("/api/benchmarks", (req: Request, res: Response) => {
  res.json(MODEL_BENCHMARKS);
});

// 6. Recruiter Evaluate Suitability Endpoint (Gemini-Powered)
app.post("/api/recruiter/evaluate-suitability", async (req: Request, res: Response) => {
  try {
    const candidates = getCandidatesFromPython();
    const { candidateId, roleName, roleDescription } = req.body;

    if (!candidateId || !roleName) {
      res.status(400).json({ error: "Candidate ID and Role Name are required." });
      return;
    }

    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) {
      res.status(404).json({ error: "Candidate not found." });
      return;
    }

    let evaluationResult: RoleSuitabilityResult;

    // Use Gemini if initialized
    if (ai) {
      console.log(`Running live Gemini AI Suitability analysis for ${candidate.name} as a ${roleName}...`);
      const targetDesc = roleDescription || "Standard role matching candidate skills.";
      
      const prompt = `
        You are an expert technical recruiter. Analyze the following candidate and assess their suitability for the target job role.
        
        TARGET ROLE NAME: "${roleName}"
        TARGET ROLE DESCRIPTION: "${targetDesc}"
        
        CANDIDATE DETAILS:
        - Name: ${candidate.name}
        - Education: ${candidate.education}
        - Years of Experience: ${candidate.experience}
        - Current Role: ${candidate.currentRole}
        - Preferred Role: ${candidate.preferredRole}
        - Core Skills (rated 1 to 5):
          * Python: ${candidate.skills.python}
          * Java: ${candidate.skills.java}
          * SQL: ${candidate.skills.sql}
          * Web Development: ${candidate.skills.webDevelopment}
          * Machine Learning: ${candidate.skills.machineLearning}
          * Communication: ${candidate.skills.communication}
          * Teamwork: ${candidate.skills.teamwork}
          * Leadership: ${candidate.skills.leadership}
          * Problem Solving: ${candidate.skills.problemSolving}
          * English Proficiency: ${candidate.skills.englishProficiency}
        - Career Goals (NLP input): "${candidate.careerGoals}"
        
        Provide your assessment strictly in the JSON format requested. Be critical but constructive.
        The suitability score must be an integer between 0 and 100 based on how well their skills match the role.
        The verdict must be one of: "Strong Match", "Potential Match", "Skill Gap", "Not Suited".
        The "strengths" must be an array of 2-4 strings detailing concrete matching skills or background points.
        The "gaps" must be an array of 1-3 strings detailing concrete technical/soft skill areas missing or needing improvement.
        The "upskillingPlan" must be an array of 2-3 specific learning actions or courses to bridge those gaps.
        The "justification" is a friendly 2-3 sentence recruiter synthesis.
      `;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                roleName: { type: Type.STRING },
                score: { type: Type.INTEGER, description: "Suitability score out of 100" },
                verdict: { 
                  type: Type.STRING, 
                  enumValues: ["Strong Match", "Potential Match", "Skill Gap", "Not Suited"] 
                },
                strengths: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                gaps: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                upskillingPlan: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                justification: { type: Type.STRING }
              },
              required: ["roleName", "score", "verdict", "strengths", "gaps", "upskillingPlan", "justification"]
            }
          }
        });

        const rawText = response.text?.trim() || "";
        const parsed = JSON.parse(rawText);
        
        evaluationResult = {
          roleName: parsed.roleName || roleName,
          score: typeof parsed.score === 'number' ? parsed.score : 70,
          verdict: parsed.verdict || "Potential Match",
          strengths: parsed.strengths || [],
          gaps: parsed.gaps || [],
          upskillingPlan: parsed.upskillingPlan || [],
          justification: parsed.justification || "Candidate shows reasonable competence.",
          evaluatedAt: new Date().toISOString()
        };
      } catch (err) {
        console.error("Gemini query failed. Falling back to deterministic analysis:", err);
        evaluationResult = runDeterministicSuitability(candidate, roleName, roleDescription);
      }
    } else {
      // Fallback if no Gemini Key
      console.log("Gemini Client not available. Running high-fidelity rule-based suitability model.");
      evaluationResult = runDeterministicSuitability(candidate, roleName, roleDescription);
    }

    // Save the suitability history into candidate record in Python SQLite
    saveSuitabilityFromPython(candidate.id, roleName, evaluationResult);

    res.json(evaluationResult);
  } catch (e: any) {
    console.error("Error evaluating suitability:", e);
    res.status(500).json({ error: e.message || "Failed to analyze suitability." });
  }
});

// Deterministic rule-based backup algorithm
function runDeterministicSuitability(
  candidate: Candidate, 
  roleName: string, 
  roleDesc?: string
): RoleSuitabilityResult {
  const normalizedRole = roleName.toLowerCase();
  let matchScore = 50; // base score
  const strengths: string[] = [];
  const gaps: string[] = [];
  const upskillingPlan: string[] = [];

  // 1. Analyze suitability by role type
  if (normalizedRole.includes("machine learning") || normalizedRole.includes("ai") || normalizedRole.includes("data scientist")) {
    matchScore += (candidate.skills.python * 4) + (candidate.skills.machineLearning * 5) + (candidate.skills.sql * 2);
    matchScore += Math.min(candidate.experience * 3, 15);
    
    if (candidate.skills.machineLearning >= 4) {
      strengths.push(`Excellent Machine Learning proficiency (level ${candidate.skills.machineLearning}/5)`);
    } else {
      gaps.push("Needs deeper experience with advanced statistical models, Random Forests, and XGBoost.");
      upskillingPlan.push("Complete advanced course: 'Machine Learning with Scikit-Learn and Python'.");
    }
    
    if (candidate.skills.python >= 4) {
      strengths.push("Strong Python coding foundation for algorithm deployment.");
    } else {
      gaps.push("Python programming is below expectation for research-grade work.");
      upskillingPlan.push("Strengthen raw algorithms knowledge in Python.");
    }
  } else if (normalizedRole.includes("frontend") || normalizedRole.includes("web") || normalizedRole.includes("react")) {
    matchScore += (candidate.skills.webDevelopment * 6) + (candidate.skills.communication * 2) + (candidate.skills.teamwork * 2);
    matchScore += Math.min(candidate.experience * 2, 10);
    
    if (candidate.skills.webDevelopment >= 4) {
      strengths.push(`Highly skilled in frontend layout, design patterns, and responsive frameworks (level ${candidate.skills.webDevelopment}/5).`);
    } else {
      gaps.push("Requires wider familiarity with component-driven state architecture (Redux/Zustand).");
      upskillingPlan.push("Build 3 end-to-end projects implementing custom React state hooks.");
    }
  } else if (normalizedRole.includes("full stack") || normalizedRole.includes("software engineer")) {
    matchScore += (candidate.skills.webDevelopment * 3) + (candidate.skills.sql * 3) + (candidate.skills.java * 2) + (candidate.skills.python * 2);
    matchScore += Math.min(candidate.experience * 3, 15);
    
    if (candidate.skills.webDevelopment >= 3 && candidate.skills.sql >= 3) {
      strengths.push("Balanced competency in both client-side interfaces and relational query writing.");
    } else {
      gaps.push("Uneven technical strengths across database handling or modern REST design.");
      upskillingPlan.push("Review Full Stack Bootcamps covering express middleware and relational database design.");
    }
  } else if (normalizedRole.includes("product") || normalizedRole.includes("manager") || normalizedRole.includes("leadership")) {
    matchScore += (candidate.skills.leadership * 5) + (candidate.skills.communication * 4) + (candidate.skills.problemSolving * 2);
    matchScore += Math.min(candidate.experience * 2, 10);
    
    if (candidate.skills.leadership >= 4 && candidate.skills.communication >= 4) {
      strengths.push("Top-tier organizational management, cross-functional collaboration, and articulation strengths.");
    } else {
      gaps.push("Lacks the high leadership or communication metrics expected for executive orchestration.");
      upskillingPlan.push("Engage in Toastmasters speech development or Agile Project Management certifications.");
    }
  } else {
    // Default Role
    matchScore += (candidate.skills.problemSolving * 4) + (candidate.skills.communication * 3);
    matchScore += Math.min(candidate.experience * 2, 10);
  }

  // Cap matching score between 35 and 98
  matchScore = Math.round(Math.max(35, Math.min(98, matchScore)));

  let verdict: 'Strong Match' | 'Potential Match' | 'Skill Gap' | 'Not Suited' = 'Potential Match';
  if (matchScore >= 85) verdict = 'Strong Match';
  else if (matchScore >= 65) verdict = 'Potential Match';
  else if (matchScore >= 45) verdict = 'Skill Gap';
  else verdict = 'Not Suited';

  if (strengths.length === 0) strengths.push("Displays good general problem solving capabilities.");
  if (gaps.length === 0) gaps.push("Could acquire more production experience in specialized frameworks.");
  if (upskillingPlan.length === 0) upskillingPlan.push("Follow curated engineering tracks to align with trending industry stacks.");

  return {
    roleName,
    score: matchScore,
    verdict,
    strengths,
    gaps,
    upskillingPlan,
    justification: `Deterministic analysis suggests candidate ${candidate.name} is a ${verdict} for the ${roleName} role, displaying a technical evaluation score of ${matchScore}%.`,
    evaluatedAt: new Date().toISOString()
  };
}

// 7. Auth Signup
app.post("/api/auth/signup", (req: Request, res: Response) => {
  try {
    const result = signupUserFromPython(req.body);
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message || "Failed to process signup" });
  }
});

// 8. Auth Login
app.post("/api/auth/login", (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, error: "Email and password are required." });
      return;
    }
    const result = loginUserFromPython(email, password);
    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message || "Failed to process login" });
  }
});

// 9. Get user notifications
app.get("/api/notifications/:userId", (req: Request, res: Response) => {
  try {
    const result = getNotificationsFromPython(req.params.userId);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to retrieve notifications" });
  }
});

// 10. Mark notification read
app.post("/api/notifications/:id/read", (req: Request, res: Response) => {
  try {
    const result = markNotificationReadFromPython(req.params.id);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to mark notification as read" });
  }
});

// 11. Add manual notification
app.post("/api/notifications", (req: Request, res: Response) => {
  try {
    const { userId, title, message, type } = req.body;
    const result = addNotificationFromPython(userId, title, message, type || "info");
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to trigger notification" });
  }
});

// 12. Get learning roadmap
app.get("/api/roadmap/:candidateId", (req: Request, res: Response) => {
  try {
    const result = getRoadmapFromPython(req.params.candidateId);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to fetch roadmap" });
  }
});

// 13. Save learning roadmap
app.post("/api/roadmap/:candidateId", (req: Request, res: Response) => {
  try {
    const result = saveRoadmapFromPython(req.params.candidateId, req.body);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to update roadmap" });
  }
});

// 14. Get resume metadata
app.get("/api/resume/:candidateId", (req: Request, res: Response) => {
  try {
    const result = getResumeFromPython(req.params.candidateId);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to fetch resume" });
  }
});

// 15. Save resume metadata
app.post("/api/resume/:candidateId", (req: Request, res: Response) => {
  try {
    const { filename, textContent, parsedData } = req.body;
    const result = saveResumeFromPython(req.params.candidateId, filename, textContent, parsedData);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to save resume" });
  }
});

// 16. Get job recommendations
app.get("/api/job-recommendations/:candidateId", (req: Request, res: Response) => {
  try {
    const result = getJobRecommendationsFromPython(req.params.candidateId);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to fetch job recommendations" });
  }
});

// 17. Save job recommendation
app.post("/api/job-recommendations/:candidateId", (req: Request, res: Response) => {
  try {
    const result = saveJobRecommendationFromPython(req.params.candidateId, req.body);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to save job recommendation" });
  }
});

// 18. Get dynamic ML training metrics and benchmarks
app.get("/api/ml/metrics", (req: Request, res: Response) => {
  try {
    const result = getMLMetricsFromPython();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to retrieve ML metrics" });
  }
});

// 19. Retrain ML models on realistic large workforce dataset
app.post("/api/ml/retrain", (req: Request, res: Response) => {
  try {
    const { datasetSize, trainTestSplit, seed } = req.body || {};
    const size = datasetSize ? Number(datasetSize) : 850;
    const split = trainTestSplit ? Number(trainTestSplit) : 0.8;
    const randomSeed = seed ? Number(seed) : Math.floor(Math.random() * 10000);
    const result = retrainModelsFromPython(size, split, randomSeed);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to retrain ML models" });
  }
});

// 20. Get sample records from the large workforce training dataset
app.get("/api/ml/dataset", (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const result = getDatasetSampleFromPython(limit);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to fetch dataset sample" });
  }
});



// ==========================================
// Vite Dev Server / Static Ingress
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite dev server mounted as Express middleware.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server successfully initialized.`);
    console.log(`Local Access: http://localhost:${PORT}`);
    console.log(`Development Server is now listening...`);
  });
}

startServer();
