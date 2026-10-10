# Screenshot API

A scalable, high-performance screenshot rendering API built with **Fastify**, **Playwright**, and **Satori**. It supports capturing screenshots of websites (via browser automation) and rendering HTML/JSX strings to images (via Satori).

## Features

- 🚀 **Fastify-powered**: High performance and low overhead.
- 🌐 **Website Screenshots**: Powered by Playwright for accurate browser rendering.
- 🎨 **HTML/JSX Rendering**: Powered by Satori for ultra-fast component-to-image conversion.
- 🧵 **Browser Pooling**: Efficient resource management with a pool of browser instances.
- 🖼️ **Multi-Format Support**: Export to PNG, JPEG, or WebP.
- 🧩 **Element Capture**: Capture specific CSS selectors instead of the whole page.
- 📏 **Vertical Stitching**: Automatically stitch multiple captured elements into a single vertical image.
- 📦 **Docker Ready**: Easy deployment with Docker and Docker Compose.
- ⚡ **Rate Limiting**: Built-in protection against abuse.

---

## Getting Started

### Local Setup

1. **Install dependencies:**
   ```bash
   npm run setup
   ```
   This command installs npm packages and the required Playwright browser (Chromium).

2. **Run in development mode:**
   ```bash
   npm run dev
   ```

3. **Build and start for production:**
   ```bash
   npm run build
   npm start
   ```

### Docker Setup

1. **Build the image:**
   ```bash
   npm run docker:build
   ```

2. **Run the container:**
   ```bash
   npm run docker:run
   ```

Alternatively, use **Docker Compose**:
```bash
docker-compose up -d
```

---

## API Routes

### 1. Health Check
`GET /health`

Returns the status of the API.
```json
{
  "status": "ok",
  "ts": 1728556800000
}
```

---

### 2. Website Screenshot
`POST /screenshot/website` or `POST /screenshot/playwright`

Captures a screenshot of a live website using Playwright.

#### Request Body (JSON)
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `url` | `string` | **Required** | The URL to capture. Protocol is optional. |
| `selector` | `string` | - | CSS selector of a specific element to capture. |
| `width` | `number` | `1280` | Viewport width. |
| `height` | `number` | `800` | Viewport height. |
| `fullPage` | `boolean` | `false` | Capture the full scrollable page. |
| `format` | `string` | `png` | `png`, `jpeg`, or `webp`. |
| `quality` | `number` | `90` | Image quality (1-100). |
| `limit` | `number` | - | Max number of elements to capture if using a selector. |
| `returnType` | `string` | `image` | `image` (binary) or `url` (JSON with storage URL). |
| `waitUntil` | `string` | `load` | `domcontentloaded`, `load`, or `networkidle`. |
| `waitFor` | `string` | - | CSS selector to wait for before capturing. |
| `waitMs` | `number` | `0` | Delay in ms before capturing (max 30000). |
| `waitForImages`| `boolean` | `true` | Wait for all images in the target to decode. |
| `blockAds` | `boolean` | `true` | Block common ad scripts. |

---

### 3. HTML Rendering
`POST /screenshot/html`

Renders one or more HTML strings into an image using Satori. This is significantly faster than browser-based screenshots but supports a subset of CSS (Flexbox).

#### Request Body (JSON)
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `htmls` | `string[]` | **Required** | Array of HTML strings to render. |
| `width` | `number` | `1200` | Output width. |
| `height` | `number` | `630` | Output height. |
| `format` | `string` | `png` | `png`, `jpeg`, or `webp`. |
| `quality` | `number` | `90` | Image quality (1-100). |
| `returnType` | `string` | `image` | `image` (binary) or `url` (JSON with storage URL). |

*Note: If multiple HTML strings are provided, they will be stitched vertically into a single image.*

---

### 4. Delete Image
`DELETE /storage/:filename`

Deletes a previously saved image from the storage.

#### Path Parameters
- `filename`: The name of the file to delete (e.g., `abc-123.webp`).

#### Response
```json
{
  "success": true,
  "message": "File abc-123.webp deleted"
}
```

---

## Configuration

Environment variables can be set in a `.env` file:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | The port the server listens on. |
| `NODE_ENV` | `development` | Environment mode (`development` or `production`). |

---

## Storage
When `returnType` is set to `url`, images are saved in the `/storage` directory and served at `http://localhost:3000/storage/{filename}`. Ensure this directory is writable.

## License
MIT
