// --- 1. DOM 元素宣告 ---
const qType = document.getElementById('qType');
const aType = document.getElementById('aType');
const srsToggle = document.getElementById('srs-toggle');
const logToggle = document.getElementById('log-toggle');
const startBtn = document.getElementById('start-btn');
const resetDataBtn = document.getElementById('reset-data-btn');
const homeBtn = document.getElementById('home-btn');
const homeBtnList = document.getElementById('home-btn-list');
const setupSection = document.getElementById('setup-section');
const quizSection = document.getElementById('quiz-section');
const questionDisplay = document.getElementById('question-display');
const hintDisplay = document.getElementById('hint-display'); 
const playAudioBtn = document.getElementById('play-audio-btn');
const inputArea = document.getElementById('input-area');

const kanjiInput = document.getElementById('kanji-input');
const chineseInput = document.getElementById('chinese-input');
const canvasArea = document.getElementById('canvas-area'); 
const hwCanvas = document.getElementById('hw-canvas'); 
const submitBtn = document.getElementById('submit-btn');
const flashcardArea = document.getElementById('flashcard-area');
const feedback = document.getElementById('feedback');
const nextBtn = document.getElementById('next-btn');

const viewListBtn = document.getElementById('view-list-btn');
const listSection = document.getElementById('list-section');
const vocabListContainer = document.getElementById('vocab-list-container');
const wordModal = document.getElementById('word-modal');
const modalContent = document.getElementById('modal-content');
const mainCategoryFilter = document.getElementById('main-category-filter');
const posFilter = document.getElementById('pos-filter');
const searchInput = document.getElementById('search-input');

// ⭐ AI 相關元素
const aiToggle = document.getElementById('ai-toggle');
const aiSettings = document.getElementById('ai-settings');
const geminiApiKeyInput = document.getElementById('gemini-api-key');
const batchResultsArea = document.getElementById('batch-results-area');
const batchResultsContent = document.getElementById('batch-results-content');
const batchFinishBtn = document.getElementById('batch-finish-btn');

// --- 2. 全域變數與核心邏輯 ---
const globalAudioPlayer = new Audio();
let vocabData = [];
let currentWord = {};
let errorChartInstance = null; 
let activeSentenceIdx = 1; 
const PROGRESS_API_URL = "https://script.google.com/macros/s/AKfycby0LtDXQCqNxWYw43ENQZ3fvAKzEKXa89JbcfXYMte-0iL4h4UFzs6lZKMm1modsS6skw/exec"; 

let lastEnterTime = 0;
const ENTER_CD_MS = 600; 
let audioSequenceId = 0; 

// 批次測驗變數
let isBatchMode = false;
let batchQuestions = [];
let batchAnswers = [];
let currentBatchIdx = 0;

const categoryMap = {
    '名詞': ['名詞', '代名詞', '形式名詞'],
    '動詞': ['動', '自', '他', '五', '上一', '下一', 'サ', 'カ'],
    '形容詞': ['い形容詞', 'な形容詞', 'い形', 'な形', '形動'],
    '副詞': ['副詞', '副'],
    '慣用': ['慣用', '接續詞', '感嘆詞']
};

const subCatMapping = {
    '動詞': {
        '自動一': ['自五', '自動一'], '自動二': ['自上一', '自下一', '自動二'], '自動三': ['自サ', '自力', '自動三'],
        '他動一': ['他五', '他動一'], '他動二': ['他上一', '他下一', '他動二'], '他動三': ['他サ', '他裝', '他動三'],
        '自他動一': ['自他五', '自開一'], '自他動二': ['自他上一', '自他下一', '自他動二'], '自他動三': ['自他サ', '自他力', '自他動三']
    },
    '形容詞': { 'い形': ['い形容詞', 'い形'], 'な形': ['な形容詞', 'な形', '形動'] },
    '副詞': { '程度副詞': ['程度'], '情態副詞': ['情態', '狀態'], '時間副詞': ['時間'], '陳述副詞': ['陳述', '呼應'], '擬聲擬態': ['擬性', '擬態', 'オノマトペ'] }
};

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

