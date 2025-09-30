// services/enhancedBookingService.js - Fixed version

import axios from 'axios';
import { getTokenFromCookie } from '../config/api';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';

class EnhancedBookingService {
    constructor() {
        this.api = axios.create({
            baseURL: API_BASE_URL,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 20000
        });

        // Add auth token to requests
        this.api.interceptors.request.use((config) => {
            const token = getTokenFromCookie();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });

        this.api.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    const currentPath = window.location.pathname;
                    if (!currentPath.includes('/login')) {
                        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    // ==================== SLOT GENERATION ====================

    async getAvailableSlotsForOffer(offerId, date) {
        try {
            if (!offerId || !date) {
                throw new Error('Offer ID and date are required');
            }

            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                throw new Error('Date must be in YYYY-MM-DD format');
            }

            let response;
            let lastError;

            // Try the dedicated offer slots endpoint first
            try {
                response = await this.api.get('/bookings/offer-slots', {
                    params: { offerId, date },
                    timeout: 15000
                });

                if (response.data && (response.data.success || response.data.availableSlots)) {
                    return this.normalizeSlotResponse(response.data, 'offer', offerId);
                }
            } catch (error) {
                lastError = error;
            }

            // Fallback to unified slots endpoint
            try {
                response = await this.api.get('/bookings/slots/unified', {
                    params: { entityId: offerId, entityType: 'offer', date },
                    timeout: 15000
                });

                if (response.data && response.data.success) {
                    return this.normalizeSlotResponse(response.data, 'offer', offerId);
                }
            } catch (error) {
                lastError = error;
            }

            // Final fallback to legacy endpoint
            try {
                response = await this.api.get('/bookings/slots', {
                    params: { offerId, date, bookingType: 'offer' },
                    timeout: 15000
                });

                if (response.data) {
                    return this.normalizeSlotResponse(response.data, 'offer', offerId);
                }
            } catch (error) {
                lastError = error;
            }

            // Handle business rule violations
            if (lastError?.response?.data?.message && this.isBusinessRuleViolation(lastError.response.data.message)) {
                return {
                    success: false,
                    message: lastError.response.data.message,
                    availableSlots: [],
                    detailedSlots: [],
                    businessRuleViolation: true,
                    bookingType: 'offer',
                    storeInfo: lastError.response.data.storeInfo,
                    branchInfo: lastError.response.data.branchInfo
                };
            }

            throw lastError || new Error('Unable to fetch offer slots');

        } catch (error) {
            return this.handleSlotError(error, 'offer');
        }
    }

    async getAvailableSlotsForService(serviceId, date) {
        try {
            if (!serviceId || !date) {
                throw new Error('Service ID and date are required');
            }

            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                throw new Error('Date must be in YYYY-MM-DD format');
            }

            let response;
            let lastError;

            // Try the dedicated service slots endpoint first
            try {
                response = await this.api.get('/bookings/service-slots', {
                    params: { serviceId, date },
                    timeout: 15000
                });

                if (response.data && (response.data.success || response.data.availableSlots)) {
                    return this.normalizeSlotResponse(response.data, 'service', serviceId);
                }
            } catch (error) {
                lastError = error;
            }

            // Fallback to unified slots endpoint
            try {
                response = await this.api.get('/bookings/slots/unified', {
                    params: { entityId: serviceId, entityType: 'service', date },
                    timeout: 15000
                });

                if (response.data && response.data.success) {
                    return this.normalizeSlotResponse(response.data, 'service', serviceId);
                }
            } catch (error) {
                lastError = error;
            }

            // Final fallback to legacy endpoint
            try {
                response = await this.api.get('/bookings/slots', {
                    params: { serviceId, date, bookingType: 'service' },
                    timeout: 15000
                });

                if (response.data) {
                    return this.normalizeSlotResponse(response.data, 'service', serviceId);
                }
            } catch (error) {
                lastError = error;
            }

            // Handle business rule violations
            if (lastError?.response?.data?.message && this.isBusinessRuleViolation(lastError.response.data.message)) {
                return {
                    success: false,
                    message: lastError.response.data.message,
                    availableSlots: [],
                    detailedSlots: [],
                    businessRuleViolation: true,
                    bookingType: 'service',
                    storeInfo: lastError.response.data.storeInfo,
                    branchInfo: lastError.response.data.branchInfo
                };
            }

            throw lastError || new Error('Unable to fetch service slots');

        } catch (error) {
            return this.handleSlotError(error, 'service');
        }
    }

