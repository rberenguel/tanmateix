import { PathBasedQuestionGenerator } from "./generators/PathBasedQuestionGenerator.js";
import { RandomUtils } from "./utils/RandomUtils.js";
import { EntityFactory } from "./utils/EntityFactory.js";
import { Renderer } from "./render/Renderer.js";

// Game state
const gameState = {
  score: 0,
  total: 100,
  questionNumber: 1,
  currentQuestion: null,
  answered: false,
  consecutiveCorrect: 0,
  difficulty: {
    numPaths: 1,
    entitiesPerPath: 3,
    timeLimit: 30,
  },
  timer: null,
  timeRemaining: 30,
  isPaused: false,
  questionHistory: [], // Track all questions for export
};

// Setup
const random = new RandomUtils();
const entityFactory = new EntityFactory(
  {
    useNonsenseWords: true,
    nonsenseWordLength: 3,
  },
  random,
);

const generator = new PathBasedQuestionGenerator({
  entityFactory,
  linearDimensions: [
    "size",
    "speed",
    "brightness",
    "temperature",
    "weight",
    "height",
    "age",
    "temporal",
    "distance",
    "depth",
    "width",
    "length",
    "volume",
    "density",
    "hardness",
    "cost",
    "difficulty",
    "strength",
    "power",
    "value",
    "quality",
    "rank",
    "quantity",
    "latency",
    "throughput",
    "availability",
    "error_rate",
    "reliability",
  ],
  random,
});

const renderer = new Renderer();

// Expose API for testing different configurations
window.tanmateix = {
  numPaths: 1, // Default to 1 path
  entitiesPerPath: 3, // Default to 3 entities (= 2 premises per path)
  generator: generator,
  gameState: gameState,

  // Generate a new question with current settings
  newQuestion: async () => {
    const question = await generator.generateMultiPathQuestion(
      window.tanmateix.numPaths,
      window.tanmateix.entitiesPerPath,
    );
    gameState.currentQuestion = question;
    gameState.answered = false;

    // Render
    const container = document.getElementById("game-container");
    container.innerHTML = renderer.renderGameUI(question);

    // Add event listeners to buttons
    container.querySelectorAll(".btn").forEach((btn) => {
      btn.addEventListener("click", handleAnswer);
    });

    // Update debug info
    const debugInfo = document.getElementById("debug-info");
    debugInfo.innerHTML = renderer.renderNetworkInfo(question);

    return question;
  },

  // Quick test with different path counts
  test2Path: () => {
    window.tanmateix.numPaths = 2;
    return window.tanmateix.newQuestion();
  },
  test3Path: () => {
    window.tanmateix.numPaths = 3;
    return window.tanmateix.newQuestion();
  },
  test4Path: () => {
    window.tanmateix.numPaths = 4;
    return window.tanmateix.newQuestion();
  },

  // Quick test with longer paths (more premises per path)
  testLongPath: (entities = 5) => {
    window.tanmateix.entitiesPerPath = entities;
    window.tanmateix.numPaths = 1;
    return window.tanmateix.newQuestion();
  },

  // Test spatial graph (fully-connected configuration)
  testSpatialGraph: async (entities = 3) => {
    const question = await generator.generateSpatialGraphQuestion(entities);
    gameState.currentQuestion = question;
    gameState.answered = false;

    const container = document.getElementById("game-container");
    container.innerHTML = renderer.renderGameUI(question);

    container.querySelectorAll(".btn").forEach((btn) => {
      btn.addEventListener("click", handleAnswer);
    });

    const debugInfo = document.getElementById("debug-info");
    debugInfo.innerHTML = renderer.renderNetworkInfo(question);

    return question;
  },

  // Compare: path-based vs configuration-based spatial reasoning
  compareSpatial: () => {
    console.log("\n=== COMPARISON: Spatial Reasoning ===\n");

    console.log("Test 1: PATH-BASED (4 entities, 3 premises)");
    console.log("Mental task: Accumulate vectors along a chain (A→B→C→D)");
    console.log("Run: window.tanmateix.testLongPath(4)");

    console.log("\n---\n");

    console.log("Test 2: CONFIGURATION-BASED (3 entities, 3 premises)");
    console.log("Mental task: Understand spatial configuration (triangle)");
    console.log("Run: window.tanmateix.testSpatialGraph(3)");

    console.log("\nTry both and compare which feels better!");
  },

  // Turn off timer for testing
  timerOff: () => {
    if (gameState.timer) {
      clearInterval(gameState.timer);
      gameState.timer = null;
      console.log("⏸️  Timer stopped");
    }
  },

  // Turn on timer
  timerOn: () => {
    startTimer();
    console.log("▶️  Timer started");
  },
};

