# Wiz VSCode Extension

A comprehensive VS Code extension for managing [Wiz Framework](https://github.com/season-framework/wiz) projects with an enhanced file explorer, specialized editors, and intelligent project navigation.

[![Version](https://img.shields.io/badge/version-1.4.2-green.svg)](https://github.com/season-framework/wiz-vscode/releases/tag/v1.4.2)
[![Wiz](https://img.shields.io/badge/wiz-%3E%3D2.5.0-blue.svg)](https://github.com/season-framework/wiz)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.60+-purple.svg)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📋 Requirements

- **VS Code**: 1.60.0 or higher
- **Wiz Framework**: 2.5.0 or higher
- **Node.js**: 14.x or higher

---

## ✨ Features

### 🗂️ Smart Project Explorer
- **Five-Level Structure**: Source, Packages (Portal), Project, Copilot, and Config categories
- **App Type Recognition**: Automatic detection of Page, Component, Layout, and Route apps
- **Virtual Folders**: Display standard folders even when they don't exist yet
- **Auto-Highlighting**: Automatically reveals active file in the tree view
- **Drag & Drop**: Move files and folders effortlessly
- **Multi-Select**: Work with multiple items simultaneously
- **File Upload**: Upload files and folders via Webview (Remote compatible)
- **Folder Protection**: Source/Packages root folders protected from accidental deletion

### ✏️ Specialized Editors
- **App Info Editor**: Webview-based visual editor for `app.json` configuration
- **Route Editor**: Dedicated interface for route-specific settings
- **Portal App Editor**: Namespace-synced editor for portal applications
- **Portal Package Editor**: Manage `portal.json` with auto-completed fields
- **View Type Selection**: Choose between HTML and Pug templates

### 🤖 MCP (Model Context Protocol) Integration
Built-in MCP server that allows AI agents (like Claude) to directly manage Wiz projects. The MCP server **automatically syncs with the VS Code Explorer** — when you switch projects, the MCP server reflects the change in real-time via a shared state file.

**54 tools** across 4 categories:

#### 🌐 Workspace (7)
| Tool | Description |
|------|-------------|
| `wiz_workspace_status` | Get workspace state, active project, and project list |
| `wiz_workspace_list_dir` | List directory contents (relative to workspace root) |
| `wiz_workspace_read_file` | Read file (relative to workspace root, line range support) |
| `wiz_workspace_write_file` | Write file (relative to workspace root) |
| `wiz_workspace_create_dir` | Create directory |
| `wiz_workspace_delete` | Delete file/directory |
| `wiz_workspace_rename` | Rename/move file or directory |

#### 📁 Project (19)
| Tool | Description |
|------|-------------|
| `wiz_project_info` | Get comprehensive project info (apps, packages, paths) |
| `wiz_project_switch` | Switch active project (syncs with Explorer) |
| `wiz_project_build` | Build project (Normal/Clean) |
| `wiz_project_export` | Export project as `.wizproject` archive |
| `wiz_project_import` | Import `.wizproject` file as new project |
| `wiz_project_structure` | Get project src/ directory tree |
| `wiz_project_list_dir` | List directory (relative to project root) |
| `wiz_project_read_file` | Read file (relative to project root, line range) |
| `wiz_project_write_file` | Write file (relative to project root) |
| `wiz_project_create_dir` | Create directory in project |
| `wiz_project_delete` | Delete file/directory in project |
| `wiz_project_rename` | Rename/move in project |
| `wiz_project_search_apps` | Search apps by keyword (source + packages) |
| `wiz_project_pip_list` | List installed pip packages |
| `wiz_project_pip_install` | Install pip package(s) |
| `wiz_project_pip_uninstall` | Uninstall pip package(s) |
| `wiz_project_npm_list` | List installed npm packages |
| `wiz_project_npm_install` | Install npm package(s) |
| `wiz_project_npm_uninstall` | Uninstall npm package(s) |

#### 🧩 Source (13)
| Tool | Description |
|------|-------------|
| `wiz_source_list_apps` | List source apps/routes (filter by type) |
| `wiz_source_app_info` | Get app details and file list |
| `wiz_source_create_app` | Create standard app (page, component, layout) |
| `wiz_source_create_route` | Create route (API endpoint) |
| `wiz_source_update_app` | Update app.json configuration |
| `wiz_source_delete_app` | Delete an app/route folder |
| `wiz_source_list_files` | List files within an app folder |
| `wiz_source_read_file` | Read a file within an app folder |
| `wiz_source_write_file` | Write a file within an app folder |
| `wiz_source_delete_file` | Delete a file within an app folder |
| `wiz_source_rename_file` | Rename a file within an app folder |
| `wiz_source_list_controllers` | List Python controllers |
| `wiz_source_list_layouts` | List layout apps |

#### 📦 Package (15)
| Tool | Description |
|------|-------------|
| `wiz_package_list` | List portal packages |
| `wiz_package_create` | Create new package |
| `wiz_package_export` | Export package as `.wizpkg` archive |
| `wiz_package_list_apps` | List apps/routes within a package |
| `wiz_package_app_info` | Get portal app details and file list |
| `wiz_package_create_app` | Create portal app in package |
| `wiz_package_create_route` | Create portal route in package |
| `wiz_package_update_app` | Update portal app.json |
| `wiz_package_delete_app` | Delete portal app/route |
| `wiz_package_list_files` | List files within a portal app folder |
| `wiz_package_read_file` | Read a file within a portal app folder |
| `wiz_package_write_file` | Write a file within a portal app folder |
| `wiz_package_delete_file` | Delete a file within a portal app folder |
| `wiz_package_list_controllers` | List controllers in a package |

> **Note**: `projectName` is **auto-detected** from Explorer state. All path parameters support relative paths that are auto-resolved to the appropriate root.

### ⌨️ Command Palette Integration
Quick access to all major features via `Ctrl+Shift+P`:

| Command | Description |
|---------|-------------|
| `Wiz: Start MCP Server` | Start MCP Server |
| `Wiz: Stop MCP Server` | Stop MCP Server |
| `Wiz: Show MCP Configuration` | Open MCP config file (.vscode/mcp.json) |
| `Wiz: Create MCP Configuration` | Create MCP config file (shown when mcp.json doesn't exist) |
| `Wiz: Build Project` | Build with type selection (Normal/Clean) |
| `Wiz: Normal Build` | Direct normal build |
| `Wiz: Clean Build` | Direct clean build |
| `Wiz: Show Build Output` | Display build output channel |
| `Wiz: Switch Project` | Quick project switching |
| `Wiz: Export Current Project` | Export to `.wizproject` file |
| `Wiz: Import Project` | Import from `.wizproject` file |
| `Wiz: Go to App` | Search and navigate to any app |
| `Wiz: Create New Page/Component/Layout/Route` | Create apps with Source/Package selection |
| `Wiz: Create New Package` | Create new Portal package |
| `Wiz: Select Build Python Interpreter` | Select Python interpreter for builds |
| `Wiz: npm Package Manager` | Open npm package management UI |
| `Wiz: pip Package Manager` | Open pip package management UI |
| `Wiz: Refresh Explorer` | Refresh the tree view |

### 🎯 Keyboard Shortcuts
When editing a Wiz app (`wiz://` scheme active):
- `Opt+A` (Mac) / `Alt+A` (Windows/Linux): Navigate to previous file type
- `Opt+S` (Mac) / `Alt+S` (Windows/Linux): Navigate to next file type
- `Opt+T` (Mac) / `Alt+T` (Windows/Linux): Open current document in split view

**File Type Navigation Order**:
- Apps: UI → Component → SCSS → API → Socket (cycles)
- Routes: Controller only

### 🚀 Project Management
- **Git Integration**: Clone projects directly from repositories
- **Project Switching**: Quick switch between multiple projects
- **Project Export**: Export projects as `.wizproject` archives
- **Project Import**: Import `.wizproject` files
- **Project Deletion**: Safe removal with confirmation dialogs
- **Package Management**: Create and export Portal packages

### 🔄 Build Integration
- **Auto-Build Trigger**: Automatic build on file save, with on/off control via `wizExplorer.build.autoBuildOnSave`
- **Python Environment Auto-Discovery**: Automatically scan PATH, conda, pyenv, venv for available interpreters
- **Python Interpreter Selection**: QuickPick-based selector with version info and wiz availability
- **Build Output Channel**: Real-time build log viewing
- **Normal/Clean Build**: Choose build type as needed

### 📦 Package Management
- **npm Package Manager**: Visual Webview UI for managing npm packages (install, uninstall, upgrade, search)
- **pip Package Manager**: Visual Webview UI for managing Python pip packages
- **Card-Based UI**: Modern card layout with real-time search filtering
- **Integrated Access**: Available from settings menu and Command Palette

---

## 🤖 MCP Server Setup

### VS Code Integration (Recommended)

1. **Create MCP Configuration**:
   - Press `Ctrl+Shift+P` → `Wiz: Create MCP Configuration`
   - This creates `.vscode/mcp.json` with the correct server settings
   - VS Code automatically detects and activates the MCP server

2. **Use with VS Code Copilot Agent Mode**:
   - MCP tools are automatically available in agent mode
   - The server syncs with Explorer — switching projects is reflected immediately
   - Ask the AI to manage your Wiz project

### Claude Desktop Integration

1. **Copy MCP Configuration**:
   - Open `.vscode/mcp.json` and copy the server configuration

2. **Add to Claude Desktop**:
   - Open Claude Desktop settings
   - Add the MCP server configuration:

```json
{
  "mcpServers": {
    "wiz": {
      "command": "node",
      "args": ["/path/to/wiz-vscode/src/mcp/index.js"],
      "env": {
        "WIZ_WORKSPACE": "/path/to/your/wiz/workspace"
      }
    }
  }
}
```

3. **Restart Claude Desktop** to apply changes

### Example Prompts

```
"Show me all page apps in the Wiz project"
"Create a new page app with namespace dashboard"
"Check all app information in the dizest package"
"Build the current project"
"Read view.html file of myapp"
```

---

## 📦 Installation

### From Source (Development)

1. **Clone the repository**:
```bash
git clone https://github.com/season-framework/wiz-vscode.git
cd wiz-vscode
```

2. **Install dependencies**:
```bash
npm install
```

3. **Run in Extension Development Host**:
- Press `F5` in VS Code
- A new VS Code window will open with the extension loaded

### From VSIX Package

```bash
code --install-extension wiz-vscode-1.4.2.vsix
```

### Building VSIX from Source

To build a `.vsix` package yourself:

1. **Install `@vscode/vsce`** (VS Code Extension Manager):
```bash
npm install -g @vscode/vsce
```

2. **Install project dependencies**:
```bash
npm install
```

3. **Package the extension**:
```bash
vsce package --no-dependencies
```

This generates `wiz-vscode-{version}.vsix` in the project root.

4. **Install the generated VSIX**:
```bash
code --install-extension wiz-vscode-*.vsix
```

> **Note**: The `--no-dependencies` flag skips bundling `node_modules` since this extension has no runtime npm dependencies.

---

## 🎓 Usage

### Opening a Wiz Project

1. Open a Wiz Framework project folder in VS Code
2. Click the **WIZ** icon in the Activity Bar
3. Navigate through the categorized tree structure:
   - **Source**: Contains `src/` apps (page, component, layout, route)
   - **Packages**: Portal packages from `src/portal/`
   - **Project**: Root-level files and directories
   - **Copilot**: GitHub Copilot instructions (`.github/`)
   - **Config**: Project configuration (`project/config/`)

### Creating New Apps

**From Command Palette** (Recommended):
1. Press `Ctrl+Shift+P`
2. Type `Wiz: Create New Page` (or Component/Layout/Route)
3. Select location: **Source** or **Package**
4. If Package selected, choose the target package
5. Fill in the namespace and optional fields

**From Context Menu**:
1. Right-click on an app group in the tree
2. Select "New App" or "New Route"
3. Fill in the form

### Managing Projects

**Switch Project**:
1. Press `Ctrl+Shift+P` → `Wiz: Switch Project`
2. Or click the Project Switcher icon in the explorer toolbar

**Export Project**:
1. Press `Ctrl+Shift+P` → `Wiz: Export Current Project`
2. Project is saved to `exports/` folder as `.wizproject`

**Import Project**:
1. Press `Ctrl+Shift+P` → `Wiz: Import Project`
2. Select a `.wizproject` file
3. Enter project name and confirm

### Building

**Manual Build**:
- `Wiz: Normal Build` - Standard incremental build
- `Wiz: Clean Build` - Full rebuild from scratch

**Auto Build**:
- Triggered automatically when saving files in the current Wiz project `src/` tree
- Can be disabled with the `wizExplorer.build.autoBuildOnSave` setting

**Settings Example**:
```json
{
   "wizExplorer.build.autoBuildOnSave": false
}
```

Disabling auto build does not affect manual build commands.

---

## 🏗️ Architecture

### Core Modules (`src/core/`)

| Module | Purpose |
|--------|---------|
| `constants.js` | Centralized constants (App types, icons, file mappings) |
| `pathUtils.js` | URI parsing, app folder detection, path resolution |
| `fileUtils.js` | File I/O operations, JSON handling |
| `uriFactory.js` | Factory for generating `wiz://` virtual URIs |
| `webviewTemplates.js` | HTML templates for Webview editors |

### Editor System (`src/editor/`)

**Facade Pattern**: `appEditorProvider.js` manages all editor instances.

**Editor Hierarchy**:
```
EditorBase (Abstract)
├── AppEditor (Standard apps)
│   ├── RouteEditor (Routes)
│   └── PortalAppEditor (Portal apps)
├── PortalEditor (portal.json)
└── Create Editors (App creation dialogs)
```

### Explorer (`src/explorer/`)

- **FileExplorerProvider**: Main tree data provider
- **CategoryHandlers**: Source, Portal, Project, Exports category logic
- **AppPatternProcessor**: Groups apps by type (page, component, layout)
- **WizDragAndDropController**: Handles file/folder movement

### Virtual File System

- **Scheme**: `wiz://<authority>/<base64-path>?label=<display-name>`
- **Provider**: `wizFileSystemProvider.js` maps virtual URIs to real files
- **Purpose**: Clean editor tabs without exposing complex paths

---

## 🛠️ Development Guide

### Project Structure

```
wiz-vscode/
├── src/
│   ├── core/                  # Core utilities and constants
│   ├── editor/                # Webview editors and providers
│   │   └── editors/          # Individual editor implementations
│   ├── explorer/             # Tree view components
│   │   ├── models/           # Category handlers
│   │   └── treeItems/        # Tree item classes
│   ├── services/             # Business logic layer
│   │   ├── project/          # Project/Build/MCP management
│   │   ├── app/              # Source/Package/Navigation management
│   │   └── file/             # File operations
│   ├── mcp/                  # MCP server entry point
│   └── extension.js          # Extension entry point (glue only)
├── resources/                # Icons and assets
├── devlog/                   # Development logs (001-050)
├── package.json              # Extension manifest
└── DEVLOG.md                 # Comprehensive development history
```

### Key Design Patterns

1. **Facade Pattern**: `AppEditorProvider` centralizes editor management
2. **Factory Pattern**: `WizUriFactory` creates virtual URIs consistently
3. **Template Method**: `EditorBase` defines lifecycle, subclasses override specifics
4. **Strategy Pattern**: Different category handlers for Source/Portal/Project

### Adding a New Editor

1. Create a new class in `src/editor/editors/` extending `EditorBase`
2. Implement `generateHtml()` and `handleMessage()`
3. Register in `AppEditorProvider`
4. Add command to `package.json` and `extension.js`

### Testing Changes

```bash
# Run extension in debug mode
Press F5 in VS Code

# Check for errors
Open Developer Tools in Extension Host window
```

---

## 📊 Latest Version: v1.4.2

See [Release Notes](./release/v1.4.2.md) for details on the current release.

All release notes are available in the [release/](./release/) directory.  
Detailed development logs are maintained in [devlog/](./devlog/) and [DEVLOG.md](./DEVLOG.md).

---

## 📅 Roadmap & TODO

- Develop wiz server cache management features (Wiz library version update expected)
- Agent Guide documentation for WIZ CLI and main features

---

## 🤝 Contributing

We welcome contributions! Here's how you can get started:

### Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
```bash
git clone https://github.com/<your-username>/wiz-vscode.git
cd wiz-vscode
```
3. **Install dependencies**:
```bash
npm install
```
4. **Create** a feature branch:
```bash
git checkout -b feature/amazing-feature
```
5. **Run** the extension in debug mode: Press `F5` in VS Code
6. **Make** your changes and test thoroughly
7. **Commit** and push:
```bash
git commit -m 'feat: add amazing feature'
git push origin feature/amazing-feature
```
8. **Open** a Pull Request on GitHub

### Development Environment

- **Node.js**: 14.x or higher
- **VS Code**: 1.60.0 or higher
- **Debugging**: Press `F5` to launch Extension Development Host
- **DevTools**: Use `Developer: Toggle Developer Tools` in the host window to inspect Webview DOM and console errors

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Purpose |
|--------|---------------------|
| `feat:` | New features |
| `fix:` | Bug fixes |
| `docs:` | Documentation only |
| `refactor:` | Code refactoring |
| `chore:` | Maintenance tasks |
| `style:` | Formatting changes |
| `test:` | Adding tests |

### Code Guidelines

- Follow the existing code style and patterns (Facade, Factory, Template Method)
- Update `devlog/` when making significant changes
- Keep editor classes extending `EditorBase` for consistency
- Use `WizPathUtils` for all path parsing — avoid ad-hoc path logic
- Register new commands in both `package.json` and `extension.js`
- Refer to [architecture-guide.md](.github/architecture-guide.md) for detailed conventions

### Reporting Issues

- Use [GitHub Issues](https://github.com/season-framework/wiz-vscode/issues) to report bugs or request features
- Include VS Code version, OS, and steps to reproduce
- Attach relevant error logs from the Output panel or Developer Tools

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🔗 Resources

- **Wiz Framework**: [https://github.com/season-framework/wiz](https://github.com/season-framework/wiz)
- **VS Code Extension API**: [https://code.visualstudio.com/api](https://code.visualstudio.com/api)
- **Issue Tracker**: [GitHub Issues](https://github.com/season-framework/wiz-vscode/issues)

---

<p align="center">Made with ❤️ for the Wiz Framework community</p>

