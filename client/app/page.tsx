import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
      <h1 className="text-5xl font-bold mb-4">Collaborative Editor</h1>
      <p className="mb-8 text-gray-400">Real-time CRDT architecture test.</p>
      
      <Link 
        href="/auth" 
        className="bg-white text-black px-6 py-3 rounded font-semibold hover:bg-gray-200 transition"
      >
        Enter System
      </Link>
    </div>
  );
}