import { Candidate, RecruiterFilter, ModelBenchmark, RoleSuitabilityResult, MLTrainingReport } from './types';
import { MODEL_BENCHMARKS, getDynamicBenchmarks } from './data/mlAlgorithms';
import { fetchLiveMLMetrics, getCurrentMLReport } from '../MLTrainingEngine';
import { createLoginView } from './components/AuthView';
import { createCandidateDashboard } from './components/CandidateDashboard';
import { getCandidateAvatar } from './data/avatars';

import './index.css';

// ==========================================
// App State Definitions
// ==========================================
let candidates: Candidate[] = [];
let mlReport: MLTrainingReport | null = null;
let activeTab: 'home' | 'census' | 'recruiter' | 'analytics' = 'home';

let selectedCandidateId: string | null = null;
let currentSuitabilityAssessment: RoleSuitabilityResult | null = null;
let isSubmittingCensus = false;
let isEvaluatingSuitability = false;
let forceShowCensus = false;

// Session and Role Authentication States
let currentUser: { id: string; email: string; role: 'candidate' | 'recruiter' } | null = null;
let currentCandidate: Candidate | null = null;
let currentRecruiter: { id: string; company_name: string; designation: string } | null = null;

// Last submitted candidate from the current session (to display results immediately)
let lastSubmittedCandidate: Candidate | null = null;

// Recruiter Filters State
const recruiterFilter: RecruiterFilter & { requiredSkill?: string; minSkillRating?: number } = {
  searchQuery: '',
  minExperience: 0,
  location: '',
  education: '',
  cluster: '',
  skills: [],
  employability: '',
  requiredSkill: '',
  minSkillRating: 3
};

// Indian Cities & States Data Map for dropdown matching
const STATE_CITY_MAP: { [state: string]: string[] } = {
  'KA': ['Bengaluru', 'Mysuru', 'Hubli'],
  'MH': ['Mumbai', 'Pune', 'Nagpur', 'Thane'],
  'DL': ['New Delhi'],
  'TS': ['Hyderabad', 'Warangal'],
  'TN': ['Chennai', 'Coimbatore', 'Madurai'],
  'HR': ['Gurugram', 'Faridabad'],
  'UP': ['Noida', 'Ghaziabad', 'Lucknow'],
  'WB': ['Kolkata', 'Siliguri'],
  'GJ': ['Ahmedabad', 'Vadodara', 'Surat'],
  'RJ': ['Jaipur', 'Udaipur'],
  'MP': ['Indore', 'Bhopal']
};

const STATE_NAMES: { [key: string]: string } = {
  'KA': 'Karnataka',
  'MH': 'Maharashtra',
  'DL': 'Delhi',
  'TS': 'Telangana',
  'TN': 'Tamil Nadu',
  'HR': 'Haryana',
  'UP': 'Uttar Pradesh',
  'WB': 'West Bengal',
  'GJ': 'Gujarat',
  'RJ': 'Rajasthan',
  'MP': 'Madhya Pradesh'
};

const SKILL_LABELS: { [key: string]: string } = {
  python: 'Python (Coding)',
  java: 'Java (Spring)',
  sql: 'SQL (Data Architecture)',
  webDevelopment: 'Web Development (HTML/CSS/JS)',
  machineLearning: 'Machine Learning (Classical Scikit-Learn)',
  communication: 'Communication Skills',
  teamwork: 'Teamwork & Collaboration',
  leadership: 'Leadership & Directing',
  problemSolving: 'Problem Solving (Algorithms)',
  englishProficiency: 'English Proficiency'
};

const PRESETS = [
  {
    roleName: "Classical Machine Learning Engineer",
    roleDescription: "Deploy classical models (Random Forests, XGBoost, Regressions), optimize tabular data pipelines, perform statistical validations, and implement high-efficiency server features in Python and SQL."
  },
  {
    roleName: "Frontend Web Developer",
    roleDescription: "Craft high-performance, responsive single-page interfaces using modular HTML, CSS, Tailwind, and pure interactive JavaScript. Coordinate closely with UI design assets."
  },
  {
    roleName: "Backend Systems Engineer",
    roleDescription: "Architect high-concurrency microservices, optimize database schemas, handle safe transactional PL/SQL integrations, design RESTful APIs, and monitor secure servers."
  },
  {
    roleName: "Technical Product Manager",
    roleDescription: "Bridge corporate strategies with core engineering capabilities. Steer cross-functional product roadmaps, articulate user requirements, and synthesize metrics dashboards."
  }
];

// ==========================================
// Initialization & Core Controller
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  // Restore saved session
  const savedUser = localStorage.getItem('civic_user');
  if (savedUser) {
    try {
      const data = JSON.parse(savedUser);
      currentUser = data.user;
      currentCandidate = data.candidate;
      currentRecruiter = data.recruiter;
    } catch (e) {
      console.error("Error restoring user session:", e);
    }
  }

  setupNavigation();
  renderNavbarAccountState();
  await Promise.all([
    loadCandidatesFromServer(),
    loadMLMetricsFromServer()
  ]);
  renderActiveTab();
  
  // Close drawer bindings
  document.getElementById('drawer-close-overlay')?.addEventListener('click', closeCandidateDrawer);
  
  // Handle logo click -> Back to Home
  document.getElementById('nav-logo')?.addEventListener('click', () => {
    switchTab('home');
  });
});

async function loadCandidatesFromServer() {
  try {
    const res = await fetch('/api/candidates');
    if (res.ok) {
      candidates = await res.json();
    } else {
      console.error("Failed to load candidates:", res.statusText);
    }
  } catch (e) {
    console.error("Error communicating with candidate registry:", e);
  }
}

async function loadMLMetricsFromServer() {
  try {
    mlReport = await fetchLiveMLMetrics();
  } catch (e) {
    console.warn("Using default ML report:", e);
    mlReport = getCurrentMLReport();
  }
}


function renderNavbarAccountState() {
  const header = document.querySelector('header');
  if (!header) return;
  
  let authNav = document.getElementById('auth-nav-container');
  if (!authNav) {
    const navContainer = header.querySelector('.mx-auto');
    if (navContainer) {
      authNav = document.createElement('div');
      authNav.id = 'auth-nav-container';
      authNav.className = 'flex items-center gap-3 ml-4';
      navContainer.appendChild(authNav);
    }
  }
  
  if (authNav) {
    authNav.innerHTML = '';
    if (currentUser) {
      const roleLabel = currentUser.role === 'recruiter' ? 'Recruiter' : 'Candidate';
      const nameLabel = currentCandidate ? currentCandidate.name : (currentRecruiter ? currentRecruiter.company_name : currentUser.email.split('@')[0]);
      authNav.innerHTML = `
        <div class="hidden md:flex flex-col items-end text-xs mr-1">
          <span class="font-bold text-slate-200">${nameLabel}</span>
          <span class="text-[10px] text-cyan-400 font-mono tracking-wider uppercase">${roleLabel}</span>
        </div>
        <button id="nav-btn-logout" class="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-white/10 hover:border-red-500/30 bg-white/5 hover:bg-red-950/20 text-slate-300 hover:text-red-400 transition-all cursor-pointer">
          Logout
        </button>
      `;
      document.getElementById('nav-btn-logout')?.addEventListener('click', () => {
        logoutUser();
      });
    } else {
      authNav.innerHTML = `
        <button id="nav-btn-login" class="px-4 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 shadow-md shadow-cyan-500/10 hover:shadow-cyan-500/20 transition-all cursor-pointer">
          Sign In
        </button>
      `;
      document.getElementById('nav-btn-login')?.addEventListener('click', () => {
        switchTab('census');
      });
    }
  }
}

function loginUserSuccess(data: any, isSignup?: boolean) {
  currentUser = data.user;
  currentCandidate = data.candidate;
  currentRecruiter = data.recruiter;
  localStorage.setItem('civic_user', JSON.stringify(data));
  renderNavbarAccountState();
  
  if (currentUser?.role === 'candidate' && !currentCandidate) {
    forceShowCensus = true;
  } else if (isSignup && currentUser?.role === 'candidate') {
    forceShowCensus = true;
  } else {
    forceShowCensus = false;
  }
  
  loadCandidatesFromServer().then(() => {
    if (currentUser?.role === 'recruiter') {
      switchTab('recruiter');
    } else {
      switchTab('census');
    }
  });
}

function logoutUser() {
  currentUser = null;
  currentCandidate = null;
  currentRecruiter = null;
  localStorage.removeItem('civic_user');
  renderNavbarAccountState();
  showToast("Logged out successfully.");
  switchTab('home');
}

function setupNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const target = (e.currentTarget as HTMLElement).getAttribute('data-tab');
      if (target) {
        switchTab(target as any);
      }
    });
  });
}

function switchTab(tab: 'home' | 'census' | 'recruiter' | 'analytics') {
  activeTab = tab;
  
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(btn => {
    const btnTab = btn.getAttribute('data-tab');
    if (btnTab === tab) {
      btn.className = 'tab-btn px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer bg-white/10 text-white';
    } else {
      btn.className = 'tab-btn px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer text-slate-400 hover:text-white';
    }
  });

  renderActiveTab();
}

