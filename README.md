# AI Remove Pilot

**Clean Your Images. Keep Your Privacy.**

A privacy-first image utility. Upload an image, have its embedded metadata and supported provenance
information removed, and download the cleaned file. Nothing is stored.

```
Upload → Clean → Download
```

## What it does, and what it does not

It removes data embedded **in the file**: EXIF, GPS/location, camera and lens identification,
software and editing history, XMP, IPTC, embedded thumbnails, comment blocks, and supported C2PA
provenance manifests.

It does **not** control how a third-party platform classifies an image. Platforms can apply an
AI-generated-content label from signals that have nothing to do with file metadata — their own
record of how an image was created, account history, a partner's disclosure, or classifiers running
on the pixels themselves. No metadata tool can reach any of that, and this one does not claim to.

It also does not fabricate metadata, invent camera or creator fields, forge Content Credentials, or
alter pixels to influence a classifier. There is no code path for any of those.

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer

`sharp` ships prebuilt binaries for common platforms, so no native toolchain is needed for a normal
install.

## Getting started

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

The app runs at http://localhost:3000.

## Scripts

| Command             | What it does                              |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Development server with hot reload        |
| `npm run build`     | Production build (also type-checks)       |
| `npm run start`     | Serve the production build                |
| `npm run lint`      | ESLint                                    |
| `npm run typecheck` | `tsc --noEmit`                            |
| `npm test`          | Vitest, including the real image pipeline |
| `npm run format`    | Prettier                                  |

## Environment variables

Every operational limit is read from the environment in `lib/config.ts` and nowhere else.

| Variable                         | Default                 | Purpose                                                                  |
| -------------------------------- | ----------------------- | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_APP_URL`            | `http://localhost:3000` | Canonical URLs, sitemap, Open Graph                                      |
| `NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB` | `25`                    | Limit shown in the UI and enforced client-side                           |
| `MAX_UPLOAD_SIZE_MB`             | `25`                    | Authoritative server-side limit                                          |
| `PROCESSING_TIMEOUT_MS`          | `30000`                 | Hard ceiling on one image's processing time                              |
| `TEMP_FILE_TTL_SECONDS`          | `300`                   | How long an in-flight job may hold memory before the sweeper releases it |
| `RATE_LIMIT_REQUESTS`            | `20`                    | Requests allowed per window, per client                                  |
| `RATE_LIMIT_WINDOW_SECONDS`      | `60`                    | Length of the rate-limit window                                          |
| `MAX_IMAGE_MEGAPIXELS`           | `100`                   | Decompression-bomb guard, applied before decoding                        |
| `NEXT_PUBLIC_ENABLE_ANALYTICS`   | `false`                 | Event-only analytics, off unless enabled                                 |

Both size variables exist because the client needs to know the limit in order to reject a file
without uploading it, while the server needs a value the client cannot influence. Set them to the
same number.

`.env.local` is gitignored. There are no secrets to configure.

## Architecture

```
app/
  page.tsx                 Landing page (the tool is the hero)
  how-it-works/  privacy/  faq/  terms/
  api/process/route.ts     The only endpoint
components/                UI, one concern per file
lib/
  config.ts                All limits, read from env exactly once
  image/
    metadata.ts            Container parser — runs in both browser and server
    processor.ts           Decode, strip, re-encode (sharp)
    validation.ts          Magic bytes, size, options, filename safety
    errors.ts              User-facing failure copy
  security/
    rate-limit.ts          Fixed-window limiter, in memory
    cleanup.ts             Job lifecycle and buffer release
  analytics/events.ts      Event-only, inert by default
types/image.ts             Shared vocabulary
tests/                     Pipeline, parser, security and API tests
```

There is no database. The application is stateless by design; if accounts or persistent analytics
are added later, they can be introduced without touching the processing path.

### Image processing

`lib/image/metadata.ts` is a dependency-free container parser. It reads the _structure_ of a file —
which segments exist, how big they are, what category of information each holds — and never reads a
tag's value. That is why it can run in the browser to produce the pre-upload report, and why the
report says "location metadata detected" rather than printing coordinates.

`lib/image/processor.ts` decodes with sharp and re-encodes from the pixels alone. Removal is
therefore the default rather than a list of things to delete: auxiliary segments simply are not
copied forward. Two details are deliberate:

- **Orientation is applied before the tag is dropped.** EXIF orientation lives in a tag, not in the
  pixels, so naively stripping metadata is what makes a cleaned photo come back sideways.
- **Colour profiles are normalised, not discarded.** An ICC profile describes how to render pixels.
  Dropping it would visibly shift a wide-gamut image, so the default converts to sRGB and attaches
  the standard profile, which carries nothing about the user. `colorProfile: "strip"` removes it
  entirely if you prefer.

The report is then generated by **re-inspecting the output bytes**, not by listing what the encoder
was asked to drop. If it says a category was removed, it is absent from the file you download.

Formats: JPEG, PNG, WebP. The pipeline is format-agnostic — adding one means adding a branch in the
encoder switch and a parser case, not changing the architecture.

### Privacy architecture

Most of the privacy properties come from things the application does not have.

- **Nothing is written to disk.** There is no upload directory, no temp file, no object store and no
  database. An image exists as a `Buffer` inside one request.
- **The cleaned image is the response body.** No download URL is created, so none can be guessed,
  shared by accident, or left to expire.
- **Buffers are released on every path.** `releaseJob` overwrites and drops them in a `finally`
  block — on success, on a rejected file type, on a decoder error, and on timeout. A sweeper
  force-releases anything that outlives its TTL.
- **Nothing about an image is logged.** No bytes, filenames, metadata values, hashes or URLs.
- **No third-party AI service is involved.** Processing is libvips on your own server.

