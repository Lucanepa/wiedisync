import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CookieJar } from '../vm-client.mjs';

test('CookieJar stores and serializes cookies', () => {
  const jar = new CookieJar();
  jar.set('language', 'de');
  jar.set('session', 'abc123');
  assert.match(jar.header(), /language=de/);
  assert.match(jar.header(), /session=abc123/);
});

test('CookieJar updates from Set-Cookie response header', () => {
  const jar = new CookieJar();
  const fakeResponse = { headers: { getSetCookie: () => ['Neos_Flow_Session=xyz; Path=/; Secure'] } };
  jar.update(fakeResponse);
  assert.equal(jar.cookies.Neos_Flow_Session, 'xyz');
});
