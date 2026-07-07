// ==========================================
// ⭐ 1. 全域參數與 API 設定區 (請在此替換你的 Google Sheet API)
// ==========================================
const SUPABASE_URL = "https://jidhlyffabogaodnxash.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_UwYW-BwjlgVf5YgMYPYXvQ_-9XnRDcd"; 

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
const startPosBtn = document.getElementById('start-pos-btn'); 
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
let currentFilteredWords = []; 
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
let lastSyncStudyDate = null; 

let isMistakeMode = false;       
let isFrequentMistakeMode = false; 
let isNewWordMode = false;
let isPosMode = false; 
let isPureFlashcardMode = false; 
let pureFlashcardList = [];      
let pureFCIdx = 0;               
let isFlipping = false; 

let isBatchMode = false;
let batchQuestions = [];
let batchAnswers = [];
let currentBatchIdx = 0;
let isHwBatchMode = false;
let hwQuestions = [];

let currentActiveQType = "";
let currentActiveATypes = [];

// ⭐ 彈窗面板與深色標籤選定記憶庫
let selectedSubCats = new Set(); 
let categoryTree = {};          
let totalSubCatCount = 0;
let currentOpenMainCat = "";

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

function formatAccent(val) {
    if (val === undefined || val === null || String(val).trim() === "") return "";
    let clean = String(val).trim().replace(/^\[+|\]+$/g, ''); 
    return clean ? `[${clean}]` : "";
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
        ['audio:聽力', '漢字:漢字', '中文意思:中文', 'sentence:句子填空', 'flashcard:單字卡'].forEach(item => {
            const [k, v] = item.split(':');
            html += `<label class="chk-label"><input type="checkbox" name="mixed-qtype" value="${k}" checked> ${v}</label>`;
        });
    } else if (val === 'flashcard') {
        html += `<div class="checkbox-group-title" style="color:#6f42c1;">請選擇小卡正面提問模式：</div>
                 <label class="chk-label"><input type="radio" name="fc-front-type" value="jp" checked> 🇯🇵 日文看字猜義</label>
                 <label class="chk-label"><input type="radio" name="fc-front-type" value="cn"> 🇹🇼 中文回想日文</label>
                 <label class="chk-label"><input type="radio" name="fc-front-type" value="audio"> 🎧 盲聽語音辨義</label>`;
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
            const chks = document.querySelectorAll('input[name="atype-chk"], input[name="mixed-qtype"], input[name="fc-front-type"]');
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

// ⭐ 雙模式單字匹配查詢
function isWordMatchPOS(w, listMainCat = null, listSubCat = null) {
    if (!w['詞性']) return false;
    const wordPosParts = w['詞性'].split('/').map(p => p.trim());

    if (listMainCat !== null && listSubCat !== null) {
        if (listMainCat === 'all' && listSubCat === 'all') return true;
        if (listSubCat !== 'all') {
            return wordPosParts.some(p => {
                const keywords = subCatMapping[listMainCat]?.[listSubCat];
                return keywords ? keywords.some(k => p.includes(k)) : p === listSubCat;
            });
        } else if (listMainCat !== 'all') {
            return wordPosParts.some(p => {
                if (listMainCat === '其他') return !Object.values(categoryMap).flat().some(k => p.includes(k));
                return categoryMap[listMainCat]?.some(k => p.includes(k));
            });
        }
        return false;
    }

    if (selectedSubCats.size === 0) return false;

    return Array.from(selectedSubCats).some(targetSub => {
        let parentMain = '其他';
        for (const [m, subs] of Object.entries(categoryTree)) {
            if (subs.includes(targetSub)) { parentMain = m; break; }
        }

        if (subCatMapping[parentMain] && subCatMapping[parentMain][targetSub]) {
            return wordPosParts.some(p => subCatMapping[parentMain][targetSub].some(k => p.includes(k)));
        }
        if (parentMain !== '其他' && categoryMap[parentMain]) {
            return wordPosParts.some(p => p.includes(targetSub));
        }
        return wordPosParts.includes(targetSub);
    });
}

// ⭐ 建立大類樹狀結構，並把所有小類預設加入深色選定庫
function buildCategoryTree() {
    if (vocabData.length === 0) return;
    const existCategories = { '其他': new Set() };
    Object.keys(categoryMap).forEach(k => existCategories[k] = new Set());

    vocabData.forEach(w => {
        if (!w['詞性']) return;
        w['詞性'].split('/').map(p => p.trim()).forEach(p => {
            let matched = false;
            Object.keys(subCatMapping).forEach(mainCat => {
                Object.keys(subCatMapping[mainCat]).forEach(subCat => {
                    if (subCatMapping[mainCat][subCat].some(k => p.includes(k)) || p === subCat) {
                        existCategories[mainCat].add(subCat);
                        matched = true;
                    }
                });
            });
            if (!matched) {
                Object.keys(categoryMap).forEach(mainCat => {
                    if (categoryMap[mainCat].some(k => p.includes(k))) {
                        existCategories[mainCat].add(p);
                        matched = true;
                    }
                });
            }
            if (!matched && p) existCategories['其他'].add(p);
        });
    });

    categoryTree = {};
    totalSubCatCount = 0;
    for (const [mainCat, subSet] of Object.entries(existCategories)) {
        if (subSet.size > 0) {
            categoryTree[mainCat] = Array.from(subSet).sort();
            categoryTree[mainCat].forEach(sub => {
                selectedSubCats.add(sub); 
                totalSubCatCount++;
            });
        }
    }
    updateSelectedCountDisplay();
}

// ⭐ 點擊大類下拉選單時，彈出對應面板 (首頁用)
window.openSubPanel = (mainCat) => {
    if (!mainCat) return;
    currentOpenMainCat = mainCat;
    const panel = document.getElementById('right-sub-panel');
    const cloud = document.getElementById('sub-cat-tag-cloud');
    const title = document.getElementById('sub-panel-title');
    
    if (!categoryTree[mainCat]) return;
    
    title.innerText = `📂 ${mainCat} - 小類清單`;
    const subs = categoryTree[mainCat] || [];
    
    let html = '';
    subs.forEach(sub => {
        const isSelected = selectedSubCats.has(sub);
        html += `<button type="button" class="tag-pill ${isSelected ? 'active' : ''}" onclick="toggleTagPill('${sub}', this)">${sub}</button>`;
    });

    cloud.innerHTML = html || '<span style="color:#999; font-size:12px;">無此小類</span>';
    panel.classList.remove('hidden'); 
};

window.closeSubPanel = () => {
    const panel = document.getElementById('right-sub-panel');
    if (panel) panel.classList.add('hidden');
    const picker = document.getElementById('main-cat-picker');
    if (picker) picker.value = ""; 
};

window.toggleTagPill = (subCat, btnElem) => {
    if (selectedSubCats.has(subCat)) {
        selectedSubCats.delete(subCat);
        btnElem.classList.remove('active');
    } else {
        selectedSubCats.add(subCat);
        btnElem.classList.add('active');
    }
    updateSelectedCountDisplay();
};

window.toggleCurrentMainCat = (status) => {
    const mainCat = currentOpenMainCat;
    const subs = categoryTree[mainCat] || [];
    subs.forEach(sub => {
        if (status) selectedSubCats.add(sub);
        else selectedSubCats.delete(sub);
    });
    openSubPanel(mainCat); 
    updateSelectedCountDisplay();
};

window.selectAllSubCats = (status) => {
    if (status) {
        Object.values(categoryTree).flat().forEach(sub => selectedSubCats.add(sub));
    } else {
        selectedSubCats.clear();
    }
    if (currentOpenMainCat && !document.getElementById('right-sub-panel').classList.contains('hidden')) {
        openSubPanel(currentOpenMainCat);
    }
    updateSelectedCountDisplay();
};

function updateSelectedCountDisplay() {
    const display = document.getElementById('selected-sub-count');
    if (!display) return;
    const count = selectedSubCats.size;
    display.innerText = `已選定：${count} 個小類`;
    if (count === 0) {
        display.style.background = '#f8d7da'; display.style.color = '#721c24';
    } else {
        display.style.background = '#d1ecf1'; display.style.color = '#0c5460';
    }
}

// ⭐ 列表頁：小類清單面板開關與點擊外圍監聽
window.toggleSubSelection = (event) => {
    if (event) event.stopPropagation();
    const panel = document.getElementById('pos-filter-panel');
    if (panel) panel.classList.toggle('hidden');
};

// ⭐ 列表頁：全選或清空當前分類下的所有小類
window.selectAllListSubCats = (status) => {
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

    subSet.forEach(sub => {
        if (status) selectedSubCats.add(sub);
        else selectedSubCats.delete(sub);
    });
    
    updateSubCategories();
};

// ⭐ 點擊選單外部自動收合監聽
document.addEventListener('click', (event) => {
    const dropdownArea = document.getElementById('pos-filter-dropdown-area');
    const panel = document.getElementById('pos-filter-panel');
    if (dropdownArea && panel && !panel.classList.contains('hidden')) {
        if (!dropdownArea.contains(event.target)) {
            panel.classList.add('hidden');
        }
    }
});

// ⭐ 動態更新「全部小類 ▾」按鈕的文字與顏色
function updateTriggerBtnText() {
    const triggerBtn = document.getElementById('pos-filter-trigger');
    if (!triggerBtn) return;
    
    if (selectedSubCats.size === 0) {
        triggerBtn.innerText = "全部小類 ▾";
        triggerBtn.style.color = "#333";
        triggerBtn.style.borderColor = "#e1e8ed";
    } else {
        triggerBtn.innerText = `已選定 ${selectedSubCats.size} 類 ▾`;
        triggerBtn.style.color = "#007bff";
        triggerBtn.style.borderColor = "#007bff";
    }
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
                alert("⚠️ 找不到 vocab.csv 檔案！請確定檔案與網頁放在同一個資料夾。");
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

    if (savedDate !== todayStr) { savedIds = []; }

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

async function ensureDataLoaded(btnElement) {
    const currentStudyDate = getTodayStudyString();
    if (vocabData.length > 0 && lastSyncStudyDate === currentStudyDate) {
        initDailyPool(); 
        return true; 
    }
    const originalText = btnElement.innerText;
    btnElement.innerText = "連線同步中...";
    btnElement.disabled = true; 
    try {
        if (vocabData.length === 0) {
            await loadVocabCSV();
            if (vocabData.length === 0) return false; 
        }
        const cloudData = await refreshHomeStats();
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
                    if (w.level === 0 && w.errorCount > 0) { sessionMistakes.add(w); }
                }
            });
        }
        lastSyncStudyDate = currentStudyDate; 
        initDailyPool(); 
        updateMistakeBtn(); 
        
        if (Object.keys(categoryTree).length === 0) {
            buildCategoryTree();
        }
        return true;
    } catch (err) {
        console.error("同步發生例外錯誤:", err);
        return false;
    } finally {
        btnElement.innerText = originalText;
        btnElement.disabled = false;
    }
}

