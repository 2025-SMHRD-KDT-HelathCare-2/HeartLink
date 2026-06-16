// Access Token은 메모리에만 보관 (localStorage 사용 X → XSS 탈취 방지)
let accessToken: string | null = null;

export const setAccessToken = (t: string | null) => {
  accessToken = t;
};

export const getAccessToken = (): string | null => accessToken;
