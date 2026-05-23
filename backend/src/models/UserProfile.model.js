// backend/src/models/UserProfile.model.js
import mongoose from 'mongoose';

const userProfileSchema = new mongoose.Schema({
  extensionId: { type: String, required: true, unique: true, index: true },
  personalInfo: {
    fullName: String, firstName: String, lastName: String,
    email: String, phone: String, dateOfBirth: String, gender: String,
    linkedIn: String, portfolio: String, github: String, website: String,
    address: String, city: String, state: String, country: String, pincode: String
  },
  education: {
    college: String, degree: String, branch: String,
    cgpa: String, percentage: String, graduationYear: String,
    tenthPercentage: String, tenthBoard: String,
    twelfthPercentage: String, twelfthBoard: String
  },
  professional: {
    skills: [String], languages: [String], tools: [String], frameworks: [String],
    workExperience: String, internships: String,
    projects: [{ name: String, description: String, url: String, tech: [String] }],
    certifications: [String], achievements: [String]
  },
  preferences: {
    jobTypes: [String], locations: [String], expectedCTC: String, noticePeriod: String
  },
  customAnswers: { type: Map, of: String },
  resumeText: String
}, { timestamps: true });

export const UserProfile = mongoose.model('UserProfile', userProfileSchema);
