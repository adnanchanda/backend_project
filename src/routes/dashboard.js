// SoleMate Dashboard Routes — v2 with screen-specific endpoints
const express = require('express');
const router = express.Router();
const {
    getKpis,
    getRevenueTrend,
    getCategorySplit,
    getTopProducts,
    getRecentOrders,
    getInventoryAlerts,
    getOrdersByChannel,
    getCustomerDemographics,
    getGeoRevenue,
    getPaymentMethods,
    getSizeDistribution,
    getOrderStatusBreakdown,
    getAllOrders,
    getAllProducts,
    getAllCustomers,
    getFullInventory,
    getSalesSummary,
} = require('../controllers/dashboardController');

// Overview endpoints
router.get('/kpis', getKpis);
router.get('/revenue-trend', getRevenueTrend);
router.get('/category-split', getCategorySplit);
router.get('/top-products', getTopProducts);
router.get('/recent-orders', getRecentOrders);
router.get('/inventory-alerts', getInventoryAlerts);
router.get('/orders-by-channel', getOrdersByChannel);
router.get('/customer-demographics', getCustomerDemographics);
router.get('/geo-revenue', getGeoRevenue);
router.get('/payment-methods', getPaymentMethods);
router.get('/size-distribution', getSizeDistribution);
router.get('/order-status-breakdown', getOrderStatusBreakdown);

// Screen-specific endpoints
router.get('/orders-list', getAllOrders);
router.get('/products-list', getAllProducts);
router.get('/customers-list', getAllCustomers);
router.get('/inventory-list', getFullInventory);
router.get('/sales-summary', getSalesSummary);

module.exports = router;
