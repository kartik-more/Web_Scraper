// ============================================================
//   ScrapeDash Frontend - Uses Flask Backend API
// ============================================================

// STATE
let products = [], view = 'grid', logOpen = false;
const API_URL = 'http://localhost:5000'; // Flask backend URL

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

// ============================================================
//   INIT
// ============================================================

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

function setUrl(u) { 
    document.getElementById('urlInp').value = u; 
}

function esc(s) { 
    return String(s).replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;'); 
}

// ============================================================
//   LOGGING
// ============================================================

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

// ============================================================
//   STATUS & PROGRESS
// ============================================================

function setStatus(m, s = 'loading') {
    const bar = document.getElementById('statusBar');
    bar.classList.add('show');
    document.getElementById('statusTxt').textContent = m;
    const sp = document.getElementById('spinEl'), sd = document.getElementById('sdotEl');
    if (s === 'loading') {
        sp.style.display = 'block'; 
        sd.className = 'sdot';
    } else {
        sp.style.display = 'none'; 
        sd.className = 'sdot ' + s;
    }
}

function hideStatus() { 
    setTimeout(() => document.getElementById('statusBar').classList.remove('show'), 4500); 
}

const STEPNAMES = {
    s1: 'Send request', 
    s2: 'Fetch HTML', 
    s3: 'Parse data', 
    s4: 'Render results'
};

const STEPICONS = {active: '▶', done: '✅', fail: '❌'};

function stepSet(id, st) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'step ' + st;
    el.textContent = STEPICONS[st] + ' ' + STEPNAMES[id];
}

// ============================================================
//   MAIN SCRAPE FUNCTION
// ============================================================

async function startScrape() {
    const url = document.getElementById('urlInp').value.trim();
    
    if (!url) {
        setStatus('❌ Enter a URL', 'fail');
        log('No URL provided', 'e');
        hideStatus();
        return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        setStatus('❌ URL must start with http:// or https://', 'fail');
        log('Invalid URL format', 'e');
        hideStatus();
        return;
    }

    products = [];
    clearResults();
    showSteps();
    setStatus('Scraping data...', 'loading');
    
    log('='.repeat(50));
    log(`🚀 Starting scrape: ${url}`);
    log('Connecting to Flask backend...');
    
    try {
        // Show progress steps
        stepSet('s1', 'done');
        stepSet('s2', 'active');
        stepSet('s3', 'active');
        stepSet('s4', 'active');

        // Call Flask backend API
        const pageCount = parseInt(document.getElementById('pageCountInp')?.value || '1') || 1;
        log(`📄 Requesting ${pageCount} page(s)...`);
        
        const response = await fetch(`${API_URL}/scrape`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: url,
                pages: pageCount
            })
        });

        stepSet('s2', 'done');

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        log(`Response: ${JSON.stringify(data).substring(0, 100)}...`);

        stepSet('s3', 'done');

        if (data.status !== 'success') {
            log(`❌ Error: ${data.message}`, 'e');
            setStatus(`❌ ${data.message}`, 'fail');
            hideStatus();
            return;
        }

        if (!data.data || data.data.length === 0) {
            log('⚠ No products found', 'w');
            setStatus('No products scraped', 'fail');
            hideStatus();
            return;
        }

        // Process results
        products = data.data;
        log(`✅ Scraped ${products.length} products`);

        // Show each product
        products.forEach((p, i) => {
            log(`  ${i+1}. ${p.name} - ${p.price}`);
        });

        stepSet('s4', 'done');

        // Render results
        renderResults();
        
        setStatus(`✅ ${products.length} products scraped`, 'ok');
        hideStatus();
        log('Done!');

    } catch (error) {
        log(`❌ Error: ${error.message}`, 'e');
        setStatus(`❌ Error: ${error.message}`, 'fail');
        stepSet('s2', 'fail');
        hideStatus();
    }
}

// ============================================================
//   RENDER RESULTS
// ============================================================