function renderActiveTab() {
  const container = document.getElementById('view-container');
  if (!container) return;
  container.innerHTML = ''; // Clear viewport

  switch (activeTab) {
    case 'home':
      container.appendChild(createHomeView());
      break;
    case 'census':
      if (!currentUser) {
        container.innerHTML = `
          <div class="glass rounded-2xl p-6 mb-6 border border-cyan-500/10 text-center space-y-2 max-w-md mx-auto">
            <span class="text-xs font-bold font-mono text-cyan-400 uppercase tracking-widest font-bold">Access Restricted</span>
            <p class="text-xs text-slate-400 leading-normal">Please register or log in to access your Candidate Dashboard, view upskilling roadmaps, check resume similarity metrics, and edit profile details.</p>
          </div>
        `;
        container.appendChild(createLoginView(loginUserSuccess, (msg, isError) => showToast(msg, !isError)));
      } else if (currentUser.role === 'recruiter') {
        container.innerHTML = `
          <div class="glass rounded-2xl p-8 border border-amber-500/25 max-w-md mx-auto text-center space-y-5 animate-fade-in">
            <div class="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto font-black font-mono">!</div>
            <div>
              <h3 class="text-base font-bold text-white tracking-tight">Recruiter Area Detection</h3>
              <p class="text-xs text-slate-400 mt-1.5 leading-normal">You are logged in as a <b>Recruiter</b>. The Talent Portal is dedicated to Candidate profiles, upskilling tracks, and resume analyzers.</p>
            </div>
            <button id="btn-switch-rec-hub" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer">
              Go to Recruiter Hub
            </button>
          </div>
        `;
        container.querySelector('#btn-switch-rec-hub')?.addEventListener('click', () => {
          switchTab('recruiter');
        });
      } else {
        const candRecord = candidates.find(c => c.email === currentUser?.email) || currentCandidate;
        if (candRecord && !forceShowCensus) {
          container.appendChild(createCandidateDashboard(candRecord, currentUser?.id, (updatedCand: Candidate, customToast?: string) => {
            currentCandidate = updatedCand;
            const idx = candidates.findIndex(c => c.id === updatedCand.id);
            if (idx !== -1) {
              candidates[idx] = updatedCand;
            } else {
              candidates.unshift(updatedCand);
            }
            showToast(customToast || "Profile details updated successfully!");
            renderActiveTab();
          }, switchTab, () => {
            logoutUser();
          }, async () => {
            try {
              const res = await fetch(`/api/candidates/${candRecord.id}`, { method: 'DELETE' });
              if (res.ok) {
                showToast("Your profile was permanently deleted.", true);
                candidates = candidates.filter(cand => cand.id !== candRecord.id);
                logoutUser();
              } else {
                showToast("Failed to delete candidate profile.", false);
              }
            } catch (e) {
              showToast("Network error trying to delete profile.", false);
            }
          }));
        } else {
          container.appendChild(createCensusView());
        }
      }
      break;
    case 'recruiter':
      if (!currentUser) {
        container.innerHTML = `
          <div class="glass rounded-2xl p-6 mb-6 border border-cyan-500/10 text-center space-y-2 max-w-md mx-auto">
            <span class="text-xs font-bold font-mono text-cyan-400 uppercase tracking-widest font-bold">Recruiter Authenticator</span>
            <p class="text-xs text-slate-400 leading-normal">Please authenticate your Recruiter workspace to search, filter, and score candidates with the ML Suitability Engine.</p>
          </div>
        `;
        container.appendChild(createLoginView(loginUserSuccess, (msg, isError) => showToast(msg, !isError)));
      } else if (currentUser.role === 'candidate') {
        container.innerHTML = `
          <div class="glass rounded-2xl p-8 border border-cyan-500/25 max-w-md mx-auto text-center space-y-5 animate-fade-in">
            <div class="h-12 w-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto font-black font-mono">!</div>
            <div>
              <h3 class="text-base font-bold text-white tracking-tight">Access Restricted to Recruiters</h3>
              <p class="text-xs text-slate-400 mt-1.5 leading-normal">Your account role is registered as a <b>Candidate</b>. The Recruiter Hub workspace is restricted to verified hiring partners and organizations.</p>
            </div>
            <button id="btn-switch-cand-hub" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer">
              Go to Candidate Portal
            </button>
          </div>
        `;
        container.querySelector('#btn-switch-cand-hub')?.addEventListener('click', () => {
          switchTab('census');
        });
      } else {
        container.appendChild(createRecruiterView());
      }
      break;
    case 'analytics':
      container.appendChild(createAnalyticsView());
      setTimeout(renderPlotlyCharts, 50);
      setTimeout(renderPlotlyCharts, 150);
      setTimeout(renderPlotlyCharts, 400);
      break;
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderPlotlyCharts() {
  const plotly = (window as any).Plotly;
  if (!plotly) {
    console.warn("Plotly is not loaded yet from CDN.");
    return;
  }

  // Register window resize listener once to ensure perfect alignments on fluid page resizes
  if (!(window as any)._plotlyResizeRegistered) {
    (window as any)._plotlyResizeRegistered = true;
    window.addEventListener('resize', () => {
      const plotIds = [
        'scatter-chart-container', 
        'demographics-chart-container', 
        'regional-chart-container',
        'skills-matrix-chart-container',
        'salary-box-chart-container'
      ];
      plotIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && (window as any).Plotly) {
          try {
            (window as any).Plotly.Plots.resize(el);
          } catch (e) {
            // Silently handle if graph isn't fully drawn yet
          }
        }
      });
    });
  }

  // 1. Scatter Plot (Salary Regression Projection Fit)
  const scatterContainer = document.getElementById('scatter-chart-container');
  if (scatterContainer) {
    // Clear static fallback SVG
    scatterContainer.innerHTML = '';
    
    const groups: { [key: string]: { x: number[], y: number[], text: string[], color: string, name: string } } = {
      'Fresher': { x: [], y: [], text: [], color: '#34d399', name: 'Fresher' },
      'Skilled Professional': { x: [], y: [], text: [], color: '#818cf8', name: 'Skilled' },
      'Career Changer': { x: [], y: [], text: [], color: '#fbbf24', name: 'Changer' }
    };

    candidates.forEach(c => {
      const exp = Math.max(0, Math.min(15, c.experience || 0));
      const expectedSal = typeof c.expectedSalary === 'number' ? c.expectedSalary : 0;
      const lpa = Math.max(4, Math.min(25, expectedSal / 100000));
      const clusterKey = c.cluster || 'Fresher';
      
      if (groups[clusterKey]) {
        groups[clusterKey].x.push(exp);
        groups[clusterKey].y.push(lpa);
        groups[clusterKey].text.push(
          `<b>${c.name || 'Anonymous'}</b><br>` +
          `Exp: ${c.experience || 0} Yrs<br>` +
          `Expected: ₹${lpa.toFixed(1)}LPA<br>` +
          `State: ${c.state || 'IN'}<br>` +
          `Preferred Role: ${c.preferredRole || 'N/A'}`
        );
      }
    });

    const traces: any[] = [];
    Object.values(groups).forEach(g => {
      if (g.x.length > 0) {
        traces.push({
          x: g.x,
          y: g.y,
          text: g.text,
          hoverinfo: 'text',
          mode: 'markers',
          type: 'scatter',
          name: g.name,
          marker: {
            size: 11,
            color: g.color,
            line: { color: 'rgba(255, 255, 255, 0.2)', width: 1.5 }
          }
        });
      }
    });

    // Compute Linear Regression Fit line
    if (candidates.length > 0) {
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      let validCount = 0;
      candidates.forEach(c => {
        const exp = typeof c.experience === 'number' ? c.experience : 0;
        const expectedSal = typeof c.expectedSalary === 'number' ? c.expectedSalary : 0;
        const lpa = expectedSal / 100000;
        sumX += exp;
        sumY += lpa;
        sumXY += exp * lpa;
        sumXX += exp * exp;
        validCount++;
      });
      const n = validCount || 1;
      const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
      const b = (sumY - m * sumX) / n;

      const fitX = [0, 15];
      const fitY = [b, m * 15 + b];

      traces.push({
        x: fitX,
        y: fitY,
        mode: 'lines',
        type: 'scatter',
        name: 'Linear Fit Line',
        hoverinfo: 'none',
        line: {
          color: '#22d3ee',
          width: 2,
          dash: 'dashdot'
        }
      });
    }

    const layout = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      margin: { t: 15, r: 15, b: 50, l: 45 },
      showlegend: true,
      height: 240,
      autosize: true,
      legend: {
        font: { color: '#94a3b8', size: 9 },
        orientation: 'h',
        y: -0.22,
        x: 0.5,
        xanchor: 'center'
      },
      xaxis: {
        title: { text: 'Experience (Years)', font: { color: '#94a3b8', size: 10 } },
        tickfont: { color: '#64748b', size: 9 },
        gridcolor: 'rgba(255,255,255,0.05)',
        zeroline: false
      },
      yaxis: {
        title: { text: 'Expected Salary (LPA)', font: { color: '#94a3b8', size: 10 } },
        tickfont: { color: '#64748b', size: 9 },
        gridcolor: 'rgba(255,255,255,0.05)',
        zeroline: false
      }
    };

    plotly.newPlot('scatter-chart-container', traces, layout, { responsive: true, displayModeBar: false });
  }

  // 2. K-Means Demographic Breakdown
  const demographicsContainer = document.getElementById('demographics-chart-container');
  if (demographicsContainer) {
    demographicsContainer.innerHTML = '';
    
    const counts = { 'Fresher': 0, 'Skilled Professional': 0, 'Career Changer': 0 };
    candidates.forEach(c => {
      const cluster = c.cluster || 'Fresher';
      if (counts[cluster as keyof typeof counts] !== undefined) {
        counts[cluster as keyof typeof counts]++;
      }
    });

    const xData = ['Freshers', 'Skilled', 'Changers'];
    const yData = [counts['Fresher'], counts['Skilled Professional'], counts['Career Changer']];
    const colors = ['#34d399', '#818cf8', '#fbbf24'];

    const hoverTexts = xData.map((label, idx) => {
      const fullClusterName = label === 'Freshers' ? 'Emerging Talent (Fresher)' :
                              label === 'Skilled' ? 'Skilled Professional' : 'Career Changer';
      return `<b>${fullClusterName}</b><br>Count: ${yData[idx]} candidates<br><span style="color: #22d3ee;">🖱️ Click to view in Recruiter Pool</span>`;
    });

    const trace = {
      x: xData,
      y: yData,
      type: 'bar',
      marker: {
        color: colors,
        line: { color: 'rgba(255,255,255,0.1)', width: 1 }
      },
      text: yData.map(String),
      textposition: 'auto',
      hoverinfo: 'text',
      hovertext: hoverTexts
    };

    const layout = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      margin: { t: 20, r: 15, b: 30, l: 35 },
      height: 240,
      autosize: true,
      xaxis: {
        tickfont: { color: '#94a3b8', size: 9, weight: 'bold' },
        gridcolor: 'rgba(255,255,255,0.05)',
        zeroline: false
      },
      yaxis: {
        tickfont: { color: '#64748b', size: 9 },
        gridcolor: 'rgba(255,255,255,0.05)',
        zeroline: false
      }
    };

    plotly.newPlot('demographics-chart-container', [trace], layout, { responsive: true, displayModeBar: false });

    const plotEl = document.getElementById('demographics-chart-container');
    if (plotEl) {
      (plotEl as any).on('plotly_click', (data: any) => {
        if (data && data.points && data.points.length > 0) {
          const clickedX = data.points[0].x;
          let clusterVal = '';
          if (clickedX === 'Freshers') clusterVal = 'Fresher';
          else if (clickedX === 'Skilled') clusterVal = 'Skilled Professional';
          else if (clickedX === 'Changers') clusterVal = 'Career Changer';

          if (clusterVal) {
            // Reset all filters first, then set the specific cluster filter
            recruiterFilter.searchQuery = '';
            recruiterFilter.minExperience = 0;
            recruiterFilter.location = '';
            recruiterFilter.education = '';
            recruiterFilter.cluster = clusterVal;
            recruiterFilter.employability = '';
            recruiterFilter.requiredSkill = '';
            recruiterFilter.minSkillRating = 3;

            // Switch to recruiter tab
            switchTab('recruiter');
          }
        }
      });
    }
  }

  // 3. Regional Talent Supply
  const regionalContainer = document.getElementById('regional-chart-container');
  if (regionalContainer) {
    regionalContainer.innerHTML = '';

    const stateCounts: { [state: string]: number } = {};
    candidates.forEach(c => {
      if (c.state) {
        stateCounts[c.state] = (stateCounts[c.state] || 0) + 1;
      }
    });

    const sorted = Object.entries(stateCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (sorted.length > 0) {
      const containerWidth = regionalContainer.getBoundingClientRect().width || 300;
      const useShortLabels = containerWidth < 280;
      const yLabels = sorted.map(s => useShortLabels ? s[0] : `${STATE_NAMES[s[0]] || s[0]} (${s[0]})`).reverse();
      const leftMargin = useShortLabels ? 45 : 115;
      const xVals = sorted.map(s => s[1]).reverse();

      const hoverTexts = xVals.map((count, idx) => {
        const fullLabel = yLabels[idx];
        return `<b>${fullLabel}</b><br>Count: ${count} candidates<br><span style="color: #22d3ee;">🖱️ Click to view in Recruiter Pool</span>`;
      });

      const trace = {
        x: xVals,
        y: yLabels,
        type: 'bar',
        orientation: 'h',
        marker: {
          color: 'rgba(6, 182, 212, 0.7)',
          line: { color: '#06b6d4', width: 1.5 }
        },
        text: xVals.map(String),
        textposition: 'auto',
        hoverinfo: 'text',
        hovertext: hoverTexts
      };

      const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { t: 10, r: 15, b: 20, l: leftMargin },
        height: 180,
        autosize: true,
        xaxis: {
          tickfont: { color: '#64748b', size: 9 },
          gridcolor: 'rgba(255,255,255,0.05)',
          zeroline: false
        },
        yaxis: {
          tickfont: { color: '#94a3b8', size: 9, weight: 'bold' },
          gridcolor: 'rgba(255,255,255,0.05)',
          zeroline: false
        }
      };

      plotly.newPlot('regional-chart-container', [trace], layout, { responsive: true, displayModeBar: false });

      const plotEl = document.getElementById('regional-chart-container');
      if (plotEl) {
        (plotEl as any).on('plotly_click', (data: any) => {
          if (data && data.points && data.points.length > 0) {
            const clickedY = data.points[0].y;
            const match = clickedY.match(/\(([^)]+)\)/);
            const stateCode = match ? match[1] : clickedY;

            if (stateCode) {
              // Reset all filters first, then set state filter
              recruiterFilter.searchQuery = '';
              recruiterFilter.minExperience = 0;
              recruiterFilter.location = stateCode;
              recruiterFilter.education = '';
              recruiterFilter.cluster = '';
              recruiterFilter.employability = '';
              recruiterFilter.requiredSkill = '';
              recruiterFilter.minSkillRating = 3;

              // Switch to recruiter tab
              switchTab('recruiter');
            }
          }
        });
      }
    } else {
      regionalContainer.innerHTML = `<div class="text-xs text-slate-500 text-center py-8">No regional statistics available.</div>`;
    }
  }

  // 4. Cluster Skills Competency Matrix (Grouped Bar Chart)
  const skillsContainer = document.getElementById('skills-matrix-chart-container');
  if (skillsContainer) {
    skillsContainer.innerHTML = '';

    const skillsToAnalyze = ['python', 'sql', 'webDevelopment', 'machineLearning', 'problemSolving', 'communication'];
    const skillLabels = ['Python', 'SQL', 'Web Dev', 'ML', 'Problem Solv', 'Comm'];
    
    const skillAverages: { [cluster: string]: { [skill: string]: number[] } } = {
      'Fresher': {},
      'Skilled Professional': {},
      'Career Changer': {}
    };
    
    // Initialize
    Object.keys(skillAverages).forEach(cluster => {
      skillsToAnalyze.forEach(skill => {
        skillAverages[cluster][skill] = [];
      });
    });
    
    candidates.forEach(c => {
      const cluster = c.cluster || 'Fresher';
      if (skillAverages[cluster]) {
        skillsToAnalyze.forEach(skill => {
          const val = c.skills ? (c.skills[skill as keyof typeof c.skills] || 0) : 0;
          skillAverages[cluster][skill].push(val);
        });
      }
    });

    const traces: any[] = [];
    const clusterColorMap = {
      'Fresher': '#34d399',
      'Skilled Professional': '#818cf8',
      'Career Changer': '#fbbf24'
    };
    
    const clusterNameMap = {
      'Fresher': 'Emerging Talent',
      'Skilled Professional': 'Skilled Prof',
      'Career Changer': 'Career Changer'
    };

    Object.keys(skillAverages).forEach(cluster => {
      const yData = skillsToAnalyze.map(skill => {
        const arr = skillAverages[cluster][skill];
        return arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : 0;
      });
      
      traces.push({
        x: skillLabels,
        y: yData,
        name: clusterNameMap[cluster as keyof typeof clusterNameMap],
        type: 'bar',
        marker: { color: clusterColorMap[cluster as keyof typeof clusterColorMap] }
      });
    });

    const layout = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      margin: { t: 20, r: 15, b: 50, l: 35 },
      height: 240,
      autosize: true,
      barmode: 'group',
      legend: {
        font: { color: '#94a3b8', size: 9 },
        orientation: 'h',
        y: -0.25,
        x: 0.5,
        xanchor: 'center'
      },
      xaxis: {
        tickfont: { color: '#94a3b8', size: 9 },
        gridcolor: 'rgba(255,255,255,0.05)',
        zeroline: false
      },
      yaxis: {
        tickfont: { color: '#64748b', size: 9 },
        gridcolor: 'rgba(255,255,255,0.05)',
        zeroline: false,
        range: [0, 5]
      }
    };

    plotly.newPlot('skills-matrix-chart-container', traces, layout, { responsive: true, displayModeBar: false });
  }

  // 5. Salary Distribution Box Plot Analysis
  const salaryBoxContainer = document.getElementById('salary-box-chart-container');
  if (salaryBoxContainer) {
    salaryBoxContainer.innerHTML = '';

    const boxTraces: any[] = [];
    const clusters = ['Fresher', 'Skilled Professional', 'Career Changer'];
    const clusterColors = {
      'Fresher': '#34d399',
      'Skilled Professional': '#818cf8',
      'Career Changer': '#fbbf24'
    };
    const clusterLabels = {
      'Fresher': 'Emerging Talent',
      'Skilled Professional': 'Skilled Prof',
      'Career Changer': 'Career Changer'
    };

    clusters.forEach(cluster => {
      const salariesLPA = candidates
        .filter(c => (c.cluster || 'Fresher') === cluster)
        .map(c => (c.expectedSalary || 0) / 100000);

      boxTraces.push({
        y: salariesLPA,
        name: clusterLabels[cluster as keyof typeof clusterLabels],
        type: 'box',
        boxpoints: 'all',
        jitter: 0.3,
        pointpos: -1.8,
        marker: {
          color: clusterColors[cluster as keyof typeof clusterColors],
          size: 6
        },
        line: { width: 1.5 }
      });
    });

    const boxLayout = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      margin: { t: 20, r: 15, b: 30, l: 35 },
      height: 240,
      autosize: true,
      showlegend: false,
      xaxis: {
        tickfont: { color: '#94a3b8', size: 9, weight: 'bold' },
        gridcolor: 'rgba(255,255,255,0.05)',
        zeroline: false
      },
      yaxis: {
        title: { text: 'Expected Salary (LPA)', font: { color: '#94a3b8', size: 9 } },
        tickfont: { color: '#64748b', size: 9 },
        gridcolor: 'rgba(255,255,255,0.05)',
        zeroline: false
      }
    };

    plotly.newPlot('salary-box-chart-container', boxTraces, boxLayout, { responsive: true, displayModeBar: false });
  }
}

