// Shapes returned by the Django API (see backend serializers). Money values arrive as strings.

export type Role =
  | 'super_admin'
  | 'school_admin'
  | 'registrar'
  | 'teacher'
  | 'parent'
  | 'student'
  | 'accountant'
  | 'hr'
  | 'principal'
  | 'librarian'
  | 'transport'
  | 'counselor'

export type Page<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  role: Role
  school: number | null
  phone: string
  language: 'en' | 'am'
  is_active?: boolean
}
export interface School {
  id: number
  name: string
  code: string
  address: string
  phone: string
  email: string
  currency: string
  late_fee_percent: string
  reminder_days_before_due: number
  absence_alert_threshold: number
  grading_scale: [number, string][]
  is_active: boolean
}
export interface AcademicYear {
  id: number
  name: string
  start_date: string
  end_date: string
  is_current: boolean
}
export interface Term {
  id: number
  academic_year: number
  name: string
  order: number
  start_date: string
  end_date: string
}
export interface GradeLevel {
  id: number
  name: string
  order: number
}
export interface Subject {
  id: number
  name: string
  code: string
}
export interface Section {
  id: number
  grade_level: number
  academic_year: number
  name: string
  label: string
  homeroom_teacher: number | null
  room: string
  capacity: number
  student_count: number
}
export interface TeacherAssignment {
  id: number
  teacher: number
  section: number
  subject: number
}
export interface Enrollment {
  id: number
  student: number
  student_name: string
  section: number
  section_label: string
  academic_year: number
  status: 'active' | 'completed' | 'promoted' | 'withdrawn'
  enrolled_on: string
}

export interface GuardianLink {
  id: number
  guardian: number
  guardian_name: string
  guardian_phone: string
  relationship: string
  is_primary: boolean
  can_pickup: boolean
}
export interface Student {
  id: number
  student_code: string | null
  user: number | null
  first_name: string
  middle_name: string
  last_name: string
  full_name: string
  date_of_birth: string
  gender: 'M' | 'F'
  photo_url: string | null
  address: string
  nationality: string
  admission_date: string
  status: 'active' | 'withdrawn' | 'transferred' | 'graduated'
  current_section: { id: number; name: string } | null
  guardians: GuardianLink[]
}
export interface Guardian {
  id: number
  user: number | null
  first_name: string
  last_name: string
  phone: string
  email: string
  occupation: string
  address: string
}
export interface StudentDocument {
  id: number
  student: number
  doc_type: string
  download_url: string
  status: 'pending' | 'verified' | 'rejected'
  created_at: string
}
export interface SupportRecord {
  id: number
  medical_notes: string
  allergies: string
  support_notes: string
}

export interface AttendanceRow {
  id: number
  student: number
  student_name: string
  section: number
  date: string
  status: AttendanceStatus
  note: string
}
export interface Correction {
  id: number
  record: number
  student_name: string
  date: string
  old_status: AttendanceStatus
  new_status: AttendanceStatus
  reason: string
  state: 'pending' | 'approved' | 'rejected'
  created_at: string
}
export interface RosterStudent {
  id: number
  name: string
  code: string | null
}

export interface Assessment {
  id: number
  section: number
  section_label: string
  subject: number
  subject_name: string
  term: number | null
  name: string
  kind: 'quiz' | 'assignment' | 'midterm' | 'final' | 'other'
  max_score: string
  weight: string
  date: string
  is_published: boolean
  published_at: string | null
}
export interface GradeRow {
  id: number
  assessment: number
  assessment_name: string
  subject: string
  student: number
  score: string | null
  max_score: string
  remarks: string
  date: string
}
export interface ReportCard {
  student: { id: number; name: string; code: string | null }
  term: number | null
  subjects: { subject: string; percent: string; letter: string }[]
  overall_percent: string | null
  overall_letter: string | null
}

