# ============================================================
#   ScrapeDash — E-Commerce Product Web Scraper (SIMPLE VERSION)
#   scraper_simple.py — Works WITHOUT Playwright
# ============================================================

import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import os
import re
from urllib.parse import urljoin, urlparse
import json

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
def fetch_page(url, use_browser=False):
    """
    Fetch page content using simple requests (no browser needed).
    """
    try:
        print(f"  → Fetching: {url}")
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        print(f"  ✓ Page fetched successfully ({len(response.text)} bytes)")
        return soup
    except requests.exceptions.RequestException as e:
        print(f"  ✗ Error fetching page: {e}")
        return None


# ============================================================
#   EXTRACT PRODUCTS FROM A PAGE
# ============================================================
def extract_products(soup, current_url):
    """
    Parse HTML and extract product data.
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
            price_text = safe_text(article.select_one('p.price_color'))
            price = num_text(price_text)
            
            # Extract rating from star class
            rating_cls = article.select_one('p.star-rating')
            rating = 'NA'
            if rating_cls:
                for cls in rating_cls.get('class', []):
                    if cls in ['One', 'Two', 'Three', 'Four', 'Five']:
                        rating_map = {'One': 1, 'Two': 2, 'Three': 3, 'Four': 4, 'Five': 5}
                        rating = rating_map.get(cls, 'NA')
                        break
            
            # Get product link 
            link = article.select_one('h3 a')
            href = link['href'] if link and link.has_attr('href') else ''
            absolute = urljoin(current_url, href)
            
            # Extract availability from article if available
            avail_elem = article.select_one('.instock')
            availability = safe_text(avail_elem) if avail_elem else 'Available'
            
            # Set default values that are consistent with book data
            brand = 'Books to Scrape'
            category = 'Books'
            seller = 'Books to Scrape'
            reviews = 'NA'
            discount = 'NA'
            mrp = 'NA'
            description = 'NA'
            sku = 'NA'
            
            products.append({
                'site': site,
                'source': absolute,
                'method': 'requests',
                'name': name,
                'price': f"£{price:.2f}" if price else price_text,
                'mrp': mrp,
                'discount': discount,
                'rating': rating,
                'reviews': reviews,
                'availability': availability,
                'brand': brand,
                'category': category,
                'sku': sku,
                'seller': seller,
                'description': description,
                'image': article.select_one('img')['src'] if article.select_one('img') and article.select_one('img').has_attr('src') else ''
            })
        print(f"  ✓ Extracted {len(products)} products from books.toscrape")
        return products

    if site == 'amazon':
        print("  ℹ Amazon requires JavaScript rendering. Use Flask app with browser mode.")
        print("  → Attempting basic extraction (may not work)...")
        # Try basic extraction without Playwright
        items = soup.select('div.s-result-item, div[data-component-type="s-search-result"]')
        for item in items:
            try:
                name = safe_text(item.select_one('h2 a span, h2 span, .a-link-normal span, .a-size-medium'))
                price_text = ''
                price_elem = item.select_one('span.a-price span.a-offscreen, span.a-price-whole, span.a-price-fraction')
                if price_elem:
                    price_text = safe_text(price_elem)
                else:
                    whole = item.select_one('span.a-price-whole')
                    frac = item.select_one('span.a-price-fraction')
                    if whole:
                        price_text = safe_text(whole) + ('.' + safe_text(frac) if frac else '')

                mrp_text = 'NA'
                mrp_elem = item.select_one('span.a-price.a-text-price span.a-offscreen, span.a-price.a-text-price')
                if mrp_elem:
                    mrp_text = safe_text(mrp_elem)

                rating = safe_text(item.select_one('span.a-icon-alt, .a-icon-alt'))
                if rating and 'out of' in rating:
                    rating = rating.split(' out of')[0].strip()

                reviews = safe_text(item.select_one('span.a-size-base.s-underline-text, .a-size-base.s-underline-text, span.a-size-small, .a-row.a-size-small'))
                if reviews and not re.search(r'\d', reviews):
                    reviews = 'NA'

                discount = 'NA'
                discount_elem = item.select_one('span.a-color-price, .a-size-base.a-color-secondary, span.savingsPercentage')
                if discount_elem:
                    discount_text = safe_text(discount_elem)
                    if discount_text and re.search(r'%|save|Save|SAVE', discount_text, re.I):
                        discount = discount_text

                if mrp_text != 'NA' and price_text and price_text != 'NA':
                    price_val = num_text(price_text)
                    mrp_val = num_text(mrp_text)
                    if mrp_val and price_val and mrp_val > price_val:
                        discount = calc_discount(mrp_val, price_val)

                href = item.select_one('h2 a, a.a-link-normal')
                url_item = urljoin(current_url, href['href']) if href and href.has_attr('href') else current_url

                if name != 'NA':
                    products.append({
                        'site': site,
                        'source': url_item,
                        'method': 'requests',
                        'name': name,
                        'price': price_text or 'NA',
                        'mrp': mrp_text or 'NA',
                        'discount': discount or 'NA',
                        'rating': rating or 'NA',
                        'reviews': reviews or 'NA',
                        'availability': 'Available',
                        'brand': 'NA',
                        'category': 'NA',
                        'sku': 'NA',
                        'seller': 'Amazon',
                        'description': 'NA',
                        'image': item.select_one('img') and item.select_one('img').get('src', '') or ''
                    })
            except Exception:
                continue
        
        print(f"  ✓ Extracted {len(products)} products (basic extraction, may be limited)")
        return products

    if site == 'flipkart':
        # Flipkart uses dynamic classes; handle multiple formats for desktop + mobile listing.
        cards = soup.select('div._2kHMtA, div._1AtVbE, div._13oc-S')
        if not cards:
            cards = soup.select('div._1fQZEK')

        for card in cards:
            try:
                name = safe_text(card.select_one('div._4rR01T') or card.select_one('a.s1Q9rs') or card.select_one('div._2WkVRV'))
                price = safe_text(card.select_one('div._30jeq3._1_WHN1') or card.select_one('div._30jeq3'))
                mrp = safe_text(card.select_one('div._3I9_wc._2p6lqe') or card.select_one('div._3I9_wc'))
                discount = safe_text(card.select_one('div._3Ay6Sb span') or card.select_one('span._2p6lqe'))
                rating = safe_text(card.select_one('div._3LWZlK') or card.select_one('span._1lRcqv'))
                reviews = safe_text(card.select_one('span._2_R_DZ') or card.select_one('span._2BkXur'))
                brand = safe_text(card.select_one('div._2WkVRV') or card.select_one('div._4rR01T') or card.select_one('a.s1Q9rs'))
                availability = 'Available' if price and price != 'NA' else 'NA'
                url_item = current_url
                link = card.select_one('a[href]')
                if link and link.has_attr('href'):
                    url_item = urljoin(current_url, link['href'])

                if name == 'NA' or name.strip() == '':
                    continue

                # Fallbacks for partially missing fields
                if brand in [None, '', 'NA'] and name:
                    brand = name.split()[0]
                if rating in [None, '', 'NA']:
                    match = re.search(r'(\d+(?:\.\d+)?)(?=\s*★)', card.get_text())
                    rating = match.group(1) if match else 'NA'
                if reviews in [None, '', 'NA']:
                    m = re.search(r'([\d,]+)\s*reviews', card.get_text(), re.I)
                    if m:
                        reviews = m.group(1)
                if discount in [None, '', 'NA'] and price and mrp and price != 'NA' and mrp != 'NA':
                    p_val = num_text(price)
                    m_val = num_text(mrp)
                    if p_val and m_val and m_val > p_val:
                        discount = calc_discount(m_val, p_val)

                price_val = num_text(price)
                mrp_val = num_text(mrp)

                products.append({
                    'site': site,
                    'source': url_item,
                    'method': 'requests',
                    'name': name,
                    'price': price or 'NA',
                    'mrp': mrp or 'NA',
                    'discount': discount or 'NA',
                    'rating': rating or 'NA',
                    'reviews': reviews or 'NA',
                    'availability': availability,
                    'brand': brand or 'NA',
                    'category': 'NA',
                    'sku': 'NA',
                    'seller': 'Flipkart',
                    'description': 'NA',
                    'image': card.select_one('img') and card.select_one('img').get('src', '') or ''
                })
            except Exception:
                continue

        print(f"  ✓ Extracted {len(products)} products from Flipkart")
        return products

    # Generic fallback
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
            
            if name and name != 'NA':
                products.append({
                    'site': site,
                    'source': current_url,
                    'method': 'generic',
                    'name': name,
                    'price': price or 'NA',
                    'mrp': 'NA',
                    'discount': 'NA',
                    'rating': 'NA',
                    'reviews': 'NA',
                    'availability': 'NA',
                    'brand': 'NA',
                    'category': 'NA',
                    'sku': 'NA',
                    'seller': 'NA',
                    'description':'NA',
                    'image': el.select_one('img') and el.select_one('img').get('src','') or ''
                })

    if not products:
        # try page-level metadata fallback for any URL
        title = safe_text(soup.select_one('meta[property="og:title"], meta[name="twitter:title"], title'))
        if title == 'NA':
            title = safe_text(soup.select_one('h1, h2, h3'))
        price = safe_text(soup.select_one('meta[property="product:price:amount"], meta[name="price"], .price, .product-price, .price-color'))
        mrp = safe_text(soup.select_one('meta[property="product:retail_price"], .mrp, .list-price, .original-price'))
        discount = 'NA'
        if price and mrp and price != 'NA' and mrp != 'NA':
            try:
                pval = num_text(price)
                mval = num_text(mrp)
                discount = calc_discount(mval, pval)
            except:
                discount = 'NA'
        rating = safe_text(soup.select_one('meta[property="og:rating"], .rating, .stars, [itemprop="ratingValue"], [data-rating]'))
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

    print(f"  ✓ Extracted {len(products)} products (generic extraction)")
    return products


# ============================================================
#   GET NEXT PAGE URL
# ============================================================
def get_next_page(soup, current_url=None):
    """
    Find the 'next' button on the page.
    """
    next_btn = soup.find("li", class_="next")
    if next_btn:
        next_href = next_btn.find("a")["href"]
        base = current_url if current_url else BASE_URL
        return urljoin(base, next_href)
    
    next_link = soup.select_one('a[rel="next"]')
    if next_link and next_link.has_attr('href'):
        return urljoin(current_url or BASE_URL, next_link['href'])
    
    return None


# ============================================================
#   MAIN SCRAPER FUNCTION
# ============================================================
def run_scraper(start_url, max_pages=1):
    """
    Main scraper function (single page, simpler).
    """
    print("=" * 55)
    print("   ScrapeDash — Web Scraper (Simple Mode)")
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

        soup = fetch_page(current_url)
        if soup is None:
            print("  ✗ Failed to fetch page. Stopping.")
            break

        products = extract_products(soup, current_url)
        if products:
            all_products.extend(products)
            print(f"  📦 Total products: {len(all_products)}")
        else:
            print("  ⚠ No products found on this page")

        if page_number < max_pages:
            current_url = get_next_page(soup, current_url)
        else:
            current_url = None
        
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
    df.index = df.index + 1
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
#   RUN
# ============================================================
if __name__ == "__main__":
    # Change START_URL to any e-commerce site
    df = run_scraper(START_URL, max_pages=5)

    if not df.empty:
        save_to_csv(df, OUTPUT_FILE)
        print(f"\n  ✅ Done! Results saved to '{OUTPUT_FILE}'.")
        print(f"\n📋 First few products:")
        print(df[['name', 'price', 'rating']].head(10).to_string())
    else:
        print("\n  ❌ No data to save.")
