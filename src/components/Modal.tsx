import type { ReactNode } from 'react';

export function Modal({
  title,
  description,
  children,
  onClose,
  cardClassName,
  titleClassName,
  descriptionClassName,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  cardClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}) {
  const cardClasses = cardClassName ? `modal-card ${cardClassName}` : 'modal-card';
  const titleClasses = titleClassName ? `modal-title ${titleClassName}` : 'modal-title';
  const descriptionClasses = descriptionClassName ? `small muted ${descriptionClassName}` : 'small muted';
  return (
    <div className="modal-overlay">
      <div className={cardClasses}>
        <div className="modal-head">
          <div>
            <div className={titleClasses}>{title}</div>
            {description ? <div className={descriptionClasses}>{description}</div> : null}
          </div>
          <button className="pill ghost" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
