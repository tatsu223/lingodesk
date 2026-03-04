import os
import urllib.request
import json
import base64

def test_tts():
    api_key = os.environ.get("GEMINI_API_KEY") # ユーザーの環境変数を期待
    if not api_key:
        print("No GEMINI_API_KEY")
        return

    url = f"https://generativelanguage.googleapis.com/v1alpha/models/gemini-2.0-flash:generateContent?key={api_key}"
    data = {
        "systemInstruction": {
            "parts": [
                { "text": "You are a text-to-speech engine. Read the following text aloud exactly as provided, without adding any conversational filler, introductory remarks, explanations, or any other additional words." }
            ]
        },
        "contents": [{"role": "user", "parts": [{"text": "Hello world"}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": { "voiceName": "Kore" }
                }
            }
        }
    }

    req = urllib.request.Request(url, json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode())
            print("Success!")
            if 'candidates' in res and len(res['candidates']) > 0:
                parts = res['candidates'][0]['content']['parts']
                has_audio = any('inlineData' in part and part['inlineData'].get('mimeType', '').startswith('audio') for part in parts)
                print(f"Has Audio: {has_audio}")
            else:
                print(res)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print(f"Error {e.code}: {err_body}")

test_tts()
