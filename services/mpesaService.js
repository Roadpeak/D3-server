const axios = require('axios');

const getMpesaAccessToken = async () => {
    try {
        const response = await axios({
            method: 'GET',
            url: `${process.env.MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
            auth: {
                username: process.env.MPESA_CONSUMER_KEY,
                password: process.env.MPESA_CONSUMER_SECRET,
            },
        });

        return response.data.access_token;
    } catch (error) {
        console.error('Error fetching M-Pesa access token:', error);
        throw new Error('Failed to fetch M-Pesa access token');
    }
};

const initiateTransaction = async (phone, amount, callbackUrl, accountReference, transactionDesc) => {
    try {
        const accessToken = await getMpesaAccessToken();

        const payload = {
            BusinessShortCode: process.env.MPESA_SHORT_CODE,
            Password: Buffer.from(
                `${process.env.MPESA_SHORT_CODE}${process.env.MPESA_PASS_KEY}${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`
            ).toString('base64'),
            Timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
            TransactionType: 'CustomerPayBillOnline',
            Amount: amount,
            PartyA: phone,
            PartyB: process.env.MPESA_SHORT_CODE,
            PhoneNumber: phone,
            CallBackURL: callbackUrl,
            AccountReference: accountReference,
            TransactionDesc: transactionDesc,
        };

        const response = await axios({
            method: 'POST',
            url: `${process.env.MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            data: payload,
        });

        return response.data;
    } catch (error) {
        console.error('M-Pesa Transaction Error:', error.response ? error.response.data : error.message);
        throw new Error('Failed to initiate transaction');
    }
};

module.exports = { initiateTransaction };
