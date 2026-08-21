import { Candidate, ModelBenchmark } from '../types';
import { getCurrentMLReport } from '../../MLTrainingEngine';

// ==========================================
// 1. NLP Text Intelligence Engine (Lexicon-Based)

// ==========================================

const STOPWORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
  'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself',
  'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom',
  'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an',
  'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at',
  'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
  'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
  'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'want', 'hope', 'aim'
]);

const POSITIVE_TRIGGERS = [
  'passion', 'passionate', 'grow', 'growth', 'excel', 'strive', 'improve', 'leadership',
  'build', 'create', 'impact', 'dream', 'scalable', 'robust', 'optimization', 'expert',
  'solving', 'eager', 'forward', 'contribution', 'innovate', 'innovation', 'love'
];

const MIXED_TRIGGERS = [
  'transitioning', 'shift', 'change', 'struggle', 'challenge', 'although', 'alternative',
  'bootcamp', 'self-teaching', 'retrain', 'pivoting', 'difficult'
];

export function analyzeNLPGoal(text: string): {
  sentiment: 'Positive' | 'Neutral' | 'Mixed';
  keywords: string[];
} {
  if (!text || text.trim().length === 0) {
    return { sentiment: 'Neutral', keywords: [] };
  }

  const cleaned = text.toLowerCase().replace(/[^a-zA-Z\s]/g, '');
  const words = cleaned.split(/\s+/).filter(w => w.length > 2);

  // Keyword extraction (excluding stopwords + finding candidate-relevant nouns)
  const freqMap: { [word: string]: number } = {};
  words.forEach(w => {
    if (!STOPWORDS.has(w)) {
      freqMap[w] = (freqMap[w] || 0) + 1;
    }
  });

  // Sort and pick top 5 keywords
  const sortedKeywords = Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => {
      return entry[0].charAt(0).toUpperCase() + entry[0].slice(1);
    });

  // Sentiment / Tone Analysis based on lexicon weights
  let score = 0;
  let mixedCount = 0;

  words.forEach(w => {
    if (POSITIVE_TRIGGERS.includes(w)) {
      score += 1.5;
    }
    if (MIXED_TRIGGERS.includes(w)) {
      mixedCount += 1;
    }
  });

  let sentiment: 'Positive' | 'Neutral' | 'Mixed' = 'Neutral';
  if (mixedCount >= 2) {
    sentiment = 'Mixed';
  } else if (score > 2.0) {
    sentiment = 'Positive';
  } else if (score > 0.5) {
    sentiment = 'Neutral';
  }

  return {
    sentiment,
    keywords: sortedKeywords.length > 0 ? sortedKeywords : ['Career', 'Growth', 'Opportunities']
  };
}

// ==========================================
// 2. Linear Regression (Salary Prediction in INR)
// ==========================================
// Formula: ExpectedSalary = Intercept + b1*Experience + b2*EducationCode + b3*TechSkillsAverage + b4*MLSkill
export function predictExpectedSalaryLinearRegression(cand: Partial<Candidate>): number {
  const intercept = 520000; // Base ₹5.2 Lakhs
  const experienceWeight = 62000; // ₹62,000 per year of experience
  
  let eduBonus = 0;
  const edu = cand.education || "Bachelor's";
  if (edu === "Master's") eduBonus = 120000;
  else if (edu === "PhD") eduBonus = 260000;
  else if (edu === "Bootcamp") eduBonus = -40000;

  // Skills impact
  const s = cand.skills || { python: 1, java: 1, sql: 1, webDevelopment: 1, machineLearning: 1 };
  const techAvg = (s.python + s.java + s.sql + s.webDevelopment + s.machineLearning) / 5;
  const techBonus = techAvg * 34000; // up to ₹1.7 Lakhs
  const mlBonus = s.machineLearning * 20000; // up to ₹1.0 Lakhs

  const rawPrediction = intercept + (cand.experience || 0) * experienceWeight + eduBonus + techBonus + mlBonus;
  
  // Cap inside realistic INR range (₹4.5L to ₹25L LPA)
  return Math.round(Math.max(450000, Math.min(2500000, rawPrediction)));
}

