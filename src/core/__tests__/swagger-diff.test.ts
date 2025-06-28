/**
 * Swagger Change Detector Tests
 */

import { SwaggerChangeDetector } from '../swagger-diff';

describe('SwaggerChangeDetector', () => {
  let changeDetector: SwaggerChangeDetector;

  beforeEach(() => {
    changeDetector = new SwaggerChangeDetector();
    jest.clearAllMocks();
  });

  describe('hasSignificantChanges', () => {
    it('should detect changes in swagger spec', () => {
      const originalSpec = {
        info: { version: '1.0.0', title: 'API' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              summary: 'Get all users',
              responses: {
                '200': { description: 'Success' },
              },
            },
          },
        },
      };

      const updatedSpec = {
        info: { version: '1.0.1', title: 'API' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              summary: 'Get all users',
              responses: {
                '200': { description: 'Success' },
              },
            },
            post: {
              operationId: 'createUser',
              summary: 'Create a user',
              responses: {
                '201': { description: 'Created' },
              },
            },
          },
          '/posts': {
            get: {
              operationId: 'getPosts',
              summary: 'Get all posts',
              responses: {
                '200': { description: 'Success' },
              },
            },
          },
        },
      };

      // First check - should return true (first time)
      const firstCheck = changeDetector.hasSignificantChanges(originalSpec);
      expect(firstCheck).toBe(true);

      // Second check - should detect changes
      const secondCheck = changeDetector.hasSignificantChanges(updatedSpec);
      expect(secondCheck).toBe(true);
    });

    it('should return false when spec has not changed', () => {
      const spec = {
        info: { version: '1.0.0', title: 'API' },
        paths: { '/users': { get: {} } },
      };

      // First check
      changeDetector.hasSignificantChanges(spec);

      // Second check with same content
      const hasChanged = changeDetector.hasSignificantChanges(spec);
      expect(hasChanged).toBe(false);
    });

    it('should detect changes in nested properties', () => {
      const originalSpec = {
        info: { version: '1.0.0', title: 'API' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              summary: 'Get users',
              parameters: [{ name: 'id', type: 'string' }],
              responses: { '200': { description: 'Success' } },
            },
          },
        },
      };

      const updatedSpec = {
        info: { version: '1.0.0', title: 'API' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              summary: 'Get users',
              parameters: [
                { name: 'id', type: 'string' },
                { name: 'includeInactive', type: 'boolean' },
              ],
              responses: { '200': { description: 'Success' } },
            },
          },
        },
      };

      // First check
      changeDetector.hasSignificantChanges(originalSpec);

      // Second check with updated spec
      const hasChanged = changeDetector.hasSignificantChanges(updatedSpec);
      expect(hasChanged).toBe(true);
    });

    it('should ignore non-significant changes', () => {
      const originalSpec = {
        info: {
          version: '1.0.0',
          title: 'API',
          description: 'Original description',
          contact: { email: 'test@example.com' },
        },
        paths: { '/users': { get: {} } },
      };

      const updatedSpec = {
        info: {
          version: '1.0.0',
          title: 'API',
          description: 'Updated description', // Non-significant change
          contact: { email: 'new@example.com' }, // Non-significant change
        },
        paths: { '/users': { get: {} } },
      };

      // First check
      changeDetector.hasSignificantChanges(originalSpec);

      // Second check - should not detect significant changes
      const hasChanged = changeDetector.hasSignificantChanges(updatedSpec);
      expect(hasChanged).toBe(false);
    });
  });

  describe('analyzeChanges', () => {
    it('should return detailed changes between specs', () => {
      const originalSpec = {
        info: { version: '1.0.0', title: 'API' },
        paths: { '/users': { get: {} } },
      };

      const updatedSpec = {
        info: { version: '1.0.1', title: 'API' },
        paths: {
          '/users': { get: {}, post: {} },
          '/posts': { get: {} },
        },
      };

      const changes = changeDetector.analyzeChanges(originalSpec, updatedSpec);

      expect(changes).toBeDefined();
      expect(changes.hasChanges).toBe(true);
      expect(changes.summary).toBeDefined();
      expect(changes.changes).toBeDefined();
      expect(Array.isArray(changes.changes)).toBe(true);
    });

    it('should return no changes when specs are identical', () => {
      const spec = {
        info: { version: '1.0.0', title: 'API' },
        paths: { '/users': { get: {} } },
      };

      const changes = changeDetector.analyzeChanges(spec, spec);

      expect(changes.hasChanges).toBe(false);
      expect(changes.summary.major).toBe(0);
      expect(changes.summary.minor).toBe(0);
      expect(changes.summary.patch).toBe(0);
    });

    it('should categorize changes by severity', () => {
      const originalSpec = {
        info: { version: '1.0.0', title: 'API' },
        paths: {
          '/users': {
            get: {
              responses: { '200': { description: 'Success' } },
            },
          },
        },
      };

      const updatedSpec = {
        info: { version: '2.0.0', title: 'API' }, // Major version change
        paths: {
          '/users': {
            get: {
              responses: {
                '200': { description: 'Success' },
                '404': { description: 'Not Found' }, // New response
              },
            },
            post: {}, // New method
          },
          '/posts': { get: {} }, // New endpoint
        },
      };

      const changes = changeDetector.analyzeChanges(originalSpec, updatedSpec);

      expect(changes.hasChanges).toBe(true);
      expect(
        changes.summary.major + changes.summary.minor + changes.summary.patch
      ).toBeGreaterThan(0);
    });
  });

  describe('OpenAPI 3.0 support', () => {
    it('should handle OpenAPI 3.0 specs', () => {
      const openApiSpec = {
        openapi: '3.0.0',
        info: { version: '1.0.0', title: 'API' },
        paths: {
          '/users': {
            get: {
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
              },
            },
          },
        },
      };

      const result = changeDetector.hasSignificantChanges(openApiSpec);
      expect(result).toBe(true); // First time should be true
    });

    it('should detect schema changes in OpenAPI 3.0', () => {
      const originalSpec = {
        openapi: '3.0.0',
        info: { version: '1.0.0', title: 'API' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              summary: 'Get users',
              responses: {
                '200': { description: 'Success' },
              },
            },
          },
        },
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
              },
            },
          },
        },
      };

      const updatedSpec = {
        openapi: '3.0.0',
        info: { version: '1.0.0', title: 'API' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              summary: 'Get users',
              responses: {
                '200': { description: 'Success' },
              },
            },
          },
        },
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                email: { type: 'string' }, // New property
              },
            },
          },
        },
      };

      // First check
      changeDetector.hasSignificantChanges(originalSpec);

      // Second check should detect schema changes
      const hasChanged = changeDetector.hasSignificantChanges(updatedSpec);
      expect(hasChanged).toBe(true);
    });
  });

  describe('Swagger 2.0 support', () => {
    it('should handle Swagger 2.0 specs', () => {
      const swaggerSpec = {
        swagger: '2.0',
        info: { version: '1.0.0', title: 'API' },
        paths: {
          '/users': {
            get: {
              responses: {
                '200': {
                  description: 'Success',
                  schema: {
                    type: 'array',
                    items: { $ref: '#/definitions/User' },
                  },
                },
              },
            },
          },
        },
        definitions: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
            },
          },
        },
      };

      const result = changeDetector.hasSignificantChanges(swaggerSpec);
      expect(result).toBe(true); // First time should be true
    });
  });

  describe('edge cases', () => {
    it('should handle empty specs', () => {
      const emptySpec = {};

      const result = changeDetector.hasSignificantChanges(emptySpec);
      expect(result).toBe(true); // First time should be true

      const secondResult = changeDetector.hasSignificantChanges(emptySpec);
      expect(secondResult).toBe(false); // No changes
    });

    it('should handle null/undefined specs', () => {
      const result = changeDetector.hasSignificantChanges(null);
      expect(result).toBe(true); // First time should be true

      const secondResult = changeDetector.hasSignificantChanges(null);
      expect(secondResult).toBe(false); // No changes
    });
  });
});
