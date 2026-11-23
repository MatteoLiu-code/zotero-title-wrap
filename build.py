import json
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

source = Path(__file__).resolve().parent
members = ("manifest.json", "bootstrap.js")
manifest = json.loads((source / members[0]).read_text(encoding="utf-8"))
destination = Path(sys.argv[1]) if len(sys.argv) > 1 else source
path = destination / f'zotero-title-wrap-{manifest["version"]}.xpi'
with ZipFile(path, "w", compression=ZIP_DEFLATED) as archive:
    for name in members:
        archive.write(source / name, arcname=name)

with ZipFile(path) as archive:
    if archive.testzip() is not None or tuple(archive.namelist()) != members:
        raise RuntimeError("XPI archive verification failed")
    for name in members:
        if archive.read(name) != (source / name).read_bytes():
            raise RuntimeError(f"Mismatched archive member: {name}")
print(path)

