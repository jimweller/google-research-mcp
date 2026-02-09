# Google Researcher MCP - Manual Testing Guide

This guide provides real-world test scenarios for validating the Google Researcher MCP tools. Each test case includes expected behavior and success criteria.

## Table of Contents

1. [Basic Search Tools](#basic-search-tools)
2. [Content Extraction](#content-extraction)
3. [Specialized Search](#specialized-search)
4. [Multi-Step Research](#multi-step-research)
5. [Edge Cases](#edge-cases)

---

## Basic Search Tools

### Test 1: Google Web Search

**Purpose:** Validate basic web search functionality with various filters.

```json
{
  "tool": "google_search",
  "input": {
    "query": "TypeScript best practices 2024",
    "num_results": 5
  }
}
```

**Expected Result:**
- Returns array of URLs with titles and snippets
- Results are relevant to the query
- Response includes `resultCount` field

**Variations to Test:**
- Add `site_search: "github.com"` to restrict to a domain
- Add `time_range: "month"` for recent results
- Add `exact_terms: "async await"` for phrase matching

---

### Test 2: Google News Search

**Purpose:** Validate news-specific search with freshness filters.

```json
{
  "tool": "google_news_search",
  "input": {
    "query": "artificial intelligence regulations",
    "num_results": 5,
    "freshness": "week",
    "sort_by": "date"
  }
}
```

**Expected Result:**
- Returns recent news articles (within specified freshness)
- Each result includes `title`, `link`, `snippet`, `source`, `publishedDate`
- Results sorted by date when `sort_by: "date"`

**Variations to Test:**
- `freshness: "hour"` for breaking news
- `news_source: "bbc.com"` to restrict to specific outlet

---

### Test 3: Google Image Search

**Purpose:** Validate image search with type and size filters.

```json
{
  "tool": "google_image_search",
  "input": {
    "query": "machine learning architecture diagram",
    "num_results": 5,
    "type": "lineart",
    "size": "large"
  }
}
```

**Expected Result:**
- Returns image results with `link`, `thumbnailLink`, `width`, `height`
- Images match requested type (lineart, photo, etc.)
- Includes `contextLink` to source page

**Variations to Test:**
- `type: "photo"` for photographs
- `color_type: "mono"` for black & white
- `file_type: "png"` for specific format

---

## Content Extraction

### Test 4: Web Page Scraping (Preview Mode)

**Purpose:** Check page structure before full content fetch.

```json
{
  "tool": "scrape_page",
  "input": {
    "url": "https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html",
    "mode": "preview"
  }
}
```

**Expected Result:**
- Returns metadata: `title`, `contentLength`, `estimatedTokens`
- Includes `headings` array showing page structure
- Includes `excerpt` with first ~500 chars
- `sizeCategory` indicates small/medium/large

---

### Test 5: Web Page Scraping (Full Content)

**Purpose:** Extract full page content with size limits.

```json
{
  "tool": "scrape_page",
  "input": {
    "url": "https://nodejs.org/en/learn/getting-started/introduction-to-nodejs",
    "mode": "full",
    "max_length": 20000
  }
}
```

**Expected Result:**
- Returns full markdown content
- Content truncated at `max_length` if exceeded
- Includes `citation` object with APA/MLA formats

---

### Test 6: YouTube Transcript Extraction

**Purpose:** Extract transcripts from YouTube videos.

```json
{
  "tool": "scrape_page",
  "input": {
    "url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "mode": "full"
  }
}
```

**Expected Result:**
- `contentType: "youtube"` indicates video content
- Returns transcript text (auto-generated or manual)
- Works with standard youtube.com URLs

**Note:** Some videos may not have transcripts available.

---

### Test 7: PDF Document Extraction

**Purpose:** Extract text from PDF documents.

```json
{
  "tool": "scrape_page",
  "input": {
    "url": "https://arxiv.org/pdf/1706.03762.pdf",
    "mode": "preview"
  }
}
```

**Expected Result:**
- `contentType: "pdf"` indicates PDF processing
- Preview shows `pageCount` in metadata
- Full mode extracts text content

---

### Test 8: Search and Scrape Combined

**Purpose:** Search and extract content in one operation.

```json
{
  "tool": "search_and_scrape",
  "input": {
    "query": "Node.js memory leak detection tools",
    "num_results": 3,
    "max_length_per_source": 15000,
    "deduplicate": true
  }
}
```

**Expected Result:**
- Searches Google and scrapes top results
- Returns `combinedContent` with all sources merged
- Each source has `citation` for proper attribution
- `summary` shows processing stats

---

## Specialized Search

### Test 9: Academic Paper Search

**Purpose:** Find scholarly articles with citations.

```json
{
  "tool": "academic_search",
  "input": {
    "query": "transformer architecture attention mechanism",
    "num_results": 5,
    "year_from": 2020,
    "source": "arxiv"
  }
}
```

**Expected Result:**
- Returns papers with `title`, `authors`, `year`, `abstract`
- Includes pre-formatted `citations` (APA, MLA, BibTeX)
- ArXiv papers include `pdfUrl` and `arxivId`

**Variations to Test:**
- `source: "pubmed"` for medical papers
- `pdf_only: true` to filter papers with PDF links
- `sort_by: "date"` for most recent

---

### Test 10: Patent Search (Technology Keywords)

**Purpose:** Find patents by technology area.

```json
{
  "tool": "patent_search",
  "input": {
    "query": "video streaming adaptive bitrate",
    "num_results": 5,
    "search_type": "prior_art"
  }
}
```

**Expected Result:**
- Returns patents with `title`, `patentNumber`, `abstract`
- Includes `url` to Google Patents page
- Includes `pdfUrl` for direct PDF access

---

### Test 11: Patent Search (Company/Assignee)

**Purpose:** Find patents by company name.

```json
{
  "tool": "patent_search",
  "input": {
    "query": "video platform",
    "assignee": "Kaltura",
    "num_results": 5
  }
}
```

**Expected Result:**
- Results filtered to specified assignee
- Tool automatically tries name variations (with/without spaces, Inc, Corp)

**Important Limitation:** Google Custom Search doesn't index ALL patents. For comprehensive company research:
1. Use keyword search first
2. Follow up with direct Google Patents searches (via scrape_page)
3. Try multiple company name variations

---

### Test 11b: Direct Google Patents Scraping (SPA)

**Purpose:** Scrape Google Patents directly for comprehensive company patent research.

```json
{
  "tool": "scrape_page",
  "input": {
    "url": "https://patents.google.com/?assignee=Kaltura",
    "mode": "full"
  }
}
```

**Expected Result:**
- Full patent list rendered from the JavaScript SPA
- Each patent includes title, patent number, assignee, dates, abstract
- Works with any assignee search parameter

**Note:** Google Patents is a JavaScript SPA that requires Playwright rendering. The scrape_page tool automatically detects this and uses browser rendering.

**Variations to Test:**
- Search by inventor: `?inventor=John+Smith`
- Search by CPC code: `?q=CPC=G06F`
- Combined filters: `?assignee=Microsoft&q=machine+learning`

---

### Test 12: Patent Search (Inventor)

**Purpose:** Find patents by inventor name.

```json
{
  "tool": "patent_search",
  "input": {
    "query": "machine learning",
    "inventor": "Geoffrey Hinton",
    "num_results": 5
  }
}
```

**Expected Result:**
- Results filtered to specified inventor
- Uses exact phrase matching for inventor name

---

## Multi-Step Research

### Test 13: Sequential Search Workflow

**Purpose:** Track complex multi-step research.

**Step 1: Initialize**
```json
{
  "tool": "sequential_search",
  "input": {
    "searchStep": "Starting research on React Server Components best practices",
    "stepNumber": 1,
    "totalStepsEstimate": 4,
    "nextStepNeeded": true
  }
}
```

**Step 2: Record Finding**
```json
{
  "tool": "sequential_search",
  "input": {
    "sessionId": "<from step 1>",
    "searchStep": "Found official React docs on RSC patterns",
    "stepNumber": 2,
    "source": {
      "url": "https://react.dev/reference/rsc/server-components",
      "summary": "Official documentation on Server Components",
      "qualityScore": 0.9
    },
    "nextStepNeeded": true
  }
}
```

**Step 3: Complete**
```json
{
  "tool": "sequential_search",
  "input": {
    "sessionId": "<from step 1>",
    "searchStep": "Research complete - found 3 authoritative sources",
    "stepNumber": 3,
    "nextStepNeeded": false
  }
}
```

**Expected Result:**
- Each step returns `sessionId` for continuation
- `stateSummary` shows progress
- Final step shows `isComplete: true`

---

## Edge Cases

### Test 14: Large Content Handling

```json
{
  "tool": "scrape_page",
  "input": {
    "url": "https://en.wikipedia.org/wiki/Machine_learning",
    "mode": "full",
    "max_length": 5000
  }
}
```

**Expected Result:**
- Content truncated at natural breakpoints
- `truncated: true` in response
- No mid-word or mid-sentence cuts

---

### Test 15: Rate Limiting / Error Handling

Run multiple searches in quick succession to verify:
- Graceful error messages
- Cache hits on repeated queries (30-minute cache)
- No crashes on API failures

---

### Test 16: International Content

```json
{
  "tool": "google_search",
  "input": {
    "query": "künstliche Intelligenz",
    "language": "lang_de",
    "country": "countryDE",
    "num_results": 3
  }
}
```

**Expected Result:**
- Results in German
- From German domains
- Proper UTF-8 encoding

---

### Test 17: JavaScript SPA Rendering

**Purpose:** Verify Playwright-based rendering for JavaScript-heavy sites.

```json
{
  "tool": "scrape_page",
  "input": {
    "url": "https://patents.google.com/?q=video+streaming",
    "mode": "full"
  }
}
```

**Expected Result:**
- Full content rendered (not just HTML shell)
- Dynamic content loaded via JavaScript is captured
- Page title reflects search query
- Content includes actual search results, not just page skeleton

**Known SPA Sites Supported:**
- `patents.google.com` - Google Patents
- `scholar.google.com` - Google Scholar
- `trends.google.com` - Google Trends
- `twitter.com` / `x.com` - Twitter/X
- `linkedin.com` - LinkedIn

**Note:** The scraper automatically detects SPA sites and uses Playwright with extended wait times for JavaScript rendering.

---

## Success Criteria Checklist

- [ ] All 10 tools respond without errors
- [ ] Search results are relevant to queries
- [ ] Content extraction returns readable markdown
- [ ] YouTube transcripts extract correctly
- [ ] PDF text extraction works
- [ ] Academic citations are properly formatted
- [ ] Patent search finds relevant results
- [ ] **Google Patents SPA renders full results**
- [ ] Sequential search maintains session state
- [ ] Error messages are descriptive
- [ ] Cache reduces duplicate API calls
- [ ] **JavaScript SPAs are automatically detected and rendered**

---

## Troubleshooting

### Common Issues

1. **Empty search results**: Check API quotas in Google Cloud Console
2. **Scrape failures**: Some sites block automated access; try different URLs
3. **YouTube no transcript**: Not all videos have captions available
4. **Patent search missing results**: Use direct Google Patents for comprehensive company searches

### Verifying Cache

Check cache stats via MCP resources:
```
cache://stats
```

Should show hit/miss ratios and entry counts.
