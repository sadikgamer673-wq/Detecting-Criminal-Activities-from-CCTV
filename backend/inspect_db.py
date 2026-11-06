import sqlite3

conn = sqlite3.connect('cctv_surveillance.db')
c = conn.cursor()
tables = [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print('Tables:', tables)

for t in tables:
    cnt = c.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    print(f"Table {t}: {cnt} rows")

if 'potential_incidents' in tables:
    print('\nPotential Incidents:')
    for row in c.execute('SELECT id, source_type, source_id, category, confidence, timestamp_start, review_status FROM potential_incidents').fetchall():
        print(row)

if 'incident_evidence' in tables:
    print('\nIncident Evidence:')
    for row in c.execute('SELECT id, incident_id, clip_path, thumbnail_path, duration_seconds FROM incident_evidence').fetchall():
        print(row)

if 'video_analysis_jobs' in tables:
    print('\nVideo Analysis Jobs:')
    for row in c.execute('SELECT id, filename, status, video_path FROM video_analysis_jobs').fetchall():
        print(row)

conn.close()
