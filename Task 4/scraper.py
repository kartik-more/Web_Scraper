# ============================================================
#   ScrapeDash — E-Commerce Product Web Scraper
#   scraper.py — Main Scraper using Requests + BeautifulSoup
# ============================================================

import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import os
import re
from urllib.parse import urljoin, urlparse
from playwright.sync_api import sync_playwright

# ============================================================
#   CONFIGURATION
# ============================================================
BASE_URL   = "https://books.toscrape.com/catalogue/"
START_URL  = "https://books.toscrape.com/catalogue/page-1.html"
OUTPUT_FILE = "products.csv"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

# Star rating words used on the website
RATING_MAP = {
    "One":   1,
    "Two":   2,
    "Three": 3,
    "Four":  4,
    "Five":  5
}

# ============================================================
#  HELPER FUNCTIONS
# ============================================================
def detect_site(url):
    hostname = urlparse(url).hostname or ''
    h = hostname.lower()
    if 'amazon' in h:
        return 'amazon'
    if 'flipkart' in h:
        return 'flipkart'
    if 'meesho' in h:
        return 'meesho'
    if 'myntra' in h:
        return 'myntra'
    if 'shopsy' in h or 'shopclues' in h:
        return 'shopsy'
    if 'toscrape.com' in h:
        return 'toscrape'
    if 'ebay' in h:
        return 'ebay'
    if 'walmart' in h:
        return 'walmart'
    return 'generic'


def normalize_price(txt):
    if not txt:
        return None
    clean = str(txt).replace('\xa0',' ').replace(',','').strip()
    m = re.search(r"([\d]+(?:\.[\d]+)?)", clean)
    if m:
        try:
            return float(m.group(1))
        except:
            return None
    return None


def calc_discount(mrp, price):
    if mrp is None or price is None or mrp <= price:
        return 'NA'
    return f"{round((mrp-price)/mrp*100)}% off"


# ============================================================
#   FETCH A SINGLE PAGE
# ============================================================
def fetch_page(url, use_browser=True):
    """
    Fetch page content and return BeautifulSoup object.
    Attempts browser render first (Playwright), then fallback to requests.
    For Amazon URLs, browser is mandatory.
    """
    # Force browser for Amazon since it blocks basic requests
    site = detect_site(url)
    if site == 'amazon':
        use_browser = True
    
    if use_browser:
        try:
            print(f"  → Fetching with browser: {url}")
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
                page = browser.new_page(user_agent=HEADERS['User-Agent'])
                page.goto(url, timeout=60000, wait_until='networkidle')
                html = page.content()
                browser.close()
                if html and len(html) > 100:
                    print(f"  ✓ Browser page fetched successfully ({len(html)} bytes)")
                    return BeautifulSoup(html, 'html.parser')
        except Exception as e:
            print(f"  ⚠ Browser fetch failed: {e}")
            # For Amazon, fail if browser doesn't work
            if site == 'amazon':
                print(f"  ✗ Amazon requires browser rendering. Cannot fallback to requests.")
                return None
            # continue to requests fallback for other sites

    try:
        print(f"  → Fetching with requests: {url}")
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        print(f"  ✓ Requests page fetched successfully ({len(response.text)} bytes)")
        return soup
    except requests.exceptions.RequestException as e:
        print(f"  ✗ Error fetching page with requests: {e}")
        return None