// ==========================================
// 3. Logistic Regression (Employability Binary Classification)
// ==========================================
export function predictEmployabilityLogisticRegression(cand: Partial<Candidate>): 'Employable' | 'Needs Upskilling' {
  const s = cand.skills || { python: 1, java: 1, sql: 1, webDevelopment: 1, machineLearning: 1, problemSolving: 1, communication: 1 };
  const exp = cand.experience || 0;

  const techAvg = (s.python + s.java + s.sql + s.webDevelopment + s.machineLearning) / 5;
  const softAvg = (s.problemSolving + s.communication) / 2;

  // Weights configuration
  const wIntercept = -3.2; // threshold bias
  const wExp = 0.45;
  const wTech = 0.6;
  const wSoft = 0.4;
  
  let wEdu = 0;
  const edu = cand.education || "Bachelor's";
  if (edu === "PhD") wEdu = 0.8;
  else if (edu === "Master's") wEdu = 0.4;
  else if (edu === "Bootcamp") wEdu = -0.2;

  const z = wIntercept + (exp * wExp) + (techAvg * wTech) + (softAvg * wSoft) + wEdu;
  const sigmoid = 1 / (1 + Math.exp(-z));

  return sigmoid >= 0.5 ? 'Employable' : 'Needs Upskilling';
}

// ==========================================
// 4. Random Forest (Career Success Score)
// ==========================================
// Operates on an ensemble of 5 Decision Trees, averaging their outputs
export function predictCareerScoreRandomForest(cand: Partial<Candidate>): number {
  const s = cand.skills || { python: 1, java: 1, sql: 1, webDevelopment: 1, machineLearning: 1, problemSolving: 1, communication: 1, leadership: 1 };
  const exp = cand.experience || 0;
  const edu = cand.education || "Bachelor's";

  const techAvg = (s.python + s.java + s.sql + s.webDevelopment + s.machineLearning) / 5;
  const softAvg = (s.problemSolving + s.communication + s.leadership) / 3;

  // Tree 1: Experience & Tech focus
  const tree1 = () => {
    if (exp >= 5) {
      return techAvg >= 4 ? 95 : 85;
    } else {
      return techAvg >= 3 ? 72 : 55;
    }
  };

  // Tree 2: Soft skills & Leadership focus
  const tree2 = () => {
    if (softAvg >= 4) {
      return s.leadership >= 4 ? 92 : 80;
    } else {
      return s.problemSolving >= 3 ? 68 : 50;
    }
  };

  // Tree 3: Education credentials focus
  const tree3 = () => {
    if (edu === 'PhD' || edu === "Master's") {
      return exp >= 2 ? 90 : 78;
    } else {
      return techAvg >= 4 ? 82 : 60;
    }
  };

  // Tree 4: Core Problem Solving & Python focus
  const tree4 = () => {
    if (s.problemSolving >= 4) {
      return s.python >= 4 ? 94 : 84;
    } else {
      return s.webDevelopment >= 3 ? 70 : 58;
    }
  };

  // Tree 5: Work Experience scaling
  const tree5 = () => {
    const base = 50;
    const addedExp = Math.min(exp, 10) * 4; // up to +40 points
    const addedTech = techAvg * 2; // up to +10 points
    return base + addedExp + addedTech;
  };

  const ensembleAverage = (tree1() + tree2() + tree3() + tree4() + tree5()) / 5;
  return Math.round(Math.max(30, Math.min(100, ensembleAverage)));
}

