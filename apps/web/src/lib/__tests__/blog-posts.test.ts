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
      expect(related.length).toBeLessThanOrEqual(4)
    }
  })

  it('incoming related-post links are not concentrated on a handful of posts', () => {
    // Regression guard for the array-order bias in the old implementation, where
    // getRelatedPosts() sliced the first N same-category posts in BLOG_POSTS order —
    // so every post in a large category linked to the same few posts, and the vast
    // majority of posts (164/212 measured before this fix) received zero incoming links.
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

    expect(zeroInbound).toBeLessThanOrEqual(15)
    expect(max).toBeLessThanOrEqual(20)
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
