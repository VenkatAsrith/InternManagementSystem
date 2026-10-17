import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Organization, Department } from '../modules/organizations/organization.model.js';
import { User } from '../modules/users/user.model.js';
import { seedDefaultTemplates } from '../modules/templates/template.service.js';
import { ROLES } from '../../../shared/constants.js';

/**
 * Bootstrap production database:
 * 1. Ensures root Organization exists
 * 2. Ensures essential Departments exist
 * 3. Ensures Super Admin account exists with dynamic credentials from environment
 * 4. Ensures default Document Templates (Offer, NDA, Certificate, etc.) are seeded
 * 5. Optionally cleans any test/demo records
 */
export async function bootstrapSystem({ cleanTestData = false } = {}) {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGO_URI);
    }

    const adminEmail = (env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPassword = env.ADMIN_PASSWORD || '';

    logger.info(`[BOOTSTRAP] Checking system initialization on: ${mongoose.connection.host}/${mongoose.connection.name}`);

    // If requested to clean test data, purge all demo records
    if (cleanTestData) {
      logger.info('[BOOTSTRAP] Cleaning test and demo data from database...');
      const db = mongoose.connection.db;

      // Keep only the official admin
      const preservedEmails = [adminEmail].filter(Boolean);
      await User.deleteMany({ email: { $nin: preservedEmails } });

      const collectionsToPurge = [
        'interns',
        'candidates',
        'applications',
        'interviews',
        'offers',
        'onboardingplans',
        'onboardingtasks',
        'projects',
        'tasks',
        'tasksubmissions',
        'attendancerecords',
        'journalentries',
        'performancereviews',
        'feedbacks',
        'meetings',
        'certificates',
        'bootcamps',
        'passes',
        'leaves',
        'assets',
        'exits',
        'payments',
        'paymentledgers',
        'compensationplans',
        'traineetasks',
        'traineeattendances',
        'traineeactivities',
        'traineeassessments',
        'traineeprojects',
        'trainingprograms',
        'courses',
        'trainingbatches',
        'trainingengagements',
        'conversations',
        'chatmessages',
        'notifications'
      ];

      for (const coll of collectionsToPurge) {
        try {
          const exists = await db.listCollections({ name: coll }).hasNext();
          if (exists) {
            await db.collection(coll).deleteMany({});
          }
        } catch {
          // ignore if collection doesn't exist
        }
      }
      logger.info('[BOOTSTRAP] Test & demo data cleanup completed.');
    }

    // 1. Ensure Root Organization
    let org = await Organization.findOne({ slug: 'techmecha-torque' }) || await Organization.findOne({});
    if (!org) {
      logger.info('[BOOTSTRAP] Creating root organization: TechMecha Torque...');
      org = await Organization.create({
        name: 'TechMecha Torque',
        slug: 'techmecha-torque',
        code: 'TMT',
        domain: 'tmt.com',
        email: adminEmail || 'contact@tmt.com',
        phone: '+1 (555) 234-5678',
        address: {
          street: '450 Innovation Parkway, Suite 800',
          city: 'San Jose',
          state: 'CA',
          country: 'USA',
          zipCode: '95134'
        },
        website: 'https://techmecha.com',
        signatory: {
          name: 'Executive Director',
          title: 'VP of Engineering & Talent'
        },
        status: 'ACTIVE'
      });
      logger.info(`[BOOTSTRAP] Root organization created with ID: ${org._id}`);
    }

    // 2. Ensure Essential Departments
    const defaultDepts = [
      { name: 'Software Engineering', code: 'ENG', description: 'Core web applications, distributed systems, and platform infrastructure.' },
      { name: 'Product & Design', code: 'PRD', description: 'Product lifecycle strategy, UX research, and UI systems.' },
      { name: 'Data & Machine Intelligence', code: 'DMI', description: 'Telemetry analytics, algorithms, and data pipelines.' },
      { name: 'Human Resources', code: 'HR', description: 'People operations, talent acquisition, and internship program management.' }
    ];

    let primaryDept = null;
    for (const d of defaultDepts) {
      let dept = await Department.findOne({ organizationId: org._id, code: d.code });
      if (!dept) {
        dept = await Department.create({
          organizationId: org._id,
          name: d.name,
          code: d.code,
          description: d.description,
          isActive: true
        });
      }
      if (!primaryDept && dept.code === 'ENG') {
        primaryDept = dept;
      }
    }

    // 3. Ensure Super Admin Account
    let adminUser = null;
    if (adminEmail) {
      adminUser = await User.findOne({ email: adminEmail }).select('+password');
      if (!adminUser) {
        if (!adminPassword) {
          logger.warn(`[BOOTSTRAP] Admin email '${adminEmail}' specified in environment but no ADMIN_PASSWORD set.`);
        }
        logger.info(`[BOOTSTRAP] Creating system administrator: ${adminEmail}...`);
        adminUser = await User.create({
          firstName: 'System',
          lastName: 'Administrator',
          email: adminEmail,
          password: adminPassword || 'Admin2026!Secure',
          role: ROLES.SUPER_ADMIN,
          organizationId: org._id,
          departmentId: primaryDept?._id,
          phone: '+1 555 000 0001',
          isActive: true,
          approvalStatus: 'APPROVED'
        });
        logger.info(`[BOOTSTRAP] Super Admin account created: ${adminUser.email}`);
      } else {
        // Ensure privileges are active
        let modified = false;
        if (adminUser.role !== ROLES.SUPER_ADMIN) {
          adminUser.role = ROLES.SUPER_ADMIN;
          modified = true;
        }
        if (!adminUser.isActive) {
          adminUser.isActive = true;
          modified = true;
        }
        if (adminUser.approvalStatus !== 'APPROVED') {
          adminUser.approvalStatus = 'APPROVED';
          modified = true;
        }
        if (adminPassword) {
          const match = await adminUser.comparePassword(adminPassword);
          if (!match) {
            logger.info(`[BOOTSTRAP] Updating admin password to match environment setting...`);
            adminUser.password = adminPassword;
            modified = true;
          }
        }
        if (modified) {
          await adminUser.save();
          logger.info(`[BOOTSTRAP] Admin user '${adminEmail}' credentials and role synchronized.`);
        }
      }
    }

    // 4. Seed Essential Document Templates (Offer letter, NDA, Certificate, etc.)
    if (adminUser) {
      await seedDefaultTemplates(org._id, adminUser._id);
      logger.info(`[BOOTSTRAP] Default document templates verified.`);
    }

    logger.info(`[BOOTSTRAP] System bootstrap completed successfully.`);
    return {
      success: true,
      organizationId: org._id,
      adminEmail: adminUser?.email
    };
  } catch (err) {
    logger.error('[BOOTSTRAP] Failed to bootstrap system:', err);
    throw err;
  }
}

// Direct CLI execution support
if (process.argv[1]?.endsWith('bootstrap.js')) {
  const clean = process.argv.includes('--clean') || process.argv.includes('--reset');
  bootstrapSystem({ cleanTestData: clean })
    .then((res) => {
      logger.info(`Bootstrap completed. Admin: ${res.adminEmail}`);
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Bootstrap failed:', err);
      process.exit(1);
    });
}
