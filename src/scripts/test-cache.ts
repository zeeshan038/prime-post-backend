import { getOrSetCache, delCache } from '../utils/cache';

async function main() {
  const key = 'test:now';
  const value = await getOrSetCache(key, 10, async () => ({ now: Date.now() }));
  console.log('Fetched value:', value);

  // Ensure cached value is returned
  const again = await getOrSetCache(key, 10, async () => ({ now: 0 }));
  console.log('Cached value:', again);

  // Delete keys by pattern
  await delCache('test:*');
  const afterDel = await getOrSetCache(key, 10, async () => ({ now: 123 }));
  console.log('After delete (should be new):', afterDel);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
