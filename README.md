# UddoktaPay Payment Backend for Eternora

This is the backend server for processing UddoktaPay payments and managing subscriptions for the Eternora life simulation app.

## Features

- **Payment Processing**: Integrates with UddoktaPay API for bKash and Rocket payments
- **Subscription Management**: Handles lifetime and monthly premium subscriptions
- **Coin Purchases**: Processes coin bundle purchases
- **Webhook Handling**: Securely processes payment notifications from UddoktaPay
- **Firebase Integration**: Updates user profiles in Firestore with subscription status
- **Ad-Free Management**: Tracks and manages ad-free subscriptions

## Setup Instructions

### 1. Install Dependencies

```bash
cd uddoktapay-backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# UddoktaPay API Credentials
UDDOKTAPAY_API_KEY=your_uddoktapay_api_key_here
UDDOKTAPAY_BASE_URL=https://sandbox.uddoktapay.com/api

# Firebase Configuration
# Service account key file: apps-3000-ffbd6f6726a6.json (already in backend directory)

# Server Configuration
PORT=3000
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Webhook URL (update after deployment)
WEBHOOK_URL=https://your-backend-url.onrender.com

# Note: Frontend should use VITE_BACKEND_URL environment variable
# Example: VITE_BACKEND_URL=http://localhost:3000
```

### 3. Firebase Service Account Setup

1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate a new private key and download the JSON file
3. Rename the file to `apps-3000-ffbd6f6726a6.json`
4. Place it in the `uddoktapay-backend/` directory
5. The file is already in `.gitignore` to protect it from being committed

### 4. UddoktaPay Setup

1. Sign up at [UddoktaPay](https://uddoktapay.com)
2. Get your API credentials from the dashboard
3. Configure webhook URL in UddoktaPay dashboard:
   - Sandbox: `https://your-backend-url.onrender.com/api/webhook`
   - Production: Update with your deployed backend URL

### 5. Run the Server

```bash
# Development
npm start

# Or with nodemon for auto-reload
npm install -g nodemon
nodemon index.js
```

## API Endpoints

### POST /api/checkout
Initialize a payment session with UddoktaPay.

**Request Body:**
```json
{
  "packageId": "lifetime_premium",
  "uid": "firebase_user_id",
  "fullName": "John Doe",
  "email": "john@example.com",
  "phone": "+8801XXXXXXXXX"
}
```

**Response:**
```json
{
  "success": true,
  "paymentUrl": "https://checkout.uddoktapay.com/...",
  "invoiceId": "invoice_id_here"
}
```

### POST /api/webhook
Handles payment notifications from UddoktaPay. This endpoint is called by UddoktaPay when a payment is completed.

**Headers:**
- `RT-UDDOKTAPAY-API-KEY`: Your UddoktaPay API key for verification

**Request Body:**
```json
{
  "invoice_id": "invoice_id",
  "status": "completed",
  "amount": 999,
  "metadata": {
    "packageId": "lifetime_premium",
    "uid": "firebase_user_id"
  },
  "transaction_id": "transaction_id"
}
```

### GET /api/verify/:uid
Verify subscription status for a user.

**Response:**
```json
{
  "success": true,
  "subscription": {
    "active": true,
    "plan": "lifetime",
    "end": null
  },
  "adFree": true,
  "premiumLifeAccess": true,
  "coins": 1500
}
```

### GET /health
Health check endpoint.

## Payment Packages

### Core Packages
- **lifetime_premium** (999 TAKA): Lifetime premium, 500 bonus coins, ad-free
- **monthly_premium** (49 TAKA): 30-day premium, ad-free
- **coin_bundle** (299 TAKA): 1000 coins

### Additional Packages
- **starter_coin_pack** (99 TAKA): 300 coins
- **coin_pack_a** (199 TAKA): 600 coins
- **coin_pack_b** (499 TAKA): 1500 coins
- **coin_pack_c** (999 TAKA): 3500 coins
- **seasonal_pass** (199 TAKA): 30-day seasonal content
- **character_pack** (149 TAKA): 5 premium characters
- **ad_free_week** (29 TAKA): 7-day ad-free

## Database Schema Updates

The backend adds the following fields to `eternora_userProfiles` collection:

```javascript
{
  // Subscription fields
  eternora_subscriptionActive: false,
  eternora_subscriptionPlan: null, // 'lifetime', 'monthly', null
  eternora_subscriptionStart: null,
  eternora_subscriptionEnd: null, // For monthly subscriptions
  eternora_adFree: false,
  eternora_premiumLifeAccess: false,
  
  // Payment history
  eternora_paymentHistory: [], // Track all transactions
}
```

## Security Considerations

1. **API Key Security**: Never commit `.env` file to version control
2. **Webhook Verification**: The webhook endpoint verifies the API key header
3. **Firebase Security Rules**: Subscription fields should be admin-only writes
4. **UID-based Identification**: All operations use Firebase UID for security

## Deployment to Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set environment variables in Render dashboard
4. Deploy the service
5. Update webhook URL in UddoktaPay dashboard

## Testing

### Local Testing
1. Use UddoktaPay sandbox environment
2. Test payment flow with test credentials
3. Verify webhook handling
4. Check Firebase Firestore for updates

### Production Testing
1. Switch to production UddoktaPay API
2. Test with real payments (small amounts)
3. Verify subscription activation
4. Monitor error logs

## Troubleshooting

### Payment Not Processing
- Check UddoktaPay API credentials
- Verify webhook URL is correct
- Check server logs for errors

### Subscription Not Activating
- Verify Firebase Admin SDK is initialized
- Check Firestore security rules
- Ensure webhook is receiving notifications

### CORS Errors
- Verify `FRONTEND_URL` in `.env`
- Check CORS configuration in `index.js`

## Support

For issues or questions, contact the development team or check the main project documentation.
