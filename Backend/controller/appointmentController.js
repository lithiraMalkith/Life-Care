// Backend/controller/appointmentController.js
import { Appointment } from "../models/appointmentSchema.js";
import { User } from "../models/userSchema.js";
import ErrorHandler from "../middlewares/errorMiddleware.js";
import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";

// ------------------- Create Appointment -------------------
export const postAppointment = catchAsyncErrors(async (req, res, next) => {
    const {
        patientEmail,
        firstName,
        lastName,
        email,
        phone,
        aadhar,
        dob,
        gender,
        appointment_date,
        department,
        doctor_firstName,
        doctor_lastName,
        hasVisited,
        address,
        amount
    } = req.body;

    // Validate required fields
    if (!patientEmail || !firstName || !lastName || !email || !phone || !aadhar || !dob || !gender ||
        !appointment_date || !department || !doctor_firstName || !doctor_lastName || !address || amount === undefined) {
        return next(new ErrorHandler("Please fill the full form!", 400));
    }

    if (typeof amount !== 'number' || amount < 0) {
        return next(new ErrorHandler("Invalid amount provided", 400));
    }

    // Find doctor
    const doctor = await User.findOne({
        firstName: doctor_firstName,
        lastName: doctor_lastName,
        role: "Doctor",
        doctrDptmnt: department
    });

    if (!doctor) return next(new ErrorHandler("Doctor not found!", 404));

    // Find patient
    const patient = await User.findOne({ email: patientEmail, role: "Patient" });
    if (!patient) return next(new ErrorHandler("Patient not found!", 404));

    // Create appointment
    const appointment = await Appointment.create({
        firstName,
        lastName,
        email,
        phone,
        aadhar,
        dob,
        gender,
        appointment_date,
        department,
        doctor: {
            firstName: doctor.firstName,
            lastName: doctor.lastName
        },
        hasVisited,
        address,
        doctorId: doctor._id,
        patientId: patient._id,
        amount
    });

    res.status(201).json({
        success: true,
        message: "Appointment created successfully!",
        appointment
    });
});

// ------------------- Get All Appointments -------------------
export const getAllAppointments = catchAsyncErrors(async (req, res, next) => {
    const appointments = await Appointment.find()
        .populate("doctorId", "firstName lastName doctrDptmnt")
        .populate("patientId", "firstName lastName email");

    res.status(200).json({ success: true, appointments });
});

// ------------------- Update Appointment Status -------------------
export const updateAppointmentStatus = catchAsyncErrors(async (req, res, next) => {
    const { id } = req.params;

    const appointment = await Appointment.findByIdAndUpdate(id, req.body, {
        new: true,
        runValidators: true
    });

    if (!appointment) return next(new ErrorHandler("Appointment not found!", 404));

    res.status(200).json({
        success: true,
        message: "Appointment status updated!",
        appointment
    });
});

// ------------------- Delete Appointment -------------------
export const deleteAppointment = catchAsyncErrors(async (req, res, next) => {
    const { id } = req.params;

    const appointment = await Appointment.findById(id);
    if (!appointment) return next(new ErrorHandler("Appointment not found!", 404));

    await appointment.deleteOne();

    res.status(200).json({ success: true, message: "Appointment deleted successfully!" });
});
