import os
import re
from flask import Flask, jsonify, request
from flask_cors import CORS

# Try to import scraper with browser/render support first
try:
    from scraper import run_scraper
except Exception as e:
    print(f"scraper.py import failed, falling back to scraper_simple: {e}")
    try:
        from scraper_simple import run_scraper
    except Exception as e2:
        print(f"Error importing scraper_simple: {e2}")
        run_scraper = None

# ============================================================
# Create Flask App
# ============================================================

app = Flask(__name__)

# Enable CORS so frontend (GitHub Pages / localhost) can call API
CORS(app, resources={r"/*": {"origins": "*"}})


# ============================================================
# Home Route
# ============================================================

@app.route("/")
def home():
    return jsonify({
        "message": "ScrapeDash Backend Running",
        "status": "ok"
    })


# ============================================================
# Health Check Route (for uptime monitoring)
# ============================================================

@app.route("/health")
def health():
    return jsonify({
        "status": "ok"
    }), 200


# ============================================================
# Scrape API
# ============================================================

@app.route("/scrape", methods=["POST"])
def scrape():

    # Get JSON data from request
    data = request.get_json(silent=True) or {}

    # Extract URL
    url = data.get("url")

    # Extract pages value safely
    try:
        pages = int(data.get("pages", 1))
    except (TypeError, ValueError):
        pages = 1

    # Validate URL
    if not url:
        return jsonify({
            "status": "error",
            "message": "URL is required"
        }), 400

    try:
        # Run scraper
        df = run_scraper(start_url=url, max_pages=pages)

        # Check if scraper returned data
        if df.empty:
            return jsonify({
                "status": "error",
                "message": "No products scraped"
            }), 200

        # Convert dataframe → JSON list
        products = df.to_dict(orient="records")

        # Normalize types
        for p in products:
            # Handle price conversion
            for price_key in ["price", "Price (£)"]:
                if price_key in p:
                    try:
                        price_val = str(p[price_key]).replace('£','').replace('$','').replace(',','').strip()
                        p[price_key] = float(price_val) if price_val else 0.0
                    except:
                        p[price_key] = 0.0
                    break

            # Handle rating conversion
            for rating_key in ["rating", "Rating"]:
                if rating_key in p:
                    try:
                        text = str(p[rating_key]).strip()
                        m = re.search(r"(\d+(?:\.\d+)?)", text)
                        p[rating_key] = float(m.group(1)) if m else 0.0
                    except:
                        p[rating_key] = 0.0
                    break

            # Handle reviews conversion
            for review_key in ["reviews", "Reviews", "review_count"]:
                if review_key in p:
                    try:
                        text = str(p[review_key]).strip()
                        m = re.search(r"([\d,]+)", text)
                        p[review_key] = int(m.group(1).replace(',', '')) if m else 0
                    except:
                        p[review_key] = 0
                    break

        return jsonify({
            "status": "success",
            "count": len(products),
            "data": products
        }), 200

    except Exception as e:

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# ============================================================
# Run Flask Server (Render Compatible)
# ============================================================

if __name__ == "__main__":

    # Render provides PORT automatically
    port = int(os.environ.get("PORT", 5000))

    # host="0.0.0.0" allows public access
    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )
