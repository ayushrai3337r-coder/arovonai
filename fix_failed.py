import urllib.request
import json
import time
import os

# Load existing data
with open("wiki_data/knowledge.json", 'r', encoding='utf-8') as f:
    existing = json.load(f)

print(f"Already have: {len(existing)} articles")

# Alternative names for failed topics
ALTERNATIVES = {
    "Newton's laws of motion": "Newton's laws",
    "Acid": "Acid–base reaction",
    "Cell biology": "Cell (biology)",
    "Python programming": "Python (programming language)",
    "Computer network": "Computer network",
    "Ancient Egypt": "History of ancient Egypt",
    "Ancient Greece": "Classical antiquity",
    "Roman Empire": "Roman Empire",
    "Ganga": "Ganges",
    "CV Raman": "C. V. Raman",
    "Chandrayaan": "Chandrayaan programme",
    "Mangalyaan": "Mars Orbiter Mission",
    "Star": "Star (astronomy)",
    "Vitamin": "Vitamins",
    "Wind power": "Wind turbine",
    "Sikhism": "Sikhism",
    "Jainism": "Jainism",
    "Cricket": "Cricket (sport)",
    "Football": "Association football",
    "Chess": "Chess",
    "Tax": "Taxation",
    "Agriculture": "Agriculture",
    "Wheat": "Wheat",
    "Rice": "Rice",
    "Earthquake": "Earthquake",
    "Volcano": "Volcano",
    "Tsunami": "Tsunami",
    "Monsoon": "Monsoon",
    "Ocean": "Ocean",
    "Bank": "Bank",
    "Molecule": "Molecule",
    "Ion": "Ion",
    "Atom": "Atom",
    "Electron": "Electron",
    "Photon": "Photon",
    "Laser": "Laser",
    "Transistor": "Transistor",
    "Penicillin": "Penicillin",
    "Antibiotic": "Antibiotic",
    "Malaria": "Malaria",
    "Cancer": "Cancer",
    "Diabetes": "Diabetes",
    "Hypertension": "Hypertension",
    "Obesity": "Obesity",
    "Asthma": "Asthma",
    "Stroke": "Stroke",
    "Heart disease": "Cardiovascular disease",
    "Pollution": "Pollution",
    "Deforestation": "Deforestation",
    "Biodiversity": "Biodiversity",
    "Ecosystem": "Ecosystem",
    "Galaxy": "Galaxy",
    "Black hole": "Black hole",
    "Solar System": "Solar System",
    "Planet": "Planet",
    "Satellite": "Satellite",
    "GPS": "Global Positioning System",
    "Blockchain": "Blockchain",
    "Cryptocurrency": "Cryptocurrency",
    "Internet": "Internet",
    "World Wide Web": "World Wide Web",
    "Cloud computing": "Cloud computing",
    "Cybersecurity": "Computer security",
    "Database": "Database",
    "Algorithm": "Algorithm",
    "Probability": "Probability",
    "Matrix": "Matrix (mathematics)",
    "Logarithm": "Logarithm",
    "Integration": "Integral",
    "Derivative": "Derivative",
    "Interpolation": "Interpolation",
    "Numerical analysis": "Numerical analysis",
    "Bisection method": "Bisection method",
    "Linear algebra": "Linear algebra",
    "Number theory": "Number theory",
    "Set theory": "Set theory",
    "Geometry": "Geometry",
    "Trigonometry": "Trigonometry",
    "Calculus": "Calculus",
    "Algebra": "Algebra",
    "Statistics": "Statistics",
    "GST": "Goods and Services Tax (India)",
    "GDP": "Gross domestic product",
    "Inflation": "Inflation",
    "Stock market": "Stock market",
    "Insurance": "Insurance",
    "Mutual fund": "Mutual fund",
    "Foreign exchange": "Foreign exchange market",
    "BRICS": "BRICS",
    "SAARC": "South Asian Association for Regional Cooperation",
    "NATO": "NATO",
    "ASEAN": "ASEAN",
    "UNESCO": "UNESCO",
    "UNICEF": "UNICEF",
    "World Bank": "World Bank",
    "IMF": "International Monetary Fund",
    "WTO": "World Trade Organization",
    "G20": "G20",
    "G7": "G7",
    "FIFA World Cup": "FIFA World Cup",
    "ICC Cricket World Cup": "ICC Cricket World Cup",
    "Olympics": "Olympic Games",
    "Commonwealth Games": "Commonwealth Games",
    "Asian Games": "Asian Games",
    "Kabaddi": "Kabaddi",
    "Badminton": "Badminton",
    "Sachin Tendulkar": "Sachin Tendulkar",
    "Virat Kohli": "Virat Kohli",
    "MS Dhoni": "MS Dhoni",
    "Neeraj Chopra": "Neeraj Chopra",
    "PV Sindhu": "P. V. Sindhu",
    "Mary Kom": "Mary Kom",
    "Viswanathan Anand": "Viswanathan Anand",
    "Rabindranath Tagore": "Rabindranath Tagore",
    "APJ Abdul Kalam": "A. P. J. Abdul Kalam",
    "CV Raman": "C. V. Raman",
    "Homi Bhabha": "Homi J. Bhabha",
    "Vikram Sarabhai": "Vikram Sarabhai",
    "Srinivasa Ramanujan": "Srinivasa Ramanujan",
    "Swami Vivekananda": "Swami Vivekananda",
    "Chanakya": "Chanakya",
    "Aryabhata": "Aryabhata",
    "Bhimrao Ambedkar": "B. R. Ambedkar",
    "Subhas Chandra Bose": "Subhas Chandra Bose",
    "Indira Gandhi": "Indira Gandhi",
    "Rajiv Gandhi": "Rajiv Gandhi",
    "Jawaharlal Nehru": "Jawaharlal Nehru",
    "Mahatma Gandhi": "Mahatma Gandhi",
    "Sardar Patel": "Vallabhbhai Patel",
    "Bal Gangadhar Tilak": "Bal Gangadhar Tilak",
    "Bhagat Singh": "Bhagat Singh",
    "Chandrayaan-3": "Chandrayaan-3",
    "Mangalyaan": "Mars Orbiter Mission",
    "ISRO": "Indian Space Research Organisation",
    "Make in India": "Make in India",
    "Digital India": "Digital India",
    "Startup India": "Startup India",
    "PM Kisan": "PM-KISAN",
    "Ayushman Bharat": "Ayushman Bharat",
    "Right to Information": "Right to Information Act, 2005",
    "Consumer protection": "Consumer Protection Act, 2019",
    "Fundamental rights India": "Fundamental rights in India",
    "Panchayati Raj": "Panchayati raj",
    "Green Revolution": "Green Revolution in India",
    "Organic farming": "Organic farming",
    "Irrigation": "Irrigation",
    "Fertilizer": "Fertilizer",
    "Sugarcane": "Sugarcane",
    "Cotton": "Cotton",
    "Pulses": "Pulse (legume)",
    "Climate": "Climate",
    "Weather": "Weather",
    "Latitude": "Latitude",
    "Longitude": "Longitude",
    "Time zone": "Time zone",
    "Cartography": "Cartography",
    "Remote sensing": "Remote sensing",
    "Acid rain": "Acid rain",
    "Ozone layer": "Ozone layer",
    "Greenhouse gas": "Greenhouse gas",
    "Carbon dioxide": "Carbon dioxide",
    "Paris Agreement": "Paris Agreement",
    "Kyoto Protocol": "Kyoto Protocol",
    "Recycling": "Recycling",
    "Waste management": "Waste management",
    "Water conservation": "Water conservation",
    "Rainforest": "Tropical rainforest",
    "Amazon rainforest": "Amazon rainforest",
    "Antarctica": "Antarctica",
    "Arctic": "Arctic",
    "Himalayas": "Himalayas",
    "Western Ghats": "Western Ghats",
    "Eastern Ghats": "Eastern Ghats",
    "Deccan Plateau": "Deccan Plateau",
    "Indo-Gangetic Plain": "Indo-Gangetic Plain",
    "Thar Desert": "Thar Desert",
    "Bay of Bengal": "Bay of Bengal",
    "Arabian Sea": "Arabian Sea",
    "Indian Ocean": "Indian Ocean",
    "Yamuna": "Yamuna River",
    "Brahmaputra": "Brahmaputra River",
    "Godavari": "Godavari River",
    "Krishna river": "Krishna River",
    "Kaveri": "Kaveri River",
    "Poverty": "Poverty",
    "Unemployment": "Unemployment",
    "Literacy": "Literacy",
    "Gender equality": "Gender equality",
    "Child labour": "Child labour",
    "Human trafficking": "Human trafficking",
    "Corruption": "Corruption",
    "Caste system": "Caste system in India",
    "Reservation India": "Reservation in India",
    "Human rights": "Human rights",
    "Labour law": "Labour law",
    "Criminal law": "Criminal law",
    "International law": "International law",
    "Diwali": "Diwali",
    "Holi": "Holi",
    "Eid": "Eid al-Fitr",
    "Christmas": "Christmas",
    "Guru Nanak": "Guru Nanak",
    "Buddha": "Gautama Buddha",
    "Mahavira": "Mahavira",
    "Bharatanatyam": "Bharatanatyam",
    "Bollywood": "Bollywood",
    "Indian cinema": "Cinema of India",
    "Indian classical music": "Indian classical music",
    "Yoga": "Yoga",
    "Ayurveda": "Ayurveda",
    "Nutrition": "Nutrition",
    "Surgery": "Surgery",
    "Vaccine": "Vaccine",
}