function renderResults() {
    if (products.length === 0) {
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('resultsWrap').style.display = 'none';
        return;
    }

    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('resultsWrap').style.display = 'block';

    // Update count
    document.getElementById('rcnt').textContent = products.length + ' product' + (products.length !== 1 ? 's' : '');

    // Update grid
    const pgrid = document.getElementById('pgrid');
    pgrid.innerHTML = '';

    products.forEach((p, i) => {
        const card = document.createElement('div');
        card.className = 'pcard';
        
        const img = p.image ? `<img src="${p.image}" alt="${esc(p.name)}">` : '<div style="width:100%; height:150px; background:#ddd; display:flex; align-items:center; justify-content:center; color:#999;">No Image</div>';
        
        card.innerHTML = `
            <div class="pimg">${img}</div>
            <div class="pinfo">
                <div class="pname" title="${esc(p.name)}">${esc(p.name || 'NA')}</div>
                <div class="pprice">${esc(String(p.price || 'NA'))}</div>
                ${p.rating ? `<div class="prating">⭐ ${esc(String(p.rating))}</div>` : ''}
                <div class="pbrand">${esc(String(p.brand || 'NA'))}</div>
            </div>
        `;
        
        pgrid.appendChild(card);
    });

    // Update table
    const tbody = document.getElementById('tbody');
    tbody.innerHTML = '';
    
    products.forEach((p, i) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${i + 1}</td>
            <td>${esc(p.name || 'NA')}</td>
            <td>${esc(String(p.price || 'NA'))}</td>
            <td>${esc(String(p.mrp || 'NA'))}</td>
            <td>${esc(String(p.discount || 'NA'))}</td>
            <td>${esc(String(p.rating || 'NA'))}</td>
            <td>${esc(String(p.reviews || 'NA'))}</td>
            <td>${esc(String(p.availability || 'NA'))}</td>
            <td>${esc(String(p.brand || 'NA'))}</td>
            <td>${esc(String(p.method || 'NA'))}</td>
        `;
    });
}

function clearResults() {
    products = [];
    document.getElementById('pgrid').innerHTML = '';
    document.getElementById('tbody').innerHTML = '';
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('resultsWrap').style.display = 'none';
}

function clearAll() {
    document.getElementById('urlInp').value = '';
    clearResults();
    document.getElementById('logBox').innerHTML = '';
}

// ============================================================
//   VIEW MODES
// ============================================================

function setView(v) {
    view = v;
    document.getElementById('vgBtn').classList.remove('on');
    document.getElementById('vtBtn').classList.remove('on');
    
    if (v === 'grid') {
        document.getElementById('vgBtn').classList.add('on');
        document.getElementById('pgrid').style.display = 'grid';
        document.getElementById('twrap').style.display = 'none';
    } else {
        document.getElementById('vtBtn').classList.add('on');
        document.getElementById('pgrid').style.display = 'none';
        document.getElementById('twrap').style.display = 'block';
    }
}

function showSteps() {
    const sr = document.getElementById('stepsRow');
    if (sr) sr.style.display = 'flex';
}

// ============================================================
//   EXPORT FUNCTIONS
// ============================================================

function exportCSV() {
    if (products.length === 0) {
        alert('No data to export');
        return;
    }

    const headers = Object.keys(products[0]);
    let csv = headers.join(',') + '\n';
    
    products.forEach(p => {
        const row = headers.map(h => {
            const val = p[h] || '';
            const escaped = String(val).replace(/"/g, '""');
            return `"${escaped}"`;
        }).join(',');
        csv += row + '\n';
    });

    downloadFile(csv, 'products.csv', 'text/csv');
}

function exportJSON() {
    if (products.length === 0) {
        alert('No data to export');
        return;
    }
    
    const json = JSON.stringify(products, null, 2);
    downloadFile(json, 'products.json', 'application/json');
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Initialize on page load
window.onload = function() {
    init();
    log('ScrapeDash Frontend Loaded');
    log('Connected to: ' + API_URL);
    log('Ready to scrape!');
};
