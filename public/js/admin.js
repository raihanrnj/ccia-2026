// Admin Panel Logic - Cerdas Cermat Scoreboard
let state = {
  title: "FINAL CERDAS CERMAT",
  subtitle: "EDISI 2026",
  currentRound: "1",
  backgroundImage: "/assets/default-bg.svg",
  teams: [
    { id: "A", name: "REGU A", score: 0 },
    { id: "B", name: "REGU B", score: 0 },
    { id: "C", name: "REGU C", score: 0 }
  ],
  quickRound: {
    A: [false, false, false, false, false],
    B: [false, false, false, false, false],
    C: [false, false, false, false, false]
  },
  history: []
};

// Track previously committed quick round counts per team to calculate delta
const committedQuickCounts = { A: 0, B: 0, C: 0 };

const channel = window.BroadcastChannel ? new BroadcastChannel('ccia_score_channel') : null;
let sseSource = null;

const elements = {
  statusBadge: document.getElementById('adminStatusBadge'),
  statusDot: document.getElementById('adminStatusDot'),
  statusText: document.getElementById('adminStatusText'),
  toast: document.getElementById('toastNotification'),
  tabBtnRound1: document.getElementById('tabBtnRound1'),
  tabBtnRound2: document.getElementById('tabBtnRound2'),
  tabLiveBadge1: document.getElementById('tabLiveBadge1'),
  tabLiveBadge2: document.getElementById('tabLiveBadge2'),
  viewRound1: document.getElementById('viewRound1'),
  viewRound2: document.getElementById('viewRound2'),
  inputTitle: document.getElementById('inputTitle'),
  inputSubtitle: document.getElementById('inputSubtitle'),
  bgPreview: document.getElementById('bgPreview'),
  historyCount: document.getElementById('historyCount'),
  historyTableBody: document.getElementById('historyTableBody'),
  teams: {
    A: {
      masterName: document.getElementById('masterNameInput-A'),
      quickName: document.getElementById('quickNameInput-A'),
      name: document.getElementById('nameInput-A'),
      quickScore: document.getElementById('quickCurrScore-A'),
      score: document.getElementById('currScore-A'),
      delta: document.getElementById('deltaInput-A'),
      quickSummary: document.getElementById('quickSummary-A')
    },
    B: {
      masterName: document.getElementById('masterNameInput-B'),
      quickName: document.getElementById('quickNameInput-B'),
      name: document.getElementById('nameInput-B'),
      quickScore: document.getElementById('quickCurrScore-B'),
      score: document.getElementById('currScore-B'),
      delta: document.getElementById('deltaInput-B'),
      quickSummary: document.getElementById('quickSummary-B')
    },
    C: {
      masterName: document.getElementById('masterNameInput-C'),
      quickName: document.getElementById('quickNameInput-C'),
      name: document.getElementById('nameInput-C'),
      quickScore: document.getElementById('quickCurrScore-C'),
      score: document.getElementById('currScore-C'),
      delta: document.getElementById('deltaInput-C'),
      quickSummary: document.getElementById('quickSummary-C')
    }
  }
};

// Show notification toast
function showToast(message, type = 'success') {
  elements.toast.textContent = message;
  elements.toast.style.borderColor = type === 'success' ? '#10b981' : '#f59e0b';
  elements.toast.classList.add('show');
  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 2200);
}

// Switch Round Tab (1 vs 2)
async function switchRoundTab(round) {
  state.currentRound = round;

  if (round === '1') {
    elements.tabBtnRound1.classList.add('active');
    elements.tabBtnRound2.classList.remove('active');
    elements.viewRound1.classList.add('active');
    elements.viewRound2.classList.remove('active');
    if (elements.tabLiveBadge1) elements.tabLiveBadge1.style.display = 'inline-block';
    if (elements.tabLiveBadge2) elements.tabLiveBadge2.style.display = 'none';
  } else {
    elements.tabBtnRound2.classList.add('active');
    elements.tabBtnRound1.classList.remove('active');
    elements.viewRound2.classList.add('active');
    elements.viewRound1.classList.remove('active');
    if (elements.tabLiveBadge2) elements.tabLiveBadge2.style.display = 'inline-block';
    if (elements.tabLiveBadge1) elements.tabLiveBadge1.style.display = 'none';
  }

  try {
    await fetch('/api/round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round })
    });
  } catch (e) {}

  if (channel) {
    channel.postMessage({ type: 'round_update', round });
  }

  showToast(`Beralih ke Babak ${round}: ${round === '1' ? 'Pertanyaan Cepat' : 'Babak Rebutan'}`);
}

