import csv
import asyncio
import os
import re
import json
import requests

# --- 設定區 ---
AUDIO_DIR = 'audio'
VOICEVOX_URL = "http://127.0.0.1:50021"
SPEAKER_ID = 2     # 四國めたん
# --------------

if not os.path.exists(AUDIO_DIR):
    os.makedirs(AUDIO_DIR)

def clean_text_for_speech(text):
    if not text: return ""
    # 移除括號內的補充說明
    text = re.sub(r'[\(\（].*?[\)\）]', '', text)
    return text.strip()

def voicevox_synthesis(text, output_path):
    """將文字送入 VOICEVOX 合成並直接存為 WAV"""
    try:
        # 1. 建立 Audio Query
        query_res = requests.post(
            f"{VOICEVOX_URL}/audio_query",
            params={'text': text, 'speaker': SPEAKER_ID}
        )
        if query_res.status_code != 200: return False
        
        query_data = query_res.json()
        query_data['speedScale'] = 1.05 

        # 2. 正式合成音訊 (WAV)
        synth_res = requests.post(
            f"{VOICEVOX_URL}/synthesis",
            params={'speaker': SPEAKER_ID},
            data=json.dumps(query_data)
        )
        if synth_res.status_code != 200: return False

        # 3. ⭐ 直接儲存二進位內容 (原生就是 WAV 格式)
        with open(output_path, "wb") as f:
            f.write(synth_res.content)
        return True
    except Exception as e:
        print(f"  ❌ 錯誤: {e}")
        return False

async def generate_audio():
    try:
        requests.get(VOICEVOX_URL)
    except:
        print("❌ 錯誤：請先啟動 VOICEVOX 軟體！")
        return

    try:
        with open('vocab.csv', mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            
            all_tasks = []
            for row in rows:
                kanji = row.get('漢字', '').strip()
                kana = row.get('假名拼音', '').strip()
                
                # 優先用漢字，確保 AI 能判斷正確重音
                speech_text = kanji if kanji else kana
                if not speech_text: continue
                
                # 檔案命名基礎
                base_name = speech_text.replace('/', '_')

                # 任務清單：改回 .wav 副檔名
                tasks_in_row = [
                    (speech_text, f"{base_name}.wav"),
                    (row.get('常用例句 1日'), f"{base_name}_1.wav"),
                    (row.get('常用例句 2日'), f"{base_name}_2.wav")
                ]
                
                for content, fname in tasks_in_row:
                    if content and content.strip():
                        all_tasks.append((content, fname))

            # 偵測是否已存在錄音
            missing_tasks = [t for t in all_tasks if not os.path.exists(os.path.join(AUDIO_DIR, t[1]))]

            print(f"📊 掃描完成。剩餘待生成：{len(missing_tasks)} / 總計：{len(all_tasks)}")

            if len(missing_tasks) == 0:
                print("🎉 所有 WAV 音檔都已就緒！")
                return

            for i, (text, filename) in enumerate(missing_tasks):
                speech_content = clean_text_for_speech(text)
                output_path = os.path.join(AUDIO_DIR, filename)

                print(f"[{i+1}/{len(missing_tasks)}] 正在生成 (WAV): {filename}")
                
                # 直接在迴圈中執行 (WAV 不需要外部轉檔工具，速度極快)
                success = voicevox_synthesis(speech_content, output_path)
                
                if success:
                    await asyncio.sleep(0.05) 
                else:
                    print(f"  ❌ 失敗: {filename}")
            
            print(f"\n✅ WAV 音檔補錄完畢！")

    except Exception as e:
        print(f"❌ 嚴重錯誤: {e}")

if __name__ == "__main__":
    asyncio.run(generate_audio())