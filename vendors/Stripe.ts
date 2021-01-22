/**
 * Endpoint for processing Stripe API
 * payment requests.
 */

const StripeAPI = require('stripe');
import express from 'express';

// TODO change to production key when ready
const stripe = StripeAPI(process.env.STRIPE_TEST_KEY);
const stripeRouter = express.Router();

stripeRouter.post('/create-checkout-session', async (req: any, res: any) => {

    const {priceId} = req.body;
    try {

        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [
                {
                    price: priceId,
                    // For metered billing, do not pass quantity
                    quantity: 1,
                },
            ],
            success_url: 'http://localhost:3000/landlord/premium/success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'http://localhost:3000/landlord/premium/canceled'
        });

        res.send({
            sessionId: session.id
        })

    }
    catch (e) {
        res.status(400);
        return res.send({
            error: {
                message: e.message
            }
        })
    }

})

export default stripeRouter;