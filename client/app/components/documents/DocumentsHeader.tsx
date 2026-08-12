import Link from 'next/link';
import UserMenu from './UserMenu';

interface DocumentsHeaderProps {
  name?: string;
  email?: string;
  onLogout: () => void;
}

export default function DocumentsHeader({ name, email, onLogout }: DocumentsHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 sm:px-10 lg:px-16">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-ink text-[13px] font-semibold text-paper">
            F
          </span>
          <span className="text-[13px] font-medium text-ink">
            Folio <span className="text-taupe">/ Documents</span>
          </span>
        </Link>

        <UserMenu name={name} email={email} onLogout={onLogout} />
      </div>
    </header>
  );
}
