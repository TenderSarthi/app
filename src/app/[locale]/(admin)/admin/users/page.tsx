'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Trash2, Crown } from 'lucide-react'
import type { AdminUser } from '@/lib/firebase/admin-queries'

export default function AdminUsersPage() {
  const { user }            = useAuth()
  const [users, setUsers]   = useState<AdminUser[]>([])
  const [query, setQuery]   = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  const load = async () => {
    if (!user) return
    setLoading(true)
    try {
      const token = await user.getIdToken()
      const res   = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to load users')
      const data  = await res.json() as { users: AdminUser[] }
      setUsers(data.users)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTogglePlan = async (uid: string, currentPlan: string) => {
    if (!user) return
    const newPlan = currentPlan === 'pro' ? 'free' : 'pro'
    if (!confirm(`Change plan to ${newPlan}?`)) return
    const token = await user.getIdToken()
    await fetch(`/api/admin/users/${uid}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan: newPlan }),
    })
    await load()
  }

  const handleDelete = async (uid: string, name: string) => {
    if (!user) return
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return
    const token = await user.getIdToken()
    await fetch(`/api/admin/users/${uid}/delete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    await load()
  }

  const filtered = users.filter((u) => {
    const q = query.toLowerCase()
    return (
      u.name.toLowerCase().includes(q)  ||
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.phone ?? '').includes(q)
    )
  })

  if (error) return <p className="text-red-600 text-sm">{error}</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading font-bold text-2xl text-navy">Users</h1>
        <span className="text-sm text-muted">{users.length} loaded</span>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          placeholder="Search name, email, phone…"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-lightbg border-b">
              <tr>
                <th className="text-left px-4 py-3 text-muted font-medium">User</th>
                <th className="text-left px-4 py-3 text-muted font-medium">Plan</th>
                <th className="text-left px-4 py-3 text-muted font-medium">Joined</th>
                <th className="text-right px-4 py-3 text-muted font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((u) => (
                <tr key={u.uid} className="hover:bg-lightbg/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{u.name}</p>
                    <p className="text-xs text-muted">{u.email ?? u.phone ?? '—'}</p>
                    {u.deletionRequested && (
                      <p className="text-xs text-red-500 mt-0.5">Deletion requested</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={u.plan === 'pro' ? 'bg-orange text-white' : 'bg-gray-100 text-gray-700'}>
                      {u.plan}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleTogglePlan(u.uid, u.plan)}
                      >
                        <Crown size={12} className="mr-1" />
                        {u.plan === 'pro' ? '→ Free' : '→ Pro'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(u.uid, u.name)}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted text-sm">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
