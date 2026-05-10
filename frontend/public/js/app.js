'use strict';

// Vite proxy forwards /api → http://localhost:5000
const API_BASE = '/api';
const TIMER_SECONDS = 180;

const CONDITIONS = {
  a: { label: 'AC1', bgColor: '#7CB342' },
  b: { label: 'AC2', bgColor: '#7CB342' },
  c: { label: 'AC3', bgColor: '#7CB342' },
  d: { label: 'CC1', bgColor: '#FDD835' },
  e: { label: 'CC2', bgColor: '#FDD835' },
  f: { label: 'CC3', bgColor: '#FDD835' }
};

const BATCH_SEQUENCES = {
  1: ['d','e','c','f','b','a'],
  2: ['e','f','d','a','c','b'],
  3: ['f','a','e','b','d','c'],
  4: ['c','d','b','e','a','f'],
  5: ['a','b','f','c','e','d'],
  6: ['b','c','a','d','f','e']
};

const SURVEY_QUESTIONS = [
  'The colors used in the advertisement appear trustworthy.',
  'I would like to buy this product for myself.',
  'I perceive this advertisement as honest.',
  'The overall appearance of the advertisement is appealing.',
  'I feel that this advertisement is trustworthy.',
  'The colors used in this advertisement are likable.',
  'The colors used in this advertisement increase my desire to buy the product.',
  'I like this advertisement.',
  'The likelihood of me purchasing this product is high.'
];

// Fixed display order for the 6 banner images
const ALL_LABELS = ['AC1', 'AC2', 'AC3', 'CC1', 'CC2', 'CC3'];

// ── State ─────────────────────────────────────────────
let state = {
  batchNumber: null,
  sequence: [],
  sessionId: null,
  currentStep: 0,
  imgIndex: 0,
  timerInterval: null,
  timerSecondsLeft: TIMER_SECONDS,
  name: '',
  email: ''
};

// ── DOM refs ──────────────────────────────────────────
const screens = {
  welcome:    document.getElementById('screen-welcome'),
  experiment: document.getElementById('screen-experiment'),
  complete:   document.getElementById('screen-complete')
};

const dom = {
  btnStart:           document.getElementById('btn-start'),
  welcomeError:       document.getElementById('welcome-error'),
  progressSteps:      document.getElementById('progress-steps'),
  stepCurrent:        document.getElementById('step-current'),
  stepTotal:          document.getElementById('step-total'),
  adLabelChip:        document.getElementById('ad-label-chip'),
  bannerImg:          document.getElementById('banner-img'),
  imgCurrent:         document.getElementById('img-current'),
  btnNextImg:         document.getElementById('btn-next-img'),
  timerDisplay:       document.getElementById('timer-display'),
  timerCircle:        document.getElementById('timer-circle'),
  questionsContainer: document.getElementById('questions-container'),
  surveyForm:         document.getElementById('survey-form'),
  surveyError:        document.getElementById('survey-error'),
  btnSubmit:          document.getElementById('btn-submit')
};

// ── Helpers ───────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => {
    s.classList.remove('active');
    s.classList.add('hidden');
  });
  screens[name].classList.remove('hidden');
  screens[name].classList.add('active');
  window.scrollTo(0, 0);
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideError(el) {
  el.classList.add('hidden');
}

