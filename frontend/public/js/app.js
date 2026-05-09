/**
 * Web Banner Advertisement Experiment - Frontend Logic
 * Optimized for Participant Batch Navigation via Link Input
 */

'use strict';

// ── Config ────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:5000/api'; // Ensure this matches your backend port
const TIMER_SECONDS = 180; // 3 minutes per condition

// Metadata for conditions
const CONDITIONS = {
  a: { label: 'AC1', product: 'Donut',   bgColor: '#7CB342', icon: '🍩', tagline: 'Indulge in Every Bite' },
  b: { label: 'AC2', product: 'Tumbler', bgColor: '#7CB342', icon: '🥤', tagline: 'Keep It Fresh, All Day' },
  c: { label: 'AC3', product: 'Rolex',   bgColor: '#7CB342', icon: '⌚', tagline: 'Timeless Elegance' },
  d: { label: 'CC1', product: 'Donut',   bgColor: '#FDD835', icon: '🍩', tagline: 'Indulge in Every Bite' },
  e: { label: 'CC2', product: 'Tumbler', bgColor: '#FDD835', icon: '🥤', tagline: 'Keep It Fresh, All Day' },
  f: { label: 'CC3', product: 'Rolex',   bgColor: '#FDD835', icon: '⌚', tagline: 'Timeless Elegance' }
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

// ── State ─────────────────────────────────────────────────────────
let state = {
  batchNumber: null,
  sequence: [],         
  sessionId: null,
  currentStep: 0,        
  timerInterval: null,
  timerSecondsLeft: TIMER_SECONDS
};

// ── DOM refs ──────────────────────────────────────────────────────
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
  adStage:            document.getElementById('ad-stage'),
  adLabelChip:        document.getElementById('ad-label-chip'),
  bannerBg:           document.getElementById('banner-bg'),
  bannerProduct:      document.getElementById('banner-product'),
  bannerTagline:      document.getElementById('banner-tagline'),
  timerDisplay:       document.getElementById('timer-display'),
  timerCircle:        document.getElementById('timer-circle'),
  surveyStage:        document.getElementById('survey-stage'),
  questionsContainer: document.getElementById('questions-container'),
  surveyForm:         document.getElementById('survey-form'),
  surveyError:        document.getElementById('survey-error'),
  btnSubmit:          document.getElementById('btn-submit')
};

// ── Helpers ───────────────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => { s.classList.remove('active'); s.classList.add('hidden'); });
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

/**
 * Validates the link pasted by the participant
 */
