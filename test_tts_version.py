import os
import urllib.request
import json
import base64

def test_tts(api_version="v1beta"):
    api_key = os.environ.get("GEMINI_API_KEY") 
    if not api_key:
        print("No GEMINI_API_KEY")
        return

    url = f"https://generativelanguage.googleapis.com/{api_version}/models/gemini-2.5-flash-tts:generateContent?key={api_key}"
    data = {"contents": [{"role": "user", "parts": [{"text": "Hello world"}]}]}
    req = urllib.request.Request(url, json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode())
            print(f"[{api_version}] Success!")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print(f"[{api_version}] Error {e.code}: {err_body}")

test_tts("v1alpha")
test_tts("v1beta")
test_tts("v1")
