import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Organization, Department } from '../modules/organizations/organization.model.js';
import { User } from '../modules/users/user.model.js';
import { InternshipProgram, InternshipOpening, Candidate, Application } from '../modules/recruitment/recruitment.model.js';
import { Interview } from '../modules/interviews/interview.model.js';
import { Offer } from '../modules/offers/offer.model.js';
import { OnboardingPlan, OnboardingTask } from '../modules/onboarding/onboarding.model.js';
import { Intern } from '../modules/interns/intern.model.js';
import { Project } from '../modules/projects/project.model.js';
import { Task, TaskSubmission } from '../modules/tasks/task.model.js';
import { LearningPath, LearningModule, LearningLesson, LearningProgress } from '../modules/learning/learning.model.js';
import { AttendanceRecord } from '../modules/attendance/attendance.model.js';
import { JournalEntry } from '../modules/journals/journal.model.js';
import { Meeting } from '../modules/meetings/meeting.model.js';
import { Feedback } from '../modules/feedback/feedback.model.js';
import { PerformanceReview } from '../modules/performance/performance.model.js';
import { DEFAULT_PERFORMANCE_METRICS } from '../modules/performance/performance.controller.js';
import { Certificate } from '../modules/certificates/certificate.model.js';
import { Document } from '../modules/documents/document.model.js';
import { Notification } from '../modules/notifications/notification.model.js';
import { AuditLog } from '../modules/audit/audit.model.js';
import { CompensationPlan, Payment, PaymentLedger } from '../modules/finance/finance.model.js';
import { Asset } from '../modules/assets/asset.model.js';
import { Leave } from '../modules/leaves/leave.model.js';
import { Exit } from '../modules/exit/exit.model.js';
import { DocumentTemplate } from '../modules/templates/documentTemplate.model.js';
import { seedDefaultTemplates } from '../modules/templates/template.service.js';
import { generateDocumentForIntern } from '../modules/documents/document.service.js';
import { generateCertificatePDF } from '../utils/pdfGenerator.js';
import { storageService } from '../utils/storage.js';
import { DEFAULT_ONBOARDING_TASKS } from '../modules/onboarding/onboarding.model.js';
import PDFDocument from 'pdfkit';
import { generateId } from '../utils/idGenerator.js';
import {
  ROLES,
  APPLICATION_STATUS,
  INTERVIEW_STATUS,
  OFFER_STATUS,
  ONBOARDING_STATUS,
  INTERN_STATUS,
  TASK_STATUS,
  TASK_PRIORITY,
  SUBMISSION_STATUS,
  PROJECT_STATUS,
  ATTENDANCE_STATUS,
  ATTENDANCE_MODE,
  JOURNAL_STATUS,
  MEETING_TYPE,
  PERFORMANCE_REVIEW_STATUS,
  PERFORMANCE_REVIEW_TYPE,
  DOCUMENT_CATEGORY,
  DOCUMENT_STATUS
} from '../../../shared/constants.js';