// Save dedicated team names form
async function saveTeamNamesForm(event) {
  if (event) event.preventDefault();
  const names = {
    A: (elements.teams.A.masterName ? elements.teams.A.masterName.value : '').trim() || 'REGU A',
    B: (elements.teams.B.masterName ? elements.teams.B.masterName.value : '').trim() || 'REGU B',
    C: (elements.teams.C.masterName ? elements.teams.C.masterName.value : '').trim() || 'REGU C'
  };

  ['A', 'B', 'C'].forEach(id => {
    const team = state.teams.find(t => t.id === id);
    if (team) team.name = names[id];
    if (elements.teams[id].name) elements.teams[id].name.value = names[id];
    if (elements.teams[id].quickName) elements.teams[id].quickName.value = names[id];
    if (elements.teams[id].masterName) elements.teams[id].masterName.value = names[id];
  });

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teams: state.teams })
    });
    if (res.ok) {
      showToast('Nama semua regu berhasil disimpan & diperbarui di Layar Display!');
    }
  } catch (e) {}

  if (channel) {
    channel.postMessage({ type: 'state_update', state });
  }
}

// Sync Team Names across tabs and master inputs
async function syncTeamNames(teamId, newName) {
  const val = newName.trim();
  if (!val) return;

  const team = state.teams.find(t => t.id === teamId);
  if (team) team.name = val;

  // Sync inputs
  if (elements.teams[teamId].name && elements.teams[teamId].name !== document.activeElement) {
    elements.teams[teamId].name.value = val;
  }
  if (elements.teams[teamId].quickName && elements.teams[teamId].quickName !== document.activeElement) {
    elements.teams[teamId].quickName.value = val;
  }
  if (elements.teams[teamId].masterName && elements.teams[teamId].masterName !== document.activeElement) {
    elements.teams[teamId].masterName.value = val;
  }

  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teams: state.teams })
    });
  } catch (e) {}

  if (channel) {
    channel.postMessage({ type: 'state_update', state });
  }
}

// ==========================================
// BABAK 1: LOGIKA PERTANYAAN CEPAT
// ==========================================
function getQuickQuestions(teamId) {
  const checks = [];
  for (let i = 0; i < 5; i++) {
    const cb = document.getElementById(`q-${teamId}-${i}`);
    checks.push(cb ? cb.checked : false);
  }
  return checks;
}

function handleQuickCheckChange(teamId) {
  const questions = getQuickQuestions(teamId);
  const correctCount = questions.filter(Boolean).length;
  const totalPoints = correctCount * 20;

  // Update badge
  const summaryEl = elements.teams[teamId].quickSummary;
  if (summaryEl) {
    summaryEl.textContent = `${correctCount}/5 Benar (+${totalPoints})`;
  }

  // Update item highlight
  for (let i = 0; i < 5; i++) {
    const cb = document.getElementById(`q-${teamId}-${i}`);
    if (cb && cb.parentElement) {
      if (cb.checked) cb.parentElement.classList.add('is-checked');
      else cb.parentElement.classList.remove('is-checked');
    }
  }
}

function toggleAllQuestions(teamId, status) {
  for (let i = 0; i < 5; i++) {
    const cb = document.getElementById(`q-${teamId}-${i}`);
    if (cb) cb.checked = status;
  }
  handleQuickCheckChange(teamId);
}

