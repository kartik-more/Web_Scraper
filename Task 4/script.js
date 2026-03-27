// STATE
let products = [], view = 'grid', logOpen = false, allMode = false;
const FIELDS = [
    {id: 'name', label: 'Product Name', on: true},
    {id: 'price', label: 'Current Price', on: true},
    {id: 'mrp', label: 'MRP / Was Price', on: true},
    {id: 'discount', label: 'Discount %', on: true},
    {id: 'rating', label: 'Rating', on: true},
    {id: 'reviews', label: 'Review Count', on: true},
    {id: 'availability', label: 'Availability', on: true},
    {id: 'brand', label: 'Brand', on: true},
    {id: 'category', label: 'Category', on: false},
    {id: 'sku', label: 'ASIN / SKU', on: false},
    {id: 'seller', label: 'Seller', on: false},
    {id: 'description', label: 'Description', on: false}
];

// INIT
function init() {
    const g = document.getElementById('optsGrid');
    FIELDS.forEach(f => {
        const d = document.createElement('div');
        d.className = 'opt' + (f.on ? ' on' : '');
        d.id = 'f' + f.id;
        d.innerHTML = `<div class="odot"></div><span class="otext">${f.label}</span>`;
        d.onclick = () => { f.on = !f.on; d.classList.toggle('on'); };
        g.appendChild(d);
    });
}
function setUrl(u) { document.getElementById('urlInp').value = u; }
function parsePriceValue(v) {
    if (!v) return NaN;
    const m = String(v).replace(/,/g, '').match(/[\d]+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : NaN;
}
function calcDiscount(mrp, price) {
    const m = parsePriceValue(mrp); const p = parsePriceValue(price);
    if (!isFinite(m) || !isFinite(p) || m <= p) return 'NA';
    return Math.round(((m - p) / m) * 100) + '% off';
}
function setAllMode(v) {
    allMode = v;
    const btn = document.getElementById('allModeBtn');
    if (btn) btn.classList.toggle('on', allMode);
    log(`All mode ${allMode ? 'enabled' : 'disabled'}`, 'w');
}
function toggleAllMode() { setAllMode(!allMode); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// LOG
function log(m, t = '') {
    const b = document.getElementById('logBox');
    const d = document.createElement('div');
    const ts = new Date().toLocaleTimeString('en-IN', {hour12: false});
    d.className = 'll ' + t;
    d.textContent = `[${ts}] ${m}`;
    b.appendChild(d);
    b.scrollTop = b.scrollHeight;
}
function toggleLog() {
    logOpen = !logOpen;
    document.getElementById('logBox').classList.toggle('open', logOpen);
    document.getElementById('larrow').textContent = logOpen ? '▴' : '▾';
}

// STATUS
function setStatus(m, s = 'loading') {
    const bar = document.getElementById('statusBar');
    bar.classList.add('show');
    document.getElementById('statusTxt').textContent = m;
    const sp = document.getElementById('spinEl'), sd = document.getElementById('sdotEl');
    if (s === 'loading') {
        sp.style.display = 'block'; sd.className = 'sdot';
    } else {
        sp.style.display = 'none'; sd.className = 'sdot ' + s;
    }
}
function hideStatus() { setTimeout(() => document.getElementById('statusBar').classList.remove('show'), 4500); }

// PROGRESS STEPS
const STEPNAMES = {s1: 'Fetch HTML', s2: 'Parse DOM', s3: 'Extract data', s4: 'Render'};
const STEPICONS = {active: '▶', done: '✅', fail: '❌'};
function stepSet(id, st) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'step ' + st;
    el.textContent = STEPICONS[st] + ' ' + STEPNAMES[id];
}

// CORS PROXIES (expanded + reliable ones)
const PROXIES = [
    (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
    (url) => 'https://corsproxy.io/?' + encodeURIComponent(url),
    (url) => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url),
    (url) => 'https://thingproxy.freeboard.io/fetch/' + encodeURIComponent(url),
    (url) => 'https://cors-anywhere.herokuapp.com/' + url
];

async function fetchHTML(url) {
    for (let i = 0; i < PROXIES.length; i++) {
        log(`Proxy ${i+1} attempt...`);
        try {
            const ctrl = new AbortController();
            const tid = setTimeout(() => ctrl.abort(), 12000);
            const r = await fetch(PROXIES[i](url), {signal: ctrl.signal});
            clearTimeout(tid);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const html = await r.text();
            if (typeof html === 'string' && html.length > 600) {
                log(`Proxy ${i+1} OK (${html.length} chars)`);
                return html;
            }
            throw new Error('Response too short');
        } catch (e) {
            log(`Proxy ${i+1} failed: ${e.message}`, 'w');
        }
    }
    return null;
}

// DOM EXTRACTION (improved selectors)
function detectSite(url) {
    const h = new URL(url).hostname.toLowerCase();
    if (h.includes('amazon')) return 'amazon';
    if (h.includes('flipkart')) return 'flipkart';
    if (h.includes('myntra')) return 'myntra';
    if (h.includes('meesho')) return 'meesho';
    if (h.includes('shopsy') || h.includes('shopclues')) return 'shopsy';
    if (h.includes('ebay')) return 'ebay';
    if (h.includes('walmart')) return 'walmart';
    if (h.includes('books.toscrape.com') || h.includes('toscrape.com')) return 'toscrape';
    return 'generic';
}

function extractDOM(html, url) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const site = detectSite(url);
    const data = {site, source: url, method: 'proxy'};

    if (site === 'amazon') {
        data.name = doc.querySelector('span#productTitle')?.textContent?.trim() || doc.querySelector('h1.a-size-large')?.textContent?.trim();
        data.price = doc.querySelector('.a-price .a-offscreen')?.textContent?.trim() || doc.querySelector('#priceblock_ourprice')?.textContent?.trim();
        data.mrp = doc.querySelector('#priceblock_ourprice, #priceblock_dealprice, #priceblock_saleprice')?.textContent?.trim() || doc.querySelector('.priceBlockStrikePriceString')?.textContent?.trim();
        data.rating = doc.querySelector('#acrPopover span.a-icon-alt')?.textContent?.trim();
        data.reviews = doc.querySelector('#acrCustomerReviewText')?.textContent?.trim();
        data.brand = doc.querySelector('#bylineInfo')?.textContent?.trim() || doc.querySelector('#brand')?.textContent?.trim();
        data.availability = doc.querySelector('#availability')?.textContent?.trim();
        if (!data.discount && data.mrp && data.price) data.discount = calcDiscount(data.mrp, data.price);
    } else if (site === 'flipkart') {
        data.name = doc.querySelector('span.B_NuCI, span._35KyD6')?.textContent?.trim() || doc.querySelector('._35KyD6')?.textContent?.trim();
        data.price = doc.querySelector('div._30jeq3._16Jk6d, div._30jeq3')?.textContent?.trim();
        data.mrp = doc.querySelector('div._3I9_wc, div._1vC4OE')?.textContent?.trim();
        data.discount = doc.querySelector('div._3Ay6Sb span')?.textContent?.trim();
        data.rating = doc.querySelector('div._3LWZlK')?.textContent?.trim() || doc.querySelector('span._2_KrJI')?.textContent?.trim();
        data.reviews = doc.querySelector('span._2_R_DZ')?.textContent?.trim();
        data.brand = doc.querySelector('a._2whKao')?.textContent?.trim() || doc.querySelector('a._21k9pD')?.textContent?.trim();
        data.availability = doc.querySelector('div._16FRp0, div._2P_LDn')?.textContent?.trim();
        if (!data.discount && data.mrp && data.price) data.discount = calcDiscount(data.mrp, data.price);
    } else if (site === 'meesho') {
        data.name = doc.querySelector('h1.b2b-title, .pdp-title')?.textContent?.trim();
        data.price = doc.querySelector('.pdp-price, .pdp-price span, .product-price')?.textContent?.trim();
        data.mrp = doc.querySelector('.pdp-discount-price, .pdp-price blockquote, .product-discounted-price')?.textContent?.trim();
        data.discount = doc.querySelector('.pdp-discount, .discount-value')?.textContent?.trim();
        data.rating = doc.querySelector('.rating-text, .pdp-review')?.textContent?.trim() || doc.querySelector('.product-rating')?.textContent?.trim();
        data.reviews = doc.querySelector('.review-count, .rating-count')?.textContent?.trim();
        data.brand = doc.querySelector('a.b2b-brand, .brand-link, .product-brand')?.textContent?.trim();
        data.availability = doc.querySelector('.product-in-stock, .stock-status')?.textContent?.trim();
        if (!data.discount && data.mrp && data.price) data.discount = calcDiscount(data.mrp, data.price);
    } else if (site === 'myntra') {
        data.name = doc.querySelector('h1.pdp-title, .pdp-title')?.textContent?.trim();
        data.price = doc.querySelector('.pdp-price', '.pdp-price span')?.textContent?.trim();
        data.rating = doc.querySelector('.pdp-review-heading, .pdp-product-rating')?.textContent?.trim();
        data.availability = doc.querySelector('.pdp-summary-info, .pdp-product-meta')?.textContent?.trim();
    } else if (site === 'meesho') {
        data.name = doc.querySelector('h1.b2b-title, .pdp-title')?.textContent?.trim();
        data.price = doc.querySelector('.pdp-price', '.pdp-price span')?.textContent?.trim();
        data.rating = doc.querySelector('.rating-text, .pdp-review')?.textContent?.trim();
        data.availability = doc.querySelector('.product-in-stock, .stock-status')?.textContent?.trim();
    } else if (site === 'shopsy') {
        data.name = doc.querySelector('h1.product-title, .product-title')?.textContent?.trim();
        data.price = doc.querySelector('.product-price, .price')?.textContent?.trim();
        data.rating = doc.querySelector('.rating', '.rating-value')?.textContent?.trim();
        data.availability = doc.querySelector('.availability')?.textContent?.trim();
    } else if (site === 'toscrape') {
        const isProductPage = /\/catalogue\//.test(url);
        if (isProductPage) {
            data.name = doc.querySelector('.product_main h1')?.textContent?.trim();
            data.price = doc.querySelector('.product_main .price_color')?.textContent?.trim();
            data.availability = doc.querySelector('.product_main .instock.availability')?.textContent?.replace(/\s+/g, ' ').trim();
            data.description = doc.querySelector('#product_description ~ p')?.textContent?.trim();
            data.category = doc.querySelector('.breadcrumb li:nth-child(3) a')?.textContent?.trim();
            const ratingEl = doc.querySelector('.product_main .star-rating');
            if (ratingEl) {
                const cls = Array.from(ratingEl.classList);
                const names = ['One','Two','Three','Four','Five'];
                const idx = names.findIndex(n => cls.includes(n));
                if (idx > -1) data.rating = `${idx + 1} / 5`;
            }
            const upcRow = Array.from(doc.querySelectorAll('table.table-striped tr')).find(tr => tr.querySelector('th')?.textContent.trim() === 'UPC');
            if (upcRow) data.sku = upcRow.querySelector('td')?.textContent.trim();
        } else {
            // listing page: grab first product as fallback
            const first = doc.querySelector('article.product_pod');
            if (first) {
                data.name = first.querySelector('h3 a')?.getAttribute('title')?.trim();
                data.price = first.querySelector('.price_color')?.textContent?.trim();
                const ratingEl = first.querySelector('.star-rating');
                if (ratingEl) {
                    const cls = Array.from(ratingEl.classList);
                    const names = ['One','Two','Three','Four','Five'];
                    const idx = names.findIndex(n => cls.includes(n));
                    if (idx > -1) data.rating = `${idx + 1} / 5`;
                }
                data.availability = first.querySelector('.instock.availability')?.textContent?.replace(/\s+/g, ' ').trim();
            }
            // fallback product info from page title
            data.name = data.name || doc.title?.replace(/\|.*$/, '').trim();
        }
    } else {
        // generic extraction fallback
        data.name = doc.querySelector('h1, h2, h3')?.textContent?.trim();
        data.price = doc.querySelector('.price, .product-price, .price_color')?.textContent?.trim();
        data.availability = doc.querySelector('.availability')?.textContent?.trim();
        data.description = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || doc.querySelector('p')?.textContent?.trim();
    }

    // Populate missing fields with generic selectors if absent
    if (!data.name) data.name = doc.querySelector('h1, h2, h3')?.textContent?.trim();
    if (!data.price) data.price = doc.querySelector('.price, .money, .product-price')?.textContent?.trim();
    if (!data.category) data.category = doc.querySelector('.breadcrumb li:nth-child(3) a')?.textContent?.trim();
    if (!data.description) data.description = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim();

    data.image = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || doc.querySelector('.product_main img')?.getAttribute('src') || null;
    log(`extractDOM:${site} => name:${data.name||'NA'} price:${data.price||'NA'} rating:${data.rating||'NA'}`);
    return data;
}