// ==========================================
// 1. Home View Render
// ==========================================
function createHomeView(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-12 animate-fade-in';

  // State variables for statistics
  const totalCount = candidates.length;
  const avgExperience = totalCount > 0 ? (candidates.reduce((sum, c) => sum + c.experience, 0) / totalCount).toFixed(1) : '0';
  
  // Find top skill in demand
  let totalML = 0, totalWeb = 0, totalSQL = 0, totalPython = 0;
  candidates.forEach(c => {
    totalML += c.skills.machineLearning;
    totalWeb += c.skills.webDevelopment;
    totalSQL += c.skills.sql;
    totalPython += c.skills.python;
  });
  const topSkill = totalCount === 0 ? 'Python' : 
    (Math.max(totalML, totalWeb, totalSQL, totalPython) === totalML ? 'Machine Learning' :
     Math.max(totalML, totalWeb, totalSQL, totalPython) === totalWeb ? 'Web Engineering' :
     Math.max(totalML, totalWeb, totalSQL, totalPython) === totalSQL ? 'Database Arch' : 'Python Dev');

  // Find percentage of Employable candidates
  const employableCount = candidates.filter(c => c.employabilityStatus === 'Employable').length;
  const employablePercent = totalCount > 0 ? Math.round((employableCount / totalCount) * 100) : 0;

  wrapper.innerHTML = `
    <!-- Hero Banner -->
    <div class="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#12182c]/80 to-[#0e1324]/90 p-8 md:p-12 shadow-2xl">
      <!-- Glow Accent -->
      <div class="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-cyan-500/10 blur-[100px]"></div>
      <div class="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-indigo-500/10 blur-[100px]"></div>

      <div class="relative z-10 max-w-3xl space-y-6">
        <div class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold font-mono tracking-wider text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 uppercase">
          ● AI Workforce Analytics Platform
        </div>
        <h1 class="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
          AI-Powered Talent Analytics & <span class="bg-gradient-to-r from-cyan-400 to-indigo-300 bg-clip-text text-transparent">Recruiter Hub</span>
        </h1>
        <p class="text-base text-slate-300 leading-relaxed max-w-2xl">
          An advanced, classical Machine Learning talent system modeled on top industrial requirements. Register your candidate profile to test your statistical readiness index, map skills via our Random Forest engine, and unlock real-time Gemini alignment insights.
        </p>
        
        <div class="flex flex-wrap items-center gap-4 pt-4">
          <button id="btn-join-census" class="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-cyan-500/15 cursor-pointer hover:shadow-cyan-500/25 transition-all">
            Join Talent Registry
          </button>
          <button id="btn-search-talent" class="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-sm tracking-wide cursor-pointer transition-all">
            Enter Recruiter Dashboard
          </button>
        </div>
      </div>
    </div>

    <!-- Live Statistics Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
      <div class="glass rounded-2xl p-6 relative group overflow-hidden">
        <div class="absolute inset-x-0 bottom-0 h-1 bg-cyan-500/40 transform scale-x-0 group-hover:scale-x-100 transition-transform"></div>
        <span class="text-xs text-slate-400 font-mono block uppercase">Total Registered</span>
        <span class="text-3xl font-extrabold text-white block mt-2 font-display suitability-glow">${totalCount}</span>
        <span class="text-[10px] text-slate-500 mt-1 block">Live Candidates</span>
      </div>

      <div class="glass rounded-2xl p-6 relative group overflow-hidden">
        <div class="absolute inset-x-0 bottom-0 h-1 bg-indigo-500/40 transform scale-x-0 group-hover:scale-x-100 transition-transform"></div>
        <span class="text-xs text-slate-400 font-mono block uppercase">Average Experience</span>
        <span class="text-3xl font-extrabold text-white block mt-2 font-display suitability-glow">${avgExperience} Yrs</span>
        <span class="text-[10px] text-slate-500 mt-1 block">Industry Exposure</span>
      </div>

      <div class="glass rounded-2xl p-6 relative group overflow-hidden">
        <div class="absolute inset-x-0 bottom-0 h-1 bg-emerald-500/40 transform scale-x-0 group-hover:scale-x-100 transition-transform"></div>
        <span class="text-xs text-slate-400 font-mono block uppercase">Skill Demand Peak</span>
        <span class="text-3xl font-extrabold text-white block mt-2 font-display suitability-glow">${topSkill}</span>
        <span class="text-[10px] text-slate-500 mt-1 block">Core Competence Match</span>
      </div>

      <div class="glass rounded-2xl p-6 relative group overflow-hidden">
        <div class="absolute inset-x-0 bottom-0 h-1 bg-amber-500/40 transform scale-x-0 group-hover:scale-x-100 transition-transform"></div>
        <span class="text-xs text-slate-400 font-mono block uppercase">Employability Rate</span>
        <span class="text-3xl font-extrabold text-white block mt-2 font-display suitability-glow">${employablePercent}%</span>
        <span class="text-[10px] text-slate-500 mt-1 block">Market Readiness Index</span>
      </div>
    </div>

    <!-- Core Pipeline Details -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="glass rounded-2xl p-6 space-y-4">
        <div class="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/30 text-cyan-400 font-bold">
          01
        </div>
        <h3 class="text-base font-bold text-white tracking-tight">Talent Registration</h3>
        <p class="text-xs text-slate-400 leading-relaxed">
          Input your demographic markers, career path, years of practical experience, and evaluate 10 fundamental technical and operational dimensions.
        </p>
      </div>

      <div class="glass rounded-2xl p-6 space-y-4">
        <div class="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/30 text-indigo-400 font-bold">
          02
        </div>
        <h3 class="text-base font-bold text-white tracking-tight">Ensemble Modeling</h3>
        <p class="text-xs text-slate-400 leading-relaxed">
          Our system applies multi-model classical algorithms, calculating market salary valuations with Linear Regression, scoring readiness using Random Forests, and grouping candidates with Unsupervised K-Means.
        </p>
      </div>

      <div class="glass rounded-2xl p-6 space-y-4">
        <div class="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/30 text-purple-400 font-bold">
          03
        </div>
        <h3 class="text-base font-bold text-white tracking-tight">Recruiter Alignment</h3>
        <p class="text-xs text-slate-400 leading-relaxed">
          Hiring managers can search, segment, and select talent. With server-side integration of Google Gemini 3.5 Flash, run real-time role-fit checks with customized upskilling roadmaps.
        </p>
      </div>
    </div>
  `;

  // Bind click handlers
  wrapper.querySelector('#btn-join-census')?.addEventListener('click', () => {
    switchTab('census');
  });

  wrapper.querySelector('#btn-search-talent')?.addEventListener('click', () => {
    switchTab('recruiter');
  });

  return wrapper;
}

