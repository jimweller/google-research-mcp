# MCP Distribution Guide

This document describes all available distribution channels for the Google Researcher MCP server and how to use them.

## Quick Reference

| Channel | Type | Status | Link |
|---------|------|--------|------|
| **npm** | Package Registry | ✅ Published | [npmjs.com/package/google-researcher-mcp](https://www.npmjs.com/package/google-researcher-mcp) |
| **MCP Registry** | Official Registry | ✅ Published | Via `mcp-publisher` CLI |
| **MCPB / GitHub Releases** | One-click Install | ✅ Automated | [GitHub Releases](https://github.com/zoharbabin/google-research-mcp/releases) |
| **awesome-mcp-servers** | Curated List | ⏳ PR #1917 | [GitHub](https://github.com/punkpeye/awesome-mcp-servers) |
| **Glama.ai** | Directory | 📋 Todo | [glama.ai/mcp/servers](https://glama.ai/mcp/servers) |
| **MCP.so** | Marketplace | 📋 Todo | [mcp.so](https://mcp.so) |

---

## Installation Methods

### For Developers (npm)

```bash
# Global installation
npm install -g google-researcher-mcp

# Or run directly with npx
npx google-researcher-mcp
```

### For Claude Desktop Users (MCPB)

1. Download the `.mcpb` file from [GitHub Releases](https://github.com/zoharbabin/google-research-mcp/releases)
2. Double-click the file to install in Claude Desktop
3. Enter your Google API credentials when prompted

### Manual Configuration (Claude Desktop)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "google-researcher": {
      "command": "npx",
      "args": ["-y", "google-researcher-mcp"],
      "env": {
        "GOOGLE_CUSTOM_SEARCH_API_KEY": "your-api-key",
        "GOOGLE_CUSTOM_SEARCH_ID": "your-search-engine-id"
      }
    }
  }
}
```

---

## Distribution Channels

### 1. npm (Primary)

**URL:** https://www.npmjs.com/package/google-researcher-mcp

The primary distribution channel for developers. Published via `npm publish`.

**Publishing:**
```bash
npm login
npm publish
```

**Version:** Managed in `package.json`

---

### 2. MCP Registry (Official Anthropic)

The official MCP server registry maintained by Anthropic.

**Publishing:**
```bash
npm install -g mcp-publisher
mcp-publisher login
mcp-publisher publish
```

**Configuration:** Uses `package.json` metadata including `mcpName` field.

---

### 3. MCPB (MCP Bundles)

**Spec:** https://github.com/modelcontextprotocol/mcpb

One-click installation format for Claude Desktop. Bundles are automatically built and attached to GitHub Releases via our CI workflow.

**Manual Build:**
```bash
npm install -g @anthropic-ai/mcpb
mcpb validate manifest.json
mcpb pack . google-researcher-mcp.mcpb
```

**Key Files:**
- `manifest.json` - MCPB manifest (v0.4)
- `.mcpbignore` - Files to exclude from bundle
- `.github/workflows/mcpb-release.yml` - Automated build workflow

**Best Practices:**
- Use manifest_version "0.4" for latest features
- Include `privacy_policies` for external service connections
- Define `user_config` for API credentials
- Keep bundle size under 100MB

---

### 4. awesome-mcp-servers

**URL:** https://github.com/punkpeye/awesome-mcp-servers (80k+ stars)

A curated community list of MCP servers.

**Submission:**
1. Fork the repository
2. Add entry to appropriate category in README.md
3. Submit PR with description

**Entry Format:**
```markdown
- [google-researcher-mcp](https://github.com/zoharbabin/google-research-mcp) - Google Search, web scraping, academic/patent search, and multi-source research tools.
```

**Status:** PR #1917 submitted

---

### 5. Glama.ai

**URL:** https://glama.ai/mcp/servers

The largest MCP directory with 17,000+ servers. Features quality scores, security audits, and usage metrics.

**Submission:**
1. Go to https://glama.ai/mcp/servers
2. Click "Add Server"
3. Submit GitHub repository URL
4. Server is automatically indexed and scored

**Benefits:**
- A/B/C quality grades
- Security audit results
- Usage statistics
- Deep search functionality

---

### 6. MCP.so

**URL:** https://mcp.so

Community-driven marketplace with 17,500+ servers.

**Submission:**
1. Click "Submit" in navigation
2. Create GitHub issue at their repository
3. Provide: name, description, features, connection info

---

### 7. Other Directories

| Directory | URL | Notes |
|-----------|-----|-------|
| MCPHub.io | https://mcphub.io | Auto-indexed from GitHub |
| Cursor Directory | https://cursor.directory/mcp | For Cursor IDE users |
| MCP.run | https://mcp.run | Enterprise gateway (not public directory) |

---

## Automated Release Process

When you create a GitHub Release:

1. **CI/CD Pipeline** runs tests across Node 20/22/24 on Linux, macOS, Windows
2. **MCPB Release** workflow builds and attaches `.mcpb` bundle
3. **npm publish** (manual) updates the npm package

### Creating a Release

```bash
# Update version
npm version patch|minor|major

# Push with tags
git push origin main --tags

# Create GitHub Release (triggers MCPB build)
gh release create v6.0.1 --generate-notes
```

---

## Maintaining Distributions

### Version Sync

Keep versions synchronized across:
- `package.json` - npm version
- `manifest.json` - MCPB version (auto-updated by CI)
- GitHub Releases - tag version

### Updating Registry Listings

After major updates:
1. Publish to npm: `npm publish`
2. Update MCP Registry: `mcp-publisher publish`
3. Create GitHub Release for MCPB
4. Update directory listings if description changed

---

## Related Resources

- [README.md](../README.md) - Main documentation
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guide
- [CHANGELOG.md](./CHANGELOG.md) - Version history
- [GitHub Issue #89](https://github.com/zoharbabin/google-research-mcp/issues/89) - Distribution tracking issue