// ==========================================
// 5. Unsupervised K-Means Clustering
// ==========================================
// Assigns candidate to nearest pre-computed centroid (3 Clusters)
// Dimensions evaluated: [Experience, TechSkillAvg, SoftSkillAvg]
export function assignKMeansCluster(cand: Partial<Candidate>): 'Fresher' | 'Skilled Professional' | 'Career Changer' {
  const s = cand.skills || { python: 1, java: 1, sql: 1, webDevelopment: 1, machineLearning: 1, problemSolving: 1, communication: 1, leadership: 1 };
  const exp = cand.experience || 0;

  const techAvg = (s.python + s.java + s.sql + s.webDevelopment + s.machineLearning) / 5;
  const softAvg = (s.problemSolving + s.communication + s.leadership) / 3;

  // Define cluster centroids
  const centroids = {
    'Fresher': { exp: 0.5, tech: 1.8, soft: 3.1 },
    'Skilled Professional': { exp: 7.2, tech: 4.3, soft: 4.2 },
    'Career Changer': { exp: 4.2, tech: 2.2, soft: 3.6 }
  };

  const getDistance = (c: { exp: number, tech: number, soft: number }) => {
    return Math.sqrt(
      Math.pow(exp - c.exp, 2) +
      Math.pow(techAvg - c.tech, 2) +
      Math.pow(softAvg - c.soft, 2)
    );
  };

  const dFresher = getDistance(centroids['Fresher']);
  const dSkilled = getDistance(centroids['Skilled Professional']);
  const dCareer = getDistance(centroids['Career Changer']);

  const minDistance = Math.min(dFresher, dSkilled, dCareer);

  if (minDistance === dFresher) {
    return 'Fresher';
  } else if (minDistance === dSkilled) {
    return 'Skilled Professional';
  } else {
    return 'Career Changer';
  }
}

// ==========================================
// 6. Complete Candidate Analysis Runner
// ==========================================
export function analyzeCandidate(input: Partial<Candidate>): Candidate {
  const predictedSalary = predictExpectedSalaryLinearRegression(input);
  const employabilityStatus = predictEmployabilityLogisticRegression(input);
  const randomForestScore = predictCareerScoreRandomForest(input);
  const cluster = assignKMeansCluster(input);
  const nlpResults = analyzeNLPGoal(input.careerGoals || '');

  // Authoritatively use Random Forest for the candidate's career readiness score
  const careerScore = randomForestScore;

  return {
    id: input.id || `cand-${Math.floor(100 + Math.random() * 900)}`,
    name: input.name || 'Anonymous Candidate',
    email: input.email || 'anonymous@gmail.com',
    age: input.age || 24,
    gender: input.gender || 'Other',
    city: input.city || 'Bengaluru',
    state: input.state || 'KA',
    education: input.education || "Bachelor's",
    employmentStatus: input.employmentStatus || 'Unemployed',
    experience: input.experience ?? 0,
    currentRole: input.currentRole || 'Candidate',
    preferredRole: input.preferredRole || 'Full Stack Engineer',
    preferredIndustry: input.preferredIndustry || 'Technology',
    expectedSalary: input.expectedSalary || 900000,
    preferredWorkMode: input.preferredWorkMode || 'Remote',
    willingToRelocate: input.willingToRelocate ?? true,
    interestedInGovJobs: input.interestedInGovJobs ?? false,
    interestedInPrivateJobs: input.interestedInPrivateJobs ?? true,
    skills: {
      python: input.skills?.python ?? 3,
      java: input.skills?.java ?? 3,
      sql: input.skills?.sql ?? 3,
      webDevelopment: input.skills?.webDevelopment ?? 3,
      machineLearning: input.skills?.machineLearning ?? 3,
      communication: input.skills?.communication ?? 3,
      teamwork: input.skills?.teamwork ?? 3,
      leadership: input.skills?.leadership ?? 3,
      problemSolving: input.skills?.problemSolving ?? 3,
      englishProficiency: input.skills?.englishProficiency ?? 3,
    },
    careerGoals: input.careerGoals || 'I want to build highly functional applications and grow as a software professional.',
    careerScore,
    employabilityStatus,
    predictedSalary,
    cluster,
    nlpSentiment: nlpResults.sentiment,
    nlpKeywords: nlpResults.keywords,
    suitabilityHistory: input.suitabilityHistory || {}
  };
}

// ==========================================
// 7. Dynamic ML Model Metrics & Benchmarking
// ==========================================
export function getDynamicBenchmarks(): ModelBenchmark[] {
  return getCurrentMLReport().benchmarks;
}

export const MODEL_BENCHMARKS: ModelBenchmark[] = getCurrentMLReport().benchmarks;