// CLAUDE AI EXTRACTION (fixed with API key)
async function extractWithClaude(url, htmlSnippet = '') {
    log('Calling Claude AI API...');
    const apiKey = document.getElementById('apiKeyInp').value.trim();
    if (!apiKey) throw new Error('Enter Anthropic API key for AI mode');
    const site = detectSite(url);
    const asinM = url.match(/dp\/([A-Z0-9]{10})/) || url.match(/[?&]product=([A-Z0-9]{10})/);
    const asin = asinM ? asinM[1] : '';
    const enabledFields = FIELDS.filter(f => f.on).map(f => f.id);
    const prompt = `You are an expert e-commerce product data extractor. Product URL: ${url}\nSite: ${site}${asin ? ` ASIN: ${asin}` : ''}\nHTML Snippet: ${htmlSnippet.slice(0,5000)}\n\nExtract ONLY these fields: ${enabledFields.join(', ')}.\n\nInstructions:\n- Use URL/ASIN/HTML to identify product.\n- Amazon: Use your knowledge of listings.\n- Price: Include ₹/$ symbol.\n- Rating: 4.3/5 → 4.3\n- Reviews: 12,450 → "12,450 reviews"\n- Availability: "In Stock", "Out of Stock"\n- Discount: "15% off" (compute if possible)\n- Unknown: "NA"\n- Name ≤120 chars, Desc ≤200 chars.\n\nReturn ONLY raw JSON: {"name":"...","price":"..."} no markdown/backticks.`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-5-sonnet-20240620', // Updated model
            max_tokens: 1000,
            messages: [{role: 'user', content: prompt}]
        })
    });
    if (!resp.ok) throw new Error(`Claude API: ${resp.status}`);
    const data = await resp.json();
    const raw = data.content?.find(b => b.type === 'text')?.text.trim();
    let parsed;
    try {
        parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
        throw new Error('Claude parse failed: ' + raw.slice(0,80));
    }
    parsed.site = site;
    parsed.source = url;
    parsed.method = 'claude-ai';
    if (asin && !parsed.sku) parsed.sku = 'ASIN: ' + asin;
    log(`Claude extracted: ${String(parsed.name || '').slice(0,35)}... price ${parsed.price} rating ${parsed.rating}`);
    return parsed;
}

