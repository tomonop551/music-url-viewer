import NextAuth from "next-auth";
import Spotify from "next-auth/providers/spotify";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Workers（OpenNext）経由では x-forwarded-host が付かない非プロキシ環境があり、
  // 既定の trustHost 判定で UntrustedHost になる。Host の供給元は Workers の
  // routes 設定に限定されるため、ここで明示的に信頼する
  trustHost: true,
  providers: [
    Spotify({
      clientId: process.env.AUTH_SPOTIFY_ID,
      clientSecret: process.env.AUTH_SPOTIFY_SECRET,
      // オブジェクト形式の scope 指定は built-in の既定文字列と merge されず
      // Invalid URL になるため、endpoint ごと文字列で渡す
      authorization:
        "https://accounts.spotify.com/authorize?scope=playlist-modify-public+playlist-modify-private",
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 2 * 24 * 60 * 60,
  },
  callbacks: {
    // JWT callback で DB に触れると Workers で接続が嵐になる（既知の落とし穴）。
    // トークンは D1 に置かない方針なので、そもそも触る必要がない
    jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
  },
});
