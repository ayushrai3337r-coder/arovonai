import requests
import json
import time
import os

os.makedirs("wiki_data", exist_ok=True)

# 500 most important topics
TOPICS = [
    # Science & Physics
    "Physics","Gravity","Newton's laws of motion","Thermodynamics",
    "Quantum mechanics","Optics","Electromagnetism","Nuclear physics",
    "Semiconductor","Atom","Electron","Photon","Relativity",
    
    # Chemistry
    "Chemistry","Periodic table","Chemical bond","Acid","Base chemistry",
    "Organic chemistry","Electrochemistry","Polymer","Metal","Reaction",
    "Atomic theory","Molecule","Ion","Oxidation","Reduction",
    
    # Biology
    "Biology","Cell","DNA","Genetics","Evolution","Photosynthesis",
    "Human body","Immune system","Nervous system","Heart","Lung","Kidney",
    "Bacteria","Virus","Vaccine","Biotechnology","Ecology","Ecosystem",
    
    # Mathematics
    "Mathematics","Calculus","Algebra","Trigonometry","Geometry",
    "Statistics","Probability","Number theory","Matrix","Differential equation",
    "Integration","Derivative","Logarithm","Set theory","Linear algebra",
    "Numerical analysis","Interpolation","Bisection method",
    
    # Computer Science
    "Computer science","Algorithm","Data structure","Programming language",
    "Python","JavaScript","Database","Operating system","Computer network",
    "Artificial intelligence","Machine learning","Deep learning",
    "Cybersecurity","Internet","World Wide Web","Cloud computing",
    "Blockchain","Cryptocurrency",
    
    # Indian History
    "History of India","Indus Valley Civilisation","Vedic period",
    "Maurya Empire","Gupta Empire","Mughal Empire","Delhi Sultanate",
    "Maratha Empire","British Raj","Indian independence movement",
    "Indian National Congress","Partition of India",
    "Mahatma Gandhi","Jawaharlal Nehru","Subhas Chandra Bose",
    "Bhimrao Ambedkar","Sardar Vallabhbhai Patel","Bal Gangadhar Tilak",
    "Bhagat Singh","Chandragupta Maurya","Ashoka","Akbar","Aurangzeb",
    
    # World History
    "Ancient Egypt","Ancient Greece","Roman Empire","Byzantine Empire",
    "Renaissance","Industrial Revolution","French Revolution",
    "World War I","World War II","Cold War","United Nations",
    "American Revolution","Russian Revolution","Chinese Revolution",
    "Colonialism","Decolonization","Holocaust","Hiroshima","Berlin Wall",
    
    # Indian Geography
    "Geography of India","Himalayas","Deccan Plateau","Indo-Gangetic Plain",
    "Ganga","Yamuna","Brahmaputra","Godavari","Krishna","Kaveri",
    "Thar Desert","Western Ghats","Eastern Ghats","Bay of Bengal",
    "Arabian Sea","Indian Ocean","Rajasthan","Kerala","Tamil Nadu",
    "Maharashtra","Punjab","Gujarat","West Bengal","Uttar Pradesh",
    
    # World Geography
    "Continent","Ocean","Amazon river","Nile","Mississippi River",
    "Mount Everest","Alps","Andes","Rocky Mountains","Sahara",
    "Amazon rainforest","Antarctica","Arctic","Pacific Ocean","Atlantic Ocean",
    "Africa","Europe","Asia","North America","South America","Australia",
    
    # Indian Constitution & Polity
    "Constitution of India","Fundamental rights","Directive Principles",
    "Parliament of India","Lok Sabha","Rajya Sabha","President of India",
    "Prime Minister of India","Supreme Court of India","High court",
    "Election Commission of India","Panchayati Raj","Federalism",
    "Indian Penal Code","Right to Information Act",
    
    # Indian Economy
    "Economy of India","GDP","Inflation","Reserve Bank of India",
    "Five-Year Plans","Green Revolution","Liberalisation in India",
    "Make in India","Digital India","Startup India","GST","Budget",
    "Foreign direct investment","Stock exchange","Sensex","NIFTY",
    
    # Famous Indians
    "APJ Abdul Kalam","Rabindranath Tagore","CV Raman","Srinivasa Ramanujan",
    "Homi J. Bhabha","Vikram Sarabhai","Satyendra Nath Bose",
    "Swami Vivekananda","Aryabhata","Brahmagupta","Chanakya",
    "Indira Gandhi","Lal Bahadur Shastri","Rajiv Gandhi",
    "Sachin Tendulkar","Viswanathan Anand","PV Sindhu","Mary Kom",
    
    # ISRO & Space
    "Indian Space Research Organisation","Chandrayaan","Mangalyaan",
    "Chandrayaan-3","Gaganyaan","PSLV","GSLV","Satellite",
    "International Space Station","NASA","Space exploration",
    "Solar System","Planet","Star","Galaxy","Black hole","Big Bang",
    
    # Health & Medicine
    "Diabetes","Hypertension","Cancer","Tuberculosis","Malaria","Dengue",
    "COVID-19","Influenza","Heart disease","Stroke","Obesity","Asthma",
    "Ayurveda","Yoga","Meditation","Nutrition","Vitamin","Protein",
    "Carbohydrate","Fat","Mineral","Antibiotic","Vaccine","Surgery",
    
    # Environment
    "Climate change","Global warming","Greenhouse gas","Carbon dioxide",
    "Ozone layer","Biodiversity","Deforestation","Pollution","Acid rain",
    "Renewable energy","Solar energy","Wind power","Hydroelectricity",
    "Nuclear energy","Paris Agreement","Kyoto Protocol","Recycling",
    
    # Religion & Culture
    "Hinduism","Buddhism","Islam","Christianity","Sikhism","Jainism",
    "Vedas","Upanishads","Bhagavad Gita","Ramayana","Mahabharata",
    "Diwali","Holi","Eid","Christmas","Guru Nanak","Buddha","Mahavira",
    "Indian classical music","Bharatanatyam","Bollywood","Indian cinema",
    
    # Sports
    "Cricket","Indian Premier League","Football","Hockey","Badminton",
    "Chess","Kabaddi","Tennis","Olympics","Commonwealth Games",
    "Asian Games","FIFA World Cup","ICC Cricket World Cup",
    "Virat Kohli","MS Dhoni","Rohit Sharma","Neeraj Chopra",
    
    # International Organizations
    "United Nations","World Health Organization","World Bank",
    "International Monetary Fund","World Trade Organization",
    "NATO","SAARC","BRICS","G20","G7","ASEAN","African Union",
    "International Court of Justice","UNESCO","UNICEF",
    
    # Technology & Inventions
    "Telephone","Radio","Television","Internet","Electricity",
    "Steam engine","Automobile","Airplane","Computer","Smartphone",
    "Printing press","Gunpowder","Compass","Telescope","Microscope",
    "X-ray","Penicillin","Transistor","Laser","Nuclear weapon",
    
    # Law & Rights
    "Human rights","Universal Declaration of Human Rights",
    "Consumer protection","Labour law","Environmental law",
    "International law","Criminal law","Civil law",
    "Women's rights","Child rights","Right to education",
    
    # Finance & Banking
    "Bank","Central bank","Stock market","Bond","Insurance",
    "Mutual fund","Foreign exchange","Gold","Inflation",
    "Fiscal policy","Monetary policy","Tax","Income tax",
    
    # Agriculture
    "Agriculture","Wheat","Rice","Cotton","Sugarcane","Pulses",
    "Irrigation","Fertilizer","Pesticide","Organic farming",
    "Green Revolution","Food security","Drought","Flood",
    
    # Social Issues
    "Poverty","Unemployment","Education","Literacy","Gender equality",
    "Child labour","Human trafficking","Drug abuse","Corruption",
    "Caste system","Reservation in India","Rural development",
    
    # Geography concepts
    "Latitude","Longitude","Time zone","Climate","Weather",
    "Monsoon","Earthquake","Volcano","Tsunami","Hurricane",
    "Map","Cartography","GPS","Remote sensing",
]

