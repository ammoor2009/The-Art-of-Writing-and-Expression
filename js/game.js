/* =========================================================
   رحلة الفارس اللغوي — منطق اللعبة
   ========================================================= */

/* ==================== إعدادات الأقسام ====================
   لإضافة قسم جديد لاحقًا: أضف عنصرًا هنا مع ملف JSON الخاص به.
   ========================================================= */
const SECTIONS = [
    {
        id: 'imlaa',
        name: 'مملكة الإملاء',
        icon: 'fa-solid fa-pen-to-square',
        description: 'الهمزات، التاء، علامات الترقيم',
        file: 'questions/spelling.json'
    },
    {
        id: 'numbers',
        name: 'مملكة الأعداد',
        icon: 'fa-solid fa-hashtag',
        description: 'الأعداد والمعدود وقواعدها',
        file: 'questions/numbers.json'
    },
    {
        id: 'akhtaa',
        name: 'مملكة الأخطاء الشائعة',
        icon: 'fa-solid fa-triangle-exclamation',
        description: 'تصحيح الأخطاء اللغوية',
        file: 'questions/common-errors.json'
    }
];

/* ==================== ثوابت اللعبة ==================== */
const QUESTIONS_PER_LEVEL = 5;
const EXAM_MAX_QUESTIONS = 20;
const TIMER_DURATION = 30;
const HINT_COST = 10;
const XP_PER_CORRECT = 20;
const GOLD_PER_CORRECT = 5;
const STORAGE_KEY = 'fursan_linguistic_state';

/* ==================== البيانات المحمّلة ==================== */
let KINGDOMS = [];
let QUESTION_BANK = [];

/* ==================== نظام الصوت ==================== */
let audioCtx = null;

function ensureAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playTone(frequency, duration, type = 'sine', volume = 0.3) {
    try {
        const ctx = ensureAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    } catch (e) { /* تجاهل */ }
}

function soundStart() {
    playTone(523.25, 0.15, 'sine', 0.3);
    setTimeout(() => playTone(659.25, 0.15, 'sine', 0.3), 150);
    setTimeout(() => playTone(783.99, 0.2, 'sine', 0.3), 300);
}

function soundCorrect() {
    playTone(659.25, 0.12, 'sine', 0.3);
    setTimeout(() => playTone(783.99, 0.12, 'sine', 0.3), 120);
    setTimeout(() => playTone(1046.5, 0.25, 'sine', 0.35), 240);
}

function soundWrong() {
    playTone(300, 0.2, 'sawtooth', 0.2);
    setTimeout(() => playTone(200, 0.3, 'sawtooth', 0.2), 200);
}

function soundFinish() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.2, 'sine', 0.25), i * 150);
    });
}

/* ==================== حالة اللعبة ==================== */
let gameState = {
    playerName: '',
    xp: 0,
    gold: 100,
    completedLevels: {},
    achievements: [],
    examHistory: []
};

/* ==================== الإنجازات ==================== */
const ACHIEVEMENTS = [
    {
        id: 'first_level',
        name: 'أول خطوة',
        desc: 'أكمل أي مرحلة',
        icon: 'fa-solid fa-shoe-prints',
        check: () => Object.values(gameState.completedLevels).some(arr => arr.length > 0)
    },
    {
        id: 'gold_500',
        name: 'جامع الذهب',
        desc: 'اجمع 500 قطعة ذهبية',
        icon: 'fa-solid fa-coins',
        check: () => gameState.gold >= 500
    },
    {
        id: 'xp_1000',
        name: 'ألف خبرة',
        desc: 'احصل على 1000 نقطة خبرة',
        icon: 'fa-solid fa-star',
        check: () => gameState.xp >= 1000
    },
    {
        id: 'exam_90',
        name: 'متفوق',
        desc: 'احصل على 90% أو أكثر في الاختبار',
        icon: 'fa-solid fa-file-pen',
        check: () => gameState.examHistory.some(s => s >= 90)
    },
    {
        id: 'complete_section',
        name: 'فارس الممالك',
        desc: 'أكمل جميع مراحل مملكة كاملة',
        icon: 'fa-solid fa-crown',
        check: () => KINGDOMS.some(k => (gameState.completedLevels[k.id]?.length || 0) >= k.levels)
    }
];