function parseListPage(html, baseUrl, site) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    console.log(`[parseListPage] Site: ${site}, HTML: ${html.length} chars, allMode: ${allMode}`);
    console.log(`[parseListPage] baseUrl: ${baseUrl}`);

    // Validate HTML was parsed
    if (!doc || !doc.body || doc.body.textContent.length < 50) {
        console.log('[parseListPage] ERROR: DOMParser failed or HTML too short');
        return [];
    }

    let products = [];

    // SPECIAL HANDLING FOR BOOKSTOCRAPE (uses CSS classes for prices/ratings)
    if (site === 'toscrape' || baseUrl.includes('toscrape.com')) {
        console.log('[parseListPage] Using BooksToScrape specific extraction');
        const articles = Array.from(doc.querySelectorAll('article.product_pod'));
        console.log(`[parseListPage] Found ${articles.length} article.product_pod elements`);
        
        // Fallback if articles not found
        if (articles.length === 0) {
            console.log('[parseListPage] Fallback: Looking for any article or div with product content');
            articles.push(...Array.from(doc.querySelectorAll('article')).slice(0, 100));
        }
        if (articles.length === 0) {
            console.log('[parseListPage] Fallback: Looking for divs with title attributes');
            articles.push(...Array.from(doc.querySelectorAll('div[data-product], div.product')).slice(0, 100));
        }

        products = articles.map((article, idx) => {
            const name = article.querySelector('h3 a')?.getAttribute('title') || '';
            
            // PRICE: Get from .price_color element
            const priceEl = article.querySelector('.price_color');
            const priceText = priceEl?.textContent?.trim() || '';
            const price = priceText || ''; // Keep full string with symbol
            
            // RATING: Extract from star-rating class name (Three = 3, Four = 4, Five = 5)
            const starEl = article.querySelector('.star-rating');
            let rating = 'NA';
            if (starEl) {
                const classList = Array.from(starEl.classList);
                const ratingMap = {
                    'Zero': '0/5', 'One': '1/5', 'Two': '2/5', 'Three': '3/5', 
                    'Four': '4/5', 'Five': '5/5'
                };
                for (const cls of classList) {
                    if (ratingMap[cls]) {
                        rating = ratingMap[cls];
                        break;
                    }
                }
            }

            const link = article.querySelector('a[href]');
            let urlLink = baseUrl;
            if (link?.href) {
                urlLink = link.href.startsWith('http') ? link.href : baseUrl + link.href;
            }

            // AVAILABILITY: Look for instock availability text
            const availEl = article.querySelector('.instock.availability');
            const availability = availEl?.textContent?.trim().replace(/\s+/g, ' ') || 'NA';

            // IMAGE: Get from img tag
            const image = article.querySelector('img')?.getAttribute('src') || '';

            if (idx < 5) {
                console.log(`[${idx}] name="${name.substring(0,40)}" | price="${price}" | rating="${rating}" | avail="${availability}"`);
            }

            return {
                site: 'toscrape',
                source: urlLink,
                method: 'selector',
                name: name || 'NA',
                price: price || 'NA',
                rating: rating,
                mrp: 'NA',
                discount: 'NA',
                reviews: 'NA',
                availability: availability,
                category: 'Books',
                description: 'NA',
                sku: 'NA',
                seller: 'NA',
                brand: 'NA',
                image: image
            };
        }).filter(p => p.name && p.name !== 'NA' && p.name.length > 3);
    } else if (site === 'amazon') {
        console.log('[parseListPage] Amazon list extraction');
        const items = Array.from(doc.querySelectorAll('div.s-main-slot > div[data-component-type="s-search-result"]'));
        products = items.map((item, idx) => {
            const name = item.querySelector('h2 a span')?.textContent?.trim() || 'NA';
            const price = item.querySelector('.a-price .a-price-whole')?.textContent?.trim() ? item.querySelector('.a-price .a-offscreen')?.textContent?.trim() : 'NA';
            const mrp = item.querySelector('.a-price .a-text-price .a-offscreen')?.textContent?.trim() || 'NA';
            const discount = item.querySelector('.a-row.a-size-base.a-color-secondary .a-size-base')?.textContent?.trim() || (mrp !== 'NA' && price !== 'NA' ? calcDiscount(mrp, price) : 'NA');
            const rating = item.querySelector('.a-icon-alt')?.textContent?.trim() || 'NA';
            const reviews = item.querySelector('.a-size-base.s-underline-text')?.textContent?.trim() || 'NA';
            const brand = item.querySelector('.a-row.a-size-base.a-color-base .a-size-base.a-color-secondary')?.textContent?.trim() || 'NA';
            const urlLink = item.querySelector('h2 a')?.href || baseUrl;
            return {
                site: 'amazon', source: urlLink, method: 'selector', name, price, mrp, discount, rating, reviews, availability: 'NA', category: 'NA', description: 'NA', sku: 'NA', seller: 'NA', brand, image: item.querySelector('img')?.src || ''
            };
        }).filter(p => p.name && p.name !== 'NA');
    } else if (site === 'flipkart') {
        console.log('[parseListPage] Flipkart list extraction');
        const items = Array.from(doc.querySelectorAll('div._1AtVbE')).filter(el => el.querySelector('a._1fQZEK, a.IRpwTa') );
        products = items.map((item, idx) => {
            const el = item.querySelector('a._1fQZEK, a.IRpwTa');
            const name = el?.querySelector('div._4rR01T, div._2WkVRV')?.textContent?.trim() || 'NA';
            const price = el?.querySelector('div._30jeq3._1_WHN1, div._30jeq3')?.textContent?.trim() || 'NA';
            const mrp = el?.querySelector('div._3I9_wc')?.textContent?.trim() || 'NA';
            const discount = el?.querySelector('div._3Ay6Sb span')?.textContent?.trim() || (mrp !== 'NA' && price !== 'NA' ? calcDiscount(mrp, price) : 'NA');
            const rating = el?.querySelector('div._3LWZlK')?.textContent?.trim() || 'NA';
            const reviews = el?.querySelector('span._2_R_DZ')?.textContent?.trim() || 'NA';
            const brand = el?.querySelector('div._2WkVRV')?.textContent?.trim() || 'NA';
            const urlLink = el?.href ? (el.href.startsWith('http') ? el.href : baseUrl + el.href) : baseUrl;
            return {
                site: 'flipkart', source: urlLink, method: 'selector', name, price, mrp, discount, rating, reviews, availability: 'NA', category: 'NA', description: 'NA', sku: 'NA', seller: 'NA', brand, image: el?.querySelector('img')?.src || ''
            };
        }).filter(p => p.name && p.name !== 'NA');
    } else if (site === 'meesho') {
        console.log('[parseListPage] Meesho list extraction');
        const items = Array.from(doc.querySelectorAll('div._1AtVbE, div.sc-kIXNHG, div.sc-iQKALj')); // fallback selectors
        products = items.map((item, idx) => {
            const name = item.querySelector('h4, .sc-2dp5m2-3, .iFjjqu')?.textContent?.trim() || 'NA';
            const price = item.querySelector('span._2YxCDZ, .sc-kfzAMf')?.textContent?.trim() || 'NA';
            const mrp = item.querySelector('span._1kMS, .sc-mdCAfm')?.textContent?.trim() || 'NA';
            const discount = item.querySelector('span._31cGf7')?.textContent?.trim() || (mrp !== 'NA' && price !== 'NA' ? calcDiscount(mrp, price) : 'NA');
            const rating = item.querySelector('span._2X6td1')?.textContent?.trim() || 'NA';
            const reviews = item.querySelector('span._3f3jq9')?.textContent?.trim() || 'NA';
            const brand = item.querySelector('.sc-1turb60-0')?.textContent?.trim() || 'NA';
            const urlLink = item.querySelector('a[href]')?.href || baseUrl;
            return {
                site: 'meesho', source: urlLink, method: 'selector', name, price, mrp, discount, rating, reviews, availability: 'NA', category: 'NA', description: 'NA', sku: 'NA', seller: 'NA', brand, image: item.querySelector('img')?.src || ''
            };
        }).filter(p => p.name && p.name !== 'NA');
    } else {
        // GENERIC TEXT-CONTENT EXTRACTION for other sites
        console.log('[parseListPage] Using generic text-content extraction');
        
        let allDivs = Array.from(doc.querySelectorAll('div, li, article'));
        console.log(`[parseListPage] Found ${allDivs.length} total containers`);

        const productContainers = allDivs.filter(cont => {
            const text = cont.textContent || '';
            return text.length > 20 && text.length < 2000;
        }).slice(0, 100);

        console.log(`[parseListPage] Filtered to ${productContainers.length} likely product containers`);

        if (productContainers.length > 0) {
            const sample = productContainers[0].textContent.substring(0, 300);
            console.log(`[DEBUG] Sample container text: "${sample.substring(0, 150)}..."`);
        }

        products = productContainers.map((container, idx) => {
            const fullText = container.textContent || '';
            const lines = fullText.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
            
            let name = '';
            let price = '';
            let rating = '';
            let urlLink = baseUrl;

            // NAME: First long line that looks like a product name
            for (const line of lines) {
                const cleaned = line.replace(/\s+/g, ' ').trim();
                if (cleaned.length > 10 && cleaned.length < 200 && !/^[\d\s₹Rs$,.-]+$/.test(cleaned)) {
                    name = cleaned;
                    break;
                }
            }

            // PRICE: Multiple formats - ₹, Rs, £, $, USD
            const pricePatterns = [
                /£[\s]*?([\d,]+(?:\.[\d]{2})?)/,    // £51.77
                /₹[\s]*?([\d,]+(?:\.[\d]{2})?)/,      // ₹1,234.56
                /Rs\.?[\s]*([\d,]+(?:\.[\d]{2})?)/i,  // Rs 1,234
                /\$[\s]*([\d,.]+)/,                     // $50.99
                /USD[\s]*([\d,]+)/i,                    // USD 100
                /([\d,]+)[\s]*₹/,                       // 1,234 ₹
                /([\d,]+)[\s]*Rs/i                      // 1,000 Rs
            ];
            
            for (const pattern of pricePatterns) {
                const match = fullText.match(pattern);
                if (match) {
                    price = match[0].trim();
                    break;
                }
            }

            if (!price) {
                const numberMatch = fullText.match(/[£₹$Rs]{0,3}\s*\d{2,}[\d,.]*/);
                if (numberMatch) {
                    price = numberMatch[0].trim();
                }
            }

            // RATING: Multiple patterns
            const ratingPatterns = [
                /(\d+\.?\d*)\s*\/\s*5/,                // 4.5/5
                /★{1,5}/,                               // ★★★★
                /(\d+)\s*out of\s*5/i                  // 4 out of 5
            ];
            
            for (const pattern of ratingPatterns) {
                const match = fullText.match(pattern);
                if (match) {
                    rating = match[0].trim();
                    break;
                }
            }

            // DISCOUNT: Look for discount percentage patterns
            let discount = 'NA';
            const discountMatch = fullText.match(/(\d+)\s*%\s*(?:off|discount|save)/i);
            if (discountMatch) {
                discount = discountMatch[1] + '% off';
            }

            // REVIEWS: Look for review count patterns
            let reviews = 'NA';
            const reviewPatterns = [
                /(\d+(?:,\d+)*)\s*reviews?/i,          // 1,234 reviews
                /(\d+(?:,\d+)*)\s*ratings?/i,          // 1,234 ratings
                /rated\s*by\s*(\d+(?:,\d+)*)/i         // rated by 1,234
            ];
            for (const pattern of reviewPatterns) {
                const match = fullText.match(pattern);
                if (match) {
                    reviews = match[1] + ' reviews';
                    break;
                }
            }

            // BRAND: Look for brand patterns
            let brand = 'NA';
            const brandPatterns = [
                /Brand:\s*([^\n,]+)/i,                  // Brand: Samsung
                /by\s+([A-Z][^\n,]+?)(?:\s*\(|,|$)/,   // by Samsung
                /([A-Z]{2,}(?:\s+[A-Z]{2,})?)\s*-/     // SAMSUNG -
            ];
            for (const pattern of brandPatterns) {
                const match = fullText.match(pattern);
                if (match && match[1].length > 2 && match[1].length < 50) {
                    brand = match[1].trim();
                    break;
                }
            }

            // MRP: Look for original/was price patterns
            let mrp = 'NA';
            const mrpPatterns = [
                /(?:MRP|Original|Was|List Price)[:\s]+([\d,]+(?:\.[\d]{2})?)/i,
                /₹\s*\d+,?\d+\s*₹\s*([\d,]+)/,        // ₹xxx ₹yyy pattern
                /crossed\s*out.*?([\d,]+)/i
            ];
            for (const pattern of mrpPatterns) {
                const match = fullText.match(pattern);
                if (match) {
                    mrp = match[0].trim();
                    break;
                }
            }

            // AVAILABILITY: Look for stock status
            let availability = 'NA';
            const availPatterns = [
                /in\s+stock/i,                          // In stock
                /out\s+of\s+stock/i,                    // Out of stock
                /only\s+(\d+)\s+(?:left|available)/i,  // Only 5 left
                /coming\s+soon/i,                       // Coming soon
                /ships?\s+(?:in|within)\s+(\d+)/i      // Ships in 2 days
            ];
            for (const pattern of availPatterns) {
                const match = fullText.match(pattern);
                if (match) {
                    availability = match[0].trim();
                    break;
                }
            }

            // SELLER: Look for seller patterns
            let seller = 'NA';
            const sellerPatterns = [
                /(?:Sold|Shipped)\s+by\s+([^\n,]+)/i,  // Sold by Amazon
                /Seller[:\s]+([^\n,]+)/i              // Seller: XYZ
            ];
            for (const pattern of sellerPatterns) {
                const match = fullText.match(pattern);
                if (match) {
                    seller = match[1].trim();
                    break;
                }
            }

            const link = container.querySelector('a[href]');
            if (link && link.href) {
                urlLink = link.href.startsWith('http') ? link.href : baseUrl + link.href;
            }

            if (idx < 5) {
                console.log(`[${idx}] name="${name.substring(0,40)}" | price="${price}" | rating="${rating}" | discount="${discount}"`);
            }

            return {
                site: site || 'all',
                source: urlLink,
                method: 'proxy-text',
                name: (name && name.length > 3) ? name : 'NA',
                price: price || 'NA',
                mrp: mrp,
                discount: discount,
                rating: rating || 'NA',
                reviews: reviews,
                availability: availability,
                category: 'NA',
                description: 'NA',
                sku: 'NA',
                seller: seller,
                brand: brand,
                image: ''
            };
        }).filter(p => p.name && p.name !== 'NA' && p.name.length > 3);
    }

    // Dedup by name
    const seen = new Set();
    const unique = products.filter(p => {
        const key = (p.name || '').toLowerCase().substring(0, 50);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    console.log(`[parseListPage] Returning ${unique.length} unique products`);
    return unique;
}

function isListPage(url, site) {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    const search = urlObj.search.toLowerCase();
    const hostname = urlObj.hostname.toLowerCase();

    console.log(`Checking if ${url} is a list page for site: ${site}`);

    if (site === 'toscrape') {
        // Books.toscrape.com list pages don't have /catalogue/ in URL
        const isList = !path.includes('/catalogue/');
        console.log(`BooksToScrape: ${isList ? 'LIST' : 'PRODUCT'} page`);
        return isList;
    } else if (site === 'amazon') {
        // Amazon search results have /s/ or /search in URL, or have query parameters
        const isList = path.includes('/s/') || path.includes('/search') || search.includes('k=') || search.includes('q=');
        console.log(`Amazon: ${isList ? 'LIST' : 'PRODUCT'} page`);
        return isList;
    } else if (site === 'flipkart') {
        // Flipkart search/category pages
        const isList = path.includes('/search') || path.includes('/category') || path.includes('/products') ||
                      search.includes('q=') || search.includes('p[]=') || hostname.includes('flipkart.com');
        console.log(`Flipkart: ${isList ? 'LIST' : 'PRODUCT'} page`);
        return isList;
    } else if (site === 'myntra') {
        // Myntra shop/search pages
        const isList = path.includes('/shop') || path.includes('/search') || search.includes('q=') ||
                      path.includes('/men-') || path.includes('/women-') || path.includes('/kids-');
        console.log(`Myntra: ${isList ? 'LIST' : 'PRODUCT'} page`);
        return isList;
    } else if (site === 'meesho') {
        // Meesho search/product pages
        const isList = path.includes('/search') || path.includes('/products') || search.includes('search=') ||
                      path.includes('/men-') || path.includes('/women-') || path.includes('/kids-');
        console.log(`Meesho: ${isList ? 'LIST' : 'PRODUCT'} page`);
        return isList;
    } else if (site === 'shopsy') {
        // Shopsy search/category pages
        const isList = path.includes('/search') || path.includes('/category') || search.includes('q=') ||
                      hostname.includes('shopsy.in');
        console.log(`Shopsy: ${isList ? 'LIST' : 'PRODUCT'} page`);
        return isList;
    } else {
        // Generic fallback: check for common list page patterns
        const isList = path.includes('/search') || path.includes('/category') || path.includes('/products') ||
                      search.includes('q=') || search.includes('search=') || search.includes('k=');
        console.log(`Generic: ${isList ? 'LIST' : 'PRODUCT'} page`);
        return isList;
    }
}

// MAIN
async function startScrape() {
    const url = document.getElementById('urlInp').value.trim();
    if (!url) return alert('Please enter a product URL');
    try {
        new URL(url);
    } catch {
        return alert('Invalid URL (must start with https://)');
    }

    const btn = document.getElementById('goBtn');
    btn.disabled = true;
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('stepsRow').style.display = 'flex';
    ['s1','s2','s3','s4'].forEach(s => stepSet(s, ''));
    setStatus('Starting...', 'loading');
    log(`Target: ${url}`);

    const normal = (v) => {
        if (v === undefined || v === null) return '';
        const s = String(v).trim();
        if (!s || s.toUpperCase() === 'NA') return '';
        return s;
    };
    const normalizeBackendProduct = (p) => {
        const nameVal = normal(p['Product Name'] || p.name || p.title || p.product_name);
        const brandVal = normal(p['Brand'] || p.brand);
        const priceVal = normal(p['Price (£)'] || p.price || p.currentPrice || p.price_usd);
        const mrpVal = normal(p['MRP'] || p.mrp || p['List Price'] || p.list_price);
        let discountVal = normal(p['Discount'] || p.discount || p['Save'] || p.save);
        if (!discountVal && priceVal && mrpVal) {
            const ru = parseFloat((priceVal || '').replace(/[^0-9\.]/g, ''));
            const rm = parseFloat((mrpVal || '').replace(/[^0-9\.]/g, ''));
            if (!isNaN(ru) && !isNaN(rm) && rm > ru) {
                discountVal = Math.round((rm - ru) / rm * 100) + '% off';
            }
        }

        const ratingVal = normal(p['Rating'] || p.rating);
        const reviewsVal = normal(p['Reviews'] || p.reviews || p.review_count);

        return {
            site: detectSite(url),
            source: p.source || p.url || url,
            method: 'backend',
            name: nameVal || 'Unknown product',
            price: priceVal || '',
            mrp: mrpVal || '',
            discount: discountVal || '',
            rating: ratingVal || '',
            reviews: reviewsVal || '',
            availability: normal(p['Availability'] || p.availability) || 'Available',
            brand: brandVal || (nameVal ? nameVal.split(' ')[0] : ''),
            category: normal(p['Category'] || p.category) || '',
            sku: normal(p['SKU'] || p.sku || p['ASIN']) || '',
            seller: normal(p['Seller'] || p.seller) || '',
            description: normal(p['Description'] || p.description) || '',
            image: p['Image'] || p.image || p.img || ''
        };
    };

    try {
        stepSet('s1', 'active');
        setStatus('Requesting backend scrape...', 'loading');
        log('Calling backend /scrape API');

        const backendUrl = 'http://localhost:5000/scrape';
        log(`Using backend endpoint: ${backendUrl}`);

        const resp = await fetch(backendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, pages: 3 })
        });

        if (!resp.ok) {
            throw new Error(`Backend status ${resp.status}`);
        }

        const result = await resp.json();
        if (result.status === 'success' && Array.isArray(result.data) && result.data.length > 0) {
            const scrapedProducts = result.data.map(normalizeBackendProduct);
            stepSet('s1', 'done');
            stepSet('s2', 'done');
            stepSet('s3', 'done');
            stepSet('s4', 'active');
            setStatus(`Rendering backend scraped products: ${scrapedProducts.length}`, 'loading');
            products.length = 0;
            addProducts(scrapedProducts);
            stepSet('s4', 'done');
            setStatus(`Done! ${scrapedProducts.length} products (backend)`, 'ok');
            hideStatus();
            btn.disabled = false;
            return;
        }

        log('Backend scrape did not produce products, falling back to proxy mode', 'w');
        // continue to proxy flow below if no data
    } catch (err) {
        log('Backend scrape failed: ' + err.message, 'w');
        setStatus('Backend failed, using proxy fallback', 'warn');
        // Continue to proxy logic
    }

    // Fallback proxy+DOM process
    try {
        stepSet('s1', 'active');
        setStatus('Fetching via CORS proxy...', 'loading');
        const html = await fetchHTML(url);
        if (!html) throw new Error('All proxies failed. Please check URL or try again later.');

        stepSet('s1', 'done'); stepSet('s2', 'active');
        setStatus('Parsing HTML...', 'loading');
        log(`HTML length: ${html.length}, contains 'product_main': ${html.includes('product_main')}`);

        let site = detectSite(url);
        if (allMode) site = 'all';
        const scrapedProducts = parseListPage(html, url, site);

        if (scrapedProducts.length > 0) {
            stepSet('s2', 'done');
            stepSet('s3', 'done');
            stepSet('s4', 'active');
            setStatus('Rendering list products...', 'loading');
            products.length = 0;
            addProducts(scrapedProducts);
            stepSet('s4', 'done');
            setStatus(`Done! ${scrapedProducts.length} products`, 'ok');
            hideStatus();
        } else {
            const product = extractDOM(html, url);
            log(`Extracted data: ${JSON.stringify(product)}`);
            stepSet('s2', 'done');
            stepSet('s3', 'done');
            product.method = 'proxy';
            const hasData = Object.keys(product).some(k => k !== 'site' && k !== 'source' && k !== 'method' && product[k]);
            if (!hasData) {
                log('Warning: No product data extracted!', 'w');
            }
            stepSet('s4', 'active');
            setStatus('Rendering...', 'loading');
            products.length = 0;
            addProduct(product);
            stepSet('s4', 'done');
            setStatus(`Done! Method: ${product.method}`, 'ok');
            hideStatus();
        }
    } catch (err) {
        log('Error: ' + err.message, 'e');
        setStatus(err.message, 'err');
        ['s1','s2','s3','s4'].forEach(id => {
            if (document.getElementById(id)?.className.includes('active')) stepSet(id, 'fail');
        });
    }
    btn.disabled = false;
}

