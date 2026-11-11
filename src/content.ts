/**
 * ─────────────────────────────────────────────────────────────
 *  content.ts — every word and image on the site lives here.
 *  Copy is Eniola's own, taken word-for-word from
 *  https://genuine-connections-me.lovable.app/
 *  *asterisks* mark italic emphasis.
 *
 *  Images:
 *   /images/eniola/eniola-*      her portrait (cut-out + background plate)
 *   /images/eniola/<name>.jpg    the photos from her Lovable site, downloaded
 *                                by `npm run fetch-images` (runs before dev/build).
 *                                Until then, quote cards stand in for them.
 * ─────────────────────────────────────────────────────────────
 */

export type StationId =
  | 'hero'
  | 'people'
  | 'faith'
  | 'work'
  | 'help'
  | 'fun'
  | 'style'
  | 'interesting'
  | 'sayhi'
  | 'footer';

/** One layer of a 2.5D photo stack. z is depth in world units (0 = back). */
export interface ImageLayer {
  src: string;
  z: number;
  /** scale of this layer relative to the stack size (default 1) */
  scale?: number;
  /** extra opacity (default 1) */
  opacity?: number;
  /** width / height of this layer if it differs from the stack's */
  aspect?: number;
  /** sub-rectangle of the image to show, in UV space: [u, v, width, height] */
  crop?: [number, number, number, number];
  /** portrait quote card shown instead of a crop while `src` is still a stand-in */
  standin?: string;
}

const IMG = '/images/eniola';
const portrait = { plate: `${IMG}/eniola-plate.webp`, cutout: `${IMG}/eniola-cutout.png` };
/** photos from her Lovable site (1400×1000, landscape 7:5) */
const photo = {
  relationships: `${IMG}/relationships.jpg`,
  faith: `${IMG}/faith.jpg`,
  career: `${IMG}/career.jpg`,
  help: `${IMG}/help.jpg`,
  loveDoing: `${IMG}/love-doing.jpg`,
  style: `${IMG}/style.jpg`,
  gold: `${IMG}/gold.jpg`,
};
const quote = (name: string) => `${IMG}/quotes/${name}.jpg`;
const frame = '/images/frame.png';
const leak = '/images/leak.png';

/** a 4:5 portrait crop out of a 7:5 landscape photo, starting at u (0–0.43) */
const tall = (u: number, zoom = 1): [number, number, number, number] => {
  const w = 0.5714 / zoom;
  const h = 1 / zoom;
  return [u, (1 - h) / 2, w, h];
};

export const site = {
  name: 'Eniola',
  logo: 'Eniola.',
  email: 'hello@eniola.co',
  title: 'Eniola · Get to know me',
  description:
    'This isn’t a résumé, and it definitely isn’t a highlight reel dressed up to impress you. The version of me you’d get after three good conversations.',
};

export const nav: { label: string; target: StationId }[] = [
  { label: 'People', target: 'people' },
  { label: 'Faith', target: 'faith' },
  { label: 'Work', target: 'work' },
  { label: 'Help', target: 'help' },
  { label: 'Say hi', target: 'sayhi' },
];

