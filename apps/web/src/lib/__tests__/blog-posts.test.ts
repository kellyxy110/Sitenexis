import { describe, it, expect } from 'vitest'
import { BLOG_POSTS, CATEGORIES, getPost, getRelatedPosts, getSeriesInfo } from '../blog-posts'

describe('blog internal linking', () => {
  const allSlugs = new Set(BLOG_POSTS.map(p => p.slug))

  it('every category actually used by a post is filterable via CATEGORIES', () => {
    const used = new Set(BLOG_POSTS.map(p => p.category))
    const filterable = new Set(CATEGORIES as readonly string[])
    for (const category of used) {
      expect(filterable.has(category)).toBe(true)
    }
  })

  it('every hand-authored inline related-block slug resolves to a real post', () => {
    const broken: string[] = []
    for (const post of BLOG_POSTS) {
      for (const block of post.content) {
        if (block.type !== 'related') continue
        for (const slug of block.slugs) {
          if (!allSlugs.has(slug)) broken.push(`${post.slug} -> ${slug}`)
        }
      }
    }
    expect(broken).toEqual([])
  })

  it('getRelatedPosts never references the current post or a nonexistent slug', () => {
    for (const post of BLOG_POSTS) {
      const related = getRelatedPosts(post)
      for (const rel of related) {
        expect(rel.slug).not.toBe(post.slug)
        expect(allSlugs.has(rel.slug)).toBe(true)
      }
      // Base list is capped at 4; the coverage-repair pass can additively append a
      // small number of extra slots onto a handful of source posts (see below) —
      // bounded generously here as a guard against a pathological future where many
      // orphaned posts happen to repair onto the same hub post.
      expect(related.length).toBeLessThanOrEqual(8)
    }
  })

  it('incoming related-post links are not concentrated on a handful of posts, and every post has at least one', () => {
    // Regression guard for the array-order bias in the old implementation, where
    // getRelatedPosts() sliced the first N same-category posts in BLOG_POSTS order —
    // so every post in a large category linked to the same few posts, and the vast
    // majority of posts (164/212 measured before this fix) received zero incoming links.
    // The coverage-repair pass (see blog-posts.ts) closed the remaining gap to zero —
    // this is a hard invariant now, not just a "mostly fixed" bound.
    const inbound = new Map<string, number>()
    for (const post of BLOG_POSTS) inbound.set(post.slug, 0)
    for (const post of BLOG_POSTS) {
      for (const rel of getRelatedPosts(post)) {
        inbound.set(rel.slug, (inbound.get(rel.slug) ?? 0) + 1)
      }
    }
    const counts = [...inbound.values()]
    const zeroInbound = counts.filter(c => c === 0).length
    const max = Math.max(...counts)

    expect(zeroInbound).toBe(0)
    expect(max).toBeLessThanOrEqual(20)
  })

  it('no tag is duplicated under a different casing across the corpus', () => {
    // Regression guard: 42 tags previously existed in two casings simultaneously
    // (e.g. "Entity Authenticity" vs "entity authenticity"), silently defeating the
    // exact-match tag comparison getRelatedPosts relied on before it went
    // case-insensitive. Keeping this at zero also keeps the tags shown to users
    // (and embedded in each post's JSON-LD `keywords`) from looking duplicated.
    const casings = new Map<string, Set<string>>()
    for (const post of BLOG_POSTS) {
      for (const tag of post.tags) {
        const lower = tag.toLowerCase()
        if (!casings.has(lower)) casings.set(lower, new Set())
        casings.get(lower)!.add(tag)
      }
    }
    const inconsistent = [...casings.entries()].filter(([, variants]) => variants.size > 1)
    expect(inconsistent).toEqual([])
  })

  it('getPost resolves every slug referenced by an inline related block', () => {
    for (const post of BLOG_POSTS) {
      for (const block of post.content) {
        if (block.type !== 'related') continue
        for (const slug of block.slugs) {
          expect(getPost(slug)).toBeDefined()
        }
      }
    }
  })

  it('every in-prose [label](/blog/slug) link resolves to a real post', () => {
    // Series posts carry hand-written mid-paragraph links (RichText parses
    // [label](href) inside p/list/callout text), not just the boxed 'related'
    // block. A typo'd slug here would silently render as a dead link.
    const linkPattern = /\]\(\/blog\/([a-z0-9-]+)\)/g
    const broken: string[] = []
    for (const post of BLOG_POSTS) {
      for (const block of post.content) {
        const text = 'text' in block ? block.text : undefined
        const items = 'items' in block ? block.items : undefined
        const texts = items ?? (text ? [text] : [])
        for (const t of texts) {
          for (const match of t.matchAll(linkPattern)) {
            if (!allSlugs.has(match[1]!)) broken.push(`${post.slug} -> ${match[1]}`)
          }
        }
      }
    }
    expect(broken).toEqual([])
  })
})

describe('authored series navigation', () => {
  const allSlugs = new Set(BLOG_POSTS.map(p => p.slug))

  it('returns null for a post that is not part of any authored series', () => {
    expect(getSeriesInfo('why-ai-systems-ignore-70-percent-of-your-content')).toBeNull()
  })

  it('every series post has a defined position, correct total, and resolvable prev/next slugs', () => {
    for (const post of BLOG_POSTS) {
      const info = getSeriesInfo(post.slug)
      if (!info) continue

      expect(info.position).toBeGreaterThanOrEqual(1)
      expect(info.position).toBeLessThanOrEqual(info.total)

      if (info.prevSlug) {
        expect(allSlugs.has(info.prevSlug)).toBe(true)
        expect(info.prevTitle).toBeTruthy()
      } else {
        expect(info.position).toBe(1)
      }

      if (info.nextSlug) {
        expect(allSlugs.has(info.nextSlug)).toBe(true)
        expect(info.nextTitle).toBeTruthy()
      } else {
        expect(info.position).toBe(info.total)
      }
    }
  })

  it('walking next from the first post in a series reaches every other post exactly once', () => {
    // Regression guard: catches a typo'd or duplicated slug in the SERIES registry
    // that would otherwise silently break the chain (skip a post, loop early, etc).
    const seenSeriesIds = new Set<string>()
    for (const post of BLOG_POSTS) {
      const info = getSeriesInfo(post.slug)
      if (!info || info.position !== 1 || seenSeriesIds.has(info.seriesId)) continue
      seenSeriesIds.add(info.seriesId)

      const walked: string[] = [post.slug]
      let cursor = info.nextSlug
      while (cursor) {
        walked.push(cursor)
        cursor = getSeriesInfo(cursor)?.nextSlug ?? null
      }

      expect(walked.length).toBe(info.total)
      expect(new Set(walked).size).toBe(walked.length)
    }
  })
})
