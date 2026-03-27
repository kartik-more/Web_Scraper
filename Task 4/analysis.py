# ============================================================
#   ScrapeDash — E-Commerce Product Web Scraper
#   analysis.py — Data Analysis using Pandas
# ============================================================

import pandas as pd
import os

CSV_FILE = "products.csv"

# ============================================================
#   LOAD DATA
# ============================================================
def load_data(filename=CSV_FILE):
    """Load the CSV file into a pandas DataFrame."""
    if not os.path.exists(filename):
        print(f"  ✗ File '{filename}' not found.")
        print("  → Please run scraper.py first to generate the data.")
        return None

    df = pd.read_csv(filename, index_col="ID")
    print(f"  ✓ Loaded {len(df)} records from '{filename}'")
    return df


# ============================================================
#   FULL ANALYSIS
# ============================================================
def analyze(df):
    """Run complete data analysis on the scraped dataset."""
    print("\n" + "=" * 55)
    print("   📊 FULL DATA ANALYSIS")
    print("=" * 55)

    # --- Basic Info ---
    print("\n📋 DATASET INFO:")
    print(f"  Total Products  : {len(df)}")
    print(f"  Columns         : {list(df.columns)}")
    print(f"  Missing Values  : {df.isnull().sum().sum()}")

    # --- Price Analysis ---
    print("\n💰 PRICE ANALYSIS:")
    print(f"  Average Price   : £{df['Price (£)'].mean():.2f}")
    print(f"  Median Price    : £{df['Price (£)'].median():.2f}")
    print(f"  Cheapest Book   : £{df['Price (£)'].min():.2f}")
    print(f"  Most Expensive  : £{df['Price (£)'].max():.2f}")
    print(f"  Price Std Dev   : £{df['Price (£)'].std():.2f}")

    # --- Price Ranges ---
    print("\n📊 PRICE DISTRIBUTION:")
    bins   = [0, 15, 25, 35, 45, 55, 100]
    labels = ["£0-15", "£15-25", "£25-35", "£35-45", "£45-55", "£55+"]
    df["Price Range"] = pd.cut(df["Price (£)"], bins=bins, labels=labels)
    price_dist = df["Price Range"].value_counts().sort_index()
    for label, count in price_dist.items():
        bar = "█" * (count // 2)
        print(f"  {label:>8}  {bar} {count}")

    # --- Rating Analysis ---
    print("\n⭐ RATING ANALYSIS:")
    print(f"  Average Rating  : {df['Rating'].mean():.2f} / 5")
    print(f"  Most Common     : {df['Rating'].mode()[0]} stars")

    print("\n  Rating Breakdown:")
    rating_counts = df["Rating"].value_counts().sort_index(ascending=False)
    for stars, count in rating_counts.items():
        pct = count / len(df) * 100
        bar = "█" * (count // 3)
        print(f"  {'★' * stars + '☆' * (5 - stars)}  {bar} {count} ({pct:.1f}%)")

    # --- Top Products ---
    print("\n🏆 TOP 5 HIGHEST RATED (5 Stars, Cheapest First):")
    top = df[df["Rating"] == 5].sort_values("Price (£)").head(5)
    if top.empty:
        print("  No 5-star products found.")
    else:
        for _, row in top.iterrows():
            print(f"  ⭐⭐⭐⭐⭐  £{row['Price (£)']:.2f}  —  {row['Product Name']}")

    # --- Cheapest Products ---
    print("\n💸 TOP 5 CHEAPEST PRODUCTS:")
    cheap = df.sort_values("Price (£)").head(5)
    for _, row in cheap.iterrows():
        print(f"  £{row['Price (£)']:.2f}  {'★' * row['Rating']}  —  {row['Product Name']}")

    # --- Most Expensive ---
    print("\n💎 TOP 5 MOST EXPENSIVE PRODUCTS:")
    expensive = df.sort_values("Price (£)", ascending=False).head(5)
    for _, row in expensive.iterrows():
        print(f"  £{row['Price (£)']:.2f}  {'★' * row['Rating']}  —  {row['Product Name']}")

    print("\n" + "=" * 55)
    return df


# ============================================================
#   FILTER FUNCTIONS
# ============================================================
def filter_by_rating(df, min_rating=4):
    """Return only products with rating >= min_rating."""
    filtered = df[df["Rating"] >= min_rating].copy()
    print(f"\n  🔍 Products with {min_rating}+ stars: {len(filtered)}")
    return filtered


def filter_by_price(df, min_price=0, max_price=100):
    """Return only products within a price range."""
    filtered = df[
        (df["Price (£)"] >= min_price) &
        (df["Price (£)"] <= max_price)
    ].copy()
    print(f"\n  🔍 Products £{min_price}–£{max_price}: {len(filtered)}")
    return filtered


def search_by_name(df, keyword):
    """Search products by keyword in the name."""
    filtered = df[
        df["Product Name"].str.contains(keyword, case=False, na=False)
    ].copy()
    print(f"\n  🔍 Products matching '{keyword}': {len(filtered)}")
    return filtered


# ============================================================
#   EXPORT FILTERED DATA
# ============================================================
def export_filtered(df, filename="filtered_products.csv"):
    """Save a filtered DataFrame to a new CSV file."""
    df.to_csv(filename)
    print(f"  💾 Filtered data saved to: {filename} ({len(df)} records)")


# ============================================================
#   RUN ANALYSIS
# ============================================================
if __name__ == "__main__":
    df = load_data()

    if df is not None:
        # Full analysis
        df = analyze(df)

        # Example: Filter 4+ star books under £30
        print("\n\n🔎 EXAMPLE FILTERS:")
        high_rated = filter_by_rating(df, min_rating=4)
        affordable  = filter_by_price(df, min_price=5, max_price=30)

        # Export filtered results
        export_filtered(high_rated, "high_rated_products.csv")
        export_filtered(affordable,  "affordable_products.csv")

        print("\n  ✅ Analysis complete!\n")
