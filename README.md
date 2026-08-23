# Stickshift Agent Guidance Directory

Custom directory of claude plugins.

## Getting Started

### Setup Development Environment

```shell
# Install all tools, deps, and activate envs
source environment.sh
```

## Install Plugins

### GitHub

Install stickshift plugins directly from github.

```shell
/plugins marketplace add stickshift/agents
/plugins enable dual-track@stickshift
```

### Local Repository

Install stickshift plugins from local clone.

```shell
# Path to local repo clone
SS_AGENTS_HOME=...
```

Configure cli opts.

```shell
# Basic coding
CLAUDE_OPTS=(
  --plugin-dir "${SS_AGENTS_HOME}/plugins/coding"
)

# Dual-track
CLAUDE_OPTS=(
  --plugin-dir "${SS_AGENTS_HOME}/plugins/dual-track"
  --agent dual-track:tech-lead
)

# Launch claude
claude "${CLAUDE_OPTS[@]}"
```