function validateAndExtractBatch(inputUrl) {
  try {
    const url = new URL(inputUrl);
    const batchParam = url.searchParams.get('batch');
    const batchNum = parseInt(batchParam);
    if (!isNaN(batchNum) && batchNum >= 1 && batchNum <= 6) return batchNum;
    return null;
  } catch (e) {
    // Fallback: check if they just entered the number itself
    const batchNum = parseInt(inputUrl);
    if (!isNaN(batchNum) && batchNum >= 1 && batchNum <= 6) return batchNum;
    return null;
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const CIRCLE_CIRCUMFERENCE = 276.5;
function updateTimerCircle(secondsLeft) {
  const ratio = secondsLeft / TIMER_SECONDS;
  const offset = CIRCLE_CIRCUMFERENCE * (1 - ratio);
  dom.timerCircle.style.strokeDashoffset = offset;
}

// ── API calls ─────────────────────────────────────────────────────
async function fetchBatch(batchNumber) {
  const res = await fetch(`${API_BASE}/batch/${batchNumber}`);
  if (!res.ok) throw new Error('Could not load batch data.');
  return res.json();
}

async function startSession(batchNumber) {
  const res = await fetch(`${API_BASE}/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchNumber })
  });
  if (!res.ok) throw new Error('Could not start session.');
  return res.json();
}

async function submitResponse(payload) {
  const res = await fetch(`${API_BASE}/response`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Submission failed');
  return data;
}

// ── Experiment UI ─────────────────────────────────────────────────

function renderBanner(conditionCode) {
  console.log("1. renderBanner triggered with code:", conditionCode);
  
  const cond = CONDITIONS[conditionCode];
  if (!cond) {
    console.error("2. ERROR: Condition code not found in CONDITIONS object:", conditionCode);
    return;
  }

  // Ensure the DOM element exists
  if (!dom.bannerProduct) {
    console.error("3. ERROR: 'dom.bannerProduct' is undefined. check your DOM references.");
    return;
  }

  // Clear existing content
  dom.bannerProduct.innerHTML = ''; 
  
  const img = document.createElement('img');
  
  /**
   * DYNAMIC PATH RESOLUTION
   * This handles the '/frontend/public/' structure automatically.
   */
  const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
  const finalPath = `${basePath}images/banner-${cond.label}.png`;
  
  console.log("4. Attempting to set image src to:", finalPath);

  img.src = finalPath; 
  img.alt = `Advertisement for ${cond.product}`;
  
  // Apply styles directly to ensure it fills the container
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'contain';
  img.style.display = 'block';

  // Log successful browser attempt
  img.onload = () => console.log("5. SUCCESS: Image loaded into browser memory.");

  // Improved Error Handling
  img.onerror = function() {
    console.error("5. NETWORK ERROR: Browser failed to fetch:", img.src);
    dom.bannerProduct.innerHTML = `<div style="color:red; font-size:12px; padding:20px; text-align:center;">
      Failed to load image:<br>${cond.label}.png
    </div>`;
  };
  
  dom.bannerProduct.appendChild(img);

  // Update UI Elements
  if(dom.adLabelChip) dom.adLabelChip.textContent = cond.label;
  if(dom.bannerBg) dom.bannerBg.style.backgroundColor = cond.bgColor;
  if(dom.bannerTagline) dom.bannerTagline.textContent = cond.tagline;
} 

function updateProgress(stepIndex) {
  const pct = ((stepIndex) / 6) * 100;
  dom.progressSteps.style.width = `${pct}%`;
  dom.stepCurrent.textContent = stepIndex + 1;
  dom.stepTotal.textContent = 6;
}

function startTimer(onComplete) {
  state.timerSecondsLeft = TIMER_SECONDS;
  dom.timerDisplay.textContent = formatTime(TIMER_SECONDS);
  updateTimerCircle(TIMER_SECONDS);

  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    state.timerSecondsLeft -= 1;
    dom.timerDisplay.textContent = formatTime(state.timerSecondsLeft);
    updateTimerCircle(state.timerSecondsLeft);

    if (state.timerSecondsLeft <= 0) {
      clearInterval(state.timerInterval);
      onComplete();
    }
  }, 1000);
}

function showSurvey() {
  dom.adStage.classList.add('hidden');
  dom.surveyStage.classList.remove('hidden');
  renderSurveyQuestions();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderSurveyQuestions() {
  dom.questionsContainer.innerHTML = '';
  SURVEY_QUESTIONS.forEach((text, i) => {
    const qNum = i + 1;
    const card = document.createElement('div');
    card.className = 'question-card';
    card.innerHTML = `
      <div class="question-text"><span class="question-num">${qNum}</span>${text}</div>
      <div class="likert-row">
        ${[1, 2, 3, 4, 5].map(v => `
          <label class="likert-option">
            <input type="radio" name="q${qNum}" value="${v}" required>
            <span class="likert-btn">${v}</span>
          </label>
        `).join('')}
      </div>
    `;
    dom.questionsContainer.appendChild(card);
  });
}

function collectSurveyAnswers() {
  const answers = {};
  for (let i = 1; i <= 9; i++) {
    const selected = dom.surveyForm.querySelector(`input[name="q${i}"]:checked`);
    if (!selected) return null;
    answers[`q${i}`] = parseInt(selected.value);
  }
  return answers;
}

async function loadCondition(stepIndex) {
  const conditionCode = state.sequence[stepIndex];
  state.currentStep = stepIndex;

  dom.adStage.classList.remove('hidden');
  dom.surveyStage.classList.add('hidden');
  hideError(dom.surveyError);
  
  updateProgress(stepIndex);
  renderBanner(conditionCode);
  
  startTimer(() => {
    showSurvey();
  });
}

// ── Event Handlers ────────────────────────────────────────────────

dom.btnStart.addEventListener('click', async () => {
  hideError(dom.welcomeError);
  
  const accessInput = document.getElementById('inp-access-code'); // ID from index.html
  const inputLink = accessInput ? accessInput.value.trim() : "";
  const extractedBatch = validateAndExtractBatch(inputLink);

  if (!extractedBatch) {
    showError(dom.welcomeError, 'Invalid link. Please paste the full URL provided to you.');
    return;
  }

  dom.btnStart.disabled = true;
  dom.btnStart.textContent = 'Verifying...';

  try {
    state.batchNumber = extractedBatch;
    const batchData = await fetchBatch(state.batchNumber);
    state.sequence = batchData.sequence;

    const sessionData = await startSession(state.batchNumber);
    state.sessionId = sessionData.sessionId;

    showScreen('experiment');
    loadCondition(0);
  } catch (err) {
    showError(dom.welcomeError, 'Connection Error: ' + err.message);
    dom.btnStart.disabled = false;
    dom.btnStart.textContent = 'Begin Experiment';
  }
});

dom.surveyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(dom.surveyError);

  const answers = collectSurveyAnswers();
  if (!answers) {
    showError(dom.surveyError, 'Please answer all questions.');
    return;
  }

  dom.btnSubmit.disabled = true;
  dom.btnSubmit.textContent = 'Saving...';

  try {
    const result = await submitResponse({
      sessionId: state.sessionId,
      batchNumber: state.batchNumber,
      stepIndex: state.currentStep,
      conditionCode: state.sequence[state.currentStep],
      answers
    });

    if (state.currentStep >= 5) {
      showScreen('complete');
    } else {
      loadCondition(state.currentStep + 1);
    }
  } catch (err) {
    showError(dom.surveyError, err.message);
  } finally {
    dom.btnSubmit.disabled = false;
    dom.btnSubmit.textContent = 'Submit & Continue';
  }
});

// ── Init ──────────────────────────────────────────────────────────
(function init() {
  showScreen('welcome');
})();