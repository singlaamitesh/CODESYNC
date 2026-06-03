/**
 * Floating status overlay for the collaborative editor: connection + sync
 * state, connected-user avatars, and the CRDT delta counter. Pure presentation.
 */
import React from 'react';
import { Users, Wifi, WifiOff, Bot } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { UserPresence } from './userIdentity';

interface Props {
  isConnected: boolean;
  isSynced: boolean;
  connectedUsers: UserPresence[];
  deltaCount: number;
}

export const EditorStatusBar: React.FC<Props> = ({
  isConnected,
  isSynced,
  connectedUsers,
  deltaCount,
}) => (
  <>
    {/* Top-right: connection / sync / users / deltas */}
    <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-md px-3 py-1.5 text-xs">
      <div className={cn('flex items-center gap-1', isConnected ? 'text-green-500' : 'text-red-500')}>
        {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
        <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
      </div>

      <div className="w-px h-4 bg-border" />

      <div className={cn('flex items-center gap-1', isSynced ? 'text-green-500' : 'text-yellow-500')}>
        <span>{isSynced ? '✓ Synced' : '⟳ Syncing'}</span>
      </div>

      <div className="w-px h-4 bg-border" />

      <div className="flex items-center gap-1">
        <Users className="h-3 w-3" />
        <span>{connectedUsers.length} user{connectedUsers.length !== 1 ? 's' : ''}</span>
        {connectedUsers.some((u) => u.isAI) && (
          <span title="AI Agent Connected">
            <Bot className="h-3 w-3 text-green-400 ml-1" />
          </span>
        )}
      </div>

      <div className="w-px h-4 bg-border" />

      <div className="flex items-center gap-1 text-muted-foreground">
        <span>Δ {deltaCount}</span>
      </div>
    </div>

    {/* Top-left: stacked user avatars (only when >1 collaborator) */}
    {connectedUsers.length > 1 && (
      <div className="absolute top-2 left-2 z-10 flex -space-x-2">
        {connectedUsers.slice(0, 5).map((user) => (
          <div
            key={user.id}
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2 border-background',
              user.isAI && 'ring-2 ring-green-400',
            )}
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {user.isAI ? '🤖' : user.name.charAt(0).toUpperCase()}
          </div>
        ))}
        {connectedUsers.length > 5 && (
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium border-2 border-background">
            +{connectedUsers.length - 5}
          </div>
        )}
      </div>
    )}
  </>
);
