---
name: writing-tests-pytest
description: Use this skill any time you're writing tests with pytest.
---

# Writing High-Quality Tests

Our tests follow strict patterns for consistency, readability, and maintainability.
This skill teaches you how to write tests that read like specifications and verify real
behavior against real infrastructure.

**A complete worked example lives in `references/example/`** — a real key/value store on a
real temp directory, fixtures with proper teardown, and tests covering the CRUD lifecycle,
the error path, and parametrization. It runs under `pytest` and passes `ruff` and `pyright`,
so unlike the snippets below it cannot quietly drift from the APIs it demonstrates. Read it
when you want the whole shape at once; read the sections below for the reasoning behind
each part.

## Test-Driven Development

Write the test before the code it verifies. The test is a specification of the behavior you
want — writing it first forces you to define "done" before you build, and it guarantees the
test can actually fail, so a passing test means something.

The loop is **Red → Green → Refactor**:

1. **Red** — Write a failing test for the next small piece of behavior. Run it and confirm
   it fails for the right reason. A test that has never failed proves nothing.
2. **Green** — Write the minimum code to make it pass. Resist the urge to build ahead of the
   test; unneeded code is untested code.
3. **Refactor** — With the test green as a safety net, clean up both the implementation and
   the test. Keep everything green as you go.

Take small steps. Each cycle should add one observable behavior, so when a test fails you
know it was the last thing you changed.

### Principles

- **One reason to fail** — Each test pins down a single behavior. When it breaks, the cause
  is obvious. Narrow tests localize failures; broad ones obscure them.
- **Triangulate toward generality** — Don't guess at abstractions up front. Write the simplest
  code that passes, and generalize only when a second test forces you to.
- **Test behavior, not implementation** — Drive the public API the caller actually uses.
  Tests coupled to internals break on every refactor and lose their value (see
  _Testing private implementation details_ under Anti-Patterns).
- **Let tests pressure the design** — Code that is hard to test is usually badly coupled.
  When a test is painful to write, treat it as a signal to fix the design, not the test.
- **The test is production code** — It earns the same care: clear names, narrative intent,
  no duplication that obscures meaning.

## Given-When-Then Structure

Every test uses comment blocks to separate phases. The `# Whens` and `# Thens` blocks are
always required. Include `# Givens` only when the test has preconditions to set up.

```python
async def test_example(fixture: SomeType):
    #
    # Givens
    #

    # Plain English comment explaining the precondition
    variable = setup_value

    #
    # Whens
    #

    # Plain English comment explaining the action
    result = await function_under_test(variable)

    #
    # Thens
    #

    # Plain English comment explaining the expectation
    assert result == expected_value
```

Each comment block starts and ends with a bare `#` on its own line. This visual separation
makes tests scannable — you can skim the comments alone and understand the test's intent
without reading any code.

### Narrative Comments

Comments describe WHAT is happening and WHY, using natural English that reads like a spec.
The tense convention makes each phase immediately recognizable:

- **Givens**: Past tense — "I created...", "Random document was generated"
- **Whens**: Present tense — "I cancel...", "I look up..."
- **Thens**: Present tense with "should" — "Task should be cancelled", "name should be benoit"

**Good:**

```python
#
# Givens
#

# Random document content
doc = {"id": str(uuid4()), "value": random_string()}

# I uploaded all files to server
await sftp_client.put(paths, recurse=True)

#
# Whens
#

# I look up organization name
name = await get_organization_name(pc, organization_id=organization_id)

#
# Thens
#

# name should be benoit
assert name == "benoit"
```

**Bad — these miss the point:**

```python
# Create a document             (too terse, no context)
# Call the function              (describes code, not intent)
# Check the result               (vague, doesn't state expectation)
# Assert result equals expected  (just restating the code)
```

The goal is that someone unfamiliar with the codebase can read only the comments and
understand the entire test scenario.

## Fixture-Based Test Data

Use pytest fixtures for anything that requires setup or teardown — databases, servers,
clients, temporary resources. Fixtures should return real, working resources.

```python
@pytest.fixture
async def sftp_client(sftp_credentials: Record) -> AsyncIterator[SFTPClient]:
    async with asyncssh.connect(**options) as conn:
        async with conn.start_sftp_client() as client:
            yield client
```

