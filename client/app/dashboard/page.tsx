'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import DocumentsHeader from '../components/documents/DocumentsHeader';
import DocumentToolbar, { SortOption } from '../components/documents/DocumentToolbar';
import DocumentGrid from '../components/documents/DocumentGrid';
import { DocumentGridSkeleton } from '../components/documents/DocumentCardSkeleton';
import EmptyDocuments from '../components/documents/EmptyDocuments';
import ErrorState from '../components/documents/ErrorState';
import CreateDocumentModal from '../components/documents/CreateDocumentModal';
import DeleteConfirmModal from '../components/documents/DeleteConfirmModal';
import { DocumentItem } from '../components/documents/DocumentCard';
import { useToast } from '../components/ui/Toast';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

const UI_STATE_KEY = 'folio:documents:ui';
const SCROLL_KEY = 'folio:documents:scroll';

function readStoredUiState(): { query: string; sort: SortOption; view: 'grid' | 'list' } {
  if (typeof window === 'undefined') return { query: '', sort: 'updated', view: 'grid' };
  try {
    const raw = sessionStorage.getItem(UI_STATE_KEY);
    if (!raw) return { query: '', sort: 'updated', view: 'grid' };
    const parsed = JSON.parse(raw);
    return {
      query: typeof parsed.query === 'string' ? parsed.query : '',
      sort: parsed.sort === 'title' ? 'title' : 'updated',
      view: parsed.view === 'list' ? 'list' : 'grid',
    };
  } catch {
    return { query: '', sort: 'updated', view: 'grid' };
  }
}

