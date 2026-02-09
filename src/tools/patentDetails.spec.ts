/**
 * Tests for Patent Details Tool
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  handlePatentDetails,
  type PatentDetailsInput,
} from './patentDetails.js';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('patentDetails', () => {
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

      const result = await handlePatentDetails({
        patent_id: '11886826'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('API key required');
    });
  });

  describe('patent number normalization', () => {
    beforeEach(() => {
      process.env.PATENTSVIEW_API_KEY = 'test-key';
    });

    it('should accept plain numeric patent numbers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '11886826',
            patent_title: 'Test Patent',
            patent_date: '2024-01-30',
            patent_type: 'utility',
            applications: [{ app_date: '2023-03-14' }],
            assignees: [{ assignee_organization: 'Test Corp' }],
            inventors: [{ inventor_first_name: 'John', inventor_last_name: 'Doe' }],
            cpcs: [{ cpc_group_id: 'G06F' }]
          }]
        })
      });

      const result = await handlePatentDetails({
        patent_id: '11886826'
      });

      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toHaveProperty('patent');
    });

    it('should normalize US prefix', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '11886826',
            patent_title: 'Test Patent',
            patent_date: '2024-01-30',
            patent_type: 'utility',
            applications: [{ app_date: '2023-03-14' }],
            assignees: [],
            inventors: [],
            cpcs: []
          }]
        })
      });

      await handlePatentDetails({
        patent_id: 'US11886826'
      });

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.q.patent_number).toBe('11886826');
    });

    it('should normalize kind code suffix', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '11886826',
            patent_title: 'Test Patent',
            patent_date: '2024-01-30',
            patent_type: 'utility',
            applications: [{ app_date: '2023-03-14' }],
            assignees: [],
            inventors: [],
            cpcs: []
          }]
        })
      });

      await handlePatentDetails({
        patent_id: 'US11886826B1'
      });

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.q.patent_number).toBe('11886826');
    });

    it('should reject invalid patent number format', async () => {
      const result = await handlePatentDetails({
        patent_id: 'invalid!!!'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid patent number format');
    });

    it('should reject too short patent numbers', async () => {
      const result = await handlePatentDetails({
        patent_id: '123'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid patent number format');
    });
  });

  describe('basic patent information', () => {
    beforeEach(() => {
      process.env.PATENTSVIEW_API_KEY = 'test-key';
    });

    it('should return patent title and abstract', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '11886826',
            patent_title: 'Systems and methods for language model-based text insertion',
            patent_abstract: 'Methods and systems for automatically generating text using language models.',
            patent_date: '2024-01-30',
            patent_type: 'utility',
            applications: [{ app_date: '2023-03-14' }],
            assignees: [],
            inventors: [],
            cpcs: []
          }]
        })
      });

      const result = await handlePatentDetails({
        patent_id: '11886826'
      });

      const patent = (result.structuredContent as { patent: { title: string; abstract: string } }).patent;
      expect(patent.title).toBe('Systems and methods for language model-based text insertion');
      expect(patent.abstract).toContain('language models');
    });

    it('should return filing and grant dates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '11886826',
            patent_title: 'Test Patent',
            patent_date: '2024-01-30',
            patent_type: 'utility',
            applications: [{ app_date: '2023-03-14' }],
            assignees: [],
            inventors: [],
            cpcs: []
          }]
        })
      });

      const result = await handlePatentDetails({
        patent_id: '11886826'
      });

      const patent = (result.structuredContent as { patent: { grantDate: string; filingDate: string } }).patent;
      expect(patent.grantDate).toBe('2024-01-30');
      expect(patent.filingDate).toBe('2023-03-14');
    });

    it('should calculate expiration date for utility patents', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '11886826',
            patent_title: 'Test Patent',
            patent_date: '2024-01-30',
            patent_type: 'utility',
            applications: [{ app_date: '2023-03-14' }],
            assignees: [],
            inventors: [],
            cpcs: []
          }]
        })
      });

      const result = await handlePatentDetails({
        patent_id: '11886826'
      });

      const patent = (result.structuredContent as { patent: { expirationDate: string; status: string } }).patent;
      expect(patent.expirationDate).toBe('2043-03-14'); // 20 years from filing
      expect(patent.status).toBe('active');
    });

    it('should calculate expired status for old patents', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '5000000',
            patent_title: 'Old Patent',
            patent_date: '1995-01-15',
            patent_type: 'utility',
            applications: [{ app_date: '1993-01-15' }],
            assignees: [],
            inventors: [],
            cpcs: []
          }]
        })
      });

      const result = await handlePatentDetails({
        patent_id: '5000000'
      });

      const patent = (result.structuredContent as { patent: { status: string } }).patent;
      expect(patent.status).toBe('expired');
    });
  });

  describe('assignee information', () => {
    beforeEach(() => {
      process.env.PATENTSVIEW_API_KEY = 'test-key';
    });

    it('should return assignee organization details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '11886826',
            patent_title: 'Test Patent',
            patent_date: '2024-01-30',
            patent_type: 'utility',
            applications: [{ app_date: '2023-03-14' }],
            assignees: [{
              assignee_organization: 'OpenAI Opco LLC',
              assignee_type: '2',
              assignee_city: 'San Francisco',
              assignee_state: 'CA',
              assignee_country: 'US'
            }],
            inventors: [],
            cpcs: []
          }]
        })
      });

      const result = await handlePatentDetails({
        patent_id: '11886826'
      });

      const patent = (result.structuredContent as { patent: { assignees: Array<{ name: string; type: string; location: { city: string; state: string; country: string } }> } }).patent;
      expect(patent.assignees).toHaveLength(1);
      expect(patent.assignees[0].name).toBe('OpenAI Opco LLC');
      expect(patent.assignees[0].type).toBe('US Company/Corporation');
      expect(patent.assignees[0].location.city).toBe('San Francisco');
    });

    it('should handle individual assignees', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '12345678',
            patent_title: 'Test Patent',
            patent_date: '2024-01-30',
            patent_type: 'utility',
            applications: [{ app_date: '2023-03-14' }],
            assignees: [{
              assignee_first_name: 'John',
              assignee_last_name: 'Inventor',
              assignee_type: '4',
              assignee_city: 'Boston',
              assignee_state: 'MA',
              assignee_country: 'US'
            }],
            inventors: [],
            cpcs: []
          }]
        })
      });

      const result = await handlePatentDetails({
        patent_id: '12345678'
      });

      const patent = (result.structuredContent as { patent: { assignees: Array<{ name: string }> } }).patent;
      expect(patent.assignees[0].name).toBe('John Inventor');
    });
  });

  describe('inventor information', () => {
    beforeEach(() => {
      process.env.PATENTSVIEW_API_KEY = 'test-key';
    });

    it('should return inventor details with locations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '11886826',
            patent_title: 'Test Patent',
            patent_date: '2024-01-30',
            patent_type: 'utility',
            applications: [{ app_date: '2023-03-14' }],
            assignees: [],
            inventors: [
              {
                inventor_first_name: 'Mohammad',
                inventor_last_name: 'Bavarian',
                inventor_city: 'San Francisco',
                inventor_state: 'CA',
                inventor_country: 'US'
              },
              {
                inventor_first_name: 'Heewoo',
                inventor_last_name: 'Jun',
                inventor_city: 'Palo Alto',
                inventor_state: 'CA',
                inventor_country: 'US'
              }
            ],
            cpcs: []
          }]
        })
      });

      const result = await handlePatentDetails({
        patent_id: '11886826'
      });

      const patent = (result.structuredContent as { patent: { inventors: Array<{ firstName: string; lastName: string; location: { city: string } }> } }).patent;
      expect(patent.inventors).toHaveLength(2);
      expect(patent.inventors[0].firstName).toBe('Mohammad');
      expect(patent.inventors[0].lastName).toBe('Bavarian');
      expect(patent.inventors[1].firstName).toBe('Heewoo');
    });
  });

  describe('CPC classification', () => {
    beforeEach(() => {
      process.env.PATENTSVIEW_API_KEY = 'test-key';
    });

    it('should return CPC codes with descriptions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '11886826',
            patent_title: 'Test Patent',
            patent_date: '2024-01-30',
            patent_type: 'utility',
            applications: [{ app_date: '2023-03-14' }],
            assignees: [],
            inventors: [],
            cpcs: [
              { cpc_group_id: 'G06F', cpc_category: 'inventional' },
              { cpc_group_id: 'G06N', cpc_category: 'inventional' }
            ]
          }]
        })
      });

      const result = await handlePatentDetails({
        patent_id: '11886826'
      });

      const patent = (result.structuredContent as { patent: { cpcCodes: Array<{ code: string; description: string; isPrimary: boolean }>; primaryTechnologyArea: string } }).patent;
      expect(patent.cpcCodes).toHaveLength(2);
      expect(patent.cpcCodes[0].code).toBe('G06F');
      expect(patent.cpcCodes[0].description).toBe('Physics');
      expect(patent.cpcCodes[0].isPrimary).toBe(true);
      expect(patent.primaryTechnologyArea).toBe('Physics');
    });
  });

  describe('citations', () => {
    beforeEach(() => {
      process.env.PATENTSVIEW_API_KEY = 'test-key';
    });

    it('should include citations when requested', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '11886826',
            patent_title: 'Test Patent',
            patent_date: '2024-01-30',
            patent_type: 'utility',
            patent_num_us_patents_cited: 10,
            patent_num_times_cited_by_us_patents: 5,
            applications: [{ app_date: '2023-03-14' }],
            assignees: [],
            inventors: [],
            cpcs: [],
            cited_patents: [
              { cited_patent_number: '10000001' },
              { cited_patent_number: '10000002' }
            ],
            citedby_patents: [
              { citedby_patent_number: '12000001' }
            ]
          }]
        })
      });

      const result = await handlePatentDetails({
        patent_id: '11886826',
        include_citations: true
      });

      const patent = (result.structuredContent as { patent: { citations: { citedByCount: number; citesCount: number; citedByPatents: string[]; citesPatents: string[] } } }).patent;
      expect(patent.citations).toBeDefined();
      expect(patent.citations.citedByCount).toBe(5);
      expect(patent.citations.citesCount).toBe(10);
      expect(patent.citations.citesPatents).toContain('10000001');
      expect(patent.citations.citedByPatents).toContain('12000001');
    });

    it('should not include citations by default', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '11886826',
            patent_title: 'Test Patent',
            patent_date: '2024-01-30',
            patent_type: 'utility',
            applications: [{ app_date: '2023-03-14' }],
            assignees: [],
            inventors: [],
            cpcs: []
          }]
        })
      });

      const result = await handlePatentDetails({
        patent_id: '11886826'
      });

      const patent = (result.structuredContent as { patent: { citations?: unknown } }).patent;
      expect(patent.citations).toBeUndefined();
    });
  });

  describe('claims', () => {
    beforeEach(() => {
      process.env.PATENTSVIEW_API_KEY = 'test-key';
    });

    it('should include claims when requested', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '11886826',
            patent_title: 'Test Patent',
            patent_date: '2024-01-30',
            patent_type: 'utility',
            applications: [{ app_date: '2023-03-14' }],
            assignees: [],
            inventors: [],
            cpcs: [],
            claims: [
              { claim_sequence: 1, claim_text: 'A method comprising...', claim_dependent: '0' },
              { claim_sequence: 2, claim_text: 'The method of claim 1...', claim_dependent: '1' }
            ]
          }]
        })
      });

      const result = await handlePatentDetails({
        patent_id: '11886826',
        include_claims: true
      });

      const patent = (result.structuredContent as { patent: { claims: Array<{ number: number; text: string; isIndependent: boolean }> } }).patent;
      expect(patent.claims).toBeDefined();
      expect(patent.claims).toHaveLength(2);
      expect(patent.claims[0].number).toBe(1);
      expect(patent.claims[0].isIndependent).toBe(true);
      expect(patent.claims[1].isIndependent).toBe(false);
    });
  });

  describe('URLs', () => {
    beforeEach(() => {
      process.env.PATENTSVIEW_API_KEY = 'test-key';
    });

    it('should include all relevant URLs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: [{
            patent_number: '11886826',
            patent_title: 'Test Patent',
            patent_date: '2024-01-30',
            patent_type: 'utility',
            applications: [{ app_date: '2023-03-14' }],
            assignees: [],
            inventors: [],
            cpcs: []
          }]
        })
      });

      const result = await handlePatentDetails({
        patent_id: '11886826'
      });

      const patent = (result.structuredContent as { patent: { url: string; pdfUrl: string; patentsViewUrl: string; googlePatentsUrl: string } }).patent;
      expect(patent.url).toContain('patents.google.com');
      expect(patent.pdfUrl).toContain('pdf');
      expect(patent.patentsViewUrl).toContain('patentsview.org');
      expect(patent.googlePatentsUrl).toContain('patents.google.com');
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      process.env.PATENTSVIEW_API_KEY = 'test-key';
    });

    it('should handle patent not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          patents: []
        })
      });

      const result = await handlePatentDetails({
        patent_id: '99999999999'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });

    it('should handle rate limiting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded'
      });

      const result = await handlePatentDetails({
        patent_id: '11886826'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('rate limit');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await handlePatentDetails({
        patent_id: '11886826'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Connection refused');
    });
  });
});
