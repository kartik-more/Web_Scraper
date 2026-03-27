import requests
import json

url = 'http://127.0.0.1:5000/scrape'
payload = {
    'url': 'https://books.toscrape.com/catalogue/page-1.html',
    'pages': 1
}

try:
    r = requests.post(url, json=payload, timeout=60)
    j = r.json()
    
    if j.get('status') == 'success':
        data = j.get('data', [])
        if data:
            p = data[0]
            print('✅ API Response Sample:')
            print(f'Name:         {p.get("name", "NA")}')
            print(f'Price:        {p.get("price", "NA")}')
            print(f'Rating:       {p.get("rating", "NA")}')
            print(f'Reviews:      {p.get("reviews", "NA")}')
            print(f'Brand:        {p.get("brand", "NA")}')
            print(f'Category:     {p.get("category", "NA")}')
            print(f'Availability: {p.get("availability", "NA")}')
            print(f'Discount:     {p.get("discount", "NA")}')
            print(f'MRP:          {p.get("mrp", "NA")}')
            desc = str(p.get("description", "NA"))[:80]
            print(f'Description:  {desc}...')
            print(f'\n📊 Total Products: {len(data)}')
    else:
        print(f'Error: {j.get("message")}')
        
except Exception as e:
    print(f'Error: {e}')
