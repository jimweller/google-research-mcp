# API Documentation: `scrape_page` Tool

This document provides detailed API documentation for the `scrape_page` tool.

## When to Use This Tool

Use `scrape_page` when you have a **specific URL** and need its content. For researching a topic across multiple sources, use `search_and_scrape` instead — it's more efficient.

## Tool Overview

The `scrape_page` tool extracts text content from:
- **Web pages** — Static HTML (fast) or JavaScript-rendered SPAs (automatic Playwright fallback)
- **YouTube videos** — Extracts transcript with robust error handling and retry logic
- **Documents** — PDF, DOCX, PPTX files (extracts text and metadata)

Results are cached for 1 hour.

### Input Schema

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `url` | `string` | Yes | The URL to scrape. Supports web pages, YouTube videos, and documents (PDF, DOCX, PPTX). |

**Example Request:**

```json
{
  "tool": "scrape_page",
  "arguments": {
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }
}
```

### Output Schema

The tool returns a `ToolResult` object. The `content` field will contain the extracted text.

#### Successful Response (Web Page)

For a standard web page, the `content` will be a single string containing the cleaned page text.

```json
{
  "tool_name": "scrape_page",
  "content": [
    {
      "type": "text",
      "text": "This is the main content of the web page..."
    }
  ]
}
```

#### Successful Response (YouTube Transcript)

For a YouTube URL, the `content` will be a single string containing the full video transcript.

```json
{
  "tool_name": "scrape_page",
  "content": [
    {
      "type": "text",
      "text": "Never gonna give you up, never gonna let you down..."
    }
  ]
}
```

#### Successful Response (Document - PDF, DOCX, PPTX)

For document URLs, the tool extracts text content and appends metadata.

```json
{
  "tool_name": "scrape_page",
  "content": [
    {
      "type": "text",
      "text": "Document text content here...\n\n[Document: PDF, 15 pages, \"Annual Report 2024\"]"
    }
  ],
  "structuredContent": {
    "url": "https://example.com/report.pdf",
    "content": "Document text content here...",
    "contentType": "pdf",
    "contentLength": 12500,
    "truncated": false,
    "metadata": {
      "title": "Annual Report 2024",
      "pageCount": 15
    }
  }
}
```

**Supported document types:**
- **PDF** — Extracts text (10 MB limit)
- **DOCX** — Extracts text from Word documents
- **PPTX** — Extracts text from PowerPoint slides

## Structured Output

All responses include a `structuredContent` field with typed data:

| Field | Type | Description |
| :--- | :--- | :--- |
| `url` | string | The URL that was scraped |
| `content` | string | Extracted text content |
| `contentType` | enum | `html`, `youtube`, `pdf`, `docx`, or `pptx` |
| `contentLength` | number | Length of content in characters |
| `truncated` | boolean | Whether content was truncated due to size limits |
| `metadata` | object | Optional document metadata (title, pageCount) |

## Enhanced YouTube Error Handling

When `scrape_page` fails to retrieve a YouTube transcript, it returns a structured error message that is both machine-readable and user-friendly.

### Error Response Format

The error response will be a `ToolResult` with `is_error` set to `true`. The `content` will contain a detailed error message.

```json
{
  "tool_name": "scrape_page",
  "is_error": true,
  "content": [
    {
      "type": "text",
      "text": "Failed to retrieve YouTube transcript for [URL]. Reason: [Error Code] - [Error Description]."
    }
  ]
}
```

### Error Code Reference

The `[Error Code]` in the message corresponds to one of the 10 specific error types. See the [YouTube Transcript Extraction Technical Documentation](./youtube-transcript-extraction.md#error-classification-system) for a full list of error codes and their meanings.

### Example Error Responses

**Example 1: Transcript Disabled**

```json
{
  "tool_name": "scrape_page",
  "is_error": true,
  "content": [
    {
      "type": "text",
      "text": "Failed to retrieve YouTube transcript for https://www.youtube.com/watch?v=xxxx. Reason: TRANSCRIPT_DISABLED - The video owner has disabled transcripts."
    }
  ]
}
```

**Example 2: Video Not Found**

```json
{
  "tool_name": "scrape_page",
  "is_error": true,
  "content": [
    {
      "type": "text",
      "text": "Failed to retrieve YouTube transcript for https://www.youtube.com/watch?v=invalid. Reason: VIDEO_NOT_FOUND - The video could not be found."
    }
  ]
}
```

**Example 3: Network Error with Retry**

If a transient error like `NETWORK_ERROR` occurs, the system will retry automatically. If all retries fail, the final error message will be returned.

```json
{
  "tool_name": "scrape_page",
  "is_error": true,
  "content": [
    {
      "type": "text",
      "text": "Failed to retrieve YouTube transcript for https://www.youtube.com/watch?v=xxxx after 3 attempts. Reason: NETWORK_ERROR - A network error occurred."
    }
  ]
}