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
      router.push('/login')
      router.refresh()
    } catch (error) {
      if (error instanceof ApiError) {
        setPasswordError(
          error.details?.length ? error.details.map((d) => d.message).join('；') : error.message,
        )
      } else {
        setPasswordError('修改失败')
      }
    } finally {
      setSavingPassword(false)
    }
  }

  /** 分栏切换：用文字激活态（字重 + 下划线）替代按钮组 */
  return (
    <div>
      <div className="flex gap-8 border-b border-ink-line dark:border-night-line">
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
            aria-current={tab === value ? 'true' : undefined}
            className={
              tab === value
                ? '-mb-px border-b border-accent pb-3 font-sans text-sm font-medium text-accent'
                : '-mb-px border-b border-transparent pb-3 font-sans text-sm text-ink-muted transition-colors hover:text-accent dark:text-ink-faint'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <form onSubmit={saveProfile} className="mt-10 max-w-md space-y-8" noValidate>
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

          <div className="flex items-center gap-6 pt-2">
            <Button type="submit" variant="primary" disabled={savingProfile}>
              {savingProfile && <Spinner />}
              保存
            </Button>
            <a href={`/users/${user.username}`} className="link font-sans text-xs">
              查看公开主页
            </a>
          </div>
        </form>
      ) : (
        <form onSubmit={savePassword} className="mt-10 max-w-md space-y-8" noValidate>
          {passwordError && (
            <p className="border-l-2 border-red-600 pl-4 font-sans text-sm text-red-700 dark:text-red-400">
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

          <Field label="新密码" htmlFor="newPassword" required hint="至少 8 位，需同时包含字母和数字">
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
              onChange={(event) => setPasswords((prev) => ({ ...prev, confirm: event.target.value }))}
            />
          </Field>

          <div className="pt-2">
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
              {savingPassword && <Spinner />}
              修改密码
            </Button>
            <p className="mt-3 font-sans text-xs text-ink-faint dark:text-ink-muted">
              修改成功后本账号的其它登录会话都会失效。
            </p>
          </div>
        </form>
      )}
    </div>
  )
}
