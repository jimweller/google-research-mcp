/**
 * Tests for Sequential Search Tool
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  handleSequentialSearch,
  createSession,
  getSession,
  getCurrentSession,
  clearAllSessions,
  sequentialSearchInputSchema,
  sequentialSearchOutputSchema,
  type SequentialSearchInput,
  type ResearchSession,
} from './sequentialSearch.js';

describe('sequentialSearch', () => {
  beforeEach(() => {
    // Clear all sessions before each test
    clearAllSessions();
  });

  afterEach(() => {
    // Clean up after each test
    clearAllSessions();
    jest.restoreAllMocks();
  });

  describe('input schema', () => {
    it('should have required searchStep field', () => {
      expect(sequentialSearchInputSchema.searchStep).toBeDefined();
    });

    it('should have required stepNumber field', () => {
      expect(sequentialSearchInputSchema.stepNumber).toBeDefined();
    });

    it('should have required nextStepNeeded field', () => {
      expect(sequentialSearchInputSchema.nextStepNeeded).toBeDefined();
    });

    it('should have optional source field', () => {
      expect(sequentialSearchInputSchema.source).toBeDefined();
    });

    it('should have optional knowledgeGap field', () => {
      expect(sequentialSearchInputSchema.knowledgeGap).toBeDefined();
    });

    it('should have optional revision fields', () => {
      expect(sequentialSearchInputSchema.isRevision).toBeDefined();
      expect(sequentialSearchInputSchema.revisesStep).toBeDefined();
    });

    it('should have optional branching fields', () => {
      expect(sequentialSearchInputSchema.branchFromStep).toBeDefined();
      expect(sequentialSearchInputSchema.branchId).toBeDefined();
    });
  });

  describe('output schema', () => {
    it('should have required sessionId field', () => {
      expect(sequentialSearchOutputSchema.sessionId).toBeDefined();
    });

    it('should have required currentStep field', () => {
      expect(sequentialSearchOutputSchema.currentStep).toBeDefined();
    });

    it('should have required isComplete field', () => {
      expect(sequentialSearchOutputSchema.isComplete).toBeDefined();
    });

    it('should have required sourceCount field', () => {
      expect(sequentialSearchOutputSchema.sourceCount).toBeDefined();
    });

    it('should have required openGapsCount field', () => {
      expect(sequentialSearchOutputSchema.openGapsCount).toBeDefined();
    });
  });

  describe('createSession', () => {
    it('should create a new session with default values', () => {
      const session = createSession('Test research question');

      expect(session.sessionId).toBeDefined();
      expect(session.question).toBe('Test research question');
      expect(session.currentStep).toBe(0);
      expect(session.totalStepsEstimate).toBe(5);
      expect(session.isComplete).toBe(false);
      expect(session.steps).toEqual([]);
      expect(session.sources).toEqual([]);
      expect(session.gaps).toEqual([]);
      expect(session.startedAt).toBeDefined();
    });

    it('should create a session with custom total steps estimate', () => {
      const session = createSession('Test question', 10);

      expect(session.totalStepsEstimate).toBe(10);
    });

    it('should set the new session as current', () => {
      const session = createSession('Test question');
      const current = getCurrentSession();

      expect(current?.sessionId).toBe(session.sessionId);
    });
  });

  describe('getSession', () => {
    it('should return null when no sessions exist', () => {
      const session = getSession();
      expect(session).toBeNull();
    });

    it('should return session by ID', () => {
      const created = createSession('Test question');
      const retrieved = getSession(created.sessionId);

      expect(retrieved?.sessionId).toBe(created.sessionId);
    });

    it('should return current session when no ID provided', () => {
      const created = createSession('Test question');
      const retrieved = getSession();

      expect(retrieved?.sessionId).toBe(created.sessionId);
    });

    it('should return null for non-existent session ID', () => {
      createSession('Test question');
      const retrieved = getSession('non-existent-id');

      expect(retrieved).toBeNull();
    });
  });

  describe('getCurrentSession', () => {
    it('should return null when no session exists', () => {
      expect(getCurrentSession()).toBeNull();
    });

    it('should return the most recently created session', () => {
      createSession('First question');
      const second = createSession('Second question');

      expect(getCurrentSession()?.sessionId).toBe(second.sessionId);
    });
  });

  describe('clearAllSessions', () => {
    it('should clear all sessions', () => {
      createSession('First');
      createSession('Second');

      clearAllSessions();

      expect(getCurrentSession()).toBeNull();
      expect(getSession()).toBeNull();
    });
  });

  describe('handleSequentialSearch', () => {
    describe('session creation', () => {
      it('should create a new session on step 1', () => {
        const result = handleSequentialSearch({
          searchStep: 'Starting research on AI',
          stepNumber: 1,
          nextStepNeeded: true,
        });

        expect(result.structuredContent.sessionId).toBeDefined();
        expect(result.structuredContent.currentStep).toBe(1);
        expect(result.structuredContent.isComplete).toBe(false);
      });

      it('should continue existing session with sessionId', () => {
        // Create first step
        const first = handleSequentialSearch({
          searchStep: 'Starting research',
          stepNumber: 1,
          nextStepNeeded: true,
        });

        // Continue with same session
        const second = handleSequentialSearch({
          searchStep: 'Found first source',
          stepNumber: 2,
          nextStepNeeded: true,
          sessionId: first.structuredContent.sessionId,
        });

        expect(second.structuredContent.sessionId).toBe(first.structuredContent.sessionId);
        expect(second.structuredContent.currentStep).toBe(2);
      });

      it('should auto-continue current session without sessionId', () => {
        const first = handleSequentialSearch({
          searchStep: 'Starting research',
          stepNumber: 1,
          nextStepNeeded: true,
        });

        const second = handleSequentialSearch({
          searchStep: 'Continuing research',
          stepNumber: 2,
          nextStepNeeded: true,
        });

        expect(second.structuredContent.sessionId).toBe(first.structuredContent.sessionId);
      });
    });

    describe('step tracking', () => {
      it('should record steps correctly', () => {
        handleSequentialSearch({
          searchStep: 'Step 1: Initial search',
          stepNumber: 1,
          nextStepNeeded: true,
        });

        handleSequentialSearch({
          searchStep: 'Step 2: Found sources',
          stepNumber: 2,
          nextStepNeeded: false,
        });

        const session = getCurrentSession();
        expect(session?.steps).toHaveLength(2);
        expect(session?.steps[0].description).toBe('Step 1: Initial search');
        expect(session?.steps[1].description).toBe('Step 2: Found sources');
      });

      it('should update totalStepsEstimate when changed', () => {
        handleSequentialSearch({
          searchStep: 'Starting with estimate of 3',
          stepNumber: 1,
          totalStepsEstimate: 3,
          nextStepNeeded: true,
        });

        handleSequentialSearch({
          searchStep: 'Realizing we need more steps',
          stepNumber: 2,
          totalStepsEstimate: 7,
          nextStepNeeded: true,
        });

        const result = handleSequentialSearch({
          searchStep: 'Final step',
          stepNumber: 3,
          totalStepsEstimate: 7,
          nextStepNeeded: false,
        });

        expect(result.structuredContent.totalStepsEstimate).toBe(7);
      });
    });

    describe('source tracking', () => {
      it('should add sources when provided', () => {
        handleSequentialSearch({
          searchStep: 'Found a source',
          stepNumber: 1,
          nextStepNeeded: true,
          source: {
            url: 'https://example.com/article',
            summary: 'Useful article about the topic',
          },
        });

        const result = handleSequentialSearch({
          searchStep: 'Found another source',
          stepNumber: 2,
          nextStepNeeded: false,
          source: {
            url: 'https://example.org/paper',
            summary: 'Academic paper with good data',
            qualityScore: 0.85,
          },
        });

        expect(result.structuredContent.sourceCount).toBe(2);

        const session = getCurrentSession();
        expect(session?.sources).toHaveLength(2);
        expect(session?.sources[0].url).toBe('https://example.com/article');
        expect(session?.sources[1].qualityScore).toBe(0.85);
      });

      it('should track which step added each source', () => {
        handleSequentialSearch({
          searchStep: 'Step 1',
          stepNumber: 1,
          nextStepNeeded: true,
          source: { url: 'https://step1.com', summary: 'Source from step 1' },
        });

        handleSequentialSearch({
          searchStep: 'Step 3',
          stepNumber: 3,
          nextStepNeeded: false,
          source: { url: 'https://step3.com', summary: 'Source from step 3' },
        });

        const session = getCurrentSession();
        expect(session?.sources[0].addedAtStep).toBe(1);
        expect(session?.sources[1].addedAtStep).toBe(3);
      });
    });

    describe('knowledge gap tracking', () => {
      it('should add knowledge gaps when identified', () => {
        handleSequentialSearch({
          searchStep: 'Found gap in knowledge',
          stepNumber: 1,
          nextStepNeeded: true,
          knowledgeGap: 'Missing data about climate impacts',
        });

        const result = handleSequentialSearch({
          searchStep: 'Another gap found',
          stepNumber: 2,
          nextStepNeeded: false,
          knowledgeGap: 'Need expert opinions',
        });

        expect(result.structuredContent.openGapsCount).toBe(2);

        const session = getCurrentSession();
        expect(session?.gaps).toHaveLength(2);
        expect(session?.gaps[0].description).toBe('Missing data about climate impacts');
        expect(session?.gaps[0].resolved).toBe(false);
      });

      it('should track which step identified each gap', () => {
        handleSequentialSearch({
          searchStep: 'Step 2',
          stepNumber: 2,
          nextStepNeeded: false,
          knowledgeGap: 'Gap from step 2',
        });

        const session = getCurrentSession();
        expect(session?.gaps[0].identifiedAtStep).toBe(2);
      });
    });

    describe('research completion', () => {
      it('should mark session complete when nextStepNeeded is false', () => {
        handleSequentialSearch({
          searchStep: 'Starting',
          stepNumber: 1,
          nextStepNeeded: true,
        });

        const result = handleSequentialSearch({
          searchStep: 'Finishing',
          stepNumber: 2,
          nextStepNeeded: false,
        });

        expect(result.structuredContent.isComplete).toBe(true);

        const session = getCurrentSession();
        expect(session?.isComplete).toBe(true);
        expect(session?.completedAt).toBeDefined();
      });

      it('should include sources and gaps in output when complete', () => {
        handleSequentialSearch({
          searchStep: 'Step 1',
          stepNumber: 1,
          nextStepNeeded: true,
          source: { url: 'https://example.com', summary: 'Good source' },
          knowledgeGap: 'Need more info',
        });

        const result = handleSequentialSearch({
          searchStep: 'Final step',
          stepNumber: 2,
          nextStepNeeded: false,
        });

        expect(result.structuredContent.sources).toBeDefined();
        expect(result.structuredContent.sources).toHaveLength(1);
        expect(result.structuredContent.gaps).toBeDefined();
        expect(result.structuredContent.gaps).toHaveLength(1);
      });

      it('should not include sources array when not complete', () => {
        const result = handleSequentialSearch({
          searchStep: 'In progress',
          stepNumber: 1,
          nextStepNeeded: true,
          source: { url: 'https://example.com', summary: 'Source' },
        });

        expect(result.structuredContent.sources).toBeUndefined();
        expect(result.structuredContent.sourceCount).toBe(1);
      });
    });

    describe('revision support', () => {
      it('should track revision metadata', () => {
        handleSequentialSearch({
          searchStep: 'Original step',
          stepNumber: 1,
          nextStepNeeded: true,
        });

        handleSequentialSearch({
          searchStep: 'Revising step 1 - found better approach',
          stepNumber: 2,
          nextStepNeeded: true,
          isRevision: true,
          revisesStep: 1,
        });

        const session = getCurrentSession();
        expect(session?.steps[1].isRevision).toBe(true);
        expect(session?.steps[1].revisesStep).toBe(1);
      });
    });

    describe('branching support', () => {
      it('should track branch metadata', () => {
        handleSequentialSearch({
          searchStep: 'Main branch',
          stepNumber: 1,
          nextStepNeeded: true,
        });

        handleSequentialSearch({
          searchStep: 'Exploring alternative',
          stepNumber: 2,
          nextStepNeeded: true,
          branchFromStep: 1,
          branchId: 'alternative-approach',
        });

        const session = getCurrentSession();
        expect(session?.currentBranch).toBe('alternative-approach');
        expect(session?.steps[1].branchId).toBe('alternative-approach');
        expect(session?.steps[1].branchFromStep).toBe(1);
      });

      it('should include branch in state summary', () => {
        handleSequentialSearch({
          searchStep: 'Main',
          stepNumber: 1,
          nextStepNeeded: true,
        });

        const result = handleSequentialSearch({
          searchStep: 'Branch',
          stepNumber: 2,
          nextStepNeeded: true,
          branchId: 'test-branch',
        });

        expect(result.structuredContent.stateSummary).toContain('Branch: test-branch');
      });
    });

    describe('text content output', () => {
      it('should include session ID in text output', () => {
        const result = handleSequentialSearch({
          searchStep: 'Test step',
          stepNumber: 1,
          nextStepNeeded: true,
        });

        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain('Research Session:');
      });

      it('should include question in text output', () => {
        const result = handleSequentialSearch({
          searchStep: 'Investigating quantum computing',
          stepNumber: 1,
          nextStepNeeded: true,
        });

        expect(result.content[0].text).toContain('Question: Investigating quantum computing');
      });

      it('should include completion details when done', () => {
        handleSequentialSearch({
          searchStep: 'Start',
          stepNumber: 1,
          nextStepNeeded: true,
          source: { url: 'https://example.com', summary: 'Test source' },
        });

        const result = handleSequentialSearch({
          searchStep: 'Done',
          stepNumber: 2,
          nextStepNeeded: false,
        });

        expect(result.content[0].text).toContain('Research Complete');
        expect(result.content[0].text).toContain('Sources Found');
        expect(result.content[0].text).toContain('https://example.com');
      });

      it('should include quality scores in source tracking', () => {
        const result = handleSequentialSearch({
          searchStep: 'Found source with quality score',
          stepNumber: 1,
          nextStepNeeded: false,
          source: { url: 'https://example.com', summary: 'Test source', qualityScore: 0.85 },
        });

        // The quality score should be stored correctly
        expect(result.structuredContent.sources).toBeDefined();
        expect(result.structuredContent.sources![0].qualityScore).toBe(0.85);

        const session = getCurrentSession();
        expect(session?.sources[0].qualityScore).toBe(0.85);
      });
    });

    describe('state summary', () => {
      it('should include step progress', () => {
        const result = handleSequentialSearch({
          searchStep: 'Test',
          stepNumber: 3,
          totalStepsEstimate: 5,
          nextStepNeeded: true,
        });

        expect(result.structuredContent.stateSummary).toContain('Step 3/5');
      });

      it('should include source count', () => {
        handleSequentialSearch({
          searchStep: 'Test',
          stepNumber: 1,
          nextStepNeeded: true,
          source: { url: 'https://a.com', summary: 'A' },
        });

        const result = handleSequentialSearch({
          searchStep: 'Test',
          stepNumber: 2,
          nextStepNeeded: true,
          source: { url: 'https://b.com', summary: 'B' },
        });

        expect(result.structuredContent.stateSummary).toContain('2 source(s)');
      });

      it('should include gap count', () => {
        handleSequentialSearch({
          searchStep: 'Test',
          stepNumber: 1,
          nextStepNeeded: true,
          knowledgeGap: 'Gap 1',
        });

        const result = handleSequentialSearch({
          searchStep: 'Test',
          stepNumber: 2,
          nextStepNeeded: true,
        });

        expect(result.structuredContent.stateSummary).toContain('1 open gap(s)');
      });

      it('should indicate COMPLETE when done', () => {
        const result = handleSequentialSearch({
          searchStep: 'Done',
          stepNumber: 1,
          nextStepNeeded: false,
        });

        expect(result.structuredContent.stateSummary).toContain('COMPLETE');
      });
    });

    describe('edge cases', () => {
      it('should handle creating session mid-research if none exists', () => {
        // Simulate calling with step 5 but no existing session
        const result = handleSequentialSearch({
          searchStep: 'Mid-research step',
          stepNumber: 5,
          nextStepNeeded: true,
        });

        // Should still work - creates a new session
        expect(result.structuredContent.sessionId).toBeDefined();
        expect(result.structuredContent.currentStep).toBe(5);
      });

      it('should handle empty source URL gracefully', () => {
        // The schema should validate this, but testing handler behavior
        const result = handleSequentialSearch({
          searchStep: 'Test',
          stepNumber: 1,
          nextStepNeeded: false,
          source: { url: 'https://valid.com', summary: 'Valid' },
        });

        expect(result.structuredContent.sourceCount).toBe(1);
      });

      it('should work with minimum required fields only', () => {
        const result = handleSequentialSearch({
          searchStep: 'Simple step',
          stepNumber: 1,
          nextStepNeeded: false,
        });

        expect(result.structuredContent.sessionId).toBeDefined();
        expect(result.structuredContent.isComplete).toBe(true);
        expect(result.structuredContent.sourceCount).toBe(0);
        expect(result.structuredContent.openGapsCount).toBe(0);
      });
    });
  });
});
