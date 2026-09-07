import type { Meta, StoryObj } from "@storybook/react";
import { MusicChat } from "./MusicChat";
const meta = {
  title: "Music/MusicChat",
  component: MusicChat,
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="min-h-screen bg-gray-50 p-6 lg:ml-auto lg:w-[430px]"><Story /></div>],
} satisfies Meta<typeof MusicChat>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Welcome: Story = {};
