import { Check, RefreshCw, WifiOff } from 'lucide-react';

export type ConnectionTone = 'positive' | 'warning' | 'negative' | 'neutral';

interface ConnectionStatusProps {
  label: string;
  tone: ConnectionTone;
  spinning?: boolean;
}

const TONE_COLOR: Record<ConnectionTone, string> = {
  positive: '#2F5233',
  warning: '#C4502A',
  negative: '#A33A3A',
  neutral: '#8A8578',
};

export default function ConnectionStatus({ label, tone, spinning = false }: ConnectionStatusProps) {
  const color = TONE_COLOR[tone];
  const Icon = tone === 'negative' ? WifiOff : tone === 'positive' ? Check : RefreshCw;

  return (
    <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color }}>
      <Icon size={12} strokeWidth={2.25} className={spinning ? 'animate-spin' : ''} />
      <span>{label}</span>
    </div>
  );
}
