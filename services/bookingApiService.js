// bookingApiService.js - Dedicated API service for booking operations

import axiosInstance from "./axiosInstance";
import merchantAuthService from "./merchantAuthService";

// Helper function to get auth headers
const getAuthHeaders = () => {
    const token = merchantAuthService.getToken();
    const headers = {
        'Content-Type': 'application/json'
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
};

// Helper function to handle API errors
const handleApiError = (error, context = '') => {
    console.error(`Booking API Error ${context}:`, error);

    // Handle authentication errors
    if (error.response?.status === 401) {
        merchantAuthService.logout();
        throw new Error('Session expired. Please log in again.');
    }

    // Handle other HTTP errors
    if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
    }

    // Handle network errors
    if (error.message === 'Network Error') {
        throw new Error('Network error. Please check your connection.');
    }

    throw error;
};

// Helper function to get merchant's store ID
const getMerchantStoreId = async () => {
    try {
        const merchant = merchantAuthService.getCurrentMerchant();
        if (!merchant) {
            throw new Error('Merchant information not found. Please log in again.');
        }

        // For now, we'll assume the store ID is available in merchant data
        // In a real implementation, you might need to fetch this from a stores endpoint
        return merchant.storeId || merchant.store_id || 'default-store';
    } catch (error) {
        console.error('Error getting merchant store ID:', error);
        throw error;
    }
};

// ===== SERVICE BOOKING METHODS =====

/**
 * Get all service bookings for the current merchant
 */
export const getMerchantServiceBookings = async (params = {}) => {
    try {
        console.log('Fetching merchant service bookings with params:', params);

        const response = await axiosInstance.get('/merchant/bookings/services', {
            headers: getAuthHeaders(),
            params: {
                limit: 50,
                offset: 0,
                ...params
            }
        });

        console.log('Service bookings response:', response.data);

        if (response.data.success) {
            return {
                success: true,
                bookings: response.data.bookings || [],
                pagination: response.data.pagination,
                summary: response.data.summary
            };
        }

        return response.data;
    } catch (error) {
        console.error('Error fetching merchant service bookings:', error);
        
        // Fallback to mock data for development
        if (error.response?.status === 404 || error.response?.status === 501) {
            return generateMockServiceBookings(params.limit || 20);
        }
        
        handleApiError(error, 'fetching service bookings');
    }
};

/**
 * Get specific service booking by ID
 */
export const getServiceBookingById = async (bookingId) => {
    try {
        console.log('Fetching service booking by ID:', bookingId);

        const response = await axiosInstance.get(`/merchant/bookings/services/${bookingId}`, {
            headers: getAuthHeaders()
        });

        if (response.data.success) {
            return response.data;
        }

        throw new Error(response.data.message || 'Failed to fetch service booking');
    } catch (error) {
        console.error('Error fetching service booking by ID:', error);
        handleApiError(error, 'fetching service booking');
    }
};

/**
 * Update service booking status
 */
export const updateServiceBookingStatus = async (bookingId, status, notes = '') => {
    try {
        console.log('Updating service booking status:', { bookingId, status, notes });

        const response = await axiosInstance.put(`/merchant/bookings/services/${bookingId}/status`, {
            status,
            notes
        }, {
            headers: getAuthHeaders()
        });

        if (response.data.success) {
            return response.data;
        }

        throw new Error(response.data.message || 'Failed to update booking status');
    } catch (error) {
        console.error('Error updating service booking status:', error);
        handleApiError(error, 'updating service booking status');
    }
};

/**
 * Check in a service booking
 */
export const checkInServiceBooking = async (bookingId, arrivalTime = null, notes = '') => {
    try {
        const checkInData = {
            status: 'in_progress',
            notes: notes || 'Customer checked in',
            checkedInAt: new Date().toISOString(),
            actualArrivalTime: arrivalTime || new Date().toTimeString().slice(0, 5)
        };

        return await updateServiceBookingStatus(bookingId, 'in_progress', 
            `${notes || 'Customer checked in'}. Arrival time: ${checkInData.actualArrivalTime}`);
    } catch (error) {
        console.error('Error checking in service booking:', error);
        handleApiError(error, 'checking in service booking');
    }
};

/**
 * Complete a service booking
 */
export const completeServiceBooking = async (bookingId, notes = '') => {
    try {
        return await updateServiceBookingStatus(bookingId, 'completed', 
            notes || 'Service completed successfully');
    } catch (error) {
        console.error('Error completing service booking:', error);
        handleApiError(error, 'completing service booking');
    }
};

