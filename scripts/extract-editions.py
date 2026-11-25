"""Extract only bounded public edition JSON from an Actions snapshot, before validation."""
import json
import pathlib
import re
import shutil
import sys
import zipfile


def extract(archive, destination):
    selected = {}
    with zipfile.ZipFile(archive) as zipped:
        if sum(info.file_size for info in zipped.infolist()) > 100_000_000:
            raise ValueError("Archive exceeds size limit")
        for info in zipped.infolist():
            name = info.filename.removeprefix("data/")
            if not re.fullmatch(r"(?:digests/(?:latest|index|\d{4}-\d{2}-\d{2})\.json|github-seen\.json)", name):
                continue
            if name in selected or info.file_size > 2_000_000:
                raise ValueError("Invalid archive entry")
            raw = zipped.read(info)
            json.loads(raw)
            selected[name] = raw
    if "digests/latest.json" not in selected:
        raise ValueError("Missing latest edition")
    target = pathlib.Path(destination)
    # Destination is a dedicated temporary folder supplied by the workflow.
    if target.exists():
        shutil.rmtree(target)
    for name, raw in selected.items():
        file = target / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(raw)


if __name__ == "__main__":
    extract(sys.argv[1], sys.argv[2])
