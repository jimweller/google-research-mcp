/**
 * Tests for Patent Assignee Search Tool
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  handlePatentAssigneeSearch,
  type PatentAssigneeSearchInput,
} from './patentAssigneeSearch.js';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('patentAssigneeSearch', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('API key validation', () => {
    it('should return error when PATENTSVIEW_API_KEY is not set', async () => {
      delete process.env.PATENTSVIEW_API_KEY;

      const result = await handlePatentAssigneeSearch({
        assignee: 'Test Corp'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('API key required');
      expect(result.content[0].text).toContain('patentsview.org');
    });

    it('should proceed when PATENTSVIEW_API_KEY is set', async () => {
      process.env.PATENTSVIEW_API_KEY = 'test-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [],
          total_hits: 0
        })
      });

      const result = await handlePatentAssigneeSearch({
        assignee: 'Test Corp'
      });

      expect(result.isError).toBeUndefined();
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('input handling', () => {
    beforeEach(() => {
      process.env.PATENTSVIEW_API_KEY = 'test-key';
    });

    it('should search for assignee name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '12345678',
            patent_title: 'Test Patent',
            patent_date: '2023-01-15',
            patent_type: 'utility',
            applications: [{ app_date: '2021-01-15' }],
            assignees: [{ assignee_organization: 'Test Corp' }],
            inventors: [{ inventor_first_name: 'John', inventor_last_name: 'Doe' }],
            cpcs: [{ cpc_group_id: 'G06F' }]
          }],
          total_hits: 1
        })
      });

      const result = await handlePatentAssigneeSearch({
        assignee: 'Test Corp'
      });

      expect(result.structuredContent.assignee).toBe('Test Corp');
      expect(result.structuredContent.totalPatents).toBe(1);
      expect(result.structuredContent.patents).toHaveLength(1);
      expect(result.structuredContent.patents[0].patentNumber).toBe('12345678');
    });

    it('should handle pagination parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [],
          total_hits: 100
        })
      });

      const result = await handlePatentAssigneeSearch({
        assignee: 'Test Corp',
        page: 2,
        per_page: 50
      });

      expect(result.structuredContent.page).toBe(2);
      expect(result.structuredContent.totalPages).toBe(2);

      // Verify API was called with pagination options
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.o.size).toBe(50);
    });

    it('should enforce per_page maximum of 100', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [],
          total_hits: 0
        })
      });

      await handlePatentAssigneeSearch({
        assignee: 'Test Corp',
        per_page: 500 // Over limit
      });

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.o.size).toBe(100);
    });

    it('should apply date range filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [],
          total_hits: 0
        })
      });

      await handlePatentAssigneeSearch({
        assignee: 'Test Corp',
        date_from: '2020-01-01',
        date_to: '2023-12-31'
      });

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.q._and).toBeDefined();
    });

    it('should apply patent type filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [],
          total_hits: 0
        })
      });

      await handlePatentAssigneeSearch({
        assignee: 'Test Corp',
        patent_type: 'design'
      });

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(JSON.stringify(requestBody.q)).toContain('design');
    });
  });

  describe('patent status calculation', () => {
    beforeEach(() => {
      process.env.PATENTSVIEW_API_KEY = 'test-key';
    });

    it('should calculate active status for recent utility patents', async () => {
      const recentDate = new Date();
      recentDate.setFullYear(recentDate.getFullYear() - 5);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '12345678',
            patent_title: 'Recent Patent',
            patent_date: recentDate.toISOString().split('T')[0],
            patent_type: 'utility',
            applications: [{ app_date: recentDate.toISOString().split('T')[0] }],
            assignees: [{ assignee_organization: 'Test Corp' }],
            inventors: [],
            cpcs: []
          }],
          total_hits: 1
        })
      });

      const result = await handlePatentAssigneeSearch({
        assignee: 'Test Corp'
      });

      expect(result.structuredContent.patents[0].status).toBe('active');
    });

    it('should calculate expired status for old utility patents', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '5000000',
            patent_title: 'Old Patent',
            patent_date: '1995-01-15',
            patent_type: 'utility',
            applications: [{ app_date: '1993-01-15' }],
            assignees: [{ assignee_organization: 'Test Corp' }],
            inventors: [],
            cpcs: []
          }],
          total_hits: 1
        })
      });

      const result = await handlePatentAssigneeSearch({
        assignee: 'Test Corp'
      });

      expect(result.structuredContent.patents[0].status).toBe('expired');
    });

    it('should filter expired patents when include_expired is false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '5000000',
            patent_title: 'Old Patent',
            patent_date: '1995-01-15',
            patent_type: 'utility',
            applications: [{ app_date: '1993-01-15' }],
            assignees: [{ assignee_organization: 'Test Corp' }],
            inventors: [],
            cpcs: []
          }],
          total_hits: 1
        })
      });

      const result = await handlePatentAssigneeSearch({
        assignee: 'Test Corp',
        include_expired: false
      });

      expect(result.structuredContent.patents).toHaveLength(0);
    });
  });

  describe('summary aggregations', () => {
    beforeEach(() => {
      process.env.PATENTSVIEW_API_KEY = 'test-key';
    });

    it('should aggregate by patent type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [
            {
              patent_number: '1',
              patent_title: 'Utility 1',
              patent_date: '2023-01-15',
              patent_type: 'utility',
              applications: [{ app_date: '2021-01-15' }],
              assignees: [{ assignee_organization: 'Test' }],
              inventors: [],
              cpcs: []
            },
            {
              patent_number: '2',
              patent_title: 'Design 1',
              patent_date: '2023-02-15',
              patent_type: 'design',
              applications: [{ app_date: '2022-01-15' }],
              assignees: [{ assignee_organization: 'Test' }],
              inventors: [],
              cpcs: []
            }
          ],
          total_hits: 2
        })
      });

      const result = await handlePatentAssigneeSearch({
        assignee: 'Test Corp'
      });

      expect(result.structuredContent.summary.byType.utility).toBe(1);
      expect(result.structuredContent.summary.byType.design).toBe(1);
    });

    it('should aggregate by year', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [
            {
              patent_number: '1',
              patent_title: 'Patent 2023',
              patent_date: '2023-01-15',
              patent_type: 'utility',
              applications: [{ app_date: '2021-01-15' }],
              assignees: [{ assignee_organization: 'Test' }],
              inventors: [],
              cpcs: []
            },
            {
              patent_number: '2',
              patent_title: 'Patent 2022',
              patent_date: '2022-06-15',
              patent_type: 'utility',
              applications: [{ app_date: '2020-01-15' }],
              assignees: [{ assignee_organization: 'Test' }],
              inventors: [],
              cpcs: []
            }
          ],
          total_hits: 2
        })
      });

      const result = await handlePatentAssigneeSearch({
        assignee: 'Test Corp'
      });

      expect(result.structuredContent.summary.byYear['2023']).toBe(1);
      expect(result.structuredContent.summary.byYear['2022']).toBe(1);
    });

    it('should aggregate top CPC codes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [
            {
              patent_number: '1',
              patent_title: 'Patent 1',
              patent_date: '2023-01-15',
              patent_type: 'utility',
              applications: [{ app_date: '2021-01-15' }],
              assignees: [{ assignee_organization: 'Test' }],
              inventors: [],
              cpcs: [{ cpc_group_id: 'G06F' }]
            },
            {
              patent_number: '2',
              patent_title: 'Patent 2',
              patent_date: '2023-02-15',
              patent_type: 'utility',
              applications: [{ app_date: '2021-02-15' }],
              assignees: [{ assignee_organization: 'Test' }],
              inventors: [],
              cpcs: [{ cpc_group_id: 'G06F' }]
            },
            {
              patent_number: '3',
              patent_title: 'Patent 3',
              patent_date: '2023-03-15',
              patent_type: 'utility',
              applications: [{ app_date: '2021-03-15' }],
              assignees: [{ assignee_organization: 'Test' }],
              inventors: [],
              cpcs: [{ cpc_group_id: 'H04L' }]
            }
          ],
          total_hits: 3
        })
      });

      const result = await handlePatentAssigneeSearch({
        assignee: 'Test Corp'
      });

      expect(result.structuredContent.summary.topCpcCodes.length).toBeGreaterThan(0);
      expect(result.structuredContent.summary.topCpcCodes[0].code).toBe('G06F');
      expect(result.structuredContent.summary.topCpcCodes[0].count).toBe(2);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      process.env.PATENTSVIEW_API_KEY = 'test-key';
    });

    it('should handle rate limiting (HTTP 429)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded'
      });

      const result = await handlePatentAssigneeSearch({
        assignee: 'Test Corp'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('rate limit');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: 'Invalid query syntax'
        })
      });

      const result = await handlePatentAssigneeSearch({
        assignee: 'Test Corp'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid query syntax');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await handlePatentAssigneeSearch({
        assignee: 'Test Corp'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Network error');
    });

    it('should return empty results for unknown assignee', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [],
          total_hits: 0
        })
      });

      const result = await handlePatentAssigneeSearch({
        assignee: 'Nonexistent Company XYZ 12345'
      });

      expect(result.isError).toBeUndefined();
      expect(result.structuredContent.totalPatents).toBe(0);
      expect(result.structuredContent.patents).toHaveLength(0);
    });
  });

  describe('output formatting', () => {
    beforeEach(() => {
      process.env.PATENTSVIEW_API_KEY = 'test-key';
    });

    it('should include patent URLs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '12345678',
            patent_title: 'Test Patent',
            patent_date: '2023-01-15',
            patent_type: 'utility',
            applications: [{ app_date: '2021-01-15' }],
            assignees: [{ assignee_organization: 'Test Corp' }],
            inventors: [],
            cpcs: []
          }],
          total_hits: 1
        })
      });

      const result = await handlePatentAssigneeSearch({
        assignee: 'Test Corp'
      });

      const patent = result.structuredContent.patents[0];
      expect(patent.url).toContain('patents.google.com');
      expect(patent.patentsViewUrl).toContain('patentsview.org');
    });

    it('should extract inventors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '12345678',
            patent_title: 'Test Patent',
            patent_date: '2023-01-15',
            patent_type: 'utility',
            applications: [{ app_date: '2021-01-15' }],
            assignees: [{ assignee_organization: 'Test Corp' }],
            inventors: [
              { inventor_first_name: 'John', inventor_last_name: 'Doe' },
              { inventor_first_name: 'Jane', inventor_last_name: 'Smith' }
            ],
            cpcs: []
          }],
          total_hits: 1
        })
      });

      const result = await handlePatentAssigneeSearch({
        assignee: 'Test Corp'
      });

      expect(result.structuredContent.patents[0].inventors).toContain('John Doe');
      expect(result.structuredContent.patents[0].inventors).toContain('Jane Smith');
    });

    it('should determine technology area from CPC codes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '12345678',
            patent_title: 'Test Patent',
            patent_date: '2023-01-15',
            patent_type: 'utility',
            applications: [{ app_date: '2021-01-15' }],
            assignees: [{ assignee_organization: 'Test Corp' }],
            inventors: [],
            cpcs: [{ cpc_group_id: 'H04L' }]
          }],
          total_hits: 1
        })
      });

      const result = await handlePatentAssigneeSearch({
        assignee: 'Test Corp'
      });

      expect(result.structuredContent.patents[0].technologyArea).toBe('Electricity');
    });
  });
});
