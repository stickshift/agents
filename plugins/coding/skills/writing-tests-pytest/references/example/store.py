"""A key/value store backed by a real directory on disk."""

import asyncio
from dataclasses import dataclass
from pathlib import Path
import re
import shutil

KEY_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]*$")

MAX_KEY_LENGTH = 64


@dataclass(frozen=True)
class Store:
    """A store rooted at a real directory."""

    root: Path


class KeyNotFoundError(Exception):
    """Raised when reading or removing a key that was never written."""

    def __init__(self, key: str) -> None:
        """Record the key that was missing."""
        super().__init__(f"No record for key: {key}")
        self.key = key


class InvalidKeyError(ValueError):
    """Raised when a key doesn't meet the store's naming rules."""

    def __init__(self, key: str, reason: str) -> None:
        """Record the offending key and why it was rejected."""
        super().__init__(f"Invalid key {key!r}: {reason}")
        self.key = key


def parse_key(raw: str) -> str:
    """Validate an untrusted key and return it unchanged."""
    if not raw:
        raise InvalidKeyError(raw, "must not be empty")

    if len(raw) > MAX_KEY_LENGTH:
        raise InvalidKeyError(raw, f"must be at most {MAX_KEY_LENGTH} characters")

    if not KEY_PATTERN.match(raw):
        raise InvalidKeyError(raw, "must be lowercase alphanumeric or dashes")

    return raw


async def create_store(root: Path) -> Store:
    """Create a store rooted at the given directory."""
    await asyncio.to_thread(root.mkdir, parents=True, exist_ok=True)
    return Store(root=root)


async def destroy_store(store: Store) -> None:
    """Remove the store and everything in it."""
    await asyncio.to_thread(shutil.rmtree, store.root, ignore_errors=True)


async def put(store: Store, *, key: str, value: str) -> None:
    """Write a record, overwriting any existing value."""
    path = store.root / parse_key(key)
    await asyncio.to_thread(path.write_text, value, encoding="utf-8")


async def get(store: Store, *, key: str) -> str:
    """Read a value. A missing key is a caller bug here, so it raises."""
    path = store.root / parse_key(key)

    try:
        return await asyncio.to_thread(path.read_text, encoding="utf-8")
    except FileNotFoundError as e:
        raise KeyNotFoundError(key) from e


async def exists(store: Store, *, key: str) -> bool:
    """Report whether a key has a value."""
    return parse_key(key) in await list_keys(store)


async def list_keys(store: Store) -> list[str]:
    """List every key in the store, sorted."""
    entries = await asyncio.to_thread(lambda: [p.name for p in store.root.iterdir()])
    return sorted(entries)


async def remove(store: Store, *, key: str) -> None:
    """Delete a record."""
    path = store.root / parse_key(key)

    try:
        await asyncio.to_thread(path.unlink)
    except FileNotFoundError as e:
        raise KeyNotFoundError(key) from e
