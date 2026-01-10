const mongoose = require('mongoose');

// CVSS V3 Metrics Schema
const cvssV3Schema = new mongoose.Schema({
  score: {
    type: Number,
    min: 0,
    max: 10
  },
  severity: {
    type: String,
    enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
  },
  vector: String,
  attackVector: String,
  attackComplexity: String,
  privilegesRequired: String,
  userInteraction: String,
  scope: String,
  confidentialityImpact: String,
  integrityImpact: String,
  availabilityImpact: String
}, { _id: false });

// CVSS V2 Metrics Schema
const cvssV2Schema = new mongoose.Schema({
  score: {
    type: Number,
    min: 0,
    max: 10
  },
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH']
  },
  vector: String,
  accessVector: String,
  accessComplexity: String,
  authentication: String,
  confidentialityImpact: String,
  integrityImpact: String,
  availabilityImpact: String
}, { _id: false });

// CISA KEV Data Schema
const cisaKevDataSchema = new mongoose.Schema({
  dateAdded: Date,
  dueDate: Date,
  notes: String,
  requiredAction: String,
  knownRansomwareCampaignUse: {
    type: String,
    enum: ['Known', 'Unknown', 'Yes', 'No', 'true', 'false']
  }
}, { _id: false });

// Reference Schema
const referenceSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  source: String,
  tags: [String]
}, { _id: false });

// Affected Product Schema
const affectedProductSchema = new mongoose.Schema({
  vendor: String,
  product: String,
  versions: [String],
  versionStartIncluding: String,
  versionEndExcluding: String,
  versionStartExcluding: String,
  versionEndIncluding: String
}, { _id: false });

// CWE Schema
const cweSchema = new mongoose.Schema({
  cweId: String,
  description: String
}, { _id: false });

// Main CVE Schema
const cveSchema = new mongoose.Schema({
  cveId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    match: /^CVE-\d{4}-\d+$/
  },
  description: {
    type: String,
    required: false,
    default: 'No description available'
  },
  publishedDate: {
    type: Date,
    required: true,
    index: true
  },
  lastModifiedDate: {
    type: Date,
    required: true
  },
  vulnStatus: {
    type: String,
    enum: ['Analyzed', 'Modified', 'Awaiting Analysis', 'Rejected', 'Received', 'Undergoing Analysis'],
    default: 'Awaiting Analysis'
  },
  cvssV3: cvssV3Schema,
  cvssV2: cvssV2Schema,
  epssScore: {
    type: Number,
    min: 0,
    max: 1,
    default: null
  },
  epssPercentile: {
    type: Number,
    min: 0,
    max: 100,
    default: null
  },
  exploitAvailable: {
    type: Boolean,
    default: false,
    index: true
  },
  cisaKev: {
    type: Boolean,
    default: false,
    index: true
  },
  cisaKevData: cisaKevDataSchema,
  references: [referenceSchema],
  affectedProducts: [affectedProductSchema],
  cwe: [cweSchema],
  attackVector: {
    type: String,
    enum: ['NETWORK', 'ADJACENT_NETWORK', 'LOCAL', 'PHYSICAL', null],
    index: true
  },
  attackComplexity: {
    type: String,
    enum: ['LOW', 'HIGH', null]
  },
  privilegesRequired: {
    type: String,
    enum: ['NONE', 'LOW', 'HIGH', null]
  },
  userInteraction: {
    type: String,
    enum: ['NONE', 'REQUIRED', null]
  },
  scope: {
    type: String,
    enum: ['UNCHANGED', 'CHANGED', null]
  },
  patchAvailable: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  collection: 'cves'
});

// ==================== INDEXES ====================

// Compound index for filtering by date and severity
cveSchema.index({ publishedDate: -1, 'cvssV3.severity': 1 });

// Text index for search functionality
cveSchema.index({ cveId: 'text', description: 'text' }, {
  weights: {
    cveId: 10,
    description: 5
  }
});

// Index on EPSS score for trending vulnerabilities (descending)
cveSchema.index({ epssScore: -1 });

// Compound index for filtering exploitable CVEs
cveSchema.index({ exploitAvailable: 1, cisaKev: 1 });

// Index for vendor filtering
cveSchema.index({ 'affectedProducts.vendor': 1 });

// Compound index for severity and publish date queries
cveSchema.index({ 'cvssV3.score': -1, publishedDate: -1 });

// ==================== VIRTUAL FIELDS ====================

// Virtual field to get CVSS score (prefers V3, falls back to V2)
cveSchema.virtual('cvssScore').get(function() {
  if (this.cvssV3 && this.cvssV3.score != null) {
    return this.cvssV3.score;
  }
  if (this.cvssV2 && this.cvssV2.score != null) {
    return this.cvssV2.score;
  }
  return null;
});

// Virtual field to get severity (prefers V3, falls back to V2)
cveSchema.virtual('severity').get(function() {
  if (this.cvssV3 && this.cvssV3.severity) {
    return this.cvssV3.severity;
  }
  if (this.cvssV2 && this.cvssV2.severity) {
    return this.cvssV2.severity;
  }
  return 'NONE';
});

// Virtual field for EPSS as percentage
cveSchema.virtual('epssPercentage').get(function() {
  return this.epssScore ? (this.epssScore * 100).toFixed(2) : null;
});

// ==================== INSTANCE METHODS ====================

