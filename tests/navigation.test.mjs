import test from 'node:test'
import assert from 'node:assert/strict'
import { TAB_PATHS, tabFromHash } from '../lib/navigation.ts'

test('navigation supports refresh, deep links and safe unknown hashes', () => {
  for (const [tab, slug] of Object.entries(TAB_PATHS)) assert.equal(tabFromHash(`#${slug}`), tab)
  for (const hash of ['', '#', '#<script>', '#https://example.com', '#admin']) assert.equal(tabFromHash(hash), 'Início')
})
