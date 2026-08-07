#!/usr/bin/env python3
"""Build a local exact-name index from DSA open data "Стан розгляду справ".

The source archive is very large (~800 MiB in the tested 05.08.2026 snapshot),
so this script downloads it to a temporary file and streams rows from the ZIP.
It does not bypass CAPTCHA or scrape the protected EDRSR search form.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import tempfile
import unicodedata
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

META_URL = "https://dsa.court.gov.ua/open_data_json.php?json=532"
DEFAULT_DATA = Path("data/data.json")
DEFAULT_OUTPUT = Path("data/court-open-data/index.json")


def norm(value: str) -> str:
    value = unicodedata.normalize("NFKC", str(value or "")).casefold()
    value = re.sub(r"[^\wа-яіїєґ'’ -]+", " ", value, flags=re.IGNORECASE)
    value = value.replace("’", "'").replace("'", "")
    return re.sub(r"\s+", " ", value).strip()


def curl_text(url: str) -> str:
    proc = subprocess.run(["curl", "-LfsS", url], check=True, stdout=subprocess.PIPE)
    return proc.stdout.decode("utf-8", errors="replace")


def recursive_objects(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from recursive_objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from recursive_objects(child)


def pick_archive(meta_text: str):
    parsed = json.loads(meta_text)
    candidates = []
    for obj in recursive_objects(parsed):
        strings = {k: v for k, v in obj.items() if isinstance(v, str)}
        name = next((v for v in strings.values() if "стан розгляду справ" in v.casefold()), "")
        url = next((v for v in strings.values() if ".zip" in v.casefold()), "")
        if url:
            candidates.append((1 if name else 0, name or Path(url).name, url))
    if not candidates:
        # Last-resort extraction from JSON text.
        urls = re.findall(r'https?[^"\\]+?\.zip', meta_text)
        if urls:
            return Path(urls[-1]).name, urls[-1]
        raise RuntimeError("У metadata не знайдено ZIP-архів")
    candidates.sort(key=lambda item: item[0], reverse=True)
    _score, name, url = candidates[0]
    return name, urljoin(META_URL, url)


def load_subjects(data_path: Path):
    if not data_path.exists():
        raise RuntimeError(f"Не знайдено {data_path}. Спочатку запустіть бота та додайте суб'єктів.")
    data = json.loads(data_path.read_text(encoding="utf-8"))
    result = []
    for subject in data.get("subjects", []):
        full_name = str(subject.get("full_name") or "").strip()
        if not full_name:
            continue
        names = [full_name, *(subject.get("aliases") or [])]
        # Exact court participant matching is safest with 3-part names.
        targets = [norm(name) for name in names if len(norm(name).split()) >= 3]
        result.append({"id": subject.get("id"), "full_name": full_name, "targets": list(dict.fromkeys(targets))})
    return result


def participant_matches(participants: str, targets):
    haystack = f" {norm(participants)} "
    return any(f" {target} " in haystack for target in targets)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    subjects = load_subjects(args.data)
    print(f"Осіб для пошуку: {len(subjects)}")
    if not subjects:
        raise SystemExit("Немає суб'єктів з повним ПІБ для індексації")

    archive_name, archive_url = pick_archive(curl_text(META_URL))
    print(f"Архів: {archive_name}")

    output = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "archive_name": archive_name,
        "archive_url": archive_url,
        "subjects": {s["id"]: {"full_name": s["full_name"], "matches": []} for s in subjects},
    }

    with tempfile.TemporaryDirectory(prefix="court-open-data-") as td:
        archive_path = Path(td) / "court.zip"
        subprocess.run(["curl", "-LfsS", archive_url, "-o", str(archive_path)], check=True)
        with zipfile.ZipFile(archive_path) as zf:
            csv_names = [name for name in zf.namelist() if name.lower().endswith(".csv")]
            if not csv_names:
                raise RuntimeError("У ZIP не знайдено CSV")
            with zf.open(csv_names[0], "r") as raw:
                import io
                text_stream = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
                reader = csv.DictReader(text_stream, delimiter="\t")
                processed = 0
                for row in reader:
                    processed += 1
                    participants = row.get("participants", "")
                    if not participants:
                        continue
                    for subject in subjects:
                        if participant_matches(participants, subject["targets"]):
                            output["subjects"][subject["id"]]["matches"].append({
                                key: row.get(key) or None
                                for key in [
                                    "court_name", "case_number", "case_proc", "registration_date", "judge", "judges",
                                    "participants", "stage_date", "stage_name", "cause_result", "cause_dep", "type", "description",
                                ]
                            })
                print(f"Оброблено рядків: {processed:,}")

    for subject in subjects:
        count = len(output["subjects"][subject["id"]]["matches"])
        print(f"{subject['full_name']}: {count} точних збігів")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Індекс збережено: {args.output.resolve()}")


if __name__ == "__main__":
    main()
