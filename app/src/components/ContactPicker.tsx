import { useState, useRef, useEffect } from 'react';
import type { Contact } from '../types';

interface Props {
  value: string;
  onChange: (name: string) => void;
  contacts: Contact[];
  placeholder?: string;
  autoFocus?: boolean;
  style?: React.CSSProperties;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const avatarColor = (name: string) => `oklch(68% 0.1 ${(name.charCodeAt(0) * 47 + 120) % 360})`;

export function ContactPicker({ value, onChange, contacts, placeholder, autoFocus, style, onKeyDown }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmed = value.trim();
  const filtered = contacts
    .filter(c => trimmed === '' || c.name.toLowerCase().includes(trimmed.toLowerCase()))
    .slice(0, 8);
  const isExact = contacts.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
  const showCreate = trimmed.length > 0 && !isExact;
  const showDropdown = open && (filtered.length > 0 || showCreate);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function select(name: string) {
    onChange(name);
    setOpen(false);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <div style={{ position: 'relative' }}>
        <input
          className="input"
          style={{ width: '100%', paddingRight: trimmed ? 80 : undefined }}
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? 'Search contacts or type a name…'}
          autoFocus={autoFocus}
          onKeyDown={e => {
            if (e.key === 'Escape') setOpen(false);
            onKeyDown?.(e);
          }}
        />
        {trimmed && (
          <span style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            fontSize: 10, padding: '2px 7px', borderRadius: 5, fontWeight: 600,
            pointerEvents: 'none',
            background: isExact ? 'color-mix(in oklab, var(--accent), transparent 82%)' : 'oklch(96% 0.02 260)',
            color: isExact ? 'var(--accent-ink)' : 'var(--ink-mute)',
          }}>
            {isExact ? '✓ Saved' : '+ New'}
          </span>
        )}
      </div>

      {showDropdown && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 400,
          background: 'color-mix(in oklab, white 96%, transparent)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--line-strong)',
          borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
        }}>
          {filtered.length > 0 && (
            <div>
              <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-mute)' }}>
                Your contacts
              </div>
              {filtered.map(c => (
                <div
                  key={c.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer' }}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => select(c.name)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'oklch(50% 0.01 260 / 0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: avatarColor(c.name),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: 12, fontWeight: 700,
                  }}>
                    {c.name[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1, color: 'var(--ink)' }}>{c.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--ink-mute)' }}>contact</span>
                </div>
              ))}
            </div>
          )}

          {showCreate && (
            <>
              {filtered.length > 0 && <div style={{ height: 1, background: 'var(--line)', margin: '2px 0' }} />}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer' }}
                onMouseDown={e => e.preventDefault()}
                onClick={() => select(trimmed)}
                onMouseEnter={e => (e.currentTarget.style.background = 'oklch(50% 0.01 260 / 0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: 'color-mix(in oklab, var(--accent), transparent 82%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent-ink)', fontSize: 16, fontWeight: 700,
                }}>
                  +
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-ink)' }}>
                    Create &ldquo;{trimmed}&rdquo;
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 1 }}>
                    Save as a new contact
                  </div>
                </div>
              </div>
            </>
          )}

          {filtered.length === 0 && !showCreate && (
            <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--ink-mute)' }}>
              No contacts yet — type a name to create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
