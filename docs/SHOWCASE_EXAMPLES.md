# Google Researcher MCP - Showcase Examples

Real-world examples demonstrating the capabilities of the Google Researcher MCP server. These examples show how AI assistants can leverage these tools for various research and information gathering tasks.

## Table of Contents

1. [Quick Information Lookup](#quick-information-lookup)
2. [Technical Research](#technical-research)
3. [Academic Research](#academic-research)
4. [Patent & IP Research](#patent--ip-research)
5. [News Monitoring](#news-monitoring)
6. [Visual Content Discovery](#visual-content-discovery)
7. [Multi-Source Research](#multi-source-research)
8. [Complex Investigation Workflows](#complex-investigation-workflows)
9. [Full Report Examples](#full-report-examples)

---

## Quick Information Lookup

### Example: "What are the latest Node.js LTS versions?"

**Tool:** `search_and_scrape`

```json
{
  "query": "Node.js LTS release schedule 2024",
  "num_results": 2,
  "filter_by_query": true
}
```

**Use Case:** Quick factual lookups where you need current, accurate information from authoritative sources.

---

### Example: "Summarize this documentation page"

**Tool:** `scrape_page`

```json
{
  "url": "https://docs.python.org/3/library/asyncio.html",
  "mode": "full",
  "max_length": 30000
}
```

**Use Case:** Extract and summarize technical documentation for developers.

---

## Technical Research

### Example: "How do I fix memory leaks in Node.js?"

**Tool:** `search_and_scrape`

```json
{
  "query": "Node.js memory leak detection debugging production",
  "num_results": 4,
  "deduplicate": true,
  "max_length_per_source": 15000
}
```

**Result:** Returns combined content from Stack Overflow, Medium articles, and official docs with proper citations.

---

### Example: "Find React hooks best practices on GitHub"

**Tool:** `google_search`

```json
{
  "query": "React hooks best practices",
  "site_search": "github.com",
  "num_results": 5
}
```

**Use Case:** Domain-specific searches to find code examples, discussions, or issues.

---

### Example: "What's in this YouTube tutorial?"

**Tool:** `scrape_page`

```json
{
  "url": "https://www.youtube.com/watch?v=abc123",
  "mode": "full"
}
```

**Result:** Extracts the video transcript, enabling:
- Summarization of video content
- Searching within video content
- Converting video tutorials to text guides

---

## Academic Research

### Example: "Find papers on transformer attention mechanisms"

**Tool:** `academic_search`

```json
{
  "query": "transformer self-attention mechanism neural networks",
  "num_results": 5,
  "year_from": 2020,
  "source": "arxiv"
}
```

**Result:**
```json
{
  "papers": [
    {
      "title": "Attention Is All You Need",
      "authors": ["Vaswani, A.", "Shazeer, N.", "..."],
      "year": 2017,
      "abstract": "We propose a new simple network architecture...",
      "pdfUrl": "https://arxiv.org/pdf/1706.03762.pdf",
      "citations": {
        "apa": "Vaswani, A. et al. (2017). Attention Is All You Need...",
        "bibtex": "@article{vaswani2017attention,..."
      }
    }
  ]
}
```

**Use Case:** Literature reviews, citation gathering, finding foundational papers.

---

### Example: "Get the full text of this research paper"

**Tool:** `scrape_page`

```json
{
  "url": "https://arxiv.org/pdf/1706.03762.pdf",
  "mode": "full"
}
```

**Result:** Extracts text from PDF including title, authors, abstract, and body content.

---

### Example: "Find medical research on a topic"

**Tool:** `academic_search`

```json
{
  "query": "CRISPR gene therapy clinical trials",
  "source": "pubmed",
  "year_from": 2022,
  "num_results": 5
}
```

**Use Case:** Medical/scientific research requiring peer-reviewed sources.

---

## Patent & IP Research

### Example: "Find prior art for video streaming technology"

**Tool:** `patent_search`

```json
{
  "query": "adaptive bitrate video streaming HTTP",
  "search_type": "prior_art",
  "num_results": 10
}
```

**Result:**
```json
{
  "patents": [
    {
      "title": "Apparatus for multi-bitrate content streaming",
      "patentNumber": "US7818444B2",
      "url": "https://patents.google.com/patent/US7818444B2",
      "pdfUrl": "https://patents.google.com/patent/US7818444B2/pdf",
      "abstract": "The invention relates to video streaming...",
      "patentOffice": "US"
    }
  ]
}
```

**Use Case:** Prior art searches, competitive intelligence, FTO analysis.

---

### Example: "Find patents by a specific company"

**Tool:** `patent_search`

```json
{
  "query": "video platform streaming",
  "assignee": "Netflix",
  "year_from": 2020,
  "num_results": 5
}
```

**Note:** The tool automatically tries company name variations (Netflix, NETFLIX, Netflix Inc, etc.)

---

### Example: "Search patents by CPC classification"

**Tool:** `patent_search`

```json
{
  "query": "machine learning",
  "cpc_code": "G06N",
  "patent_office": "US",
  "num_results": 5
}
```

**Use Case:** Technology landscape analysis within specific patent classifications.

---

## News Monitoring

### Example: "What's the latest news on AI regulations?"

**Tool:** `google_news_search`

```json
{
  "query": "artificial intelligence regulation law",
  "freshness": "week",
  "sort_by": "date",
  "num_results": 10
}
```

**Result:**
```json
{
  "articles": [
    {
      "title": "EU AI Act Implementation Timeline",
      "link": "https://...",
      "snippet": "The European Union's AI Act...",
      "source": "reuters.com",
      "publishedDate": "2024-..."
    }
  ]
}
```

---

### Example: "Breaking news from specific source"

**Tool:** `google_news_search`

```json
{
  "query": "technology",
  "freshness": "hour",
  "news_source": "techcrunch.com",
  "num_results": 5
}
```

**Use Case:** Real-time monitoring of specific news outlets.

---

## Visual Content Discovery

### Example: "Find architecture diagrams for microservices"

**Tool:** `google_image_search`

```json
{
  "query": "microservices architecture diagram",
  "type": "lineart",
  "size": "large",
  "num_results": 10
}
```

**Result:** Returns image URLs, thumbnails, dimensions, and source pages for diagrams.

---

### Example: "Find stock photos of data centers"

**Tool:** `google_image_search`

```json
{
  "query": "data center server room",
  "type": "photo",
  "size": "xlarge",
  "num_results": 5
}
```

---

## Multi-Source Research

### Example: "Comprehensive research on a technical topic"

**Tool:** `search_and_scrape`

```json
{
  "query": "Kubernetes horizontal pod autoscaling best practices production",
  "num_results": 5,
  "deduplicate": true,
  "include_sources": true,
  "total_max_length": 50000
}
```

**Result:** Combined, deduplicated content from multiple authoritative sources with full citations for each.

---

### Example: "Check page size before full fetch"

**Step 1:** Preview the page

```json
{
  "tool": "scrape_page",
  "input": {
    "url": "https://en.wikipedia.org/wiki/Artificial_intelligence",
    "mode": "preview"
  }
}
```

**Result:**
```json
{
  "preview": {
    "contentLength": 285000,
    "estimatedTokens": 71250,
    "sizeCategory": "very_large",
    "headings": ["History", "Goals", "Techniques", "..."],
    "excerpt": "Artificial intelligence (AI) is..."
  }
}
```

**Step 2:** Fetch with appropriate limits

```json
{
  "tool": "scrape_page",
  "input": {
    "url": "https://en.wikipedia.org/wiki/Artificial_intelligence",
    "mode": "full",
    "max_length": 20000
  }
}
```

---

## Complex Investigation Workflows

### Example: "Multi-step research with tracking"

**Use Case:** Investigating a complex topic that requires multiple searches and source evaluation.

**Step 1: Initialize research**
```json
{
  "tool": "sequential_search",
  "input": {
    "searchStep": "Starting investigation into WebAssembly security vulnerabilities",
    "stepNumber": 1,
    "totalStepsEstimate": 5,
    "nextStepNeeded": true
  }
}
```

**Step 2: Search and record findings**
```json
{
  "tool": "search_and_scrape",
  "input": {
    "query": "WebAssembly security vulnerabilities CVE",
    "num_results": 3
  }
}
```

```json
{
  "tool": "sequential_search",
  "input": {
    "sessionId": "...",
    "searchStep": "Found CVE database entries and security advisories",
    "stepNumber": 2,
    "source": {
      "url": "https://cve.mitre.org/...",
      "summary": "Official CVE entries for WASM vulnerabilities",
      "qualityScore": 0.95
    },
    "nextStepNeeded": true
  }
}
```

**Step 3: Academic perspective**
```json
{
  "tool": "academic_search",
  "input": {
    "query": "WebAssembly security analysis",
    "year_from": 2022
  }
}
```

```json
{
  "tool": "sequential_search",
  "input": {
    "sessionId": "...",
    "searchStep": "Found 3 academic papers analyzing WASM security model",
    "stepNumber": 3,
    "knowledgeGap": "Need industry best practices for mitigation",
    "nextStepNeeded": true
  }
}
```

**Step 4: Complete research**
```json
{
  "tool": "sequential_search",
  "input": {
    "sessionId": "...",
    "searchStep": "Research complete - compiled CVEs, academic analysis, and mitigation strategies",
    "stepNumber": 4,
    "nextStepNeeded": false
  }
}
```

---

## Tool Selection Guide

| Task | Recommended Tool |
|------|-----------------|
| Quick factual lookup | `search_and_scrape` |
| Get content from known URL | `scrape_page` |
| Find URLs to process later | `google_search` |
| Current events/news | `google_news_search` |
| Visual content | `google_image_search` |
| Academic/scholarly | `academic_search` |
| Patents/IP | `patent_search` |
| Complex multi-step | `sequential_search` + others |

---

## Full Report Examples

The following are complete reports generated by AI assistants using the Google Researcher MCP tools, demonstrating end-to-end research workflows:

### Patent Portfolio Analysis

**File:** [`examples/patent-portfolio-analysis-report.md`](examples/patent-portfolio-analysis-report.md)

A comprehensive patent portfolio analysis for an AI company, demonstrating how to combine `scrape_page`, `search_and_scrape`, and `patent_search` to:

- Discover all patents assigned to a company across jurisdictions
- Filter false matches from Google Patents keyword contamination
- Trace patent assignment chains (IBM -> Anthropic PBC)
- Identify pending applications from prosecution history cross-references
- Assess competitive positioning and portfolio gaps

**Tools used:** `scrape_page` (Google Patents pages), `search_and_scrape` (subsidiary/acquisition research), `patent_search` (structured discovery)

**Key technique:** Iterative multi-tool refinement -- each round of results informed more targeted queries, resolving ambiguous assignee naming and uncovering patents not visible through standard searches.

---

## Best Practices

1. **Start with `search_and_scrape`** for most research tasks - it combines search and content extraction efficiently.

2. **Use `preview` mode first** for large pages to check size before fetching full content.

3. **Leverage deduplication** when combining multiple sources to reduce noise.

4. **Use domain filters** (`site_search`) when you need results from specific authoritative sources.

5. **Track complex research** with `sequential_search` to maintain context across multiple queries.

6. **Use appropriate filters**:
   - `time_range` for current information
   - `year_from/year_to` for academic papers
   - `freshness` for news

7. **Respect rate limits** - results are cached for 30 minutes, so repeated queries are fast and free.