export interface FeeCategory {
  id: number
  name: string
  code: string
}
export interface FeeStructure {
  id: number
  academic_year: number
  grade_level: number
  category: number
  category_name: string
  amount: string
  frequency: string
  is_active: boolean
}
export interface Discount {
  id: number
  name: string
  kind: 'percent' | 'fixed'
  value: string
  auto_rule: 'manual' | 'sibling'
  is_active: boolean
}
export interface StudentDiscount {
  id: number
  student: number
  discount: number
  valid_from: string
  valid_to: string | null
}
export interface InvoiceItem {
  id: number
  kind: 'charge' | 'discount' | 'late_fee'
  description: string
  quantity: number
  unit_price: string
  amount: string
}
export interface Invoice {
  id: number
  number: string | null
  student: number
  student_name: string
  academic_year: number
  status: 'draft' | 'issued' | 'partial' | 'paid' | 'void'
  issue_date: string | null
  due_date: string
  total: string
  amount_paid: string
  balance: string
  is_overdue: boolean
  currency: string
  items: InvoiceItem[]
}
export interface Payment {
  id: number
  invoice: number
  invoice_number: string | null
  amount: string
  method: 'cash' | 'bank_transfer' | 'mobile_money' | 'online'
  status: 'confirmed' | 'reversed'
  paid_on: string
  reference: string
  notes: string
  receipt_number: string
  created_at: string
}
export interface Receipt {
  number: string
  issued_at: string
  school: string
  student: string
  currency: string
  payment: Payment
}
export interface Refund {
  id: number
  payment: number
  amount: string
  reason: string
  state: 'requested' | 'approved' | 'rejected'
  requested_by: number | null
  decided_by: number | null
  decided_at: string | null
  created_at: string
}

export interface Notice {
  id: number
  category: string
  priority: 'info' | 'warning' | 'urgent'
  title: string
  body: string
  data: Record<string, number>
  is_read: boolean
  created_at: string
}
export interface Preference {
  category: string
  in_app: boolean
  email: boolean
  sms: boolean
}
export interface Delivery {
  id: number
  recipient: string
  title: string
  channel: string
  status: 'pending' | 'sent' | 'failed'
  attempts: number
  last_error: string
  sent_at: string | null
  created_at: string
}
export interface Announcement {
  id: number
  title: string
  body: string
  priority: 'info' | 'warning' | 'urgent'
  audience: 'all' | 'role' | 'grade' | 'section'
  target_role: string
  grade_level: number | null
  section: number | null
  published_at: string | null
  created_at: string
}
export interface AuditEntry {
  id: number
  actor: number | null
  actor_name: string | null
  action: string
  object_type: string
  object_id: string
  changes: Record<string, unknown>
  ip_address: string | null
  created_at: string
}

export interface Finance {
  billed: string | number
  collected: string | number
  outstanding: string | number
  overdue_count: number
}
export interface ChildCard {
  id: number
  name: string
  code: string | null
  section: string | null
  today: AttendanceStatus | null
  recent_attendance: { date: string; status: AttendanceStatus }[]
  outstanding_balance: string | number
  currency: string
  latest_grades: {
    subject: string
    assessment: string
    score: string
    max_score: string
  }[]
}
export type Dashboard =
  | { kind: 'family'; children: ChildCard[] }
  | {
      kind: 'teacher'
      sections: {
        section: number
        label: string
        students: number
        attendance_marked_today: boolean
      }[]
    }
  | {
      kind: 'finance'
      finance: Finance
      aging: Record<string, number | string>
    }
  | {
      kind: 'management'
      students_active: number
      attendance_today: Partial<Record<AttendanceStatus, number>>
      finance?: Finance
    }
  | { kind: 'basic' }
export interface AttendanceReport {
  totals: Partial<Record<AttendanceStatus, number>>
  daily: { date: string; status: AttendanceStatus; n: number }[]
}
export interface FinanceReport {
  summary: Finance
  aging: Record<string, number | string>
}
