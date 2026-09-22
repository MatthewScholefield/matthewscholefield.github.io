import { spawn } from 'node:child_process';

export interface GitHubRepository {
  archived: boolean;
  default_branch: string;
  description: string | null;
  fork: boolean;
  full_name: string;
  homepage: string | null;
  html_url: string;
  name: string;
  owner: { login: string };
  private: boolean;
  visibility?: string;
}

export interface GitHubContentItem {
  download_url: string | null;
  html_url: string;
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'dir' | 'file' | 'submodule' | 'symlink';
  url: string;
}

export interface GitHubReadmeMetadata {
  download_url: string | null;
  git_url: string;
  html_url: string;
  name: string;
  path: string;
  sha: string;
  size: number;
  type: string;
  url: string;
}

export class GitHubApiError extends Error {
  readonly endpoint: string;
  readonly status: number | null;
  readonly stderr: string;

  constructor(endpoint: string, status: number | null, stderr: string) {
    super(`GitHub API request failed${status === null ? '' : ` (${status})`} for ${endpoint}: ${stderr.trim() || 'unknown error'}`);
    this.name = 'GitHubApiError';
    this.endpoint = endpoint;
    this.status = status;
    this.stderr = stderr;
  }
}

interface GhOptions {
  accept?: string;
  paginate?: boolean;
  slurp?: boolean;
}

function parseStatus(stderr: string): number | null {
  const status = stderr.match(/HTTP\s+(\d{3})/i)?.[1];
  return status ? Number(status) : null;
}

export async function ghApi(endpoint: string, options: GhOptions = {}): Promise<Buffer> {
  const args = ['api'];
  if (options.paginate) args.push('--paginate');
  if (options.slurp) args.push('--slurp');
  if (options.accept) args.push('-H', `Accept: ${options.accept}`);
  args.push(endpoint);

  return await new Promise<Buffer>((resolve, reject) => {
    const child = spawn('gh', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout));
        return;
      }
      const message = Buffer.concat(stderr).toString('utf8');
      reject(new GitHubApiError(endpoint, parseStatus(message), message));
    });
  });
}

export async function ghApiJson<T>(endpoint: string, options: GhOptions = {}): Promise<T> {
  const body = await ghApi(endpoint, { accept: 'application/vnd.github+json', ...options });
  try {
    return JSON.parse(body.toString('utf8')) as T;
  } catch (error) {
    throw new Error(`GitHub API returned invalid JSON for ${endpoint}: ${String(error)}`);
  }
}

export async function ghApiText(endpoint: string, accept: string): Promise<string> {
  return (await ghApi(endpoint, { accept })).toString('utf8');
}

export async function mapConcurrent<T, R>(
  values: readonly T[],
  limit: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new Error(`Invalid concurrency limit: ${limit}`);
  const results = new Array<R>(values.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= values.length) return;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => worker()));
  return results;
}

export function validateRepository(value: unknown): GitHubRepository {
  if (!value || typeof value !== 'object') throw new Error('Invalid repository metadata');
  const repo = value as GitHubRepository;
  if (typeof repo.full_name !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo.full_name) ||
      repo.full_name.split('/').some(part => part === '.' || part === '..') ||
      typeof repo.name !== 'string' || repo.name !== repo.full_name.split('/')[1] ||
      !repo.owner || typeof repo.owner.login !== 'string' || repo.owner.login !== repo.full_name.split('/')[0] ||
      typeof repo.private !== 'boolean' || typeof repo.fork !== 'boolean' || typeof repo.archived !== 'boolean' ||
      typeof repo.default_branch !== 'string' || !repo.default_branch ||
      !(repo.description === null || typeof repo.description === 'string') ||
      !(repo.homepage === null || typeof repo.homepage === 'string') ||
      repo.html_url !== `https://github.com/${repo.full_name}` ||
      (repo.visibility !== undefined && !['public', 'private', 'internal'].includes(repo.visibility))) {
    throw new Error(`Malformed repository metadata: ${String(repo.full_name)}`);
  }
  return repo;
}

export function parseInventory(pages: unknown): { allPublic: GitHubRepository[]; eligible: GitHubRepository[] } {
  if (!Array.isArray(pages) || pages.some(page => !Array.isArray(page))) {
    throw new Error('Paginated GitHub inventory did not return an array of pages');
  }
  const allPublic = pages.flat().map(validateRepository).filter(repo => !repo.private && (!repo.visibility || repo.visibility === 'public'));
  return { allPublic, eligible: allPublic.filter(repo => !repo.fork) };
}

export async function optionalReadme<T>(fetcher: () => Promise<T>): Promise<T | null> {
  try { return await fetcher(); } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) return null;
    throw error;
  }
}
