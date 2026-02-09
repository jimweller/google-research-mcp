# Example Report: Patent Portfolio Analysis

> **Generated using:** Google Researcher MCP Server
> **Tools used:** `scrape_page`, `search_and_scrape`, `patent_search`, `google_search`
> **Date:** February 2026
> **Subject:** Anthropic, PBC patent portfolio

This report demonstrates how an AI assistant can combine multiple Google Researcher MCP tools to produce a comprehensive patent portfolio analysis. The workflow involved:

1. **`scrape_page`** on Google Patents to get the full patent list for the target company
2. **`search_and_scrape`** to find subsidiary/acquisition info and additional patent context
3. **`patent_search`** for structured patent discovery across offices
4. **`scrape_page`** on individual patent pages for detailed claims and inventor data
5. Iterative refinement using multiple queries to separate true assignee patents from false matches

---

## Tools & Queries Used

### Step 1: Initial Patent Discovery

```json
// scrape_page - Get full patent list from Google Patents
{
  "url": "https://patents.google.com/?assignee=Anthropic&oq=Anthropic",
  "max_length": 80000
}
```

```json
// patent_search - Structured landscape search
{
  "query": "Anthropic AI safety artificial intelligence",
  "assignee": "Anthropic",
  "num_results": 10,
  "search_type": "landscape"
}
```

### Step 2: Subsidiary & Acquisition Research

```json
// search_and_scrape - Find corporate relationships
{
  "query": "Anthropic subsidiaries acquisitions companies owned",
  "num_results": 5
}
```

### Step 3: Deep Dive on Individual Patents

```json
// scrape_page - Get full patent details including claims
{
  "url": "https://patents.google.com/patent/US12437238B1/en",
  "max_length": 50000
}
```

### Step 4: Sorted & Filtered Searches

```json
// scrape_page - Sorted by newest, exact assignee match
{
  "url": "https://patents.google.com/?assignee=%22Anthropic+Pbc%22&num=100&sort=new",
  "max_length": 80000
}
```

---

## Generated Report

### Executive Summary

Anthropic, PBC (Public Benefit Corporation) has a notably small patent portfolio relative to its $60B+ valuation and position as a leading AI frontier lab. As of February 2026, the portfolio consists of **3 distinct patent families** totaling approximately 12+ filed applications across multiple jurisdictions (US, WO, AU, CN, JP, DE, GB).

The patents originate from two sources:
1. **IBM acquisition** -- Two patent families covering ML optimization and private transfer learning, formally assigned to Anthropic in July 2025
2. **Adept AI acquisition (2024)** -- One patent family with multiple applications covering agentic AI and multimodal interface automation

Anthropic has not patented any of its core innovations (Constitutional AI, RLHF techniques, the Claude model architecture, or AI safety mechanisms). This represents both a philosophical choice and a strategic gap.

The most strategically valuable asset is Patent Family 3 (from Adept), which covers agentic AI workflows -- a rapidly growing market segment aligned with Anthropic's Claude computer use capabilities.

---

### Patent Portfolio Overview

| Metric | Value |
|--------|-------|
| Total Patent Families | 3 |
| Total Known Filings | ~12+ (across all jurisdictions) |
| Granted Patents | 3 (AU2020385049B2, AU2020369228B2, US12437238B1) |
| Pending Applications | ~8+ (US, WO, CN, JP, DE, GB) |
| Date Range | Priority: Oct 2019 -- Mar 2024 |
| Primary Assignee | Anthropic, PBC |
| Acquisition Sources | IBM (2 families), Adept AI (1 family) |

---

### Patents by Technology Area

| Technology Area | Families | Key Patents | CPC Classifications |
|-----------------|----------|-------------|---------------------|
| Agentic AI / UI Automation | 1 | US12437238B1, WO2025199330A1 | G06F16/951, G06N3/08 (17+ total) |
| ML Training Optimization | 1 | AU2020385049B2, US20220292401A1 | G06N20/00 |
| Secure/Private ML | 1 | AU2020369228B2, US11676011B2 | G06N3/08 |

---

### Complete Patent List

#### Family 1: ML Prediction Accuracy via Optimal Weighting

| # | Patent Number | Title | Status | Priority Date | Key Claims |
|---|--------------|-------|--------|---------------|------------|
| 1 | AU2020385049B2 | Identifying optimal weights to improve prediction accuracy in machine learning techniques | Granted (Feb 2023) | Nov 14, 2019 | Teacher-student model framework using RL to determine optimal data case weights; 25 claims |
| 2 | US20220292401A1 | (Same) | Published | Nov 14, 2019 | US national phase |
| 3 | WO, CN, JP, DE, GB | (Same) | Various | Nov 14, 2019 | International filings |

**Inventors:** Steven George Barbee, Si Er Han, Jing Xu, Ji Hui Yang, Xue Ying Zhang
**Origin:** Filed by IBM; assigned to Anthropic PBC on July 24, 2025

#### Family 2: Private Transfer Learning