// Override toJSON to customize output
cveSchema.methods.toJSON = function() {
  const obj = this.toObject();
  
  // Remove MongoDB internal fields
  delete obj.__v;
  
  // Include virtual fields
  obj.cvssScore = this.cvssScore;
  obj.severity = this.severity;
  obj.epssPercentage = this.epssPercentage;
  
  // Format dates
  if (obj.publishedDate) {
    obj.publishedDate = obj.publishedDate.toISOString();
  }
  if (obj.lastModifiedDate) {
    obj.lastModifiedDate = obj.lastModifiedDate.toISOString();
  }
  if (obj.createdAt) {
    obj.createdAt = obj.createdAt.toISOString();
  }
  if (obj.updatedAt) {
    obj.updatedAt = obj.updatedAt.toISOString();
  }
  
  return obj;
};

// Check if CVE is critical
cveSchema.methods.isCritical = function() {
  return this.severity === 'CRITICAL';
};

// Check if CVE is high risk
cveSchema.methods.isHighRisk = function() {
  return this.severity === 'CRITICAL' || this.severity === 'HIGH';
};

// Get risk score (combines CVSS, EPSS, and other factors)
cveSchema.methods.getRiskScore = function() {
  let score = 0;
  
  // Base CVSS score (0-10)
  if (this.cvssScore) {
    score += this.cvssScore * 5; // Max 50 points
  }
  
  // EPSS contribution (0-30)
  if (this.epssScore) {
    score += this.epssScore * 30; // Max 30 points
  }
  
  // Exploit available (+10)
  if (this.exploitAvailable) {
    score += 10;
  }
  
  // CISA KEV (+10)
  if (this.cisaKev) {
    score += 10;
  }
  
  return Math.min(score, 100); // Cap at 100
};

// ==================== STATIC METHODS ====================

// Find CVEs by severity
cveSchema.statics.findBySeverity = function(severity) {
  return this.find({
    $or: [
      { 'cvssV3.severity': severity.toUpperCase() },
      { 'cvssV2.severity': severity.toUpperCase() }
    ]
  }).sort({ publishedDate: -1 });
};

// Find CVEs with available exploits
cveSchema.statics.findWithExploits = function() {
  return this.find({ exploitAvailable: true })
    .sort({ epssScore: -1, publishedDate: -1 });
};

// Find CVEs in CISA KEV catalog
cveSchema.statics.findInCisaKev = function() {
  return this.find({ cisaKev: true })
    .sort({ 'cisaKevData.dateAdded': -1 });
};

// Find CVEs by vendor
cveSchema.statics.findByVendor = function(vendor) {
  return this.find({
    'affectedProducts.vendor': new RegExp(vendor, 'i')
  }).sort({ publishedDate: -1 });
};

// Find CVEs by product
cveSchema.statics.findByProduct = function(product) {
  return this.find({
    'affectedProducts.product': new RegExp(product, 'i')
  }).sort({ publishedDate: -1 });
};

// Find trending CVEs (high EPSS score)
cveSchema.statics.findTrending = function(limit = 10) {
  return this.find({
    epssScore: { $gt: 0 }
  })
    .sort({ epssScore: -1 })
    .limit(limit);
};

// Get statistics
cveSchema.statics.getStatistics = async function() {
  const total = await this.countDocuments();
  const critical = await this.countDocuments({ 'cvssV3.severity': 'CRITICAL' });
  const high = await this.countDocuments({ 'cvssV3.severity': 'HIGH' });
  const medium = await this.countDocuments({ 'cvssV3.severity': 'MEDIUM' });
  const low = await this.countDocuments({ 'cvssV3.severity': 'LOW' });
  const withExploits = await this.countDocuments({ exploitAvailable: true });
  const inCisaKev = await this.countDocuments({ cisaKev: true });
  
  return {
    total,
    bySeverity: {
      critical,
      high,
      medium,
      low
    },
    withExploits,
    inCisaKev
  };
};

// ==================== MIDDLEWARE ====================

// Pre-save middleware for data validation
cveSchema.pre('save', async function() {
  // Validate CVE ID format
  if (!this.cveId.match(/^CVE-\d{4}-\d+$/)) {
    throw new Error('Invalid CVE ID format');
  }
  
  // Ensure lastModifiedDate is not before publishedDate
  if (this.lastModifiedDate < this.publishedDate) {
    this.lastModifiedDate = this.publishedDate;
  }
  
  // Auto-populate attackVector from cvssV3 if not set
  if (this.cvssV3 && this.cvssV3.attackVector && !this.attackVector) {
    this.attackVector = this.cvssV3.attackVector;
  }
  
  // Auto-populate attackComplexity from cvssV3 if not set
  if (this.cvssV3 && this.cvssV3.attackComplexity && !this.attackComplexity) {
    this.attackComplexity = this.cvssV3.attackComplexity;
  }
  
  // Validate EPSS score range
  if (this.epssScore != null && (this.epssScore < 0 || this.epssScore > 1)) {
    throw new Error('EPSS score must be between 0 and 1');
  }
  
  // Validate EPSS percentile range
  if (this.epssPercentile != null && (this.epssPercentile < 0 || this.epssPercentile > 100)) {
    throw new Error('EPSS percentile must be between 0 and 100');
  }
});

// Post-save middleware for logging
cveSchema.post('save', function(doc) {
  console.log(`✅ CVE saved: ${doc.cveId}`);
});

// Pre-update middleware
cveSchema.pre('findOneAndUpdate', async function() {
  this.set({ lastModifiedDate: new Date() });
});

// ==================== EXPORT ====================

const CVE = mongoose.model('CVE', cveSchema);

module.exports = CVE;
