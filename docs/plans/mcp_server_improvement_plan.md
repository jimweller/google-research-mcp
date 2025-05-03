# MCP Server Improvement Plan

## Introduction

This document outlines a plan to enhance the capabilities of the `google-researcher-mcp` server based on user feedback and potential future needs. The goal is to make the research tools more robust, verifiable, controllable, and useful for various downstream tasks.

## Improvement Areas

### 1. Source Attribution & Verification

*   **Suggested Capability:** Modify `research_topic` (and potentially `analyze_with_gemini`) to optionally return a list of source URLs used to generate the summary or analysis.
*   **Proposed Changes:**
    *   Add an optional boolean parameter `include_sources` to the `research_topic` and `analyze_with_gemini` tool schemas (default: `false`).
    *   If `include_sources` is `true`, the tool's response JSON should include a new field, e.g., `sources: ["url1", "url2", ...]`.
    *   The underlying implementation will need to track the URLs used during the research and analysis phases.
*   **Benefit:** Increases trustworthiness and allows users or agents to verify information, check for conflicting sources, or delve deeper into specific points.

### 2. Controlling Research Depth & Focus

*   **Suggested Capability:** Add parameters to `research_topic` to control the scope and detail level of the research.
*   **Proposed Changes:**
    *   Add an optional `focus` parameter (string enum, e.g., `"general"`, `"core_architecture"`, `"security_practices"`, `"recent_updates"`, `"comparison"`) to the `research_topic` schema.
    *   Add an optional `depth` parameter (string enum, e.g., `"summary"`, `"detailed"`, `"comprehensive"`) to the `research_topic` schema.
    *   The implementation will need to adjust the search queries, the amount of content scraped/analyzed, and the final summarization prompt based on these parameters.
*   **Benefit:** Allows for more targeted research, saving tokens and time. Prevents overly broad or unnecessarily detailed summaries.

### 3. Structured Data Extraction

*   **Suggested Capability:** Add a new tool or mode to extract information into a specific JSON schema provided in the request.
*   **Proposed Changes:**
    *   Introduce a new tool, tentatively named `extract_structured_data`.
    *   Input schema for `extract_structured_data`:
        *   `text_content`: The source text to extract from.
        *   `target_schema`: A JSON schema defining the desired output structure.
        *   `extraction_prompt` (optional): Specific instructions for the LLM performing the extraction.
    *   Alternatively, modify `analyze_with_gemini` to accept an optional `target_schema` parameter. If provided, the tool would attempt to format its analysis according to the schema instead of returning free text.
*   **Benefit:** Facilitates programmatic consumption of research results by other tools or agents. Enables reliable extraction of specific data points.

### 4. Handling Failed Sources

*   **Suggested Capability:** Modify `research_topic` to report failed source URLs and provide options for handling partial data.
*   **Proposed Changes:**
    *   Add an optional boolean parameter `report_failed_sources` to the `research_topic` schema (default: `false`).
    *   Add an optional enum parameter `on_source_failure` (e.g., `"fail_request"`, `"proceed_partial"`) (default: `"proceed_partial"`).
    *   If `report_failed_sources` is `true`, the response JSON should include a new field, e.g., `failed_sources: ["url3", "url4", ...]`.
    *   The implementation needs to track scraping/analysis errors per source and act according to the `on_source_failure` parameter.
*   **Benefit:** Increases transparency and robustness. Helps diagnose incomplete summaries and allows for more resilient workflows.

### 5. Recency Filtering/Weighting

*   **Suggested Capability:** Add options to filter search results by recency and prioritize newer information.
*   **Proposed Changes:**
    *   Add an optional `recency_filter` parameter (string enum, e.g., `"any"`, `"past_year"`, `"past_6_months"`, `"past_month"`) to the `google_search` tool schema (default: `"any"`). The underlying Google Search API call needs to be adjusted.
    *   Modify `research_topic` to potentially use this `google_search` parameter.
    *   Consider adding logic within `research_topic` or `analyze_with_gemini` to explicitly mention the age of sources or give more weight to recent information during analysis, possibly controlled by another optional parameter.
*   **Benefit:** Ensures information is up-to-date, crucial for rapidly evolving topics like technology protocols and security practices.

## Next Steps

1.  Prioritize these features based on expected impact and implementation effort.
2.  Refine the proposed parameter names and schemas.
3.  Create specific implementation tasks for each feature.
4.  Update the MCP server codebase and documentation.