# ============================================================
#   EXTRACT PRODUCTS FROM A PAGE
# ============================================================
def extract_products(soup, current_url):
    """
    Parse HTML and extract product data. Supports books.toscrape and common ecommerce pages.
    """
    site = detect_site(current_url)
    products = []

    def safe_text(sel, default='NA'):
        return sel.get_text(strip=True) if sel else default

    def num_text(txt):
        val = normalize_price(txt)
        return val if val is not None else 0.0

    if site == 'toscrape':
        articles = soup.select('article.product_pod')
        for article in articles:
            name = safe_text(article.select_one('h3 a'))
            price = num_text(article.select_one('p.price_color').text if article.select_one('p.price_color') else '')
            rating_cls = article.select_one('p.star-rating')
            rating = 1
            if rating_cls:
                for cls in rating_cls.get('class', []):
                    if cls in RATING_MAP:
                        rating = RATING_MAP[cls]
                        break
            link = article.select_one('h3 a')
            href = link['href'] if link and link.has_attr('href') else ''
            absolute = urljoin(current_url, href)
            products.append({
                'site': site,
                'source': absolute,
                'method': 'requests',
                'name': name,
                'price': f"£{price:.2f}",
                'mrp': 'NA',
                'discount': 'NA',
                'rating': rating,
                'reviews': 'NA',
                'availability': 'In stock',
                'brand': 'NA',
                'category': 'Books',
                'sku': 'NA',
                'seller': 'NA',
                'description': 'NA',
                'image': article.select_one('img')['src'] if article.select_one('img') and article.select_one('img').has_attr('src') else ''
            })
        print(f"  ✓ Extracted {len(products)} products from books.toscrape page")
        return products

    if site == 'amazon':
        # Amazon listing extraction: robust across search terms + query params
        items = soup.select('div[data-component-type="s-search-result"], div.s-result-item, div[data-asin]')
        if not items:
            items = soup.select('div[data-component-type="s-search-result"]')

        for item in items:
            try:
                # Product title
                name_elem = item.select_one('h2 a span, h2 span, span.a-size-medium, span.a-size-base-plus')
                name = safe_text(name_elem) if name_elem else 'NA'

                # Price
                price_elem = item.select_one('span.a-price span.a-offscreen, span.a-price-whole, span.a-price-fraction')
                price_text = safe_text(price_elem) if price_elem else ''
                if not price_text:
                    # sometimes price broken into whole+fraction
                    whole = item.select_one('span.a-price-whole')
                    frac = item.select_one('span.a-price-fraction')
                    if whole:
                        price_text = safe_text(whole) + ('.' + safe_text(frac) if frac else '')

                # MRP / list price
                mrp_elem = item.select_one('span.a-price.a-text-price span.a-offscreen, span.a-price.a-text-price')
                mrp_text = safe_text(mrp_elem) if mrp_elem else ''

                # Rating and review count
                rating_elem = item.select_one('span.a-icon-alt, .a-icon-alt')
                rating_text = safe_text(rating_elem) if rating_elem else 'NA'
                if rating_text and 'out of' in rating_text:
                    rating_text = rating_text.split(' out of')[0].strip()

                reviews_elem = item.select_one('span.a-size-base.s-underline-text, span.a-size-base.a-color-secondary, span.a-size-base')
                reviews = safe_text(reviews_elem) if reviews_elem else 'NA'
                if reviews and not re.search(r'\d', reviews):
                    # As fallback check anchor count text: "1,234" inside review link
                    review_link = item.select_one('a[href*="/product-reviews/"]') or item.select_one('a.a-link-normal')
                    if review_link:
                        rev_text = safe_text(review_link)
                        if re.search(r'\d', rev_text):
                            reviews = rev_text
                        else:
                            reviews = 'NA'
                    else:
                        reviews = 'NA'

                # Extract discount both from text and from price/mrp
                discount_elem = item.select_one('span.a-color-price, span.a-size-small.a-color-secondary')
                discount_text = safe_text(discount_elem) if discount_elem else 'NA'
                if discount_text and re.search(r'%|save|Save|SAVE', discount_text, re.I):
                    discount = discount_text
                else:
                    discount = 'NA'

                # Brand guess from child tag fallback
                brand_elem = item.select_one('span.a-size-base-plus.a-color-base, span.a-size-base.a-color-secondary')
                brand = safe_text(brand_elem) if brand_elem else 'NA'
                if brand == 'NA' and name != 'NA':
                    brand = name.split(' ')[0]

                # Source URL
                href = item.select_one('h2 a, a.a-link-normal[href*="/dp/"]')
                url_item = urljoin(current_url, href['href']) if href and href.has_attr('href') else current_url

                if name == 'NA' or len(name) < 2:
                    continue

                price_val = num_text(price_text)
                mrp_val = num_text(mrp_text)
                if (discount == 'NA' or not discount) and mrp_val and price_val:
                    discount = calc_discount(mrp_val, price_val)

                img_elem = item.select_one('img')
                image_url = img_elem.get('src', '') if img_elem and img_elem.has_attr('src') else ''

                products.append({
                    'site': site,
                    'source': url_item,
                    'method': 'browser',
                    'name': name,
                    'price': price_text or 'NA',
                    'mrp': mrp_text or 'NA',
                    'discount': discount,
                    'rating': rating_text or 'NA',
                    'reviews': reviews or 'NA',
                    'availability': 'Available',
                    'brand': brand or 'NA',
                    'category': 'NA',
                    'sku': 'NA',
                    'seller': 'Amazon',
                    'description': 'NA',
                    'image': image_url
                })
            except Exception as e:
                print(f"    ⚠ Error parsing Amazon item: {e}")
                continue

        print(f"  ✓ Extracted {len(products)} products from Amazon listing")
        return products

    if site == 'flipkart':
        items = soup.select('div._1AtVbE, div._2kHmtq')
        for item in items:
            try:
                card = item.select_one('a._1fQZEK, a.IRpwTa, a[href*="/p/"]')
                if not card: continue
                name = safe_text(card.select_one('div._4rR01T, div._2WkVRV, a div span'))
                price = safe_text(card.select_one('div._30jeq3._1_WHN1, div._30jeq3, span div span'))
                mrp = safe_text(card.select_one('div._3I9_wc, div._3LWZlK.OMGografD'))
                discount = safe_text(card.select_one('div._3Ay6Sb span, span._2cLu-S'))
                rating = safe_text(card.select_one('div._3LWZlK, span[data-testid*="rating"]'))
                reviews = safe_text(card.select_one('span._2_R_DZ, span[data-testid*="review"]'))
                brand = safe_text(card.select_one('div._4OR-Lg'))
                url_item = urljoin(current_url, card['href']) if card and card.has_attr('href') else current_url
                price_val = num_text(price)
                mrp_val = num_text(mrp)
                if not discount and price_val and mrp_val:
                    discount = calc_discount(mrp_val, price_val)
                
                if name == 'NA':
                    continue
                
                products.append({
                    'site': site,
                    'source': url_item,
                    'method': 'browser',
                    'name': name,
                    'price': price or 'NA',
                    'mrp': mrp or 'NA',
                    'discount': discount or 'NA',
                    'rating': rating or 'NA',
                    'reviews': reviews or 'NA',
                    'availability': 'NA',
                    'brand': brand or 'NA',
                    'category': 'NA',
                    'sku': 'NA',
                    'seller': 'Flipkart',
                    'description': 'NA',
                    'image': card.select_one('img') and card.select_one('img').get('src','') or ''
                })
            except Exception as e:
                print(f"    ⚠ Error parsing Flipkart item: {e}")
                continue

        print(f"  ✓ Extracted {len(products)} products from Flipkart listing")
        return products

    if site == 'meesho':
        items = soup.select('div._2Q7uyx, div.sc-zplgbx, div._2hL1C3, div[class*="product"]')
        for item in items:
            try:
                name = safe_text(item.select_one('h4, .sc-1turb60-0, a span'))
                price = safe_text(item.select_one('span._2YxCDZ, span[data-testid*="price"]'))
                mrp = safe_text(item.select_one('span._1kMS, span[data-testid*="old-price"]'))
                discount = safe_text(item.select_one('span._31cGf7, span[data-testid*="discount"]'))
                rating = safe_text(item.select_one('span._2X6td1, span[data-testid*="rating"]'))
                reviews = safe_text(item.select_one('span._3f3jq9, span[data-testid*="review"]'))
                brand = safe_text(item.select_one('.sc-1turb60-0, .product-brand, span[data-testid*="seller"]'))
                url_item = item.select_one('a[href]')
                url_item = urljoin(current_url, url_item['href']) if url_item and url_item.has_attr('href') else current_url
                price_val = num_text(price)
                mrp_val = num_text(mrp)
                if not discount and price_val and mrp_val:
                    discount = calc_discount(mrp_val, price_val)
                
                if name == 'NA':
                    continue
                    
                products.append({
                    'site': site,
                    'source': url_item,
                    'method': 'browser',
                    'name': name,
                    'price': price or 'NA',
                    'mrp': mrp or 'NA',
                    'discount': discount or 'NA',
                    'rating': rating or 'NA',
                    'reviews': reviews or 'NA',
                    'availability': 'NA',
                    'brand': brand or 'NA',
                    'category': 'NA',
                    'sku': 'NA',
                    'seller': 'Meesho',
                    'description': 'NA',
                    'image': item.select_one('img') and item.select_one('img').get('src','') or ''
                })
            except Exception as e:
                print(f"    ⚠ Error parsing Meesho item: {e}")
                continue

        print(f"  ✓ Extracted {len(products)} products from Meesho listing")
        return products

    # Generic fallback by container
    fallback_selectors = ["div.product", "div.product-card", "div.item", "li.product", "article.product", "div.card", ".product-item"]
    seen = set()
    for sel in fallback_selectors:
        elems = soup.select(sel)
        for el in elems:
            try:
                key = (el.name, ' '.join(el.get('class', [])), el.get('id', ''))
            except:
                key = str(el)[:100]
            if key in seen:
                continue
            seen.add(key)
            name = safe_text(el.select_one('h2, h3, a, .title, .product-title'))
            price = safe_text(el.select_one('*[class*="price"], *[id*="price"]'))
            mrp = safe_text(el.select_one('*[class*="mrp"], *[class*="list-price"], *[class*="was-price"]'))
            availability = safe_text(el.select_one('*[class*="availability"], *[class*="stock"]'))
            rating = safe_text(el.select_one('*[class*="rating"], *[data-rating]'))
            reviews = safe_text(el.select_one('*[class*="review"], *[class*="ratings"]'))
            brand = safe_text(el.select_one('*[class*="brand"]'))
            url_item = el.select_one('a[href]')
            url_item = urljoin(current_url, url_item['href']) if url_item and url_item.has_attr('href') else current_url
            price_val = num_text(price)
            mrp_val = num_text(mrp)
            discount = calc_discount(mrp_val, price_val) if mrp_val and price_val else 'NA'
            products.append({
                'site': site,
                'source': url_item,
                'method': 'fallback',
                'name': name,
                'price': price or 'NA',
                'mrp': mrp or 'NA',
                'discount': discount,
                'rating': rating or 'NA',
                'reviews': reviews or 'NA',
                'availability': availability or 'NA',
                'brand': brand or 'NA',
                'category': 'NA',
                'sku': 'NA',
                'seller': 'NA',
                'description':'NA',
                'image': el.select_one('img') and el.select_one('img').get('src','') or ''
            })

    # Page-level fallback for any URL
    if not products:
        title = safe_text(soup.select_one('meta[property="og:title"], meta[name="twitter:title"], title'))
        price = safe_text(soup.select_one('meta[property="product:price:amount"], meta[name="price"], .price, .product-price'))
        mrp = safe_text(soup.select_one('meta[property="product:retail_price"], .mrp, .list-price, .original-price'))
        discount = 'NA'
        if price and mrp and price != 'NA' and mrp != 'NA':
            pval = num_text(price); mval = num_text(mrp)
            if pval is not None and mval is not None:
                discount = calc_discount(mval, pval)
        rating = safe_text(soup.select_one('meta[property="og:rating"], .rating, [itemprop="ratingValue"], [data-rating]'))
        reviews = safe_text(soup.select_one('meta[property="og:review_count"], .review-count, [itemprop="reviewCount"], [data-review-count]'))
        brand = safe_text(soup.select_one('meta[property="og:brand"], .brand, [itemprop="brand"], .product-brand'))
        availability = safe_text(soup.select_one('meta[property="product:availability"], .availability, [itemprop="availability"]'))
        if availability == 'NA' and soup.select_one('.in-stock, .available'):
            availability = 'Available'
        description = safe_text(soup.select_one('meta[name="description"], meta[property="og:description"], .product-description, .description'))
        image = (soup.select_one('meta[property="og:image"]') and soup.select_one('meta[property="og:image"]').get('content')) or (soup.select_one('img') and soup.select_one('img').get('src','')) or ''

        if title and title != 'NA':
            products.append({
                'site': site,
                'source': current_url,
                'method': 'page',
                'name': title,
                'price': price or 'NA',
                'mrp': mrp or 'NA',
                'discount': discount,
                'rating': rating or 'NA',
                'reviews': reviews or 'NA',
                'availability': availability or 'NA',
                'brand': brand or 'NA',
                'category': 'NA',
                'sku': 'NA',
                'seller': 'NA',
                'description': description or 'NA',
                'image': image
            })

    print(f"  ✓ Extracted {len(products)} products using fallback generic extraction")
    return products


