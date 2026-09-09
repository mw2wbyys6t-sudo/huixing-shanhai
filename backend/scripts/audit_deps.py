# -*- coding: utf-8 -*-
"""依赖审计：扫描 backend/app 运行时三方 import，对比 requirements.txt 找缺失"""
import ast
import os
import sys

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BACKEND)

STDLIB = set(getattr(sys, 'stdlib_module_names', set())) | {
    'os', 'sys', 'json', 'time', 're', 'io', 'uuid', 'hashlib', 'secrets', 'asyncio',
    'logging', 'datetime', 'pathlib', 'typing', 'subprocess', 'tempfile', 'struct',
    'base64', 'functools', 'collections', 'contextlib', 'itertools', 'math', 'random',
    'string', 'urllib', 'copy', 'warnings', 'traceback', 'threading', 'socket', 'ssl',
    'sqlite3', 'zipfile', 'shutil', 'platform', 'signal', 'types', 'enum',
}

found = {}
for root, dirs, files in os.walk('app'):
    for f in files:
        if not f.endswith('.py'):
            continue
        path = os.path.join(root, f).replace(os.sep, '/')
        tree = ast.parse(open(path, encoding='utf-8').read())
        for node in ast.walk(tree):
            names = []
            if isinstance(node, ast.Import):
                names = [a.name for a in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
                names = [node.module]
            for n in names:
                top = n.split('.')[0]
                if top not in STDLIB and top != 'app':
                    found.setdefault(top, set()).add(path)

print("app/ 运行时三方依赖：")
for k in sorted(found):
    print(f"  {k:20s} <- {', '.join(sorted(found[k]))}")

req = open('requirements.txt', encoding='utf-8').read().lower()
ALIAS = {
    'dotenv': 'python-dotenv',
    'multipart': 'python-multipart',
    'yaml': 'pyyaml',
}
print("\n与 requirements.txt 对比：")
missing = []
for k in sorted(found):
    rn = ALIAS.get(k, k)
    ok = rn.lower() in req or k.lower() in req
    if not ok:
        missing.append(k)
    print(f"  {'OK ' if ok else 'MISS'} {k} (pip 名: {rn})")

print("\n缺失清单:", missing if missing else "无")
