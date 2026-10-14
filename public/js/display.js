// Live Display Scoreboard Logic
(() => {
  const elements = {
    title: document.getElementById('competitionTitle'),
    subtitle: document.getElementById('competitionSubtitle'),
    roundBadge: document.getElementById('displayRoundBadge'),
    roundIcon: document.getElementById('roundBadgeIcon'),
    roundText: document.getElementById('displayRoundText'),
    bgLayer: document.getElementById('bgLayer'),
    syncDot: document.getElementById('syncDot'),
    syncText: document.getElementById('syncText'),
    btnFullscreen: document.getElementById('btnFullscreen'),
    btnSound: document.getElementById('btnSound'),
    teams: {
      A: {
        card: document.getElementById('card-A'),
        name: document.getElementById('name-A'),
        score: document.getElementById('score-A'),
        delta: document.getElementById('delta-A'),
        crown: document.getElementById('crown-A'),
        rank: document.getElementById('rank-A')
      },
      B: {
        card: document.getElementById('card-B'),
        name: document.getElementById('name-B'),
        score: document.getElementById('score-B'),
        delta: document.getElementById('delta-B'),
        crown: document.getElementById('crown-B'),
        rank: document.getElementById('rank-B')
      },
      C: {
        card: document.getElementById('card-C'),
        name: document.getElementById('name-C'),
        score: document.getElementById('score-C'),
        delta: document.getElementById('delta-C'),
        crown: document.getElementById('crown-C'),
        rank: document.getElementById('rank-C')
      }
    }
  };

  // Internal state tracking
  let currentState = {
    title: "FINAL CCIA MUSLIMFEST 2026",
    subtitle: "",
    backgroundImage: "",
    teams: [
      { id: "A", name: "REGU A", score: 0 },
      { id: "B", name: "REGU B", score: 0 },
      { id: "C", name: "REGU C", score: 0 }
    ]
  };

  const currentDisplayScores = { A: 0, B: 0, C: 0 };
  let sseSource = null;
  const channel = window.BroadcastChannel ? new BroadcastChannel('ccia_score_channel') : null;

  // Sound toggle state
  let soundEnabled = true;
  elements.btnSound?.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    if (window.soundFX) window.soundFX.enabled = soundEnabled;
    elements.btnSound.textContent = soundEnabled ? '🔊' : '🔇';
    elements.btnSound.title = soundEnabled ? 'Suara Aktif' : 'Suara Senyap';
  });

  // Fullscreen toggle
  elements.btnFullscreen?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // Animate score number smoothly
  function animateScore(teamId, targetScore, delta = null) {
    const el = elements.teams[teamId];
    if (!el) return;

    const startScore = currentDisplayScores[teamId];
    const diff = targetScore - startScore;

    // Trigger delta popup animation if there is a change
    if (delta !== null && delta !== 0) {
      el.delta.textContent = delta > 0 ? `+${delta}` : `${delta}`;
      el.delta.className = 'score-delta ' + (delta > 0 ? 'show-up' : 'show-down');

      // Trigger card bounce
      el.card.classList.remove('score-bump');
      void el.card.offsetWidth; // force reflow
      el.card.classList.add('score-bump');

      // Play sound effect
      if (soundEnabled && window.soundFX) {
        if (delta > 0) window.soundFX.playScoreUp();
        else window.soundFX.playScoreDown();
      }

      setTimeout(() => {
        el.delta.className = 'score-delta';
      }, 1800);
    }

    if (diff === 0) {
      el.score.textContent = targetScore;
      return;
    }

    const duration = 400; // ms
    const startTime = performance.now();

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const val = Math.round(startScore + diff * ease);

      el.score.textContent = val;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.score.textContent = targetScore;
        currentDisplayScores[teamId] = targetScore;
      }
    }

    requestAnimationFrame(step);
    currentDisplayScores[teamId] = targetScore;
  }

  // Update UI with new state
  function applyState(newState, specificDelta = null, changedTeamId = null) {
    if (!newState) return;

    // Title
    if (newState.title && elements.title && elements.title.textContent !== newState.title) {
      elements.title.textContent = newState.title;
      document.title = `${newState.title} - Scoreboard`;
    }
    // Subtitle (element may not exist)
    if (newState.subtitle && elements.subtitle && elements.subtitle.textContent !== newState.subtitle) {
      elements.subtitle.textContent = newState.subtitle;
    }

    // Active Round Badge
    if (newState.currentRound && elements.roundBadge && elements.roundText) {
      if (newState.currentRound === '2') {
        elements.roundBadge.className = 'display-round-badge round-2';
        if (elements.roundIcon) elements.roundIcon.textContent = '';
        elements.roundText.textContent = 'BABAK 2: BABAK REBUTAN';
      } else {
        elements.roundBadge.className = 'display-round-badge';
        if (elements.roundIcon) elements.roundIcon.textContent = '';
        elements.roundText.textContent = 'BABAK 1: PERTANYAAN CEPAT';
      }
    }

    // Background Image
    if (elements.bgLayer) {
      if (newState.backgroundImage) {
        const currentBg = elements.bgLayer.style.backgroundImage;
        const targetBg = `url("${newState.backgroundImage}")`;
        if (!currentBg.includes(newState.backgroundImage)) {
          elements.bgLayer.style.backgroundImage = targetBg;
        }
      } else {
        elements.bgLayer.style.backgroundImage = '';
      }
    }

    // Teams & Scores
    if (Array.isArray(newState.teams)) {
      const teamList = newState.teams;

      // Find leader
      const maxScore = Math.max(...teamList.map(t => t.score));
      const hasScores = maxScore > 0;

      // Sort scores to determine rank
      const sorted = [...teamList].sort((a, b) => b.score - a.score);

      teamList.forEach(t => {
        const teamEl = elements.teams[t.id];
        if (!teamEl) return;

        // Name
        if (teamEl.name.textContent !== t.name) {
          teamEl.name.textContent = t.name;
        }

        // Leader highlight
        const isLeader = hasScores && t.score === maxScore;
        if (isLeader) {
          teamEl.card.classList.add('is-leader');
        } else {
          teamEl.card.classList.remove('is-leader');
        }

        // Rank text
        const rankIndex = sorted.findIndex(s => s.id === t.id) + 1;
        if (hasScores) {
          teamEl.rank.textContent = `Peringkat ${rankIndex}`;
        } else {
          teamEl.rank.textContent = `Skor Terkini`;
        }

        // Calculate delta if this team was specifically modified
        const delta = (changedTeamId === t.id)
          ? specificDelta
          : (t.score - currentDisplayScores[t.id]);

        animateScore(t.id, t.score, (changedTeamId === t.id || specificDelta !== null) ? delta : null);
      });
    }

    currentState = newState;
    // Cache to localStorage
    try {
      localStorage.setItem('ccia_state', JSON.stringify(currentState));
    } catch (e) {}
  }

  // SSE connection to server for instant push
  function setupSSE() {
    if (!window.EventSource) return;

    if (sseSource) {
      sseSource.close();
    }

    sseSource = new EventSource('/api/events');

    sseSource.addEventListener('state', (e) => {
      try {
        const data = JSON.parse(e.data);
        elements.syncDot.className = 'sync-dot';
        elements.syncText.textContent = 'Terhubung Real-time';
        applyState(data.state);
      } catch (err) {}
    });

    sseSource.addEventListener('score_update', (e) => {
      try {
        const data = JSON.parse(e.data);
        elements.syncDot.className = 'sync-dot';
        elements.syncText.textContent = 'Terhubung Real-time';
        const change = data.change;
        applyState(data.state, change ? change.delta : null, change ? change.teamId : null);
      } catch (err) {}
    });

    sseSource.addEventListener('batch_update', (e) => {
      try {
        const data = JSON.parse(e.data);
        applyState(data.state);
      } catch (err) {}
    });

    sseSource.addEventListener('reset', (e) => {
      try {
        const data = JSON.parse(e.data);
        applyState(data.state);
      } catch (err) {}
    });

    sseSource.addEventListener('round_update', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.round) currentState.currentRound = data.round;
        applyState(currentState);
      } catch (err) {}
    });

    sseSource.addEventListener('history_revert', (e) => {
      try {
        const data = JSON.parse(e.data);
        applyState(data.state);
      } catch (err) {}
    });

    sseSource.addEventListener('settings_update', (e) => {
      try {
        const data = JSON.parse(e.data);
        applyState(data.state);
      } catch (err) {}
    });

    sseSource.onerror = () => {
      elements.syncDot.className = 'sync-dot offline';
      elements.syncText.textContent = 'Mode Sinkronisasi Lokal';
    };
  }

  // Cross-tab BroadcastChannel sync
  if (channel) {
    channel.onmessage = (event) => {
      if (event.data && event.data.type === 'state_update') {
        applyState(event.data.state, event.data.delta, event.data.teamId);
      }
    };
  }

  // Fallback LocalStorage listener
  window.addEventListener('storage', (e) => {
    if (e.key === 'ccia_state' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        applyState(parsed);
      } catch (err) {}
    }
  });

  // Polling fallback every 2.5s (Guarantees sync as requested by user)
  async function fetchState() {
    try {
      const res = await fetch('/api/state', { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        applyState(data);
        elements.syncDot.className = 'sync-dot';
        elements.syncText.textContent = 'Terhubung Real-time';
      }
    } catch (e) {
      // Offline fallback: load from localStorage
      try {
        const cached = localStorage.getItem('ccia_state');
        if (cached) applyState(JSON.parse(cached));
      } catch (err) {}
    }
  }

  // Init
  fetchState();
  setupSSE();
  setInterval(fetchState, 2500); // Poll every 2.5s for 100% reliability
})();