// AI 設定 UI 切換
aiToggle.addEventListener('change', () => {
    if (aiToggle.checked) aiSettings.classList.remove('hidden');
    else aiSettings.classList.add('hidden');
});

function getBaseName(w) {
    const kanji = (w['漢字'] || '').trim();
    const kana = (w['假名拼音'] || '').trim();
    return (kanji || kana).replace(/\//g, '_');
}

function stopAllAudio() {
    audioSequenceId++; 
    globalAudioPlayer.pause();
    globalAudioPlayer.currentTime = 0;
    globalAudioPlayer.src = ""; 
}

function cleanForSpeech(text) {
    if (!text) return "";
    return text.replace(/[\(\（].*?[\)\）]/g, '').trim();
}

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
            datasets: [{ label: '累積錯誤次數', data: counts, backgroundColor: 'rgba(255, 99, 132, 0.5)', borderColor: 'rgb(255, 99, 132)', borderWidth: 1 }]
        },
        options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

const modeMap = {
    'audio': [ { val: '中文意思', text: '回答中文' }, { val: '漢字', text: '回答漢字' }, { val: 'both', text: '回答漢字+中文' }, { val: 'flip', text: '翻頁模式' }, { val: 'handwriting', text: '手寫模式' } ],
    '中文意思': [ { val: '假名拼音', text: '回答假名' }, { val: '漢字', text: '回答漢字' }, { val: 'flip', text: '翻頁模式' }, { val: 'handwriting', text: '手寫模式' } ],
    '漢字': [ { val: '假名拼音', text: '回答假名' }, { val: '中文意思', text: '回答中文' }, { val: 'flip', text: '翻頁模式' }, { val: 'handwriting', text: '手寫模式' } ],
    'sentence': [ { val: 'ans', text: '填空答題' } ]
};

qType.addEventListener('change', () => {
    const opts = modeMap[qType.value] || [];
    aType.innerHTML = opts.map(o => `<option value="${o.val}">${o.text}</option>`).join('');
});
qType.dispatchEvent(new Event('change'));

async function loadVocabCSV() {
    return new Promise((resolve) => {
        Papa.parse("vocab.csv", {
            download: true, header: true,
            complete: (results) => {
                vocabData = results.data.filter(row => row['中文意思'] && (row['漢字'] || row['假名拼音']))
                    .map(item => ({ ...item, errorCount: 0, level: 0, nextReviewDate: "" }));
                resolve();
            }
        });
    });
}