export default function DashboardPage() {
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [user, setUser] = useState<{ name?: string; email?: string }>({});

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const savingRenameRef = useRef<Set<string>>(new Set());

  const initialUiState = useMemo(() => readStoredUiState(), []);
  const [query, setQuery] = useState(initialUiState.query);
  const [sort, setSort] = useState<SortOption>(initialUiState.sort);
  const [view, setView] = useState<'grid' | 'list'>(initialUiState.view);

  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const scrollRestoredRef = useRef(false);
  const router = useRouter();

  const fetchDocuments = async () => {
    const token = localStorage.getItem('token');

    if (!token) {
      router.push('/auth');
      return;
    }

    setLoading(true);
    setError(false);

    try {
      const res = await fetch(`${API_URL}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) throw new Error('Unauthorized');
      if (!res.ok) throw new Error('Request failed');

      const data = await res.json();
      setDocuments(data);
    } catch (err) {
      if (err instanceof Error && err.message === 'Unauthorized') {
        localStorage.removeItem('token');
        router.push('/auth');
        return;
      }
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser({ name: data.user?.name, email: data.user?.email });
      }
    } catch {
      // Non-critical — the workspace still functions without profile info.
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist list UI state (search/sort/view) so returning from a document feels continuous.
  useEffect(() => {
    sessionStorage.setItem(UI_STATE_KEY, JSON.stringify({ query, sort, view }));
  }, [query, sort, view]);

  // Restore scroll position once the real content has painted.
  useEffect(() => {
    if (loading || scrollRestoredRef.current) return;
    scrollRestoredRef.current = true;
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved) {
      requestAnimationFrame(() => window.scrollTo(0, parseInt(saved, 10) || 0));
    }
  }, [loading]);

  // Capture scroll position right before this page unmounts (e.g. opening a document).
  useEffect(() => {
    return () => {
      sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    };
  }, []);

  // Cmd/Ctrl+K focuses search, matching the shortcut hinted in the search field.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('document-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const createDocument = async (title: string) => {
    const token = localStorage.getItem('token');
    setCreating(true);

    try {
      const res = await fetch(`${API_URL}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error();

      const newDoc = await res.json();

      if (title) {
        await fetch(`${API_URL}/documents/${newDoc.id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title }),
        });
      }

      router.push(`/documents/${newDoc.id}`);
    } catch (err) {
      setCreating(false);
      setModalOpen(false);
      showToast('Failed to create document.', 'error');
    }
  };

  const requestDelete = (doc: DocumentItem) => {
    setDeleteError('');
    setDeleteTarget(doc);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const token = localStorage.getItem('token');

    setDeleting(true);
    setDeleteError('');

    try {
      const res = await fetch(`${API_URL}/documents/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error();

      setDocuments((docs) => docs.filter((doc) => doc.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast('Document deleted', 'success');
    } catch (err) {
      setDeleteError("Couldn't delete document. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const startRename = (doc: DocumentItem) => {
    setEditingId(doc.id);
    setEditTitle(doc.title);
  };

  const saveRename = async (id: string) => {
    if (savingRenameRef.current.has(id)) return;

    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }

    const token = localStorage.getItem('token');
    savingRenameRef.current.add(id);

    try {
      const res = await fetch(`${API_URL}/documents/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: editTitle }),
      });

      if (!res.ok) throw new Error();

      const updatedDoc = await res.json();

      setDocuments((docs) =>
        docs.map((doc) =>
          doc.id === id ? { ...doc, title: updatedDoc.title ?? editTitle } : doc
        )
      );
      showToast('Document renamed', 'success');
    } catch (err) {
      showToast('Failed to rename document.', 'error');
    } finally {
      savingRenameRef.current.delete(id);
      setEditingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem(UI_STATE_KEY);
    sessionStorage.removeItem(SCROLL_KEY);
    router.push('/auth');
  };

  const visibleDocuments = useMemo(() => {
    let list = documents;

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((doc) => doc.title.toLowerCase().includes(q));
    }

    list = [...list].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return list;
  }, [documents, query, sort]);

  return (
    <div className="min-h-screen bg-paper">
      <DocumentsHeader name={user.name} email={user.email} onLogout={handleLogout} />

      <main className="mx-auto max-w-[1400px] px-6 py-10 sm:px-10 lg:px-16">
        <div className="flex flex-col gap-4 pb-8 border-b border-hairline sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-ink sm:text-4xl">
              Documents
            </h1>
            <p className="mt-2 text-[14px] text-taupe">
              Your workspace for everything you&apos;re writing together.
            </p>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="group inline-flex w-fit items-center gap-2 rounded-[6px] bg-ink px-5 py-2.5 text-[13px] font-medium text-paper transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#33312e]"
          >
            <Plus size={15} strokeWidth={2.25} />
            New Document
          </button>
        </div>

        <div className="mt-8">
          {!loading && !error && documents.length > 0 && (
            <div className="mb-6">
              <DocumentToolbar
                query={query}
                onQueryChange={setQuery}
                sort={sort}
                onSortChange={setSort}
                view={view}
                onViewChange={setView}
              />
            </div>
          )}

          {loading ? (
            <DocumentGridSkeleton />
          ) : error ? (
            <ErrorState onRetry={fetchDocuments} />
          ) : documents.length === 0 ? (
            <EmptyDocuments onCreate={() => setModalOpen(true)} />
          ) : visibleDocuments.length === 0 ? (
            <EmptyDocuments onCreate={() => setModalOpen(true)} filtered />
          ) : (
            <DocumentGrid
              documents={visibleDocuments}
              view={view}
              editingId={editingId}
              editValue={editTitle}
              onEditValueChange={setEditTitle}
              onStartRename={startRename}
              onSubmitRename={saveRename}
              onCancelRename={() => setEditingId(null)}
              onRequestDelete={requestDelete}
            />
          )}
        </div>
      </main>

      <CreateDocumentModal
        open={modalOpen}
        creating={creating}
        onClose={() => {
          setModalOpen(false);
          setCreating(false);
        }}
        onCreate={createDocument}
      />

      <DeleteConfirmModal
        open={!!deleteTarget}
        title={deleteTarget?.title ?? ''}
        deleting={deleting}
        error={deleteError}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
