'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { PublicUser } from '@/lib/types'
import { api, ApiError } from '@/lib/api-client'
import { Button, Field, Input, Spinner, Textarea } from './ui'
import { useToast } from './ui/toast'

type Tab = 'profile' | 'password'

export function SettingsForm({ user }: { user: PublicUser }) {
  const router = useRouter()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('profile')

  const [profile, setProfile] = useState({
    nickname: user.nickname,
    email: user.email ?? '',
    bio: user.bio ?? '',
  })
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({})
  const [savingProfile, setSavingProfile] = useState(false)

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [passwordError, setPasswordError] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    setSavingProfile(true)
    setProfileErrors({})
    try {
      await api.patch('/api/users/me', {
        nickname: profile.nickname.trim(),
        email: profile.email.trim(),
        bio: profile.bio.trim() || null,
      })
      toast.success('资料已更新')
      router.refresh()
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details?.length) {
          setProfileErrors(Object.fromEntries(error.details.map((d) => [d.path, d.message])))
        }
        toast.error(error.message)
      } else {
        toast.error('保存失败')
      }
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault()
    setPasswordError('')

    if (passwords.newPassword !== passwords.confirm) {
      setPasswordError('两次输入的新密码不一致')
      return
    }

    setSavingPassword(true)
    try {
      await api.patch('/api/users/me/password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      })
      toast.success('密码已修改，请重新登录')
      // 后端会注销当前会话，跳转到登录页
      router.push('/login')
      router.refresh()
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details?.length) {
          setPasswordError(error.details.map((d) => d.message).join('；'))
        } else {
          setPasswordError(error.message)
        }
      } else {
        setPasswordError('修改失败')
      }
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex gap-1 border-b border-ink-200 dark:border-ink-800">
        {(
          [
            ['profile', '基本资料'],
            ['password', '修改密码'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={
              tab === value
                ? '-mb-px border-b-2 border-ink-900 px-3 py-2 text-sm font-medium text-ink-900 dark:border-ink-100 dark:text-ink-100'
                : '-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-ink-500 transition-colors hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <form onSubmit={saveProfile} className="max-w-md space-y-4" noValidate>
          <Field label="用户名" hint="用户名不可修改">
            <Input value={user.username} disabled />
          </Field>

          <Field label="昵称" htmlFor="nickname" error={profileErrors.nickname} required>
            <Input
              id="nickname"
              value={profile.nickname}
              maxLength={32}
              onChange={(event) => setProfile((prev) => ({ ...prev, nickname: event.target.value }))}
            />
          </Field>

          <Field label="邮箱" htmlFor="email" error={profileErrors.email} required>
            <Input
              id="email"
              type="email"
              value={profile.email}
              onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))}
            />
          </Field>

          <Field
            label="个人简介"
            htmlFor="bio"
            error={profileErrors.bio}
            hint={`${profile.bio.length} / 200`}
          >
            <Textarea
              id="bio"
              rows={3}
              maxLength={200}
              value={profile.bio}
              onChange={(event) => setProfile((prev) => ({ ...prev, bio: event.target.value }))}
              placeholder="展示在你的公开主页上"
            />
          </Field>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" variant="primary" disabled={savingProfile}>
              {savingProfile && <Spinner className="h-3.5 w-3.5" />}
              保存修改
            </Button>
            <a
              href={`/users/${user.username}`}
              className="text-xs text-accent hover:underline"
            >
              查看公开主页
            </a>
          </div>
        </form>
      ) : (
        <form onSubmit={savePassword} className="max-w-md space-y-4" noValidate>
          {passwordError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400">
              {passwordError}
            </p>
          )}

          <Field label="当前密码" htmlFor="currentPassword" required>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={passwords.currentPassword}
              onChange={(event) =>
                setPasswords((prev) => ({ ...prev, currentPassword: event.target.value }))
              }
            />
          </Field>

          <Field
            label="新密码"
            htmlFor="newPassword"
            required
            hint="至少 8 位，需同时包含字母和数字"
          >
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={passwords.newPassword}
              onChange={(event) =>
                setPasswords((prev) => ({ ...prev, newPassword: event.target.value }))
              }
            />
          </Field>

          <Field label="确认新密码" htmlFor="confirm" required>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={passwords.confirm}
              onChange={(event) =>
                setPasswords((prev) => ({ ...prev, confirm: event.target.value }))
              }
            />
          </Field>

          <div className="pt-1">
            <Button
              type="submit"
              variant="primary"
              disabled={
                savingPassword ||
                !passwords.currentPassword ||
                !passwords.newPassword ||
                !passwords.confirm
              }
            >
              {savingPassword && <Spinner className="h-3.5 w-3.5" />}
              修改密码
            </Button>
            <p className="mt-2 text-xs hint">修改成功后当前会话会失效，需要重新登录。</p>
          </div>
        </form>
      )}
    </div>
  )
}
