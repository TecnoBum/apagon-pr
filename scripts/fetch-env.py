#!/usr/bin/env python3
"""Escribe ~/workspace/apagon-pr/.env.local con:
- TURSO_DATABASE_URL / TURSO_AUTH_TOKEN: leídos de Vercel en tiempo de
  ejecución (mismo patrón que ~/workspace/cubaonline/medir-turso.py).
- VAPID (Web Push): generados con web-push; si ya existen en .env.local,
  se conservan.
- ADMIN_SECRET: aleatorio, solo si no existe.
NUNCA imprime los valores. .env.local está en .gitignore.
"""
import json
import os
import re
import secrets
import subprocess
import sys

PROJECT = os.path.expanduser("~/workspace/apagon-pr")
ENV_FILE = os.path.join(PROJECT, ".env.local")

IDS = {
    "TURSO_DATABASE_URL": "5SuCWGGKIaiyQkJj",
    "TURSO_AUTH_TOKEN": "7S6fYUtHuQA6XzZR",
}


def get_env_value(key: str) -> str | None:
    """Lee una env var de Vercel (proyecto klick). Devuelve None si el
    conector no tiene acceso al equipo (403 conocido desde el 9 nov 2026);
    en ese caso el llamador usa la base local de desarrollo."""
    args = json.dumps({"idOrName": "klick", "id": IDS[key]})
    try:
        out = subprocess.run(
            ["/opt/hatch/bin/vercel", "call-tool", "--name", "get_project_env",
             "--arguments-json", args],
            capture_output=True, text=True, check=True,
        )
        data = json.loads(out.stdout)
        text = data["result"]["content"][0]["text"]
        parsed = json.loads(text)
        if "result" not in parsed:
            return None
        value = parsed["result"]["value"]
        if not parsed["result"].get("decrypted"):
            return None
        return value
    except Exception:
        return None


def gen_vapid() -> tuple[str, str]:
    code = (
        "const webpush = require('web-push');"
        "const k = webpush.generateVAPIDKeys();"
        "console.log(JSON.stringify(k));"
    )
    out = subprocess.run(
        ["node", "-e", code],
        capture_output=True, text=True, check=True, cwd=PROJECT,
    )
    k = json.loads(out.stdout)
    return k["publicKey"], k["privateKey"]


def read_existing() -> dict:
    vals = {}
    if os.path.exists(ENV_FILE):
        for line in open(ENV_FILE, encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip()
    return vals


def main() -> int:
    existing = read_existing()
    out = dict(existing)
    changed = []

    for key in ("TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"):
        if not out.get(key):
            v = get_env_value(key)
            if v:
                out[key] = v
                changed.append(key)
    if not out.get("TURSO_DATABASE_URL"):
        # Sin acceso a Vercel (403 al equipo tecnobum): base libsql LOCAL
        # en archivo, con el MISMO esquema y código. En producción (Vercel)
        # las env vars reales de Turso ya existen en el proyecto klick.
        out["TURSO_DATABASE_URL"] = f"file:{os.path.join(PROJECT, '.dev.db')}"
        out.pop("TURSO_AUTH_TOKEN", None)
        changed.append("LOCAL_DB(file:.dev.db)")
        print("AVISO: sin acceso a Vercel (403 equipo tecnobum); uso base local file:.dev.db para verificación. En producción valen las env vars de Turso del proyecto klick.")
    if not out.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY") or not out.get("VAPID_PRIVATE_KEY"):
        pub, priv = gen_vapid()
        out["NEXT_PUBLIC_VAPID_PUBLIC_KEY"] = pub
        out["VAPID_PRIVATE_KEY"] = priv
        changed.append("VAPID")
    if not out.get("VAPID_SUBJECT"):
        out["VAPID_SUBJECT"] = "https://apagon-pr.vercel.app"
        changed.append("VAPID_SUBJECT")
    if not out.get("ADMIN_SECRET"):
        out["ADMIN_SECRET"] = secrets.token_hex(24)
        changed.append("ADMIN_SECRET")

    order = [
        "TURSO_DATABASE_URL",
        "TURSO_AUTH_TOKEN",
        "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
        "VAPID_PRIVATE_KEY",
        "VAPID_SUBJECT",
        "ADMIN_SECRET",
    ]
    lines = [
        "# Apagón PR — secretos locales. NO commitear (ver .gitignore).",
        "# Generado por scripts/fetch-env.py; los valores nunca se imprimen.",
    ]
    for k in order:
        if k in out:
            lines.append(f"{k}={out[k]}")
    for k, v in out.items():
        if k not in order:
            lines.append(f"{k}={v}")
    with open(ENV_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"OK .env.local: {len(out)} claves; nuevas/actualizadas: {', '.join(changed) or 'ninguna'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
