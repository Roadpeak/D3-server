// controllers/paymentController.js - Complete Updated Version

const paymentService = require('../services/paymentService');
const { Payment, Booking, sequelize } = require('../models');

class PaymentController {
  
  // ==================== M-PESA INTEGRATION ====================

  /**
   * Initiate M-Pesa STK Push payment with enhanced merchant validation
   */
  async initiateMpesaPayment(req, res) {
    try {
      const { phoneNumber, amount, bookingId, type = 'booking_access_fee', offerId, serviceId } = req.body;

      console.log('💳 M-Pesa Payment Request:', {
        phoneNumber,
        amount,
        bookingId,
        type,
        offerId,
        serviceId
      });

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

      // ENHANCED: Merchant validation with multiple fallback methods
      let merchantExists = false;
      let merchantInfo = null;
      let debugInfo = {
        offerId,
        serviceId,
        searchMethod: '',
        errors: []
      };

      if (offerId) {
        try {
          console.log('🔍 Searching for offer merchant:', offerId);
          
          // Import models from the correct path
          const { Offer, Service, Store } = require('../models');
          
          // METHOD 1: Try the association-based approach first
          try {
            const offer = await Offer.findByPk(offerId, {
              include: [{
                model: Service,
                as: 'service',
                include: [{
                  model: Store,
                  as: 'store'
                }]
              }]
            });

            console.log('📋 Association-based query result:', {
              hasOffer: !!offer,
              hasService: !!offer?.service,
              hasStore: !!offer?.service?.store
            });

            if (offer && offer.service && offer.service.store) {
              merchantExists = true;
              merchantInfo = {
                type: 'offer',
                entityId: offerId,
                storeId: offer.service.store.id,
                storeName: offer.service.store.name,
                serviceId: offer.service.id,
                serviceName: offer.service.name
              };
              debugInfo.searchMethod = 'association_based';
              console.log('✅ Merchant found via associations');
            } else if (offer) {
              debugInfo.errors.push('Offer found but missing service/store associations');
            }
          } catch (associationError) {
            console.warn('⚠️ Association-based query failed:', associationError.message);
            debugInfo.errors.push(`Association error: ${associationError.message}`);
          }

          // METHOD 2: Fallback to manual joins if associations fail
          if (!merchantExists) {
            try {
              console.log('🔄 Trying manual join approach...');
              
              const offerData = await Offer.findByPk(offerId);
              
              if (offerData && offerData.service_id) {
                const serviceData = await Service.findByPk(offerData.service_id, {
                  include: [{
                    model: Store,
                    as: 'store'
                  }]
                });

                console.log('📋 Manual join result:', {
                  hasOffer: !!offerData,
                  hasService: !!serviceData,
                  hasStore: !!serviceData?.store
                });

                if (serviceData && serviceData.store) {
                  merchantExists = true;
                  merchantInfo = {
                    type: 'offer',
                    entityId: offerId,
                    storeId: serviceData.store.id,
                    storeName: serviceData.store.name,
                    serviceId: serviceData.id,
                    serviceName: serviceData.name
                  };
                  debugInfo.searchMethod = 'manual_join';
                  console.log('✅ Merchant found via manual join');
                } else {
                  debugInfo.errors.push('Service found but missing store association');
                }
              } else {
                debugInfo.errors.push('Offer not found or missing service_id');
              }
            } catch (manualError) {
              console.error('❌ Manual join failed:', manualError.message);
              debugInfo.errors.push(`Manual join error: ${manualError.message}`);
            }
          }

          // METHOD 3: Raw SQL as last resort
          if (!merchantExists) {
            try {
              console.log('🔄 Trying raw SQL approach...');
              
              const [results] = await sequelize.query(`
                SELECT 
                  o.id as offer_id,
                  o.title as offer_title,
                  s.id as service_id,
                  s.name as service_name,
                  st.id as store_id,
                  st.name as store_name,
                  st.status as store_status
                FROM offers o
                JOIN services s ON o.service_id = s.id
                JOIN stores st ON s.store_id = st.id
                WHERE o.id = :offerId
                AND o.status = 'active'
                AND st.status = 'open'
              `, {
                replacements: { offerId },
                type: sequelize.QueryTypes.SELECT
              });

              console.log('📋 Raw SQL result:', results);

              if (results && results.length > 0) {
                const result = results[0];
                merchantExists = true;
                merchantInfo = {
                  type: 'offer',
                  entityId: offerId,
                  storeId: result.store_id,
                  storeName: result.store_name,
                  serviceId: result.service_id,
                  serviceName: result.service_name
                };
                debugInfo.searchMethod = 'raw_sql';
                console.log('✅ Merchant found via raw SQL');
              } else {
                debugInfo.errors.push('Raw SQL returned no results');
              }
            } catch (sqlError) {
              console.error('❌ Raw SQL failed:', sqlError.message);
              debugInfo.errors.push(`Raw SQL error: ${sqlError.message}`);
            }
          }

        } catch (error) {
          console.error('❌ Error validating offer merchant:', error);
          debugInfo.errors.push(`Database error: ${error.message}`);
        }
      } else if (serviceId) {
        // Handle direct service bookings
        try {
          const { Service, Store } = require('../models');
          
          const service = await Service.findByPk(serviceId, {
            include: [{
              model: Store,
              as: 'store'
            }]
          });

          if (service && service.store) {
            merchantExists = true;
            merchantInfo = {
              type: 'service',
              entityId: serviceId,
              storeId: service.store.id,
              storeName: service.store.name,
              serviceId: serviceId,
              serviceName: service.name
            };
            debugInfo.searchMethod = 'service_direct';
            console.log('✅ Merchant found for service booking');
          } else {
            debugInfo.errors.push('Service not found or missing store association');
          }
        } catch (error) {
          debugInfo.errors.push(`Service validation error: ${error.message}`);
        }
      }

      // Log final merchant validation result
      console.log('🏪 Final merchant validation:', {
        merchantExists,
        merchantInfo,
        debugInfo
      });

      // Return detailed error if merchant doesn't exist
      if (!merchantExists) {
        return res.status(400).json({
          success: false,
          message: 'Merchant does not exist',
          error: 'The offer/service is not properly associated with a merchant store.',
          debug: debugInfo,
          troubleshooting: {
            possibleCauses: [
              'Offer exists but service association is broken',
              'Service exists but store association is broken', 
              'Sequelize associations not properly defined',
              'Database foreign key constraints missing',
              'Store is not in "open" status'
            ],
            recommendations: [
              'Check your Sequelize model associations in models/index.js',
              'Verify foreign keys exist in database tables',
              'Ensure store status is "open"',
              'Run database integrity check'
            ]
          }
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

      // Create enhanced description
      const description = `Access Fee - ${merchantInfo.storeName} - ${merchantInfo.serviceName}`;

      console.log('🚀 Proceeding with STK Push:', {
        merchantInfo,
        amount: paymentAmount,
        description
      });

      // Initiate STK Push
      const result = await paymentService.initiateSTKPush(
        phoneNumber,
        paymentAmount,
        bookingId || `temp-${Date.now()}`,
        description
      );

      if (result.success) {
        console.log('✅ STK Push successful');
        
        // Update payment record with merchant info
        if (result.payment) {
          await result.payment.update({
            metadata: {
              ...result.payment.metadata,
              merchantInfo: merchantInfo,
              debugInfo: debugInfo
            }
          });
        }

        // Update booking with payment ID if booking exists
        if (booking) {
          await booking.update({ 
            paymentId: result.payment.id,
            paymentUniqueCode: result.payment.unique_code
          });
        }

        return res.status(200).json({
          success: true,
          message: 'M-Pesa payment initiated successfully. Please check your phone for the payment prompt.',
          payment: {
            id: result.payment.id,
            unique_code: result.payment.unique_code,
            amount: result.payment.amount,
            status: result.payment.status,
            checkoutRequestId: result.checkoutRequestId
          },
          merchantInfo: {
            storeName: merchantInfo.storeName,
            storeId: merchantInfo.storeId,
            serviceName: merchantInfo.serviceName
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
        error: process.env.NODE_ENV === 'development' ? error.stack : 'Payment service temporarily unavailable'
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
        
        // If payment was successful and has booking data, create the booking
        if (result.payment && result.payment.status === 'completed' && result.payment.metadata?.bookingData) {
          try {
            const bookingData = result.payment.metadata.bookingData;
            
            // Add payment info to booking data
            bookingData.paymentId = result.payment.id;
            bookingData.paymentUniqueCode = result.payment.unique_code;
            bookingData.accessFee = result.payment.amount;
            bookingData.status = 'confirmed';
            bookingData.bookingType = 'offer';
            
            // Import booking controller and create the booking
            const offerBookingController = require('../controllers/offerBookingController');
            
            // Create mock req/res objects for the controller
            const mockReq = { body: bookingData };
            const mockRes = {
              status: () => mockRes,
              json: (data) => {
                console.log('Booking created after payment:', data.success ? 'SUCCESS' : 'FAILED');
                return data;
              }
            };
            
            await offerBookingController.createBooking(mockReq, mockRes);
            
          } catch (bookingError) {
            console.error('⚠️ Error creating booking after payment:', bookingError);
          }
        }
  
        return res.status(200).json({
          ResultCode: 0,
          ResultDesc: "Callback processed successfully"
        });
      } else {
        console.log('❌ M-Pesa callback processing failed:', result.message);
        
        return res.status(200).json({
          ResultCode: 0,
          ResultDesc: "Callback received"
        });
      }
  
    } catch (error) {
      console.error('❌ M-Pesa callback processing error:', error);
      
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