/* ==================== مكتبة القواعد ==================== */
const LIBRARY_CONTENT = [
    { title: 'إنّ وأخواتها', content: 'إنّ وأخواتها تدخل على الجملة الاسمية فتنصب المبتدأ (اسمها) وترفع الخبر (خبرها). مثال: "إنّ الطالبَ مجتهدٌ".' },
    { title: 'كان وأخواتها', content: 'كان وأخواتها ترفع المبتدأ (اسمها) وتنصب الخبر (خبرها). مثال: "كان الجوُّ جميلًا".' },
    { title: 'التمييز بين الضاد والظاء', content: 'الضاد تخرج من حافة اللسان مع الأضراس، والظاء من طرف اللسان مع أطراف الثنايا العليا. مثل: "نَفَدَ" (بمعنى انتهى) و"نَفَذَ" (بمعنى اخترق).' },
    { title: 'الهمزات', content: 'همزة القطع تُكتب وتُلفظ دائمًا (أحمد، إسلام)، وهمزة الوصل تُكتب ألفًا بدون همزة وتُلفظ عند البدء فقط (اكتب، اسم).' },
    { title: 'التاء المربوطة والمبسوطة', content: 'التاء المربوطة (ة) تُلفظ هاءً عند الوقف (مدرسة)، والتاء المبسوطة (ت) تبقى تاءً دائمًا (بنت، معلمات).' },
    { title: 'ألف التفريق', content: 'تُزاد ألف بعد واو الجماعة للتفريق بينها وبين الواو الأصلية. مثال: "كتبوا" (واو الجماعة) و"يدعو" (واو أصلية).' },
    { title: 'كافّة وغير', content: 'كافة لا تُضاف إلى ما بعدها بل تعرب حالًا: "حضر الناسُ كافّةً". وغير لا تدخلها (أل): "غيرُ المقبولِ" لا "الغيرُ المقبولِ".' },
    { title: 'مبارك ومبروك', content: 'الصواب في التهنئة "مبارك" من الفعل بارك، وليس "مبروك" من بَرَكَ البعير.' },
    { title: 'حروف الجر وتغيير المعنى', content: 'رغِبَ في الشيء: أراده، ورغِبَ عنه: تركه. فأجاب عن السؤال (لا: على). واعتذر عن الفعل لا عن الحضور.' },
    { title: 'قواعد الأعداد', content: 'العدد 1 و2 يوافق المعدود، والأعداد 3-10 تخالفه، و11-19 الجزء الأول يخالف والثاني يوافق، وألفاظ العقود والمائة والألف تلزم صورة واحدة.' }
];

/* ==================== أدوات مساعدة ==================== */
function $(id) { return document.getElementById(id); }

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = $(id);
    if (el) el.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (id !== 'screenMap' && id !== 'screenStart') {
        history.pushState({ screen: id }, '');
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    } catch (e) { /* تجاهل */ }
}

function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            gameState = { ...gameState, ...JSON.parse(saved) };
        }
    } catch (e) { /* تجاهل */ }
}

function updateTopBar() {
    $('topXp').textContent = gameState.xp;
    $('topGold').textContent = gameState.gold;
    $('topName').textContent = gameState.playerName || 'فارس';
}

/* ==================== تحميل بيانات الأقسام ==================== */
async function loadSectionData() {
    const bank = [];
    const kingdoms = [];

    for (const section of SECTIONS) {
        try {
            const response = await fetch(section.file);
            if (!response.ok) throw new Error(`فشل تحميل ${section.file}`);
            const data = await response.json();
            const questions = Array.isArray(data) ? data : (data.questions || []);

            if (!questions.length) {
                console.warn(`لا توجد أسئلة في: ${section.file}`);
            }

            let maxLevel = 1;
            questions.forEach((q, idx) => {
                const item = {
                    kingdom: section.id,
                    level: q.level || Math.floor(idx / QUESTIONS_PER_LEVEL) + 1,
                    type: q.type || 'mcq',
                    text: q.text,
                    options: q.options || [],
                    answer: q.answer,
                    explanation: q.explanation || ''
                };
                if (item.level > maxLevel) maxLevel = item.level;
                bank.push(item);
            });

            kingdoms.push({
                id: section.id,
                name: section.name,
                icon: section.icon,
                description: section.description,
                levels: maxLevel
            });
        } catch (err) {
            console.error(`خطأ في تحميل القسم ${section.id}:`, err);
        }
    }

    QUESTION_BANK = bank;
    KINGDOMS = kingdoms;
}

