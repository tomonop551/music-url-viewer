import type { Meta, StoryObj } from '@storybook/react';
import { MusicList } from './MusicList';

const meta = {
  title: 'Components/MusicList',
  component: MusicList,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof MusicList>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockUrls = [
  {
    message_id: '1',
    user_id: 'u1',
    user_name: 'John Doe',
    url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
    title: 'Awesome Spotify Track',
    timestamp: new Date().toISOString(),
  },
  {
    message_id: '2',
    user_id: 'u2',
    user_name: 'Jane Smith',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Awesome YouTube Video',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const Default: Story = {
  args: {
    initialMusicUrls: mockUrls,
  },
};

export const Empty: Story = {
  args: {
    initialMusicUrls: [],
  },
};
