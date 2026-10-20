## 1. Feed size cap

- [x] 1.1 Raise `FEED_MAX_BYTES` from 2 MiB to 8 MiB.
- [x] 1.2 Bound the memory feed cache to 32 MiB of bodies in addition to 256 entries.
- [x] 1.3 Add tests for caching a feed over 2 MiB and for byte-based eviction.
- [x] 1.4 Update the README.
