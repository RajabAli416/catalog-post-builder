import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import {
  AIMode,
  AspectRatioType,
  BackgroundType,
  CataloguePagePlate,
  CatalogueProduct,
  GarmentAnalysis,
  GeneratedShootImage,
  InstagramPostDraft,
  ShootConfiguration,
  ShootStyleId,
  ShotPoseType,
} from '../types/studio';
import { UPLOADS_DIR } from './repository';
import { readStoredMedia, storeMediaBuffer } from './mediaStore';

export function getGeminiConfig() {
  const rawKey = process.env.GEMINI_API_KEY || '';
  const hasValidKey = Boolean(
    rawKey &&
      rawKey.trim() !== '' &&
      rawKey !== 'MY_GEMINI_API_KEY' &&
      rawKey !== 'YOUR_API_KEY'
  );

  return {
    apiKey: rawKey,
    hasValidKey,
    imageModel: process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-lite-image',
    visionModel: process.env.GEMINI_VISION_MODEL || 'gemini-3.8-flash',
    textModel: process.env.GEMINI_TEXT_MODEL || 'gemini-3.8-flash',
  };
}

function createGeminiClient(): GoogleGenAI {
  const { apiKey, hasValidKey } = getGeminiConfig();
  if (!hasValidKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add it in the Vercel project environment variables, then redeploy.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const TEXT_MODEL_FALLBACKS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'];

function geminiErrorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isZeroFreeTierQuota(err: unknown): boolean {
  const message = geminiErrorText(err);
  return /free_tier/i.test(message) && /limit:\s*0/.test(message);
}

function isTemporaryCapacityError(err: unknown): boolean {
  if (isZeroFreeTierQuota(err)) return false;
  return /503|UNAVAILABLE|high demand|overloaded/i.test(geminiErrorText(err));
}

export class GeminiRateLimitError extends Error {
  retryAfterMs: number;

  constructor(retryAfterMs: number) {
    const seconds = Math.ceil(retryAfterMs / 1000);
    super(`Gemini is limiting new images. This shot continues automatically in ${seconds} seconds.`);
    this.name = 'GeminiRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

function isPrepaidCreditsDepleted(err: unknown): boolean {
  return /prepayment credits are depleted|code"\s*:\s*402/i.test(geminiErrorText(err));
}

function isRateLimitError(err: unknown): boolean {
  if (isZeroFreeTierQuota(err) || isPrepaidCreditsDepleted(err)) return false;
  return /429|RESOURCE_EXHAUSTED|quota exceeded/i.test(geminiErrorText(err));
}

function parseRetryAfterMs(message: string): number {
  const match =
    message.match(/retry in ([0-9.]+)\s*s/i) ||
    message.match(/retryDelay"\s*:\s*"([0-9.]+)s/i);
  const seconds = match ? Number(match[1]) : 45;
  const ms = Math.ceil(seconds * 1000) + 2000;
  return Math.min(Math.max(ms, 15_000), 120_000);
}

function toUserFacingGeminiError(err: unknown): Error {
  const message = geminiErrorText(err);
  if (isPrepaidCreditsDepleted(err)) {
    return new Error(
      'Gemini prepaid credits are used up, so image generation cannot start. In AI Studio, open the project billing page and buy credits, then retry the shoot.'
    );
  }
  if (isZeroFreeTierQuota(err)) {
    const imageModel = /image/i.test(message);
    return new Error(
      imageModel
        ? 'Image generation is not included on the free Gemini plan. In Google AI Studio, open the project for this API key and turn on billing, then retry the shoot.'
        : 'This Gemini model is not included on the free plan. In Google AI Studio, turn on billing for this API key, then try again.'
    );
  }
  if (isTemporaryCapacityError(err)) {
    return new Error('Gemini is busy right now. Wait about a minute, then retry the shoot.');
  }
  if (isRateLimitError(err)) {
    const retryMatch =
      message.match(/retry in ([0-9.]+)\s*s/i) ||
      message.match(/retryDelay"\s*:\s*"([0-9.]+)s/i);
    const retrySeconds = retryMatch ? Number(retryMatch[1]) : 45;
    const dailyQuota = /per\s*day|perday/i.test(message);
    if (dailyQuota && retrySeconds > 180) {
      return new Error(
        'The daily Gemini image quota for this key is used up. Try the shoot again after the quota resets.'
      );
    }
    console.error('Gemini rate limit:', message);
    return new GeminiRateLimitError(parseRetryAfterMs(message));
  }
  return err instanceof Error ? err : new Error('Gemini request failed.');
}

async function generateContentWithFallback(
  ai: GoogleGenAI,
  primaryModel: string,
  fallbacks: string[],
  request: {
    contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'];
    config?: Parameters<GoogleGenAI['models']['generateContent']>[0]['config'];
  }
) {
  const models = [primaryModel, ...fallbacks.filter((model) => model !== primaryModel)];
  let lastError: unknown;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    const attempts = index === 0 ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await ai.models.generateContent({
          model,
          contents: request.contents,
          config: request.config,
        });
      } catch (err) {
        lastError = err;
        if (isRateLimitError(err) || isZeroFreeTierQuota(err) || !isTemporaryCapacityError(err)) {
          throw toUserFacingGeminiError(err);
        }
        if (attempt === 0 && attempts > 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }
  }

  throw toUserFacingGeminiError(lastError);
}

/**
 * Helper to resolve any local asset path (/src/assets/..., /uploads/..., or data URL)
 * into base64 inlineData for multimodal Gemini requests.
 */
export async function resolveImageToBase64(imageUrlOrPath: string): Promise<{
  data: string;
  mimeType: string;
}> {
  if (!imageUrlOrPath) {
    throw new Error('This product has no garment reference image to send to Gemini.');
  }

  if (imageUrlOrPath.startsWith('data:')) {
    const match = imageUrlOrPath.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return { mimeType: match[1], data: match[2] };
    }
  }

  if (imageUrlOrPath.startsWith('http://') || imageUrlOrPath.startsWith('https://')) {
    const response = await fetch(imageUrlOrPath);
    if (!response.ok) {
      throw new Error('Could not read the stored garment image.');
    }
    const mimeType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0];
    const buffer = Buffer.from(await response.arrayBuffer());
    return { data: buffer.toString('base64'), mimeType };
  }

  if (imageUrlOrPath.startsWith('/api/media?')) {
    const pathname = new URLSearchParams(imageUrlOrPath.slice('/api/media?'.length)).get('pathname') || '';
    if (!pathname.startsWith('media/') || pathname.includes('..')) {
      throw new Error('Garment reference image is missing from storage.');
    }
    const stored = await readStoredMedia(pathname);
    if (!stored) {
      throw new Error('Garment reference image is missing from storage.');
    }
    const mimeType = stored.contentType.split(';')[0] || 'image/jpeg';
    return { data: stored.bytes.toString('base64'), mimeType };
  }

  let diskPath = '';
  if (imageUrlOrPath.startsWith('/uploads/')) {
    diskPath = path.join(UPLOADS_DIR, path.basename(imageUrlOrPath));
  } else if (imageUrlOrPath.startsWith('/src/')) {
    diskPath = path.join(process.cwd(), imageUrlOrPath.replace(/^\//, ''));
  }

  if (!diskPath || !fs.existsSync(diskPath)) {
    throw new Error('Garment reference image is missing from storage.');
  }

  const buffer = fs.readFileSync(diskPath);
  const ext = path.extname(diskPath).toLowerCase();
  const mimeType =
    ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

  return {
    data: buffer.toString('base64'),
    mimeType,
  };
}

/**
 * Extracts embedded JPEG streams from a raw PDF buffer if present (up to 6 images)
 * so real uploaded lookbook PDFs can surface embedded garment plates on the server.
 */
export async function extractEmbeddedJpegsFromPdfBuffer(pdfBuffer: Buffer): Promise<string[]> {
  const savedUrls: string[] = [];
  const soi = Buffer.from([0xff, 0xd8, 0xff]);
  const eoi = Buffer.from([0xff, 0xd9]);

  let offset = 0;
  while (offset < pdfBuffer.length && savedUrls.length < 6) {
    const start = pdfBuffer.indexOf(soi, offset);
    if (start === -1) break;
    const end = pdfBuffer.indexOf(eoi, start + 3);
    if (end === -1) break;

    const length = end + 2 - start;
    if (length > 12 * 1024 && length < 12 * 1024 * 1024) {
      const jpgBuf = pdfBuffer.subarray(start, end + 2);
      const url = await storeMediaBuffer(Buffer.from(jpgBuf), 'image/jpeg', 'pdf-plate');
      savedUrls.push(url);
    }
    offset = end + 2;
  }

  return savedUrls;
}

/**
 * PHASE 2B — CATALOGUE UPLOAD & PRODUCT EXTRACTION
 * Avoids blindly treating every PDF page as one product.
 */
export async function extractCatalogueProductsServer(params: {
  projectId: string;
  sourceType: 'Catalogue PDF' | 'Garment Images';
  uploadedFiles: Array<{
    originalName: string;
    mimeType: string;
    buffer?: Buffer;
    publicUrl: string;
  }>;
  aiMode: AIMode;
}): Promise<{
  products: CatalogueProduct[];
  pages: CataloguePagePlate[];
}> {
  const { projectId, sourceType, uploadedFiles } = params;
  const today = new Date().toISOString().slice(0, 10);

  const imageFiles = uploadedFiles.filter((f) => f.mimeType.startsWith('image/'));
  const pdfFile = uploadedFiles.find(
    (f) => f.mimeType === 'application/pdf' || f.originalName.toLowerCase().endsWith('.pdf')
  );

  let extractedPlateUrls: string[] = imageFiles.map((f) => f.publicUrl).filter(Boolean);

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
                  mimeType: 'application/pdf',
                  data: pdfBuffer.toString('base64'),
                },
              },
              {
                text: `You are analyzing a fashion clothing catalogue PDF.
Identify all individual clothing/garment products shown across the pages. Do NOT blindly treat every page as one product: skip cover/index pages, and if a page has multiple garments, list each garment separately.
Return a JSON array of detected garments with sku, name, category, fabricDetails, rawCatalogueText, and sourcePage.`,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
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
                  sourcePage: { type: Type.INTEGER },
                },
                required: ['sku', 'name', 'category', 'fabricDetails', 'rawCatalogueText', 'sourcePage'],
              },
            },
          },
        });

        const parsed = JSON.parse(response.text || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (extractedPlateUrls.length === 0) {
            throw new Error(
              'Gemini found garments, but this PDF has no embedded photos to use as references. Upload garment images instead.'
            );
          }
          const products: CatalogueProduct[] = parsed.map((item, idx) => {
            const imgUrl =
              extractedPlateUrls[idx % Math.max(1, extractedPlateUrls.length)] || '';
            const pageNum = Number(item.sourcePage) || idx + 1;
            return {
              id: `prod-${Date.now()}-${idx + 1}`,
              projectId,
              sku: String(item.sku || `Piece ${idx + 1}`),
              name: String(item.name || `Catalogue Piece 0${idx + 1}`),
              category: String(item.category || 'Luxury Pret'),
              fabricDetails: String(item.fabricDetails || 'Pure Woven Silk & Artisanal Embroidery'),
              rawCatalogueText: String(item.rawCatalogueText || ''),
              garmentImageUrl: imgUrl,
              referenceImage: imgUrl,
              sourcePage: pageNum,
              detectedPage: pageNum,
              garmentAnalysis: null,
              selected: true,
              createdAt: today,
              generatedCount: 0,
            };
          });

          const pages: CataloguePagePlate[] = products.map((p, idx) => ({
            pageNumber: p.sourcePage,
            imageUrl: p.referenceImage,
            label: `Page 0${p.sourcePage} — ${p.name}`,
            detectedRegions: [
              {
                id: `reg-${idx + 1}`,
                label: p.name,
                sku: p.sku,
                cropBox: { x: 8, y: 6, width: 84, height: 86 },
              },
            ],
          }));

          return { products, pages };
        }
        throw new Error('No garments were detected in this catalogue PDF.');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Gemini could not read this catalogue PDF.';
        throw new Error(message);
      }
    } else {
      throw new Error('Catalogue PDF is larger than 18MB. Upload a smaller file.');
    }
  }

  // If user uploaded individual garment images, build products directly from those uploaded files
  if (imageFiles.length > 0) {
    const products: CatalogueProduct[] = imageFiles.map((file, idx) => {
      const cleanBase = path
        .basename(file.originalName, path.extname(file.originalName))
        .replace(/[-_]+/g, ' ');
      return {
        id: `prod-${Date.now()}-${idx + 1}`,
        projectId,
        sku: cleanBase.length > 3 ? cleanBase.slice(0, 40) : `Piece ${idx + 1}`,
        name: cleanBase.length > 3 ? cleanBase : `Garment ${idx + 1}`,
        category: 'Uploaded garment',
        fabricDetails: 'Uploaded garment photo',
        rawCatalogueText: `UPLOADED GARMENT FILE: ${file.originalName}. SOURCE PLATE #${idx + 1}.`,
        garmentImageUrl: file.publicUrl,
        referenceImage: file.publicUrl,
        sourcePage: idx + 1,
        detectedPage: idx + 1,
        garmentAnalysis: null,
        selected: true,
        createdAt: today,
        generatedCount: 0,
      };
    });

    const pages: CataloguePagePlate[] = products.map((p, idx) => ({
      pageNumber: idx + 1,
      imageUrl: p.referenceImage,
      label: `Plate 0${idx + 1} — ${p.name}`,
    }));

    return { products, pages };
  }

  throw new Error(
    sourceType === 'Catalogue PDF'
      ? 'Upload a catalogue PDF or garment images. Sample catalogues are no longer available.'
      : 'Upload at least one garment image.'
  );
}

