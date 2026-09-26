import {
  ShootConfiguration,
  ShootStyleId,
} from '../types/studio';

export const SHOOT_STYLE_PRESETS: Array<{
  id: ShootStyleId;
  title: ShootStyleId;
  subtitle: string;
  lightingNote: string;
}> = [
  {
    id: 'Luxury Editorial',
    title: 'Luxury Editorial',
    subtitle: 'Architectural shadows, sculptural poise, magazine-grade depth',
    lightingNote: 'Directional sunlight + 50mm f/1.4 shallow focus',
  },
  {
    id: 'Minimal Studio',
    title: 'Minimal Studio',
    subtitle: 'Clean alabaster backdrop, travertine plinths, pure garment focus',
    lightingNote: 'Soft diffused cyclorama key light',
  },
  {
    id: 'Outdoor Lifestyle',
    title: 'Outdoor Lifestyle',
    subtitle: 'Sunlit sandstone colonnades, natural movement, golden hour warmth',
    lightingNote: 'Late afternoon natural rim lighting',
  },
  {
    id: 'Boutique Catalogue',
    title: 'Boutique Catalogue',
    subtitle: 'True-to-color textile clarity, balanced posture, e-commerce ready',
    lightingNote: 'Even neutral 5200K commercial fill',
  },
  {
    id: 'Festive',
    title: 'Festive',
    subtitle: 'Rich evening ambiance, highlighted zardozi and tilla metallic luster',
    lightingNote: 'Warm tungsten specular highlights',
  },
  {
    id: 'Modern Pakistani Fashion',
    title: 'Modern Pakistani Fashion',
    subtitle: 'Contemporary South Asian silhouette styling with effortless drape',
    lightingNote: 'Crisp editorial daylight contrast',
  },
];

export const DEFAULT_SHOOT_CONFIG: ShootConfiguration = {
  model: {
    aiGenerated: true,
    gender: 'Female',
    modelStyle: 'Pakistani / South Asian',
    personaName: 'Ayla Raza (Lahore Editorial)',
    ageRange: '25–29',
    skinComplexion: 'Warm Olive',
    hairStyling: 'Sleek Center-Part Bun',
    stylingAccent: 'Minimal Gold Studs',
  },
  shootStyle: 'Luxury Editorial',
  poses: ['Full body', '3/4 standing', 'Detail portrait', 'Walking'],
  background: 'Minimal architectural',
  customBackgroundNote: '',
  aspectRatio: 'Instagram Portrait 4:5',
  numberOfImages: 4,
};
