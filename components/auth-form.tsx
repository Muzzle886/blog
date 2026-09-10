'use client'

import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { api, ApiError } from '@/lib/api-client'
import { safeRedirectPath } from '@/lib/safe-redirect'
import { useToast } from './ui/toast'
import { Button, Field, Input, Spinner } from './ui'

type Mode = 'login' | 'register'

interface FieldErrors {
  [key: string]: string
}

/** 登录 / 注册表单。成功后写入会话 Cookie（由 API 层完成），再跳转回来源页。 */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  // 只接受站内相对路径，避免 ?redirect=https://evil.tld 造成登录后开放重定向
  const redirectTo = safeRedirectPath(searchParams.get('redirect'))

  const [form, setForm] = useState({
    identifier: '',
    username: '',
    email: '',
    nickname: '',
    password: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 切换登录/注册时清空校验状态
  useEffect(() => {
    setErrors({})
    setFormError('')
  }, [mode])

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setErrors({})
    setFormError('')

    try {
      if (mode === 'login') {
        await api.post('/api/auth/login', {
          identifier: form.identifier.trim(),
          password: form.password,
        })
        toast.success('登录成功')
      } else {
        await api.post('/api/auth/register', {
          username: form.username.trim(),
          email: form.email.trim(),
          nickname: form.nickname.trim(),
          password: form.password,
        })
        toast.success('注册成功，已自动登录')
      }
      router.push(redirectTo)
      router.refresh()
    } catch (error) {
      if (error instanceof ApiError) {
        // 422 携带字段级明细，直接贴到对应输入框
        if (error.details?.length) {
          const mapped: FieldErrors = {}
          for (const detail of error.details) {
            mapped[detail.path] = detail.message
          }
          setErrors(mapped)
          setFormError('请检查表单中标红的字段')
        } else if (error.code === 'CONFLICT') {
          const key = error.message.includes('邮箱') ? 'email' : 'username'
          setErrors({ [key]: error.message })
          setFormError(error.message)
        } else {
          setFormError(error.message)
        }
      } else {
        setFormError('网络异常，请稍后重试')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400">
          {formError}
        </p>
      )}

      {isLogin ? (
        <Field
          label="用户名或邮箱"
          htmlFor="identifier"
          error={errors.identifier}
          required
        >
          <Input
            id="identifier"
            name="identifier"
            autoComplete="username"
            value={form.identifier}
            onChange={(event) => update('identifier', event.target.value)}
            placeholder="用户名或邮箱"
          />
        </Field>
      ) : (
        <>
          <Field label="用户名" htmlFor="username" error={errors.username} required hint="3–32 位字母、数字、下划线或连字符">
            <Input
              id="username"
              name="username"
              autoComplete="username"
              value={form.username}
              onChange={(event) => update('username', event.target.value)}
              placeholder="用户名"
            />
          </Field>

          <Field label="昵称" htmlFor="nickname" error={errors.nickname} required hint="展示在文章与评论中">
            <Input
              id="nickname"
              name="nickname"
              value={form.nickname}
              onChange={(event) => update('nickname', event.target.value)}
              placeholder="展示给他人的名字"
            />
          </Field>

          <Field label="邮箱" htmlFor="email" error={errors.email} required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              placeholder="you@example.com"
            />
          </Field>
        </>
      )}

      <Field
        label="密码"
        htmlFor="password"
        error={errors.password}
        required
        hint={isLogin ? undefined : '至少 8 位，需同时包含字母和数字'}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          value={form.password}
          onChange={(event) => update('password', event.target.value)}
          placeholder="••••••••"
        />
      </Field>

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={submitting}
      >
        {submitting && <Spinner className="h-3.5 w-3.5" />}
        {isLogin ? '登录' : '注册并登录'}
      </Button>

      <p className="text-center text-xs text-ink-400 dark:text-ink-500">
        {isLogin ? (
          <>
            还没有账号？
            <Link
              href={`/register${redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
              className="ml-1 text-accent hover:underline"
            >
              注册
            </Link>
          </>
        ) : (
          <>
            已有账号？
            <Link
              href={`/login${redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
              className="ml-1 text-accent hover:underline"
            >
              登录
            </Link>
          </>
        )}
      </p>
    </form>
  )
}
