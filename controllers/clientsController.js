const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// Middleware to check subscription status
const checkSubscriptionStatus = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'No authorization token provided' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const merchant = await Merchant.findById(decoded.id).populate('subscription');
        
        if (!merchant) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid merchant' 
            });
        }

        // Check if merchant has active subscription
        if (!merchant.subscription || merchant.subscription.status !== 'active') {
            return res.status(403).json({ 
                success: false, 
                message: 'Premium subscription required to access this feature',
                requiresSubscription: true
            });
        }

        // Check if subscription is not expired
        if (merchant.subscription.expiresAt && merchant.subscription.expiresAt < new Date()) {
            return res.status(403).json({ 
                success: false, 
                message: 'Subscription has expired. Please renew to continue using premium features',
                requiresSubscription: true
            });
        }

        req.merchant = merchant;
        next();
    } catch (error) {
        console.error('Subscription check error:', error);
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid or expired token' 
        });
    }
};

// Email transporter setup (configure based on your email service)
const createEmailTransporter = () => {
    return nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
};

class ClientsController {
    
    // Get all followers for the merchant
    async getFollowers(req, res) {
        try {
            const merchantId = req.merchant._id;
            const { page = 1, limit = 20, search = '', sortBy = 'name', sortOrder = 'asc' } = req.query;

            const searchQuery = search ? {
                merchantId,
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            } : { merchantId };

            const sortOptions = {};
            sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

            const followers = await Follower.find(searchQuery)
                .sort(sortOptions)
                .skip((page - 1) * limit)
                .limit(parseInt(limit));

            const totalFollowers = await Follower.countDocuments(searchQuery);

            res.json({
                success: true,
                data: {
                    followers,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(totalFollowers / limit),
                        totalFollowers,
                        hasNextPage: page * limit < totalFollowers,
                        hasPrevPage: page > 1
                    }
                }
            });
        } catch (error) {
            console.error('Get followers error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch followers' 
            });
        }
    }

    // Get all customers for the merchant
    async getCustomers(req, res) {
        try {
            const merchantId = req.merchant._id;
            const { 
                page = 1, 
                limit = 20, 
                search = '', 
                sortBy = 'name', 
                sortOrder = 'asc',
                bookingType = 'all' 
            } = req.query;

            let searchQuery = { merchantId };

            // Add search filter
            if (search) {
                searchQuery.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ];
            }

            // Add booking type filter
            if (bookingType !== 'all') {
                searchQuery.bookingType = bookingType;
            }

            const sortOptions = {};
            sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

            const customers = await Customer.find(searchQuery)
                .sort(sortOptions)
                .skip((page - 1) * limit)
                .limit(parseInt(limit));

            const totalCustomers = await Customer.countDocuments(searchQuery);

            res.json({
                success: true,
                data: {
                    customers,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(totalCustomers / limit),
                        totalCustomers,
                        hasNextPage: page * limit < totalCustomers,
                        hasPrevPage: page > 1
                    }
                }
            });
        } catch (error) {
            console.error('Get customers error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch customers' 
            });
        }
    }

    // Send bulk email to selected followers/customers
    async sendBulkEmail(req, res) {
        try {
            const merchantId = req.merchant._id;
            const { recipientIds, recipientType, subject, message } = req.body;

            // Validate input
            if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Recipient IDs are required' 
                });
            }

            if (!subject || !message) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Subject and message are required' 
                });
            }

            if (!['followers', 'customers'].includes(recipientType)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid recipient type' 
                });
            }

            // Get recipients based on type
            let recipients;
            if (recipientType === 'followers') {
                recipients = await Follower.find({ 
                    _id: { $in: recipientIds }, 
                    merchantId 
                });
            } else {
                recipients = await Customer.find({ 
                    _id: { $in: recipientIds }, 
                    merchantId 
                });
            }

            if (recipients.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'No valid recipients found' 
                });
            }

            // Check subscription limits (if you have email limits per plan)
            const subscription = req.merchant.subscription;
            if (subscription.emailsSentThisMonth + recipients.length > subscription.maxEmailsPerMonth) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Email limit exceeded for your subscription plan' 
                });
            }

            // Setup email transporter
            const transporter = createEmailTransporter();
            
            // Send emails
            const emailPromises = recipients.map(recipient => {
                const mailOptions = {
                    from: `"${req.merchant.storeName}" <${process.env.SMTP_FROM_EMAIL}>`,
                    to: recipient.email,
                    subject: subject,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
                                <h2 style="color: #333; margin-bottom: 20px;">Hello ${recipient.name},</h2>
                                <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                                    ${message.replace(/\n/g, '<br>')}
                                </div>
                                <p style="color: #666; font-size: 14px; margin-bottom: 0;">
                                    Best regards,<br>
                                    ${req.merchant.storeName}
                                </p>
                            </div>
                        </div>
                    `
                };

                return transporter.sendMail(mailOptions);
            });

            // Wait for all emails to be sent
            await Promise.all(emailPromises);

            // Update subscription email count
            await Subscription.findByIdAndUpdate(subscription._id, {
                $inc: { emailsSentThisMonth: recipients.length }
            });

            // Log the bulk email activity
            await BulkEmailLog.create({
                merchantId,
                recipientType,
                recipientCount: recipients.length,
                subject,
                message,
                sentAt: new Date()
            });

            res.json({
                success: true,
                message: `Bulk email sent successfully to ${recipients.length} recipients`,
                data: {
                    recipientCount: recipients.length,
                    emailsSentThisMonth: subscription.emailsSentThisMonth + recipients.length
                }
            });

        } catch (error) {
            console.error('Bulk email error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to send bulk email' 
            });
        }
    }

    // Get client statistics
    async getClientStats(req, res) {
        try {
            const merchantId = req.merchant._id;

            const [
                totalFollowers,
                totalCustomers,
                vipFollowers,
                vipCustomers,
                recentFollowers,
                recentCustomers,
                emailsSentThisMonth
            ] = await Promise.all([
                Follower.countDocuments({ merchantId }),
                Customer.countDocuments({ merchantId }),
                Follower.countDocuments({ merchantId, isVip: true }),
                Customer.countDocuments({ merchantId, isVip: true }),
                Follower.countDocuments({ 
                    merchantId, 
                    followedSince: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                }),
                Customer.countDocuments({ 
                    merchantId, 
                    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                }),
                BulkEmailLog.aggregate([
                    {
                        $match: {
                            merchantId,
                            sentAt: { 
                                $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) 
                            }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalEmails: { $sum: '$recipientCount' }
                        }
                    }
                ])
            ]);

            res.json({
                success: true,
                data: {
                    totalFollowers,
                    totalCustomers,
                    vipFollowers,
                    vipCustomers,
                    recentFollowers,
                    recentCustomers,
                    emailsSentThisMonth: emailsSentThisMonth[0]?.totalEmails || 0,
                    subscription: {
                        plan: req.merchant.subscription.plan,
                        maxEmailsPerMonth: req.merchant.subscription.maxEmailsPerMonth,
                        status: req.merchant.subscription.status
                    }
                }
            });
        } catch (error) {
            console.error('Get client stats error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch client statistics' 
            });
        }
    }

    // Add a new follower
    async addFollower(req, res) {
        try {
            const merchantId = req.merchant._id;
            const { name, email, phone, isVip = false } = req.body;

            // Validate input
            if (!name || !email) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Name and email are required' 
                });
            }

            // Check if follower already exists
            const existingFollower = await Follower.findOne({ email, merchantId });
            if (existingFollower) {
                return res.status(409).json({ 
                    success: false, 
                    message: 'Follower with this email already exists' 
                });
            }

            const follower = await Follower.create({
                merchantId,
                name,
                email,
                phone,
                isVip,
                followedSince: new Date(),
                lastActive: new Date()
            });

            res.status(201).json({
                success: true,
                message: 'Follower added successfully',
                data: follower
            });
        } catch (error) {
            console.error('Add follower error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to add follower' 
            });
        }
    }

    // Update follower information
    async updateFollower(req, res) {
        try {
            const merchantId = req.merchant._id;
            const { followerId } = req.params;
            const { name, email, phone, isVip } = req.body;

            const follower = await Follower.findOneAndUpdate(
                { _id: followerId, merchantId },
                { name, email, phone, isVip },
                { new: true, runValidators: true }
            );

            if (!follower) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Follower not found' 
                });
            }

            res.json({
                success: true,
                message: 'Follower updated successfully',
                data: follower
            });
        } catch (error) {
            console.error('Update follower error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to update follower' 
            });
        }
    }

    // Delete a follower
    async deleteFollower(req, res) {
        try {
            const merchantId = req.merchant._id;
            const { followerId } = req.params;

            const follower = await Follower.findOneAndDelete({ 
                _id: followerId, 
                merchantId 
            });

            if (!follower) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Follower not found' 
                });
            }

            res.json({
                success: true,
                message: 'Follower deleted successfully'
            });
        } catch (error) {
            console.error('Delete follower error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to delete follower' 
            });
        }
    }

    // Get bulk email history
    async getBulkEmailHistory(req, res) {
        try {
            const merchantId = req.merchant._id;
            const { page = 1, limit = 10 } = req.query;

            const emailHistory = await BulkEmailLog.find({ merchantId })
                .sort({ sentAt: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit));

            const totalEmails = await BulkEmailLog.countDocuments({ merchantId });

            res.json({
                success: true,
                data: {
                    emailHistory,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(totalEmails / limit),
                        totalEmails,
                        hasNextPage: page * limit < totalEmails,
                        hasPrevPage: page > 1
                    }
                }
            });
        } catch (error) {
            console.error('Get email history error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch email history' 
            });
        }
    }
}

module.exports = { ClientsController: new ClientsController(), checkSubscriptionStatus };