    // Helper method to normalize slot responses
    normalizeSlotResponse(data, bookingType, entityId) {
        const result = {
            success: true,
            availableSlots: data.availableSlots || [],
            detailedSlots: data.detailedSlots || [],
            bookingRules: data.bookingRules || null,
            storeInfo: data.storeInfo || null,
            branchInfo: data.branchInfo || null,
            bookingType: bookingType
        };

        // Set payment requirements based on booking type
        if (bookingType === 'offer') {
            result.accessFee = data.accessFee || this.calculateDefaultAccessFee(data.discount);
            result.requiresPayment = true;
        } else {
            result.accessFee = 0;
            result.requiresPayment = false;
        }

        return result;
    }

    // Helper to identify business rule violations
    isBusinessRuleViolation(message) {
        const violations = [
            'closed', 'not open', 'working days', 'business hours',
            'outside operating hours', 'branch not operational',
            'service not available on this day'
        ];
        return violations.some(violation => message.toLowerCase().includes(violation));
    }

    // Enhanced slot error handling
    handleSlotError(error, bookingType) {
        const message = error.response?.data?.message || error.message;
        
        if (this.isBusinessRuleViolation(message)) {
            return {
                success: false,
                message: message,
                availableSlots: [],
                detailedSlots: [],
                businessRuleViolation: true,
                bookingType: bookingType,
                storeInfo: error.response?.data?.storeInfo,
                branchInfo: error.response?.data?.branchInfo
            };
        }

        throw this.handleError(error);
    }

    // ==================== BOOKING CREATION ====================

    async createBooking(bookingData) {
        try {
            // Validate required fields
            this.validateBookingData(bookingData);

            const isOfferBooking = bookingData.offerId || bookingData.bookingType === 'offer';
            const isServiceBooking = bookingData.serviceId || bookingData.bookingType === 'service';

            if (!isOfferBooking && !isServiceBooking) {
                throw new Error('Booking must specify either offerId or serviceId');
            }

            // Prepare payload with proper booking type
            const payload = {
                ...bookingData,
                bookingType: isOfferBooking ? 'offer' : 'service'
            };

            // Handle service bookings (no payment required)
            if (isServiceBooking) {
                delete payload.paymentData;
                payload.accessFee = 0;
            }

            // FIXED: Remove the problematic validation call
            // The startTime is already properly formatted from the frontend
            // No need for additional validation here

            let response;
            
            // Try dedicated booking endpoint first
            try {
                if (isOfferBooking) {
                    response = await this.api.post('/bookings/offers', payload);
                } else {
                    response = await this.api.post('/bookings/service', payload);
                }
            } catch (error) {
                // Fallback to general booking endpoint
                response = await this.api.post('/bookings', payload);
            }

            if (response.data && response.data.success) {
                return response.data;
            } else {
                throw new Error(response.data?.message || 'Booking creation failed');
            }

        } catch (error) {
            throw this.handleError(error);
        }
    }

