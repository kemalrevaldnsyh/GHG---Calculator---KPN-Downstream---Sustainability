import './styles.css';
import { supabase, supabaseConfigured } from './supabase.js';

const app = document.getElementById('app');

const LINKS = [
  {
    id: 'ghg',
    title: 'GHG Calculator',
    desc: 'Emisi GHG — Refinery, ETD, Traceability, Raw Data',
    url: import.meta.env.VITE_GHG_APP_URL || '/',
    label: 'Buka aplikasi →',
  },
  {
    id: 'app2',
    title: import.meta.env.VITE_PORTAL_APP2_LABEL || 'Website 2',
    desc: 'Aplikasi sustainability kedua (atur URL di env Vercel)',
    url: import.meta.env.VITE_PORTAL_APP2_URL || '#',
    label: 'Buka aplikasi →',
  },
].filter((l) => l.url && l.url !== '#');

function shellHtml(inner, userEmail) {
  return `
    <div class="shell">
      <header class="topbar">
        <div>
          <div class="topbar-title">KPN Downstream Sustainability</div>
          <div class="topbar-sub">Secure portal</div>
        </div>
        ${userEmail ? `
          <div>
            <div class="user-chip">${escapeHtml(userEmail)}</div>
            <button type="button" class="btn btn-ghost" id="btn-logout" style="margin-top:6px">Keluar</button>
          </div>
        ` : ''}
      </header>
      <main class="main">${inner}</main>
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

function renderLogin(errorMsg) {
  const configWarn = !supabaseConfigured
    ? `<div class="alert alert-warn">Supabase belum dikonfigurasi. Set <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code> di Vercel atau <code>.env.local</code>.</div>`
    : '';

  app.innerHTML = shellHtml(`
    <div class="panel">
      <h1>Masuk</h1>
      <p class="lead">Login untuk mengakses portal aplikasi sustainability.</p>
      ${configWarn}
      ${errorMsg ? `<div class="alert alert-error">${escapeHtml(errorMsg)}</div>` : ''}
      <form id="login-form">
        <div class="field">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" autocomplete="username" required placeholder="nama@perusahaan.com" />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required placeholder="••••••••" />
        </div>
        <button type="submit" class="btn btn-primary" id="btn-login" ${supabaseConfigured ? '' : 'disabled'}>Masuk</button>
      </form>
      <p class="footer-note">Auth via Supabase · session disimpan di browser</p>
    </div>
  `);

  document.getElementById('login-form')?.addEventListener('submit', onLogin);
}

function renderGate(user) {
  const cards = (LINKS.length ? LINKS : [{
    title: 'GHG Calculator',
    desc: 'Set VITE_GHG_APP_URL di environment variables',
    url: '#',
    label: 'URL belum diset',
  }]).map((l) => `
    <a class="card-link" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">
      <h2>${escapeHtml(l.title)}</h2>
      <p>${escapeHtml(l.desc)}</p>
      <div class="go">${escapeHtml(l.label)}</div>
    </a>
  `).join('');

  app.innerHTML = shellHtml(`
    <div class="panel panel-wide">
      <h1>Pilih aplikasi</h1>
      <p class="lead">Anda sudah masuk. Pilih aplikasi yang ingin dibuka.</p>
      <div class="cards">${cards}</div>
      <p class="footer-note">Link membuka tab baru · akses langsung ke URL app tetap perlu dilindungi terpisah jika diperlukan</p>
    </div>
  `, user?.email);

  document.getElementById('btn-logout')?.addEventListener('click', onLogout);
}

async function onLogin(e) {
  e.preventDefault();
  if (!supabase) return;

  const btn = document.getElementById('btn-login');
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  btn.disabled = true;
  btn.textContent = 'Memproses…';

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    renderLogin(error.message);
    return;
  }

  renderGate(data.user);
}

async function onLogout() {
  if (!supabase) return;
  await supabase.auth.signOut();
  renderLogin();
}

async function init() {
  if (!supabaseConfigured) {
    renderLogin();
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    renderGate(session.user);
  } else {
    renderLogin();
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) renderGate(session.user);
    else renderLogin();
  });
}

init();
