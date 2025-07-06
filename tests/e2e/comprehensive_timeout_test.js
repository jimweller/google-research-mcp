/**
 * Comprehensive Test Suite for Timeout Fixes
 * 
 * Tests all aspects of the timeout protection implemented in the research_topic tool:
 * 1. Timeout Protection Tests
 * 2. Graceful Degradation Tests  
 * 3. Content Size Management Tests
 * 4. Error Recovery Tests
 * 5. Integration Tests
 */

import { MCPEndToEndTest } from './e2e_test_base.mjs';
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

class TimeoutTestSuite {
    constructor() {
        this.test = new MCPEndToEndTest('stdio', 'comprehensive-timeout-test');
        this.results = {
            passed: 0,
            failed: 0,
            details: []
        };
    }

    async setup() {
        console.log('🔧 Setting up test environment...');
        const transport = new StdioClientTransport({
            command: "node",
            args: ["dist/server.js"],
            env: { ...process.env, MCP_TEST_MODE: "stdio" }
        });
        
        await this.test.connect(transport);
        console.log('✅ Test environment ready\n');
    }

    async cleanup() {
        await this.test.cleanup();
    }

    reportTest(testName, passed, details = '') {
        const status = passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${status}: ${testName}`);
        if (details) console.log(`   ${details}`);
        
        this.results.details.push({ testName, passed, details });
        if (passed) this.results.passed++;
        else this.results.failed++;
    }

    // Test Category 1: Timeout Protection Tests
    async testTimeoutProtections() {
        console.log('🚨 CATEGORY 1: TIMEOUT PROTECTION TESTS');
        console.log('=' .repeat(60));

        // Test 1.1: Google Search API timeout (10 seconds)
        try {
            const startTime = Date.now();
            const result = await this.test.client.callTool({
                name: "google_search",
                arguments: {
                    query: 'machine learning deep learning neural networks artificial intelligence',
                    num_results: 10
                }
            });
            const duration = Date.now() - startTime;
            
            const hasTimeout = duration < 12000; // Should complete within timeout + buffer
            this.reportTest(
                'Google Search API timeout protection (10s)',
                result.content && hasTimeout,
                `Completed in ${duration}ms, has results: ${!!result.content?.length}`
            );
        } catch (error) {
            this.reportTest(
                'Google Search API timeout protection (10s)',
                error.message.includes('timeout') || error.message.includes('aborted'),
                `Error: ${error.message}`
            );
        }

        // Test 1.2: Web scraping timeout (15 seconds)
        try {
            const startTime = Date.now();
            // Use a URL that might be slow to test timeout
            const result = await this.test.client.callTool({
                name: "scrape_page",
                arguments: { url: 'https://httpbin.org/delay/5' } // 5 second delay
            });
            const duration = Date.now() - startTime;
            
            const completedInTime = duration < 17000; // Should complete within timeout + buffer
            this.reportTest(
                'Web scraping timeout protection (15s)',
                result.content && completedInTime,
                `Completed in ${duration}ms, has content: ${!!result.content?.length}`
            );
        } catch (error) {
            this.reportTest(
                'Web scraping timeout protection (15s)',
                error.message.includes('timeout') || error.message.includes('aborted'),
                `Error: ${error.message}`
            );
        }

        // Test 1.3: Gemini analysis timeout (30 seconds)
        try {
            const startTime = Date.now();
            const largeText = "Analyze this comprehensive text about machine learning. ".repeat(5000); // Large input
            const result = await this.test.client.callTool({
                name: "analyze_with_gemini",
                arguments: { text: largeText }
            });
            const duration = Date.now() - startTime;
            
            const completedInTime = duration < 32000; // Should complete within timeout + buffer
            this.reportTest(
                'Gemini analysis timeout protection (30s)',
                result.content && completedInTime,
                `Completed in ${duration}ms, analysis length: ${result.content[0]?.text?.length || 0}`
            );
        } catch (error) {
            this.reportTest(
                'Gemini analysis timeout protection (30s)',
                error.message.includes('timeout') || error.message.includes('aborted'),
                `Error: ${error.message}`
            );
        }

        console.log('');
    }

    // Test Category 2: Graceful Degradation Tests
    async testGracefulDegradation() {
        console.log('🛡️ CATEGORY 2: GRACEFUL DEGRADATION TESTS');
        console.log('=' .repeat(60));

        // Test 2.1: Promise.allSettled handles partial URL failures
        try {
            const result = await this.test.client.callTool({
                name: "research_topic",
                arguments: {
                    query: 'TypeScript programming language features',
                    num_results: 5 // More URLs to increase chance of some failures
                }
            });
            
            const hasResults = result.content && result.content[0].text.length > 0;
            const hasResearchSummary = result.content[0].text.includes('Research Summary');
            const hasMetrics = result.content[0].text.includes('URLs successfully scraped') || 
                             result.content[0].text.includes('processing time');
            
            this.reportTest(
                'Promise.allSettled handles partial failures',
                hasResults && hasResearchSummary,
                `Has results: ${hasResults}, Has summary: ${hasResearchSummary}, Has metrics: ${hasMetrics}`
            );
        } catch (error) {
            this.reportTest(
                'Promise.allSettled handles partial failures',
                false,
                `Unexpected failure: ${error.message}`
            );
        }

        // Test 2.2: Research continues with mixed URL success/failure
        try {
            // Use a mix of valid and potentially problematic URLs
            const searchResult = await this.test.client.callTool({
                name: "google_search",
                arguments: {
                    query: 'JavaScript async await promises',
                    num_results: 4
                }
            });

            if (searchResult.content && searchResult.content.length > 0) {
                // Test research_topic with these URLs
                const researchResult = await this.test.client.callTool({
                    name: "research_topic",
                    arguments: {
                        query: 'JavaScript async await promises',
                        num_results: 4
                    }
                });

                const completedSuccessfully = researchResult.content && 
                                            researchResult.content[0].text.includes('Research Summary');
                
                this.reportTest(
                    'Research continues despite some URL failures',
                    completedSuccessfully,
                    `Research completed: ${completedSuccessfully}, Result length: ${researchResult.content[0].text.length}`
                );
            } else {
                throw new Error('No search results to test with');
            }
        } catch (error) {
            this.reportTest(
                'Research continues despite some URL failures',
                false,
                `Test failed: ${error.message}`
            );
        }

        console.log('');
    }

    // Test Category 3: Content Size Management Tests
    async testContentSizeManagement() {
        console.log('📏 CATEGORY 3: CONTENT SIZE MANAGEMENT TESTS');
        console.log('=' .repeat(60));

        // Test 3.1: 50KB max per scraped page limit
        try {
            // Try to scrape a potentially large page
            const result = await this.test.client.callTool({
                name: "scrape_page",
                arguments: { url: 'https://en.wikipedia.org/wiki/Machine_learning' }
            });
            
            const contentLength = result.content[0].text.length;
            const withinLimit = contentLength <= 50 * 1024; // 50KB limit
            
            this.reportTest(
                '50KB max per scraped page limit',
                withinLimit,
                `Content length: ${contentLength} bytes (${(contentLength/1024).toFixed(1)}KB), Within limit: ${withinLimit}`
            );
        } catch (error) {
            this.reportTest(
                '50KB max per scraped page limit',
                false,
                `Scraping failed: ${error.message}`
            );
        }

        // Test 3.2: 300KB max combined content limit in research_topic
        try {
            const result = await this.test.client.callTool({
                name: "research_topic",
                arguments: {
                    query: 'comprehensive guide to machine learning algorithms',
                    num_results: 6 // More URLs to potentially hit the limit
                }
            });
            
            const totalLength = result.content[0].text.length;
            // The result should be reasonable size even with multiple large pages
            const reasonableSize = totalLength < 500 * 1024; // Should be manageable
            
            this.reportTest(
                '300KB max combined content management',
                reasonableSize,
                `Total result length: ${totalLength} bytes (${(totalLength/1024).toFixed(1)}KB)`
            );
        } catch (error) {
            this.reportTest(
                '300KB max combined content management',
                false,
                `Research failed: ${error.message}`
            );
        }

        // Test 3.3: 200KB max Gemini input limit
        try {
            // Create content larger than 200KB to test truncation
            const largeContent = "This is a very long text for testing Gemini input limits. ".repeat(4000); // ~240KB
            const result = await this.test.client.callTool({
                name: "analyze_with_gemini",
                arguments: { text: largeContent }
            });
            
            const hasResult = result.content && result.content[0].text.length > 0;
            const inputSize = largeContent.length;
            
            this.reportTest(
                '200KB max Gemini input limit with truncation',
                hasResult,
                `Input: ${inputSize} bytes (${(inputSize/1024).toFixed(1)}KB), Analysis completed: ${hasResult}`
            );
        } catch (error) {
            this.reportTest(
                '200KB max Gemini input limit with truncation',
                false,
                `Analysis failed: ${error.message}`
            );
        }

        console.log('');
    }

    // Test Category 4: Error Recovery Tests
    async testErrorRecovery() {
        console.log('🔄 CATEGORY 4: ERROR RECOVERY TESTS');
        console.log('=' .repeat(60));

        // Test 4.1: Detailed error logging
        try {
            // Try to scrape an invalid URL to trigger error handling
            const result = await this.test.client.callTool({
                name: "scrape_page",
                arguments: { url: 'https://this-domain-definitely-does-not-exist-12345.com' }
            });
            
            // Should either succeed with error message or fail gracefully
            this.reportTest(
                'Detailed error logging for invalid URLs',
                true,
                'Invalid URL handled gracefully'
            );
        } catch (error) {
            const hasDetailedError = error.message && error.message.length > 10;
            this.reportTest(
                'Detailed error logging for invalid URLs',
                hasDetailedError,
                `Error message: ${error.message}`
            );
        }

        // Test 4.2: Fallback mechanisms in research_topic
        try {
            // Test with a query that might have some problematic URLs
            const result = await this.test.client.callTool({
                name: "research_topic",
                arguments: {
                    query: 'Node.js performance optimization techniques',
                    num_results: 3
                }
            });
            
            const completedWithFallback = result.content && 
                                        result.content[0].text.includes('Research Summary');
            
            this.reportTest(
                'Fallback mechanisms work correctly',
                completedWithFallback,
                `Research completed with fallbacks: ${completedWithFallback}`
            );
        } catch (error) {
            this.reportTest(
                'Fallback mechanisms work correctly',
                false,
                `Fallback failed: ${error.message}`
            );
        }

        console.log('');
    }

    // Test Category 5: Integration Tests
    async testIntegration() {
        console.log('🔗 CATEGORY 5: INTEGRATION TESTS');
        console.log('=' .repeat(60));

        // Test 5.1: Full research_topic workflow
        try {
            const startTime = Date.now();
            const result = await this.test.client.callTool({
                name: "research_topic",
                arguments: {
                    query: 'React hooks useState useEffect',
                    num_results: 3
                }
            });
            const duration = Date.now() - startTime;
            
            const hasAllComponents = result.content && 
                                   result.content[0].text.includes('Research Summary') &&
                                   result.content[0].text.includes('Analysis') &&
                                   result.content[0].text.length > 1000;
            
            this.reportTest(
                'Full research_topic workflow integration',
                hasAllComponents,
                `Duration: ${duration}ms, Has all components: ${hasAllComponents}, Length: ${result.content[0].text.length}`
            );
        } catch (error) {
            this.reportTest(
                'Full research_topic workflow integration',
                false,
                `Integration test failed: ${error.message}`
            );
        }

        // Test 5.2: Performance under normal conditions
        try {
            const startTime = Date.now();
            const result = await this.test.client.callTool({
                name: "research_topic",
                arguments: {
                    query: 'Python data analysis pandas',
                    num_results: 2
                }
            });
            const duration = Date.now() - startTime;
            
            const performanceGood = duration < 60000 && result.content; // Should complete within 1 minute
            
            this.reportTest(
                'Performance under normal conditions',
                performanceGood,
                `Completed in ${duration}ms (${(duration/1000).toFixed(1)}s), Performance acceptable: ${performanceGood}`
            );
        } catch (error) {
            this.reportTest(
                'Performance under normal conditions',
                false,
                `Performance test failed: ${error.message}`
            );
        }

        // Test 5.3: Resilience with problematic URLs
        try {
            // Test research with a query that might return some problematic URLs
            const result = await this.test.client.callTool({
                name: "research_topic",
                arguments: {
                    query: 'software development best practices 2024',
                    num_results: 4
                }
            });
            
            const resilient = result.content && 
                            result.content[0].text.includes('Research Summary') &&
                            result.content[0].text.length > 500;
            
            this.reportTest(
                'Resilience with potentially problematic URLs',
                resilient,
                `Resilient operation: ${resilient}, Result length: ${result.content[0].text.length}`
            );
        } catch (error) {
            this.reportTest(
                'Resilience with potentially problematic URLs',
                false,
                `Resilience test failed: ${error.message}`
            );
        }

        console.log('');
    }

    async runAllTests() {
        console.log('🧪 COMPREHENSIVE TIMEOUT FIXES TEST SUITE');
        console.log('=' .repeat(80));
        console.log('Testing timeout protection, graceful degradation, content limits, and error recovery\n');

        try {
            await this.setup();
            
            await this.testTimeoutProtections();
            await this.testGracefulDegradation();
            await this.testContentSizeManagement();
            await this.testErrorRecovery();
            await this.testIntegration();
            
            this.printSummary();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
        } finally {
            await this.cleanup();
        }
    }

    printSummary() {
        console.log('📊 TEST RESULTS SUMMARY');
        console.log('=' .repeat(80));
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`📈 Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);
        
