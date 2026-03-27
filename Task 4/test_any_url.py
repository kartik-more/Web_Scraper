from scraper_simple import run_scraper
urls = [
    'https://books.toscrape.com/catalogue/page-1.html',
    'https://www.flipkart.com/search?q=laptop',
    'https://www.amazon.in/s?k=laptop+under+35000'
]
for url in urls:
    print('===', url)
    df = run_scraper(url, max_pages=1)
    print('rows', len(df))
    if not df.empty:
        print(df[['name','price','mrp','discount','rating','reviews','brand','availability']].head(3).to_string())
    print('\n')
