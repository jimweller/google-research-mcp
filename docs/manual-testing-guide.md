# Manual Testing Guide & Examples

This guide provides real-world test scenarios for verifying the Google Researcher MCP server functionality. These examples also demonstrate what's possible with the MCP tools.

## Quick Reference: Which Tool to Use

| Scenario | Tool | Why |
|----------|------|-----|
| Research a topic | `search_and_scrape` | Gets search results AND content in one call |
| Get URLs only | `google_search` | When you'll process pages yourself |
| Read specific URL | `scrape_page` | When you already have the URL |
| Find recent news | `google_news_search` | Freshness filters, news sources |
| Find images | `google_image_search` | Visual content with filters |
| Academic research | `academic_search` | Papers with citations (APA, MLA, BibTeX) |
| Patent research | `patent_search` | Prior art, FTO analysis |
| Complex investigation | `sequential_search` | Track multi-step research progress |

---

## Test Scenarios

### 1. Basic Web Search

**Purpose**: Verify basic search returns relevant URLs

```json
{
  "tool": "google_search",
  "params": {
    "query": "MCP Model Context Protocol specification",
    "num_results": 3
  }
}
```

**Expected Output**:
- Array of 3 URLs
- URLs should include modelcontextprotocol.io or related sites
- Response includes `query` and `resultCount`

---

### 2. Research with Content (Primary Use Case)

**Purpose**: Most common research scenario - search and get content in one call

```json
{
  "tool": "search_and_scrape",
  "params": {
    "query": "What is RAG retrieval augmented generation for LLMs",
    "num_results": 2,
    "max_length_per_source": 5000
  }
}
```

**Expected Output**:
- `combinedContent` with merged content from sources
- `sources` array with URLs, citations, quality scores
- `sizeMetadata` with token estimates
- Pre-formatted citations (APA, MLA)

**Use Cases**:
- Answering technical questions
- Researching unfamiliar topics
- Fact-checking claims
- Comparing products/technologies

---

### 3. Scrape Specific URL

**Purpose**: Extract content from a known URL

```json
{
  "tool": "scrape_page",
  "params": {
    "url": "https://github.com/anthropics/anthropic-cookbook",
    "max_length": 3000
  }
}
```

**Expected Output**:
- Markdown-formatted content
- `citation` with metadata and formatted citations
- `truncated` flag if content exceeded limit
- `estimatedTokens` for context planning

**Supported Content Types**:
- HTML web pages (static and JavaScript-rendered)
- YouTube videos (extracts transcript)
- PDF documents
- DOCX documents
- PPTX presentations

---

### 4. YouTube Transcript Extraction

**Purpose**: Verify YouTube transcript extraction works

```json
{
  "tool": "scrape_page",
  "params": {
    "url": "https://www.youtube.com/watch?v=zjkBMFhNj_g",
    "max_length": 2000
  }
}
```

**Expected Output**:
- `contentType`: "youtube"
- Full transcript text in `content`
- Proper truncation with `originalLength`

**Example**: Andrej Karpathy's "Intro to LLMs" video returns ~51K characters of transcript.

---

### 5. News Search

**Purpose**: Find recent news with freshness filters

```json
{
  "tool": "google_news_search",
  "params": {
    "query": "AI agents autonomous systems",
    "num_results": 3,
    "freshness": "week"
  }
}
```

**Expected Output**:
- `articles` array with title, link, snippet, source
- Results filtered to last 7 days
- `freshness` and `sortedBy` in response

**Freshness Options**: `hour`, `day`, `week`, `month`, `year`

---

### 6. Image Search

**Purpose**: Find images with type/size filters

```json
{
  "tool": "google_image_search",
  "params": {
    "query": "neural network architecture diagram",
    "num_results": 3,
    "type": "lineart"
  }
}
```

**Expected Output**:
- `images` array with:
  - `link` (full image URL)
  - `thumbnailLink`
  - `contextLink` (page containing image)
  - `width`, `height`, `fileSize`

**Filter Options**:
- `size`: huge, large, medium, small
- `type`: clipart, face, lineart, photo, animated
- `color_type`: color, gray, mono, trans
- `file_type`: jpg, gif, png, svg, webp

---

### 7. Academic Paper Search

**Purpose**: Find research papers with proper citations

```json
{
  "tool": "academic_search",
  "params": {
    "query": "transformer attention mechanism deep learning",
    "num_results": 3,
    "year_from": 2020
  }
}
```

**Expected Output**:
- `papers` array with:
  - `title`, `authors`, `year`, `abstract`
  - `venue` (journal/conference)
  - `doi` when available
  - `citations` object with APA, MLA, BibTeX formats

**Use Cases**:
- Literature reviews
- Finding authoritative sources
- Academic research
- Technical deep-dives

---

