"""Fixtures providing a real store on a real temporary directory."""

from collections.abc import AsyncIterator
from datetime import date
from pathlib import Path
import tempfile
from uuid import uuid4

import pytest
from store import Store, create_store, destroy_store


@pytest.fixture
async def store() -> AsyncIterator[Store]:
    """Real store rooted at a unique temp directory, removed after the test."""
    root = Path(tempfile.gettempdir()) / f"store-tests/{date.today().isoformat()}/{uuid4()}"
    store = await create_store(root)

    yield store

    await destroy_store(store)


@pytest.fixture
def key() -> str:
    """Unique key, so tests sharing a store would still not collide."""
    return f"key-{uuid4()}"