Organize fixtures by scope:

- **Shared fixtures** go in `tests/fixtures/` for cross-cutting concerns
- **Domain-specific test data** uses the custom Faker provider in `tests/fixtures/fake.py`
- **Package-specific fixtures** go in `<package>/tests/fixtures/<package>_package_fixtures.py`

## Real Integration Testing Over Mocking

The default is to test against real infrastructure. Mocking internal services hides real
bugs — if a test passes against mocks but fails against the actual database, the test was
worse than useless because it gave false confidence.

**Use real infrastructure for:**

- Databases (MongoDB, LocalStack S3)
- Servers spun up in containers
- HTTP clients and servers
- Message queues

**Mock only when you must:**

- External third-party APIs (Stripe, external webhooks)
- Services genuinely outside your control
- Expensive external calls with no test equivalent

```python
# Good — tests real behavior
async def test_sftp_upload(sftp_client: SFTPClient):
    #
    # Whens
    #

    # I upload file
    await sftp_client.put(local_path, remote_path)

    #
    # Thens
    #

    # File should exist on server
    assert await sftp_client.exists(remote_path)
```

```python
# Acceptable — external API we don't control
@patch("ashvin.payment.processor.post")
async def test_payment(mock_stripe: AsyncMock):
    mock_stripe.return_value = None
```

## Test Isolation and Cleanup

Each test must be completely independent — safe to run in parallel, in any order. Use
`AsyncIterator` fixtures with try/finally for cleanup, and create unique resource names
with timestamps and random strings to avoid collisions.

```python
@pytest.fixture
async def temp_queue(pc: PlatformClient) -> AsyncIterator[Queue]:
    name = f"benoit/tests/{date.today().isoformat()}/{random_string()}"
    queue = await apm.messages.create_queue(pc, name=name)
    yield queue
    await apm.messages.delete_queue(pc, queue=queue)
```

## Test Both Happy and Sad Paths

Always pair success tests with error-case tests. For error cases, `# Whens / Thens` can
be combined when the action and assertion are a single expression:

```python
async def test_get_organization_name_unknown_id(pc: PlatformClient):
    #
    # Givens
    #

    # Random organization id (doesn't exist)
    organization_id = str(uuid4())

    #
    # Whens / Thens
    #

    # I look up organization name, it should fail
    with pytest.raises(ValueError):
        await get_organization_name(pc, organization_id=organization_id)
```

## CRUD Pattern Testing

When testing data operations, verify the complete lifecycle in a single test. This catches
subtle issues like create succeeding but read returning stale data, or delete not actually
removing the resource.

```python
async def test_crud_secrets(client: PlatformClient, secret_name: str):
    #
    # Givens
    #

    # Random value
    value0 = {"x": random_string()}

    #
    # Whens
    #

    # I create a secret
    secret = await apm.secrets.create(client, name=secret_name, value=value0)

    #
    # Thens
    #

    # Secret should be populated
    assert secret["id"] is not None
    assert secret["name"] == secret_name

    # Secret should exist by id
    assert await apm.secrets.exists(client, identifier=secret["id"])

    #
    # Whens
    #

    # I read secret value
    value1 = await apm.secrets.json(client, secret=secret)

    #
    # Thens
    #

    # value1 should equal value0
    assert value1 == value0

    #
    # Whens
    #

    # I update secret value
    value2 = {"x": random_string()}
    await apm.secrets.put(client, secret=secret, value=value2)

    # I read updated value
    value3 = await apm.secrets.json(client, secret=secret)

    #
    # Thens
    #

    # value3 should equal value2
    assert value3 == value2

    #
    # Whens
    #

    # I delete secret
    await apm.secrets.delete(client, secret=secret)

    #
    # Thens
    #

    # Secret should not exist
    assert not await apm.secrets.exists(client, identifier=secret["id"])
```

## End-to-End Flows

Integration tests should verify the complete workflow — from input through processing to
all observable side effects. Check every external system the code touches.

