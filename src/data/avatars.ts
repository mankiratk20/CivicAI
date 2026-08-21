export function getCandidateAvatar(gender?: string, className: string = "w-10 h-10"): string {
  const normGender = (gender || '').trim().toLowerCase();
  
  if (normGender === 'male') {
    return `
      <svg class="${className} rounded-full shadow-md border border-cyan-500/20" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="maleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#06b6d4" />
            <stop offset="100%" stop-color="#4f46e5" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="32" fill="url(#maleGrad)" />
        <path d="M18 28C18 20 24 16 32 16C40 16 46 20 46 28C46 29 45 30 44 30C43 30 42 29 42 28C42 23 38 20 32 20C26 20 22 23 22 28C22 29 21 30 20 30C19 30 18 29 18 28Z" fill="#ffffff" opacity="0.9" />
        <circle cx="32" cy="30" r="10" fill="#ffffff" />
        <path d="M14 50C14 43 22 40 32 40C42 40 50 43 50 50V54H14V50Z" fill="#ffffff" opacity="0.85" />
        <path d="M29 40L32 46L35 40H29Z" fill="#1e1b4b" opacity="0.9" />
      </svg>
    `;
  } else if (normGender === 'female') {
    return `
      <svg class="${className} rounded-full shadow-md border border-pink-500/20" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="femaleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ec4899" />
            <stop offset="100%" stop-color="#6366f1" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="32" fill="url(#femaleGrad)" />
        <path d="M16 28C16 18 22 14 32 14C42 14 48 18 48 28C48 35 46 38 45 40C44 42 43 36 43 32C43 23 38 18 32 18C26 18 21 23 21 32C21 36 20 42 19 40C18 38 16 35 16 28Z" fill="#ffffff" opacity="0.9" />
        <circle cx="32" cy="30" r="10" fill="#ffffff" />
        <path d="M14 50C14 43 22 40 32 40C42 40 50 43 50 50V54H14V50Z" fill="#ffffff" opacity="0.85" />
        <path d="M27 41C27 44 37 44 37 41" stroke="#312e81" stroke-width="2" stroke-linecap="round" opacity="0.8" />
      </svg>
    `;
  } else {
    return `
      <svg class="${className} rounded-full shadow-md border border-slate-500/20" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="otherGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#64748b" />
            <stop offset="100%" stop-color="#334155" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="32" fill="url(#otherGrad)" />
        <circle cx="32" cy="28" r="10" fill="#ffffff" opacity="0.9" />
        <path d="M14 48C14 41 22 38 32 38C42 38 50 41 50 48V52H14V48Z" fill="#ffffff" opacity="0.8" />
      </svg>
    `;
  }
}