# ============================================================
#   GET NEXT PAGE URL
# ============================================================
def get_next_page(soup, current_url=None):
    """
    Find the 'next' button/link on the page and return the absolute next page URL.
    Supports books.toscrape, Amazon, Flipkart, and other common e-commerce sites.
    Returns None if there is no next page.
    """
    # books.toscrape
    next_btn = soup.find("li", class_="next")
    if next_btn:
        next_href = next_btn.find("a")["href"]
        base = current_url if current_url else BASE_URL
        return urljoin(base, next_href)
    
    # Amazon next page button
    next_amazon = soup.select_one('a.s-pagination-next')
    if next_amazon and next_amazon.has_attr('href'):
        return urljoin(current_url or 'https://www.amazon.com/', next_amazon['href'])
    
    # Generic pagination next
    next_link = soup.select_one('a[rel="next"], .pagination a[rel="next"]')
    if next_link and next_link.has_attr('href'):
        return urljoin(current_url or BASE_URL, next_link['href'])
    
    return None


# ============================================================
#   MAIN SCRAPER FUNCTION
# ============================================================
def run_scraper(start_url, max_pages=5):
    """
    Main scraper function.
    Scrapes multiple pages and collects all product data.
    """
    print("=" * 55)
    print("   ScrapeDash — Web Scraper Started")
    print("=" * 55)
    print(f"  Target : {start_url}")
    print(f"  Pages  : {max_pages}")
    print("=" * 55)

    all_products = []
    current_url = start_url
    page_number = 1
    site = detect_site(start_url)

    while current_url and page_number <= max_pages:
        print(f"\n📄 Scraping Page {page_number}/{max_pages}...")
        print(f"   URL: {current_url}")

        soup = fetch_page(current_url, use_browser=True)
        if soup is None:
            print("  ✗ Failed to fetch page with browser, trying requests fallback")
            soup = fetch_page(current_url, use_browser=False)
        if soup is None:
            print("  ✗ Failed to fetch page. Stopping.")
            break

        products = extract_products(soup, current_url)
        if products:
            all_products.extend(products)
        else:
            print("  ⚠ No products found on this page")

        print(f"  📦 Total products collected so far: {len(all_products)}")

        # Try to find next page for all sites
        current_url = get_next_page(soup, current_url)
        page_number += 1

        if current_url and page_number <= max_pages:
            print("  ⏳ Waiting 1 second before next page...")
            time.sleep(1)

    # ---- Build DataFrame ----
    print("\n" + "=" * 55)
    print("  ✅ Scraping Complete!")
    print(f"  📦 Total Products: {len(all_products)}")
    print("=" * 55)

    if not all_products:
        print("  ⚠ No products were scraped.")
        return pd.DataFrame()

    df = pd.DataFrame(all_products)
    df.index = df.index + 1  # Start index from 1
    df.index.name = "ID"

    return df


