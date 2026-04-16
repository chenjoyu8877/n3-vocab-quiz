// ==========================================
// ⭐ 1. 全域參數與 API 設定區 (請在此替換你的 Google Sheet API)
// ==========================================
const PROGRESS_API_URL = "https://script.google.com/macros/s/AKfycby0LtDXQCqNxWYw43ENQZ3fvAKzEKXa89JbcfXYMte-0iL4h4UFzs6lZKMm1modsS6skw/exec"; 

let DAILY_LIMIT = 30;     
const AI_BATCH_SIZE = 10; 
const HW_BATCH_SIZE = 10; 

// ==========================================
// --- DOM 元素宣告 ---
// ==========================================
const qType = document.getElementById('qType');
const aTypeContainer = document.getElementById('aType-container');
const srsToggle = document.getElementById('srs-toggle');

const startBtn = document.getElementById('start-btn');
const startNewWordsBtn = document.getElementById('start-new-words-btn'); 
const startFreqBtn = document.getElementById('start-frequent-mistakes-btn');
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
const kanaInput = document.getElementById('kana-input');
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

// --- 全域變數與核心邏輯 ---
const globalAudioPlayer = new Audio();
let vocabData = [];
let currentWord = {};
let errorChartInstance = null; 
let activeSentenceIdx = 1; 

let lastEnterTime = 0;
const ENTER_CD_MS = 600; 
let audioSequenceId = 0; 

// ⭐ 雲端同步無痕與新舊單字變數
let dailyNewWords = [];     
let dueOldWords = [];       
let dailyPool = [];         
let currentFullPool = [];   
let roundPending = [];      
let hwChoices = {};           
let currentManualChoice = null; 
let sessionMistakes = new Set(); 
let lastSyncStudyDate = null; // 🚀 新增：紀錄最後同步的「學習日」，用來防卡頓

let isMistakeMode = false;       
let isFrequentMistakeMode = false; 
let isNewWordMode = false;

let isBatchMode = false;
let batchQuestions = [];
let batchAnswers = [];
let currentBatchIdx = 0;
let isHwBatchMode = false;
let hwQuestions = [];

let currentActiveQType = "";
let currentActiveATypes = [];

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

function renderATypeOptions() {
    let html = `<label class="chk-label hw-label"><input type="checkbox" id="hw-checkbox"> ✍️ 批次手寫模式</label><hr style="margin:10px 0; border:0; border-top:1px dashed #ccc;">`;
    const val = qType.value;

    if (val === 'mixed') {
        html += `<div class="checkbox-group-title">請勾選要混合的題型 (至少兩項)：</div>`;
        ['audio:聽力', '漢字:漢字', '中文意思:中文', 'sentence:句子填空'].forEach(item => {
            const [k, v] = item.split(':');
            html += `<label class="chk-label"><input type="checkbox" name="mixed-qtype" value="${k}" checked> ${v}</label>`;
        });
    } else {
        let aTypes = [];
        if (val === 'audio') aTypes = ['漢字', '假名拼音', '中文意思'];
        else if (val === '漢字') aTypes = ['假名拼音', '中文意思'];
        else if (val === '中文意思') aTypes = ['漢字', '假名拼音'];
        else if (val === 'sentence') aTypes = ['漢字', '假名拼音'];

        html += `<div class="checkbox-group-title">請勾選要作答的項目 (最少一項，最多全部)：</div>`;
        aTypes.forEach(t => {
            let label = t === '假名拼音' ? '拼音' : (t === '中文意思' ? '中文' : '漢字');
            html += `<label class="chk-label"><input type="checkbox" name="atype-chk" value="${t}" checked> ${label}</label>`;
        });
    }
    
    aTypeContainer.innerHTML = html;

    const hwChk = document.getElementById('hw-checkbox');
    if (hwChk) {
        hwChk.addEventListener('change', (e) => {
            const chks = document.querySelectorAll('input[name="atype-chk"], input[name="mixed-qtype"]');
            chks.forEach(c => {
                c.disabled = e.target.checked;
                if(e.target.checked) c.parentElement.style.opacity = 0.5;
                else c.parentElement.style.opacity = 1;
            });
        });
    }
}

qType.addEventListener('change', () => {
    renderATypeOptions();
    localStorage.setItem('savedQType', qType.value);
});


function getStudyDate(dateInput) {
    let d = new Date(dateInput);
    if (isNaN(d.getTime())) return new Date(0); 
    d.setHours(d.getHours() - 8);
    return d;
}