| # | Patent Number | Title | Status | Priority Date | Key Claims |
|---|--------------|-------|--------|---------------|------------|
| 4 | AU2020369228B2 | Private transfer learning | Granted (Nov 2023) | Oct 24, 2019 | Encrypted ML model with training/inferencing APIs in trusted execution environment; 18 claims |
| 5 | US11676011B2 | (Same) | Granted | Oct 24, 2019 | US version |
| 6 | WO, CN, JP, GB | (Same) | Various | Oct 24, 2019 | International filings |

**Inventors:** Michael Amisano, John Behnken, Jeb Linton, John Melchionne, David Wright
**Origin:** Filed by IBM; assigned to Anthropic PBC on July 24, 2025

#### Family 3: Agentic AI Trajectories (Adept Acquisition)

| # | Patent Number | Title | Status | Priority Date | Key Claims |
|---|--------------|-------|--------|---------------|------------|
| 7 | US12437238B1 | Generation of agentic trajectories for training AI agents to automate multimodal interface task workflows | Granted (Oct 2025) | Mar 20, 2024 | System for intercepting user actions, generating training data for AI agents; 20 claims |
| 8 | US20250299098A1 | (Same -- pre-grant pub) | Published | Mar 20, 2024 | |
| 9 | WO2025199330A1 | Artificial intelligence agents for user interface task workflow automation | Published (Sep 2025) | Mar 20, 2024 | International filing |
| 10-14 | US18/909,068; 909,186; 909,455; 909,531; 909,588 | (Related applications) | Pending | Mar 20, 2024 | Office actions issued Dec 2024 -- Jan 2025 |

**Inventors:** Shaya Zarkesh, Lina Lukyantseva, Rohan Bavishi, David Luan, John Qian, Claire Pajot, Fred Bertsch, Erich Elsen, Curtis Hawthorne
**Origin:** Anthropic PBC filing using Adept AI technology. Claims priority from 8 provisional applications (ADPT1000-ADPT1007).

**Provisional Application Titles:**
- "Persimmon-8B" -- multimodal model architecture
- "Adventure of the Errant Hardware" -- infrastructure
- "Fuyu-8B: A Multimodal Architecture for AI Agents"
- "Adept Experiments"
- "Adept Fuyu-Heavy: A new multimodal model"
- "Adept Recorder" -- action recording system
- "Adept Workflow Language (AWL)" -- custom automation language
- "Adept Frankenmodel" -- model combination techniques

---

### Key Inventors

| Inventor | Patent Family | Primary Technologies |
|----------|-------------|---------------------|
| Shaya Zarkesh | Family 3 | Agentic AI, UI automation |
| Rohan Bavishi | Family 3 | Multimodal models (Fuyu) |
| David Luan | Family 3 | Adept co-founder; agentic workflows |
| Erich Elsen | Family 3 | Persimmon model, infrastructure |
| Curtis Hawthorne | Family 3 | Multimodal AI agents |
| Steven George Barbee | Family 1 | ML optimization (ex-IBM) |
| Michael Amisano | Family 2 | Private transfer learning (ex-IBM) |

---

### Competitive Positioning

**Strengths:**
- Agentic AI coverage (Family 3) aligns with a high-growth market segment
- Broad international filing strategy across 7+ jurisdictions
- Defensive IBM patents provide coverage in ML optimization and secure model deployment

**Weaknesses & Gaps:**
- 3 patent families is very small for a $60B+ company
- No patents on core innovations (Constitutional AI, RLHF, Claude architecture)
- No natively filed patents -- all acquired via IBM or Adept
- No patents from key founders/researchers (Dario Amodei, Daniela Amodei, etc.)
- Limited leverage in cross-licensing negotiations with Google, Microsoft, Meta

---

### Recommendations

1. **Develop a patent filing program for core technologies.** Published research on Constitutional AI, RLHF, model scaling, and interpretability represents unprotected patentable innovation.
2. **File continuation applications on Family 3.** The agentic AI patent is the strongest asset; additional continuations should cover new Claude computer use capabilities.
3. **Consider acquiring additional patent portfolios** for defensive depth.
4. **Monitor the 5 pending Adept-origin applications** currently under prosecution.
5. **Evaluate trade secret vs. patent strategy** for core model technologies.

---

## Research Methodology Notes

### Data Quality Observations

During this analysis, several data quality challenges were encountered:

- **Google Patents assignee search contamination:** Searching for `assignee:Anthropic` returned ~18 results, but ~83% were IBM patents appearing due to full-text keyword matching on the word "anthropic" (which has general English meaning). Careful filtering was required to identify true Anthropic-assigned patents.
- **Assignment chain complexity:** Patents originally filed by IBM with later assignment to Anthropic PBC required cross-referencing multiple jurisdictions to confirm the transfer.
- **Pending application discovery:** The granted US patent (US12437238B1) referenced related application numbers in its prosecution history, enabling discovery of 5 additional pending applications not visible through standard assignee searches.

### Tool Combination Strategy

The most effective approach combined:
1. **Broad discovery** via `scrape_page` on Google Patents search results
2. **Structured search** via `patent_search` for validation
3. **Deep analysis** via `scrape_page` on individual patent pages
4. **Contextual research** via `search_and_scrape` for corporate/acquisition background
5. **Iterative refinement** -- each round of results informed more targeted queries

This multi-tool, iterative approach is recommended for any patent portfolio analysis where assignee naming is ambiguous or where patent ownership has changed hands.
