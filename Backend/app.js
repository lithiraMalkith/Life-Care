import { config } from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fileUpload from "express-fileupload";
import { dbConnection } from "./database/dbConnection.js";
import { errorMiddleware } from "./middlewares/errorMiddleware.js";

import userRouter from "./router/userRouter.js";
import messageRouter from "./router/messageRouter.js";
import appointmentRouter from "./router/appointmentRouter.js";
import medicalHistoryRoutes from "./router/medicalHistoryRoutes.js";
import { Appointment } from "./models/appointmentSchema.js"; // Added for analytics

config({ path: "./.env" });

const app = express();

// Stripe webhook needs raw body, so we handle it before other middleware
app.use('/api/v1/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const stripe = new (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
    
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    try {
      const { default: Payment } = await import('./models/Payment.js');
      const { Appointment } = await import('./models/appointmentSchema.js');
      
      const payment = await Payment.findOne({ stripeSessionId: session.id });
      if (payment) {
        payment.status = 'completed';
        payment.paidAt = new Date();
        payment.stripePaymentIntentId = session.payment_intent;
        await payment.save();

        await Appointment.findByIdAndUpdate(payment.appointment, {
          paymentStatus: 'paid',
          payment: payment._id,
          status: 'Confirmed'
        });

        console.log(`Payment ${payment._id} completed successfully via webhook`);
      }
    } catch (error) {
      console.error('Error handling successful payment via webhook:', error);
    }
  }

  res.json({ received: true });
});

// Regular middleware for other routes
app.use(cors({
  origin: [process.env.FRONTEND_PATIENT, process.env.FRONTEND_ADMIN],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Routes
app.use("/api/v1/message", messageRouter);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/appointment", appointmentRouter);
app.use("/api/v1/medical-history", medicalHistoryRoutes);

// Analytics endpoints
// 1) Daily appointment count
app.get('/api/v1/analytics/daily-appointments', async (req, res) => {
  try {
    const { date } = req.query; // expected format: YYYY-MM-DD (matches appointment_date string)
    if (!date) return res.status(400).json({ success: false, message: 'date query param is required (YYYY-MM-DD)' });

    const count = await Appointment.countDocuments({ appointment_date: date });
    return res.status(200).json({ success: true, date, count });
  } catch (err) {
    console.error('daily-appointments error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get daily appointment count' });
  }
});

// 2) Daily income (best-effort: sums Appointment.amount if present; returns 0 otherwise)
app.get('/api/v1/analytics/daily-income', async (req, res) => {
  try {
    const { date } = req.query; // YYYY-MM-DD
    if (!date) return res.status(400).json({ success: false, message: 'date query param is required (YYYY-MM-DD)' });

    const pipeline = [
      { $match: { appointment_date: date } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ];

    const result = await Appointment.aggregate(pipeline);
    const total = result.length ? result[0].total || 0 : 0;
    return res.status(200).json({ success: true, date, totalIncome: total });
  } catch (err) {
    console.error('daily-income error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get daily income' });
  }
});

// 3) Most visited doctors within a date range (by total appointments)
app.get('/api/v1/analytics/most-visited-doctors', async (req, res) => {
  try {
    const { start, end, limit = 3 } = req.query; // dates as YYYY-MM-DD
    const match = {};
    if (start && end) {
      match.appointment_date = { $gte: start, $lte: end };
    }

    const pipeline = [
      { $match: match },
      { $group: {
          _id: "$doctorId",
          count: { $sum: 1 },
          firstName: { $first: "$doctor.firstName" },
          lastName: { $first: "$doctor.lastName" },
          department: { $first: "$department" }
      }},
      { $sort: { count: -1 } },
      { $limit: Number(limit) }
    ];

    let topDoctors = await Appointment.aggregate(pipeline);

    // Fallback: if fewer than requested limit are found in range, fill with overall top doctors
    const lim = Number(limit);
    if (topDoctors.length < lim) {
      const excludeIds = topDoctors.map(d => d._id).filter(Boolean);
      const fallbackMatch = excludeIds.length ? { doctorId: { $nin: excludeIds } } : {};
      const fallbackPipeline = [
        { $match: fallbackMatch },
        { $group: {
            _id: "$doctorId",
            count: { $sum: 1 },
            firstName: { $first: "$doctor.firstName" },
            lastName: { $first: "$doctor.lastName" },
            department: { $first: "$department" }
        }},
        { $sort: { count: -1 } },
        { $limit: lim - topDoctors.length }
      ];
      const fillers = await Appointment.aggregate(fallbackPipeline);
      topDoctors = topDoctors.concat(fillers);
    }

    return res.status(200).json({ success: true, start, end, topDoctors });
  } catch (err) {
    console.error('most-visited-doctors error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get most visited doctors' });
  }
});

app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running healthy",
    timestamp: new Date().toISOString()
  });
});

dbConnection();

app.use(errorMiddleware);

export default app;