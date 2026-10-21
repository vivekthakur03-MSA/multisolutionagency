// Multisolution member portal: shared logic for login, register and the freelancer / vendor dashboards.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCwZ8-5XaKweQpW9MUmDIceCrasWPpovNg",
  authDomain: "multisolution-agency.firebaseapp.com",
  projectId: "multisolution-agency",
  storageBucket: "multisolution-agency.firebasestorage.app",
  messagingSenderId: "901377722666",
  appId: "1:901377722666:web:78cc1940bb28ddef483653"
};
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export { doc, getDoc, onAuthStateChanged };
export const MAIL = 'connect@multisolutionagency.in';
export const WA = 'https://chat.whatsapp.com/IH5iKda2vhbHXo5w8ZxIlA';
export const LI = 'https://www.linkedin.com/company/multisolution-agency/';
export const LANGUAGES = ['Hindi','English','Punjabi','Urdu','Bengali','Tamil','Telugu','Marathi','Gujarati','Kannada','Malayalam','Odia','Assamese','Bhojpuri','Awadhi','Maithili','Rajasthani','Haryanvi','Nepali','Sinhala','Arabic','French','Spanish','German','Japanese','Korean','Mandarin Chinese','Russian','Portuguese','Swahili','Indonesian','Thai','Vietnamese'];
export const COUNTRIES = ['India','Nepal','Bangladesh','Sri Lanka','Pakistan','United States','United Kingdom','Canada','Australia','United Arab Emirates','Saudi Arabia','Singapore','Malaysia','Philippines','Indonesia','Germany','France','Spain','Brazil','Nigeria','Kenya','South Africa'];

export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function fmtDate(ts){ const d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null); return d ? d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '-'; }
let toastT;
export function toast(m){ let t = $('toast'); if(!t){ t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); } t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }
export function friendly(e){
  const c = (e && e.code) || '';
  if(c === 'auth/email-already-in-use') return 'This email is already registered. Please log in instead.';
  if(/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return 'Incorrect email or password.';
  if(c === 'auth/weak-password') return 'Password is too weak. Use at least 8 characters.';
  if(c === 'auth/invalid-email') return 'Please enter a valid email address.';
  if(c === 'auth/too-many-requests') return 'Too many attempts. Please wait a few minutes and try again.';
  if(c === 'auth/network-request-failed') return 'Network problem. Please check your internet connection.';
  if(e && e.message === 'NO_MEMBER') return 'No freelancer or vendor account found for this email.';
  if(e && e.message === 'WRONG_ROLE') return 'This account is registered as a different type. Please choose the correct option above.';
  return 'Something went wrong. Please try again.';
}

// ---- IDs: 6 digits for freelancers, 8 digits for vendors ----
function randomId(digits){ const a = new Uint32Array(1); crypto.getRandomValues(a); const min = Math.pow(10, digits - 1); return String(min + (a[0] % (9 * min))); }
async function reserveId(uid, role, publicName){
  for(let i = 0; i < 15; i++){
    const id = randomId(role === 'vendor' ? 8 : 6);
    try{ await setDoc(doc(db,'userIds',id), { uid, role, name: publicName }); return id; }catch(e){ /* ID already taken: try another */ }
  }
  throw new Error('ID_FAILED');
}

// ---- Account ----
export async function registerAccount(role, email, password, profile){
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  try{
    const publicName = role === 'vendor' ? profile.company : profile.name;
    const userId = await reserveId(user.uid, role, publicName);
    await setDoc(doc(db,'users',user.uid), Object.assign({}, profile, { role, userId, email, photo: '', createdAt: serverTimestamp() }));
    try{ await sendEmailVerification(user); }catch(e){}
  }catch(e){ try{ await user.delete(); }catch(_){} throw e; }
  return role;
}
export async function loginAccount(role, email, password){
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db,'users',cred.user.uid));
  if(!snap.exists()){ await signOut(auth); throw new Error('NO_MEMBER'); }
  if(snap.data().role !== role){ await signOut(auth); throw new Error('WRONG_ROLE'); }
  return role;
}
export const sendReset = (email) => sendPasswordResetEmail(auth, email);
export const dashboardUrl = (role) => role === 'vendor' ? 'vendor.html' : 'freelancer.html';

export function guard(role, cb){
  let done = false;
  onAuthStateChanged(auth, async (user) => {
    if(done) return;
    if(!user){ location.replace('login.html?role=' + role); return; }
    let snap;
    try{ snap = await getDoc(doc(db,'users',user.uid)); }
    catch(e){ console.error(e); document.body.innerHTML = '<p style="padding:40px;color:#fff;font-family:sans-serif">Could not load your account. Please refresh the page.</p>'; return; }
    if(!snap.exists()){ await signOut(auth); location.replace('login.html?role=' + role); return; }
    const p = snap.data();
    if(p.role !== role){ location.replace(dashboardUrl(p.role)); return; }
    done = true; cb(user, p);
  });
}

