'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// 1. Define the shape of our Document data
interface Document {
  id: string;
  title: string;
  updated_at: string;
}

export default function DashboardPage() {
  // 2. Type the state variables
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  
  const router = useRouter();

  const fetchDocuments = async () => {
    const token = localStorage.getItem('token');
    if (!token) return router.push('/auth');

    try {
      const res = await fetch('http://localhost:4000/documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) throw new Error('Unauthorized');
      
      const data = await res.json();
      setDocuments(data);
    } catch (err) {
      localStorage.removeItem('token');
      router.push('/auth');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [router]);

  const createDocument = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('http://localhost:4000/documents', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const newDoc = await res.json();
      router.push(`/documents/${newDoc.id}`);
    } catch (err) {
      setError('Failed to create document');
    }
  };

  // 3. Type the ID parameter as a string
  const deleteDocument = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    const token = localStorage.getItem('token');
    try {
      await fetch(`http://localhost:4000/documents/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setDocuments(documents.filter(doc => doc.id !== id));
    } catch (err) {
      setError('Failed to delete document');
    }
  };

  const saveRename = async (id: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:4000/documents/${id}`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: editTitle })
      });
      
      const updatedDoc = await res.json();
      setDocuments(documents.map(doc => doc.id === id ? { ...doc, title: updatedDoc.title } : doc));
      setEditingId(null);
    } catch (err) {
      setError('Failed to rename document');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/auth');
  };

  if (loading) return <div className="p-8 font-mono">Initializing systems...</div>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-10 pb-4 border-b border-gray-200">
          <h1 className="text-3xl font-semibold tracking-tight">Documents</h1>
          <div className="flex gap-4">
            <button 
              onClick={createDocument}
              className="bg-black text-white px-5 py-2 text-sm font-medium rounded-sm hover:bg-gray-800 transition shadow-sm"
            >
              + New Document
            </button>
            <button 
              onClick={handleLogout}
              className="text-gray-500 hover:text-black text-sm transition px-3"
            >
              Logout
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 mb-6 rounded text-sm">{error}</div>}

        {/* Document Grid */}
        {documents.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-gray-300 rounded-sm">
            <p className="text-gray-500 mb-4">No documents found.</p>
            <button onClick={createDocument} className="text-blue-600 hover:underline">
              Create your first document
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <div key={doc.id} className="bg-white p-5 border border-gray-200 rounded-sm shadow-sm hover:shadow-md transition group flex flex-col justify-between h-40">
                
                {/* Title Area */}
                <div>
                  {editingId === doc.id ? (
                    <input 
                      type="text"
                      className="w-full border-b border-black outline-none font-medium mb-2 pb-1"
                      value={editTitle}
                      // 4. Type the onChange event
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditTitle(e.target.value)}
                      onBlur={() => saveRename(doc.id)}
                      onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && saveRename(doc.id)}
                      autoFocus
                    />
                  ) : (
                    <div className="flex justify-between items-start mb-2">
                      <Link href={`/documents/${doc.id}`} className="font-medium hover:text-blue-600 truncate pr-4">
                        {doc.title}
                      </Link>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 font-mono">
                    Updated: {new Date(doc.updated_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition">
                  <button 
                    onClick={() => {
                      setEditingId(doc.id);
                      setEditTitle(doc.title);
                    }}
                    className="text-xs text-gray-500 hover:text-black"
                  >
                    Rename
                  </button>
                  <button 
                    onClick={() => deleteDocument(doc.id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}