if (startNewWordsBtn) {
    startNewWordsBtn.onclick = async () => {
        isMistakeMode = false; isFrequentMistakeMode = false; isNewWordMode = true; isPosMode = false; isPureFlashcardMode = false;
        const isLoaded = await ensureDataLoaded(startNewWordsBtn);
        if (!isLoaded) return; 
        
        if (selectedSubCats.size === 0) {
            alert("⚠️ 請至少點選一個深色小類標籤作為測驗範圍喔！"); return;
        }
        let pool = srsToggle.checked ? dailyNewWords : vocabData;
        currentFullPool = pool.filter(w => isWordMatchPOS(w));
        roundPending = currentFullPool.filter(w => !isTestedToday(w) || (w.level === 0 && w.errorCount > 0));
        if (roundPending.length === 0) {
            alert("🎉 在此分類範圍下，今日的「新單字」已全數完成！");
            if (currentFullPool.length > 0) document.getElementById('round-modal').classList.remove('hidden');
            return;
        }
        startQuiz();
    };
}

startBtn.onclick = async () => {
    isMistakeMode = false; isFrequentMistakeMode = false; isNewWordMode = false; isPosMode = false; isPureFlashcardMode = false;
    const isLoaded = await ensureDataLoaded(startBtn);
    if (!isLoaded) return; 
    
    if (selectedSubCats.size === 0) {
        alert("⚠️ 請至少點選一個深色小類標籤作為測驗範圍喔！"); return;
    }
    let pool = srsToggle.checked ? dailyPool : vocabData;
    currentFullPool = pool.filter(w => isWordMatchPOS(w));
    roundPending = currentFullPool.filter(w => !isTestedToday(w) || (w.level === 0 && w.errorCount > 0));
    if (roundPending.length === 0) {
        alert("🎉 在此分類範圍下，今日「綜合任務」已全數完成！");
        if (currentFullPool.length > 0) document.getElementById('round-modal').classList.remove('hidden');
        return;
    }
    startQuiz();
};

