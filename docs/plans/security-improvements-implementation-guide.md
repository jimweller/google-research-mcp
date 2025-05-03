# Security Improvements Implementation Guide: Google Researcher MCP Server

**Date:** April 22, 2025
**Version:** 1.0
**Author:** Roo (Docs Writer Mode)

## Table of Contents

1.  [Executive Summary](#1-executive-summary)
2.  [High Risk Findings & Implementation Guidelines](#2-high-risk-findings--implementation-guidelines)
    *   [2.1 SSRF Protection for `scrape_page` Tool](#21-ssrf-protection-for-scrape_page-tool)
    *   [2.2 Secure Cache Admin Endpoint Authorization](#22-secure-cache-admin-endpoint-authorization)
    *   [2.3 Secure API Key Management](#23-secure-api-key-management)
3.  [Medium Risk Findings & Implementation Guidelines](#3-medium-risk-findings--implementation-guidelines)
    *   [3.1 Secure All Management Endpoints](#31-secure-all-management-endpoints)
    *   [3.2 Secure CORS Configuration](#32-secure-cors-configuration)
    *   [3.3 Enable Event Store Encryption](#33-enable-event-store-encryption)
    *   [3.4 Implement Rate Limiting](#34-implement-rate-limiting)
4.  [Low Risk Findings & Implementation Guidelines](#4-low-risk-findings--implementation-guidelines)
    *   [4.1 Review Information Disclosure via Statistics](#41-review-information-disclosure-via-statistics)
    *   [4.2 Implement Dependency Scanning](#42-implement-dependency-scanning)
    *   [4.3 Enhance Security Logging](#43-enhance-security-logging)
    *   [4.4 Timing Attacks (Awareness)](#44-timing-attacks-awareness)
5.  [Implementation Roadmap](#5-implementation-roadmap)
6.  [Potential Challenges & Mitigations](#6-potential-challenges--mitigations)
7.  [Troubleshooting Guide](#7-troubleshooting-guide)
8.  [References & Resources](#8-references--resources)

---

## 1. Executive Summary

This document outlines the implementation plan for addressing security vulnerabilities identified during a review of the Google Researcher MCP Server codebase. The review highlighted several areas requiring attention, particularly concerning input validation (SSRF), authentication/authorization for management endpoints, secrets management, and secure configuration.

Addressing the **High Risk** findings is paramount:

*   Implementing robust SSRF protection for the `scrape_page` tool.
*   Securing management endpoints with strong authentication and authorization.
*   Adopting secure practices for managing API keys and other secrets.

**Medium Risk** findings, such as securing CORS, enabling encryption for stored events, and implementing rate limiting, should also be prioritized to harden the server against common web attacks and potential abuse.

**Low Risk** findings, including enhancing logging and dependency management, contribute to overall security posture and incident response capabilities.

This guide provides detailed steps, code examples, and considerations for implementing these security improvements effectively.

---

## 2. High Risk Findings & Implementation Guidelines

### 2.1 SSRF Protection for `scrape_page` Tool

**Finding:** The `scrape_page` tool lacks sufficient validation to prevent Server-Side Request Forgery (SSRF), potentially allowing requests to internal network resources.

**Location:** `src/server.ts` (lines 188, 304-306)

**Impact:** Information disclosure, interaction with internal services, cloud metadata access.

**Implementation Guidelines:**

1.  **Install an SSRF Protection Library:** Use a dedicated library designed to prevent SSRF attacks. `ssrf-req-filter` is a potential option.
    ```bash
    npm install ssrf-req-filter
    ```

2.  **Implement Strict URL Validation:** Create a validation function that checks protocols, denies private/reserved IP addresses, and potentially enforces domain allowlists.

    ```typescript
    // src/shared/urlValidator.ts (New File)
    import { Filter } from 'ssrf-req-filter';
    import dns from 'node:dns/promises';

    const ssrfFilter = new Filter({
      // Allowed protocols (adjust as needed)
      allowedProtocols: ['http', 'https'],
      // Deny private IP ranges (RFC 1918, loopback, link-local)
      // Filter automatically handles these common ranges
      // You can add more specific deny rules if needed
    });

    export async function validateExternalUrl(url: string): Promise<{ valid: boolean; reason?: string }> {
      try {
        const parsedUrl = new URL(url);

        // Basic protocol check (redundant with filter but good practice)
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          return { valid: false, reason: 'Only HTTP and HTTPS protocols are allowed' };
        }

        // Resolve hostname to IP address for filtering
        // Handle potential errors during DNS resolution
        let ipAddress: string;
        try {
          const lookupResult = await dns.lookup(parsedUrl.hostname);
          ipAddress = lookupResult.address;
        } catch (dnsError) {
          console.warn(`DNS lookup failed for ${parsedUrl.hostname}:`, dnsError);
          // Decide policy: fail open (allow if DNS fails) or fail closed (deny)
          // Failing closed is generally safer
          return { valid: false, reason: `DNS lookup failed for hostname: ${parsedUrl.hostname}` };
        }

        // Use ssrf-req-filter to check the resolved IP
        if (!ssrfFilter.check(ipAddress)) {
           return { valid: false, reason: `Resolved IP address ${ipAddress} is not allowed` };
        }

        // Optional: Domain allowlist check
        const ALLOWED_DOMAINS = process.env.ALLOWED_SCRAPE_DOMAINS?.split(',') || [];
        if (ALLOWED_DOMAINS.length > 0 && !ALLOWED_DOMAINS.some(domain => parsedUrl.hostname.endsWith(domain))) {
          return { valid: false, reason: 'Domain not in allowlist' };
        }

        return { valid: true };
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('Invalid URL')) {
           return { valid: false, reason: 'Invalid URL format' };
        }
        console.error('Unexpected error during URL validation:', error);
        return { valid: false, reason: 'Internal validation error' };
      }
    }
    ```

3.  **Integrate Validation into `scrape_page` Tool:** Modify the tool handler in `src/server.ts` to call the validator before proceeding.

    ```typescript
    // src/server.ts (Inside configureToolsAndResources)
    import { validateExternalUrl } from '../shared/urlValidator.js'; // Adjust path

    // ... inside scrapePageFn or the tool registration ...
    server.tool(
      "scrape_page",
      { url: z.string().url() }, // Keep Zod for basic format validation
      async ({ url }) => {
        // Perform SSRF validation
        const validationResult = await validateExternalUrl(url);
        if (!validationResult.valid) {
          // Log the attempt for security monitoring
          console.warn(`SSRF attempt blocked for URL: ${url}. Reason: ${validationResult.reason}`);
          // Throw a user-friendly error
          throw new Error(`Invalid or disallowed URL provided. Reason: ${validationResult.reason}`);
        }

        // If valid, proceed with scraping
        console.log(`URL validated, proceeding with scrape: ${url}`); // Add logging
        const content = await scrapePageFn({ url }); // Assuming scrapePageFn contains the actual scraping logic
        return { content };
      }
    );
    ```

4.  **Configure HTTP Client Timeouts:** Set reasonable timeouts for the underlying HTTP clients used by `CheerioCrawler` and `youtube-transcript` (if possible) to prevent resource exhaustion from slow external servers. Limit redirects.

    ```typescript
    // Example for CheerioCrawler (inside scrapePageFn)
    const crawler = new CheerioCrawler({
      // ... requestHandler ...
      requestHandlerTimeoutSecs: 30, // Timeout for the handler itself
      navigationTimeoutSecs: 60,    // Timeout for page navigation/loading
      maxRequestRetries: 2,         // Limit retries
      maxRedirects: 5             // Limit redirects
    });
    ```

5.  **Consider Network Isolation:** For maximum security, run the scraping logic in a separate, network-isolated container or service with strict egress rules.

### 2.2 Secure Cache Admin Endpoint Authorization

**Finding:** The `/mcp/cache-invalidate` endpoint relies on a potentially weak static API key (`CACHE_ADMIN_KEY`).

**Location:** `src/server.ts` (lines 688-695), `.env.example` (line 21)

**Impact:** Denial of Service, increased costs, potential cache manipulation.

**Implementation Guidelines:**

1.  **Mandate Strong Admin Key:** Ensure the `CACHE_ADMIN_KEY` environment variable is set to a strong, unpredictable, randomly generated value in production. Update documentation to emphasize this.

2.  **Implement Robust Authentication Middleware:** Replace the static key check with a standard, secure authentication mechanism. Options include:
    *   **JWT (JSON Web Tokens):** Suitable if a separate authentication service exists or can be added. Requires secure key management for signing.
    *   **Session-Based Authentication:** Requires managing server-side sessions (e.g., using `express-session` with a secure store).
    *   **mTLS (Mutual TLS):** Provides strong authentication if clients can manage certificates.

    **Example using JWT Middleware:**

    ```bash
    npm install jsonwebtoken express-bearer-token
    # Add @types/jsonwebtoken if needed
    ```

    ```typescript
    // src/middleware/authAdmin.ts (New File)
    import bearerToken from 'express-bearer-token';
    import jwt from 'jsonwebtoken';

    const JWT_SECRET = process.env.ADMIN_JWT_SECRET; // MUST be set securely
    const JWT_ISSUER = process.env.ADMIN_JWT_ISSUER || 'mcp-server-admin';
    const REQUIRED_ROLE = 'cache-admin'; // Define a specific role/scope

    if (!JWT_SECRET) {
      console.error('FATAL: ADMIN_JWT_SECRET environment variable is not set.');
      // Potentially exit in production if JWT auth is mandatory
      // process.exit(1);
    }

    export const authenticateAdmin = [
      bearerToken(), // Extracts token from Authorization: Bearer header
      (req: any, res: any, next: any) => {
        if (!JWT_SECRET) {
           // Handle case where secret is missing but server didn't exit
           console.error('Admin JWT secret not configured, denying access.');
           return res.status(500).json({ error: 'Server configuration error' });
        }
        if (!req.token) {
          return res.status(401).json({ error: 'Unauthorized: Authentication token required' });
        }

        try {
          const decoded = jwt.verify(req.token, JWT_SECRET, {
            issuer: JWT_ISSUER,
            algorithms: ['HS256'] // Specify expected algorithm
          }) as any; // Type assertion, consider defining a proper type

          // Check for required role/scope/permission
          if (!decoded.roles || !decoded.roles.includes(REQUIRED_ROLE)) {
             console.warn(`Forbidden access attempt: User ${decoded.sub} lacks role ${REQUIRED_ROLE}`);
             return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
          }

          // Attach user info for potential logging downstream
          req.adminUser = { id: decoded.sub, roles: decoded.roles };
          next();

        } catch (error) {
          if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: 'Unauthorized: Token expired' });
          }
          if (error instanceof jwt.JsonWebTokenError) {
             console.warn(`Invalid admin token received: ${error.message}`);
             return res.status(401).json({ error: 'Unauthorized: Invalid token' });
          }
          console.error('Unexpected error during admin authentication:', error);
          return res.status(500).json({ error: 'Internal server error' });
        }
      }
    ];
    ```

    ```typescript
    // src/server.ts (Apply middleware)
    import { authenticateAdmin } from './middleware/authAdmin.js'; // Adjust path

    // Apply to the invalidate endpoint
    app.post("/mcp/cache-invalidate", authenticateAdmin, (req: Request, res: Response) => {
      // Handler logic...
    });

    // Apply to other admin endpoints (see 3.1)
    app.get("/mcp/cache-stats", authenticateAdmin, /* ... */);
    app.get("/mcp/event-store-stats", authenticateAdmin, /* ... */);
    app.post("/mcp/cache-persist", authenticateAdmin, /* ... */);
    app.get("/mcp/cache-persist", authenticateAdmin, /* ... */);
    ```

3.  **Add IP Address Whitelisting:** As an additional layer, restrict access to management endpoints to specific trusted IP addresses.

    ```typescript
    // src/middleware/ipWhitelist.ts (New File)
    export function ipWhitelistAdmin(req: any, res: any, next: any) {
      const ALLOWED_IPS = process.env.ADMIN_ALLOWED_IPS?.split(',') || [];
      // Ensure loopback is allowed for local testing/management
      const defaultAllowed = ['127.0.0.1', '::1'];
      const whitelist = [...new Set([...defaultAllowed, ...ALLOWED_IPS])]; // Combine and deduplicate

      // Get client IP, considering proxies
      const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

      if (!whitelist.includes(clientIp)) {
        console.warn(`Forbidden access attempt to admin endpoint from IP: ${clientIp}`);
        return res.status(403).json({ error: 'Forbidden: Access denied from this IP address' });
      }
      next();
    }
    ```

    ```typescript
    // src/server.ts (Apply middleware)
    import { ipWhitelistAdmin } from './middleware/ipWhitelist.js'; // Adjust path

    // Apply *before* authentication middleware
    app.post("/mcp/cache-invalidate", ipWhitelistAdmin, authenticateAdmin, /* ... */);
    // Apply to other admin endpoints as well...
    ```

### 2.3 Secure API Key Management

**Finding:** Critical API keys are managed via environment variables / `.env` files, risking exposure.

**Location:** `.env.example`, `src/server.ts` (lines 66-75, 690)

**Impact:** Unauthorized API usage, increased costs, potential account compromise.

**Implementation Guidelines:**

1.  **Use a Secrets Management System:** Integrate with a dedicated service (e.g., HashiCorp Vault, AWS Secrets Manager, Google Secret Manager, Azure Key Vault) for storing and retrieving secrets in production.

    **Example using Google Secret Manager:**

    ```bash
    npm install @google-cloud/secret-manager
    ```

    ```typescript
    // src/config/secrets.ts (New File)
    import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

    const client = new SecretManagerServiceClient();
    const projectId = process.env.GOOGLE_CLOUD_PROJECT; // Ensure this is set

    async function getSecretValue(secretId: string): Promise<string> {
      if (!projectId) {
        throw new Error('GOOGLE_CLOUD_PROJECT environment variable not set.');
      }
      const name = `projects/${projectId}/secrets/${secretId}/versions/latest`;
      try {
        console.log(`Accessing secret: ${name}`); // Log attempt
        const [version] = await client.accessSecretVersion({ name });
        if (!version.payload?.data) {
          throw new Error(`Secret payload for ${secretId} is empty.`);
        }
        const secretValue = version.payload.data.toString('utf8');
        console.log(`Successfully retrieved secret: ${secretId}`); // Log success
        return secretValue;
      } catch (error) {
        console.error(`Failed to access secret ${secretId}:`, error);
        // Consider more specific error handling or fallback mechanisms
        throw new Error(`Failed to retrieve secret: ${secretId}`);
      }
    }

    export async function loadSecrets(): Promise<Record<string, string>> {
      // List of secret IDs stored in Secret Manager
      const secretIds = [
        'google-custom-search-api-key', // Use descriptive IDs in Secret Manager
        'google-custom-search-id',
        'google-gemini-api-key',
        'cache-admin-key', // Optional, depending on auth method
        'admin-jwt-secret' // If using JWT for admin auth
      ];

      const secrets: Record<string, string> = {};
      for (const id of secretIds) {
        // Map Secret Manager ID to environment variable name convention if needed
        const envVarName = id.toUpperCase().replace(/-/g, '_');
        try {
           secrets[envVarName] = await getSecretValue(id);
        } catch (error) {
           // Decide how to handle missing secrets - fail fast or allow partial loading?
           console.error(`Could not load secret ${id}. Server might not function correctly.`);
           // For critical secrets, consider throwing the error:
           // throw error;
        }
      }
      return secrets;
    }
    ```

    ```typescript
    // src/server.ts (Load secrets during startup)
    import { loadSecrets } from './config/secrets.js'; // Adjust path

    async function start() {
      try {
        // Load secrets before initializing components that need them
        const secrets = await loadSecrets();

        // Option 1: Set process.env (less ideal, but works with existing code)
        // Object.assign(process.env, secrets);

        // Option 2: Pass secrets directly to components (preferred)
        const googleSearchApiKey = secrets['GOOGLE_CUSTOM_SEARCH_API_KEY'];
        // ... get other secrets ...

        // Initialize components with secrets
        // e.g., initializeGeminiClient(googleGeminiApiKey);
        // e.g., initializeExpressApp(cacheAdminKey, adminJwtSecret);

        // Validate required secrets are loaded
        if (!googleSearchApiKey /* || other critical secrets */) {
           throw new Error("Missing critical API keys from secrets manager.");
        }

        // Proceed with server setup...
        const app = createApp({ /* pass secrets if needed */ });
        // ... listen ...

      } catch (error) {
        console.error('FATAL: Failed to initialize server due to secret loading error:', error);
        process.exit(1);
      }
    }

    start();
    ```

2.  **Strict Access Control:** Ensure the runtime environment (server, container) has minimal privileges, only granting access to the required secrets in the management system. Use service accounts with least-privilege IAM roles.

3.  **`.gitignore`:** Double-check that `.env` files and any local secret files are listed in `.gitignore`.

4.  **Key Rotation:** Establish a process for regularly rotating API keys and secrets stored in the management system. Automate this process if possible.

---

## 3. Medium Risk Findings & Implementation Guidelines

### 3.1 Secure All Management Endpoints

**Finding:** Endpoints like `/mcp/cache-stats`, `/mcp/event-store-stats`, and `GET /mcp/cache-persist` lack authentication.

**Location:** `src/server.ts` (lines 596, 634, 746)

**Impact:** Information disclosure, potential minor DoS.

**Implementation Guidelines:**

*   Apply the same robust authentication middleware (e.g., `authenticateAdmin` from section 2.2.1) and IP whitelisting (section 2.2.2) to *all* management endpoints (`/mcp/*`).

    ```typescript
    // src/server.ts
    import { authenticateAdmin } from './middleware/authAdmin.js';
    import { ipWhitelistAdmin } from './middleware/ipWhitelist.js';

    // Apply to all management endpoints
    app.get("/mcp/cache-stats", ipWhitelistAdmin, authenticateAdmin, /* ... */);
    app.get("/mcp/event-store-stats", ipWhitelistAdmin, authenticateAdmin, /* ... */);
    app.post("/mcp/cache-invalidate", ipWhitelistAdmin, authenticateAdmin, /* ... */);
    app.post("/mcp/cache-persist", ipWhitelistAdmin, authenticateAdmin, /* ... */);
    app.get("/mcp/cache-persist", ipWhitelistAdmin, authenticateAdmin, /* ... */);
    ```

### 3.2 Secure CORS Configuration

**Finding:** Default CORS configuration allows requests from any origin (`*`), which is insecure for production.

**Location:** `src/server.ts` (lines 76-78, 419-426)

**Impact:** Allows untrusted websites to interact with the API from a user's browser.

**Implementation Guidelines:**

1.  **Explicit Allowlist:** Define the specific origins (frontend domains) that are allowed to access the API in the `ALLOWED_ORIGINS` environment variable for production deployments. Separate multiple origins with commas.

    ```bash
    # Example .env for production
    ALLOWED_ORIGINS=https://your-trusted-frontend.com,https://another-trusted-app.com
    ```

2.  **Refine Server Configuration:** Ensure the server code correctly parses and uses the allowlist, and avoids defaulting to `*` in production.

    ```typescript
    // src/server.ts
    const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
    let allowedOriginsList: string[] = [];

    if (allowedOriginsEnv) {
      allowedOriginsList = allowedOriginsEnv.split(',').map(s => s.trim()).filter(Boolean);
    }

    // Fallback for development, but restrict in production if not set
    if (allowedOriginsList.length === 0 && process.env.NODE_ENV !== 'development') {
      console.warn('WARNING: No ALLOWED_ORIGINS specified in production. CORS will be highly restricted.');
      // Optionally set a very restrictive default or leave empty to deny most cross-origin requests
      // allowedOriginsList = ['https://emergency-access-origin.com'];
    } else if (allowedOriginsList.length === 0 && process.env.NODE_ENV === 'development') {
       console.log('Development mode: Allowing default localhost origins for CORS.');
       // Add common development origins
       allowedOriginsList = ['http://localhost:3000', 'http://127.0.0.1:3000', /* add other dev ports */];
    }

    app.use(
      cors({
        origin: (origin, callback) => {
          // Allow requests with no origin (like mobile apps or curl requests)
          if (!origin) return callback(null, true);

          if (allowedOriginsList.indexOf(origin) !== -1) {
            callback(null, true); // Origin is allowed
          } else {
            console.warn(`CORS: Blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS')); // Origin is not allowed
          }
        },
        methods: ["GET", "POST", "DELETE"], // Be specific
        allowedHeaders: ["Content-Type", "Mcp-Session-Id", "Accept", "Authorization"], // Include Authorization if using JWT
        exposedHeaders: ["Mcp-Session-Id"],
        credentials: true // If you need to handle cookies or authorization headers
      })
    );
    ```

### 3.3 Enable Event Store Encryption

**Finding:** Event data stored on disk by `PersistentEventStore` might be in plaintext if encryption is not explicitly enabled.

**Location:** `src/shared/persistentEventStore.ts`, `src/shared/types/eventStore.ts`

**Impact:** Disclosure of potentially sensitive session data if disk storage is compromised.

**Implementation Guidelines:**

1.  **Enable Encryption:** Configure the `PersistentEventStore` with encryption options in `src/server.ts`.

    ```typescript
    // src/server.ts (Inside HTTP+SSE setup)
    import { PersistentEventStore } from "./shared/persistentEventStore.js";
    import { getSecretValue } from './config/secrets.js'; // Assuming secrets management

    // ... inside app.post('/mcp') for new sessions ...

    // Retrieve encryption key securely
    let eventStoreEncryptionKey: Buffer | undefined;
    try {
      const keyString = await getSecretValue('event-store-encryption-key'); // Get key from secrets manager
      eventStoreEncryptionKey = Buffer.from(keyString, 'hex'); // Assuming key is stored as hex
      if (eventStoreEncryptionKey.length !== 32) { // Validate key length for aes-256-gcm
         throw new Error('Invalid event store encryption key length.');
      }
    } catch (error) {
       console.error('FATAL: Could not load event store encryption key. Encryption disabled.', error);
       // Decide whether to proceed without encryption or exit
    }

    const eventStore = new PersistentEventStore({
      storagePath: opts.eventPath || path.resolve(__dirname, '..', 'storage', 'event_store'),
      // ... other options ...
      encryption: {
        enabled: !!eventStoreEncryptionKey, // Enable only if key was loaded successfully
        keyProvider: async () => {
          if (!eventStoreEncryptionKey) {
             // This should ideally not happen if enabled is false, but handle defensively
             throw new Error('Encryption key is not available.');
          }
          return eventStoreEncryptionKey;
        },
        algorithm: 'aes-256-gcm' // Default, but explicit is good
      },
      // ... accessControl, auditLog options ...
    });
    ```

2.  **Secure Key Management:** Store the encryption key securely using the secrets management system (see section 2.3.1). Ensure the key has appropriate entropy (e.g., 32 bytes for AES-256).

3.  **Key Rotation:** Implement a strategy for rotating the event store encryption key. This is more complex as it requires re-encrypting existing data or handling multiple keys during decryption. Consider strategies like:
    *   **Versioned Keys:** Store a key version identifier with the encrypted data and retrieve the corresponding key for decryption.
    *   **Periodic Re-encryption:** A background process reads, decrypts with the old key, and re-encrypts with the new key.

### 3.4 Implement Rate Limiting

**Finding:** The application lacks rate limiting, making it vulnerable to DoS attacks via resource exhaustion.

**Location:** `src/server.ts` (Express routes)

**Impact:** Service unavailability, increased costs.

**Implementation Guidelines:**

1.  **Install Rate Limiting Middleware:** Use a library like `express-rate-limit`.

    ```bash
    npm install express-rate-limit
    ```

2.  **Apply Rate Limiting:** Configure and apply the middleware to relevant routes in `src/server.ts`.

    ```typescript
    // src/server.ts
    import rateLimit from 'express-rate-limit';

    // Configure rate limiter for general API usage
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP, please try again after 15 minutes',
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
      keyGenerator: (req) => {
         // Use IP address as the key
         return req.ip || req.socket.remoteAddress;
      }
    });

    // Configure stricter rate limiter for sensitive/expensive operations (e.g., admin actions, scraping)
    const sensitiveActionLimiter = rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 100, // Limit each IP to 100 sensitive actions per hour
      message: 'Too many sensitive actions from this IP, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
       keyGenerator: (req) => req.ip || req.socket.remoteAddress
    });

    // Apply general limiter to all /mcp routes
    app.use('/mcp', apiLimiter);

    // Apply stricter limiter specifically to admin or expensive routes
    // Note: Apply *before* the general limiter if you want it to take precedence for these routes
    app.post("/mcp/cache-invalidate", sensitiveActionLimiter, /* ipWhitelist, authenticateAdmin, */ /* ... */);
    // Consider applying sensitiveActionLimiter to scrape_page if abuse is a concern

    // Apply general limiter to other routes if necessary
    app.use('/events', apiLimiter);
    ```

3.  **Consider Session/User-Based Limiting:** If user authentication is implemented for general API usage, consider keying the rate limiter on session ID or user ID for more granular control.

---

## 4. Low Risk Findings & Implementation Guidelines

### 4.1 Review Information Disclosure via Statistics

**Finding:** Statistics endpoints expose detailed internal metrics.

**Impact:** Minor information disclosure aiding reconnaissance.

**Implementation Guidelines:**

*   Ensure robust authentication is applied to these endpoints (see section 3.1).
*   Review the level of detail exposed. If necessary, create different "views" of the stats based on user roles (e.g., a less detailed view for general monitoring, full details for administrators). This requires implementing role-based access control within the endpoint handlers.

### 4.2 Implement Dependency Scanning

**Finding:** Potential vulnerabilities in third-party dependencies.

**Impact:** Varies, potentially severe.

**Implementation Guidelines:**

1.  **Regular Scanning:** Integrate automated dependency scanning into the CI/CD pipeline using tools like:
    *   `npm audit` (built-in)
    *   GitHub Dependabot alerts and security updates
    *   Snyk
    *   OWASP Dependency-Check

2.  **Update Policy:** Establish a policy for reviewing and applying dependency updates regularly, prioritizing security patches.

    ```bash
    # Run audit regularly
    npm audit

    # Fix vulnerabilities automatically (use with caution, test thoroughly)
    # npm audit fix --force
    ```

### 4.3 Enhance Security Logging

**Finding:** Limited dedicated logging for security-relevant events.

**Impact:** Difficulty in detecting and responding to security incidents.

**Implementation Guidelines:**

1.  **Enable Event Store Audit Logging:** Configure and enable the `auditLog` feature of `PersistentEventStore`.

    ```typescript
    // src/config/auditLogger.ts (New File - Example using console)
    import { AuditEvent } from '../shared/types/eventStore.js'; // Adjust path

    // Replace with a proper logging library (e.g., Winston, Pino) sending to a secure log aggregator
    export async function logAuditEvent(event: AuditEvent): Promise<void> {
      console.log(`AUDIT: ${JSON.stringify(event)}`);
      // In production, send to a dedicated logging service/file
      // e.g., await productionLogger.info('AUDIT', event);
    }
    ```

    ```typescript
    // src/server.ts (Configure PersistentEventStore)
    import { logAuditEvent } from './config/auditLogger.js'; // Adjust path

    const eventStore = new PersistentEventStore({
      // ... other options ...
      auditLog: {
        enabled: true,
        logger: logAuditEvent
      }
    });
    ```

2.  **Implement Application-Level Security Logging:** Add specific log entries for security-sensitive actions throughout the application:
    *   Authentication successes and failures (especially for admin endpoints).
    *   Authorization failures.
    *   Detected SSRF attempts (even if blocked).
    *   Rate limit triggers.
    *   Significant configuration changes loaded.
    *   Errors during cryptographic operations.

    Use a structured logging format (e.g., JSON) and include relevant context (timestamp, user ID, source IP, event type, outcome).

    ```typescript
    // Example security log entry
    // logger.warn({ event: 'auth_failure', type: 'admin_login', ip: req.ip, reason: 'invalid_token' });
    ```

3.  **Centralize Logs:** Ship logs from the application and infrastructure to a centralized, secure log management system (e.g., ELK stack, Splunk, Datadog) for analysis and alerting.

### 4.4 Timing Attacks (Awareness)

**Finding:** Theoretical possibility of timing attacks against crypto/cache operations.

**Impact:** Extremely low likelihood of practical exploitation.

**Implementation Guidelines:**

*   **No Immediate Action Required:** Rely on the constant-time implementations provided by Node.js's `node:crypto` module. Standard cache lookups are generally not considered a significant timing attack vector in this context.
*   **Awareness:** Keep this potential vector in mind if implementing custom cryptographic routines or highly sensitive lookups in the future.

---

## 5. Implementation Roadmap

A suggested prioritization for implementing these changes:

1.  **Phase 1 (Critical - Address Immediately):**
    *   Implement SSRF Protection (2.1)
    *   Secure Cache Admin Endpoint (2.2 - Start with strong key, plan for robust auth)
    *   Secure API Key Management (2.3 - Use secrets manager in production)
    *   Secure CORS Configuration (3.2 - Set explicit allowlist for production)
    *   Secure All Management Endpoints (3.1 - Apply initial strong key auth)

2.  **Phase 2 (High Priority):**
    *   Implement Robust Authentication for Admin Endpoints (2.2 - JWT/Session/mTLS)
    *   Enable Event Store Encryption (3.3 - Requires secure key management)
    *   Implement Rate Limiting (3.4)
    *   Implement Dependency Scanning (4.2 - Set up automated checks)

3.  **Phase 3 (Medium Priority):**
    *   Enhance Security Logging (4.3 - Enable audit logs, add specific app logs)
    *   Review Information Disclosure via Statistics (4.1 - Assess after auth is added)

4.  **Phase 4 (Ongoing):**
    *   Regular Dependency Updates (4.2)
    *   Regular Key Rotation (2.3)
    *   Monitor Logs and Alerts (4.3)

---

## 6. Potential Challenges & Mitigations

*   **SSRF Library Compatibility:** Ensure chosen SSRF libraries work correctly with the application's asynchronous nature and DNS resolution strategy.
    *   *Mitigation:* Thoroughly test the validation logic with various valid and malicious URLs, including IP addresses and domains requiring DNS lookups.
*   **Secrets Management Integration:** Setting up and integrating a secrets management system adds complexity to deployment and local development.
    *   *Mitigation:* Use tools like `dotenv` for local development secrets (clearly documented as dev-only), provide clear setup instructions, and use infrastructure-as-code for managing secrets infrastructure.
*   **Admin Authentication Implementation:** Choosing and implementing a robust authentication system (JWT, sessions) requires careful design and secure key/session management.
    *   *Mitigation:* Leverage well-vetted libraries (e.g., `jsonwebtoken`, `express-session`), follow security best practices for key/session storage, and consider using existing identity providers if available.
*   **Event Store Key Rotation:** Rotating the event store encryption key without downtime or data loss is complex.
    *   *Mitigation:* Plan the rotation strategy carefully (versioned keys or background re-encryption). Implement thoroughly and test extensively before applying in production. Start with encryption enabled using the initial key.
*   **Rate Limiting Tuning:** Finding the right balance for rate limits requires monitoring and adjustment to avoid blocking legitimate users while preventing abuse.
    *   *Mitigation:* Start with conservative limits, monitor logs for legitimate blocks, and adjust thresholds based on observed traffic patterns. Consider different limits for different user types or endpoints.
*   **Performance Impact:** Some security measures (e.g., stricter validation, encryption, robust authentication) might introduce minor performance overhead.
    *   *Mitigation:* Profile the application before and after changes. Optimize critical paths. Ensure caching strategies remain effective.

---

## 7. Troubleshooting Guide

*   **SSRF Blocking Legitimate URLs:**
    *   Check `validateExternalUrl` logic, especially DNS resolution and IP range checks.
    *   Verify the `ALLOWED_SCRAPE_DOMAINS` environment variable if used.
    *   Inspect logs for the specific reason the URL was blocked.
*   **Admin Endpoint Access Denied (401/403):**
    *   Verify the authentication token (JWT validity, expiry, signature, required roles).
    *   Check the IP whitelist configuration (`ADMIN_ALLOWED_IPS`).
    *   Ensure the `ADMIN_JWT_SECRET` matches between token generation and verification.
    *   Check server logs for detailed authentication/authorization errors.
*   **Secrets Not Loading:**
    *   Verify permissions/roles of the service account accessing the secrets manager.
    *   Check that secret names/IDs match between the code and the secrets manager.
    *   Ensure `GOOGLE_CLOUD_PROJECT` (or equivalent for other providers) is correctly set.
    *   Check network connectivity between the server and the secrets management service.
*   **CORS Errors:**
    *   Verify the `ALLOWED_ORIGINS` environment variable exactly matches the `Origin` header sent by the browser (including protocol, domain, and port).
    *   Check the browser's developer console for specific CORS error messages.
    *   Ensure the `cors` middleware is configured correctly in `src/server.ts`.
*   **Event Store Decryption Errors:**
    *   Verify the correct encryption key is being provided by the `keyProvider`.
    *   Ensure the key format (e.g., hex, base64) matches between storage and retrieval.
    *   Check that the algorithm (`aes-256-gcm`) and IV/authTag handling are correct.
    *   Consider potential data corruption in the stored event files.
*   **Legitimate Users Being Rate Limited:**
    *   Review the rate limit configuration (`windowMs`, `max`).
    *   Check logs to identify which users/IPs are hitting the limit.
    *   Consider increasing limits or using a more granular key (e.g., user ID + IP).

---

## 8. References & Resources

*   **OWASP Top 10:** [https://owasp.org/www-project-top-ten/](https://owasp.org/www-project-top-ten/)
*   **OWASP SSRF Prevention Cheat Sheet:** [https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
*   **Node.js Security Best Practices:** [https://nodejs.org/en/docs/guides/security/](https://nodejs.org/en/docs/guides/security/)
*   **Express Security Best Practices:** [https://expressjs.com/en/advanced/best-practice-security.html](https://expressjs.com/en/advanced/best-practice-security.html)
*   **JWT Handbook:** [https://jwt.io/introduction/](https://jwt.io/introduction/)
*   **Google Cloud Secret Manager:** [https://cloud.google.com/secret-manager/docs](https://cloud.google.com/secret-manager/docs)
*   **ssrf-req-filter library:** [https://www.npmjs.com/package/ssrf-req-filter](https://www.npmjs.com/package/ssrf-req-filter)
*   **express-rate-limit library:** [https://www.npmjs.com/package/express-rate-limit](https://www.npmjs.com/package/express-rate-limit)
*   **CORS (Cross-Origin Resource Sharing):** [https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)