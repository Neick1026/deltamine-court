let judgeSession = null;

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
    const cases = await DB.getCases();
    renderCasesTable(cases);
    updateStats(cases);
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
      <td><span class="case-id">#${String(c.id).slice(-4).padStart(4,'0')}</span></td>
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
  const total  = cases.length;
  const justice = total > 0 ? Math.round((closed / total) * 100) : 0;

  const totalEl   = document.querySelector('.stat-total');
  const activeEl  = document.querySelector('.stat-active');
  const justiceEl = document.querySelector('.stat-justice');
  if (totalEl)   totalEl.textContent   = closed;
  if (activeEl)  activeEl.textContent  = active;
  if (justiceEl) justiceEl.textContent = justice + '%';
  // Судьи: 3 (без ftr26)
  const judgesEl = document.querySelector('.stat-judges');
  if (judgesEl) judgesEl.textContent = '3';
}

// ===================== SUBMIT CASE =====================
async function submitCase(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Отправка...';

  try {
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
    await DB.addCase(newCase);
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
    const judges = await DB.getJudges();
    const judge = judges.find(j => j.nick === nick && j.password === password);
    if (!judge) throw new Error('Неверный ник или пароль');

    judgeSession = { nick, isAdmin: !!judge.admin };
    document.getElementById('judgeLoggedName').textContent = '⚖️ ' + nick;
    document.getElementById('judgeLogged').style.display = 'flex';
    document.getElementById('loginBtn').style.display = 'none';
    if (judge.admin) document.getElementById('adminOpenBtn').style.display = 'inline-flex';
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
  document.getElementById('adminOpenBtn').style.display = 'none';
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
    const cases = await DB.getCases();
    if (!cases.length) {
      container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">Дел нет</p>';
      return;
    }
    container.innerHTML = cases.map(c => `
      <div class="judge-case-card">
        <div class="judge-case-header">
          <span class="case-id">#${String(c.id).slice(-4).padStart(4,'0')}</span>
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
          <button class="btn-action btn-review"  onclick="judgeAction(${c.id},'reviewing')"       ${c.status==='reviewing'?'disabled':''}>🔍 Рассмотреть</button>
          <button class="btn-action btn-approve" onclick="openVerdict(${c.id},'approved')"        >✅ Одобрить</button>
          <button class="btn-action btn-close"   onclick="openVerdict(${c.id},'closed')"          >🔒 Закрыть</button>
        </div>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<p style="color:#ef5350;text-align:center">Ошибка загрузки</p>';
  }
}

async function judgeAction(id, status, verdict = null) {
  try {
    // Сбрасываем кэш чтобы получить свежий SHA
    DB._casesSha = null;
    await DB.updateCase(id, {
      status,
      verdict,
      judge_nick: judgeSession.nick,
      updated_at: new Date().toISOString()
    });
    await loadJudgeCases();
    await loadCases();
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
  if (!verdict) {
    alert('Напишите комментарий к вердикту');
    return;
  }
  closeVerdict();
  judgeAction(id, status, verdict);
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

// ===================== ADMIN PANEL =====================
function openAdminPanel() {
  document.getElementById('adminPanelModal').classList.add('open');
  loadAdminCases();
}
function closeAdminPanel() { document.getElementById('adminPanelModal').classList.remove('open'); }
function closeAdminOutside(e) { if (e.target === document.getElementById('adminPanelModal')) closeAdminPanel(); }

function showAdminTab(tab, btn) {
  document.getElementById('adminTabCases').style.display  = tab === 'cases'  ? 'block' : 'none';
  document.getElementById('adminTabJudges').style.display = tab === 'judges' ? 'block' : 'none';
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  if (tab === 'judges') loadAdminJudges();
  if (tab === 'cases')  loadAdminCases();
}

async function loadAdminCases() {
  const el = document.getElementById('adminCasesList');
  el.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">Загрузка...</p>';
  try {
    const cases = await DB.getCases();
    if (!cases.length) {
      el.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">Дел нет</p>';
      return;
    }
    el.innerHTML = cases.map(c => `
      <div class="judge-case-card">
        <div class="judge-case-header">
          <span class="case-id">#${String(c.id).slice(-4).padStart(4,'0')}</span>
          <span class="tag tag-${c.case_type}">${caseTypeLabel(c.case_type)}</span>
          <span class="status status-${c.status}">${statusLabel(c.status)}</span>
          <span style="font-size:.8rem;color:var(--text-muted);margin-left:auto">${new Date(c.created_at).toLocaleDateString('ru')}</span>
        </div>
        <div class="judge-case-body">
          <p><strong>Истец:</strong> ${esc(c.plaintiff)} &nbsp;|&nbsp; <strong>Ответчик:</strong> ${esc(c.defendant)}</p>
          <p class="judge-case-desc">${esc(c.description)}</p>
          ${c.judge_nick ? `<p style="font-size:.82rem;color:var(--text-muted)">Судья: ${esc(c.judge_nick)}</p>` : ''}
          ${c.verdict    ? `<p class="judge-verdict">⚖️ ${esc(c.verdict)}</p>` : ''}
        </div>
        <div class="judge-case-actions">
          <button class="btn-action btn-close" onclick="adminDeleteCase(${c.id})">🗑️ Удалить</button>
        </div>
      </div>
    `).join('');
  } catch {
    el.innerHTML = '<p style="color:#ef5350;text-align:center">Ошибка загрузки</p>';
  }
}

async function adminDeleteCase(id) {
  if (!confirm('Удалить дело?')) return;
  try {
    DB._casesSha = null;
    const cases = await DB.getCases();
    const filtered = cases.filter(c => c.id !== id);
    const newSha = await ghWrite('data/cases.json', filtered, DB._casesSha, `Удалено дело #${id}`);
    DB._casesSha = newSha;
    loadAdminCases();
    loadCases();
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
}

async function adminClearAllCases() {
  if (!confirm('Очистить ВСЕ дела и сбросить статистику?')) return;
  try {
    DB._casesSha = null;
    await DB.getCases(); // получаем свежий SHA
    const newSha = await ghWrite('data/cases.json', [], DB._casesSha, 'Очистка всех дел (admin)');
    DB._casesSha = newSha;
    loadAdminCases();
    loadCases();
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
}

async function loadAdminJudges() {
  const el = document.getElementById('adminJudgesList');
  el.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">Загрузка...</p>';
  try {
    const judges = await DB.getJudges();
    // Показываем только не-admin судей
    const realJudges = judges.filter(j => !j.admin);
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px">
        ${realJudges.map((j, i) => `
          <div class="judge-edit-row">
            <span style="color:var(--text-muted);font-size:.8rem;min-width:20px">${i+1}.</span>
            <input class="judge-edit-nick" data-orig="${esc(j.nick)}" value="${esc(j.nick)}" placeholder="Ник" />
            <input class="judge-edit-pass" value="${esc(j.password)}" placeholder="Пароль" />
            <button class="btn-action btn-approve" onclick="adminSaveJudge(this)">💾 Сохранить</button>
          </div>
        `).join('')}
      </div>
    `;
  } catch {
    el.innerHTML = '<p style="color:#ef5350;text-align:center">Ошибка загрузки</p>';
  }
}

async function adminSaveJudge(btn) {
  const row     = btn.closest('.judge-edit-row');
  const origNick = row.querySelector('.judge-edit-nick').dataset.orig;
  const newNick  = row.querySelector('.judge-edit-nick').value.trim();
  const newPass  = row.querySelector('.judge-edit-pass').value.trim();
  if (!newNick || !newPass) { alert('Ник и пароль не могут быть пустыми'); return; }
  try {
    const { content: judges, sha } = await ghRead('data/judges.json');
    const idx = judges.findIndex(j => j.nick === origNick);
    if (idx === -1) throw new Error('Судья не найден');
    judges[idx].nick     = newNick;
    judges[idx].password = newPass;
    await ghWrite('data/judges.json', judges, sha, `Изменён судья ${origNick} → ${newNick}`);
    // Обновляем data-orig
    row.querySelector('.judge-edit-nick').dataset.orig = newNick;
    btn.textContent = '✅ Сохранено';
    setTimeout(() => { btn.textContent = '💾 Сохранить'; }, 2000);
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
}

// ===================== INIT =====================
loadCases();
