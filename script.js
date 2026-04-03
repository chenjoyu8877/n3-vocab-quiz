// --- 1. DOM 元素宣告 ---
const qType = document.getElementById('qType');
const aType = document.getElementById('aType');
const srsToggle = document.getElementById('srs-toggle');
const logToggle = document.getElementById('log-toggle');
const startBtn = document.getElementById('start-btn');
const resetDataBtn = document.getElementById('reset-data-btn');
const homeBtn = document.getElementById('home-btn');
const setupSection = document.getElementById('setup-section');
const quizSection = document.getElementById('quiz-section');
const questionDisplay = document.getElementById('question-display');
const hintDisplay = document.getElementById('hint-display'); 
const playAudioBtn = document.getElementById('play-audio-btn');
const inputArea = document.getElementById('input-area');
const answerInput = document.getElementById('answer-input');
const canvasArea = document.getElementById('canvas-area'); 
const hwCanvas = document.getElementById('hw-canvas'); 
const submitBtn = document.getElementById('submit-btn');
const flashcardArea = document.getElementById('flashcard-area');
const feedback = document.getElementById('feedback');
const nextBtn = document.getElementById('next-btn');
const giveHintBtn = document.getElementById('give-hint-btn');
const wordHintText = document.getElementById('word-hint-text');

// --- 2. 全域變數與畫布設定 ---
const globalAudioPlayer = new Audio();
let vocabData = [];
let currentWord = {};
let errorChartInstance = null; 
let activeSentenceIdx = 1; // 追蹤目前考的是哪一句例句
const PROGRESS_API_URL = "https://script.google.com/macros/s/AKfycby0LtDXQCqNxWYw43ENQZ3fvAKzEKXa89JbcfXYMte-0iL4h4UFzs6lZKMm1modsS6skw/exec"; // 請務必更換

let ctx = hwCanvas ? hwCanvas.getContext('2d') : null;
let drawing = false;

if (hwCanvas) {
    const startDrawing = (e) => { drawing = true; draw(e); };
    const stopDrawing = () => { drawing = false; if(ctx) ctx.beginPath(); };
    hwCanvas.addEventListener('mousedown', startDrawing);
    hwCanvas.addEventListener('mouseup', stopDrawing);
    hwCanvas.addEventListener('mousemove', draw);
    hwCanvas.addEventListener('touchstart', (e) => { drawing = true; draw(e.touches[0]); e.preventDefault(); }, {passive: false});
    hwCanvas.addEventListener('touchend', stopDrawing);
    hwCanvas.addEventListener('touchmove', (e) => { draw(e.touches[0]); e.preventDefault(); }, {passive: false});
}

function draw(e) {
    if (!drawing || !ctx) return;
    const rect = hwCanvas.getBoundingClientRect();
    const x = (e.clientX || e.pageX) - rect.left;
    const y = (e.clientY || e.pageY) - rect.top;
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#333';
    ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
}

function clearCanvas() { if (ctx) ctx.clearRect(0, 0, hwCanvas.width, hwCanvas.height); }

// --- 3. 音訊與淨化控制 ---
function stopAllAudio() {
    globalAudioPlayer.pause();
    globalAudioPlayer.currentTime = 0;
    globalAudioPlayer.src = ""; 
    if (window.speechSynthesis) window.speechSynthesis.cancel();
}

function cleanForSpeech(text) {
    if (!text) return "";
    return text.replace(/[\(\（].*?[\)\）]/g, '').trim();
}

// --- 4. 數據視覺化圖表 ---
function renderErrorChart(cloudData = []) {
    const chartCanvas = document.getElementById('errorChart');
    if (!chartCanvas) return;
    const chartCtx = chartCanvas.getContext('2d');
    const sortedErrors = [...cloudData]
        .filter(p => parseInt(p.errorCount) > 0)
        .sort((a, b) => b.errorCount - a.errorCount)
        .slice(0, 5);
    const labels = sortedErrors.map(p => p.wordId);
    const counts = sortedErrors.map(p => p.errorCount);
    if (errorChartInstance) errorChartInstance.destroy();
    errorChartInstance = new Chart(chartCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '累積錯誤次數',
                data: counts,
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
                borderColor: 'rgb(255, 99, 132)',
                borderWidth: 1
            }]
        },
        options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

