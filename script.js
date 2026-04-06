// ==========================================
// ⭐ 全域參數設定區 (可在此統一修改抽題數)
// ==========================================
const AI_BATCH_SIZE = 5;  // AI 模式的抽題數
const HW_BATCH_SIZE = 10; // 手寫練習模式的抽題數

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

// ⭐ 延遲批改與【錯題特訓】變數
let hwChoices = {};           
let currentManualChoice = null; 
let sessionMistakes = new Set(); // 儲存錯題
let isMistakeMode = false;       // 是否處於錯題特訓模式

// 批次測驗變數
let isBatchMode = false;
let batchQuestions = [];
let batchAnswers = [];
let currentBatchIdx = 0;

// 手寫批次變數
let isHwBatchMode = false;
let hwQuestions = [];

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
    'audio': [ { val: '中文意思', text: '回答中文' }, { val: '漢字', text: '回答漢字' }, { val: 'both', text: '回答漢字+中文' }, { val: 'flip', text: '翻頁模式' }, { val: 'handwriting', text: '批次手寫練習' } ],
    '中文意思': [ { val: '假名拼音', text: '回答假名' }, { val: '漢字', text: '回答漢字' }, { val: 'flip', text: '翻頁模式' }, { val: 'handwriting', text: '批次手寫練習' } ],
    '漢字': [ { val: '假名拼音', text: '回答假名' }, { val: '中文意思', text: '回答中文' }, { val: 'flip', text: '翻頁模式' }, { val: 'handwriting', text: '批次手寫練習' } ],
    'sentence': [ { val: 'ans', text: '填空答題' } ]
};

qType.addEventListener('change', () => {
    const opts = modeMap[qType.value] || [];
    aType.innerHTML = opts.map(o => `<option value="${o.val}">${o.text}</option>`).join('');
    
    localStorage.setItem('savedQType', qType.value);
    
    const savedAType = localStorage.getItem('savedAType');
    if (savedAType && Array.from(aType.options).some(opt => opt.value === savedAType)) {
        aType.value = savedAType;
    } else {
        localStorage.setItem('savedAType', aType.value);
    }
});

aType.addEventListener('change', () => {
    localStorage.setItem('savedAType', aType.value);
});


// ⭐ 核心時間偏移函數：將時間倒退 8 小時
// 讓 00:00 ~ 07:59 的時間判定為「昨天」
function getStudyDate(dateInput) {
    let d = new Date(dateInput);
    if (isNaN(d.getTime())) return new Date(0); // 防止解析錯誤
    d.setHours(d.getHours() - 8);
    return d;
}

function isTestedToday(wordObj) {
    if (!wordObj.lastReview) return false;
    
    let lr = new Date(wordObj.lastReview);
    
    // 如果日期格式較舊無法解析，嘗試清理中文字串
    if (isNaN(lr.getTime())) {
        const cleanStr = wordObj.lastReview.toString().replace(/上午|下午/g, '').replace(/AM|PM/gi, '').trim();
        lr = new Date(cleanStr);
        if (isNaN(lr.getTime())) return false; // 仍解析失敗則放棄
    }
    
    // 使用專屬的「學習日」來做比較 (扣除 8 小時)
    const lrStudyDate = getStudyDate(lr);
    const todayStudyDate = getStudyDate(new Date());
    
    return lrStudyDate.getFullYear() === todayStudyDate.getFullYear() &&
           lrStudyDate.getMonth() === todayStudyDate.getMonth() &&
           lrStudyDate.getDate() === todayStudyDate.getDate();
}

async function loadVocabCSV() {
    return new Promise((resolve) => {
        Papa.parse("vocab.csv", {
            download: true, header: true,
            complete: (results) => {
                vocabData = results.data.filter(row => row['中文意思'] && (row['漢字'] || row['假名拼音']))
                    .map(item => ({ ...item, errorCount: 0, level: 0, nextReviewDate: "", lastReview: "" }));
                resolve();
            }
        });
    });
}

// 核心同步模組：包含載入歷史錯題
async function ensureDataLoaded(btnElement) {
    if (vocabData.length > 0) return; 
    
    const originalText = btnElement.innerText;
    btnElement.innerText = "同步數據中...";
    
    await loadVocabCSV();
    const cloudData = await refreshHomeStats();
    
    sessionMistakes.clear(); // 載入前清空錯題暫存
    
    if (cloudData) {
        const map = new Map(cloudData.map(p => [p.wordId, p]));
        vocabData.forEach(w => {
            const id = (w['漢字'] || '').trim() || (w['假名拼音'] || '').trim();
            const p = map.get(id);
            if (p) { 
                w.errorCount = parseInt(p.errorCount) || 0; 
                w.level = parseInt(p.level) || 0; 
                w.nextReviewDate = p.nextReviewDate || ""; 
                w.lastReview = p.lastReview || ""; 
                
                // ⭐ 將雲端的歷史錯題 (Level=0且錯過) 自動載入「錯題特訓」中
                if (w.level === 0 && w.errorCount > 0) {
                    sessionMistakes.add(w);
                }
            }
        });
    }
    updateMistakeBtn(); // 更新錯題按鈕顯示
    btnElement.innerText = originalText;
}

