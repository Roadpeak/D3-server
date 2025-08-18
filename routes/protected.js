// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { authenticateToken } = require('../middleware/auth');

// Create payment record
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { amount, currency, method, phoneNumber, bookingId, offerId, description } = req.body;

    // Validate required fields
    if (!amount || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Amount and phone number are required'
      });
    }

    // Validate phone number format
    if (!paymentService.validatePhoneNumber(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    const paymentData = {
      amount: paymentService.formatAmount(amount),
      currency: currency || 'KES',
      method: method || 'mpesa',
      phoneNumber,
      bookingId,
      offerId,
      userId: req.user.id,
      description: description || 'Booking Payment'
    };

    const result = await paymentService.createBookingPayment(paymentData);

    if (result.success) {
      res.status(201).json({
        success: true,
        payment: result.payment,
        message: 'Payment record created successfully'
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating payment record'
    });
  }
});

// Initiate M-Pesa STK Push
router.post('/mpesa/stkpush', authenticateToken, async (req, res) => {
  try {
    const { phoneNumber, amount, bookingId, description } = req.body;

    // Validate required fields
    if (!phoneNumber || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and amount are required'
      });
    }

    // Validate phone number
    if (!paymentService.validatePhoneNumber(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Use format: 0712345678 or +254712345678'
      });
    }

    // Validate amount
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    const result = await paymentService.initiateSTKPush(
      phoneNumber,
      numericAmount,
      bookingId || 'temp_booking',
      description || 'Booking Payment'
    );

    if (result.success) {
      res.status(200).json({
        success: true,
        checkoutRequestId: result.checkoutRequestId,
        merchantRequestId: result.merchantRequestId,
        paymentId: result.payment.id,
        message: 'STK Push initiated. Please check your phone to complete payment.'
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('STK Push error:', error);
    res.status(500).json({
      success: false,
      message: 'Error initiating payment. Please try again.'
    });
  }
});

// M-Pesa callback endpoint
router.post('/mpesa/callback', async (req, res) => {
  try {
    console.log('📨 M-Pesa callback received:', JSON.stringify(req.body, null, 2));

    const result = await paymentService.processMpesaCallback(req.body);

    if (result.success) {
      console.log('✅ Callback processed successfully');

      // Here you can add additional logic like updating booking status
      // Example: awaitenhancedBookingController.updateBookingPaymentStatus(result.payment);

      res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Success'
      });
    } else {
      console.log('❌ Callback processing failed');
      res.status(200).json({
        ResultCode: 1,
        ResultDesc: 'Failed'
      });
    }

  } catch (error) {
    console.error('❌ Callback processing error:', error);
    res.status(200).json({
      ResultCode: 1,
      ResultDesc: 'Internal server error'
    });
  }
});

// Query STK Push status
router.get('/mpesa/status/:checkoutRequestId', authenticateToken, async (req, res) => {
  try {
    const { checkoutRequestId } = req.params;

    const result = await paymentService.querySTKPushStatus(checkoutRequestId);

    if (result.success) {
      res.status(200).json({
        success: true,
        status: result.data,
        message: 'Status retrieved successfully'
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Status query error:', error);
    res.status(500).json({
      success: false,
      message: 'Error querying payment status'
    });
  }
});

// Get payment status by payment ID
router.get('/:paymentId/status', authenticateToken, async (req, res) => {
  try {
    const { paymentId } = req.params;

    const result = await paymentService.checkPaymentStatus(paymentId);

    if (result.success) {
      res.status(200).json({
        success: true,
        payment: result.payment,
        message: 'Payment status retrieved successfully'
      });
    } else {
      res.status(404).json(result);
    }

  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking payment status'
    });
  }
});

// Get user's payment history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, method } = req.query;
    const userId = req.user.id;

    const { Payment } = require('../models');

    const whereClause = {
      'metadata.userId': userId
    };

    if (status) whereClause.status = status;
    if (method) whereClause.method = method;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: payments } = await Payment.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.status(200).json({
      success: true,
      payments,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment history'
    });
  }
});

// Admin routes (require admin authentication)
const { authenticateAdmin } = require('../middleware/auth');

// Get payment summary for admin
router.get('/admin/summary', authenticateAdmin, async (req, res) => {
  try {
    const { startDate, endDate, status, method } = req.query;

    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (status) filters.status = status;
    if (method) filters.method = method;

    const result = await paymentService.getPaymentSummary(filters);

    if (result.success) {
      res.status(200).json({
        success: true,
        summary: result.summary,
        message: 'Payment summary retrieved successfully'
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Payment summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment summary'
    });
  }
});

// Get all payments for admin
router.get('/admin/all', authenticateAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      method,
      startDate,
      endDate,
      search
    } = req.query;

    const { Payment, Booking, User } = require('../models');
    const { Op } = require('sequelize');

    const whereClause = {};

    if (status) whereClause.status = status;
    if (method) whereClause.method = method;

    if (startDate && endDate) {
      whereClause.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: payments } = await Payment.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Booking,
          required: false,
          include: [
            {
              model: User,
              attributes: ['id', 'firstName', 'lastName', 'email']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.status(200).json({
      success: true,
      payments,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Admin payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payments'
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Payment service is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;