async function submitQuickRound(teamId) {
  const questions = getQuickQuestions(teamId);
  const currentCheckedCount = questions.filter(Boolean).length;
  const prevCommitted = committedQuickCounts[teamId] || 0;
  const delta = (currentCheckedCount - prevCommitted) * 20;

  if (delta === 0) {
    showToast(`Tidak ada perubahan centang soal untuk Regu ${teamId}`, 'warn');
    return;
  }

  try {
    const res = await fetch('/api/quick-round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, questions, delta })
    });

    if (res.ok) {
      const data = await res.json();
      committedQuickCounts[teamId] = currentCheckedCount;
      renderState(data.state);

      if (channel) {
        channel.postMessage({
          type: 'state_update',
          state: data.state,
          delta,
          teamId
        });
      }

      const team = state.teams.find(t => t.id === teamId);
      showToast(`Babak 1: ${team?.name || teamId} ${delta > 0 ? '+' : ''}${delta} (${currentCheckedCount}/5 Benar)`);
      if (window.soundFX) {
        if (delta > 0) window.soundFX.playScoreUp();
        else window.soundFX.playScoreDown();
      }
    }
  } catch (e) {
    committedQuickCounts[teamId] = currentCheckedCount;
    const team = state.teams.find(t => t.id === teamId);
    if (team) {
      team.score += delta;
      renderState(state);
      if (channel) channel.postMessage({ type: 'state_update', state, delta, teamId });
      showToast(`Mode Lokal: Nilai Regu ${teamId} diupdate`);
    }
  }
}

async function submitAllQuickRounds() {
  const teamsToSubmit = ['A', 'B', 'C'];
  let countUpdated = 0;

  for (const teamId of teamsToSubmit) {
    const questions = getQuickQuestions(teamId);
    const currentCheckedCount = questions.filter(Boolean).length;
    const prevCommitted = committedQuickCounts[teamId] || 0;
    const delta = (currentCheckedCount - prevCommitted) * 20;

    if (delta !== 0) {
      await fetch('/api/quick-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, questions, delta })
      });
      committedQuickCounts[teamId] = currentCheckedCount;
      countUpdated++;
    }
  }

  if (countUpdated === 0) {
    showToast('Semua centang soal babak 1 sudah tersimpan.', 'warn');
    return;
  }

  // Refresh latest state
  const res = await fetch('/api/state');
  if (res.ok) {
    const data = await res.json();
    renderState(data);
    if (channel) channel.postMessage({ type: 'state_update', state: data });
  }

  showToast(`Berhasil submit Babak 1 untuk ${countUpdated} regu!`);
  if (window.soundFX) window.soundFX.playScoreUp();
}

// ==========================================
// BABAK 2: LOGIKA BABAK REBUTAN
// ==========================================
function stepDelta(teamId, step) {
  const input = elements.teams[teamId].delta;
  const current = parseInt(input.value, 10) || 0;
  input.value = current + step;
  input.focus();
}

function setDelta(teamId, val) {
  const input = elements.teams[teamId].delta;
  input.value = val;
  input.focus();
}

function clearAllInputs() {
  ['A', 'B', 'C'].forEach(id => {
    elements.teams[id].delta.value = '';
  });
  showToast('Input nilai rebutan dibersihkan');
}