async function loadAndSyncData() {
    await ensureDataLoaded(startBtn);
    startQuiz();
}

// ⭐ 動態更新首頁的「錯題特訓」按鈕
function updateMistakeBtn() {
    let btn = document.getElementById('mistake-btn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'mistake-btn';
        btn.className = 'primary-btn'; 
        btn.style.marginTop = '10px';
        btn.style.backgroundColor = '#ff4d4f';
        btn.style.color = 'white';
        btn.style.fontWeight = 'bold';
        btn.onclick = () => {
            isMistakeMode = true;
            startQuiz();
        };
        document.getElementById('setup-section').appendChild(btn);
    }
    if (sessionMistakes.size > 0) {
        btn.innerHTML = `🔥 錯題特訓 (${sessionMistakes.size} 題待消滅)`;
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}

// ⭐ 絕對精準的數據條 (以 8:00 AM 為日界線，從雲端紀錄掃描)
function updateStatsBar() {
    let bar = document.getElementById('quiz-stats-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'quiz-stats-bar';
        bar.style = 'display:flex; justify-content:space-between; font-size:13px; color:#555; margin-bottom:15px; background:#e9ecef; padding:10px 15px; border-radius:10px; font-weight:bold; box-shadow: 0 2px 4px rgba(0,0,0,0.05);';
        const quizArea = document.getElementById('quiz-section');
        const headerRow = quizArea.querySelector('.header-row');
        headerRow.parentNode.insertBefore(bar, headerRow.nextSibling); 
    }
    
    const todayStudy = getStudyDate(new Date());
    todayStudy.setHours(0,0,0,0); // 歸零進行純日期比較
    
    // 動態掃描：真的在今天考過的數量
    let testedTodayCount = vocabData.filter(w => isTestedToday(w)).length;
    
    // 動態掃描：扣除今天考過的，剩下應該今天要背的
    let pendingCount = vocabData.filter(w => {
        if (isTestedToday(w)) return false; 
        if (!w.nextReviewDate) return true; // 新單字
        const nd = new Date(w.nextReviewDate);
        nd.setHours(0,0,0,0);
        return nd <= todayStudy;
    }).length;
    
    let modeText = isMistakeMode ? `<span style="color:#ff4d4f;">🔥 錯題特訓中</span>` : `<span>📚 總單字: ${vocabData.length}</span>`;
    bar.innerHTML = `${modeText} <span style="color:#d9534f;">⏳ 待測驗: ${pendingCount}</span> <span style="color:#28a745;">🎯 已測驗: ${testedTodayCount}</span>`;
}

// --- 5. 單字列表渲染 ---
async function showListView() {
    await ensureDataLoaded(viewListBtn); 
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

        const lvLevel = w.nextReviewDate ? parseInt(w.level) : -1;
        let lvText = '未測';
        let lvBg = '#f8f9fa';
        let lvColor = '#6c757d';

        if (lvLevel === 0) { lvBg = '#f8d7da'; lvColor = '#721c24'; lvText = 'Lv.0'; }
        else if (lvLevel === 1) { lvBg = '#fff3cd'; lvColor = '#856404'; lvText = 'Lv.1'; }
        else if (lvLevel === 2) { lvBg = '#cce5ff'; lvColor = '#004085'; lvText = 'Lv.2'; }
        else if (lvLevel === 3) { lvBg = '#d4edda'; lvColor = '#155724'; lvText = 'Lv.3'; }
        else if (lvLevel === 4) { lvBg = '#e2d9f3'; lvColor = '#4a148c'; lvText = 'Lv.4'; }
        else if (lvLevel === 5) { lvBg = '#fce4ec'; lvColor = '#ad1457'; lvText = 'Lv.5'; }
        else if (lvLevel === 6) { lvBg = '#e0f2f1'; lvColor = '#006064'; lvText = 'Lv.6'; }
        else if (lvLevel >= 7) { lvBg = '#343a40'; lvColor = '#ffd700'; lvText = `Lv.${lvLevel}`; }

        item.innerHTML = `
            <div style="width: 45px; display: flex; flex-direction: column; align-items: flex-start; justify-content: center;">
                <div style="font-size: 10px; color: #999; font-family: monospace; margin-bottom: 4px;">#${w['單字編號'] || (index + 1)}</div>
                <div style="font-size: 9px; color: ${lvColor}; background: ${lvBg}; border-radius: 4px; padding: 2px 5px; font-weight: bold;">${lvText}</div>
            </div>
            <div style="flex: 1.5; text-align: left; padding-left: 5px; min-width: 0;">
                <div style="font-size:16px; font-weight:bold; color:#2c3e50; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${w['漢字']}</div>
                <div style="font-size:11px; color:#666;">${displayKana} <span style="color:#007bff; font-weight:bold; margin-left:3px;">${displayAccent}</span></div>
            </div>
            <div style="flex: 0.9; text-align: center;">
                <div style="color: #6c757d; font-size: 10px; background: #f8f9fa; border-radius: 4px; margin: 0 5px; padding: 2px 0;">${w['詞性']}</div>
            </div>
            <div style="flex: 1.2; color:#d9534f; font-weight:bold; font-size:14px; text-align:left; padding-left: 5px;">${w['中文意思']}</div>
            <div style="width: 35px; text-align: right;">
                <button onclick="event.stopPropagation(); playListAudio(${index})" style="background:none; border:none; font-size:18px; color:#007bff; cursor:pointer;">🔊</button>
            </div>
        `;
        vocabListContainer.appendChild(item);
    });
}

