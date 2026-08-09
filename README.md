# Stickshift Agent Guidance Directory

Custom directory of claude plugins.

## Install Plugins

### GitHub

```shell
/plugins marketplace add stickshift/agents
/plugins enable dual-track@stickshift
```

### Local Repository

```shell
# Path to local repo clone
SS_AGENTS_HOME=...
```

```shell
# Configure cli opts
CLAUDE_OPTS=(
  --plugin-dir "${SS_AGENTS_HOME}/plugins/dual-track"
  --agent dual-track:tech-lead
)

# Launch claude
claude "${CLAUDE_OPTS[@]}"
```