// Single team score submit (Babak Rebutan)
async function submitSingleTeam(teamId) {
  const deltaInput = elements.teams[teamId].delta;
  const deltaVal = parseInt(deltaInput.value, 10);
  const currentTeam = state.teams.find(t => t.id === teamId);

  if (isNaN(deltaVal) || deltaVal === 0) {
    showToast(`Pilih / isi nilai tambah atau kurang untuk ${currentTeam?.name || teamId}`, 'warn');
    deltaInput.focus();
    return;
  }

  try {
    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId,
        delta: deltaVal,
        round: "2",
        note: `Babak Rebutan: ${deltaVal > 0 ? '+' : ''}${deltaVal}`
      })
    });

    if (res.ok) {
      const data = await res.json();
      deltaInput.value = '';
      renderState(data.state);

      if (channel) {
        channel.postMessage({
          type: 'state_update',
          state: data.state,
          delta: deltaVal,
          teamId
        });
      }

      showToast(`Rebutan: ${currentTeam?.name || teamId} ${deltaVal > 0 ? '+' : ''}${deltaVal}`);
      if (window.soundFX) {
        if (deltaVal > 0) window.soundFX.playScoreUp();
        else window.soundFX.playScoreDown();
      }
    }
  } catch (err) {
    if (currentTeam) {
      currentTeam.score += deltaVal;
      renderState(state);
      if (channel) channel.postMessage({ type: 'state_update', state, delta: deltaVal, teamId });
      deltaInput.value = '';
      showToast(`Mode Lokal: ${currentTeam.name} diupdate`);
    }
  }
}

// Master Submit (Babak 2)
async function submitAllTeams() {
  const updates = [];
  ['A', 'B', 'C'].forEach(id => {
    const val = parseInt(elements.teams[id].delta.value, 10);
    if (!isNaN(val) && val !== 0) {
      updates.push({
        teamId: id,
        delta: val,
        note: `Rebutan: ${val > 0 ? '+' : ''}${val}`
      });
    }
  });

  if (updates.length === 0) {
    showToast('Tidak ada angka perubahan nilai yang diisi.', 'warn');
    return;
  }

  try {
    const res = await fetch('/api/batch-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates })
    });

    if (res.ok) {
      const data = await res.json();
      clearAllInputs();
      renderState(data.state);

      if (channel) {
        channel.postMessage({ type: 'state_update', state: data.state });
      }

      showToast(`Berhasil submit perubahan untuk ${updates.length} regu!`);
      if (window.soundFX) window.soundFX.playScoreUp();
    }
  } catch (e) {
    clearAllInputs();
    showToast(`Gagal menghubungi server.`);
  }
}

// ==========================================
// RIWAYAT & AKSI PEMBATALAN (DELETE / UNDO)
// ==========================================
async function deleteHistoryItem(id) {
  if (!confirm('Yakin ingin membatalkan/menghapus transaksi nilai ini? Skor kelompok akan otomatis dikembalikan.')) {
    return;
  }

  try {
    const res = await fetch('/api/history/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });

    if (res.ok) {
      const data = await res.json();
      renderState(data.state);
      if (channel) channel.postMessage({ type: 'state_update', state: data.state });
      showToast('Transaksi nilai berhasil dibatalkan dan skor dikembalikan.');
    }
  } catch (e) {
    showToast('Gagal membatalkan transaksi', 'warn');
  }
}

async function undoLastScore() {
  if (!confirm('Yakin ingin membatalkan (undo) perubahan skor terakhir?')) return;
  try {
    const res = await fetch('/api/undo', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      renderState(data.state);
      if (channel) channel.postMessage({ type: 'state_update', state: data.state });
      showToast('Perubahan nilai terakhir berhasil dibatalkan.');
    }
  } catch (e) {}
}

async function confirmResetScores() {
  const ans = prompt('Ketik "RESET" untuk mengonfirmasi reset semua nilai menjadi 0:');
  if (ans !== 'RESET') return;

  try {
    const res = await fetch('/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 0 })
    });
    if (res.ok) {
      const data = await res.json();
      ['A', 'B', 'C'].forEach(id => {
        toggleAllQuestions(id, false);
        committedQuickCounts[id] = 0;
      });
      renderState(data.state);
      if (channel) channel.postMessage({ type: 'state_update', state: data.state });
      showToast('Semua nilai telah direset ke 0.');
    }
  } catch (e) {}
}

// Save Settings
async function saveSettings(event) {
  event.preventDefault();
  const title = elements.inputTitle.value.trim();
  const subtitle = elements.inputSubtitle.value.trim();

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, subtitle })
    });
    if (res.ok) {
      const data = await res.json();
      renderState(data.state);
      if (channel) channel.postMessage({ type: 'state_update', state: data.state });
      showToast('Pengaturan judul berhasil disimpan.');
    }
  } catch (e) {}
}

function handleBgUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    elements.bgPreview.src = dataUrl;

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backgroundImage: dataUrl })
      });
      if (res.ok) {
        const data = await res.json();
        renderState(data.state);
        if (channel) channel.postMessage({ type: 'state_update', state: data.state });
        showToast('Background baru berhasil diterapkan pada layar TV!');
      }
    } catch (err) {}
  };
  reader.readAsDataURL(file);
}

async function restoreDefaultBg() {
  const defaultBg = '/assets/default-bg.svg';
  elements.bgPreview.src = defaultBg;
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backgroundImage: defaultBg })
    });
    if (res.ok) {
      const data = await res.json();
      renderState(data.state);
      if (channel) channel.postMessage({ type: 'state_update', state: data.state });
      showToast('Background dikembalikan ke default panggung.');
    }
  } catch (e) {}
}

// Render State
function renderState(newState) {
  if (!newState) return;
  state = newState;

  // Title & Subtitle
  if (document.activeElement !== elements.inputTitle && newState.title) {
    elements.inputTitle.value = newState.title;
  }
  if (document.activeElement !== elements.inputSubtitle && newState.subtitle) {
    elements.inputSubtitle.value = newState.subtitle;
  }

  // Background Preview
  if (newState.backgroundImage && elements.bgPreview) {
    elements.bgPreview.src = newState.backgroundImage;
  }

  // Active Round Tab
  if (newState.currentRound && (newState.currentRound === '1' || newState.currentRound === '2')) {
    if (newState.currentRound === '1') {
      elements.tabBtnRound1.classList.add('active');
      elements.tabBtnRound2.classList.remove('active');
      elements.viewRound1.classList.add('active');
      elements.viewRound2.classList.remove('active');
      if (elements.tabLiveBadge1) elements.tabLiveBadge1.style.display = 'inline-block';
      if (elements.tabLiveBadge2) elements.tabLiveBadge2.style.display = 'none';
    } else {
      elements.tabBtnRound2.classList.add('active');
      elements.tabBtnRound1.classList.remove('active');
      elements.viewRound2.classList.add('active');
      elements.viewRound1.classList.remove('active');
      if (elements.tabLiveBadge2) elements.tabLiveBadge2.style.display = 'inline-block';
      if (elements.tabLiveBadge1) elements.tabLiveBadge1.style.display = 'none';
    }
  }

  // Teams
  if (Array.isArray(newState.teams)) {
    newState.teams.forEach(t => {
      const el = elements.teams[t.id];
      if (el) {
        if (el.score) el.score.textContent = t.score;
        if (el.quickScore) el.quickScore.textContent = t.score;
        if (document.activeElement !== el.name && t.name) el.name.value = t.name;
        if (document.activeElement !== el.quickName && t.name) el.quickName.value = t.name;
        if (document.activeElement !== el.masterName && t.name && el.masterName) el.masterName.value = t.name;
      }
    });
  }

  // Quick Round Checkboxes
  if (newState.quickRound) {
    ['A', 'B', 'C'].forEach(id => {
      const list = newState.quickRound[id];
      if (Array.isArray(list)) {
        list.forEach((val, idx) => {
          const cb = document.getElementById(`q-${id}-${idx}`);
          if (cb && cb !== document.activeElement) {
            cb.checked = !!val;
          }
        });
        committedQuickCounts[id] = list.filter(Boolean).length;
        handleQuickCheckChange(id);
      }
    });
  }

  // History with Delete action button
  renderHistory(newState.history || []);

  try {
    localStorage.setItem('ccia_state', JSON.stringify(state));
  } catch (e) {}
}