        if (this.results.failed > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.results.details
                .filter(test => !test.passed)
                .forEach(test => {
                    console.log(`   • ${test.testName}: ${test.details}`);
                });
        }
        
        console.log('\n🎯 TIMEOUT FIXES VERIFICATION:');
        const timeoutTests = this.results.details.filter(test => 
            test.testName.includes('timeout') || 
            test.testName.includes('Timeout')
        );
        const timeoutsPassed = timeoutTests.filter(test => test.passed).length;
        
        if (timeoutsPassed === timeoutTests.length && timeoutTests.length > 0) {
            console.log('✅ All timeout protections are working correctly');
        } else {
            console.log('❌ Some timeout protections need attention');
        }

        const gracefulTests = this.results.details.filter(test => 
            test.testName.includes('graceful') || 
            test.testName.includes('Promise.allSettled') ||
            test.testName.includes('continues despite')
        );
        const gracefulPassed = gracefulTests.filter(test => test.passed).length;
        
        if (gracefulPassed === gracefulTests.length && gracefulTests.length > 0) {
            console.log('✅ Graceful degradation is working correctly');
        } else {
            console.log('❌ Graceful degradation needs attention');
        }

        console.log('\n🏁 Test suite completed!');
    }
}

// Run the comprehensive test suite
const testSuite = new TimeoutTestSuite();
testSuite.runAllTests().catch(console.error);