// ⭐ 單字詳細卡片 (彈出視窗)
window.showWordDetail = (index) => {
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
};

window.closeModal = () => { wordModal.classList.add('hidden'); };

function closeListView() { listSection.classList.add('hidden'); setupSection.classList.remove('hidden'); }

function playListAudio(index) {
   const w = vocabData[index];
   const baseName = getBaseName(w);
   const audioUrl = `./audio/${encodeURIComponent(baseName)}.wav`;
   const player = new Audio(audioUrl);
   player.play().catch(() => { console.warn(`音檔不存在: ${audioUrl}`); });
}

function processManualChoice() {
    if (currentManualChoice !== null) {
        if (currentManualChoice) {
            currentWord.level++;
            updateLocalNextReviewDate(currentWord, "SUCCESS");
            syncToCloud("SUCCESS", currentWord);
        } else {
            currentWord.errorCount++;
            currentWord.level = Math.max(0, currentWord.level - 1);
            updateLocalNextReviewDate(currentWord, "ERROR");
            syncToCloud("ERROR", currentWord);
        }
        currentManualChoice = null; 
    }
}

function processHwChoices() {
    Object.keys(hwChoices).forEach(idxStr => {
        const idx = parseInt(idxStr);
        const w = hwQuestions[idx];
        const isCorrect = hwChoices[idx];
        if (isCorrect) {
            w.level++;
            updateLocalNextReviewDate(w, "SUCCESS");
            syncToCloud("SUCCESS", w);
        } else {
            w.errorCount++;
            w.level = Math.max(0, w.level - 1);
            updateLocalNextReviewDate(w, "ERROR");
            syncToCloud("ERROR", w);
        }
    });
    hwChoices = {}; 
}

// --- 6. 測驗管理流程 ---
function startQuiz() { 
    processManualChoice(); 
    processHwChoices();

    batchResultsContent.innerHTML = "";
    feedback.innerHTML = "";
    hwChoices = {}; 
    currentManualChoice = null;

    updateStatsBar(); 

    let dueWords = [];

    // ⭐ 如果是錯題特訓模式，無腦抓出錯題清單考到底
    if (isMistakeMode) {
        dueWords = Array.from(sessionMistakes);
        if (dueWords.length === 0) {
            alert("✅ 錯題已全數消滅！太棒了！");
            isMistakeMode = false;
            updateMistakeBtn();
            homeBtn.click();
            return;
        }
    } else {
        const todayStudy = getStudyDate(new Date()); 
        todayStudy.setHours(0, 0, 0, 0); // 8點基準歸零
        
        dueWords = vocabData.filter(w => {
            if (isTestedToday(w)) return false; // 扣除今天已測的
            
            if (!w.nextReviewDate) return true;
            const nextDate = new Date(w.nextReviewDate);
            nextDate.setHours(0, 0, 0, 0);
            return nextDate <= todayStudy;
        });
    }

    dueWords.sort(() => Math.random() - 0.5); 

    // --- AI 模式 ---
    if (aiToggle.checked) {
        const apiKey = geminiApiKeyInput.value.trim();
        if (!apiKey) { 
            alert("請先輸入 Gemini API Key！"); 
            startBtn.innerText = "開始測驗"; 
            return; 
        }
        localStorage.setItem('geminiApiKey', apiKey); 

        const mode = aType.value;
        if (mode !== '中文意思' && mode !== 'both') { 
            alert("AI 批改模式僅支援答題包含「中文意思」的模式！"); 
            startBtn.innerText = "開始測驗"; 
            return; 
        }
        
        isBatchMode = true;
        isHwBatchMode = false;
        batchAnswers = []; 
        currentBatchIdx = 0;

        batchQuestions = dueWords.slice(0, Math.min(AI_BATCH_SIZE, dueWords.length)); 
        if (batchQuestions.length === 0) { 
            alert("🎉 今日任務已完成！"); 
            startBtn.innerText = "開始測驗"; 
            return; 
        }
    } 
    // --- 批次手寫練習模式 ---
    else if (aType.value === 'handwriting') {
        isHwBatchMode = true;
        isBatchMode = false;
        hwQuestions = dueWords.slice(0, Math.min(HW_BATCH_SIZE, dueWords.length));
        
        if (hwQuestions.length === 0) { 
            alert("🎉 今日任務已完成！"); 
            startBtn.innerText = "開始測驗"; 
            return; 
        }

        setupSection.classList.add('hidden'); 
        batchResultsArea.classList.add('hidden');
        quizSection.classList.remove('hidden'); 
        
        renderHwBatch(); 
        return; 
    } 
    // --- 常規模式 ---
    else {
        isBatchMode = false;
        isHwBatchMode = false;
        
        if (dueWords.length === 0) {
            alert("🎉 今日任務已完成！");
            startBtn.innerText = "開始測驗"; 
            return;
        }
    }

    setupSection.classList.add('hidden'); 
    batchResultsArea.classList.add('hidden');
    document.getElementById('question-area').classList.remove('hidden');
    quizSection.classList.remove('hidden'); 
    nextQuestion(); 
}