if (startPosBtn) {
    startPosBtn.onclick = async () => {
        isMistakeMode = false; isFrequentMistakeMode = false; isNewWordMode = false; isPosMode = true; isPureFlashcardMode = false;
        const isLoaded = await ensureDataLoaded(startPosBtn);
        if (!isLoaded) return; 
        
        if (selectedSubCats.size === 0) {
            alert("⚠️ 請先在上方「🏷️ 測驗範圍」點擊想要特訓的小類，讓它變成深色選定狀態喔！");
            return;
        }
        currentFullPool = vocabData.filter(w => isWordMatchPOS(w));
        if (currentFullPool.length === 0) { alert("⚠️ 目前字庫中沒有找到符合這些選定分類的單字！"); return; }
        
        if (srsToggle.checked) {
            roundPending = currentFullPool.filter(w => !isTestedToday(w) || (w.level === 0 && w.errorCount > 0));
            if (roundPending.length === 0) {
                if (confirm(`🎉 你今天已經把選定的分類練完囉！要直接重新抽題複習這個範圍嗎？`)) {
                    roundPending = [...currentFullPool];
                } else { return; }
            }
        } else { roundPending = [...currentFullPool]; }
        startQuiz();
    };
}

startFreqBtn.onclick = async () => {
    isMistakeMode = false; isFrequentMistakeMode = true; isNewWordMode = false; isPosMode = false; isPureFlashcardMode = false;
    const isLoaded = await ensureDataLoaded(startFreqBtn);
    if (!isLoaded) return; 
    
    if (selectedSubCats.size === 0) {
        alert("⚠️ 請至少點選一個深色小類標籤作為測驗範圍喔！"); return;
    }
    let mistakeWords = vocabData.filter(w => w.errorCount > 0 || w.errorRate > 0);
    mistakeWords = mistakeWords.filter(w => isWordMatchPOS(w));
    mistakeWords.sort((a,b) => b.errorRate - a.errorRate);
    if (mistakeWords.length === 0) { alert("🎉 太強了！在你選擇的範圍裡沒有任何常錯單字！"); return; }
    currentFullPool = [...mistakeWords]; roundPending = [...currentFullPool]; 
    startQuiz();
};

function updateMistakeBtn() {
    let btn = document.getElementById('mistake-btn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'mistake-btn';
        btn.className = 'primary-btn'; 
        btn.style.marginTop = '10px'; btn.style.backgroundColor = '#ff4d4f'; btn.style.color = 'white'; btn.style.fontWeight = 'bold';
        btn.onclick = () => {
            isMistakeMode = true; isFrequentMistakeMode = false; isNewWordMode = false; isPosMode = false; isPureFlashcardMode = false;
            currentFullPool = Array.from(sessionMistakes); roundPending = [...currentFullPool];
            startQuiz();
        };
        document.getElementById('setup-section').appendChild(btn);
    }
    if (sessionMistakes.size > 0) {
        btn.innerHTML = `🔥 剛錯的單字特訓 (${sessionMistakes.size} 題待消滅)`;
        btn.classList.remove('hidden');
    } else { btn.classList.add('hidden'); }
}

function updateStatsBar() {
    let bar = document.getElementById('quiz-stats-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'quiz-stats-bar';
        bar.style = 'display:flex; justify-content:space-between; align-items:center; font-size:13px; color:#555; margin-bottom:15px; background:#e9ecef; padding:10px 15px; border-radius:10px; font-weight:bold; box-shadow: 0 2px 4px rgba(0,0,0,0.05); flex-wrap:wrap; gap:5px;';
        const quizArea = document.getElementById('quiz-section');
        const headerRow = quizArea.querySelector('.header-row');
        headerRow.parentNode.insertBefore(bar, headerRow.nextSibling); 
    }
    
    const totalDaily = currentFullPool.length;
    const pendingRound = roundPending.length;
    const masteredRound = totalDaily - pendingRound;
    
    let modeText = `<span>📚 綜合測驗</span>`;
    if (isNewWordMode) modeText = `<span style="color:#20c997;">🆕 今日新單字</span>`;
    if (isPosMode) modeText = `<span style="color:#17a2b8;">🎯 指定詞性特訓</span>`;
    if (isMistakeMode) modeText = `<span style="color:#ff4d4f;">🔥 剛錯的單字特訓</span>`;
    if (isFrequentMistakeMode) modeText = `<span style="color:#6c757d;">💀 歷史死穴特訓</span>`;
    if (isPureFlashcardMode) modeText = `<span style="color:#6f42c1;">🃏 純小卡背誦特訓</span>`;
    if (!srsToggle.checked && !isMistakeMode && !isFrequentMistakeMode && !isNewWordMode && !isPosMode && !isPureFlashcardMode) modeText = `<span>♾️ 無盡全庫抽題</span>`;

    const count = selectedSubCats.size;
    let posTag = "";
    if (!isPureFlashcardMode && totalSubCatCount > 0 && count < totalSubCatCount) {
        posTag = ` <span style="background:#d1ecf1; color:#0c5460; padding:2px 6px; border-radius:4px; font-size:11px;">🏷️ 已選定 ${count} 個小類</span>`;
    }

    bar.innerHTML = `<div>${modeText}${posTag}</div> <div><span style="color:#d9534f;">⏳ 待消滅: ${pendingRound}/${totalDaily}</span> <span style="color:#28a745; margin-left:8px;">🎯 已消滅: ${masteredRound}</span></div>`;
}

async function showListView() {
    const isLoaded = await ensureDataLoaded(viewListBtn); 
    if (!isLoaded) return;
    
    const sortFilter = document.getElementById('sort-filter');
    if (sortFilter) {
        sortFilter.value = 'none'; 
    }
    
    mainCategoryFilter.value = 'all'; 
    searchInput.value = ''; 
    
    updateSubCategories(); 
    setupSection.classList.add('hidden'); 
    listSection.classList.remove('hidden');
}

// ⭐ 列表頁小類標籤渲染邏輯 (配合按鈕文字連動更新)
function updateSubCategories() {
    const mainCat = mainCategoryFilter.value;
    const container = document.getElementById('pos-filter-container');
    if (!container) return;
    
    container.innerHTML = '';
    selectedSubCats.clear(); 

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

    Array.from(subSet).sort().forEach(sub => {
        const btn = document.createElement('button');
        btn.innerText = sub;
        btn.className = 'tag-pill';
        btn.type = "button";
        btn.onclick = () => {
            if (selectedSubCats.has(sub)) {
                selectedSubCats.delete(sub);
                btn.classList.remove('active');
            } else {
                selectedSubCats.add(sub);
                btn.classList.add('active');
            }
            renderVocabList(); 
            updateTriggerBtnText(); // ⭐ 點擊標籤即時同步更新按鈕文字
        };
        container.appendChild(btn);
    });
    
    renderVocabList();
    updateTriggerBtnText(); // ⭐ 切換大類時同步重置按鈕文字
}