function getTodayStudyString() {
    const d = getStudyDate(new Date());
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

function isTestedToday(wordObj) {
    if (!wordObj.lastReview) return false;
    
    let lr = new Date(wordObj.lastReview);
    if (isNaN(lr.getTime())) {
        const cleanStr = wordObj.lastReview.toString().replace(/上午|下午/g, '').replace(/AM|PM/gi, '').trim();
        lr = new Date(cleanStr);
        if (isNaN(lr.getTime())) return false; 
    }
    
    const lrStudyDate = getStudyDate(lr);
    const todayStudyDate = getStudyDate(new Date());
    
    return lrStudyDate.getFullYear() === todayStudyDate.getFullYear() &&
           lrStudyDate.getMonth() === todayStudyDate.getMonth() &&
           lrStudyDate.getDate() === todayStudyDate.getDate();
}

async function loadVocabCSV() {
    return new Promise((resolve) => {
        Papa.parse("vocab.csv", {
            download: true, 
            header: true,
            complete: (results) => {
                vocabData = results.data.filter(row => row['中文意思'] && (row['漢字'] || row['假名拼音']))
                    .map((item, index) => ({ 
                        ...item, 
                        uniqueId: (item['漢字'] || '').trim() || (item['假名拼音'] || '').trim(), 
                        originalIndex: index,
                        errorCount: 0, 
                        drawCount: 0,
                        errorRate: 0,
                        firstReviewDate: "",
                        nextReviewDate: "", 
                        level: 0,
                        lastReview: "" 
                    }));
                resolve();
            },
            error: (err) => {
                console.error("CSV載入失敗:", err);
                if (window.location.protocol === 'file:') {
                    alert("⚠️ 嚴重錯誤：瀏覽器阻擋了讀取本地的 vocab.csv 檔案！\n\n請使用 Live Server 或上傳到網頁伺服器上運行！");
                } else {
                    alert("⚠️ 找不到 vocab.csv 檔案！請確定檔案與網頁放在同一個資料夾。");
                }
                resolve(); 
            }
        });
    });
}

function initDailyPool() {
    if (vocabData.length === 0) return;

    const todayStudy = getStudyDate(new Date()); 
    todayStudy.setHours(0, 0, 0, 0);
    const todayStr = getTodayStudyString();

    if (!srsToggle.checked) {
        dailyNewWords = [];
        dueOldWords = [];
        dailyPool = [...vocabData];
        currentFullPool = [...vocabData];
        roundPending = [...vocabData];
        return;
    }

    let savedDate = localStorage.getItem('dailyNewDate');
    let savedIds = JSON.parse(localStorage.getItem('dailyNewIds') || '[]');

    if (savedDate !== todayStr) {
        savedIds = []; 
    }

    dailyNewWords = vocabData.filter(w => savedIds.includes(w.uniqueId));

    if (dailyNewWords.length < DAILY_LIMIT) {
        let needed = DAILY_LIMIT - dailyNewWords.length;
        let availableNew = vocabData.filter(w => w.drawCount === 0 && !savedIds.includes(w.uniqueId));
        
        let toAdd = availableNew.slice(0, needed);
        dailyNewWords = [...dailyNewWords, ...toAdd];
        
        savedIds = dailyNewWords.map(w => w.uniqueId);
        localStorage.setItem('dailyNewIds', JSON.stringify(savedIds));
        localStorage.setItem('dailyNewDate', todayStr);
    }

    dueOldWords = vocabData.filter(w => {
        if (w.drawCount === 0) return false; 
        if (savedIds.includes(w.uniqueId)) return false; 

        if (!w.nextReviewDate) return true; 
        const nd = new Date(w.nextReviewDate);
        nd.setHours(0, 0, 0, 0);
        return nd <= todayStudy;
    });

    dailyPool = [...dailyNewWords, ...dueOldWords];
}

// 🚀 核心升級：防卡頓智能快取機制
async function ensureDataLoaded(btnElement) {
    const currentStudyDate = getTodayStudyString();

    // 如果已經載入過資料，而且還在「同一天」，直接秒進測驗，不要去煩 API！
    if (vocabData.length > 0 && lastSyncStudyDate === currentStudyDate) {
        initDailyPool(); 
        return true; 
    }
    
    // 如果是新的一天，或者剛開啟網頁，才執行底下的雲端同步
    const originalText = btnElement.innerText;
    btnElement.innerText = "連線同步中...";
    btnElement.disabled = true; 
    
    try {
        if (vocabData.length === 0) {
            await loadVocabCSV();
            if (vocabData.length === 0) return false; 
        }

        const cloudData = await refreshHomeStats();
        if (cloudData === null) {
            alert("⚠️ 無法連線到 Google Sheet 資料庫！\n\n系統將切換為「單機模式」運行。如需存檔，請確認 API URL 與部署權限。");
        }
        
        sessionMistakes.clear(); 
        
        if (cloudData && Array.isArray(cloudData)) {
            const map = new Map(cloudData.map(p => [p.wordId, p]));
            vocabData.forEach(w => {
                const p = map.get(w.uniqueId);
                if (p) { 
                    w.errorCount = parseInt(p.errorCount) || 0; 
                    w.drawCount = parseInt(p.drawCount) || 0;
                    w.errorRate = parseFloat(p.errorRate) || 0;
                    w.firstReviewDate = p.firstReviewDate || "";
                    w.nextReviewDate = p.nextReviewDate || ""; 
                    w.level = parseInt(p.level) || 0; 
                    w.lastReview = p.lastReview || ""; 
                    
                    if (w.level === 0 && w.errorCount > 0) {
                        sessionMistakes.add(w);
                    }
                }
            });
        }
        
        lastSyncStudyDate = currentStudyDate; // 🚀 更新最後同步日，防止後續無意義的卡頓
        initDailyPool(); 
        updateMistakeBtn(); 
        return true;

    } catch (err) {
        console.error("同步發生例外錯誤:", err);
        alert("發生非預期的錯誤：" + err.message);
        return false;
    } finally {
        btnElement.innerText = originalText;
        btnElement.disabled = false;
    }
}

if (startNewWordsBtn) {
    startNewWordsBtn.onclick = async () => {
        isMistakeMode = false;
        isFrequentMistakeMode = false;
        isNewWordMode = true;
        
        const isLoaded = await ensureDataLoaded(startNewWordsBtn);
        if (!isLoaded) return; 
        
        currentFullPool = srsToggle.checked ? dailyNewWords : vocabData;
        roundPending = currentFullPool.filter(w => !isTestedToday(w) || (w.level === 0 && w.errorCount > 0));
        
        if (roundPending.length === 0) {
            alert("🎉 今日「新單字」已全數完成！太棒了！\n(如果想繼續，請直接按重新一輪)");
            document.getElementById('round-modal').classList.remove('hidden');
            return;
        }
        
        startQuiz();
    };
}

startBtn.onclick = async () => {
    isMistakeMode = false;
    isFrequentMistakeMode = false;
    isNewWordMode = false;
    
    const isLoaded = await ensureDataLoaded(startBtn);
    if (!isLoaded) return; 
    
    currentFullPool = srsToggle.checked ? dailyPool : vocabData;
    roundPending = currentFullPool.filter(w => !isTestedToday(w) || (w.level === 0 && w.errorCount > 0));
    
    if (roundPending.length === 0) {
        alert("🎉 今日「所有任務」已全數完成！太棒了！\n(如果想繼續，請直接按重新一輪)");
        document.getElementById('round-modal').classList.remove('hidden');
        return;
    }
    
    startQuiz();
};

startFreqBtn.onclick = async () => {
    isMistakeMode = false;
    isFrequentMistakeMode = true;
    isNewWordMode = false;
    
    const isLoaded = await ensureDataLoaded(startFreqBtn);
    if (!isLoaded) return;

    let mistakeWords = vocabData.filter(w => w.errorCount > 0 || w.errorRate > 0);
    mistakeWords.sort((a,b) => b.errorRate - a.errorRate);
    
    if (mistakeWords.length === 0) {
        alert("🎉 太強了！你的題庫裡沒有任何常錯單字！");
        return;
    }

    currentFullPool = [...mistakeWords]; 
    roundPending = [...currentFullPool]; 
    startQuiz();
};

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
            isFrequentMistakeMode = false;
            isNewWordMode = false;
            
            currentFullPool = Array.from(sessionMistakes);
            roundPending = [...currentFullPool];
            startQuiz();
        };
        document.getElementById('setup-section').appendChild(btn);
    }
    if (sessionMistakes.size > 0) {
        btn.innerHTML = `🔥 剛錯的單字特訓 (${sessionMistakes.size} 題待消滅)`;
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}

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
    
    const totalDaily = currentFullPool.length;
    const pendingRound = roundPending.length;
    const masteredRound = totalDaily - pendingRound;
    
    let modeText = `<span>📚 綜合測驗</span>`;
    if (isNewWordMode) modeText = `<span style="color:#20c997;">🆕 今日新單字</span>`;
    if (isMistakeMode) modeText = `<span style="color:#ff4d4f;">🔥 剛錯的單字特訓</span>`;
    if (isFrequentMistakeMode) modeText = `<span style="color:#6c757d;">💀 歷史死穴特訓</span>`;
    if (!srsToggle.checked && !isMistakeMode && !isFrequentMistakeMode && !isNewWordMode) modeText = `<span>♾️ 無盡全庫抽題</span>`;

    bar.innerHTML = `${modeText} <span style="color:#d9534f;">⏳ 待消滅: ${pendingRound}/${totalDaily}</span> <span style="color:#28a745;">🎯 已消滅: ${masteredRound}</span>`;
}