function getNextWord() {
    if (isBatchMode) {
        if (currentBatchIdx >= batchQuestions.length) return null;
        return batchQuestions[currentBatchIdx];
    }

    let dueWords = [];
    if (isMistakeMode) {
        dueWords = Array.from(sessionMistakes);
        if (dueWords.length === 0) {
            alert("✅ 錯題已全數消滅！太棒了！");
            isMistakeMode = false;
            updateMistakeBtn();
            homeBtn.click();
            return null;
        }
    } else {
        const todayStudy = getStudyDate(new Date()); 
        todayStudy.setHours(0, 0, 0, 0);
        
        dueWords = vocabData.filter(w => {
            if (isTestedToday(w)) return false; 
            if (!w.nextReviewDate) return true;
            const nextDate = new Date(w.nextReviewDate);
            nextDate.setHours(0, 0, 0, 0);
            return nextDate <= todayStudy;
        });
        if (dueWords.length === 0) { 
            alert("🎉 今日任務已完成！"); 
            homeBtn.click(); 
            return null; 
        }
    }

    if (srsToggle.checked && !isMistakeMode) {
        let lowLevel = dueWords.filter(w => w.level < 3);
        if (lowLevel.length > 0 && Math.random() < 0.8) return lowLevel[Math.floor(Math.random() * lowLevel.length)];
    }
    return dueWords[Math.floor(Math.random() * dueWords.length)];
}


window.playBatchAudio = (idx, type = 'word') => {
    const w = hwQuestions[idx];
    const baseName = getBaseName(w);
    const audioUrl = `./audio/${encodeURIComponent(baseName)}${type==='word'?'':`_${type}`}.wav`;
    const player = new Audio(audioUrl);
    player.play().catch(() => { console.warn(`音檔不存在: ${audioUrl}`); });
};