// Generate and display question
async function newQuestion() {
  // Use difficulty settings
  const { numPaths, entitiesPerPath, timeLimit } = gameState.difficulty;
  gameState.currentQuestion = await generator.generateMultiPathQuestion(
    numPaths,
    entitiesPerPath,
  );
  gameState.answered = false;
  gameState.timeRemaining = timeLimit;

  // Render
  const container = document.getElementById("game-container");
  container.innerHTML = renderer.renderGameUI(gameState.currentQuestion);

  // Add event listeners to buttons
  container.querySelectorAll(".btn").forEach((btn) => {
    btn.addEventListener("click", handleAnswer);
  });

  // Update debug info
  const debugInfo = document.getElementById("debug-info");
  debugInfo.innerHTML = renderer.renderNetworkInfo(gameState.currentQuestion);

  // Start timer
  startTimer();
}

// Timer functions
function startTimer() {
  // Clear existing timer
  if (gameState.timer) {
    clearInterval(gameState.timer);
  }

  // Update display instantly (no transition)
  updateTimerDisplay(true);

  // Start countdown
  gameState.timer = setInterval(() => {
    if (!gameState.isPaused) {
      gameState.timeRemaining--;
      updateTimerDisplay();

      if (gameState.timeRemaining <= 0) {
        clearInterval(gameState.timer);
        if (!gameState.answered) {
          handleTimeout();
        }
      }
    }
  }, 1000);
}

// Pause/Resume functions
function togglePause() {
  if (gameState.answered) return; // Can't pause between questions

  gameState.isPaused = !gameState.isPaused;
  const overlay = document.getElementById("pause-overlay");

  if (gameState.isPaused) {
    overlay.classList.add("visible");
  } else {
    // Add 5 seconds on resume (capped at time limit)
    gameState.timeRemaining = Math.min(
      gameState.timeRemaining + 5,
      gameState.difficulty.timeLimit,
    );
    updateTimerDisplay(true); // Instant update on resume

    overlay.classList.remove("visible");
  }
}

function updateTimerDisplay(instant = false) {
  const progressBar = document.getElementById("progress");
  const percentage =
    (gameState.timeRemaining / gameState.difficulty.timeLimit) * 100;

  // Disable transition for instant updates (start/resume)
  if (instant) {
    progressBar.style.transition = "none";
    progressBar.style.width = `${percentage}%`;
    // Force reflow
    progressBar.offsetHeight;
    // Re-enable transition
    progressBar.style.transition = "";
  } else {
    progressBar.style.width = `${percentage}%`;
  }

  // Color coding
  if (gameState.timeRemaining <= 5) {
    progressBar.style.background = "var(--error)";
  } else if (gameState.timeRemaining <= 10) {
    progressBar.style.background = "var(--gold)";
  } else {
    progressBar.style.background = "var(--accent)";
  }
}

function handleTimeout() {
  gameState.answered = true;
  gameState.consecutiveCorrect = 0;

  // Track question for export (timeout = wrong answer)
  gameState.questionHistory.push({
    questionNumber: gameState.questionNumber,
    question: gameState.currentQuestion,
    userAnswer: null, // timeout
    correctAnswer: gameState.currentQuestion.isValid,
    correct: false,
  });

  // Visual feedback
  showFeedback(false);

  // Disable buttons
  document.querySelectorAll(".btn").forEach((btn) => {
    btn.disabled = true;
    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";
  });

  // Auto-advance
  setTimeout(() => {
    if (gameState.questionNumber < gameState.total) {
      gameState.questionNumber++;
      updateProgress();
      updateStreak();
      newQuestion();
    } else {
      showGameOver();
    }
  }, 400);
}

