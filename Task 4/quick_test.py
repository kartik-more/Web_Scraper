import requests

url = 'http://127.0.0.1:5000/scrape'
payload = {
    'url': 'https://books.toscrape.com/catalogue/page-1.html',
    'pages': 1
}

print("Sending request...")
r = requests.post(url, json=payload, timeout=120)
print("Got response...")
j = r.json()

if j.get('status') == 'success' and j.get('data'):
    p = j['data'][0]
    print(f'Name:         {p.get("name")}')
    print(f'Price:        {p.get("price")}')
    print(f'Rating:       {p.get("rating")}')
    print(f'Reviews:      {p.get("reviews")}')
    print(f'Brand:        {p.get("brand")}')
    print(f'Availability: {p.get("availability")}')
    print(f'Category:     {p.get("category")}')
else:
    print(f"Error: {j}")