/* ==================== شاشة البداية ==================== */
function handleStartGame() {
    const nameInput = $('playerNameInput');
    const name = nameInput.value.trim();
    if (!name) {
        nameInput.focus();
        alert('من فضلك أدخل اسمك');
        return;
    }
    gameState.playerName = name;
    saveState();
    updateTopBar();
    showScreen('screenMap');
    renderKingdomGrid();
}

/* ==================== النافذة المنبثقة ==================== */
function setupInfoModal() {
    $('infoBtn').addEventListener('click', () => {
        $('infoModal').classList.add('active');
    });
    $('closeInfoModal').addEventListener('click', () => {
        $('infoModal').classList.remove('active');
    });
    $('infoModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            $('infoModal').classList.remove('active');
        }
    });
}

/* ==================== زر الرجوع ==================== */
function setupPopstate() {
    window.addEventListener('popstate', () => {
        const activeScreen = document.querySelector('.screen.active');
        if (activeScreen && activeScreen.id !== 'screenMap' && activeScreen.id !== 'screenStart') {
            goBackToMap();
            history.pushState(null, '', '');
        } else {
            history.back();
        }
    });
}

/* ==================== الخريطة ==================== */
function renderKingdomGrid() {
    const grid = $('kingdomGrid');
    grid.innerHTML = '';

    if (!KINGDOMS.length) {
        grid.innerHTML = '<p style="text-align:center;color:var(--text-3)">لا توجد ممالك متاحة حاليًا.</p>';
        return;
    }

    KINGDOMS.forEach(kingdom => {
        const completedCount = gameState.completedLevels[kingdom.id]?.length || 0;
        const progressPercent = kingdom.levels > 0
            ? (completedCount / kingdom.levels) * 100
            : 0;

        const card = document.createElement('div');
        card.className = 'map-kingdom';
        card.innerHTML = `
            <div class="kingdom-watermark"><i class="${kingdom.icon}"></i></div>
            <div class="kingdom-body">
                <div class="kingdom-icon"><i class="${kingdom.icon}"></i></div>
                <h3 class="kingdom-name">${escapeHtml(kingdom.name)}</h3>
                <p class="kingdom-desc">${escapeHtml(kingdom.description)}</p>
                <div class="kingdom-progress-row">
                    <span>${completedCount} / ${kingdom.levels} مرحلة</span>
                    <span>${Math.round(progressPercent)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercent}%;"></div>
                </div>
            </div>
        `;
        card.addEventListener('click', () => openKingdom(kingdom.id));
        grid.appendChild(card);
    });
}

function openKingdom(kingdomId) {
    const kingdom = KINGDOMS.find(k => k.id === kingdomId);
    if (!kingdom) return;

    const completed = gameState.completedLevels[kingdom.id] || [];
    let nextLevel = 1;
    for (let i = 1; i <= kingdom.levels; i++) {
        if (!completed.includes(i)) { nextLevel = i; break; }
        nextLevel = i + 1;
    }
    if (nextLevel > kingdom.levels) {
        alert('أكملت جميع المراحل في هذه المملكة!');
        return;
    }
    startLevel(kingdom.id, nextLevel);
}

/* ==================== المرحلة ==================== */
let currentLevelInfo = null;
let levelTimerInterval = null;
let levelTimeLeft = 0;
let answerLocked = false;

