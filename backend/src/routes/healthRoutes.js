/**
 * Health Check Routes
 * Endpoints for monitoring system health and readiness
 */

const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

/**
 * @route   GET /api/health
 * @desc    Basic health check - returns simple status
 * @access  Public
 */
router.get('/', healthController.basicHealthCheck);

/**
 * @route   GET /api/health/detailed
 * @desc    Comprehensive system status with all metrics
 * @access  Public (consider restricting in production)
 */
router.get('/detailed', healthController.detailedHealthCheck);

/**
 * @route   GET /api/health/ready
 * @desc    Readiness probe for Kubernetes/container orchestration
 * @access  Public
 */
router.get('/ready', healthController.readinessCheck);

/**
 * @route   GET /api/health/live
 * @desc    Liveness probe for Kubernetes/container orchestration
 * @access  Public
 */
router.get('/live', healthController.livenessCheck);

module.exports = router;
