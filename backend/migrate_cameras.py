import sqlite3
from pathlib import Path

db_path = Path(__file__).parent / "cctv_surveillance.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()
cols = [r[1] for r in c.execute("PRAGMA table_info(cameras)").fetchall()]
print("Existing camera columns:", cols)

if "source_type" not in cols:
    c.execute("ALTER TABLE cameras ADD COLUMN source_type VARCHAR(50) DEFAULT 'ip_cctv'")
    print("Added source_type column")

if "monitoring_active" not in cols:
    c.execute("ALTER TABLE cameras ADD COLUMN monitoring_active BOOLEAN DEFAULT 0")
    print("Added monitoring_active column")

if "last_error" not in cols:
    c.execute("ALTER TABLE cameras ADD COLUMN last_error TEXT DEFAULT NULL")
    print("Added last_error column")

conn.commit()
updated = [r[1] for r in c.execute("PRAGMA table_info(cameras)").fetchall()]
print("Updated camera columns:", updated)
conn.close()