```python
async def test_sftp_collector_e2e(
    sftp_client: SFTPClient,
    sftp_collector_client: HttpClient,
    pc: PlatformClient,
    storage_bucket: Bucket,
):
    #
    # Givens
    #

    # I uploaded files to SFTP server
    await sftp_client.put(paths, recurse=True)

    #
    # Whens
    #

    # I wait for collector to process files
    await wait_for(processed_n(sftp_collector_client, n), timeout=timeout)

    #
    # Thens
    #

    # Collector should have saved metadata to MongoDB
    assert await find_document(pc, organization_id=org_id, document_id=doc_id)

    # Collector should have saved content to S3
    assert await apm.objects.exists(pc, bucket=storage_bucket, key=content_key)

    # Collector should have sent messages to queue
    messages = await apm.messages.receive(pc, queue=ocr_queue)
    assert len(messages) == n

    # Collector should have cleaned up files
    assert len(await sftp.list_pdfs(sftp=sftp_client)) == 0
```

## Parametrized Testing

Use `@pytest.mark.parametrize` when multiple scenarios share the same test logic but
differ in inputs or expected outputs:

```python
@pytest.mark.parametrize("filename_generator", filename_generators)
async def test_parse_timestamp(fake: Faker, filename_generator: FilenameGenerator):
    #
    # Givens
    #

    # Random date time
    dt0 = fake.date_time()

    # path encodes dt using filename generator
    path = filename_generator(fake, dt0)

    #
    # Whens
    #

    # I parse timestamp from path
    dt1 = sftp._parse_timestamp(path)

    #
    # Thens
    #

    # dt1 should equal dt0 down to minute
    assert dt1.strftime("%Y%m%dT%H%M") == dt0.strftime("%Y%m%dT%H%M")
```

## Test Naming

**File naming:** `test_<package>_<module>.py`, placed in `<package>/tests/`.

**Function naming:** Describe the scenario and expected outcome, not just the function
being called.

```python
# Good — describes the scenario
async def test_get_organization_name_unknown_id(pc: PlatformClient):
async def test_sftp_collector_processes_pdfs(sftp_client: SFTPClient):
async def test_merge_dicts_overlapping_nested():

# Bad — too vague
async def test_organization():
async def test_collector():
async def test_merge():
```

## No Test Classes

Use standalone `async def test_*` functions — never group tests into classes. Classes add
nesting without value when pytest fixtures and markers handle setup, teardown, and
categorization. If you need to group related tests visually, use comment section headers.

```python
# Good — standalone functions
async def test_rate_limiter_allows_within_budget(limiter: RateLimiter):
    ...

async def test_rate_limiter_rejects_over_budget(limiter: RateLimiter):
    ...


# Bad — unnecessary class wrapper
class TestRateLimiter:
    async def test_allows_within_budget(self, limiter: RateLimiter):
        ...
```

## Anti-Patterns

Avoid these common mistakes:

**Skipping the structure** — bare tests without Given-When-Then are hard to maintain:

```python
# Bad
async def test_something():
    result = await function()
    assert result == expected
```

**Comments that restate the code** — add no value:

```python
# Bad
# Call get_organization_name
name = await get_organization_name(pc, organization_id=organization_id)
```

**Mocking internal infrastructure** — tests mocks instead of real behavior:

```python
# Bad
@patch("ashvin.platform.documents.mongodb")
async def test_save_document(mock_mongo):
    ...
```

**Vague variable names** — domain concepts make tests self-documenting:

```python
# Bad
x = await get_data()

# Good
organization_name = await get_organization_name(pc, organization_id=org_id)
```

**Testing private implementation details** — test the public API instead:

```python
# Bad
result = module._internal_helper_function()

# Good
await save_document(pc, doc=doc, content=content)
```

## Quick Checklist

Before submitting a test, verify:

- Written test-first and confirmed to fail before the code made it pass (Red → Green → Refactor)
- Standalone functions, no test classes
- Uses Whens/Thens structure (Givens when there are preconditions)
- Includes narrative comments explaining what and why
- Uses fixtures for complex setup
- Tests real infrastructure (not over-mocked)
- Tests both success and error cases
- Cleans up resources after test
- Has descriptive test name
- Variable names reflect domain concepts
- Verifies observable behavior, not implementation
- Can run in parallel with other tests (isolated)
- Uses async/await correctly throughout