/**
 * Confirm a service booking
 */
export const confirmServiceBooking = async (bookingId, notes = '') => {
    try {
        return await updateServiceBookingStatus(bookingId, 'confirmed', 
            notes || 'Booking confirmed by merchant');
    } catch (error) {
        console.error('Error confirming service booking:', error);
        handleApiError(error, 'confirming service booking');
    }
};

/**
 * Cancel a service booking
 */
export const cancelServiceBooking = async (bookingId, reason = '') => {
    try {
        return await updateServiceBookingStatus(bookingId, 'cancelled', 
            reason || 'Booking cancelled by merchant');
    } catch (error) {
        console.error('Error cancelling service booking:', error);
        handleApiError(error, 'cancelling service booking');
    }
};

// ===== OFFER BOOKING METHODS =====

/**
 * Get all offer bookings for the current merchant
 */
export const getMerchantOfferBookings = async (params = {}) => {
    try {
        console.log('Fetching merchant offer bookings with params:', params);

        const response = await axiosInstance.get('/merchant/bookings/offers', {
            headers: getAuthHeaders(),
            params: {
                limit: 50,
                offset: 0,
                ...params
            }
        });

        console.log('Offer bookings response:', response.data);

        if (response.data.success) {
            return {
                success: true,
                bookings: response.data.bookings || [],
                pagination: response.data.pagination,
                summary: response.data.summary
            };
        }

        return response.data;
    } catch (error) {
        console.error('Error fetching merchant offer bookings:', error);
        
        // Fallback to mock data for development
        if (error.response?.status === 404 || error.response?.status === 501) {
            return generateMockOfferBookings(params.limit || 20);
        }
        
        handleApiError(error, 'fetching offer bookings');
    }
};

/**
 * Get specific offer booking by ID
 */
export const getOfferBookingById = async (bookingId) => {
    try {
        console.log('Fetching offer booking by ID:', bookingId);

        const response = await axiosInstance.get(`/merchant/bookings/offers/${bookingId}`, {
            headers: getAuthHeaders()
        });

        if (response.data.success) {
            return response.data;
        }

        throw new Error(response.data.message || 'Failed to fetch offer booking');
    } catch (error) {
        console.error('Error fetching offer booking by ID:', error);
        handleApiError(error, 'fetching offer booking');
    }
};

/**
 * Update offer booking status
 */
export const updateOfferBookingStatus = async (bookingId, status, notes = '') => {
    try {
        console.log('Updating offer booking status:', { bookingId, status, notes });

        const response = await axiosInstance.put(`/merchant/bookings/offers/${bookingId}/status`, {
            status,
            notes
        }, {
            headers: getAuthHeaders()
        });

        if (response.data.success) {
            return response.data;
        }

        throw new Error(response.data.message || 'Failed to update offer booking status');
    } catch (error) {
        console.error('Error updating offer booking status:', error);
        handleApiError(error, 'updating offer booking status');
    }
};

/**
 * Check in an offer booking
 */
export const checkInOfferBooking = async (bookingId, arrivalTime = null, notes = '') => {
    try {
        const checkInData = {
            status: 'in_progress',
            notes: notes || 'Customer checked in for offer',
            checkedInAt: new Date().toISOString(),
            actualArrivalTime: arrivalTime || new Date().toTimeString().slice(0, 5)
        };

        return await updateOfferBookingStatus(bookingId, 'in_progress', 
            `${notes || 'Customer checked in for offer'}. Arrival time: ${checkInData.actualArrivalTime}`);
    } catch (error) {
        console.error('Error checking in offer booking:', error);
        handleApiError(error, 'checking in offer booking');
    }
};

/**
 * Complete an offer booking
 */
export const completeOfferBooking = async (bookingId, notes = '') => {
    try {
        return await updateOfferBookingStatus(bookingId, 'completed', 
            notes || 'Offer service completed successfully');
    } catch (error) {
        console.error('Error completing offer booking:', error);
        handleApiError(error, 'completing offer booking');
    }
};

/**
 * Confirm an offer booking
 */
export const confirmOfferBooking = async (bookingId, notes = '') => {
    try {
        return await updateOfferBookingStatus(bookingId, 'confirmed', 
            notes || 'Offer booking confirmed by merchant');
    } catch (error) {
        console.error('Error confirming offer booking:', error);
        handleApiError(error, 'confirming offer booking');
    }
};

/**
 * Cancel an offer booking
 */