async function showListView() {
    const isLoaded = await ensureDataLoaded(viewListBtn); 
    if (!isLoaded) return;
    
    mainCategoryFilter.value = 'all';
    searchInput.value = ''; 
    document.getElementById('status-filter').value = 'all'; 
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
    const statusCat = document.getElementById('status-filter').value; 
    const searchTerm = searchInput.value.trim().toLowerCase();

    let matchCount = 0; 

    vocabData.forEach((w, index) => {
        if (!w['詞性']) return;

        const isTested = w.drawCount > 0;
        if (statusCat === 'tested' && !isTested) return;
        if (statusCat === 'untested' && isTested) return;

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

        matchCount++; 

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

        let rateDisplay = w.drawCount > 0 ? `${Math.round(w.errorRate * 100)}%` : '-';

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
                <div style="color: #d9534f; font-size: 9px; font-weight: bold; margin-top:2px;">錯率: ${rateDisplay}</div>
            </div>
            <div style="flex: 1.2; color:#d9534f; font-weight:bold; font-size:14px; text-align:left; padding-left: 5px;">${w['中文意思']}</div>
            <div style="width: 35px; text-align: right;">
                <button onclick="event.stopPropagation(); playListAudio(${index})" style="background:none; border:none; font-size:18px; color:#007bff; cursor:pointer;">🔊</button>
            </div>
        `;
        vocabListContainer.appendChild(item);
    });

    const countDisplay = document.getElementById('vocab-count-display');
    if (countDisplay) {
        countDisplay.innerText = `共找到 ${matchCount} 個單字`;
    }
}

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

function commitWordResult(w, isCorrect) {
    w.drawCount++; 
    if (!w.firstReviewDate) w.firstReviewDate = new Date().toISOString();
    
    if (isCorrect) {
        w.level++;
        updateLocalNextReviewDate(w, "SUCCESS");
        roundPending = roundPending.filter(item => item.uniqueId !== w.uniqueId);
    } else {
        w.errorCount++;
        w.level = Math.max(0, w.level - 1);
        updateLocalNextReviewDate(w, "ERROR");
    }
    
    w.errorRate = w.drawCount > 0 ? (w.errorCount / w.drawCount) : 0;
    syncToCloud(isCorrect ? "SUCCESS" : "ERROR", w);
}

function processManualChoice() {
    if (currentManualChoice !== null) {
        commitWordResult(currentWord, currentManualChoice);
        currentManualChoice = null; 
    }
}

function processHwChoices() {
    Object.keys(hwChoices).forEach(idxStr => {
        const idx = parseInt(idxStr);
        commitWordResult(hwQuestions[idx], hwChoices[idx]);
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

    if (isMistakeMode) {
        dueWords = Array.from(sessionMistakes);
        if (dueWords.length === 0) {
            alert("✅ 本次錯題已全數消滅！太棒了！");
            isMistakeMode = false;
            updateMistakeBtn();
            homeBtn.click();
            return;
        }
    } else {
        dueWords = [...roundPending];
        if (dueWords.length === 0) {
            document.getElementById('round-modal').classList.remove('hidden');
            return;
        }
    }

    let selectedQType = qType.value;
    const hwChk = document.getElementById('hw-checkbox');
    isHwBatchMode = hwChk && hwChk.checked;
    
    let selectedATypes = [];
    if (selectedQType === 'mixed') {
        selectedATypes = Array.from(document.querySelectorAll('input[name="mixed-qtype"]:checked')).map(el => el.value);
        if (selectedATypes.length < 2) {
            alert("⚠️ 混合大亂鬥模式請至少勾選「兩項」要測驗的題型！");
            return;
        }
    } else if (!isHwBatchMode) {
        selectedATypes = Array.from(document.querySelectorAll('input[name="atype-chk"]:checked')).map(el => el.value);
        if (selectedATypes.length === 0) {
            alert("⚠️ 請至少勾選一項要作答的項目！");
            return;
        }
    }

    // --- AI 模式 ---
    if (aiToggle.checked && !isHwBatchMode) {
        const apiKey = geminiApiKeyInput.value.trim();
        if (!apiKey) { alert("請先輸入 Gemini API Key！"); return; }
        localStorage.setItem('geminiApiKey', apiKey); 
        
        if (selectedQType !== 'mixed' && !selectedATypes.includes('中文意思')) {
            alert("⚠️ AI 語意批改需要勾選「中文意思」作答項目才能運作！");
            return;
        }

        isBatchMode = true;
        batchAnswers = []; 
        currentBatchIdx = 0;
        batchQuestions = getBatchWords(dueWords, Math.min(AI_BATCH_SIZE, dueWords.length));
    } 
    // --- 批次手寫練習模式 ---
    else if (isHwBatchMode) {
        isBatchMode = false;
        hwQuestions = getBatchWords(dueWords, Math.min(HW_BATCH_SIZE, dueWords.length));
        setupSection.classList.add('hidden'); 
        batchResultsArea.classList.add('hidden');
        quizSection.classList.remove('hidden'); 
        renderHwBatch(); 
        return; 
    } 
    // --- 常規單題模式 ---
    else {
        isBatchMode = false;
        isHwBatchMode = false;
    }

    setupSection.classList.add('hidden'); 
    batchResultsArea.classList.add('hidden');
    document.getElementById('question-area').classList.remove('hidden');
    quizSection.classList.remove('hidden'); 
    nextQuestion(); 
}

window.restartRound = () => {
    document.getElementById('round-modal').classList.add('hidden');
    roundPending = [...currentFullPool]; 
    startQuiz();
};

function getWeightedRandomWord(pool) {
    let totalWeight = 0;
    let weights = pool.map(w => {
        let weight = 1 + (w.errorRate * 9); 
        totalWeight += weight;
        return weight;
    });

    let random = Math.random() * totalWeight;
    let sum = 0;
    for (let i = 0; i < pool.length; i++) {
        sum += weights[i];
        if (random <= sum) return pool[i];
    }
    return pool[pool.length - 1];
}

function getBatchWords(pool, count) {
    let selected = [];
    let tempPool = [...pool];
    while (selected.length < count && tempPool.length > 0) {
        let word = getWeightedRandomWord(tempPool);
        selected.push(word);
        tempPool = tempPool.filter(w => w.uniqueId !== word.uniqueId); 
    }
    return selected;
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
            alert("✅ 本次錯題已全數消滅！太棒了！");
            isMistakeMode = false;
            updateMistakeBtn();
            homeBtn.click();
            return null;
        }
    } else {
        dueWords = [...roundPending];
        if (dueWords.length === 0) {
            document.getElementById('round-modal').classList.remove('hidden');
            return null;
        }
    }

    return getWeightedRandomWord(dueWords);
}

// ⭐ 動態產生每題的 UI
function nextQuestion() {
    processManualChoice(); 
    stopAllAudio();
    updateStatsBar(); 
    feedback.innerHTML = ''; kanjiInput.value = ''; kanaInput.value = ''; chineseInput.value = ''; 
    nextBtn.classList.add('hidden'); clearCanvas();
    
    currentWord = getNextWord();
    if (!currentWord) return;

    playAudioBtn.classList.add('hidden'); inputArea.classList.add('hidden');
    canvasArea.classList.add('hidden'); flashcardArea.classList.add('hidden');

    currentActiveQType = qType.value;
    
    if (currentActiveQType === 'mixed') {
        const mixQTypes = Array.from(document.querySelectorAll('input[name="mixed-qtype"]:checked')).map(el => el.value);
        currentActiveQType = mixQTypes[Math.floor(Math.random() * mixQTypes.length)];
        
        if (currentActiveQType === 'audio') currentActiveATypes = [['漢字'], ['假名拼音'], ['中文意思']][Math.floor(Math.random()*3)];
        else if (currentActiveQType === '漢字') currentActiveATypes = [['假名拼音'], ['中文意思']][Math.floor(Math.random()*2)];
        else if (currentActiveQType === '中文意思') currentActiveATypes = [['漢字'], ['假名拼音']][Math.floor(Math.random()*2)];
        else if (currentActiveQType === 'sentence') currentActiveATypes = [['漢字'], ['假名拼音']][Math.floor(Math.random()*2)];
    } else {
        currentActiveATypes = Array.from(document.querySelectorAll('input[name="atype-chk"]:checked')).map(el => el.value);
    }

    let qName = currentActiveQType === 'audio' ? '聽力' : (currentActiveQType === 'sentence' ? '句子填空' : currentActiveQType);
    let hintLabels = currentActiveATypes.map(t => t==='假名拼音'?'拼音':(t==='中文意思'?'中文':'漢字')).join(' + ');
    
    let hintText = `[${qName}] 答題：<span style="color:#007bff">${hintLabels}</span> | 重音：${currentWord['重音'] || '-'}`;
    if (isBatchMode) hintText += ` | <strong style="color:red;">AI 模式: 第 ${currentBatchIdx + 1}/${batchQuestions.length} 題</strong>`;
    hintDisplay.innerHTML = hintText;

    inputArea.classList.remove('hidden');
    kanjiInput.classList.add('hidden');
    kanaInput.classList.add('hidden');
    chineseInput.classList.add('hidden');

    if (currentActiveATypes.includes('漢字')) kanjiInput.classList.remove('hidden');
    if (currentActiveATypes.includes('假名拼音')) kanaInput.classList.remove('hidden');
    if (currentActiveATypes.includes('中文意思')) chineseInput.classList.remove('hidden');

    setTimeout(() => {
        if (!kanjiInput.classList.contains('hidden')) kanjiInput.focus();
        else if (!kanaInput.classList.contains('hidden')) kanaInput.focus();
        else if (!chineseInput.classList.contains('hidden')) chineseInput.focus();
    }, 50);

    if (currentActiveQType === 'sentence') {
        activeSentenceIdx = (Math.random() < 0.5 && currentWord['常用例句 2題目']) ? 2 : 1;
        const cnTrans = currentWord[`常用例句 ${activeSentenceIdx}中`];
        const sentenceQ = currentWord[`常用例句 ${activeSentenceIdx}題目`];
        questionDisplay.innerHTML = `<div style="font-size:18px; color:#666; margin-bottom:10px;">${cnTrans}</div><div>${sentenceQ}</div>`;
    } else if (currentActiveQType === 'audio') {
        questionDisplay.innerText = "🎧 聽力測驗 (聽音拼寫)";
        playAudioBtn.classList.remove('hidden');
        playFullSequence(); 
    } else if (currentActiveQType === '中文意思') {
        questionDisplay.innerHTML = `${currentWord['中文意思']} <span style="font-size:18px; color:#e67e22;">[${currentWord['詞性']}]</span>`;
    } else if (currentActiveQType === '漢字') {
        questionDisplay.innerText = currentWord['漢字'] || currentWord['假名拼音'];
    } 
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
        let currentQType = qType.value;
        if (currentQType === 'mixed') {
            const mixQTypes = Array.from(document.querySelectorAll('input[name="mixed-qtype"]:checked')).map(el => el.value);
            currentQType = mixQTypes[Math.floor(Math.random() * mixQTypes.length)];
        }

        let qText = "";
        
        if (currentQType === 'audio') {
            let audioBtns = `<button onclick="playBatchAudio(${idx}, 'word')" class="secondary-btn" style="padding:6px 12px; margin-right:5px; margin-bottom:5px;">🔊 聽單字</button>`;
            if (w['常用例句 1日']) {
                audioBtns += `<button onclick="playBatchAudio(${idx}, '1')" class="secondary-btn" style="padding:6px 12px; margin-right:5px; margin-bottom:5px;">🔊 聽例句 1</button>`;
            }
            if (w['常用例句 2日']) {
                audioBtns += `<button onclick="playBatchAudio(${idx}, '2')" class="secondary-btn" style="padding:6px 12px; margin-right:5px; margin-bottom:5px;">🔊 聽例句 2</button>`;
            }
            qText = `<div style="display:inline-block;">${audioBtns}</div> <span style="color:#e67e22; font-size:14px; font-weight:normal;">[${w['詞性']}]</span>`;
        } 
        else if (currentQType === '中文意思') {
            qText = `${w['中文意思']} <span style="color:#e67e22; font-size:14px; font-weight:normal;">[${w['詞性']}]</span>`;
        } else if (currentQType === 'sentence') {
            const sIdx = (Math.random() < 0.5 && w['常用例句 2題目']) ? 2 : 1;
            qText = `<div style="font-size:14px; color:#666; font-weight:normal;">${w[`常用例句 ${sIdx}中`]}</div><div>${w[`常用例句 ${sIdx}題目`]}</div>`;
        } else {
            qText = w['漢字'] || w['假名拼音'];
        }

        const wordIdx = vocabData.findIndex(vw => vw.uniqueId === w.uniqueId);
        const displayKana = w['假名拼音(分別)'] || w['假名拼音'] || ""; 

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
        <button id="hw-next-btn" class="primary-btn" onclick="nextHwBatch()" style="flex:1; background:#28a745; margin-top:0;">➡️ 下一組</button>
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

function showFullCard(isCorrect, userDisplayArr = []) {
    let headerHTML = "";

    if (isCorrect) {
        headerHTML = `<h3 style="color:green;">✅ 正確！</h3>`;
    } else {
        headerHTML = `<h3 style="color:red;">❌ 答錯了！</h3><p><small>您的輸入：${userDisplayArr.join(' / ')}</small></p><button onclick="undo()" id="undo-btn">🔧 手誤取消懲罰</button>`;
    }

    const wordIdx = vocabData.indexOf(currentWord);
    const displayKana = currentWord['假名拼音(分別)'] || currentWord['假名拼音'] || ""; 

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
    
    nextBtn.classList.remove('hidden');
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
    inputArea.classList.add('hidden');

    if (isBatchMode) {
        batchAnswers.push({
            word: currentWord,
            userC: chineseInput.value.trim(),
            userK: kanjiInput.value.trim()
        });
        currentBatchIdx++;
        if (currentBatchIdx < batchQuestions.length) nextQuestion();
        else await processBatchResults(); 
        return;
    }

    let isCorrect = true;
    let userDisplayArr = [];

    if (currentActiveATypes.includes('漢字')) {
        const uK = kanjiInput.value.trim().toLowerCase();
        userDisplayArr.push(uK || "(未填)");
        const kPoss = (currentWord['漢字'] || currentWord['假名拼音'] || "").split('/').map(s => s.trim().toLowerCase());
        if (!kPoss.includes(uK)) isCorrect = false;
    }
    
    if (currentActiveATypes.includes('假名拼音')) {
        const uKa = kanaInput.value.trim().toLowerCase();
        userDisplayArr.push(uKa || "(未填)");
        const kaPoss = (currentWord['假名拼音'] || "").split('/').map(s => s.trim().toLowerCase());
        
        if (currentActiveQType === 'sentence') {
            const ansPoss = (currentWord[`常用例句 ${activeSentenceIdx}答案`] || "").split('/').map(s=>s.trim().toLowerCase());
            if (!ansPoss.includes(uKa) && !kaPoss.includes(uKa)) isCorrect = false;
        } else {
            if (!kaPoss.includes(uKa)) isCorrect = false;
        }
    }

    if (currentActiveATypes.includes('中文意思')) {
        const uC = chineseInput.value.trim().toLowerCase();
        userDisplayArr.push(uC || "(未填)");
        const cPoss = (currentWord['中文意思'] || "").split('/').map(s => s.trim().toLowerCase());
        if (!cPoss.includes(uC)) isCorrect = false;
    }

    commitWordResult(currentWord, isCorrect);
    showFullCard(isCorrect, userDisplayArr); 
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

        if (currentActiveATypes.includes('漢字')) {
            const kPoss = (item.word['漢字'] || "").split('/').map(s => s.trim().toLowerCase());
            if (!kPoss.includes(item.userK.toLowerCase())) finalCorrect = false;
        }

        commitWordResult(item.word, finalCorrect);

        const statusIcon = finalCorrect ? "✅" : "❌";
        const boxColor = finalCorrect ? '#c3e6cb' : '#f5c6cb';
        const aiTagStr = `<span style="color:${aiResult ? 'green' : 'red'}; font-weight:bold;">${aiResult ? 'AI 中文判定正確' : 'AI 中文判定錯誤'}</span>`;

        const wordIndex = vocabData.indexOf(item.word);
        const displayKana = item.word['假名拼音(分別)'] || item.word['假名拼音'] || ""; 

        html += `
            <div class="card-box" onclick="showWordDetail(${wordIndex})" style="border: 2px solid ${boxColor}; margin-bottom: 10px; padding: 12px; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                <h4 style="margin: 0 0 8px 0; font-size: 18px;">${statusIcon} ${item.word['漢字']} (${displayKana})</h4>
                <p style="margin: 3px 0; font-size: 14px; color: #555;">標準答案: ${item.word['中文意思']}</p>
                <p style="margin: 3px 0; font-size: 14px; color: #007bff; font-weight: bold;">
                    你的輸入: ${item.userC} ${currentActiveATypes.includes('漢字') ? ` (漢字: ${item.userK})` : ''}
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
        <button onclick="startQuiz()" class="primary-btn" style="flex:1; background:#28a745; margin-top:0;">➡️ 下一組</button>
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
    refreshHomeStats(); // 背景同步，不阻塞 UI
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
    refreshHomeStats(); // 背景同步，不阻塞 UI
};

// --- 8. 事件監聽 ---
function handleEnter(e) {
    const now = Date.now();
    if (now - lastEnterTime < ENTER_CD_MS) { e.preventDefault(); return; }
    lastEnterTime = now;
    if (!nextBtn.classList.contains('hidden')) { nextQuestion(); } 
    else if (feedback.innerHTML === "" && !isHwBatchMode) {
        if (document.activeElement === kanjiInput && !kanaInput.classList.contains('hidden')) kanaInput.focus();
        else if ((document.activeElement === kanjiInput || document.activeElement === kanaInput) && !chineseInput.classList.contains('hidden')) chineseInput.focus();
        else checkAnswer(); 
    }
}

[kanjiInput, kanaInput, chineseInput].forEach(el => {
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); handleEnter(e); }
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !quizSection.classList.contains('hidden')) {
        if (document.activeElement === kanjiInput || document.activeElement === kanaInput || document.activeElement === chineseInput) return;
        e.preventDefault(); handleEnter(e);
    }
}, true); 

