import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  AspectRatioType,
  BackgroundType,
  CatalogueProduct,
  GeneratedShootImage,
  ImageCountOption,
  InstagramPostDraft,
  ShootConfiguration,
  ShootShotJob,
  ShootStyleId,
  ShotPoseType,
  StudioProject,
  StudioShoot,
} from './src/types/studio';
import { studioRepository, UPLOADS_DIR } from './src/server/repository';
import {
  analyzeProductGarmentServer,
  extractCatalogueProductsServer,
  generateFashionShotServer,
  generateInstagramCopyServer,
  getGeminiConfig,
} from './src/server/geminiService';
import { DEFAULT_SHOOT_CONFIG } from './src/data/studioDefaults';
import { storeMediaBuffer } from './src/server/mediaStore';
import { getStorageMode } from './src/server/stateStore';

const PORT = Number(process.env.PORT) || 3000;

function buildRuntime() {
  const geminiCfg = getGeminiConfig();
  return {
    aiMode: 'live' as const,
    envAiMode: 'live' as const,
    hasGeminiApiKey: geminiCfg.hasValidKey,
    imageModel: geminiCfg.imageModel,
    visionModel: geminiCfg.visionModel,
    textModel: geminiCfg.textModel,
    storageMode: getStorageMode(),
  };
}

// Security: sanitize text inputs (Phase 2K)
function sanitizeText(input: unknown, maxLength = 2000): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

// Security: validate allowed enum values (Phase 2K)
const ALLOWED_STYLES: ShootStyleId[] = [
  'Luxury Editorial',
  'Minimal Studio',
  'Outdoor Lifestyle',
  'Boutique Catalogue',
  'Festive',
  'Modern Pakistani Fashion',
];

const ALLOWED_POSES: ShotPoseType[] = [
  'Full body',
  '3/4 standing',
  'Walking',
  'Seated',
  'Detail portrait',
  'Back/side angle',
];

const ALLOWED_BACKGROUNDS: BackgroundType[] = [
  'Studio',
  'Luxury interior',
  'Minimal architectural',
  'Outdoor',
  'Custom',
];

const ALLOWED_RATIOS: AspectRatioType[] = [
  'Instagram Portrait 4:5',
  'Square 1:1',
  'Story 9:16',
];

// Security: Multer upload configuration with strict file type & size limits (25MB max)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max per file
    files: 12,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Only PDF, JPG, PNG, and WEBP files are allowed.'));
    }
  },
});

const shootLocks = new Set<string>();