// --- 5. 出題模式連動 (修正：例句模式固定為填空) ---
const modeMap = {
    'sentence': [
        { val: 'ans', text: '填空答題' }
    ],
    'audio': [
        { val: '中文意思', text: '回答中文' }, { val: '漢字', text: '回答漢字' },
        { val: 'both', text: '回答漢字+中文' }, { val: 'flip', text: '翻頁模式' },
        { val: 'handwriting', text: '手寫模式' }
    ],
    '中文意思': [
        { val: '假名拼音', text: '回答假名' }, { val: '漢字', text: '回答漢字' },
        { val: 'flip', text: '翻頁模式' }, { val: 'handwriting', text: '手寫模式' }
    ],
    '漢字': [
        { val: '假名拼音', text: '回答假名' }, { val: '中文意思', text: '回答中文' },
        { val: 'flip', text: '翻頁模式' }, { val: 'handwriting', text: '手寫模式' }
    ]
};

qType.addEventListener('change', () => {
    const opts = modeMap[qType.value] || [];
    aType.innerHTML = opts.map(o => `<option value="${o.val}">${o.text}</option>`).join('');
});
qType.dispatchEvent(new Event('change'));

// --- 6. 同步與抽題邏輯 ---
async function refreshHomeStats() {
    if (logToggle.checked) {
        try {
            const res = await fetch(PROGRESS_API_URL);
            if (res.ok) {
                const cloudData = await res.json();
                renderErrorChart(cloudData);
                return cloudData;
            }
        } catch (e) { console.warn("同步失敗", e); }
    }
    return null;
}

async function loadAndSyncData() {
    startBtn.innerText = "同步數據中...";
    Papa.parse("vocab.csv", {
        download: true, header: true,
        complete: async (results) => {
            vocabData = results.data.filter(row => row['中文意思'] && (row['漢字'] || row['假名拼音']))
                .map(item => ({ ...item, errorCount: 0, level: 0, nextReviewDate: "" }));
            const cloudData = await refreshHomeStats();
            if (cloudData) {
                const map = new Map(cloudData.map(p => [p.wordId, p]));
                vocabData.forEach(w => {
                    const id = w['漢字'] || w['假名拼音'];
                    const p = map.get(id);
                    if (p) { 
                        w.errorCount = parseInt(p.errorCount) || 0; 
                        w.level = parseInt(p.level) || 0; 
                        w.nextReviewDate = p.nextReviewDate || ""; 
                    }
                });
            }
            startQuiz();
        }
    });
}

function getNextWord() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let dueWords = vocabData.filter(w => {
        if (!w.nextReviewDate) return true;
        return new Date(w.nextReviewDate) <= today;
    });
    if (dueWords.length === 0) { alert("🎉 今日任務已完成！"); homeBtn.click(); return null; }
    if (srsToggle.checked) {
        let lowLevel = dueWords.filter(w => w.level < 3);
        if (lowLevel.length > 0 && Math.random() < 0.8) return lowLevel[Math.floor(Math.random() * lowLevel.length)];
    }
    return dueWords[Math.floor(Math.random() * dueWords.length)];
}

// --- 7. 測驗流程管理 ---
function startQuiz() { setupSection.classList.add('hidden'); quizSection.classList.remove('hidden'); nextQuestion(); }

function nextQuestion() {
    stopAllAudio();
    feedback.innerHTML = ''; answerInput.value = ''; wordHintText.innerText = ''; 
    nextBtn.classList.add('hidden'); clearCanvas();
    
    currentWord = getNextWord();
    if (!currentWord) return;

    playAudioBtn.classList.add('hidden'); inputArea.classList.add('hidden');
    canvasArea.classList.add('hidden'); flashcardArea.classList.add('hidden');

    const currentModeName = aType.options[aType.selectedIndex].text;
    hintDisplay.innerHTML = `模式：<span style="color:#007bff">${currentModeName}</span> | 重音：${currentWord['重音'] || '-'}`;

    // 處理出題邏輯
    if (qType.value === 'sentence') {
        // 隨機選例句 1 或 2，若例句 2 題目為空則固定選 1
        activeSentenceIdx = (Math.random() < 0.5 && currentWord['常用例句 2題目']) ? 2 : 1;
        const cnTrans = currentWord[`常用例句 ${activeSentenceIdx}中`];
        const sentenceQ = currentWord[`常用例句 ${activeSentenceIdx}題目`];
        questionDisplay.innerHTML = `<div style="font-size:18px; color:#666; margin-bottom:10px;">${cnTrans}</div><div>${sentenceQ}</div>`;
        inputArea.classList.remove('hidden');
        setTimeout(() => answerInput.focus(), 50);
    } else {
        if (qType.value === 'audio') {
            questionDisplay.innerText = "🎧 聽力測驗 (點擊卡片看答案)";
            playAudioBtn.classList.remove('hidden');
            playFullSequence();
        } else {
            questionDisplay.innerText = currentWord[qType.value];
        }

        // 依答題形式決定顯示
        if (aType.value === 'flip') {
            flashcardArea.classList.remove('hidden');
        } else if (aType.value === 'handwriting') {
            canvasArea.classList.remove('hidden');
            document.getElementById('canvas-submit-btn').classList.remove('hidden');
        } else {
            inputArea.classList.remove('hidden');
            setTimeout(() => answerInput.focus(), 50);
        }
    }
}

