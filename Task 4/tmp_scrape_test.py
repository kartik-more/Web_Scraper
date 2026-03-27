from scraper_simple import run_scraper
url='https://www.flipkart.com/search?q=laptop'
df = run_scraper(url, max_pages=1)
print('rows', len(df))
print(df[['name','price','mrp','discount','rating','reviews','brand']].head(5).to_string())
