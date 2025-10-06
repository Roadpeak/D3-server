const axios = require('axios');

// Get Access Token from Daraja
async function getAccessToken() {
  const auth = Buffer.from(`${process.env.DARAJA_API_KEY}:${process.env.DARAJA_API_SECRET}`).toString('base64');

  try {
    const response = await axios({
      method: 'get',
      url: 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Error getting access token', error);
    throw new Error('Failed to obtain access token');
  }
}

module.exports = {
  getAccessToken
};