// ⭐ 列表篩選與渲染
function renderVocabList() {
    if (!vocabListContainer) return;
    vocabListContainer.innerHTML = '';
    currentFilteredWords = []; 
    const mainCat = mainCategoryFilter.value; 
    
    const sortElement = document.getElementById('sort-filter');
    const sortType = sortElement ? sortElement.value : 'none'; 
    const searchTerm = searchInput.value.trim().toLowerCase();

    vocabData.forEach((w) => {
        if (!w['詞性']) return;
        
        if (searchTerm) {
            const kanji = (w['漢字'] || '').toLowerCase();
            const kana = (w['假名拼音'] || '').toLowerCase();
            const zh = (w['中文意思'] || '').toLowerCase();
            if (!kanji.includes(searchTerm) && !kana.includes(searchTerm) && !zh.includes(searchTerm)) return; 
        }
        
        if (mainCat !== 'all') {
            if (!isWordMatchPOS(w, mainCat, 'all')) return; 
        }
        
        if (selectedSubCats.size > 0) {
            const wordPos = w['詞性'] || '';
            const isMatch = Array.from(selectedSubCats).some(sub => wordPos.includes(sub));
            if (!isMatch) return;
        }
        currentFilteredWords.push(w); 
    });

    if (sortType === 'level-asc') {
        currentFilteredWords.sort((a, b) => {
            const valA = a.nextReviewDate ? parseInt(a.level) : -1;
            const valB = b.nextReviewDate ? parseInt(b.level) : -1;
            return valA - valB; 
        });
    } else if (sortType === 'level-desc') {
        currentFilteredWords.sort((a, b) => {
            const valA = a.nextReviewDate ? parseInt(a.level) : -1;
            const valB = b.nextReviewDate ? parseInt(b.level) : -1;
            return valB - valA; 
        });
    } else if (sortType === 'error-desc') {
        currentFilteredWords.sort((a, b) => (parseFloat(b.errorRate) || 0) - (parseFloat(a.errorRate) || 0));
    }

    currentFilteredWords.forEach((w) => {
        const originalIndex = vocabData.indexOf(w);

        const item = document.createElement('div');
        item.className = "list-item";
        item.style = "display:flex; align-items:center; padding:10px 5px; border-bottom:1px solid #f1f1f1; cursor:pointer;";
        item.onclick = () => showWordDetail(originalIndex);
        
        const displayKana = w['假名拼音(分別)'] || w['假名拼音'] || "";
        const displayAccent = formatAccent(w['重音']);
        const lvLevel = w.nextReviewDate ? parseInt(w.level) : -1;
        
        let lvText = '未測'; let lvBg = '#f8f9fa'; let lvColor = '#6c757d';
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
                <div style="font-size: 10px; color: #999; font-family: monospace; margin-bottom: 4px;">#${w['單字編號'] || (originalIndex + 1)}</div>
                <div style="font-size: 9px; color: ${lvColor}; background: ${lvBg}; border-radius: 4px; padding: 2px 5px; font-weight: bold;">${lvText}</div>
            </div>
            <div style="flex: 1.5; text-align: left; padding-left: 5px; min-width: 0;">
                <div style="font-size:16px; font-weight:bold; color:#2c3e50; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" class="jp-text" lang="ja">${w['漢字']}</div>
                <div style="font-size:11px; color:#666;" class="jp-text" lang="ja">${displayKana} <span style="color:#007bff; font-weight:bold; margin-left:3px; font-family: sans-serif;">${displayAccent}</span></div>
            </div>
            <div style="flex: 0.9; text-align: center;">
                <div style="color: #6c757d; font-size: 10px; background: #f8f9fa; border-radius: 4px; margin: 0 5px; padding: 2px 0;">${w['詞性']}</div>
                <div style="color: #d9534f; font-size: 9px; font-weight: bold; margin-top:2px;">錯率: ${rateDisplay}</div>
            </div>
            <div style="flex: 1.2; color:#d9534f; font-weight:bold; font-size:14px; text-align:left; padding-left: 5px;">${w['中文意思']}</div>
            <div style="width: 35px; text-align: right;">
                <button onclick="event.stopPropagation(); playListAudio(${originalIndex})" style="background:none; border:none; font-size:18px; color:#007bff; cursor:pointer;">🔊</button>
            </div>
        `;
        vocabListContainer.appendChild(item);
    });

    const countDisplay = document.getElementById('vocab-count-display');
    if (countDisplay) { countDisplay.innerText = `共找到 ${currentFilteredWords.length} 個單字`; }
}

window.showWordDetail = (index) => {
    const w = vocabData[index];
    currentWord = w; 
    const detailKana = w['假名拼音(分別)'] || w['假名拼音'] || "";
    modalContent.innerHTML = `
        <span class="close-btn" onclick="closeModal()" style="position:absolute; top:10px; right:15px; font-size:28px; cursor:pointer;">&times;</span>
        <div style="font-size: 24px; margin-bottom:5px;" class="jp-text" lang="ja"><strong>${w['漢字']}</strong></div>
        <div style="color:#666; margin-bottom:10px;" class="jp-text" lang="ja">${detailKana} <span style="font-family: sans-serif;">${formatAccent(w['重音'])} | ${w['詞性']}</span></div>
        <div style="color:#d9534f; font-weight:bold; font-size:18px;">中文：${w['中文意思']}</div>
        <hr>
        <div class="sentence-row" onclick="playTTS('1')" style="cursor:pointer; padding:8px; background:#f9f9f9; border-radius:5px;">🔊 <strong style="font-family: sans-serif;">例句 1：</strong><span class="jp-text" lang="ja">${w['常用例句 1日']}</span><br><small style="color:#666;">${w['常用例句 1中']}</small></div>
        <div class="sentence-row" onclick="playTTS('2')" style="cursor:pointer; padding:8px; background:#f9f9f9; border-radius:5px; margin-top:10px;">🔊 <strong style="font-family: sans-serif;">例句 2：</strong><span class="jp-text" lang="ja">${w['常用例句 2日']}</span><br><small style="color:#666;">${w['常用例句 2中']}</small></div>
    `;
    wordModal.classList.remove('hidden');
};

window.closeModal = () => { wordModal.classList.add('hidden'); };

function closeListView() { 
    listSection.classList.add('hidden'); setupSection.classList.remove('hidden'); 
    closeSubPanel(); 
}

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

function startQuiz() { 
    processManualChoice(); processHwChoices();
    batchResultsContent.innerHTML = ""; feedback.innerHTML = ""; hwChoices = {}; currentManualChoice = null;
    updateStatsBar(); 

    let dueWords = [];
    if (isMistakeMode) {
        dueWords = Array.from(sessionMistakes);
        if (dueWords.length === 0) {
            alert("✅ 本次錯題已全數消滅！太棒了！");
            isMistakeMode = false; updateMistakeBtn(); homeBtn.click(); return;
        }
    } else {
        dueWords = [...roundPending];
        if (dueWords.length === 0) {
            document.getElementById('round-modal').classList.remove('hidden'); return;
        }
    }

    let selectedQType = qType.value;
    const hwChk = document.getElementById('hw-checkbox');
    isHwBatchMode = hwChk && hwChk.checked;
    
    let selectedATypes = [];
    if (selectedQType === 'mixed') {
        selectedATypes = Array.from(document.querySelectorAll('input[name="mixed-qtype"]:checked')).map(el => el.value);
        if (selectedATypes.length < 2) { alert("⚠️ 混合大亂鬥模式請至少勾選「兩項」要測驗的題型！"); return; }
    } else if (selectedQType !== 'flashcard' && !isHwBatchMode) {
        selectedATypes = Array.from(document.querySelectorAll('input[name="atype-chk"]:checked')).map(el => el.value);
        if (selectedATypes.length === 0) { alert("⚠️ 請至少勾選一項要作答的項目！"); return; }
    }

    if (aiToggle.checked && !isHwBatchMode) {
        if (selectedQType === 'flashcard') {
            alert("⚠️ AI 語意批改需要在作答框輸入文字，無法與「單字卡翻牌自評模式」同時使用喔！請改選其他出題形式或關閉 AI 模式。"); return;
        }
        const apiKey = geminiApiKeyInput.value.trim();
        if (!apiKey) { alert("請先輸入 Gemini API Key！"); return; }
        localStorage.setItem('geminiApiKey', apiKey); 
        if (selectedQType !== 'mixed' && !selectedATypes.includes('中文意思')) {
            alert("⚠️ AI 語意批改需要勾選「中文意思」作答項目才能運作！"); return;
        }
        isBatchMode = true; batchAnswers = []; currentBatchIdx = 0;
        batchQuestions = getBatchWords(dueWords, Math.min(AI_BATCH_SIZE, dueWords.length));
    } 
    else if (isHwBatchMode) {
        isBatchMode = false; hwQuestions = getBatchWords(dueWords, Math.min(HW_BATCH_SIZE, dueWords.length));
        setupSection.classList.add('hidden'); batchResultsArea.classList.add('hidden'); quizSection.classList.remove('hidden'); 
        renderHwBatch(); return; 
    } 
    else { isBatchMode = false; isHwBatchMode = false; }

    setupSection.classList.add('hidden'); batchResultsArea.classList.add('hidden');
    document.getElementById('question-area').classList.remove('hidden');
    quizSection.classList.remove('hidden'); 
    nextQuestion(); 
}

window.restartRound = () => {
    document.getElementById('round-modal').classList.add('hidden');
    roundPending = [...currentFullPool]; startQuiz();
};

function getWeightedRandomWord(pool) {
    let totalWeight = 0;
    let weights = pool.map(w => {
        let weight = 1 + (w.errorRate * 9); 
        totalWeight += weight; return weight;
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
    let selected = []; let tempPool = [...pool];
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
            isMistakeMode = false; updateMistakeBtn(); homeBtn.click(); return null;
        }
    } else {
        dueWords = [...roundPending];
        if (dueWords.length === 0) {
            document.getElementById('round-modal').classList.remove('hidden'); return null;
        }
    }
    return getWeightedRandomWord(dueWords);
}

function nextQuestion() {
    processManualChoice(); stopAllAudio(); updateStatsBar(); 
    feedback.innerHTML = ''; kanjiInput.value = ''; kanaInput.value = ''; chineseInput.value = ''; 
    nextBtn.classList.add('hidden'); clearCanvas();
    
    currentWord = getNextWord();
    if (!currentWord) return;

    playAudioBtn.classList.add('hidden'); inputArea.classList.add('hidden');
    canvasArea.classList.add('hidden'); flashcardArea.classList.add('hidden');
    document.getElementById('question-area').classList.remove('hidden');

    currentActiveQType = qType.value;
    
    if (currentActiveQType === 'mixed') {
        const mixQTypes = Array.from(document.querySelectorAll('input[name="mixed-qtype"]:checked')).map(el => el.value);
        currentActiveQType = mixQTypes[Math.floor(Math.random() * mixQTypes.length)];
        if (currentActiveQType === 'audio') currentActiveATypes = [['漢字'], ['假名拼音'], ['中文意思']][Math.floor(Math.random()*3)];
        else if (currentActiveQType === '漢字') currentActiveATypes = [['假名拼音'], ['中文意思']][Math.floor(Math.random()*2)];
        else if (currentActiveQType === '中文意思') currentActiveATypes = [['漢字'], ['假名拼音']][Math.floor(Math.random()*2)];
        else if (currentActiveQType === 'sentence') currentActiveATypes = [['漢字'], ['假名拼音']][Math.floor(Math.random()*2)];
        else if (currentActiveQType === 'flashcard') currentActiveATypes = ['漢字', '假名拼音', '中文意思'];
    } else if (currentActiveQType !== 'flashcard') {
        currentActiveATypes = Array.from(document.querySelectorAll('input[name="atype-chk"]:checked')).map(el => el.value);
    }

    if (currentActiveQType === 'flashcard') {
        document.getElementById('question-area').classList.add('hidden');
        inputArea.classList.add('hidden'); canvasArea.classList.add('hidden');
        flashcardArea.classList.remove('hidden');
        
        document.getElementById('fc-quiz-ctrl').classList.remove('hidden');
        
        const inner = document.getElementById('flashcard-inner');
        if (inner.classList.contains('flipped')) {
            isFlipping = true; inner.classList.remove('flipped');
            setTimeout(() => { renderFlashcardContent(currentWord, false); isFlipping = false; }, 280);
        } else { renderFlashcardContent(currentWord, false); }
        return;
    }

    let qName = currentActiveQType === 'audio' ? '聽力' : (currentActiveQType === 'sentence' ? '句子填空' : currentActiveQType);
    let hintLabels = currentActiveATypes.map(t => t==='假名拼音'?'拼音':(t==='中文意思'?'中文':'漢字')).join(' + ');
    let hintText = `[${qName}] 答題：<span style="color:#007bff">${hintLabels}</span> | 重音：${formatAccent(currentWord['重音']) || '-'}`;
    if (isBatchMode) hintText += ` | <strong style="color:red;">AI 模式: 第 ${currentBatchIdx + 1}/${batchQuestions.length} 題</strong>`;
    hintDisplay.innerHTML = hintText;

    inputArea.classList.remove('hidden');
    kanjiInput.classList.add('hidden'); kanaInput.classList.add('hidden'); chineseInput.classList.add('hidden');
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
        questionDisplay.innerHTML = `<div style="font-size:18px; color:#666; margin-bottom:10px;">${cnTrans}</div><div class="jp-text" lang="ja">${sentenceQ}</div>`;
    } else if (currentActiveQType === 'audio') {
        questionDisplay.innerText = "🎧 聽力測驗 (聽音拼寫)";
        playAudioBtn.classList.remove('hidden'); playFullSequence(); 
    } else if (currentActiveQType === '中文意思') {
        questionDisplay.innerHTML = `${currentWord['中文意思']} <span style="font-size:18px; color:#e67e22;">[${currentWord['詞性']}]</span>`;
    } else if (currentActiveQType === '漢字') {
        questionDisplay.innerHTML = `<span class="jp-text" lang="ja">${currentWord['漢字'] || currentWord['假名拼音']}</span>`;
    } 
}

function renderFlashcardContent(word, isPureMode = false) {
    const inner = document.getElementById('flashcard-inner');
    inner.classList.remove('flipped'); 
    let frontType = 'jp';
    const checkedRadio = document.querySelector('input[name="fc-front-type"]:checked');
    if (!isPureMode && checkedRadio) { frontType = checkedRadio.value; }

    const frontTag = document.getElementById('fc-front-tag');
    const frontWord = document.getElementById('fc-front-word');
    const frontHint = document.getElementById('fc-front-hint');

    if (frontType === 'cn') {
        frontTag.innerText = "Q. 中文回想日文"; frontWord.innerText = word['中文意思']; frontHint.innerText = "點擊卡片或按空白鍵 (Space) 看對應日文";
    } else if (frontType === 'audio') {
        frontTag.innerText = "Q. 聽音辨意"; frontWord.innerText = "🎧 請聽語音回想單字"; frontHint.innerText = "點擊卡片或按空白鍵 (Space) 看對應單字與翻譯"; playTTS('word'); 
    } else {
        frontTag.innerText = isPureMode ? `卡片瀏覽 #${word['單字編號'] || (vocabData.indexOf(word) + 1)}` : "Q. 日文單字";
        frontWord.innerText = word['漢字'] || word['假名拼音']; frontHint.innerText = "點擊卡片或按空白鍵 (Space) 翻到背面看解析"; playTTS('word'); 
    }

    const displayKana = word['假名拼音(分別)'] || word['假名拼音'] || "";
    const cleanAccent = formatAccent(word['重音']); 
    document.getElementById('fc-back-word').innerText = word['漢字'] || word['假名拼音'];
    document.getElementById('fc-back-kana').innerText = `${displayKana} ${cleanAccent}`.trim();
    document.getElementById('fc-back-meaning').innerHTML = `中文：${word['中文意思']} <span style="font-size:14px; color:#6c757d; font-weight:normal;">[${word['詞性'] || '-'}]</span>`;

    let sentHTML = "";
    if (word['常用例句 1日']) {
        sentHTML += `<div class="sentence-row" onclick="event.stopPropagation(); playTTS('1')" style="padding: 10px 14px; margin-top: 8px; background: #f8f9fa; border-radius: 8px; cursor: pointer; border-left: 3px solid #007bff;">
            🔊 <strong style="font-family:sans-serif; color:#007bff;">例句 1：</strong><span class="jp-text" lang="ja">${word['常用例句 1日']}</span><br><small style="color:#666;">${word['常用例句 1中'] || ''}</small></div>`;
    }
    if (word['常用例句 2日']) {
        sentHTML += `<div class="sentence-row" onclick="event.stopPropagation(); playTTS('2')" style="padding: 10px 14px; margin-top: 8px; background: #f8f9fa; border-radius: 8px; cursor: pointer; border-left: 3px solid #28a745;">
            🔊 <strong style="font-family:sans-serif; color:#28a745;">例句 2：</strong><span class="jp-text" lang="ja">${word['常用例句 2日']}</span><br><small style="color:#666;">${word['常用例句 2中'] || ''}</small></div>`;
    }
    if (!sentHTML) sentHTML = `<div style="color:#999; font-size:13px; text-align:center; padding:10px;">(暫無常用例句)</div>`;
    document.getElementById('fc-back-sentences').innerHTML = sentHTML;
}

window.flipFlashcard = () => {
    if (isFlipping) return;
    document.getElementById('flashcard-inner').classList.toggle('flipped');
};

window.gradeFlashcard = (isCorrect) => {
    if (isFlipping) return;
    commitWordResult(currentWord, isCorrect);
    if (isCorrect) {
        nextQuestion();
    } else {
        flashcardArea.classList.add('hidden');
        showFullCard(false, ["(小卡自評忘記)"]);
    }
};

window.startPureFlashcardMode = () => {
    if (currentFilteredWords.length === 0) {
        alert("⚠️ 目前篩選結果沒有任何單字，請先選擇分類或清除搜尋關鍵字！"); return;
    }
    stopAllAudio();
    isPureFlashcardMode = true;
    
    currentFullPool = [...currentFilteredWords];
    roundPending = [...currentFullPool];
    
    listSection.classList.add('hidden');
    setupSection.classList.add('hidden');
    quizSection.classList.remove('hidden');
    
    qType.value = 'flashcard';
    startQuiz();
};

window.playBatchAudio = (idx, type = 'word') => {
    const w = hwQuestions[idx];
    const baseName = getBaseName(w);
    const audioUrl = `./audio/${encodeURIComponent(baseName)}${type==='word'?'':`_${type}`}.wav`;
    const player = new Audio(audioUrl);
    player.play().catch(() => { console.warn(`音檔不存在: ${audioUrl}`); });
};

function renderHwBatch() {
    stopAllAudio(); updateStatsBar(); 
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
            if (w['常用例句 1日']) audioBtns += `<button onclick="playBatchAudio(${idx}, '1')" class="secondary-btn" style="padding:6px 12px; margin-right:5px; margin-bottom:5px;">🔊 聽例句 1</button>`;
            if (w['常用例句 2日']) audioBtns += `<button onclick="playBatchAudio(${idx}, '2')" class="secondary-btn" style="padding:6px 12px; margin-right:5px; margin-bottom:5px;">🔊 聽例句 2</button>`;
            qText = `<div style="display:inline-block;">${audioBtns}</div> <span style="color:#e67e22; font-size:14px; font-weight:normal;">[${w['詞性']}]</span>`;
        } else if (currentQType === '中文意思') {
            qText = `${w['中文意思']} <span style="color:#e67e22; font-size:14px; font-weight:normal;">[${w['詞性']}]</span>`;
        } else if (currentQType === 'sentence') {
            const sIdx = (Math.random() < 0.5 && w['常用例句 2題目']) ? 2 : 1;
            qText = `<div style="font-size:14px; color:#666; font-weight:normal;">${w[`常用例句 ${sIdx}中`]}</div><div class="jp-text" lang="ja">${w[`常用例句 ${sIdx}題目`]}</div>`;
        } else if (currentQType === 'flashcard') {
            qText = `<span class="jp-text" lang="ja">${w['漢字'] || w['假名拼音']}</span> <span style="color:#666; font-size:13px;">(翻開看中文意思)</span>`;
        } else {
            qText = `<span class="jp-text" lang="ja">${w['漢字'] || w['假名拼音']}</span>`;
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
                    <div style="font-size: 22px;" class="jp-text" lang="ja"><strong>${w['漢字']}</strong> (${displayKana})</div>
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

window.flipAllHwCards = () => { hwQuestions.forEach((_, idx) => flipHwCard(idx)); };

window.gradeHwCard = (idx, isCorrect) => {
    hwChoices[idx] = isCorrect;
    const btnTrue = document.getElementById(`hw-btn-true-${idx}`);
    const btnFalse = document.getElementById(`hw-btn-false-${idx}`);
    if (isCorrect) {
        btnTrue.style.background = '#28a745'; btnTrue.style.color = 'white';
        btnFalse.style.background = '#fdeeed'; btnFalse.style.color = '#dc3545';
    } else {
        btnFalse.style.background = '#dc3545'; btnFalse.style.color = 'white';
        btnTrue.style.background = '#e8f5e9'; btnTrue.style.color = '#28a745';
    }
    if (Object.keys(hwChoices).length >= hwQuestions.length) {
        document.getElementById('hw-finish-area').classList.remove('hidden');
    }
};

window.finishHwBatch = () => { processHwChoices(); homeBtn.click(); };
window.nextHwBatch = () => { processHwChoices(); startQuiz(); };

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
        btnTrue.style.background = '#28a745'; btnTrue.style.color = 'white';
        btnFalse.style.background = '#fdeeed'; btnFalse.style.color = '#dc3545';
    } else {
        btnFalse.style.background = '#dc3545'; btnFalse.style.color = 'white';
        btnTrue.style.background = '#e8f5e9'; btnTrue.style.color = '#28a745';
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
            <div style="font-size: 24px;" class="jp-text" lang="ja"><strong>${currentWord['漢字']}</strong> (${displayKana})</div>
            <div style="color: #d9534f; font-weight: bold;">中文：${currentWord['中文意思']}</div>
            <div style="font-size: 14px; color: #777;">[${currentWord['詞性']}] | 重音：${formatAccent(currentWord['重音']) || '-'}</div>
            
            <button onclick="showWordDetail(${wordIdx})" class="secondary-btn" style="margin-top:10px; width:auto; padding:6px 12px; font-size:12px; font-weight:bold; color:#007bff; background:#e9ecef; border-radius:8px;">🔍 開啟詳細單字卡</button>
            <hr>
            <div style="font-size: 15px; background: #f1f1f1; padding: 10px; border-radius: 8px;">
                <div class="sentence-row" onclick="playTTS('1')" style="cursor:pointer; margin-bottom:10px;">🔊 <strong style="font-family: sans-serif;">例句 1：</strong><span class="jp-text" lang="ja">${currentWord['常用例句 1日']}</span><br><small style="color:#666;">${currentWord['常用例句 1中']}</small></div>
                <div class="sentence-row" onclick="playTTS('2')" style="cursor:pointer;">🔊 <strong style="font-family: sans-serif;">例句 2：</strong><span class="jp-text" lang="ja">${currentWord['常用例句 2日']}</span><br><small style="color:#666;">${currentWord['常用例句 2中']}</small></div>
            </div>
        </div>
    `;
    nextBtn.classList.remove('hidden');
}

function updateLocalNextReviewDate(wordObj, status) {
    const intervals = [0, 1, 2, 4, 7, 15, 30, 60, 90];
    let daysToAdd = 0;
    if (status === "SUCCESS" || status === "UNDO") { daysToAdd = intervals[wordObj.level] || 90; } 
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
        batchAnswers.push({ word: currentWord, userC: chineseInput.value.trim(), userK: kanjiInput.value.trim() });
        currentBatchIdx++;
        if (currentBatchIdx < batchQuestions.length) nextQuestion();
        else await processBatchResults(); 
        return;
    }

    let isCorrect = true; let userDisplayArr = [];
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
        } else { if (!kaPoss.includes(uKa)) isCorrect = false; }
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
        id: idx, 日文單字: item.word['漢字'] || item.word['假名拼音'], 標準答案: item.word['中文意思'], 使用者輸入: item.userC
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
            method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        if (!resData.candidates || !resData.candidates[0].content) { throw new Error("AI 未回傳內容（可能被系統阻擋）。"); }
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
                <h4 style="margin: 0 0 8px 0; font-size: 18px;" class="jp-text" lang="ja">${statusIcon} ${item.word['漢字']} (${displayKana})</h4>
                <p style="margin: 3px 0; font-size: 14px; color: #555;">標準答案: ${item.word['中文意思']}</p>
                <p style="margin: 3px 0; font-size: 14px; color: #007bff; font-weight: bold;">
                    你的輸入: ${item.userC} ${currentActiveATypes.includes('漢字') ? ` (漢字: <span class="jp-text" lang="ja">${item.userK}</span>)` : ''}
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
    isMistakeMode = false; updateMistakeBtn(); stopAllAudio();
    quizSection.classList.add('hidden'); batchResultsArea.classList.add('hidden'); 
    setupSection.classList.remove('hidden'); 
    closeSubPanel(); 
    refreshHomeStats(); 
};

homeBtn.onclick = () => { 
    processManualChoice(); processHwChoices();
    isMistakeMode = false; isPureFlashcardMode = false; updateMistakeBtn();
    stopAllAudio(); 
    quizSection.classList.add('hidden'); batchResultsArea.classList.add('hidden'); 
    if (isPureFlashcardMode) {
        isPureFlashcardMode = false;
        listSection.classList.remove('hidden');
    } else {
        setupSection.classList.remove('hidden'); 
        closeSubPanel(); 
    }
    refreshHomeStats(); 
};

function handleEnter(e) {
    const now = Date.now();
    if (now - lastEnterTime < ENTER_CD_MS) { e.preventDefault(); return; }
    lastEnterTime = now;
    if (!nextBtn.classList.contains('hidden')) { nextQuestion(); } 
    else if (!flashcardArea.classList.contains('hidden')) {
        if (isFlipping) return;
        const inner = document.getElementById('flashcard-inner');
        if (!inner.classList.contains('flipped')) {
            flipFlashcard();
        } else {
            gradeFlashcard(true);
        }
    }
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
    if (quizSection.classList.contains('hidden')) return;

    if (!nextBtn.classList.contains('hidden')) {
        if (e.code === 'Space' || e.key === 'ArrowRight' || e.key === 'Enter') {
            e.preventDefault();
            const now = Date.now();
            if (now - lastEnterTime < ENTER_CD_MS) return;
            lastEnterTime = now;
            nextQuestion(); return;
        }
    }

    if (!flashcardArea.classList.contains('hidden')) {
        if (isFlipping) return;
        const inner = document.getElementById('flashcard-inner');
        
        if (e.code === 'Space') {
            e.preventDefault();
            flipFlashcard(); 
            return;
        }
        
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (inner.classList.contains('flipped')) {
                gradeFlashcard(true); 
            } else {
                flipFlashcard();      
            }
            return;
        }
        
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            gradeFlashcard(false); 
            return;
        }
    }

    if (e.key === 'Enter') {
        if (document.activeElement === kanjiInput || document.activeElement === kanaInput || document.activeElement === chineseInput) return;
        e.preventDefault(); handleEnter(e);
    }
}, true); 

searchInput.addEventListener('input', renderVocabList);

async function refreshHomeStats() {
    try {
        const { data, error } = await supabaseClient
            .from('vocab_progress')
            .select('*');
            
        if (error) throw error;
        
        const formattedData = data.map(item => ({
            ...item,
            wordId: item.word_id,
            errorCount: item.error_count,
            drawCount: item.draw_count,
            errorRate: item.error_rate,
            firstReviewDate: item.first_review_date,
            nextReviewDate: item.next_review_date,
            lastReview: item.last_review
        }));

        renderErrorChart(formattedData); 
        return formattedData; 
    } catch (e) {
        console.error("Supabase 同步失敗:", e);
        return null;
    }
}

window.undo = () => {
    currentWord.errorCount--; currentWord.level += 2; 
    updateLocalNextReviewDate(currentWord, "UNDO");
    roundPending.push(currentWord);
    currentWord.errorRate = currentWord.drawCount > 0 ? (currentWord.errorCount / currentWord.drawCount) : 0;
    syncToCloud("UNDO", currentWord);
    feedback.innerHTML = `<h3 style="color:blue;">✨ 已取消懲罰！</h3>` + (feedback.innerHTML.split('</button>')[1] || "");
};

function syncToCloud(op, wordObj) {
    const targetWord = wordObj || currentWord;
    
    if (op === "SUCCESS" || op === "UNDO") { sessionMistakes.delete(targetWord); } 
    else if (op === "ERROR") { sessionMistakes.add(targetWord); }
    updateMistakeBtn(); 
    if (op === "SUCCESS" || op === "ERROR" || op === "UNDO") { updateStatsBar(); }
    
    const data = { 
        word_id: targetWord.uniqueId,
        error_count: targetWord.errorCount,
        draw_count: targetWord.drawCount,
        error_rate: targetWord.errorRate,
        first_review_date: targetWord.firstReviewDate,
        next_review_date: targetWord.nextReviewDate,
        level: targetWord.level,
        last_review: new Date().toISOString()
    };

    supabaseClient
        .from('vocab_progress')
        .upsert(data)
        .then(({ error }) => {
            if (error) console.error("Supabase 同步失敗:", error);
        });
}

const exportModal = document.getElementById('export-modal');
window.openExportModal = () => {
    if (currentFilteredWords.length === 0) { alert("⚠️ 目前篩選結果沒有任何單字可以匯出！"); return; }
    document.getElementById('export-count').innerText = currentFilteredWords.length;
    exportModal.classList.remove('hidden');
};
window.closeExportModal = () => { exportModal.classList.add('hidden'); };

function getExportData() {
    const selectedCols = Array.from(document.querySelectorAll('input[name="export-col"]:checked')).map(el => el.value);
    if (selectedCols.length === 0) { alert("⚠️ 請至少勾選一個要匯出的欄位！"); return null; }
    const rows = currentFilteredWords.map((w, idx) => {
        return selectedCols.map(col => {
            if (col === '單字編號') return w['單字編號'] || (w.originalIndex + 1);
            if (col === '假名拼音') return w['假名拼音(分別)'] || w['假名拼音'] || "";
            return w[col] || "";
        });
    });
    return { headers: selectedCols, rows: rows };
}

window.copyVocabTable = () => {
    const data = getExportData(); if (!data) return;
    let textStr = data.headers.join('\t') + '\n';
    data.rows.forEach(row => { textStr += row.join('\t') + '\n'; });
    navigator.clipboard.writeText(textStr).then(() => {
        alert(`✅ 成功複製 ${data.rows.length} 個單字！\n你可以直接「貼上」到 Excel、Notion 或 Google Sheets 中，它會自動對齊表格列！`);
        closeExportModal();
    }).catch(err => { alert("❌ 複製失敗，請檢查瀏覽器權限。"); });
};

window.downloadVocabCSV = () => {
    const data = getExportData(); if (!data) return;
    let csvContent = "\uFEFF"; 
    const escapeCSV = (arr) => arr.map(item => `"${String(item).replace(/"/g, '""')}"`).join(',');
    csvContent += escapeCSV(data.headers) + "\r\n";
    data.rows.forEach(row => { csvContent += escapeCSV(row) + "\r\n"; });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const mainCat = mainCategoryFilter.value === 'all' ? '全部單字' : mainCategoryFilter.value;
    const subCatStr = selectedSubCats.size > 0 ? `_已選${selectedSubCats.size}類` : '';
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `N3單字表_${mainCat}${subCatStr}_${dateStr}.csv`);
    
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    closeExportModal();
};

