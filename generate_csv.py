#!/usr/bin/env python3
"""
CSV Generator for Product Importer Testing

Generates a CSV file with 500,000 product records for testing the
Product Importer system's ability to handle large datasets.

Usage:
    python generate_csv.py [--rows 500000] [--output products_500k.csv]

Features:
- Generates realistic product data with unique SKUs
- Configurable number of rows
- Progress indicator
- Memory-efficient streaming write
"""

import csv
import random
import argparse
from datetime import datetime


# Product name components for realistic data generation
ADJECTIVES = [
    'Premium', 'Deluxe', 'Professional', 'Advanced', 'Ultimate', 'Elite',
    'Classic', 'Modern', 'Vintage', 'Eco-Friendly', 'Luxury', 'Budget',
    'Compact', 'Portable', 'Heavy-Duty', 'Lightweight', 'Wireless', 'Smart'
]

PRODUCT_TYPES = [
    'Widget', 'Gadget', 'Tool', 'Device', 'Accessory', 'Component',
    'Module', 'System', 'Kit', 'Set', 'Package', 'Bundle', 'Unit',
    'Appliance', 'Equipment', 'Instrument', 'Machine', 'Apparatus'
]

CATEGORIES = [
    'Electronics', 'Home & Garden', 'Sports & Outdoors', 'Automotive',
    'Office Supplies', 'Health & Beauty', 'Toys & Games', 'Books',
    'Clothing', 'Food & Beverage', 'Pet Supplies', 'Industrial'
]

MATERIALS = [
    'Aluminum', 'Steel', 'Plastic', 'Carbon Fiber', 'Titanium', 'Wood',
    'Glass', 'Ceramic', 'Rubber', 'Leather', 'Fabric', 'Composite'
]

COLORS = [
    'Black', 'White', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Yellow',
    'Orange', 'Purple', 'Pink', 'Brown', 'Gold', 'Bronze', 'Beige'
]


def generate_sku(index):
    """Generate a unique SKU for a product."""
    # Format: PRD-XXXXXX (e.g., PRD-000001, PRD-123456)
    return f"PRD-{index:06d}"


def generate_product_name():
    """Generate a realistic product name."""
    adjective = random.choice(ADJECTIVES)
    product_type = random.choice(PRODUCT_TYPES)
    category = random.choice(CATEGORIES)
    
    # Randomly add color or material
    if random.random() > 0.5:
        modifier = random.choice(COLORS)
    else:
        modifier = random.choice(MATERIALS)
    
    # Various name formats for variety
    formats = [
        f"{adjective} {product_type}",
        f"{modifier} {product_type}",
        f"{adjective} {modifier} {product_type}",
        f"{category} {product_type}",
        f"{adjective} {category} {product_type}",
    ]
    
    return random.choice(formats)


def generate_description():
    """Generate a realistic product description."""
    templates = [
        "High-quality {material} construction with {adjective} design. Perfect for {category} applications.",
        "This {adjective} {product_type} features advanced technology and superior performance.",
        "Durable {material} {product_type} designed for professional use. {adjective} quality guaranteed.",
        "Premium {category} product with {adjective} features. Made from {material} for long-lasting durability.",
        "{adjective} {product_type} suitable for both personal and commercial use. Available in {color}.",
        "Innovative {material} design meets {adjective} functionality in this {category} {product_type}.",
        "Professional-grade {product_type} with {adjective} performance. Ideal for demanding applications.",
    ]
    
    template = random.choice(templates)
    description = template.format(
        material=random.choice(MATERIALS).lower(),
        adjective=random.choice(ADJECTIVES).lower(),
        category=random.choice(CATEGORIES).lower(),
        product_type=random.choice(PRODUCT_TYPES).lower(),
        color=random.choice(COLORS).lower()
    )
    
    return description


def generate_csv(num_rows=500000, output_file='products_500k.csv'):
    """
    Generate a CSV file with product data.
    
    Args:
        num_rows: Number of product rows to generate
        output_file: Output CSV filename
    """
    print(f"🚀 Generating CSV with {num_rows:,} products...")
    print(f"📁 Output file: {output_file}")
    print()
    
    start_time = datetime.now()
    
    # Write CSV with streaming to handle large files efficiently
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['sku', 'name', 'description', 'is_active']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        # Write header
        writer.writeheader()
        
        # Generate and write rows
        for i in range(1, num_rows + 1):
            row = {
                'sku': generate_sku(i),
                'name': generate_product_name(),
                'description': generate_description(),
                'is_active': 'true' if random.random() > 0.2 else 'false'
            }
            writer.writerow(row)
            
            # Progress indicator
            if i % 10000 == 0:
                progress = (i / num_rows) * 100
                elapsed = (datetime.now() - start_time).total_seconds()
                rate = i / elapsed if elapsed > 0 else 0
                eta = (num_rows - i) / rate if rate > 0 else 0
                
                print(f"Progress: {i:,}/{num_rows:,} ({progress:.1f}%) | "
                      f"Rate: {rate:.0f} rows/sec | "
                      f"ETA: {eta:.0f}s", end='\r')
    
    # Final statistics
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    print()  # New line after progress indicator
    print()
    print("✅ CSV generation complete!")
    print(f"⏱️  Time taken: {duration:.2f} seconds")
    print(f"📊 Rows generated: {num_rows:,}")
    print(f"⚡ Average rate: {num_rows/duration:.0f} rows/second")
    
    # File size
    import os
    file_size = os.path.getsize(output_file)
    file_size_mb = file_size / (1024 * 1024)
    print(f"💾 File size: {file_size_mb:.2f} MB")
    print()
    print(f"🎯 Ready to test! Upload {output_file} to the Product Importer.")


def main():
    """Main entry point with argument parsing."""
    parser = argparse.ArgumentParser(
        description='Generate CSV file with product data for testing',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate default 500,000 rows
  python generate_csv.py
  
  # Generate custom number of rows
  python generate_csv.py --rows 100000
  
  # Specify output filename
  python generate_csv.py --rows 1000000 --output products_1m.csv
  
  # Quick test with 1000 rows
  python generate_csv.py --rows 1000 --output products_test.csv
        """
    )
    
    parser.add_argument(
        '--rows',
        type=int,
        default=500000,
        help='Number of product rows to generate (default: 500000)'
    )
    
    parser.add_argument(
        '--output',
        type=str,
        default='products_500k.csv',
        help='Output CSV filename (default: products_500k.csv)'
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.rows < 1:
        print("❌ Error: Number of rows must be at least 1")
        return 1
    
    if args.rows > 10000000:
        print("⚠️  Warning: Generating more than 10 million rows may take a long time")
        response = input("Continue? (y/n): ")
        if response.lower() != 'y':
            print("Cancelled.")
            return 0
    
    # Generate CSV
    try:
        generate_csv(args.rows, args.output)
        return 0
    except KeyboardInterrupt:
        print("\n\n❌ Generation cancelled by user")
        return 1
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        return 1


if __name__ == '__main__':
    exit(main())
