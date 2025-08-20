// controllers/clientBookingController.js - New controller for client-related booking operations

const { Booking, User, Store, Service, Offer, Payment, Staff, Branch, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Get bookings with detailed customer information for authenticated merchant
 */
exports.getBookingsWithCustomers = async (req, res) => {
    try {
        const merchantId = req.user.id; // From your merchant auth middleware
        const { 
            page = 1, 
            limit = 50, 
            status, 
            bookingType, 
            startDate, 
            endDate,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        console.log('👥 Getting bookings with customer details for merchant:', merchantId);

        // Get merchant's store
        const store = await Store.findOne({
            where: { merchant_id: merchantId }
        });

        if (!store) {
            return res.status(404).json({
                success: false,
                message: 'No store found for this merchant. Please create a store first.'
            });
        }

        console.log('✅ Store found:', store.name);

        // Build where clause for bookings
        const whereClause = { storeId: store.id };

        if (status) {
            whereClause.status = status;
        }

        if (bookingType) {
            whereClause.bookingType = bookingType;
        }

        if (startDate || endDate) {
            whereClause.startTime = {};
            if (startDate) {
                whereClause.startTime[Op.gte] = new Date(startDate);
            }
            if (endDate) {
                whereClause.startTime[Op.lte] = new Date(endDate);
            }
        }

        // Build order clause
        let orderClause = [];
        switch (sortBy) {
            case 'customerName':
                orderClause = [[User, 'first_name', sortOrder.toUpperCase()]];
                break;
            case 'startTime':
                orderClause = [['startTime', sortOrder.toUpperCase()]];
                break;
            case 'status':
                orderClause = [['status', sortOrder.toUpperCase()]];
                break;
            case 'bookingType':
                orderClause = [['bookingType', sortOrder.toUpperCase()]];
                break;
            default:
                orderClause = [['createdAt', sortOrder.toUpperCase()]];
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Fetch bookings with all related data
        const { count, rows: bookings } = await Booking.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    attributes: [
                        'id',
                        'first_name',
                        'last_name',
                        'firstName',
                        'lastName',
                        'email',
                        'email_address',
                        'phone',
                        'phone_number',
                        'avatar',
                        'isVip',
                        'status',
                        'createdAt',
                        'lastActiveAt'
                    ],
                    required: true // Only bookings with valid users
                },
                {
                    model: Service,
                    attributes: ['id', 'name', 'price', 'duration', 'category'],
                    required: false
                },
                {
                    model: Offer,
                    attributes: ['id', 'title', 'discount', 'expiration_date'],
                    required: false,
                    include: [
                        {
                            model: Service,
                            as: 'service',
                            attributes: ['id', 'name', 'price'],
                            required: false
                        }
                    ]
                },
                {
                    model: Payment,
                    attributes: ['id', 'amount', 'status', 'method', 'transaction_id'],
                    required: false
                },
                {
                    model: Staff,
                    attributes: ['id', 'name', 'role'],
                    required: false
                }
            ],
            order: orderClause,
            limit: parseInt(limit),
            offset: offset
        });

        // Process and enhance booking data
        const enhancedBookings = bookings.map(booking => {
            const user = booking.User;
            const bookingJson = booking.toJSON();

            // Format user name
            const firstName = user.first_name || user.firstName || '';
            const lastName = user.last_name || user.lastName || '';
            const fullName = `${firstName} ${lastName}`.trim() || 'Unknown Customer';
            
            // Format user contact info
            const email = user.email || user.email_address || '';
            const phone = user.phone || user.phone_number || '';

            // Determine service details
            let serviceName = 'Unknown Service';
            let servicePrice = 0;
            
            if (booking.Offer && booking.Offer.service) {
                serviceName = booking.Offer.service.name;
                servicePrice = booking.Offer.service.price;
            } else if (booking.Service) {
                serviceName = booking.Service.name;
                servicePrice = booking.Service.price;
            }

            // Calculate total amount
            let totalAmount = 0;
            if (booking.Payment) {
                totalAmount = parseFloat(booking.Payment.amount) || 0;
            }
            if (booking.accessFee) {
                totalAmount += parseFloat(booking.accessFee) || 0;
            }

            return {
                ...bookingJson,
                // Enhanced customer info
                customerName: fullName,
                customerEmail: email,
                customerPhone: phone,
                customerAvatar: user.avatar,
                customerIsVip: user.isVip || false,
                customerStatus: user.status,
                customerSince: user.createdAt,
                customerLastActive: user.lastActiveAt,
                
                // Enhanced service info
                serviceName,
                servicePrice,
                
                // Enhanced booking info
                isOfferBooking: booking.bookingType === 'offer' || !!booking.offerId,
                isServiceBooking: booking.bookingType === 'service' || (!booking.offerId && !!booking.serviceId),
                totalAmount: totalAmount.toFixed(2),
                
                // Payment info
                paymentStatus: booking.Payment?.status || 'pending',
                paymentMethod: booking.Payment?.method || null,
                
                // Staff info
                staffName: booking.Staff?.name || null,
                staffRole: booking.Staff?.role || null
            };
        });

        console.log(`✅ Found ${enhancedBookings.length} bookings with customer details`);

        return res.status(200).json({
            success: true,
            bookings: enhancedBookings,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / parseInt(limit)),
                hasNextPage: offset + bookings.length < count,
                hasPrevPage: page > 1
            },
            summary: {
                totalBookings: count,
                offerBookings: enhancedBookings.filter(b => b.isOfferBooking).length,
                serviceBookings: enhancedBookings.filter(b => b.isServiceBooking).length,
                completedBookings: enhancedBookings.filter(b => b.status === 'completed').length,
                pendingBookings: enhancedBookings.filter(b => b.status === 'pending').length,
                totalRevenue: enhancedBookings
                    .filter(b => b.status === 'completed')
                    .reduce((sum, b) => sum + parseFloat(b.totalAmount), 0)
                    .toFixed(2)
            },
            store: {
                id: store.id,
                name: store.name,
                location: store.location
            }
        });

    } catch (error) {
        console.error('💥 Error getting bookings with customers:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching bookings with customer details',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get unique customers for the authenticated merchant
 */
exports.getUniqueCustomers = async (req, res) => {
    try {
        const merchantId = req.user.id; // From your merchant auth middleware
        const { page = 1, limit = 50, search, bookingType, sortBy = 'totalBookings', sortOrder = 'desc' } = req.query;

        console.log('👥 Getting unique customers for merchant:', merchantId);

        // Get merchant's store
        const store = await Store.findOne({
            where: { merchant_id: merchantId }
        });

        if (!store) {
            return res.status(404).json({
                success: false,
                message: 'No store found for this merchant'
            });
        }

        // Get unique customers with booking statistics using raw SQL for better performance
        const baseQuery = `
            SELECT 
                u.id,
                u.first_name,
                u.last_name,
                u.firstName,
                u.lastName,
                u.email,
                u.email_address,
                u.phone,
                u.phone_number,
                u.avatar,
                u.isVip,
                u.status,
                u.createdAt as customerSince,
                u.lastActiveAt,
                COUNT(b.id) as totalBookings,
                SUM(CASE WHEN b.bookingType = 'offer' THEN 1 ELSE 0 END) as offerBookings,
                SUM(CASE WHEN b.bookingType = 'service' THEN 1 ELSE 0 END) as serviceBookings,
                COALESCE(SUM(CAST(COALESCE(b.accessFee, 0) AS DECIMAL(10,2))), 0) as totalSpent,
                MAX(b.createdAt) as lastBookingDate,
                GROUP_CONCAT(DISTINCT b.status) as bookingStatuses
            FROM Users u
            INNER JOIN Bookings b ON u.id = b.userId
            WHERE b.storeId = :storeId
            ${bookingType ? 'AND b.bookingType = :bookingType' : ''}
            ${search ? `AND (
                u.first_name LIKE :search OR 
                u.last_name LIKE :search OR 
                u.firstName LIKE :search OR 
                u.lastName LIKE :search OR 
                u.email LIKE :search OR 
                u.email_address LIKE :search
            )` : ''}
            GROUP BY u.id
        `;

        const orderClause = (() => {
            switch (sortBy) {
                case 'name':
                    return `ORDER BY COALESCE(u.first_name, u.firstName) ${sortOrder.toUpperCase()}`;
                case 'totalBookings':
                    return `ORDER BY totalBookings ${sortOrder.toUpperCase()}`;
                case 'totalSpent':
                    return `ORDER BY totalSpent ${sortOrder.toUpperCase()}`;
                case 'lastBookingDate':
                    return `ORDER BY lastBookingDate ${sortOrder.toUpperCase()}`;
                default:
                    return `ORDER BY totalBookings ${sortOrder.toUpperCase()}`;
            }
        })();

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const paginationClause = `LIMIT :limit OFFSET :offset`;

        const finalQuery = `${baseQuery} ${orderClause} ${paginationClause}`;
        const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as customer_counts`;

        const replacements = {
            storeId: store.id,
            limit: parseInt(limit),
            offset: offset,
            ...(bookingType && { bookingType }),
            ...(search && { search: `%${search}%` })
        };

        const [customers, countResult] = await Promise.all([
            sequelize.query(finalQuery, { 
                replacements, 
                type: sequelize.QueryTypes.SELECT 
            }),
            sequelize.query(countQuery, { 
                replacements: { 
                    storeId: store.id,
                    ...(bookingType && { bookingType }),
                    ...(search && { search: `%${search}%` })
                }, 
                type: sequelize.QueryTypes.SELECT 
            })
        ]);

        // Format customer data
        const formattedCustomers = customers.map(customer => {
            const firstName = customer.first_name || customer.firstName || '';
            const lastName = customer.last_name || customer.lastName || '';
            const email = customer.email || customer.email_address || '';
            const phone = customer.phone || customer.phone_number || '';

            const totalSpent = parseFloat(customer.totalSpent || 0);
            const totalBookings = parseInt(customer.totalBookings);

            return {
                id: customer.id,
                name: `${firstName} ${lastName}`.trim() || 'Unknown Customer',
                firstName,
                lastName,
                email,
                phone,
                avatar: customer.avatar,
                isVip: customer.isVip || totalBookings >= 3 || totalSpent >= 200,
                status: customer.status,
                customerSince: customer.customerSince,
                lastActive: customer.lastActiveAt,
                totalBookings: totalBookings,
                offerBookings: parseInt(customer.offerBookings || 0),
                serviceBookings: parseInt(customer.serviceBookings || 0),
                totalSpent: `$${totalSpent.toFixed(2)}`,
                lastBookingDate: customer.lastBookingDate,
                bookingType: customer.offerBookings > customer.serviceBookings ? 'offer' : 'service',
                bookingDetails: customer.offerBookings > customer.serviceBookings ? 'Offer Bookings' : 'Service Bookings'
            };
        });

        console.log(`✅ Found ${formattedCustomers.length} unique customers`);

        return res.status(200).json({
            success: true,
            customers: formattedCustomers,
            pagination: {
                total: parseInt(countResult[0].total),
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(countResult[0].total / parseInt(limit))
            },
            store: {
                id: store.id,
                name: store.name,
                location: store.location
            }
        });

    } catch (error) {
        console.error('💥 Error getting unique customers:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching unique customers',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

module.exports = {
    getBookingsWithCustomers,
    getUniqueCustomers
};