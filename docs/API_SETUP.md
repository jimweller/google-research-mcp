# Google API Setup Guide

This guide walks you through getting the Google API credentials needed to use Google Researcher MCP.

## Prerequisites

- A Google account
- A credit card (for Google Cloud verification - you get $300 free credit and won't be charged)

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top
3. Click "New Project"
4. Name it something like "MCP Research Tools"
5. Click "Create"

## Step 2: Enable the Custom Search API

1. In your new project, go to [APIs & Services > Library](https://console.cloud.google.com/apis/library)
2. Search for "Custom Search API"
3. Click on "Custom Search API"
4. Click "Enable"

## Step 3: Create an API Key

1. Go to [APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" > "API Key"
3. Copy your API key (this is your `GOOGLE_CUSTOM_SEARCH_API_KEY`)
4. (Optional but recommended) Click "Edit API key" to restrict it to Custom Search API only

## Step 4: Create a Programmable Search Engine

1. Go to [Programmable Search Engine](https://programmablesearchengine.google.com/)
2. Click "Add" or "Create a search engine"
3. Under "What to search":
   - Select "Search the entire web"
4. Name your search engine (e.g., "MCP Web Search")
5. Click "Create"
6. On the next page, find your "Search engine ID" (this is your `GOOGLE_CUSTOM_SEARCH_ID`)

## Step 5: Configure Your MCP Client

Use the credentials in your MCP client configuration:

**Claude Desktop (macOS):** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Claude Desktop (Windows):** `%APPDATA%\Claude\claude_desktop_config.json`
**Claude Code:** `~/.claude.json` or `~/.config/claude/settings.json`

## API Limits

- **Free tier:** 100 queries/day
- **Paid tier:** $5 per 1,000 queries (after free quota)

For most personal use, the free tier is sufficient. Results are cached for 30 minutes to minimize API calls.

## Troubleshooting

### "API key not valid" error
- Make sure you've enabled the Custom Search API in your project
- Check that you copied the entire API key

### "Invalid search engine ID" error
- Verify the Search Engine ID from programmablesearchengine.google.com
- Make sure you selected "Search the entire web"

### Rate limit errors
- Wait for the daily quota to reset (midnight Pacific time)
- Or enable billing for additional quota
