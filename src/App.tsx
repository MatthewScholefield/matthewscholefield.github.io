import { Fragment } from 'react'
import { site } from '../content/site'
import { ProjectCatalog } from '@/components/ProjectCatalog'
import catalog from '@/generated/catalog.json'
import type { Project } from '@/types'

export default function App() {
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <header className="introduction">
        <h1>{site.name}</h1>
        <p>{site.introduction}</p>
        <nav className="profile-links" aria-label="Find me online">
          {site.profiles.map((link, index) => <Fragment key={link.name}>
            {index > 0 && <span className="separator" aria-hidden="true">·</span>}
            <a href={link.url}>{link.name}</a>
          </Fragment>)}
        </nav>
      </header>
      <section className="home-section" aria-labelledby="apps-heading">
        <h2 id="apps-heading">Apps</h2>
        <p className="section-intro">I also have a few apps.</p>
        <div className="card-grid">
          {site.apps.map(app => <a className="app-card" href={app.url} key={app.name}>
            <strong>{app.name}</strong>
            <span className="app-domain">{new URL(app.url).hostname}</span>
            <span className="visit-site">Visit site</span>
          </a>)}
        </div>
        <p className="business-line">Made and run by me as <strong>{site.businessName}</strong>.</p>
        <p className="recursive-line">Also under <strong>Recursive Corruption</strong>: <a href={site.recursiveCorruptionUrl}>GitHub</a>.</p>
      </section>
      <ProjectCatalog projects={catalog as Project[]} />
      <footer className="page-footer">Have a question or something to share? <a href={'mailto:' + site.email}>Say hi.</a></footer>
    </main>
  </>
}