function validateAndExtractBatch(input) {
  try {
    const url = new URL(input.startsWith('http') ? input : 'http://' + input);
    const b = parseInt(url.searchParams.get('batch'));
    return (b >= 1 && b <= 6) ? b : null;
  } catch {
    return null;
  }
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function formatTime(s) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

// SVG mini ring: r=15, circumference = 2π×15 ≈ 94.25
const CIRC = 94.25;
function updateTimerRing(left) {
  const offset = CIRC * (1 - left / TIMER_SECONDS);
  dom.timerCircle.style.strokeDashoffset = offset;
  dom.timerCircle.style.stroke =
    left > 60 ? '#3d5af1' :
    left > 20 ? '#f59e0b' : '#ef4444';
}

// ── API ───────────────────────────────────────────────
async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Timer ─────────────────────────────────────────────
function startTimer() {
  clearInterval(state.timerInterval);
  state.timerSecondsLeft = TIMER_SECONDS;
  dom.timerDisplay.textContent = formatTime(TIMER_SECONDS);
  updateTimerRing(TIMER_SECONDS);

  state.timerInterval = setInterval(() => {
    state.timerSecondsLeft--;
    dom.timerDisplay.textContent = formatTime(state.timerSecondsLeft);
    updateTimerRing(state.timerSecondsLeft);

    if (state.timerSecondsLeft <= 0) {
      clearInterval(state.timerInterval);
      dom.btnNextImg.disabled = true;
      dom.btnNextImg.textContent = "Time's up — please submit";
    }
  }, 1000);
}

// ── Image carousel ────────────────────────────────────
function showImage(idx) {
  state.imgIndex = idx;
  const label = ALL_LABELS[idx];

  // images/ folder is inside public/ which is Vite root, so path is just images/...
  dom.bannerImg.src = `images/banner-${label}.png`;
  dom.bannerImg.alt = `Advertisement banner ${label}`;
  dom.imgCurrent.textContent = idx + 1;

  const atLast = idx >= 5 || state.timerSecondsLeft <= 0;
  dom.btnNextImg.disabled = atLast;
  dom.btnNextImg.textContent =
    (!atLast)                        ? 'Next Image →' :
    (state.timerSecondsLeft <= 0)    ? "Time's up — please submit" :
                                       'All images viewed';
}

dom.btnNextImg.addEventListener('click', () => {
  if (state.imgIndex < 5) showImage(state.imgIndex + 1);
});

// ── Survey ────────────────────────────────────────────
function renderSurvey() {
  dom.questionsContainer.innerHTML = '';
  const scaleLabels = ['Strongly\nDisagree', 'Disagree', 'Neutral', 'Agree', 'Strongly\nAgree'];

  SURVEY_QUESTIONS.forEach((text, i) => {
    const n = i + 1;
    const card = document.createElement('div');
    card.className = 'question-card';

    const qText = document.createElement('div');
    qText.className = 'question-text';
    qText.innerHTML = `<span class="question-num">${n}</span><span>${text}</span>`;

    const row = document.createElement('div');
    row.className = 'likert-row';

    for (let v = 1; v <= 5; v++) {
      const lbl = document.createElement('label');
      lbl.className = 'likert-option';

      const input = document.createElement('input');
      input.type  = 'radio';
      input.name  = `q${n}`;
      input.value = v;

      const btn = document.createElement('span');
      btn.className   = 'likert-btn';
      btn.textContent = v;
      btn.addEventListener('click', () => { input.checked = true; });

      const scaleLbl = document.createElement('span');
      scaleLbl.className   = 'likert-scale-label';
      scaleLbl.textContent = scaleLabels[v - 1];

      lbl.appendChild(input);
      lbl.appendChild(btn);
      lbl.appendChild(scaleLbl);
      row.appendChild(lbl);
    }

    card.appendChild(qText);
    card.appendChild(row);
    dom.questionsContainer.appendChild(card);
  });
}

function collectAnswers() {
  const answers = {};
  for (let i = 1; i <= 9; i++) {
    const sel = dom.surveyForm.querySelector(`input[name="q${i}"]:checked`);
    if (!sel) return null;
    answers[`q${i}`] = parseInt(sel.value);
  }
  return answers;
}

// ── Load condition ────────────────────────────────────
function loadCondition(stepIndex) {
  state.currentStep = stepIndex;

  const condCode = state.sequence[stepIndex];
  dom.adLabelChip.textContent       = CONDITIONS[condCode]?.label || '—';
  dom.stepCurrent.textContent       = stepIndex + 1;
  dom.stepTotal.textContent         = 6;
  dom.progressSteps.style.width     = `${(stepIndex / 6) * 100}%`;

  hideError(dom.surveyError);
  dom.btnSubmit.disabled    = false;
  dom.btnSubmit.textContent = 'Submit & Continue →';

  renderSurvey();
  showImage(0);
  startTimer();
  window.scrollTo(0, 0);
}

// ── Survey submit ─────────────────────────────────────
dom.surveyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(dom.surveyError);

  const answers = collectAnswers();
  if (!answers) {
    showError(dom.surveyError, 'Please answer all 9 questions before submitting.');
    dom.questionsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  dom.btnSubmit.disabled    = true;
  dom.btnSubmit.textContent = 'Saving…';

  try {
    const condCode = state.sequence[state.currentStep];
    const result = await apiPost('/response', {
      sessionId:     state.sessionId,
      stepIndex:     state.currentStep,
      conditionCode: condCode,
      answers
    });

    clearInterval(state.timerInterval);

    if (result.isComplete) {
      showScreen('complete');
    } else {
      loadCondition(result.nextStep);
    }
  } catch (err) {
    showError(dom.surveyError, err.message || 'Failed to save. Please try again.');
    dom.btnSubmit.disabled    = false;
    dom.btnSubmit.textContent = 'Submit & Continue →';
  }
});

// ── Begin Experiment ──────────────────────────────────
dom.btnStart.addEventListener('click', async () => {
  hideError(dom.welcomeError);

  const linkVal  = document.getElementById('inp-access-code').value.trim();
  const nameVal  = document.getElementById('inp-name').value.trim();
  const emailVal = document.getElementById('inp-email').value.trim();

  // Validate before touching the server
  const batch = validateAndExtractBatch(linkVal);
  if (!batch) {
    showError(dom.welcomeError,
      'Invalid link. Paste the full link from the researcher, e.g. http://localhost:5173?batch=1');
    return;
  }
  if (!emailVal || !isValidEmail(emailVal)) {
    showError(dom.welcomeError, 'Please enter a valid email address.');
    return;
  }

  dom.btnStart.disabled    = true;
  dom.btnStart.textContent = 'Starting…';

  try {
    state.batchNumber = batch;
    state.sequence    = BATCH_SEQUENCES[batch];
    state.name        = nameVal;
    state.email       = emailVal;

    const session = await apiPost('/session/start', {
      batchNumber: batch,
      name:        nameVal,
      email:       emailVal
    });
    state.sessionId = session.sessionId;

    showScreen('experiment');
    loadCondition(0);

  } catch (err) {
    showError(dom.welcomeError,
      err.message || 'Could not connect to the server. Make sure the backend is running on port 5000.');
  } finally {
    dom.btnStart.disabled    = false;
    dom.btnStart.textContent = 'Begin Experiment';
  }
});

// ── Init ──────────────────────────────────────────────
(function init() {
  showScreen('welcome');
})();