### Security

- Format is decided by **magic bytes**, never by the filename, extension, or the MIME type the
  browser attaches. A declared type that contradicts the bytes is rejected rather than corrected.
- Size is checked from `Content-Length`, then from the part, then from the buffer.
- `limitInputPixels` refuses decompression bombs before pixel memory is allocated.
- Processing has a hard deadline, enforced both inside libvips and by an outer race, so a wedged
  decode returns an explanation instead of hanging.
- Filenames are reduced to a basename and passed through an ASCII allowlist before being echoed in
  `Content-Disposition`, which rules out path traversal and header injection. No user-supplied
  string ever reaches the filesystem, because nothing touches the filesystem.
- Per-client rate limiting, keyed on a non-reversible hash of the address.
- Cross-origin form posts are rejected when the browser declares an origin.
- CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP,
  CORP and HSTS are set in `next.config.ts`. API responses are `no-store`.

CSRF needs no token here: the endpoint is unauthenticated and stateless, so there is no user context
an attacker could act within. The origin check is defence in depth.

## API

### `POST /api/process`

`multipart/form-data`:

| Field              | Required | Notes                                           |
| ------------------ | -------- | ----------------------------------------------- |
| `file`             | yes      | JPG, PNG or WebP                                |
| `quality`          | no       | 60–100, default 92. Ignored for lossless output |
| `applyOrientation` | no       | `true` (default) or `false`                     |
| `colorProfile`     | no       | `srgb` (default) or `strip`                     |

**Success — 200.** The body is the cleaned image. The summary travels in the `X-Clean-Report`
header as base64-encoded JSON:

```json
{
  "success": true,
  "filename": "photo-clean.jpg",
  "mimeType": "image/jpeg",
  "originalSize": 3981201,
  "processedSize": 3512900,
  "width": 1536,
  "height": 2048,
  "format": "jpeg",
  "metadataDetected": ["exif", "gps", "camera", "software"],
  "metadataRemoved": ["exif", "gps", "camera", "software"],
  "metadataRetained": [],
  "metadataBytesBefore": 24518,
  "metadataBytesAfter": 0,
  "losslessReencode": false,
  "orientationApplied": true,
  "processingMs": 210
}
```

The file is returned directly rather than behind a link. A download URL would mean the cleaned image
has to exist somewhere addressable for some period, which is precisely what this product promises
not to do.

```bash
curl -X POST -F "file=@photo.jpg" http://localhost:3000/api/process -o clean.jpg -D headers.txt
```

**Errors** are JSON with a stable `code`: `no_file`, `unsupported_type`, `too_large`, `empty_file`,
`corrupt_image`, `too_many_pixels`, `timeout`, `rate_limited`, `bad_request`, `server_error`.
Internal details and stack traces are never returned.

`GET /api/process` reports the endpoint's limits without requiring an upload.

## Testing

```bash
npm test
```

The suite tests the real pipeline, not just components. Fixtures are generated at runtime — real
JPEG, PNG and WebP files with real EXIF, GPS, XMP, C2PA and PNG text chunks — so nobody has to trust
an opaque binary in the repository. Covered: parser correctness for each format, metadata removal
verified by re-reading the output, lossless PNG and WebP round-trips proved by comparing raw pixels,
orientation handling, corrupt and truncated input, malicious offsets and IFD loops, buffer release
on every path, filename sanitisation, rate limiting, and the API's success and failure responses.

## Deployment

The app is a standard Next.js application and deploys anywhere Next.js runs.

**It needs a Node.js runtime**, not an edge runtime: `sharp` is a native module. The processing
route sets `runtime = "nodejs"` explicitly.

Because nothing is written to disk, the usual serverless caveat about ephemeral filesystems does not
apply — there is no state to lose between invocations. What does need attention when scaling
horizontally:

- **Memory.** Each in-flight image occupies memory roughly proportional to its decoded size, which
  is much larger than its file size. Size instances against `MAX_UPLOAD_SIZE_MB` and
  `MAX_IMAGE_MEGAPIXELS` together, and lower them on small instances.
- **Rate limiting is per instance.** The limiter holds counters in process memory, so N instances
  permit N times the configured limit in aggregate. For a real fleet, enforce the limit at the edge
  (your CDN or load balancer) and keep this one as a backstop.
- **Request duration.** Large images on a slow instance can approach a platform's function timeout.
  Keep `PROCESSING_TIMEOUT_MS` comfortably below it so users get a clear message rather than a
  gateway error.
- **Body size limits.** Some platforms cap request bodies below 25 MB. Set
  `MAX_UPLOAD_SIZE_MB` to match, or uploads will fail at the platform layer before the app can
  produce a useful error.

A long-running Node process (a container, a VM) is the simplest fit: it avoids cold-start cost on a
native module and makes the in-memory rate limiter behave as intended.

## Troubleshooting

**`Cannot find native binding` when running tests.** npm sometimes skips optional platform
dependencies. Remove `node_modules` and `package-lock.json` and reinstall.

**sharp fails to load after deploying.** The prebuilt binary is platform-specific. Install
dependencies on the target platform, or in the same container image you deploy.

**The cleaned JPEG is larger than the original.** Expected. The original was probably saved with
aggressive chroma subsampling; re-encoding at quality 92 with full colour resolution avoids adding
visible damage and can cost bytes. Lower the quality slider if size matters more.

**A cleaned photo appears rotated.** It should not — orientation is applied to the pixels before the
tag is dropped. If it happens, the input's orientation tag disagrees with its pixels; open an issue
with the format and dimensions, not the image.

**Everything returns 429 in development.** The rate limiter counts every request in the window.
Raise `RATE_LIMIT_REQUESTS` in `.env.local`.
# ai-remove-pilot
