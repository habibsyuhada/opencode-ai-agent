# Install Guide

## 1. Install the CLI

```bash
npm install -g .
```

## 2. Attach agents to a project without copying

```bash
cd your-project
armiai install
```

This creates a project `.opencode` symlink to the globally installed template.

## 3. Migrate existing workflow state

```bash
armiai migrate
```

This scans existing artifacts and creates low-token flow state under `docs/flow-state/`.

## 4. Continue in OpenCode

Open your project with OpenCode and use:

```text
Armi, continue this project from the current checkpoint. Do not redo completed stages.
```

## 5. Update later

When you install a newer version:

```bash
npm install -g . --force
cd your-project
armiai update
```

## 6. Remove from a project

```bash
armiai uninstall
```
