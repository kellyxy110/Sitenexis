import { describe, it, expect } from 'vitest';
import { isPrivateHostUrl } from '../safe-fetch';

describe('isPrivateHostUrl', () => {
  it('blocks loopback addresses', () => {
    expect(isPrivateHostUrl('http://localhost/')).toBe(true);
    expect(isPrivateHostUrl('http://127.0.0.1/')).toBe(true);
    expect(isPrivateHostUrl('http://[::1]/')).toBe(true);
  });

  it('blocks RFC1918 private ranges', () => {
    expect(isPrivateHostUrl('http://10.0.0.5/')).toBe(true);
    expect(isPrivateHostUrl('http://192.168.1.1/')).toBe(true);
    expect(isPrivateHostUrl('http://172.16.0.1/')).toBe(true);
    expect(isPrivateHostUrl('http://172.31.255.255/')).toBe(true);
    expect(isPrivateHostUrl('http://172.32.0.1/')).toBe(false); // just outside the 172.16-31 range
  });

  it('blocks link-local and cloud metadata addresses', () => {
    expect(isPrivateHostUrl('http://169.254.169.254/latest/meta-data/')).toBe(true);
  });

  it('blocks IPv6 unique-local and link-local ranges', () => {
    expect(isPrivateHostUrl('http://[fc00::1]/')).toBe(true);
    expect(isPrivateHostUrl('http://[fd12:3456::1]/')).toBe(true);
    expect(isPrivateHostUrl('http://[fe80::1]/')).toBe(true);
  });

  it('allows ordinary public domains', () => {
    expect(isPrivateHostUrl('https://sitenexis.vercel.app/')).toBe(false);
    expect(isPrivateHostUrl('https://example.com/')).toBe(false);
  });

  it('treats unparseable input as disallowed', () => {
    expect(isPrivateHostUrl('not a url')).toBe(true);
  });
});
