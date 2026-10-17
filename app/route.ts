export function GET(request: Request) { return Response.redirect(new URL("/welcome.html", request.url), 302); }