// --- 8. 💡 提示功能 ---
function giveHint() {
    if (!currentWord) return;
    let hint = "";
    let targetAnswer = (qType.value === 'sentence') 
        ? currentWord[`常用例句 ${activeSentenceIdx}答案`] 
        : currentWord[aType.value === 'both' ? '漢字' : aType.value];

    if (aType.value === 'flip' || aType.value === 'handwriting') {
        hint = "請根據答案卡內容對照判定喔！";
    } else if (aType.value === 'both') {
        hint = `提示：漢字「${currentWord['漢字'][0]}...」，中文「${currentWord['中文意思'][0]}...」`;
    } else if (targetAnswer) {
        const first = targetAnswer.split('/')[0];
        hint = `提示：首字「${first[0]}」，共 ${first.length} 字。`;
    }
    wordHintText.innerText = hint;
}

// --- 9. 音訊播放 (對齊新欄位：日文原句) ---
function playTTS(type = 'word') {
    return new Promise((resolve) => {
        let text = (type === 'word') 
            ? (currentWord['漢字'] || currentWord['假名拼音']) 
            : currentWord[`常用例句 ${type}日`];

        if (!text) return resolve();
        const baseName = (currentWord['漢字'] || currentWord['假名拼音']).replace(/\//g, '_');
        globalAudioPlayer.src = `./audio/${encodeURIComponent(baseName)}${type==='word'?'':`_${type}`}.mp3`;
        globalAudioPlayer.onended = resolve;
        globalAudioPlayer.play().catch(() => {
            window.speechSynthesis.cancel();
            const ut = new SpeechSynthesisUtterance(cleanForSpeech(text));
            ut.lang = 'ja-JP'; ut.onend = resolve;
            window.speechSynthesis.speak(ut);
        });
    });
}

async function playFullSequence() {
    stopAllAudio();
    await playTTS('word');
    if (currentWord['常用例句 1日']) { await new Promise(r => setTimeout(r, 600)); await playTTS('1'); }
    if (currentWord['常用例句 2日']) { await new Promise(r => setTimeout(r, 600)); await playTTS('2'); }
}

// --- 10. 判定與對照顯示 (手動判定與錯題再現) ---
function showFullCard(isCorrect, userAnswer = "") {
    const isManual = (aType.value === 'flip' || aType.value === 'handwriting');
    let headerHTML = "";

    if (isManual) {
        headerHTML = `
            <div id="manual-controls" style="margin-bottom:15px; background:#fff3cd; padding:12px; border-radius:10px; border:1px solid #ffeeba;">
                <p style="font-weight:bold; margin-bottom:10px; color:#856404;">請判定您的回答：</p>
                <div style="display:flex; gap:10px;">
                    <button onclick="manualResult(true)" style="background:#28a745; color:white; flex:1; padding:12px; border-radius:8px; font-weight:bold;">✅ 我對了</button>
                    <button onclick="manualResult(false)" style="background:#dc3545; color:white; flex:1; padding:12px; border-radius:8px; font-weight:bold;">❌ 我錯了</button>
                </div>
            </div>
        `;
    } else {
        if (isCorrect) headerHTML = `<h3 style="color:green;">✅ 正確！</h3>`;
        else headerHTML = `<h3 style="color:red;">❌ 答錯了！</h3><p><small>輸入：${userAnswer || "(空白)"}</small></p><button onclick="undo()" id="undo-btn">🔧 手誤取消懲罰</button>`;
    }

    feedback.innerHTML = `
        <div class="card-box" style="border: 2px solid #ccc; padding: 15px; border-radius: 10px; background: #fff; margin-top: 15px; text-align: left;">
            ${headerHTML}
            <div style="font-size: 24px;"><strong>${currentWord['漢字']}</strong> (${currentWord['假名拼音']})</div>
            <div style="color: #d9534f; font-weight: bold;">中文：${currentWord['中文意思']}</div>
            <div style="font-size: 14px; color: #777;">[${currentWord['詞性']}] | 重音：${currentWord['重音']}</div>
            <hr>
            <div style="font-size: 15px; background: #f1f1f1; padding: 10px; border-radius: 8px;">
                <div class="sentence-row" onclick="playTTS('1')" style="cursor:pointer; margin-bottom:10px;">
                    🔊 <strong>例句 1：</strong>${currentWord['常用例句 1日']}<br>
                    <small style="color:#666;">${currentWord['常用例句 1中']}</small>
                </div>
                <div class="sentence-row" onclick="playTTS('2')" style="cursor:pointer;">
                    🔊 <strong>例句 2：</strong>${currentWord['常用例句 2日']}<br>
                    <small style="color:#666;">${currentWord['常用例句 2中']}</small>
                </div>
            </div>
        </div>
    `;
    if (!isManual) nextBtn.classList.remove('hidden');
}

async function checkAnswer() {
    const mode = aType.value;
    const userVal = answerInput.value.trim().toLowerCase();
    
    if (mode === 'handwriting') {
        document.getElementById('canvas-submit-btn').classList.add('hidden'); 
    } else if (mode === 'flip') {
        flashcardArea.classList.add('hidden');
    } else {
        inputArea.classList.add('hidden');
    }

    if (mode === 'flip' || mode === 'handwriting') {
        showFullCard(null);
    } else {
        // 抓取對應模式下的正確答案
        let correctRaw = (qType.value === 'sentence') 
            ? currentWord[`常用例句 ${activeSentenceIdx}答案`] 
            : currentWord[mode === 'both' ? '漢字' : mode];
        
        const possible = (correctRaw || "").toLowerCase().split('/').map(s => s.trim());
        const isCorrect = possible.some(p => userVal === p);

        if (isCorrect) {
            currentWord.level++;
            syncToCloud("SUCCESS");
            showFullCard(true);
        } else {
            currentWord.errorCount++;
            currentWord.level = Math.max(0, currentWord.level - 1);
            currentWord.nextReviewDate = new Date().toISOString().split('T')[0]; // 當天再現
            syncToCloud("ERROR");
            showFullCard(false, userVal);
        }
    }
}

window.manualResult = (isCorrect) => {
    if (isCorrect) {
        currentWord.level++;
        syncToCloud("SUCCESS");
        nextQuestion();
    } else {
        currentWord.errorCount++;
        currentWord.level = Math.max(0, currentWord.level - 1);
        currentWord.nextReviewDate = new Date().toISOString().split('T')[0];
        syncToCloud("ERROR");
        const ctrl = document.getElementById('manual-controls');
        if (ctrl) ctrl.innerHTML = `<h3 style="color:red; margin:0;">❌ 判定錯誤 (當天將再次出現)</h3>`;
        nextBtn.classList.remove('hidden');
    }
};

window.undo = () => {
    currentWord.errorCount--; currentWord.level += 2; syncToCloud("UNDO");
    feedback.innerHTML = `<h3 style="color:blue;">✨ 已取消懲罰！</h3>` + (feedback.innerHTML.split('</button>')[1] || "");
};

function syncToCloud(op) {
    if (!logToggle.checked) return;
    const data = { timestamp: new Date().toLocaleString(), wordId: currentWord['漢字'] || currentWord['假名拼音'], errorCount: currentWord.errorCount, level: currentWord.level, status: op };
    fetch(PROGRESS_API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(data) });
}

// --- 11. 事件綁定 ---
window.onload = refreshHomeStats;
startBtn.onclick = loadAndSyncData;
submitBtn.onclick = checkAnswer;
nextBtn.onclick = nextQuestion;
playAudioBtn.onclick = playFullSequence;
giveHintBtn.onclick = giveHint;

homeBtn.onclick = () => { 
    stopAllAudio(); quizSection.classList.add('hidden'); setupSection.classList.remove('hidden'); 
    startBtn.innerText = "開始測驗"; refreshHomeStats(); 
};

resetDataBtn.onclick = () => {
    if (confirm("⚠️ 確定要重設進度嗎？")) {
        vocabData.forEach(w => { w.level = 0; w.errorCount = 0; w.nextReviewDate = ""; });
        if (logToggle.checked) fetch(PROGRESS_API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ status: "RESET_ALL" }) }).then(() => location.reload());
    }
};

document.onkeydown = (e) => {
    if (e.key === 'Enter' && !quizSection.classList.contains('hidden')) {
        if (!nextBtn.classList.contains('hidden')) nextQuestion();
        else if (feedback.innerHTML === "") checkAnswer();
    }
};