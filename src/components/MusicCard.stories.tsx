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

export const Default: Story = {
  args: {
    item: {
      message_id: '1',
      user_id: 'u1',
      user_name: 'John Doe',
      url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
      title: 'Awesome Spotify Track',
      timestamp: new Date().toISOString(),
    },
  },
};

export const YouTube: Story = {
  args: {
    item: {
      message_id: '2',
      user_id: 'u2',
      user_name: 'Jane Smith',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Awesome YouTube Video',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
    },
  },
};

export const NoTitle: Story = {
  args: {
    item: {
      message_id: '3',
      user_id: 'u3',
      user_name: 'Anonymous',
      url: 'https://example.com/music',
      timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  },
};
