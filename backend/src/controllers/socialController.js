import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const COOKIE_RT_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 3 * 24 * 60 * 60 * 1000,
};

const providerConfig = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    getProfile: async (accessToken) => {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const d = await res.json();
      return { id: d.id, email: d.email, nickname: d.name, profileImage: d.picture };
    },
  },
  naver: {
    authUrl: 'https://nid.naver.com/oauth2.0/authorize',
    tokenUrl: 'https://nid.naver.com/oauth2.0/token',
    scope: null,
    clientId: () => process.env.NAVER_CLIENT_ID,
    clientSecret: () => process.env.NAVER_CLIENT_SECRET,
    getProfile: async (accessToken) => {
      const res = await fetch('https://openapi.naver.com/v1/nid/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const d = await res.json();
      const p = d.response;
      return { id: p.id, email: p.email, nickname: p.nickname || p.name, profileImage: p.profile_image };
    },
  },
  kakao: {
    authUrl: 'https://kauth.kakao.com/oauth/authorize',
    tokenUrl: 'https://kauth.kakao.com/oauth/token',
    scope: 'profile_nickname account_email',
    clientId: () => process.env.KAKAO_CLIENT_ID,
    clientSecret: () => process.env.KAKAO_CLIENT_SECRET,
    getProfile: async (accessToken) => {
      const res = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const d = await res.json();
      return {
        id: String(d.id),
        email: d.kakao_account?.email,
        nickname: d.kakao_account?.profile?.nickname,
        profileImage: d.kakao_account?.profile?.profile_image_url,
      };
    },
  },
};

function issueTokens(user) {
  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30m' }
  );
  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '3d' }
  );
  return { token, refreshToken };
}

export const redirectToProvider = (req, res) => {
  const { provider } = req.params;
  const config = providerConfig[provider];
  if (!config) return res.status(404).json({ message: '지원하지 않는 소셜 로그인입니다.' });

  const clientId = config.clientId();
  if (!clientId) {
    return res.status(503).json({ message: `${provider} 로그인이 아직 설정되지 않았습니다.` });
  }

  const state = crypto.randomUUID();
  const redirectUri = `${process.env.BACKEND_URL}/api/auth/${provider}/callback`;
  const role = ['user', 'guardian'].includes(req.query.role) ? req.query.role : 'user';

  const shortCookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
  };

  res.cookie('oauth_state', state, shortCookieOpts);
  res.cookie('oauth_role', role, shortCookieOpts);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    ...(config.scope && { scope: config.scope }),
  });

  res.redirect(`${config.authUrl}?${params}`);
};

export const handleCallback = async (req, res) => {
  const { provider } = req.params;
  const config = providerConfig[provider];
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!config) return res.redirect(`${frontendUrl}/oauth/callback?error=unsupported_provider`);

  const { code, state, error } = req.query;

  if (error) return res.redirect(`${frontendUrl}/oauth/callback?error=${encodeURIComponent(error)}`);

  const savedState = req.cookies?.oauth_state;
  const savedRole = req.cookies?.oauth_role || 'user';
  res.clearCookie('oauth_state');
  res.clearCookie('oauth_role');

  if (!state || state !== savedState) {
    return res.redirect(`${frontendUrl}/oauth/callback?error=invalid_state`);
  }

  try {
    const redirectUri = `${process.env.BACKEND_URL}/api/auth/${provider}/callback`;

    // code → access token
    const tokenRes = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId(),
        client_secret: config.clientSecret(),
        redirect_uri: redirectUri,
        code,
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error(`[Social] ${provider} token exchange failed:`, tokenData);
      return res.redirect(`${frontendUrl}/oauth/callback?error=token_exchange`);
    }

    const profile = await config.getProfile(tokenData.access_token);

    if (!profile.email) {
      return res.redirect(`${frontendUrl}/oauth/callback?error=no_email`);
    }

    // 기존 유저 확인 (providerId 우선, 없으면 email)
    let user = await User.findOne({ provider, providerId: profile.id });
    if (!user) user = await User.findOne({ email: profile.email });

    if (user) {
      if (!user.providerId) {
        user.provider = provider;
        user.providerId = profile.id;
        if (profile.profileImage && !user.profileImage) user.profileImage = profile.profileImage;
        await user.save();
      }
      const { token, refreshToken } = issueTokens(user);
      await User.findByIdAndUpdate(user._id, { refreshToken });
      res.cookie('refreshToken', refreshToken, COOKIE_RT_OPTIONS);
      return res.redirect(`${frontendUrl}/oauth/callback`);
    }

    // 신규 유저 — 탭에서 선택한 role로 바로 생성
    const newUser = await User.create({
      provider,
      providerId: profile.id,
      email: profile.email,
      nickname: profile.nickname || profile.email.split('@')[0],
      profileImage: profile.profileImage || null,
      role: savedRole,
      phoneVerified: false,
    });

    const { token, refreshToken } = issueTokens(newUser);
    await User.findByIdAndUpdate(newUser._id, { refreshToken });
    res.cookie('refreshToken', refreshToken, COOKIE_RT_OPTIONS);
    return res.redirect(`${frontendUrl}/oauth/callback`);
  } catch (err) {
    console.error(`[Social] ${provider} callback error:`, err.message);
    return res.redirect(`${frontendUrl}/oauth/callback?error=server`);
  }
};

