import requests
import json

url = 'http://127.0.0.1:5000/scrape'
payload = {
    'url': 'https://books.toscrape.com/catalogue/page-1.html',
    'pages': 1
}

print("Testing Flask API Response...\n")
r = requests.post(url, json=payload, timeout=120)
j = r.json()

if j.get('status') == 'success':
    data = j.get('data', [])
    print(f"✅ Status: {j['status']}")
    print(f"📊 Total Products: {len(data)}\n")
    
    if data:
        p = data[0]
        print("Sample Product #1:")
        print("─" * 50)
        fields = ['name', 'price', 'mrp', 'discount', 'rating', 'reviews', 
                  'availability', 'brand', 'category', 'sku', 'seller']
        
        for field in fields:
            value = p.get(field, 'MISSING')
            status = "✅" if value and value != 'NA' else "⚠️" if value == 'NA' else "❌"
            print(f"{status} {field:15} : {str(value)[:50]}")
        
        print("\n" + "─" * 50)
        print("\nAll 5 Products Preview:")
        print("─" * 50)
        for i, prod in enumerate(data[:5]):
            print(f"{i+1}. {prod.get('name', 'NA')[:45]}")
            print(f"   Price: {prod.get('price')} | Rating: {prod.get('rating')} | Brand: {prod.get('brand')}")
else:
    print(f"❌ Error: {j.get('message')}")
    print(f"Full response: {json.dumps(j, indent=2)}")
