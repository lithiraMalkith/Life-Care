import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import express from 'express';
import { Appointment } from '../models/appointmentSchema.js';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Daily Appointments Route
  app.get('/api/v1/analytics/daily-appointments', async (req, res) => {
    try {
      const { date } = req.query;
      if (!date) {
        return res.status(400).json({ 
          success: false, 
          message: 'date query param is required (YYYY-MM-DD)' 
        });
      }

      // Since appointment_date is stored as string, match it directly
      const count = await Appointment.countDocuments({
        appointment_date: date
      });

      return res.status(200).json({ success: true, date, count });
    } catch (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to get daily appointments' 
      });
    }
  });

  // Daily Income Route
  app.get('/api/v1/analytics/daily-income', async (req, res) => {
    try {
      const { date } = req.query;
      if (!date) {
        return res.status(400).json({ 
          success: false, 
          message: 'date query param is required (YYYY-MM-DD)' 
        });
      }

      // Since appointment_date is stored as string, match it directly
      const result = await Appointment.aggregate([
        { $match: { appointment_date: date } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      const total = result.length ? result[0].total || 0 : 0;
      return res.status(200).json({ success: true, date, totalIncome: total });
    } catch (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to get daily income' 
      });
    }
  });

  // Most Visited Doctors Route
  app.get('/api/v1/analytics/most-visited-doctors', async (req, res) => {
    try {
      const { start, end, limit = 3 } = req.query;
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

      const topDoctors = await Appointment.aggregate(pipeline);
      return res.status(200).json({ success: true, start, end, topDoctors });
    } catch (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to get most visited doctors' 
      });
    }
  });
  
  return app;
};

describe('Analytics API Unit Tests', () => {
  let mongoServer;
  let app;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    app = createTestApp();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Appointment.deleteMany({});
  });

  describe('GET /api/v1/analytics/daily-appointments', () => {
    test('should return 400 if date parameter is missing', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/daily-appointments')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('date query param is required');
    });

    test('should return 0 appointments for empty date', async () => {
      const testDate = '2024-01-15';
      const response = await request(app)
        .get(`/api/v1/analytics/daily-appointments?date=${testDate}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(0);
    });

    test('should count appointments correctly', async () => {
      const testDate = '2024-01-15';
      const patientId = new mongoose.Types.ObjectId();
      const doctorId = new mongoose.Types.ObjectId();
      
      await Appointment.create([
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
          phone: '1234567890',
          aadhar: '123456789012',
          dob: new Date('1990-01-01'),
          gender: 'Male',
          appointment_date: testDate,
          department: 'Cardiology',
          doctor: {
            firstName: 'Dr. Smith',
            lastName: 'Johnson'
          },
          patientId: patientId,
          doctorId: doctorId,
          address: '123 Test St',
          amount: 500,
          status: 'Pending'
        },
        {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@test.com',
          phone: '0987654321',
          aadhar: '987654321098',
          dob: new Date('1985-05-15'),
          gender: 'Female',
          appointment_date: testDate,
          department: 'Neurology',
          doctor: {
            firstName: 'Dr. Emily',
            lastName: 'Brown'
          },
          patientId: new mongoose.Types.ObjectId(),
          doctorId: new mongoose.Types.ObjectId(),
          address: '456 Test Ave',
          amount: 750,
          status: 'Accepted'
        }
      ]);

      const response = await request(app)
        .get('/api/v1/analytics/daily-appointments?date=2024-01-15')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
    });
  });

  describe('GET /api/v1/analytics/daily-income', () => {
    test('should return 400 if date is missing', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/daily-income')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should calculate total income correctly', async () => {
      const testDate = '2024-01-15';
      
      await Appointment.create([
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
          phone: '1234567890',
          aadhar: '123456789012',
          dob: new Date('1990-01-01'),
          gender: 'Male',
          appointment_date: testDate,
          department: 'Cardiology',
          doctor: {
            firstName: 'Dr. Smith',
            lastName: 'Johnson'
          },
          patientId: new mongoose.Types.ObjectId(),
          doctorId: new mongoose.Types.ObjectId(),
          address: '123 Test St',
          amount: 500,
          status: 'Pending'
        },
        {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@test.com',
          phone: '0987654321',
          aadhar: '987654321098',
          dob: new Date('1985-05-15'),
          gender: 'Female',
          appointment_date: testDate,
          department: 'Neurology',
          doctor: {
            firstName: 'Dr. Emily',
            lastName: 'Brown'
          },
          patientId: new mongoose.Types.ObjectId(),
          doctorId: new mongoose.Types.ObjectId(),
          address: '456 Test Ave',
          amount: 1500,
          status: 'Accepted'
        }
      ]);

      const response = await request(app)
        .get('/api/v1/analytics/daily-income?date=2024-01-15')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.totalIncome).toBe(2000);
    });
  });

  describe('GET /api/v1/analytics/most-visited-doctors', () => {
    test('should return top doctors sorted by visits', async () => {
      const testDate = '2024-01-15';
      const doctorId1 = new mongoose.Types.ObjectId();
      const doctorId2 = new mongoose.Types.ObjectId();
      
      await Appointment.create([
        {
          firstName: 'Patient',
          lastName: 'One',
          email: 'p1@test.com',
          phone: '1111111111',
          aadhar: '111111111111',
          dob: new Date('1990-01-01'),
          gender: 'Male',
          appointment_date: testDate,
          department: 'Cardiology',
          doctor: {
            firstName: 'Dr. Smith',
            lastName: 'Johnson'
          },
          patientId: new mongoose.Types.ObjectId(),
          doctorId: doctorId1,
          address: '123 Test St',
          amount: 500,
          status: 'Pending'
        },
        {
          firstName: 'Patient',
          lastName: 'Two',
          email: 'p2@test.com',
          phone: '2222222222',
          aadhar: '222222222222',
          dob: new Date('1990-01-01'),
          gender: 'Female',
          appointment_date: testDate,
          department: 'Cardiology',
          doctor: {
            firstName: 'Dr. Smith',
            lastName: 'Johnson'
          },
          patientId: new mongoose.Types.ObjectId(),
          doctorId: doctorId1,
          address: '123 Test St',
          amount: 500,
          status: 'Accepted'
        },
        {
          firstName: 'Patient',
          lastName: 'Three',
          email: 'p3@test.com',
          phone: '3333333333',
          aadhar: '333333333333',
          dob: new Date('1990-01-01'),
          gender: 'Male',
          appointment_date: testDate,
          department: 'Neurology',
          doctor: {
            firstName: 'Dr. Emily',
            lastName: 'Brown'
          },
          patientId: new mongoose.Types.ObjectId(),
          doctorId: doctorId2,
          address: '456 Test Ave',
          amount: 750,
          status: 'Pending'
        }
      ]);

      const response = await request(app)
        .get('/api/v1/analytics/most-visited-doctors?limit=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.topDoctors).toHaveLength(2);
      expect(response.body.topDoctors[0].firstName).toBe('Dr. Smith');
      expect(response.body.topDoctors[0].count).toBe(2);
    });
  });
});