async function loadAndSyncData() {
    startBtn.innerText = "同步數據中...";
    await loadVocabCSV();
    const cloudData = await refreshHomeStats();
    if (cloudData) {
        const map = new Map(cloudData.map(p => [p.wordId, p]));
        vocabData.forEach(w => {
            const id = (w['漢字'] || '').trim() || (w['假名拼音'] || '').trim();
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

function getNextWord() {
    if (isBatchMode) {
        if (currentBatchIdx >= batchQuestions.length) return null;
        return batchQuestions[currentBatchIdx];
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    let dueWords = vocabData.filter(w => {
        if (!w.nextReviewDate) return true;
        const nextDate = new Date(w.nextReviewDate);
        nextDate.setHours(0, 0, 0, 0);
        return nextDate <= today;
    });
    if (dueWords.length === 0) { alert("🎉 今日任務已完成！"); homeBtn.click(); return null; }
    if (srsToggle.checked) {
        let lowLevel = dueWords.filter(w => w.level < 3);
        if (lowLevel.length > 0 && Math.random() < 0.8) return lowLevel[Math.floor(Math.random() * lowLevel.length)];
    }
    return dueWords[Math.floor(Math.random() * dueWords.length)];
}

// --- 5. 單字列表渲染 ---
async function showListView() {
    if (vocabData.length === 0) await loadVocabCSV();
    mainCategoryFilter.value = 'all';
    searchInput.value = ''; 
    updateSubCategories(); 
    setupSection.classList.add('hidden');
    listSection.classList.remove('hidden');
}

function updateSubCategories() {
    const mainCat = mainCategoryFilter.value;
    const subSet = new Set();
    if (subCatMapping[mainCat]) {
        Object.keys(subCatMapping[mainCat]).forEach(key => subSet.add(key));
    } else {
        vocabData.forEach(w => {
            if (!w['詞性']) return;
            w['詞性'].split('/').map(p => p.trim()).forEach(p => {
                if (mainCat === 'all') subSet.add(p);
                else if (mainCat === '其他') {
                    const isKnown = Object.values(categoryMap).flat().some(k => p.includes(k));
                    if (!isKnown) subSet.add(p);
                } else if (categoryMap[mainCat]?.some(k => p.includes(k))) {
                    subSet.add(p);
                }
            });
        });
    }
    posFilter.innerHTML = '<option value="all">全部小類</option>';
    Array.from(subSet).sort().forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub; opt.innerText = sub;
        posFilter.appendChild(opt);
    });
    renderVocabList();
}

function renderVocabList() {
    vocabListContainer.innerHTML = '';
    const mainCat = mainCategoryFilter.value;
    const subCat = posFilter.value;
    const searchTerm = searchInput.value.trim().toLowerCase();

    vocabData.forEach((w, index) => {
        if (!w['詞性']) return;

        if (searchTerm) {
            const kanji = (w['漢字'] || '').toLowerCase();
            const kana = (w['假名拼音'] || '').toLowerCase();
            const zh = (w['中文意思'] || '').toLowerCase();
            if (!kanji.includes(searchTerm) && !kana.includes(searchTerm) && !zh.includes(searchTerm)) return; 
        }

        const parts = w['詞性'].split('/').map(p => p.trim());
        let match = (mainCat === 'all' && subCat === 'all');
        if (!match && subCat !== 'all') {
            match = parts.some(p => {
                const keywords = subCatMapping[mainCat]?.[subCat];
                return keywords ? keywords.some(k => p.includes(k)) : p === subCat;
            });
        } else if (!match && mainCat !== 'all') {
            match = parts.some(p => {
                if (mainCat === '其他') return !Object.values(categoryMap).flat().some(k => p.includes(k));
                return categoryMap[mainCat]?.some(k => p.includes(k));
            });
        }
        if (!match) return;

        const item = document.createElement('div');
        item.className = "list-item";
        item.style = "display:flex; align-items:center; padding:10px 5px; border-bottom:1px solid #f1f1f1; cursor:pointer;";
        item.onclick = () => showWordDetail(index);
        
        const displayKana = w['假名拼音(分別)'] || w['假名拼音'] || "";
        const displayAccent = w['重音'] || "";

        item.innerHTML = `
            <div style="width: 30px; font-size: 10px; color: #999; text-align: left; font-family: monospace;">#${w['單字編號'] || (index + 1)}</div>
            <div style="flex: 1.5; text-align: left; padding-left: 5px; min-width: 0;">
                <div style="font-size:16px; font-weight:bold; color:#2c3e50; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${w['漢字']}</div>
                <div style="font-size:11px; color:#666;">${displayKana} <span style="color:#007bff; font-weight:bold; margin-left:3px;">${displayAccent}</span></div>
            </div>
            <div style="flex: 1; text-align: center; color: #6c757d; font-size: 10px; background: #f8f9fa; border-radius: 4px; margin: 0 5px; padding: 2px 0;">${w['詞性']}</div>
            <div style="flex: 1.2; color:#d9534f; font-weight:bold; font-size:14px; text-align:left; padding-left: 5px;">${w['中文意思']}</div>
            <div style="width: 35px; text-align: right;">
                <button onclick="event.stopPropagation(); playListAudio(${index})" style="background:none; border:none; font-size:18px; color:#007bff; cursor:pointer;">🔊</button>
            </div>
        `;
        vocabListContainer.appendChild(item);
    });
}

function showWordDetail(index) {
    const w = vocabData[index];
    currentWord = w; 
    const detailKana = w['假名拼音(分別)'] || w['假名拼音'] || "";
    modalContent.innerHTML = `
        <span class="close-btn" onclick="closeModal()" style="position:absolute; top:10px; right:15px; font-size:28px; cursor:pointer;">&times;</span>
        <div style="font-size: 24px; margin-bottom:5px;"><strong>${w['漢字']}</strong></div>
        <div style="color:#666; margin-bottom:10px;">${detailKana} ${w['重音'] || ''} | ${w['詞性']}</div>
        <div style="color:#d9534f; font-weight:bold; font-size:18px;">中文：${w['中文意思']}</div>
        <hr>
        <div class="sentence-row" onclick="playTTS('1')" style="cursor:pointer; padding:8px; background:#f9f9f9; border-radius:5px;">🔊 <strong>例句 1：</strong>${w['常用例句 1日']}<br><small style="color:#666;">${w['常用例句 1中']}</small></div>
        <div class="sentence-row" onclick="playTTS('2')" style="cursor:pointer; padding:8px; background:#f9f9f9; border-radius:5px; margin-top:10px;">🔊 <strong>例句 2：</strong>${w['常用例句 2日']}<br><small style="color:#666;">${w['常用例句 2中']}</small></div>
    `;
    wordModal.classList.remove('hidden');
}

function closeModal() { wordModal.classList.add('hidden'); }
function closeListView() { listSection.classList.add('hidden'); setupSection.classList.remove('hidden'); }

function playListAudio(index) {
   const w = vocabData[index];
   const baseName = getBaseName(w);
   const audioUrl = `./audio/${encodeURIComponent(baseName)}.wav`;
   const player = new Audio(audioUrl);
   player.play().catch(() => { console.warn(`音檔不存在: ${audioUrl}`); });
}

// --- 6. 測驗管理流程 ---
function startQuiz() { 
    if (aiToggle.checked) {
        const apiKey = geminiApiKeyInput.value.trim();
        if (!apiKey) { alert("請先輸入 Gemini API Key！"); return; }
        
        // ⭐ 將 API Key 存入瀏覽器，下次不用重填
        localStorage.setItem('geminiApiKey', apiKey); 

        const mode = aType.value;
        if (mode !== '中文意思' && mode !== 'both') { alert("AI 批改模式僅支援答題包含「中文意思」的模式！"); return; }
        
        isBatchMode = true;
        batchAnswers = [];
        currentBatchIdx = 0;

        const today = new Date(); today.setHours(0, 0, 0, 0);
        let dueWords = vocabData.filter(w => {
            if (!w.nextReviewDate) return true;
            const nextDate = new Date(w.nextReviewDate);
            nextDate.setHours(0, 0, 0, 0);
            return nextDate <= today;
        });

        dueWords.sort(() => Math.random() - 0.5); 
        // ⭐ 改成 5 題，方便快速測試
        batchQuestions = dueWords.slice(0, 5); 

        if (batchQuestions.length === 0) { alert("🎉 今日任務已完成！"); return; }
    } else {
        isBatchMode = false;
    }

    setupSection.classList.add('hidden'); 
    batchResultsArea.classList.add('hidden');
    document.getElementById('question-area').classList.remove('hidden');
    quizSection.classList.remove('hidden'); 
    nextQuestion(); 
}

function nextQuestion() {
    stopAllAudio();
    feedback.innerHTML = ''; kanjiInput.value = ''; chineseInput.value = ''; 
    nextBtn.classList.add('hidden'); clearCanvas();
    
    currentWord = getNextWord();
    if (!currentWord) return;

    playAudioBtn.classList.add('hidden'); inputArea.classList.add('hidden');
    canvasArea.classList.add('hidden'); flashcardArea.classList.add('hidden');

    const currentModeName = aType.options[aType.selectedIndex].text;
    let hintText = `模式：<span style="color:#007bff">${currentModeName}</span> | 重音：${currentWord['重音'] || '-'}`;
    
    if (isBatchMode) {
        hintText += ` | <strong style="color:red;">AI 模式: 第 ${currentBatchIdx + 1}/${batchQuestions.length} 題</strong>`;
    }
    hintDisplay.innerHTML = hintText;

    if (qType.value === 'sentence') {
        activeSentenceIdx = (Math.random() < 0.5 && currentWord['常用例句 2題目']) ? 2 : 1;
        const cnTrans = currentWord[`常用例句 ${activeSentenceIdx}中`];
        const sentenceQ = currentWord[`常用例句 ${activeSentenceIdx}題目`];
        questionDisplay.innerHTML = `<div style="font-size:18px; color:#666; margin-bottom:10px;">${cnTrans}</div><div>${sentenceQ}</div>`;
        inputArea.classList.remove('hidden'); kanjiInput.classList.add('hidden'); chineseInput.classList.remove('hidden');
        setTimeout(() => chineseInput.focus(), 50);
    } else {
        if (aType.value === 'flip') flashcardArea.classList.remove('hidden');
        else if (aType.value === 'handwriting') {
            canvasArea.classList.remove('hidden');
            document.getElementById('canvas-submit-btn').classList.remove('hidden');
        } else {
            inputArea.classList.remove('hidden');
            if (aType.value === 'both') {
                kanjiInput.classList.remove('hidden'); chineseInput.classList.remove('hidden');
                setTimeout(() => kanjiInput.focus(), 50);
            } else if (aType.value === '中文意思') {
                kanjiInput.classList.add('hidden'); chineseInput.classList.remove('hidden');
                setTimeout(() => chineseInput.focus(), 50);
            } else {
                kanjiInput.classList.remove('hidden'); chineseInput.classList.add('hidden');
                setTimeout(() => kanjiInput.focus(), 50);
            }
        }

        if (qType.value === 'audio') {
            questionDisplay.innerText = "🎧 聽力測驗 (點擊卡片看答案)";
            playAudioBtn.classList.remove('hidden');
            playFullSequence(); 
        } else {
            questionDisplay.innerText = currentWord[qType.value];
        }
    }
}

async function playFullSequence() {
    const currentId = audioSequenceId; 
    if (audioSequenceId !== currentId) return; 
    await playTTS('word', currentId);

    if (currentWord['常用例句 1日']) {
        if (audioSequenceId !== currentId) return;
        await new Promise(r => setTimeout(r, 600)); 
        if (audioSequenceId !== currentId) return;
        await playTTS('1', currentId);
    }
    if (currentWord['常用例句 2日']) {
        if (audioSequenceId !== currentId) return;
        await new Promise(r => setTimeout(r, 600));
        if (audioSequenceId !== currentId) return;
        await playTTS('2', currentId);
    }
}

function playTTS(type = 'word', taskId = null) {
    return new Promise((resolve) => {
        if (taskId !== null && taskId !== audioSequenceId) return resolve();
        let text = (type === 'word') ? (currentWord['漢字'] || currentWord['假名拼音']) : currentWord[`常用例句 ${type}日`];
        if (!text) return resolve();
        
        const baseName = getBaseName(currentWord);
        const audioUrl = `./audio/${encodeURIComponent(baseName)}${type==='word'?'':`_${type}`}.wav`;
        globalAudioPlayer.src = audioUrl;
        
        globalAudioPlayer.onended = () => resolve();
        globalAudioPlayer.onerror = () => { console.warn(`音檔不存在: ${audioUrl}`); resolve(); };
        globalAudioPlayer.play().catch(() => resolve());
    });
}

function showFullCard(isCorrect, userAnswer = "") {
    const isManual = (aType.value === 'flip' || aType.value === 'handwriting');
    let headerHTML = isManual ? `
        <div id="manual-controls" style="margin-bottom:15px; background:#fff3cd; padding:12px; border-radius:10px; border:1px solid #ffeeba;">
            <p style="font-weight:bold; margin-bottom:10px; color:#856404;">請判定您的回答：</p>
            <div style="display:flex; gap:10px;">
                <button onclick="manualResult(true)" style="background:#28a745; color:white; flex:1; padding:12px; border-radius:8px; font-weight:bold;">✅ 我對了</button>
                <button onclick="manualResult(false)" style="background:#dc3545; color:white; flex:1; padding:12px; border-radius:8px; font-weight:bold;">❌ 我錯了</button>
            </div>
        </div>` : (isCorrect ? `<h3 style="color:green;">✅ 正確！</h3>` : `<h3 style="color:red;">❌ 答錯了！</h3><p><small>您的輸入：${userAnswer}</small></p><button onclick="undo()" id="undo-btn">🔧 手誤取消懲罰</button>`);

    feedback.innerHTML = `
        <div class="card-box" style="border: 2px solid #ccc; padding: 15px; border-radius: 10px; background: #fff; margin-top: 15px; text-align: left;">
            ${headerHTML}
            <div style="font-size: 24px;"><strong>${currentWord['漢字']}</strong> (${currentWord['假名拼音']})</div>
            <div style="color: #d9534f; font-weight: bold;">中文：${currentWord['中文意思']}</div>
            <div style="font-size: 14px; color: #777;">[${currentWord['詞性']}] | 重音：${currentWord['重音'] || '-'}</div>
            <hr>
            <div style="font-size: 15px; background: #f1f1f1; padding: 10px; border-radius: 8px;">
                <div class="sentence-row" onclick="playTTS('1')" style="cursor:pointer; margin-bottom:10px;">🔊 <strong>例句 1：</strong>${currentWord['常用例句 1日']}<br><small style="color:#666;">${currentWord['常用例句 1中']}</small></div>
                <div class="sentence-row" onclick="playTTS('2')" style="cursor:pointer;">🔊 <strong>例句 2：</strong>${currentWord['常用例句 2日']}<br><small style="color:#666;">${currentWord['常用例句 2中']}</small></div>
            </div>
        </div>
    `;
    if (!isManual) nextBtn.classList.remove('hidden');
}

async function checkAnswer() {
    const mode = aType.value;
    inputArea.classList.add('hidden');

    if (isBatchMode) {
        batchAnswers.push({
            word: currentWord,
            userC: chineseInput.value.trim(),
            userK: kanjiInput.value.trim()
        });
        currentBatchIdx++;
        
        if (currentBatchIdx < batchQuestions.length) {
            nextQuestion();
        } else {
            await processBatchResults(); 
        }
        return;
    }

    if (mode === 'flip' || mode === 'handwriting') {
        showFullCard(null);
    } else {
        let isCorrect = false;
        let userDisplay = "";
        if (mode === 'both') {
            const userK = kanjiInput.value.trim(); const userC = chineseInput.value.trim();
            userDisplay = `${userK} / ${userC}`;
            const kPoss = (currentWord['漢字'] || "").split('/').map(s => s.trim().toLowerCase());
            const cPoss = (currentWord['中文意思'] || "").split('/').map(s => s.trim().toLowerCase());
            isCorrect = kPoss.includes(userK.toLowerCase()) && cPoss.includes(userC.toLowerCase());
        } else {
            const userVal = (mode === '中文意思' ? chineseInput.value : kanjiInput.value).trim().toLowerCase();
            userDisplay = userVal;
            let correctRaw = (qType.value === 'sentence') ? currentWord[`常用例句 ${activeSentenceIdx}答案`] : currentWord[mode];
            isCorrect = (correctRaw || "").toLowerCase().split('/').map(s => s.trim()).some(p => userVal === p);
        }
        if (isCorrect) { currentWord.level++; syncToCloud("SUCCESS", currentWord); showFullCard(true); } 
        else { currentWord.errorCount++; currentWord.level = Math.max(0, currentWord.level - 1); currentWord.nextReviewDate = new Date().toISOString().split('T')[0]; syncToCloud("ERROR", currentWord); showFullCard(false, userDisplay); }
    }
}

async function processBatchResults() {
    document.getElementById('question-area').classList.add('hidden');
    inputArea.classList.add('hidden');
    feedback.innerHTML = `<h3 style="text-align:center; color:#007bff;">🤖 AI 批改中，請稍候...</h3>`;

    const apiKey = geminiApiKeyInput.value.trim();
    const promptData = batchAnswers.map((item, idx) => ({
        id: idx,
        日文單字: item.word['漢字'] || item.word['假名拼音'],
        標準答案: item.word['中文意思'],
        使用者輸入: item.userC
    }));

    const promptText = `
        你是一個嚴格但具備語意理解能力的日文老師。
        我會給你一個 JSON 陣列，裡面有 ${batchAnswers.length} 個物件。
        請判斷「使用者輸入」是否能作為「日文單字」的正確中文翻譯（需參考「標準答案」）。
        只要語意相符、是合理的同義詞即算正確。
        請回傳一個嚴格的 JSON 陣列（Array of Strings），順序與題目完全對應。
        正確回傳字串 "正確"，錯誤回傳字串 "錯誤"。
        不要回傳任何 Markdown 標記，只要純 JSON 陣列。
        題目資料：\n${JSON.stringify(promptData)}
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
            })
        });

        if (!response.ok) throw new Error("API 請求失敗");
        const resData = await response.json();
        
        let textContent = resData.candidates[0].content.parts[0].text;
        textContent = textContent.replace(/```json/gi, '').replace(/```/gi, '').trim();
        
        const aiResults = JSON.parse(textContent);
        renderBatchResults(aiResults);

    } catch (error) {
        console.error("AI 批改錯誤:", error);
        feedback.innerHTML = `<h3 style="color:red; text-align:center;">❌ AI 批改發生錯誤，請檢查 API Key 或網路狀態。</h3>`;
        batchResultsArea.classList.remove('hidden');
    }
}

function renderBatchResults(aiResults) {
    feedback.innerHTML = "";
    batchResultsArea.classList.remove('hidden');

    let html = `<div style="max-height: 60vh; overflow-y: auto; padding-right: 10px;">`;

    batchAnswers.forEach((item, idx) => {
        const aiResult = aiResults[idx] === "正確";
        let finalCorrect = aiResult;
        const mode = aType.value;

        let kanjiOk = true;
        if (mode === 'both') {
            const kPoss = (item.word['漢字'] || "").split('/').map(s => s.trim().toLowerCase());
            kanjiOk = kPoss.includes(item.userK.toLowerCase());
            finalCorrect = aiResult && kanjiOk;
        }

        if (finalCorrect) {
            item.word.level++;
            syncToCloud("SUCCESS", item.word); 
        } else {
            item.word.errorCount++;
            item.word.level = Math.max(0, item.word.level - 1);
            item.word.nextReviewDate = new Date().toISOString().split('T')[0];
            syncToCloud("ERROR", item.word);
        }

        const statusIcon = finalCorrect ? "✅" : "❌";
        const boxColor = finalCorrect ? '#c3e6cb' : '#f5c6cb';
        const aiTagStr = `<span style="color:${aiResult ? 'green' : 'red'}; font-weight:bold;">${aiResult ? 'AI 判定正確' : 'AI 判定錯誤'}</span>`;

        html += `
            <div class="card-box" style="border: 2px solid ${boxColor}; margin-bottom: 10px; padding: 12px;">
                <h4 style="margin: 0 0 8px 0; font-size: 18px;">${statusIcon} ${item.word['漢字']} (${item.word['假名拼音']})</h4>
                <p style="margin: 3px 0; font-size: 14px; color: #555;">標準答案: ${item.word['中文意思']}</p>
                <p style="margin: 3px 0; font-size: 14px; color: #007bff; font-weight: bold;">
                    你的輸入: ${item.userC} ${mode === 'both' ? ` (漢字: ${item.userK})` : ''}
                </p>
                <div style="margin-top: 5px; font-size: 13px; background: #f8f9fa; padding: 5px; border-radius: 4px;">
                    ${aiTagStr}
                </div>
            </div>
        `;
    });

    html += `</div>`;
    batchResultsContent.innerHTML = html;
}

batchFinishBtn.onclick = () => {
    stopAllAudio();
    quizSection.classList.add('hidden');
    batchResultsArea.classList.add('hidden'); 
    setupSection.classList.remove('hidden');
    startBtn.innerText = "開始測驗";
    refreshHomeStats();
};

homeBtn.onclick = () => { 
    stopAllAudio(); 
    quizSection.classList.add('hidden'); 
    batchResultsArea.classList.add('hidden'); 
    setupSection.classList.remove('hidden'); 
    startBtn.innerText = "開始測驗"; 
    refreshHomeStats(); 
};

// --- 8. 事件監聽 ---
function handleEnter(e) {
    const now = Date.now();
    if (now - lastEnterTime < ENTER_CD_MS) { e.preventDefault(); return; }
    lastEnterTime = now;
    if (!nextBtn.classList.contains('hidden')) { nextQuestion(); } 
    else if (feedback.innerHTML === "") {
        if (document.activeElement === kanjiInput && aType.value === 'both') { chineseInput.focus(); } 
        else { checkAnswer(); }
    }
}

[kanjiInput, chineseInput].forEach(el => {
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); handleEnter(e); }
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !quizSection.classList.contains('hidden')) {
        if (document.activeElement === kanjiInput || document.activeElement === chineseInput) return;
        e.preventDefault(); handleEnter(e);
    }
}, true); 

searchInput.addEventListener('input', renderVocabList);

// --- 9. 初始化與同步 ---
async function refreshHomeStats() {
    if (logToggle.checked) {
        try {
            const res = await fetch(PROGRESS_API_URL);
            if (res.ok) { const cloudData = await res.json(); renderErrorChart(cloudData); return cloudData; }
        } catch (e) { console.warn("同步失敗", e); }
    }
    return null;
}

window.manualResult = (isCorrect) => {
    if (isCorrect) { currentWord.level++; syncToCloud("SUCCESS", currentWord); nextQuestion(); }
    else {
        currentWord.errorCount++; currentWord.level = Math.max(0, currentWord.level - 1);
        currentWord.nextReviewDate = new Date().toISOString().split('T')[0]; syncToCloud("ERROR", currentWord);
        const ctrl = document.getElementById('manual-controls');
        if (ctrl) ctrl.innerHTML = `<h3 style="color:red; margin:0;">❌ 判定錯誤</h3>`;
        nextBtn.classList.remove('hidden');
    }
};

window.undo = () => {
    currentWord.errorCount--; currentWord.level += 2; syncToCloud("UNDO", currentWord);
    feedback.innerHTML = `<h3 style="color:blue;">✨ 已取消懲罰！</h3>` + (feedback.innerHTML.split('</button>')[1] || "");
};

function syncToCloud(op, wordObj) {
    if (!logToggle.checked) return;
    const targetWord = wordObj || currentWord;
    const wordId = (targetWord['漢字'] || '').trim() || (targetWord['假名拼音'] || '').trim();
    const data = { timestamp: new Date().toLocaleString(), wordId: wordId, errorCount: targetWord.errorCount, level: targetWord.level, status: op };
    fetch(PROGRESS_API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(data) });
}

// ⭐ 網頁載入時自動讀取 localStorage 中的 API Key
window.onload = () => {
    refreshHomeStats();
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) {
        geminiApiKeyInput.value = savedKey;
    }
};

startBtn.onclick = loadAndSyncData;
viewListBtn.onclick = showListView;
submitBtn.onclick = checkAnswer;
nextBtn.onclick = nextQuestion;
playAudioBtn.onclick = () => playFullSequence();
homeBtnList.onclick = () => { stopAllAudio(); listSection.classList.add('hidden'); setupSection.classList.remove('hidden'); };
mainCategoryFilter.onchange = updateSubCategories;
posFilter.onchange = renderVocabList;
resetDataBtn.onclick = () => { if (confirm("⚠️ 確定要重設進度嗎？")) { vocabData.forEach(w => { w.level = 0; w.errorCount = 0; w.nextReviewDate = ""; }); if (logToggle.checked) fetch(PROGRESS_API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ status: "RESET_ALL" }) }).then(() => location.reload()); } };

window.onclick = (event) => { 
    if (event.target == wordModal) {
        closeModal(); 
    }
};