function renderHwBatch() {
    stopAllAudio();
    updateStatsBar(); 
    document.getElementById('question-area').classList.add('hidden');
    document.getElementById('input-area').classList.add('hidden');
    document.getElementById('canvas-area').classList.add('hidden'); 
    document.getElementById('flashcard-area').classList.add('hidden');
    nextBtn.classList.add('hidden');

    let modeTitle = isMistakeMode ? `<span style="color:#ff4d4f;">🔥 錯題手寫特訓 (${hwQuestions.length} 題)</span>` : `✍️ 手寫練習 (${hwQuestions.length} 題)`;

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h2 style="margin:0; color:#2c3e50;">${modeTitle}</h2>
            <button onclick="flipAllHwCards()" class="secondary-btn" style="background:#007bff; color:white; padding:8px 15px;">全部翻開</button>
        </div>
        <p style="text-align:left; font-size:13px; color:#666; margin-bottom:15px;">請在筆記本上依序寫下答案，完成後點擊翻開對答案。</p>
        <div id="hw-batch-list" style="display:flex; flex-direction:column; gap:15px;">
    `;

    hwQuestions.forEach((w, idx) => {
        let qText = "";
        
        if (qType.value === 'audio') {
            let audioBtns = `<button onclick="playBatchAudio(${idx}, 'word')" class="secondary-btn" style="padding:6px 12px; margin-right:5px; margin-bottom:5px;">🔊 聽單字</button>`;
            if (w['常用例句 1日']) {
                audioBtns += `<button onclick="playBatchAudio(${idx}, '1')" class="secondary-btn" style="padding:6px 12px; margin-right:5px; margin-bottom:5px;">🔊 聽例句 1</button>`;
            }
            if (w['常用例句 2日']) {
                audioBtns += `<button onclick="playBatchAudio(${idx}, '2')" class="secondary-btn" style="padding:6px 12px; margin-right:5px; margin-bottom:5px;">🔊 聽例句 2</button>`;
            }
            qText = `<div style="display:inline-block;">${audioBtns}</div> <span style="color:#e67e22; font-size:14px; font-weight:normal;">[${w['詞性']}]</span>`;
        } 
        else if (qType.value === '中文意思') {
            qText = `${w['中文意思']} <span style="color:#e67e22; font-size:14px; font-weight:normal;">[${w['詞性']}]</span>`;
        } else if (qType.value === 'sentence') {
            const sIdx = (Math.random() < 0.5 && w['常用例句 2題目']) ? 2 : 1;
            qText = `<div style="font-size:14px; color:#666; font-weight:normal;">${w[`常用例句 ${sIdx}中`]}</div><div>${w[`常用例句 ${sIdx}題目`]}</div>`;
        } else {
            qText = w[qType.value] || "未知題目";
        }

        const wordIdx = vocabData.indexOf(w);
        const displayKana = w['假名拼音(分別)'] || w['假名拼音'] || ""; // ⭐ 修正為分別

        html += `
            <div class="card-box" id="hw-card-${idx}" style="padding:15px; border-left:5px solid #007bff; margin-top:0;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:18px; font-weight:bold; flex:1; text-align:left;">
                        <span style="color:#95a5a6; margin-right:5px;">Q${idx + 1}.</span> ${qText}
                    </div>
                    <button id="hw-flip-btn-${idx}" onclick="flipHwCard(${idx})" class="secondary-btn" style="white-space:nowrap; align-self:flex-start;">翻開</button>
                </div>
                
                <div id="hw-ans-${idx}" class="hidden" style="margin-top:15px; padding-top:15px; border-top:1px dashed #ccc; text-align:left;">
                    <div style="font-size: 22px;"><strong>${w['漢字']}</strong> (${displayKana})</div>
                    <div style="color: #d9534f; font-weight: bold;">中文：${w['中文意思']}</div>
                    
                    <button onclick="showWordDetail(${wordIdx})" class="secondary-btn" style="margin-bottom:10px; width:auto; padding:4px 8px; font-size:12px; color:#007bff; background:#e9ecef;">🔍 展開單字卡</button>
                    
                    <div style="display:flex; gap:10px;" id="hw-ctrl-${idx}">
                        <button id="hw-btn-true-${idx}" onclick="gradeHwCard(${idx}, true)" class="hw-grade-btn" style="background:#e8f5e9; color:#28a745; border: 2px solid #28a745; flex:1; padding:10px; border-radius:8px; font-weight:bold; transition:all 0.2s;">✅ 我寫對了</button>
                        <button id="hw-btn-false-${idx}" onclick="gradeHwCard(${idx}, false)" class="hw-grade-btn" style="background:#fdeeed; color:#dc3545; border: 2px solid #dc3545; flex:1; padding:10px; border-radius:8px; font-weight:bold; transition:all 0.2s;">❌ 我寫錯了</button>
                    </div>
                </div>
            </div>
        `;
    });

    html += `</div>
    <div id="hw-finish-area" class="hidden" style="margin-top:20px; display:flex; gap:10px;">
        <button id="hw-home-btn" class="secondary-btn" onclick="finishHwBatch()" style="flex:1;">🏠 回首頁</button>
        <button id="hw-next-btn" class="primary-btn" onclick="nextHwBatch()" style="flex:1; background:#28a745; margin-top:0;">➡️ 下一批</button>
    </div>
    `;
    feedback.innerHTML = html;
}

window.flipHwCard = (idx) => {
    document.getElementById(`hw-ans-${idx}`).classList.remove('hidden');
    document.getElementById(`hw-flip-btn-${idx}`).classList.add('hidden');
};

window.flipAllHwCards = () => {
    hwQuestions.forEach((_, idx) => flipHwCard(idx));
};

window.gradeHwCard = (idx, isCorrect) => {
    hwChoices[idx] = isCorrect;
    
    const btnTrue = document.getElementById(`hw-btn-true-${idx}`);
    const btnFalse = document.getElementById(`hw-btn-false-${idx}`);
    
    if (isCorrect) {
        btnTrue.style.background = '#28a745';
        btnTrue.style.color = 'white';
        btnFalse.style.background = '#fdeeed';
        btnFalse.style.color = '#dc3545';
    } else {
        btnFalse.style.background = '#dc3545';
        btnFalse.style.color = 'white';
        btnTrue.style.background = '#e8f5e9';
        btnTrue.style.color = '#28a745';
    }
    
    if (Object.keys(hwChoices).length >= hwQuestions.length) {
        document.getElementById('hw-finish-area').classList.remove('hidden');
    }
};

window.finishHwBatch = () => {
    processHwChoices();
    homeBtn.click(); 
};

window.nextHwBatch = () => {
    processHwChoices();
    startQuiz(); 
};


function nextQuestion() {
    processManualChoice(); 
    stopAllAudio();
    updateStatsBar(); 
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
            // 已攔截
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
        } 
        else if (qType.value === '中文意思') {
            questionDisplay.innerHTML = `${currentWord[qType.value]} <span style="font-size:18px; color:#e67e22;">[${currentWord['詞性']}]</span>`;
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

window.manualResultUI = (isCorrect) => {
    currentManualChoice = isCorrect;
    const btnTrue = document.getElementById('manual-btn-true');
    const btnFalse = document.getElementById('manual-btn-false');
    
    if (isCorrect) {
        btnTrue.style.background = '#28a745';
        btnTrue.style.color = 'white';
        btnFalse.style.background = '#fdeeed';
        btnFalse.style.color = '#dc3545';
    } else {
        btnFalse.style.background = '#dc3545';
        btnFalse.style.color = 'white';
        btnTrue.style.background = '#e8f5e9';
        btnTrue.style.color = '#28a745';
    }
    
    nextBtn.classList.remove('hidden'); 
};

function showFullCard(isCorrect, userAnswer = "") {
    const isManual = (aType.value === 'flip');
    const trackingDisabled = !srsToggle.checked && !logToggle.checked; 

    let headerHTML = "";

    if (isManual) {
        if (trackingDisabled) {
            headerHTML = `<h3 style="color:#007bff; margin-bottom:15px;">💡 單字解答</h3>`;
        } else {
            headerHTML = `
                <div id="manual-controls" style="margin-bottom:15px; background:#fff3cd; padding:12px; border-radius:10px; border:1px solid #ffeeba;">
                    <p style="font-weight:bold; margin-bottom:10px; color:#856404;">請判定您的回答：</p>
                    <div style="display:flex; gap:10px;">
                        <button id="manual-btn-true" onclick="manualResultUI(true)" style="background:#e8f5e9; color:#28a745; border: 2px solid #28a745; flex:1; padding:12px; border-radius:8px; font-weight:bold; transition:all 0.2s;">✅ 我對了</button>
                        <button id="manual-btn-false" onclick="manualResultUI(false)" style="background:#fdeeed; color:#dc3545; border: 2px solid #dc3545; flex:1; padding:12px; border-radius:8px; font-weight:bold; transition:all 0.2s;">❌ 我錯了</button>
                    </div>
                </div>`;
        }
    } else {
        headerHTML = isCorrect ? `<h3 style="color:green;">✅ 正確！</h3>` : `<h3 style="color:red;">❌ 答錯了！</h3><p><small>您的輸入：${userAnswer}</small></p><button onclick="undo()" id="undo-btn">🔧 手誤取消懲罰</button>`;
    }

    const wordIdx = vocabData.indexOf(currentWord);
    const displayKana = currentWord['假名拼音(分別)'] || currentWord['假名拼音'] || ""; // ⭐ 修正為分別

    feedback.innerHTML = `
        <div class="card-box" style="border: 2px solid #ccc; padding: 15px; border-radius: 10px; background: #fff; margin-top: 15px; text-align: left;">
            ${headerHTML}
            <div style="font-size: 24px;"><strong>${currentWord['漢字']}</strong> (${displayKana})</div>
            <div style="color: #d9534f; font-weight: bold;">中文：${currentWord['中文意思']}</div>
            <div style="font-size: 14px; color: #777;">[${currentWord['詞性']}] | 重音：${currentWord['重音'] || '-'}</div>
            
            <button onclick="showWordDetail(${wordIdx})" class="secondary-btn" style="margin-top:10px; width:auto; padding:6px 12px; font-size:12px; font-weight:bold; color:#007bff; background:#e9ecef; border-radius:8px;">🔍 開啟詳細單字卡</button>
            <hr>
            <div style="font-size: 15px; background: #f1f1f1; padding: 10px; border-radius: 8px;">
                <div class="sentence-row" onclick="playTTS('1')" style="cursor:pointer; margin-bottom:10px;">🔊 <strong>例句 1：</strong>${currentWord['常用例句 1日']}<br><small style="color:#666;">${currentWord['常用例句 1中']}</small></div>
                <div class="sentence-row" onclick="playTTS('2')" style="cursor:pointer;">🔊 <strong>例句 2：</strong>${currentWord['常用例句 2日']}<br><small style="color:#666;">${currentWord['常用例句 2中']}</small></div>
            </div>
        </div>
    `;
    
    if (!isManual || trackingDisabled) {
        nextBtn.classList.remove('hidden');
    }
}

function updateLocalNextReviewDate(wordObj, status) {
    const intervals = [0, 1, 2, 4, 7, 15, 30, 60, 90];
    let daysToAdd = 0;
    
    if (status === "SUCCESS" || status === "UNDO") {
        daysToAdd = intervals[wordObj.level] || 90;
    } 
    
    let nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + daysToAdd);
    
    const yyyy = nextDate.getFullYear();
    const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
    const dd = String(nextDate.getDate()).padStart(2, '0');
    wordObj.nextReviewDate = `${yyyy}/${mm}/${dd}`;
    wordObj.lastReview = new Date().toISOString(); 
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

    if (mode === 'flip') {
        showFullCard(null);
    } else {
        let isCorrect = false;
        let userDisplay = "";
        let userVal = ""; 

        if (mode === 'both') {
            const userK = kanjiInput.value.trim(); const userC = chineseInput.value.trim();
            userDisplay = `${userK} / ${userC}`;
            const kPoss = (currentWord['漢字'] || "").split('/').map(s => s.trim().toLowerCase());
            const cPoss = (currentWord['中文意思'] || "").split('/').map(s => s.trim().toLowerCase());
            isCorrect = kPoss.includes(userK.toLowerCase()) && cPoss.includes(userC.toLowerCase());
        } else {
            if (mode === 'ans' || mode === '中文意思' || qType.value === 'sentence') {
                userVal = chineseInput.value.trim();
            } else {
                userVal = kanjiInput.value.trim();
            }
            
            userDisplay = userVal;
            let correctRaw = (qType.value === 'sentence') ? currentWord[`常用例句 ${activeSentenceIdx}答案`] : currentWord[mode];
            isCorrect = (correctRaw || "").toLowerCase().split('/').map(s => s.trim()).some(p => userVal.toLowerCase() === p);
        }

        if (isCorrect) { 
            currentWord.level++; 
            updateLocalNextReviewDate(currentWord, "SUCCESS");
            syncToCloud("SUCCESS", currentWord); 
            showFullCard(true); 
        } else { 
            currentWord.errorCount++; 
            currentWord.level = Math.max(0, currentWord.level - 1); 
            updateLocalNextReviewDate(currentWord, "ERROR");
            syncToCloud("ERROR", currentWord); 
            showFullCard(false, userDisplay); 
        }
    }
}

window.processBatchResults = async () => {
    document.getElementById('question-area').classList.add('hidden');
    inputArea.classList.add('hidden');
    
    batchResultsContent.innerHTML = "";
    feedback.innerHTML = `<h3 style="text-align:center; color:#007bff;">🤖 AI 批改中，請稍候...</h3>`;
    batchResultsArea.classList.remove('hidden');

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
        請只回傳陣列本身，不要包含任何 markdown 標記，也不要加上任何解釋文字。
        題目資料：\n${JSON.stringify(promptData)}
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            })
        });

        if (!response.ok) throw new Error("API 請求失敗，可能為網路問題或配額限制。");
        const resData = await response.json();
        
        if (!resData.candidates || !resData.candidates[0].content) {
            throw new Error("AI 未回傳內容（可能被系統阻擋）。");
        }

        let textContent = resData.candidates[0].content.parts[0].text;
        textContent = textContent.replace(/```json/gi, '').replace(/```/gi, '').trim();
        
        const aiResults = JSON.parse(textContent);
        renderBatchResults(aiResults);

    } catch (error) {
        console.error("AI 批改錯誤:", error);
        feedback.innerHTML = "";
        
        batchResultsContent.innerHTML = `
            <div style="text-align:center; padding: 20px 0;">
                <h3 style="color:#d9534f; margin-bottom:10px;">❌ AI 批改發生錯誤</h3>
                <p style="color:#666; font-size:14px; margin-bottom:20px;">錯誤原因：${error.message}</p>
                <button onclick="processBatchResults()" class="primary-btn" style="background:#f39c12; margin-bottom:10px;">🔄 網路異常？重新送出批改</button>
                <button onclick="homeBtn.click()" class="secondary-btn" style="width:100%;">🏠 放棄並回首頁</button>
            </div>
        `;
    }
};

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
            updateLocalNextReviewDate(item.word, "SUCCESS");
            syncToCloud("SUCCESS", item.word); 
        } else {
            item.word.errorCount++;
            item.word.level = Math.max(0, item.word.level - 1);
            updateLocalNextReviewDate(item.word, "ERROR");
            syncToCloud("ERROR", item.word);
        }

        const statusIcon = finalCorrect ? "✅" : "❌";
        const boxColor = finalCorrect ? '#c3e6cb' : '#f5c6cb';
        const aiTagStr = `<span style="color:${aiResult ? 'green' : 'red'}; font-weight:bold;">${aiResult ? 'AI 判定正確' : 'AI 判定錯誤'}</span>`;

        const wordIndex = vocabData.indexOf(item.word);
        const displayKana = item.word['假名拼音(分別)'] || item.word['假名拼音'] || ""; // ⭐ 修正為分別

        html += `
            <div class="card-box" onclick="showWordDetail(${wordIndex})" style="border: 2px solid ${boxColor}; margin-bottom: 10px; padding: 12px; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                <h4 style="margin: 0 0 8px 0; font-size: 18px;">${statusIcon} ${item.word['漢字']} (${displayKana})</h4>
                <p style="margin: 3px 0; font-size: 14px; color: #555;">標準答案: ${item.word['中文意思']}</p>
                <p style="margin: 3px 0; font-size: 14px; color: #007bff; font-weight: bold;">
                    你的輸入: ${item.userC} ${mode === 'both' ? ` (漢字: ${item.userK})` : ''}
                </p>
                <div style="margin-top: 5px; font-size: 13px; background: #f8f9fa; padding: 5px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                    ${aiTagStr}
                    <span style="color: #888; font-size: 11px;">🔍 點擊查看單字卡</span>
                </div>
            </div>
        `;
    });

    html += `</div>
    <div style="margin-top:20px; display:flex; gap:10px;">
        <button onclick="document.getElementById('batch-finish-btn').click()" class="secondary-btn" style="flex:1;">🏠 回首頁</button>
        <button onclick="startQuiz()" class="primary-btn" style="flex:1; background:#28a745; margin-top:0;">➡️ 下一批</button>
    </div>`;
    batchResultsContent.innerHTML = html;
    
    document.getElementById('batch-finish-btn').classList.add('hidden');
}

batchFinishBtn.onclick = () => {
    isMistakeMode = false;
    updateMistakeBtn();
    stopAllAudio();
    quizSection.classList.add('hidden');
    batchResultsArea.classList.add('hidden'); 
    setupSection.classList.remove('hidden');
    startBtn.innerText = "開始測驗";
    refreshHomeStats();
};

homeBtn.onclick = () => { 
    processManualChoice();
    processHwChoices();
    isMistakeMode = false;
    updateMistakeBtn();
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
    else if (feedback.innerHTML === "" && !isHwBatchMode) {
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

window.undo = () => {
    currentWord.errorCount--; 
    currentWord.level += 2; 
    updateLocalNextReviewDate(currentWord, "UNDO");
    syncToCloud("UNDO", currentWord);
    feedback.innerHTML = `<h3 style="color:blue;">✨ 已取消懲罰！</h3>` + (feedback.innerHTML.split('</button>')[1] || "");
};

function syncToCloud(op, wordObj) {
    const targetWord = wordObj || currentWord;
    
    // ⭐ 更新錯題本：答錯自動加入，答對/撤銷自動移除
    if (op === "SUCCESS" || op === "UNDO") {
        sessionMistakes.delete(targetWord);
    } else if (op === "ERROR") {
        sessionMistakes.add(targetWord);
    }
    updateMistakeBtn(); // 即時更新首頁的特訓按鈕狀態

    if (op === "SUCCESS" || op === "ERROR") {
        updateStatsBar();
    }
    
    if (!logToggle.checked) return;
    const wordId = (targetWord['漢字'] || '').trim() || (targetWord['假名拼音'] || '').trim();
    const data = { timestamp: new Date().toISOString(), wordId: wordId, errorCount: targetWord.errorCount, level: targetWord.level, status: op };
    fetch(PROGRESS_API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(data) });
}

window.onload = () => {
    refreshHomeStats();
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) {
        geminiApiKeyInput.value = savedKey;
    }

    const aiWarning = document.querySelector('#ai-settings p');
    if (aiWarning) {
        aiWarning.innerHTML = `⚠️ 啟用後將強制進行 ${AI_BATCH_SIZE} 題測驗，結束後統一交由 AI 對答案。`;
    }

    const savedQType = localStorage.getItem('savedQType');
    if (savedQType) {
        qType.value = savedQType;
    }
    qType.dispatchEvent(new Event('change'));
};

startBtn.onclick = () => {
    isMistakeMode = false; // 正常測驗模式
    loadAndSyncData();
};
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