export const cancelOfferBooking = async (bookingId, reason = '') => {
    try {
        return await updateOfferBookingStatus(bookingId, 'cancelled', 
            reason || 'Offer booking cancelled by merchant');
    } catch (error) {
        console.error('Error cancelling offer booking:', error);
        handleApiError(error, 'cancelling offer booking');
    }
};

// ===== COMBINED BOOKING METHODS =====

/**
 * Get all bookings (both service and offer) for the current merchant
 */
export const getMerchantAllBookings = async (params = {}) => {
    try {
        console.log('Fetching all merchant bookings with params:', params);

        const response = await axiosInstance.get('/merchant/bookings/all', {
            headers: getAuthHeaders(),
            params: {
                limit: 50,
                offset: 0,
                ...params
            }
        });

        console.log('All bookings response:', response.data);

        if (response.data.success) {
            return {
                success: true,
                bookings: response.data.bookings || [],
                pagination: response.data.pagination,
                summary: response.data.summary
            };
        }

        return response.data;
    } catch (error) {
        console.error('Error fetching all merchant bookings:', error);
        
        // Fallback: try to get both service and offer bookings separately
        try {
            console.log('Trying to combine service and offer bookings...');
            
            const [serviceResult, offerResult] = await Promise.allSettled([
                getMerchantServiceBookings({ ...params, limit: Math.floor((params.limit || 50) / 2) }),
                getMerchantOfferBookings({ ...params, limit: Math.floor((params.limit || 50) / 2) })
            ]);

            const serviceBookings = serviceResult.status === 'fulfilled' ? serviceResult.value.bookings || [] : [];
            const offerBookings = offerResult.status === 'fulfilled' ? offerResult.value.bookings || [] : [];

            const allBookings = [...serviceBookings, ...offerBookings]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            return {
                success: true,
                bookings: allBookings,
                summary: {
                    total: allBookings.length,
                    services: serviceBookings.length,
                    offers: offerBookings.length,
                    pending: allBookings.filter(b => b.status === 'pending').length,
                    confirmed: allBookings.filter(b => b.status === 'confirmed').length,
                    in_progress: allBookings.filter(b => b.status === 'in_progress').length,
                    completed: allBookings.filter(b => b.status === 'completed').length,
                    cancelled: allBookings.filter(b => b.status === 'cancelled').length
                }
            };
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
            return generateMockCombinedBookings(params.limit || 20);
        }
    }
};

/**
 * Get booking by ID (handles both service and offer bookings)
 */
export const getBookingById = async (bookingId) => {
    try {
        console.log('Fetching booking by ID:', bookingId);

        // Try service booking first
        try {
            const serviceBooking = await getServiceBookingById(bookingId);
            return {
                ...serviceBooking,
                bookingType: 'service'
            };
        } catch (serviceError) {
            // If service booking fails, try offer booking
            try {
                const offerBooking = await getOfferBookingById(bookingId);
                return {
                    ...offerBooking,
                    bookingType: 'offer'
                };
            } catch (offerError) {
                // If both fail, try general endpoint
                const response = await axiosInstance.get(`/merchant/bookings/view/${bookingId}`, {
                    headers: getAuthHeaders()
                });

                return response.data;
            }
        }
    } catch (error) {
        console.error('Error fetching booking by ID:', error);
        handleApiError(error, 'fetching booking');
    }
};

/**
 * Update booking status (auto-detects service vs offer)
 */
export const updateBookingStatus = async (bookingId, status, notes = '') => {
    try {
        console.log('Updating booking status:', { bookingId, status, notes });

        // Try to determine booking type first
        try {
            const booking = await getBookingById(bookingId);
            
            if (booking.bookingType === 'service' || booking.serviceId || booking.Service) {
                return await updateServiceBookingStatus(bookingId, status, notes);
            } else if (booking.bookingType === 'offer' || booking.offerId || booking.Offer) {
                return await updateOfferBookingStatus(bookingId, status, notes);
            }
        } catch (typeError) {
            console.log('Could not determine booking type, trying general update');
        }

        // Fallback to general endpoint
        const response = await axiosInstance.put(`/merchant/bookings/${bookingId}/status`, {
            status,
            notes
        }, {
            headers: getAuthHeaders()
        });

        return response.data;
    } catch (error) {
        console.error('Error updating booking status:', error);
        handleApiError(error, 'updating booking status');
    }
};

// ===== STORE-SPECIFIC BOOKING METHODS =====

/**
 * Get bookings for a specific store
 */
