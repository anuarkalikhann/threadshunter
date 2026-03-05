import os
import sqlite3
import pandas as pd
from serpapi import GoogleSearch
from apify_client import ApifyClient
from dotenv import load_dotenv
from datetime import datetime

# Загрузка переменных окружения (опционально)
load_dotenv()

# --- КОНФИГУРАЦИЯ ---
SERPAPI_KEY = os.getenv("SERPAPI_KEY")
APIFY_TOKEN = os.getenv("APIFY_TOKEN")
DB_NAME = "history.db"
CSV_NAME = "threads_monitoring_results.csv"

# --- ШАГ 1: ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ---
def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS history (
            url TEXT PRIMARY KEY,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    return conn

def is_new_url(conn, url):
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM history WHERE url = ?", (url,))
    return cursor.fetchone() is None

def add_url_to_history(conn, url):
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO history (url) VALUES (?)", (url,))
        conn.commit()
    except sqlite3.IntegrityError:
        pass

# --- ШАГ 2: ПОИСК В GOOGLE ЧЕРЕЗ SERPAPI ---
def search_threads_urls(keyword):
    print(f"[*] Поиск постов по ключевому слову: {keyword}...")
    
    # Расширяем поиск: убираем кавычки вокруг ключевого слова и пробуем за неделю (qdr:w)
    # Если за неделю ничего, попробуем за все время (убрав tbs)
    params = {
        "q": f'site:threads.net {keyword}',
        "tbs": "qdr:w", # за неделю
        "api_key": SERPAPI_KEY,
        "engine": "google",
        "num": 20
    }

    search = GoogleSearch(params)
    results = search.get_dict()
    
    if "error" in results:
        print(f"[!] Ошибка SerpApi: {results['error']}")
        return []

    urls = []
    if "organic_results" in results:
        print(f"[DEBUG] Всего органических результатов: {len(results['organic_results'])}")
        for result in results["organic_results"]:
            link = result.get("link")
            title = result.get("title", "")
            snippet = result.get("snippet", "")
            
            # Логируем каждый найденный домен для отладки
            # print(f"[DEBUG] Found link: {link}")
            
            # Threads ссылки могут иметь разный формат, проверяем наличие threads.net
            if link and "threads.net" in link:
                # В Google Threads ссылки часто ведут на посты или профили
                # Обычно пост содержит /post/ или @user/post/
                if "/post/" in link or "@" in link:
                    urls.append(link)
    else:
        print("[DEBUG] 'organic_results' не найдены в ответе SerpApi.")
    
    # Очистка ссылок
    urls = list(set([u.split('?')[0] for u in urls]))
    print(f"[+] Найдено потенциальных ссылок: {len(urls)}")
    return urls

# --- ШАГ 3: СКРЕЙПИНГ ЧЕРЕЗ APIFY ---
def scrape_threads_data(new_urls):
    if not new_urls:
        print("[!] Нет новых ссылок для скрейпинга.")
        return []

    print(f"[*] Запуск Apify для сбора данных по {len(new_urls)} ссылкам...")
    client = ApifyClient(APIFY_TOKEN)

    # Параметры для apify/threads-scraper
    run_input = {
        "startUrls": [{"url": url} for url in new_urls],
        "maxItems": 100,  # Опционально
        "proxyConfiguration": {"useApifyProxy": True}
    }

    # Запуск актора (используем актуальный ID из скриншота)
    run = client.actor("logical_scrapers/threads-post-scraper").call(run_input=run_input)

    # Получение результатов из dataset
    dataset_items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
    print(f"[+] Сбор данных завершен. Получено объектов: {len(dataset_items)}")
    return dataset_items

# --- ШАГ 4: АНАЛИЗ И СОХРАНЕНИЕ ---
def process_results(data, conn, keyword):
    if not data:
        print("[!] Данные не получены.")
        return

    # Структура от Apify: каждый item = {"thread": {...}, "replies": [...]}
    # Извлекаем главный пост + все реплаи в плоский список строк
    rows = []
    for item in data:
        # Главный пост
        thread = item.get("thread")
        if thread:
            rows.append({
                "url":          thread.get("url", "N/A"),
                "username":     thread.get("username", "N/A"),
                "text":         thread.get("text", ""),
                "likes":        thread.get("like_count", 0),
                "replies_count":thread.get("reply_count", 0),
                "date":         datetime.utcfromtimestamp(thread["published_on"]).strftime('%Y-%m-%d %H:%M')
                                if thread.get("published_on") else "N/A",
            })
        # Реплаи (ответы в треде)
        for reply in item.get("replies", []):
            rows.append({
                "url":          reply.get("url", "N/A"),
                "username":     reply.get("username", "N/A"),
                "text":         reply.get("text", ""),
                "likes":        reply.get("like_count", 0),
                "replies_count":reply.get("reply_count", 0),
                "date":         datetime.utcfromtimestamp(reply["published_on"]).strftime('%Y-%m-%d %H:%M')
                                if reply.get("published_on") else "N/A",
            })

    if not rows:
        print("[!] Не удалось извлечь данные из ответа Apify.")
        return

    df = pd.DataFrame(rows)
    df['likes'] = pd.to_numeric(df['likes'], errors='coerce').fillna(0).astype(int)
    df['replies_count'] = pd.to_numeric(df['replies_count'], errors='coerce').fillna(0).astype(int)

    # --- ФИЛЬТР: оставляем только посты, где текст содержит ключевое слово ---
    total_before = len(df)
    df = df[df['text'].str.contains(keyword, case=False, na=False)]
    filtered_out = total_before - len(df)
    print(f"[*] Фильтрация: {total_before} постов → {len(df)} совпадают с '{keyword}' (отброшено: {filtered_out})")

    if df.empty:
        print(f"[!] Ни один пост не содержит слово '{keyword}'. Попробуй другое ключевое слово.")
        return

    df = df.sort_values(by='likes', ascending=False).reset_index(drop=True)

    top_5 = df.head(5)

    print("\n" + "="*70)
    print("                    ТОП-5 ПОСТОВ ПО ЛАЙКАМ")
    print("="*70)
    for i, row in top_5.iterrows():
        short_text = (row['text'][:80] + '...') if len(str(row['text'])) > 80 else row['text']
        print(f"  ❤️  {row['likes']:>5} лайков | @{row['username']} | {row['date']}")
        print(f"       {short_text}")
        print(f"       {row['url']}")
        print()
    print("="*70 + "\n")

    # --- Формируем красивый CSV для Excel ---
    # Убираем переносы строк в тексте, чтобы каждый пост = одна строка
    df['text_clean'] = df['text'].str.replace(r'[\r\n]+', ' ', regex=True).str.strip()
    df['keyword'] = keyword
    df.index = df.index + 1  # Нумерация с 1

    csv_df = df[['keyword', 'date', 'likes', 'replies_count', 'username', 'text_clean', 'url']].copy()
    csv_df.columns = ['Ключевое слово', 'Дата', 'Лайки', 'Ответы', 'Автор', 'Текст поста', 'Ссылка']
    csv_df.index.name = '№'

    file_exists = os.path.isfile(CSV_NAME)
    csv_df.to_csv(CSV_NAME, mode='a', index=True, header=not file_exists, encoding='utf-8-sig', sep=';')
    print(f"[+] Данные сохранены в {CSV_NAME} (добавлено строк: {len(csv_df)})")    
    # Добавляем обработанные ссылки в историю (только главные посты)
    for url in df['url'].unique():
        if url and url != "N/A":
            add_url_to_history(conn, url)

# --- ГЛАВНЫЙ ЦИКЛ ---
def main():
    keyword = input("Введите ключевое слово для мониторинга Threads: ")
    
    conn = init_db()
    
    # 1. Поиск ссылок
    all_found_urls = search_threads_urls(keyword)
    
    # 2. Фильтрация новых
    new_urls = [u for u in all_found_urls if is_new_url(conn, u)]
    print(f"[+] Новых ссылок для обработки: {len(new_urls)}")
    
    if new_urls:
        # 3. Скрейпинг
        scraped_data = scrape_threads_data(new_urls)
        
        # 4. Обработка и сохранение
        process_results(scraped_data, conn, keyword)
    else:
        print("[!] Новых постов не найдено.")
    
    conn.close()

if __name__ == "__main__":
    main()