    // Validate booking data before submission
    validateBookingData(data) {
        const required = ['userId', 'startTime'];
        const missing = required.filter(field => !data[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        // Validate entity IDs
        if (!data.offerId && !data.serviceId) {
            throw new Error('Either offerId or serviceId is required');
        }

        // Basic datetime format validation
        if (data.startTime && typeof data.startTime === 'string') {
            // Check if it's a valid datetime format
            const date = new Date(data.startTime);
            if (isNaN(date.getTime())) {
                throw new Error(`Invalid datetime format: ${data.startTime}`);
            }
        }
    }

    // ==================== BRANCH AND STAFF MANAGEMENT ====================

    async getBranchForOffer(offerId) {
        try {
            if (!offerId) {
                throw new Error('Offer ID is required');
            }

            let response;
            let lastError;

            // Try the dedicated branch endpoint first
            try {
                response = await this.api.get(`/bookings/offers/${offerId}/branch`);
                if (response.data && response.data.success && response.data.branch) {
                    return response.data;
                }
            } catch (error) {
                lastError = error;
            }

            // Fallback to legacy endpoint
            try {
                response = await this.api.get(`/bookings/branches/offer/${offerId}`);
                if (response.data && response.data.branch) {
                    return response.data;
                }
            } catch (error) {
                lastError = error;
            }

            // Final fallback: extract from offer details
            try {
                const offerResponse = await this.api.get(`/offers/${offerId}`);
                
                if (offerResponse.data && (offerResponse.data.success || offerResponse.data.offer)) {
                    const offer = offerResponse.data.offer || offerResponse.data;
                    
                    if (offer.service?.store) {
                        const extractedBranch = this.extractBranchFromEntity(offer, 'offer');
                        return extractedBranch;
                    }
                }
            } catch (error) {
                lastError = error;
            }

            // Return empty result if all methods fail
            return {
                success: false,
                branch: null,
                branches: [],
                message: 'Branch information not available for this offer',
                error: lastError?.response?.data?.message || lastError?.message || 'Unknown error'
            };

        } catch (error) {
            return {
                success: false,
                branch: null,
                branches: [],
                message: error.message || 'Failed to fetch branch information',
                error: error.message
            };
        }
    }

    async getBranchForService(serviceId) {
        try {
            if (!serviceId) {
                throw new Error('Service ID is required');
            }

            let response;
            let lastError;

            // Try the dedicated branch endpoint first
            try {
                response = await this.api.get(`/bookings/services/${serviceId}/branch`);
                if (response.data && response.data.success && response.data.branch) {
                    return response.data;
                }
            } catch (error) {
                lastError = error;
            }

            // Fallback to legacy endpoint
            try {
                response = await this.api.get(`/bookings/branches/service/${serviceId}`);
                if (response.data && response.data.branch) {
                    return response.data;
                }
            } catch (error) {
                lastError = error;
            }

            // Final fallback: extract from service details
            try {
                const serviceResponse = await this.api.get(`/services/${serviceId}`);
                
                if (serviceResponse.data && (serviceResponse.data.success || serviceResponse.data.service)) {
                    const service = serviceResponse.data.service || serviceResponse.data;
                    
                    if (service.store) {
                        const extractedBranch = this.extractBranchFromEntity(service, 'service');
                        return extractedBranch;
                    }
                }
            } catch (error) {
                lastError = error;
            }

            return {
                success: false,
                branch: null,
                branches: [],
                message: 'Branch information not available for this service',
                error: lastError?.response?.data?.message || lastError?.message || 'Unknown error'
            };

        } catch (error) {
            return {
                success: false,
                branch: null,
                branches: [],
                message: error.message || 'Failed to fetch branch information',
                error: error.message
            };
        }
    }

    // Helper to extract branch from entity data
    extractBranchFromEntity(entity, entityType) {
        try {
            let service, store;
            
            if (entityType === 'offer') {
                service = entity.service;
                store = service?.store;
            } else {
                service = entity;
                store = entity.store;
            }
            
            if (!store) {
                return {
                    success: false,
                    branch: null,
                    branches: [],
                    message: 'Store information not available'
                };
            }

            // Handle working days - ensure it's always an array
            let workingDays = store.working_days;
            if (typeof workingDays === 'string') {
                try {
                    workingDays = JSON.parse(workingDays);
                } catch (e) {
                    workingDays = workingDays.split(',').map(day => day.trim());
                }
            }
            if (!Array.isArray(workingDays)) {
                workingDays = [];
            }

            const branch = {
                id: `store-${store.id}`,
                name: store.name + ' (Main Branch)',
                address: store.location,
                location: store.location,
                phone: store.phone_number,
                openingTime: store.opening_time,
                closingTime: store.closing_time,
                workingDays: workingDays,
                isMainBranch: true,
                storeId: store.id
            };

            return {
                success: true,
                branch: branch,
                branches: [branch],
                source: 'entity_extraction'
            };
        } catch (error) {
            return {
                success: false,
                branch: null,
                branches: [],
                message: 'Failed to extract branch information'
            };
        }
    }

    async getStaffForOffer(offerId) {
        try {
            if (!offerId) {
                throw new Error('Offer ID is required');
            }

            let response;

            // Try dedicated staff endpoint
            try {
                response = await this.api.get(`/bookings/offers/${offerId}/staff`);
                if (response.data && response.data.success) {
                    return response.data;
                }
            } catch (error) {
                // Ignore error and try fallback
            }

            // Fallback to legacy endpoint
            try {
                response = await this.api.get(`/bookings/staff/offer/${offerId}`);
                if (response.data) {
                    return response.data;
                }
            } catch (error) {
                // Ignore error
            }

            return {
                success: true,
                staff: [],
                message: 'Staff information not available for this offer'
            };

        } catch (error) {
            return {
                success: false,
                staff: [],
                message: error.message || 'Failed to fetch staff information'
            };
        }
    }

    async getStaffForService(serviceId) {
        try {
            if (!serviceId) {
                throw new Error('Service ID is required');
            }

            let response;

            // Try dedicated staff endpoint
            try {
                response = await this.api.get(`/bookings/services/${serviceId}/staff`);
                if (response.data && response.data.success) {
                    return response.data;
                }
            } catch (error) {
                // Ignore error and try fallback
            }

            // Fallback to legacy endpoint
            try {
                response = await this.api.get(`/bookings/staff/service/${serviceId}`);
                if (response.data) {
                    return response.data;
                }
            } catch (error) {
                // Ignore error
            }

            return {
                success: true,
                staff: [],
                message: 'Staff information not available for this service'
            };

        } catch (error) {
            return {
                success: false,
                staff: [],
                message: error.message || 'Failed to fetch staff information'
            };
        }
    }

    // ==================== USER BOOKINGS ====================

    async getUserBookings(params = {}) {
        try {
            const response = await this.api.get('/bookings/user', { 
                params,
                timeout: 20000 
            });
            
            if (response.data) {
                if (response.data.success !== undefined) {
                    return response.data;
                } else if (response.data.bookings) {
                    return {
                        success: true,
                        bookings: response.data.bookings,
                        pagination: response.data.pagination,
                        summary: response.data.summary
                    };
                } else if (Array.isArray(response.data)) {
                    return {
                        success: true,
                        bookings: response.data,
                        pagination: { total: response.data.length, totalPages: 1 }
                    };
                }
            }
            
            return {
                success: true,
                bookings: [],
                pagination: { total: 0, totalPages: 0 },
                message: 'No bookings found'
            };
            
        } catch (error) {
            return {
                success: false,
                bookings: [],
                pagination: { total: 0, totalPages: 0 },
                message: this.getBookingErrorMessage(error),
                error: error.message
            };
        }
    }

    async getBookingById(bookingId) {
        try {
            if (!bookingId) {
                throw new Error('Booking ID is required');
            }

            // Validate booking ID format (assuming UUID format)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(bookingId)) {
                throw new Error('Invalid booking ID format');
            }

            let response;
            let lastError;

            // Try the primary endpoint
            try {
                response = await this.api.get(`/bookings/${bookingId}`, {
                    timeout: 15000
                });

                if (response.data && (response.data.success || response.data.booking)) {
                    return {
                        success: true,
                        booking: response.data.booking || response.data,
                        message: 'Booking details retrieved successfully'
                    };
                }
            } catch (error) {
                lastError = error;

                // If it's a 404, the booking doesn't exist
                if (error.response?.status === 404) {
                    return {
                        success: false,
                        booking: null,
                        message: 'Booking not found. It may have been deleted or you may not have permission to view it.',
                        notFound: true
                    };
                }

                // If it's a 500 error, try alternative approach
                if (error.response?.status === 500) {
                    try {
                        const userBookingsResponse = await this.api.get('/bookings/user', {
                            params: { 
                                limit: 100,
                                bookingId: bookingId
                            },
                            timeout: 10000
                        });

                        if (userBookingsResponse.data?.bookings) {
                            const foundBooking = userBookingsResponse.data.bookings.find(
                                booking => booking.id === bookingId
                            );

                            if (foundBooking) {
                                return {
                                    success: true,
                                    booking: foundBooking,
                                    message: 'Booking details retrieved successfully',
                                    source: 'user_bookings_fallback'
                                };
                            }
                        }
                    } catch (fallbackError) {
                        // Ignore fallback error
                    }
                }
            }

            throw lastError || new Error('Unable to fetch booking details');

        } catch (error) {
            return {
                success: false,
                booking: null,
                message: this.getBookingErrorMessage(error),
                error: error.message,
                statusCode: error.response?.status
            };
        }
    }

    getBookingErrorMessage(error) {
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;
            
            switch (status) {
                case 400:
                    return 'Invalid booking request. Please check the booking ID and try again.';
                case 401:
                    return 'You need to be logged in to view this booking.';
                case 403:
                    return 'You do not have permission to view this booking.';
                case 404:
                    return 'Booking not found. It may have been cancelled or deleted.';
                case 429:
                    return 'Too many requests. Please wait a moment and try again.';
                case 500:
                    return 'Server error occurred while retrieving booking details. Please try again in a few moments.';
                case 502:
                case 503:
                case 504:
                    return 'Service temporarily unavailable. Please try again later.';
                default:
                    return data?.message || 'An unexpected error occurred while retrieving booking details.';
            }
        } else if (error.request) {
            return 'Network error. Please check your connection and try again.';
        } else {
            return error.message || 'An unexpected error occurred.';
        }
    }