print(f"Fetching {len(TOPICS)} Wikipedia articles...")

results = {}
failed = []

def fetch_article(title):
    url = "https://en.wikipedia.org/w/api.php"
    params = {
        'action': 'query',
        'format': 'json',
        'titles': title,
        'prop': 'extracts',
        'exlimit': 1,
        'explaintext': True,
        'exsectionformat': 'plain',
    }
    try:
        r = requests.get(url, params=params, timeout=15)
        if r.status_code == 200:
            data = r.json()
            pages = data.get('query', {}).get('pages', {})
            for pid, page in pages.items():
                if pid != '-1':
                    text = page.get('extract', '')
                    if text and len(text) > 200:
                        return text
    except Exception as e:
        pass
    return None

for i, topic in enumerate(TOPICS):
    print(f"[{i+1}/{len(TOPICS)}] {topic}", end=" ... ")
    text = fetch_article(topic)
    if text:
        # Trim to 3000 chars per article to save space
        results[topic] = text[:3000]
        print(f"OK ({len(text):,} chars)")
    else:
        failed.append(topic)
        print("SKIP")
    
    # Be nice to Wikipedia API
    time.sleep(0.3)

print(f"\nFetched: {len(results)} articles")
print(f"Failed: {len(failed)}")

# Save
with open("wiki_data/knowledge.json", 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False)

total = sum(len(v) for v in results.values())
print(f"Total text: {total:,} chars = {total/1024:.0f} KB")
print("Saved: wiki_data/knowledge.json")
