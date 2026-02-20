const express = require('express');
const router = express.Router();
const { getHome, getHealth } = require('../controllers/homeController');
const dashboardRoutes = require('./dashboard');

router.get('/', getHome);
router.get('/health', getHealth);

// Dashboard API
router.use('/dashboard', dashboardRoutes);

module.exports = router;