/**
 * PHASE 2C — GARMENT ANALYSIS
 * Sends the product's reference image to Gemini vision/image understanding
 * and extracts structured JSON stored in product.garmentAnalysis.
 */
export async function analyzeProductGarmentServer(
  product: CatalogueProduct,
  aiMode: AIMode
): Promise<GarmentAnalysis> {
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
            data: base64Image,
          },
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
- immutableElements (array of critical garment details that must NEVER be altered during shoot generation)`,
        },
      ],
    },
    config: {
      responseMimeType: 'application/json',
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
          immutableElements: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'garmentCategory',
          'shirtKameezDesign',
          'trousersShawlDupatta',
          'dominantColors',
          'secondaryColors',
          'printPattern',
          'embroidery',
          'neckline',
          'sleeves',
          'borders',
          'motifs',
          'fabricAppearance',
          'importantVisualDetails',
          'immutableElements',
        ],
      },
    },
  });

  const parsed = JSON.parse(response.text || '{}');
  return {
    garmentCategory: parsed.garmentCategory || product.category,
    shirtKameezDesign: parsed.shirtKameezDesign || product.name,
    trousersShawlDupatta: parsed.trousersShawlDupatta || 'Matching tailored trousers',
    dominantColors: Array.isArray(parsed.dominantColors) ? parsed.dominantColors : ['Rich Jewel Tone'],
    secondaryColors: Array.isArray(parsed.secondaryColors) ? parsed.secondaryColors : ['Metallic Gold Zardozi'],
    printPattern: parsed.printPattern || 'Woven textile surface',
    embroidery: parsed.embroidery || product.fabricDetails,
    neckline: parsed.neckline || 'Embroidered portrait neckline',
    sleeves: parsed.sleeves || 'Full sleeves with embroidered border',
    borders: parsed.borders || 'Artisanal border detailing',
    motifs: parsed.motifs || 'Traditional South Asian motifs',
    fabricAppearance: parsed.fabricAppearance || product.fabricDetails,
    importantVisualDetails: Array.isArray(parsed.importantVisualDetails)
      ? parsed.importantVisualDetails
      : ['Preserve neckline and cuff embroidery geometry'],
    immutableElements: Array.isArray(parsed.immutableElements)
      ? parsed.immutableElements
      : ['Exact colors, embroidery placement, and silhouette proportions'],
    analyzedAt: new Date().toISOString(),
    modeUsed: 'live',
  };
}

/**
 * PHASE 2D — MASTER GENERATION INSTRUCTION BUILDER
 */
export function buildMasterFashionPrompt(params: {
  product: CatalogueProduct;
  analysis: GarmentAnalysis;
  config: ShootConfiguration;
  shotType: ShotPoseType;
  customPromptOverride?: string;
}): string {
  const { product, analysis, config, shotType, customPromptOverride } = params;

  const shotSpecifications: Record<
    ShotPoseType,
    { shotDesc: string; poseDesc: string; cameraDesc: string; compDesc: string }
  > = {
    'Full body': {
      shotDesc: 'full-body standing editorial photograph',
      poseDesc: 'poised natural full-length stance showcasing complete garment silhouette from shoulder to hem',
      cameraDesc: 'eye-level 50mm prime fashion photography',
      compDesc: 'full garment, hemline, and trouser drape clearly visible',
    },
    '3/4 standing': {
      shotDesc: 'three-quarter standing fashion editorial photograph',
      poseDesc: 'natural 3/4 angled stance with relaxed shoulders and one hand gently poised',
      cameraDesc: 'eye-level 85mm portrait lens framing from head to mid-calf',
      compDesc: 'shirt silhouette, neckline embroidery, and sleeve cuff borders prominently visible',
    },
    Walking: {
      shotDesc: 'dynamic walking motion editorial fashion photograph',
      poseDesc: 'graceful mid-stride movement capturing natural fabric flow and drape',
      cameraDesc: 'low-to-eye-level editorial tracking framing',
      compDesc: 'full garment in fluid motion with crisp focus on embroidery',
    },
    Seated: {
      shotDesc: 'seated luxury editorial fashion portrait',
      poseDesc: 'seated gracefully on a minimalist architectural plinth with upright posture',
      cameraDesc: 'medium-full editorial framing at eye level',
      compDesc: 'garment drape, neckline, and sleeve borders clearly visible without bunching',
    },
    'Detail portrait': {
      shotDesc: 'close-up 3/4 editorial beauty and garment craftsmanship portrait',
      poseDesc: 'serene editorial expression angled toward directional key light',
      cameraDesc: '85mm macro-editorial portrait framing from chest/waist up',
      compDesc: 'intricate neckline embroidery, sleeve cuff work, and fabric sheen as the primary focus',
    },
    'Back/side angle': {
      shotDesc: 'three-quarter side profile fashion editorial photograph',
      poseDesc: 'sculptural side-angle stance with head turned subtly toward camera',
      cameraDesc: 'eye-level editorial profile framing',
      compDesc: 'sleeve border, shoulder tailoring, and side slit drape clearly visible',
    },
    'Sleeve close-up': {
      shotDesc: 'tight editorial close-up of the sleeve',
      poseDesc: 'arm gently bent so the sleeve falls naturally without hiding the craft',
      cameraDesc: 'macro fashion close-up, sharp on the sleeve surface',
      compDesc: 'sleeve embroidery, fabric, and seam construction fill the frame',
    },
    'Neckline close-up': {
      shotDesc: 'tight editorial close-up of the neckline',
      poseDesc: 'shoulders relaxed, chin slightly lifted so the neckline sits undistorted',
      cameraDesc: 'macro fashion close-up from the collarbone to the upper chest',
      compDesc: 'neckline shape, embroidery, and edge finishing are the only subject',
    },
    'Embroidery close-up': {
      shotDesc: 'macro close-up of the garment embroidery',
      poseDesc: 'still pose that presents the embroidered panel flat to the lens',
      cameraDesc: 'macro lens with shallow depth, focused on thread and motif',
      compDesc: 'stitch texture, motif placement, and thread color fill the frame',
    },
    'Print / pattern close-up': {
      shotDesc: 'macro close-up of the garment print or pattern',
      poseDesc: 'fabric held or worn so the repeat lies flat and readable',
      cameraDesc: 'straight-on macro framing of the printed surface',
      compDesc: 'pattern scale, repeat, and color placement are clearly readable',
    },
    'Dupatta close-up': {
      shotDesc: 'close-up of the dupatta drape and border',
      poseDesc: 'dupatta falls naturally over one shoulder with the border visible',
      cameraDesc: 'close editorial framing on the dupatta fabric and edge',
      compDesc: 'dupatta weave, border, and drape are the subject, not the full outfit',
    },
    'Fabric texture': {
      shotDesc: 'extreme close-up of the fabric texture',
      poseDesc: 'garment surface presented so weave and sheen are readable',
      cameraDesc: 'macro lens raking across the cloth',
      compDesc: 'weave, sheen, and hand of the fabric fill the frame',
    },
    'Cuff / border detail': {
      shotDesc: 'close-up of the cuff or border detail',
      poseDesc: 'wrist or hem turned just enough to show the border without folding the craft away',
      cameraDesc: 'macro editorial framing on the cuff or border edge',
      compDesc: 'border width, stitching, and trim are sharply visible',
    },
    'Trouser detail': {
      shotDesc: 'close-up of the trouser or lower-garment detail',
      poseDesc: 'standing or seated so the trouser drape and hem are undistorted',
      cameraDesc: 'close framing from knee or hip to the hem',
      compDesc: 'trouser cut, pleat or gather, and hem finish are the subject',
    },
  };

  const lightingByStyle: Record<ShootStyleId, string> = {
    'Luxury Editorial': 'dramatic soft architectural window sunlight with sculpted shadows',
    'Minimal Studio': 'soft diffused professional studio cyclorama lighting',
    'Outdoor Lifestyle': 'warm golden-hour natural directional sunlight',
    'Boutique Catalogue': 'even, colour-accurate 5200K commercial studio lighting',
    Festive: 'warm evening editorial lighting accentuating metallic gold/silver threadwork luster',
    'Modern Pakistani Fashion': 'crisp contemporary daylight editorial contrast',
  };

  const spec = shotSpecifications[shotType] || shotSpecifications['Full body'];
  const bgDescription =
    config.background === 'Custom' && config.customBackgroundNote
      ? config.customBackgroundNote
      : config.background;

  return `Create a new professional fashion photograph using the supplied garment reference.

