// src/controllers/transactionController.js
const { Store, StoreSubscription } = require('../models');
const { initiateTransaction } = require('../services/mpesaService');
const { Op } = require('sequelize');

// Handle Subscription Creation
exports.createSubscription = async (req, res) => {
    const { storeId } = req.body;

    try {
        const store = await Store.findByPk(storeId);
        if (!store) return res.status(404).json({ error: 'Store not found' });

        const now = new Date();
        const trialEnd = new Date();
        trialEnd.setMonth(now.getMonth() + 1); // 1-month free trial

        const nextBillingDate = new Date();
        nextBillingDate.setMonth(trialEnd.getMonth() + 1); // Billing starts after trial

        const subscription = await StoreSubscription.create({
            store_id: storeId,
            start_date: now,
            end_date: trialEnd,
            next_billing_date: nextBillingDate,
            is_trial: true,
            is_active: true,
            status: 'active',
        });

        res.status(201).json({
            message: 'Subscription created successfully!',
            subscription,
        });
    } catch (error) {
        console.error('Error creating subscription:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Handle Transaction Initiation
exports.initiateTransaction = async (req, res) => {
    const { storeId, phoneNumber } = req.body;

    try {
        const subscription = await StoreSubscription.findOne({
            where: { store_id: storeId, is_active: true },
        });

        if (!subscription) return res.status(404).json({ error: 'Subscription not found' });

        const amount = 300; // KES 300
        const paymentResponse = await initiateTransaction(
            phoneNumber,
            amount,
            `${process.env.BASE_URL}/transactions/callback`,
            `Store-${storeId}`,
            'Monthly Subscription Payment'
        );

        res.status(200).json({
            message: 'Transaction initiated successfully!',
            paymentResponse,
        });
    } catch (error) {
        console.error('Error initiating transaction:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Handle Mpesa Callback
exports.handleMpesaCallback = async (req, res) => {
    const { Body } = req.body;

    try {
        const {
            stkCallback: { ResultCode, CallbackMetadata },
        } = Body;

        if (ResultCode === 0) {
            const { Item } = CallbackMetadata;
            const storeId = Item.find((i) => i.Name === 'AccountReference').Value.replace('Store-', '');

            const subscription = await StoreSubscription.findOne({ where: { store_id: storeId, is_active: true } });

            if (subscription) {
                // Keep the original next_billing_date, don't shift it to payment date
                const originalBillingDate = subscription.next_billing_date;
                subscription.next_billing_date = new Date(originalBillingDate.setMonth(originalBillingDate.getMonth() + 1));
                await subscription.save();

                // Mark the invoice as paid if it exists
                const invoice = await Invoice.findOne({ where: { store_id: storeId, payment_status: 'unpaid' } });
                if (invoice) {
                    invoice.payment_status = 'paid';
                    await invoice.save();
                }
            }

            return res.status(200).json({ message: 'Transaction processed successfully!' });
        } else {
            return res.status(400).json({ error: 'Transaction failed' });
        }
    } catch (error) {
        console.error('Error processing Mpesa callback:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};