async function seed() {
  try {
    logger.info('Connecting to database for seeding...');
    await mongoose.connect(env.MONGO_URI);
    logger.info('Connected to MongoDB. Clearing existing collections...');

    await Promise.all([
      Organization.deleteMany({}),
      Department.deleteMany({}),
      User.deleteMany({}),
      InternshipProgram.deleteMany({}),
      InternshipOpening.deleteMany({}),
      Candidate.deleteMany({}),
      Application.deleteMany({}),
      Interview.deleteMany({}),
      Offer.deleteMany({}),
      OnboardingPlan.deleteMany({}),
      OnboardingTask.deleteMany({}),
      Intern.deleteMany({}),
      Project.deleteMany({}),
      Task.deleteMany({}),
      TaskSubmission.deleteMany({}),
      LearningPath.deleteMany({}),
      LearningModule.deleteMany({}),
      LearningLesson.deleteMany({}),
      LearningProgress.deleteMany({}),
      AttendanceRecord.deleteMany({}),
      JournalEntry.deleteMany({}),
      Meeting.deleteMany({}),
      Feedback.deleteMany({}),
      PerformanceReview.deleteMany({}),
      Certificate.deleteMany({}),
      Notification.deleteMany({}),
      AuditLog.collection.deleteMany({}).catch(() => {}),
      CompensationPlan.deleteMany({}),
      Payment.deleteMany({}),
      PaymentLedger.deleteMany({}),
      Asset.deleteMany({}),
      Leave.deleteMany({}),
      Exit.deleteMany({}),
      DocumentTemplate.deleteMany({}),
      Document.deleteMany({})
    ]);

    logger.info('Creating Demo Organization: TechMecha Torque...');
    const org = await Organization.create({
      name: 'TechMecha Torque',
      slug: 'techmecha-torque',
      code: 'TMT',
      domain: 'techmecha.com',
      email: 'contact@techmecha.com',
      phone: '+1 (555) 234-5678',
      address: {
        street: '450 Innovation Parkway, Suite 800',
        city: 'San Jose',
        state: 'CA',
        country: 'USA',
        zipCode: '95134'
      },
      website: 'https://techmecha.com',
      logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      signatory: {
        name: 'Dr. Evelyn Reed',
        title: 'VP of Engineering & Talent'
      },
      status: 'ACTIVE'
    });

    logger.info('Creating Departments...');
    const [deptTech, deptProduct, deptData] = await Promise.all([
      Department.create({
        organizationId: org._id,
        name: 'Software Engineering',
        code: 'ENG',
        description: 'Core web applications, distributed systems, and platform infrastructure.'
      }),
      Department.create({
        organizationId: org._id,
        name: 'Product & Design',
        code: 'PRD',
        description: 'Product lifecycle strategy, user research, and interactive UI systems.'
      }),
      Department.create({
        organizationId: org._id,
        name: 'Data & Machine Intelligence',
        code: 'DMI',
        description: 'Telemetry analytics, neural algorithms, and data pipeline infrastructure.'
      })
    ]);

    logger.info('Creating Staff Users & Leadership...');
    const defaultPassword = 'Password2026!';

    const superAdmin = await User.create({
      firstName: 'Antigravity',
      lastName: 'GlobalAdmin',
      email: 'admin@techmecha.com',
      password: defaultPassword,
      role: ROLES.SUPER_ADMIN,
      phone: '+1 555 000 0001'
    });

    const orgAdmin = await User.create({
      organizationId: org._id,
      departmentId: deptTech._id,
      firstName: 'Arthur',
      lastName: 'Pendleton',
      email: 'orgadmin@techmecha.com',
      password: defaultPassword,
      role: ROLES.ORGANIZATION_ADMIN,
      phone: '+1 555 000 0002'
    });

    const hrAdmin = await User.create({
      organizationId: org._id,
      departmentId: deptTech._id,
      firstName: 'Rachel',
      lastName: 'Adams',
      email: 'hr@techmecha.com',
      password: defaultPassword,
      role: ROLES.HR_ADMIN,
      phone: '+1 555 000 0003'
    });

    const managerSarah = await User.create({
      organizationId: org._id,
      departmentId: deptTech._id,
      firstName: 'Sarah',
      lastName: 'Jenkins',
      email: 'sarah.jenkins@techmecha.com',
      password: defaultPassword,
      role: ROLES.PROGRAM_MANAGER,
      phone: '+1 555 000 0004'
    });

    const managerVikram = await User.create({
      organizationId: org._id,
      departmentId: deptProduct._id,
      firstName: 'Vikram',
      lastName: 'Mehta',
      email: 'vikram.mehta@techmecha.com',
      password: defaultPassword,
      role: ROLES.PROGRAM_MANAGER,
      phone: '+1 555 000 0005'
    });

    const mentorElena = await User.create({
      organizationId: org._id,
      departmentId: deptTech._id,
      firstName: 'Elena',
      lastName: 'Rostova',
      email: 'elena.rostova@techmecha.com',
      password: defaultPassword,
      role: ROLES.MENTOR,
      phone: '+1 555 000 0006'
    });

    const mentorMarcus = await User.create({
      organizationId: org._id,
      departmentId: deptTech._id,
      firstName: 'Marcus',
      lastName: 'Vance',
      email: 'marcus.vance@techmecha.com',
      password: defaultPassword,
      role: ROLES.MENTOR,
      phone: '+1 555 000 0007'
    });

    const mentorAisha = await User.create({
      organizationId: org._id,
      departmentId: deptData._id,
      firstName: 'Aisha',
      lastName: 'Khan',
      email: 'aisha.khan@techmecha.com',
      password: defaultPassword,
      role: ROLES.MENTOR,
      phone: '+1 555 000 0008'
    });

    const interviewerDavid = await User.create({
      organizationId: org._id,
      departmentId: deptTech._id,
      firstName: 'David',
      lastName: 'Chen',
      email: 'david.chen@techmecha.com',
      password: defaultPassword,
      role: ROLES.INTERVIEWER,
      phone: '+1 555 000 0009'
    });

    logger.info('Creating Internship Programs...');
    const [progFullStack, progBackend, progData] = await Promise.all([
      InternshipProgram.create({
        organizationId: org._id,
        departmentId: deptTech._id,
        title: 'Full Stack Web Engineering (MERN)',
        slug: 'full-stack-web-engineering',
        description: 'Comprehensive 60-day immersion in modern React, Node.js modular architecture, and cloud deployment.',
        durationDays: 60,
        attendanceRequirementPercent: 85,
        requiredDocuments: ['Government ID Proof', 'College ID Card', 'Internship Agreement', 'NDA'],
        completionRequirements: {
          minimumTasksCompleted: 5,
          projectRequired: true,
          finalReviewRequired: true,
          minimumAttendancePercent: 85
        }
      }),
      InternshipProgram.create({
        organizationId: org._id,
        departmentId: deptTech._id,
        title: 'Cloud & Distributed Backend Systems',
        slug: 'cloud-backend-systems',
        description: 'Deep dive into microservices, asynchronous messaging, MongoDB indexing, and container orchestration.',
        durationDays: 60,
        attendanceRequirementPercent: 90,
        requiredDocuments: ['Government ID Proof', 'College ID Card', 'Internship Agreement'],
        completionRequirements: {
          minimumTasksCompleted: 6,
          projectRequired: true,
          finalReviewRequired: true,
          minimumAttendancePercent: 90
        }
      }),
      InternshipProgram.create({
        organizationId: org._id,
        departmentId: deptData._id,
        title: 'Data Intelligence & Telemetry Analytics',
        slug: 'data-intelligence-analytics',
        description: 'Stream processing, telemetry aggregations, and predictive operational pipelines.',
        durationDays: 60,
        attendanceRequirementPercent: 85,
        requiredDocuments: ['Government ID Proof', 'College ID Card', 'Internship Agreement'],
        completionRequirements: {
          minimumTasksCompleted: 5,
          projectRequired: true,
          finalReviewRequired: true,
          minimumAttendancePercent: 85
        }
      })
    ]);

    logger.info('Creating Public Internship Openings...');
    const deadlineFuture = new Date();
    deadlineFuture.setDate(deadlineFuture.getDate() + 30);

    const [openingFS, openingBackend] = await Promise.all([
      InternshipOpening.create({
        organizationId: org._id,
        departmentId: deptTech._id,
        programId: progFullStack._id,
        title: 'Full Stack Engineering Intern',
        slug: 'full-stack-engineering-intern',
        description: 'Build enterprise-grade internal tooling using React, Vite, Tailwind CSS, Express, and MongoDB.',
        responsibilities: [
          'Design and implement performant RESTful APIs with Express and Mongoose',
          'Build responsive, accessible user interfaces in React 18 with Tailwind CSS',
          'Participate in daily standups, code reviews, and sprint planning',
          'Deploy modular web applications on containerized local servers'
        ],
        requiredSkills: ['JavaScript / TypeScript', 'React', 'Node.js', 'MongoDB', 'Git'],
        preferredSkills: ['Tailwind CSS', 'Docker', 'REST API Design'],
        duration: '60 Days',
        workMode: 'HYBRID',
        location: 'San Jose, CA / Remote',
        stipend: '$1,200 / month performance stipend',
        openPositions: 8,
        deadline: deadlineFuture,
        status: 'OPEN',
        createdBy: hrAdmin._id
      }),
      InternshipOpening.create({
        organizationId: org._id,
        departmentId: deptTech._id,
        programId: progBackend._id,
        title: 'Backend Systems & Cloud Intern',
        slug: 'backend-systems-cloud-intern',
        description: 'Architect scalable data pipelines, automated background workflows, and enterprise audit engines.',
        responsibilities: [
          'Implement MongoDB aggregation pipelines and compound indexing strategies',
          'Develop secure authentication and granular role-based authorization services',
          'Write comprehensive integration test suites using Jest and Supertest'
        ],
        requiredSkills: ['Node.js', 'Express', 'MongoDB / Mongoose', 'Data Modeling'],
        preferredSkills: ['Docker Compose', 'Redis', 'Linux Administration'],
        duration: '60 Days',
        workMode: 'REMOTE',
        location: 'Flexible / Global',
        stipend: '$1,300 / month performance stipend',
        openPositions: 5,
        deadline: deadlineFuture,
        status: 'OPEN',
        createdBy: hrAdmin._id
      })
    ]);

    logger.info('Creating 10 Realistic Intern Users & Candidates...');
    const internProfilesData = [
      { firstName: 'Arjun', lastName: 'Sharma', email: 'arjun.sharma@example.com', college: 'San Jose State University', degree: 'B.S. Computer Science', year: 2026, skills: ['React', 'Node.js', 'MongoDB', 'Tailwind'], mentor: mentorElena, program: progFullStack, status: INTERN_STATUS.ACTIVE },
      { firstName: 'Priya', lastName: 'Patel', email: 'priya.patel@example.com', college: 'UC Berkeley', degree: 'B.S. Electrical Engineering & CS', year: 2026, skills: ['Express', 'Node.js', 'Docker', 'MongoDB'], mentor: mentorMarcus, program: progBackend, status: INTERN_STATUS.ACTIVE },
      { firstName: 'Rahul', lastName: 'Verma', email: 'rahul.verma@example.com', college: 'Stanford University', degree: 'M.S. Computer Science', year: 2025, skills: ['React', 'TypeScript', 'Tailwind CSS'], mentor: mentorElena, program: progFullStack, status: INTERN_STATUS.ACTIVE },
      { firstName: 'Ananya', lastName: 'Deshmukh', email: 'ananya.deshmukh@example.com', college: 'Carnegie Mellon University', degree: 'B.S. Information Systems', year: 2026, skills: ['Python', 'MongoDB', 'Data Pipelines'], mentor: mentorAisha, program: progData, status: INTERN_STATUS.ACTIVE },
      { firstName: 'Rohan', lastName: 'Gupta', email: 'rohan.gupta@example.com', college: 'Georgia Tech', degree: 'B.S. Computer Science', year: 2027, skills: ['Node.js', 'Linux', 'Docker', 'Git'], mentor: mentorMarcus, program: progBackend, status: INTERN_STATUS.ACTIVE },
      { firstName: 'Sneha', lastName: 'Reddy', email: 'sneha.reddy@example.com', college: 'UT Austin', degree: 'B.S. Software Engineering', year: 2026, skills: ['React', 'CSS3', 'REST APIs'], mentor: mentorElena, program: progFullStack, status: INTERN_STATUS.ACTIVE },
      { firstName: 'Kavya', lastName: 'Nair', email: 'kavya.nair@example.com', college: 'University of Washington', degree: 'B.S. Computer Science', year: 2026, skills: ['JavaScript', 'React', 'MongoDB'], mentor: mentorElena, program: progFullStack, status: INTERN_STATUS.ONBOARDING },
      { firstName: 'Aditya', lastName: 'Joshi', email: 'aditya.joshi@example.com', college: 'Purdue University', degree: 'B.S. Computer Engineering', year: 2026, skills: ['React', 'HTML5', 'Node.js'], mentor: mentorMarcus, program: progFullStack, status: INTERN_STATUS.PRE_ONBOARDING },
      { firstName: 'Tanvi', lastName: 'Agarwal', email: 'tanvi.agarwal@example.com', college: 'UIUC', degree: 'M.S. Computer Science', year: 2025, skills: ['Backend Architecture', 'MongoDB', 'APIs'], mentor: mentorMarcus, program: progBackend, status: INTERN_STATUS.ACTIVE },
      { firstName: 'Kartik', lastName: 'Iyer', email: 'kartik.iyer@example.com', college: 'University of Michigan', degree: 'B.S. Computer Science', year: 2025, skills: ['Full Stack', 'Express', 'React', 'MongoDB'], mentor: mentorElena, program: progFullStack, status: INTERN_STATUS.COMPLETED }
    ];

    const createdInterns = [];
    const createdUsers = [];

    const startDateBase = new Date();
    startDateBase.setDate(startDateBase.getDate() - 25); // 25 days into internship

    for (let i = 0; i < internProfilesData.length; i++) {
      const p = internProfilesData[i];

      const user = await User.create({
        organizationId: org._id,
        departmentId: deptTech._id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        password: defaultPassword,
        role: ROLES.INTERN,
        phone: `+1 555 100 ${String(i + 1).padStart(4, '0')}`
      });
      createdUsers.push(user);

      const candidate = await Candidate.create({
        organizationId: org._id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: user.phone,
        city: 'San Jose',
        state: 'CA',
        country: 'USA',
        education: {
          college: p.college,
          degree: p.degree,
          branch: 'Computer Science',
          graduationYear: p.year,
          cgpa: '3.85'
        },
        technicalSkills: p.skills,
        softSkills: ['Teamwork', 'Communication', 'Problem Solving'],
        github: `https://github.com/${p.firstName.toLowerCase()}-${p.lastName.toLowerCase()}`,
        linkedin: `https://linkedin.com/in/${p.firstName.toLowerCase()}${p.lastName.toLowerCase()}`
      });

      const appId = await generateId('APP');
      const application = await Application.create({
        applicationId: appId,
        organizationId: org._id,
        openingId: openingFS._id,
        candidateId: candidate._id,
        status: APPLICATION_STATUS.OFFER_ACCEPTED,
        coverLetter: `I am thrilled to contribute to the software engineering team at TechMecha Torque. My experience in ${p.skills.join(', ')} aligns well with your mission.`,
        privacyConsent: true,
        timeline: [
          { stage: APPLICATION_STATUS.APPLIED, note: 'Applied via portal', timestamp: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000) },
          { stage: APPLICATION_STATUS.SHORTLISTED, note: 'Shortlisted for technical review', timestamp: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000) },
          { stage: APPLICATION_STATUS.INTERVIEW_SCHEDULED, note: 'Interview with Staff Engineer', timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          { stage: APPLICATION_STATUS.INTERVIEWED, note: 'Strong recommendation received', timestamp: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000) },
          { stage: APPLICATION_STATUS.SELECTED, note: 'Candidate selected by HR', timestamp: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000) },
          { stage: APPLICATION_STATUS.OFFER_ACCEPTED, note: 'Offer accepted', timestamp: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) }
        ]
      });

      const internId = await generateId('INT');
      const endDate = new Date(startDateBase);
      endDate.setDate(endDate.getDate() + 60);

      const intern = await Intern.create({
        internId,
        userId: user._id,
        applicationId: application._id,
        candidateId: candidate._id,
        organizationId: org._id,
        departmentId: deptTech._id,
        programId: p.program._id,
        mentorId: p.mentor._id,
        managerId: managerSarah._id,
        startDate: startDateBase,
        expectedEndDate: endDate,
        status: p.status,
        completionDetails: p.status === INTERN_STATUS.COMPLETED ? {
          tasksCompletedCount: 6,
          attendancePercent: 94,
          finalPerformanceScore: 8.8,
          approvedBy: hrAdmin._id,
          approvedAt: new Date()
        } : {}
      });
      createdInterns.push(intern);
    }

    logger.info('Creating Demo Projects...');
    const [projectTelemetry, projectIMS, projectDiagnostics] = await Promise.all([
      Project.create({
        organizationId: org._id,
        programId: progFullStack._id,
        name: 'Torque Cloud Telemetry Dashboard',
        description: 'Real-time vehicle diagnostics and IoT sensor streaming visualization platform.',
        objective: 'Enable fleet operators to monitor speed, temperature, and battery health via WebSockets.',
        ownerId: managerSarah._id,
        members: [createdUsers[0]._id, createdUsers[2]._id, createdUsers[5]._id],
        startDate: startDateBase,
        endDate: new Date(startDateBase.getTime() + 50 * 24 * 60 * 60 * 1000),
        status: PROJECT_STATUS.ACTIVE,
        progress: 68,
        repositoryUrl: 'https://github.com/techmecha/torque-telemetry',
        documentationUrl: 'https://docs.techmecha.com/telemetry'
      }),
      Project.create({
        organizationId: org._id,
        programId: progBackend._id,
        name: 'Fleet Ingestion & Diagnostics Engine',
        description: 'High-throughput Node.js micro-service engine with MongoDB time-series aggregations.',
        objective: 'Ingest 10k telemetry packets/sec with zero loss and automated anomaly detection.',
        ownerId: managerSarah._id,
        members: [createdUsers[1]._id, createdUsers[4]._id, createdUsers[8]._id],
        startDate: startDateBase,
        endDate: new Date(startDateBase.getTime() + 55 * 24 * 60 * 60 * 1000),
        status: PROJECT_STATUS.ACTIVE,
        progress: 74,
        repositoryUrl: 'https://github.com/techmecha/fleet-diagnostics'
      }),
      Project.create({
        organizationId: org._id,
        programId: progData._id,
        name: 'Autonomous Route Optimization API',
        description: 'Predictive routing system utilizing geospatial clustering and traffic telemetry.',
        objective: 'Reduce fleet travel latency and battery depletion using shortest-path heuristics.',
        ownerId: managerVikram._id,
        members: [createdUsers[3]._id],
        startDate: startDateBase,
        endDate: new Date(startDateBase.getTime() + 60 * 24 * 60 * 60 * 1000),
        status: PROJECT_STATUS.ACTIVE,
        progress: 50
      })
    ]);

    logger.info('Creating 30+ Realistic Tasks with Submissions & Review Loops...');
    const taskTemplates = [
      { title: 'Setup Vite + React Architecture & Design System', desc: 'Initialize project structure with Tailwind, Lucide icons, and responsive layouts.', priority: TASK_PRIORITY.HIGH, status: TASK_STATUS.APPROVED, userIdx: 0, proj: projectTelemetry },
      { title: 'Build Telemetry Streaming Chart Components', desc: 'Implement Recharts telemetry components for RPM, speed, and battery temperature.', priority: TASK_PRIORITY.HIGH, status: TASK_STATUS.APPROVED, userIdx: 0, proj: projectTelemetry },
      { title: 'Create REST Endpoint for Vehicle Battery Status', desc: 'Develop Express controller and Mongoose query for aggregated battery metrics.', priority: TASK_PRIORITY.MEDIUM, status: TASK_STATUS.APPROVED, userIdx: 0, proj: projectTelemetry },
      { title: 'Implement WebSocket Client for Real-time Feeds', desc: 'Connect frontend to simulated telemetry stream with auto-reconnection.', priority: TASK_PRIORITY.URGENT, status: TASK_STATUS.SUBMITTED, userIdx: 0, proj: projectTelemetry },
      { title: 'Optimize Bundle Size & Audit Lighthouse Score', desc: 'Run Vite build analyzer, configure code splitting, and achieve 95+ performance.', priority: TASK_PRIORITY.MEDIUM, status: TASK_STATUS.IN_PROGRESS, userIdx: 0, proj: projectTelemetry },
      { title: 'Write Unit Tests for Ingestion Validator', desc: 'Write comprehensive Jest tests covering sensor payload edge cases.', priority: TASK_PRIORITY.LOW, status: TASK_STATUS.TODO, userIdx: 0, proj: projectTelemetry },

      { title: 'Design MongoDB Indexes for Fleet Time-Series Data', desc: 'Add compound indexes for { vehicleId: 1, timestamp: -1 } and verify query plans.', priority: TASK_PRIORITY.HIGH, status: TASK_STATUS.APPROVED, userIdx: 1, proj: projectDiagnostics },
      { title: 'Build Express Ingestion API with Rate Limiting', desc: 'Implement express-rate-limit and input validation using Zod.', priority: TASK_PRIORITY.HIGH, status: TASK_STATUS.APPROVED, userIdx: 1, proj: projectDiagnostics },
      { title: 'Develop Diagnostic Alert Rule Engine', desc: 'Trigger automated notifications when engine temperature exceeds 95C.', priority: TASK_PRIORITY.URGENT, status: TASK_STATUS.SUBMITTED, userIdx: 1, proj: projectDiagnostics },
      { title: 'Write Supertest Integration Tests for Ingestion', desc: 'Simulate concurrent batch telemetry requests and verify 200 responses.', priority: TASK_PRIORITY.MEDIUM, status: TASK_STATUS.IN_PROGRESS, userIdx: 1, proj: projectDiagnostics },

      { title: 'Create Responsive Navigation and Sidebar', desc: 'Develop accessible navigation drawer with collapsible state and badges.', priority: TASK_PRIORITY.MEDIUM, status: TASK_STATUS.APPROVED, userIdx: 2, proj: projectTelemetry },
      { title: 'Implement Dark/Light Mode Theme Toggle', desc: 'Persist user theme preference in localStorage and apply Tailwind dark class.', priority: TASK_PRIORITY.LOW, status: TASK_STATUS.APPROVED, userIdx: 2, proj: projectTelemetry },
      { title: 'Build Vehicle List Filter & Search Table', desc: 'Add instant debounce search, status pills, and column sorting.', priority: TASK_PRIORITY.HIGH, status: TASK_STATUS.IN_PROGRESS, userIdx: 2, proj: projectTelemetry },

      { title: 'Extract Geospatial Waypoints from Ingestion Logs', desc: 'Parse latitude/longitude sequences and format into GeoJSON tracks.', priority: TASK_PRIORITY.HIGH, status: TASK_STATUS.APPROVED, userIdx: 3, proj: projectDiagnostics },
      { title: 'Build Map View with Interactive Route Polyline', desc: 'Integrate interactive map displaying vehicle fleet trajectory.', priority: TASK_PRIORITY.URGENT, status: TASK_STATUS.IN_PROGRESS, userIdx: 3, proj: projectDiagnostics },

      { title: 'Containerize Diagnostics Engine with Dockerfile', desc: 'Create production multi-stage Docker build with non-root security user.', priority: TASK_PRIORITY.HIGH, status: TASK_STATUS.APPROVED, userIdx: 4, proj: projectDiagnostics },
      { title: 'Configure Docker Compose with MongoDB Replica Set', desc: 'Define container network, environment bindings, and health check dependencies.', priority: TASK_PRIORITY.HIGH, status: TASK_STATUS.SUBMITTED, userIdx: 4, proj: projectDiagnostics },

      { title: 'Build Notification Center & Bell Icon Dropdown', desc: 'Display unread counter badge, mark as read handlers, and timestamp formatting.', priority: TASK_PRIORITY.MEDIUM, status: TASK_STATUS.APPROVED, userIdx: 5, proj: projectTelemetry },
      { title: 'Implement Export to CSV for Telemetry History', desc: 'Generate downloadable CSV files with proper headers and date formatting.', priority: TASK_PRIORITY.LOW, status: TASK_STATUS.TODO, userIdx: 5, proj: projectTelemetry },

      { title: 'Refactor Auth Token Rotation & Refresh Handler', desc: 'Implement JWT refresh token mechanism with secure cookie storage.', priority: TASK_PRIORITY.HIGH, status: TASK_STATUS.APPROVED, userIdx: 8, proj: projectDiagnostics },
      { title: 'Add Prometheus Metrics Endpoint for Express API', desc: 'Expose /metrics tracking HTTP request durations and status codes.', priority: TASK_PRIORITY.MEDIUM, status: TASK_STATUS.IN_PROGRESS, userIdx: 8, proj: projectDiagnostics },

      { title: 'Complete Final Capstone Presentation', desc: 'Present telemetry architecture to engineering leadership and mentors.', priority: TASK_PRIORITY.HIGH, status: TASK_STATUS.APPROVED, userIdx: 9, proj: projectTelemetry },
      { title: 'Document Architecture Decision Records (ADRs)', desc: 'Document architectural choices and tradeoffs in docs/decisions.md.', priority: TASK_PRIORITY.MEDIUM, status: TASK_STATUS.APPROVED, userIdx: 9, proj: projectTelemetry }
    ];

    for (const t of taskTemplates) {
      const assignedUser = createdUsers[t.userIdx];
      const dueDate = new Date(startDateBase);
      dueDate.setDate(dueDate.getDate() + 14);

      const task = await Task.create({
        organizationId: org._id,
        projectId: t.proj._id,
        title: t.title,
        description: t.desc,
        assignedTo: [assignedUser._id],
        createdBy: managerSarah._id,
        priority: t.priority,
        status: t.status,
        dueDate,
        estimatedHours: 16,
        actualHours: t.status === TASK_STATUS.APPROVED ? 14 : 8,
        tags: ['Frontend', 'React', 'Vite', 'Engineering'],
        links: [{ label: 'Spec Document', url: 'https://docs.techmecha.com/specs' }]
      });

      if (t.status === TASK_STATUS.APPROVED || t.status === TASK_STATUS.SUBMITTED) {
        const sub = await TaskSubmission.create({
          taskId: task._id,
          submittedBy: assignedUser._id,
          description: `Completed implementation for: ${t.title}. All automated tests pass and PR is linked.`,
          links: [
            { label: 'GitHub Pull Request', url: 'https://github.com/techmecha/torque/pull/42' },
            { label: 'Live Demo URL', url: 'https://staging.techmecha.com/telemetry' }
          ],
          version: 1,
          status: t.status === TASK_STATUS.APPROVED ? SUBMISSION_STATUS.APPROVED : SUBMISSION_STATUS.SUBMITTED,
          reviewerId: mentorElena._id,
          reviewNotes: t.status === TASK_STATUS.APPROVED ? 'Outstanding code structure and test coverage. Approved for merge.' : '',
          reviewedAt: t.status === TASK_STATUS.APPROVED ? new Date() : undefined
        });
      }
    }

    logger.info('Creating Learning Path with Modules & Lessons...');
    const learningPath = await LearningPath.create({
      organizationId: org._id,
      programId: progFullStack._id,
      title: 'MERN Stack Enterprise Mastery',
      description: 'Foundational and advanced engineering patterns for building scalable full-stack applications.',
      targetRole: 'Full Stack Engineering Intern'
    });

    const [modArch, modReact, modMongo] = await Promise.all([
      LearningModule.create({
        pathId: learningPath._id,
        organizationId: org._id,
        title: 'Module 1: Modular Monolith Architecture & REST Principles',
        description: 'Domain-oriented design, RBAC enforcement, and tenant scoping in Express.',
        order: 1
      }),
      LearningModule.create({
        pathId: learningPath._id,
        organizationId: org._id,
        title: 'Module 2: Advanced React, State, & Enterprise UI Patterns',
        description: 'React Hook Form, Zod schema validation, TanStack Query caching, and accessible Tailwind UI.',
        order: 2
      }),
      LearningModule.create({
        pathId: learningPath._id,
        organizationId: org._id,
        title: 'Module 3: High Performance MongoDB & Data Aggregations',
        description: 'Aggregation pipelines, compound index planning, transactions, and data consistency.',
        order: 3
      })
    ]);

    const lessons = await Promise.all([
      LearningLesson.create({
        moduleId: modArch._id,
        organizationId: org._id,
        title: 'Understanding Domain Modules vs Spaghetti Code',
        contentType: 'ARTICLE',
        content: 'Enterprise applications thrive on modular boundaries. Each module should encapsulate its model, service, controller, and routes.',
        durationMinutes: 25,
        order: 1
      }),
      LearningLesson.create({
        moduleId: modArch._id,
        organizationId: org._id,
        title: 'Implementing Multi-Tenant Scoping with Mongoose',
        contentType: 'VIDEO',
        externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        durationMinutes: 40,
        order: 2
      }),
      LearningLesson.create({
        moduleId: modReact._id,
        organizationId: org._id,
        title: 'Mastering React Hook Form and Zod Validation',
        contentType: 'ARTICLE',
        content: 'Type-safe forms prevent bad inputs from reaching the server. Learn how Zod schemas can be shared between frontend and backend.',
        durationMinutes: 30,
        order: 1
      }),
      LearningLesson.create({
        moduleId: modReact._id,
        organizationId: org._id,
        title: 'Building Accessible Data Tables with Tailwind CSS',
        contentType: 'DOCUMENT',
        content: 'Design guidelines for pagination, sorting headers, loading skeletons, and empty state fallbacks.',
        durationMinutes: 35,
        order: 2
      }),
      LearningLesson.create({
        moduleId: modMongo._id,
        organizationId: org._id,
        title: 'Aggregation Pipelines: Funnels, Rates, and Groupings',
        contentType: 'ARTICLE',
        content: 'Never calculate metrics on the client. Leverage MongoDB aggregation stages like $match, $group, $project, and $lookup.',
        durationMinutes: 45,
        order: 1
      })
    ]);

    // Mark completed lessons for Intern Arjun
    for (const lesson of lessons.slice(0, 4)) {
      await LearningProgress.create({
        userId: createdUsers[0]._id,
        organizationId: org._id,
        lessonId: lesson._id,
        moduleId: lesson.moduleId,
        pathId: learningPath._id,
        isCompleted: true,
        completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      });
    }

    logger.info('Creating Attendance Records for the past 15 working days...');
    for (let dayOffset = 18; dayOffset >= 0; dayOffset--) {
      const recordDate = new Date();
      recordDate.setDate(recordDate.getDate() - dayOffset);
      const dayOfWeek = recordDate.getDay();

      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

      recordDate.setHours(0, 0, 0, 0);

      for (let i = 0; i < 6; i++) {
        const intern = createdInterns[i];
        const checkInTime = new Date(recordDate);
        checkInTime.setHours(9, 15 + (i * 3), 0, 0);

        const checkOutTime = new Date(recordDate);
        checkOutTime.setHours(17, 30 + (i * 2), 0, 0);

        await AttendanceRecord.create({
          internId: intern._id,
          userId: intern.userId,
          organizationId: org._id,
          date: recordDate,
          checkIn: checkInTime,
          checkOut: dayOffset === 0 ? undefined : checkOutTime, // Today still checked in
          totalHours: dayOffset === 0 ? 0 : 8.0,
          status: ATTENDANCE_STATUS.PRESENT,
          mode: ATTENDANCE_MODE.WEB
        });
      }
    }

    logger.info('Creating Daily Journals for Interns...');
    for (let day = 1; day <= 15; day++) {
      const journalDate = new Date(startDateBase);
      journalDate.setDate(journalDate.getDate() + day);

      await JournalEntry.create({
        internId: createdInterns[0]._id,
        userId: createdUsers[0]._id,
        organizationId: org._id,
        date: journalDate,
        dayNumber: day,
        workSummary: `Worked on Telemetry dashboard charts, integrated React component library, and refined API error boundaries on Day ${day}.`,
        tasksCompleted: ['Component setup', 'Vite configuration', 'Express router integration'],
        whatILearned: 'Learned about Vite code-splitting and how compound indexes dramatically speed up telemetry queries.',
        challenges: day === 7 ? 'Experienced CORS issue when connecting to local telemetry simulator, resolved by setting proper headers.' : '',
        blockers: 'None',
        nextSteps: 'Proceed with WebSocket streaming client implementation.',
        hoursWorked: 8,
        status: JOURNAL_STATUS.REVIEWED,
        mentorReview: {
          reviewerId: mentorElena._id,
          comments: 'Great progress, Arjun! The UI looks very clean and your commit messages are exemplary.',
          reviewedAt: new Date(journalDate.getTime() + 12 * 60 * 60 * 1000)
        }
      });
    }

    logger.info('Creating Upcoming & Past Meetings...');
    const tomorrowMeeting = new Date();
    tomorrowMeeting.setDate(tomorrowMeeting.getDate() + 1);

    await Promise.all([
      Meeting.create({
        organizationId: org._id,
        title: 'Weekly 1-on-1 Mentorship Sync',
        type: MEETING_TYPE.MENTOR_1ON1,
        participants: [mentorElena._id, createdUsers[0]._id],
        internIds: [createdInterns[0]._id],
        mentorId: mentorElena._id,
        scheduledDate: tomorrowMeeting,
        startTime: '10:00 AM',
        endTime: '10:45 AM',
        meetingLink: 'https://meet.jit.si/TechMecha-Mentorship-Arjun',
        agenda: 'Review progress on Telemetry streaming task and plan capstone deliverables.'
      }),
      Meeting.create({
        organizationId: org._id,
        title: 'Engineering Team Sprint Demo',
        type: MEETING_TYPE.TEAM,
        participants: [mentorElena._id, mentorMarcus._id, createdUsers[0]._id, createdUsers[1]._id, createdUsers[2]._id],
        internIds: [createdInterns[0]._id, createdInterns[1]._id],
        mentorId: mentorElena._id,
        scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        startTime: '02:00 PM',
        endTime: '03:00 PM',
        meetingLink: 'https://meet.jit.si/TechMecha-Sprint-Demo',
        agenda: 'Showcase sprint deliverables to Engineering Leadership.'
      })
    ]);

    logger.info('Creating Mid-Term Performance Review for Arjun Sharma...');
    const arjunReviewMetrics = DEFAULT_PERFORMANCE_METRICS.map(m => ({
      metricName: m.metricName,
      weightPercent: m.weightPercent,
      score: 8.5 + (Math.random() * 1.0),
      comments: 'Consistent high performer with strong architectural intuition.'
    }));

    await PerformanceReview.create({
      organizationId: org._id,
      internId: createdInterns[0]._id,
      userId: createdUsers[0]._id,
      cycleTitle: 'Mid-Term Engineering Evaluation (Week 4)',
      type: PERFORMANCE_REVIEW_TYPE.MID_TERM,
      metrics: arjunReviewMetrics,
      selfAssessment: {
        scores: arjunReviewMetrics,
        strengths: 'Fast learner, comfortable with React and Express, enjoy writing clean tests.',
        growthAreas: 'Would like to gain deeper experience with container orchestration and Docker.',
        generalComments: 'The mentorship from Elena has been phenomenal.',
        submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      mentorAssessment: {
        scores: arjunReviewMetrics,
        feedback: 'Arjun has exceeded expectations in all assigned deliverables. His code reviews are thoughtful and well-reasoned.',
        evaluatorId: mentorElena._id,
        submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      managerReview: {
        comments: 'Outstanding contribution to the Torque telemetry dashboard.',
        reviewerId: managerSarah._id,
        reviewedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      finalScore: 8.8,
      status: PERFORMANCE_REVIEW_STATUS.FINALIZED,
      finalizedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    });

    logger.info('Creating Sample Certificate for Completed Intern Kartik Iyer...');
    const certId = 'CERT-2026-000001';
    const certPdf = await generateCertificatePDF({
      internName: 'Kartik Iyer',
      internId: createdInterns[9].internId,
      programTitle: 'Full Stack Web Engineering (MERN)',
      departmentName: 'Software Engineering',
      organizationName: org.name,
      startDate: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      endDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      duration: '60 Days',
      certificateId: certId,
      issueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      signatory: 'Dr. Evelyn Reed, VP of Engineering & Talent',
      verifyUrl: `${env.FRONTEND_URL}/verify/certificate/${certId}`
    });
    const storedCert = await storageService.saveFile({
      buffer: certPdf,
      originalName: `${certId}.pdf`,
      mimeType: 'application/pdf',
      subDir: `certificates/${org._id}`
    });

    await Certificate.create({
      certificateId: certId,
      organizationId: org._id,
      internId: createdInterns[9]._id,
      userId: createdUsers[9]._id,
      internName: 'Kartik Iyer',
      programTitle: 'Full Stack Web Engineering (MERN)',
      departmentName: 'Software Engineering',
      organizationName: org.name,
      startDate: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      endDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      duration: '60 Days',
      issueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      signatory: 'Dr. Evelyn Reed, VP of Engineering & Talent',
      filePath: storedCert.filePath,
      checksum: storedCert.checksum,
      status: 'ACTIVE'
    });

    logger.info('Seeding TMT Letter Templates...');
    await seedDefaultTemplates(org._id, superAdmin._id);

    logger.info('Seeding Onboarding Plans, Tasks, and Official Documents...');
    const createSamplePDF = (title, lines) => {
      return new Promise((resolve) => {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const bufs = [];
        doc.on('data', b => bufs.push(b));
        doc.on('end', () => resolve(Buffer.concat(bufs)));
        doc.fontSize(20).fillColor('#0284c7').text(title, { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).fillColor('#64748b').text('TechMecha Torque Talent Operations | Official Document Record', { align: 'center' });
        doc.moveDown(1.5);
        doc.fontSize(11).fillColor('#1e293b');
        for (const l of lines) {
          doc.text(l);
          doc.moveDown(0.5);
        }
        doc.moveDown(2);
        doc.fontSize(9).fillColor('#94a3b8').text(`Document verified and registered in the internal management platform on ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.end();
      });
    };

    // 1. Uploaded Documents for Active Intern Arjun Sharma
    const arjunGovIdPdf = await createSamplePDF('GOVERNMENT IDENTIFICATION PROOF', [
      'Document Holder: Arjun Sharma',
      'Document Type: Permanent Resident / National Identity Card',
      'Document Number: ID-2026-TMT-88912',
      'Date of Birth: June 14, 2003',
      'Issuing Authority: Government Civil Registry Department',
      'Status: Verified & Authenticated by TechMecha Torque HR Operations'
    ]);
    const storedArjunId = await storageService.saveFile({
      buffer: arjunGovIdPdf,
      originalName: 'Arjun_Sharma_Government_ID.pdf',
      mimeType: 'application/pdf',
      subDir: `documents/${org._id}/${createdUsers[0]._id}`
    });

    const arjunCollegeIdPdf = await createSamplePDF('COLLEGE IDENTITY CREDENTIAL', [
      'Student Name: Arjun Sharma',
      'Institution: San Jose State University',
      'Department: Department of Computer Science & Engineering',
      'Student ID: SJSU-CS-2026-902',
      'Degree: Bachelor of Science in Computer Science',
      'Status: Active Bona Fide Student - Class of 2026'
    ]);
    const storedArjunCollegeId = await storageService.saveFile({
      buffer: arjunCollegeIdPdf,
      originalName: 'Arjun_Sharma_SJSU_College_ID.pdf',
      mimeType: 'application/pdf',
      subDir: `documents/${org._id}/${createdUsers[0]._id}`
    });

    const docArjunId = await Document.create({
      organizationId: org._id,
      ownerId: createdUsers[0]._id,
      internId: createdInterns[0]._id,
      source: 'UPLOADED',
      type: DOCUMENT_CATEGORY.ID_PROOF,
      title: 'Arjun Sharma - Government ID Proof',
      fileName: storedArjunId.fileName,
      originalName: storedArjunId.originalName,
      filePath: storedArjunId.filePath,
      mimeType: storedArjunId.mimeType,
      size: storedArjunId.size,
      checksum: storedArjunId.checksum,
      version: 1,
      status: DOCUMENT_STATUS.APPROVED,
      uploadedBy: createdUsers[0]._id,
      approvedBy: hrAdmin._id,
      approvalNotes: 'Government ID verified successfully against official records.',
      approvedAt: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000)
    });

    const docArjunCollege = await Document.create({
      organizationId: org._id,
      ownerId: createdUsers[0]._id,
      internId: createdInterns[0]._id,
      source: 'UPLOADED',
      type: DOCUMENT_CATEGORY.COLLEGE_ID,
      title: 'Arjun Sharma - College Student ID',
      fileName: storedArjunCollegeId.fileName,
      originalName: storedArjunCollegeId.originalName,
      filePath: storedArjunCollegeId.filePath,
      mimeType: storedArjunCollegeId.mimeType,
      size: storedArjunCollegeId.size,
      checksum: storedArjunCollegeId.checksum,
      version: 1,
      status: DOCUMENT_STATUS.APPROVED,
      uploadedBy: createdUsers[0]._id,
      approvedBy: hrAdmin._id,
      approvalNotes: 'University enrollment verified.',
      approvedAt: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000)
    });

    // 2. Uploaded Documents for Onboarding Intern Kavya Nair (status UNDER_REVIEW so HR can review!)
    const kavyaGovIdPdf = await createSamplePDF('GOVERNMENT IDENTIFICATION PROOF', [
      'Document Holder: Kavya Nair',
      'Document Type: National Identity Passport / ID',
      'Document Number: ID-2026-TMT-55421',
      'Date of Birth: August 21, 2004',
      'Issuing Authority: Civil Identity Authority',
      'Notice: Awaiting HR Admin Review & Approval'
    ]);
    const storedKavyaId = await storageService.saveFile({
      buffer: kavyaGovIdPdf,
      originalName: 'Kavya_Nair_Passport_Proof.pdf',
      mimeType: 'application/pdf',
      subDir: `documents/${org._id}/${createdUsers[6]._id}`
    });

    const docKavyaId = await Document.create({
      organizationId: org._id,
      ownerId: createdUsers[6]._id,
      internId: createdInterns[6]._id,
      source: 'UPLOADED',
      type: DOCUMENT_CATEGORY.ID_PROOF,
      title: 'Kavya Nair - Passport ID Proof',
      fileName: storedKavyaId.fileName,
      originalName: storedKavyaId.originalName,
      filePath: storedKavyaId.filePath,
      mimeType: storedKavyaId.mimeType,
      size: storedKavyaId.size,
      checksum: storedKavyaId.checksum,
      version: 1,
      status: DOCUMENT_STATUS.UNDER_REVIEW,
      uploadedBy: createdUsers[6]._id,
      approvalNotes: ''
    });

    // 3. Generate Official Letters for Arjun Sharma
    const arjunPopulated = await Intern.findById(createdInterns[0]._id)
      .populate('userId')
      .populate('programId')
      .populate('departmentId')
      .populate('mentorId');

    const seedReq = { userId: hrAdmin._id, timezone: 'Asia/Kolkata', headers: {}, ip: '127.0.0.1', get: () => '' };

    await generateDocumentForIntern({
      req: seedReq,
      intern: arjunPopulated,
      templateCode: 'JOINING_LETTER'
    });

    await generateDocumentForIntern({
      req: seedReq,
      intern: arjunPopulated,
      templateCode: 'NDA_AGREEMENT'
    });

    // 4. Generate Recommendation Letter for Completed Intern Kartik Iyer
    const kartikPopulated = await Intern.findById(createdInterns[9]._id)
      .populate('userId')
      .populate('programId')
      .populate('departmentId')
      .populate('mentorId');

    await generateDocumentForIntern({
      req: seedReq,
      intern: kartikPopulated,
      templateCode: 'EXPERIENCE_LETTER'
    });

    await generateDocumentForIntern({
      req: seedReq,
      intern: kartikPopulated,
      templateCode: 'RECOMMENDATION_LETTER',
      extra: { recommendation: { note: 'Kartik was a standout engineer who demonstrated exceptional dedication to system quality, test automation, and full-stack software delivery.' } }
    });

    // 5. Seed Onboarding Plan for Arjun Sharma (Completed)
    const arjunPlan = await OnboardingPlan.create({
      organizationId: org._id,
      internId: createdInterns[0]._id,
      candidateId: createdInterns[0].candidateId,
      applicationId: createdInterns[0].applicationId,
      status: ONBOARDING_STATUS.COMPLETED,
      progress: 100,
      completedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
    });

    for (const t of DEFAULT_ONBOARDING_TASKS) {
      await OnboardingTask.create({
        onboardingPlanId: arjunPlan._id,
        organizationId: org._id,
        key: t.key,
        title: t.title,
        description: t.description,
        owner: t.owner,
        documentType: t.documentType,
        documentId: t.documentType === 'ID_PROOF' ? docArjunId._id : t.documentType === 'COLLEGE_ID' ? docArjunCollege._id : undefined,
        status: ONBOARDING_STATUS.COMPLETED,
        required: t.required,
        completedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        completedBy: hrAdmin._id
      });
    }

    // 6. Seed Onboarding Plan for Kavya Nair (In Progress)
    const kavyaPlan = await OnboardingPlan.create({
      organizationId: org._id,
      internId: createdInterns[6]._id,
      candidateId: createdInterns[6].candidateId,
      applicationId: createdInterns[6].applicationId,
      status: ONBOARDING_STATUS.IN_PROGRESS,
      progress: 30
    });

    for (const t of DEFAULT_ONBOARDING_TASKS) {
      const isIdProof = t.key === 'GOV_ID';
      const isProfile = t.key === 'PROFILE';
      const isAccess = t.key === 'ACCESS';

      const task = await OnboardingTask.create({
        onboardingPlanId: kavyaPlan._id,
        organizationId: org._id,
        key: t.key,
        title: t.title,
        description: t.description,
        owner: t.owner,
        documentType: t.documentType,
        documentId: isIdProof ? docKavyaId._id : undefined,
        status: isIdProof ? ONBOARDING_STATUS.IN_PROGRESS : (isProfile || isAccess) ? ONBOARDING_STATUS.COMPLETED : ONBOARDING_STATUS.PENDING,
        required: t.required,
        completedAt: (isProfile || isAccess) ? new Date() : undefined,
        completedBy: (isProfile || isAccess) ? hrAdmin._id : undefined
      });

      if (isIdProof) {
        docKavyaId.onboardingTaskId = task._id;
        await docKavyaId.save();
      }
    }

    // 7. Seed Onboarding Plan for Aditya Joshi (Pre-Onboarding)
    const adityaPlan = await OnboardingPlan.create({
      organizationId: org._id,
      internId: createdInterns[7]._id,
      candidateId: createdInterns[7].candidateId,
      applicationId: createdInterns[7].applicationId,
      status: ONBOARDING_STATUS.PENDING,
      progress: 0
    });

    for (const t of DEFAULT_ONBOARDING_TASKS) {
      await OnboardingTask.create({
        onboardingPlanId: adityaPlan._id,
        organizationId: org._id,
        key: t.key,
        title: t.title,
        description: t.description,
        owner: t.owner,
        documentType: t.documentType,
        status: ONBOARDING_STATUS.PENDING,
        required: t.required
      });
    }

    logger.info('Seeding Compensation & Finance Subsystems...');
    await CompensationPlan.create({
      organizationId: org._id,
      internId: createdInterns[0]._id,
      compensationType: 'MONTHLY_STIPEND',
      baseAmount: 35000,
      currency: 'INR',
      paymentFrequency: 'MONTHLY',
      bankDetails: {
        accountHolderName: 'Arjun Sharma',
        accountNumberMasked: '••••4892',
        bankName: 'HDFC Bank',
        ifscOrRoutingCode: 'HDFC0001234'
      }
    });

    const paymentAugust = await Payment.create({
      paymentId: 'TMT-PAY-2026-000842',
      organizationId: org._id,
      internId: createdInterns[0]._id,
      cycle: '2026-08',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-31'),
      grossAmount: 35000,
      totalDeductions: 0,
      totalAdditions: 2000,
      netPayable: 37000,
      paidAmount: 37000,
      status: 'PAID',
      paymentMethod: 'BANK_TRANSFER',
      paymentReference: 'TMT-UTR-2026-00892',
      paidAt: new Date('2026-09-02'),
      approvedBy: hrAdmin._id,
      approvedAt: new Date('2026-09-01'),
      notes: 'August sprint reward included'
    });

    await PaymentLedger.create([
      {
        organizationId: org._id,
        paymentId: paymentAugust._id,
        internId: createdInterns[0]._id,
        type: 'STIPEND',
        amount: 35000,
        currency: 'INR',
        description: 'Monthly stipend base for August 2026',
        createdBy: hrAdmin._id
      },
      {
        organizationId: org._id,
        paymentId: paymentAugust._id,
        internId: createdInterns[0]._id,
        type: 'BONUS',
        amount: 2000,
        currency: 'INR',
        description: 'Exceeded architecture deliverable quality bonus',
        createdBy: mentorElena._id
      }
    ]);

    await Payment.create({
      paymentId: 'TMT-PAY-2026-000914',
      organizationId: org._id,
      internId: createdInterns[0]._id,
      cycle: '2026-09',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-30'),
      grossAmount: 35000,
      totalDeductions: 0,
      totalAdditions: 0,
      netPayable: 35000,
      paidAmount: 0,
      status: 'PENDING',
      notes: 'September stipend cycle in progress'
    });

    logger.info('Seeding IT Equipment & Assets...');
    await Asset.create([
      {
        assetTag: 'TMT-AST-2026-000012',
        organizationId: org._id,
        internId: createdInterns[0]._id,
        name: 'Apple MacBook Pro 14 M3',
        type: 'LAPTOP',
        serialNumber: 'C02G99XP841',
        specifications: '18GB RAM, 512GB SSD, Space Black',
        status: 'ASSIGNED',
        assignedDate: new Date('2026-08-01'),
        assignedBy: hrAdmin._id
      },
      {
        assetTag: 'TMT-AST-2026-000013',
        organizationId: org._id,
        name: 'Dell UltraSharp 27 4K USB-C Hub Monitor',
        type: 'MONITOR',
        serialNumber: 'CN-09341-716',
        specifications: 'U2723QE 4K IPS Black',
        status: 'REQUESTED'
      }
    ]);

    logger.info('Seeding Leaves & Offboarding Cases...');
    await Leave.create({
      organizationId: org._id,
      internId: createdInterns[0]._id,
      leaveType: 'SICK',
      startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      totalDays: 1,
      reason: 'Viral fever and doctor consultation',
      status: 'APPROVED',
      reviewedBy: mentorElena._id,
      reviewedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      reviewNotes: 'Approved. Get well soon!'
    });

    await Exit.create({
      exitId: 'TMT-EXT-2026-000008',
      organizationId: org._id,
      internId: createdInterns[9]._id,
      userId: createdUsers[9]._id,
      reason: 'COMPLETION',
      status: 'ALUMNI',
      lastWorkingDay: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      assetClearanceStatus: 'CLEARED',
      financeClearanceStatus: 'CLEARED',
      finalSettlementAmount: 0,
      certificateEligible: true,
      lorEligible: true,
      accessRevoked: true,
      accessRevokedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    });

    logger.info('===============================================================');
    logger.info('SEEDING COMPLETED SUCCESSFULLY!');
    logger.info('===============================================================');
    logger.info('DEMO ACCOUNTS CREATED:');
    logger.info('1. Super Admin:       admin@techmecha.com       / Password2026!');
    logger.info('2. Org Admin:         orgadmin@techmecha.com    / Password2026!');
    logger.info('3. HR Admin:          hr@techmecha.com          / Password2026!');
    logger.info('4. Manager:           sarah.jenkins@techmecha.com / Password2026!');
    logger.info('5. Mentor:            elena.rostova@techmecha.com / Password2026!');
    logger.info('6. Interviewer:       david.chen@techmecha.com  / Password2026!');
    logger.info('7. Active Intern:     arjun.sharma@example.com  / Password2026!');
    logger.info('8. Completed Intern:  kartik.iyer@example.com   / Password2026!');
    logger.info('===============================================================');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    logger.error('Error during database seed:', err);
    process.exit(1);
  }
}

seed();
