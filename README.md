# Stickshift Agent Guidance Directory

Custom directory of Claude Code plugins.

## Plugins

* [coding](./plugins/coding) - Skills for writing code.

## Install Plugins in Claude Code

### GitHub

Install stickshift plugins directly from github.

```shell
# Add stickshift marketplace
/plugins marketplace add stickshift/agents

# Enable plugin
/plugins enable {plugin_name}@stickshift
```

### Local Repository

Install stickshift plugins from a local clone.

```shell
# Path to local repo clone
SS_AGENTS_HOME=...
```

Configure claude code cli opts.

```shell
# Launch claude w/ local plugin path
claude --plugin-dir "${SS_AGENTS_HOME}/plugins/{plugin_name}"
```
