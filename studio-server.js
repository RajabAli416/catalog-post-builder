// server.ts
import "dotenv/config";
import express from "express";
import multer from "multer";
import path5 from "path";

// src/server/repository.ts
import path2 from "path";

// src/server/stateStore.ts
import fs from "fs";
import path from "path";

// src/server/requestContext.ts
import { AsyncLocalStorage } from "node:async_hooks";
var storage = new AsyncLocalStorage();
function runAsUser(userId, fn) {
  return storage.run({ userId }, fn);
}
function currentUserId() {
  const userId = storage.getStore()?.userId;
  if (!userId) {
    throw new Error("Sign in required.");
  }
  return userId;
}

// src/server/stateStore.ts
var LOCAL_DIR = path.resolve(process.cwd(), ".studio-data");
var LEGACY_LOCAL_FILE = path.join(LOCAL_DIR, "studio-db.json");
var EPHEMERAL_DIR = path.join("/tmp", "atelier-studio");
var LEGACY_BLOB_PATH = "studio/studio-db.json";
function safeUserId(userId) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    throw new Error("Invalid user.");
  }
  return userId;
}
function createEmptyState() {
  return {
    aiMode: "live",
    projects: [],
    products: [],
    shoots: [],
    generatedImages: [],
    postDrafts: []
  };
}
function getStorageMode() {
  if (process.env.VERCEL && process.env.BLOB_READ_WRITE_TOKEN) return "vercel-blob";
  if (process.env.VERCEL) return "ephemeral";
  return "local-disk";
}
function isLegacyDemoState(state) {
  return state.projects.some(
    (project) => project.id === "proj-autumn-festive" || project.id === "proj-heritage-silk"
  );
}
function cleanPlaceholderLabels(state) {
  const cannedFabric = "High-Resolution Garment Plate \xB7 Ready for Gemini Vision Analysis";
  const skuByProduct = /* @__PURE__ */ new Map();
  const products = state.products.map((product, index) => {
    const fakeSku = /^AN-26-\d+$/.test(product.sku);
    const sku = fakeSku ? product.name || `Piece ${index + 1}` : product.sku;
    if (fakeSku) skuByProduct.set(product.id, sku);
    return {
      ...product,
      sku,
      fabricDetails: product.fabricDetails === cannedFabric ? "Uploaded garment" : product.fabricDetails
    };
  });
  return {
    ...state,
    products,
    shoots: state.shoots.map((shoot) => {
      const sku = skuByProduct.get(shoot.productId);
      return sku ? { ...shoot, productSku: sku } : shoot;
    }),
    generatedImages: state.generatedImages.map((image) => {
      const sku = skuByProduct.get(image.productId);
      return sku ? { ...image, productSku: sku } : image;
    })
  };
}
function normalizeState(parsed) {
  if (!parsed || !Array.isArray(parsed.projects)) return createEmptyState();
  if (isLegacyDemoState(parsed)) return createEmptyState();
  return cleanPlaceholderLabels({
    ...createEmptyState(),
    ...parsed,
    aiMode: "live",
    projects: parsed.projects || [],
    products: parsed.products || [],
    shoots: parsed.shoots || [],
    generatedImages: parsed.generatedImages || [],
    postDrafts: parsed.postDrafts || []
  });
}
function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return createEmptyState();
  try {
    return normalizeState(JSON.parse(fs.readFileSync(filePath, "utf-8")));
  } catch {
    return createEmptyState();
  }
}
function writeJsonFile(filePath, state) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state), "utf-8");
}
function stateHasContent(state) {
  return state.projects.length > 0 || state.products.length > 0 || state.shoots.length > 0 || state.generatedImages.length > 0 || state.postDrafts.length > 0;
}
function userLocalFile(userId) {
  return path.join(LOCAL_DIR, "users", safeUserId(userId), "studio-db.json");
}
function userEphemeralFile(userId) {
  return path.join(EPHEMERAL_DIR, "users", safeUserId(userId), "studio-db.json");
}
function userBlobPath(userId) {
  return `studio/${safeUserId(userId)}/studio-db.json`;
}
async function readBlobJson(blobPath) {
  const { get } = await import("@vercel/blob");
  let result;
  try {
    result = await get(blobPath, { access: "private", useCache: false });
  } catch {
    return null;
  }
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const raw = await new Response(result.stream).text();
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function writeBlobJson(blobPath, value) {
  const { put } = await import("@vercel/blob");
  await put(blobPath, JSON.stringify(value), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0
  });
}
async function readUserState(userId) {
  const mode = getStorageMode();
  if (mode === "local-disk") return readJsonFile(userLocalFile(userId));
  if (mode === "ephemeral") return readJsonFile(userEphemeralFile(userId));
  const parsed = await readBlobJson(userBlobPath(userId));
  if (!parsed) return createEmptyState();
  return normalizeState(parsed);
}
async function writeUserState(userId, state) {
  const mode = getStorageMode();
  if (mode === "local-disk") {
    writeJsonFile(userLocalFile(userId), state);
    return;
  }
  if (mode === "ephemeral") {
    writeJsonFile(userEphemeralFile(userId), state);
    return;
  }
  await writeBlobJson(userBlobPath(userId), state);
}
async function readLegacyState() {
  const mode = getStorageMode();
  if (mode === "local-disk") return readJsonFile(LEGACY_LOCAL_FILE);
  if (mode === "ephemeral") return createEmptyState();
  const parsed = await readBlobJson(LEGACY_BLOB_PATH);
  if (!parsed) return createEmptyState();
  return normalizeState(parsed);
}
function contentKey(state) {
  return JSON.stringify({
    projects: state.projects,
    products: state.products,
    shoots: state.shoots,
    generatedImages: state.generatedImages,
    postDrafts: state.postDrafts
  });
}
function studioStateReferencesMedia(state, pathname) {
  const encoded = encodeURIComponent(pathname);
  const serialized = JSON.stringify(state);
  return serialized.includes(pathname) || serialized.includes(encoded);
}
async function loadStudioState() {
  const userId = currentUserId();
  const own = await readUserState(userId);
  if (!stateHasContent(own)) return own;
  const legacy = await readLegacyState();
  if (stateHasContent(legacy) && contentKey(own) === contentKey(legacy)) {
    const empty = createEmptyState();
    await writeUserState(userId, empty);
    return empty;
  }
  return own;
}
async function saveStudioState(state) {
  const next = { ...state, aiMode: "live" };
  await writeUserState(currentUserId(), next);
}

