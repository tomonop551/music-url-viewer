import type { Meta, StoryObj } from "@storybook/react";

import { TodayPick } from "./TodayPick";

const meta = {
  title: "Components/TodayPick",
  component: TodayPick,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    dateKey: "2026-10-26",
  },
} satisfies Meta<typeof TodayPick>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    item: {
      message_id: "1",
      url: "https://youtu.be/tMKrECxEpq8?si=5yKlzPNcFDE3zrrf",
      title: "花譜　#22　「過去を喰らう」 【オリジナルMV】",
      timestamp: "2026-09-27T14:03:11.000000+00:00",
      dopamine: 8,
    },
  },
};

// タイトルが取れなかった行。URL をタイトル代わりに見せる。
export const NoTitle: Story = {
  args: {
    item: {
      message_id: "2",
      url: "https://music.apple.com/jp/album/1234567890",
      timestamp: "2026-09-01T00:00:00.000000+00:00",
    },
  },
};

// 中毒性が未評価の行（実際のカタログでは大多数がこちら）。バッジの行が崩れないこと。
export const NoDopamine: Story = {
  args: {
    item: {
      message_id: "3",
      url: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
      title: "Awesome Spotify Track",
      timestamp: "2026-09-10T09:15:00.000000+00:00",
    },
  },
};

// 長いタイトル（プレイリスト名など）。ヒーローでも折り返して収まること。
export const LongTitle: Story = {
  args: {
    item: {
      message_id: "4",
      url: "https://music.youtube.com/playlist?list=OLAK5uy_nIZetgKJuMQ7rConC54DIpHgB1G1u7v-Y&si=VTNPmtBJ9kPsWvf3",
      title:
        "Little Mermaid Medley リトル・マーメイド・メドレー（ヒーローでも 3 行に折り返す長さのタイトルの例）",
      timestamp: "2026-09-22T03:29:44.000000+00:00",
      dopamine: 5,
    },
  },
};