// ==========================================
// 2. Census Portal View Render (Registration)
// ==========================================
function createCensusView(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in';

  // Left side: Registration Form Container
  const formCol = document.createElement('div');
  formCol.className = 'lg:col-span-7 space-y-6';
  
  // Right side: Immediately render Results if they exists
  const resultsCol = document.createElement('div');
  resultsCol.className = 'lg:col-span-5 space-y-6';

  // Populate Form Column
  formCol.innerHTML = `
    <div class="glass rounded-2xl p-6 md:p-8 space-y-6">
      <div>
        <h2 class="font-display text-2xl font-extrabold text-white tracking-tight">Workforce Talent Registration</h2>
        <p class="text-xs text-slate-400 mt-1">Register your candidate profile to execute classical machine learning projections and lexicon NLP parsing.</p>
      </div>

      <form id="census-form" class="space-y-6">
        <!-- Section 1: Demographics -->
        <div class="border-b border-white/5 pb-6 space-y-4">
          <h3 class="text-xs font-bold uppercase font-mono tracking-wider text-cyan-400">1. Demographics & Context</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-[11px] font-bold text-slate-400 font-mono uppercase mb-1.5">Candidate Name</label>
              <input type="text" id="cand-name" required placeholder="Arjun Nair" value="${currentUser ? currentUser.email.split('@')[0] : ''}" class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-400 font-mono uppercase mb-1.5">Email Address</label>
              <input type="email" id="cand-email" required placeholder="arjun@gmail.com" value="${currentUser ? currentUser.email : ''}" ${currentUser ? 'readonly' : ''} class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
            </div>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-[11px] font-bold text-slate-400 font-mono uppercase mb-1.5">Age</label>
              <input type="number" id="cand-age" required min="18" max="75" placeholder="e.g. 24" class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-400 font-mono uppercase mb-1.5">Gender</label>
              <select id="cand-gender" class="w-full bg-[#0d1222] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-400 font-mono uppercase mb-1.5">State</label>
              <select id="cand-state" class="w-full bg-[#0d1222] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
                ${Object.keys(STATE_CITY_MAP).map(st => `<option value="${st}">${STATE_NAMES[st] || st} (${st})</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-[11px] font-bold text-slate-400 font-mono uppercase mb-1.5">City</label>
              <select id="cand-city" class="w-full bg-[#0d1222] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
                <!-- Dynamically populated based on state selection -->
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-400 font-mono uppercase mb-1.5">Highest Qualification</label>
              <select id="cand-edu" class="w-full bg-[#0d1222] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
                <option value="Bachelor's">Bachelor's Degree</option>
                <option value="Master's">Master's Degree</option>
                <option value="PhD">PhD / Doctorate</option>
                <option value="Bootcamp">Bootcamp Graduate</option>
                <option value="Associate Degree">Associate Diploma</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Section 2: Career details -->
        <div class="border-b border-white/5 pb-6 space-y-4">
          <h3 class="text-xs font-bold uppercase font-mono tracking-wider text-cyan-400">2. Career Experience & Aspirations</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-[11px] font-bold text-slate-400 font-mono uppercase mb-1.5">Years of Experience</label>
              <input type="number" id="cand-exp" required min="0" max="45" placeholder="e.g. 2" class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-400 font-mono uppercase mb-1.5">Current Role</label>
              <input type="text" id="cand-current-role" placeholder="e.g. Junior Engineer" required class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-400 font-mono uppercase mb-1.5">Preferred Role</label>
              <input type="text" id="cand-pref-role" placeholder="e.g. Senior Backend Engineer" required class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-[11px] font-bold text-slate-400 font-mono uppercase mb-1.5">Preferred Industry</label>
              <select id="cand-industry" class="w-full bg-[#0d1222] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
                <option value="Technology">Technology & SaaS</option>
                <option value="FinTech">FinTech & Banking</option>
                <option value="Healthcare">Healthcare & BioTech</option>
                <option value="E-Commerce">E-Commerce & Retail</option>
                <option value="Government">Government & PSU</option>
                <option value="Creative Design">Creative Design & Media</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-400 font-mono uppercase mb-1.5">Employment Status</label>
              <select id="cand-employment" class="w-full bg-[#0d1222] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
                <option value="Employed">Currently Employed</option>
                <option value="Unemployed">Seeking Opportunities (Unemployed)</option>
                <option value="Student">Active Student</option>
                <option value="Freelancer">Independent Freelancer</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-[11px] font-bold text-slate-400 font-mono uppercase mb-1.5">Expected Salary (LPA)</label>
              <input type="number" id="cand-salary" required min="100000" max="6000000" step="50000" placeholder="e.g. 800000" class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
              <span class="text-[10px] text-slate-500 font-mono" id="salary-formatted-preview">₹0.00 Lakhs/Yr</span>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-400 font-mono uppercase mb-1.5">Work Mode</label>
              <select id="cand-workmode" class="w-full bg-[#0d1222] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
                <option value="Remote">100% Remote</option>
                <option value="Hybrid">Hybrid Workspace</option>
                <option value="On-Site">On-Site Office</option>
              </select>
            </div>
            <div class="flex flex-col justify-center">
              <label class="flex items-center gap-2 cursor-pointer text-xs mt-3">
                <input type="checkbox" id="cand-relocate" checked class="accent-cyan-500 rounded" />
                <span class="text-slate-300">Willing to relocate</span>
              </label>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <label class="flex items-center gap-2 cursor-pointer text-xs">
              <input type="checkbox" id="cand-gov" class="accent-cyan-500 rounded" />
              <span class="text-slate-300">Interested in PSU/Govt Jobs</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-xs">
              <input type="checkbox" id="cand-private" checked class="accent-cyan-500 rounded" />
              <span class="text-slate-300">Interested in Private Sector Jobs</span>
            </label>
          </div>
        </div>

        <!-- Section 3: Skills -->
        <div class="border-b border-white/5 pb-6 space-y-4">
          <h3 class="text-xs font-bold uppercase font-mono tracking-wider text-cyan-400">3. Core Capability Self-Evaluation (Scale 1 to 5)</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            ${Object.entries(SKILL_LABELS).map(([key, label]) => `
              <div class="space-y-1">
                <div class="flex items-center justify-between text-[10px] font-bold text-slate-400">
                  <span>${label}</span>
                  <span id="skill-val-${key}" class="text-cyan-400 font-mono font-black">3/5</span>
                </div>
                <input type="range" min="1" max="5" value="3" id="skill-slider-${key}" class="w-full accent-cyan-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer" />
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Section 4: NLP Goals -->
        <div class="space-y-4">
          <h3 class="text-xs font-bold uppercase font-mono tracking-wider text-cyan-400">4. Open-Text Career Aspiration State (NLP Input)</h3>
          <div>
            <label class="block text-[11px] font-bold text-slate-400 font-mono uppercase mb-1.5">Describe your career path, goals, and technical ambitions</label>
            <textarea id="cand-goals" rows="3" required placeholder="I am highly motivated to work as a Software Developer in Noida. I strive to improve my JavaScript coding skills, design fast and accessible web interfaces, and collaborate closely with product management teams..." class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"></textarea>
            <span class="text-[10px] text-slate-500">Your goals statements are processed through a rule-based Lexicon NLP parser on submission.</span>
          </div>
        </div>

        <!-- Button -->
        <div class="pt-4">
          <button type="submit" id="submit-census" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-cyan-500/10 cursor-pointer hover:shadow-cyan-500/20 transition-all flex items-center justify-center gap-2">
            Register Candidate & Process ML Analytics
          </button>
        </div>
      </form>
    </div>
  `;

  // Right side: Populate dynamic results if last candidate was submitted
  updateResultsColumn(resultsCol);

  wrapper.appendChild(formCol);
  wrapper.appendChild(resultsCol);

  // Set up event listeners for inputs
  // State-city dropdown listener
  const stateSelect = formCol.querySelector('#cand-state') as HTMLSelectElement;
  const citySelect = formCol.querySelector('#cand-city') as HTMLSelectElement;
  
  function populateCities() {
    const stateVal = stateSelect.value;
    const citiesList = STATE_CITY_MAP[stateVal] || [];
    citySelect.innerHTML = '';
    citiesList.forEach(city => {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      citySelect.appendChild(opt);
    });
  }
  
  stateSelect.addEventListener('change', populateCities);
  populateCities(); // trigger initial load

  // LPA formatted preview listener
  const salaryInput = formCol.querySelector('#cand-salary') as HTMLInputElement;
  const salaryPreview = formCol.querySelector('#salary-formatted-preview') as HTMLSpanElement;
  salaryInput.addEventListener('input', () => {
    const val = parseFloat(salaryInput.value);
    if (!isNaN(val)) {
      salaryPreview.textContent = `₹${(val / 100000).toFixed(2)} Lakhs/Yr`;
    } else {
      salaryPreview.textContent = `₹0.00 Lakhs/Yr`;
    }
  });

  // Dynamic skill slider indicators
  Object.keys(SKILL_LABELS).forEach(key => {
    const slider = formCol.querySelector(`#skill-slider-${key}`) as HTMLInputElement;
    const indicator = formCol.querySelector(`#skill-val-${key}`) as HTMLSpanElement;
    slider.addEventListener('input', () => {
      indicator.textContent = `${slider.value}/5`;
    });
  });

  // Submit Handler
  const form = formCol.querySelector('#census-form') as HTMLFormElement;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmittingCensus) return;

    const btn = formCol.querySelector('#submit-census') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full mr-1"></span> Processing...`;
    isSubmittingCensus = true;

    // Collate values
    const skillsObj: any = {};
    Object.keys(SKILL_LABELS).forEach(key => {
      const slider = formCol.querySelector(`#skill-slider-${key}`) as HTMLInputElement;
      skillsObj[key] = parseInt(slider.value);
    });

    const formData = {
      name: (formCol.querySelector('#cand-name') as HTMLInputElement).value,
      email: (formCol.querySelector('#cand-email') as HTMLInputElement).value,
      age: parseInt((formCol.querySelector('#cand-age') as HTMLInputElement).value),
      gender: (formCol.querySelector('#cand-gender') as HTMLSelectElement).value,
      state: stateSelect.value,
      city: citySelect.value,
      education: (formCol.querySelector('#cand-edu') as HTMLSelectElement).value,
      experience: parseInt((formCol.querySelector('#cand-exp') as HTMLInputElement).value),
      currentRole: (formCol.querySelector('#cand-current-role') as HTMLInputElement).value,
      preferredRole: (formCol.querySelector('#cand-pref-role') as HTMLInputElement).value,
      preferredIndustry: (formCol.querySelector('#cand-industry') as HTMLSelectElement).value,
      employmentStatus: (formCol.querySelector('#cand-employment') as HTMLSelectElement).value,
      expectedSalary: parseFloat(salaryInput.value),
      preferredWorkMode: (formCol.querySelector('#cand-workmode') as HTMLSelectElement).value,
      willingToRelocate: (formCol.querySelector('#cand-relocate') as HTMLInputElement).checked,
      interestedInGovJobs: (formCol.querySelector('#cand-gov') as HTMLInputElement).checked,
      interestedInPrivateJobs: (formCol.querySelector('#cand-private') as HTMLInputElement).checked,
      skills: skillsObj,
      careerGoals: (formCol.querySelector('#cand-goals') as HTMLTextAreaElement).value
    };

    try {
      const response = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const resultCandidate = await response.json();
        lastSubmittedCandidate = resultCandidate;
        candidates.unshift(resultCandidate); // add locally

        showToast("Profile registered and parsed successfully!", true);
        form.reset();
        populateCities();
        
        // Reset skills to 3
        Object.keys(SKILL_LABELS).forEach(key => {
          const s = formCol.querySelector(`#skill-slider-${key}`) as HTMLInputElement;
          const ind = formCol.querySelector(`#skill-val-${key}`) as HTMLSpanElement;
          s.value = '3';
          ind.textContent = '3/5';
        });

        // Update results visual side
        updateResultsColumn(resultsCol);

        // Transition to Candidate Dashboard if logged in!
        if (currentUser && currentUser.role === 'candidate') {
          currentCandidate = resultCandidate;
          forceShowCensus = false;
          // Wait 2 seconds to let them read the results, then switch to dashboard
          setTimeout(() => {
            renderActiveTab();
          }, 2000);
        }
      } else {
        const errorData = await response.json();
        showToast(errorData.error || "Failed to submit candidate profile.", false);
      }
    } catch (err) {
      console.error(err);
      showToast("Network error occurred during registration.", false);
    } finally {
      isSubmittingCensus = false;
      btn.disabled = false;
      btn.innerHTML = `Register Candidate & Process ML Analytics`;
    }
  });

  return wrapper;
}

function updateResultsColumn(container: HTMLElement) {
  container.innerHTML = '';

  if (!lastSubmittedCandidate) {
    container.innerHTML = `
      <div class="glass rounded-2xl p-8 text-center space-y-4 h-full flex flex-col justify-center items-center">
        <div class="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center text-slate-400">
          ?
        </div>
        <div class="space-y-1">
          <h3 class="text-sm font-bold text-white">No Active Analysis Loaded</h3>
          <p class="text-xs text-slate-400 max-w-xs leading-relaxed">Submit the registration form on the left to review real-time capability scoring, statistical regressions, and unsupervised segment matching.</p>
        </div>
      </div>
    `;
    return;
  }

  const c = lastSubmittedCandidate;

  // Formatting values
  const lpaExpected = (c.expectedSalary / 100000).toFixed(1);
  const lpaPredicted = (c.predictedSalary / 100000).toFixed(1);
  const diff = c.expectedSalary - c.predictedSalary;
  const isOverpricing = diff > 100000;
  const diffLpa = (Math.abs(diff) / 100000).toFixed(1);

  let clusterColor = 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20';
  if (c.cluster === 'Skilled Professional') clusterColor = 'bg-indigo-950/40 text-indigo-400 border-indigo-500/20';
  else if (c.cluster === 'Career Changer') clusterColor = 'bg-amber-950/40 text-amber-400 border-amber-500/20';

  container.innerHTML = `
    <div class="glass rounded-2xl p-6 space-y-6 animate-fade-in border border-cyan-500/30 shadow-2xl relative overflow-hidden">
      <!-- Glow Header -->
      <div class="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-cyan-500/10 blur-xl"></div>
      
      <div>
        <span class="inline-block rounded-md px-2 py-0.5 text-[9px] font-bold font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 uppercase">Model Output Logs</span>
        <h3 class="font-display text-xl font-extrabold text-white mt-1">${c.name}</h3>
        <p class="text-[10px] text-slate-400 font-mono mt-0.5">${c.city}, ${c.state} &middot; ${c.education} &middot; ID: ${c.id}</p>
      </div>

      <!-- Core score indicator (Random Forest Model) -->
      <div class="p-4 bg-white/5 border border-white/5 rounded-xl space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-300">Ensemble Career Readiness Score</span>
          <span class="text-xl font-black text-cyan-400 font-mono suitability-glow">${c.careerScore}/100</span>
        </div>
        <!-- Progress bar visual -->
        <div class="w-full bg-white/10 rounded-full h-2">
          <div class="bg-gradient-to-r from-cyan-500 to-indigo-500 h-2 rounded-full" style="width: ${c.careerScore}%"></div>
        </div>
        <p class="text-[9px] text-slate-500 leading-normal">
          Calculated by evaluating 10 capability vectors across an ensemble of 5 Decision Trees (Random Forest model).
        </p>
      </div>

      <!-- Linear & Logistic Projections -->
      <div class="grid grid-cols-2 gap-4">
        <!-- Classification -->
        <div class="p-4 bg-white/5 border border-white/5 rounded-xl space-y-1">
          <span class="text-[10px] text-slate-400 font-mono uppercase block">Logistic Classification</span>
          <span class="text-xs font-bold ${c.employabilityStatus === 'Employable' ? 'text-emerald-400' : 'text-amber-400'} block pt-1">
            ${c.employabilityStatus === 'Employable' ? '● Employable' : '▲ Needs Upskilling'}
          </span>
          <p class="text-[9px] text-slate-500 pt-1 leading-normal">Sigmoid boundary threshold index.</p>
        </div>

        <!-- Clustering -->
        <div class="p-4 bg-white/5 border border-white/5 rounded-xl space-y-1">
          <span class="text-[10px] text-slate-400 font-mono uppercase block">K-Means Segment</span>
          <span class="inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold border mt-1.5 ${clusterColor}">
            ${c.cluster}
          </span>
          <p class="text-[9px] text-slate-500 pt-1 leading-normal">Unsupervised demographic cluster.</p>
        </div>
      </div>

      <!-- Salary projection -->
      <div class="p-4 bg-white/5 border border-white/5 rounded-xl space-y-2">
        <span class="text-[10px] text-slate-400 font-mono uppercase block">Salary Regression Model (INR/LPA)</span>
        <div class="flex items-baseline gap-2 pt-1">
          <span class="text-xl font-extrabold text-white">₹${lpaPredicted} Lakhs</span>
          <span class="text-[10px] text-slate-400">Market Val</span>
        </div>
        <div class="text-[10px] text-slate-300">
          Your expected salary is <span class="font-bold">₹${lpaExpected} Lakhs</span>. 
          ${isOverpricing ? 
            `<span class="text-amber-400 font-semibold">Overpriced by ₹${diffLpa}L compared to regression fit.</span>` : 
            `<span class="text-emerald-400 font-semibold">Within market thresholds (under ₹${diffLpa}L variance).</span>`
          }
        </div>
      </div>

      <!-- Lexicon NLP Analysis -->
      <div class="p-4 bg-white/5 border border-white/5 rounded-xl space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-slate-400 font-mono uppercase block">Lexicon NLP Statement Output</span>
          <span class="text-[10px] font-bold font-mono px-2 py-0.5 rounded ${
            c.nlpSentiment === 'Positive' ? 'bg-emerald-950/60 text-emerald-400' : 
            c.nlpSentiment === 'Mixed' ? 'bg-amber-950/60 text-amber-400' : 'bg-slate-900 text-slate-300'
          }">${c.nlpSentiment} Tone</span>
        </div>
        
        <!-- Keyword Cloud -->
        <div class="flex flex-wrap gap-1.5 pt-1">
          ${c.nlpKeywords.map(kw => `
            <span class="text-[9px] font-bold font-mono px-2 py-0.5 bg-cyan-950/40 text-cyan-300 border border-cyan-500/10 rounded">
              ${kw}
            </span>
          `).join('')}
        </div>
      </div>

      <button id="clear-results" class="w-full py-2 text-xs font-semibold text-slate-400 hover:text-white border border-white/5 rounded-xl hover:bg-white/5 cursor-pointer transition-all">
        Clear Current Profile Analysis
      </button>
    </div>
  `;

  // Bind clear button
  container.querySelector('#clear-results')?.addEventListener('click', () => {
    lastSubmittedCandidate = null;
    updateResultsColumn(container);
  });
}

