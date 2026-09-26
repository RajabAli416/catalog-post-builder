import React, { useState } from 'react';
import { Check, Cpu, Sliders } from 'lucide-react';
import { AIMode, StudioRuntimeStatus } from '../../types/studio';

interface SettingsViewProps {
  runtimeStatus?: StudioRuntimeStatus | null;
  onToggleAIMode?: (mode: AIMode) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  runtimeStatus,
  onToggleAIMode,
}) => {
  const [studioHandle, setStudioHandle] = useState('@ateliernoor.official');
  const [defaultRegion, setDefaultRegion] = useState('Pakistani / South Asian');
  const [colorProfile, setColorProfile] = useState('Display P3 · 4:5 Lossless JPEG');
  const [saved, setSaved] = useState(false);
  const [switchingMode, setSwitchingMode] = useState(false);

  const currentMode: AIMode = runtimeStatus?.aiMode || 'mock';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const handleModeSwitch = async (mode: AIMode) => {
    if (!onToggleAIMode || mode === currentMode) return;
    setSwitchingMode(true);
    try {
      await onToggleAIMode(mode);
    } finally {
      setSwitchingMode(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8 pb-16">
      <div className="border-b border-[#E6E4DD] pb-5">
        <div className="flex items-center gap-2 text-xs text-[#6E6B62] mb-1">
          <span>Studio Configuration</span>
          <span aria-hidden="true">·</span>
          <span>Preferences & Pipeline Defaults</span>
        </div>
        <h1 className="font-editorial text-3xl md:text-4xl font-semibold text-[#141413]">
          Studio Settings
        </h1>
        <p className="mt-1 text-sm text-[#57554E]">
          Configure default talent casting, Instagram brand voice standards, and export color profiles.
        </p>
      </div>

      {/* Phase 2K: AI Engine Mode Switcher (Mock / Demo Mode vs Gemini Live Mode) */}
      <div className="bg-white border border-[#E2DFD7] p-6 md:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6E4DD] pb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#141413]" />
            <h2 className="font-editorial text-2xl font-semibold text-[#141413]">
              Gemini Pipeline Runtime Mode
            </h2>
          </div>
          <span className="font-mono text-xs text-[#57554E]">
            AI_MODE={currentMode}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            disabled={switchingMode}
            onClick={() => handleModeSwitch('mock')}
            className={`p-4 text-left border transition-colors ${
              currentMode === 'mock'
                ? 'bg-[#141413] text-white border-[#141413]'
                : 'bg-[#FAF9F5] text-[#141413] border-[#E2DFD7] hover:border-[#78756C]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">
                MODE 1 — MOCK / DEMO MODE
              </span>
              {currentMode === 'mock' && <Check className="w-3.5 h-3.5" />}
            </div>
            <p
              className={`mt-1.5 text-xs leading-relaxed ${
                currentMode === 'mock' ? 'text-[#D6D3C9]' : 'text-[#6E6B62]'
              }`}
            >
              Uses curated high-res editorial garment plates and deterministic structured garment analysis when Gemini API credits are not being tested.
            </p>
          </button>

          <button
            type="button"
            disabled={switchingMode}
            onClick={() => handleModeSwitch('live')}
            className={`p-4 text-left border transition-colors ${
              currentMode === 'live'
                ? 'bg-[#141413] text-white border-[#141413]'
                : 'bg-[#FAF9F5] text-[#141413] border-[#E2DFD7] hover:border-[#78756C]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">
                MODE 2 — GEMINI LIVE MODE
              </span>
              {currentMode === 'live' && <Check className="w-3.5 h-3.5" />}
            </div>
            <p
              className={`mt-1.5 text-xs leading-relaxed ${
                currentMode === 'live' ? 'text-[#D6D3C9]' : 'text-[#6E6B62]'
              }`}
            >
              Executes real server-side Gemini Vision garment inspection, multi-shot image generation with garment reference preservation, and original Instagram copy.
            </p>
          </button>
        </div>

        <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs border-t border-[#E6E4DD]">
          <div>
            <span className="text-[#78756C] block">Image Generation Model</span>
            <span className="font-mono text-[#141413] font-medium">
              {runtimeStatus?.imageModel || 'gemini-3.1-flash-image-preview'}
            </span>
          </div>
          <div>
            <span className="text-[#78756C] block">Vision & Copy Model</span>
            <span className="font-mono text-[#141413] font-medium">
              {runtimeStatus?.visionModel || 'gemini-3-flash-preview'}
            </span>
          </div>
          <div>
            <span className="text-[#78756C] block">Server API Key Status</span>
            <span className="font-mono text-[#141413] font-medium">
              {runtimeStatus?.hasGeminiApiKey
                ? 'Configured (Server-Side)'
                : 'Pending GEMINI_API_KEY'}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-[#E2DFD7] p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-2 border-b border-[#E6E4DD] pb-3">
          <Sliders className="w-4 h-4 text-[#141413]" />
          <h2 className="font-editorial text-2xl font-semibold text-[#141413]">
            Default Brand & Casting Standards
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="studio-ig-handle"
              className="block text-xs font-medium text-[#141413] mb-2"
            >
              Instagram Brand Handle
            </label>
            <input
              id="studio-ig-handle"
              type="text"
              value={studioHandle}
              onChange={(e) => setStudioHandle(e.target.value)}
              className="w-full bg-[#FAF9F5] border border-[#D6D3C9] px-3.5 py-2.5 text-sm text-[#141413] focus:outline-none focus:border-[#141413]"
            />
          </div>

          <div>
            <label
              htmlFor="default-casting-region"
              className="block text-xs font-medium text-[#141413] mb-2"
            >
              Default Editorial Model Style
            </label>
            <select
              id="default-casting-region"
              value={defaultRegion}
              onChange={(e) => setDefaultRegion(e.target.value)}
              className="w-full bg-[#FAF9F5] border border-[#D6D3C9] px-3.5 py-2.5 text-sm text-[#141413] focus:outline-none focus:border-[#141413]"
            >
              <option value="Pakistani / South Asian">
                Pakistani / South Asian (Female Editorial)
              </option>
              <option value="Global South Asian">
                Global South Asian Diaspora
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="default-color-profile"
              className="block text-xs font-medium text-[#141413] mb-2"
            >
              Plate Export Profile
            </label>
            <select
              id="default-color-profile"
              value={colorProfile}
              onChange={(e) => setColorProfile(e.target.value)}
              className="w-full bg-[#FAF9F5] border border-[#D6D3C9] px-3.5 py-2.5 text-sm text-[#141413] focus:outline-none focus:border-[#141413]"
            >
              <option value="Display P3 · 4:5 Lossless JPEG">
                Display P3 · 4:5 Lossless JPEG (1080 × 1350)
              </option>
              <option value="sRGB · High-Res Editorial TIFF">
                sRGB · High-Res Editorial PNG (2160 × 2700)
              </option>
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-[#141413] mb-2">
              Copywriting Originality Guardrail
            </span>
            <div className="p-3 bg-[#FAF9F5] border border-[#E6E4DD] text-xs text-[#57554E]">
              Enforced: Instagram captions never reproduce verbatim line-sheet SKU specifications.
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[#E6E4DD] flex items-center justify-between">
          <span className="text-xs text-[#6E6B62]">
            Persistence Layer: Active project state synced to backend repository
          </span>
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] transition-colors whitespace-nowrap"
          >
            {saved ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Preferences Saved
              </>
            ) : (
              'Save Studio Defaults'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
