'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import type { AdminArticle, ArticleInput } from '@/lib/firebase/admin-queries'

const CATEGORIES = ['getting_started', 'bidding_strategy', 'finance_compliance', 'post_win']

const EMPTY_FORM: ArticleInput = {
  id: '', category: 'getting_started', readMinutes: 3, youtubeId: null,
  titleEn: '', titleHi: '', summaryEn: '', summaryHi: '',
  bodyEn: '', bodyHi: '', published: true,
}

export default function AdminLearnPage() {
  const { user } = useAuth()
  const [articles, setArticles] = useState<AdminArticle[]>([])
  const [loading, setLoading]   = useState(true)
  const [form, setForm]         = useState<ArticleInput | null>(null)
  const [editId, setEditId]     = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const getToken = async () => user!.getIdToken()

  const load = async () => {
    if (!user) return
    setLoading(true)
    const token = await getToken()
    const res   = await fetch('/api/admin/articles', { headers: { Authorization: `Bearer ${token}` } })
    const data  = await res.json() as { articles: AdminArticle[] }
    setArticles(data.articles)
    setLoading(false)
  }

  useEffect(() => { load() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!form || !user) return
    setSaving(true)
    setError(null)
    try {
      const token  = await getToken()
      const url    = editId ? `/api/admin/articles/${editId}` : '/api/admin/articles'
      const method = editId ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Save failed')
      }
      setForm(null)
      setEditId(null)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!user || !confirm('Delete this article?')) return
    const token = await getToken()
    await fetch(`/api/admin/articles/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    await load()
  }

  const openEdit = (a: AdminArticle) => {
    setEditId(a.id)
    setForm({ ...a })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading font-bold text-2xl text-navy">Learning Center CMS</h1>
        <Button
          size="sm"
          className="bg-orange text-white hover:bg-orange/90"
          onClick={() => { setForm({ ...EMPTY_FORM }); setEditId(null) }}
        >
          <Plus size={14} className="mr-1.5" />
          New Article
        </Button>
      </div>

      {form && (
        <div className="bg-white border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-navy">{editId ? 'Edit Article' : 'New Article'}</h2>
          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Article ID (slug, e.g. gem-basics)" value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })} disabled={!!editId} />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <Input placeholder="Title (English)" value={form.titleEn}
              onChange={(e) => setForm({ ...form, titleEn: e.target.value })} />
            <Input placeholder="Title (Hindi)" value={form.titleHi}
              onChange={(e) => setForm({ ...form, titleHi: e.target.value })} />
            <Input placeholder="Summary (English)" value={form.summaryEn}
              onChange={(e) => setForm({ ...form, summaryEn: e.target.value })} />
            <Input placeholder="Summary (Hindi)" value={form.summaryHi}
              onChange={(e) => setForm({ ...form, summaryHi: e.target.value })} />
            <Input type="number" placeholder="Read minutes" value={form.readMinutes}
              onChange={(e) => setForm({ ...form, readMinutes: Number(e.target.value) })} />
            <Input placeholder="YouTube ID (optional)" value={form.youtubeId ?? ''}
              onChange={(e) => setForm({ ...form, youtubeId: e.target.value || null })} />
          </div>

          <textarea
            rows={5}
            placeholder="Body paragraphs (English) — one paragraph per line"
            value={form.bodyEn}
            onChange={(e) => setForm({ ...form, bodyEn: e.target.value })}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
          <textarea
            rows={5}
            placeholder="Body paragraphs (Hindi) — one paragraph per line"
            value={form.bodyHi}
            onChange={(e) => setForm({ ...form, bodyHi: e.target.value })}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />

          <div className="flex gap-2">
            <Button size="sm" className="bg-orange text-white" disabled={saving} onClick={handleSave}>
              <Check size={14} className="mr-1" />
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setForm(null); setEditId(null) }}>
              <X size={14} className="mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : articles.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-muted text-sm">
          No articles yet. Click &quot;New Article&quot; to create the first one.
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-lightbg border-b">
              <tr>
                <th className="text-left px-4 py-3 text-muted font-medium">Article</th>
                <th className="text-left px-4 py-3 text-muted font-medium">Category</th>
                <th className="text-left px-4 py-3 text-muted font-medium">Status</th>
                <th className="text-right px-4 py-3 text-muted font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {articles.map((a) => (
                <tr key={a.id} className="hover:bg-lightbg/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{a.titleEn}</p>
                    <p className="text-xs text-muted">{a.id} · {a.readMinutes} min read</p>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">{a.category}</td>
                  <td className="px-4 py-3">
                    <Badge className={a.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                      {a.published ? 'Published' : 'Draft'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(a)}>
                        <Pencil size={12} />
                      </Button>
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(a.id)}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
