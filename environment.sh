# environment.sh - Configure build environment

# Parameters - overridable
VERSION=${VERSION:-0.0.0}

# Settings - non-overridable
WORKSPACE_PATH=$PWD

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

# Sourcing this file succeeds unless a real bootstrap step failed above.
true