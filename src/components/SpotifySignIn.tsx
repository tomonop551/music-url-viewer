"use client";

import { signIn } from "next-auth/react";

export function SpotifySignIn() {
  return (
    <button
      type="button"
      onClick={() => signIn("spotify", { callbackUrl: "/playlists" })}
      className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
    >
      Spotify と連携する
    </button>
  );
}
