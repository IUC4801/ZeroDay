/**
 * Swagger API Documentation Configuration
 * OpenAPI 3.0 specification for ZeroDay CVE Tracker API
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'ZeroDay API',
    version: '1.0.0',
    description: 'Advanced CVE Vulnerability Tracker API - Comprehensive vulnerability intelligence and tracking system',
    contact: {
      name: 'API Support',
      email: 'support@zeroday.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:5000/api',
      description: 'Development server'
    },
    {
      url: 'https://api.zeroday.com/api',
      description: 'Production server'
    }
  ],
  tags: [
    {
      name: 'CVEs',
      description: 'CVE vulnerability data endpoints'
    },
    {
      name: 'Search',
      description: 'Advanced search and filtering'
    },
    {
      name: 'Sync',
      description: 'Data synchronization operations'
    },
    {
      name: 'Health',
      description: 'System health and monitoring'
    },
    {
      name: 'Statistics',
      description: 'Analytics and statistics'
    }
  ],
  components: {
    schemas: {
      CVE: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            example: '507f1f77bcf86cd799439011'
          },
          cveId: {
            type: 'string',
            example: 'CVE-2023-12345',
            description: 'CVE identifier'
          },
          sourceIdentifier: {
            type: 'string',
            example: 'cve@mitre.org'
          },
          publishedDate: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-15T10:30:00Z'
          },
          lastModifiedDate: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-16T14:20:00Z'
          },
          vulnStatus: {
            type: 'string',
            enum: ['Analyzed', 'Modified', 'Awaiting Analysis', 'Undergoing Analysis', 'Rejected'],
            example: 'Analyzed'
          },
          description: {
            type: 'string',
            example: 'A critical vulnerability that allows remote code execution'
          },
          cvssV3: {
            type: 'object',
            properties: {
              version: { type: 'string', example: '3.1' },
              vectorString: { type: 'string', example: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' },
              baseScore: { type: 'number', example: 9.8 },
              baseSeverity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], example: 'CRITICAL' },
              exploitabilityScore: { type: 'number', example: 3.9 },
              impactScore: { type: 'number', example: 5.9 }
            }
          },
          cvssV2: {
            type: 'object',
            properties: {
              version: { type: 'string', example: '2.0' },
              vectorString: { type: 'string', example: 'AV:N/AC:L/Au:N/C:C/I:C/A:C' },
              baseScore: { type: 'number', example: 10.0 }
            }
          },
          weaknesses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                source: { type: 'string', example: 'NVD' },
                type: { type: 'string', example: 'Primary' },
                description: { type: 'string', example: 'CWE-79: Improper Neutralization of Input' }
              }
            }
          },
          references: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: { type: 'string', example: 'https://example.com/advisory' },
                source: { type: 'string', example: 'vendor' },
                tags: { type: 'array', items: { type: 'string' }, example: ['Patch', 'Vendor Advisory'] }
              }
            }
          },
          affectedProducts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                vendor: { type: 'string', example: 'microsoft' },
                product: { type: 'string', example: 'windows_server_2019' },
                version: { type: 'string', example: '1809' }
              }
            }
          },
          epssScore: {
            type: 'number',
            example: 0.95432,
            description: 'EPSS probability score (0-1)'
          },
          epssPercentile: {
            type: 'number',
            example: 99.5,
            description: 'EPSS percentile ranking'
          },
          exploitAvailable: {
            type: 'boolean',
            example: true
          },
          cisaKev: {
            type: 'boolean',
            example: true,
            description: 'Is in CISA Known Exploited Vulnerabilities catalog'
          },
          cisaKevDetails: {
            type: 'object',
            properties: {
              dateAdded: { type: 'string', format: 'date' },
              dueDate: { type: 'string', format: 'date' },
              requiredAction: { type: 'string' }
            }
          }
        }
      },
      Pagination: {
        type: 'object',
        properties: {
          page: {
            type: 'integer',
            example: 1,
            description: 'Current page number'
          },
          limit: {
            type: 'integer',
            example: 25,
            description: 'Items per page'
          },
          total: {
            type: 'integer',
            example: 1000,
            description: 'Total number of items'
          },
          totalPages: {
            type: 'integer',
            example: 40,
            description: 'Total number of pages'
          },
          hasNext: {
            type: 'boolean',
            example: true
          },
          hasPrev: {
            type: 'boolean',
            example: false
          },
          showing: {
            type: 'string',
            example: '1-25 of 1000'
          }
        }
      },
      SuccessResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          message: {
            type: 'string',
            example: 'Operation completed successfully'
          },
          data: {
            type: 'object'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-15T10:30:00Z'
          }
        }
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          message: {
            type: 'string',
            example: 'Success'
          },
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/CVE'
            }
          },
          pagination: {
            $ref: '#/components/schemas/Pagination'
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          message: {
            type: 'string',
            example: 'An error occurred'
          },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', example: 'page' },
                message: { type: 'string', example: 'Page must be a positive integer' },
                value: { type: 'string', example: '-1' }
              }
            }
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      CVEFilters: {
        type: 'object',
        properties: {
          severity: {
            type: 'string',
            enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
            example: 'CRITICAL'
          },
          startDate: {
            type: 'string',
            format: 'date',
            example: '2023-01-01'
          },
          endDate: {
            type: 'string',
            format: 'date',
            example: '2023-12-31'
          },
          exploitAvailable: {
            type: 'boolean',
            example: true
          },
          cisaKev: {
            type: 'boolean',
            example: true
          },
          vendor: {
            type: 'string',
            example: 'microsoft'
          },
          product: {
            type: 'string',
            example: 'windows'
          }
        }
      },
      Statistics: {
        type: 'object',
        properties: {
          totalCVEs: {
            type: 'integer',
            example: 10000
          },
          bySeverity: {
            type: 'object',
            properties: {
              CRITICAL: { type: 'integer', example: 500 },
              HIGH: { type: 'integer', example: 2000 },
              MEDIUM: { type: 'integer', example: 5000 },
              LOW: { type: 'integer', example: 2500 }
            }
          },
          withExploits: {
            type: 'integer',
            example: 1500
          },
          inKEV: {
            type: 'integer',
            example: 850
          },
          avgCvssScore: {
            type: 'number',
            example: 6.8
          },
          recentCVEs: {
            type: 'integer',
            example: 250,
            description: 'CVEs published in last 30 days'
          }
        }
      },
      SyncRequest: {
        type: 'object',
        properties: {
          dateRange: {
            type: 'string',
            enum: ['7d', '30d', '90d', 'all'],
            example: '30d'
          },
          force: {
            type: 'boolean',
            example: false
          },
          full: {
            type: 'boolean',
            example: false
          },
          incremental: {
            type: 'boolean',
            example: true
          },
          vendors: {
            type: 'array',
            items: { type: 'string' },
            example: ['microsoft', 'apple', 'google']
          },
          resume: {
            type: 'boolean',
            example: false
          },
          checkOSV: {
            type: 'boolean',
            example: false
          }
        }
      },
      SearchRequest: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            example: 'remote code execution',
            description: 'Search query (2-200 characters)'
          },
          filters: {
            $ref: '#/components/schemas/CVEFilters'
          },
          page: {
            type: 'integer',
            example: 1,
            minimum: 1
          },
          limit: {
            type: 'integer',
            example: 25,
            minimum: 1,
            maximum: 100
          }
        }
      }
    },
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API Key for authentication'
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT Bearer token'
      }
    },
    parameters: {
      PageParam: {
        in: 'query',
        name: 'page',
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1
        },
        description: 'Page number'
      },
      LimitParam: {
        in: 'query',
        name: 'limit',
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 25
        },
        description: 'Number of items per page'
      },
      SeverityParam: {
        in: 'query',
        name: 'severity',
        schema: {
          type: 'string',
          enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
        },
        description: 'Filter by severity level'
      },
      CVEIdParam: {
        in: 'path',
        name: 'cveId',
        required: true,
        schema: {
          type: 'string',
          pattern: '^CVE-\\d{4}-\\d{4,}$'
        },
        example: 'CVE-2023-12345',
        description: 'CVE identifier'
      },
      VendorParam: {
        in: 'path',
        name: 'vendor',
        required: true,
        schema: {
          type: 'string'
        },
        example: 'microsoft',
        description: 'Vendor name'
      }
    },
    responses: {
      Success: {
        description: 'Successful operation',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/SuccessResponse'
            }
          }
        }
      },
      BadRequest: {
        description: 'Bad request - Invalid parameters',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            },
            example: {
              success: false,
              message: 'Validation failed',
              errors: [
                {
                  field: 'page',
                  message: 'Page must be an integer greater than or equal to 1',
                  value: '0'
                }
              ],
              timestamp: '2023-01-15T10:30:00Z'
            }
          }
        }
      },
      Unauthorized: {
        description: 'Unauthorized - Invalid or missing API key',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            }
          }
        }
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            },
            example: {
              success: false,
              message: 'CVE not found',
              timestamp: '2023-01-15T10:30:00Z'
            }
          }
        }
      },
      TooManyRequests: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            },
            example: {
              success: false,
              message: 'Too many requests',
              retryAfter: 60,
              timestamp: '2023-01-15T10:30:00Z'
            }
          }
        }
      },
      ServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            }
          }
        }
      }
    }
  }
};

// Options for swagger-jsdoc
const options = {
  swaggerDefinition,
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/models/*.js'
  ]
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(options);

// Swagger UI options
const swaggerUiOptions = {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'ZeroDay API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true
  }
};

/**
 * Setup Swagger documentation
 * @param {Object} app - Express app instance
 */
const setupSwagger = (app) => {
  // Serve swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
  
  // Serve OpenAPI spec as JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  
  console.log('📚 Swagger documentation available at /api-docs');
  console.log('📄 OpenAPI spec available at /api-docs.json');
};

module.exports = {
  setupSwagger,
  swaggerSpec
};
