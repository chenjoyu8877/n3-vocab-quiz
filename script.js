const qType = document.getElementById('qType');
const aType = document.getElementById('aType');
const startBtn = document.getElementById('start-btn');
const homeBtn = document.getElementById('home-btn');
const setupSection = document.getElementById('setup-section');
const quizSection = document.getElementById('quiz-section');
const questionDisplay = document.getElementById('question-display');
const playAudioBtn = document.getElementById('play-audio-btn');
const inputArea = document.getElementById('input-area');
const answerInput = document.getElementById('answer-input');
const submitBtn = document.getElementById('submit-btn');
const flashcardArea = document.getElementById('flashcard-area');
const flashcard = document.getElementById('flashcard');
const flashcardAnswer = document.getElementById('flashcard-answer');
const feedback = document.getElementById('feedback');
const nextBtn = document.getElementById('next-btn');

// 全域播放器與資料變數
const globalAudioPlayer = new Audio();
let vocabData = [];
let currentWord = {};

// 1. 處理下拉選單互斥防呆
qType.addEventListener('change', () => {
    Array.from(aType.options).forEach(opt => opt.disabled = false);
    if (qType.value === '中文意思') {
        aType.querySelector('option[value="中文意思"]').disabled = true;
        if (aType.value === '中文意思') aType.value = '';
    } else if (qType.value === '漢字') {
        aType.querySelector('option[value="漢字"]').disabled = true;
        if (aType.value === '漢字') aType.value = '';
    }
});

// 2. 讀取並解析 CSV
function loadCSV() {
    Papa.parse("vocab.csv", {
        download: true,
        header: true,
        complete: function(results) {
            vocabData = results.data.filter(row => row['中文意思'] && (row['漢字'] || row['假名拼音']));
            if (vocabData.length > 0) {
                startQuiz();
            } else {
                alert("CSV 載入失敗或沒有符合格式的單字！");
                startBtn.innerText = "開始測驗";
            }
        }
    });
}

startBtn.addEventListener('click', () => {
    if (!qType.value || !aType.value) {
        alert('請先選擇出題與答題形式！');
        return;
    }
    startBtn.innerText = "載入題庫中...";
    loadCSV();
});

// 3. 開始測驗邏輯
function startQuiz() {
    setupSection.classList.add('hidden');
    quizSection.classList.remove('hidden');
    startBtn.innerText = "開始測驗"; 
    nextQuestion();
}

function nextQuestion() {
    feedback.innerText = '';
    answerInput.value = '';
    nextBtn.classList.add('hidden'); 
    
    const randomIndex = Math.floor(Math.random() * vocabData.length);
    currentWord = vocabData[randomIndex];

    // 準備背面的 HTML
    const fullAnswerHTML = `
        <div style="font-size: 22px; margin-bottom: 5px;">
            <strong>${currentWord['漢字'] || ''}</strong> (${currentWord['假名拼音'] || ''})
        </div>
        <div style="color: #0056b3; margin-bottom: 5px;">中文：${currentWord['中文意思'] || ''}</div>
        <div style="font-size: 14px; color: #555; margin-bottom: 8px;">
            [${currentWord['詞性'] || '-'}] | 重音：${currentWord['重音'] || '-'}
        </div>
        <div style="font-size: 14px; text-align: left; width: 100%;">
            ${currentWord['常用例句 1'] ? `・${currentWord['常用例句 1']}<br>` : ''}
            ${currentWord['常用例句 2'] ? `・${currentWord['常用例句 2']}` : ''}
        </div>
    `;
    
    if (aType.value === 'flip') {
        inputArea.classList.add('hidden');
        flashcardArea.classList.remove('hidden');
        
        // 【修正重點】判斷卡片當前狀態
        if (flashcard.classList.contains('is-flipped')) {
            // 如果卡片在背面，才需要執行「等待翻轉動畫」的邏輯
            flashcardAnswer.innerHTML = '<div style="font-size: 16px; color: #777;">單字載入中...</div>';
            flashcard.classList.remove('is-flipped');
            
            const handleTransition = (e) => {
                if (e.propertyName === 'transform') {
                    flashcardAnswer.innerHTML = fullAnswerHTML;
                    flashcard.removeEventListener('transitionend', handleTransition);
                }
            };
            flashcard.addEventListener('transitionend', handleTransition);
        } else {
            // 如果卡片已經在正面（例如第一題），直接填入內容，不用等動畫
            flashcardAnswer.innerHTML = fullAnswerHTML;
        }

    } else {
        // 打字模式直接載入
        flashcard.classList.remove('is-flipped');
        flashcardAnswer.innerHTML = fullAnswerHTML;
        flashcardArea.classList.add('hidden');
        inputArea.classList.remove('hidden');
        setTimeout(() => answerInput.focus(), 50); // 稍微延遲確保對焦成功
    }

    // 處理出題內容與語音
    playAudioBtn.classList.add('hidden');
    if (qType.value === 'audio') {
        questionDisplay.innerText = "🎧 請聽發音";
        playAudioBtn.classList.remove('hidden');
        playTTS(); 
    } else if (qType.value === '中文意思') {
        questionDisplay.innerText = currentWord['中文意思'];
    } else if (qType.value === '漢字') {
        questionDisplay.innerText = currentWord['漢字'];
    }
}

// 4. 高品質語音播放
function playTTS() {
    let sourceText = currentWord['漢字'] || currentWord['假名拼音'];
    if (!sourceText) return;

    const safeFileName = sourceText.trim().replace(/\//g, '_');
    const audioUrl = `./audio/${encodeURIComponent(safeFileName)}.mp3`;

    globalAudioPlayer.pause();
    globalAudioPlayer.currentTime = 0; 
    globalAudioPlayer.src = audioUrl;

    globalAudioPlayer.play().catch(err => {
        console.warn("播放失敗，嘗試系統語音:", err);
        window.speechSynthesis.cancel();
        const backup = new SpeechSynthesisUtterance(sourceText);
        backup.lang = 'ja-JP';
        window.speechSynthesis.speak(backup);
    });
}

// 事件監聽
playAudioBtn.addEventListener('click', playTTS);
submitBtn.addEventListener('click', checkAnswer);
nextBtn.addEventListener('click', nextQuestion);

// 5. 驗證答案
function checkAnswer() {
    const userAnswer = answerInput.value.trim().toLowerCase();
    let correctAnswer = (currentWord[aType.value] || "").trim().toLowerCase(); 

    if (userAnswer === correctAnswer) {
        feedback.innerText = "✅ 答對了！";
        feedback.style.color = "green";
        nextBtn.classList.remove('hidden');
    } else {
        feedback.innerText = `❌ 答錯了！正確答案是: ${correctAnswer}`;
        feedback.style.color = "red";
    }
}

// 6. Enter 鍵操作
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (!nextBtn.classList.contains('hidden')) {
            nextQuestion();
        } 
        else if (!quizSection.classList.contains('hidden') && !inputArea.classList.contains('hidden')) {
            checkAnswer();
        }
    }
});

// 7. 翻卡邏輯
flashcard.addEventListener('click', () => {
    if (aType.value === 'flip') {
        flashcard.classList.toggle('is-flipped');
        nextBtn.classList.remove('hidden'); 
    }
});

// 8. 回首頁
homeBtn.addEventListener('click', () => {
    globalAudioPlayer.pause();
    window.speechSynthesis.cancel();
    quizSection.classList.add('hidden');
    setupSection.classList.remove('hidden');
    feedback.innerText = '';
    answerInput.value = '';
    flashcard.classList.remove('is-flipped');
});