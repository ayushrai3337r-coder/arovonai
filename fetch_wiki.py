import urllib.request
import json
import time
import os

os.makedirs("wiki_data", exist_ok=True)

TOPICS = [
    "Physics","Gravity","Thermodynamics","Quantum mechanics","Optics",
    "Electromagnetism","Nuclear physics","Atom","Relativity",
    "Chemistry","Periodic table","Organic chemistry","Acid","Molecule",
    "Biology","Cell biology","DNA","Genetics","Evolution","Photosynthesis",
    "Human body","Immune system","Nervous system","Bacteria","Virus",
    "Mathematics","Calculus","Algebra","Trigonometry","Statistics",
    "Probability","Numerical analysis","Differential equation","Matrix",
    "Computer science","Algorithm","Data structure","Python programming",
    "Database","Computer network","Artificial intelligence",
    "Machine learning","Cybersecurity","Internet","Blockchain",
    "History of India","Indus Valley Civilisation","Maurya Empire",
    "Gupta Empire","Mughal Empire","British Raj",
    "Indian independence movement","Mahatma Gandhi","Jawaharlal Nehru",
    "Subhas Chandra Bose","Bhimrao Ambedkar","Chandragupta Maurya",
    "Ashoka","Akbar","World War I","World War II","Cold War",
    "French Revolution","Industrial Revolution","Ancient Egypt",
    "Ancient Greece","Roman Empire","United Nations",
    "Geography of India","Himalayas","Ganga","Brahmaputra",
    "Thar Desert","Western Ghats","Bay of Bengal","Arabian Sea",
    "Amazon river","Mount Everest","Sahara","Pacific Ocean",
    "Constitution of India","Fundamental rights","Parliament of India",
    "Supreme Court of India","Election Commission of India",
    "Economy of India","Reserve Bank of India","GDP","Inflation",
    "Make in India","Digital India","GST",
    "APJ Abdul Kalam","Rabindranath Tagore","CV Raman",
    "Srinivasa Ramanujan","Vikram Sarabhai","Swami Vivekananda",
    "Sachin Tendulkar","Virat Kohli","MS Dhoni","Neeraj Chopra",
    "Indian Space Research Organisation","Chandrayaan",
    "Mangalyaan","Solar System","Black hole","Galaxy","Star",
    "Diabetes","Hypertension","Cancer","Tuberculosis","Malaria",
    "Ayurveda","Yoga","Nutrition","Vitamin","Antibiotic",
    "Climate change","Global warming","Biodiversity","Pollution",
    "Solar energy","Wind power","Renewable energy","Paris Agreement",
    "Hinduism","Buddhism","Islam","Sikhism","Jainism",
    "Bhagavad Gita","Ramayana","Mahabharata","Vedas",
    "Cricket","Indian Premier League","Football","Chess","Badminton",
    "Olympics","FIFA World Cup","ICC Cricket World Cup","Kabaddi",
    "World Health Organization","World Bank","IMF","BRICS","G20","SAARC",
    "Telephone","Radio","Television","Airplane","Steam engine",
    "Printing press","Penicillin","Transistor","Laser",
    "Human rights","Consumer protection","Labour law",
    "Bank","Stock market","Insurance","Mutual fund","Tax",
    "Agriculture","Wheat","Rice","Green Revolution","Irrigation",
    "Poverty","Literacy","Gender equality","Caste system",
    "Earthquake","Volcano","Tsunami","Monsoon","Climate",
    "Continent","Ocean","Time zone","Latitude","Longitude",
]

def fetch_article(title):
    # Use REST summary API — simple and fast
    safe = title.replace(' ', '_').replace("'", '%27')
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{safe}"
    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'ArovonBot/1.0 (educational project)'}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            extract = data.get('extract', '')
            if extract and len(extract) > 100:
                return extract
    except Exception as e:
        pass
    return None

def fetch_full(title):
    # Full article API
    safe = title.replace(' ', '+')
    url = f"https://en.wikipedia.org/w/api.php?action=query&format=json&titles={safe}&prop=extracts&exlimit=1&explaintext=true&exsectionformat=plain"
    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'ArovonBot/1.0 (educational project)'}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            pages = data.get('query', {}).get('pages', {})
            for pid, page in pages.items():
                if pid != '-1':
                    text = page.get('extract', '')
                    if text and len(text) > 200:
                        return text
    except Exception as e:
        pass
    return None

print(f"Fetching {len(TOPICS)} Wikipedia articles...")
print("Using urllib — no external library needed\n")

results = {}
failed = []

for i, topic in enumerate(TOPICS):
    print(f"[{i+1}/{len(TOPICS)}] {topic}", end=" ... ", flush=True)
    
    # Try summary first (faster)
    text = fetch_article(topic)
    
    # If summary too short, get full article
    if text and len(text) < 500:
        full = fetch_full(topic)
        if full and len(full) > len(text):
            text = full[:4000]
    elif not text:
        text = fetch_full(topic)
        if text:
            text = text[:4000]
    
    if text and len(text) > 100:
        results[topic] = text
        print(f"OK ({len(text):,} chars)")
    else:
        failed.append(topic)
        print("SKIP")
    
    time.sleep(0.2)

print(f"\nFetched: {len(results)} articles")
print(f"Failed: {len(failed)}")
if failed:
    print(f"Failed topics: {failed[:5]}...")

with open("wiki_data/knowledge.json", 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False)

total = sum(len(v) for v in results.values())
print(f"Total text: {total:,} chars = {total/1024:.0f} KB")
print("Saved: wiki_data/knowledge.json")