    async cancelBooking(bookingId, reason = '', refundRequested = false) {
        try {
            const response = await this.api.put(`/bookings/${bookingId}/cancel`, {
                reason,
                refundRequested
            });

            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async updateBookingStatus(bookingId, status) {
        try {
            const response = await this.api.put(`/bookings/${bookingId}/status`, { status });
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // ==================== PAYMENT PROCESSING ====================

    async processMpesaPayment(phoneNumber, amount, bookingId) {
        try {
            const response = await this.api.post('/payments/mpesa', {
                phoneNumber,
                amount: parseFloat(amount),
                bookingId,
                type: 'booking_access_fee'
            });

            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async checkPaymentStatus(paymentId) {
        try {
            const response = await this.api.get(`/payments/${paymentId}/status`);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // ==================== UTILITY METHODS ====================

    calculateDefaultAccessFee(discount) {
        if (!discount) return 5.99;
        return (parseFloat(discount) * 0.15).toFixed(2);
    }

    calculateAccessFee(discount) {
        return this.calculateDefaultAccessFee(discount);
    }

    // Enhanced error handling
    handleError(error) {
        if (error.response) {
            const data = error.response.data;
            let message = data?.message || data?.error || 'Server error occurred';
            
            // Handle specific error cases
            switch (error.response.status) {
                case 400:
                    if (message.includes('datetime') || message.includes('time format')) {
                        message = 'Invalid time format. Please try selecting a different time slot.';
                    } else if (message.includes('not found')) {
                        message = 'The selected item is no longer available.';
                    }
                    break;
                case 401:
                    message = 'Authentication required. Please log in again.';
                    break;
                case 403:
                    message = 'You do not have permission to perform this action.';
                    break;
                case 404:
                    message = 'The requested resource was not found.';
                    break;
                case 409:
                    message = 'This time slot is no longer available. Please select a different time.';
                    break;
                case 429:
                    message = 'Too many requests. Please wait a moment and try again.';
                    break;
                default:
                    if (error.response.status >= 500) {
                        message = 'Server error occurred. Please try again in a few moments.';
                    }
            }
            
            const newError = new Error(message);
            newError.status = error.response.status;
            newError.response = error.response;
            return newError;
        } else if (error.request) {
            return new Error('Network error. Please check your connection and try again.');
        } else {
            return error;
        }
    }

    // ==================== LEGACY COMPATIBILITY ====================

    async getStoresForOffer(offerId) {
        const branchResult = await this.getBranchForOffer(offerId);

        return {
            success: true,
            stores: branchResult.branch ? [this.branchToStoreFormat(branchResult.branch)] : [],
            message: branchResult.message
        };
    }

    async getStoresForService(serviceId) {
        const branchResult = await this.getBranchForService(serviceId);

        return {
            success: true,
            stores: branchResult.branch ? [this.branchToStoreFormat(branchResult.branch)] : [],
            message: branchResult.message
        };
    }

    // Convert branch format to legacy store format
    branchToStoreFormat(branch) {
        return {
            id: branch.id,
            name: branch.name,
            location: branch.address || branch.location,
            address: branch.address || branch.location,
            phone: branch.phone,
            phone_number: branch.phone,
            opening_time: branch.openingTime,
            closing_time: branch.closingTime,
            working_days: branch.workingDays
        };
    }
}

const enhancedBookingService = new EnhancedBookingService();

export default enhancedBookingService;

export const {
    getAvailableSlots,
    getAvailableSlotsForOffer,
    getAvailableSlotsForService,
    createBooking,
    getBranchForOffer,
    getBranchForService,
    getStoresForOffer,
    getStoresForService,
    getStaffForOffer,
    getStaffForService,
    getUserBookings,
    getBookingById,
    updateBookingStatus,
    cancelBooking,
    processMpesaPayment,
    checkPaymentStatus,
    calculateAccessFee,
    handleError
} = enhancedBookingService;