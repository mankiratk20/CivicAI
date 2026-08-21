export interface Candidate {
  id: string;
  name: string;
  email: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  city: string;
  state: string;
  education: string; // "Bachelor's", "Master's", "PhD", "Associate Degree", "Bootcamp"
  
  // Employment
  employmentStatus: 'Unemployed' | 'Employed' | 'Student' | 'Freelancer';
  experience: number; // in years
  currentRole: string;
  preferredRole: string;
  preferredIndustry: string;
  expectedSalary: number; // in USD per year
  preferredWorkMode: 'Remote' | 'Hybrid' | 'On-Site';
  willingToRelocate: boolean;
  interestedInGovJobs: boolean;
  interestedInPrivateJobs: boolean;

  // Skills (1-5 scale)
  skills: {
    python: number;
    java: number;
    sql: number;
    webDevelopment: number;
    machineLearning: number;
    communication: number;
    teamwork: number;
    leadership: number;
    problemSolving: number;
    englishProficiency: number;
  };

  // Open-Text goals
  careerGoals: string;

  // Applied job IDs list
  appliedJobs?: string[];

  // ML & Deep Learning Outputs
  careerScore: number;       // generated score out of 100
  employabilityStatus: 'Employable' | 'Needs Upskilling';
  predictedSalary: number;   // Linear Regression output
  cluster: 'Fresher' | 'Skilled Professional' | 'Career Changer'; // K-Means Clustering result
  nlpSentiment: 'Positive' | 'Neutral' | 'Mixed';
  nlpKeywords: string[];

  // Suitability analyses run by recruiter
  suitabilityHistory?: {
    [roleName: string]: RoleSuitabilityResult;
  };
}

export interface RoleSuitabilityResult {
  roleName: string;
  score: number; // 0 - 100
  verdict: 'Strong Match' | 'Potential Match' | 'Skill Gap' | 'Not Suited';
  strengths: string[];
  gaps: string[];
  upskillingPlan: string[];
  justification: string;
  evaluatedAt: string;
}

export interface ModelBenchmark {
  modelName: string;
  category: 'Classical ML' | 'Deep Learning';
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  description: string;
  pros: string;
  cons: string;
}

export interface ConfusionMatrix {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  weight: number;
}

export interface RegressionMetrics {
  modelName: string;
  category: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  r2Score: number;
  mae: number;
  rmse: number;
  weights: { [key: string]: number };
  description: string;
}

export interface ClassificationMetrics {
  modelName: string;
  category: string;
  accuracy: number;
  precision: number;
  recall: number;
  specificity?: number;
  f1Score: number;
  confusionMatrix?: ConfusionMatrix;
  weights?: number[];
  numTrees?: number;
  featureImportances?: FeatureImportance[];
  description: string;
}

export interface ClusterMetrics {
  modelName: string;
  category: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  silhouetteScore: number;
  wcss: number;
  clusterCounts: { [cluster: string]: number };
  centroids: { [cluster: string]: { experience: number; techAvg: number; softAvg: number; salaryMillion: number } };
  description: string;
}

export interface MLTrainingReport {
  timestamp: string;
  datasetSize: number;
  trainSize: number;
  testSize: number;
  trainTestSplitRatio: number;
  overallMetrics: {
    accuracy: number;
    f1Score: number;
    precision: number;
    recall: number;
  };
  models: {
    linearRegression: RegressionMetrics;
    logisticRegression: ClassificationMetrics;
    randomForest: ClassificationMetrics;
    kmeans: ClusterMetrics;
  };
  benchmarks: ModelBenchmark[];
}

export interface WorkforceDatasetRecord {
  id: string;
  name: string;
  email: string;
  age: number;
  gender: string;
  city: string;
  state: string;
  education: string;
  employmentStatus: string;
  experience: number;
  currentRole: string;
  preferredRole: string;
  preferredIndustry: string;
  expectedSalary: number;
  preferredWorkMode: string;
  willingToRelocate: boolean;
  interestedInGovJobs: boolean;
  interestedInPrivateJobs: boolean;
  skills: {
    python: number;
    java: number;
    sql: number;
    webDevelopment: number;
    machineLearning: number;
    communication: number;
    teamwork: number;
    leadership: number;
    problemSolving: number;
    englishProficiency: number;
  };
  careerGoals: string;
  careerScore: number;
  employabilityStatus: string;
  isEmployable: number;
  cluster: string;
}

export interface RecruiterFilter {
  searchQuery: string;
  minExperience: number;
  location: string;
  education: string;
  cluster: string;
  skills: string[]; // required skills list
  employability: string;
}
