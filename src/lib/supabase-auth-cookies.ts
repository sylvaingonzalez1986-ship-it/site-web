type CookieReader = {
  getAll(): Array<{ name: string }>;
};

type CookieWriter = {
  cookies: {
    set: (
      name: string,
      value: string,
      options: {
        maxAge: number;
        expires: Date;
        path: string;
      },
    ) => void;
  };
};

export function isSupabaseAuthCookieName(name: string): boolean {
  return name.startsWith("sb-") && name.includes("-auth-token");
}

export function clearSupabaseAuthCookies(response: CookieWriter, cookieReader: CookieReader): void {
  for (const cookie of cookieReader.getAll()) {
    if (!isSupabaseAuthCookieName(cookie.name)) {
      continue;
    }

    response.cookies.set(cookie.name, "", {
      maxAge: 0,
      expires: new Date(0),
      path: "/",
    });
  }
}