function renderHistory(history) {
  elements.historyCount.textContent = `${history.length} catatan`;

  if (!history || history.length === 0) {
    elements.historyTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">Belum ada riwayat penilaian</td>
      </tr>
    `;
    return;
  }

  elements.historyTableBody.innerHTML = history.slice(0, 40).map(item => {
    const isPos = item.delta > 0;
    const isZero = item.delta === 0;
    const badgeClass = isPos ? 'delta-badge-pos' : (isZero ? '' : 'delta-badge-neg');
    const displayDelta = isZero ? '-' : (isPos ? `+${item.delta}` : `${item.delta}`);
    const roundTag = item.round === '1'
      ? `<span class="round-tag round-tag-1">B1: Cepat</span>`
      : `<span class="round-tag round-tag-2">B2: Rebutan</span>`;

    return `
      <tr>
        <td style="color: #94a3b8; font-size: 0.8rem;">${item.timestamp || '-'}</td>
        <td>${roundTag}</td>
        <td><strong>${item.teamName || item.teamId}</strong></td>
        <td><span class="${badgeClass}">${displayDelta}</span> <small style="color: #64748b;">(${item.note || ''})</small></td>
        <td style="font-family: var(--font-num); font-size: 1.25rem; font-weight: 700;">${item.newScore}</td>
        <td style="text-align: center;">
          <button type="button" class="btn-delete-row" onclick="deleteHistoryItem('${item.id}')" title="Hapus / Batalkan poin ini">
            Hapus
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// SSE Connection
function setupSSE() {
  if (!window.EventSource) return;
  if (sseSource) sseSource.close();

  sseSource = new EventSource('/api/events');

  sseSource.addEventListener('state', (e) => {
    try {
      const data = JSON.parse(e.data);
      elements.statusDot.className = 'status-dot';
      elements.statusText.textContent = 'Server Online (Real-time)';
      renderState(data.state);
    } catch (err) {}
  });

  sseSource.addEventListener('score_update', (e) => {
    try {
      const data = JSON.parse(e.data);
      renderState(data.state);
    } catch (err) {}
  });

  sseSource.addEventListener('batch_update', (e) => {
    try {
      const data = JSON.parse(e.data);
      renderState(data.state);
    } catch (err) {}
  });

  sseSource.addEventListener('history_revert', (e) => {
    try {
      const data = JSON.parse(e.data);
      renderState(data.state);
      showToast(`Transaksi nilai dibatalkan: ${data.reverted?.teamName || ''} (${data.reverted?.delta || ''})`);
    } catch (err) {}
  });

  sseSource.addEventListener('round_update', (e) => {
    try {
      const data = JSON.parse(e.data);
      renderState(data.state);
    } catch (err) {}
  });

  sseSource.addEventListener('reset', (e) => {
    try {
      const data = JSON.parse(e.data);
      renderState(data.state);
    } catch (err) {}
  });

  sseSource.addEventListener('settings_update', (e) => {
    try {
      const data = JSON.parse(e.data);
      renderState(data.state);
    } catch (err) {}
  });

  sseSource.onerror = () => {
    elements.statusDot.className = 'status-dot offline';
    elements.statusText.textContent = 'Mode Lokal / Offline';
  };
}

// Logout function
async function logoutAdmin() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  window.location.href = '/login';
}

// Init
async function init() {
  // Check auth first
  try {
    const authRes = await fetch('/api/auth/check');
    if (authRes.ok) {
      const authData = await authRes.json();
      if (!authData.authenticated) {
        window.location.href = '/login';
        return;
      }
    }
  } catch (e) {}

  try {
    const res = await fetch('/api/state');
    if (res.ok) {
      const data = await res.json();
      renderState(data);
      elements.statusDot.className = 'status-dot';
      elements.statusText.textContent = 'Server Online (Real-time)';
    } else if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
  } catch (e) {
    const cached = localStorage.getItem('ccia_state');
    if (cached) renderState(JSON.parse(cached));
  }

  setupSSE();

  // Enter key support for quick submit
  ['A', 'B', 'C'].forEach(id => {
    elements.teams[id].delta?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitSingleTeam(id);
      }
    });
  });
}

init();
