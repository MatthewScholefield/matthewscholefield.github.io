import assert from 'node:assert/strict'
import test from 'node:test'
import { GitHubApiError, optionalReadme, parseInventory, type GitHubRepository } from './github-api.js'
import { selectProjects, validateCatalog } from './sync-github.js'

const original: GitHubRepository = { full_name: 'Owner/original', name: 'original', owner: { login: 'Owner' }, archived: false, private: false, fork: false, description: null, homepage: null, html_url: 'https://github.com/Owner/original', default_branch: 'trunk' }
function repo(name: string, overrides: Partial<GitHubRepository> = {}): GitHubRepository {
  return { ...original, full_name: `Owner/${name}`, name, html_url: `https://github.com/Owner/${name}`, ...overrides }
}

test('pagination preserves originals while forks/private/unclassified repositories cannot publish', () => {
  const pages = [[repo('original'), repo('fork', { fork: true })], [repo('private', { private: true }), repo('later', { archived: true }), repo('new')]]
  const inventory = parseInventory(pages)
  assert.deepEqual(inventory.eligible.map(item => item.name), ['original', 'later', 'new'])
  const catalog = validateCatalog({ 'Owner/original': { category: 'tools', order: 20 }, 'Owner/later': { category: 'libraries', order: 10 }, 'Owner/private': { category: 'games', order: 1 }, 'Owner/fork': { category: 'games', order: 1 } })
  const diagnostics: string[] = []
  const published = selectProjects(pages.flat(), catalog, message => diagnostics.push(message))
  assert.deepEqual(published.map(item => item.repository.name), ['later', 'original'])
  assert.ok(diagnostics.some(message => message.includes('Owner/new')))
  assert.equal(published[1].repository.description, null)
})

test('malformed API metadata and editorial classification fail closed', () => {
  assert.throws(() => parseInventory([[{ ...original, private: undefined }]]), /Malformed/)
  assert.throws(() => parseInventory([original]), /array of pages/)
  assert.throws(() => validateCatalog({ 'Owner/original': { category: 'Python', order: 1 } }), /category/)
  assert.throws(() => validateCatalog({ 'Owner/original': { category: 'tools', order: '1' } }), /order/)
  assert.throws(() => validateCatalog({ 'Owner/original': { category: 'tools', order: 1, description: 'local copy' } }), /category/)
})

test('README absence is distinct from authentication, rate limits, outages and network failures', async () => {
  assert.equal(await optionalReadme(async () => { throw new GitHubApiError('readme', 404, 'Not Found (HTTP 404)') }), null)
  for (const status of [401, 403, 429, 500, null]) {
    const error = new GitHubApiError('readme', status, 'request failed')
    await assert.rejects(optionalReadme(async () => { throw error }), candidate => candidate === error)
  }
})
