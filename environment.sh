# environment.sh - Configure build environment

# Parameters - overridable
VERSION=${VERSION:-0.0.0}
PYTEST_ADDOPTS=${PYTEST_ADDOPTS:-"-s -n auto -m 'not wip'"}

# Settings - non-overridable
WORKSPACE_PATH=$PWD
PYDEVD_DISABLE_FILE_VALIDATION=1

# Telemetry
CLAUDE_CODE_ENABLE_TELEMETRY=1
OTEL_SERVICE_NAME="agents"
OTEL_RESOURCE_ATTRIBUTES="service.instance.id=localhost"
OTEL_TRACES_EXPORTER="otlp"
OTEL_TRACES_EXPORT_INTERVAL="1000"
OTEL_METRICS_EXPORTER="otlp"
OTEL_METRICS_EXPORT_INTERVAL="1000"
OTEL_LOGS_EXPORTER="otlp"
OTEL_LOGS_EXPORT_INTERVAL="1000"
OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
OTEL_EXPORTER_OTLP_LOGS_INSECURE="true"
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel.stickshift.local:8081
OTEL_SEMCONV_STABILITY_OPT_IN="http"

# Reproducible builds: hardcode SOURCE_DATE_EPOCH to midnight 2025-01-01 (1735689600)
SOURCE_DATE_EPOCH=1735689600

# Bootstrap toolchain (mise) - conditional, so a fresh worktree needs only
# `source environment.sh`. Warm path is a checksum compare, ~0 cost.
if command -v mise >/dev/null 2>&1; then
  # New worktree = new config path; trust it so install/env don't prompt.
  mise trust -q 2>/dev/null || true

  mkdir -p build
  mise_stamp=build/.bootstrap-mise
  mise_sum=$( (shasum -a 256 mise.toml 2>/dev/null || sha256sum mise.toml) | cut -d' ' -f1)
  if [[ "$mise_sum" != "$(cat $mise_stamp 2>/dev/null)" ]]; then
    mise install && echo "$mise_sum" > $mise_stamp
  fi

  # Put the pinned tools on PATH for this shell even without `mise activate`
  # in the user's rc (scripts, CI, teammates who haven't set it up).
  eval "$(mise env -s bash)"
else
  echo "WARN: mise not found - install it (brew install mise) to get pinned tool versions" >&2
fi

# JS dependencies - npm ci only when the lockfile is newer than the last
# install (npm writes node_modules/.package-lock.json on every ci/install).
if [[ ! -f node_modules/.package-lock.json || package-lock.json -nt node_modules/.package-lock.json ]]; then
  npm ci
fi

# Local JS binaries (nx et al) directly on PATH, so `nx check` works bare -
# no npx prefix, no alias, same short form locally and in CI.
[[ ":$PATH:" != *":$WORKSPACE_PATH/node_modules/.bin:"* ]] && PATH="$WORKSPACE_PATH/node_modules/.bin:$PATH"

# Export variables to temporary .env
tmp_project_env=$(mktemp)

project_variables=(
  CLAUDE_CODE_ENABLE_TELEMETRY
  OTEL_SERVICE_NAME
  OTEL_RESOURCE_ATTRIBUTES
  OTEL_TRACES_EXPORTER
  OTEL_TRACES_EXPORT_INTERVAL
  OTEL_METRICS_EXPORTER
  OTEL_METRICS_EXPORT_INTERVAL
  OTEL_LOGS_EXPORTER
  OTEL_LOGS_EXPORT_INTERVAL
  OTEL_EXPORTER_OTLP_ENDPOINT
  OTEL_EXPORTER_OTLP_PROTOCOL
  OTEL_EXPORTER_OTLP_LOGS_INSECURE
  OTEL_SEMCONV_STABILITY_OPT_IN
  PYDEVD_DISABLE_FILE_VALIDATION
  PYTEST_ADDOPTS
  SOURCE_DATE_EPOCH
  VERSION
  WORKSPACE_PATH
)

for v in "${project_variables[@]}"; do
  if [ -n "${BASH_VERSION:-}" ]; then
    # For bash
    if [ -n "${!v}" ]; then
      echo "$v=\"${!v}\"" >> $tmp_project_env
    fi
  elif [ -n "${ZSH_VERSION:-}" ]; then
    # For zsh
    if [ -n "${(P)v}" ]; then
      echo "$v=\"${(P)v}\"" >> $tmp_project_env
    fi
  fi
done

# Only update .env if they're different.
#   Note: Prevents parallel make processes from stepping on each other.

if [[ ! -f .env ]] || ! cmp -s .env $tmp_project_env; then
  echo "Updating .env"
  mv $tmp_project_env .env
fi

# Reload and export variables from .env
set -a; source .env; set +a

# Persist PATH additions for subsequent CI steps (a step's own PATH edits die
# with its shell; GITHUB_PATH is how they carry forward). .venv/bin is included
# because nx recipes invoke bare `dk` (correct for consuming repos, where dk
# ships on the bundle's PATH); in this repo dk is the venv's console script,
# and CI never activates the venv - the dir may not exist yet when this line
# runs (deps install later), which GITHUB_PATH tolerates.
if [[ -n $GITHUB_PATH ]]; then
  echo "$WORKSPACE_PATH/node_modules/.bin" >> "$GITHUB_PATH"
  echo "$WORKSPACE_PATH/.venv/bin" >> "$GITHUB_PATH"
fi

# Record env settings in CI
if [[ -n $GITHUB_ENV ]]; then
  # GITHUB_ENV can't handle quotes so we convert .env into GH's delimiter syntax.
  cat .env | awk -F= '{print $1" "$2}' | while read k v; do
    # Strip enclosing quotes from v
    v=$(echo $v | sed -E 's/^"|"$//g')
    printf '%s<<EOF\n%s\nEOF\n' "$k" "$v" >> "$GITHUB_ENV"
  done
fi

# Local env tuning
if [[ $CI != "true" ]]; then

  # Install deps
  if ! [[ -f ${WORKSPACE_PATH}/.venv/bin/activate ]]; then
    uv sync --all-packages
  fi

  # Activate python venv
  source ${WORKSPACE_PATH}/.venv/bin/activate
fi

# Sourcing this file succeeds unless a real bootstrap step failed above.
true