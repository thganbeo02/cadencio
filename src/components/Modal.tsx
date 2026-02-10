import type { ReactNode } from 'react';

export function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-head">
          <div>
            <div className="modal-title">{title}</div>
            {description ? <div className="small muted">{description}</div> : null}
          </div>
          <button className="pill ghost" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