export const getStoreBookings = async (storeId, params = {}) => {
    try {
        console.log('Fetching bookings for store:', storeId);

        const response = await axiosInstance.get(`/merchant/bookings/store/${storeId}`, {
            headers: getAuthHeaders(),
            params: {
                limit: 50,
                offset: 0,
                ...params
            }
        });

        if (response.data.success) {
            return response.data;
        }

        return response.data;
    } catch (error) {
        console.error('Error fetching store bookings:', error);
        handleApiError(error, 'fetching store bookings');
    }
};

/**
 * Get bookings for current merchant's store
 */
export const getMyStoreBookings = async (params = {}) => {
    try {
        const storeId = await getMerchantStoreId();
        return await getStoreBookings(storeId, params);
    } catch (error) {
        console.error('Error fetching my store bookings:', error);
        handleApiError(error, 'fetching my store bookings');
    }
};

// ===== ANALYTICS METHODS =====

/**
 * Get booking analytics for the merchant
 */
export const getBookingAnalytics = async (timeRange = '7d') => {
    try {
        console.log('Fetching booking analytics for timeRange:', timeRange);

        const response = await axiosInstance.get('/merchant/bookings/analytics', {
            headers: getAuthHeaders(),
            params: { timeRange }
        });

        if (response.data.success) {
            return response.data;
        }

        return response.data;
    } catch (error) {
        console.error('Error fetching booking analytics:', error);
        
        // Fallback: calculate analytics from booking data
        try {
            const allBookings = await getMerchantAllBookings({ limit: 1000 });
            return calculateBookingAnalytics(allBookings.bookings || [], timeRange);
        } catch (fallbackError) {
            return {
                success: true,
                analytics: getEmptyAnalytics(),
                message: 'Analytics not available'
            };
        }
    }
};

// ===== BULK OPERATIONS =====

/**
 * Bulk update booking statuses
 */
export const bulkUpdateBookingStatus = async (bookingIds, status, notes = '') => {
    try {
        console.log('Bulk updating booking statuses:', { bookingIds, status });

        const response = await axiosInstance.put('/merchant/bookings/bulk-status', {
            bookingIds,
            status,
            notes
        }, {
            headers: getAuthHeaders()
        });

        if (response.data.success) {
            return response.data;
        }

        // Fallback: update each booking individually
        const results = await Promise.allSettled(
            bookingIds.map(id => updateBookingStatus(id, status, notes))
        );

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        return {
            success: true,
            message: `Updated ${successful} bookings successfully. ${failed} failed.`,
            results: {
                successful,
                failed,
                total: bookingIds.length
            }
        };
    } catch (error) {
        console.error('Error bulk updating booking statuses:', error);
        handleApiError(error, 'bulk updating booking statuses');
    }
};

/**
 * Export booking data
 */
export const exportBookingData = async (filters = {}, format = 'csv') => {
    try {
        console.log('Exporting booking data with filters:', filters);

        const response = await axiosInstance.post('/merchant/bookings/export', {
            filters,
            format
        }, {
            headers: getAuthHeaders(),
            responseType: 'blob'
        });

        // Create download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `bookings-export-${new Date().toISOString().split('T')[0]}.${format}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        return { success: true, message: 'Export completed successfully' };
    } catch (error) {
        console.error('Error exporting booking data:', error);
        
        // Fallback: create simple export from current data
        try {
            const allBookings = await getMerchantAllBookings({ limit: 1000 });
            return createSimpleBookingExport(allBookings.bookings || [], format);
        } catch (fallbackError) {
            handleApiError(error, 'exporting booking data');
        }
    }
};

// ===== UTILITY FUNCTIONS =====

/**
 * Generate mock service bookings for development
 */
