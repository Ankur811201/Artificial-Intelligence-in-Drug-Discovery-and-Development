/* =========================================================
   AI in Drug Discovery — Interactive Logic
   Vanilla JS · No frameworks · No backend
   ========================================================= */

(function () {
  'use strict';

  /* -------------------- Lucide icons -------------------- */
  function applyLucide() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }
  document.addEventListener('DOMContentLoaded', function () {
    applyLucide();
    initChallenges();
    initOpenButtons();
    initExperiment();
  });

  /* -------------------- Expandable Challenge Cards -------------------- */
  function initChallenges() {
    var grid = document.getElementById('challengeGrid');
    if (!grid) return;
    grid.addEventListener('click', function (ev) {
      var node = ev.target.closest('.challenge');
      if (!node) return;
      var targetId = node.getAttribute('data-target');
      var body = document.getElementById(targetId);
      if (!body) return;
      var isOpen = node.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        node.setAttribute('aria-expanded', 'false');
        body.hidden = true;
      } else {
        node.setAttribute('aria-expanded', 'true');
        body.hidden = false;
      }
    });
  }

  /* -------------------- Open Experiment Buttons -------------------- */
  function initOpenButtons() {
    var ids = ['openExperimentBtn', 'openExperimentHero', 'openExperimentConclusion'];
    ids.forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', openExperiment);
    });
    var exit = document.getElementById('exitExperimentBtn');
    if (exit) exit.addEventListener('click', closeExperiment);
  }

  /* =========================================================
     EXPERIMENT STATE MACHINE
     ========================================================= */

  var STATE = {
    open: false,
    screenIndex: 0,
    candidates: [],
    investigatedSet: {},        // id -> boolean
    investigatedList: [],
    targetInvestigations: 3,
    aiStates: {},               // id -> score 0..100
    ranks: [],                  // sorted candidate ids
    highCount: 25,
    midCount: 80,
    aiDone: false,
  };

  var SCREENS = [
    'mission',
    'conventional',
    'burden',
    'transition',
    'ai-screening',
    'feel-diff',
    'how-ai-works',
    'top-candidate',
    'twist',
    'human-ai'
  ];

  /* -------------------- Deterministic data -------------------- */
  function buildCandidates() {
    // Letters A–Y (25 letters) × 8 = 200 deterministic candidates
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXY'.split('');
    var pool = [];
    var count = 0;
    for (var i = 0; i < letters.length; i++) {
      for (var j = 1; j <= 8; j++) {
        count++;
        var id = letters[i] + (j < 10 ? '0' + j : String(j));
        pool.push({
          id: id,
          index: count,
          letter: letters[i]
        });
      }
    }
    return pool; // length === 200
  }

  // Deterministic simulated AI score per candidate
  // Produces a global ranking; A17 lands in the top.
  function aiScore(c, idxInPool) {
    // Hash-like deterministic function over letter + index
    var letterCode = c.letter.charCodeAt(0);
    var num = parseInt(c.id.slice(1), 10);
    // Combination: stable hash producing values 0..1
    var h = (Math.sin(letterCode * 9.3 + num * 0.71 + idxInPool * 0.13) * 10000);
    h = h - Math.floor(h); // fractional 0..1
    // Boost A17 explicitly so it sits at rank 1 without magic — clear & educational
    if (c.id === 'A17') return 0.91;
    // Spread scores realistically, with variance
    return h * 0.78 + 0.10; // 0.10 .. 0.88
  }

  function setupCandidates() {
    STATE.candidates = buildCandidates();
    STATE.investigatedSet = {};
    STATE.investigatedList = [];
    STATE.aiStates = {};
    STATE.aiDone = false;
    STATE.aiRunning = false;
    STATE.candidates.forEach(function (c, i) {
      STATE.aiStates[c.id] = aiScore(c, i);
    });
    // Compute lower-precision integer scores and ranking for animation
    STATE.ranks = STATE.candidates.slice().sort(function (a, b) {
      return STATE.aiStates[b.id] - STATE.aiStates[a.id];
    }).map(function (c) { return c.id; });

    // Counts of top-mid vs bottom
    STATE.highCutoff = 25;
    STATE.midCutoff = 80; // 25 high + 55 mid + 120 low
  }

  /* -------------------- Open / Close / Reset -------------------- */
  var stage, progressFill, progressDots;

  function initExperiment() {
    stage = document.getElementById('expStage');
    progressFill = document.getElementById('expProgressFill');
    progressDots = document.getElementById('expProgressDots');

    // Render dots
    progressDots.innerHTML = '';
    SCREENS.forEach(function () {
      var d = document.createElement('span');
      progressDots.appendChild(d);
    });

    setupCandidates();
  }

  function openExperiment() {
    resetExperiment();
    var root = document.getElementById('experiment');
    STATE.open = true;
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    renderScreen(0);
    applyLucide();
    // Focus management
    setTimeout(function () {
      var focusable = root.querySelector('button, [tabindex]:not([tabindex="-1"])');
      if (focusable) focusable.focus({ preventScroll: true });
    }, 50);
  }

  function closeExperiment() {
    var root = document.getElementById('experiment');
    STATE.open = false;
    root.hidden = true;
    document.body.style.overflow = '';
    resetExperiment();
  }

  function resetExperiment() {
    setupCandidates();
    STATE.screenIndex = 0;
    updateProgress();
    if (stage) stage.innerHTML = '';
  }

  function updateProgress() {
    if (!progressFill || !progressDots) return;
    var pct = Math.round(((STATE.screenIndex + 1) / SCREENS.length) * 100);
    progressFill.style.width = pct + '%';
    var dots = progressDots.querySelectorAll('span');
    dots.forEach(function (d, i) {
      d.classList.remove('done', 'cur');
      if (i < STATE.screenIndex) d.classList.add('done');
      else if (i === STATE.screenIndex) d.classList.add('cur');
    });
  }

  /* -------------------- Renderers -------------------- */
  function nextScreen() {
    if (STATE.screenIndex < SCREENS.length - 1) {
      STATE.screenIndex++;
      renderScreen(STATE.screenIndex);
    }
  }

  function renderScreen(idx) {
    STATE.screenIndex = idx;
    updateProgress();
    stage.scrollTop = 0;
    var html = '';
    switch (SCREENS[idx]) {
      case 'mission':       html = renderMission(); break;
      case 'conventional':  html = renderConventional(); break;
      case 'burden':        html = renderBurden(); break;
      case 'transition':    html = renderTransition(); break;
      case 'ai-screening':  html = renderAIScreening(); break;
      case 'feel-diff':     html = renderFeelDiff(); break;
      case 'how-ai-works':  html = renderHowAI(); break;
      case 'top-candidate': html = renderTopCandidate(); break;
      case 'twist':         html = renderTwist(); break;
      case 'human-ai':      html = renderHumanAi(); break;
      default: html = '';
    }
    stage.innerHTML = '<div class="exp-screen" id="expScreen">' + html + '</div>';
    bindScreen(SCREENS[idx]);
    applyLucide();
  }

  function el(html) { return html; }

  /* ---------- Screen 1: Mission ---------- */
  function renderMission() {
    return el(
      '<span class="exp-eyebrow">Part 1</span>' +
      '<h2 class="exp-title">You are the researcher.</h2>' +
      '<p class="exp-subtitle">Your goal is to identify a promising candidate for further investigation.</p>' +

      '<div class="mission-stat">' +
        '<div class="mission-stat-card">' +
          '<div class="mission-stat-label">Illustrative Candidates</div>' +
          '<div class="mission-stat-value">200</div>' +
          '<div class="mission-stat-note">A small fictional pool used to demonstrate the search and prioritization problem.</div>' +
        '</div>' +
      '</div>' +

      '<div class="note-box">' +
        '<strong>Note.</strong> This is a simplified educational simulation. Conventional drug discovery uses chemistry, biology, laboratory screening, expert knowledge, statistics, and computational chemistry — not random molecule selection.' +
      '</div>' +

      '<div class="actions">' +
        '<button class="btn btn-primary btn-lg" id="expMissionBtn" type="button">' +
          '<span>Begin Search</span>' +
          '<i data-lucide="arrow-right"></i>' +
        '</button>' +
      '</div>'
    );
  }

  /* ---------- Screen 2: Conventional Screening ---------- */
  function renderConventional() {
    return el(
      '<span class="exp-eyebrow">Part 1</span>' +
      '<h2 class="exp-title">Conventional screening</h2>' +
      '<p class="exp-text">Drug discovery uses scientific knowledge and structured screening methods. This simplified interaction demonstrates how experimental investigation becomes burdensome when many candidates require evaluation.</p>' +

      '<div class="cand-grid" id="candGrid" role="grid" aria-label="200 candidates"></div>' +

      '<div id="processing" class="processing-card" hidden>' +
        '<div class="processing-step" data-step="prep"><i data-lucide="hourglass"></i><span>Candidate selected…</span></div>' +
        '<div class="processing-step" data-step="prepare"><i data-lucide="flask-conical"></i><span>Preparing test…</span></div>' +
        '<div class="processing-step" data-step="assess"><i data-lucide="activity"></i><span>Experimental assessment…</span></div>' +
        '<div class="processing-step" data-step="analyze"><i data-lucide="bar-chart-3"></i><span>Analyzing results…</span></div>' +
        '<div class="processing-step" data-step="verdict"><i data-lucide="alert-triangle"></i><span>Not prioritized — continuing</span></div>' +
      '</div>' +

      '<div class="investigated-list" id="investigatedList" aria-live="polite"></div>' +

      '<div class="kpi-row" id="convKpis">' +
        '<div class="kpi"><div class="kpi-label">Tested</div><div class="kpi-value" id="kpiTested">0 / 200</div></div>' +
        '<div class="kpi"><div class="kpi-label">Remaining</div><div class="kpi-value amber" id="kpiRemaining">200</div></div>' +
      '</div>' +

      '<div class="burden-meters" id="burdenMeters">' +
        renderMeter('Time burden', 0) +
        renderMeter('Resource use', 0) +
        renderMeter('Experimental effort', 0) +
      '</div>'
    );
  }

 function renderMeter(name, value) {
  var pct = Math.min(100, Math.max(0, Math.round(value)));

  return (
    '<div class="meter">' +
      '<div class="meter-row">' +
        '<span class="meter-name">' + name + '</span>' +
        '<span class="meter-pct">' + pct + '%</span>' +
      '</div>' +
      '<div class="meter-bar">' +
        '<div class="meter-fill" style="width:' + pct + '%"></div>' +
      '</div>' +
    '</div>'
  );
}

  /* ---------- Screen 3: Feel the Pain ---------- */
  function renderBurden() {
    var investigated = STATE.investigatedList.length;
    var remaining = 200 - investigated;
    var listHtml = STATE.investigatedList.map(function (id) {
      return '<li>Candidate ' + id + '</li>';
    }).join('');
    return el(
      '<span class="exp-eyebrow">Outcome</span>' +
      '<h2 class="exp-title">You have barely started.</h2>' +

      '<div class="kpi-row">' +
        '<div class="kpi"><div class="kpi-label">Investigated</div><div class="kpi-value amber">' + investigated + '</div></div>' +
        '<div class="kpi"><div class="kpi-label">Remaining</div><div class="kpi-value">' + remaining + '</div></div>' +
      '</div>' +

      '<div class="investigated-list">' + listHtml + '</div>' +

      '<div class="note-box">' +
        '<strong>Simulation vs reality.</strong> ' +
        'This realistic small pool represents the <em>search and prioritization burden</em> — it is <strong>not</strong> the full pharmaceutical development process.' +
      '</div>' +

      '<div class="compare">' +
        '<div class="compare-card">' +
          '<h4>Simulation</h4>' +
          '<div class="kpi-row">' +
            '<div class="kpi"><div class="kpi-label">Investigated</div><div class="kpi-value amber">' + investigated + '</div></div>' +
            '<div class="kpi"><div class="kpi-label">Remaining</div><div class="kpi-value">' + remaining + '</div></div>' +
          '</div>' +
        '</div>' +
        '<div class="compare-card">' +
          '<h4>Real drug development</h4>' +
          '<div class="kpi-row">' +
            '<div class="kpi"><div class="kpi-label">Time</div><div class="kpi-value">10+ <small style="font-size:14px;font-weight:600">years</small></div></div>' +
            '<div class="kpi"><div class="kpi-label">Cost</div><div class="kpi-value">&gt;$2 <small style="font-size:14px;font-weight:600">B</small></div></div>' +
          '</div>' +
          '<p class="exp-text" style="margin-top:8px;font-size:13px">Only about <strong>10%</strong> of candidates entering clinical trials are ultimately approved.</p>' +
          '<p class="source-note" style="margin-top:8px"><i data-lucide="info"></i> Figures describe broader discovery &amp; development. See <a href="#references" onclick="return false">References</a>.</p>' +
        '</div>' +
      '</div>' +

      '<div class="burden-meters" style="margin-top:6px">' +
        renderMeter('Time burden', 65) +
        renderMeter('Cost burden', 70) +
        renderMeter('Attrition rate', 90) +
      '</div>' +

      '<p class="exp-text" style="font-size:20px;font-weight:700;color:var(--text);margin-top:14px">Can we make the search<br/>more informed and focused?</p>' +

      '<div class="actions">' +
        '<button class="btn btn-primary btn-lg" id="activateAiBtn" type="button">' +
          '<span>Activate AI Assistance</span>' +
          '<i data-lucide="arrow-right"></i>' +
        '</button>' +
      '</div>'
    );
  }

  /* ---------- Screen 4: Transition ---------- */
  function renderTransition() {
    var grid = renderCandGrid('mini');
    return el(
      '<span class="exp-eyebrow">Transition</span>' +
      '<h2 class="exp-title">Same candidates.<br/>Different approach.</h2>' +
      '<p class="exp-text">We keep the same pool — only the screening strategy changes.</p>' +

      grid +

      '<div class="callout" style="margin-top:14px">' +
        '<i data-lucide="info"></i>' +
        '<span>The 200 illustrative candidates are not replaced. AI computationally screens and ranks this same pool.</span>' +
      '</div>' +

      '<p class="label-tag" style="margin-top:14px">Part 2 · AI-assisted prioritization</p>' +

      '<div class="actions">' +
        '<button class="btn btn-primary btn-lg" id="runAiBtn" type="button">' +
          '<span>Run AI Screening</span>' +
          '<i data-lucide="brain-circuit"></i>' +
        '</button>' +
      '</div>'
    );
  }

  function renderCandGrid(variant) {
    var container = '<div class="cand-grid" data-variant="' + variant + '" aria-hidden="true">';
    STATE.candidates.forEach(function (c) {
      if (STATE.investigatedSet[c.id]) {
        container += '<span class="cand investigated" data-id="' + c.id + '" title="' + c.id + '">' + c.id + '</span>';
      } else {
        container += '<span class="cand" data-id="' + c.id + '" title="' + c.id + '">' + c.id + '</span>';
      }
    });
    container += '</div>';
    return container;
  }

  /* ---------- Screen 5: AI Screening ---------- */
  function renderAIScreening() {
    var grid = renderCandGrid('full');
    return el(
      '<span class="exp-eyebrow">Part 2 · AI-assisted</span>' +
      '<h2 class="exp-title">AI screening</h2>' +
      '<p class="exp-text">AI analyzes each candidate\'s learned representation, estimates molecular properties, and assigns a priority score.</p>' +

      grid +

      '<div class="processing-card" id="aiProcessing" hidden>' +
        '<div class="processing-step" data-step="read"><i data-lucide="database"></i><span>Reading candidate representations…</span></div>' +
        '<div class="processing-step" data-step="patterns"><i data-lucide="sigma"></i><span>Finding learned patterns…</span></div>' +
        '<div class="processing-step" data-step="props"><i data-lucide="test-tube-2"></i><span>Estimating properties…</span></div>' +
        '<div class="processing-step" data-step="compare"><i data-lucide="git-compare"></i><span>Comparing predictions…</span></div>' +
        '<div class="processing-step" data-step="rank"><i data-lucide="bar-chart-4"></i><span>Ranking candidates…</span></div>' +
      '</div>' +

      '<div class="kpi-row" id="aiKpis" hidden>' +
        '<div class="kpi"><div class="kpi-label">Screened</div><div class="kpi-value green">200</div></div>' +
        '<div class="kpi"><div class="kpi-label">High priority</div><div class="kpi-value green">25</div></div>' +
        '<div class="kpi"><div class="kpi-label">Medium priority</div><div class="kpi-value" style="color:var(--accent-2)">55</div></div>' +
        '<div class="kpi"><div class="kpi-label">Low priority</div><div class="kpi-value">120</div></div>' +
      '</div>' +

      '<p class="label-tag" style="margin-top:6px">Illustrative simulation · not a real pharmaceutical success rate</p>' +
      '<p class="exp-text" style="font-size:13px;margin-top:0;color:var(--text-mute)">AI computationally screened and ranked the candidates — it did not experimentally test them.</p>'
    );
  }

  /* ---------- Screen 6: Feel the Difference ---------- */
  function renderFeelDiff() {
    return el(
      '<span class="exp-eyebrow">Comparison</span>' +
      '<h2 class="exp-title">Feel the difference</h2>' +

      '<div class="compare">' +
        '<div class="compare-card">' +
          '<h4>Conventional screening</h4>' +
          '<div class="kpi-row">' +
            '<div class="kpi"><div class="kpi-label">Investigated</div><div class="kpi-value amber">3</div></div>' +
            '<div class="kpi"><div class="kpi-label">Remaining</div><div class="kpi-value">197</div></div>' +
          '</div>' +
          '<p class="exp-text" style="margin-top:8px;font-size:14px">Experimental burden grows as investigation continues.</p>' +
        '</div>' +
        '<div class="compare-card ai">' +
          '<h4>AI-assisted</h4>' +
          '<div class="kpi-row">' +
            '<div class="kpi"><div class="kpi-label">Screened</div><div class="kpi-value green">200</div></div>' +
            '<div class="kpi"><div class="kpi-label">Prioritized</div><div class="kpi-value green">25</div></div>' +
          '</div>' +
          '<p class="exp-text" style="margin-top:8px;font-size:14px">Experimental attention can be focused.</p>' +
        '</div>' +
      '</div>' +

      '<div class="note-box">' +
        'This is an <strong>educational workflow demonstration</strong>, not a measured real-world speed comparison.' +
      '</div>' +

      '<p class="exp-text" style="font-size:20px;font-weight:700;margin-top:14px">' +
        'AI did not remove the experiment.<br/>' +
        '<em style="color:var(--accent-2)">It helped decide what to investigate first.</em>' +
      '</p>' +

      '<div class="actions">' +
        '<button class="btn btn-primary btn-lg" id="howAiBtn" type="button">' +
          '<span>How did AI do that?</span>' +
          '<i data-lucide="arrow-right"></i>' +
        '</button>' +
      '</div>'
    );
  }

  /* ---------- Screen 7: How AI works (simplified) ---------- */
  function renderHowAI() {
    return el(
      '<span class="exp-eyebrow">Explain</span>' +
      '<h2 class="exp-title">How AI prioritized candidates</h2>' +

      '<div class="transform">' +
        '<div class="t-node"><span>Molecular / biological data</span></div>' +
        '<i class="t-arrow" data-lucide="arrow-down"></i>' +
        '<div class="t-node"><span>Numerical representation</span></div>' +
        '<i class="t-arrow" data-lucide="arrow-down"></i>' +
        '<div class="t-node t-node-accent"><span>Machine learning model</span></div>' +
        '<i class="t-arrow" data-lucide="arrow-down"></i>' +
        '<div class="t-node"><span>Property predictions</span></div>' +
        '<i class="t-arrow" data-lucide="arrow-down"></i>' +
        '<div class="t-node t-node-warn"><span>Ranking</span></div>' +
      '</div>' +

      '<p class="exp-text center max-680" style="margin-inline:auto">Machine-learning models learn patterns from existing data and use those patterns to <em>estimate properties</em> of new candidates. These predictions help researchers prioritize candidates for further investigation.</p>' +
      '<p class="exp-text center" style="font-size:13px;margin-inline:auto;color:var(--text-mute)">The model does not "understand" chemistry the way a human does — it identifies statistical patterns from training data.</p>' +

      '<div class="actions">' +
        '<button class="btn btn-primary btn-lg" id="topCandidateBtn" type="button">' +
          '<span>Show Top Candidate</span>' +
          '<i data-lucide="arrow-right"></i>' +
        '</button>' +
      '</div>'
    );
  }

  /* ---------- Screen 8: Top candidate ---------- */
  function renderTopCandidate() {
    return el(
      '<span class="exp-eyebrow">Result</span>' +
      '<h2 class="exp-title">Top-ranked candidate</h2>' +

      '<div class="candidate-card">' +
        '<div class="candidate-meta">' +
          '<span class="label-tag">Fictional candidate</span>' +
          '<div class="candidate-id">Candidate A17</div>' +
          '<div class="meta-row"><span>Rank</span><span>#1 of 200</span></div>' +
          '<div class="score-big">' +
            '<span>Simulated AI Score</span>' +
            '<span>91 / 100</span>' +
          '</div>' +
          '<div class="meta-row"><span>Predicted activity</span><span style="color:var(--green)">High</span></div>' +
          '<div class="meta-row"><span>Drug-like properties</span><span style="color:var(--accent-2)">Promising</span></div>' +
          '<div class="meta-row"><span>Safety indicators</span><span style="color:var(--amber)">Needs validation</span></div>' +
        '</div>' +
      '</div>' +

      '<div class="note-box">' +
        '<strong>Illustrative predictions.</strong> A17 is a fictional candidate. Scores and properties are simulated for education only — they are <strong>not</strong> experimental results.' +
      '</div>' +

      '<p class="exp-text" style="font-size:20px;font-weight:700;margin-top:6px">AI has prioritized A17.<br/>Have we discovered a medicine?</p>' +

      '<div class="decision-row">' +
        '<button class="btn btn-ghost btn-lg" id="decideYes" type="button">Yes</button>' +
        '<button class="btn btn-primary btn-lg" id="decideNo" type="button">No</button>' +
      '</div>'
    );
  }

  /* ---------- Screen 9: The Twist ---------- */
  function renderTwist() {
    return el(
      '<span class="exp-eyebrow">Reality check</span>' +
      '<h2 class="exp-title"><span style="color:var(--red)">No.</span></h2>' +

      '<p class="exp-text" style="font-size:22px;font-weight:700;color:var(--text)">' +
        'AI prediction<br/>' +
        'is <em style="color:var(--red)">not</em><br/>' +
        'experimental proof.' +
      '</p>' +

      '<div class="burden-meters">' +
        '<div class="meter"><div class="meter-row"><span class="meter-name">A17 is computationally promising</span></div><div class="meter-bar"><div class="meter-fill" style="width:91%"></div></div></div>' +
        '<div class="meter"><div class="meter-row"><span class="meter-name">Experimental evidence</span></div><div class="meter-bar" style="background:rgba(239,68,68,.18)"><div class="meter-fill" style="width:5%"></div></div></div>' +
      '</div>' +

      '<p class="exp-text" style="font-weight:600;color:var(--text);margin-top:10px">A promising candidate still must pass:</p>' +

      '<div class="validation-chain">' +
        '<div class="chain-step fail"><h5>01 · Lab testing</h5><p>May fail.</p></div>' +
        '<div class="chain-step fail"><h5>02 · Preclinical</h5><p>May fail.</p></div>' +
        '<div class="chain-step fail"><h5>03 · Clinical</h5><p>May fail.</p></div>' +
        '<div class="chain-step fail"><h5>04 · Regulatory</h5><p>May fail.</p></div>' +
        '<div class="chain-step success"><h5>05 · Possible medicine</h5><p>Only after evidence.</p></div>' +
      '</div>' +

      '<div class="note-box">' +
        '<strong>AI</strong> helps decide <em>where</em> to investigate. <br/>' +
        '<strong>Experiments</strong> determine whether predictions hold up.' +
      '</div>'
    );
  }

  /* ---------- Screen 10: AI + Human ---------- */
  function renderHumanAi() {
    return el(
      '<span class="exp-eyebrow">Conclusion</span>' +
      '<h2 class="exp-title">AI + scientist</h2>' +

      '<div class="duo">' +
        '<div class="duo-col duo-ai">' +
          '<h3><i data-lucide="brain-circuit"></i> AI</h3>' +
          '<ul>' +
            '<li>Analyze</li>' +
            '<li>Predict</li>' +
            '<li>Rank</li>' +
            '<li>Prioritize</li>' +
          '</ul>' +
        '</div>' +
        '<div class="duo-plus">+</div>' +
        '<div class="duo-col duo-human">' +
          '<h3><i data-lucide="user-round"></i> Scientist</h3>' +
          '<ul>' +
            '<li>Experiment</li>' +
            '<li>Interpret</li>' +
            '<li>Validate</li>' +
            '<li>Decide</li>' +
          '</ul>' +
        '</div>' +
      '</div>' +

      '<blockquote class="big-quote">' +
        'AI helps find <em>where to look.</em><br/>' +
        'Science determines <em>what works.</em>' +
      '</blockquote>' +

      '<blockquote class="big-quote" style="margin-top:14px;border-color:rgba(52,211,153,.3);background:linear-gradient(180deg,rgba(52,211,153,.10),rgba(52,211,153,.02))">' +
        'AI accelerates the search.<br/>' +
        'Science validates the answer.' +
      '</blockquote>' +

      '<div class="closing-cta">' +
        '<a class="btn btn-primary btn-lg" href="#top" id="returnSiteBtn" type="button">' +
          '<span>Return to Website</span>' +
          '<i data-lucide="home"></i>' +
        '</a>' +
        '<a class="btn btn-ghost btn-lg" href="#applications" id="exploreScienceBtn" type="button">' +
          '<span>Explore the Science</span>' +
          '<i data-lucide="arrow-right"></i>' +
        '</a>' +
      '</div>'
    );
  }

  /* =========================================================
     SCREEN BINDINGS
     ========================================================= */
  function bindScreen(name) {
    switch (name) {
      case 'mission':
        var mb = document.getElementById('expMissionBtn');
        if (mb) mb.addEventListener('click', function () { nextScreen(); });
        break;

      case 'conventional':
        renderCandidateGrid();
        break;

      case 'burden':
        var ab = document.getElementById('activateAiBtn');
        if (ab) ab.addEventListener('click', function () { nextScreen(); });
        break;

      case 'transition':
        var tb = document.getElementById('runAiBtn');
        if (tb) {
          tb.addEventListener('click', function () {
            tb.disabled = true;
            nextScreen();
            // runAIScreening() is triggered automatically when 'ai-screening' renders
          });
        }
        break;

      case 'ai-screening':
        // Trigger the AI screening animation when this screen renders
        runAIScreening();
        break;

      case 'feel-diff':
        var hb = document.getElementById('howAiBtn');
        if (hb) hb.addEventListener('click', function () { nextScreen(); });
        break;

      case 'how-ai-works':
        var tc = document.getElementById('topCandidateBtn');
        if (tc) tc.addEventListener('click', function () { nextScreen(); });
        break;

      case 'top-candidate':
        var yes = document.getElementById('decideYes');
        var no = document.getElementById('decideNo');
        if (yes) yes.addEventListener('click', function () { nextScreen(); });
        if (no) no.addEventListener('click', function () { nextScreen(); });
        break;

      case 'human-ai':
        var r = document.getElementById('returnSiteBtn');
        var e = document.getElementById('exploreScienceBtn');
        if (r) r.addEventListener('click', function (ev) {
          ev.preventDefault();
          closeExperiment();
          setTimeout(function () { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 80);
        });
        if (e) e.addEventListener('click', function (ev) {
          ev.preventDefault();
          closeExperiment();
          setTimeout(function () {
            var apps = document.getElementById('applications');
            if (apps) apps.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 80);
        });
        break;
    }
  }

  /* =========================================================
     CONVENTIONAL SCREENING FLOW
     ========================================================= */
  function renderCandidateGrid() {
    var grid = document.getElementById('candGrid');
    if (!grid) return;
    grid.innerHTML = '';
    STATE.candidates.forEach(function (c) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cand';
      btn.textContent = c.id;
      btn.dataset.id = c.id;
      btn.setAttribute('aria-label', 'Candidate ' + c.id);
      btn.addEventListener('click', function () { onCandidateClick(c.id, btn); });
      grid.appendChild(btn);
    });
    updateConvKPIs();

    // Auto-trigger first investigation after a brief pause so the story advances
    // But ONLY if user hasn't taken manual control yet — to honor "manual selection"
    // per spec we keep it manual but provide a clear cue. We DO NOT auto-investigate.
  }

  function onCandidateClick(id, el) {
    if (STATE.investigatedSet[id]) return;
    if (el.classList.contains('processing')) return;

    // Disable selecting other candidates during processing
    var all = document.querySelectorAll('#candGrid .cand');
    all.forEach(function (n) {
      if (n.dataset.id !== id) n.classList.add('investigated');
    });
    el.classList.add('processing');

    // Show processing card
    var proc = document.getElementById('processing');
    if (proc) proc.hidden = false;
    runProcessingSteps(proc, function () {
      // Mark investigated
      STATE.investigatedSet[id] = true;
      STATE.investigatedList.push(id);
      el.classList.remove('processing');
      el.classList.add('investigated');

      // Update visible list
      var list = document.getElementById('investigatedList');
      if (list) {
        var li = document.createElement('li');
        li.textContent = 'Candidate ' + id + ' — experimental assessment complete';
        list.appendChild(li);
      }
      updateConvKPIs();
      updateBurdenMeters();

      // Re-enable remaining candidates
      all.forEach(function (n) {
        if (!STATE.investigatedSet[n.dataset.id]) n.classList.remove('investigated');
      });
      // Hide processing card after last step
      if (proc) proc.hidden = true;

      // After required count, auto-advance
      if (STATE.investigatedList.length >= STATE.targetInvestigations) {
        setTimeout(function () { nextScreen(); }, 1200);
      }
    });
  }

  function runProcessingSteps(container, done) {
    var steps = container.querySelectorAll('.processing-step');
    var order = ['prep', 'prepare', 'assess', 'analyze', 'verdict'];
    var i = 0;
    function next() {
      steps.forEach(function (s, idx) {
        s.classList.remove('active', 'done');
      });
      var prev = null;
      var activeIdx = i;
      for (var k = 0; k < steps.length; k++) {
        var step = steps[k];
        var stepName = step.getAttribute('data-step');
        if (stepName === order[activeIdx]) {
          step.classList.add('active');
          if (prev) prev.classList.add('done');
          prev = step;
        }
      }
      i++;
      if (i < order.length) {
        setTimeout(next, 380);
      } else {
        setTimeout(function () {
          // mark final as done
          steps.forEach(function (s) { s.classList.remove('active'); s.classList.add('done'); });
          setTimeout(done, 350);
        }, 420);
      }
    }
    next();
  }

  function updateConvKPIs() {
    var testedEl = document.getElementById('kpiTested');
    var remEl = document.getElementById('kpiRemaining');
    var n = STATE.investigatedList.length;
    if (testedEl) testedEl.textContent = n + ' / 200';
    if (remEl) remEl.textContent = (200 - n);
  }

  function updateBurdenMeters() {
    var n = STATE.investigatedList.length;
    var pct = Math.min(30 + n * 22, 95); // 30 → 96 after 3
    var mm = document.getElementById('burdenMeters');
    if (!mm) return;
    var fills = mm.querySelectorAll('.meter-fill');
    var pcts = mm.querySelectorAll('.meter-pct');
    var names = ['Time burden', 'Resource use', 'Experimental effort'];
    var values = [pct, Math.max(30, pct - 8), Math.max(30, pct - 4)];
    fills.forEach(function (f, i) {
      f.style.width = values[i] + '%';
    });
    pcts.forEach(function (p, i) {
      p.textContent = values[i] + '%';
    });
  }

  /* =========================================================
     AI SCREENING FLOW
     ========================================================= */
  function runAIScreening() {
    var grid = document.querySelector('#candGrid, .exp-screen .cand-grid');
    if (!grid) return;
    if (STATE.aiRunning) return;          // debounce / prevent double-trigger
    STATE.aiRunning = true;
    var candEls = grid.querySelectorAll('.cand');
    var proc = document.getElementById('aiProcessing');
    var kpis = document.getElementById('aiKpis');

    if (STATE.aiDone) {
      // Already ran — show final classification immediately
      applyClasses(candEls);
      if (proc) proc.hidden = true;
      if (kpis) kpis.hidden = false;
      // Attach click listener to advance on first interaction with grid
      return;
    }

    if (proc) proc.hidden = false;
    if (kpis) kpis.hidden = true;

    var steps = proc ? proc.querySelectorAll('.processing-step') : [];
    var order = ['read', 'patterns', 'props', 'compare', 'rank'];
    var i = 0;

    function nextStep() {
      steps.forEach(function (s) { s.classList.remove('active', 'done'); });
      var prev = null;
      var activeIdx = i;
      for (var k = 0; k < steps.length; k++) {
        var step = steps[k];
        var stepName = step.getAttribute('data-step');
        if (stepName === order[activeIdx]) {
          step.classList.add('active');
          if (prev) prev.classList.add('done');
          prev = step;
        }
      }
      i++;
      if (i < order.length) {
        setTimeout(nextStep, 600);
      } else {
        setTimeout(function () {
          steps.forEach(function (s) { s.classList.remove('active'); s.classList.add('done'); });
          // Apply classifications
          applyClasses(candEls);
          STATE.aiDone = true;
          if (proc) proc.hidden = true;
          if (kpis) kpis.hidden = false;
          // Continue to next screen after reveal pause
          setTimeout(function () { nextScreen(); }, 2000);
        }, 800);
      }
    }
    // Slight delay before starting so the AI grid is visible
    setTimeout(nextStep, 200);

    function applyClasses(els) {
      var ranks = STATE.ranks; // sorted desc by score
      var cutoff = {
        high: ranks[STATE.highCutoff - 1],           // score at rank 25
        mid:  ranks[STATE.highCutoff + STATE.midCutoff - 1]  // hmm — but midCutoff includes high range
      };
      // Recompute clean counts: high=25, mid=55, low=120 from ranks
      els.forEach(function (el, idx) {
        var id = el.dataset.id;
        var rank = ranks.indexOf(id);
        el.classList.remove('ai-high', 'ai-mid', 'ai-low', 'top-A17');
        if (rank < 25) {
          el.classList.add('ai-high');
          if (id === 'A17') el.classList.add('top-A17');
        } else if (rank < 80) {
          el.classList.add('ai-mid');
        } else {
          el.classList.add('ai-low');
        }
      });
    }
  }

  /* =========================================================
     KEYBOARD SUPPORT
     ========================================================= */
  document.addEventListener('keydown', function (ev) {
    if (!STATE.open) return;
    if (ev.key === 'Escape') {
      closeExperiment();
    }
  });
})();
