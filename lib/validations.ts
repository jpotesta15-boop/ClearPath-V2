import { z } from 'zod'

/** Add client form — Phase 2 / Session 5 */
export const addClientSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Email must be valid'),
  phone: z.string().optional(),
  goals: z.string().optional(),
})
export type AddClientInput = z.infer<typeof addClientSchema>

/** Update client (patch) — optional fields */
export const updateClientSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  goals: z.string().nullable().optional(),
  status: z.enum(['active', 'paused', 'completed']).optional(),
  notes: z.string().nullable().optional(),
  profile_photo_url: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
})
export type UpdateClientInput = z.infer<typeof updateClientSchema>

/** Login form */
export const loginSchema = z.object({
  email: z.string().email('Email must be valid'),
  password: z.string().min(1, 'Password is required'),
})
export type LoginInput = z.infer<typeof loginSchema>

/** Signup form */
export const signupSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    email: z.string().email('Email must be valid'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type SignupInput = z.infer<typeof signupSchema>

/** Invite client — email only (11-auth, 04-client-management) */
export const inviteClientSchema = z.object({
  email: z.string().email('Email must be valid').transform((e) => e.trim().toLowerCase()),
})
export type InviteClientInput = z.infer<typeof inviteClientSchema>

/** Set password (after invite) — min 8 chars */
export const setPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
export type SetPasswordInput = z.infer<typeof setPasswordSchema>

/** Send message form — clientId + content (05-messaging, Session 8) */
export const sendMessageSchema = z.object({
  clientId: z.string().uuid('Invalid client'),
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message must be 2000 characters or less'),
})
export type SendMessageInput = z.infer<typeof sendMessageSchema>

/** Mark messages read — clientId (thread) */
export const markMessagesReadSchema = z.object({
  clientId: z.string().uuid('Invalid client'),
})
export type MarkMessagesReadInput = z.infer<typeof markMessagesReadSchema>

/** Recurring availability — create (Session 9) */
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/
export const recurringAvailabilityCreateSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(timeRegex, 'Use HH:mm or HH:mm:ss'),
  endTime: z.string().regex(timeRegex, 'Use HH:mm or HH:mm:ss'),
  label: z.string().max(200).optional(),
  sessionProductId: z.string().uuid().optional().nullable(),
}).refine((d) => d.endTime > d.startTime, { message: 'End time must be after start time', path: ['endTime'] })
export type RecurringAvailabilityCreateInput = z.infer<typeof recurringAvailabilityCreateSchema>

/** Recurring availability — patch */
export const recurringAvailabilityPatchSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: z.string().regex(timeRegex).optional(),
  endTime: z.string().regex(timeRegex).optional(),
  label: z.string().max(200).nullable().optional(),
  sessionProductId: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
}).refine(
  (d) => {
    if (d.startTime != null && d.endTime != null) return d.endTime > d.startTime
    return true
  },
  { message: 'End time must be after start time', path: ['endTime'] }
)
export type RecurringAvailabilityPatchInput = z.infer<typeof recurringAvailabilityPatchSchema>

/** Create session (coach) — client, time, optional duration/notes/slot/product */
export const createSessionSchema = z.object({
  client_id: z.string().uuid('Invalid client'),
  scheduled_time: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date-time'),
  duration_minutes: z.number().int().min(15).max(240).optional().default(60),
  notes: z.string().max(2000).optional().nullable(),
  availability_slot_id: z.string().uuid().optional().nullable(),
  session_product_id: z.string().uuid().optional().nullable(),
  status: z.enum(['pending', 'confirmed']).optional().default('confirmed'),
})
export type CreateSessionInput = z.infer<typeof createSessionSchema>

/** Session package — create/update (Session 11) */
export const createPackageSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional().nullable(),
  price_cents: z.number().int().min(0),
  currency: z.string().length(3).optional().default('usd'),
  duration_minutes: z.number().int().min(5).max(480).optional().default(60),
  session_type: z.string().max(100).optional().nullable(),
  is_active: z.boolean().optional().default(true),
})
export type CreatePackageInput = z.infer<typeof createPackageSchema>

export const updatePackageSchema = createPackageSchema.partial()
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>

/** Create invoice — package, client, optional due date */
export const createInvoiceSchema = z.object({
  packageId: z.string().uuid('Invalid package'),
  clientId: z.string().uuid('Invalid client'),
  dueDate: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date').optional().nullable(),
})
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>

/** Mark invoice paid — payment method and optional reference/note */
const paymentMethodEnum = z.enum([
  'cash', 'zelle', 'venmo', 'cashapp', 'paypal', 'bank_transfer', 'stripe', 'other',
])
export const markInvoicePaidSchema = z.object({
  paymentMethod: paymentMethodEnum,
  paymentReference: z.string().max(500).optional().nullable(),
  paymentMethodNote: z.string().max(500).optional().nullable(),
  amountCents: z.number().int().min(0).optional(),
})
export type MarkInvoicePaidInput = z.infer<typeof markInvoicePaidSchema>

/** Program builder (Session 12) */
export const createProgramSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional().nullable(),
})
export type CreateProgramInput = z.infer<typeof createProgramSchema>

export const updateProgramSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
})
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>

export const createModuleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(2000).optional().nullable(),
  position: z.number().int().min(0).optional().default(0),
})
export type CreateModuleInput = z.infer<typeof createModuleSchema>

export const updateModuleSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  position: z.number().int().min(0).optional(),
})
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>

export const createContentSchema = z.object({
  contentType: z.enum(['text', 'url', 'video', 'file']),
  title: z.string().max(500).optional().nullable(),
  body: z.string().max(50000).optional().nullable(),
  url: z.string().max(2000).optional().nullable(),
  videoId: z.string().uuid().optional().nullable(),
  fileUrl: z.string().max(2000).optional().nullable(),
})
export type CreateContentInput = z.infer<typeof createContentSchema>

export const updateContentSchema = z.object({
  title: z.string().max(500).nullable().optional(),
  body: z.string().max(50000).nullable().optional(),
  url: z.string().max(2000).nullable().optional(),
  videoId: z.string().uuid().nullable().optional(),
  fileUrl: z.string().max(2000).nullable().optional(),
  position: z.number().int().min(0).optional(),
})
export type UpdateContentInput = z.infer<typeof updateContentSchema>

export const assignProgramSchema = z.object({
  clientId: z.string().uuid('Invalid client'),
})
export type AssignProgramInput = z.infer<typeof assignProgramSchema>
