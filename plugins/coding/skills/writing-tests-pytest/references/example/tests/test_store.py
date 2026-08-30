from uuid import uuid4

import pytest
from store import (
    InvalidKeyError,
    KeyNotFoundError,
    Store,
    exists,
    get,
    list_keys,
    parse_key,
    put,
    remove,
)


async def test_crud_records(store: Store, key: str):
    #
    # Givens
    #

    # Random value
    value0 = f"value-{uuid4()}"

    #
    # Whens
    #

    # I put a record
    await put(store, key=key, value=value0)

    #
    # Thens
    #

    # Record should exist
    assert await exists(store, key=key)

    #
    # Whens
    #

    # I read the value back
    value1 = await get(store, key=key)

    #
    # Thens
    #

    # value1 should equal value0
    assert value1 == value0

    #
    # Whens
    #

    # I overwrite the value
    value2 = f"value-{uuid4()}"
    await put(store, key=key, value=value2)

    # I read the updated value
    value3 = await get(store, key=key)

    #
    # Thens
    #

    # value3 should equal value2
    assert value3 == value2

    #
    # Whens
    #

    # I remove the record
    await remove(store, key=key)

    #
    # Thens
    #

    # Record should not exist
    assert not await exists(store, key=key)


async def test_get_key_never_written(store: Store, key: str):
    #
    # Whens / Thens
    #

    # I read a missing key, it should fail
    with pytest.raises(KeyNotFoundError):
        await get(store, key=key)


async def test_store_starts_empty(store: Store):
    #
    # Whens
    #

    # I list the keys in a freshly created store
    keys = await list_keys(store)

    #
    # Thens
    #

    # Store should be empty
    assert keys == []


invalid_keys = [
    pytest.param("", "must not be empty", id="an empty string"),
    pytest.param("Key", "lowercase alphanumeric", id="an uppercase key"),
    pytest.param("../etc", "lowercase alphanumeric", id="a path traversal"),
    pytest.param("-key", "lowercase alphanumeric", id="a leading dash"),
]


@pytest.mark.parametrize(("raw", "reason"), invalid_keys)
async def test_parse_key_rejects(raw: str, reason: str):
    #
    # Whens / Thens
    #

    # I parse an invalid key, it should fail and say why
    with pytest.raises(InvalidKeyError, match=reason):
        parse_key(raw)


async def test_parse_key_accepts_well_formed_key():
    #
    # Whens
    #

    # I parse a valid key
    parsed = parse_key("orders-2026-01")

    #
    # Thens
    #

    # parsed should equal the key unchanged
    assert parsed == "orders-2026-01"
