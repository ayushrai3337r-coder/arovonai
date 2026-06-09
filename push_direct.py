import json
import urllib.request
import urllib.parse

with open("wiki_data/knowledge.json", 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Total articles: {len(data)}")

PROJECT_ID = "arovonai"

def build_tf(text):
    stop = {'the','a','an','and','or','in','on','at','to','for','of','with','is','are','was','were','be','been','have','has','had','do','does','did','will','would','could','should','this','that','i','you','he','she','it','we','they','my','your','his','her','its','also','from','by','as','not','all','can','may','more','one','two','some','other','than','then','there','their','which','who','what','how','when','where'}
    words = text.lower().split()
    tf = {}
    for w in words:
        w = ''.join(c for c in w if c.isalnum())
        if len(w) > 2 and w not in stop:
            tf[w] = tf.get(w, 0) + 1
    return dict(sorted(tf.items(), key=lambda x: x[1], reverse=True)[:150])

def upload(title, text):
    tf = build_tf(text)
    safe_id = ''.join(c if c.isalnum() or c == '_' else '_' for c in title)[:100]
    
    doc = {
        "fields": {
            "name": {"stringValue": title},
            "text": {"stringValue": text[:6000]},
            "wordCount": {"integerValue": str(len(text.split()))},
            "tf": {"mapValue": {"fields": {
                k: {"integerValue": str(v)} for k, v in tf.items()
            }}}
        }
    }
    
    url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/knowledge/{safe_id}"
    body = json.dumps(doc).encode('utf-8')
    
    req = urllib.request.Request(
        url,
        data=body,
        method='PATCH',
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status in [200, 201]
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f" HTTP {e.code}: {body[:100]}")
        return False
    except Exception as e:
        print(f" Error: {e}")
        return False

success = 0
fail = 0

for i, (title, text) in enumerate(data.items()):
    print(f"[{i+1}/{len(data)}] {title[:45]}", end=" ... ", flush=True)
    if upload(title, text):
        success += 1
        print("OK")
    else:
        fail += 1
    import time
    time.sleep(0.1)

print(f"\nDone! Success: {success}, Failed: {fail}")
