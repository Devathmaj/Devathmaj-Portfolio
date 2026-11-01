import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MUSIC_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'music',
);

// Metadata is keyed by filename so the manifest always reflects what is
// actually in src/music, in a stable alphabetical order.
const ALBUM = 'The Listening Room';

const TRACKS = {
  'Canon_in_D_Major_(ISRC_USUAN1100301).mp3': {
    id: 'record-c02fee3539',
    title: 'Canon in D Major',
    artist: 'Johann Pachelbel',
    album: ALBUM,
    genre: 'Classical',
    colour: '#bda17c',
  },
  'FurElise.ogg': {
    id: 'record-921e37584a',
    title: 'Für Elise',
    artist: 'Ludwig van Beethoven',
    album: ALBUM,
    genre: 'Classical',
    colour: '#a96950',
  },
  'HoliznaCC0 - All The Way Sad.mp3': {
    id: 'record-461d77597d',
    title: 'All The Way Sad',
    artist: 'HoliznaCC0',
    album: ALBUM,
    genre: 'Lo-fi',
    colour: '#89987e',
  },
  'HoliznaCC0 - Funky Pop.mp3': {
    id: 'record-103000d085',
    title: 'Funky Pop',
    artist: 'HoliznaCC0',
    album: ALBUM,
    genre: 'Lo-fi',
    colour: '#9b899d',
  },
  'HoliznaCC0 - Happy Dance.mp3': {
    id: 'record-ec497b2097',
    title: 'Happy Dance',
    artist: 'HoliznaCC0',
    album: ALBUM,
    genre: 'Lo-fi',
    colour: '#b99461',
  },
  'Loyalty Freak Music - Coexistenz.mp3': {
    id: 'record-f5508470e4',
    title: 'Coexistenz',
    artist: 'Loyalty Freak Music',
    album: ALBUM,
    genre: 'Instrumental',
    colour: '#879fa1',
  },
  'Ludwig_van_Beethoven_-_Moonlight_sonata_classica_in_modern_(mp3.pm).mp3': {
    id: 'record-913be691c2',
    title: 'Moonlight sonata (classica in modern)',
    artist: 'Ludwig van Beethoven',
    album: ALBUM,
    genre: 'Classical',
    colour: '#ab8b77',
  },
  'sweet_sereneWAV.wav': {
    id: 'record-24efd79620',
    title: 'Sweet Serene',
    artist: 'Fablefly Music',
    album: ALBUM,
    genre: 'Ambient',
    colour: '#acaa83',
  },
};

const MIME_BY_EXTENSION = {
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

export function buildMusicManifest() {
  if (!fs.existsSync(MUSIC_DIR)) return [];

  return fs
    .readdirSync(MUSIC_DIR)
    .filter((file) => MIME_BY_EXTENSION[path.extname(file).toLowerCase()])
    .sort()
    .flatMap((file) => {
      const track = TRACKS[file];
      if (!track) return [];

      return [
        {
          ...track,
          duration: null,
          artwork: null,
          sources: [
            {
              src: `/music/${encodeURIComponent(file)}`,
              type: MIME_BY_EXTENSION[path.extname(file).toLowerCase()],
            },
          ],
        },
      ];
    });
}

export const MUSIC_ALBUM = {
  id: 'the-listening-room',
  title: ALBUM,
  artist: 'Various Artists',
  artwork: null,
};

