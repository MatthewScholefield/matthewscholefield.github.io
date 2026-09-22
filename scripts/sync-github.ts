import { appendFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { ghApiJson, ghApiText, GitHubApiError, mapConcurrent, optionalReadme, parseInventory, validateRepository, type GitHubReadmeMetadata, type GitHubRepository } from './github-api.js'
import { sanitizeReadme } from './readme.js'
import type { Category, Project } from '../src/types.js'

const ROOT = path.resolve(import.meta.dirname, '..')
const CACHE_ROOT = path.join(ROOT, '.cache', 'github')
const PERSONAL_OWNER = 'MatthewScholefield'
const CONCURRENCY = 4
const categories: Category[] = ['small-apps', 'tools', 'libraries', 'games', 'experiments']
type CatalogEntry = { category: Category; order: number } | { exclude: string }

export function validateCatalog(value: unknown): Record<string, CatalogEntry> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Catalog must be an object')
  for (const [name, entry] of Object.entries(value)) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name) || name.split('/').some(part => part === '.' || part === '..') || !entry || typeof entry !== 'object') throw new Error(`Invalid catalog entry: ${name}`)
    const keys = Object.keys(entry).sort().join(',')
    if ('exclude' in entry) {
      if (keys !== 'exclude' || typeof entry.exclude !== 'string' || !entry.exclude.trim()) throw new Error(`Invalid exclusion: ${name}`)
    } else if (keys !== 'category,order' || !categories.includes(entry.category) || !Number.isSafeInteger(entry.order)) {
      throw new Error(`Invalid category/order: ${name}`)
    }
  }
  return value as Record<string, CatalogEntry>
}

export function selectProjects(repositories: GitHubRepository[], catalog: Record<string, CatalogEntry>, diagnostic: (message: string) => void): Array<{ repository: GitHubRepository; category: Category; order: number }> {
  const seen = new Set<string>()
  const included = []
  for (const value of repositories) {
    const repository = validateRepository(value)
    const name = repository.full_name
    if (seen.has(name)) throw new Error(`Duplicate repository: ${name}`)
    seen.add(name)
    if (repository.private || repository.fork || (repository.visibility && repository.visibility !== 'public')) {
      diagnostic(`Omitted private or forked repository: ${name}`)
      continue
    }
    const entry = catalog[name]
    if (!entry) { diagnostic(`Unclassified repository (not published): ${name}`); continue }
    if ('exclude' in entry) continue
    included.push({ repository, category: entry.category, order: entry.order })
  }
  for (const [name, entry] of Object.entries(catalog)) {
    if (!seen.has(name) && !('exclude' in entry)) diagnostic(`Curated repository missing from public inventory: ${name}`)
  }
  return included.sort((a, b) => a.order - b.order || a.repository.full_name.localeCompare(b.repository.full_name, 'en'))
}

async function fetchRepositories(catalog: Record<string, CatalogEntry>) {
  const pages = await ghApiJson<unknown>(`users/${PERSONAL_OWNER}/repos?type=owner&per_page=100&sort=full_name`, { paginate: true, slurp: true })
  const personal = parseInventory(pages)
  // Explicit organization work survives the old catalog's removal; never enumerate whole organizations.
  const organizationNames = Object.keys(catalog).filter(name => name.split('/')[0].toLowerCase() !== PERSONAL_OWNER.toLowerCase())
  const unavailable: string[] = []
  const organizations = await mapConcurrent(organizationNames, CONCURRENCY, async name => {
    try { return validateRepository(await ghApiJson<unknown>(`repos/${name}`)) } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) { unavailable.push(name); return null }
      throw error
    }
  })
  return { personal, organizationNames, unavailable, repositories: [...personal.allPublic, ...organizations.filter((repo): repo is GitHubRepository => repo !== null)] }
}

function validateReadme(value: GitHubReadmeMetadata, repo: GitHubRepository): GitHubReadmeMetadata {
  if (!value || typeof value.path !== 'string' || !value.path || typeof value.sha !== 'string' || !value.sha ||
      typeof value.size !== 'number' || !Number.isSafeInteger(value.size) || value.size < 0 ||
      typeof value.html_url !== 'string' || !value.html_url.startsWith(`${repo.html_url}/blob/`)) throw new Error(`Malformed README metadata: ${repo.full_name}`)
  return value
}

async function readmeMetadata(repo: GitHubRepository) {
  return optionalReadme(async () => validateReadme(await ghApiJson<GitHubReadmeMetadata>(`repos/${repo.full_name}/readme`), repo))
}

async function collectInventory(catalog: Record<string, CatalogEntry>) {
  const fetchedAt = new Date().toISOString()
  const inventory = await fetchRepositories(catalog)
  const eligible = inventory.repositories.filter(repo => !repo.fork && !repo.private && (!repo.visibility || repo.visibility === 'public'))
  await rm(path.join(CACHE_ROOT, 'repos'), { recursive: true, force: true })
  const candidates = await mapConcurrent(eligible, CONCURRENCY, async metadata => {
    const directory = path.join(CACHE_ROOT, 'repos', metadata.full_name)
    await mkdir(directory, { recursive: true })
    await writeFile(path.join(directory, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n')
    const readme = await readmeMetadata(metadata)
    if (readme) {
      const raw = await ghApiText(`repos/${metadata.full_name}/readme`, 'application/vnd.github.raw+json')
      await writeFile(path.join(directory, 'readme.raw'), raw)
    } else {
      const listing = await optionalReadme(() => ghApiJson<unknown>(`repos/${metadata.full_name}/contents`))
      await writeFile(path.join(directory, 'contents-root.json'), JSON.stringify(listing ?? [], null, 2) + '\n')
    }
    const provenance = { status: readme ? 'available' : 'missing', fetchedAt, metadata: readme }
    await writeFile(path.join(directory, 'readme.json'), JSON.stringify(provenance, null, 2) + '\n')
    return { source: metadata.owner.login.toLowerCase() === PERSONAL_OWNER.toLowerCase() ? 'personal-inventory' : 'legacy-catalog', metadata, readme: provenance }
  })
  await mkdir(CACHE_ROOT, { recursive: true })
  const manifest = { fetchedAt, personal: { publicRepositories: inventory.personal.allPublic.length, forksExcludedBeforeReadme: inventory.personal.allPublic.length - inventory.personal.eligible.length, eligibleRepositories: inventory.personal.eligible.length }, legacyOrganizationRepositories: inventory.organizationNames, unavailableLegacyRepositories: inventory.unavailable, candidates }
  await writeFile(path.join(CACHE_ROOT, 'inventory.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`Personal public: ${manifest.personal.publicRepositories}; forks excluded before README fetch: ${manifest.personal.forksExcludedBeforeReadme}; eligible: ${manifest.personal.eligibleRepositories}`)
  console.log(`Explicit organization candidates: ${inventory.organizationNames.length}; eligible candidates: ${candidates.length}; missing READMEs: ${candidates.filter(candidate => candidate.readme.status === 'missing').length}`)
  for (const name of inventory.unavailable) console.warn(`Unavailable organization repository: ${name}`)
}

async function syncCatalog(catalog: Record<string, CatalogEntry>) {
  const inventory = await fetchRepositories(catalog)
  const diagnostics: string[] = []
  const selected = selectProjects(inventory.repositories, catalog, message => { diagnostics.push(message); console.warn(message) })
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Catalog refresh\n${diagnostics.length ? diagnostics.map(message => `- ${message}`).join('\n') : 'All public candidates are classified.'}\n`)
  // Stage a complete output set: API failures cannot turn an old catalog into a partial replacement.
  const stage = path.join(CACHE_ROOT, 'generated-stage')
  await rm(stage, { recursive: true, force: true })
  await mkdir(path.join(stage, 'readmes'), { recursive: true })
  const projects = await mapConcurrent(selected, CONCURRENCY, async ({ repository: repo, category, order }): Promise<Project> => {
    let homepageUrl: string | null = null
    if (repo.homepage) {
      try { const url = new URL(repo.homepage); if (['http:', 'https:'].includes(url.protocol)) homepageUrl = url.href } catch { /* Invalid upstream homepages are not links. */ }
    }
    const metadata = await readmeMetadata(repo)
    let readmeUrl: string | null = null
    if (metadata && metadata.size > 0) {
      const rendered = await ghApiText(`repos/${repo.full_name}/readme`, 'application/vnd.github.html+json')
      if (rendered.trim() && !rendered.trimStart().startsWith('<')) throw new Error(`GitHub did not render HTML for ${repo.full_name}`)
      const html = sanitizeReadme(rendered, { fullName: repo.full_name, defaultBranch: repo.default_branch, path: metadata.path })
      if (html) {
        const payload = JSON.stringify({ html }) + '\n'
        const hash = createHash('sha256').update(payload).digest('hex').slice(0, 16)
        const filename = `${repo.full_name}-${hash}.json`
        const destination = path.join(stage, 'readmes', filename)
        await mkdir(path.dirname(destination), { recursive: true })
        await writeFile(destination, payload)
        readmeUrl = `/generated/readmes/${filename}`
      }
    }
    return { fullName: repo.full_name, name: repo.name, description: repo.description, category, order, githubUrl: repo.html_url, homepageUrl, archived: repo.archived, readmeUrl, readmeSourceUrl: metadata?.html_url ?? null }
  })
  await mkdir(path.join(ROOT, 'public', 'generated'), { recursive: true })
  await mkdir(path.join(ROOT, 'src', 'generated'), { recursive: true })
  await rm(path.join(ROOT, 'public', 'generated', 'readmes'), { recursive: true, force: true })
  await rename(path.join(stage, 'readmes'), path.join(ROOT, 'public', 'generated', 'readmes'))
  await writeFile(path.join(ROOT, 'src', 'generated', 'catalog.json'), JSON.stringify(projects, null, 2) + '\n')
  await rm(stage, { recursive: true, force: true })
  console.log(`Generated ${projects.length} projects and ${projects.filter(project => project.readmeUrl).length} sanitized README assets.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const catalog = validateCatalog(JSON.parse(await readFile(path.join(ROOT, 'content', 'catalog.json'), 'utf8')))
  if (args.length === 1 && args[0] === '--inventory') await collectInventory(catalog)
  else if (args.length === 0) await syncCatalog(catalog)
  else throw new Error(`Unknown arguments: ${args.join(' ')}`)
}