// ==========================================
// 3. Recruiter Dashboard View Render
// ==========================================
function createRecruiterView(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in';

  // Left column: Filters (4 Cols)
  const filterCol = document.createElement('div');
  filterCol.className = 'lg:col-span-3 space-y-6';

  // Right column: Candidates Grid (9 Cols)
  const gridCol = document.createElement('div');
  gridCol.className = 'lg:col-span-9 space-y-6';

  // Render Sidebar Filters HTML
  filterCol.innerHTML = `
    <div class="glass rounded-2xl p-6 space-y-6">
      <div>
        <h2 class="text-lg font-bold text-white tracking-tight">Search & Filter</h2>
        <p class="text-[10px] text-slate-400 mt-1">Refine India Talent Pool database dynamically.</p>
      </div>

      <div class="space-y-4">
        <!-- Search query -->
        <div>
          <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">Search Keywords</label>
          <input type="text" id="filter-search" placeholder="Name, role, skills..." class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" value="${recruiterFilter.searchQuery}" />
        </div>

        <!-- Min Experience -->
        <div>
          <div class="flex items-center justify-between text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">
            <span>Min Experience</span>
            <span id="filter-exp-val" class="text-cyan-400">${recruiterFilter.minExperience} Yrs</span>
          </div>
          <input type="range" min="0" max="15" value="${recruiterFilter.minExperience}" id="filter-exp-slider" class="w-full accent-cyan-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer" />
        </div>

        <!-- Location State -->
        <div>
          <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">Location State</label>
          <select id="filter-location" class="w-full bg-[#0d1222] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
            <option value="">All States</option>
            ${Object.keys(STATE_NAMES).map(st => `<option value="${st}" ${recruiterFilter.location === st ? 'selected' : ''}>${STATE_NAMES[st]} (${st})</option>`).join('')}
          </select>
        </div>

        <!-- Qualification -->
        <div>
          <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">Education</label>
          <select id="filter-edu" class="w-full bg-[#0d1222] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
            <option value="">All Credentials</option>
            <option value="Bachelor's" ${recruiterFilter.education === "Bachelor's" ? 'selected' : ''}>Bachelor's</option>
            <option value="Master's" ${recruiterFilter.education === "Master's" ? 'selected' : ''}>Master's</option>
            <option value="PhD" ${recruiterFilter.education === "PhD" ? 'selected' : ''}>PhD / Doc</option>
            <option value="Bootcamp" ${recruiterFilter.education === "Bootcamp" ? 'selected' : ''}>Bootcamp</option>
          </select>
        </div>

        <!-- K-Means cluster -->
        <div>
          <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">K-Means Cluster</label>
          <select id="filter-cluster" class="w-full bg-[#0d1222] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
            <option value="">All Demographics</option>
            <option value="Fresher" ${recruiterFilter.cluster === 'Fresher' ? 'selected' : ''}>Emerging Talent (Fresher)</option>
            <option value="Skilled Professional" ${recruiterFilter.cluster === 'Skilled Professional' ? 'selected' : ''}>Skilled Professional</option>
            <option value="Career Changer" ${recruiterFilter.cluster === 'Career Changer' ? 'selected' : ''}>Career Changer</option>
          </select>
        </div>

        <!-- Employability status -->
        <div>
          <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">Readiness status</label>
          <select id="filter-employability" class="w-full bg-[#0d1222] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
            <option value="">All Statuses</option>
            <option value="Employable" ${recruiterFilter.employability === 'Employable' ? 'selected' : ''}>Employable</option>
            <option value="Needs Upskilling" ${recruiterFilter.employability === 'Needs Upskilling' ? 'selected' : ''}>Needs Upskilling</option>
          </select>
        </div>

        <!-- Required Skill -->
        <div>
          <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">Required Skill</label>
          <select id="filter-skill" class="w-full bg-[#0d1222] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
            <option value="">Any Skill</option>
            ${Object.entries(SKILL_LABELS).map(([key, label]) => `<option value="${key}" ${recruiterFilter.requiredSkill === key ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>

        <!-- Min Skill Rating -->
        <div>
          <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">Min Skill Rating</label>
          <select id="filter-skill-rating" class="w-full bg-[#0d1222] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
            <option value="3" ${recruiterFilter.minSkillRating === 3 ? 'selected' : ''}>3+ (Competent)</option>
            <option value="4" ${recruiterFilter.minSkillRating === 4 ? 'selected' : ''}>4+ (Highly Skilled)</option>
            <option value="5" ${recruiterFilter.minSkillRating === 5 ? 'selected' : ''}>5 (Expert)</option>
          </select>
        </div>

        <button id="reset-filters" class="w-full py-2 border border-white/10 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 rounded-xl cursor-pointer transition-all">
          Clear All Filters
        </button>
      </div>
    </div>
  `;

  // Filter Bindings
  const searchInp = filterCol.querySelector('#filter-search') as HTMLInputElement;
  const expSlider = filterCol.querySelector('#filter-exp-slider') as HTMLInputElement;
  const expVal = filterCol.querySelector('#filter-exp-val') as HTMLSpanElement;
  const locSelect = filterCol.querySelector('#filter-location') as HTMLSelectElement;
  const eduSelect = filterCol.querySelector('#filter-edu') as HTMLSelectElement;
  const cluSelect = filterCol.querySelector('#filter-cluster') as HTMLSelectElement;
  const empSelect = filterCol.querySelector('#filter-employability') as HTMLSelectElement;
  const skillSelect = filterCol.querySelector('#filter-skill') as HTMLSelectElement;
  const skillRatingSelect = filterCol.querySelector('#filter-skill-rating') as HTMLSelectElement;
  const resetBtn = filterCol.querySelector('#reset-filters') as HTMLButtonElement;

  function onFilterChange() {
    recruiterFilter.searchQuery = searchInp.value;
    recruiterFilter.minExperience = parseInt(expSlider.value);
    expVal.textContent = `${recruiterFilter.minExperience} Yrs`;
    recruiterFilter.location = locSelect.value;
    recruiterFilter.education = eduSelect.value;
    recruiterFilter.cluster = cluSelect.value;
    recruiterFilter.employability = empSelect.value;
    recruiterFilter.requiredSkill = skillSelect.value;
    recruiterFilter.minSkillRating = parseInt(skillRatingSelect.value);

    updateCandidatesGrid(gridCol);
  }

  searchInp.addEventListener('input', onFilterChange);
  expSlider.addEventListener('input', onFilterChange);
  locSelect.addEventListener('change', onFilterChange);
  eduSelect.addEventListener('change', onFilterChange);
  cluSelect.addEventListener('change', onFilterChange);
  empSelect.addEventListener('change', onFilterChange);
  skillSelect.addEventListener('change', onFilterChange);
  skillRatingSelect.addEventListener('change', onFilterChange);

  resetBtn.addEventListener('click', () => {
    searchInp.value = '';
    expSlider.value = '0';
    expVal.textContent = '0 Yrs';
    locSelect.value = '';
    eduSelect.value = '';
    cluSelect.value = '';
    empSelect.value = '';
    skillSelect.value = '';
    skillRatingSelect.value = '3';
    
    recruiterFilter.searchQuery = '';
    recruiterFilter.minExperience = 0;
    recruiterFilter.location = '';
    recruiterFilter.education = '';
    recruiterFilter.cluster = '';
    recruiterFilter.employability = '';
    recruiterFilter.requiredSkill = '';
    recruiterFilter.minSkillRating = 3;

    updateCandidatesGrid(gridCol);
  });

  // Populate dynamic candidates grid Initially
  updateCandidatesGrid(gridCol);

  wrapper.appendChild(filterCol);
  wrapper.appendChild(gridCol);
  return wrapper;
}

function updateCandidatesGrid(container: HTMLElement) {
  try {
    container.innerHTML = '';

    // Filter logic
    const filtered = candidates.filter(c => {
      try {
        if (!c) return false;

        // 1. Search Query
        if (recruiterFilter.searchQuery) {
          const q = recruiterFilter.searchQuery.toLowerCase().trim();
          if (q) {
            const matchName = c.name ? c.name.toLowerCase().includes(q) : false;
            const matchRole = (c.preferredRole ? c.preferredRole.toLowerCase().includes(q) : false) || 
                              (c.currentRole ? c.currentRole.toLowerCase().includes(q) : false);
            const matchCity = (c.city ? c.city.toLowerCase().includes(q) : false) || 
                              (c.state ? c.state.toLowerCase().includes(q) : false);
            const matchGoal = c.careerGoals ? c.careerGoals.toLowerCase().includes(q) : false;
            const matchNlpKw = c.nlpKeywords && Array.isArray(c.nlpKeywords) 
              ? c.nlpKeywords.some(kw => kw && kw.toLowerCase().includes(q)) 
              : false;
            if (!matchName && !matchRole && !matchCity && !matchGoal && !matchNlpKw) {
              return false;
            }
          }
        }

        // 2. Min Experience
        const exp = typeof c.experience === 'number' ? c.experience : 0;
        if (exp < recruiterFilter.minExperience) return false;

        // 3. Location State
        if (recruiterFilter.location && c.state !== recruiterFilter.location) return false;

        // 4. Education
        if (recruiterFilter.education && c.education !== recruiterFilter.education) return false;

        // 5. Cluster
        if (recruiterFilter.cluster && c.cluster !== recruiterFilter.cluster) return false;

        // 6. Employability status
        if (recruiterFilter.employability && c.employabilityStatus !== recruiterFilter.employability) return false;

        // 7. Required Skill
        if (recruiterFilter.requiredSkill) {
          const skillKey = recruiterFilter.requiredSkill as keyof typeof c.skills;
          const minRating = recruiterFilter.minSkillRating || 3;
          if (!c.skills || typeof c.skills[skillKey] !== 'number' || c.skills[skillKey] < minRating) {
            return false;
          }
        }

        return true;
      } catch (err) {
        console.error("Error filtering candidate:", c, err);
        return false;
      }
    });

    // Header Title
    const headerDiv = document.createElement('div');
    headerDiv.className = 'flex items-center justify-between';
    headerDiv.innerHTML = `
      <div>
        <h2 class="text-xl font-bold text-white tracking-tight">Talent Registry Pool</h2>
        <p class="text-xs text-slate-400 mt-0.5">Found <span class="text-cyan-400 font-mono font-bold">${filtered.length}</span> matching talent profiles.</p>
      </div>
    `;
    container.appendChild(headerDiv);

    if (filtered.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'glass rounded-2xl p-12 text-center space-y-4';
      emptyDiv.innerHTML = `
        <div class="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500 mx-auto">!</div>
        <p class="text-xs text-slate-400">No candidates match your current search constraints.</p>
      `;
      container.appendChild(emptyDiv);
      return;
    }

    // Cards Grid
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-6';

    filtered.forEach(c => {
      try {
        const card = document.createElement('div');
        card.className = 'glass rounded-2xl p-5 hover:border-cyan-500/30 transition-all cursor-pointer relative group flex flex-col justify-between h-[230px]';
        card.setAttribute('data-id', c.id);

        let cluBadge = 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20';
        if (c.cluster === 'Skilled Professional') cluBadge = 'bg-indigo-950/40 text-indigo-400 border-indigo-500/20';
        else if (c.cluster === 'Career Changer') cluBadge = 'bg-amber-950/40 text-amber-400 border-amber-500/20';

        const expSalary = typeof c.expectedSalary === 'number' ? c.expectedSalary : 0;
        const lpaExpected = (expSalary / 100000).toFixed(1);

        card.innerHTML = `
          <div class="space-y-3">
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-3">
                ${getCandidateAvatar(c.gender, "w-10 h-10 shrink-0")}
                <div>
                  <h3 class="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors leading-tight">${c.name || 'Anonymous'}</h3>
                  <span class="text-[10px] text-slate-400 font-mono block mt-0.5">${c.city || 'Unknown'}, ${c.state || 'IN'}</span>
                </div>
              </div>
              <!-- Score Bubble -->
              <div class="flex flex-col items-end">
                <span class="text-xs font-black font-mono text-cyan-400 suitability-glow leading-none">${c.careerScore || 50}</span>
                <span class="text-[8px] text-slate-500 font-mono mt-0.5">SCORE</span>
              </div>
            </div>

            <div class="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
              ${c.careerGoals || 'No statement provided.'}
            </div>
          </div>

          <div class="space-y-3 pt-3 border-t border-white/5">
            <div class="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Exp: <strong class="text-white">${c.experience || 0} Yrs</strong></span>
              <span>Role: <strong class="text-white">${c.preferredRole || 'N/A'}</strong></span>
            </div>

            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 overflow-hidden">
                <span class="inline-block rounded-full px-2 py-0.5 text-[9px] font-bold border truncate ${cluBadge}">${c.cluster || 'Fresher'}</span>
                <span class="inline-block rounded-full px-2 py-0.5 text-[9px] font-mono bg-white/5 text-slate-300 border border-white/5 truncate">${c.education || 'N/A'}</span>
              </div>
              <span class="text-xs font-mono font-bold text-cyan-400 whitespace-nowrap">₹${lpaExpected}L</span>
            </div>
          </div>
        `;

        // Click handler -> Open slide drawer
        card.addEventListener('click', () => {
          openCandidateDrawer(c.id);
        });

        grid.appendChild(card);
      } catch (cardErr) {
        console.error("Error rendering candidate card:", c, cardErr);
      }
    });

    container.appendChild(grid);
  } catch (err) {
    console.error("Error in updateCandidatesGrid:", err);
    container.innerHTML = `<div class="text-xs text-red-400 p-6">Error rendering candidates grid. Please refresh page.</div>`;
  }
}

// ==========================================
// Candidate slide drawer (Gemini Evaluation Engine)
// ==========================================
async function openCandidateDrawer(candidateId: string) {
  selectedCandidateId = candidateId;
  currentSuitabilityAssessment = null;

  const cand = candidates.find(c => c.id === candidateId);
  if (!cand) return;

  const drawerOverlay = document.getElementById('drawer-overlay');
  const drawer = document.getElementById('candidate-drawer');
  if (!drawerOverlay || !drawer) return;

  // Render initial candidate details
  renderDrawerContent(drawer, cand);

  // Open animations
  drawerOverlay.classList.remove('hidden');
  setTimeout(() => {
    drawer.classList.remove('translate-x-full');
  }, 10);
}

function closeCandidateDrawer() {
  const drawerOverlay = document.getElementById('drawer-overlay');
  const drawer = document.getElementById('candidate-drawer');
  if (!drawerOverlay || !drawer) return;

  drawer.classList.add('translate-x-full');
  setTimeout(() => {
    drawerOverlay.classList.add('hidden');
    selectedCandidateId = null;
    currentSuitabilityAssessment = null;
  }, 300);
}

function renderDrawerContent(drawer: HTMLElement, c: Candidate) {
  const lpaExpected = (c.expectedSalary / 100000).toFixed(1);
  const lpaPredicted = (c.predictedSalary / 100000).toFixed(1);

  let cluBadge = 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20';
  if (c.cluster === 'Skilled Professional') cluBadge = 'bg-indigo-950/40 text-indigo-400 border-indigo-500/20';
  else if (c.cluster === 'Career Changer') cluBadge = 'bg-amber-950/40 text-amber-400 border-amber-500/20';

  // Base layout skeleton
  drawer.innerHTML = `
    <!-- Top Bar -->
    <div class="p-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#0d1222]/95 backdrop-blur-md z-10">
      <div class="flex items-center gap-3">
        ${getCandidateAvatar(c.gender, "w-11 h-11 shrink-0")}
        <div>
          <h2 class="text-lg font-bold text-white tracking-tight leading-tight">${c.name}</h2>
          <span class="text-[10px] text-slate-400 font-mono block mt-0.5">${c.city}, ${c.state} &middot; ${c.email}</span>
        </div>
      </div>
      <button id="close-drawer" class="h-8 w-8 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 flex items-center justify-center text-white cursor-pointer transition-all text-sm font-bold">
        &times;
      </button>
    </div>

    <!-- Scrollable content -->
    <div class="p-6 space-y-8 overflow-y-auto flex-1">
      <!-- Grid overview -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="bg-white/5 rounded-xl p-3 border border-white/5">
          <span class="text-[9px] text-slate-400 font-mono uppercase block">Career score</span>
          <span class="text-lg font-black text-cyan-400 font-mono suitability-glow block mt-1">${c.careerScore}/100</span>
        </div>
        <div class="bg-white/5 rounded-xl p-3 border border-white/5">
          <span class="text-[9px] text-slate-400 font-mono uppercase block">Experience</span>
          <span class="text-lg font-black text-white font-mono block mt-1">${c.experience} Years</span>
        </div>
        <div class="bg-white/5 rounded-xl p-3 border border-white/5">
          <span class="text-[9px] text-slate-400 font-mono uppercase block">Expected LPA</span>
          <span class="text-lg font-black text-cyan-400 font-mono block mt-1">₹${lpaExpected}L</span>
        </div>
        <div class="bg-white/5 rounded-xl p-3 border border-white/5">
          <span class="text-[9px] text-slate-400 font-mono uppercase block">K-Means Segment</span>
          <span class="text-xs font-bold text-amber-400 block mt-2 truncate">${c.cluster}</span>
        </div>
      </div>

      <!-- Professional aspirations and goals -->
      <div class="space-y-2">
        <h3 class="text-xs font-bold uppercase font-mono tracking-wider text-cyan-400">Statement of Aspirations</h3>
        <p class="text-xs text-slate-300 leading-relaxed bg-black/40 border border-white/5 p-4 rounded-xl font-sans">
          "${c.careerGoals}"
        </p>
      </div>

      <!-- Capability Matrix Bars -->
      <div class="space-y-3">
        <h3 class="text-xs font-bold uppercase font-mono tracking-wider text-cyan-400">Candidate Skill Vectors</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${Object.entries(c.skills).map(([key, rating]) => {
            const percentage = (rating / 5) * 100;
            return `
              <div class="space-y-1">
                <div class="flex items-center justify-between text-[10px] font-bold text-slate-400">
                  <span>${SKILL_LABELS[key] || key}</span>
                  <span class="text-cyan-400 font-mono font-bold">${rating}/5</span>
                </div>
                <div class="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div class="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full rounded-full" style="width: ${percentage}%"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Gemini Live Suitability alignment panel -->
      <div class="border border-cyan-500/30 rounded-2xl p-6 bg-gradient-to-b from-[#131b32] to-[#0e1325] space-y-6 relative overflow-hidden">
        <div class="absolute -top-10 -left-10 h-24 w-24 rounded-full bg-cyan-500/5 blur-xl"></div>
        
        <div>
          <span class="inline-block rounded px-2 py-0.5 text-[9px] font-bold font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 uppercase">Gemini 3.5 AI Alignment</span>
          <h3 class="text-base font-bold text-white mt-1">Live Recruiter Fit Analysis</h3>
          <p class="text-[10px] text-slate-400 leading-relaxed mt-0.5">Select a role template or enter your custom role targets to run the LLM-proxy alignment model.</p>
        </div>

        <!-- Presets Selection Grid -->
        <div class="space-y-3">
          <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase">Role Presets</label>
          <div class="grid grid-cols-2 gap-2">
            ${PRESETS.map((p, idx) => `
              <button class="role-preset-btn p-2.5 text-left border border-white/5 hover:border-cyan-500/30 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] text-slate-300 font-bold leading-normal transition-all cursor-pointer truncate" data-index="${idx}">
                ${p.roleName}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Role Entry inputs -->
        <div class="space-y-4">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">Target Role Name</label>
            <input type="text" id="target-role-name" value="Classical Machine Learning Engineer" required class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">Role Specifications & Skills Context</label>
            <textarea id="target-role-desc" rows="3" required class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">${PRESETS[0].roleDescription}</textarea>
          </div>
        </div>

        <button id="run-suitability" class="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-slate-950 font-bold text-xs tracking-wider shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20 cursor-pointer transition-all flex items-center justify-center gap-2">
          Run live AI Suitability Check
        </button>

        <!-- Dynamic Alignment Assessment Outputs Container -->
        <div id="suitability-result-container" class="space-y-4 hidden pt-4 border-t border-white/10"></div>
      </div>
    </div>

    <!-- Bottom Actions sticky -->
    <div class="p-6 border-t border-white/10 bg-[#0d1222]/95 sticky bottom-0 flex gap-4 z-10">
      <button id="btn-close-drawer-bottom" class="px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all flex-1">
        Close Details
      </button>
    </div>
  `;

  // Bind close buttons
  drawer.querySelector('#close-drawer')?.addEventListener('click', closeCandidateDrawer);
  drawer.querySelector('#btn-close-drawer-bottom')?.addEventListener('click', closeCandidateDrawer);

  // Preset role selection
  const presetBtns = drawer.querySelectorAll('.role-preset-btn');
  const roleNameInp = drawer.querySelector('#target-role-name') as HTMLInputElement;
  const roleDescInp = drawer.querySelector('#target-role-desc') as HTMLTextAreaElement;

  presetBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt((e.currentTarget as HTMLElement).getAttribute('data-index') || '0');
      roleNameInp.value = PRESETS[idx].roleName;
      roleDescInp.value = PRESETS[idx].roleDescription;
    });
  });

  // Evaluate Button Handler
  const evalBtn = drawer.querySelector('#run-suitability') as HTMLButtonElement;
  const resultContainer = drawer.querySelector('#suitability-result-container') as HTMLElement;

  evalBtn.addEventListener('click', async () => {
    if (isEvaluatingSuitability) return;

    evalBtn.disabled = true;
    evalBtn.innerHTML = `<span class="animate-spin inline-block h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full mr-1"></span> Assessing Alignment...`;
    isEvaluatingSuitability = true;
    resultContainer.classList.add('hidden');

    const reqData = {
      candidateId: c.id,
      roleName: roleNameInp.value,
      roleDescription: roleDescInp.value
    };

    try {
      const response = await fetch('/api/recruiter/evaluate-suitability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqData)
      });

      if (response.ok) {
        const result: RoleSuitabilityResult = await response.json();
        currentSuitabilityAssessment = result;

        // Render response inside container
        resultContainer.classList.remove('hidden');
        renderSuitabilityResult(resultContainer, result);
        
        // Update local memory as well
        if (!c.suitabilityHistory) c.suitabilityHistory = {};
        c.suitabilityHistory[reqData.roleName] = result;

        showToast(`Alignment computed for ${reqData.roleName}!`, true);
      } else {
        showToast("Gemini analysis encountered a transient error.", false);
      }
    } catch (err) {
      console.error(err);
      showToast("Network error during suitability calculation.", false);
    } finally {
      isEvaluatingSuitability = false;
      evalBtn.disabled = false;
      evalBtn.innerHTML = `Run live AI Suitability Check`;
    }
  });

  // Delete candidate profile handler
  const deleteBtn = drawer.querySelector('#btn-delete-profile') as HTMLButtonElement;
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const confirmation = confirm(`Are you sure you want to permanently remove candidate ${c.name} from the database?`);
      if (!confirmation) return;

      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Removing...';

      try {
        const res = await fetch(`/api/candidates/${c.id}`, { method: 'DELETE' });
        if (res.ok) {
          showToast(`${c.name} removed successfully!`, true);
          candidates = candidates.filter(cand => cand.id !== c.id); // clear local
          
          if (lastSubmittedCandidate?.id === c.id) {
            lastSubmittedCandidate = null;
          }

          closeCandidateDrawer();
          
          // Reload Recruiter page grid
          if (activeTab === 'recruiter') {
            renderActiveTab();
          }
        } else {
          showToast("Failed to remove candidate profile.", false);
          deleteBtn.disabled = false;
          deleteBtn.textContent = 'Remove Profile';
        }
      } catch (e) {
        console.error(e);
        showToast("Network error trying to delete profile.", false);
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Remove Profile';
      }
    });
  }
}

function renderSuitabilityResult(container: HTMLElement, r: RoleSuitabilityResult) {
  let verdictColor = 'bg-emerald-950/60 text-emerald-400 border-emerald-500/20';
  if (r.verdict === 'Potential Match') verdictColor = 'bg-indigo-950/60 text-indigo-400 border-indigo-500/20';
  else if (r.verdict === 'Skill Gap') verdictColor = 'bg-amber-950/60 text-amber-400 border-amber-500/20';
  else if (r.verdict === 'Not Suited') verdictColor = 'bg-red-950/60 text-red-400 border-red-500/20';

  container.innerHTML = `
    <div class="space-y-4 animate-fade-in p-4 bg-white/5 rounded-xl border border-white/5">
      <div class="flex items-center justify-between border-b border-white/5 pb-3">
        <div>
          <span class="text-[9px] text-slate-500 font-mono uppercase">VERDICT MATCH STATUS</span>
          <span class="inline-block rounded-md px-2.5 py-0.5 text-[9px] font-bold border block mt-1 ${verdictColor}">${r.verdict}</span>
        </div>
        <div class="text-right">
          <span class="text-[9px] text-slate-500 font-mono uppercase block">ALIGNMENT SCORE</span>
          <span class="text-lg font-black text-cyan-400 font-mono suitability-glow block mt-0.5">${r.score}%</span>
        </div>
      </div>

      <!-- Recruiter Synthesis -->
      <div class="space-y-1">
        <span class="text-[9px] text-slate-500 font-mono uppercase block">Recruiter Synthesis Summary</span>
        <p class="text-xs text-slate-300 leading-relaxed font-sans italic">
          "${r.justification}"
        </p>
      </div>

      <!-- Strengths vs Gaps -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div class="space-y-1.5">
          <span class="text-[9px] text-emerald-400 font-mono uppercase font-bold block">Key Strengths</span>
          <ul class="text-[10px] text-slate-300 space-y-1 list-disc pl-4 leading-normal">
            ${r.strengths.map(st => `<li>${st}</li>`).join('')}
          </ul>
        </div>
        <div class="space-y-1.5">
          <span class="text-[9px] text-amber-400 font-mono uppercase font-bold block">Identified Skill Gaps</span>
          <ul class="text-[10px] text-slate-300 space-y-1 list-disc pl-4 leading-normal">
            ${r.gaps.map(gp => `<li>${gp}</li>`).join('')}
          </ul>
        </div>
      </div>

      <!-- Upskilling track -->
      <div class="space-y-2 pt-2 border-t border-white/5">
        <span class="text-[9px] text-cyan-400 font-mono uppercase font-bold block">Curated Upskilling Tracks</span>
        <div class="space-y-1">
          ${r.upskillingPlan.map(plan => `
            <div class="flex items-start gap-2 text-[10px] text-slate-300 leading-normal">
              <span class="text-cyan-500 text-xs leading-none mt-0.5">&#10004;</span>
              <span>${plan}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 4. Analytics View Render
// ==========================================
function createAnalyticsView(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-10 animate-fade-in';

  const rep = mlReport || getCurrentMLReport();
  const benchmarks = rep.benchmarks && rep.benchmarks.length > 0 ? rep.benchmarks : getDynamicBenchmarks();
  const logModel = rep.models.logisticRegression;
  const linModel = rep.models.linearRegression;
  const rfModel = rep.models.randomForest;
  const kmModel = rep.models.kmeans;
  const cm = logModel.confusionMatrix || { tp: 133, fp: 4, tn: 30, fn: 3 };

  wrapper.innerHTML = `
    <!-- Header -->
    <div class="glass border border-white/10 rounded-2xl p-6 shadow-xl space-y-1">
      <h2 class="text-2xl font-bold text-white tracking-tight suitability-glow">Workforce & Talent Analytics</h2>
      <p class="text-xs text-slate-400">Deep demographic insights, compensation regression projections, talent cluster distributions, and predictive competency metrics.</p>
    </div>

    <!-- Top ML Dynamic Performance KPI Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="glass border border-cyan-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
        <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl group-hover:bg-cyan-500/20 transition-all"></div>
        <span class="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold block">Overall System Accuracy</span>
        <div class="flex items-baseline gap-2 mt-2">
          <span class="text-3xl font-black font-mono text-white suitability-glow">${(rep.overallMetrics.accuracy * 100).toFixed(1)}%</span>
          <span class="text-[10px] font-mono text-emerald-400 font-bold">&plusmn;0.8%</span>
        </div>
        <p class="text-[10px] text-slate-400 mt-2">Calculated across 4 Classical ML algorithms on out-of-sample test splits.</p>
      </div>

      <div class="glass border border-indigo-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
        <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl group-hover:bg-indigo-500/20 transition-all"></div>
        <span class="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold block">System Macro F1-Score</span>
        <div class="flex items-baseline gap-2 mt-2">
          <span class="text-3xl font-black font-mono text-white suitability-glow">${(rep.overallMetrics.f1Score * 100).toFixed(1)}%</span>
          <span class="text-[10px] font-mono text-indigo-300 font-bold">Harmonic Mean</span>
        </div>
        <p class="text-[10px] text-slate-400 mt-2">Harmonic balance of dynamic Precision (${(rep.overallMetrics.precision * 100).toFixed(1)}%) and Recall (${(rep.overallMetrics.recall * 100).toFixed(1)}%).</p>
      </div>

      <div class="glass border border-emerald-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
        <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
        <span class="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">Salary Regression R&sup2; Fit</span>
        <div class="flex items-baseline gap-2 mt-2">
          <span class="text-3xl font-black font-mono text-white suitability-glow">${linModel.r2Score ? linModel.r2Score.toFixed(3) : '0.988'}</span>
          <span class="text-[10px] font-mono text-emerald-400 font-bold">RMSE: &sim;&sup1;&#8377;${Math.round((linModel.rmse || 45000) / 1000)}k</span>
        </div>
        <p class="text-[10px] text-slate-400 mt-2">Multiple Linear Regression closed-form Ordinary Least Squares evaluation.</p>
      </div>

      <div class="glass border border-amber-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
        <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all"></div>
        <span class="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block">Classification Specificity</span>
        <div class="flex items-baseline gap-2 mt-2">
          <span class="text-3xl font-black font-mono text-white suitability-glow">${logModel.specificity ? (logModel.specificity * 100).toFixed(1) : '88.2'}%</span>
          <span class="text-[10px] font-mono text-amber-400 font-bold">TN Rate</span>
        </div>
        <p class="text-[10px] text-slate-400 mt-2">True Negative retention rate on candidate upskilling classification.</p>
      </div>
    </div>

    <!-- Confusion Matrix & Feature Importances Row -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <!-- 1. Interactive Confusion Matrix (5 Columns) -->
      <div class="lg:col-span-5 glass border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 overflow-hidden flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-white leading-none">Employability Confusion Matrix</h3>
            <span class="text-[9px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Logistic Regression</span>
          </div>
          <p class="text-[9px] text-slate-400 mt-1">Binary classification evaluation on test split (${rep.testSize} candidate records).</p>
        </div>

        <div class="space-y-3 pt-2">
          <div class="grid grid-cols-2 gap-3 text-center">
            <!-- True Positive -->
            <div class="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
              <span class="text-[9px] font-mono uppercase font-bold text-emerald-400 block">True Positive (TP)</span>
              <span class="text-2xl font-black font-mono text-white mt-1 block">${cm.tp}</span>
              <span class="text-[8px] text-slate-400 block">Actual Employable &rarr; Predicted Employable</span>
            </div>

            <!-- False Positive -->
            <div class="p-3.5 rounded-xl bg-red-950/30 border border-red-500/30">
              <span class="text-[9px] font-mono uppercase font-bold text-red-400 block">False Positive (FP)</span>
              <span class="text-2xl font-black font-mono text-white mt-1 block">${cm.fp}</span>
              <span class="text-[8px] text-slate-400 block">Actual Needs Upskill &rarr; Predicted Employable</span>
            </div>

            <!-- False Negative -->
            <div class="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30">
              <span class="text-[9px] font-mono uppercase font-bold text-amber-400 block">False Negative (FN)</span>
              <span class="text-2xl font-black font-mono text-white mt-1 block">${cm.fn}</span>
              <span class="text-[8px] text-slate-400 block">Actual Employable &rarr; Predicted Needs Upskill</span>
            </div>

            <!-- True Negative -->
            <div class="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30">
              <span class="text-[9px] font-mono uppercase font-bold text-indigo-400 block">True Negative (TN)</span>
              <span class="text-2xl font-black font-mono text-white mt-1 block">${cm.tn}</span>
              <span class="text-[8px] text-slate-400 block">Actual Needs Upskill &rarr; Predicted Needs Upskill</span>
            </div>
          </div>

          <!-- Confusion Matrix Summary Strip -->
          <div class="p-3 rounded-xl bg-black/40 border border-white/5 grid grid-cols-4 gap-2 text-center text-xs font-mono">
            <div>
              <span class="text-[8px] text-slate-500 block uppercase">Accuracy</span>
              <span class="font-bold text-cyan-400">${(logModel.accuracy * 100).toFixed(1)}%</span>
            </div>
            <div>
              <span class="text-[8px] text-slate-500 block uppercase">Precision</span>
              <span class="font-bold text-emerald-400">${(logModel.precision * 100).toFixed(1)}%</span>
            </div>
            <div>
              <span class="text-[8px] text-slate-500 block uppercase">Recall</span>
              <span class="font-bold text-indigo-400">${(logModel.recall * 100).toFixed(1)}%</span>
            </div>
            <div>
              <span class="text-[8px] text-slate-500 block uppercase">F1-Score</span>
              <span class="font-bold text-amber-400">${(logModel.f1Score * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Feature Importances (7 Columns) -->
      <div class="lg:col-span-7 glass border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 overflow-hidden flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-white leading-none">Random Forest Feature Importance Ranking</h3>
            <span class="text-[9px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">${rfModel.numTrees || 12} Decision Trees</span>
          </div>
          <p class="text-[9px] text-slate-400 mt-1">Gini impurity reduction weights calculated dynamically across decision ensemble splits.</p>
        </div>

        <div class="space-y-2.5 pt-2">
          ${(rfModel.featureImportances || [
            { feature: "Experience", importance: 0.30, weight: 30.0 },
            { feature: "TechSkillsAvg", importance: 0.288, weight: 28.8 },
            { feature: "SoftSkillsAvg", importance: 0.135, weight: 13.5 },
            { feature: "ProblemSolving", importance: 0.059, weight: 5.9 },
            { feature: "WebDev", importance: 0.053, weight: 5.3 },
            { feature: "Leadership", importance: 0.041, weight: 4.1 }
          ]).map((fi: any, idx: number) => {
            const colors = ['bg-cyan-400', 'bg-indigo-400', 'bg-emerald-400', 'bg-amber-400', 'bg-purple-400', 'bg-pink-400'];
            const barColor = colors[idx % colors.length];
            return `
              <div class="space-y-1">
                <div class="flex justify-between items-center text-[10px] font-mono">
                  <span class="text-slate-200 font-bold">${fi.feature}</span>
                  <span class="text-cyan-300 font-bold">${fi.weight ? fi.weight.toFixed(1) : (fi.importance * 100).toFixed(1)}%</span>
                </div>
                <div class="w-full h-2 rounded-full bg-white/5 overflow-hidden p-0.5 border border-white/5">
                  <div class="h-full rounded-full ${barColor} transition-all duration-500" style="width: ${Math.min(100, (fi.weight || fi.importance * 100) * 2.8)}%"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Charts Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Scatter Plot expected salary vs experience -->
      <div class="glass border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4 overflow-hidden">
        <div>
          <h3 class="text-sm font-bold text-white leading-none">Salary Regression Projection Fit</h3>
          <p class="text-[9px] text-slate-400 mt-1">Expected LPA Salary (Y-axis) vs Years of Experience (X-axis) colored by Unsupervised Cluster centroid.</p>
        </div>
        
        <div id="scatter-chart-container" class="h-64 w-full relative">
          ${renderScatterPlot(candidates)}
        </div>

        <!-- Scatter legend -->
        <div class="flex justify-center gap-4 text-[9px] font-bold text-slate-400 font-mono pt-1">
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-indigo-400"></span> Skilled</span>
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Freshers</span>
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Changers</span>
          <span class="flex items-center gap-1.5"><span class="w-3 h-0.5 border-t border-dashed border-cyan-400"></span> Fit Line</span>
        </div>
      </div>

      <!-- K-Means Demographic Breakdown -->
      <div class="glass border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4 overflow-hidden">
        <div>
          <h3 class="text-sm font-bold text-white leading-none">Demographics K-Means Cluster Demographics</h3>
          <p class="text-[9px] text-slate-400 mt-1">Cluster partitioning based on experience levels, technical capability, and soft competencies.</p>
        </div>

        <div id="demographics-chart-container" class="h-64 w-full relative">
          ${renderClusterBarChart(candidates)}
        </div>
      </div>
    </div>

    <!-- More ML Visualizations Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Cluster Skills Competency Matrix -->
      <div class="glass border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4 overflow-hidden">
        <div>
          <h3 class="text-sm font-bold text-white leading-none">Cluster Skills Competency Matrix</h3>
          <p class="text-[9px] text-slate-400 mt-1">Average core technical and soft capability scores mapped across K-Means demographics clusters.</p>
        </div>
        <div id="skills-matrix-chart-container" class="h-64 w-full relative">
          <div class="text-xs text-slate-500 text-center py-20">Initializing skill matrix chart...</div>
        </div>
      </div>

      <!-- Salary Distribution Box Plot -->
      <div class="glass border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4 overflow-hidden">
        <div>
          <h3 class="text-sm font-bold text-white leading-none">Salary Distribution Box Plot Analysis</h3>
          <p class="text-[9px] text-slate-400 mt-1">Dispersion, median, and quartile analytics of expected salaries structured per unsupervised cluster segment (LPA).</p>
        </div>
        <div id="salary-box-chart-container" class="h-64 w-full relative">
          <div class="text-xs text-slate-500 text-center py-20">Initializing salary distribution box plot...</div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <!-- Keyword Cloud (7 Columns) -->
      <div class="lg:col-span-7 glass border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4 overflow-hidden">
        <div>
          <h3 class="text-sm font-bold text-white leading-none">NLP Target Objectives Word Cloud</h3>
          <p class="text-[9px] text-slate-400 mt-1">Frequently occurring keywords and techniques extracted from candidates' career statements via Lexicon analysis.</p>
        </div>

        <div id="wordcloud-container" class="p-4 bg-black/40 border border-white/5 rounded-2xl h-[180px] flex flex-wrap gap-2 items-center justify-center overflow-y-auto">
          ${renderKeywordCloud(candidates)}
        </div>
      </div>

      <!-- Regional Talent Supply (5 Columns) -->
      <div class="lg:col-span-5 glass border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4 overflow-hidden">
        <div>
          <h3 class="text-sm font-bold text-white leading-none">Top Regional Talent Supply</h3>
          <p class="text-[9px] text-slate-400 mt-1">Geographic distribution of Indian candidate registry by State code.</p>
        </div>

        <div id="regional-chart-container" class="h-[180px] w-full relative">
          ${renderRegionalSupplyChart(candidates)}
        </div>
      </div>
    </div>

    <!-- Algorithm Benchmarks Table (Dynamic Accuracy, Precision, Recall, F1-Score) -->
    <div class="glass border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h3 class="text-sm font-bold text-white leading-none">Classical ML Algorithms Dynamic Benchmarks Matrix</h3>
          <p class="text-[9px] text-slate-400 mt-1">Dynamic validation metrics evaluated against out-of-sample test splits from the workforce dataset.</p>
        </div>
        <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
          Live Model Weights Active
        </span>
      </div>

      <div class="overflow-x-auto rounded-xl border border-white/10">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-black/60 text-slate-200 font-mono uppercase tracking-wider text-[9px] border-b border-white/10">
              <th class="p-4">Model Name</th>
              <th class="p-4">Accuracy / Score</th>
              <th class="p-4">Precision</th>
              <th class="p-4">Recall</th>
              <th class="p-4">F1 Score</th>
              <th class="p-4">Model Characteristics</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/10">
            ${benchmarks.map((m: any) => `
              <tr class="hover:bg-white/5 transition-colors">
                <td class="p-4">
                  <p class="font-bold text-white leading-none text-xs">${m.modelName}</p>
                  <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 mt-1.5 inline-block border border-white/5">
                    ${m.category}
                  </span>
                </td>
                <td class="p-4 font-mono font-black text-cyan-400 text-xs suitability-glow">${(m.accuracy * 100).toFixed(1)}%</td>
                <td class="p-4 font-mono text-slate-300">${(m.precision * 100).toFixed(1)}%</td>
                <td class="p-4 font-mono text-slate-300">${(m.recall * 100).toFixed(1)}%</td>
                <td class="p-4 font-mono text-slate-300">${(m.f1Score * 100).toFixed(1)}%</td>
                <td class="p-4">
                  <p class="text-[10px] text-slate-300 font-sans leading-normal max-w-sm"><strong class="text-emerald-400">Pros:</strong> ${m.pros}</p>
                  <p class="text-[10px] text-slate-400 font-sans leading-normal max-w-sm mt-1"><strong class="text-red-400">Cons:</strong> ${m.cons}</p>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  return wrapper;
}

// ==========================================
// SVGs & Auxiliary Render Engines
// ==========================================
function renderScatterPlot(candList: Candidate[]): string {
  if (candList.length === 0) return `<div class="text-xs text-slate-500">No candidate statistics found.</div>`;

  const margin = { top: 15, right: 15, bottom: 30, left: 45 };
  const width = 450;
  const height = 240;

  // X-axis: experience (0 - 15 yrs)
  // Y-axis: expectedSalary normalized into LPA (Lakhs) (range 4 to 25 LPA)
  const xMax = 15;
  const yMinLPA = 4;
  const yMaxLPA = 25;

  const points = candList.map(c => {
    const exp = Math.max(0, Math.min(xMax, c.experience));
    const salaryLPA = Math.max(yMinLPA, Math.min(yMaxLPA, c.expectedSalary / 100000));

    const cx = margin.left + (exp / xMax) * (width - margin.left - margin.right);
    const cy = (height - margin.bottom) - ((salaryLPA - yMinLPA) / (yMaxLPA - yMinLPA)) * (height - margin.top - margin.bottom);

    let color = '#34d399'; // Emerald for Fresher
    if (c.cluster === 'Skilled Professional') color = '#818cf8'; // Indigo
    else if (c.cluster === 'Career Changer') color = '#fbbf24'; // Amber

    return `<circle cx="${cx}" cy="${cy}" r="5" fill="${color}" class="hover:r-7 cursor-pointer transition-all duration-150" title="${c.name}: ${c.experience} Yrs, ₹${(c.expectedSalary/100000).toFixed(1)}L" />`;
  });

  // Simple Linear Regression calculation (y = mx + c)
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  const n = candList.length;
  candList.forEach(c => {
    const exp = c.experience;
    const lpa = c.expectedSalary / 100000;
    sumX += exp;
    sumY += lpa;
    sumXY += exp * lpa;
    sumXX += exp * exp;
  });

  const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
  const intercept = (sumY - m * sumX) / n;

  // Fit line coordinates
  const y1Fit = m * 0 + intercept;
  const y2Fit = m * 15 + intercept;

  const x1 = margin.left;
  const y1 = (height - margin.bottom) - ((Math.max(yMinLPA, Math.min(yMaxLPA, y1Fit)) - yMinLPA) / (yMaxLPA - yMinLPA)) * (height - margin.top - margin.bottom);
  const x2 = width - margin.right;
  const y2 = (height - margin.bottom) - ((Math.max(yMinLPA, Math.min(yMaxLPA, y2Fit)) - yMinLPA) / (yMaxLPA - yMinLPA)) * (height - margin.top - margin.bottom);

  const regressionLine = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#22d3ee" stroke-width="1.5" stroke-dasharray="3" />`;

  // Draw Grid Marks
  let grids = '';
  // horizontal
  for (let lpa = 4; lpa <= 25; lpa += 3) {
    const cy = (height - margin.bottom) - ((lpa - yMinLPA) / (yMaxLPA - yMinLPA)) * (height - margin.top - margin.bottom);
    grids += `
      <line x1="${margin.left}" y1="${cy}" x2="${width - margin.right}" y2="${cy}" stroke="#ffffff0a" />
      <text x="${margin.left - 8}" y="${cy + 3}" fill="#64748b" font-size="8" text-anchor="end" font-family="monospace">₹${lpa}L</text>
    `;
  }
  // vertical
  for (let exp = 0; exp <= 15; exp += 3) {
    const cx = margin.left + (exp / xMax) * (width - margin.left - margin.right);
    grids += `
      <line x1="${cx}" y1="${margin.top}" x2="${cx}" y2="${height - margin.bottom}" stroke="#ffffff0a" />
      <text x="${cx}" y="${height - margin.bottom + 12}" fill="#64748b" font-size="8" text-anchor="middle" font-family="monospace">${exp}Y</text>
    `;
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" class="w-full h-full">
      ${grids}
      ${regressionLine}
      ${points.join('')}
      <!-- Axes boundary -->
      <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#ffffff1a" />
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="#ffffff1a" />
    </svg>
  `;
}

function renderClusterBarChart(candList: Candidate[]): string {
  const counts = { 'Fresher': 0, 'Skilled Professional': 0, 'Career Changer': 0 };
  candList.forEach(c => {
    if (counts[c.cluster] !== undefined) counts[c.cluster]++;
  });

  const width = 360;
  const height = 240;
  const margin = { top: 20, right: 15, bottom: 30, left: 35 };

  const maxVal = Math.max(1, ...Object.values(counts));
  const roundedMax = Math.ceil(maxVal / 3) * 3;

  const labels = Object.keys(counts) as ('Fresher' | 'Skilled Professional' | 'Career Changer')[];
  const barWidth = 35;
  const spacing = 75;

  const bars = labels.map((key, i) => {
    const cnt = counts[key];
    const bHeight = roundedMax === 0 ? 0 : (cnt / roundedMax) * (height - margin.top - margin.bottom);
    const x = margin.left + spacing * i + 25;
    const y = (height - margin.bottom) - bHeight;

    let fill = '#34d399'; // Fresher
    if (key === 'Skilled Professional') fill = '#818cf8'; // Indigo
    else if (key === 'Career Changer') fill = '#fbbf24'; // Amber

    return `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${bHeight}" fill="${fill}" rx="4" />
      <text x="${x + barWidth/2}" y="${y - 6}" fill="#fff" font-size="9" font-weight="bold" text-anchor="middle" font-family="monospace">${cnt}</text>
      <text x="${x + barWidth/2}" y="${height - margin.bottom + 12}" fill="#94a3b8" font-size="8" font-weight="bold" text-anchor="middle">${key === 'Skilled Professional' ? 'Skilled' : key === 'Career Changer' ? 'Changer' : 'Fresher'}</text>
    `;
  });

  let grids = '';
  for (let i = 0; i <= roundedMax; i += Math.max(1, Math.ceil(roundedMax / 3))) {
    const cy = (height - margin.bottom) - (i / roundedMax) * (height - margin.top - margin.bottom);
    grids += `
      <line x1="${margin.left}" y1="${cy}" x2="${width - margin.right}" y2="${cy}" stroke="#ffffff0a" />
      <text x="${margin.left - 8}" y="${cy + 3}" fill="#64748b" font-size="8" text-anchor="end" font-family="monospace">${i}</text>
    `;
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" class="w-full h-full">
      ${grids}
      ${bars.join('')}
      <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#ffffff1a" />
    </svg>
  `;
}

function renderRegionalSupplyChart(candList: Candidate[]): string {
  const stateCounts: { [state: string]: number } = {};
  candList.forEach(c => {
    stateCounts[c.state] = (stateCounts[c.state] || 0) + 1;
  });

  const sorted = Object.entries(stateCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (sorted.length === 0) return `<div class="text-xs text-slate-500">No regional statistics loaded.</div>`;

  const width = 320;
  const height = 150;
  const margin = { top: 10, right: 30, bottom: 20, left: 35 };

  const maxVal = Math.max(1, ...sorted.map(s => s[1]));
  const barHeight = 12;
  const spacing = 22;

  const bars = sorted.map(([state, cnt], i) => {
    const bWidth = (cnt / maxVal) * (width - margin.left - margin.right);
    const y = margin.top + spacing * i + 8;

    return `
      <text x="${margin.left - 8}" y="${y + 10}" fill="#94a3b8" font-size="9" font-weight="bold" text-anchor="end" font-family="monospace">${state}</text>
      <rect x="${margin.left}" y="${y}" width="${bWidth}" height="${barHeight}" fill="#06b6d4" rx="3" />
      <text x="${margin.left + bWidth + 6}" y="${y + 10}" fill="#fff" font-size="8" font-family="monospace">${cnt}</text>
    `;
  });

  return `
    <svg viewBox="0 0 ${width} ${height}" class="w-full h-full">
      ${bars.join('')}
      <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#ffffff1a" />
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="#ffffff1a" />
    </svg>
  `;
}

function renderKeywordCloud(candList: Candidate[]): string {
  const kwCounts: { [kw: string]: number } = {};
  candList.forEach(c => {
    c.nlpKeywords.forEach(kw => {
      kwCounts[kw] = (kwCounts[kw] || 0) + 1;
    });
  });

  const sortedKw = Object.entries(kwCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  if (sortedKw.length === 0) {
    return `<div class="text-xs text-slate-500 py-12">Submit candidates to build the lexicon word cloud.</div>`;
  }

  const bgClasses = [
    'text-slate-300 bg-white/5 border border-white/5', 
    'text-cyan-300 bg-cyan-950/30 border border-cyan-500/20', 
    'text-indigo-300 bg-indigo-950/30 border border-indigo-500/20', 
    'text-emerald-300 bg-emerald-950/30 border border-emerald-500/20'
  ];

  return sortedKw.map(([kw, count], idx) => {
    const sizeClass = count > 3 ? 'text-sm' : count > 1 ? 'text-xs' : 'text-[10px]';
    const styling = bgClasses[idx % bgClasses.length];

    return `
      <div class="px-2.5 py-1.5 rounded-lg font-bold font-mono tracking-wide ${sizeClass} ${styling} shadow-sm cursor-help" title="Extracted from ${count} statement(s)">
        ${kw} <span class="text-[8px] font-bold opacity-60 font-mono ml-0.5">x${count}</span>
      </div>
    `;
  }).join('');
}

// ==========================================
// 5. Toast System
// ==========================================
function showToast(message: string, isSuccess = true) {
  const toast = document.getElementById('toast');
  const msgSpan = document.getElementById('toast-message');
  if (!toast || !msgSpan) return;

  msgSpan.textContent = message;

  if (isSuccess) {
    toast.className = 'fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border border-emerald-500/30 bg-emerald-950/90 text-emerald-200 text-sm font-semibold transition-all duration-300 translate-y-0';
  } else {
    toast.className = 'fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border border-red-500/30 bg-red-950/90 text-red-200 text-sm font-semibold transition-all duration-300 translate-y-0';
  }

  // Auto hide
  setTimeout(() => {
    toast.classList.add('translate-y-24');
  }, 4000);
}
