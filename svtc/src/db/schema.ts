import { sql } from 'drizzle-orm';
import {
  pgTable, serial, integer, text, boolean, timestamp, date, jsonb, uuid, doublePrecision,
  customType, uniqueIndex, index,
} from 'drizzle-orm/pg-core';

/** Colonne binaire PostgreSQL (fichiers PDF, logos). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();

export type Role = 'ADMIN' | 'ENCADREUR' | 'PARENT';

// ---------------------------------------------------------------- Paramètres & référentiels
export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const academicYears = pgTable('academic_years', {
  id: serial('id').primaryKey(),
  label: text('label').notNull().unique(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  isCurrent: boolean('is_current').notNull().default(false),
  createdAt: createdAt(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: text('role').$type<Role>().notNull(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  email: text('email'),
  isActive: boolean('is_active').notNull().default(true),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const authSessions = pgTable('auth_sessions', {
  id: text('id').primaryKey(), // SHA-256 du jeton (le jeton brut n'est jamais stocké)
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').$type<Role>().notNull(),
  createdAt: createdAt(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
}, (t) => [index('auth_sessions_user_idx').on(t.userId)]);

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
});

export const files = pgTable('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  sha256: text('sha256').notNull(),
  data: bytea('data').notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
});

export const classes = pgTable('classes', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  cycle: text('cycle').notNull().default('SECOND'), // PREMIER | SECOND
  sortOrder: integer('sort_order').notNull().default(0),
  registrationFee: integer('registration_fee').notNull().default(0),
  monthlyFee: integer('monthly_fee').notNull().default(0),
  capacity: integer('capacity').notNull().default(30),
  color: text('color').notNull().default('#2453d6'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
});

export const subjects = pgTable('subjects', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color').notNull().default('#2453d6'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
});

export const rooms = pgTable('rooms', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  capacity: integer('capacity').notNull().default(30),
  rates: jsonb('rates').$type<Record<string, number>>().notNull().default({}), // jour (0=dimanche … 6=samedi) → FCFA/heure
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- Personnes
export const tutors = pgTable('tutors', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').unique().references(() => users.id, { onDelete: 'set null' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  gender: text('gender').notNull().default('M'),
  phone: text('phone'),
  email: text('email'),
  specialty: text('specialty'),
  diploma: text('diploma'),
  address: text('address'),
  baseSalary: integer('base_salary').notNull().default(0), // salaire mensuel de référence (mode prorata)
  hourlyRate: integer('hourly_rate').notNull().default(0), // taux horaire (mode horaire)
  hireDate: date('hire_date'),
  color: text('color').notNull().default('#2453d6'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
});

export const parents = pgTable('parents', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').unique().references(() => users.id, { onDelete: 'set null' }),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull().unique(),
  phone2: text('phone2'),
  whatsapp: text('whatsapp'),
  email: text('email'),
  profession: text('profession'),
  address: text('address'),
  relation: text('relation').notNull().default('Parent'),
  createdAt: createdAt(),
});

export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  matricule: text('matricule').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  gender: text('gender').notNull().default('M'),
  birthDate: date('birth_date'),
  school: text('school'),
  phone: text('phone'),
  classId: integer('class_id').notNull().references(() => classes.id),
  academicYearId: integer('academic_year_id').notNull().references(() => academicYears.id),
  parentId: integer('parent_id').references(() => parents.id, { onDelete: 'set null' }),
  discountPct: integer('discount_pct').notNull().default(0),
  status: text('status').notNull().default('ACTIF'), // ACTIF | SUSPENDU | ABANDON
  enrolledAt: date('enrolled_at').notNull(),
  notes: text('notes'),
  createdAt: createdAt(),
}, (t) => [index('students_class_idx').on(t.classId, t.academicYearId), index('students_parent_idx').on(t.parentId)]);

// ---------------------------------------------------------------- Pédagogie & planning
export const assignments = pgTable('assignments', {
  id: serial('id').primaryKey(),
  academicYearId: integer('academic_year_id').notNull().references(() => academicYears.id),
  classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  tutorId: integer('tutor_id').notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  sessionsPerWeek: integer('sessions_per_week').notNull().default(1), // nombre de créneaux hebdomadaires souhaités
  createdAt: createdAt(),
}, (t) => [uniqueIndex('assignments_unique').on(t.academicYearId, t.classId, t.subjectId)]);

export const timeslots = pgTable('timeslots', {
  id: serial('id').primaryKey(),
  academicYearId: integer('academic_year_id').notNull().references(() => academicYears.id),
  dayOfWeek: integer('day_of_week').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  tutorId: integer('tutor_id').references(() => tutors.id, { onDelete: 'set null' }),
  roomId: integer('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
});

export type SeanceStatus = 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE';

export const seances = pgTable('seances', {
  id: serial('id').primaryKey(),
  academicYearId: integer('academic_year_id').notNull().references(() => academicYears.id),
  timeslotId: integer('timeslot_id').references(() => timeslots.id, { onDelete: 'set null' }),
  date: date('date').notNull(),
  dayOfWeek: integer('day_of_week').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  tutorId: integer('tutor_id').references(() => tutors.id, { onDelete: 'set null' }),
  roomId: integer('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  status: text('status').$type<SeanceStatus>().notNull().default('PLANIFIEE'),
  actualStart: timestamp('actual_start', { withTimezone: true }),
  actualEnd: timestamp('actual_end', { withTimezone: true }),
  topic: text('topic'),
  summary: text('summary'),
  homework: text('homework'),
  validated: boolean('validated').notNull().default(false),
  validatedBy: uuid('validated_by').references(() => users.id, { onDelete: 'set null' }),
  validatedAt: timestamp('validated_at', { withTimezone: true }),
  cancelReason: text('cancel_reason'),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('seances_timeslot_date').on(t.timeslotId, t.date),
  index('seances_date_idx').on(t.date),
  index('seances_tutor_idx').on(t.tutorId, t.date),
  index('seances_class_idx').on(t.classId, t.date),
]);

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'RETARD' | 'EXCUSE';

export const attendances = pgTable('attendances', {
  id: serial('id').primaryKey(),
  seanceId: integer('seance_id').notNull().references(() => seances.id, { onDelete: 'cascade' }),
  studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  status: text('status').$type<AttendanceStatus>().notNull(),
  comment: text('comment'),
  recordedBy: uuid('recorded_by').references(() => users.id, { onDelete: 'set null' }),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex('attendances_unique').on(t.seanceId, t.studentId), index('attendances_student_idx').on(t.studentId)]);

export const evaluations = pgTable('evaluations', {
  id: serial('id').primaryKey(),
  academicYearId: integer('academic_year_id').notNull().references(() => academicYears.id),
  classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  tutorId: integer('tutor_id').references(() => tutors.id, { onDelete: 'set null' }),
  seanceId: integer('seance_id').references(() => seances.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  type: text('type').notNull().default('TD'), // TD | INTERROGATION | DEVOIR | EXAMEN_BLANC | TP
  date: date('date').notNull(),
  maxScore: doublePrecision('max_score').notNull().default(20),
  coefficient: doublePrecision('coefficient').notNull().default(1),
  createdAt: createdAt(),
}, (t) => [index('evaluations_class_idx').on(t.classId, t.subjectId)]);

export const grades = pgTable('grades', {
  id: serial('id').primaryKey(),
  evaluationId: integer('evaluation_id').notNull().references(() => evaluations.id, { onDelete: 'cascade' }),
  studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  score: doublePrecision('score'),
  absent: boolean('absent').notNull().default(false),
  comment: text('comment'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex('grades_unique').on(t.evaluationId, t.studentId), index('grades_student_idx').on(t.studentId)]);

export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  academicYearId: integer('academic_year_id').notNull().references(() => academicYears.id),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').notNull().default('FICHE_TD'), // FICHE_TD | CORRIGE | COURS | EPREUVE | AUTRE
  classId: integer('class_id').references(() => classes.id, { onDelete: 'set null' }),
  subjectId: integer('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
  tutorId: integer('tutor_id').references(() => tutors.id, { onDelete: 'set null' }),
  seanceId: integer('seance_id').references(() => seances.id, { onDelete: 'set null' }),
  fileId: uuid('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('SOUMIS'), // SOUMIS | APPROUVE | A_REVOIR
  adminComment: text('admin_comment'),
  visibleToParents: boolean('visible_to_parents').notNull().default(false),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- Finances
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  receiptNo: text('receipt_no').notNull().unique(),
  academicYearId: integer('academic_year_id').notNull().references(() => academicYears.id),
  studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  amount: integer('amount').notNull(),
  type: text('type').notNull().default('MENSUALITE'), // INSCRIPTION | MENSUALITE | AUTRE
  method: text('method').notNull().default('ESPECES'), // ESPECES | MTN_MOMO | ORANGE_MONEY | VIREMENT | AUTRE
  reference: text('reference'),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
  receivedBy: uuid('received_by').references(() => users.id, { onDelete: 'set null' }),
  notes: text('notes'),
  cancelled: boolean('cancelled').notNull().default(false),
  cancelReason: text('cancel_reason'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelledBy: uuid('cancelled_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
}, (t) => [index('payments_student_idx').on(t.studentId), index('payments_paid_idx').on(t.paidAt)]);

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  academicYearId: integer('academic_year_id').notNull().references(() => academicYears.id),
  date: date('date').notNull(),
  category: text('category').notNull(), // LOCATION_SALLE | SALAIRE | FOURNITURES | COMMUNICATION | TRANSPORT | ENTRETIEN | AUTRE
  label: text('label').notNull(),
  amount: integer('amount').notNull(),
  method: text('method').notNull().default('ESPECES'),
  beneficiary: text('beneficiary'),
  reference: text('reference'),
  sourceType: text('source_type'), // SALAIRE | LOCATION
  sourceRef: text('source_ref'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
}, (t) => [index('expenses_date_idx').on(t.date)]);

export const salarySlips = pgTable('salary_slips', {
  id: serial('id').primaryKey(),
  tutorId: integer('tutor_id').notNull().references(() => tutors.id, { onDelete: 'cascade' }),
  period: text('period').notNull(), // AAAA-MM
  mode: text('mode').notNull(),
  plannedMinutes: integer('planned_minutes').notNull(),
  doneMinutes: integer('done_minutes').notNull(),
  ratePct: doublePrecision('rate_pct').notNull(),
  baseSalary: integer('base_salary').notNull(),
  hourlyRate: integer('hourly_rate').notNull(),
  grossAmount: integer('gross_amount').notNull(),
  bonus: integer('bonus').notNull().default(0),
  deduction: integer('deduction').notNull().default(0),
  netAmount: integer('net_amount').notNull(),
  status: text('status').notNull().default('CALCULE'), // CALCULE | PAYE
  paidAt: timestamp('paid_at', { withTimezone: true }),
  expenseId: integer('expense_id').references(() => expenses.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('salary_unique').on(t.tutorId, t.period)]);

export const rentSettlements = pgTable('rent_settlements', {
  id: serial('id').primaryKey(),
  period: text('period').notNull().unique(), // AAAA-MM
  amount: integer('amount').notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
  expenseId: integer('expense_id').references(() => expenses.id, { onDelete: 'set null' }),
  notes: text('notes'),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- Communication
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
  senderName: text('sender_name').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  category: text('category').notNull().default('INFO'), // INFO | RAPPEL_PAIEMENT | ABSENCE | SUIVI | REUNION | URGENT
  channels: text('channels').array().notNull().default(sql`ARRAY['APP']::text[]`),
  audience: text('audience').notNull(),
  studentId: integer('student_id').references(() => students.id, { onDelete: 'set null' }),
  attachmentKind: text('attachment_kind'), // SUIVI
  attachmentRef: text('attachment_ref'),
  createdAt: createdAt(),
});

export const messageRecipients = pgTable('message_recipients', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  parentId: integer('parent_id').references(() => parents.id, { onDelete: 'set null' }),
  tutorId: integer('tutor_id').references(() => tutors.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  phone: text('phone'),
  body: text('body').notNull(),
  smsStatus: text('sms_status').notNull().default('NON_DEMANDE'), // NON_DEMANDE | ENVOYE | SIMULE | ECHEC
  smsError: text('sms_error'),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index('recipients_parent_idx').on(t.parentId), index('recipients_user_idx').on(t.userId), index('recipients_msg_idx').on(t.messageId)]);

// ---------------------------------------------------------------- Traçabilité
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  username: text('username'),
  action: text('action').notNull(),
  entity: text('entity'),
  entityId: text('entity_id'),
  details: jsonb('details'),
  ip: text('ip'),
  createdAt: createdAt(),
}, (t) => [index('audit_created_idx').on(t.createdAt)]);

export const verifications = pgTable('verifications', {
  code: text('code').primaryKey(),
  kind: text('kind').notNull(),
  refId: text('ref_id').notNull(),
  summary: jsonb('summary').$type<Record<string, string>>().notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('verifications_ref').on(t.kind, t.refId)]);