async function advanceShootOneStep(shootId: string): Promise<StudioShoot | null> {
  if (shootLocks.has(shootId)) {
    return studioRepository.getShoot(shootId);
  }

  const existing = await studioRepository.getShoot(shootId);
  if (!existing) return null;
  if (existing.status === 'Complete' || existing.status === 'Failed') return existing;
  if (existing.pipelineBusyUntil && existing.pipelineBusyUntil > Date.now()) {
    return existing;
  }

  shootLocks.add(shootId);
  try {
    await studioRepository.updateShoot(shootId, {
      pipelineBusyUntil: Date.now() + 55_000,
    });

    const shoot = await studioRepository.getShoot(shootId);
    const product = shoot ? await studioRepository.getProduct(shoot.productId) : null;
    if (!shoot || !product) {
      return studioRepository.updateShoot(shootId, {
        status: 'Failed',
        errorMessage: 'Source garment product record not found.',
        pipelineBusyUntil: 0,
      });
    }

    const aiMode = await studioRepository.getAiMode();
    if (!product.garmentAnalysis) {
      await studioRepository.updateShoot(shootId, {
        status: 'Analyzing garment',
        jobs: shoot.jobs.map((job, idx) =>
          idx === 0 ? { ...job, status: 'Analyzing garment' } : job
        ),
      });
      const analysis = await analyzeProductGarmentServer(product, aiMode);
      await studioRepository.saveGarmentAnalysis(product.id, analysis);
      return studioRepository.updateShoot(shootId, {
        status: 'Generating',
        pipelineBusyUntil: 0,
      });
    }

    const jobs = [...shoot.jobs];
    const index = jobs.findIndex((job) => job.status !== 'Complete');
    if (index === -1) {
      return studioRepository.updateShoot(shootId, {
        status: 'Complete',
        pipelineBusyUntil: 0,
      });
    }

    const job = jobs[index];
    jobs[index] = { ...job, status: 'Generating' };
    await studioRepository.updateShoot(shootId, {
      status: 'Generating',
      jobs: [...jobs],
    });

    const shotResult = await generateFashionShotServer({
      product,
      analysis: product.garmentAnalysis,
      config: shoot.config,
      shotType: job.shotType,
      shotIndex: index,
      aiMode,
    });

    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const shortPersona = shoot.config.model.personaName.split(' ')[0];
    const newImage: GeneratedShootImage = {
      id: `img-${Date.now()}-${index + 1}`,
      shootId: shoot.id,
      productId: product.id,
      projectId: shoot.projectId,
      imageUrl: shotResult.imageUrl,
      garmentReferenceUrl: product.referenceImage || product.garmentImageUrl,
      productName: product.name,
      productSku: product.sku,
      shotType: job.shotType,
      modelSummary: `${shortPersona} · ${shoot.config.model.modelStyle} (${shoot.config.model.ageRange})`,
      style: shoot.config.shootStyle,
      background: shoot.config.background,
      aspectRatio: shoot.config.aspectRatio,
      status: 'Ready',
      promptNotes: shotResult.promptNotes,
      masterPromptUsed: shotResult.masterPromptUsed,
      cropVariant: shotResult.cropVariant,
      selectedForPost: index < 3,
      createdAt: `Today, ${nowTime}`,
    };

    await studioRepository.createGeneratedImage(newImage);
    jobs[index] = { ...job, status: 'Complete', imageId: newImage.id };
    const allDone = jobs.every((item) => item.status === 'Complete');
    if (allDone) {
      const latestProduct = await studioRepository.getProduct(product.id);
      if (latestProduct) {
        await studioRepository.updateProduct(product.id, {
          generatedCount: (latestProduct.generatedCount || 0) + jobs.length,
        });
      }
    }

    return studioRepository.updateShoot(shootId, {
      status: allDone ? 'Complete' : 'Generating',
      jobs,
      pipelineBusyUntil: 0,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : 'Unexpected error during fashion shoot generation.';
    console.error(`Shoot ${shootId} generation failed:`, message);
    const latestShoot = await studioRepository.getShoot(shootId);
    const updatedJobs: ShootShotJob[] = (latestShoot?.jobs || existing.jobs).map((job) =>
      job.status === 'Complete' ? job : { ...job, status: 'Failed', error: message }
    );
    return studioRepository.updateShoot(shootId, {
      status: 'Failed',
      errorMessage: message,
      jobs: updatedJobs,
      pipelineBusyUntil: 0,
    });
  } finally {
    shootLocks.delete(shootId);
  }
}


export function createApp() {
  const app = express();

  if (process.env.VERCEL) {
    app.use((req, _res, next) => {
      const url = req.url || '/';
      const queryIndex = url.indexOf('?');
      const pathOnly = queryIndex === -1 ? url : url.slice(0, queryIndex);
      const query = queryIndex === -1 ? '' : url.slice(queryIndex);
      if (pathOnly === '/api' || pathOnly.startsWith('/api/')) {
        next();
        return;
      }
      req.url = `/api${pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`}${query}`;
      next();
    });
  }

  app.use(express.json({ limit: '25mb' }));
  app.use('/uploads', express.static(UPLOADS_DIR));
  app.use('/src/assets', express.static(path.join(process.cwd(), 'src/assets')));

  // --- RUNTIME STATUS & DEVELOPMENT AI_MODE TOGGLE (Phase 2L) ---
  app.get('/api/status', async (_req, res) => {
    res.json(buildRuntime());
  });

  app.patch('/api/settings/mode', async (_req, res) => {
    res.json(buildRuntime());
  });

  // --- BOOTSTRAP FULL STATE ---
  app.get('/api/bootstrap', async (_req, res) => {
    const state = await studioRepository.getState();
    res.json({
      ...state,
      aiMode: 'live',
      runtime: buildRuntime(),
    });
  });

  // --- PHASE 2J: PROJECTS & CATALOGUE UPLOAD ---
  app.post('/api/projects', async (req, res) => {
    const name = sanitizeText(req.body?.name, 160) || 'Untitled Seasonal Collection';
    const sourceType =
      req.body?.sourceType === 'Garment Images' ? 'Garment Images' : 'Catalogue PDF';
    const sourceFileName =
      sanitizeText(req.body?.sourceFileName, 200) || 'Seasonal_Catalogue.pdf';

    const newProject: StudioProject = {
      id: `proj-${Date.now()}`,
      name,
      seasonCode: sanitizeText(req.body?.seasonCode, 12) || 'FW26',
      sourceType,
      sourceFileName,
      status: 'active',
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: 'Just now',
      productIds: [],
      shootIds: [],
      coverImageUrl: '',
      pages: [],
    };

    const created = await studioRepository.createProject(newProject);
    res.status(201).json(created);
  });

  app.post(
    '/api/projects/:id/catalogue',
    (req, res, next) => {
      upload.array('files', 12)(req, res, (err) => {
        if (err) {
          res.status(400).json({ error: err.message || 'File upload validation failed.' });
          return;
        }
        next();
      });
    },
    async (req, res) => {
      try {
        const projectId = sanitizeText(req.params.id, 80);
        let project = await studioRepository.getProject(projectId);

        const sourceType: 'Catalogue PDF' | 'Garment Images' =
          req.body?.sourceType === 'Garment Images' ? 'Garment Images' : 'Catalogue PDF';
        const projectName =
          sanitizeText(req.body?.projectName, 160) ||
          project?.name ||
          'Untitled Collection';

        const files = (req.files as Express.Multer.File[]) || [];
        if (files.length === 0) {
          res.status(400).json({
            error: 'Upload a catalogue PDF or garment images. Sample catalogues are no longer available.',
          });
          return;
        }

        const uploadedFiles = [];
        for (const file of files) {
          const isPdf =
            file.mimetype === 'application/pdf' ||
            file.originalname.toLowerCase().endsWith('.pdf');
          const mimeType = file.mimetype || (isPdf ? 'application/pdf' : 'image/jpeg');
          const publicUrl = isPdf
            ? ''
            : await storeMediaBuffer(file.buffer, mimeType, 'upload');
          uploadedFiles.push({
            originalName: file.originalname,
            mimeType,
            buffer: file.buffer,
            publicUrl,
          });
        }

        if (!project) {
          project = await studioRepository.createProject({
            id: projectId,
            name: projectName,
            seasonCode: 'FW26',
            sourceType,
            sourceFileName: uploadedFiles[0]?.originalName || 'catalogue-upload',
            status: 'active',
            createdAt: new Date().toISOString().slice(0, 10),
            updatedAt: 'Just now',
            productIds: [],
            shootIds: [],
            coverImageUrl: '',
          });
        }

        const aiMode = await studioRepository.getAiMode();
        const { products, pages } = await extractCatalogueProductsServer({
          projectId: project.id,
          sourceType,
          uploadedFiles,
          aiMode,
        });

        await studioRepository.createProducts(products);

        const updatedProject = await studioRepository.updateProject(project.id, {
          name: projectName,
          sourceType,
          sourceFileName:
            uploadedFiles[0]?.originalName || project.sourceFileName,
          productIds: [...products.map((p) => p.id), ...project.productIds],
          coverImageUrl: products[0]?.referenceImage || project.coverImageUrl,
          pages,
          status: 'active',
        });

        res.json({
          project: updatedProject,
          products,
          pages,
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to process catalogue upload.';
        res.status(500).json({ error: message });
      }
    }
  );

  // Manual Crop / Product Extraction Fallback from a Catalogue Page (Phase 2B)
  app.post('/api/projects/:id/manual-extract', async (req, res) => {
    try {
      const projectId = sanitizeText(req.params.id, 80);
      const project = await studioRepository.getProject(projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }

      const name = sanitizeText(req.body?.name, 140) || 'Manual Cropped Catalogue Piece';
      const sku = sanitizeText(req.body?.sku, 40) || `SKU-${Date.now().toString().slice(-6)}`;
      const category = sanitizeText(req.body?.category, 80) || 'Luxury Pret · Manual Crop';
      const fabricDetails =
        sanitizeText(req.body?.fabricDetails, 240) ||
        'Isolated from Catalogue Page via Studio Crop Tool';
      const sourcePage = Math.max(1, Number(req.body?.sourcePage) || 1);
      let imageUrl = sanitizeText(req.body?.croppedDataUrl, 10 * 1024 * 1024);

      // If client sent a base64 cropped canvas data URL, save it to /uploads/
      if (imageUrl.startsWith('data:image/')) {
        const match = imageUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (!match) {
          res.status(400).json({ error: 'Cropped garment image could not be read.' });
          return;
        }
        const mime = match[1].includes('png') ? 'image/png' : 'image/jpeg';
        imageUrl = await storeMediaBuffer(Buffer.from(match[2], 'base64'), mime, 'manual-crop');
      } else if (!imageUrl) {
        res.status(400).json({ error: 'A cropped garment image is required.' });
        return;
      }

      const newProduct: CatalogueProduct = {
        id: `prod-manual-${Date.now()}`,
        projectId: project.id,
        sku,
        name,
        category,
        fabricDetails,
        rawCatalogueText: `MANUAL PAGE CROP (PAGE ${sourcePage}) · SKU ${sku} · ${name.toUpperCase()}`,
        garmentImageUrl: imageUrl,
        referenceImage: imageUrl,
        sourcePage,
        detectedPage: sourcePage,
        garmentAnalysis: null,
        selected: true,
        createdAt: new Date().toISOString().slice(0, 10),
        generatedCount: 0,
      };

      await studioRepository.createProducts([newProduct]);
      await studioRepository.updateProject(project.id, {
        productIds: [newProduct.id, ...project.productIds],
      });

      res.status(201).json(newProduct);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Manual product extraction failed.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/projects/:id/products', async (req, res) => {
    const projectId = sanitizeText(req.params.id, 80);
    const products = await studioRepository.listProducts(projectId);
    res.json(products);
  });

  // --- PHASE 2C & 2J: PRODUCTS & GARMENT ANALYSIS ---
  app.get('/api/products/:id', async (req, res) => {
    const product = await studioRepository.getProduct(sanitizeText(req.params.id, 80));
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    res.json(product);
  });

  app.post('/api/products/:id/analyze', async (req, res) => {
    try {
      const productId = sanitizeText(req.params.id, 80);
      const product = await studioRepository.getProduct(productId);
      if (!product) {
        res.status(404).json({ error: 'Product not found.' });
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
        garmentAnalysis: analysis,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to analyze garment.';
      res.status(500).json({ error: message });
    }
  });

  // --- PHASE 2D, 2E, 2F & 2J: SHOOTS & MULTI-SHOT GENERATION ---
  app.post('/api/products/:id/shoots', async (req, res) => {
    try {
      const productId = sanitizeText(req.params.id, 80);
      const product = await studioRepository.getProduct(productId);
      if (!product) {
        res.status(404).json({ error: 'Product not found.' });
        return;
      }

      const incomingConfig = (req.body?.config || {}) as Partial<ShootConfiguration>;

      // Validate and sanitize shoot configuration parameters (Phase 2K)
      const shootStyle: ShootStyleId = ALLOWED_STYLES.includes(
        incomingConfig.shootStyle as ShootStyleId
      )
        ? (incomingConfig.shootStyle as ShootStyleId)
        : DEFAULT_SHOOT_CONFIG.shootStyle;

      const rawPoses = Array.isArray(incomingConfig.poses)
        ? incomingConfig.poses.filter((p): p is ShotPoseType =>
            ALLOWED_POSES.includes(p as ShotPoseType)
          )
        : [];
      const poses: ShotPoseType[] =
        rawPoses.length > 0 ? rawPoses : DEFAULT_SHOOT_CONFIG.poses;

      const background: BackgroundType = ALLOWED_BACKGROUNDS.includes(
        incomingConfig.background as BackgroundType
      )
        ? (incomingConfig.background as BackgroundType)
        : DEFAULT_SHOOT_CONFIG.background;

      const aspectRatio: AspectRatioType = ALLOWED_RATIOS.includes(
        incomingConfig.aspectRatio as AspectRatioType
      )
        ? (incomingConfig.aspectRatio as AspectRatioType)
        : DEFAULT_SHOOT_CONFIG.aspectRatio;

      const validCounts: ImageCountOption[] = [1, 2, 4, 6];
      const numberOfImages: ImageCountOption = validCounts.includes(
        Number(incomingConfig.numberOfImages) as ImageCountOption
      )
        ? (Number(incomingConfig.numberOfImages) as ImageCountOption)
        : 4;

      const sanitizedConfig: ShootConfiguration = {
        model: {
          aiGenerated: true,
          gender: 'Female',
          modelStyle: 'Pakistani / South Asian',
          personaName:
            sanitizeText(incomingConfig.model?.personaName, 80) ||
            DEFAULT_SHOOT_CONFIG.model.personaName,
          ageRange:
            incomingConfig.model?.ageRange === '20–24' ||
            incomingConfig.model?.ageRange === '25–29' ||
            incomingConfig.model?.ageRange === '30–35'
              ? incomingConfig.model.ageRange
              : '25–29',
          skinComplexion:
            incomingConfig.model?.skinComplexion ||
            DEFAULT_SHOOT_CONFIG.model.skinComplexion,
          hairStyling:
            incomingConfig.model?.hairStyling ||
            DEFAULT_SHOOT_CONFIG.model.hairStyling,
          stylingAccent:
            incomingConfig.model?.stylingAccent ||
            DEFAULT_SHOOT_CONFIG.model.stylingAccent,
        },
        shootStyle,
        poses,
        background,
        customBackgroundNote: sanitizeText(
          incomingConfig.customBackgroundNote,
          300
        ),
        aspectRatio,
        numberOfImages,
      };

      const shootId = `shoot-${Date.now()}`;

      // Phase 2E: Create separate generation jobs for each requested shot
      const jobs: ShootShotJob[] = Array.from({ length: numberOfImages }).map(
        (_, idx) => ({
          id: `job-${shootId}-${idx + 1}`,
          shootId,
          shotType: poses[idx % poses.length],
          status: 'Queued',
        })
      );

      const newShoot: StudioShoot = {
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
          numberOfImages: sanitizedConfig.numberOfImages,
        },
        aspectRatio: sanitizedConfig.aspectRatio,
        status: 'Queued',
        jobs,
        config: sanitizedConfig,
        images: [],
        createdAt: new Date().toISOString().slice(0, 10),
      };

      const created = await studioRepository.createShoot(newShoot);
      res.status(201).json(created);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create shoot.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/shoots/:id/generate', async (req, res) => {
    const shootId = sanitizeText(req.params.id, 80);
    const shoot = await studioRepository.getShoot(shootId);
    if (!shoot) {
      res.status(404).json({ error: 'Shoot not found.' });
      return;
    }

    res.json({
      message: 'Shoot generation started.',
      shoot,
    });
  });

  app.get('/api/shoots/:id', async (req, res) => {
    const shootId = sanitizeText(req.params.id, 80);
    const shoot = await advanceShootOneStep(shootId);
    if (!shoot) {
      res.status(404).json({ error: 'Shoot not found.' });
      return;
    }
    const product = await studioRepository.getProduct(shoot.productId);
    res.json({
      shoot,
      garmentAnalysis: product?.garmentAnalysis || null,
    });
  });

  // --- PHASE 2H & 2J: INDIVIDUAL IMAGE REGENERATION & DELETION ---
  app.post('/api/generated-images/:id/regenerate', async (req, res) => {
    try {
      const imageId = sanitizeText(req.params.id, 80);
      const existingImage = await studioRepository.getGeneratedImage(imageId);
      if (!existingImage) {
        res.status(404).json({ error: 'Generated image not found.' });
        return;
      }

      const product = await studioRepository.getProduct(existingImage.productId);
      if (!product) {
        res.status(404).json({ error: 'Associated garment product not found.' });
        return;
      }

      const shoot = await studioRepository.getShoot(existingImage.shootId);
      const aiMode = await studioRepository.getAiMode();

      // Allow overriding prompt, pose/shotType, background, or style (Phase 2H)
      const nextShotType: ShotPoseType = ALLOWED_POSES.includes(
        req.body?.shotType as ShotPoseType
      )
        ? (req.body.shotType as ShotPoseType)
        : existingImage.shotType;

      const nextStyle: ShootStyleId = ALLOWED_STYLES.includes(
        req.body?.style as ShootStyleId
      )
        ? (req.body.style as ShootStyleId)
        : existingImage.style;

      const nextBackground: BackgroundType = ALLOWED_BACKGROUNDS.includes(
        req.body?.background as BackgroundType
      )
        ? (req.body.background as BackgroundType)
        : existingImage.background;

      const customPrompt = sanitizeText(req.body?.promptNotes, 1000);

      await studioRepository.updateGeneratedImage(imageId, {
        status: 'Regenerating',
      });

      const baseConfig: ShootConfiguration = shoot?.config || {
        ...DEFAULT_SHOOT_CONFIG,
        shootStyle: nextStyle,
        background: nextBackground,
        aspectRatio: existingImage.aspectRatio,
      };

      const mergedConfig: ShootConfiguration = {
        ...baseConfig,
        shootStyle: nextStyle,
        background: nextBackground,
      };

      const analysis =
        product.garmentAnalysis ||
        (await analyzeProductGarmentServer(product, aiMode));

      const regenResult = await generateFashionShotServer({
        product,
        analysis,
        config: mergedConfig,
        shotType: nextShotType,
        shotIndex: Math.floor(Math.random() * 4),
        aiMode,
        customPromptOverride: customPrompt || existingImage.promptNotes,
      });

      const updated = await studioRepository.updateGeneratedImage(imageId, {
        imageUrl: regenResult.imageUrl,
        shotType: nextShotType,
        style: nextStyle,
        background: nextBackground,
        promptNotes: regenResult.promptNotes,
        masterPromptUsed: regenResult.masterPromptUsed,
        cropVariant: regenResult.cropVariant,
        status: 'Refined',
      });

      res.json(updated);
    } catch (err: unknown) {
      const imageId = sanitizeText(req.params.id, 80);
      const message =
        err instanceof Error ? err.message : 'Failed to regenerate image.';
      await studioRepository.updateGeneratedImage(imageId, {
        status: 'Ready',
        errorMessage: message,
      });
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/generated-images/:id', async (req, res) => {
    const imageId = sanitizeText(req.params.id, 80);
    const deleted = await studioRepository.deleteGeneratedImage(imageId);
    if (!deleted) {
      res.status(404).json({ error: 'Image not found.' });
      return;
    }
    res.json({ deleted: true, id: imageId });
  });

  // --- PHASE 2I & 2J: INSTAGRAM POST BUILDER & COPY GENERATION ---
  app.post('/api/posts/generate-copy', async (req, res) => {
    try {
      const productId = sanitizeText(req.body?.productId, 80);
      const product =
        (await studioRepository.getProduct(productId)) ||
        (await studioRepository.listProducts())[0];

      if (!product) {
        res.status(404).json({ error: 'Product not found for copy generation.' });
        return;
      }

      const tone = (req.body?.tone ||
        'Editorial Storytelling') as InstagramPostDraft['captionTone'];
      const style = sanitizeText(req.body?.style, 80) || 'Luxury Editorial';
      const aiMode = await studioRepository.getAiMode();

      const generatedCopy = await generateInstagramCopyServer({
        product,
        tone,
        style,
        aiMode,
      });

      res.json(generatedCopy);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate Instagram copy.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/posts', async (req, res) => {
    const body = req.body || {};
    const selectedImages = Array.isArray(body.carouselImageIds)
      ? body.carouselImageIds.map((id: unknown) => sanitizeText(id, 80))
      : Array.isArray(body.selectedImages)
      ? body.selectedImages.map((id: unknown) => sanitizeText(id, 80))
      : [];

    const coverImageId =
      sanitizeText(body.coverImageId || body.coverImage, 80) ||
      selectedImages[0] ||
      '';
    const shortDesc = sanitizeText(
      body.shortDescription || body.description,
      500
    );

    const newPost: InstagramPostDraft = {
      id: `post-${Date.now()}`,
      projectId: sanitizeText(body.projectId, 80),
      productId: sanitizeText(body.productId, 80),
      shootId: sanitizeText(body.shootId, 80),
      productTitle:
        sanitizeText(body.productTitle, 160) || 'Editorial Collection Piece',
      shortDescription: shortDesc,
      description: shortDesc,
      caption: sanitizeText(body.caption, 2200),
      captionTone: body.captionTone || 'Editorial Storytelling',
      hashtags: Array.isArray(body.hashtags)
        ? body.hashtags.map((h: unknown) => sanitizeText(h, 60)).filter(Boolean)
        : [],
      cta: sanitizeText(body.cta, 300),
      aspectRatio: 'Instagram Portrait 4:5',
      carouselImageIds: selectedImages,
      selectedImages,
      coverImageId,
      coverImage: coverImageId,
      status: body.status === 'Ready to Publish' ? 'Ready to Publish' : 'Draft',
      updatedAt: 'Just now',
    };

    const created = await studioRepository.createPost(newPost);
    res.status(201).json(created);
  });

  app.patch('/api/posts/:id', async (req, res) => {
    const postId = sanitizeText(req.params.id, 80);
    const updated = await studioRepository.updatePost(postId, req.body || {});
    if (!updated) {
      res.status(404).json({ error: 'Post draft not found.' });
      return;
    }
    res.json(updated);
  });

  app.delete('/api/posts/:id', async (req, res) => {
    const postId = sanitizeText(req.params.id, 80);
    const deleted = await studioRepository.deletePost(postId);
    if (!deleted) {
      res.status(404).json({ error: 'Post draft not found.' });
      return;
    }
    res.json({ deleted: true, id: postId });
  });

  app.get(/^\/api\/media\/(.+)$/, async (req, res) => {
    let pathname = '';
    try {
      pathname = decodeURIComponent(req.params[0] || '');
    } catch {
      res.status(400).json({ error: 'Invalid media path.' });
      return;
    }
    if (!pathname.startsWith('media/') || pathname.includes('..') || pathname.includes('\\')) {
      res.status(400).json({ error: 'Invalid media path.' });
      return;
    }
    const { get } = await import('@vercel/blob');
    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200 || !result.stream) {
      res.status(404).json({ error: 'Media not found.' });
      return;
    }
    res.setHeader('Content-Type', result.blob.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
    res.end(bytes);
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Unknown API route.', path: req.originalUrl });
  });

  return app;
}

export async function startDevServer() {
  const app = createApp();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Atelier Noor server running on http://localhost:${PORT}`);
  });
}

