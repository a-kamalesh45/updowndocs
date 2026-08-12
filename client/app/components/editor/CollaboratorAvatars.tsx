interface CollaboratorState {
  user: { name: string; color: string };
  typing?: boolean;
}

interface CollaboratorAvatarsProps {
  users: Array<[number, CollaboratorState]>;
  max?: number;
}

export default function CollaboratorAvatars({ users, max = 4 }: CollaboratorAvatarsProps) {
  if (users.length === 0) return null;

  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map(([clientId, state]) => (
        <div
          key={clientId}
          title={state.user.name}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-paper transition-transform duration-150 hover:z-10 hover:scale-110"
          style={{ backgroundColor: state.user.color }}
        >
          {state.user.name.charAt(0).toUpperCase()}
        </div>
      ))}
      {overflow > 0 && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hairline text-[10px] font-semibold text-taupe ring-2 ring-paper">
          +{overflow}
        </div>
      )}
    </div>
  );
}
