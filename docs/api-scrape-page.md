# API Documentation: `scrape_page` Tool

This document provides detailed API documentation for the `scrape_page` tool, with a focus on its enhanced capabilities for extracting YouTube video transcripts.

## Tool Overview

The `scrape_page` tool is designed to extract text content from web pages and YouTube videos. It intelligently filters out noise (like ads and navigation menus) and can automatically retrieve video transcripts when available.

### Input Schema

The tool takes a single argument:

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `url` | `string` | Yes | The URL of the web page or YouTube video to scrape. |

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