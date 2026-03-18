// ===================== CONFIG =====================
const GITHUB_OWNER = 'YOUR_USERNAME';
const GITHUB_REPO  = 'YOUR_REPO';
const GITHUB_TOKEN = 'ghp_YOUR_TOKEN'; // Fine-grained token: Contents Read & Write
const CASES_PATH   = 'data/cases.json';
const JUDGES_PATH  = 'data/judges.json';
const GITHUB_API   = 'https://api.github.com';

let judgeSession = null; // { nick, token }

// ===================== GITHUB HELPERS =====================
async function ghGet(path) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
  };
  const res = await fetch(`${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`, { headers });
  if (!res.ok) throw new Error('GitHub fetch error');
  const data = await res.json();
  return { content: JSON.parse(atob(data.content)), sha: data.sha };
}

async function ghPut(path, content, sha, message) {
  const res = await fetch(`${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))),
      sha,
    }),
  });
  if (!res.ok) throw new Error('GitHub write error');
  return res.json();
}

// ===================== MOBILE NAV =====================
function toggleMenu() {
  document.getElementById('mobileNav').classList.toggle('open');
}
document.addEventListener('click', (e) => {
  const nav = document.getElementById('mobileNav');
  const toggle = document.querySelector('.nav-toggle');
  if (nav && toggle && !nav.contains(e.target) && !toggle.contains(e.target)) {
    nav.classList.remove('open');
  }
});

// ===================== LAW TABS =====================
function showLaw(id, btn) {
  document.querySelectorAll('.law-doc').forEach(d => d.style.display = 'none');
  document.querySelectorAll('.law-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('law-' + id).style.display = 'block';
  btn.classList.add('active');
}

// ===================== LOAD CASES =====================
async function loadCases() {
  try {
    const { content } = await ghGet(CASES_PATH);
    renderCasesTable(content);
    updateStats(content);
  } catch {
    console.error('Не удалось загрузить дела');
  }
}

function renderCasesTable(cases) {
  const tbody = document.querySelector('.cases-table tbody');
  if (!tbody) return;
  const active = cases.filter(c => c.status !== 'closed');
  if (!active.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">Активных дел нет</td></tr>';
    return;
  }
  tbody.innerHTML = active.map(c => `
    <tr>
      <td><span class="case-id">#${String(c.id).padStart(4,'0')}</span></td>
      <td>${esc(c.plaintiff)}</td>
      <td>${esc(c.defendant)}</td>
      <td><span class="tag tag-${c.case_type}">${caseTypeLabel(c.case_type)}</span></td>
      <td><span class="status status-${c.status}">${statusLabel(c.status)}</span></td>
      <td>${esc(c.judge_nick || '—')}</td>
    </tr>
  `).join('');
}

function updateStats(cases) {
  const closed = cases.filter(c => c.status === 'closed' || c.status === 'approved').length;
  const active = cases.filter(c => c.status === 'pending' || c.status === 'reviewing').length;
  const totalEl = document.querySelector('.stat-total');
  const activeEl = document.querySelector('.stat-active');
  if (totalEl) totalEl.textContent = closed;
  if (activeEl) activeEl.textContent = active;
}

// ===================== SUBMIT CASE =====================
async function submitCase(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Отправка...';

  try {
    const { content: cases, sha } = await ghGet(CASES_PATH);
    const newCase = {
      id: Date.now(),
      plaintiff:   document.getElementById('plaintiff').value.trim(),
      defendant:   document.getElementById('defendant').value.trim(),
      case_type:   document.getElementById('caseType').value,
      description: document.getElementById('description').value.trim(),
      evidence:    document.getElementById('evidence').value.trim(),
      discord:     document.getElementById('discord').value.trim(),
      status:      'pending',
      judge_nick:  null,
      verdict:     null,
      created_at:  new Date().toISOString(),
    };
    cases.push(newCase);
    await ghPut(CASES_PATH, cases, sha, `Новое дело #${newCase.id} от ${newCase.plaintiff}`);
    document.querySelector('.case-form').style.display = 'none';
    document.getElementById('formSuccess').classList.add('show');
    loadCases();
  } catch (err) {
    alert('Ошибка при отправке: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '⚖️ Подать иск';
  }
}

function resetForm() {
  document.querySelector('.case-form').reset();
  document.querySelector('.case-form').style.display = 'block';
  document.getElementById('formSuccess').classList.remove('show');
}

// ===================== LOGIN =====================
function openLogin() {
  document.getElementById('loginModal').classList.add('open');
  document.getElementById('loginError').textContent = '';
  document.getElementById('loginError').classList.remove('show');
}
function closeLogin() { document.getElementById('loginModal').classList.remove('open'); }
function closeLoginOutside(e) { if (e.target === document.getElementById('loginModal')) closeLogin(); }

async function loginJudge(e) {
  e.preventDefault();
  const btn = document.getElementById('loginSubmitBtn');
  const errEl = document.getElementById('loginError');
  btn.disabled = true;
  btn.textContent = 'Вход...';
  errEl.classList.remove('show');

  const nick     = document.getElementById('loginNick').value.trim();
  const password = document.getElementById('loginPass').value;

  try {
    const { content: judges } = await ghGet(JUDGES_PATH);
    const judge = judges.find(j => j.nick === nick && j.password === password);
    if (!judge) throw new Error('Неверный ник или пароль');

    judgeSession = { nick };
    document.getElementById('judgeLoggedName').textContent = '⚖️ ' + nick;
    document.getElementById('judgeLogged').style.display = 'flex';
    document.getElementById('loginBtn').style.display = 'none';
    closeLogin();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Войти';
  }
}

function logoutJudge() {
  judgeSession = null;
  document.getElementById('judgeLogged').style.display = 'none';
  document.getElementById('loginBtn').style.display = 'inline-block';
}

// ===================== JUDGE PANEL =====================
function openJudgePanel() {
  document.getElementById('judgePanelModal').classList.add('open');
  loadJudgeCases();
}
function closeJudgePanel() { document.getElementById('judgePanelModal').classList.remove('open'); }
function closeJudgePanelOutside(e) { if (e.target === document.getElementById('judgePanelModal')) closeJudgePanel(); }

async function loadJudgeCases() {
  const container = document.getElementById('judgePanelCases');
  container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">Загрузка...</p>';
  try {
    const { content: cases } = await ghGet(CASES_PATH);
    if (!cases.length) {
      container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">Дел нет</p>';
      return;
    }
    container.innerHTML = cases.map(c => `
      <div class="judge-case-card">
        <div class="judge-case-header">
          <span class="case-id">#${String(c.id).toString().slice(-4).padStart(4,'0')}</span>
          <span class="tag tag-${c.case_type}">${caseTypeLabel(c.case_type)}</span>
          <span class="status status-${c.status}">${statusLabel(c.status)}</span>
          <span style="font-size:.8rem;color:var(--text-muted);margin-left:auto">${new Date(c.created_at).toLocaleDateString('ru')}</span>
        </div>
        <div class="judge-case-body">
          <p><strong>Истец:</strong> ${esc(c.plaintiff)} &nbsp;|&nbsp; <strong>Ответчик:</strong> ${esc(c.defendant)}</p>
          <p class="judge-case-desc">${esc(c.description)}</p>
          ${c.evidence ? `<p style="font-size:.82rem;color:var(--text-muted)">📎 ${esc(c.evidence)}</p>` : ''}
          ${c.discord  ? `<p style="font-size:.82rem;color:var(--text-muted)">💬 ${esc(c.discord)}</p>`  : ''}
          ${c.verdict  ? `<p class="judge-verdict">⚖️ ${esc(c.verdict)}</p>` : ''}
        </div>
        <div class="judge-case-actions">
          <button class="btn-action btn-review"  onclick="judgeAction(${c.id},'reviewing')"         ${c.status==='reviewing'?'disabled':''}>🔍 Рассмотреть</button>
          <button class="btn-action btn-approve" onclick="openVerdict(${c.id},'approved')"                                               >✅ Одобрить</button>
          <button class="btn-action btn-close"   onclick="openVerdict(${c.id},'closed')"                                                >🔒 Закрыть</button>
        </div>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<p style="color:#ef5350;text-align:center">Ошибка загрузки</p>';
  }
}

async function judgeAction(id, status, verdict = null) {
  try {
    const { content: cases, sha } = await ghGet(CASES_PATH);
    const idx = cases.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Дело не найдено');
    cases[idx].status     = status;
    cases[idx].judge_nick = judgeSession.nick;
    cases[idx].verdict    = verdict;
    cases[idx].updated_at = new Date().toISOString();
    await ghPut(CASES_PATH, cases, sha, `Дело #${id}: статус → ${status} (${judgeSession.nick})`);
    loadJudgeCases();
    loadCases();
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
}

// ===================== VERDICT MODAL =====================
function openVerdict(id, status) {
  document.getElementById('verdictCaseId').value  = id;
  document.getElementById('verdictStatus').value  = status;
  document.getElementById('verdictText').value    = '';
  document.getElementById('verdictModal').classList.add('open');
}
function closeVerdict() { document.getElementById('verdictModal').classList.remove('open'); }
function closeVerdictOutside(e) { if (e.target === document.getElementById('verdictModal')) closeVerdict(); }

function submitVerdict() {
  const id      = Number(document.getElementById('verdictCaseId').value);
  const status  = document.getElementById('verdictStatus').value;
  const verdict = document.getElementById('verdictText').value.trim();
  closeVerdict();
  judgeAction(id, status, verdict || null);
}

// ===================== HELPERS =====================
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function caseTypeLabel(t) {
  return ({grief:'Гриферство',fraud:'Мошенничество',theft:'Кража',land:'Земельный спор',insult:'Оскорбления',cheat:'Читерство',other:'Другое'})[t] || t;
}
function statusLabel(s) {
  return ({pending:'Ожидает',reviewing:'На рассмотрении',approved:'Одобрено',closed:'Закрыто'})[s] || s;
}

// ===================== INIT =====================
loadCases();