// RENDER
function addProduct(p) {
    products.unshift(p);
    renderAll();
}
function addProducts(list) {
    products = list.concat(products);
    renderAll();
}
function renderAll() {
    document.getElementById('resultsWrap').style.display = 'block';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('rcnt').textContent = `${products.length} product${products.length !== 1 ? 's' : ''}`;

    // Grid
    const g = document.getElementById('pgrid');
    g.innerHTML = '';
    products.forEach((p, i) => {
        const c = document.createElement('div');
        c.className = 'pcard';
        c.style.animationDelay = i * 0.04 + 's';
        const siteClass = p.site === 'flipkart' ? 'fk' : p.site !== 'amazon' ? 'gen' : '';
        const availCls = p.availability?.toLowerCase().includes('out') ? 'b-out' : 'b-in';
        const methodCls = p.method?.includes('claude') ? (p.method.includes('ai') ? 'ai' : '') : '';
        const stars = '★'.repeat(Math.min(5, Math.round(parseFloat(p.rating) || 0)));
        c.innerHTML = `
            <div class="cidx"><span>${String(i+1).padStart(3,'0')}</span> <span class="sbadge ${siteClass}">${p.site || 'generic'?.toUpperCase()}</span> <span class="mbadge ${methodCls}">${p.method || ''}</span></div>
            <div class="pname">${esc(p.name || 'NA')}</div>
            <div class="pmeta">
                ${p.price ? `<span class="badge b-price">${esc(p.price)}</span>` : ''}
                ${p.mrp ? `<span class="badge b-mrp">${esc(p.mrp)}</span>` : ''}
                ${p.discount ? `<span class="badge b-disc">${esc(p.discount)}</span>` : ''}
                ${p.rating ? `<span class="badge b-rat">${stars} ${esc(p.rating)}</span>` : ''}
                ${p.reviews ? `<span class="badge b-rev">${esc(p.reviews)}</span>` : ''}
                ${p.availability ? `<span class="badge ${availCls}">${esc(p.availability).slice(0,22)}</span>` : ''}
            </div>
            <div class="pextra">
                ${p.brand ? `<div class="exrow"><span class="exlbl">Brand</span><span class="exval">${esc(p.brand).slice(0,28)}</span></div>` : ''}
                ${p.category ? `<div class="exrow"><span class="exlbl">Category</span><span class="exval">${esc(p.category).slice(0,26)}</span></div>` : ''}
                ${p.sku ? `<div class="exrow"><span class="exlbl">SKU/ASIN</span><span class="exval">${esc(p.sku).slice(0,24)}</span></div>` : ''}
                ${p.seller ? `<div class="exrow"><span class="exlbl">Seller</span><span class="exval">${esc(p.seller).slice(0,24)}</span></div>` : ''}
                <div class="exrow" style="grid-column:1/-1;"><span class="exlbl">URL</span><a class="exlink" href="${esc(p.source)}" target="_blank">${esc(p.source).slice(0,48)}</a></div>
                ${p.description ? `<div class="exrow" style="grid-column:1/-1;"><span class="exlbl">Description</span><span class="exval" style="white-space:normal;max-width:100%">${esc(p.description).slice(0,130)}</span></div>` : ''}
            </div>
        `;
        g.appendChild(c);
    });

    // Table (similar logic, truncated)
    const tb = document.getElementById('tbody');
    tb.innerHTML = '';
    products.forEach((p, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:var(--muted);font-family:'Space Mono',monospace;font-size:0.6rem">${i+1}</td>
            <td class="td-name" title="${esc(p.name)}">${esc(p.name || 'NA').slice(0,55)}</td>
            <td class="td-price">${esc(p.price || 'NA')}</td>
            <td style="color:var(--muted);text-decoration:line-through;font-size:0.72rem">${esc(p.mrp || 'NA')}</td>
            <td style="color:var(--green)">${esc(p.discount || 'NA')}</td>
            <td class="td-rat">${p.rating ? esc(p.rating) + ' ★' : 'NA'}</td>
            <td style="color:var(--purple)">${esc(p.reviews || 'NA')}</td>
            <td>${esc(p.availability || 'NA')}</td>
            <td>${esc(p.brand || 'NA')}</td>
            <td><span class="mbadge">${p.method?.includes('ai') ? 'ai' : esc(p.method)}</span></td>
        `;
        tb.appendChild(tr);
    });
}

function setView(v) {
    view = v;
    document.getElementById('pgrid').style.display = v === 'grid' ? 'grid' : 'none';
    document.getElementById('twrap').style.display = v === 'table' ? 'block' : 'none';
    document.getElementById('vgBtn').classList.toggle('on', v === 'grid');
    document.getElementById('vtBtn').classList.toggle('on', v === 'table');
}

// EXPORT
function exportCSV() {
    if (!products.length) return;
    const keys = ['name','price','mrp','discount','rating','reviews','availability','brand','category','sku','seller','description','source','url','site','method'];
    const hdr = keys.join(',');
    const rows = products.map(p => keys.map(k => `"${String(p[k] || 'NA').replace(/"/g, '""')}"`).join(','));
    dl(`ecom_scrape_${Date.now()}.csv`, [hdr, ...rows].join('\n'), 'text/csv');
}
function exportJSON() {
    if (!products.length) return;
    dl(`ecom_scrape_${Date.now()}.json`, JSON.stringify(products, null, 2), 'application/json');
}
function dl(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], {type}));
    a.download = name;
    a.click();
}

function clearResults() {
    products = [];
    document.getElementById('resultsWrap').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('stepsRow').style.display = 'none';
}
function clearAll() {
    clearResults();
    document.getElementById('urlInp').value = '';
    document.getElementById('logBox').innerHTML = '';
    document.getElementById('statusBar').classList.remove('show');
}

// Auto-init
init();
