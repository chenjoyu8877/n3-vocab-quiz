import csv
import asyncio
import edge_tts
import os
import re

AUDIO_DIR = 'audio'
if not os.path.exists(AUDIO_DIR):
    os.makedirs(AUDIO_DIR)

# 清理文字功能 (過濾括號)
def clean_text_for_speech(text):
    if not text: return ""
    text = re.sub(r'[\(\（].*?[\)\）]', '', text)
    return text.replace('/', '、').strip()

async def generate_audio():
    VOICE = "ja-JP-NanamiNeural"
    
    try:
        with open('vocab.csv', mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            
            # --- 第一階段：掃描任務清單 ---
            all_tasks = []
            for row in rows:
                raw_base = row.get('漢字') or row.get('假名拼音')
                if not raw_base: continue
                base_name = raw_base.strip().replace('/', '_')

                # 整理出單字、例句1、例句2 的預期檔名與內容
                possible_tasks = [
                    (raw_base, f"{base_name}.mp3"),
                    (row.get('常用例句 1'), f"{base_name}_1.mp3"),
                    (row.get('常用例句 2'), f"{base_name}_2.mp3")
                ]
                for content, fname in possible_tasks:
                    if content and content.strip():
                        all_tasks.append((content, fname))

            # --- 第二階段：比對已存在的檔案 ---
            missing_tasks = []
            for content, fname in all_tasks:
                if not os.path.exists(os.path.join(AUDIO_DIR, fname)):
                    missing_tasks.append((content, fname))

            # --- 第三階段：印出統計報告 ---
            total = len(all_tasks)
            missing = len(missing_tasks)
            done = total - missing

            print("=" * 40)
            print(f"📊 題庫掃描報告")
            print(f"🔹 總計應有音檔：{total} 個")
            print(f"✅ 已經錄製完成：{done} 個")
            print(f"⏳ 剩餘需要下載：{missing} 個")
            print("=" * 40)

            if missing == 0:
                print("🎉 所有音檔都已經準備好了！無需下載。")
                return

            # --- 第四階段：正式開始下載（僅補錄缺失的部分） ---
            print(f"🚀 開始補錄剩餘的 {missing} 個音檔...\n")
            
            for i, (raw_content, filename) in enumerate(missing_tasks):
                speech_content = clean_text_for_speech(raw_content)
                output_path = os.path.join(AUDIO_DIR, filename)

                success = False
                for attempt in range(3):
                    try:
                        # 顯示目前補錄進度
                        print(f"[{i+1}/{missing}] 正在補錄: {filename}...")
                        communicate = edge_tts.Communicate(speech_content, VOICE)
                        await communicate.save(output_path)
                        
                        # 加上小暫停防止被微軟封鎖
                        await asyncio.sleep(0.8) 
                        success = True
                        break 
                    except Exception as e:
                        print(f"  ⚠ 失敗 (重試 {attempt+1}): {e}")
                        await asyncio.sleep(2)
                
                if not success:
                    print(f"  ❌ 跳過失敗檔案: {filename}")
            
            print(f"\n✅ 補錄完成！")

    except Exception as e:
        print(f"❌ 嚴重錯誤: {e}")

if __name__ == "__main__":
    asyncio.run(generate_audio())