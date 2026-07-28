import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SECRET_KEY || ""
);

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const { data: profile, error } = await supabaseAdmin
          .from("profiles")
          .select("user_id, username, display_name, avatar_url, password_hash")
          .eq("username", credentials.username.toLowerCase().trim())
          .maybeSingle();

        if (error || !profile || !profile.password_hash) return null;

        const isValid = await bcrypt.compare(credentials.password, profile.password_hash);
        if (!isValid) return null;

        return {
          id: profile.user_id,
          name: profile.display_name || profile.username,
          email: null,
          image: profile.avatar_url || null,
        };
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };

