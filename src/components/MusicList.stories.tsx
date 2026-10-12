import type { Meta, StoryObj } from '@storybook/react';
import { MusicList } from './MusicList';

const meta = {
  title: 'Components/MusicList',
  component: MusicList,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  args: {
    query: '',
    page: 1,
    pageSize: 50,
    total: 6,
    lastPage: 1,
  },
} satisfies Meta<typeof MusicList>;

export default meta;
type Story = StoryObj<typeof meta>;

// 実データの傾向（和文タイトル・長いタイトル・プレイリストURL・タイトル未取得）を再現する
const mockUrls = [
  {
    message_id: '1',
    url: 'https://music.youtube.com/playlist?list=OLAK5uy_nIZetgKJuMQ7rConC54DIpHgB1G1u7v-Y&si=VTNPmtBJ9kPsWvf3',
    title: 'シュガーソルト',
    timestamp: '2026-10-05T20:06:05.354391+00:00',
  },
  {
    message_id: '2',
    url: 'https://youtu.be/tMKrECxEpq8?si=5yKlzPNcFDE3zrrf',
    title: '花譜　#22　「過去を喰らう」 【オリジナルMV】',
    timestamp: '2026-09-27T14:03:11.000000+00:00',
  },
  {
    message_id: '3',
    url: 'https://youtu.be/NfqAA_cLNoA?si=BQ09WKIfmtaB6Bv2',
    title: 'Little Mermaid Medley リトル・マーメイド・メドレー（2行に折り返す長さの例）',
    timestamp: '2026-09-22T03:29:44.000000+00:00',
  },
  {
    message_id: '4',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'ハイメンテナンスガール',
    timestamp: '2026-09-16T13:55:02.000000+00:00',
    dopamine: 8,
  },
  {
    message_id: '5',
    url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
    title: 'Awesome Spotify Track',
    timestamp: '2026-09-10T09:15:00.000000+00:00',
    dopamine: 5,
  },
  {
    message_id: '6',
    url: 'https://music.apple.com/jp/album/1234567890',
    timestamp: '2026-09-01T00:00:00.000000+00:00',
  },
];

export const Default: Story = {
  args: {
    items: mockUrls,
  },
};

// 2 ページ目。前へ/次へとページ番号が出る状態。
export const Paginated: Story = {
  args: {
    items: mockUrls,
    page: 2,
    total: 222,
    lastPage: 5,
  },
};

// 検索中。件数の表示とクリア導線が変わる。
export const SearchResults: Story = {
  args: {
    items: mockUrls.slice(1, 3),
    query: '花譜',
    total: 3,
    lastPage: 1,
  },
};

export const Empty: Story = {
  args: {
    items: [],
    total: 0,
    lastPage: 1,
  },
};

// 検索して 0 件。案内文とクリア導線だけになる。
export const NoResults: Story = {
  args: {
    items: [],
    query: '該当なし',
    total: 0,
    lastPage: 1,
  },
};