// ---- Chip input (languages) ----
export function chipInput(input, addBtn, list, initial){
  let items = (initial || []).slice();
  const draw = () => { list.innerHTML = items.map((x,i) => `<span class="chip">${esc(x)}<button type="button" data-i="${i}" aria-label="Remove">&times;</button></span>`).join(''); };
  const add = () => { const v = input.value.trim(); if(v && !items.some(x => x.toLowerCase() === v.toLowerCase())) items.push(v); input.value = ''; draw(); };
  addBtn.addEventListener('click', add);
  input.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ','){ e.preventDefault(); add(); } });
  list.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if(b){ items.splice(+b.dataset.i, 1); draw(); } });
  draw();
  return { get: () => { if(input.value.trim()) add(); return items.slice(); }, set: (a) => { items = (a || []).slice(); draw(); } };
}
export function fillDatalist(el, arr){ el.innerHTML = arr.map(x => `<option value="${esc(x)}">`).join(''); }

export function compressPhoto(file){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const im = new Image(); im.onload = () => {
      const W = 360, H = 450, c = document.createElement('canvas'); c.width = W; c.height = H;
      const sc = Math.max(W / im.width, H / im.height), w = im.width * sc, h = im.height * sc;
      c.getContext('2d').drawImage(im, (W - w) / 2, (H - h) / 2, w, h); res(c.toDataURL('image/jpeg', .85));
    }; im.onerror = () => rej(new Error('bad image')); im.src = r.result; };
    r.onerror = () => rej(new Error('read')); r.readAsDataURL(file);
  });
}

