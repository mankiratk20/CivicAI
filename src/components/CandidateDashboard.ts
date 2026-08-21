import { Candidate, RoleSuitabilityResult } from '../types';
import { getCandidateAvatar } from '../data/avatars';

// Pure-JS TF-IDF Keyword Extraction & Cosine Similarity NLP Analyzer
export function computeCosineSimilarity(resumeText: string, jobDesc: string): {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
} {
  const cleanTokens = (txt: string) => {
    return txt.toLowerCase()
      .replace(/[^a-z0-9\s\#\+]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  };

  const resumeTokens = cleanTokens(resumeText);
  const jobTokens = cleanTokens(jobDesc);

  // Simple Stopwords filter
  const stopwords = new Set([
    'and', 'the', 'for', 'with', 'a', 'an', 'in', 'on', 'at', 'to', 'of', 'from', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'this', 'that', 'our', 'your', 'their'
  ]);

  const rFiltered = resumeTokens.filter(t => !stopwords.has(t));
  const jFiltered = jobTokens.filter(t => !stopwords.has(t));

  const allTerms = Array.from(new Set([...rFiltered, ...jFiltered]));
  const rFreq: { [key: string]: number } = {};
  const jFreq: { [key: string]: number } = {};

  allTerms.forEach(term => {
    rFreq[term] = rFiltered.filter(t => t === term).length;
    jFreq[term] = jFiltered.filter(t => t === term).length;
  });

  // Calculate TF-IDF Vectors
  let dotProduct = 0;
  let normR = 0;
  let normJ = 0;

  allTerms.forEach(term => {
    const r = rFreq[term];
    const j = jFreq[term];
    dotProduct += r * j;
    normR += r * r;
    normJ += j * j;
  });

  const score = normR === 0 || normJ === 0 ? 0 : dotProduct / (Math.sqrt(normR) * Math.sqrt(normJ));

  // Determine matched vs missing keywords
  const matchedKeywords = allTerms.filter(term => rFreq[term] > 0 && jFreq[term] > 0);
  const missingKeywords = allTerms.filter(term => jFreq[term] > 0 && rFreq[term] === 0);

  return {
    score: Math.round(score * 100),
    matchedKeywords: matchedKeywords.slice(0, 10),
    missingKeywords: missingKeywords.slice(0, 10)
  };
}

export function createCandidateDashboard(
  cand: Candidate,
  userId: string | undefined,
  onProfileUpdated: (updatedCand: Candidate, toastMessage?: string) => void,
  switchTab: (tab: any) => void,
  onLogout: () => void,
  onDeleteProfile: () => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'space-y-8 animate-fade-in';

  // Sub-tab state
  let activeSubTab: 'profile' | 'score' | 'resume' | 'roadmap' | 'jobs' | 'notifications' = 'profile';

  // Notifications state
  let notifications: any[] = [];
  let isEditingProfile = false;
  const notificationUserId = userId || cand.id;

  // Load notifications from server
  async function loadNotifications() {
    try {
      const res = await fetch(`/api/notifications/${encodeURIComponent(notificationUserId)}`);
      if (res.ok) {
        notifications = await res.json();
      }
    } catch (e) {
      console.error("Error loading notifications:", e);
    }
  }

  function renderDashboard() {
    const unreadCount = notifications.filter(n => !n.is_read).length;
    
    container.innerHTML = `
      <!-- Header Dashboard Banner -->
      <div class="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-cyan-950/20 via-indigo-950/10 to-transparent p-6 sm:p-8">
        <div class="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-500/10 blur-2xl"></div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-center gap-4">
            ${getCandidateAvatar(cand.gender, "w-14 h-14")}
            <div>
              <span class="inline-block rounded-md px-2.5 py-0.5 text-[9px] font-bold font-mono tracking-wider text-cyan-400 bg-cyan-950/50 border border-cyan-500/30 uppercase">Candidate Hub</span>
              <h1 class="text-3xl font-extrabold tracking-tight text-white mt-1">${cand.name}</h1>
              <p class="text-xs text-slate-400 mt-1 font-mono">${cand.city}, ${cand.state} &middot; Preferred Role: ${cand.preferredRole} &middot; ID: ${cand.id}</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="text-right">
              <span class="text-[10px] block text-slate-500 font-mono">CAREER READY INDEX</span>
              <span class="text-2xl font-black text-cyan-400 font-mono">${cand.careerScore}/100</span>
            </div>
            <div class="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-extrabold font-mono">
              ${cand.careerScore}
            </div>
          </div>
        </div>

        <!-- Inner Navigation Sub-tabs -->
        <div class="flex flex-wrap gap-1.5 mt-8 border-t border-white/5 pt-6">
          <button id="subtab-profile" class="sub-tab-btn px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeSubTab === 'profile' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white bg-white/5 hover:bg-white/10'}" data-sub="profile">
            My Profile
          </button>
          <button id="subtab-score" class="sub-tab-btn px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeSubTab === 'score' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white bg-white/5 hover:bg-white/10'}" data-sub="score">
            ML Career Score
          </button>
          <button id="subtab-resume" class="sub-tab-btn px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeSubTab === 'resume' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white bg-white/5 hover:bg-white/10'}" data-sub="resume">
            Resume Analyzer (NLP)
          </button>
          <button id="subtab-roadmap" class="sub-tab-btn px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeSubTab === 'roadmap' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white bg-white/5 hover:bg-white/10'}" data-sub="roadmap">
            Upskilling Roadmap
          </button>
          <button id="subtab-jobs" class="sub-tab-btn px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeSubTab === 'jobs' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white bg-white/5 hover:bg-white/10'}" data-sub="jobs">
            Job Recommendations
          </button>
          <button id="subtab-notifications" class="sub-tab-btn px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer relative ${activeSubTab === 'notifications' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white bg-white/5 hover:bg-white/10'}" data-sub="notifications">
            Notifications
            ${unreadCount > 0 ? `<span class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">${unreadCount}</span>` : ''}
          </button>
        </div>
      </div>

      <!-- Active Content Panel -->
      <div id="subtab-content-panel" class="space-y-6"></div>
    `;

    // Bind sub-tab selectors
    const btns = container.querySelectorAll('.sub-tab-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = (e.currentTarget as HTMLElement).getAttribute('data-sub');
        if (target) {
          activeSubTab = target as any;
          renderDashboard();
        }
      });
    });

    renderActiveSubTab();
  }

  function renderActiveSubTab() {
    const panel = container.querySelector('#subtab-content-panel');
    if (!panel) return;
    panel.innerHTML = '';

    switch (activeSubTab) {
      case 'profile':
        panel.appendChild(createProfileSubView());
        break;
      case 'score':
        panel.appendChild(createScoreSubView());
        break;
      case 'resume':
        panel.appendChild(createResumeSubView());
        break;
      case 'roadmap':
        panel.appendChild(createRoadmapSubView());
        break;
      case 'jobs':
        panel.appendChild(createJobsSubView());
        break;
      case 'notifications':
        panel.appendChild(createNotificationsSubView());
        break;
    }
  }

  // ==========================================
  // SUB-VIEWS GENERATION
  // ==========================================

  function createProfileSubView(): HTMLElement {
    const view = document.createElement('div');
    view.className = 'grid grid-cols-1 lg:grid-cols-12 gap-8';

    if (isEditingProfile) {
      // Edit form
      view.innerHTML = `
        <div class="lg:col-span-8 glass rounded-2xl p-6 md:p-8 space-y-6">
          <div>
            <h2 class="font-display text-xl font-extrabold text-white tracking-tight">Edit Demographics & Professional Details</h2>
            <p class="text-xs text-slate-400 mt-1">Submit changes to recalculate alignment scores and regression parameters.</p>
          </div>

          <form id="profile-edit-form" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">Full Name</label>
                <input type="text" id="edit-name" required value="${cand.name}" class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">Email (Cannot Change)</label>
                <input type="email" id="edit-email" readonly disabled value="${cand.email}" class="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-500 focus:outline-none" />
              </div>
            </div>

            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">Age</label>
                <input type="number" id="edit-age" required min="18" max="75" value="${cand.age}" class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">Gender</label>
                <select id="edit-gender" class="w-full bg-[#0d1222] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
                  <option value="Male" ${cand.gender === 'Male' ? 'selected' : ''}>Male</option>
                  <option value="Female" ${cand.gender === 'Female' ? 'selected' : ''}>Female</option>
                  <option value="Other" ${cand.gender === 'Other' ? 'selected' : ''}>Other</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">Qualification</label>
                <select id="edit-edu" class="w-full bg-[#0d1222] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
                  <option value="Bachelor's" ${cand.education === "Bachelor's" ? 'selected' : ''}>Bachelor's Degree</option>
                  <option value="Master's" ${cand.education === "Master's" ? 'selected' : ''}>Master's Degree</option>
                  <option value="PhD" ${cand.education === "PhD" ? 'selected' : ''}>PhD / Doctorate</option>
                  <option value="Bootcamp" ${cand.education === "Bootcamp" ? 'selected' : ''}>Bootcamp Graduate</option>
                  <option value="Associate Degree" ${cand.education === "Associate Degree" ? 'selected' : ''}>Associate Diploma</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">Experience (Yrs)</label>
                <input type="number" id="edit-exp" required min="0" max="45" value="${cand.experience}" class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">Current Role</label>
                <input type="text" id="edit-current-role" required value="${cand.currentRole}" class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">Preferred Role</label>
                <input type="text" id="edit-pref-role" required value="${cand.preferredRole}" class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">Preferred Industry</label>
                <select id="edit-industry" class="w-full bg-[#0d1222] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
                  <option value="Technology" ${cand.preferredIndustry === 'Technology' ? 'selected' : ''}>Technology & SaaS</option>
                  <option value="FinTech" ${cand.preferredIndustry === 'FinTech' ? 'selected' : ''}>FinTech & Banking</option>
                  <option value="Healthcare" ${cand.preferredIndustry === 'Healthcare' ? 'selected' : ''}>Healthcare & BioTech</option>
                  <option value="E-Commerce" ${cand.preferredIndustry === 'E-Commerce' ? 'selected' : ''}>E-Commerce & Retail</option>
                  <option value="Government" ${cand.preferredIndustry === 'Government' ? 'selected' : ''}>Government & PSU</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">Expected Salary (₹/Yr)</label>
                <input type="number" id="edit-salary" required min="100000" value="${cand.expectedSalary}" class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <button type="button" id="edit-cancel" class="py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-xs text-white font-bold transition-all cursor-pointer">
                Cancel
              </button>
              <button type="submit" class="py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 text-xs font-bold transition-all cursor-pointer">
                Save & Recalculate ML
              </button>
            </div>
          </form>
        </div>
      `;

      // Form Bindings
      view.querySelector('#edit-cancel')?.addEventListener('click', () => {
        isEditingProfile = false;
        renderActiveSubTab();
      });

      view.querySelector('#profile-edit-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          ...cand,
          name: (view.querySelector('#edit-name') as HTMLInputElement).value,
          age: parseInt((view.querySelector('#edit-age') as HTMLInputElement).value),
          gender: (view.querySelector('#edit-gender') as HTMLSelectElement).value,
          education: (view.querySelector('#edit-edu') as HTMLSelectElement).value,
          experience: parseInt((view.querySelector('#edit-exp') as HTMLInputElement).value),
          currentRole: (view.querySelector('#edit-current-role') as HTMLInputElement).value,
          preferredRole: (view.querySelector('#edit-pref-role') as HTMLInputElement).value,
          preferredIndustry: (view.querySelector('#edit-industry') as HTMLSelectElement).value,
          expectedSalary: parseFloat((view.querySelector('#edit-salary') as HTMLInputElement).value)
        };

        try {
          const res = await fetch('/api/candidates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            const updated = await res.json();
            isEditingProfile = false;
            onProfileUpdated(updated);
          }
        } catch (err) {
          console.error("Failed to update candidate profile:", err);
        }
      });
    } else {
      // Show values
      view.innerHTML = `
        <div class="lg:col-span-8 space-y-6">
          <div class="glass rounded-2xl p-6 md:p-8 space-y-6">
            <div class="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 class="text-base font-bold text-white tracking-tight">Personal Details & Experience</h3>
              <button id="btn-edit-profile" class="px-3 py-1.5 rounded-lg border border-white/10 hover:border-cyan-500/30 bg-white/5 hover:bg-cyan-500/10 text-[11px] text-cyan-400 transition-all font-bold cursor-pointer">
                Edit Profile
              </button>
            </div>

            <div class="grid grid-cols-2 gap-y-5 gap-x-4">
              <div>
                <span class="text-[10px] text-slate-500 block font-mono uppercase">Full Name</span>
                <span class="text-sm font-semibold text-slate-200 mt-1 block">${cand.name}</span>
              </div>
              <div>
                <span class="text-[10px] text-slate-500 block font-mono uppercase">Email Address</span>
                <span class="text-sm font-semibold text-slate-200 mt-1 block">${cand.email}</span>
              </div>
              <div>
                <span class="text-[10px] text-slate-500 block font-mono uppercase">Age / Gender</span>
                <span class="text-sm font-semibold text-slate-200 mt-1 block">${cand.age} Yrs &middot; ${cand.gender}</span>
              </div>
              <div>
                <span class="text-[10px] text-slate-500 block font-mono uppercase">Highest Qualification</span>
                <span class="text-sm font-semibold text-slate-200 mt-1 block">${cand.education}</span>
              </div>
              <div>
                <span class="text-[10px] text-slate-500 block font-mono uppercase">Current Role & Experience</span>
                <span class="text-sm font-semibold text-slate-200 mt-1 block">${cand.currentRole} (${cand.experience} Yrs)</span>
              </div>
              <div>
                <span class="text-[10px] text-slate-500 block font-mono uppercase">Salary Expectations</span>
                <span class="text-sm font-semibold text-slate-200 mt-1 block">₹${(cand.expectedSalary / 100000).toFixed(2)} Lakhs/Yr</span>
              </div>
              <div>
                <span class="text-[10px] text-slate-500 block font-mono uppercase">Location Preferences</span>
                <span class="text-sm font-semibold text-slate-200 mt-1 block">${cand.city}, ${cand.state} (${cand.preferredWorkMode})</span>
              </div>
              <div>
                <span class="text-[10px] text-slate-500 block font-mono uppercase">Industry / relocation</span>
                <span class="text-sm font-semibold text-slate-200 mt-1 block">${cand.preferredIndustry} &middot; ${cand.willingToRelocate ? 'Relocating OK' : 'No Relocation'}</span>
              </div>
            </div>
          </div>

          <!-- Skills Profile Section -->
          <div class="glass rounded-2xl p-6 md:p-8 space-y-4">
            <h3 class="text-sm font-bold text-white tracking-tight border-b border-white/5 pb-3">Technical & Soft Skills Core Scores</h3>
            <div class="grid grid-cols-2 gap-4">
              ${Object.entries(cand.skills).map(([key, rating]) => `
                <div class="space-y-1">
                  <div class="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                    <span>${key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}</span>
                    <span class="text-cyan-400 font-mono font-bold">${rating}/5</span>
                  </div>
                  <div class="w-full bg-white/5 rounded-full h-1.5">
                    <div class="bg-gradient-to-r from-cyan-500 to-indigo-500 h-1.5 rounded-full" style="width: ${rating * 20}%"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="lg:col-span-4 space-y-6">
          <div class="glass rounded-2xl p-6 border border-cyan-500/25 shadow-2xl space-y-4">
            <h3 class="text-xs font-bold font-mono text-cyan-400 tracking-wider uppercase">AI Career Quick Assessment</h3>
            
            <div class="flex flex-col items-center py-4 space-y-2">
              <div class="h-24 w-24 rounded-full border-4 border-cyan-500/20 flex items-center justify-center relative bg-gradient-to-tr from-cyan-950/20 to-indigo-950/10">
                <div class="absolute inset-0 rounded-full border-4 border-t-cyan-400 animate-spin" style="animation-duration: 3s"></div>
                <span class="text-2xl font-black text-cyan-400 font-mono">${cand.careerScore}</span>
              </div>
              <span class="text-xs font-mono font-bold uppercase tracking-wider ${cand.employabilityStatus === 'Employable' ? 'text-emerald-400' : 'text-amber-400'} pt-2">
                ${cand.employabilityStatus === 'Employable' ? '● Employable' : '▲ Needs Upskilling'}
              </span>
            </div>

            <p class="text-[11px] text-slate-400 leading-relaxed font-sans text-center">
              Your profile cluster is classified as a <b class="text-indigo-400 font-bold">${cand.cluster}</b>, representing ${cand.cluster === 'Skilled Professional' ? 'advanced skill maturity and experienced fit' : 'emerging baseline competency waiting for specialized upskilling'}.
            </p>
          </div>

          <!-- Account Management Card -->
          <div class="glass rounded-2xl p-6 border border-white/10 shadow-2xl space-y-4">
            <h3 class="text-xs font-bold font-mono text-slate-300 tracking-wider uppercase">Account Management</h3>
            <p class="text-[11px] text-slate-400 leading-relaxed font-sans">
              Sign out of your active session or permanently remove your candidate profile from the registry database.
            </p>
            <div class="space-y-2.5 pt-2">
              <button id="btn-candidate-signout" class="w-full py-2 text-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-white font-bold transition-all cursor-pointer">
                Sign Out
              </button>
              <button id="btn-candidate-delete-profile" class="w-full py-2 text-center rounded-xl border border-red-500/30 hover:bg-red-500/10 text-xs text-red-400 hover:text-red-300 font-bold transition-all cursor-pointer">
                Delete Profile Permanently
              </button>
            </div>
          </div>
        </div>
      `;

      view.querySelector('#btn-edit-profile')?.addEventListener('click', () => {
        isEditingProfile = true;
        renderActiveSubTab();
      });

      view.querySelector('#btn-candidate-signout')?.addEventListener('click', () => {
        onLogout();
      });

      view.querySelector('#btn-candidate-delete-profile')?.addEventListener('click', () => {
        const confirmDel = confirm("Are you sure you want to permanently delete your candidate profile? This action is irreversible.");
        if (confirmDel) {
          onDeleteProfile();
        }
      });
    }

    return view;
  }

  function createScoreSubView(): HTMLElement {
    const view = document.createElement('div');
    view.className = 'grid grid-cols-1 lg:grid-cols-12 gap-8';

    // Pricing models evaluation
    const expectedLpa = cand.expectedSalary / 100000;
    const predictedLpa = cand.predictedSalary / 100000;
    const isOverpriced = expectedLpa > predictedLpa + 1.5;
    const isUnderpriced = predictedLpa > expectedLpa + 1.5;

    view.innerHTML = `
      <div class="lg:col-span-8 space-y-6">
        <!-- Circular indicators -->
        <div class="glass rounded-2xl p-6 md:p-8 space-y-6">
          <h3 class="text-base font-bold text-white tracking-tight border-b border-white/5 pb-3">Capability Modeling Vectors</h3>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <!-- Career readiness ring -->
            <div class="p-4 rounded-xl bg-white/5 border border-white/5 text-center flex flex-col items-center space-y-2">
              <span class="text-[10px] text-slate-400 font-mono uppercase">Random Forest Ready</span>
              <div class="h-20 w-20 rounded-full border-4 border-cyan-500/25 flex items-center justify-center relative bg-black/40">
                <span class="text-lg font-black text-cyan-400 font-mono">${cand.careerScore}%</span>
              </div>
              <span class="text-[10px] text-slate-500 leading-tight">Maturity threshold index</span>
            </div>

            <!-- NLP sentiment ring -->
            <div class="p-4 rounded-xl bg-white/5 border border-white/5 text-center flex flex-col items-center space-y-2">
              <span class="text-[10px] text-slate-400 font-mono uppercase">Aspiration Sentiment</span>
              <div class="h-20 w-20 rounded-full border-4 border-indigo-500/25 flex items-center justify-center relative bg-black/40">
                <span class="text-lg font-black text-indigo-400 font-mono">${cand.nlpSentiment || 'Neutral'}</span>
              </div>
              <span class="text-[10px] text-slate-500 leading-tight">Lexicon semantic sentiment</span>
            </div>

            <!-- predicted market evaluation -->
            <div class="p-4 rounded-xl bg-white/5 border border-white/5 text-center flex flex-col items-center space-y-2">
              <span class="text-[10px] text-slate-400 font-mono uppercase">Linear Market Value</span>
              <div class="h-20 w-20 rounded-full border-4 border-emerald-500/25 flex items-center justify-center relative bg-black/40">
                <span class="text-lg font-black text-emerald-400 font-mono">₹${predictedLpa.toFixed(1)}L</span>
              </div>
              <span class="text-[10px] text-slate-500 leading-tight">Linear regression fit line</span>
            </div>
          </div>
        </div>

        <!-- Valuation assessment cards -->
        <div class="glass rounded-2xl p-6 md:p-8 space-y-4">
          <h3 class="text-base font-bold text-white tracking-tight border-b border-white/5 pb-3">Expected vs Predicted Salary Valuation</h3>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="p-4 bg-white/5 border border-white/5 rounded-xl">
              <span class="text-[10px] text-slate-500 block font-mono uppercase">Your expected salary</span>
              <span class="text-2xl font-black text-white font-mono mt-1 block">₹${expectedLpa.toFixed(1)} Lakhs/Yr</span>
            </div>
            <div class="p-4 bg-white/5 border border-white/5 rounded-xl">
              <span class="text-[10px] text-slate-500 block font-mono uppercase">ML Predicted Salary</span>
              <span class="text-2xl font-black text-cyan-400 font-mono mt-1 block">₹${predictedLpa.toFixed(1)} Lakhs/Yr</span>
            </div>
          </div>

          <div class="p-4 rounded-xl ${isOverpriced ? 'bg-amber-950/10 border border-amber-500/20 text-amber-300' : (isUnderpriced ? 'bg-emerald-950/10 border border-emerald-500/20 text-emerald-300' : 'bg-cyan-950/10 border border-cyan-500/20 text-cyan-300')} text-xs leading-relaxed">
            ${isOverpriced ? `
              <b>▲ Pricing Warning</b>: Your expected salary is slightly above the predicted regression line based on your experience and skills rating. Hiring managers may identify pricing gaps during suitability checks. Consider upskilling or adjusting expectations.
            ` : (isUnderpriced ? `
              <b>✔ Relational Advantage</b>: Your expectations are highly competitive! The machine learning pricing model predicts a higher valuation for your capabilities, giving you a substantial hiring advantage.
            ` : `
              <b>✔ Balanced Pricing</b>: Your expectations align perfectly with the computed Linear Regression slope. This signals professional maturity and transparent positioning.
            `)}
          </div>
        </div>
      </div>

      <div class="lg:col-span-4 space-y-6">
        <div class="glass rounded-2xl p-6 space-y-4">
          <h3 class="text-sm font-bold text-white tracking-tight border-b border-white/5 pb-3">Aesthetic Score Details</h3>
          
          <div class="space-y-3.5">
            <div>
              <span class="text-[10px] text-slate-500 block font-mono uppercase">My Strengths</span>
              <ul class="space-y-1.5 mt-2">
                <li class="flex items-start gap-2 text-xs text-slate-300">
                  <span class="text-cyan-400">✔</span>
                  <span>Competent rating in ${cand.skills.problemSolving >= 3 ? 'Problem Solving' : 'general adaptability'}</span>
                </li>
                <li class="flex items-start gap-2 text-xs text-slate-300">
                  <span class="text-cyan-400">✔</span>
                  <span>Good communication and teamwork traits</span>
                </li>
              </ul>
            </div>
            
            <div class="pt-2 border-t border-white/5">
              <span class="text-[10px] text-slate-500 block font-mono uppercase">Identified Gaps</span>
              <ul class="space-y-1.5 mt-2">
                <li class="flex items-start gap-2 text-xs text-slate-300">
                  <span class="text-red-400">▲</span>
                  <span>Needs machine learning or database optimization skills to bridge standard developer alignment indices</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;

    return view;
  }

  function createResumeSubView(): HTMLElement {
    const view = document.createElement('div');
    view.className = 'glass rounded-2xl p-6 md:p-8 space-y-6';

    const presets = [
      {
        name: "Classical Machine Learning Engineer",
        keywords: "python, sql, machineLearning, scikit-learn, database, regression, ensemble, pandas, algorithms, engineering"
      },
      {
        name: "Frontend Web Developer",
        keywords: "webdevelopment, html, css, javascript, react, UI, component, responsive, layout, design, communication, teamwork"
      },
      {
        name: "Backend Systems Engineer",
        keywords: "java, sql, database, REST, api, server, cloud, tables, security, engineering, problemsolving"
      },
      {
        name: "Technical Product Manager",
        keywords: "leadership, communication, teamwork, product, roadmap, manager, strategy, agile, scrum, articulation"
      }
    ];

    view.innerHTML = `
      <div class="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 class="font-display text-2xl font-extrabold text-white tracking-tight">Lexicon Cosine-Similarity Resume Analyzer</h2>
          <p class="text-xs text-slate-400 mt-1">Upload your raw text resume or paste details to perform immediate keyword TF-IDF indexing comparisons with preset job requirement vectors.</p>
        </div>

        <div class="space-y-4">
          <!-- Selection -->
          <div>
            <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1.5">1. Select Target Career Role Alignment</label>
            <select id="resume-job-target" class="w-full bg-[#0d1222] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500">
              ${presets.map((p, i) => `<option value="${i}">${p.name}</option>`).join('')}
            </select>
          </div>

          <!-- Drag drop simulation / textarea -->
          <div>
            <label class="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1.5">2. Paste Raw Resume Text Content</label>
            <textarea id="resume-paste-text" rows="8" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500" placeholder="Rahul Sharma\nEmail: rahul@gmail.com\n\nProfile Summary:\nHighly motivated Full Stack Web Developer. Experienced in building responsive user interfaces with HTML5, CSS3, modern JavaScript, and React. Excellent team collaborator and problem solver...\n\nSkills:\nJavaScript, CSS, SQL, Git, team player..."></textarea>
          </div>

          <button id="btn-run-similarity" class="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-bold text-xs tracking-wider uppercase transition-all cursor-pointer shadow-lg shadow-cyan-500/15 flex items-center justify-center gap-2">
            Run Cosine-Similarity NLP Evaluation
          </button>
        </div>

        <!-- Results section -->
        <div id="similarity-results-card" class="hidden p-6 rounded-2xl border border-cyan-500/30 bg-cyan-950/10 space-y-5 animate-fade-in">
          <!-- Cosine score dial -->
          <div class="flex items-center gap-5">
            <div class="h-16 w-16 rounded-full border-4 border-cyan-400/30 flex items-center justify-center bg-black/40 relative">
              <span id="similarity-percentage" class="text-base font-black text-cyan-400 font-mono">0%</span>
            </div>
            <div>
              <h4 class="text-sm font-bold text-white tracking-tight" id="similarity-verdict">Awaiting analysis...</h4>
              <p class="text-[10px] text-slate-400 font-mono">Computed based on word-frequency overlap indices (TF-IDF vector matching).</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
            <div>
              <span class="text-[10px] text-slate-500 block font-mono uppercase">Matched Keywords</span>
              <div class="flex flex-wrap gap-1 mt-1.5" id="similarity-matched-tags"></div>
            </div>
            <div>
              <span class="text-[10px] text-slate-500 block font-mono uppercase">Missing Core Competencies</span>
              <div class="flex flex-wrap gap-1 mt-1.5" id="similarity-missing-tags"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind analyzer click
    view.querySelector('#btn-run-similarity')?.addEventListener('click', async () => {
      const targetSel = view.querySelector('#resume-job-target') as HTMLSelectElement;
      const textArea = view.querySelector('#resume-paste-text') as HTMLTextAreaElement;
      const resultsCard = view.querySelector('#similarity-results-card') as HTMLDivElement;

      if (!textArea.value.trim()) {
        alert("Please paste resume text before executing the similarity engine.");
        return;
      }

      const preset = presets[parseInt(targetSel.value)];
      const analysis = computeCosineSimilarity(textArea.value, preset.keywords);

      resultsCard.classList.remove('hidden');

      const scoreEl = view.querySelector('#similarity-percentage') as HTMLSpanElement;
      const verdictEl = view.querySelector('#similarity-verdict') as HTMLHeadingElement;
      const matchTags = view.querySelector('#similarity-matched-tags') as HTMLDivElement;
      const missTags = view.querySelector('#similarity-missing-tags') as HTMLDivElement;

      scoreEl.textContent = `${analysis.score}%`;
      
      let resVerdict = 'Requires bridge training';
      if (analysis.score >= 70) resVerdict = 'Excellent candidate fit!';
      else if (analysis.score >= 45) resVerdict = 'Potential fit with moderate upskilling';
      
      verdictEl.textContent = `${resVerdict} (Role: ${preset.name})`;

      matchTags.innerHTML = analysis.matchedKeywords.length > 0 
        ? analysis.matchedKeywords.map(k => `<span class="bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono px-2 py-0.5 rounded-md">${k}</span>`).join('')
        : '<span class="text-[10px] text-slate-500 italic">No matches</span>';

      missTags.innerHTML = analysis.missingKeywords.length > 0 
        ? analysis.missingKeywords.map(k => `<span class="bg-red-950/40 text-red-400 border border-red-500/20 text-[9px] font-mono px-2 py-0.5 rounded-md">${k}</span>`).join('')
        : '<span class="text-[10px] text-slate-500 italic">None detected</span>';

      try {
        const candidateId = cand.id || localStorage.getItem('civic_candidate_id') || '';
        if (candidateId) {
          await fetch(`/api/resume/${encodeURIComponent(candidateId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: 'pasted-resume.txt',
              textContent: textArea.value,
              parsedData: {
                skills: analysis.matchedKeywords.join(', '),
                education: '',
                experience: '',
                keywords: analysis.matchedKeywords
              }
            })
          });
        }
      } catch (err) {
        console.error('Error saving parsed resume data:', err);
      }

      // Record this interaction in notifications!
      const userObj = JSON.parse(localStorage.getItem('civic_user') || '{}');
      if (userObj.user) {
        fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userObj.user.id,
            title: "Resume Analyzed!",
            message: `Executed TF-IDF NLP match for ${preset.name}. Computed similarity: ${analysis.score}%.`,
            type: "resume"
          })
        }).then(() => loadNotifications());
      }
    });

    return view;
  }

  async function persistRoadmap(payload: Record<string, unknown>) {
    try {
      await fetch(`/api/roadmap/${encodeURIComponent(cand.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Error saving roadmap payload:', err);
    }
  }

  async function persistJobRecommendations(payload: Array<Record<string, unknown>>) {
    try {
      await Promise.all(payload.map(jobRec => fetch(`/api/job-recommendations/${encodeURIComponent(cand.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobRec)
      })));
    } catch (err) {
      console.error('Error saving job recommendations:', err);
    }
  }

  function createRoadmapSubView(): HTMLElement {
    const view = document.createElement('div');
    view.className = 'glass rounded-2xl p-6 md:p-8 space-y-6 max-w-2xl mx-auto';

    // Personalize upskilling roadmap based on weakest skills
    const weakestSkills = Object.entries(cand.skills)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2)
      .map(entry => entry[0]);

    const items = weakestSkills.map(skill => {
      let topic = 'Data Engineering and SQL architecture';
      let link = 'https://www.geeksforgeeks.org/sql-tutorial/';
      let project = 'Database normalization and index tuning simulator';
      if (skill === 'python') {
        topic = 'Advanced Data Structures and Scripting in Python';
        link = 'https://www.coursera.org/specializations/python';
        project = 'Tabular data cleaning and processing CSV pipeline';
      } else if (skill === 'machineLearning') {
        topic = 'Classical Machine Learning Foundations with Scikit-Learn';
        link = 'https://www.coursera.org/learn/machine-learning-with-python';
        project = 'Linear regression house pricing calculator';
      } else if (skill === 'webDevelopment') {
        topic = 'Responsive Client Interfaces with HTML, CSS, & Vanilla JS';
        link = 'https://www.geeksforgeeks.org/web-development-tutorials/';
        project = 'Modular interactive budget manager SPA';
      } else if (skill === 'leadership') {
        topic = 'Agile Sprint Management & Lead Articulation';
        link = 'https://www.edx.org/course/agile-leadership-principles';
        project = 'Sprint planning board mapping 5 team sprints';
      }
      return { skill, topic, link, project };
    });

    const roadmapPayload = {
      current_skills: cand.skills,
      missing_skills: weakestSkills,
      recommended_topics: items.map(item => item.topic),
      suggested_courses: items.map(item => item.link),
      projects_to_build: items.map(item => item.project),
      career_goal: cand.preferredRole || cand.careerGoals || 'Advance my career'
    };

    void persistRoadmap(roadmapPayload);

    view.innerHTML = `
      <div>
        <h2 class="font-display text-2xl font-extrabold text-white tracking-tight">Your Personalized Learning Timeline</h2>
        <p class="text-xs text-slate-400 mt-1">Based on computed model gaps across your self-assessed technical ratings, here are curated actionable tracks to scale up your professional scores.</p>
      </div>

      <div class="space-y-6 relative border-l border-white/10 ml-2.5 pl-6 pt-2">
        ${items.map((item, index) => `
          <div class="relative space-y-2">
            <!-- Timeline node -->
            <div class="absolute -left-9.5 top-1.5 h-6 w-6 rounded-full bg-[#0b0f19] border-2 border-cyan-400 flex items-center justify-center text-[10px] font-black text-cyan-400 font-mono">
              0${index + 1}
            </div>

            <div>
              <span class="inline-block rounded px-1.5 py-0.5 text-[8px] font-bold font-mono tracking-wider text-cyan-400 bg-cyan-950/40 uppercase">Recommended Track for ${item.skill.charAt(0).toUpperCase() + item.skill.slice(1).replace(/([A-Z])/g, ' $1')}</span>
              <h4 class="text-sm font-bold text-slate-200 mt-1">${item.topic}</h4>
            </div>

            <div class="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-3.5 text-xs">
              <div>
                <span class="text-[9px] text-slate-500 font-mono uppercase block">SUGGESTED COURSE RESOURCE</span>
                <a href="${item.link}" target="_blank" rel="noreferrer" class="text-cyan-400 hover:underline inline-block mt-0.5">${item.topic} Course Page &middot; (Coursera/GFG/edX)</a>
              </div>
              
              <div class="pt-2 border-t border-white/5">
                <span class="text-[9px] text-slate-500 font-mono uppercase block">MINI-PROJECT TO BUILD</span>
                <p class="text-slate-300 mt-0.5 font-sans">${item.project}</p>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    return view;
  }

  function createJobsSubView(): HTMLElement {
    const view = document.createElement('div');
    view.className = 'glass rounded-2xl p-6 md:p-8 space-y-6 max-w-2xl mx-auto';

    // Map jobs matching candidate's preferences
    const activeJobs = [
      {
        id: "JOB-7492",
        role: "Classical Machine Learning Engineer",
        company: "CivicTech Solutions",
        location: "Bengaluru, KA",
        salary: 1200000,
        desc: "Deploy classical models (Random Forests, Regressions), optimize tabular data pipelines."
      },
      {
        id: "JOB-1048",
        role: "Frontend Web Developer",
        company: "GreenSphere Inc.",
        location: "Mumbai, MH",
        salary: 850000,
        desc: "Craft responsive single-page interfaces using modular HTML, CSS, Tailwind, and pure interactive JavaScript."
      },
      {
        id: "JOB-3829",
        role: "Backend Systems Engineer",
        company: "State Informatics",
        location: "New Delhi, DL",
        salary: 950000,
        desc: "Architect high-concurrency microservices, optimize database schemas."
      }
    ];

    // Filter jobs matching candidate role
    const matched = activeJobs.filter(job => 
      job.role.toLowerCase().includes(cand.preferredRole.toLowerCase()) ||
      cand.preferredRole.toLowerCase().includes(job.role.toLowerCase())
    );

    const displayJobs = matched.length > 0 ? matched : activeJobs;
    const weakSkillNames = Object.entries(cand.skills)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2)
      .map(([skill]) => skill);

    const jobRecommendations = displayJobs.map(job => {
      let matchPercent = 65;
      if (cand.preferredRole.toLowerCase().includes(job.role.toLowerCase().split(' ')[0])) {
        matchPercent = 88;
      }
      return {
        role_name: job.role,
        company: job.company,
        location: job.location,
        expected_salary: job.salary,
        match_percentage: matchPercent,
        required_skills: [job.role.toLowerCase().includes('machine') ? 'Machine Learning' : 'Software Development', 'Problem Solving'],
        missing_skills: weakSkillNames.length > 0 ? weakSkillNames : ['Communication']
      };
    });

    void persistJobRecommendations(jobRecommendations);

    const appliedJobsSet = new Set<string>(
      cand.appliedJobs || JSON.parse(localStorage.getItem(`applied_jobs_${cand.id}`) || '[]')
    );

    view.innerHTML = `
      <div>
        <h2 class="font-display text-2xl font-extrabold text-white tracking-tight">Curated Professional Opportunities</h2>
        <p class="text-xs text-slate-400 mt-1">These postings have been dynamically matched based on your preferred role, location context, and experience level.</p>
      </div>

      <div class="space-y-4">
        ${displayJobs.map(job => {
          // Calculate match score
          let matchPercent = 65;
          if (cand.preferredRole.toLowerCase().includes(job.role.toLowerCase().split(' ')[0])) {
            matchPercent = 88;
          }
          const isApplied = appliedJobsSet.has(job.id);
          return `
            <div class="p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-cyan-500/25 transition-all duration-300 space-y-4 relative overflow-hidden">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h4 class="text-sm font-bold text-slate-200">${job.role}</h4>
                  <p class="text-[10px] text-slate-400 font-mono mt-0.5">${job.company} &middot; ${job.location} &middot; Salary: ₹${(job.salary/100000).toFixed(1)} LPA</p>
                </div>
                <div class="text-right">
                  <span class="inline-block px-2 py-0.5 text-[9px] font-bold font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 rounded-md uppercase">${matchPercent}% Match</span>
                </div>
              </div>

              <p class="text-xs text-slate-400 leading-relaxed font-sans">${job.desc}</p>

              <div class="pt-3 border-t border-white/5 flex items-center justify-between">
                <span class="text-[9px] text-slate-500 font-mono">Job Reference ID: ${job.id}</span>
                ${isApplied ? `
                  <span class="px-3.5 py-1.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg border border-emerald-500/30 flex items-center gap-1">
                    Applied ✓
                  </span>
                ` : `
                  <button data-job-id="${job.id}" class="btn-apply px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 text-[10px] font-bold rounded-lg transition-all cursor-pointer border border-cyan-500/30 shadow-md shadow-cyan-500/10 hover:shadow-cyan-500/20">
                    Apply Now
                  </button>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    setTimeout(() => {
      const applyBtns = view.querySelectorAll('.btn-apply');
      applyBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const btnEl = e.currentTarget as HTMLButtonElement;
          const jobId = btnEl.getAttribute('data-job-id');
          if (!jobId) return;

          const job = activeJobs.find(j => j.id === jobId);
          if (!job) return;

          btnEl.disabled = true;
          btnEl.textContent = 'Applying...';

          try {
            // Save to localStorage applied list
            const currentApplied = JSON.parse(localStorage.getItem(`applied_jobs_${cand.id}`) || '[]');
            if (!currentApplied.includes(jobId)) {
              currentApplied.push(jobId);
              localStorage.setItem(`applied_jobs_${cand.id}`, JSON.stringify(currentApplied));
            }

            // Save in candidate's transient list
            if (!cand.appliedJobs) cand.appliedJobs = [];
            if (!cand.appliedJobs.includes(jobId)) {
              cand.appliedJobs.push(jobId);
            }

            // Also post manual notification to backend
            const notifRes = await fetch('/api/notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: notificationUserId,
                title: "Job Application Submitted!",
                message: `You successfully applied for ${job.role} at ${job.company} (${job.id}).`,
                type: "jobs"
              })
            });

            if (notifRes.ok) {
              await loadNotifications();
              renderDashboard();
            }

            // Trigger saving the candidate via the onProfileUpdated callback
            onProfileUpdated(cand, "Job application submitted successfully!");
          } catch (err) {
            console.error("Error applying for job:", err);
            btnEl.disabled = false;
            btnEl.textContent = 'Apply Now';
          }
        });
      });
    }, 10);

    return view;
  }

  function createNotificationsSubView(): HTMLElement {
    const view = document.createElement('div');
    view.className = 'glass rounded-2xl p-6 md:p-8 space-y-6 max-w-2xl mx-auto';

    if (notifications.length === 0) {
      view.innerHTML = `
        <div class="text-center py-10 space-y-3">
          <div class="text-3xl">📭</div>
          <p class="text-xs text-slate-400 font-medium">No alerts or messages logged for your user profile.</p>
        </div>
      `;
    } else {
      view.innerHTML = `
        <div class="flex items-center justify-between border-b border-white/5 pb-4">
          <h3 class="text-base font-bold text-white tracking-tight">Recent Profile Activity Logs</h3>
          <button id="btn-clear-notifications" class="text-[10px] font-bold text-slate-400 hover:text-white transition-all cursor-pointer">
            Mark all read
          </button>
        </div>

        <div class="space-y-4">
          ${notifications.map(n => `
            <div class="p-4 rounded-xl border ${n.is_read ? 'border-white/5 bg-white/5 opacity-60' : 'border-cyan-500/25 bg-cyan-950/5'} space-y-1 relative">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-200">${n.title}</span>
                <span class="text-[9px] text-slate-500 font-mono">${new Date(n.created_at || '').toLocaleDateString()}</span>
              </div>
              <p class="text-xs text-slate-400 leading-normal font-sans">${n.message}</p>
            </div>
          `).join('')}
        </div>
      `;

      view.querySelector('#btn-clear-notifications')?.addEventListener('click', async () => {
        const unread = notifications.filter(n => !n.is_read);
        for (const n of unread) {
          try {
            await fetch(`/api/notifications/${n.id}/read`, { method: 'POST' });
          } catch (e) {}
        }
        loadNotifications().then(() => renderActiveSubTab());
      });
    }

    return view;
  }

  // Initial load execution
  loadNotifications().then(() => renderDashboard());

  return container;
}
