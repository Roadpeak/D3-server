// services/bookingService.js
import api from './api';

class BookingService {
  // Get available time slots for an offer
  async getAvailableSlots(offerId, date) {
    try {
      console.log('🔍 Getting available slots for offer:', offerId, 'on date:', date);
      
      const response = await api.get('/bookings/get-slots', {
        params: { offerId, date }
      });
      
      console.log('✅ Available slots response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error getting available slots:', error);
      throw this.handleBookingError(error);
    }
  }

  // Get stores for booking selection
  async getStoresForOffer(offerId) {
    try {
      const response = await api.get(`/offers/${offerId}`);
      const offer = response.data.offer;
      
      // Return the store associated with the offer
      if (offer && offer.store) {
        return {
          success: true,
          stores: [offer.store]
        };
      }
      
      throw new Error('No store found for this offer');
    } catch (error) {
      console.error('❌ Error getting stores for offer:', error);
      throw this.handleBookingError(error);
    }
  }

  // Get staff for booking selection
  async getStaffForStore(storeId) {
    try {
      const response = await api.get(`/staff/store/${storeId}`);
      return {
        success: true,
        staff: response.data.staff || response.data || []
      };
    } catch (error) {
      console.error('❌ Error getting staff for store:', error);
      // Return empty staff list if endpoint doesn't exist
      return {
        success: true,
        staff: []
      };
    }
  }

  // Create a new booking with payment
  async createBooking(bookingData) {
    try {
      console.log('📝 Creating booking with data:', bookingData);
      
      // Validate required fields
      this.validateBookingData(bookingData);
      
      // For offer bookings, create payment first
      let paymentData = null;
      if (bookingData.type === 'offer' && bookingData.requiresPayment) {
        paymentData = await this.createPayment(bookingData);
      }
      
      // Prepare booking payload
      const bookingPayload = {
        offerId: bookingData.offerId,
        userId: bookingData.userId,
        startTime: this.formatDateTime(bookingData.date, bookingData.time),
        paymentUniqueCode: paymentData?.unique_code || null,
        // Additional fields for enhanced booking
        storeId: bookingData.storeId,
        staffId: bookingData.staffId,
        notes: bookingData.notes || '',
        clientInfo: {
          name: bookingData.clientName,
          email: bookingData.clientEmail,
          phone: bookingData.clientPhone
        }
      };
      
      console.log('📤 Sending booking payload:', bookingPayload);
      
      const response = await api.post('/bookings', bookingPayload);
      
      console.log('✅ Booking created successfully:', response.data);
      
      return {
        success: true,
        booking: response.data.booking,
        payment: paymentData,
        message: 'Booking created successfully'
      };
      
    } catch (error) {
      console.error('❌ Error creating booking:', error);
      throw this.handleBookingError(error);
    }
  }

  // Create payment for offer booking
  async createPayment(bookingData) {
    try {
      const paymentPayload = {
        amount: bookingData.accessFee || 5.99, // Platform access fee
        currency: 'KES',
        paymentMethod: bookingData.paymentMethod || 'mpesa',
        description: `Access fee for ${bookingData.offerTitle}`,
        metadata: {
          offerId: bookingData.offerId,
          userId: bookingData.userId,
          bookingType: 'offer'
        }
      };
      
      const response = await api.post('/payments/create', paymentPayload);
      return response.data.payment;
    } catch (error) {
      console.error('❌ Error creating payment:', error);
      throw new Error('Failed to initialize payment. Please try again.');
    }
  }

  // Process M-Pesa payment
  async processMpesaPayment(phoneNumber, amount, bookingId) {
    try {
      const response = await api.post('/payments/mpesa/stkpush', {
        phoneNumber,
        amount,
        callbackMetadata: {
          bookingId,
          type: 'offer_booking'
        }
      });
      
      return {
        success: true,
        checkoutRequestId: response.data.checkoutRequestId,
        message: 'Payment request sent to your phone'
      };
    } catch (error) {
      console.error('❌ M-Pesa payment error:', error);
      throw new Error('Failed to process M-Pesa payment. Please try again.');
    }
  }

  // Check payment status
  async checkPaymentStatus(paymentId) {
    try {
      const response = await api.get(`/payments/${paymentId}/status`);
      return response.data;
    } catch (error) {
      console.error('❌ Error checking payment status:', error);
      throw this.handleBookingError(error);
    }
  }

  // Get user's bookings
  async getUserBookings(userId, filters = {}) {
    try {
      const params = { userId, ...filters };
      const response = await api.get('/bookings/user', { params });
      
      return {
        success: true,
        bookings: response.data.bookings || response.data || []
      };
    } catch (error) {
      console.error('❌ Error getting user bookings:', error);
      throw this.handleBookingError(error);
    }
  }

  // Cancel a booking
  async cancelBooking(bookingId, reason = '') {
    try {
      const response = await api.patch(`/bookings/${bookingId}`, {
        status: 'cancelled',
        cancellationReason: reason
      });
      
      return {
        success: true,
        booking: response.data.booking,
        message: 'Booking cancelled successfully'
      };
    } catch (error) {
      console.error('❌ Error cancelling booking:', error);
      throw this.handleBookingError(error);
    }
  }

  // Get booking details
  async getBookingDetails(bookingId) {
    try {
      const response = await api.get(`/bookings/${bookingId}`);
      return {
        success: true,
        booking: response.data
      };
    } catch (error) {
      console.error('❌ Error getting booking details:', error);
      throw this.handleBookingError(error);
    }
  }

  // Utility methods
  validateBookingData(data) {
    const required = ['offerId', 'userId', 'date', 'time'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    
    // Validate date is in the future
    const bookingDateTime = new Date(`${data.date}T${this.convertTo24Hour(data.time)}`);
    if (bookingDateTime <= new Date()) {
      throw new Error('Booking date and time must be in the future');
    }
  }

  formatDateTime(date, time) {
    const time24 = this.convertTo24Hour(time);
    return `${date}T${time24}:00.000Z`;
  }

  convertTo24Hour(time12h) {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    
    if (hours === '12') {
      hours = '00';
    }
    if (modifier === 'PM') {
      hours = parseInt(hours, 10) + 12;
    }
    
    return `${hours.padStart(2, '0')}:${minutes}`;
  }

  handleBookingError(error) {
    if (error.response?.data?.message) {
      return new Error(error.response.data.message);
    }
    if (error.message) {
      return new Error(error.message);
    }
    return new Error('An unexpected error occurred during booking');
  }
}

export default new BookingService();