// Handle answer
function handleAnswer(e) {
  if (gameState.answered) return;

  const userAnswer = e.currentTarget.dataset.answer === "true";
  const correct = userAnswer === gameState.currentQuestion.isValid;

  gameState.answered = true;
  clearInterval(gameState.timer);

  // Track question for export
  gameState.questionHistory.push({
    questionNumber: gameState.questionNumber,
    question: gameState.currentQuestion,
    userAnswer: userAnswer,
    correctAnswer: gameState.currentQuestion.isValid,
    correct: correct,
  });

  // Update streak and score
  if (correct) {
    gameState.score++;
    gameState.consecutiveCorrect++;
    updateScore();

    // Check for difficulty increase (every 10 correct)
    if (
      gameState.consecutiveCorrect > 0 &&
      gameState.consecutiveCorrect % 10 === 0
    ) {
      increaseDifficulty();
    }
  } else {
    gameState.consecutiveCorrect = 0;
  }

  // Visual feedback
  showFeedback(correct);

  // Disable buttons
  document.querySelectorAll(".btn").forEach((btn) => {
    btn.disabled = true;
    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";
  });

  // Auto-advance after shorter delay (snappier!)
  setTimeout(() => {
    if (gameState.questionNumber < gameState.total) {
      gameState.questionNumber++;
      updateProgress();
      updateStreak();
      newQuestion();
    } else {
      showGameOver();
    }
  }, 400);
}

// Increase difficulty
function increaseDifficulty() {
  const diff = gameState.difficulty;
  const options = [];

  // Check which dimensions can be increased
  if (diff.numPaths < 3) options.push("paths");
  if (diff.entitiesPerPath < 5) options.push("entities");
  if (diff.timeLimit > 10) options.push("time");

  if (options.length === 0) {
    console.log("🏆 Maximum difficulty reached!");
    return;
  }

  // Randomly pick one dimension to increase
  const dimension = options[Math.floor(Math.random() * options.length)];

  if (dimension === "paths") {
    diff.numPaths++;
    console.log(`📈 Difficulty increased: ${diff.numPaths} paths`);
  } else if (dimension === "entities") {
    diff.entitiesPerPath++;
    console.log(`📈 Difficulty increased: ${diff.entitiesPerPath} entities`);
  } else if (dimension === "time") {
    diff.timeLimit -= 5;
    console.log(`📈 Difficulty increased: ${diff.timeLimit}s timer`);
  }

  updateLevel();
}

// Update level display
function updateLevel() {
  const diff = gameState.difficulty;
  const level =
    diff.numPaths -
    1 +
    (diff.entitiesPerPath - 3) +
    Math.floor((30 - diff.timeLimit) / 5);
  document.getElementById("lbl-level").textContent = level + 1;
}

// Update streak display
function updateStreak() {
  document.getElementById("lbl-streak").textContent =
    gameState.consecutiveCorrect;
}

// Show feedback
function showFeedback(correct) {
  const container = document.getElementById("game-container");
  const className = correct ? "flash-correct" : "flash-incorrect";

  container.classList.add(className);
  setTimeout(() => {
    container.classList.remove(className);
  }, 400);
}

// Update score
function updateScore() {
  document.getElementById("lbl-score").textContent = gameState.score;
}

// Update progress
function updateProgress() {
  // Update question counter
  document.getElementById("lbl-question").textContent =
    gameState.questionNumber;
}