searchInput.addEventListener('input', renderVocabList);

// --- 9. 初始化與同步 ---
async function refreshHomeStats() {
    try {
        const res = await fetch(PROGRESS_API_URL);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const cloudData = await res.json(); 
        renderErrorChart(cloudData); 
        return cloudData; 
    } catch (e) { 
        console.error("同步失敗", e); 
        return null; 
    }
}

window.undo = () => {
    currentWord.errorCount--; 
    currentWord.level += 2; 
    updateLocalNextReviewDate(currentWord, "UNDO");
    
    roundPending.push(currentWord);
    
    currentWord.errorRate = currentWord.drawCount > 0 ? (currentWord.errorCount / currentWord.drawCount) : 0;
    syncToCloud("UNDO", currentWord);
    feedback.innerHTML = `<h3 style="color:blue;">✨ 已取消懲罰！</h3>` + (feedback.innerHTML.split('</button>')[1] || "");
};

function syncToCloud(op, wordObj) {
    const targetWord = wordObj || currentWord;
    
    if (op === "SUCCESS" || op === "UNDO") {
        sessionMistakes.delete(targetWord);
    } else if (op === "ERROR") {
        sessionMistakes.add(targetWord);
    }
    updateMistakeBtn(); 

    if (op === "SUCCESS" || op === "ERROR" || op === "UNDO") {
        updateStatsBar();
    }
    
    const wordId = targetWord.uniqueId;
    const data = { 
        timestamp: new Date().toISOString(), 
        wordId: wordId, 
        errorCount: targetWord.errorCount, 
        drawCount: targetWord.drawCount,
        errorRate: targetWord.errorRate,
        firstReviewDate: targetWord.firstReviewDate,
        nextReviewDate: targetWord.nextReviewDate,
        level: targetWord.level, 
        status: op 
    };
    fetch(PROGRESS_API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(data) });
}

window.onload = () => {
    refreshHomeStats();
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) {
        geminiApiKeyInput.value = savedKey;
    }
    
    const savedQType = localStorage.getItem('savedQType');
    if (savedQType) qType.value = savedQType;
    qType.dispatchEvent(new Event('change'));
};

viewListBtn.onclick = showListView;
submitBtn.onclick = checkAnswer;
nextBtn.onclick = nextQuestion;
playAudioBtn.onclick = () => playFullSequence();
homeBtnList.onclick = () => { stopAllAudio(); listSection.classList.add('hidden'); setupSection.classList.remove('hidden'); };
mainCategoryFilter.onchange = updateSubCategories;
posFilter.onchange = renderVocabList;
resetDataBtn.onclick = () => { if (confirm("⚠️ 確定要重設進度嗎？")) { fetch(PROGRESS_API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ status: "RESET_ALL" }) }).then(() => location.reload()); } };

window.onclick = (event) => { 
    if (event.target == wordModal || event.target == document.getElementById('round-modal')) {
        closeModal(); 
        document.getElementById('round-modal').classList.add('hidden');
    }
};