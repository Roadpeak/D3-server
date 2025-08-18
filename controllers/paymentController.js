// controllers/paymentController.js - Complete M-Pesa Integration

const paymentService = require('../services/paymentService');
const { Payment, Booking } = require('../models');

class PaymentController {
  
  // ==================== M-PESA INTEGRATION ====================

  /**
   * Initiate M-Pesa STK Push payment
   */
  async initiateMpesaPayment(req, res) {
    try {
      const { phoneNumber, amount, bookingId, type = 'booking_access_fee' } = req.body;

      console.log('💳 Initiating M-Pesa payment:', { phoneNumber, amount, bookingId, type });

      // Validate required fields
      if (!phoneNumber || !amount) {
        return res.status(400).json({
          success: false,
          message: 'Phone number and amount are required'
        });
      }

      // Validate phone number format
      if (!paymentService.validatePhoneNumber(phoneNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number format. Use format: 0712345678 or +254712345678'
        });
      }

      // Validate amount
      const paymentAmount = parseFloat(amount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid amount. Amount must be greater than 0'
        });
      }

      // If bookingId is provided, verify the booking exists
      let booking = null;
      if (bookingId) {
        booking = await Booking.findByPk(bookingId);
        if (!booking) {
          return res.status(404).json({
            success: false,
            message: 'Booking not found'
          });
        }

        // Check if booking already has a payment
        if (booking.paymentId) {
          const existingPayment = await Payment.findByPk(booking.paymentId);
          if (existingPayment && existingPayment.status === 'completed') {
            return res.status(400).json({
              success: false,
              message: 'This booking has already been paid for',
              payment: existingPayment
            });
          }
        }
      }

      // Create description based on type
      let description = 'Payment';
      if (type === 'booking_access_fee') {
        description = `Booking Access Fee - ${bookingId || 'Service'}`;
      } else if (type === 'service_payment') {
        description = `Service Payment - ${bookingId || 'Service'}`;
      }

      // Initiate STK Push
      const result = await paymentService.initiateSTKPush(
        phoneNumber,
        paymentAmount,
        bookingId || `temp-${Date.now()}`,
        description
      );

      if (result.success) {
        // Update booking with payment ID if booking exists
        if (booking) {
          await booking.update({ 
            paymentId: result.payment.id,
            paymentUniqueCode: result.payment.unique_code
          });
        }

        console.log('✅ M-Pesa payment initiated successfully');

        return res.status(200).json({
          success: true,
          message: 'M-Pesa payment initiated. Please check your phone for the payment prompt.',
          payment: {
            id: result.payment.id,
            unique_code: result.payment.unique_code,
            amount: result.payment.amount,
            status: result.payment.status,
            checkoutRequestId: result.checkoutRequestId
          },
          checkoutRequestId: result.checkoutRequestId,
          instructions: 'Please enter your M-Pesa PIN when prompted on your phone to complete the payment.'
        });
      } else {
        throw new Error('Failed to initiate M-Pesa payment');
      }

    } catch (error) {
      console.error('❌ M-Pesa payment initiation error:', error);
      
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to initiate M-Pesa payment',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Payment service temporarily unavailable'
      });
    }
  }

  /**
   * Handle M-Pesa callback from Safaricom
   */
  async handleMpesaCallback(req, res) {
    try {
      console.log('📨 Received M-Pesa callback:', JSON.stringify(req.body, null, 2));

      const result = await paymentService.processMpesaCallback(req.body);

      if (result.success) {
        console.log('✅ M-Pesa callback processed successfully');
        
        // Update booking status if payment was successful
        if (result.payment && result.payment.metadata && result.payment.metadata.bookingId) {
          try {
            const booking = await Booking.findOne({
              where: { paymentId: result.payment.id }
            });
            
            if (booking) {
              await booking.update({ status: 'confirmed' });
              console.log('✅ Booking status updated to confirmed');
            }
          } catch (bookingError) {
            console.error('⚠️ Error updating booking status:', bookingError);
          }
        }

        // Always return success to M-Pesa
        return res.status(200).json({
          ResultCode: 0,
          ResultDesc: "Callback processed successfully"
        });
      } else {
        console.log('❌ M-Pesa callback processing failed:', result.message);
        
        // Still return success to M-Pesa to avoid retries
        return res.status(200).json({
          ResultCode: 0,
          ResultDesc: "Callback received"
        });
      }

    } catch (error) {
      console.error('❌ M-Pesa callback processing error:', error);
      
      // Always return success to M-Pesa to avoid infinite retries
      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Callback received"
      });
    }
  }

  /**
   * Check M-Pesa payment status
   */
  async checkMpesaStatus(req, res) {
    try {
      const { paymentId, checkoutRequestId } = req.params;

      console.log('🔍 Checking M-Pesa payment status:', { paymentId, checkoutRequestId });

      let payment = null;

      if (paymentId) {
        // Check by payment ID
        const result = await paymentService.checkPaymentStatus(paymentId);
        if (result.success) {
          payment = result.payment;
        }
      } else if (checkoutRequestId) {
        // Query M-Pesa directly
        const mpesaResult = await paymentService.querySTKPushStatus(checkoutRequestId);
        if (mpesaResult.success) {
          // Find payment by checkout request ID
          payment = await Payment.findOne({
            where: { transaction_id: checkoutRequestId }
          });
        }
      }

      if (payment) {
        return res.status(200).json({
          success: true,
          payment: {
            id: payment.id,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
            mpesa_receipt_number: payment.mpesa_receipt_number,
            transaction_date: payment.transaction_date,
            created_at: payment.createdAt,
            updated_at: payment.updatedAt
          }
        });
      } else {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

    } catch (error) {
      console.error('❌ Error checking M-Pesa status:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to check payment status',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Service temporarily unavailable'
      });
    }
  }

  /**
   * Retry failed M-Pesa payment
   */
  async retryMpesaPayment(req, res) {
    try {
      const { paymentId } = req.params;

      console.log('🔄 Retrying M-Pesa payment:', paymentId);

      const payment = await Payment.findByPk(paymentId);
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      if (payment.status !== 'failed') {
        return res.status(400).json({
          success: false,
          message: 'Can only retry failed payments'
        });
      }

      if (!payment.canRetry()) {
        return res.status(400).json({
          success: false,
          message: 'Maximum retry attempts exceeded'
        });
      }

      // Extract original payment details
      const { phone_number, amount, metadata } = payment;
      const bookingId = metadata?.bookingId;

      // Initiate new STK Push
      const result = await paymentService.initiateSTKPush(
        phone_number,
        amount,
        bookingId || `retry-${Date.now()}`,
        `Retry Payment - ${payment.reference || 'Service'}`
      );

      if (result.success) {
        // Update retry count
        await payment.update({
          retry_count: payment.retry_count + 1,
          next_retry_at: null,
          status: 'pending'
        });

        return res.status(200).json({
          success: true,
          message: 'Payment retry initiated successfully',
          payment: result.payment,
          checkoutRequestId: result.checkoutRequestId
        });
      } else {
        throw new Error('Failed to retry payment');
      }

    } catch (error) {
      console.error('❌ Error retrying M-Pesa payment:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to retry payment',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Service temporarily unavailable'
      });
    }
  }

  // ==================== GENERAL PAYMENT METHODS ====================

  /**
   * Create payment record
   */
  async createPayment(req, res) {
    try {
      const paymentData = req.body;

      const result = await paymentService.createBookingPayment(paymentData);

      if (result.success) {
        return res.status(201).json({
          success: true,
          payment: result.payment
        });
      } else {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

    } catch (error) {
      console.error('Error creating payment:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create payment'
      });
    }
  }

  /**
   * Get all payments
   */
  async getAllPayments(req, res) {
    try {
      const { page = 1, limit = 10, status, method } = req.query;
      
      const whereClause = {};
      if (status) whereClause.status = status;
      if (method) whereClause.method = method;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { count, rows: payments } = await Payment.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: offset,
        order: [['createdAt', 'DESC']]
      });

      return res.status(200).json({
        success: true,
        payments: payments,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('Error fetching payments:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch payments'
      });
    }
  }

  /**
   * Get payments by status
   */
  async getPaymentsByStatus(req, res) {
    try {
      const { status } = req.params;
      
      const payments = await Payment.findAll({
        where: { status },
        order: [['createdAt', 'DESC']]
      });

      return res.status(200).json({
        success: true,
        payments: payments,
        count: payments.length
      });

    } catch (error) {
      console.error('Error fetching payments by status:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch payments'
      });
    }
  }

  /**
   * Get payments by user
   */
  async getPaymentsByUser(req, res) {
    try {
      const { user_id } = req.params;
      
      // Get payments through bookings
      const payments = await Payment.findAll({
        include: [{
          model: Booking,
          where: { userId: user_id },
          as: 'Bookings'
        }],
        order: [['createdAt', 'DESC']]
      });

      return res.status(200).json({
        success: true,
        payments: payments,
        count: payments.length
      });

    } catch (error) {
      console.error('Error fetching user payments:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch user payments'
      });
    }
  }

  /**
   * Get payment summary/analytics
   */
  async getPaymentSummary(req, res) {
    try {
      const { startDate, endDate, status, method } = req.query;
      
      const filters = {};
      if (startDate && endDate) {
        filters.startDate = startDate;
        filters.endDate = endDate;
      }
      if (status) filters.status = status;
      if (method) filters.method = method;

      const result = await paymentService.getPaymentSummary(filters);

      if (result.success) {
        return res.status(200).json({
          success: true,
          summary: result.summary
        });
      } else {
        return res.status(500).json({
          success: false,
          message: result.message
        });
      }

    } catch (error) {
      console.error('Error fetching payment summary:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch payment summary'
      });
    }
  }

  /**
   * Legacy payment callback handler
   */
  async paymentCallback(req, res) {
    try {
      console.log('📨 Generic payment callback received:', req.body);
      
      // Route to appropriate callback handler based on payment method
      const { method, provider } = req.body;
      
      if (method === 'mpesa' || provider === 'mpesa') {
        return this.handleMpesaCallback(req, res);
      }
      
      // Handle other payment methods here
      
      return res.status(200).json({
        success: true,
        message: 'Callback received'
      });

    } catch (error) {
      console.error('Error handling payment callback:', error);
      return res.status(200).json({
        success: true,
        message: 'Callback processed'
      });
    }
  }
}

module.exports = new PaymentController();