// Show game over
function showGameOver() {
  clearInterval(gameState.timer);
  const container = document.getElementById("game-container");
  const percentage = Math.round((gameState.score / gameState.total) * 100);
  const finalLevel =
    gameState.difficulty.numPaths -
    1 +
    (gameState.difficulty.entitiesPerPath - 3) +
    Math.floor((30 - gameState.difficulty.timeLimit) / 5) +
    1;

  container.innerHTML = `
    <div class="premises-container" style="text-align: center; padding: 40px;">
        <h2 style="color: var(--accent); font-size: 2rem; margin-bottom: 20px;">Game Complete!</h2>
        <div style="font-size: 3rem; margin: 30px 0;">
            ${percentage >= 80 ? "🏆" : percentage >= 60 ? "🎯" : "💪"}
        </div>
        <div style="font-size: 1.5rem; margin-bottom: 20px;">
            Score: <span style="color: var(--success); font-weight: bold;">${gameState.score}</span> / ${gameState.total}
        </div>
        <div style="font-size: 1.2rem; margin-bottom: 20px;">
            Accuracy: <span style="color: var(--accent); font-weight: bold;">${percentage}%</span>
        </div>
        <div style="font-size: 1.1rem; margin-bottom: 20px; opacity: 0.8;">
            Max Streak: <span style="color: var(--gold); font-weight: bold;">${Math.floor(gameState.score / 10) * 10}</span>
        </div>
        <div style="font-size: 1.1rem; margin-bottom: 30px; opacity: 0.7;">
            Final Level: <span style="font-weight: bold;">${finalLevel}</span>
        </div>
        <div style="font-size: 1rem; margin-bottom: 30px; opacity: 0.8;">
            ${percentage >= 80 ? "Outstanding reasoning!" : percentage >= 60 ? "Great job!" : "Keep practicing!"}
        </div>
        <button id="play-again-btn" class="resume-btn">Play Again</button>
    </div>
`;

  // Add event listener to Play Again button
  document
    .getElementById("play-again-btn")
    .addEventListener("click", restartGame);
}

// Restart game function
function restartGame() {
  gameState.score = 0;
  gameState.questionNumber = 1;
  gameState.consecutiveCorrect = 0;
  gameState.questionHistory = []; // Clear question history
  gameState.difficulty = {
    numPaths: 1,
    entitiesPerPath: 3,
    timeLimit: 30,
  };
  updateScore();
  updateProgress();
  updateStreak();
  updateLevel();
  newQuestion();
}

// Export question history as markdown
function exportQuestions() {
  if (gameState.questionHistory.length === 0) {
    alert("No questions to export yet!");
    return;
  }

  let markdown = `# Tanmateix Question History\n\n`;
  markdown += `**Session Date:** ${new Date().toLocaleString()}\n`;
  markdown += `**Questions Answered:** ${gameState.questionHistory.length}\n`;
  markdown += `**Score:** ${gameState.score}/${gameState.questionHistory.length}\n\n`;
  markdown += `---\n\n`;

  gameState.questionHistory.forEach((entry) => {
    const q = entry.question;
    const relationType = q.premises[0]?.type?.name || "Unknown";

    markdown += `## Question ${entry.questionNumber}\n\n`;
    markdown += `**Type:** ${relationType}\n\n`;

    // For spatial, add grid
    if (relationType === "Spatial" && q.metadata?.spatialGrid) {
      markdown += `\`\`\`\n${q.metadata.spatialGrid.toString()}\`\`\`\n\n`;
    }

    // Premises
    markdown += `**Premises:**\n`;
    q.premises.forEach((p, i) => {
      markdown += `${i + 1}. ${p.entities[0].displayValue} ${p.properties.text} ${p.entities[1].displayValue}\n`;
    });

    // Conclusion
    markdown += `\n**Question:**\n`;
    markdown += `${q.conclusion.entities[0].displayValue} ${q.conclusion.properties.text} ${q.conclusion.entities[1].displayValue}\n\n`;

    // Answers
    markdown += `**Correct Answer:** ${q.isValid ? "True" : "False"}\n`;
    markdown += `**Your Answer:** ${entry.userAnswer === null ? "Timeout" : entry.userAnswer ? "True" : "False"}\n`;
    markdown += `**Result:** ${entry.correct ? "✓ Correct" : "✗ Wrong"}\n\n`;
    markdown += `---\n\n`;
  });

  // Share using Web Share API if available
  const filename = `tanmateix-questions-${Date.now()}.md`;

  // Helper to download file
  const downloadFile = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (navigator.share && navigator.canShare) {
    const file = new File([markdown], filename, { type: "text/markdown" });

    if (navigator.canShare({ files: [file] })) {
      navigator
        .share({
          files: [file],
          title: "Tanmateix Question History",
        })
        .catch((err) => {
          console.error("Share failed:", err);
          // Fallback to download on error (permission denied, etc.)
          downloadFile();
        });
    } else {
      // Fallback: share as text
      navigator
        .share({
          text: markdown,
          title: "Tanmateix Question History",
        })
        .catch((err) => {
          console.error("Share failed:", err);
          // Fallback to download on error
          downloadFile();
        });
    }
  } else {
    // Fallback: download
    downloadFile();
  }
}

