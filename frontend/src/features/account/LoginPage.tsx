import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ApiError, errorText } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Form'
import { ErrorNote } from '../../components/ui/Feedback'
import { useI18n } from '../../i18n'

const schema = z.object({
  email: z
    .string()
    .min(1, 'Enter your email.')
    .email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})
type Form = z.infer<typeof schema>

export default function LoginPage() {
  const { user, login } = useAuth()
  const { t, lang, setLang } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) })
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (user) return <Navigate to={from} replace />

  const submit = handleSubmit(async (v) => {
    setError(null)
    try {
      await login(v.email.trim(), v.password)
      navigate(from, { replace: true })
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? "That email and password don't match an active account."
          : errorText(e)
      )
    }
  })

  return (
    <div className="grid min-h-screen md:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-board p-12 text-board-ink md:flex md:flex-col md:justify-between">
        <div className="flex items-center gap-2.5">
          <div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 380 40"
              width="380"
              height="40"
            >
              <rect width="40" height="40" rx="8" fill="#2563EB" />
              <polygon points="20,8 34,15 20,22 6,15" fill="#ffffff" />
              <circle cx="20" cy="8" r="2.5" fill="#BFDBFE" />
              <line
                x1="34"
                y1="15"
                x2="34"
                y2="27"
                stroke="#FBBF24"
                stroke-width="2"
              />
              <circle cx="34" cy="29" r="2.5" fill="#FBBF24" />
              <rect
                x="13"
                y="22"
                width="14"
                height="4"
                rx="1"
                fill="#ffffff"
                opacity="0.85"
              />
              <rect
                x="9"
                y="26"
                width="22"
                height="4"
                rx="2"
                fill="#ffffff"
                opacity="0.85"
              />

              <text
                x="52"
                y="25"
                font-family="Nunito Sans, ui-sans-serif, system-ui, sans-serif"
                font-size="24"
                font-weight="600"
                fill="currentColor"
              >
                Yohanis Children Academy
              </text>
            </svg>
            <div className="text-xs text-gray-500">Management System</div>
          </div>
        </div>
        {/* <span className="font-display text-2xl font-semibold text-white">
          Yohanis Children Academy<span className="text-chalk">.</span>
        </span> */}
        <div>
          <div aria-hidden className="mb-8 flex flex-wrap gap-1.5">
            {'PPPLPPAPPEPPPLPP'.split('').map((c, i) => (
              <span
                key={i}
                className={`flex h-8 w-8 items-center justify-center rounded text-sm font-semibold text-white ${c === 'P' ? 'bg-present' : c === 'A' ? 'bg-absent' : c === 'L' ? 'bg-late' : 'bg-excused'}`}
              >
                {c}
              </span>
            ))}
          </div>
          <p className="max-w-md font-display text-4xl font-semibold leading-tight text-white">
            Every student, every day, on one register.
          </p>
          <p className="mt-4 max-w-sm text-sm opacity-80">
            Attendance, results and fees for teachers, families and the front
            office.
          </p>
        </div>
        <span className="text-xs opacity-60">
          Secure sign-in · your data stays with your school
        </span>
      </aside>
      <main className="flex items-center justify-center p-6 sm:p-10">
        <form
          onSubmit={submit}
          noValidate
          className="w-full max-w-sm space-y-5"
        >
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-semibold">
              {t('auth.signIn', 'Sign in')}
            </h1>
            <button
              type="button"
              className="text-sm text-muted underline"
              onClick={() => setLang(lang === 'en' ? 'am' : 'en')}
            >
              {lang === 'en' ? 'አማርኛ' : 'English'}
            </button>
          </div>
          <ErrorNote message={error} />
          <Field
            label={t('auth.email', 'Email')}
            htmlFor="email"
            error={errors.email?.message}
          >
            <Input
              id="email"
              type="email"
              autoComplete="username"
              invalid={!!errors.email}
              {...register('email')}
            />
          </Field>
          <Field
            label={t('auth.password', 'Password')}
            htmlFor="password"
            error={errors.password?.message}
          >
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              invalid={!!errors.password}
              {...register('password')}
            />
          </Field>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            {t('auth.signIn', 'Sign in')}
          </Button>
          <p className="text-sm">
            <Link className="underline" to="/reset-password">
              {t('auth.forgot', 'Forgot your password?')}
            </Link>
          </p>
        </form>
      </main>
    </div>
  )
}