### 8. Patent Search

**Purpose**: Search patents for prior art, FTO analysis

```json
{
  "tool": "patent_search",
  "params": {
    "query": "large language model training optimization",
    "num_results": 3,
    "year_from": 2022
  }
}
```

**Expected Output**:
- `patents` array with:
  - `title`, `patentNumber`, `url`
  - `abstract`
  - `patentOffice` (US, EP, WO, JP, CN, KR)
  - `pdfUrl` for direct PDF access

**Filter Options**:
- `patent_office`: US, EP, WO, JP, CN, KR
- `assignee`: Filter by company
- `inventor`: Filter by inventor name
- `cpc_code`: Filter by CPC classification
- `search_type`: prior_art, specific, landscape

---

### 9. Multi-Step Research (Sequential Search)

**Purpose**: Track complex research with multiple steps

**Step 1: Start Session**
```json
{
  "tool": "sequential_search",
  "params": {
    "searchStep": "Starting research on vector databases for RAG applications",
    "stepNumber": 1,
    "totalStepsEstimate": 3,
    "nextStepNeeded": true
  }
}
```

**Step 2: Record Findings**
```json
{
  "tool": "sequential_search",
  "params": {
    "sessionId": "<session-id-from-step-1>",
    "searchStep": "Found comparison: Pinecone (managed), Weaviate (hybrid), Chroma (local)",
    "stepNumber": 2,
    "totalStepsEstimate": 3,
    "nextStepNeeded": true,
    "source": {
      "url": "https://example.com/comparison",
      "summary": "Comprehensive vector DB comparison",
      "qualityScore": 0.8
    }
  }
}
```

**Step 3: Complete**
```json
{
  "tool": "sequential_search",
  "params": {
    "sessionId": "<session-id>",
    "searchStep": "Research complete. Recommendation: Chroma for dev, Pinecone for production.",
    "stepNumber": 3,
    "totalStepsEstimate": 3,
    "nextStepNeeded": false
  }
}
```

**Expected Output** (on completion):
- `isComplete`: true
- `sources` array with all recorded sources
- `gaps` array with unresolved knowledge gaps

**Use Cases**:
- Complex investigations requiring 3+ searches
- Research with branching paths
- Investigations where you need to show reasoning
- Research you might abandon early

---

## Content Size Control

### Preview Mode
Get metadata without full content:

```json
{
  "tool": "scrape_page",
  "params": {
    "url": "https://example.com/large-article",
    "mode": "preview"
  }
}
```

### Limit Content Size
Prevent context exhaustion:

```json
{
  "tool": "search_and_scrape",
  "params": {
    "query": "detailed technical topic",
    "num_results": 5,
    "max_length_per_source": 10000,
    "total_max_length": 50000
  }
}
```

---

## Verification Checklist

Run these tests after any changes to verify functionality:

- [ ] `google_search` returns URLs
- [ ] `search_and_scrape` returns combined content with citations
- [ ] `scrape_page` extracts HTML content
- [ ] `scrape_page` extracts YouTube transcripts
- [ ] `google_news_search` returns recent articles
- [ ] `google_image_search` returns image URLs with metadata
- [ ] `academic_search` returns papers with BibTeX citations
- [ ] `patent_search` returns patents with PDF links
- [ ] `sequential_search` creates and completes sessions
- [ ] Content truncation works (`max_length` parameter)
- [ ] Preview mode returns metadata only

---

## Troubleshooting

### No Results
- Check API key is configured (`GOOGLE_API_KEY`, `GOOGLE_CSE_ID`)
- Verify query is not too restrictive
- Try broader search terms

### Content Truncated
- Use `max_length` to control size
- Check `truncated` flag in response
- Use `mode: "preview"` first to check size

### YouTube Transcript Fails
- Some videos don't have transcripts
- Auto-generated transcripts may have quality issues
- Check `contentType` in response

### Rate Limiting
- Default: 100 requests per minute
- Configurable via `RATE_LIMIT_*` env vars
- Check `stats://cache` resource for hit rates

---

## Example Real-World Workflows

### Technical Research
```
1. search_and_scrape("how does X work") - get overview
2. academic_search("X technical paper") - find authoritative sources
3. scrape_page(paper_url) - read full paper
```

### Competitive Analysis
```
1. google_news_search("company X announcement") - recent news
2. patent_search(assignee: "Company X") - IP landscape
3. search_and_scrape("Company X vs competitors") - analysis
```

### Fact-Checking
```
1. search_and_scrape("claim to verify") - find sources
2. Check quality scores and citations
3. academic_search for authoritative confirmation
```

### Content Creation
```
1. google_image_search("topic diagrams") - find visuals
2. search_and_scrape("topic explanation") - gather info
3. scrape_page(youtube_url) - extract video insights
```
