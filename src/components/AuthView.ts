import { STATE_NAMES, STATE_CITY_MAP } from '../data/indianStates';

export function createLoginView(
  onLoginSuccess: (data: any, isSignup?: boolean) => void,
  showToast: (msg: string, isError?: boolean) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'max-w-md mx-auto py-10 px-4 sm:px-6 animate-fade-in';
  
  let isSignup = false;
  let selectedRole: 'candidate' | 'recruiter' = 'candidate';
  
  function renderForm() {
    container.innerHTML = `
      <div class="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl space-y-6">
        <div class="text-center">
          <h2 class="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-300 bg-clip-text text-transparent">
            ${isSignup ? 'Join CivicAI Platform' : 'Welcome Back'}
          </h2>
          <p class="mt-2 text-xs text-slate-400 leading-normal">
            ${isSignup 
              ? 'Create a unified credential to evaluate capabilities, track alignments, and plan career roadmaps.' 
              : 'Sign in to access secure role-based workspaces and ML demographic projections.'}
          </p>
        </div>

        <form id="auth-form" class="space-y-4">
          ${isSignup ? `
            <!-- Role Selection -->
            <div>
              <label class="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">Account Workspace Role</label>
              <div class="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
                <button type="button" id="role-cand" class="py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${selectedRole === 'candidate' ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-400' : 'text-slate-400 hover:text-white'}">
                  Candidate
                </button>
                <button type="button" id="role-rec" class="py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${selectedRole === 'recruiter' ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-400' : 'text-slate-400 hover:text-white'}">
                  Recruiter
                </button>
              </div>
            </div>
            
            ${selectedRole === 'recruiter' ? `
              <!-- Recruiter Specific Fields -->
              <div>
                <label for="auth-name" class="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">Company Name</label>
                <input type="text" id="auth-name" required class="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all" placeholder="e.g. CivicTech Solutions">
              </div>
              <div>
                <label for="auth-designation" class="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">Designation / Role Title</label>
                <input type="text" id="auth-designation" class="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all" placeholder="e.g. Hiring Coordinator">
              </div>
            ` : ''}
          ` : ''}
          
          <!-- Email Input -->
          <div>
            <label for="auth-email" class="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">Email Address</label>
            <input type="email" id="auth-email" required class="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all" placeholder="name@example.com">
          </div>
          
          <!-- Password Input -->
          <div>
            <label for="auth-password" class="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">Secure Password</label>
            <input type="password" id="auth-password" required minlength="6" class="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all" placeholder="••••••••">
          </div>
          
          <button type="submit" id="auth-submit-btn" class="w-full mt-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-bold text-xs tracking-wider uppercase shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer">
            <span>${isSignup ? 'Register Account' : 'Verify & Log In'}</span>
          </button>
        </form>
        
        <div class="pt-4 border-t border-white/5 text-center">
          <p class="text-xs text-slate-400">
            ${isSignup ? 'Already have an active account?' : "Don't have an account registered yet?"}
            <button id="toggle-auth-mode" class="ml-1 text-cyan-400 hover:underline font-bold focus:outline-none cursor-pointer">
              ${isSignup ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    `;
    
    // Attach toggle listeners
    container.querySelector('#toggle-auth-mode')?.addEventListener('click', () => {
      isSignup = !isSignup;
      renderForm();
    });
    
    if (isSignup) {
      container.querySelector('#role-cand')?.addEventListener('click', () => {
        selectedRole = 'candidate';
        renderForm();
      });
      container.querySelector('#role-rec')?.addEventListener('click', () => {
        selectedRole = 'recruiter';
        renderForm();
      });
    }
    
    // Submit Listener
    container.querySelector('#auth-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = container.querySelector('#auth-submit-btn') as HTMLButtonElement;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Processing Secure Validation...</span>`;
      }
      
      const email = (container.querySelector('#auth-email') as HTMLInputElement).value;
      const password = (container.querySelector('#auth-password') as HTMLInputElement).value;
      
      try {
        if (isSignup) {
          const payload: any = { email, password, role: selectedRole };
          
          if (selectedRole === 'candidate') {
            payload.name = email.split('@')[0];
          } else {
            const name = (container.querySelector('#auth-name') as HTMLInputElement).value;
            const designation = (container.querySelector('#auth-designation') as HTMLInputElement)?.value || 'Hiring Coordinator';
            payload.company_name = name;
            payload.designation = designation;
          }
          
          const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (res.ok && data.success) {
            onLoginSuccess(data, true);
            showToast("Account successfully registered! Welcome to CivicAI.");
          } else {
            showToast(data.error || "Signup failed.", true);
            renderForm();
          }
        } else {
          // Login
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            onLoginSuccess(data, false);
            showToast("Signed in successfully. Welcome back!");
          } else {
            showToast(data.error || "Invalid credentials. Please verify your email and password.", true);
            renderForm();
          }
        }
      } catch (err: any) {
        showToast("Server error. Please verify your connection.", true);
        renderForm();
      }
    });
  }
  
  renderForm();
  return container;
}