def fetch_article(title):
    safe = title.replace(' ', '_').replace("'", '%27')
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{safe}"
    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'ArovonBot/1.0'}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            extract = data.get('extract', '')
            if extract and len(extract) > 100:
                return extract
    except:
        pass
    return None

def fetch_full(title):
    safe = title.replace(' ', '+').replace("'", '%27')
    url = f"https://en.wikipedia.org/w/api.php?action=query&format=json&titles={safe}&prop=extracts&exlimit=1&explaintext=true"
    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'ArovonBot/1.0'}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            pages = data.get('query', {}).get('pages', {})
            for pid, page in pages.items():
                if pid != '-1':
                    text = page.get('extract', '')
                    if text and len(text) > 200:
                        return text[:5000]
    except:
        pass
    return None

print("Fetching alternative names for failed articles...\n")
new_fetched = 0

for original, alternative in ALTERNATIVES.items():
    if original in existing:
        continue

    print(f"Trying: {alternative}", end=" ... ", flush=True)

    text = fetch_article(alternative)
    if not text or len(text) < 200:
        text = fetch_full(alternative)

    if text and len(text) > 100:
        existing[original] = text
        new_fetched += 1
        print(f"OK ({len(text):,} chars)")
    else:
        print("SKIP")

    time.sleep(0.2)

print(f"\nNew articles fetched: {new_fetched}")
print(f"Total now: {len(existing)} articles")

with open("wiki_data/knowledge.json", 'w', encoding='utf-8') as f:
    json.dump(existing, f, ensure_ascii=False)

total = sum(len(v) for v in existing.values())
print(f"Total text: {total:,} chars = {total/1024:.0f} KB")
print("Saved!")