// Don't start game automatically - wait for start button
updateScore();
updateProgress();
updateStreak();
updateLevel();

// Fetch and display version from manifest.json
fetch("manifest.json")
  .then((res) => res.json())
  .then((manifest) => {
    const versionDisplay = document.getElementById("version-display");
    const startVersionDisplay = document.getElementById(
      "start-version-display",
    );
    if (versionDisplay && manifest.version) {
      versionDisplay.textContent = `v${manifest.version}`;
    }
    if (startVersionDisplay && manifest.version) {
      startVersionDisplay.textContent = `v${manifest.version}`;
    }
  })
  .catch((err) => {
    console.warn("Could not load version from manifest:", err);
  });

// Info modal handlers
const modal = document.getElementById("info-modal");
const openBtn = document.getElementById("game-info-btn");
const closeBtn = document.getElementById("info-modal-close");
const exportBtn = document.getElementById("export-questions-btn");

openBtn.addEventListener("click", () => {
  modal.classList.add("visible");
  // Pause timer when modal opens
  if (!gameState.answered && !gameState.isPaused) {
    gameState.isPaused = true;
  }
});

exportBtn.addEventListener("click", () => {
  exportQuestions();
});

closeBtn.addEventListener("click", () => {
  modal.classList.remove("visible");
  // Resume timer when modal closes
  if (!gameState.answered && gameState.isPaused) {
    gameState.isPaused = false;
  }
});

// Close on overlay click
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.classList.remove("visible");
    // Resume timer when modal closes
    if (!gameState.answered && gameState.isPaused) {
      gameState.isPaused = false;
    }
  }
});

// Verification error modal handlers
const verificationModal = document.getElementById("verification-error-modal");
const verificationCloseBtn = document.getElementById(
  "verification-error-close",
);

verificationCloseBtn.addEventListener("click", () => {
  verificationModal.classList.remove("visible");
  // Resume timer when modal closes
  if (!gameState.answered && gameState.isPaused) {
    gameState.isPaused = false;
  }
});

verificationModal.addEventListener("click", (e) => {
  if (e.target === verificationModal) {
    verificationModal.classList.remove("visible");
    // Resume timer when modal closes
    if (!gameState.answered && gameState.isPaused) {
      gameState.isPaused = false;
    }
  }
});

// Expose function to show verification error
window.showVerificationError = (errorMessage) => {
  document.getElementById("verification-error-message").textContent =
    errorMessage;
  verificationModal.classList.add("visible");
  // Pause timer when error modal shows
  if (!gameState.answered && !gameState.isPaused) {
    gameState.isPaused = true;
  }
};

// Start game handler
const startBtn = document.getElementById("start-btn");
const startScreen = document.getElementById("start-screen");

startBtn.addEventListener("click", () => {
  startScreen.classList.remove("visible");
  newQuestion();
});

// Pause/Resume handlers
const resumeBtn = document.getElementById("resume-btn");
const progressContainer = document.querySelector(".progress-container");

progressContainer.addEventListener("click", togglePause);
resumeBtn.addEventListener("click", togglePause);

// Keyboard shortcut (Space to toggle pause)
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !modal.classList.contains("visible")) {
    e.preventDefault();
    togglePause();
  }
});
