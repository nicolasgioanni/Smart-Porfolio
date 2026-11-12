"""Extract verified Actions ZIP bytes into a new directory without dependencies."""
import os
from pathlib import Path
import shutil
import stat
import sys
import unicodedata
import zipfile


def extract(archive, destination):
    root = Path(destination)
    # Caller must supply a fresh destination, never a checkout or existing tree.
    if root.exists() or root.is_symlink() or root.parent.is_symlink():
        raise ValueError("Unsafe artifact destination")
    limit = 512 * 1024 * 1024
    file_limit = 128 * 1024 * 1024
    with zipfile.ZipFile(archive) as bundle:
        entries = bundle.infolist()
        if not entries or len(entries) > 20000:
            raise ValueError("Invalid archive entry count")
        seen, files, total = set(), set(), 0
        for entry in entries:
            name = entry.filename.removesuffix("/")
            pieces = name.split("/")
            canonical = unicodedata.normalize("NFC", name).casefold()
            full_mode = (entry.external_attr >> 16) & 0o177777
            mode = stat.S_IFMT(full_mode)
            if (not name or entry.filename != entry.orig_filename or
                    any(piece in ("", ".", "..") for piece in pieces) or
                    any(ord(char) < 32 or char in "\\:" for char in name) or
                    name != unicodedata.normalize("NFC", name) or
                    canonical in seen or entry.flag_bits & 1 or
                    (full_mode and mode == 0) or
                    full_mode & (stat.S_ISUID | stat.S_ISGID | stat.S_ISVTX) or
                    mode not in (0, stat.S_IFREG, stat.S_IFDIR) or
                    (mode == stat.S_IFDIR and not entry.is_dir()) or
                    (mode == stat.S_IFREG and entry.is_dir()) or
                    entry.file_size < 0 or entry.compress_size < 0 or entry.file_size > file_limit):
                raise ValueError("Unsafe archive entry")
            seen.add(canonical)
            if not entry.is_dir():
                files.add(canonical)
            total += entry.file_size
            if total > limit:
                raise ValueError("Archive exceeds expansion budget")
        for name in seen:
            parents = name.split("/")[:-1]
            if any("/".join(parents[:index]) in files for index in range(1, len(parents) + 1)):
                raise ValueError("Archive file and directory collision")
        root.mkdir(mode=0o700)
        try:
            for entry in entries:
                target = root / entry.filename
                if entry.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                written = 0
                with bundle.open(entry) as source, target.open("xb") as output:
                    while chunk := source.read(65536):
                        written += len(chunk)
                        if written > entry.file_size or written > file_limit:
                            raise ValueError("Archive file exceeds its declared size")
                        output.write(chunk)
                if written != entry.file_size:
                    raise ValueError("Archive file is incomplete")
                os.chmod(target, 0o644)
        except Exception:
            shutil.rmtree(root)
            raise


if __name__ == "__main__":
    try:
        extract(sys.argv[1], sys.argv[2])
    except Exception:
        # Never print archive contents, signed URLs or attacker-controlled names.
        sys.exit("Artifact archive rejected")
