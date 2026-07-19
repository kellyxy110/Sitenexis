import { describe, it, expect } from 'vitest'
import { BLOG_POSTS, CATEGORIES, getPost, getRelatedPosts } from '../blog-posts'

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
})
