'use client';

import { lazy, Suspense, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp } from 'lucide-react';
import { AppDialog } from '@/components/ui/AppDialog';
import retro from './ArenaRetro.module.css';

const Lesson = lazy(() => import('./ArenaPlayableLesson').then(module => ({ default: module.ArenaPlayableLesson })));
const completed = () => undefined;

/** The guided example owns its local data; the real closed book stays in place. */
export function ContestNotebookHelp({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  };
  return <>
    <button ref={trigger} type="button" className={className} data-notebook-help aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <CircleHelp size={20} aria-hidden="true" />Comment faire ?
    </button>
    {open ? createPortal(<Suspense fallback={<AppDialog open onClose={close} title="Comment faire ?" closeLabel="Retour au carnet" className={retro.gameSurface}><p role="status">Sylvain prépare ta fiche d’entraînement…</p></AppDialog>}>
      <Lesson lesson="notebook" onClose={close} onCompleted={completed} />
    </Suspense>, document.body) : null}
  </>;
}