function startLevel(kingdomId, levelNumber) {
    const kingdom = KINGDOMS.find(k => k.id === kingdomId);
    if (!kingdom) return;

    let levelQuestions = QUESTION_BANK.filter(q => q.kingdom === kingdomId && q.level === levelNumber);

    // إن لم تكفِ الأسئلة، نستكمل من بقية أسئلة المملكة
    if (levelQuestions.length < QUESTIONS_PER_LEVEL) {
        const additional = QUESTION_BANK.filter(q => q.kingdom === kingdomId && q.level !== levelNumber);
        const needed = QUESTIONS_PER_LEVEL - levelQuestions.length;
        const extra = shuffleArray(additional.slice()).slice(0, needed);
        levelQuestions = levelQuestions.concat(extra);
    }

    const selectedQuestions = shuffleArray(levelQuestions.slice()).slice(0, QUESTIONS_PER_LEVEL);

    if (!selectedQuestions.length) {
        alert('لا توجد أسئلة متاحة لهذه المرحلة.');
        return;
    }

    currentLevelInfo = {
        kingdomId,
        levelNumber,
        questions: selectedQuestions,
        currentIndex: 0,
        correct: 0,
        hintsUsed: 0,
        goldEarned: 0,
        xpEarned: 0
    };

    showScreen('screenLevel');
    $('levelTitle').textContent = `${kingdom.name} - المرحلة ${levelNumber}`;
    $('levelSubtitle').textContent = kingdom.description;
    $('totalQuestionsNum').textContent = selectedQuestions.length;
    answerLocked = false;

    $('nextBtn').classList.add('hidden');
    $('finishLevelBtn').classList.add('hidden');
    $('endLevelBtn').classList.add('hidden');
    $('feedbackBox').classList.add('hidden');

    soundStart();
    renderQuestion();
}

function renderQuestion() {
    if (!currentLevelInfo) return;
    const info = currentLevelInfo;
    const q = info.questions[info.currentIndex];

    $('currentQuestionNum').textContent = info.currentIndex + 1;
    $('levelProgress').style.width = `${(info.currentIndex / info.questions.length) * 100}%`;
    $('questionText').textContent = q.text;
    $('timerSeconds').textContent = TIMER_DURATION;

    const typeMap = {
        mcq: 'اختيار من متعدد',
        true_false: 'صح أم خطأ',
        fill: 'أكمل الفراغ',
        correct_error: 'صحح الخطأ'
    };
    $('questionType').textContent = typeMap[q.type] || q.type;

    const container = $('optionsContainer');
    container.innerHTML = '';

    q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `
            <span class="option-badge">${String.fromCharCode(65 + idx)}</span>
            <span class="option-text">${escapeHtml(opt)}</span>
        `;
        btn.addEventListener('click', () => selectAnswer(idx));
        container.appendChild(btn);
    });

    $('hintText').classList.add('hidden');
    $('hintBtn').classList.remove('hidden');
    $('feedbackBox').classList.add('hidden');
    $('feedbackBox').className = 'feedback hidden';

    answerLocked = false;
    resetTimerBar();
}

/* ==================== شريط الوقت ==================== */
function resetTimerBar() {
    clearInterval(levelTimerInterval);
    levelTimeLeft = TIMER_DURATION;
    updateTimerBarWidth();

    const startTime = Date.now();
    levelTimerInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        levelTimeLeft = Math.max(0, TIMER_DURATION - elapsed);
        updateTimerBarWidth();

        const secEl = $('timerSeconds');
        if (secEl) secEl.textContent = Math.ceil(levelTimeLeft);

        if (levelTimeLeft <= 0) {
            clearInterval(levelTimerInterval);
            if (!answerLocked) selectAnswer(-1);
        }
    }, 100);
}

function updateTimerBarWidth() {
    const percent = (levelTimeLeft / TIMER_DURATION) * 100;
    const fill = $('timeBarFill');
    if (!fill) return;
    fill.style.width = percent + '%';
    fill.classList.remove('warn', 'danger');
    if (percent <= 25) fill.classList.add('danger');
    else if (percent <= 50) fill.classList.add('warn');
}