export const content = {
  hero: {
    kicker: 'A warm hello',
    headline: 'I’m *Eniola*.',
    paragraphs: [
      'Before you scroll further, let’s get one thing straight: this isn’t a résumé, and it definitely isn’t a highlight reel dressed up to impress you. Think of it as the version of me you’d get after three good conversations and a shared plate of something delicious: the real one, minus the small talk.',
      'I’m ambitious, deeply intentional, occasionally chaotic, and genuinely curious about people. You’ll find bits of my faith, my friendships, my career climb, the things I’m unreasonably passionate about, and a few boundaries I’m not negotiating on. Stay a while. I promise it’s worth it.',
    ],
    ctaPrimary: { label: 'Let’s connect', target: 'sayhi' as StationId },
    ctaSecondary: { label: 'Read on ↓', target: 'people' as StationId },
    image: [
      { src: portrait.plate, z: 0 },
      { src: portrait.cutout, z: 0.6 },
      { src: frame, z: 1.0, scale: 1.02 },
      { src: leak, z: 1.4, scale: 1.2, opacity: 0.2 },
    ] as ImageLayer[],
  },

  people: {
    kicker: 'The people',
    headline: 'My Relationships & Love',
    quote: 'If you’re in, you’re really in.',
    paragraphs: [
      'I’m a girl’s girl through and through, deeply loyal to a very small circle, and unreasonably proud of it. If you’re in, you’re really in. My friendships are where I show up hardest, though I’ll be honest: I live in my head a lot, so staying present takes real, deliberate effort on my part. Out of sight can genuinely mean out of mind for me. It’s not personal, it’s just how I’m wired, and I’m working on it.',
      'I’m always open to people who share my values. But my inner circle didn’t get there by accident, and it’s not expanding just because you asked nicely.',
    ],
    /** five frames, each a different moment cropped from the same photo */
    portraits: [
      [0.0, 1.0],
      [0.12, 1.25],
      [0.22, 1.0],
      [0.32, 1.3],
      [0.4286, 1.0],
    ].map(([u, zoom], i) => [
      { src: photo.relationships, z: 0, crop: tall(u, zoom), standin: quote(`people-${i + 1}`) },
      { src: frame, z: 0.35, scale: 1.02 },
      { src: leak, z: 0.6, scale: 1.1, opacity: 0.15 },
    ]) as ImageLayer[][],
  },

  faith: {
    kicker: 'Faith',
    headline: 'Building my own belief, on my own terms.',
    lines: [
      'I was raised in the church, but I’m no longer running on inherited belief. I’m building my own relationship with God, on my own terms, and holding myself accountable to it. My circle is walking this road with me.',
      'There’s a calling I’ve felt for a while now, one I’ve spent a good chunk of my life dodging. I’m not fully answering it yet. But I know it’s there, and I know I’ll come around to it eventually. When I do, I’m all in.',
    ],
    image: [
      { src: photo.faith, z: 0 },
      { src: frame, z: 0.4, scale: 1.02 },
      { src: leak, z: 0.8, scale: 1.25, opacity: 0.15 },
    ] as ImageLayer[],
  },

  work: {
    kicker: 'The work',
    headlineLeft: 'Soon-global.',
    headlineRight: 'Not someday-global.',
    paragraphs: [
      'I always saw myself in heels, climbing the ladder, becoming the boss everyone name-drops in meetings. Right now, I’m in it: locked in, doing the work, standing out in a field I refuse to be ordinary in. Global HR professional is the goal. Not someday-global. Soon-global.',
      'Funny enough, remote work was never part of the vision. I’m still adjusting to it, still low-key mourning the version of me who imagined mornings in an office, dressed up with somewhere to be. But I’m making it work, because that’s what I do.',
    ],
    tile: '/images/work-tile.webp',
    image: [
      { src: photo.career, z: 0 },
      { src: frame, z: 0.5, scale: 1.02 },
      { src: leak, z: 0.9, scale: 1.2, opacity: 0.15 },
    ] as ImageLayer[],
  },

  help: {
    kicker: 'How I can help',
    headline: 'If any of this sounds like you, come find me.',
    outro: 'If you need someone to sharpen your story, your document, or your event, I’m your person.',
    cards: [
      {
        title: 'CV revamps',
        body: 'I revamp CVs that aren’t landing interviews.',
        cta: 'Ask me',
        subject: 'CV revamp',
      },
      {
        title: 'Mentoring',
        body: 'I give early-career and university students the practical, no-fluff advice nobody handed me.',
        cta: 'Ask me',
        subject: 'Mentoring',
      },
      {
        title: 'Event moderating & hosting',
        body: 'I moderate and host events with actual energy in the room.',
        cta: 'Ask me',
        subject: 'Event moderating & hosting',
      },
    ],
    image: [
      { src: photo.help, z: 0 },
      { src: leak, z: 0.8, scale: 1.2, opacity: 0.15 },
    ] as ImageLayer[],
  },

  fun: {
    kicker: 'For fun',
    headline: 'What I Love Doing',
    items: [
      'K-dramas, unapologetically: my favorite way to disappear from the world for a while.',
      'Teaching and speaking, any chance to use my voice for something that matters.',
      'The cinema, especially quiet afternoon showings, sometimes solo, and those solo moments are some of my favorite in life.',
      'Real conversations with my people.',
      'A good nap that resets my entire nervous system.',
      'And novels. I miss them more than I let on, and I’m making my way back.',
    ],
    honest:
      'I also scroll. About two hours a day, most days. Not mindlessly. It’s how I stay curious, stay aware, keep learning about the world beyond my own bubble.',
    /** seven mixed-media frames for the carousel (photo + crop) */
    frames: [
      [photo.loveDoing, tall(0.2)],
      [photo.loveDoing, tall(0.0, 1.4)],
      [photo.relationships, tall(0.3, 1.2)],
      [portrait.plate, [0, 0, 1, 1]],
      [photo.help, tall(0.15)],
      [photo.style, tall(0.25, 1.2)],
      [photo.career, tall(0.4)],
    ].map(([src, crop], i) =>
      i === 3
        ? [
            { src: src as string, z: 0 },
            { src: portrait.cutout, z: 0.15 },
            { src: frame, z: 0.3, scale: 1.02 },
          ]
        : [
            {
              src: src as string,
              z: 0,
              crop: crop as [number, number, number, number],
              standin: quote(`fun-${i < 3 ? i + 1 : i}`),
            },
            { src: frame, z: 0.3, scale: 1.02 },
          ]
    ) as ImageLayer[][],
    phoneFeed: '/images/phone-feed.webp',
  },

  style: {
    kicker: 'Personal style',
    headline: 'My Style',
    body:
      'I’m not artistic. Not remotely creative. But when it comes to how I dress and how I move through decisions, I’m a minimalist to my core. Simple. Moderate. Nothing overdone. I don’t need to be the loudest thing in the room to be remembered.',
    /** back: the wardrobe flat lay · front: Eniola, 5.5 units closer (rack focus) */
    image: [
      { src: photo.style, z: 0 },
      { src: portrait.cutout, z: 5.5, scale: 0.6, aspect: 0.8 },
      { src: leak, z: 6.2, scale: 0.5, opacity: 0.25, aspect: 0.8 },
    ] as ImageLayer[],
  },

  interesting: {
    kicker: 'One thing you should know',
    headline: 'Something Interesting About Me',
    body:
      'I cannot wear fake jewelry. My body genuinely reacts to it. So it’s real gold or nothing at all. And yes, I’ve fully romanticized this as proof I was simply made for the finer things.',
    tag: 'Real gold or nothing at all.',
    image: [
      { src: photo.gold, z: 0 },
      { src: leak, z: 0.6, scale: 1.2, opacity: 0.15 },
    ] as ImageLayer[],
  },

  sayhi: {
    kicker: 'Say hi',
    headline: 'If you made it this far, we should probably talk.',
    body: 'Email works best. Socials work fine.',
    note: 'Coffee, in person or over video, works best of all.',
    email: { label: site.email, href: `mailto:${site.email}` },
    links: [
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/eniolaalawode/' },
    ],
    copiedToast: 'Email copied: hello@eniola.co',
  },

  footer: {
    headline: '*“The real thing, or nothing.”*',
    copyright: '© 2026 Eniola. Made with care.',
    backToStart: 'Back to the start',
  },
};

export const stationOrder: StationId[] = [
  'hero',
  'people',
  'faith',
  'work',
  'help',
  'fun',
  'style',
  'interesting',
  'sayhi',
  'footer',
];
