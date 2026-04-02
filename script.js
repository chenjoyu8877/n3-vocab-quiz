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

// 輔助功能：清理括號內的中文
function cleanForSpeech(text) {
    if (!text) return "";
    return text.replace(/[\(\（].*?[\)\）]/g, '').trim();
}

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

    const fullAnswerHTML = `
        <div style="font-size: 22px; margin-bottom: 5px;">
            <strong>${currentWord['漢字'] || ''}</strong> (${currentWord['假名拼音'] || ''})
        </div>
        <div style="color: #0056b3; margin-bottom: 5px;">中文：${currentWord['中文意思'] || ''}</div>
        <div style="font-size: 14px; color: #555; margin-bottom: 8px;">
            [${currentWord['詞性'] || '-'}] | 重音：${currentWord['重音'] || '-'}
        </div>
        <div style="font-size: 14px; text-align: left; width: 100%;">
            ${currentWord['常用例句 1'] ? 
                `<div class="sentence-row" style="cursor:pointer; padding:3px;" onclick="event.stopPropagation(); playTTS('1')">🔊 ${currentWord['常用例句 1']}</div>` : ''}
            ${currentWord['常用例句 2'] ? 
                `<div class="sentence-row" style="cursor:pointer; padding:3px;" onclick="event.stopPropagation(); playTTS('2')">🔊 ${currentWord['常用例句 2']}</div>` : ''}
        </div>
    `;
    
    if (aType.value === 'flip') {
        inputArea.classList.add('hidden');
        flashcardArea.classList.remove('hidden');
        
        if (flashcard.classList.contains('is-flipped')) {
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
            flashcardAnswer.innerHTML = fullAnswerHTML;
        }

    } else {
        flashcard.classList.remove('is-flipped');
        flashcardAnswer.innerHTML = fullAnswerHTML;
        flashcardArea.classList.add('hidden');
        inputArea.classList.remove('hidden');
        setTimeout(() => answerInput.focus(), 50); 
    }

    playAudioBtn.classList.add('hidden');
    if (qType.value === 'audio') {
        questionDisplay.innerText = "🎧 請聽發音";
        playAudioBtn.classList.remove('hidden');
        // 【關鍵改動】：出題時直接啟動「連讀序列」
        playFullSequence(); 
    } else if (qType.value === '中文意思') {
        questionDisplay.innerText = currentWord['中文意思'];
    } else if (qType.value === '漢字') {
        questionDisplay.innerText = currentWord['漢字'];
    }
}

// 4-1. 高品質語音播放 (Promise 化版本，確保播完才會執行下一步)
function playTTS(type = 'word') {
    return new Promise((resolve) => {
        let rawText = currentWord['漢字'] || currentWord['假名拼音'];
        if (!rawText) return resolve();

        const baseFileName = rawText.trim().replace(/\//g, '_');
        let targetFileName = type === 'word' ? baseFileName : `${baseFileName}_${type}`;
        const audioUrl = `./audio/${encodeURIComponent(targetFileName)}.mp3`;

        globalAudioPlayer.pause();
        globalAudioPlayer.currentTime = 0; 
        globalAudioPlayer.src = audioUrl;

        // 當音檔播放結束時，發出完成信號
        globalAudioPlayer.onended = () => resolve();

        globalAudioPlayer.play().catch(err => {
            console.warn("找不到預錄檔，嘗試系統語音:", err);
            let speechText = type === 'word' ? rawText : currentWord[`常用例句 ${type}`];
            window.speechSynthesis.cancel();
            const backup = new SpeechSynthesisUtterance(cleanForSpeech(speechText));
            backup.lang = 'ja-JP';
            // 系統語音結束時也發出完成信號
            backup.onend = () => resolve();
            window.speechSynthesis.speak(backup);
        });
    });
}

// 4-2. 【新增】連鎖播放邏輯：單字 -> 停頓 -> 例句 1 -> 停頓 -> 例句 2
async function playFullSequence() {
    // 停止目前所有可能的播放，確保乾淨開始
    window.speechSynthesis.cancel();
    
    // 1. 播放單字
    await playTTS('word');
    
    // 2. 停頓 0.6 秒 (可依喜好調整)
    await new Promise(r => setTimeout(r, 600));

    // 3. 播放例句 1
    if (currentWord['常用例句 1']) {
        await playTTS('1');
        await new Promise(r => setTimeout(r, 600));
    }

    // 4. 播放例句 2
    if (currentWord['常用例句 2']) {
        await playTTS('2');
    }
}

// 事件監聽
// 重播按鈕現在也會執行完整序列
playAudioBtn.addEventListener('click', () => playFullSequence());
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