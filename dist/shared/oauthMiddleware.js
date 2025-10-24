/**
 * OAuth 2.1 Resource Server Middleware
 *
 * This module implements Express middleware for validating OAuth 2.1 Bearer tokens
 * as a Resource Server. It handles token extraction, signature validation against
 * external Authorization Server JWKS, issuer/audience validation, and expiry checks.
 *
 * Features:
 * - Bearer token extraction from Authorization header
 * - JWKS fetching and caching from the configured AS URI
 * - Token signature validation using JWKS
 * - Validation of iss, aud, exp, nbf claims
 * - HTTP 401 responses for missing/invalid/expired tokens
 * - Configurable AS Issuer URL and expected Audience
 * - HTTPS enforcement for production environments
 */
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { PersistentCache } from '../cache/index.js';
import { hasRequiredScopes } from './oauthScopes.js';
/**
 * Error class for OAuth token validation failures
 */
export class OAuthTokenError extends Error {
    status;
    code;
    constructor(message, code = 'invalid_token', status = 401) {
        super(message);
        this.name = 'OAuthTokenError';
        this.code = code;
        this.status = status;
    }
}
/**
 * Creates an OAuth 2.1 middleware for validating Bearer tokens
 *
 * @param options - Configuration options for the middleware
 * @returns Express middleware function
 */
export function createOAuthMiddleware(options) {
    // Validate required options
    if (!options.issuerUrl) {
        throw new Error('issuerUrl is required for OAuth middleware');
    }
    if (!options.audience) {
        throw new Error('audience is required for OAuth middleware');
    }
    // Set default options
    const jwksPath = options.jwksPath || '/.well-known/jwks.json';
    const enforceHttps = options.enforceHttps ?? (process.env.NODE_ENV === 'production');
    const jwksCacheTtl = options.jwksCacheTtl || 60 * 60 * 1000; // 1 hour default
    const allowExpiredTokens = options.allowExpiredTokens || false;
    // Ensure issuerUrl doesn't end with a slash
    const issuerUrl = options.issuerUrl.endsWith('/')
        ? options.issuerUrl.slice(0, -1)
        : options.issuerUrl;
    // Construct JWKS URI
    const jwksUri = `${issuerUrl}${jwksPath}`;
    // Create JWKS client for signature verification
    const jwksRsaClient = jwksClient({
        jwksUri,
        cache: true,
        cacheMaxAge: jwksCacheTtl,
        rateLimit: true,
        jwksRequestsPerMinute: 10
    });
    // Create cache for JWKS
    const jwksCache = new PersistentCache({
        defaultTTL: jwksCacheTtl,
        maxSize: 100,
        storagePath: './storage/jwks_cache',
        eagerLoading: true
    });
    /**
     * Gets the signing key from JWKS
     *
     * @param kid - Key ID from the JWT header
     * @returns Promise resolving to the signing key
     */
    async function getSigningKey(kid) {
        try {
            // Try to get from cache first using getOrCompute with a null computeFn
            // that will only be called if the key is not in cache
            return await jwksCache.getOrCompute('jwks', { kid }, async () => {
                // Fetch from JWKS client if not in cache
                const key = await new Promise((resolve, reject) => {
                    jwksRsaClient.getSigningKey(kid, (err, key) => {
                        if (err) {
                            return reject(err);
                        }
                        // Handle different key types
                        const signingKey = key.getPublicKey?.() || key.rsaPublicKey;
                        if (!signingKey) {
                            return reject(new Error('Unable to get signing key'));
                        }
                        resolve(signingKey);
                    });
                });
                return key;
            }, {
                ttl: jwksCacheTtl, // Use the configured TTL
                staleWhileRevalidate: true,
                staleTime: 24 * 60 * 60 * 1000 // Allow serving stale keys for up to a day while revalidating
            });
        }
        catch (error) {
            console.error('Error getting signing key:', error);
            throw new OAuthTokenError('Unable to verify token signature', 'invalid_token');
        }
    }
    /**
     * Verifies a JWT token
     *
     * @param token - The JWT token to verify
     * @returns Promise resolving to the decoded token
     */
    async function verifyToken(token) {
        try {
            // Decode the token without verification to get the header
            const decoded = jwt.decode(token, { complete: true });
            if (!decoded || typeof decoded !== 'object') {
                throw new OAuthTokenError('Invalid token format');
            }
            // Get the key ID from the header
            const kid = decoded.header.kid;
            if (!kid) {
                throw new OAuthTokenError('Token missing key ID (kid)');
            }
            // Get the signing key
            const signingKey = await getSigningKey(kid);
            // Verify options
            const verifyOptions = {
                issuer: issuerUrl,
                audience: options.audience,
                algorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512']
            };
            // Skip expiration check if allowExpiredTokens is true (for testing only)
            if (allowExpiredTokens) {
                verifyOptions.ignoreExpiration = true;
            }
            // Verify the token
            return jwt.verify(token, signingKey, verifyOptions);
        }
        catch (error) {
            if (error instanceof OAuthTokenError) {
                throw error;
            }
            if (error instanceof jwt.TokenExpiredError) {
                throw new OAuthTokenError('Token has expired', 'expired_token');
            }
            if (error instanceof jwt.NotBeforeError) {
                throw new OAuthTokenError('Token not yet valid', 'invalid_token');
            }
            console.error('Token verification error:', error);
            throw new OAuthTokenError('Invalid token', 'invalid_token');
        }
    }
    /**
     * Extracts scopes from the token
     *
     * @param token - The decoded token
     * @returns Array of scope strings
     */
    function extractScopes(token) {
        // Handle different scope formats
        if (!token.scope) {
            return [];
        }
        if (typeof token.scope === 'string') {
            return token.scope.split(' ');
        }
        if (Array.isArray(token.scope)) {
            return token.scope;
        }
        return [];
    }
    /**
     * The Express middleware function
     */
    return async function oauthMiddleware(req, res, next) {
        try {
            // Enforce HTTPS in production
            if (enforceHttps && process.env.NODE_ENV === 'production') {
                if (req.headers['x-forwarded-proto'] !== 'https' && req.protocol !== 'https') {
                    return res.status(403).json({
                        error: 'https_required',
                        error_description: 'HTTPS is required for this endpoint'
                    });
                }
            }
            // Extract the token from the Authorization header
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                throw new OAuthTokenError('Missing authorization header', 'missing_token');
            }
            // Check for Bearer token format
            const parts = authHeader.split(' ');
            if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
                throw new OAuthTokenError('Invalid authorization header format', 'invalid_token');
            }
            const token = parts[1];
            if (!token) {
                throw new OAuthTokenError('Empty token', 'invalid_token');
            }
            // Verify the token
            const decodedToken = await verifyToken(token);
            // Extract scopes
            const scopes = extractScopes(decodedToken);
            // Attach token and scopes to the request for later use
            req.oauth = {
                token: decodedToken,
                scopes
            };
            next();
        }
        catch (error) {
            if (error instanceof OAuthTokenError) {
                return res.status(error.status).json({
                    error: error.code,
                    error_description: error.message
                });
            }
            console.error('OAuth middleware error:', error);
            return res.status(401).json({
                error: 'invalid_token',
                error_description: 'An error occurred while validating the token'
            });
        }
    };
}
/**
 * Creates middleware that checks if the token has the required scopes
 *
 * @param requiredScopes - Array of scopes required for the endpoint
 * @returns Express middleware function
 */
