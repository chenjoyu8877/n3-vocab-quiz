import json
import requests
import os

# --- 設定區 ---
VOICEVOX_URL = "http://127.0.0.1:50021"
SPEAKER_ID = 2        # 四國めたん
AUDIO_DIR = 'audio'   # 你的音檔存放資料夾

# ⭐ 在這裡填寫你要修正的單字
# 格式： "原本的檔名(漢字)": "你想要AI讀的正確假名"
WORDS_TO_FIX = {
    "否": "いや"  # 或是 "つらい"，視你的單字而定
}
# --------------

def voicevox_synthesis(text, output_path):
    """呼叫 VOICEVOX 合成並儲存"""
    try:
        # 1. 建立查詢
        query_res = requests.post(
            f"{VOICEVOX_URL}/audio_query",
            params={'text': text, 'speaker': SPEAKER_ID}
        )
        if query_res.status_code != 200:
            print(f"  ❌ 無法建立查詢: {text}")
            return False
        
        query_data = query_res.json()
        query_data['speedScale'] = 1.05  # 語速設定

        # 2. 合成音訊
        synth_res = requests.post(
            f"{VOICEVOX_URL}/synthesis",
            params={'speaker': SPEAKER_ID},
            data=json.dumps(query_data)
        )
        if synth_res.status_code != 200:
            print(f"  ❌ 合成失敗: {text}")
            return False

        # 3. 儲存檔案 (WAV)
        with open(output_path, "wb") as f:
            f.write(synth_res.content)
        return True
    except Exception as e:
        print(f"  ❌ 發生錯誤: {e}")
        return False

def main():
    # 檢查 VOICEVOX 是否開啟
    try:
        requests.get(VOICEVOX_URL)
    except:
        print("❌ 錯誤：請先啟動 VOICEVOX 軟體！")
        return

    if not os.path.exists(AUDIO_DIR):
        print(f"❌ 錯誤：找不到 '{AUDIO_DIR}' 資料夾！")
        return

    print(f"🚀 開始修正特定音檔 (共 {len(WORDS_TO_FIX)} 個)...")

    for kanji, kana in WORDS_TO_FIX.items():
        # 檔名維持漢字 (例如: 明日.wav)
        filename = f"{kanji}.wav"
        output_path = os.path.join(AUDIO_DIR, filename)
        
        print(f"🔄 正在修正 [{kanji}] -> 讀音改為: {kana}")
        
        # 執行合成 (傳入的是假名 kana)
        success = voicevox_synthesis(kana, output_path)
        
        if success:
            print(f"  ✅ 成功覆蓋檔案: {filename}")
        else:
            print(f"  ❌ 修正失敗: {filename}")

    print("\n✨ 所有指定單字已修正完畢！")

if __name__ == "__main__":
    main()