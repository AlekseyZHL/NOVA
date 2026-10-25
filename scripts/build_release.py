#!/usr/bin/env python3
"""
NOVA Wallet — сборка релизных архивов для Google Drive / бэкапа.

Использование:
    python3 scripts/build_release.py 1.0.2

Создаёт в exports/:
    NOVA-Wallet-<ver>-source.zip            исходники БЕЗ секретов
    NOVA-Wallet-<ver>-backup-<date>.zip     то же + data/db.json (без ключей)
    FILE_MAP.txt, manifest.json
    docs/*.html                             HTML-версии документов для Google Docs

НИКОГДА не включает: .env, *.key, vault.enc, node_modules, data/ (кроме db.json).
Для HTML-конвертации нужен пакет `markdown` (pip install markdown) — если его нет,
шаг пропускается, а архивы всё равно собираются.
"""
import json
import os
import shutil
import sys
import zipfile
from datetime import date

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'exports')
DOCS = os.path.join(OUT, 'docs')
def default_version():
    try:
        return json.load(open(os.path.join(ROOT, 'package.json'), encoding='utf-8'))['version']
    except Exception:
        return '0.0.0'


VERSION = sys.argv[1] if len(sys.argv) > 1 else default_version()
TODAY = date.today().isoformat()

SKIP_DIRS = {'node_modules', '.git', 'exports', '__pycache__', '.cache', 'data', '.venv'}
SKIP_FILES = {'.env', '.env.local', 'vault.key', 'session.key', 'vault.enc', '.DS_Store'}

CSS = """body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.55;color:#1a2233;max-width:900px;margin:0 auto;padding:24px}
h1{font-size:22pt;color:#4c3bd4;border-bottom:3px solid #7c5cff;padding-bottom:8px}
h2{font-size:16pt;color:#2b3b6b;margin-top:24px;border-bottom:1px solid #d8dcec;padding-bottom:5px}
h3{font-size:13pt;color:#3b4a75}p{margin:8px 0}
code{background:#f1f3fa;padding:1px 4px;border-radius:3px;font-family:Consolas,monospace;font-size:9.5pt;color:#b1368a}
pre{background:#10162a;color:#e6ebff;padding:12px;border-radius:8px;overflow:auto;font-size:9pt}
pre code{background:none;color:inherit;padding:0}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:9.5pt}
th,td{border:1px solid #ccd3e5;padding:7px 9px;text-align:left;vertical-align:top}
th{background:#eef0fb;color:#2b3b6b}
blockquote{border-left:4px solid #7c5cff;background:#f6f4ff;margin:12px 0;padding:8px 14px;color:#4a3f78}
li{margin:4px 0}hr{border:0;border-top:1px solid #d8dcec}a{color:#3b5bdb}"""

GROUPS = [
    ('00_Обзор и быстрый старт', ['README.md', 'CHANGELOG.md']),
    ('01_Архитектура', ['docs/ARCHITECTURE.md']),
    ('02_Безопасность', ['docs/SECURITY.md']),
    ('03_Настройка Telegram', ['docs/SETUP_TELEGRAM.md']),
    ('04_Руководство пользователя', ['docs/USER_GUIDE.md']),
    ('05_Дорожная карта и тесты', ['docs/ROADMAP.md', 'docs/TEST_REPORT.md']),
]


def webapp_url():
    """Читает публичный URL из .env, чтобы в архивах не было мёртвых ссылок."""
    env = os.path.join(ROOT, '.env')
    try:
        for line in open(env, encoding='utf-8'):
            if line.startswith('WEBAPP_URL='):
                v = line.strip().split('=', 1)[1]
                return v if v else 'set WEBAPP_URL in .env'
    except OSError:
        pass
    return 'set WEBAPP_URL in .env'


def source_files():
    items = []
    for dirpath, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f in SKIP_FILES or f.endswith('.zip') or f.endswith('.log'):
                continue
            full = os.path.join(dirpath, f)
            items.append((full, os.path.relpath(full, ROOT)))
    return sorted(items, key=lambda x: x[1])


def make_zip(path, items, extra=()):
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for full, rel in items:
            z.write(full, os.path.join('nova-wallet', rel))
        for full, rel in extra:
            z.write(full, os.path.join('nova-wallet', rel))
    return os.path.getsize(path)


def main():
    os.makedirs(DOCS, exist_ok=True)
    src = source_files()

    source_zip = os.path.join(OUT, f'NOVA-Wallet-v{VERSION}-source.zip')
    backup_zip = os.path.join(OUT, f'NOVA-Wallet-v{VERSION}-backup-{TODAY}.zip')
    s1 = make_zip(source_zip, src)

    db = os.path.join(ROOT, 'data', 'db.json')
    extra = [(db, 'data/db.json')] if os.path.exists(db) else []
    s2 = make_zip(backup_zip, src, extra)

    lines = [f'NOVA Wallet v{VERSION} — карта исходного архива', '=' * 52, '']
    for full, rel in src:
        lines.append(f'{os.path.getsize(full):>9} B   {rel}')
    lines += ['', f'Файлов: {len(src)}', '', 'Исключено: .env, ключи, vault.enc, node_modules, data/']
    with open(os.path.join(OUT, 'FILE_MAP.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    for src_name, dst_name in [('CHANGELOG.md', 'CHANGELOG.md'),
                               ('docs/TEST_REPORT.md', 'TEST_REPORT.md')]:
        p = os.path.join(ROOT, src_name)
        if os.path.exists(p):
            shutil.copy(p, os.path.join(OUT, dst_name))

    html_count = 0
    try:
        import markdown  # noqa: F401
    except ImportError:
        print('⚠️  pip install markdown — HTML-документы не пересобраны (архивы готовы)')
    else:
        for title, files in GROUPS:
            parts = [f'# {title.replace("_", " ")}\n']
            for f in files:
                p = os.path.join(ROOT, f)
                if os.path.exists(p):
                    parts += [open(p, encoding='utf-8').read(), '\n\n---\n']
            body = markdown.markdown('\n'.join(parts),
                                     extensions=['tables', 'fenced_code', 'sane_lists'])
            doc = f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>{body}</body></html>'
            with open(os.path.join(DOCS, title + '.html'), 'w', encoding='utf-8') as f:
                f.write(doc)
            html_count += 1

    manifest = {
        'project': 'NOVA Wallet', 'version': VERSION, 'date': TODAY,
        'preview': webapp_url(),
        'source_files': len(src),
        'excluded_secrets': ['.env', 'data/vault.key', 'data/session.key', 'data/vault.enc'],
        'html_docs': html_count,
    }
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f'✅ v{VERSION}: source {s1} B, backup {s2} B, файлов {len(src)}, HTML-доков {html_count}')
    print(f'   {os.path.basename(source_zip)}')
    print(f'   {os.path.basename(backup_zip)}')


if __name__ == '__main__':
    main()
