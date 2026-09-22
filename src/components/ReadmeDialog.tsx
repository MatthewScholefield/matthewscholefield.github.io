import { useEffect, useState, type MouseEvent, type RefObject } from 'react'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Project } from '@/types'

const bodies = new Map<string, string>()
type ReadmeState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; html: string }

function ReadmeBody({ project }: { project: Project }) {
  const url = project.readmeUrl
  const [state, setState] = useState<ReadmeState>(() => url && bodies.has(url)
    ? { status: 'ready', html: bodies.get(url)! }
    : { status: 'loading' })

  useEffect(() => {
    if (!url || bodies.has(url)) return
    const controller = new AbortController()
    let active = true
    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) throw new Error(`README request failed: ${response.status}`)
        const payload: unknown = await response.json()
        if (!payload || typeof payload !== 'object' || !('html' in payload) || typeof payload.html !== 'string') {
          throw new Error('Invalid README payload')
        }
        if (!active) return
        bodies.set(url, payload.html)
        setState({ status: 'ready', html: payload.html })
      } catch {
        if (active) setState({ status: 'error' })
      }
    })()
    return () => { active = false; controller.abort() }
  }, [url])

  if (!url) return <p>No README here yet. <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">View the project on GitHub.</a></p>
  if (state.status === 'loading') return <p role="status">Loading README…</p>
  if (state.status === 'error') return <p role="alert">Couldn’t load this README. <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">View the project on GitHub.</a></p>

  function followFragment(event: MouseEvent<HTMLDivElement>) {
    const anchor = (event.target as Element).closest('a')
    const href = anchor?.getAttribute('href')
    if (!href?.startsWith('#')) return
    event.preventDefault()
    let id: string
    try { id = decodeURIComponent(href.slice(1)) } catch { return }
    const target = Array.from(event.currentTarget.querySelectorAll('[id]')).find(element => element.id === id)
    target?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }

  return <div className="readme-document" onClick={followFragment} dangerouslySetInnerHTML={{ __html: state.html }} />
}

export function ReadmeDialog({ project, open, onOpenChange, trigger }: {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: RefObject<HTMLButtonElement | null>
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    {project && <DialogContent className="readme-dialog" showCloseButton={false} aria-describedby={undefined}
      onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus({ preventScroll: true }) }}>
      <DialogHeader className="readme-header">
        <div className="reader-title-row">
          <DialogTitle className="reader-title">{project.name}</DialogTitle>
          <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
        </div>
        <div className="reader-links">
          <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">View on GitHub</a>
          {project.homepageUrl && <a href={project.homepageUrl} target="_blank" rel="noopener noreferrer">Website</a>}
        </div>
      </DialogHeader>
      <div className="readme-scroll" tabIndex={0} aria-label="README document">
        {open && <ReadmeBody key={project.fullName + project.readmeUrl} project={project} />}
      </div>
    </DialogContent>}
  </Dialog>
}