const generateMockServiceBookings = (limit = 20) => {
    const mockBookings = [];
    const statuses = ['confirmed', 'pending', 'completed', 'in_progress', 'cancelled'];
    const services = [
        { id: 1, name: 'Hair Cut & Styling', duration: 60, price: 2500 },
        { id: 2, name: 'Massage Therapy', duration: 90, price: 4500 },
        { id: 3, name: 'Facial Treatment', duration: 75, price: 3500 },
        { id: 4, name: 'Manicure & Pedicure', duration: 120, price: 3000 }
    ];
    const customers = [
        { firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', phoneNumber: '+254712345678' },
        { firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@example.com', phoneNumber: '+254723456789' },
        { firstName: 'Mike', lastName: 'Johnson', email: 'mike.johnson@example.com', phoneNumber: '+254734567890' },
        { firstName: 'Sarah', lastName: 'Wilson', email: 'sarah.wilson@example.com', phoneNumber: '+254745678901' }
    ];

    for (let i = 0; i < limit; i++) {
        const service = services[i % services.length];
        const customer = customers[i % customers.length];
        const status = statuses[i % statuses.length];
        
        // Generate random date within last 30 days or next 30 days
        const now = new Date();
        const randomDays = (Math.random() - 0.5) * 60; // -30 to +30 days
        const bookingDate = new Date(now.getTime() + randomDays * 24 * 60 * 60 * 1000);
        
        const booking = {
            id: 1000 + i,
            serviceId: service.id,
            userId: 100 + i,
            startTime: bookingDate.toISOString(),
            endTime: new Date(bookingDate.getTime() + service.duration * 60 * 1000).toISOString(),
            status: status,
            duration: service.duration,
            bookingType: 'service',
            createdAt: new Date(bookingDate.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
            
            // User data
            User: {
                id: 100 + i,
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                phoneNumber: customer.phoneNumber
            },
            
            // Service data
            Service: {
                id: service.id,
                name: service.name,
                duration: service.duration,
                price: service.price
            },
            
            // Derived properties
            customerName: `${customer.firstName} ${customer.lastName}`,
            serviceName: service.name,
            isUpcoming: bookingDate > now,
            isPast: bookingDate < now,
            canModify: ['pending', 'confirmed'].includes(status) && bookingDate > now
        };
        
        mockBookings.push(booking);
    }

    return {
        success: true,
        bookings: mockBookings,
        pagination: {
            total: mockBookings.length,
            limit: limit,
            offset: 0
        },
        summary: {
            total: mockBookings.length,
            pending: mockBookings.filter(b => b.status === 'pending').length,
            confirmed: mockBookings.filter(b => b.status === 'confirmed').length,
            in_progress: mockBookings.filter(b => b.status === 'in_progress').length,
            completed: mockBookings.filter(b => b.status === 'completed').length,
            cancelled: mockBookings.filter(b => b.status === 'cancelled').length
        },
        message: 'Using mock service booking data for development'
    };
};

/**
 * Generate mock offer bookings for development
 */
const generateMockOfferBookings = (limit = 20) => {
    const mockBookings = [];
    const statuses = ['confirmed', 'pending', 'completed', 'in_progress', 'cancelled'];
    const offers = [
        { id: 1, title: '50% Off Hair Styling', discount: 50, original_price: 2500, discounted_price: 1250 },
        { id: 2, title: '30% Off Massage Package', discount: 30, original_price: 4500, discounted_price: 3150 },
        { id: 3, title: 'Weekend Facial Special', discount: 25, original_price: 3500, discounted_price: 2625 },
        { id: 4, title: 'Mani-Pedi Combo Deal', discount: 40, original_price: 3000, discounted_price: 1800 }
    ];
    const customers = [
        { firstName: 'Alice', lastName: 'Brown', email: 'alice.brown@example.com', phoneNumber: '+254756789012' },
        { firstName: 'Bob', lastName: 'Davis', email: 'bob.davis@example.com', phoneNumber: '+254767890123' },
        { firstName: 'Carol', lastName: 'Miller', email: 'carol.miller@example.com', phoneNumber: '+254778901234' },
        { firstName: 'David', lastName: 'Wilson', email: 'david.wilson@example.com', phoneNumber: '+254789012345' }
    ];

    for (let i = 0; i < limit; i++) {
        const offer = offers[i % offers.length];
        const customer = customers[i % customers.length];
        const status = statuses[i % statuses.length];
        
        // Generate random date within last 30 days or next 30 days
        const now = new Date();
        const randomDays = (Math.random() - 0.5) * 60; // -30 to +30 days
        const bookingDate = new Date(now.getTime() + randomDays * 24 * 60 * 60 * 1000);
        
        const booking = {
            id: 2000 + i,
            offerId: offer.id,
            userId: 200 + i,
            startTime: bookingDate.toISOString(),
            endTime: new Date(bookingDate.getTime() + 90 * 60 * 1000).toISOString(), // 90 min default
            status: status,
            bookingType: 'offer',
            accessFee: Math.round(offer.discounted_price * 0.1), // 10% access fee
            createdAt: new Date(bookingDate.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
            
            // User data
            User: {
                id: 200 + i,
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                phoneNumber: customer.phoneNumber
            },
            
            // Offer data
            Offer: {
                id: offer.id,
                title: offer.title,
                discount: offer.discount,
                original_price: offer.original_price,
                discounted_price: offer.discounted_price
            },
            
            // Derived properties
            customerName: `${customer.firstName} ${customer.lastName}`,
            offerTitle: offer.title,
            isUpcoming: bookingDate > now,
            isPast: bookingDate < now,
            canModify: ['pending', 'confirmed'].includes(status) && bookingDate > now,
            accessFeePaid: ['confirmed', 'in_progress', 'completed'].includes(status)
        };
        
        mockBookings.push(booking);
    }

    return {
        success: true,
        bookings: mockBookings,
        pagination: {
            total: mockBookings.length,
            limit: limit,
            offset: 0
        },
        summary: {
            total: mockBookings.length,
            pending: mockBookings.filter(b => b.status === 'pending').length,
            confirmed: mockBookings.filter(b => b.status === 'confirmed').length,
            in_progress: mockBookings.filter(b => b.status === 'in_progress').length,
            completed: mockBookings.filter(b => b.status === 'completed').length,
            cancelled: mockBookings.filter(b => b.status === 'cancelled').length
        },
        message: 'Using mock offer booking data for development'
    };
};

/**
 * Generate mock combined bookings for development
 */
const generateMockCombinedBookings = (limit = 20) => {
    const serviceLimit = Math.ceil(limit / 2);
    const offerLimit = Math.floor(limit / 2);
    
    const serviceBookings = generateMockServiceBookings(serviceLimit);
    const offerBookings = generateMockOfferBookings(offerLimit);
    
    const combinedBookings = [
        ...serviceBookings.bookings,
        ...offerBookings.bookings
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
        success: true,
        bookings: combinedBookings,
        pagination: {
            total: combinedBookings.length,
            limit: limit,
            offset: 0
        },
        summary: {
            total: combinedBookings.length,
            services: serviceBookings.bookings.length,
            offers: offerBookings.bookings.length,
            pending: combinedBookings.filter(b => b.status === 'pending').length,
            confirmed: combinedBookings.filter(b => b.status === 'confirmed').length,
            in_progress: combinedBookings.filter(b => b.status === 'in_progress').length,
            completed: combinedBookings.filter(b => b.status === 'completed').length,
            cancelled: combinedBookings.filter(b => b.status === 'cancelled').length
        },
        message: 'Using mock combined booking data for development'
    };
};

/**
 * Calculate booking analytics from booking data
 */
const calculateBookingAnalytics = (bookings = [], timeRange = '7d') => {
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
        case '1d':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
        case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        case '90d':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        default:
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const filteredBookings = bookings.filter(booking => 
        new Date(booking.createdAt) >= startDate
    );

    const serviceBookings = filteredBookings.filter(b => 
        b.serviceId || b.Service || b.bookingType === 'service'
    );
    
    const offerBookings = filteredBookings.filter(b => 
        b.offerId || b.Offer || b.bookingType === 'offer'
    );

    const revenue = filteredBookings
        .filter(b => b.status === 'completed')
        .reduce((sum, b) => {
            const amount = parseFloat(b.Service?.price || b.Offer?.discounted_price || b.accessFee || 0);
            return sum + amount;
        }, 0);

    return {
        success: true,
        analytics: {
            timeRange,
            totalBookings: filteredBookings.length,
            serviceBookings: serviceBookings.length,
            offerBookings: offerBookings.length,
            confirmed: filteredBookings.filter(b => b.status === 'confirmed').length,
            completed: filteredBookings.filter(b => b.status === 'completed').length,
            pending: filteredBookings.filter(b => b.status === 'pending').length,
            cancelled: filteredBookings.filter(b => b.status === 'cancelled').length,
            revenue: revenue,
            averageBookingValue: filteredBookings.length > 0 ? revenue / filteredBookings.length : 0,
            completionRate: filteredBookings.length > 0 ? 
                (filteredBookings.filter(b => b.status === 'completed').length / filteredBookings.length) * 100 : 0
        }
    };
};

/**
 * Get empty analytics structure
 */
const getEmptyAnalytics = () => ({
    totalBookings: 0,
    serviceBookings: 0,
    offerBookings: 0,
    confirmed: 0,
    completed: 0,
    pending: 0,
    cancelled: 0,
    revenue: 0,
    averageBookingValue: 0,
    completionRate: 0
});

/**
 * Create simple booking export from data
 */
const createSimpleBookingExport = (bookings = [], format = 'csv') => {
    try {
        const headers = [
            'ID', 'Type', 'Customer Name', 'Customer Email', 'Service/Offer', 
            'Date', 'Time', 'Status', 'Duration', 'Price', 'Notes'
        ];

        const rows = bookings.map(booking => [
            booking.id,
            booking.bookingType || (booking.serviceId ? 'service' : 'offer'),
            booking.customerName || `${booking.User?.firstName || ''} ${booking.User?.lastName || ''}`.trim(),
            booking.User?.email || '',
            booking.serviceName || booking.Service?.name || booking.offerTitle || booking.Offer?.title || '',
            new Date(booking.startTime).toLocaleDateString(),
            new Date(booking.startTime).toLocaleTimeString(),
            booking.status,
            booking.duration || booking.Service?.duration || '90',
            booking.Service?.price || booking.Offer?.discounted_price || booking.accessFee || '0',
            booking.notes || ''
        ]);

        if (format === 'csv') {
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(field => `"${field || ''}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `bookings-export-${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            return { 
                success: true, 
                message: 'Simple CSV export completed successfully',
                recordCount: bookings.length 
            };
        }

        return { 
            success: false, 
            message: 'Only CSV export is supported in fallback mode' 
        };
    } catch (error) {
        console.error('Error creating simple export:', error);
        throw new Error('Failed to create export file');
    }
};

// ===== SEARCH AND FILTER METHODS =====

/**
 * Search bookings by customer name, email, or booking ID
 */
export const searchBookings = async (query, params = {}) => {
    try {
        console.log('Searching bookings with query:', query);

        const response = await axiosInstance.get('/merchant/bookings/search', {
            headers: getAuthHeaders(),
            params: {
                q: query,
                ...params
            }
        });

        if (response.data.success) {
            return response.data;
        }

        throw new Error(response.data.message || 'Search failed');
    } catch (error) {
        console.error('Error searching bookings:', error);
        
        // Fallback: search within all bookings
        try {
            const allBookings = await getMerchantAllBookings({ limit: 1000 });
            const filteredBookings = (allBookings.bookings || []).filter(booking => {
                const searchText = query.toLowerCase();
                return (
                    booking.id.toString().includes(searchText) ||
                    booking.customerName?.toLowerCase().includes(searchText) ||
                    booking.User?.email?.toLowerCase().includes(searchText) ||
                    booking.User?.firstName?.toLowerCase().includes(searchText) ||
                    booking.User?.lastName?.toLowerCase().includes(searchText) ||
                    booking.serviceName?.toLowerCase().includes(searchText) ||
                    booking.offerTitle?.toLowerCase().includes(searchText)
                );
            });

            return {
                success: true,
                bookings: filteredBookings,
                query: query,
                totalResults: filteredBookings.length
            };
        } catch (fallbackError) {
            handleApiError(error, 'searching bookings');
        }
    }
};

/**
 * Filter bookings by various criteria
 */
export const filterBookings = async (filters = {}) => {
    try {
        console.log('Filtering bookings with filters:', filters);

        const response = await axiosInstance.get('/merchant/bookings/filter', {
            headers: getAuthHeaders(),
            params: filters
        });

        if (response.data.success) {
            return response.data;
        }

        throw new Error(response.data.message || 'Filter failed');
    } catch (error) {
        console.error('Error filtering bookings:', error);
        
        // Fallback: filter within all bookings
        try {
            const allBookings = await getMerchantAllBookings({ limit: 1000 });
            let filteredBookings = allBookings.bookings || [];

            // Apply filters
            if (filters.status) {
                filteredBookings = filteredBookings.filter(b => b.status === filters.status);
            }
            if (filters.bookingType) {
                filteredBookings = filteredBookings.filter(b => b.bookingType === filters.bookingType);
            }
            if (filters.startDate) {
                const startDate = new Date(filters.startDate);
                filteredBookings = filteredBookings.filter(b => new Date(b.startTime) >= startDate);
            }
            if (filters.endDate) {
                const endDate = new Date(filters.endDate);
                filteredBookings = filteredBookings.filter(b => new Date(b.startTime) <= endDate);
            }
            if (filters.serviceId) {
                filteredBookings = filteredBookings.filter(b => b.serviceId === filters.serviceId);
            }
            if (filters.staffId) {
                filteredBookings = filteredBookings.filter(b => b.staffId === filters.staffId);
            }

            return {
                success: true,
                bookings: filteredBookings,
                filters: filters,
                totalResults: filteredBookings.length
            };
        } catch (fallbackError) {
            handleApiError(error, 'filtering bookings');
        }
    }
};

// ===== NOTIFICATION METHODS =====

/**
 * Send booking confirmation to customer
 */
export const sendBookingConfirmation = async (bookingId) => {
    try {
        const response = await axiosInstance.post(`/merchant/bookings/${bookingId}/send-confirmation`, {}, {
            headers: getAuthHeaders()
        });

        return response.data;
    } catch (error) {
        console.error('Error sending booking confirmation:', error);
        handleApiError(error, 'sending booking confirmation');
    }
};

/**
 * Send booking reminder to customer
 */
export const sendBookingReminder = async (bookingId, reminderType = 'default') => {
    try {
        const response = await axiosInstance.post(`/merchant/bookings/${bookingId}/send-reminder`, {
            reminderType
        }, {
            headers: getAuthHeaders()
        });

        return response.data;
    } catch (error) {
        console.error('Error sending booking reminder:', error);
        handleApiError(error, 'sending booking reminder');
    }
};

// ===== SUMMARY METHODS =====

/**
 * Get booking summary for today
 */
export const getTodayBookingSummary = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const response = await axiosInstance.get('/merchant/bookings/summary/today', {
            headers: getAuthHeaders()
        });

        if (response.data.success) {
            return response.data;
        }

        // Fallback: calculate from all bookings
        const allBookings = await getMerchantAllBookings({ 
            startDate: today,
            endDate: today,
            limit: 1000
        });

        const todayBookings = (allBookings.bookings || []).filter(booking => 
            new Date(booking.startTime).toDateString() === new Date().toDateString()
        );

        return {
            success: true,
            summary: {
                total: todayBookings.length,
                confirmed: todayBookings.filter(b => b.status === 'confirmed').length,
                in_progress: todayBookings.filter(b => b.status === 'in_progress').length,
                completed: todayBookings.filter(b => b.status === 'completed').length,
                cancelled: todayBookings.filter(b => b.status === 'cancelled').length,
                upcoming: todayBookings.filter(b => 
                    new Date(b.startTime) > new Date() && ['confirmed', 'pending'].includes(b.status)
                ).length
            },
            bookings: todayBookings
        };
    } catch (error) {
        console.error('Error getting today booking summary:', error);
        handleApiError(error, 'getting today booking summary');
    }
};

/**
 * Get upcoming bookings
 */
export const getUpcomingBookings = async (hours = 24) => {
    try {
        const response = await axiosInstance.get('/merchant/bookings/upcoming', {
            headers: getAuthHeaders(),
            params: { hours }
        });

        if (response.data.success) {
            return response.data;
        }

        // Fallback: filter from all bookings
        const allBookings = await getMerchantAllBookings({ limit: 1000 });
        const now = new Date();
        const futureTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

        const upcomingBookings = (allBookings.bookings || []).filter(booking => {
            const bookingTime = new Date(booking.startTime);
            return bookingTime > now && 
                   bookingTime <= futureTime && 
                   ['confirmed', 'pending'].includes(booking.status);
        }).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

        return {
            success: true,
            bookings: upcomingBookings,
            count: upcomingBookings.length,
            timeframe: `Next ${hours} hours`
        };
    } catch (error) {
        console.error('Error getting upcoming bookings:', error);
        handleApiError(error, 'getting upcoming bookings');
    }
};

// ===== DEFAULT EXPORT =====

export default {
    // Service Booking Methods
    getMerchantServiceBookings,
    getServiceBookingById,
    updateServiceBookingStatus,
    checkInServiceBooking,
    completeServiceBooking,
    confirmServiceBooking,
    cancelServiceBooking,

    // Offer Booking Methods
    getMerchantOfferBookings,
    getOfferBookingById,
    updateOfferBookingStatus,
    checkInOfferBooking,
    completeOfferBooking,
    confirmOfferBooking,
    cancelOfferBooking,

    // Combined Booking Methods
    getMerchantAllBookings,
    getBookingById,
    updateBookingStatus,

    // Store-specific Methods
    getStoreBookings,
    getMyStoreBookings,

    // Analytics
    getBookingAnalytics,

    // Bulk Operations
    bulkUpdateBookingStatus,
    exportBookingData,

    // Search and Filter
    searchBookings,
    filterBookings,

    // Notifications
    sendBookingConfirmation,
    sendBookingReminder,

    // Summary Methods
    getTodayBookingSummary,
    getUpcomingBookings
};