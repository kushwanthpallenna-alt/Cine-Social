import { withAuth } from "next-auth/middleware";

const authMiddleware = withAuth({
  pages: {
    signIn: "/auth/signin",
  },
});

export default function middleware(req: any, event: any) {
  return authMiddleware(req, event);
}

export const config = {
  matcher: [
    "/",
    "/movies",
    "/recommendations",
    "/api/tmdb",
  ],
};
