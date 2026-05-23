// content/stores/UserProfileStore.js

const DEFAULT_PROFILE = {
  personalInfo: {
    fullName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    linkedIn: '',
    portfolio: '',
    github: '',
    website: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    pincode: ''
  },
  education: {
    college: '',
    degree: '',
    branch: '',
    cgpa: '',
    percentage: '',
    graduationYear: '',
    tenthPercentage: '',
    tenthBoard: '',
    twelfthPercentage: '',
    twelfthBoard: ''
  },
  professional: {
    skills: [],
    languages: [],
    tools: [],
    frameworks: [],
    workExperience: '',
    internships: '',
    projects: [],
    certifications: [],
    achievements: []
  },
  preferences: {
    jobTypes: [],
    locations: [],
    expectedCTC: '',
    noticePeriod: ''
  },
  customAnswers: {},
  resumeText: '',
  createdAt: null,
  updatedAt: null
};

export class UserProfileStore {
  static async getProfile() {
    const result = await chrome.storage.local.get('userProfile');
    return result.userProfile || DEFAULT_PROFILE;
  }

  static async saveProfile(profileData) {
    const existing = await this.getProfile();
    const merged = this.deepMerge(existing, profileData);
    merged.updatedAt = new Date().toISOString();
    if (!merged.createdAt) merged.createdAt = new Date().toISOString();
    await chrome.storage.local.set({ userProfile: merged });
    return merged;
  }

  static async updateField(path, value) {
    const profile = await this.getProfile();
    this.setNestedValue(profile, path, value);
    profile.updatedAt = new Date().toISOString();
    await chrome.storage.local.set({ userProfile: profile });
    return profile;
  }

  static deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  static setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]] = current[keys[i]] || {};
    }
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Flatten profile into question-answer pairs for semantic matching.
   */
  static flattenForMatching(profile) {
    const p = profile.personalInfo;
    const e = profile.education;
    const pr = profile.professional;

    return [
      { field: 'fullName', question: 'Full name', answer: p.fullName },
      { field: 'firstName', question: 'First name', answer: p.firstName },
      { field: 'lastName', question: 'Last name / surname', answer: p.lastName },
      { field: 'email', question: 'Email address', answer: p.email },
      { field: 'phone', question: 'Phone number / mobile number', answer: p.phone },
      { field: 'dateOfBirth', question: 'Date of birth', answer: p.dateOfBirth },
      { field: 'gender', question: 'Gender', answer: p.gender },
      { field: 'linkedin', question: 'LinkedIn profile URL', answer: p.linkedIn },
      { field: 'portfolio', question: 'Portfolio website', answer: p.portfolio },
      { field: 'github', question: 'GitHub profile', answer: p.github },
      { field: 'city', question: 'City / current location', answer: p.city },
      { field: 'state', question: 'State', answer: p.state },
      { field: 'country', question: 'Country', answer: p.country },
      { field: 'college', question: 'College / university name', answer: e.college },
      { field: 'degree', question: 'Degree / qualification', answer: e.degree },
      { field: 'branch', question: 'Branch / major / specialization', answer: e.branch },
      { field: 'cgpa', question: 'CGPA / cumulative GPA / academic score', answer: e.cgpa },
      { field: 'percentage', question: 'Percentage / marks obtained', answer: e.percentage },
      { field: 'graduationYear', question: 'Graduation year / expected graduation', answer: e.graduationYear },
      { field: 'tenthPercentage', question: '10th percentage / SSC marks', answer: e.tenthPercentage },
      { field: 'twelfthPercentage', question: '12th percentage / HSC marks', answer: e.twelfthPercentage },
      { field: 'skills', question: 'Skills / technical skills', answer: Array.isArray(pr.skills) ? pr.skills.join(', ') : pr.skills },
      { field: 'languages', question: 'Programming languages known', answer: Array.isArray(pr.languages) ? pr.languages.join(', ') : pr.languages },
      { field: 'workExperience', question: 'Work experience / professional experience', answer: pr.workExperience },
      { field: 'internships', question: 'Internship experience', answer: pr.internships },
      // Custom answers override everything
      ...Object.entries(profile.customAnswers || {}).map(([q, a]) => ({
        field: 'custom', question: q, answer: a
      }))
    ].filter(item => item.answer && item.answer !== '');
  }
}
