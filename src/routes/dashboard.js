const express = require('express');
const router = express.Router();

const { getKpis } = require('../controllers/kpiController');
const {
  getRevenueTrend, getCategorySplit, getTopProducts, getRecentOrders,
  getInventoryAlerts, getOrdersByChannel, getCustomerDemographics,
  getGeoRevenue, getPaymentMethods, getSizeDistribution, getOrderStatusBreakdown,
} = require('../controllers/analyticsController');
const { getAllOrders } = require('../controllers/orderController');
const { getAllProducts } = require('../controllers/productController');
const { getAllCustomers } = require('../controllers/customerController');
const { getFullInventory } = require('../controllers/inventoryController');
const { getSalesSummary } = require('../controllers/salesController');

// Overview
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

// Paginated list endpoints
router.get('/orders-list', getAllOrders);
router.get('/products-list', getAllProducts);
router.get('/customers-list', getAllCustomers);
router.get('/inventory-list', getFullInventory);

// Aggregate
router.get('/sales-summary', getSalesSummary);

module.exports = router;
