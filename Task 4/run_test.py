from scraper_simple import run_scraper
url='https://www.amazon.in/s?k=laptop+under+35000&crid=25UCNVAMGU5OH&sprefix=l%2Caps%2C677&ref=nb_sb_ss_mvt-t11-ranker_1_1'
print('URL', url)
df = run_scraper(url, max_pages=1)
print('rows', len(df))
if not df.empty:
    print(df[['name','price','mrp','discount','rating','reviews','brand']].head(10).to_string())