// ---- Robotic intro (once per login session) ----
function intro(role, uid){
  if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const k = 'msa_intro_' + uid; if(sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1');
  const V = role === 'vendor';
  const lines = V ? ['> BOOTING VENDOR CONSOLE...','> LOADING TEAM REGISTRY...','> SYNCING VENDOR PROFILE...','> ACCESS GRANTED'] : ['> BOOTING CONTRIBUTOR CORE...','> LOADING LANGUAGE MODULES...','> SYNCING YOUR PROFILE...','> ACCESS GRANTED'];
  const el = document.createElement('div'); el.id = 'intro';
  el.innerHTML = `<div class="gr"></div><div class="in"><h2>MULTI<b>SOLUTION</b></h2>${lines.map(() => '<p></p>').join('')}<div class="bar"><i></i></div></div><button class="skip" type="button">SKIP</button>`;
  document.body.appendChild(el);
  const ps = el.querySelectorAll('p'), bar = el.querySelector('.bar i'); let dead = false;
  const finish = () => { if(dead) return; dead = true; el.classList.add('out'); setTimeout(() => el.remove(), 700); };
  el.querySelector('.skip').addEventListener('click', finish);
  (async () => {
    for(let i = 0; i < lines.length && !dead; i++){
      for(let c = 0; c <= lines[i].length && !dead; c++){ ps[i].textContent = lines[i].slice(0, c); await new Promise(r => setTimeout(r, 16)); }
      if(i === lines.length - 1) ps[i].className = 'ok';
      bar.style.width = ((i + 1) / lines.length * 100) + '%'; await new Promise(r => setTimeout(r, 200));
    }
    setTimeout(finish, 350);
  })();
}

// ---- ID card (drawn on a canvas so what you see is what you download) ----
function loadImg(src){ return new Promise(res => { if(!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
function rr(x, X, Y, W, H, R){ x.beginPath(); x.moveTo(X+R,Y); x.arcTo(X+W,Y,X+W,Y+H,R); x.arcTo(X+W,Y+H,X,Y+H,R); x.arcTo(X,Y+H,X,Y,R); x.arcTo(X,Y,X+W,Y,R); x.closePath(); }
function fit(x, t, maxW){ t = String(t); while(x.measureText(t).width > maxW && t.length > 2) t = t.slice(0, -2); return t; }
let idSeq = 0;
async function drawIdCard(canvas, p, role){
  const seq = ++idSeq, V = role === 'vendor';
  try{ await Promise.all([document.fonts.load('800 30px Montserrat'), document.fonts.load('600 20px Inter')]); }catch(e){}
  const logo = await loadImg('msa-logo.jpg'), photo = await loadImg(p.photo);
  if(seq !== idSeq) return;
  const x = canvas.getContext('2d'), W = 640, H = 1010;
  const C = V ? { a: '#0A2463', b: '#061745', ac: '#D9962B', soft: '#F6E7C8', ink: '#7A4E0A' } : { a: '#0B3A5C', b: '#041224', ac: '#19D3C5', soft: '#D7F6F2', ink: '#0B6F68' };
  const name = V ? (p.company || p.name) : p.name;
  x.clearRect(0,0,W,H); x.save(); rr(x,0,0,W,H,36); x.clip();
  x.fillStyle = '#fff'; x.fillRect(0,0,W,H);
  const g = x.createLinearGradient(0,0,W,300); g.addColorStop(0,C.a); g.addColorStop(1,C.b); x.fillStyle = g; x.fillRect(0,0,W,300);
  x.save(); x.beginPath(); x.rect(0,0,W,300); x.clip();
  x.fillStyle = 'rgba(255,255,255,.07)'; x.beginPath(); x.arc(W-40,30,150,0,7); x.fill();
  x.fillStyle = C.ac; x.globalAlpha = .22; x.beginPath(); x.arc(30,280,120,0,7); x.fill(); x.globalAlpha = 1; x.restore();
  x.fillStyle = C.ac; x.fillRect(0,300,W,8);
  x.textAlign = 'center';
  if(logo){ x.fillStyle = '#fff'; rr(x,W/2-44,28,88,70,12); x.fill(); const r = Math.min(76/logo.width, 58/logo.height); x.drawImage(logo, W/2-logo.width*r/2, 63-logo.height*r/2, logo.width*r, logo.height*r); }
  x.fillStyle = '#fff'; x.font = '800 32px Montserrat, sans-serif'; x.fillText('MULTISOLUTION AGENCY', W/2, 146);
  x.fillStyle = C.ac; x.font = '700 18px Inter, sans-serif'; x.fillText(V ? 'VENDOR ID CARD' : 'FREELANCER ID CARD', W/2, 180);
  x.fillStyle = 'rgba(255,255,255,.7)'; x.font = '600 14px Inter, sans-serif'; x.fillText('OFFICIAL MEMBER IDENTITY', W/2, 210);
  const cx = W/2, cy = 330, R = 100;
  x.fillStyle = '#fff'; x.beginPath(); x.arc(cx,cy,R+10,0,7); x.fill(); x.lineWidth = 6; x.strokeStyle = C.ac; x.stroke();
  x.save(); x.beginPath(); x.arc(cx,cy,R,0,7); x.clip();
  if(photo){ const s = Math.max(2*R/photo.width, 2*R/photo.height); x.drawImage(photo, cx-photo.width*s/2, cy-photo.height*s/2, photo.width*s, photo.height*s); }
  else { x.fillStyle = C.a; x.fillRect(cx-R,cy-R,2*R,2*R); x.fillStyle = '#fff'; x.font = '800 90px Montserrat, sans-serif'; x.textBaseline = 'middle'; x.fillText((name.charAt(0) || 'U').toUpperCase(), cx, cy+4); x.textBaseline = 'alphabetic'; }
  x.restore();
  x.fillStyle = C.a; x.font = '800 34px Montserrat, sans-serif'; x.fillText(fit(x, name, W-80), cx, 498);
  const role2 = V ? 'VENDOR' : 'FREELANCER'; x.font = '700 16px Montserrat, sans-serif'; const pw = x.measureText(role2).width + 44;
  x.fillStyle = C.soft; rr(x,cx-pw/2,520,pw,38,19); x.fill(); x.fillStyle = C.ink; x.fillText(role2, cx, 545);
  const langs = (p.languages || []); const lt = langs.length > 3 ? langs.slice(0,3).join(', ') + ' +' + (langs.length-3) : (langs.join(', ') || '-');
  const rows = [['USER ID', p.userId], ['LANGUAGES', lt], ['COUNTRY', p.country || '-'], [V ? 'CONTACT PERSON' : 'MEMBER SINCE', V ? (p.name || '-') : fmtDate(p.createdAt)]];
  x.textAlign = 'left'; let Y = 622;
  rows.forEach(r => { x.fillStyle = '#8A96B5'; x.font = '700 13px Inter, sans-serif'; x.fillText(r[0], 60, Y); x.fillStyle = '#14203F'; x.font = '600 21px Inter, sans-serif'; x.fillText(fit(x, r[1], W-120), 60, Y+27); Y += 66; });
  x.fillStyle = C.b; x.fillRect(0,H-84,W,84); x.fillStyle = C.ac; x.fillRect(0,H-84,W,4);
  x.textAlign = 'center'; x.fillStyle = '#fff'; x.font = '700 17px Montserrat, sans-serif'; x.fillText('Multisolution Agency \u00b7 Patiala, Punjab, India', W/2, H-44);
  x.fillStyle = 'rgba(255,255,255,.65)'; x.font = '600 13px Inter, sans-serif'; x.fillText('multisolutionagency.in', W/2, H-20);
  x.restore();
}

// ---- Dashboard ----
const ICONS = {
  dash: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M22 20a6 6 0 0 0-4-5.6"/>',
  post: '<path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/>',
  id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.5-1.5 2-2 3-2s2.5.5 3 2M15 10h3M15 14h3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>'
};
const ic = (k) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;
function linkify(t){
  return esc(t).replace(/(https?:\/\/[^\s<]+|www\.[^\s<]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9.-]+)/gi, (m) => {
    let tail = '', core = m; while(/[.,;:!?)\]]$/.test(core)){ tail = core.slice(-1) + tail; core = core.slice(0,-1); }
    const href = /^https?:/i.test(core) ? core : (/^www\./i.test(core) ? 'https://' + core : 'mailto:' + core);
    return `<a href="${href}" target="_blank" rel="noopener nofollow">${core}</a>${tail}`;
  });
}

export function startDashboard(role){
  document.body.dataset.theme = role;
  let started = false;
  guard(role, (user, p) => { if(started) return; started = true; build(role, user, p); });
}

function build(role, user, p){
  const V = role === 'vendor';
  let profile = p, members = [], projects = [], pending = null, q = '';
  const publicName = () => V ? (profile.company || profile.name) : profile.name;
  const NAV = [['overview','Overview','dash'], [V ? 'team' : 'vendors', V ? 'My Team' : 'My Vendors', 'team'], ['projects','Open Projects','post'], ['payments','Payments','wallet'], ['idcard','ID Card','id'], ['profile','My Profile','user']];
  const TITLES = {}; NAV.forEach(n => TITLES[n[0]] = n[1]);
  const codeCard = V ? `<div class="code-card"><div style="flex:1;min-width:200px"><small>YOUR TEAM CODE (VENDOR ID)</small><b>${esc(p.userId)}</b><span class="mu" style="font-size:.84rem">Share this code. Freelancers who enter it join your team instantly.</span></div><button class="btn" data-copy="${esc(p.userId)}" type="button">Copy code</button></div>` : '';
  const projHtml = '<div class="pj-grid" id="pjGrid"></div>';
  $('app').innerHTML = `
  <div class="app">
    <aside class="sb" id="sidebar">
      <div class="sb-brand"><img src="msa-logo.jpg" alt=""><div><b>Multisolution</b><small>${V ? 'VENDOR CONSOLE' : 'CONTRIBUTOR HUB'}</small></div></div>
      <nav class="sb-nav">${NAV.map((n,i) => `<button class="nav-i${i ? '' : ' on'}" data-v="${n[0]}" type="button">${ic(n[2])}${n[1]}</button>`).join('')}</nav>
      <div class="sb-bot"><a href="index.html">&larr; Back to website</a></div>
    </aside>
    <div class="sb-scrim" id="scrim"></div>
    <div class="mn">
      <div class="tb">
        <button class="menu-btn" id="menuBtn" type="button" aria-label="Menu">${ic('menu')}</button>
        <h1 id="pageTitle">Overview</h1>
        <div class="tb-r"><div class="chip-u"><div class="avatar" id="tbAv"></div><div><b id="tbName"></b><span>${V ? 'VENDOR' : 'FREELANCER'} &middot; ${esc(p.userId)}</span></div></div><button class="btn line sm" id="logoutBtn" type="button">Log out</button></div>
      </div>
      <div class="ct">
        <section class="view" id="v-overview">
          <div class="hello"><div class="avatar big" id="helloAv"></div><div><h2 id="helloName"></h2><p class="mu">${V ? 'Vendor' : 'Freelancer'} ID <b style="color:var(--ac)">${esc(p.userId)}</b></p></div></div>
          <div id="verifyBar" style="margin-top:20px"></div>
          <div class="stats">
            <div class="stat"><b id="sMem">0</b><span>${V ? 'Team members' : 'Vendors I work with'}</span></div>
            <div class="stat"><b>0</b><span>Work assigned</span></div>
            <div class="stat"><b id="sProj">0</b><span>Open projects</span></div>
            <div class="stat"><b>0</b><span>Payments recorded</span></div>
          </div>
          ${codeCard}
          <div class="pn"><div class="pn-h"><h3>My work</h3></div><div class="empty"><b>No work assigned yet</b>When a project is assigned to you, it will appear here.</div></div>
          <div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn" data-go="${V ? 'team' : 'vendors'}" type="button">${V ? 'Manage my team' : 'Join a vendor'}</button><button class="btn line" data-go="projects" type="button">See open projects</button></div>
        </section>
        <section class="view" id="v-${V ? 'team' : 'vendors'}" hidden>
          ${V ? codeCard : ''}
          <div class="note">${V ? 'You can see each member\'s name and ID. Work details are shown only for work you send them.' : 'You can join as many vendors as you like. You can remove a vendor at any time and work on your own.'}</div>
          <div class="pn"><div class="pn-h"><h3>${V ? 'Add a member by ID' : 'Join a vendor'}</h3></div><div class="pn-b">
            <form class="join" id="joinForm"><div class="f"><label for="joinCode">${V ? 'Freelancer ID (6 digits)' : 'Vendor code (8 digits)'}</label><input id="joinCode" inputmode="numeric" maxlength="${V ? 6 : 8}" placeholder="${V ? 'e.g. 482916' : 'e.g. 73920415'}" required></div><button class="btn" id="joinBtn" type="submit">${V ? 'Add member' : 'Join'}</button></form>
            <p class="msg" id="joinMsg"></p>
            ${V ? '<p class="mu" style="font-size:.8rem;margin-top:10px">The freelancer must already be registered. Ask them to register first and share their ID.</p>' : ''}
          </div></div>
          <div class="pn"><div class="pn-h"><h3>${V ? 'My team' : 'My vendors'}</h3><span class="badge ac" id="mCount">0</span>${V ? '<input id="mSearch" placeholder="Search name or ID" style="margin-left:auto;background:rgba(255,255,255,.06);border:1px solid var(--line);border-radius:999px;padding:8px 14px;color:var(--tx);font:inherit;font-size:.84rem">' : ''}</div><div id="mList"></div></div>
        </section>
        <section class="view" id="v-projects" hidden>
          <div class="note">Open projects from Multisolution Agency. Open a project to read the details and apply or contact us.</div>
          ${projHtml}
        </section>
        <section class="view" id="v-payments" hidden>
          <div class="stats" style="grid-template-columns:repeat(3,1fr)"><div class="stat"><b>0</b><span>Total received</span></div><div class="stat"><b>-</b><span>Last payment</span></div><div class="stat"><b>0</b><span>Records</span></div></div>
          <div class="pn"><div class="pn-h"><h3>Payment records</h3></div><div class="empty"><b>No payment records yet</b>Payments are sent from the company bank account. Each payment will be recorded here with the amount, date and reference number.${V ? '<br>Only your own payments are shown here.' : ''}</div></div>
        </section>
        <section class="view" id="v-idcard" hidden>
          <div class="pn"><div class="pn-h"><h3>My ID card</h3></div><div class="pn-b"><div class="idwrap"><canvas id="idCanvas" width="640" height="1010"></canvas>
            <div style="flex:1;min-width:240px;max-width:380px"><h3 style="font-size:1.05rem">Your ${V ? 'vendor' : 'freelancer'} ID card</h3><p class="mu" style="margin:8px 0 18px">It is made from your profile. Update your photo or details in My Profile and the card changes instantly.</p><button class="btn" id="idDl" type="button">Download ID card</button></div></div></div></div>
        </section>
        <section class="view" id="v-profile" hidden>
          <div class="pn" style="max-width:720px"><div class="pn-h"><h3>My profile</h3></div><div class="pn-b">
            <div class="pf-photo"><div class="avatar xl" id="pfAv"></div><div><label for="photoIn" class="btn line sm" style="cursor:pointer">Upload photo</label><input type="file" id="photoIn" accept="image/*" hidden> <button class="btn line sm" id="photoRm" type="button">Remove</button><p class="mu" style="font-size:.78rem;margin-top:6px">Shown on your dashboard and ID card.</p></div></div>
            <div class="row2"><div class="f"><label>${V ? 'Vendor ID (team code)' : 'Freelancer ID'}</label><input value="${esc(p.userId)}" readonly></div><div class="f"><label>Email</label><input value="${esc(p.email || user.email)}" readonly></div></div>
            ${V ? '<div class="row2"><div class="f"><label for="pCompany">Company / team name</label><input id="pCompany"></div><div class="f"><label for="pTeam">Team size</label><input id="pTeam" type="number" min="1"></div></div>' : ''}
            <div class="row2"><div class="f"><label for="pName">${V ? 'Contact person name' : 'Full name'}</label><input id="pName"></div><div class="f"><label for="pPhone">Phone</label><input id="pPhone" type="tel"></div></div>
            <div class="f"><label for="pCountry">Country</label><input id="pCountry" list="dlC"></div>
            <div class="f"><label for="pLang">Languages</label><div class="join"><div class="f"><input id="pLang" list="dlL" placeholder="Type or pick a language"></div><button class="btn line sm" id="pLangAdd" type="button">Add</button></div><div class="chips" id="pLangList"></div></div>
            <div class="f"><label for="pExp">Experience</label><textarea id="pExp"></textarea></div>
            <div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn" id="pSave" type="button">Save profile</button><button class="btn line" id="pReset" type="button">Send password reset link</button></div>
            <datalist id="dlC"></datalist><datalist id="dlL"></datalist>
          </div></div>
        </section>
      </div>
    </div>
  </div>
  <div class="md" id="pdm" hidden><div class="md-box"><button class="md-x" id="pdX" type="button" aria-label="Close">&times;</button><div id="pdBody"></div></div></div>
  <div class="md" id="cfm" hidden><div class="md-box sm"><h3>Are you sure?</h3><p class="mu" id="cfT" style="margin-top:8px"></p><div class="md-act"><button class="btn line sm" id="cfNo" type="button">Cancel</button><button class="btn danger sm" id="cfOk" type="button">Remove</button></div></div></div>`;

  // ---- helpers ----
  const setAv = (el, photo, name) => { el.style.backgroundImage = photo ? `url(${photo})` : ''; el.textContent = photo ? '' : ((name || 'U').trim().charAt(0) || 'U').toUpperCase(); };
  const ask = (text) => new Promise(res => { $('cfT').textContent = text; $('cfm').hidden = false; const done = (v) => { $('cfm').hidden = true; res(v); }; $('cfOk').onclick = () => done(true); $('cfNo').onclick = () => done(false); });
  function show(v){
    document.querySelectorAll('.view').forEach(x => x.hidden = x.id !== 'v-' + v);
    document.querySelectorAll('.nav-i').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    $('pageTitle').textContent = TITLES[v] || 'Overview'; $('sidebar').classList.remove('open'); $('scrim').classList.remove('open');
    if(history.replaceState) history.replaceState(null, '', '#' + v);
    if(v === 'idcard') drawIdCard($('idCanvas'), profile, role);
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', (e) => {
    const n = e.target.closest('.nav-i'); if(n) show(n.dataset.v);
    const g = e.target.closest('[data-go]'); if(g) show(g.dataset.go);
    const c = e.target.closest('[data-copy]'); if(c){ navigator.clipboard.writeText(c.dataset.copy).then(() => toast('Code copied')).catch(() => toast(c.dataset.copy)); }
  });
  $('menuBtn').addEventListener('click', () => { $('sidebar').classList.add('open'); $('scrim').classList.add('open'); });
  $('scrim').addEventListener('click', () => { $('sidebar').classList.remove('open'); $('scrim').classList.remove('open'); });
  $('logoutBtn').addEventListener('click', async () => { await signOut(auth); location.replace('login.html?role=' + role); });

  function refreshProfileUi(){
    const n = V ? (profile.company || profile.name) : profile.name;
    $('tbName').textContent = n; $('helloName').textContent = 'Welcome, ' + (profile.name || n);
    setAv($('tbAv'), profile.photo, n); setAv($('helloAv'), profile.photo, n); setAv($('pfAv'), pending === null ? profile.photo : pending, n);
    $('pName').value = profile.name || ''; $('pPhone').value = profile.phone || ''; $('pCountry').value = profile.country || ''; $('pExp').value = profile.experience || '';
    if(V){ $('pCompany').value = profile.company || ''; $('pTeam').value = profile.teamSize || ''; }
    langs.set(profile.languages || []); pending = null;
    if(!$('v-idcard').hidden) drawIdCard($('idCanvas'), profile, role);
  }
  fillDatalist($('dlC'), COUNTRIES); fillDatalist($('dlL'), LANGUAGES);
  const langs = chipInput($('pLang'), $('pLangAdd'), $('pLangList'), profile.languages);
  refreshProfileUi();

  // verify email banner
  if(!user.emailVerified){
    $('verifyBar').innerHTML = `<div class="note warn">Please verify your email address. We sent a link to <b>${esc(user.email)}</b>. <button class="au-link" id="vResend" type="button">Resend link</button> &middot; <button class="au-link" id="vDone" type="button">I have verified</button></div>`;
    $('vResend').onclick = async () => { try{ await sendEmailVerification(user); toast('Verification email sent'); }catch(e){ toast(friendly(e)); } };
    $('vDone').onclick = async () => { try{ await user.reload(); }catch(e){} location.reload(); };
  }

  // ---- profile actions ----
  $('photoIn').addEventListener('change', async function(){ const f = this.files[0]; this.value = ''; if(!f) return; if(!/^image\//.test(f.type)){ toast('Please choose an image'); return; } try{ pending = await compressPhoto(f); setAv($('pfAv'), pending, publicName()); toast('Photo selected. Click Save profile.'); }catch(e){ toast('Could not read this image'); } });
  $('photoRm').addEventListener('click', () => { pending = ''; setAv($('pfAv'), '', publicName()); });
  $('pReset').addEventListener('click', async () => { try{ await sendReset(user.email); toast('Password reset link sent to your email'); }catch(e){ toast(friendly(e)); } });
  $('pSave').addEventListener('click', async () => {
    const name = $('pName').value.trim(); if(!name){ toast('Please enter your name'); return; }
    const data = { name, phone: $('pPhone').value.trim(), country: $('pCountry').value.trim(), languages: langs.get(), experience: $('pExp').value.trim(), photo: pending === null ? (profile.photo || '') : pending };
    if(V){ data.company = $('pCompany').value.trim(); data.teamSize = parseInt($('pTeam').value, 10) || 0; if(!data.company){ toast('Please enter your company or team name'); return; } }
    const btn = $('pSave'); btn.disabled = true;
    try{
      const oldPub = publicName();
      await updateDoc(doc(db,'users',user.uid), data);
      profile = Object.assign({}, profile, data);
      if(publicName() !== oldPub){
        await updateDoc(doc(db,'userIds',profile.userId), { name: publicName() });
        const snap = await getDocs(query(collection(db,'memberships'), where(V ? 'vendorUid' : 'freelancerUid', '==', user.uid)));
        for(const d of snap.docs){ await updateDoc(d.ref, V ? { vendorName: publicName() } : { freelancerName: publicName() }); }
      }
      refreshProfileUi(); toast('Profile saved');
    }catch(e){ console.error(e); toast('Could not save profile. Please try again.'); }
    btn.disabled = false;
  });
  $('idDl').addEventListener('click', async () => {
    await drawIdCard($('idCanvas'), profile, role);
    $('idCanvas').toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'MSA_ID_' + profile.userId + '.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('ID card downloaded'); }, 'image/png');
  });

  // ---- vendor <-> freelancer links ----
  const msg = (t, ok) => { const m = $('joinMsg'); m.textContent = t; m.className = 'msg ' + (ok ? 'ok' : 'err'); m.style.display = 'block'; };
  $('joinForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('joinMsg').style.display = 'none';
    const code = $('joinCode').value.trim(), need = V ? 6 : 8;
    if(!new RegExp('^\\d{' + need + '}$').test(code)){ msg(V ? 'Freelancer ID must be 6 digits.' : 'Vendor code must be 8 digits.'); return; }
    const btn = $('joinBtn'); btn.disabled = true;
    try{
      const s = await getDoc(doc(db,'userIds',code));
      if(!s.exists() || s.data().role !== (V ? 'freelancer' : 'vendor')){ msg(V ? 'No registered freelancer found with this ID.' : 'No vendor found with this code.'); btn.disabled = false; return; }
      const o = s.data(), vendorUid = V ? user.uid : o.uid, freeUid = V ? o.uid : user.uid, id = vendorUid + '_' + freeUid;
      if(members.some(m => m.id === id)){ msg(V ? 'This freelancer is already in your team.' : 'You are already in this vendor\'s team.'); btn.disabled = false; return; }
      await setDoc(doc(db,'memberships',id), { vendorUid, vendorId: V ? profile.userId : code, vendorName: V ? publicName() : o.name, freelancerUid: freeUid, freelancerId: V ? code : profile.userId, freelancerName: V ? o.name : publicName(), joinedBy: V ? 'vendor' : 'freelancer', createdAt: serverTimestamp() });
      $('joinCode').value = ''; msg(V ? o.name + ' was added to your team.' : 'You joined ' + o.name + '.', true);
    }catch(err){ console.error(err); msg('Could not complete this. Please try again.'); }
    btn.disabled = false;
  });
  function renderMembers(){
    $('mCount').textContent = members.length; $('sMem').textContent = members.length;
    let list = members.slice(); if(V && q){ const s = q.toLowerCase(); list = list.filter(m => (m.freelancerName || '').toLowerCase().includes(s) || (m.freelancerId || '').includes(s)); }
    $('mList').innerHTML = list.length ? list.map(m => {
      const nm = V ? m.freelancerName : m.vendorName, idv = V ? m.freelancerId : m.vendorId;
      const by = V ? (m.joinedBy === 'freelancer' ? 'Joined with your code' : 'Added by you') : (m.joinedBy === 'freelancer' ? 'You joined' : 'Added by vendor');
      return `<div class="li"><div class="avatar">${esc((nm || 'U').charAt(0).toUpperCase())}</div><div class="grow"><b>${esc(nm)}</b><small>${V ? 'Freelancer' : 'Vendor'} ID ${esc(idv)} &middot; ${fmtDate(m.createdAt)}</small></div><span class="badge">${by}</span><button class="btn line sm" data-rm="${esc(m.id)}" type="button">Remove</button></div>`;
    }).join('') : `<div class="empty"><b>${members.length ? 'No match found' : (V ? 'Your team is empty' : 'You are not in any vendor team')}</b>${members.length ? 'Try a different name or ID.' : (V ? 'Share your team code, or add a registered freelancer by ID.' : 'Enter a vendor code above to join. You can also work on your own.')}</div>`;
  }
  $('mList').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-rm]'); if(!b) return;
    const m = members.find(x => x.id === b.dataset.rm); if(!m) return;
    const nm = V ? m.freelancerName : m.vendorName;
    if(await ask(V ? `Remove ${nm} from your team?` : `Leave ${nm}'s team? You can work on your own or join again later.`)){
      try{ await deleteDoc(doc(db,'memberships',m.id)); toast(V ? 'Member removed' : 'You left the team'); }catch(err){ toast('Could not remove. Please try again.'); }
    }
  });
  if(V && $('mSearch')) $('mSearch').addEventListener('input', function(){ q = this.value.trim(); renderMembers(); });
  onSnapshot(query(collection(db,'memberships'), where(V ? 'vendorUid' : 'freelancerUid', '==', user.uid)), (snap) => {
    members = []; snap.forEach(d => { const x = d.data(); x.id = d.id; members.push(x); });
    members.sort((a,b) => ((b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0)));
    renderMembers();
  }, (err) => { console.warn(err); renderMembers(); });

  // ---- open projects ----
  function renderProjects(){
    $('sProj').textContent = projects.length;
    $('pjGrid').innerHTML = projects.length ? projects.map((d,i) => {
      const poster = /^(data:image\/|https:\/\/)/.test(d.poster || '') ? d.poster : '';
      return `<article class="pj"><div class="pj-img" style="${poster ? `background-image:url(${poster})` : ''}">${poster ? '' : esc(d.emoji || '\ud83d\udce3')}</div><div class="pj-b">${d.category ? `<span class="badge ac" style="align-self:flex-start">${esc(d.category)}</span>` : ''}<h4>${esc(d.title)}</h4><p>${esc(d.description)}</p><button class="btn sm" data-pj="${i}" type="button">View details &amp; apply</button></div></article>`;
    }).join('') : '<div class="pn" style="grid-column:1/-1"><div class="empty"><b>No open projects right now</b>New projects will appear here as soon as they are posted.</div></div>';
  }
  $('pjGrid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pj]'); if(!b) return; const d = projects[+b.dataset.pj]; if(!d) return;
    const subject = `Application: ${d.title} (${V ? 'Vendor' : 'Freelancer'} ID ${profile.userId})`;
    const body = `Hello Multisolution Agency,\n\nI would like to apply for: ${d.title}\n\nName: ${profile.name}\n${V ? 'Company: ' + (profile.company || '') + '\n' : ''}${V ? 'Vendor' : 'Freelancer'} ID: ${profile.userId}\nLanguages: ${(profile.languages || []).join(', ')}\nCountry: ${profile.country || ''}\n`;
    $('pdBody').innerHTML = `<h3 style="font-size:1.25rem;padding-right:34px">${esc(d.title)}</h3><p class="mu" style="margin-top:4px">${d.category ? esc(d.category) + ' &middot; ' : ''}${fmtDate(d.createdAt)}${d.needs ? ' &middot; Looking for: ' + esc(d.needs) : ''}</p><div class="pd-desc">${linkify(d.description || '')}</div>
      <div class="md-act" style="justify-content:flex-start"><a class="btn" href="mailto:${MAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}">Apply by email</a><a class="btn line" href="${WA}" target="_blank" rel="noopener">WhatsApp</a><a class="btn line" href="${LI}" target="_blank" rel="noopener">LinkedIn</a></div>
      <p class="mu" style="font-size:.8rem;margin-top:14px">Email: <a href="mailto:${MAIL}" style="color:var(--ac)">${MAIL}</a> &middot; Your name and ID are added to the email automatically.</p>`;
    $('pdm').hidden = false;
  });
  $('pdX').addEventListener('click', () => $('pdm').hidden = true);
  $('pdm').addEventListener('click', (e) => { if(e.target === $('pdm')) $('pdm').hidden = true; });
  onSnapshot(query(collection(db,'liveUpdates'), orderBy('createdAt','desc')), (snap) => { projects = []; snap.forEach(d => projects.push(d.data())); renderProjects(); }, () => { projects = []; renderProjects(); });

  const h = (location.hash || '').slice(1); show(TITLES[h] ? h : 'overview');
  intro(role, user.uid);
}