The garment is the primary source of truth.

Preserve the garment as accurately as possible:

* exact colors (${analysis.dominantColors.join(', ')}; accents: ${analysis.secondaryColors.join(', ')})
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
${analysis.immutableElements.map((el) => `- ${el}`).join('\n')}

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
${customPromptOverride ? `Additional Art Direction: ${customPromptOverride}` : ''}`;
}

function mapAspectRatioToGeminiConfig(
  ratio: AspectRatioType
): '1:1' | '3:4' | '9:16' {
  if (ratio === 'Square 1:1') return '1:1';
  if (ratio === 'Story 9:16') return '9:16';
  // Instagram Portrait 4:5 maps closest to 3:4 portrait plate in Gemini imageConfig
  return '3:4';
}

/**
 * PHASE 2D & 2E — SINGLE SHOT GEMINI IMAGE GENERATION
 * Each shot in a multi-shot shoot invokes this function separately with the original
 * garment reference image attached + the structured GarmentAnalysis + shot instructions.
 */
export async function generateFashionShotServer(params: {
  product: CatalogueProduct;
  analysis: GarmentAnalysis;
  config: ShootConfiguration;
  shotType: ShotPoseType;
  shotIndex: number;
  aiMode: AIMode;
  customPromptOverride?: string;
}): Promise<{
  imageUrl: string;
  promptNotes: string;
  masterPromptUsed: string;
  cropVariant: GeneratedShootImage['cropVariant'];
}> {
  const {
    product,
    analysis,
    config,
    shotType,
    shotIndex,
    aiMode,
    customPromptOverride,
  } = params;

  const masterPrompt = buildMasterFashionPrompt({
    product,
    analysis,
    config,
    shotType,
    customPromptOverride,
  });

  const conciseNotes =
    customPromptOverride ||
    `${shotType} framing in ${config.background.toLowerCase()} setting · ${config.shootStyle} lighting · ${config.model.skinComplexion} complexion, ${config.model.hairStyling.toLowerCase()} · Preserving ${analysis.embroidery.toLowerCase()}.`;

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
            data: garmentSource.data,
          },
        },
        {
          text: masterPrompt,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: mapAspectRatioToGeminiConfig(config.aspectRatio),
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  let generatedBase64: string | null = null;
  let generatedMime = 'image/png';

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
      'Gemini image model did not return an image part for this shot. Check model availability or retry.'
    );
  }

  const imageUrl = await storeMediaBuffer(
    Buffer.from(generatedBase64, 'base64'),
    generatedMime,
    `gemini-shoot-${shotIndex + 1}`
  );

  return {
    imageUrl,
    promptNotes: conciseNotes,
    masterPromptUsed: masterPrompt,
    cropVariant: 'full',
  };
}

/**
 * PHASE 2I — ORIGINAL INSTAGRAM COPY GENERATION
 * Generates original product title, short description, caption, hashtags, and CTA
 * without copying raw catalogue descriptions.
 */
export async function generateInstagramCopyServer(params: {
  product: CatalogueProduct;
  tone: InstagramPostDraft['captionTone'];
  style: string;
  aiMode: AIMode;
}): Promise<{
  productTitle: string;
  shortDescription: string;
  caption: string;
  hashtags: string[];
  cta: string;
  copyPromptUsed: string;
}> {
  const { product, tone, style } = params;
  void params.aiMode;

  try {
    const ai = createGeminiClient();
      const { textModel } = getGeminiConfig();
      const analysisSummary = product.garmentAnalysis
        ? JSON.stringify(product.garmentAnalysis)
        : product.fabricDetails;

      const copyPrompt = `You are the creative director for a luxury Pakistani fashion house.
Write original Instagram carousel copy for the following garment photographed in a "${style}" campaign with a "${tone}" voice.
CRITICAL RULE: Do NOT copy or repeat the raw catalogue specification text ("${product.rawCatalogueText}"). Write completely original, refined editorial storytelling based on the garment's visual traits:
Garment Name: ${product.name}
Visual Analysis: ${analysisSummary}`;

      const response = await generateContentWithFallback(ai, textModel, TEXT_MODEL_FALLBACKS, {
        contents: copyPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              productTitle: { type: Type.STRING },
              shortDescription: { type: Type.STRING },
              caption: { type: Type.STRING },
              hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
              cta: { type: Type.STRING },
            },
            required: ['productTitle', 'shortDescription', 'caption', 'hashtags', 'cta'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed.caption && parsed.productTitle) {
        return {
          productTitle: parsed.productTitle,
          shortDescription: parsed.shortDescription || '',
          caption: parsed.caption,
          hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : ['#Veyra'],
          cta:
            parsed.cta ||
            'Explore bespoke & standard sizing via the link in bio, or message our studio concierge.',
          copyPromptUsed: copyPrompt,
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate Instagram copy.';
      throw new Error(message);
    }

  throw new Error('Gemini did not return Instagram copy.');
}
