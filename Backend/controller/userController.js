import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/errorMiddleware.js";
import { User } from "../models/userSchema.js";
import cloudinary from "cloudinary";



// ------------------- Patient Registration -------------------
export const patientRegister = catchAsyncErrors(async (req, res, next) => {
  const { firstName, lastName, email, phone, password, gender, aadhar, dob } = req.body;

  if (!firstName || !lastName || !email || !phone || !password || !gender || !aadhar || !dob) {
    return next(new ErrorHandler("Please fill the full form!", 400));
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new ErrorHandler("User already registered with this email!", 400));
  }

  const user = await User.create({
    firstName,
    lastName,
    email,
    phone,
    password,
    gender,
    dob,
    aadhar,
    role: "Patient",
  });

  res.status(201).json({
    success: true,
    message: "User registered successfully!",
    user,
  });
});

// ------------------- Patient / User Login -------------------
export const login = catchAsyncErrors(async (req, res, next) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return next(new ErrorHandler("Please provide all details!", 400));
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    return next(new ErrorHandler("Invalid Email or Password!", 400));
  }

  if (user.role !== role) {
    return next(new ErrorHandler(`User with role ${role} not found!`, 400));
  }

  const userWithoutPassword = await User.findById(user._id);
  res.status(200).json({
    success: true,
    message: "User login successful!",
    user: userWithoutPassword,
  });
});

// ------------------- Add New Admin -------------------
export const addNewAdmin = catchAsyncErrors(async (req, res, next) => {
  const { firstName, lastName, email, phone, password, gender, aadhar, dob } = req.body;

  if (!firstName || !lastName || !email || !phone || !password || !gender || !aadhar || !dob) {
    return next(new ErrorHandler("Please fill full form!", 400));
  }

  const existingAdmin = await User.findOne({ email });
  if (existingAdmin) {
    return next(new ErrorHandler(`${existingAdmin.role} with this email already exists!`, 400));
  }

  const admin = await User.create({
    firstName,
    lastName,
    email,
    phone,
    password,
    gender,
    aadhar,
    dob,
    role: "Admin",
  });

  res.status(201).json({
    success: true,
    message: "New Admin registered successfully!",
    admin,
  });
});

// ------------------- Get All Doctors -------------------
export const getAllDoctors = catchAsyncErrors(async (req, res, next) => {
  const doctors = await User.find({ role: "Doctor" });
  res.status(200).json({
    success: true,
    doctors,
  });
});

// ------------------- Get User Details -------------------
export const getUserDetails = catchAsyncErrors(async (req, res, next) => {
  const { userId } = req.query; // JWT-free: pass userId in query
  if (!userId) return next(new ErrorHandler("User ID required!", 400));

  const user = await User.findById(userId);
  if (!user) return next(new ErrorHandler("User not found!", 404));

  res.status(200).json({
    success: true,
    user,
  });
});

// ------------------- Logout Admin -------------------
export const logoutAdmin = catchAsyncErrors(async (req, res, next) => {

  // Prevent caching of logout response
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");

  // Clear auth cookie if used
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "none",
    secure: true,
  });
  
  res.status(200).json({
    success: true,
    message: "Admin logged out successfully!",
  });
});

// ------------------- Logout Patient -------------------
export const logoutPatient = catchAsyncErrors(async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: "Patient logged out successfully!",
  });
});

// ------------------- Add New Doctor -------------------
export const addNewDoctor = catchAsyncErrors(async (req, res, next) => {
  if (!req.files || !req.files.doctrAvatar) {
    return next(new ErrorHandler("Doctor avatar required!", 400));
  }

  const { doctrAvatar } = req.files;
  const allowedFormats = ["image/png", "image/jpeg", "image/webp"];
  if (!allowedFormats.includes(doctrAvatar.mimetype)) {
    return next(new ErrorHandler("File format not supported!", 400));
  }

  const { firstName, lastName, email, phone, password, gender, aadhar, dob, doctrDptmnt } = req.body;

  if (!firstName || !lastName || !email || !phone || !password || !gender || !aadhar || !dob || !doctrDptmnt) {
    return next(new ErrorHandler("Please provide full details", 400));
  }

  const existingDoctor = await User.findOne({ email });
  if (existingDoctor) {
    return next(new ErrorHandler(`${existingDoctor.role} already registered with this email!`, 400));
  }

  const cloudinaryResponse = await cloudinary.uploader.upload(doctrAvatar.tempFilePath);

  const doctor = await User.create({
    firstName,
    lastName,
    email,
    phone,
    password,
    gender,
    aadhar,
    dob,
    role: "Doctor",
    doctrDptmnt,
    doctrAvatar: {
      public_id: cloudinaryResponse.public_id,
      url: cloudinaryResponse.secure_url,
    },
  });

  res.status(201).json({
    success: true,
    message: "New Doctor registered successfully!",
    doctor,
  });
});
