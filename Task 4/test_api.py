import requests

url = 'http://127.0.0.1:5000/scrape'
payload = {
    'url': 'https://books.toscrape.com/catalogue/page-1.html',
    'pages': 1
}

try:
    r = requests.post(url, json=payload, timeout=30)
    j = r.json()
    data = j.get('data', [])
    
    print('✅ SUCCESS!')
    print(f'Found {len(data)} products\n')
    print('📋 Sample products:')
    for i, p in enumerate(data[:5]):
        print(f'{i+1}. {p.get("name", "NA")[:50]} - {p.get("price", "NA")}')
        
except Exception as e:
    print(f'❌ Error: {e}')
