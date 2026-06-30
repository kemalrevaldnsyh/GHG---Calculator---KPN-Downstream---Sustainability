import '../styles/auth.css';
import { supabase, supabaseConfigured } from './supabase.js';

const GATE_ID = 'auth-gate';
const HUB_PORTAL_URL = (import.meta.env.VITE_HUB_PORTAL_URL || 'https://sustainability-hub-portal.vercel.app/').trim();

function brandLogoSvg() {
  return `
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M16 3L28 9.5V22.5L16 29L4 22.5V9.5L16 3Z" stroke="white" stroke-width="1.5" fill="none"/>
      <circle cx="16" cy="16" r="5.5" stroke="white" stroke-width="1.5" fill="none"/>
    </svg>
  `;
}

function brandBlock() {
  return `
    <div class="auth-brand">
      <div class="auth-brand-row">
        <div class="auth-brand-logo">${brandLogoSvg()}</div>
        <div>
          <div class="auth-brand-name">KPNCORP</div>
          <div class="auth-brand-dept">Downstream — Sustainability</div>
        </div>
      </div>
      <p class="auth-brand-tagline">Sustainable Supply. Responsible Refining.</p>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function gateEl() {
  let el = document.getElementById(GATE_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = GATE_ID;
    document.body.prepend(el);
  }
  return el;
}

function showGate() {
  gateEl().hidden = false;
  document.getElementById('app-root')?.setAttribute('hidden', '');
}

function hideGate() {
  gateEl().hidden = true;
  document.getElementById('app-root')?.removeAttribute('hidden');
}

function renderLogin(errorMsg) {
  const configWarn = !supabaseConfigured
    ? `<div class="auth-alert auth-alert-warn">Supabase belum dikonfigurasi. Set <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code> di Vercel.</div>`
    : '';

  gateEl().innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        ${brandBlock()}
        <hr class="auth-divider" />
        <h1 class="auth-title">Sign in</h1>
        <p class="auth-lead">Use your authorized account to access the GHG Calculator.</p>
        ${configWarn}
        ${errorMsg ? `<div class="auth-alert auth-alert-error">${escapeHtml(errorMsg)}</div>` : ''}
        <form id="auth-login-form">
          <div class="auth-field">
            <label for="auth-email">Email address</label>
            <input id="auth-email" name="email" type="email" autocomplete="username" required placeholder="you@company.com" />
          </div>
          <div class="auth-field">
            <label for="auth-password">Password</label>
            <input id="auth-password" name="password" type="password" autocomplete="current-password" required placeholder="••••••••" />
          </div>
          <button type="submit" class="auth-btn auth-btn-primary" id="auth-btn-login" ${supabaseConfigured ? '' : 'disabled'}>Sign in</button>
        </form>
        <a class="auth-back-link" href="${escapeHtml(HUB_PORTAL_URL)}">← Back to Sustainability Hub Portal</a>
      </div>
    </div>
  `;

  showGate();
  document.getElementById('auth-login-form')?.addEventListener('submit', onLogin);
}

async function onLogin(e) {
  e.preventDefault();
  if (!supabase) return;

  const btn = document.getElementById('auth-btn-login');
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  btn.disabled = true;
  btn.textContent = 'Signing in…';

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    renderLogin(error.message);
  }
}

let onAuthenticated = () => {};
let appStarted = false;

function enterApp() {
  hideGate();
  if (appStarted) return;
  appStarted = true;
  onAuthenticated();
}

export function requireAuthSession(callback) {
  onAuthenticated = callback;

  if (!supabaseConfigured) {
    hideGate();
    callback();
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.has('signout') && supabase) {
    supabase.auth.signOut().then(() => {
      window.history.replaceState({}, '', window.location.pathname);
      renderLogin();
    });
    return;
  }

  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      enterApp();
      return;
    }
    renderLogin();
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) enterApp();
    else renderLogin();
  });
}

export async function signOut() {
  if (!supabase) return;
  appStarted = false;
  await supabase.auth.signOut();
  renderLogin();
}

export function initLandingAuthUi() {
  if (!supabaseConfigured) return;

  const bar = document.getElementById('landing-auth-bar');
  const btn = document.getElementById('btn-landing-signout');
  const emailEl = document.getElementById('landing-user-email');
  if (!bar || !btn) return;

  bar.hidden = false;
  btn.addEventListener('click', () => { signOut(); });

  supabase.auth.getSession().then(({ data: { session } }) => {
    if (emailEl && session?.user?.email) {
      emailEl.textContent = session.user.email;
    }
  });
}
