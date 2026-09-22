import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReadmeDialog } from '@/components/ReadmeDialog'
import type { Category, Project } from '@/types'

type Tab = 'all' | Category
const labels: Record<Tab, string> = { all: 'All', 'small-apps': 'Small apps', tools: 'Tools', libraries: 'Libraries', games: 'Games', experiments: 'Experiments' }
const tabs = Object.keys(labels) as Tab[]

export function ProjectCatalog({ projects }: { projects: Project[] }) {
  const [tab, setTab] = useState<Tab>('all')
  const [counts, setCounts] = useState<Record<Tab, number>>({ all: 6, 'small-apps': 6, tools: 6, libraries: 6, games: 6, experiments: 6 })
  const [project, setProject] = useState<Project | null>(null)
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const matching = projects.filter(item => tab === 'all' || item.category === tab)
    .sort((a, b) => a.order - b.order || a.fullName.localeCompare(b.fullName, 'en'))

  return <section className="home-section" aria-labelledby="projects-heading">
    <h2 id="projects-heading">Projects</h2>
    <p className="section-intro">Libraries, little tools, games, and other things I’ve made.</p>
    <Tabs value={tab} onValueChange={value => setTab(value as Tab)}>
      <div className="tabs-scroll">
        <TabsList variant="line" aria-label="Project categories">
          {tabs.map(value => <TabsTrigger value={value} key={value}>{labels[value]}</TabsTrigger>)}
        </TabsList>
      </div>
      {tabs.map(value => <TabsContent value={value} key={value}>
        {value === tab && <>
          {matching.length === 0 ? <p className="empty-category">Nothing here yet.</p> : <div className="card-grid project-grid">
            {matching.slice(0, counts[tab]).map(item => <Card className="project-card" key={item.fullName}>
              <button className="project-main" onClick={event => { trigger.current = event.currentTarget; setProject(item); setOpen(true) }} aria-label={`Read ${item.name} README`}>
                <h3>{item.name}</h3>
                {item.description && <p>{item.description}</p>}
              </button>
              <div className="project-meta"><span>{labels[item.category]}</span>{item.archived && <span>Archived</span>}</div>
              <div className="project-links">
                <a href={item.githubUrl}>GitHub</a>
                {item.homepageUrl && <a href={item.homepageUrl}>Website</a>}
              </div>
            </Card>)}
          </div>}
          {counts[tab] < matching.length && <Button className="show-more" variant="outline" onClick={() => setCounts(current => ({ ...current, [tab]: current[tab] + 6 }))}>Show more</Button>}
        </>}
      </TabsContent>)}
    </Tabs>
    <p className="all-repositories"><a href="https://github.com/MatthewScholefield?tab=repositories">All repositories on GitHub</a></p>
    <ReadmeDialog project={project} open={open} onOpenChange={setOpen} trigger={trigger} />
  </section>
}
