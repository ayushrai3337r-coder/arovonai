import json
import urllib.request
import urllib.parse
import os

with open("wiki_data/knowledge.json", 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Total articles: {len(data)}")
print(f"Total size: {sum(len(v) for v in data.values())/1024:.0f} KB")

PROJECT_ID = "arovonai"
API_KEY = "AIzaSyBPOOgWTZI-sAWYmS_HHyMPcU90UKY_Xo0"

# Get anonymous token
def get_token():
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}"
    body = json.dumps({"returnSecureToken": True}).encode()
    req = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode()).get('idToken')
    except Exception as e:
        print(f"Token error: {e}")
        return None

def build_tf(text):
    stop = {'the','a','an','and','or','in','on','at','to','of','is','are','was','were','it','this','that','with','for','as','be','by','from','have','had','not','but','its','their','they','we','he','she','his','her','which','who','what','how','when','where','also','been','has','into','than','then','can','will','would','could','should','more','after','before','during','between','through','over','under','about','above','below','these','those'}
    words = text.lower().split()
    tf = {}
    for w in words:
        w = ''.join(c for c in w if c.isalnum())
        if len(w) > 2 and w not in stop:
            tf[w] = tf.get(w, 0) + 1
    # Keep top 150 terms only
    sorted_tf = sorted(tf.items(), key=lambda x: x[1], reverse=True)[:150]
    return dict(sorted_tf)

def upload_doc(doc_id, title, text, token):
    tf = build_tf(text)
    words = text.split()

    # Build Firestore fields
    tf_fields = {k: {"integerValue": str(v)} for k, v in tf.items()}

    doc = {
        "fields": {
            "name": {"stringValue": title},
            "text": {"stringValue": text[:6000]},
            "wordCount": {"integerValue": str(len(words))},
            "tf": {"mapValue": {"fields": tf_fields}}
        }
    }

    safe_id = ''.join(c if c.isalnum() or c in '-_' else '_' for c in doc_id)[:100]
    url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/knowledge/{safe_id}"

    body = json.dumps(doc).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=body,
        method='PATCH',
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status in [200, 201]
    except urllib.error.HTTPError as e:
        if e.code == 401:
            return 'refresh'
        return False
    except Exception as e:
        return False

print("\nGetting Firebase token...")
token = get_token()
if not token:
    print("ERROR: Could not get token")
    exit()
print("Token OK\n")

items = list(data.items())
success = 0
fail = 0

for i, (title, text) in enumerate(items):
    print(f"[{i+1}/{len(items)}] {title[:45]}", end=" ... ", flush=True)

    result = upload_doc(title, text, token)

    if result == 'refresh':
        print("refreshing token...", end=" ", flush=True)
        token = get_token()
        result = upload_doc(title, text, token)

    if result:
        success += 1
        print("OK")
    else:
        fail += 1
        print("FAIL")

    # Refresh token every 55 uploads
    if (i + 1) % 55 == 0:
        token = get_token()
        print("--- Token refreshed ---")

print(f"\nDone!")
print(f"Success: {success}")
print(f"Failed: {fail}")
print(f"Total in Firestore: {success} articles")