// src/server/repository.ts
var DATA_DIR = path2.resolve(process.cwd(), ".studio-data");
var UPLOADS_DIR = path2.join(DATA_DIR, "uploads");
var LocalFileStudioRepository = class {
  constructor() {
    this.state = createEmptyState();
    this.hydrated = false;
    this.chain = Promise.resolve();
  }
  async ensure() {
    if (getStorageMode() === "local-disk" && this.hydrated) return;
    this.state = await loadStudioState();
    this.state.aiMode = "live";
    this.hydrated = true;
  }
  async commit() {
    this.state.aiMode = "live";
    await saveStudioState(this.state);
  }
  async transaction(write, fn) {
    const run = this.chain.then(async () => {
      await this.ensure();
      const result = await fn();
      if (write) await this.commit();
      return result;
    });
    this.chain = run.then(
      () => void 0,
      () => void 0
    );
    return run;
  }
  async getState() {
    return this.transaction(false, () => this.state);
  }
  async getAiMode() {
    return this.transaction(false, () => "live");
  }
  async setAiMode(_mode) {
    return this.transaction(true, () => {
      this.state.aiMode = "live";
      return "live";
    });
  }
  async listProjects() {
    return this.transaction(false, () => this.state.projects);
  }
  async getProject(id) {
    return this.transaction(false, () => this.state.projects.find((p) => p.id === id) || null);
  }
  async createProject(project) {
    return this.transaction(true, () => {
      this.state.projects = [project, ...this.state.projects.filter((p) => p.id !== project.id)];
      return project;
    });
  }
  async deleteProject(id) {
    return this.transaction(true, () => {
      const before = this.state.projects.length;
      this.state.projects = this.state.projects.filter((p) => p.id !== id);
      if (this.state.projects.length === before) return false;
      const removedProducts = new Set(
        this.state.products.filter((p) => p.projectId === id).map((p) => p.id)
      );
      this.state.products = this.state.products.filter((p) => p.projectId !== id);
      this.state.shoots = this.state.shoots.filter((s) => s.projectId !== id);
      this.state.generatedImages = this.state.generatedImages.filter((img) => img.projectId !== id);
      this.state.postDrafts = this.state.postDrafts.filter(
        (post) => post.projectId !== id && !removedProducts.has(post.productId)
      );
      return true;
    });
  }
  async updateProject(id, patch) {
    return this.transaction(true, () => {
      const idx = this.state.projects.findIndex((p) => p.id === id);
      if (idx === -1) return null;
      this.state.projects[idx] = {
        ...this.state.projects[idx],
        ...patch,
        updatedAt: patch.updatedAt || "Just now"
      };
      return this.state.projects[idx];
    });
  }
  async listProducts(projectId) {
    return this.transaction(false, () => {
      if (!projectId) return this.state.products;
      return this.state.products.filter((p) => p.projectId === projectId);
    });
  }
  async getProduct(id) {
    return this.transaction(false, () => this.state.products.find((p) => p.id === id) || null);
  }
  async createProducts(newProducts) {
    return this.transaction(true, () => {
      this.state.products = [...newProducts, ...this.state.products];
      return newProducts;
    });
  }
  async updateProduct(id, patch) {
    return this.transaction(true, () => {
      const idx = this.state.products.findIndex((p) => p.id === id);
      if (idx === -1) return null;
      this.state.products[idx] = { ...this.state.products[idx], ...patch };
      return this.state.products[idx];
    });
  }
  async saveGarmentAnalysis(productId, analysis) {
    return this.updateProduct(productId, { garmentAnalysis: analysis });
  }
  async listShoots(productId) {
    return this.transaction(false, () => {
      if (!productId) return this.state.shoots;
      return this.state.shoots.filter((s) => s.productId === productId);
    });
  }
  async getShoot(id) {
    return this.transaction(false, () => this.state.shoots.find((s) => s.id === id) || null);
  }
  async createShoot(shoot) {
    return this.transaction(true, () => {
      this.state.shoots = [shoot, ...this.state.shoots];
      const proj = this.state.projects.find((p) => p.id === shoot.projectId);
      if (proj && !proj.shootIds.includes(shoot.id)) {
        proj.shootIds.push(shoot.id);
        proj.updatedAt = "Just now";
      }
      return shoot;
    });
  }
  async updateShoot(id, patch) {
    return this.transaction(true, () => {
      const idx = this.state.shoots.findIndex((s) => s.id === id);
      if (idx === -1) return null;
      this.state.shoots[idx] = { ...this.state.shoots[idx], ...patch };
      return this.state.shoots[idx];
    });
  }
  async listGeneratedImages(shootId) {
    return this.transaction(false, () => {
      if (!shootId) return this.state.generatedImages;
      return this.state.generatedImages.filter((img) => img.shootId === shootId);
    });
  }
  async getGeneratedImage(id) {
    return this.transaction(
      false,
      () => this.state.generatedImages.find((img) => img.id === id) || null
    );
  }
  async createGeneratedImage(image) {
    return this.transaction(true, () => {
      this.state.generatedImages = [image, ...this.state.generatedImages];
      const shoot = this.state.shoots.find((s) => s.id === image.shootId);
      if (shoot) {
        shoot.images = [image, ...shoot.images.filter((i) => i.id !== image.id)];
      }
      return image;
    });
  }
  async updateGeneratedImage(id, patch) {
    return this.transaction(true, () => {
      const idx = this.state.generatedImages.findIndex((img) => img.id === id);
      if (idx === -1) return null;
      const updated = { ...this.state.generatedImages[idx], ...patch };
      this.state.generatedImages[idx] = updated;
      const shoot = this.state.shoots.find((s) => s.id === updated.shootId);
      if (shoot) {
        shoot.images = shoot.images.map((i) => i.id === id ? updated : i);
      }
      return updated;
    });
  }
  async deleteGeneratedImage(id) {
    return this.transaction(true, () => {
      const target = this.state.generatedImages.find((img) => img.id === id);
      if (!target) return false;
      this.state.generatedImages = this.state.generatedImages.filter((img) => img.id !== id);
      const shoot = this.state.shoots.find((s) => s.id === target.shootId);
      if (shoot) {
        shoot.images = shoot.images.filter((i) => i.id !== id);
      }
      return true;
    });
  }
  async listPosts() {
    return this.transaction(false, () => this.state.postDrafts);
  }
  async createPost(post) {
    return this.transaction(true, () => {
      this.state.postDrafts = [post, ...this.state.postDrafts];
      return post;
    });
  }
  async updatePost(id, patch) {
    return this.transaction(true, () => {
      const idx = this.state.postDrafts.findIndex((p) => p.id === id);
      if (idx === -1) return null;
      this.state.postDrafts[idx] = {
        ...this.state.postDrafts[idx],
        ...patch,
        updatedAt: "Just now"
      };
      return this.state.postDrafts[idx];
    });
  }
  async deletePost(id) {
    return this.transaction(true, () => {
      const before = this.state.postDrafts.length;
      this.state.postDrafts = this.state.postDrafts.filter((p) => p.id !== id);
      return this.state.postDrafts.length < before;
    });
  }
};
var studioRepository = new LocalFileStudioRepository();

// src/server/geminiService.ts
import fs3 from "fs";
import path4 from "path";
import { GoogleGenAI, Type } from "@google/genai";

// src/server/mediaStore.ts
import fs2 from "fs";
import path3 from "path";
function extensionForMime(mimeType) {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("pdf")) return "pdf";
  return "jpg";
}
function mediaPathForUser(pathname, userId) {
  if (!pathname.startsWith("media/") || pathname.includes("..") || pathname.includes("\\")) {
    return false;
  }
  return pathname.startsWith(`media/${userId}/`);
}
function diskPathForMedia(pathname) {
  if (!pathname.startsWith("media/") || pathname.includes("..") || pathname.includes("\\")) {
    return null;
  }
  const relative = pathname.slice("media/".length);
  const resolved = path3.resolve(UPLOADS_DIR, relative);
  const root = path3.resolve(UPLOADS_DIR);
  if (resolved !== root && !resolved.startsWith(root + path3.sep)) return null;
  return resolved;
}
async function readStoredMedia(pathname) {
  const mode = getStorageMode();
  if (mode === "vercel-blob") {
    const { get } = await import("@vercel/blob");
    const result = await get(pathname, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
    return {
      bytes,
      contentType: result.blob.contentType || "application/octet-stream"
    };
  }
  const diskPath = diskPathForMedia(pathname);
  if (!diskPath || !fs2.existsSync(diskPath)) return null;
  const ext = path3.extname(diskPath).toLowerCase();
  const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".pdf" ? "application/pdf" : "image/jpeg";
  return { bytes: fs2.readFileSync(diskPath), contentType };
}
async function storeMediaBuffer(buffer, mimeType, prefix) {
  const mode = getStorageMode();
  const userId = currentUserId();
  const ext = extensionForMime(mimeType);
  const fileName = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
  const pathname = `media/${userId}/${fileName}`;
  if (mode === "vercel-blob") {
    const { put } = await import("@vercel/blob");
    await put(pathname, buffer, {
      access: "private",
      addRandomSuffix: false,
      contentType: mimeType
    });
    return `/api/media?pathname=${encodeURIComponent(pathname)}`;
  }
  if (mode === "ephemeral") {
    throw new Error(
      "Image storage is not configured on Vercel. Open the project Storage tab, create a Blob store, then redeploy. Vercel will set BLOB_READ_WRITE_TOKEN automatically."
    );
  }
  const filePath = diskPathForMedia(pathname);
  if (!filePath) {
    throw new Error("Could not store this image.");
  }
  fs2.mkdirSync(path3.dirname(filePath), { recursive: true });
  fs2.writeFileSync(filePath, buffer);
  return `/api/media?pathname=${encodeURIComponent(pathname)}`;
}

// src/server/geminiService.ts
function getGeminiConfig() {
  const rawKey = process.env.GEMINI_API_KEY || "";
  const hasValidKey = Boolean(
    rawKey && rawKey.trim() !== "" && rawKey !== "MY_GEMINI_API_KEY" && rawKey !== "YOUR_API_KEY"
  );
  return {
    apiKey: rawKey,
    hasValidKey,
    imageModel: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-lite-image",
    visionModel: process.env.GEMINI_VISION_MODEL || "gemini-3.8-flash",
    textModel: process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash"
  };
}
function createGeminiClient() {
  const { apiKey, hasValidKey } = getGeminiConfig();
  if (!hasValidKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add it in the Vercel project environment variables, then redeploy."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
var TEXT_MODEL_FALLBACKS = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite"];
function geminiErrorText(err) {
  return err instanceof Error ? err.message : String(err);
}
function isZeroFreeTierQuota(err) {
  const message = geminiErrorText(err);
  return /free_tier/i.test(message) && /limit:\s*0/.test(message);
}
function isTemporaryCapacityError(err) {
  if (isZeroFreeTierQuota(err)) return false;
  return /503|UNAVAILABLE|high demand|overloaded/i.test(geminiErrorText(err));
}
var GeminiRateLimitError = class extends Error {
  constructor(retryAfterMs) {
    const seconds = Math.ceil(retryAfterMs / 1e3);
    super(`Gemini is limiting new images. This shot continues automatically in ${seconds} seconds.`);
    this.name = "GeminiRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
};
function isPrepaidCreditsDepleted(err) {
  return /prepayment credits are depleted|code"\s*:\s*402/i.test(geminiErrorText(err));
}
function isRateLimitError(err) {
  if (isZeroFreeTierQuota(err) || isPrepaidCreditsDepleted(err)) return false;
  return /429|RESOURCE_EXHAUSTED|quota exceeded/i.test(geminiErrorText(err));
}
function parseRetryAfterMs(message) {
  const match = message.match(/retry in ([0-9.]+)\s*s/i) || message.match(/retryDelay"\s*:\s*"([0-9.]+)s/i);
  const seconds = match ? Number(match[1]) : 45;
  const ms = Math.ceil(seconds * 1e3) + 2e3;
  return Math.min(Math.max(ms, 15e3), 12e4);
}
function toUserFacingGeminiError(err) {
  const message = geminiErrorText(err);
  if (isPrepaidCreditsDepleted(err)) {
    return new Error(
      "Gemini prepaid credits are used up, so image generation cannot start. In AI Studio, open the project billing page and buy credits, then retry the shoot."
    );
  }
  if (isZeroFreeTierQuota(err)) {
    const imageModel = /image/i.test(message);
    return new Error(
      imageModel ? "Image generation is not included on the free Gemini plan. In Google AI Studio, open the project for this API key and turn on billing, then retry the shoot." : "This Gemini model is not included on the free plan. In Google AI Studio, turn on billing for this API key, then try again."
    );
  }
  if (isTemporaryCapacityError(err)) {
    return new Error("Gemini is busy right now. Wait about a minute, then retry the shoot.");
  }
  if (isRateLimitError(err)) {
    const retryMatch = message.match(/retry in ([0-9.]+)\s*s/i) || message.match(/retryDelay"\s*:\s*"([0-9.]+)s/i);
    const retrySeconds = retryMatch ? Number(retryMatch[1]) : 45;
    const dailyQuota = /per\s*day|perday/i.test(message);
    if (dailyQuota && retrySeconds > 180) {
      return new Error(
        "The daily Gemini image quota for this key is used up. Try the shoot again after the quota resets."
      );
    }
    console.error("Gemini rate limit:", message);
    return new GeminiRateLimitError(parseRetryAfterMs(message));
  }
  return err instanceof Error ? err : new Error("Gemini request failed.");
}
async function generateContentWithFallback(ai, primaryModel, fallbacks, request) {
  const models = [primaryModel, ...fallbacks.filter((model) => model !== primaryModel)];
  let lastError;
  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    const attempts = index === 0 ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await ai.models.generateContent({
          model,
          contents: request.contents,
          config: request.config
        });
      } catch (err) {
        lastError = err;
        if (isRateLimitError(err) || isZeroFreeTierQuota(err) || !isTemporaryCapacityError(err)) {
          throw toUserFacingGeminiError(err);
        }
        if (attempt === 0 && attempts > 1) {
          await new Promise((resolve) => setTimeout(resolve, 2e3));
        }
      }
    }
  }
  throw toUserFacingGeminiError(lastError);
}
async function resolveImageToBase64(imageUrlOrPath) {
  if (!imageUrlOrPath) {
    throw new Error("This product has no garment reference image to send to Gemini.");
  }
  if (imageUrlOrPath.startsWith("data:")) {
    const match = imageUrlOrPath.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return { mimeType: match[1], data: match[2] };
    }
  }
  if (imageUrlOrPath.startsWith("http://") || imageUrlOrPath.startsWith("https://")) {
    const response = await fetch(imageUrlOrPath);
    if (!response.ok) {
      throw new Error("Could not read the stored garment image.");
    }
    const mimeType2 = (response.headers.get("content-type") || "image/jpeg").split(";")[0];
    const buffer2 = Buffer.from(await response.arrayBuffer());
    return { data: buffer2.toString("base64"), mimeType: mimeType2 };
  }
  if (imageUrlOrPath.startsWith("/api/media?")) {
    const pathname = new URLSearchParams(imageUrlOrPath.slice("/api/media?".length)).get("pathname") || "";
    if (!pathname.startsWith("media/") || pathname.includes("..")) {
      throw new Error("Garment reference image is missing from storage.");
    }
    const stored = await readStoredMedia(pathname);
    if (!stored) {
      throw new Error("Garment reference image is missing from storage.");
    }
    const mimeType2 = stored.contentType.split(";")[0] || "image/jpeg";
    return { data: stored.bytes.toString("base64"), mimeType: mimeType2 };
  }
  let diskPath = "";
  if (imageUrlOrPath.startsWith("/uploads/")) {
    diskPath = path4.join(UPLOADS_DIR, path4.basename(imageUrlOrPath));
  } else if (imageUrlOrPath.startsWith("/src/")) {
    diskPath = path4.join(process.cwd(), imageUrlOrPath.replace(/^\//, ""));
  }
  if (!diskPath || !fs3.existsSync(diskPath)) {
    throw new Error("Garment reference image is missing from storage.");
  }
  const buffer = fs3.readFileSync(diskPath);
  const ext = path4.extname(diskPath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return {
    data: buffer.toString("base64"),
    mimeType
  };
}
async function extractEmbeddedJpegsFromPdfBuffer(pdfBuffer) {
  const savedUrls = [];
  const soi = Buffer.from([255, 216, 255]);
  const eoi = Buffer.from([255, 217]);
  let offset = 0;
  while (offset < pdfBuffer.length && savedUrls.length < 6) {
    const start = pdfBuffer.indexOf(soi, offset);
    if (start === -1) break;
    const end = pdfBuffer.indexOf(eoi, start + 3);
    if (end === -1) break;
    const length = end + 2 - start;
    if (length > 12 * 1024 && length < 12 * 1024 * 1024) {
      const jpgBuf = pdfBuffer.subarray(start, end + 2);
      const url = await storeMediaBuffer(Buffer.from(jpgBuf), "image/jpeg", "pdf-plate");
      savedUrls.push(url);
    }
    offset = end + 2;
  }
  return savedUrls;
}
async function extractCatalogueProductsServer(params) {
  const { projectId, sourceType, uploadedFiles } = params;
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const imageFiles = uploadedFiles.filter((f) => f.mimeType.startsWith("image/"));
  const pdfFile = uploadedFiles.find(
    (f) => f.mimeType === "application/pdf" || f.originalName.toLowerCase().endsWith(".pdf")
  );
  let extractedPlateUrls = imageFiles.map((f) => f.publicUrl).filter(Boolean);
  const pdfBuffer = pdfFile?.buffer;
  if (pdfBuffer && pdfBuffer.length > 0) {
    const embeddedJpegs = await extractEmbeddedJpegsFromPdfBuffer(pdfBuffer);
    if (embeddedJpegs.length > 0) {
      extractedPlateUrls = [...extractedPlateUrls, ...embeddedJpegs];
    }
    const { visionModel } = getGeminiConfig();
    if (pdfBuffer.length < 18 * 1024 * 1024) {
      try {
        const ai = createGeminiClient();
        const response = await generateContentWithFallback(ai, visionModel, TEXT_MODEL_FALLBACKS, {
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: pdfBuffer.toString("base64")
                }
              },
              {
                text: `You are analyzing a fashion clothing catalogue PDF.
Identify all individual clothing/garment products shown across the pages. Do NOT blindly treat every page as one product: skip cover/index pages, and if a page has multiple garments, list each garment separately.
Return a JSON array of detected garments with sku, name, category, fabricDetails, rawCatalogueText, and sourcePage.`
              }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sku: { type: Type.STRING },
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  fabricDetails: { type: Type.STRING },
                  rawCatalogueText: { type: Type.STRING },
                  sourcePage: { type: Type.INTEGER }
                },
                required: ["sku", "name", "category", "fabricDetails", "rawCatalogueText", "sourcePage"]
              }
            }
          }
        });
        const parsed = JSON.parse(response.text || "[]");
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (extractedPlateUrls.length === 0) {
            throw new Error(
              "Gemini found garments, but this PDF has no embedded photos to use as references. Upload garment images instead."
            );
          }
          const products = parsed.map((item, idx) => {
            const imgUrl = extractedPlateUrls[idx % Math.max(1, extractedPlateUrls.length)] || "";
            const pageNum = Number(item.sourcePage) || idx + 1;
            return {
              id: `prod-${Date.now()}-${idx + 1}`,
              projectId,
              sku: String(item.sku || `Piece ${idx + 1}`),
              name: String(item.name || `Catalogue Piece 0${idx + 1}`),
              category: String(item.category || "Luxury Pret"),
              fabricDetails: String(item.fabricDetails || "Pure Woven Silk & Artisanal Embroidery"),
              rawCatalogueText: String(item.rawCatalogueText || ""),
              garmentImageUrl: imgUrl,
              referenceImage: imgUrl,
              sourcePage: pageNum,
              detectedPage: pageNum,
              garmentAnalysis: null,
              selected: true,
              createdAt: today,
              generatedCount: 0
            };
          });
          const pages = products.map((p, idx) => ({
            pageNumber: p.sourcePage,
            imageUrl: p.referenceImage,
            label: `Page 0${p.sourcePage} \u2014 ${p.name}`,
            detectedRegions: [
              {
                id: `reg-${idx + 1}`,
                label: p.name,
                sku: p.sku,
                cropBox: { x: 8, y: 6, width: 84, height: 86 }
              }
            ]
          }));
          return { products, pages };
        }
        throw new Error("No garments were detected in this catalogue PDF.");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Gemini could not read this catalogue PDF.";
        throw new Error(message);
      }
    } else {
      throw new Error("Catalogue PDF is larger than 18MB. Upload a smaller file.");
    }
  }
  if (imageFiles.length > 0) {
    const products = imageFiles.map((file, idx) => {
      const cleanBase = path4.basename(file.originalName, path4.extname(file.originalName)).replace(/[-_]+/g, " ");
      return {
        id: `prod-${Date.now()}-${idx + 1}`,
        projectId,
        sku: cleanBase.length > 3 ? cleanBase.slice(0, 40) : `Piece ${idx + 1}`,
        name: cleanBase.length > 3 ? cleanBase : `Garment ${idx + 1}`,
        category: "Uploaded garment",
        fabricDetails: "Uploaded garment photo",
        rawCatalogueText: `UPLOADED GARMENT FILE: ${file.originalName}. SOURCE PLATE #${idx + 1}.`,
        garmentImageUrl: file.publicUrl,
        referenceImage: file.publicUrl,
        sourcePage: idx + 1,
        detectedPage: idx + 1,
        garmentAnalysis: null,
        selected: true,
        createdAt: today,
        generatedCount: 0
      };
    });
    const pages = products.map((p, idx) => ({
      pageNumber: idx + 1,
      imageUrl: p.referenceImage,
      label: `Plate 0${idx + 1} \u2014 ${p.name}`
    }));
    return { products, pages };
  }
  throw new Error(
    sourceType === "Catalogue PDF" ? "Upload a catalogue PDF or garment images. Sample catalogues are no longer available." : "Upload at least one garment image."
  );
}
async function analyzeProductGarmentServer(product, aiMode) {
  void aiMode;
  const ai = createGeminiClient();
  const { visionModel } = getGeminiConfig();
  const { data: base64Image, mimeType } = await resolveImageToBase64(
    product.referenceImage || product.garmentImageUrl
  );
  const response = await generateContentWithFallback(ai, visionModel, TEXT_MODEL_FALLBACKS, {
    contents: {
      parts: [
        {
          inlineData: {
            mimeType,
            data: base64Image
          }
        },
        {
          text: `Analyze this Pakistani / South Asian fashion garment reference photograph in meticulous technical detail so a fashion photography AI can preserve every garment attribute accurately.
Extract structured JSON covering:
- garmentCategory
- shirtKameezDesign
- trousersShawlDupatta
- dominantColors (array of specific color descriptions)
- secondaryColors (array of accent/embroidery colors)
- printPattern
- embroidery
- neckline
- sleeves
- borders
- motifs
- fabricAppearance
- importantVisualDetails (array)
- immutableElements (array of critical garment details that must NEVER be altered during shoot generation)`
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          garmentCategory: { type: Type.STRING },
          shirtKameezDesign: { type: Type.STRING },
          trousersShawlDupatta: { type: Type.STRING },
          dominantColors: { type: Type.ARRAY, items: { type: Type.STRING } },
          secondaryColors: { type: Type.ARRAY, items: { type: Type.STRING } },
          printPattern: { type: Type.STRING },
          embroidery: { type: Type.STRING },
          neckline: { type: Type.STRING },
          sleeves: { type: Type.STRING },
          borders: { type: Type.STRING },
          motifs: { type: Type.STRING },
          fabricAppearance: { type: Type.STRING },
          importantVisualDetails: { type: Type.ARRAY, items: { type: Type.STRING } },
          immutableElements: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: [
          "garmentCategory",
          "shirtKameezDesign",
          "trousersShawlDupatta",
          "dominantColors",
          "secondaryColors",
          "printPattern",
          "embroidery",
          "neckline",
          "sleeves",
          "borders",
          "motifs",
          "fabricAppearance",
          "importantVisualDetails",
          "immutableElements"
        ]
      }
    }
  });
  const parsed = JSON.parse(response.text || "{}");
  return {
    garmentCategory: parsed.garmentCategory || product.category,
    shirtKameezDesign: parsed.shirtKameezDesign || product.name,
    trousersShawlDupatta: parsed.trousersShawlDupatta || "Matching tailored trousers",
    dominantColors: Array.isArray(parsed.dominantColors) ? parsed.dominantColors : ["Rich Jewel Tone"],
    secondaryColors: Array.isArray(parsed.secondaryColors) ? parsed.secondaryColors : ["Metallic Gold Zardozi"],
    printPattern: parsed.printPattern || "Woven textile surface",
    embroidery: parsed.embroidery || product.fabricDetails,
    neckline: parsed.neckline || "Embroidered portrait neckline",
    sleeves: parsed.sleeves || "Full sleeves with embroidered border",
    borders: parsed.borders || "Artisanal border detailing",
    motifs: parsed.motifs || "Traditional South Asian motifs",
    fabricAppearance: parsed.fabricAppearance || product.fabricDetails,
    importantVisualDetails: Array.isArray(parsed.importantVisualDetails) ? parsed.importantVisualDetails : ["Preserve neckline and cuff embroidery geometry"],
    immutableElements: Array.isArray(parsed.immutableElements) ? parsed.immutableElements : ["Exact colors, embroidery placement, and silhouette proportions"],
    analyzedAt: (/* @__PURE__ */ new Date()).toISOString(),
    modeUsed: "live"
  };
}
function buildMasterFashionPrompt(params) {
  const { product, analysis, config, shotType, customPromptOverride } = params;
  const shotSpecifications = {
    "Full body": {
      shotDesc: "full-body standing editorial photograph",
      poseDesc: "poised natural full-length stance showcasing complete garment silhouette from shoulder to hem",
      cameraDesc: "eye-level 50mm prime fashion photography",
      compDesc: "full garment, hemline, and trouser drape clearly visible"
    },
    "3/4 standing": {
      shotDesc: "three-quarter standing fashion editorial photograph",
      poseDesc: "natural 3/4 angled stance with relaxed shoulders and one hand gently poised",
      cameraDesc: "eye-level 85mm portrait lens framing from head to mid-calf",
      compDesc: "shirt silhouette, neckline embroidery, and sleeve cuff borders prominently visible"
    },
    Walking: {
      shotDesc: "dynamic walking motion editorial fashion photograph",
      poseDesc: "graceful mid-stride movement capturing natural fabric flow and drape",
      cameraDesc: "low-to-eye-level editorial tracking framing",
      compDesc: "full garment in fluid motion with crisp focus on embroidery"
    },
    Seated: {
      shotDesc: "seated luxury editorial fashion portrait",
      poseDesc: "seated gracefully on a minimalist architectural plinth with upright posture",
      cameraDesc: "medium-full editorial framing at eye level",
      compDesc: "garment drape, neckline, and sleeve borders clearly visible without bunching"
    },
    "Detail portrait": {
      shotDesc: "close-up 3/4 editorial beauty and garment craftsmanship portrait",
      poseDesc: "serene editorial expression angled toward directional key light",
      cameraDesc: "85mm macro-editorial portrait framing from chest/waist up",
      compDesc: "intricate neckline embroidery, sleeve cuff work, and fabric sheen as the primary focus"
    },
    "Back/side angle": {
      shotDesc: "three-quarter side profile fashion editorial photograph",
      poseDesc: "sculptural side-angle stance with head turned subtly toward camera",
      cameraDesc: "eye-level editorial profile framing",
      compDesc: "sleeve border, shoulder tailoring, and side slit drape clearly visible"
    },
    "Sleeve close-up": {
      shotDesc: "tight editorial close-up of the sleeve",
      poseDesc: "arm gently bent so the sleeve falls naturally without hiding the craft",
      cameraDesc: "macro fashion close-up, sharp on the sleeve surface",
      compDesc: "sleeve embroidery, fabric, and seam construction fill the frame"
    },
    "Neckline close-up": {
      shotDesc: "tight editorial close-up of the neckline",
      poseDesc: "shoulders relaxed, chin slightly lifted so the neckline sits undistorted",
      cameraDesc: "macro fashion close-up from the collarbone to the upper chest",
      compDesc: "neckline shape, embroidery, and edge finishing are the only subject"
    },
    "Embroidery close-up": {
      shotDesc: "macro close-up of the garment embroidery",
      poseDesc: "still pose that presents the embroidered panel flat to the lens",
      cameraDesc: "macro lens with shallow depth, focused on thread and motif",
      compDesc: "stitch texture, motif placement, and thread color fill the frame"
    },
    "Print / pattern close-up": {
      shotDesc: "macro close-up of the garment print or pattern",
      poseDesc: "fabric held or worn so the repeat lies flat and readable",
      cameraDesc: "straight-on macro framing of the printed surface",
      compDesc: "pattern scale, repeat, and color placement are clearly readable"
    },
    "Dupatta close-up": {
      shotDesc: "close-up of the dupatta drape and border",
      poseDesc: "dupatta falls naturally over one shoulder with the border visible",
      cameraDesc: "close editorial framing on the dupatta fabric and edge",
      compDesc: "dupatta weave, border, and drape are the subject, not the full outfit"
    },
    "Fabric texture": {
      shotDesc: "extreme close-up of the fabric texture",
      poseDesc: "garment surface presented so weave and sheen are readable",
      cameraDesc: "macro lens raking across the cloth",
      compDesc: "weave, sheen, and hand of the fabric fill the frame"
    },
    "Cuff / border detail": {
      shotDesc: "close-up of the cuff or border detail",
      poseDesc: "wrist or hem turned just enough to show the border without folding the craft away",
      cameraDesc: "macro editorial framing on the cuff or border edge",
      compDesc: "border width, stitching, and trim are sharply visible"
    },
    "Trouser detail": {
      shotDesc: "close-up of the trouser or lower-garment detail",
      poseDesc: "standing or seated so the trouser drape and hem are undistorted",
      cameraDesc: "close framing from knee or hip to the hem",
      compDesc: "trouser cut, pleat or gather, and hem finish are the subject"
    }
  };
  const lightingByStyle = {
    "Luxury Editorial": "dramatic soft architectural window sunlight with sculpted shadows",
    "Minimal Studio": "soft diffused professional studio cyclorama lighting",
    "Outdoor Lifestyle": "warm golden-hour natural directional sunlight",
    "Boutique Catalogue": "even, colour-accurate 5200K commercial studio lighting",
    Festive: "warm evening editorial lighting accentuating metallic gold/silver threadwork luster",
    "Modern Pakistani Fashion": "crisp contemporary daylight editorial contrast"
  };
  const spec = shotSpecifications[shotType] || shotSpecifications["Full body"];
  const bgDescription = config.background === "Custom" && config.customBackgroundNote ? config.customBackgroundNote : config.background;
  return `Create a new professional fashion photograph using the supplied garment reference.

The garment is the primary source of truth.

Preserve the garment as accurately as possible:

* exact colors (${analysis.dominantColors.join(", ")}; accents: ${analysis.secondaryColors.join(", ")})
* print (${analysis.printPattern})
* embroidery (${analysis.embroidery})
* motifs (${analysis.motifs})
* borders (${analysis.borders})
* neckline (${analysis.neckline})
* sleeves (${analysis.sleeves})
* proportions (${analysis.shirtKameezDesign})
* dupatta / trousers (${analysis.trousersShawlDupatta})
* fabric appearance (${analysis.fabricAppearance})

Immutable garment constraints:
${analysis.immutableElements.map((el) => `- ${el}`).join("\n")}

Do not redesign the garment.
Do not invent additional embroidery.
Do not remove existing details.
Do not alter the print or color scheme.

If the reference already shows a person or fashion model wearing the garment, do not copy that person in any way. Do not reproduce their face, body, identity, pose, proportions, or styling. Replace them completely with a new fictional model.

If the reference is a flat-lay or a dress form or dummy with no real person, still photograph the garment on a new fictional model. Do not invent a face that resembles anyone in the source, and do not copy the dummy.

The garment itself stays unchanged.

Create an original photograph with a different:

* face
* pose
* camera angle
* composition
* background
* lighting
* styling

Do not reproduce the original catalogue photograph or its composition.

The result should look like a professionally photographed Pakistani fashion editorial/catalogue image.

The garment must remain the visual priority.

Shot type: ${spec.shotDesc}.
Pose: ${spec.poseDesc}.
Camera: ${spec.cameraDesc}.
Composition: ${spec.compDesc}.
Lighting: ${lightingByStyle[config.shootStyle]}.
Background environment: ${bgDescription}.
Model casting: AI-generated ${config.model.gender} ${config.model.modelStyle} fashion model, age range ${config.model.ageRange}, ${config.model.skinComplexion} complexion, hair styled in ${config.model.hairStyling}, minimal styling accent (${config.model.stylingAccent}).
${customPromptOverride ? `Additional Art Direction: ${customPromptOverride}` : ""}`;
}
function mapAspectRatioToGeminiConfig(ratio) {
  if (ratio === "Square 1:1") return "1:1";
  if (ratio === "Story 9:16") return "9:16";
  return "3:4";
}
async function generateFashionShotServer(params) {
  const {
    product,
    analysis,
    config,
    shotType,
    shotIndex,
    aiMode,
    customPromptOverride
  } = params;
  const masterPrompt = buildMasterFashionPrompt({
    product,
    analysis,
    config,
    shotType,
    customPromptOverride
  });
  const conciseNotes = customPromptOverride || `${shotType} framing in ${config.background.toLowerCase()} setting \xB7 ${config.shootStyle} lighting \xB7 ${config.model.skinComplexion} complexion, ${config.model.hairStyling.toLowerCase()} \xB7 Preserving ${analysis.embroidery.toLowerCase()}.`;
  void aiMode;
  const ai = createGeminiClient();
  const { imageModel } = getGeminiConfig();
  const garmentSource = await resolveImageToBase64(
    product.referenceImage || product.garmentImageUrl
  );
  const response = await generateContentWithFallback(ai, imageModel, [], {
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: garmentSource.mimeType,
            data: garmentSource.data
          }
        },
        {
          text: masterPrompt
        }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: mapAspectRatioToGeminiConfig(config.aspectRatio)
      }
    }
  });
  const parts = response.candidates?.[0]?.content?.parts || [];
  let generatedBase64 = null;
  let generatedMime = "image/png";
  for (const part of parts) {
    if (part.inlineData?.data) {
      generatedBase64 = part.inlineData.data;
      if (part.inlineData.mimeType) {
        generatedMime = part.inlineData.mimeType;
      }
      break;
    }
  }
  if (!generatedBase64) {
    throw new Error(
      "Gemini image model did not return an image part for this shot. Check model availability or retry."
    );
  }
  const imageUrl = await storeMediaBuffer(
    Buffer.from(generatedBase64, "base64"),
    generatedMime,
    `gemini-shoot-${shotIndex + 1}`
  );
  return {
    imageUrl,
    promptNotes: conciseNotes,
    masterPromptUsed: masterPrompt,
    cropVariant: "full"
  };
}
async function generateInstagramCopyServer(params) {
  const { product, tone, style } = params;
  void params.aiMode;
  try {
    const ai = createGeminiClient();
    const { textModel } = getGeminiConfig();
    const analysisSummary = product.garmentAnalysis ? JSON.stringify(product.garmentAnalysis) : product.fabricDetails;
    const copyPrompt = `You are the creative director for a luxury Pakistani fashion house.
Write original Instagram carousel copy for the following garment photographed in a "${style}" campaign with a "${tone}" voice.
CRITICAL RULE: Do NOT copy or repeat the raw catalogue specification text ("${product.rawCatalogueText}"). Write completely original, refined editorial storytelling based on the garment's visual traits:
Garment Name: ${product.name}
Visual Analysis: ${analysisSummary}`;
    const response = await generateContentWithFallback(ai, textModel, TEXT_MODEL_FALLBACKS, {
      contents: copyPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            productTitle: { type: Type.STRING },
            shortDescription: { type: Type.STRING },
            caption: { type: Type.STRING },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
            cta: { type: Type.STRING }
          },
          required: ["productTitle", "shortDescription", "caption", "hashtags", "cta"]
        }
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    if (parsed.caption && parsed.productTitle) {
      return {
        productTitle: parsed.productTitle,
        shortDescription: parsed.shortDescription || "",
        caption: parsed.caption,
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : ["#Veyra"],
        cta: parsed.cta || "Explore bespoke & standard sizing via the link in bio, or message our studio concierge.",
        copyPromptUsed: copyPrompt
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate Instagram copy.";
    throw new Error(message);
  }
  throw new Error("Gemini did not return Instagram copy.");
}

// src/data/studioDefaults.ts
var DEFAULT_SHOOT_CONFIG = {
  model: {
    aiGenerated: true,
    gender: "Female",
    modelStyle: "Pakistani / South Asian",
    personaName: "Ayla Raza (Lahore Editorial)",
    ageRange: "25\u201329",
    skinComplexion: "Warm Olive",
    hairStyling: "Sleek Center-Part Bun",
    stylingAccent: "Minimal Gold Studs"
  },
  shootStyle: "Luxury Editorial",
  poses: ["Full body", "3/4 standing", "Detail portrait", "Walking"],
  background: "Minimal architectural",
  customBackgroundNote: "",
  aspectRatio: "Instagram Portrait 4:5",
  numberOfImages: 4
};

// src/server/supabaseAuth.ts
import { createClient } from "@supabase/supabase-js";
function supabaseServerConfig() {
  const url = process.env.SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || "";
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
async function userIdFromAuthorizationHeader(header) {
  const config = supabaseServerConfig();
  if (!config) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_ANON_KEY are not configured. Add them in Vercel, then redeploy."
    );
  }
  const value = header || "";
  const token = value.startsWith("Bearer ") ? value.slice("Bearer ".length).trim() : "";
  if (!token) return null;
  const supabase = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;
  if (!/^[0-9a-f-]{36}$/i.test(data.user.id)) return null;
  return data.user.id;
}
async function userIdFromRequest(req) {
  const header = req.headers.authorization;
  return userIdFromAuthorizationHeader(Array.isArray(header) ? header[0] : header);
}

// server.ts
var PORT = Number(process.env.PORT) || 3e3;
function buildRuntime() {
  const geminiCfg = getGeminiConfig();
  return {
    aiMode: "live",
    envAiMode: "live",
    hasGeminiApiKey: geminiCfg.hasValidKey,
    imageModel: geminiCfg.imageModel,
    visionModel: geminiCfg.visionModel,
    textModel: geminiCfg.textModel,
    storageMode: getStorageMode()
  };
}
function sanitizeText(input, maxLength = 2e3) {
  if (typeof input !== "string") return "";
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}
var ALLOWED_STYLES = [
  "Luxury Editorial",
  "Minimal Studio",
  "Outdoor Lifestyle",
  "Boutique Catalogue",
  "Festive",
  "Modern Pakistani Fashion"
];
var ALLOWED_POSES = [
  "Full body",
  "3/4 standing",
  "Walking",
  "Seated",
  "Detail portrait",
  "Back/side angle",
  "Sleeve close-up",
  "Neckline close-up",
  "Embroidery close-up",
  "Print / pattern close-up",
  "Dupatta close-up",
  "Fabric texture",
  "Cuff / border detail",
  "Trouser detail"
];
var ALLOWED_BACKGROUNDS = [
  "Studio",
  "Luxury interior",
  "Minimal architectural",
  "Outdoor",
  "Custom"
];
var ALLOWED_RATIOS = [
  "Instagram Portrait 4:5",
  "Square 1:1",
  "Story 9:16"
];
var upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    // 25MB max per file
    files: 12
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp"
    ];
    const ext = path5.extname(file.originalname).toLowerCase();
    const allowedExts = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Only PDF, JPG, PNG, and WEBP files are allowed."));
    }
  }
});
var shootLocks = /* @__PURE__ */ new Set();
async function advanceShootOneStep(shootId) {
  if (shootLocks.has(shootId)) {
    return studioRepository.getShoot(shootId);
  }
  const existing = await studioRepository.getShoot(shootId);
  if (!existing) return null;
  if (existing.status === "Complete" || existing.status === "Failed") return existing;
  if (existing.pipelineBusyUntil && existing.pipelineBusyUntil > Date.now()) {
    return existing;
  }
  shootLocks.add(shootId);
  try {
    await studioRepository.updateShoot(shootId, {
      pipelineBusyUntil: Date.now() + 55e3
    });
    const shoot = await studioRepository.getShoot(shootId);
    const product = shoot ? await studioRepository.getProduct(shoot.productId) : null;
    if (!shoot || !product) {
      return studioRepository.updateShoot(shootId, {
        status: "Failed",
        errorMessage: "Source garment product record not found.",
        pipelineBusyUntil: 0
      });
    }
    const aiMode = await studioRepository.getAiMode();
    if (!product.garmentAnalysis) {
      await studioRepository.updateShoot(shootId, {
        status: "Analyzing garment",
        jobs: shoot.jobs.map(
          (job2, idx) => idx === 0 ? { ...job2, status: "Analyzing garment" } : job2
        )
      });
      const analysis = await analyzeProductGarmentServer(product, aiMode);
      await studioRepository.saveGarmentAnalysis(product.id, analysis);
      return studioRepository.updateShoot(shootId, {
        status: "Generating",
        pipelineBusyUntil: 0
      });
    }
    const jobs = [...shoot.jobs];
    const index = jobs.findIndex((job2) => job2.status !== "Complete");
    if (index === -1) {
      return studioRepository.updateShoot(shootId, {
        status: "Complete",
        pipelineBusyUntil: 0
      });
    }
    const job = jobs[index];
    jobs[index] = { ...job, status: "Generating" };
    await studioRepository.updateShoot(shootId, {
      status: "Generating",
      jobs: [...jobs]
    });
    const shotResult = await generateFashionShotServer({
      product,
      analysis: product.garmentAnalysis,
      config: shoot.config,
      shotType: job.shotType,
      shotIndex: index,
      aiMode
    });
    const nowTime = (/* @__PURE__ */ new Date()).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
    const shortPersona = shoot.config.model.personaName.split(" ")[0];
    const newImage = {
      id: `img-${Date.now()}-${index + 1}`,
      shootId: shoot.id,
      productId: product.id,
      projectId: shoot.projectId,
      imageUrl: shotResult.imageUrl,
      garmentReferenceUrl: product.referenceImage || product.garmentImageUrl,
      productName: product.name,
      productSku: product.sku,
      shotType: job.shotType,
      modelSummary: `${shortPersona} \xB7 ${shoot.config.model.modelStyle} (${shoot.config.model.ageRange})`,
      style: shoot.config.shootStyle,
      background: shoot.config.background,
      aspectRatio: shoot.config.aspectRatio,
      status: "Ready",
      promptNotes: shotResult.promptNotes,
      masterPromptUsed: shotResult.masterPromptUsed,
      cropVariant: shotResult.cropVariant,
      selectedForPost: index < 3,
      createdAt: `Today, ${nowTime}`
    };
    await studioRepository.createGeneratedImage(newImage);
    jobs[index] = { ...job, status: "Complete", imageId: newImage.id };
    const allDone = jobs.every((item) => item.status === "Complete");
    if (allDone) {
      const latestProduct = await studioRepository.getProduct(product.id);
      if (latestProduct) {
        await studioRepository.updateProduct(product.id, {
          generatedCount: (latestProduct.generatedCount || 0) + jobs.length
        });
      }
    }
    return studioRepository.updateShoot(shootId, {
      status: allDone ? "Complete" : "Generating",
      jobs,
      errorMessage: "",
      pipelineBusyUntil: allDone ? 0 : Date.now() + 2e4
    });
  } catch (err) {
    if (err instanceof GeminiRateLimitError) {
      console.error(`Shoot ${shootId} paused for Gemini rate limit:`, err.message);
      return studioRepository.updateShoot(shootId, {
        status: "Generating",
        errorMessage: err.message,
        pipelineBusyUntil: Date.now() + err.retryAfterMs
      });
    }
    const message = err instanceof Error ? err.message : "Unexpected error during fashion shoot generation.";
    console.error(`Shoot ${shootId} generation failed:`, message);
    const latestShoot = await studioRepository.getShoot(shootId);
    const updatedJobs = (latestShoot?.jobs || existing.jobs).map(
      (job) => job.status === "Complete" ? job : { ...job, status: "Failed", error: message }
    );
    return studioRepository.updateShoot(shootId, {
      status: "Failed",
      errorMessage: message,
      jobs: updatedJobs,
      pipelineBusyUntil: 0
    });
  } finally {
    shootLocks.delete(shootId);
  }
}
function createApp() {
  const app = express();
  if (process.env.VERCEL) {
    app.use((req, _res, next) => {
      const url = req.url || "/";
      const queryIndex = url.indexOf("?");
      const pathOnly = queryIndex === -1 ? url : url.slice(0, queryIndex);
      const query = queryIndex === -1 ? "" : url.slice(queryIndex);
      if (pathOnly === "/api" || pathOnly.startsWith("/api/")) {
        next();
        return;
      }
      req.url = `/api${pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`}${query}`;
      next();
    });
  }
  app.use(express.json({ limit: "25mb" }));
  app.use(async (req, res, next) => {
    const url = req.url || "/";
    const pathOnly = url.split("?")[0];
    if (!pathOnly.startsWith("/api")) {
      next();
      return;
    }
    try {
      const userId = await userIdFromRequest(req);
      if (!userId) {
        res.status(401).json({ error: "Sign in required." });
        return;
      }
      runAsUser(userId, () => next());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in could not be checked.";
      res.status(503).json({ error: message });
    }
  });
  app.use("/uploads", express.static(UPLOADS_DIR));
  app.use("/src/assets", express.static(path5.join(process.cwd(), "src/assets")));
  app.get("/api/status", async (_req, res) => {
    res.json(buildRuntime());
  });
  app.patch("/api/settings/mode", async (_req, res) => {
    res.json(buildRuntime());
  });
  app.get("/api/bootstrap", async (_req, res) => {
    const state = await studioRepository.getState();
    res.json({
      ...state,
      aiMode: "live",
      runtime: buildRuntime()
    });
  });
  app.post("/api/projects", async (req, res) => {
    const name = sanitizeText(req.body?.name, 160) || "Untitled Seasonal Collection";
    const sourceType = req.body?.sourceType === "Garment Images" ? "Garment Images" : "Catalogue PDF";
    const sourceFileName = sanitizeText(req.body?.sourceFileName, 200);
    const newProject = {
      id: `proj-${Date.now()}`,
      name,
      seasonCode: sanitizeText(req.body?.seasonCode, 12) || "FW26",
      sourceType,
      sourceFileName,
      status: "active",
      createdAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
      updatedAt: "Just now",
      productIds: [],
      shootIds: [],
      coverImageUrl: "",
      pages: []
    };
    const created = await studioRepository.createProject(newProject);
    res.status(201).json(created);
  });
  app.delete("/api/projects/:id", async (req, res) => {
    const projectId = sanitizeText(req.params.id, 80);
    const deleted = await studioRepository.deleteProject(projectId);
    if (!deleted) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    res.json({ deleted: true, id: projectId });
  });
  app.post(
    "/api/projects/:id/catalogue",
    (req, res, next) => {
      upload.array("files", 12)(req, res, (err) => {
        if (err) {
          res.status(400).json({ error: err.message || "File upload validation failed." });
          return;
        }
        next();
      });
    },
    async (req, res) => {
      try {
        const projectId = sanitizeText(req.params.id, 80);
        const project = await studioRepository.getProject(projectId);
        if (!project) {
          res.status(404).json({ error: "Create a project before uploading a catalogue." });
          return;
        }
        const sourceType = req.body?.sourceType === "Garment Images" ? "Garment Images" : "Catalogue PDF";
        const projectName = sanitizeText(req.body?.projectName, 160) || project.name || "Untitled Collection";
        const files = req.files || [];
        if (files.length === 0) {
          res.status(400).json({
            error: "Upload a catalogue PDF or garment images. Sample catalogues are no longer available."
          });
          return;
        }
        const uploadedFiles = [];
        for (const file of files) {
          const isPdf = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
          const mimeType = file.mimetype || (isPdf ? "application/pdf" : "image/jpeg");
          const publicUrl = isPdf ? "" : await storeMediaBuffer(file.buffer, mimeType, "upload");
          uploadedFiles.push({
            originalName: file.originalname,
            mimeType,
            buffer: file.buffer,
            publicUrl
          });
        }
        const aiMode = await studioRepository.getAiMode();
        const { products, pages } = await extractCatalogueProductsServer({
          projectId: project.id,
          sourceType,
          uploadedFiles,
          aiMode
        });
        await studioRepository.createProducts(products);
        const updatedProject = await studioRepository.updateProject(project.id, {
          name: projectName,
          sourceType,
          sourceFileName: uploadedFiles[0]?.originalName || project.sourceFileName,
          productIds: [...products.map((p) => p.id), ...project.productIds],
          coverImageUrl: products[0]?.referenceImage || project.coverImageUrl,
          pages,
          status: "active"
        });
        res.json({
          project: updatedProject,
          products,
          pages
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to process catalogue upload.";
        res.status(500).json({ error: message });
      }
    }
  );
  app.post("/api/projects/:id/manual-extract", async (req, res) => {
    try {
      const projectId = sanitizeText(req.params.id, 80);
      const project = await studioRepository.getProject(projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found." });
        return;
      }
      const name = sanitizeText(req.body?.name, 140) || "Manual Cropped Catalogue Piece";
      const sku = sanitizeText(req.body?.sku, 40) || `SKU-${Date.now().toString().slice(-6)}`;
      const category = sanitizeText(req.body?.category, 80) || "Luxury Pret \xB7 Manual Crop";
      const fabricDetails = sanitizeText(req.body?.fabricDetails, 240) || "Isolated from Catalogue Page via Studio Crop Tool";
      const sourcePage = Math.max(1, Number(req.body?.sourcePage) || 1);
      let imageUrl = sanitizeText(req.body?.croppedDataUrl, 10 * 1024 * 1024);
      if (imageUrl.startsWith("data:image/")) {
        const match = imageUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (!match) {
          res.status(400).json({ error: "Cropped garment image could not be read." });
          return;
        }
        const mime = match[1].includes("png") ? "image/png" : "image/jpeg";
        imageUrl = await storeMediaBuffer(Buffer.from(match[2], "base64"), mime, "manual-crop");
      } else if (!imageUrl) {
        res.status(400).json({ error: "A cropped garment image is required." });
        return;
      }
      const newProduct = {
        id: `prod-manual-${Date.now()}`,
        projectId: project.id,
        sku,
        name,
        category,
        fabricDetails,
        rawCatalogueText: `MANUAL PAGE CROP (PAGE ${sourcePage}) \xB7 SKU ${sku} \xB7 ${name.toUpperCase()}`,
        garmentImageUrl: imageUrl,
        referenceImage: imageUrl,
        sourcePage,
        detectedPage: sourcePage,
        garmentAnalysis: null,
        selected: true,
        createdAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        generatedCount: 0
      };
      await studioRepository.createProducts([newProduct]);
      await studioRepository.updateProject(project.id, {
        productIds: [newProduct.id, ...project.productIds]
      });
      res.status(201).json(newProduct);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Manual product extraction failed.";
      res.status(500).json({ error: message });
    }
  });
  app.get("/api/projects/:id/products", async (req, res) => {
    const projectId = sanitizeText(req.params.id, 80);
    const products = await studioRepository.listProducts(projectId);
    res.json(products);
  });
  app.get("/api/products/:id", async (req, res) => {
    const product = await studioRepository.getProduct(sanitizeText(req.params.id, 80));
    if (!product) {
      res.status(404).json({ error: "Product not found." });
      return;
    }
    res.json(product);
  });
  app.post("/api/products/:id/analyze", async (req, res) => {
    try {
      const productId = sanitizeText(req.params.id, 80);
      const product = await studioRepository.getProduct(productId);
      if (!product) {
        res.status(404).json({ error: "Product not found." });
        return;
      }
      const aiMode = await studioRepository.getAiMode();
      const analysis = await analyzeProductGarmentServer(product, aiMode);
      const updatedProduct = await studioRepository.saveGarmentAnalysis(
        productId,
        analysis
      );
      res.json({
        product: updatedProduct,
        garmentAnalysis: analysis
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to analyze garment.";
      res.status(500).json({ error: message });
    }
  });
  app.post("/api/products/:id/shoots", async (req, res) => {
    try {
      const productId = sanitizeText(req.params.id, 80);
      const product = await studioRepository.getProduct(productId);
      if (!product) {
        res.status(404).json({ error: "Product not found." });
        return;
      }
      const incomingConfig = req.body?.config || {};
      const shootStyle = ALLOWED_STYLES.includes(
        incomingConfig.shootStyle
      ) ? incomingConfig.shootStyle : DEFAULT_SHOOT_CONFIG.shootStyle;
      const rawPoses = Array.isArray(incomingConfig.poses) ? incomingConfig.poses.filter(
        (p) => ALLOWED_POSES.includes(p)
      ) : [];
      const poses = rawPoses.length > 0 ? rawPoses : DEFAULT_SHOOT_CONFIG.poses;
      const background = ALLOWED_BACKGROUNDS.includes(
        incomingConfig.background
      ) ? incomingConfig.background : DEFAULT_SHOOT_CONFIG.background;
      const aspectRatio = ALLOWED_RATIOS.includes(
        incomingConfig.aspectRatio
      ) ? incomingConfig.aspectRatio : DEFAULT_SHOOT_CONFIG.aspectRatio;
      const numberOfImages = Math.max(1, poses.length);
      const sanitizedConfig = {
        model: {
          aiGenerated: true,
          gender: "Female",
          modelStyle: "Pakistani / South Asian",
          personaName: sanitizeText(incomingConfig.model?.personaName, 80) || DEFAULT_SHOOT_CONFIG.model.personaName,
          ageRange: incomingConfig.model?.ageRange === "20\u201324" || incomingConfig.model?.ageRange === "25\u201329" || incomingConfig.model?.ageRange === "30\u201335" ? incomingConfig.model.ageRange : "25\u201329",
          skinComplexion: incomingConfig.model?.skinComplexion || DEFAULT_SHOOT_CONFIG.model.skinComplexion,
          hairStyling: incomingConfig.model?.hairStyling || DEFAULT_SHOOT_CONFIG.model.hairStyling,
          stylingAccent: incomingConfig.model?.stylingAccent || DEFAULT_SHOOT_CONFIG.model.stylingAccent
        },
        shootStyle,
        poses,
        background,
        customBackgroundNote: sanitizeText(
          incomingConfig.customBackgroundNote,
          300
        ),
        aspectRatio,
        numberOfImages
      };
      const shootId = `shoot-${Date.now()}`;
      const jobs = poses.map((shotType, idx) => ({
        id: `job-${shootId}-${idx + 1}`,
        shootId,
        shotType,
        status: "Queued"
      }));
      const newShoot = {
        id: shootId,
        projectId: product.projectId,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        garmentImageUrl: product.referenceImage || product.garmentImageUrl,
        style: sanitizedConfig.shootStyle,
        modelSettings: sanitizedConfig.model,
        shotSettings: {
          poses: sanitizedConfig.poses,
          background: sanitizedConfig.background,
          customBackgroundNote: sanitizedConfig.customBackgroundNote,
          numberOfImages: sanitizedConfig.numberOfImages
        },
        aspectRatio: sanitizedConfig.aspectRatio,
        status: "Queued",
        jobs,
        config: sanitizedConfig,
        images: [],
        createdAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
      };
      const created = await studioRepository.createShoot(newShoot);
      res.status(201).json(created);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create shoot.";
      res.status(500).json({ error: message });
    }
  });
  app.post("/api/shoots/:id/generate", async (req, res) => {
    const shootId = sanitizeText(req.params.id, 80);
    const shoot = await studioRepository.getShoot(shootId);
    if (!shoot) {
      res.status(404).json({ error: "Shoot not found." });
      return;
    }
    res.json({
      message: "Shoot generation started.",
      shoot
    });
  });
  app.get("/api/shoots/:id", async (req, res) => {
    const shootId = sanitizeText(req.params.id, 80);
    const shoot = await advanceShootOneStep(shootId);
    if (!shoot) {
      res.status(404).json({ error: "Shoot not found." });
      return;
    }
    const product = await studioRepository.getProduct(shoot.productId);
    res.json({
      shoot,
      garmentAnalysis: product?.garmentAnalysis || null
    });
  });
  app.post("/api/generated-images/:id/regenerate", async (req, res) => {
    try {
      const imageId = sanitizeText(req.params.id, 80);
      const existingImage = await studioRepository.getGeneratedImage(imageId);
      if (!existingImage) {
        res.status(404).json({ error: "Generated image not found." });
        return;
      }
      const product = await studioRepository.getProduct(existingImage.productId);
      if (!product) {
        res.status(404).json({ error: "Associated garment product not found." });
        return;
      }
      const shoot = await studioRepository.getShoot(existingImage.shootId);
      const aiMode = await studioRepository.getAiMode();
      const nextShotType = ALLOWED_POSES.includes(
        req.body?.shotType
      ) ? req.body.shotType : existingImage.shotType;
      const nextStyle = ALLOWED_STYLES.includes(
        req.body?.style
      ) ? req.body.style : existingImage.style;
      const nextBackground = ALLOWED_BACKGROUNDS.includes(
        req.body?.background
      ) ? req.body.background : existingImage.background;
      const customPrompt = sanitizeText(req.body?.promptNotes, 1e3);
      await studioRepository.updateGeneratedImage(imageId, {
        status: "Regenerating"
      });
      const baseConfig = shoot?.config || {
        ...DEFAULT_SHOOT_CONFIG,
        shootStyle: nextStyle,
        background: nextBackground,
        aspectRatio: existingImage.aspectRatio
      };
      const mergedConfig = {
        ...baseConfig,
        shootStyle: nextStyle,
        background: nextBackground
      };
      const analysis = product.garmentAnalysis || await analyzeProductGarmentServer(product, aiMode);
      const regenResult = await generateFashionShotServer({
        product,
        analysis,
        config: mergedConfig,
        shotType: nextShotType,
        shotIndex: Math.floor(Math.random() * 4),
        aiMode,
        customPromptOverride: customPrompt || existingImage.promptNotes
      });
      const updated = await studioRepository.updateGeneratedImage(imageId, {
        imageUrl: regenResult.imageUrl,
        shotType: nextShotType,
        style: nextStyle,
        background: nextBackground,
        promptNotes: regenResult.promptNotes,
        masterPromptUsed: regenResult.masterPromptUsed,
        cropVariant: regenResult.cropVariant,
        status: "Refined"
      });
      res.json(updated);
    } catch (err) {
      const imageId = sanitizeText(req.params.id, 80);
      const message = err instanceof Error ? err.message : "Failed to regenerate image.";
      await studioRepository.updateGeneratedImage(imageId, {
        status: "Ready",
        errorMessage: message
      });
      res.status(500).json({ error: message });
    }
  });
  app.delete("/api/generated-images/:id", async (req, res) => {
    const imageId = sanitizeText(req.params.id, 80);
    const deleted = await studioRepository.deleteGeneratedImage(imageId);
    if (!deleted) {
      res.status(404).json({ error: "Image not found." });
      return;
    }
    res.json({ deleted: true, id: imageId });
  });
  app.post("/api/posts/generate-copy", async (req, res) => {
    try {
      const productId = sanitizeText(req.body?.productId, 80);
      const product = await studioRepository.getProduct(productId) || (await studioRepository.listProducts())[0];
      if (!product) {
        res.status(404).json({ error: "Product not found for copy generation." });
        return;
      }
      const tone = req.body?.tone || "Editorial Storytelling";
      const style = sanitizeText(req.body?.style, 80) || "Luxury Editorial";
      const aiMode = await studioRepository.getAiMode();
      const generatedCopy = await generateInstagramCopyServer({
        product,
        tone,
        style,
        aiMode
      });
      res.json(generatedCopy);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate Instagram copy.";
      res.status(500).json({ error: message });
    }
  });
  app.post("/api/posts", async (req, res) => {
    const body = req.body || {};
    const selectedImages = Array.isArray(body.carouselImageIds) ? body.carouselImageIds.map((id) => sanitizeText(id, 80)) : Array.isArray(body.selectedImages) ? body.selectedImages.map((id) => sanitizeText(id, 80)) : [];
    const coverImageId = sanitizeText(body.coverImageId || body.coverImage, 80) || selectedImages[0] || "";
    const shortDesc = sanitizeText(
      body.shortDescription || body.description,
      500
    );
    const newPost = {
      id: `post-${Date.now()}`,
      projectId: sanitizeText(body.projectId, 80),
      productId: sanitizeText(body.productId, 80),
      shootId: sanitizeText(body.shootId, 80),
      productTitle: sanitizeText(body.productTitle, 160) || "Editorial Collection Piece",
      shortDescription: shortDesc,
      description: shortDesc,
      caption: sanitizeText(body.caption, 2200),
      captionTone: body.captionTone || "Editorial Storytelling",
      hashtags: Array.isArray(body.hashtags) ? body.hashtags.map((h) => sanitizeText(h, 60)).filter(Boolean) : [],
      cta: sanitizeText(body.cta, 300),
      aspectRatio: "Instagram Portrait 4:5",
      carouselImageIds: selectedImages,
      selectedImages,
      coverImageId,
      coverImage: coverImageId,
      status: body.status === "Ready to Publish" ? "Ready to Publish" : "Draft",
      updatedAt: "Just now"
    };
    const created = await studioRepository.createPost(newPost);
    res.status(201).json(created);
  });
  app.patch("/api/posts/:id", async (req, res) => {
    const postId = sanitizeText(req.params.id, 80);
    const updated = await studioRepository.updatePost(postId, req.body || {});
    if (!updated) {
      res.status(404).json({ error: "Post draft not found." });
      return;
    }
    res.json(updated);
  });
  app.delete("/api/posts/:id", async (req, res) => {
    const postId = sanitizeText(req.params.id, 80);
    const deleted = await studioRepository.deletePost(postId);
    if (!deleted) {
      res.status(404).json({ error: "Post draft not found." });
      return;
    }
    res.json({ deleted: true, id: postId });
  });
  app.get("/api/media", async (req, res) => {
    const raw = req.query.pathname;
    const pathname = typeof raw === "string" ? raw : "";
    if (!pathname.startsWith("media/") || pathname.includes("..") || pathname.includes("\\")) {
      res.status(400).json({ error: "Invalid media path." });
      return;
    }
    let allowed = false;
    try {
      const userId = currentUserId();
      allowed = mediaPathForUser(pathname, userId);
      if (!allowed) {
        allowed = studioStateReferencesMedia(await loadStudioState(), pathname);
      }
    } catch {
      allowed = false;
    }
    if (!allowed) {
      res.status(404).json({ error: "Media not found." });
      return;
    }
    const stored = await readStoredMedia(pathname);
    if (!stored) {
      res.status(404).json({ error: "Media not found." });
      return;
    }
    res.setHeader("Content-Type", stored.contentType);
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(stored.bytes);
  });
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "Unknown API route.", path: req.originalUrl });
  });
  return app;
}
async function startDevServer() {
  const app = createApp();
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path5.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path5.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Veyra server running on http://localhost:${PORT}`);
  });
}
export {
  createApp,
  startDevServer
};