# ============================================================
#   SAVE TO CSV
# ============================================================
def save_to_csv(df, filename=OUTPUT_FILE):
    """
    Save the DataFrame to a CSV file.
    """
    if df.empty:
        print("  ⚠ Nothing to save — DataFrame is empty.")
        return

    df.to_csv(filename)
    file_size = os.path.getsize(filename)
    print(f"\n  💾 Dataset saved to: {filename}")
    print(f"  📁 File size       : {file_size} bytes")
    print(f"  📊 Total records   : {len(df)}")


# ============================================================
#   DISPLAY SUMMARY
# ============================================================
def display_summary(df):
    """
    Print a summary of the scraped dataset.
    """
    if df.empty:
        return

    print("\n" + "=" * 55)
    print("   📊 DATASET SUMMARY")
    print("=" * 55)
    print(f"  Total Products : {len(df)}")
    print(f"  Avg Price      : £{df['Price (£)'].mean():.2f}")
    print(f"  Min Price      : £{df['Price (£)'].min():.2f}")
    print(f"  Max Price      : £{df['Price (£)'].max():.2f}")
    print(f"  Avg Rating     : {df['Rating'].mean():.1f} / 5")
    print(f"  5-Star Books   : {len(df[df['Rating'] == 5])}")
    print("=" * 55)
    print("\n  📋 First 5 Records:")
    print(df.head().to_string())
    print("\n  📋 Last 5 Records:")
    print(df.tail().to_string())
    print("=" * 55)


# ============================================================
#   RUN
# ============================================================
if __name__ == "__main__":
    # Change max_pages to scrape more or fewer pages
    # Each page has ~20 products
    # max_pages=5  → ~100 products
    # max_pages=10 → ~200 products
    # max_pages=50 → all 1000 products

    df = run_scraper(START_URL, max_pages=5)

    if not df.empty:
        display_summary(df)
        save_to_csv(df, OUTPUT_FILE)
        print(f"\n  ✅ Done! Open '{OUTPUT_FILE}' to see your data.\n")