/* ==================== الإجابة ==================== */
function selectAnswer(selectedIndex) {
    if (answerLocked || !currentLevelInfo) return;
    answerLocked = true;
    clearInterval(levelTimerInterval);

    const info = currentLevelInfo;
    const q = info.questions[info.currentIndex];
    const isCorrect = selectedIndex === q.answer;

    const optionButtons = document.querySelectorAll('.option-btn');
    optionButtons.forEach((btn, idx) => {
        btn.disabled = true;
        if (idx === q.answer) btn.classList.add('is-correct');
        if (idx === selectedIndex && !isCorrect) btn.classList.add('is-wrong');
    });

    const feedbackBox = $('feedbackBox');
    feedbackBox.classList.remove('hidden');

    if (isCorrect) {
        info.correct++;
        feedbackBox.className = 'feedback correct';
        feedbackBox.innerHTML = `<i class="fa-solid fa-check-circle"></i> إجابة صحيحة! ${escapeHtml(q.explanation || '')}`;
        info.xpEarned += XP_PER_CORRECT;
        info.goldEarned += GOLD_PER_CORRECT;
        soundCorrect();
    } else {
        feedbackBox.className = 'feedback wrong';
        const correctText = q.options[q.answer] || '';
        feedbackBox.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> إجابة خاطئة. الإجابة الصحيحة: ${escapeHtml(correctText)}. ${escapeHtml(q.explanation || '')}`;
        soundWrong();
    }

    updateTopBar();

    if (info.currentIndex < info.questions.length - 1) {
        $('nextBtn').classList.remove('hidden');
        $('finishLevelBtn').classList.add('hidden');
        $('endLevelBtn').classList.remove('hidden');
        $('nextBtn').textContent = 'السؤال التالي';
    } else {
        $('finishLevelBtn').classList.remove('hidden');
        $('nextBtn').classList.add('hidden');
        $('endLevelBtn').classList.add('hidden');
        $('finishLevelBtn').textContent = 'إنهاء المرحلة';
    }
}

/* ==================== التلميح ==================== */
function useHint() {
    if (answerLocked || !currentLevelInfo) return;
    if (gameState.gold < HINT_COST) {
        alert('لا تملك قطعًا ذهبية كافية!');
        return;
    }
    gameState.gold -= HINT_COST;
    saveState();
    updateTopBar();

    const info = currentLevelInfo;
    const q = info.questions[info.currentIndex];
    const wrongOptions = q.options.map((_, idx) => idx).filter(idx => idx !== q.answer);
    const toRemove = shuffleArray(wrongOptions.slice()).slice(0, Math.min(2, wrongOptions.length));

    const optionButtons = document.querySelectorAll('.option-btn');
    toRemove.forEach(idx => {
        if (optionButtons[idx]) optionButtons[idx].classList.add('is-dimmed');
    });

    info.hintsUsed++;
    const hintText = $('hintText');
    hintText.textContent = 'تم حذف إجابتين خاطئتين';
    hintText.classList.remove('hidden');
    $('hintBtn').classList.add('hidden');
    saveState();
}

/* ==================== إنهاء المرحلة ==================== */
function finishLevel() {
    clearInterval(levelTimerInterval);
    const info = currentLevelInfo;
    if (!info) return;

    if (!gameState.completedLevels[info.kingdomId]) {
        gameState.completedLevels[info.kingdomId] = [];
    }
    if (!gameState.completedLevels[info.kingdomId].includes(info.levelNumber)) {
        gameState.completedLevels[info.kingdomId].push(info.levelNumber);
    }
    gameState.xp += info.xpEarned;
    gameState.gold += info.goldEarned;
    saveState();
    updateTopBar();

    $('completeCorrect').textContent = info.correct;
    $('completeXp').textContent = info.xpEarned;
    $('completeGold').textContent = info.goldEarned;
    $('completeTitle').textContent =
        info.correct >= 4 ? 'أداء رائع!' :
        info.correct >= 3 ? 'جيد جدًا' : 'حاول مرة أخرى';
    $('completeIcon').textContent =
        info.correct >= 4 ? '🏆' :
        info.correct >= 3 ? '🌟' : '💪';
    $('completeMessage').textContent =
        `أجبت على ${info.correct} من أصل ${info.questions.length} أسئلة صحيحة.`;

    soundFinish();
    showScreen('screenLevelComplete');
}

function goBackToMap() {
    clearInterval(levelTimerInterval);
    showScreen('screenMap');
    renderKingdomGrid();
    updateTopBar();
}

/* ==================== المكتبة ==================== */
function renderLibrary() {
    const container = $('libraryContent');
    container.innerHTML = '';
    LIBRARY_CONTENT.forEach(item => {
        const div = document.createElement('div');
        div.className = 'library-item';
        div.innerHTML = `<h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.content)}</p>`;
        container.appendChild(div);
    });
}

/* ==================== الإنجازات ==================== */
function renderAchievements() {
    const list = $('achievementsList');
    list.innerHTML = '';
    ACHIEVEMENTS.forEach(ach => {
        const unlocked = !!ach.check();
        const div = document.createElement('div');
        div.className = 'achievement' + (unlocked ? ' unlocked' : '');
        div.innerHTML = `
            <div class="achievement-icon"><i class="${ach.icon}"></i></div>
            <div class="achievement-body">
                <div class="achievement-name">${escapeHtml(ach.name)}</div>
                <div class="achievement-desc">${escapeHtml(ach.desc)}</div>
            </div>
            <div class="achievement-status">${unlocked ? '✅' : '🔒'}</div>
        `;
        list.appendChild(div);
    });
}

/* ==================== وضع الاختبار ==================== */
let examQuestions = [];
let examIndex = 0;
let examCorrect = 0;
let examTimerInterval = null;
let examTimeLeft = 0;
let examInProgress = false;

function openExamScreen() {
    showScreen('screenExam');
    $('examContent').innerHTML = '';
    $('examStartBtn').classList.remove('hidden');
    $('examStartBtn').textContent = 'بدء الاختبار';

    const count = Math.min(EXAM_MAX_QUESTIONS, QUESTION_BANK.length);
    $('examSubtitle').textContent = `اختبار شامل من ${count} سؤالًا بدون تلميحات`;
}

function startExamQuestions() {
    if (!QUESTION_BANK.length) {
        alert('لا توجد أسئلة متاحة.');
        return;
    }
    const count = Math.min(EXAM_MAX_QUESTIONS, QUESTION_BANK.length);
    examQuestions = shuffleArray(QUESTION_BANK.slice()).slice(0, count);
    examIndex = 0;
    examCorrect = 0;
    examInProgress = true;
    $('examStartBtn').classList.add('hidden');
    soundStart();
    renderExamQuestion();
}

function renderExamQuestion() {
    if (examIndex >= examQuestions.length) { finishExam(); return; }
    const q = examQuestions[examIndex];
    const container = $('examContent');
    container.innerHTML = `
        <div class="exam-card">
            <div class="question-meta">
                <span class="question-type">السؤال ${examIndex + 1} / ${examQuestions.length}</span>
                <span class="question-time"><span id="examTimerSeconds">${TIMER_DURATION}</span> ثانية</span>
            </div>
            <h4 class="question-text font-amiri">${escapeHtml(q.text)}</h4>
            <div class="options-list">
                ${q.options.map((opt, idx) => `
                    <button class="option-btn exam-option" data-index="${idx}">
                        <span class="option-badge">${String.fromCharCode(65 + idx)}</span>
                        <span class="option-text">${escapeHtml(opt)}</span>
                    </button>
                `).join('')}
            </div>
            <div class="time-bar-container" style="margin-top:20px;margin-bottom:0;">
                <div id="examTimeBarFill" class="time-bar-fill"></div>
            </div>
        </div>
    `;

    document.querySelectorAll('.exam-option').forEach(btn => {
        btn.addEventListener('click', () => selectExamAnswer(parseInt(btn.dataset.index, 10)));
    });

    clearInterval(examTimerInterval);
    examTimeLeft = TIMER_DURATION;
    const startTime = Date.now();

    examTimerInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        examTimeLeft = Math.max(0, TIMER_DURATION - elapsed);
        const percent = (examTimeLeft / TIMER_DURATION) * 100;
        const f = $('examTimeBarFill');
        const sec = $('examTimerSeconds');
        if (f) {
            f.style.width = percent + '%';
            f.classList.remove('warn', 'danger');
            if (percent <= 25) f.classList.add('danger');
            else if (percent <= 50) f.classList.add('warn');
        }
        if (sec) sec.textContent = Math.ceil(examTimeLeft);
        if (examTimeLeft <= 0) {
            clearInterval(examTimerInterval);
            selectExamAnswer(-1);
        }
    }, 100);
}

function selectExamAnswer(idx) {
    if (!examInProgress) return;
    clearInterval(examTimerInterval);
    examInProgress = false;

    const q = examQuestions[examIndex];
    const isCorrect = idx === q.answer;
    if (isCorrect) { examCorrect++; soundCorrect(); } else { soundWrong(); }

    document.querySelectorAll('.exam-option').forEach((btn, i) => {
        btn.disabled = true;
        if (i === q.answer) btn.classList.add('is-correct');
        if (i === idx && !isCorrect) btn.classList.add('is-wrong');
    });

    setTimeout(() => {
        examIndex++;
        examInProgress = true;
        if (examIndex < examQuestions.length) renderExamQuestion();
        else finishExam();
    }, 1500);
}

function finishExam() {
    examInProgress = false;
    clearInterval(examTimerInterval);
    const total = examQuestions.length || 1;
    const scorePercent = Math.round((examCorrect / total) * 100);
    gameState.examHistory.push(scorePercent);

    if (scorePercent >= 90) { gameState.gold += 50; gameState.xp += 100; }
    else if (scorePercent >= 70) { gameState.gold += 25; gameState.xp += 50; }
    else if (scorePercent >= 50) { gameState.gold += 10; gameState.xp += 20; }

    saveState();
    updateTopBar();
    showScreen('screenExamResult');
    $('examScoreDisplay').textContent = `${scorePercent}%`;
    $('examCorrect').textContent = examCorrect;
    $('examWrong').textContent = total - examCorrect;

    let msg = '';
    if (scorePercent >= 90) msg = 'ممتاز! أنت فارس حقيقي للغة العربية.';
    else if (scorePercent >= 70) msg = 'جيد جدًا، واصل التقدم!';
    else if (scorePercent >= 50) msg = 'لا بأس، تحتاج إلى مزيد من المراجعة.';
    else msg = 'تحتاج إلى مراجعة القواعد الأساسية.';
    $('examMessage').textContent = msg;

    soundFinish();
}

/* ==================== التهيئة ==================== */
async function init() {
    $('startGameBtn').addEventListener('click', handleStartGame);
    $('playerNameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleStartGame();
    });

    setupInfoModal();
    setupPopstate();

    $('backToMapBtn').addEventListener('click', goBackToMap);
    $('continueFromCompleteBtn').addEventListener('click', goBackToMap);

    $('libraryBtn').addEventListener('click', () => {
        showScreen('screenLibrary');
        renderLibrary();
    });
    $('libBackBtn').addEventListener('click', goBackToMap);

    $('achievementsBtn').addEventListener('click', () => {
        showScreen('screenAchievements');
        renderAchievements();
    });
    $('achBackBtn').addEventListener('click', goBackToMap);

    $('examModeBtn').addEventListener('click', openExamScreen);
    $('examStartBtn').addEventListener('click', startExamQuestions);
    $('examBackBtn').addEventListener('click', goBackToMap);
    $('examResultBackBtn').addEventListener('click', goBackToMap);

    $('nextBtn').addEventListener('click', () => {
        if (!currentLevelInfo) return;
        currentLevelInfo.currentIndex++;
        renderQuestion();
    });

    $('finishLevelBtn').addEventListener('click', finishLevel);

    $('endLevelBtn').addEventListener('click', () => {
        if (confirm('هل تريد إنهاء اللعب والعودة إلى الخريطة؟')) {
            clearInterval(levelTimerInterval);
            goBackToMap();
        }
    });

    $('hintBtn').addEventListener('click', useHint);

    loadState();
    updateTopBar();
    $('playerNameInput').value = gameState.playerName || '';
    $('year').textContent = new Date().getFullYear();

    await loadSectionData();

    showScreen('screenStart');

    setTimeout(() => {
        const ls = $('loadingScreen');
        if (ls) {
            ls.style.opacity = '0';
            setTimeout(() => { ls.style.display = 'none'; }, 400);
        }
    }, 400);
}

window.addEventListener('DOMContentLoaded', init);
