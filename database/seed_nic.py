"""
ResQAI — NIC Database Seeder.
Generates 500 valid Sri Lankan NICs and inserts them using asyncpg.
"""

import asyncio
import random
from datetime import datetime

import asyncpg

DB_URL = "postgresql://resqai_user:resqai_pass@localhost:5433/resqai"

DISTRICTS = [
    "Colombo", "Gampaha", "Kandy", "Ratnapura", "Galle",
    "Jaffna", "Trincomalee", "Batticaloa", "Anuradhapura", "Kurunegala"
]

def generate_old_nic():
    """Format: 9 digits + V/X. e.g., 881234567V"""
    year = random.randint(50, 99)
    # Day of year: 1-366 for men, 501-866 for women
    is_male = random.choice([True, False])
    day = random.randint(1, 365)
    if not is_male:
        day += 500
        
    sequence = random.randint(1, 9999)
    return f"{year:02d}{day:03d}{sequence:04d}V"

def generate_new_nic():
    """Format: 12 digits. e.g., 198812345678"""
    year = random.randint(1950, 2005)
    is_male = random.choice([True, False])
    day = random.randint(1, 365)
    if not is_male:
        day += 500
        
    sequence = random.randint(1, 9999)
    check_digit = random.randint(0, 9)
    return f"{year:04d}{day:03d}{sequence:04d}{check_digit}"

async def main():
    print("Connecting to database...")
    conn = await asyncpg.connect(DB_URL)
    
    records = []
    
    # Generate 250 old format
    for _ in range(250):
        records.append((generate_old_nic(), True, random.choice(DISTRICTS)))
        
    # Generate 250 new format
    for _ in range(250):
        records.append((generate_new_nic(), True, random.choice(DISTRICTS)))
        
    print(f"Inserting {len(records)} NIC records...")
    
    query = """
        INSERT INTO nic_database (nic_number, is_valid, district)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
    """
    
    await conn.executemany(query, records)
    print("✅ Seeding complete.")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
