import type { Meta, StoryObj } from '@storybook/react';
import { MusicCard } from './MusicCard';

const meta = {
  title: 'Components/MusicCard',
  component: MusicCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof MusicCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const YouTube: Story = {
  args: {
    item: {
      message_id: '1',
      url: 'https://youtu.be/tMKrECxEpq8?si=5yKlzPNcFDE3zrrf',
      title: '花譜　#22　「過去を喰らう」 【オリジナルMV】',
      timestamp: '2026-09-27T14:03:11.000000+00:00',
    },
  },
};

export const Spotify: Story = {
  args: {
    item: {
      message_id: '2',
      url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
      title: 'Awesome Spotify Track',
      timestamp: '2026-09-10T09:15:00.000000+00:00',
    },
  },
};

export const Dopamine: Story = {
  args: {
    item: {
      message_id: '3',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'ハイメンテナンスガール',
      timestamp: '2026-09-16T13:55:02.000000+00:00',
      dopamine: 8,
    },
  },
};

// タイトルが取れなかった行。URL をタイトル代わりに見せる。
export const NoTitle: Story = {
  args: {
    item: {
      message_id: '4',
      url: 'https://music.apple.com/jp/album/1234567890',
      timestamp: '2026-09-01T00:00:00.000000+00:00',
    },
  },
};

// プレイリストなど、タイトルとURL が両方長い行。
export const LongPlaylist: Story = {
  args: {
    item: {
      message_id: '5',
      url: 'https://music.youtube.com/playlist?list=OLAK5uy_nIZetgKJuMQ7rConC54DIpHgB1G1u7v-Y&si=VTNPmtBJ9kPsWvf3',
      title: 'Little Mermaid Medley リトル・マーメイド・メドレー（2行に折り返す長さの例）',
      timestamp: '2026-09-22T03:29:44.000000+00:00',
    },
  },
};