window.onload = async () => {
    refreshHomeStats();
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) { geminiApiKeyInput.value = savedKey; }
    const savedQType = localStorage.getItem('savedQType');
    if (savedQType) qType.value = savedQType;
    qType.dispatchEvent(new Event('change'));

    if (vocabData.length === 0) {
        await loadVocabCSV();
    }
    buildCategoryTree();
};

viewListBtn.onclick = showListView;
submitBtn.onclick = checkAnswer;
nextBtn.onclick = nextQuestion;
playAudioBtn.onclick = () => playFullSequence();
homeBtnList.onclick = () => { 
    stopAllAudio(); listSection.classList.add('hidden'); setupSection.classList.remove('hidden'); closeSubPanel(); 
};
mainCategoryFilter.onchange = updateSubCategories;
resetDataBtn.onclick = async () => {
    if (confirm("⚠️ 確定要重設所有進度嗎？")) {
        const { error } = await supabaseClient
            .from('vocab_progress')
            .delete()
            .neq('word_id', 'non_existent_id'); 

        if (!error) { alert("重設成功！"); location.reload(); }
        else { alert("重設失敗: " + error.message); }
    }
};
window.onclick = (event) => { 
    if (event.target == wordModal || event.target == document.getElementById('round-modal') || event.target == exportModal) {
        closeModal(); 
        document.getElementById('round-modal').classList.add('hidden');
        if (typeof closeExportModal === 'function') closeExportModal();
    }
};