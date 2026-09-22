import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeReadme } from './readme.js'

const context = { fullName: 'Owner/project', defaultBranch: 'release/docs', path: 'docs/README.rst' }

test('executable content is removed without losing useful README markup', () => {
  const html = sanitizeReadme(`<script>alert(1)</script><style>body{display:none}</style><iframe src="https://evil.test"></iframe><form><input name="password"></form><p class="fixed" style="color:red" onclick="evil()">Read <a href="javascript:alert(1)">this</a> <a href="https://example.com">link</a></p><pre><code>&lt;safe&gt;</code></pre><table><tr><th>Name</th><td>Value</td></tr></table><details><summary>More</summary>All the content</details><input type="checkbox" checked><input type="text"><img src="data:image/svg+xml,bad" onerror="evil()" alt="Example">`, context)
  assert.doesNotMatch(html, /<(script|style|iframe|form)|onclick|onerror|style=|class=|javascript:|data:image|type="text"/)
  assert.match(html, /<pre><code>&lt;safe&gt;<\/code><\/pre>/)
  assert.match(html, /<table>/)
  assert.match(html, /<details><summary>More<\/summary>All the content<\/details>/)
  assert.match(html, /type="checkbox" checked disabled/)
  assert.match(html, /target="_blank" rel="noopener noreferrer"/)
  assert.match(html, /alt="Example"/)
})

test('relative file/image links use actual README directory and branch; absolute links survive', () => {
  const html = sanitizeReadme('<a href="../LICENSE">License</a><img src="images/plot.png" alt="Plot"><a href="mailto:hello@example.com">Email</a><img src="https://images.example.com/a.png">', context)
  assert.match(html, /href="https:\/\/github.com\/Owner\/project\/blob\/release%2Fdocs\/LICENSE"/)
  assert.match(html, /src="https:\/\/raw.githubusercontent.com\/Owner\/project\/release%2Fdocs\/docs\/images\/plot.png"/)
  assert.match(html, /href="mailto:hello@example.com"/)
  assert.match(html, /src="https:\/\/images.example.com\/a.png"/)
})

test('GitHub heading IDs and fragment links normalize together and cannot collide across repositories', () => {
  const input = '<h2 id="user-content-usage">Usage</h2><a href="#usage">Go</a><a href="#user-content-usage">GitHub form</a>'
  const html = sanitizeReadme(input, context)
  const id = html.match(/id="([^"]+)"/)![1]
  assert.equal((html.match(new RegExp(`href="#${id}"`, 'g')) ?? []).length, 2)
  assert.notEqual(sanitizeReadme(input, { ...context, fullName: 'Other/project' }).match(/id="([^"]+)"/)![1], id)
  const permalink = sanitizeReadme('<a class="anchor" id="user-content-title" href="#title"><svg><path d="M0"/></svg></a>', context)
  assert.match(permalink, />§<\/a>/)
})

test('empty rendered wrappers mean no README, but an image-only README is retained', () => {
  assert.equal(sanitizeReadme('<div><article> \n </article></div>', context), '')
  assert.match(sanitizeReadme('<p><img src="./diagram.png" alt="Diagram"></p>', context), /alt="Diagram"/)
})
