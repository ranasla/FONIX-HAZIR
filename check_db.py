import sqlite3

conn = sqlite3.connect('fonix.db')
cursor = conn.cursor()

# Tum tablolari listele
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("Tablolar:", [t[0] for t in tables])

# User tablosu var mi?
if ('user',) in tables:
    print("\nUser tablosu mevcut!")
    cursor.execute("SELECT id, username, email FROM user")
    users = cursor.fetchall()
    print(f"Kayitli kullanicilar ({len(users)}):")
    for u in users:
        print(f"  - ID: {u[0]}, Username: {u[1]}, Email: {u[2]}")
else:
    print("\nUser tablosu YOK!")

conn.close()