export function requireScopes(requiredScopes) {
    return function scopeMiddleware(req, res, next) {
        // Check if oauth object exists (token was validated)
        if (!req.oauth) {
            return res.status(401).json({
                error: 'invalid_token',
                error_description: 'No valid token provided'
            });
        }
        const { scopes } = req.oauth;
        // Check if token has required scopes
        if (!hasRequiredScopes(scopes, requiredScopes)) {
            return res.status(403).json({
                error: 'insufficient_scope',
                error_description: 'The token does not have the required scopes',
                scope: requiredScopes.join(' ')
            });
        }
        next();
    };
}
/**
 * Creates middleware that applies OAuth validation only if a token is present
 * This is useful for endpoints that can be accessed both with and without authentication
 *
 * @param options - Configuration options for the middleware
 * @returns Express middleware function
 */
export function optionalOAuth(options) {
    const oauthMiddleware = createOAuthMiddleware(options);
    return async function optionalOAuthMiddleware(req, res, next) {
        // Skip OAuth validation if no Authorization header is present
        if (!req.headers.authorization) {
            return next();
        }
        // Otherwise, apply the OAuth middleware
        return oauthMiddleware(req, res, next);
    };
}
/**
 * Creates middleware that applies OAuth validation and scope checking in one step
 *
 * @param options - Configuration options for the middleware
 * @param requiredScopes - Array of scopes required for the endpoint
 * @returns Express middleware function
 */
export function protectWithScopes(options, requiredScopes) {
    const oauthMiddleware = createOAuthMiddleware(options);
    const scopeMiddleware = requireScopes(requiredScopes);
    return async function protectedRouteMiddleware(req, res, next) {
        try {
            // First apply OAuth validation
            await new Promise((resolve, reject) => {
                oauthMiddleware(req, res, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            // Then check scopes
            scopeMiddleware(req, res, next);
        }
        catch (error) {
            next(error);
        }
    };
}
//# sourceMappingURL=oauthMiddleware.js.map