const QUESTION_COUNT = 20;
const TIME_LIMIT = 10;

let currentTheme = null;
let currentQuestions = [];
let currentIndex = 0;
let wrongCount = 0;
let timerInterval = null;
let selectedThemeId = null;

// DOM
const themeList = document.getElementById('theme-list');
const timerFill = document.getElementById('timer-fill');
const flashCard = document.querySelector('.flash-card');
const exitModal = document.getElementById('exit-modal');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const startGuideModal = document.getElementById('start-guide-modal');
const guideStartBtn = document.getElementById('guide-start-btn');
const guideCloseBtn = document.getElementById('guide-close-btn');
const lockedModal = document.getElementById('locked-modal');
const lockedCloseBtn = document.getElementById('locked-close-btn');

// --- 오디오 객체 생성 ---
const timerAudio = new Audio('assets/timer.mp3');
timerAudio.loop = false;
const correctAudio = new Audio('assets/correct.mp3');
const wrongAudio = new Audio('assets/wrong.mp3');
const clearAudio = new Audio('assets/clear.mp3');

function setScreenSize() {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
setScreenSize();
window.addEventListener('resize', setScreenSize);

init();

function init() {
  renderLobby();

  const openingScreen = document.getElementById('opening-screen');
  if (openingScreen) {
    openingScreen.onclick = () => {
      // 오프닝 화면 클릭 시 로비로 이동
      openingScreen.classList.remove('active');
      showScreen('lobby-screen');
    };
  }

  if (flashCard) {
    flashCard.onclick = () => {
      document.getElementById('q-pronun').classList.add('visible');
    };
  }

  guideStartBtn.onclick = () => {
    startGuideModal.style.display = 'none';
    startGame(selectedThemeId);
  };

  guideCloseBtn.onclick = () => {
    startGuideModal.style.display = 'none';
  };

  document.getElementById('close-game').onclick = () => {
    resetTimer();
    exitModal.style.display = 'flex';
  };

  modalCancelBtn.onclick = () => {
    exitModal.style.display = 'none';
    startTimer();
  };

  modalConfirmBtn.onclick = () => {
    exitModal.style.display = 'none';
    showScreen('lobby-screen');
  };

  if (lockedCloseBtn) {
    lockedCloseBtn.onclick = () => {
      lockedModal.style.display = 'none';
    };
  }
}

function renderLobby() {
  themeList.innerHTML = '';
  // 로컬 스토리지 키 변경 (jindam_cleared_kr)
  const clearedData = JSON.parse(
    localStorage.getItem('jindam_cleared_kr') || '[]',
  );
  const total = themesData.length;
  const cleared = clearedData.length;

  document.getElementById('total-cleared').innerText = `${cleared}/${total}`;
  document.getElementById('total-progress').style.width =
    `${(cleared / total) * 100}%`;

  themesData.forEach((theme) => {
    const isCleared = clearedData.includes(theme.id);
    const isLocked = theme.id > 31; // 31번 초과 잠금

    const card = document.createElement('div');
    card.className = `theme-card ${isCleared ? 'cleared' : ''} ${isLocked ? 'locked' : ''}`;

    card.onclick = () => {
      if (isLocked) {
        lockedModal.style.display = 'flex';
      } else {
        selectedThemeId = theme.id;
        startGuideModal.style.display = 'flex';
      }
    };

    card.innerHTML = `
      ${
        isLocked
          ? '<div class="lock-badge">🔒</div>'
          : isCleared
            ? '<div class="stamp">👑</div>'
            : ''
      }
      <div class="theme-icon">${theme.icon}</div>
      <div class="theme-title">${theme.title}</div>
    `;
    themeList.appendChild(card);
  });
}

function showScreen(screenId) {
  const screens = document.querySelectorAll('.screen');
  const targetScreen = document.getElementById(screenId);
  targetScreen.classList.add('active');
  screens.forEach((s) => {
    if (s.id !== screenId) s.classList.remove('active');
  });
  targetScreen.scrollTop = 0;
}

function startGame(themeId) {
  currentTheme = themesData.find((t) => t.id === themeId);
  if (!currentTheme) return;

  // 랜덤 문제 섞기
  currentQuestions = [...currentTheme.words]
    .sort(() => Math.random() - 0.5)
    .slice(0, QUESTION_COUNT);

  currentIndex = 0;
  wrongCount = 0;
  document.getElementById('current-stage-name').innerText =
    currentTheme.title.split('\n')[0]; // 제목 첫 줄만 표시
  showScreen('game-screen');
  renderQuestion();
}

function renderQuestion() {
  resetTimer();
  if (currentIndex >= currentQuestions.length) {
    endGame(true);
    return;
  }

  const q = currentQuestions[currentIndex];
  // 데이터 키 매핑: kr(한국어), pr(발음), vn(베트남어 뜻)
  document.getElementById('q-korean').innerText = q.kr;
  const pinyinEl = document.getElementById('q-pronun');
  pinyinEl.innerText = q.pr;
  pinyinEl.classList.remove('visible');

  document.getElementById('score-display').innerText =
    `${currentIndex + 1}/${currentQuestions.length}`;
  document.getElementById('progress-fill').style.width =
    `${(currentIndex / currentQuestions.length) * 100}%`;

  let wrongAnswer;
  let attempts = 0;

  // [중복 방지 로직 - 베트남어 버전]
  do {
    const randomIdx = Math.floor(Math.random() * currentTheme.words.length);
    wrongAnswer = currentTheme.words[randomIdx].vn;
    attempts++;

    // 쉼표/슬래시 등으로 구분된 단어 쪼개기 (베트남어 뜻)
    // 예: "Xin chào, Chào" -> ["Xin chào", "Chào"]
    const splitChars = /[,/]/;
    const answerKeywords = q.vn
      .split(splitChars)
      .map((s) => s.trim().toLowerCase());
    const wrongAnswerLower = wrongAnswer.toLowerCase();

    // 오답에 정답 키워드가 포함되어 있는지 확인
    const isOverlapping = answerKeywords.some((keyword) =>
      wrongAnswerLower.includes(keyword),
    );

    if (isOverlapping || wrongAnswer === q.vn) {
      wrongAnswer = null; // 다시 뽑기
    }
  } while (!wrongAnswer && attempts < 30 && currentTheme.words.length > 1);

  if (!wrongAnswer) {
    // 실패 시 아무거나
    const randomIdx = Math.floor(Math.random() * currentTheme.words.length);
    wrongAnswer = currentTheme.words[randomIdx].vn;
  }

  const btn1 = document.getElementById('btn-1');
  const btn2 = document.getElementById('btn-2');
  const newBtn1 = btn1.cloneNode(true);
  const newBtn2 = btn2.cloneNode(true);

  newBtn1.className = 'option-btn';
  newBtn2.className = 'option-btn';

  btn1.parentNode.replaceChild(newBtn1, btn1);
  btn2.parentNode.replaceChild(newBtn2, btn2);

  const isAnswerLeft = Math.random() < 0.5;
  if (isAnswerLeft) {
    newBtn1.innerText = q.vn; // 정답(베트남어)
    newBtn2.innerText = wrongAnswer;
    newBtn1.onclick = () => handleAnswer(true, newBtn1);
    newBtn2.onclick = () => handleAnswer(false, newBtn2);
  } else {
    newBtn1.innerText = wrongAnswer;
    newBtn2.innerText = q.vn; // 정답(베트남어)
    newBtn1.onclick = () => handleAnswer(false, newBtn1);
    newBtn2.onclick = () => handleAnswer(true, newBtn2);
  }
  startTimer();
}

function startTimer() {
  timerFill.style.transition = 'none';
  timerFill.style.width = '100%';

  // 타이머 오디오 재생
  timerAudio.currentTime = 0;
  timerAudio.play().catch((e) => console.warn('오디오 재생 차단됨:', e));

  setTimeout(() => {
    timerFill.style.transition = `width ${TIME_LIMIT}s linear`;
    timerFill.style.width = '0%';
  }, 50);

  timerInterval = setTimeout(
    () => endGame(false, 'Hết giờ! (시간 초과)'),
    TIME_LIMIT * 1000,
  );
}

function resetTimer() {
  clearTimeout(timerInterval);

  // 타이머 오디오 정지
  timerAudio.pause();
  timerAudio.currentTime = 0;

  timerFill.style.transition = 'none';
  timerFill.style.width = '100%';
}

function handleAnswer(isCorrect, btnElement) {
  resetTimer();

  // 1. 중복 클릭 방지를 위해 잠시 모든 버튼 클릭 막기
  const allBtns = document.querySelectorAll('.option-btn');
  allBtns.forEach((btn) => (btn.style.pointerEvents = 'none'));

  // 2. 선택 직후 발음 자동 노출 (q-pronun)
  document.getElementById('q-pronun').classList.add('visible');

  if (isCorrect) {
    // 3. 정답 사운드 재생
    correctAudio.currentTime = 0;
    correctAudio.play().catch((e) => console.warn('오디오 재생 차단됨:', e));

    // 4. 정답 시각적 피드백 (초록색 버튼 효과)
    btnElement.classList.add('correct-anim');

    // 5. 1.5초 대기 후 다음 문제로 이동 및 클릭 잠금 해제
    setTimeout(() => {
      currentIndex++;
      allBtns.forEach((btn) => (btn.style.pointerEvents = 'auto'));
      renderQuestion();
    }, 1500);
  } else {
    // 오답 사운드 재생
    wrongAudio.currentTime = 0;
    wrongAudio.play().catch((e) => console.warn('오디오 재생 차단됨:', e));

    // 오답 시각적 피드백 (빨간색 흔들림 효과)
    btnElement.classList.add('wrong-anim');

    // 1.5초 대기 후 결과 화면으로 이동
    setTimeout(() => {
      allBtns.forEach((btn) => (btn.style.pointerEvents = 'auto'));
      endGame(false);
    }, 1500);
  }
}

function endGame(isSuccess, reason = '') {
  resetTimer();
  showScreen('result-screen');
  const icon = document.getElementById('res-icon');
  const title = document.getElementById('res-title');
  const msg = document.getElementById('res-msg');

  if (isSuccess) {
    // ★ 20문제 올클리어 사운드 재생
    clearAudio.currentTime = 0;
    clearAudio.play().catch((e) => console.warn('오디오 재생 차단됨:', e));

    icon.innerText = '👑';
    title.innerText = 'Hoàn thành!';
    title.style.color = 'var(--primary)';
    msg.innerText = `${QUESTION_COUNT} câu hỏi đã được chinh phục!`;

    const clearedData = JSON.parse(
      localStorage.getItem('jindam_cleared_kr') || '[]',
    );
    if (!clearedData.includes(currentTheme.id)) {
      clearedData.push(currentTheme.id);
      localStorage.setItem('jindam_cleared_kr', JSON.stringify(clearedData));
    }
  } else {
    icon.innerText = '😢';
    title.innerText = reason ? reason : 'Thất bại...';
    title.style.color = 'var(--error)';
    msg.innerText = reason
      ? 'Hãy nhanh tay hơn!'
      : `Bạn đã sai ở câu số ${currentIndex + 1}.`;
  }

  // 버튼 이벤트 연결
  document.getElementById('next-btn').onclick = () => {
    renderLobby();
    showScreen('lobby-screen');
  };
  document.getElementById('retry-btn').onclick = () =>
    startGame(currentTheme.id);
}
